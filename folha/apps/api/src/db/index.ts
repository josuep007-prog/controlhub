import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema.js";

export type Db = PgliteDatabase<typeof schema>;
export { schema };

const aqui = dirname(fileURLToPath(import.meta.url));
/** Pasta das migrations geradas pelo drizzle-kit (apps/api/drizzle). */
export const PASTA_MIGRATIONS = resolve(aqui, "../../drizzle");

export interface ConexaoDb {
  db: Db;
  fechar: () => Promise<void>;
  descricao: string;
}

/**
 * Abre o banco e aplica as migrations.
 * - DATABASE_URL definido → PostgreSQL de verdade (produção).
 * - Senão → PGlite (Postgres embutido) em `dataDir`, ou em memória se `dataDir` = ":memory:".
 */
export async function abrirBanco(opcoes: { url?: string; dataDir?: string } = {}): Promise<ConexaoDb> {
  if (opcoes.url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const cliente = postgres(opcoes.url, { max: 10 });
    const db = drizzle(cliente, { schema });
    await migrate(db, { migrationsFolder: PASTA_MIGRATIONS });
    // A API do Drizzle é a mesma nos dois drivers; o tipo do PGlite serve para ambos.
    return { db: db as unknown as Db, fechar: () => cliente.end(), descricao: "PostgreSQL" };
  }
  const dataDir = opcoes.dataDir ?? ":memory:";
  if (dataDir !== ":memory:") mkdirSync(dataDir, { recursive: true });
  const cliente = dataDir === ":memory:" ? new PGlite() : new PGlite(dataDir);
  const db = drizzlePglite(cliente, { schema });
  await migratePglite(db, { migrationsFolder: PASTA_MIGRATIONS });
  return { db, fechar: () => cliente.close(), descricao: `PGlite (${dataDir})` };
}
