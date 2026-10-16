/** Grava os dados de exemplo (dados-exemplo.ts) num banco vazio. */
import { RUBRICAS_PADRAO, TABELAS_PADRAO } from "@folha/calculo";
import { count } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { competenciaPadrao, dadosExemplo } from "./dados-exemplo.js";
import { abrirBanco, type Db } from "./db/index.js";
import { cargos, empresas, funcionarios, lancamentos, rubricas, sindicatos, tabelasLegais, usuarios } from "./db/schema.js";

export { competenciaPadrao };

export async function semear(db: Db, competencia = competenciaPadrao()) {
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(empresas);
  if (n > 0) return false;
  const d = dadosExemplo(competencia);

  await db.transaction(async (tx) => {
    await tx.insert(usuarios).values([...d.usuarios]);
    await tx.insert(tabelasLegais).values(TABELAS_PADRAO.map((t) => ({ vigencia: t.vigencia, fonte: t.fonte, dados: t })));
    await tx.insert(rubricas).values(RUBRICAS_PADRAO.map((r) => ({ ...r, fator: r.fator ?? null, ativa: r.ativa ?? true })));
    await tx.insert(sindicatos).values(d.sindicatos);
    await tx.insert(cargos).values(d.cargos);
    await tx.insert(empresas).values(d.empresas);
    await tx.insert(funcionarios).values(d.funcionarios);
    await tx.insert(lancamentos).values(d.lancamentos);
  });
  return true;
}

// Execução direta: `npm run seed` (usa o mesmo banco do servidor).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { configuracaoBanco } = await import("./config.js");
  const conexao = await abrirBanco(configuracaoBanco());
  const feito = await semear(conexao.db);
  console.log(feito ? `Dados de exemplo gravados em ${conexao.descricao}.` : "O banco já tem empresas; nada foi alterado.");
  await conexao.fechar();
}
