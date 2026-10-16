import { calendarioCompetencia } from "./calendario.js";
import { centavos, dec, maximo, minimo, soma, type Dec } from "./dinheiro.js";
import { calcularInss, type ResultadoInss } from "./inss.js";
import { calcularIrrf, type ResultadoIrrf } from "./irrf.js";
import { COD, type Rubrica } from "./rubricas.js";
import type { TabelasLegais } from "./tabelas.js";

export type Regime = "simples" | "presumido" | "real";

export interface EmpresaCalculo {
  regime: Regime;
  /** Simples Nacional anexo IV recolhe a CPP patronal na folha. */
  simplesAnexoIV?: boolean;
  /** RAT ajustado (RAT × FAP), ex.: "0.02". */
  ratAjustado: string;
  /** Outras entidades (terceiros), ex.: "0.058". */
  terceiros: string;
}

export interface FuncionarioCalculo {
  id: string;
  nome: string;
  /** Mensalista: salário do mês. Horista: valor da hora. */
  salario: string;
  tipoSalario: "mensal" | "horista";
  horasMensais: number;
  admissao: string;
  demissao?: string | null;
  categoria: "empregado" | "aprendiz";
  dependentesIrrf: number;
  /** Filhos até 14 anos (ou inválidos) para o salário-família. */
  filhosSalarioFamilia: number;
  valeTransporte: { opta: boolean; valorMensal: string };
  /** Ex.: "0.40" para 40%. */
  percentualAdiantamento: string;
}

export interface Lancamento {
  rubricaCodigo: string;
  quantidade?: string | number | null;
  valor?: string | number | null;
}

export interface ItemCalculo {
  codigo: string;
  descricao: string;
  tipo: "provento" | "desconto" | "informativa";
  referencia: string;
  valor: string;
}

export interface ResultadoCalculo {
  funcionarioId: string;
  competencia: string;
  tipo: "mensal" | "adiantamento";
  itens: ItemCalculo[];
  totalProventos: string;
  totalDescontos: string;
  liquido: string;
  bases: { inss: string; fgts: string; irrf: string };
  inss: string;
  irrf: string;
  fgts: string;
  encargos: { cpp: string; rat: string; terceiros: string; fgts: string };
  detalhe: { inss?: ResultadoInss; irrf?: ResultadoIrrf; diasTrabalhados: number };
  avisos: string[];
}

export interface EntradaFolha {
  competencia: string;
  empresa: EmpresaCalculo;
  funcionario: FuncionarioCalculo;
  lancamentos: Lancamento[];
  rubricas: Rubrica[];
  tabelas: TabelasLegais;
  /** Líquido do adiantamento já pago na competência (vira desconto na mensal). */
  adiantamentoPago?: string;
  feriadosExtras?: string[];
}

const fmtNum = (v: Dec | number | string, casas = 2) =>
  dec(v)
    .toFixed(casas)
    .replace(".", ",");

const fmtHoras = (h: Dec) => {
  const min = h.times(60).toDecimalPlaces(0).toNumber();
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
};

