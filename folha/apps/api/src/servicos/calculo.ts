import {
  TABELAS_PADRAO,
  calcularAdiantamento,
  calcularFolhaMensal,
  dec,
  tabelaVigente,
  type FuncionarioCalculo,
  type ResultadoCalculo,
  type Rubrica,
  type TabelasLegais,
} from "@folha/calculo";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { Db } from "../db/index.js";
import {
  calculoItens,
  calculos,
  competencias,
  empresas,
  funcionarios,
  lancamentos,
  rubricas,
  tabelasLegais,
} from "../db/schema.js";
import { ErroNegocio, limitesCompetencia, registrarAuditoria } from "../util.js";

export type TipoCalculo = "mensal" | "adiantamento";

export async function carregarTabelas(db: Db): Promise<TabelasLegais[]> {
  const linhas = await db.select().from(tabelasLegais);
  return linhas.length ? linhas.map((l) => l.dados as TabelasLegais) : TABELAS_PADRAO;
}

export async function carregarRubricas(db: Db): Promise<Rubrica[]> {
  const linhas = await db.select().from(rubricas).orderBy(asc(rubricas.codigo));
  return linhas.map((r) => ({ ...r, fator: r.fator ?? undefined }));
}

/** Funcionários com algum dia de vínculo na competência. */
export async function funcionariosDaCompetencia(db: Db, empresaId: string, comp: string) {
  const { inicio, fim } = limitesCompetencia(comp);
  return db
    .select()
    .from(funcionarios)
    .where(
      and(
        eq(funcionarios.empresaId, empresaId),
        lte(funcionarios.admissao, fim),
        or(isNull(funcionarios.demissao), gte(funcionarios.demissao, inicio)),
      ),
    )
    .orderBy(asc(funcionarios.nome));
}

export async function competenciaFechada(db: Db, empresaId: string, comp: string) {
  const [c] = await db
    .select()
    .from(competencias)
    .where(and(eq(competencias.empresaId, empresaId), eq(competencias.competencia, comp)));
  return !!c?.fechada;
}

const paraCalculo = (f: typeof funcionarios.$inferSelect): FuncionarioCalculo => ({
  id: f.id,
  nome: f.nome,
  salario: f.salario,
  tipoSalario: f.tipoSalario,
  horasMensais: f.horasMensais,
  admissao: f.admissao,
  demissao: f.demissao,
  categoria: f.categoria,
  dependentesIrrf: f.dependentesIrrf,
  filhosSalarioFamilia: f.filhosSalarioFamilia,
  valeTransporte: { opta: f.optaVt, valorMensal: f.vtValorMensal },
  percentualAdiantamento: f.percentualAdiantamento,
});

/**
 * Calcula (ou recalcula) a folha de uma empresa na competência e grava o resultado.
 * O recálculo substitui o anterior do mesmo tipo. Competência fechada não recalcula.
 */
export async function calcularEmpresa(
  db: Db,
  empresaId: string,
  comp: string,
  tipo: TipoCalculo,
  usuario: string,
): Promise<{ funcionarios: number; liquido: string; avisos: number }> {
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  if (!empresa) throw new ErroNegocio("Empresa não encontrada", 404);
  if (await competenciaFechada(db, empresaId, comp)) {
    throw new ErroNegocio(`A competência ${comp} da ${empresa.razaoSocial} está fechada. Reabra para recalcular.`, 409);
  }

  const [tabelas, listaRubricas, lista, lancs] = await Promise.all([
    carregarTabelas(db),
    carregarRubricas(db),
    funcionariosDaCompetencia(db, empresaId, comp),
    db
      .select()
      .from(lancamentos)
      .where(and(eq(lancamentos.empresaId, empresaId), eq(lancamentos.competencia, comp))),
  ]);
  const tabela = tabelaVigente(comp, tabelas);

  const adiantamentos = new Map<string, string>();
  if (tipo === "mensal") {
    const ad = await db
      .select({ funcionarioId: calculos.funcionarioId, liquido: calculos.liquido })
      .from(calculos)
      .where(and(eq(calculos.empresaId, empresaId), eq(calculos.competencia, comp), eq(calculos.tipo, "adiantamento")));
    for (const a of ad) adiantamentos.set(a.funcionarioId, a.liquido);
  }

  const empresaCalc = {
    regime: empresa.regime,
    simplesAnexoIV: empresa.simplesAnexoIV,
    ratAjustado: dec(empresa.rat).times(empresa.fap).toFixed(6),
    terceiros: empresa.terceiros,
  };

  const resultados: ResultadoCalculo[] = lista.map((f) => {
    const entrada = {
      competencia: comp,
      empresa: empresaCalc,
      funcionario: paraCalculo(f),
      lancamentos: tipo === "mensal" ? lancs.filter((l) => l.funcionarioId === f.id) : [],
      rubricas: listaRubricas,
      tabelas: tabela,
      adiantamentoPago: adiantamentos.get(f.id),
    };
    return tipo === "mensal" ? calcularFolhaMensal(entrada) : calcularAdiantamento(entrada);
  });

  await db.transaction(async (tx) => {
    await tx
      .delete(calculos)
      .where(and(eq(calculos.empresaId, empresaId), eq(calculos.competencia, comp), eq(calculos.tipo, tipo)));
    for (const r of resultados) {
      if (r.itens.length === 0 && r.avisos.some((a) => a.startsWith("Sem dias"))) continue;
      const [c] = await tx
        .insert(calculos)
        .values({
          empresaId,
          funcionarioId: r.funcionarioId,
          competencia: comp,
          tipo,
          totalProventos: r.totalProventos,
          totalDescontos: r.totalDescontos,
          liquido: r.liquido,
          baseInss: r.bases.inss,
          baseFgts: r.bases.fgts,
          baseIrrf: r.bases.irrf,
          inss: r.inss,
          irrf: r.irrf,
          fgts: r.fgts,
          cpp: r.encargos.cpp,
          rat: r.encargos.rat,
          terceiros: r.encargos.terceiros,
          diasTrabalhados: r.detalhe.diasTrabalhados,
          avisos: r.avisos,
          detalhe: JSON.parse(JSON.stringify(r.detalhe)),
          calculadoPor: usuario,
        })
        .returning({ id: calculos.id });
      if (c && r.itens.length) {
        await tx.insert(calculoItens).values(r.itens.map((i, ordem) => ({ calculoId: c.id, ordem, ...i })));
      }
    }
    await registrarAuditoria(tx, usuario, `calcular_${tipo}`, "empresa", empresaId, { competencia: comp, funcionarios: resultados.length });
  });

  const liquido = resultados.reduce((a, r) => a.plus(r.liquido), dec(0));
  return {
    funcionarios: resultados.length,
    liquido: liquido.toFixed(2),
    avisos: resultados.reduce((a, r) => a + r.avisos.length, 0),
  };
}
