import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { montarRascunhoDeExtracao } from "../admissao-regras.js";
import type { Db } from "../db/index.js";
import { empresas } from "../db/schema.js";
import { registrarAuditoria, ErroNegocio } from "../util.js";
import type { Extrator } from "../servicos/extracao.js";

const Corpo = z.object({
  empresaId: z.string(),
  arquivos: z
    .array(z.object({ nome: z.string().min(1).max(200), tipo: z.string(), base64: z.string().optional(), texto: z.string().max(200_000).optional() }))
    .min(1, "Envie pelo menos um documento."),
});

export function rotasAdmissao(app: FastifyInstance, db: Db, extrator: Extrator) {
  /** Lê os documentos e devolve um rascunho para conferir. Não grava nada. */
  app.post("/api/admissao/extrair", { bodyLimit: 60 * 1024 * 1024 }, async (req) => {
    const b = Corpo.parse(req.body);
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, b.empresaId));
    if (!empresa) throw new ErroNegocio("Empresa não encontrada", 404);
    const resposta = await extrator({ empresa: { razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj }, arquivos: b.arquivos });
    const rascunho = montarRascunhoDeExtracao(resposta);
    // Só o que foi lido e a quantidade de arquivos; nunca o conteúdo dos documentos.
    await registrarAuditoria(db, req.usuario, "ler_documentos", "empresa", empresa.id, {
      arquivos: b.arquivos.map((a) => a.nome),
      pendencias: rascunho.pendencias.length,
    });
    return rascunho;
  });
}
