import { centavos, dec, maximo, minimo, type Dec, type Numerico } from "./dinheiro.js";
import type { TabelaInss } from "./tabelas.js";

export interface ResultadoInss {
  /** Base efetivamente tributada (limitada ao teto). */
  base: Dec;
  valor: Dec;
  /** Alíquota efetiva sobre a base (informativa). */
  aliquotaEfetiva: Dec;
  faixas: { de: Dec; ate: Dec; aliquota: Dec; valor: Dec }[];
}

/**
 * INSS do empregado, progressivo por faixas (EC 103/2019).
 * Cada faixa incide só sobre a parcela da base dentro dela; o total é arredondado
 * no final (assim o desconto máximo de 2026 fica em R$ 988,09, como publicado).
 */
export function calcularInss(baseBruta: Numerico, tabela: TabelaInss): ResultadoInss {
  const teto = dec(tabela.faixas[tabela.faixas.length - 1]?.ate ?? 0);
  const base = maximo(0, minimo(baseBruta, teto));
  let anterior = dec(0);
  let total = dec(0);
  const faixas: ResultadoInss["faixas"] = [];
  for (const f of tabela.faixas) {
    const ate = dec(f.ate);
    if (base.lte(anterior)) break;
    const parcela = minimo(base, ate).minus(anterior);
    const valor = parcela.times(f.aliquota);
    total = total.plus(valor);
    faixas.push({ de: anterior, ate, aliquota: dec(f.aliquota), valor: centavos(valor) });
    anterior = ate;
  }
  const valor = centavos(total);
  return {
    base: centavos(base),
    valor,
    aliquotaEfetiva: base.isZero() ? dec(0) : valor.div(base).toDecimalPlaces(4),
    faixas,
  };
}
