import { describe, expect, it } from "vitest";
import {
  RUBRICAS_PADRAO,
  TABELAS_2026,
  calcularAdiantamento,
  calcularFolhaMensal,
  calcularInss,
  calcularIrrf,
  calendarioCompetencia,
  diasTrabalhados,
  pascoa,
  type EntradaFolha,
  type FuncionarioCalculo,
} from "../src/index.js";

// Casos-ouro conferidos à mão com as tabelas de 2026 (ver comentários em src/tabelas.ts).

describe("INSS 2026", () => {
  const t = TABELAS_2026.inss;
  it.each([
    ["1000.00", "75.00"],
    ["1621.00", "121.58"], // 1ª faixa cheia: 121,575
    ["3000.00", "248.60"], // 121,575 + 115,3656 + 11,6592
    ["5000.00", "501.51"],
    ["8475.55", "988.09"], // teto: desconto máximo publicado
    ["12000.00", "988.09"], // acima do teto
  ])("base %s → %s", (base, esperado) => {
    expect(calcularInss(base, t).valor.toFixed(2)).toBe(esperado);
  });

  it("limita a base ao teto", () => {
    expect(calcularInss("12000", t).base.toFixed(2)).toBe("8475.55");
  });
});

describe("IRRF 2026 com redução da Lei 15.270/2025", () => {
  const t = TABELAS_2026.irrf;

  it("exemplo oficial da Receita: R$ 6.000 pelo simplificado → 574,29 − 179,75 = 394,54", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "6000", inss: "0", dependentes: 0 }, t);
    expect(r.metodo).toBe("simplificado");
    expect(r.impostoTabela.toFixed(2)).toBe("574.29");
    expect(r.reducao.toFixed(2)).toBe("179.75");
    expect(r.valor.toFixed(2)).toBe("394.54");
  });

  it("R$ 6.000 com INSS de 641,51: deduções legais vencem", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "6000", inss: "641.51", dependentes: 0 }, t);
    expect(r.metodo).toBe("deducoes_legais");
    expect(r.base.toFixed(2)).toBe("5358.49");
    expect(r.impostoTabela.toFixed(2)).toBe("564.85");
    expect(r.valor.toFixed(2)).toBe("385.10");
  });

  it("R$ 5.000: isento pela redução", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "5000", inss: "501.51", dependentes: 0 }, t);
    expect(r.impostoTabela.toFixed(2)).toBe("312.89");
    expect(r.valor.toFixed(2)).toBe("0.00");
  });

  it("R$ 5.500: redução parcial calculada sobre o bruto", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "5500", inss: "571.51", dependentes: 0 }, t);
    expect(r.metodo).toBe("simplificado");
    expect(r.impostoTabela.toFixed(2)).toBe("436.79");
    expect(r.reducao.toFixed(2)).toBe("246.32");
    expect(r.valor.toFixed(2)).toBe("190.47");
  });

  it("R$ 8.000: acima de R$ 7.350 não tem redução", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "8000", inss: "921.51", dependentes: 0 }, t);
    expect(r.reducao.toFixed(2)).toBe("0.00");
    expect(r.valor.toFixed(2)).toBe("1037.85");
  });

  it("dependentes entram nas deduções legais", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "4000", inss: "368.60", dependentes: 2 }, t);
    expect(r.metodo).toBe("deducoes_legais");
    expect(r.base.toFixed(2)).toBe("3252.22");
    expect(r.impostoTabela.toFixed(2)).toBe("93.67");
    expect(r.valor.toFixed(2)).toBe("0.00");
  });

  it("sem redução (ex.: tabela antiga) cobra o imposto da tabela", () => {
    const r = calcularIrrf({ rendimentosTributaveis: "5500", inss: "571.51", dependentes: 0, aplicarReducao: false }, t);
    expect(r.valor.toFixed(2)).toBe("436.79");
  });
});

