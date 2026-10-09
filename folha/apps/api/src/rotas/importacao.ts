import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/index.js";
import { aplicarImportacao, previaImportacao } from "../servicos/importacao.js";

const Corpo = z.object({
  tipo: z.enum(["funcionarios", "empresas"]),
  empresaId: z.string().optional(),
  linhas: z.array(z.record(z.string(), z.unknown())).min(1, "Arquivo sem linhas").max(5000),
});

export function rotasImportacao(app: FastifyInstance, db: Db) {
  app.post("/api/importacao/previa", (req) => {
    const b = Corpo.parse(req.body);
    return previaImportacao(db, b.tipo, b.linhas, b.empresaId);
  });
  app.post("/api/importacao/aplicar", (req) => {
    const b = Corpo.parse(req.body);
    return aplicarImportacao(db, b.tipo, b.linhas, req.usuario, b.empresaId);
  });
}
