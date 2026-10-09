import { Decimal } from "decimal.js";

/** Decimal isolado para cálculos de folha: nunca usar float com dinheiro. */
export const D: typeof Decimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;
export type Numerico = Dec | string | number;

export const dec = (v: Numerico | null | undefined): Dec => new D(v ?? 0);

/** Arredonda para centavos (meio para cima, como as folhas brasileiras). */
export const centavos = (v: Numerico): Dec => dec(v).toDecimalPlaces(2, D.ROUND_HALF_UP);

export const soma = (vs: Numerico[]): Dec => vs.reduce<Dec>((a, v) => a.plus(v), dec(0));

export const minimo = (a: Numerico, b: Numerico): Dec => D.min(a, b);
export const maximo = (a: Numerico, b: Numerico): Dec => D.max(a, b);

/** "1234.5" → "1.234,50" */
export function brl(v: Numerico): string {
  const n = centavos(v);
  const neg = n.isNegative();
  const [int, frac] = n.abs().toFixed(2).split(".");
  const milhar = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${milhar},${frac}`;
}
