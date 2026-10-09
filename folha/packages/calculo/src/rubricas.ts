/**
 * Rubricas (os "Eventos" do Domínio). As de modo "sistema" são calculadas pelo motor;
 * as demais recebem quantidade ou valor nos lançamentos da competência.
 */

export type TipoRubrica = "provento" | "desconto" | "informativa";
export type ModoRubrica = "sistema" | "horas" | "dias" | "valor" | "percentual";

export interface Rubrica {
  codigo: string;
  descricao: string;
  tipo: TipoRubrica;
  modo: ModoRubrica;
  /**
   * horas/dias: multiplicador do valor-hora ou valor-dia (1,5 = HE 50%).
   * percentual: ignorado (a quantidade lançada é o percentual sobre o salário).
   */
  fator?: string;
  incideInss: boolean;
  incideFgts: boolean;
  incideIrrf: boolean;
  /** Entra na base do DSR sobre variáveis. */
  incideDsr: boolean;
  ativa?: boolean;
}

/** Códigos que o motor reconhece. Os demais são livres. */
export const COD = {
  SALARIO: "001",
  DSR_VARIAVEIS: "020",
  SALARIO_FAMILIA: "050",
  ADIANTAMENTO_PAGO: "300",
  ADIANTAMENTO_DESCONTO: "210",
  VALE_TRANSPORTE: "220",
  INSS: "901",
  IRRF: "902",
  FGTS: "950",
} as const;

const r = (
  codigo: string,
  descricao: string,
  tipo: TipoRubrica,
  modo: ModoRubrica,
  inc: { inss?: boolean; fgts?: boolean; irrf?: boolean; dsr?: boolean } = {},
  fator?: string,
): Rubrica => ({
  codigo,
  descricao,
  tipo,
  modo,
  fator,
  incideInss: inc.inss ?? false,
  incideFgts: inc.fgts ?? false,
  incideIrrf: inc.irrf ?? false,
  incideDsr: inc.dsr ?? false,
  ativa: true,
});

const TRIB = { inss: true, fgts: true, irrf: true };

export const RUBRICAS_PADRAO: Rubrica[] = [
  r(COD.SALARIO, "Salário base", "provento", "sistema", TRIB),
  r("010", "Horas extras 50%", "provento", "horas", { ...TRIB, dsr: true }, "1.5"),
  r("011", "Horas extras 100%", "provento", "horas", { ...TRIB, dsr: true }, "2"),
  r("015", "Adicional noturno 20%", "provento", "horas", { ...TRIB, dsr: true }, "0.2"),
  r(COD.DSR_VARIAVEIS, "DSR sobre variáveis", "provento", "sistema", TRIB),
  r("030", "Comissões", "provento", "valor", { ...TRIB, dsr: true }),
  r("040", "Gratificação", "provento", "valor", TRIB),
  r("045", "Adicional de insalubridade", "provento", "valor", TRIB),
  r(COD.SALARIO_FAMILIA, "Salário-família", "provento", "sistema"),
  r("060", "Reembolso de despesas", "provento", "valor"),
  r("200", "Faltas", "desconto", "dias", TRIB, "1"),
  r("201", "DSR sobre faltas", "desconto", "dias", TRIB, "1"),
  r("205", "Atrasos", "desconto", "horas", TRIB, "1"),
  r(COD.ADIANTAMENTO_DESCONTO, "Adiantamento salarial", "desconto", "sistema"),
  r(COD.VALE_TRANSPORTE, "Vale-transporte (6%)", "desconto", "sistema"),
  r("230", "Plano de saúde", "desconto", "valor"),
  r("240", "Vale-refeição/alimentação", "desconto", "valor"),
  r("250", "Contribuição sindical/assistencial", "desconto", "valor"),
  r(COD.ADIANTAMENTO_PAGO, "Adiantamento salarial", "provento", "sistema"),
  r(COD.INSS, "INSS", "desconto", "sistema"),
  r(COD.IRRF, "IRRF", "desconto", "sistema"),
  r(COD.FGTS, "FGTS do mês", "informativa", "sistema"),
];
