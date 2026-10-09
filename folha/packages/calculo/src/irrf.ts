import { centavos, dec, maximo, minimo, type Dec, type Numerico } from "./dinheiro.js";
import type { TabelaIrrf } from "./tabelas.js";

export interface EntradaIrrf {
  /** Soma dos rendimentos tributáveis do mês (bruto, antes de qualquer dedução). */
  rendimentosTributaveis: Numerico;
  /** INSS descontado no mês (dedução legal). */
  inss: Numerico;
  dependentes: number;
  pensaoAlimenticia?: Numerico;
  /** Aplica a redução da Lei 15.270/2025 (vale para a folha mensal e para o 13º). */
  aplicarReducao?: boolean;
}

export interface ResultadoIrrf {
  metodo: "deducoes_legais" | "simplificado";
  baseLegal: Dec;
  baseSimplificada: Dec;
  base: Dec;
  aliquota: Dec;
  impostoTabela: Dec;
  reducao: Dec;
  valor: Dec;
}

function impostoPelaTabela(base: Dec, tabela: TabelaIrrf): { imposto: Dec; aliquota: Dec } {
  if (base.lte(0)) return { imposto: dec(0), aliquota: dec(0) };
  const faixa = tabela.faixas.find((f) => f.ate === null || base.lte(f.ate)) ?? tabela.faixas[tabela.faixas.length - 1];
  if (!faixa) return { imposto: dec(0), aliquota: dec(0) };
  const imposto = maximo(0, base.times(faixa.aliquota).minus(faixa.deducao));
  return { imposto: centavos(imposto), aliquota: dec(faixa.aliquota) };
}

/**
 * Redução mensal da Lei 15.270/2025: até R$ 5.000 zera o imposto (até R$ 312,89);
 * de R$ 5.000,01 a R$ 7.350 vale R$ 978,62 − 0,133145 × rendimentos tributáveis.
 * O teste de faixa e a fórmula usam os rendimentos tributáveis brutos, não a base.
 * A redução nunca passa do imposto apurado pela tabela.
 */
export function reducaoIrrf(rendimentos: Numerico, impostoTabela: Numerico, tabela: TabelaIrrf): Dec {
  const r = tabela.reducao;
  if (!r) return dec(0);
  const rend = dec(rendimentos);
  let reducao: Dec;
  if (rend.lte(r.limiteIsencao)) reducao = dec(r.reducaoMaxima);
  else if (rend.lte(r.limiteSuperior)) reducao = dec(r.constante).minus(rend.times(r.coeficiente));
  else reducao = dec(0);
  return centavos(maximo(0, minimo(reducao, impostoTabela)));
}

/**
 * IRRF mensal. Calcula pelas deduções legais (INSS + dependentes + pensão) e pelo
 * desconto simplificado, e fica com o que resultar em menos imposto.
 */
export function calcularIrrf(e: EntradaIrrf, tabela: TabelaIrrf): ResultadoIrrf {
  const rend = maximo(0, e.rendimentosTributaveis);
  const deducoesLegais = dec(e.inss)
    .plus(dec(tabela.deducaoDependente).times(e.dependentes))
    .plus(e.pensaoAlimenticia ?? 0);
  const baseLegal = centavos(maximo(0, rend.minus(deducoesLegais)));
  // O simplificado substitui as deduções legais, exceto a pensão judicial.
  const baseSimplificada = centavos(
    maximo(0, rend.minus(tabela.descontoSimplificado).minus(e.pensaoAlimenticia ?? 0)),
  );
  const legal = impostoPelaTabela(baseLegal, tabela);
  const simpl = impostoPelaTabela(baseSimplificada, tabela);
  const usaSimplificado = simpl.imposto.lt(legal.imposto);
  const escolhido = usaSimplificado ? simpl : legal;
  const reducao = e.aplicarReducao === false ? dec(0) : reducaoIrrf(rend, escolhido.imposto, tabela);
  const valor = centavos(maximo(0, escolhido.imposto.minus(reducao)));
  return {
    metodo: usaSimplificado ? "simplificado" : "deducoes_legais",
    baseLegal,
    baseSimplificada,
    base: usaSimplificado ? baseSimplificada : baseLegal,
    aliquota: escolhido.aliquota,
    impostoTabela: escolhido.imposto,
    reducao,
    valor,
  };
}
