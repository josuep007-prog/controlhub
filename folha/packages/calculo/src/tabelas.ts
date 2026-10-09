/**
 * Tabelas legais versionadas por vigência (competência AAAA-MM).
 *
 * Fontes de 2026 (conferir sempre que sair norma nova):
 * - INSS e salário-família: Portaria Interministerial MPS/MF nº 13/2026.
 * - IRRF: tabela progressiva mensal mantida da Lei 15.191/2025 + redução mensal da
 *   Lei 15.270/2025 (art. 3º-A da Lei 9.250/1995), conforme orientação da Receita Federal
 *   às fontes pagadoras (dez/2025).
 */

export interface FaixaInss {
  /** Limite superior da faixa (salário de contribuição). */
  ate: string;
  aliquota: string;
}

export interface TabelaInss {
  faixas: FaixaInss[];
}

export interface FaixaIrrf {
  /** Limite superior da base; null = sem limite. */
  ate: string | null;
  aliquota: string;
  deducao: string;
}

export interface ReducaoIrrf {
  /** Até este rendimento tributável mensal a redução zera o imposto (limitada a `reducaoMaxima`). */
  limiteIsencao: string;
  reducaoMaxima: string;
  /** Acima disso não há redução. */
  limiteSuperior: string;
  /** Redução = constante − coeficiente × rendimentos tributáveis. */
  constante: string;
  coeficiente: string;
}

export interface TabelaIrrf {
  faixas: FaixaIrrf[];
  deducaoDependente: string;
  descontoSimplificado: string;
  reducao: ReducaoIrrf | null;
}

export interface TabelasLegais {
  /** Primeira competência em que a tabela vale (AAAA-MM). */
  vigencia: string;
  fonte: string;
  salarioMinimo: string;
  inss: TabelaInss;
  irrf: TabelaIrrf;
  salarioFamilia: { limiteRemuneracao: string; cota: string };
  fgts: { aliquota: string; aliquotaAprendiz: string };
  valeTransporte: { percentualDesconto: string };
}

export const TABELAS_2026: TabelasLegais = {
  vigencia: "2026-01",
  fonte:
    "INSS/salário-família: Portaria Interministerial MPS/MF nº 13/2026. IRRF: Lei 15.191/2025 + redução da Lei 15.270/2025.",
  salarioMinimo: "1621.00",
  inss: {
    faixas: [
      { ate: "1621.00", aliquota: "0.075" },
      { ate: "2902.84", aliquota: "0.09" },
      { ate: "4354.27", aliquota: "0.12" },
      { ate: "8475.55", aliquota: "0.14" },
    ],
  },
  irrf: {
    faixas: [
      { ate: "2428.80", aliquota: "0", deducao: "0" },
      { ate: "2826.65", aliquota: "0.075", deducao: "182.16" },
      { ate: "3751.05", aliquota: "0.15", deducao: "394.16" },
      { ate: "4664.68", aliquota: "0.225", deducao: "675.49" },
      { ate: null, aliquota: "0.275", deducao: "908.73" },
    ],
    deducaoDependente: "189.59",
    descontoSimplificado: "607.20",
    reducao: {
      limiteIsencao: "5000.00",
      reducaoMaxima: "312.89",
      limiteSuperior: "7350.00",
      constante: "978.62",
      coeficiente: "0.133145",
    },
  },
  salarioFamilia: { limiteRemuneracao: "1980.38", cota: "67.54" },
  fgts: { aliquota: "0.08", aliquotaAprendiz: "0.02" },
  valeTransporte: { percentualDesconto: "0.06" },
};

export const TABELAS_PADRAO: TabelasLegais[] = [TABELAS_2026];

/** Tabela vigente na competência: a de maior vigência que não seja posterior a ela. */
export function tabelaVigente(competencia: string, tabelas: TabelasLegais[] = TABELAS_PADRAO): TabelasLegais {
  const ordenadas = [...tabelas].sort((a, b) => b.vigencia.localeCompare(a.vigencia));
  const t = ordenadas.find((x) => x.vigencia <= competencia) ?? ordenadas[ordenadas.length - 1];
  if (!t) throw new Error("Nenhuma tabela legal cadastrada");
  return t;
}
