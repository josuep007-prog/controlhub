import { randomUUID } from "node:crypto";
import type { Db } from "./db/index.js";
import { auditoria } from "./db/schema.js";

export const uid = () => randomUUID();

/** "1.234,56", "1234.56" ou número → número (NaN se inválido). */
export function numeroBR(v: unknown): number {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

export const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** CPF válido pelos dígitos verificadores. */
export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** CNPJ válido (inclui o CNPJ alfanumérico de 2026: letras valem código ASCII − 48). */
export function cnpjValido(cnpj: string): boolean {
  const c = String(cnpj ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  if (c.length !== 14 || !/^\d{2}$/.test(c.slice(12)) || /^(\d)\1{13}$/.test(c)) return false;
  const val = (ch: string) => ch.charCodeAt(0) - 48;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, p, i) => a + val(c[i]!) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export const normalizarCnpj = (s: string) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");

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
