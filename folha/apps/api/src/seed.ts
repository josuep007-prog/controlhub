/**
 * Dados de exemplo para o protótipo: 3 empresas fictícias, ~15 funcionários,
 * rubricas padrão, tabelas de 2026 e alguns lançamentos na competência de exemplo.
 * Todos os nomes, CPFs e CNPJs são inventados (gerados com dígitos válidos).
 */
import { RUBRICAS_PADRAO, TABELAS_PADRAO } from "@folha/calculo";
import { count } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { abrirBanco, type Db } from "./db/index.js";
import { cargos, empresas, funcionarios, lancamentos, rubricas, sindicatos, tabelasLegais, usuarios } from "./db/schema.js";

function dvCpf(base: string) {
  const calc = (s: string) => {
    const n = s.length + 1;
    const soma = [...s].reduce((a, d, i) => a + Number(d) * (n - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(base);
  return base + d1 + calc(base + d1);
}

function dvCnpj(base12: string) {
  const calc = (s: string, pesos: number[]) => {
    const r = [...s].reduce((a, d, i) => a + Number(d) * pesos[i]!, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + d1 + calc(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

/** Competência de exemplo: o mês anterior ao atual (é a folha que se processa agora). */
export function competenciaPadrao(hoje = new Date()) {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export async function semear(db: Db, competencia = competenciaPadrao()) {
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(empresas);
  if (n > 0) return false;

  await db.transaction(async (tx) => {
    await tx.insert(usuarios).values([
      { id: "u-coord", nome: "Coordenação DP", email: "dp@controltax.com.br", perfil: "coordenacao" },
      { id: "u-ana", nome: "Ana Analista", perfil: "analista" },
      { id: "u-bruno", nome: "Bruno Analista", perfil: "analista" },
    ]);

    await tx.insert(tabelasLegais).values(TABELAS_PADRAO.map((t) => ({ vigencia: t.vigencia, fonte: t.fonte, dados: t })));

    await tx.insert(rubricas).values(
      RUBRICAS_PADRAO.map((r) => ({ ...r, fator: r.fator ?? null, ativa: r.ativa ?? true })),
    );

    await tx.insert(sindicatos).values([
      { id: "s-comercio", nome: "SINDICATO DOS EMPREGADOS NO COMÉRCIO (EXEMPLO)", codigoDominio: "12", mesDataBase: 5 },
      { id: "s-metal", nome: "SINDICATO DOS METALÚRGICOS (EXEMPLO)", codigoDominio: "31", mesDataBase: 11 },
      { id: "s-saude", nome: "SINDICATO DOS TRABALHADORES DA SAÚDE (EXEMPLO)", codigoDominio: "45", mesDataBase: 3 },
    ]);

    await tx.insert(cargos).values([
      { id: "c-padeiro", nome: "PADEIRO", cbo: "848305" },
      { id: "c-atendente", nome: "ATENDENTE DE LOJA", cbo: "521140" },
      { id: "c-caixa", nome: "OPERADOR DE CAIXA", cbo: "421125" },
      { id: "c-torneiro", nome: "TORNEIRO MECÂNICO", cbo: "721215" },
      { id: "c-soldador", nome: "SOLDADOR", cbo: "724315" },
      { id: "c-aux-adm", nome: "AUXILIAR ADMINISTRATIVO", cbo: "411010" },
      { id: "c-gerente", nome: "GERENTE ADMINISTRATIVO", cbo: "142105" },
      { id: "c-tec-enf", nome: "TÉCNICO DE ENFERMAGEM", cbo: "322205" },
      { id: "c-recep", nome: "RECEPCIONISTA", cbo: "422105" },
      { id: "c-aprendiz", nome: "JOVEM APRENDIZ ADMINISTRATIVO", cbo: "411005" },
    ]);

    const emp = [
      {
        id: "e-padaria",
        codigoDominio: "101",
        razaoSocial: "PADARIA PÃO DOURADO LTDA (EXEMPLO)",
        nomeFantasia: "Pão Dourado",
        cnpj: dvCnpj("112223330001"),
        regime: "simples" as const,
        cnae: "1091102",
        fpas: "515",
        rat: "0.01",
        sindicatoId: "s-comercio",
        responsavelId: "u-ana",
      },
      {
        id: "e-metal",
        codigoDominio: "205",
        razaoSocial: "METALÚRGICA VALE FORTE LTDA (EXEMPLO)",
        nomeFantasia: "Vale Forte",
        cnpj: dvCnpj("445556660001"),
        regime: "presumido" as const,
        cnae: "2539001",
        fpas: "507",
        codigoTerceiros: "0079",
        rat: "0.03",
        fap: "1.1500",
        sindicatoId: "s-metal",
        responsavelId: "u-bruno",
      },
      {
        id: "e-clinica",
        codigoDominio: "318",
        razaoSocial: "CLÍNICA BEM VIVER S/S (EXEMPLO)",
        nomeFantasia: "Bem Viver",
        cnpj: dvCnpj("778889990001"),
        regime: "real" as const,
        cnae: "8630503",
        fpas: "515",
        rat: "0.02",
        fap: "0.8000",
        sindicatoId: "s-saude",
        responsavelId: "u-ana",
        temAdiantamento: false,
      },
    ];
    await tx.insert(empresas).values(emp);

    let seq = 100000000;
    const f = (
      empresaId: string,
      matricula: number,
      nome: string,
      cargoId: string,
      salario: string,
      admissao: string,
      extra: Partial<typeof funcionarios.$inferInsert> = {},
    ): typeof funcionarios.$inferInsert => ({
      id: `${empresaId}-${matricula}`,
      empresaId,
      matricula,
      codigoDominio: String(matricula),
      nome,
      cpf: dvCpf(String((seq += 7919)).padStart(9, "0")),
      pis: null,
      cargoId,
      salario,
      admissao,
      dataNascimento: "1990-01-01",
      ...extra,
    });

    await tx.insert(funcionarios).values([
      f("e-padaria", 1, "MARIA APARECIDA DOS SANTOS", "c-padeiro", "2350.00", "2018-03-12", { dependentesIrrf: 1, sexo: "F" }),
      f("e-padaria", 2, "JOÃO PEDRO OLIVEIRA", "c-padeiro", "2350.00", "2021-08-02", { sexo: "M", optaVt: true, vtValorMensal: "220.00" }),
      f("e-padaria", 3, "LUCIANA FERREIRA LIMA", "c-atendente", "1700.00", "2023-02-01", { filhosSalarioFamilia: 2, sexo: "F", optaVt: true, vtValorMensal: "220.00" }),
      f("e-padaria", 4, "CARLOS EDUARDO SOUZA", "c-caixa", "1750.00", "2024-06-10", { sexo: "M" }),
      f("e-padaria", 5, "BEATRIZ ALMEIDA COSTA", "c-atendente", "1700.00", `${competencia}-18`, { sexo: "F", tipoContrato: "experiencia" }),
      f("e-metal", 1, "ROBERTO CARLOS PEREIRA", "c-torneiro", "4200.00", "2015-01-05", { dependentesIrrf: 2, sexo: "M" }),
      f("e-metal", 2, "ANDERSON LUIZ MARTINS", "c-soldador", "3600.00", "2019-09-16", { dependentesIrrf: 1, sexo: "M", optaVt: true, vtValorMensal: "300.00" }),
      f("e-metal", 3, "FERNANDO GOMES RIBEIRO", "c-soldador", "3600.00", "2022-04-04", { sexo: "M" }),
      f("e-metal", 4, "PATRÍCIA MENDES ROCHA", "c-aux-adm", "2600.00", "2020-11-03", { sexo: "F" }),
      f("e-metal", 5, "MARCOS VINÍCIUS ARAÚJO", "c-gerente", "9500.00", "2012-07-01", { dependentesIrrf: 3, sexo: "M" }),
      f("e-metal", 6, "GABRIEL HENRIQUE DIAS", "c-aprendiz", "1105.23", "2025-02-03", { categoria: "aprendiz", horasMensais: 150, sexo: "M", percentualAdiantamento: "0" }),
      f("e-clinica", 1, "JULIANA RODRIGUES NUNES", "c-tec-enf", "3100.00", "2017-05-15", { sexo: "F", jornada: "12x36" }),
      f("e-clinica", 2, "CAMILA BARBOSA TEIXEIRA", "c-tec-enf", "3100.00", "2021-10-01", { sexo: "F", jornada: "12x36" }),
      f("e-clinica", 3, "RAFAEL MOREIRA CASTRO", "c-recep", "1900.00", "2023-07-17", { sexo: "M", filhosSalarioFamilia: 1 }),
      f("e-clinica", 4, "SANDRA REGINA MONTEIRO", "c-gerente", "6200.00", "2016-02-01", { sexo: "F", dependentesIrrf: 1 }),
    ]);

    await tx.insert(lancamentos).values([
      { empresaId: "e-padaria", competencia, funcionarioId: "e-padaria-1", rubricaCodigo: "010", quantidade: "12" },
      { empresaId: "e-padaria", competencia, funcionarioId: "e-padaria-2", rubricaCodigo: "010", quantidade: "8" },
      { empresaId: "e-padaria", competencia, funcionarioId: "e-padaria-2", rubricaCodigo: "015", quantidade: "40" },
      { empresaId: "e-padaria", competencia, funcionarioId: "e-padaria-4", rubricaCodigo: "200", quantidade: "1" },
      { empresaId: "e-padaria", competencia, funcionarioId: "e-padaria-4", rubricaCodigo: "201", quantidade: "1" },
      { empresaId: "e-metal", competencia, funcionarioId: "e-metal-1", rubricaCodigo: "010", quantidade: "15.5" },
      { empresaId: "e-metal", competencia, funcionarioId: "e-metal-2", rubricaCodigo: "010", quantidade: "10" },
      { empresaId: "e-metal", competencia, funcionarioId: "e-metal-2", rubricaCodigo: "011", quantidade: "4" },
      { empresaId: "e-metal", competencia, funcionarioId: "e-metal-3", rubricaCodigo: "045", valor: "324.20" },
      { empresaId: "e-metal", competencia, funcionarioId: "e-metal-5", rubricaCodigo: "230", valor: "480.00" },
      { empresaId: "e-clinica", competencia, funcionarioId: "e-clinica-1", rubricaCodigo: "015", quantidade: "84" },
      { empresaId: "e-clinica", competencia, funcionarioId: "e-clinica-2", rubricaCodigo: "015", quantidade: "84" },
      { empresaId: "e-clinica", competencia, funcionarioId: "e-clinica-4", rubricaCodigo: "040", valor: "800.00" },
    ]);
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
