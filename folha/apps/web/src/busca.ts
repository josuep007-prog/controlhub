import { useNavigate, useSearch } from "@tanstack/react-router";

/** Parâmetros de busca comuns: empresa em foco, relatório e tipo de cálculo. */
export interface Busca {
  empresa?: string;
  rel?: "recibo" | "extrato" | "liquidos" | "encargos";
  tipo?: "mensal" | "adiantamento";
}

export const validarBusca = (s: Record<string, unknown>): Busca => ({
  empresa: typeof s.empresa === "string" && s.empresa ? s.empresa : undefined,
  rel: ["recibo", "extrato", "liquidos", "encargos"].includes(s.rel as string) ? (s.rel as Busca["rel"]) : undefined,
  tipo: s.tipo === "adiantamento" ? "adiantamento" : s.tipo === "mensal" ? "mensal" : undefined,
});

/** Lê e altera os parâmetros de busca da rota atual. */
export function useBusca(): [Busca, (b: Partial<Busca>) => void] {
  const busca = useSearch({ strict: false }) as Busca;
  const navigate = useNavigate();
  return [busca, (b) => navigate({ to: ".", search: (atual: Busca) => ({ ...atual, ...b }), replace: true })];
}
