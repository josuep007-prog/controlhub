import { randomUUID } from "node:crypto";
import type { Db } from "./db/index.js";
import { auditoria } from "./db/schema.js";

export const uid = () => randomUUID();

export { cnpjValido, cpfValido, normalizarCnpj, numeroBR, soDigitos } from "./validacao.js";

/** Primeiro e último dia da competência AAAA-MM. */
export function limitesCompetencia(comp: string) {
  const [a, m] = comp.split("-").map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${comp}-01`, fim: `${comp}-${String(ultimo).padStart(2, "0")}` };
}

export const competenciaValida = (c: unknown): c is string => typeof c === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(c);

export async function registrarAuditoria(
  db: Pick<Db, "insert">,
  usuario: string,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhe?: unknown,
) {
  await db.insert(auditoria).values({ usuario, acao, entidade, entidadeId, detalhe: detalhe ?? null });
}

export class ErroNegocio extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
