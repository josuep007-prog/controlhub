import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raizApi = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function configuracaoBanco() {
  return process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : { dataDir: process.env.PGLITE_DIR ?? resolve(raizApi, "../../.data/pglite") };
}

export const PASTA_WEB = process.env.WEB_DIST ?? resolve(raizApi, "../web/dist");
export const PORTA = Number(process.env.PORT ?? 3333);
export const HOST = process.env.HOST ?? "127.0.0.1";