function ultimoDiaComp(comp: string) {
  const [a, m] = comp.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Dias trabalhados no mês comercial de 30 dias, considerando admissão e demissão. */
export function diasTrabalhados(competencia: string, admissao: string, demissao?: string | null): number {
  const ini = `${competencia}-01`;
  const fim = `${competencia}-${String(ultimoDiaComp(competencia)).padStart(2, "0")}`;
  if (admissao > fim) return 0;
  if (demissao && demissao < ini) return 0;
  let primeiro = 1;
  let ultimo = 30;
  if (admissao >= ini) primeiro = Number(admissao.slice(8, 10));
  if (demissao && demissao <= fim) {
    const d = Number(demissao.slice(8, 10));
    ultimo = d >= ultimoDiaComp(competencia) ? 30 : d;
  }
  return Math.max(0, Math.min(30, ultimo) - Math.min(primeiro, 30) + 1);
}

function mapaRubricas(rubricas: Rubrica[]) {
  const m = new Map(rubricas.map((r) => [r.codigo, r]));
  return (codigo: string): Rubrica => {
    const r = m.get(codigo);
    if (!r) throw new Error(`Rubrica ${codigo} não cadastrada`);
    return r;
  };
}

/** Salário contratual do mês cheio (horista: hora × horas mensais). */
function salarioMensalCheio(f: FuncionarioCalculo): Dec {
  return f.tipoSalario === "horista" ? dec(f.salario).times(f.horasMensais) : dec(f.salario);
}

function valorHora(f: FuncionarioCalculo): Dec {
  return f.tipoSalario === "horista" ? dec(f.salario) : dec(f.salario).div(f.horasMensais || 220);
}

interface ItemInterno {
  rubrica: Rubrica;
  referencia: string;
  valor: Dec;
}

function baseDe(itens: ItemInterno[], campo: "incideInss" | "incideFgts" | "incideIrrf" | "incideDsr"): Dec {
  return soma(
    itens
      .filter((i) => i.rubrica[campo])
      .map((i) => (i.rubrica.tipo === "desconto" ? i.valor.neg() : i.rubrica.tipo === "provento" ? i.valor : 0)),
  );
}

function finalizar(
  e: EntradaFolha,
  tipo: ResultadoCalculo["tipo"],
  itens: ItemInterno[],
  extras: Partial<Pick<ResultadoCalculo, "bases" | "inss" | "irrf" | "fgts" | "encargos" | "detalhe">>,
  avisos: string[],
): ResultadoCalculo {
  const visiveis = itens.filter((i) => !i.valor.isZero());
  const prov = soma(visiveis.filter((i) => i.rubrica.tipo === "provento").map((i) => i.valor));
  const desc = soma(visiveis.filter((i) => i.rubrica.tipo === "desconto").map((i) => i.valor));
  const liquido = prov.minus(desc);
  if (liquido.isNegative()) avisos.push("Líquido negativo: os descontos passam dos proventos.");
  const z = "0.00";
  return {
    funcionarioId: e.funcionario.id,
    competencia: e.competencia,
    tipo,
    itens: visiveis.map((i) => ({
      codigo: i.rubrica.codigo,
      descricao: i.rubrica.descricao,
      tipo: i.rubrica.tipo,
      referencia: i.referencia,
      valor: centavos(i.valor).toFixed(2),
    })),
    totalProventos: centavos(prov).toFixed(2),
    totalDescontos: centavos(desc).toFixed(2),
    liquido: centavos(liquido).toFixed(2),
    bases: extras.bases ?? { inss: z, fgts: z, irrf: z },
    inss: extras.inss ?? z,
    irrf: extras.irrf ?? z,
    fgts: extras.fgts ?? z,
    encargos: extras.encargos ?? { cpp: z, rat: z, terceiros: z, fgts: z },
    detalhe: extras.detalhe ?? { diasTrabalhados: 0 },
    avisos,
  };
}

/** Folha mensal de um funcionário. */
export function calcularFolhaMensal(e: EntradaFolha): ResultadoCalculo {
  const { funcionario: f, tabelas: t, competencia } = e;
  const rub = mapaRubricas(e.rubricas);
  const avisos: string[] = [];
  const itens: ItemInterno[] = [];
  const dias = diasTrabalhados(competencia, f.admissao, f.demissao);

  if (dias === 0) {
    avisos.push("Sem dias trabalhados na competência.");
    return finalizar(e, "mensal", itens, { detalhe: { diasTrabalhados: 0 } }, avisos);
  }
  if (f.demissao && f.demissao.slice(0, 7) === competencia) {
    avisos.push("Demissão na competência: verbas rescisórias devem ser calculadas na rescisão.");
  }

  // 1. Salário proporcional aos dias (mês comercial de 30 dias).
  const cheio = salarioMensalCheio(f);
  const salario = centavos(cheio.times(dias).div(30));
  itens.push({
    rubrica: rub(COD.SALARIO),
    referencia: f.tipoSalario === "horista" ? fmtHoras(dec(f.horasMensais).times(dias).div(30)) : `${dias},00 d`,
    valor: salario,
  });

  // 2. Variáveis lançadas.
  const vh = valorHora(f);
  const vd = cheio.div(30);
  for (const l of e.lancamentos) {
    const r = rub(l.rubricaCodigo);
    if (r.modo === "sistema") {
      avisos.push(`Rubrica ${r.codigo} é calculada pelo sistema e foi ignorada nos lançamentos.`);
      continue;
    }
    const qtd = dec(l.quantidade ?? 0);
    const fator = dec(r.fator ?? 1);
    let valor: Dec;
    let referencia: string;
    switch (r.modo) {
      case "horas":
        valor = vh.times(fator).times(qtd);
        referencia = fmtHoras(qtd);
        break;
      case "dias":
        valor = vd.times(fator).times(qtd);
        referencia = `${fmtNum(qtd)} d`;
        break;
      case "percentual":
        valor = cheio.times(qtd).div(100);
        referencia = `${fmtNum(qtd)}%`;
        break;
      default:
        valor = dec(l.valor ?? 0);
        referencia = "";
    }
    if (l.valor != null && l.valor !== "" && r.modo !== "valor") valor = dec(l.valor); // valor informado prevalece
    itens.push({ rubrica: r, referencia, valor: centavos(valor) });
  }

  // 3. DSR sobre variáveis (HE, adicional noturno, comissões).
  const cal = calendarioCompetencia(competencia, e.feriadosExtras);
  const baseDsr = baseDe(itens, "incideDsr");
  if (baseDsr.gt(0) && cal.diasUteis > 0) {
    itens.push({
      rubrica: rub(COD.DSR_VARIAVEIS),
      referencia: `${cal.diasRepouso}/${cal.diasUteis}`,
      valor: centavos(baseDsr.div(cal.diasUteis).times(cal.diasRepouso)),
    });
  }

  // 4. Salário-família: limite pela remuneração do mês cheio; cota proporcional aos dias.
  if (f.filhosSalarioFamilia > 0 && f.categoria === "empregado") {
    const remuneracao = cheio.plus(baseDe(itens.filter((i) => i.rubrica.codigo !== COD.SALARIO), "incideInss"));
    if (remuneracao.lte(t.salarioFamilia.limiteRemuneracao)) {
      const cota = dec(t.salarioFamilia.cota).times(f.filhosSalarioFamilia).times(dias).div(30);
      itens.push({ rubrica: rub(COD.SALARIO_FAMILIA), referencia: `${f.filhosSalarioFamilia} cota(s)`, valor: centavos(cota) });
    }
  }

  // 5. Bases e encargos.
  const baseInss = maximo(0, baseDe(itens, "incideInss"));
  const baseFgts = maximo(0, baseDe(itens, "incideFgts"));
  const rendIrrf = maximo(0, baseDe(itens, "incideIrrf"));

  const inss = calcularInss(baseInss, t.inss);
  if (inss.valor.gt(0)) {
    itens.push({ rubrica: rub(COD.INSS), referencia: `${fmtNum(inss.aliquotaEfetiva.times(100))}%`, valor: inss.valor });
  }
  if (baseInss.gt(inss.base)) avisos.push("Base do INSS acima do teto: desconto limitado ao teto.");

  const irrf = calcularIrrf(
    { rendimentosTributaveis: rendIrrf, inss: inss.valor, dependentes: f.dependentesIrrf },
    t.irrf,
  );
  if (irrf.valor.gt(0)) {
    itens.push({ rubrica: rub(COD.IRRF), referencia: `${fmtNum(irrf.aliquota.times(100), 1)}%`, valor: irrf.valor });
  }

  // 6. Adiantamento já pago e vale-transporte.
  if (e.adiantamentoPago && dec(e.adiantamentoPago).gt(0)) {
    itens.push({ rubrica: rub(COD.ADIANTAMENTO_DESCONTO), referencia: "", valor: centavos(e.adiantamentoPago) });
  }
  if (f.valeTransporte.opta) {
    const seisPorCento = salario.times(t.valeTransporte.percentualDesconto);
    const custo = dec(f.valeTransporte.valorMensal).times(dias).div(30);
    const vt = centavos(minimo(seisPorCento, custo));
    if (vt.gt(0)) {
      itens.push({ rubrica: rub(COD.VALE_TRANSPORTE), referencia: `${fmtNum(dec(t.valeTransporte.percentualDesconto).times(100))}%`, valor: vt });
    }
  }

  // 7. FGTS (informativo) e encargos patronais.
  const aliqFgts = f.categoria === "aprendiz" ? t.fgts.aliquotaAprendiz : t.fgts.aliquota;
  const fgts = centavos(baseFgts.times(aliqFgts));
  itens.push({ rubrica: rub(COD.FGTS), referencia: `${fmtNum(dec(aliqFgts).times(100))}%`, valor: fgts });

  const recolheCpp = e.empresa.regime !== "simples" || !!e.empresa.simplesAnexoIV;
  const cpp = recolheCpp ? centavos(baseInss.times("0.20")) : dec(0);
  const rat = recolheCpp ? centavos(baseInss.times(e.empresa.ratAjustado)) : dec(0);
  const terceiros = e.empresa.regime !== "simples" ? centavos(baseInss.times(e.empresa.terceiros)) : dec(0);

  return finalizar(
    e,
    "mensal",
    itens,
    {
      bases: { inss: centavos(baseInss).toFixed(2), fgts: centavos(baseFgts).toFixed(2), irrf: centavos(rendIrrf).toFixed(2) },
      inss: inss.valor.toFixed(2),
      irrf: irrf.valor.toFixed(2),
      fgts: fgts.toFixed(2),
      encargos: { cpp: cpp.toFixed(2), rat: rat.toFixed(2), terceiros: terceiros.toFixed(2), fgts: fgts.toFixed(2) },
      detalhe: { inss, irrf, diasTrabalhados: dias },
    },
    avisos,
  );
}

/**
 * Adiantamento quinzenal: percentual do salário contratual. Quem foi admitido depois
 * do dia 15 não recebe adiantamento na competência. Sem INSS/IRRF (são apurados na mensal).
 */
export function calcularAdiantamento(e: EntradaFolha): ResultadoCalculo {
  const { funcionario: f, competencia } = e;
  const rub = mapaRubricas(e.rubricas);
  const avisos: string[] = [];
  const itens: ItemInterno[] = [];
  const dias = diasTrabalhados(competencia, f.admissao, f.demissao);
  const admitidoNoMes = f.admissao.slice(0, 7) === competencia;
  const pct = dec(f.percentualAdiantamento || 0);
  if (dias === 0) avisos.push("Sem dias trabalhados na competência.");
  else if (admitidoNoMes && Number(f.admissao.slice(8, 10)) > 15) avisos.push("Admitido após o dia 15: sem adiantamento.");
  else if (pct.lte(0)) avisos.push("Funcionário sem percentual de adiantamento.");
  else {
    itens.push({
      rubrica: rub(COD.ADIANTAMENTO_PAGO),
      referencia: `${fmtNum(pct.times(100))}%`,
      valor: centavos(salarioMensalCheio(f).times(pct)),
    });
  }
  return finalizar(e, "adiantamento", itens, { detalhe: { diasTrabalhados: dias } }, avisos);
}
