const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const brl = (v: string | number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (v: string | number, casas = 2) =>
  `${(Number(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`;

export const dataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export const dataHoraBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

export const compLonga = (c: string) => {
  const [a, m] = c.split("-");
  return `${MESES[Number(m) - 1]}/${a}`;
};

export const compCurta = (c: string) => {
  const [a, m] = c.split("-");
  return `${m}/${a}`;
};

export const compShift = (c: string, n: number) => {
  const [a, m] = c.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export const cnpjFmt = (c: string) => {
  const d = (c ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c;
};

export const cpfFmt = (c: string) => {
  const d = (c ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c;
};

export const REGIMES: Record<string, string> = { simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" };

export const norm = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
