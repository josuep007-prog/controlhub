import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Db } from "./db/index.js";
import { usuarios } from "./db/schema.js";
import { rotasCadastros } from "./rotas/cadastros.js";
import { rotasFolha } from "./rotas/folha.js";
import { rotasImportacao } from "./rotas/importacao.js";
import { mensagemValidacao } from "./esquemas.js";
import { ErroNegocio } from "./util.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Nome de quem fez a requisição (cabeçalho x-usuario com o id do usuário). */
    usuario: string;
  }
}

export async function criarApp(db: Db, opcoes: { pastaWeb?: string; logger?: boolean } = {}) {
  const app = Fastify({ logger: opcoes.logger ?? false, bodyLimit: 20 * 1024 * 1024 });

  app.decorateRequest("usuario", "");
  app.addHook("preHandler", async (req) => {
    const id = req.headers["x-usuario"];
    req.usuario = "sistema";
    if (typeof id === "string" && id) {
      const [u] = await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, id));
      if (u) req.usuario = u.nome;
    }
  });

  app.setErrorHandler((erro, _req, reply) => {
    if (erro instanceof ZodError) {
      return reply.status(400).send({ erro: mensagemValidacao(erro) });
    }
    if (erro instanceof ErroNegocio) return reply.status(erro.status).send({ erro: erro.message });
    const e = erro as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ erro: e.message });
    app.log.error(erro);
    return reply.status(500).send({ erro: "Erro interno. Tente de novo ou avise o suporte." });
  });

  rotasCadastros(app, db);
  rotasFolha(app, db);
  rotasImportacao(app, db);

  // Em produção a API também serve o front-end compilado (apps/web/dist).
  if (opcoes.pastaWeb && existsSync(opcoes.pastaWeb)) {
    await app.register(fastifyStatic, { root: opcoes.pastaWeb });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ erro: "Rota não encontrada" });
      return reply.sendFile("index.html");
    });
  }

  return app;
}