describe("calendário", () => {
  it("Páscoa 2026 em 5/abr", () => {
    expect(pascoa(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
  });
  it("março/2026: 26 dias úteis e 5 domingos", () => {
    expect(calendarioCompetencia("2026-03")).toEqual({ diasNoMes: 31, diasUteis: 26, diasRepouso: 5 });
  });
  it("abril/2026: Sexta-feira Santa e Tiradentes viram repouso", () => {
    expect(calendarioCompetencia("2026-04")).toEqual({ diasNoMes: 30, diasUteis: 24, diasRepouso: 6 });
  });
  it("dias trabalhados no mês comercial", () => {
    expect(diasTrabalhados("2026-03", "2020-01-01")).toBe(30);
    expect(diasTrabalhados("2026-03", "2026-03-20")).toBe(11);
    expect(diasTrabalhados("2026-03", "2026-03-31")).toBe(1);
    expect(diasTrabalhados("2026-03", "2026-04-02")).toBe(0);
    expect(diasTrabalhados("2026-03", "2020-01-01", "2026-03-10")).toBe(10);
  });
});

const func = (p: Partial<FuncionarioCalculo> = {}): FuncionarioCalculo => ({
  id: "f1",
  nome: "Teste",
  salario: "3000.00",
  tipoSalario: "mensal",
  horasMensais: 220,
  admissao: "2025-01-10",
  categoria: "empregado",
  dependentesIrrf: 0,
  filhosSalarioFamilia: 0,
  valeTransporte: { opta: false, valorMensal: "0" },
  percentualAdiantamento: "0.40",
  ...p,
});

const entrada = (p: Partial<EntradaFolha> = {}): EntradaFolha => ({
  competencia: "2026-03",
  empresa: { regime: "presumido", ratAjustado: "0.02", terceiros: "0.058" },
  funcionario: func(),
  lancamentos: [],
  rubricas: RUBRICAS_PADRAO,
  tabelas: TABELAS_2026,
  ...p,
});

const item = (r: ReturnType<typeof calcularFolhaMensal>, codigo: string) => r.itens.find((i) => i.codigo === codigo)?.valor;

describe("folha mensal", () => {
  it("salário de R$ 3.000 com 10h extras 50% em março/2026", () => {
    const r = calcularFolhaMensal(entrada({ lancamentos: [{ rubricaCodigo: "010", quantidade: 10 }] }));
    expect(item(r, "001")).toBe("3000.00");
    expect(item(r, "010")).toBe("204.55"); // 3000/220 × 1,5 × 10
    expect(item(r, "020")).toBe("39.34"); // 204,55 / 26 × 5
    expect(r.bases.inss).toBe("3243.89");
    expect(r.inss).toBe("277.87");
    expect(r.irrf).toBe("0.00"); // 15,59 pela tabela, zerado pela redução
    expect(r.fgts).toBe("259.51");
    expect(r.totalProventos).toBe("3243.89");
    expect(r.liquido).toBe("2966.02");
    expect(r.encargos).toEqual({ cpp: "648.78", rat: "64.88", terceiros: "188.15", fgts: "259.51" });
  });

  it("desconta adiantamento e vale-transporte (6% limitado ao custo)", () => {
    const r = calcularFolhaMensal(
      entrada({
        funcionario: func({ valeTransporte: { opta: true, valorMensal: "300" } }),
        lancamentos: [{ rubricaCodigo: "010", quantidade: 10 }],
        adiantamentoPago: "1200.00",
      }),
    );
    expect(item(r, "210")).toBe("1200.00");
    expect(item(r, "220")).toBe("180.00");
    expect(r.liquido).toBe("1586.02");
  });

  it("faltas reduzem salário e bases", () => {
    const r = calcularFolhaMensal(entrada({ lancamentos: [{ rubricaCodigo: "200", quantidade: 2 }] }));
    expect(item(r, "200")).toBe("200.00");
    expect(r.bases.inss).toBe("2800.00");
  });

  it("admissão no meio do mês é proporcional", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ salario: "2000", admissao: "2026-03-20" }) }));
    expect(item(r, "001")).toBe("733.33");
    expect(r.detalhe.diasTrabalhados).toBe(11);
  });

  it("salário-família para remuneração até o limite", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ salario: "1700", filhosSalarioFamilia: 2 }) }));
    expect(item(r, "050")).toBe("135.08");
    expect(r.bases.inss).toBe("1700.00"); // salário-família não integra a base
  });

  it("horista: hora × horas mensais", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ tipoSalario: "horista", salario: "10.00", horasMensais: 220 }) }));
    expect(item(r, "001")).toBe("2200.00");
  });

  it("aprendiz recolhe FGTS de 2%", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ salario: "1000", categoria: "aprendiz" }) }));
    expect(r.fgts).toBe("20.00");
  });

  it("Simples Nacional (fora do anexo IV) não recolhe CPP, RAT nem terceiros", () => {
    const r = calcularFolhaMensal(entrada({ empresa: { regime: "simples", ratAjustado: "0.02", terceiros: "0.058" } }));
    expect(r.encargos.cpp).toBe("0.00");
    expect(r.encargos.terceiros).toBe("0.00");
    expect(r.encargos.fgts).toBe("240.00");
  });

  it("acima do teto do INSS avisa e limita", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ salario: "12000" }) }));
    expect(r.inss).toBe("988.09");
    expect(r.avisos.some((a) => a.includes("teto"))).toBe(true);
  });

  it("funcionário admitido depois da competência não tem folha", () => {
    const r = calcularFolhaMensal(entrada({ funcionario: func({ admissao: "2026-05-01" }) }));
    expect(r.itens).toHaveLength(0);
    expect(r.liquido).toBe("0.00");
  });
});

describe("adiantamento", () => {
  it("40% do salário contratual", () => {
    const r = calcularAdiantamento(entrada());
    expect(r.liquido).toBe("1200.00");
  });
  it("admitido depois do dia 15 não recebe", () => {
    const r = calcularAdiantamento(entrada({ funcionario: func({ admissao: "2026-03-20" }) }));
    expect(r.liquido).toBe("0.00");
    expect(r.avisos[0]).toMatch(/dia 15/);
  });
});
