import type * as XLSXTipos from "xlsx";
import { ABA_ADMISSAO, type AbaModelo } from "./regras";

type Biblioteca = typeof XLSXTipos;

/** No artefato a planilha vem do cdnjs (window.XLSX); na versão instalada, carrega sob demanda. */
export async function carregarXlsx(): Promise<Biblioteca> {
  if (import.meta.env.VITE_DEMO === "1") {
    const x = (window as unknown as { XLSX?: Biblioteca }).XLSX;
    if (!x) throw new Error("A biblioteca de planilhas não carregou. Recarregue a página.");
    return x;
  }
  return import("xlsx");
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export interface Planilha {
  /** Uma linha por registro, com os títulos do cabeçalho como chaves. Linhas vazias ficam (a numeração segue a do Excel). */
  linhas: Record<string, unknown>[];
  /** Texto das linhas acima do cabeçalho (título da ficha). */
  titulo: string;
  /** Número da primeira linha de dados, como o Excel mostra. */
  primeiraLinha: number;
}

/** Lê a primeira planilha (ou a aba "Admissão"). O cabeçalho é a primeira linha com 3 ou mais células preenchidas. */
export async function lerPlanilha(arquivo: File): Promise<Planilha> {
  const XLSX = await carregarXlsx();
  const buf = await arquivo.arrayBuffer();
  const csv = arquivo.name.toLowerCase().endsWith(".csv");
  const wb = csv ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true }) : XLSX.read(buf, { cellDates: false });
  const nome = wb.SheetNames.find((n) => norm(n) === norm(ABA_ADMISSAO)) ?? wb.SheetNames[0]!;
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome]!, { header: 1, defval: "", raw: true });
  const iCab = matriz.findIndex((l) => l.filter((c) => String(c).trim()).length >= 3);
  if (iCab < 0) return { linhas: [], titulo: "", primeiraLinha: 1 };
  const cab = matriz[iCab]!.map((c) => String(c).trim());
  return {
    titulo: matriz
      .slice(0, iCab)
      .flat()
      .map((c) => String(c).trim())
      .filter(Boolean)
      .join(" "),
    primeiraLinha: iCab + 2,
    linhas: matriz.slice(iCab + 1).map((l) => Object.fromEntries(cab.flatMap((h, i) => (h ? [[h, l[i]]] : [])))),
  };
}

/** Texto de todas as abas, para mandar ao Claude uma planilha qualquer como documento. */
export async function planilhaParaTexto(arquivo: File): Promise<string> {
  const XLSX = await carregarXlsx();
  const buf = await arquivo.arrayBuffer();
  const csv = arquivo.name.toLowerCase().endsWith(".csv");
  const wb = csv ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true }) : XLSX.read(buf);
  return wb.SheetNames.map((n) => `## Aba ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!, { blankrows: false })}`).join("\n\n");
}

/** Monta o .xlsx a partir do conteúdo de montarModelo. */
export async function gerarXlsx(abas: AbaModelo[]): Promise<Uint8Array> {
  const XLSX = await carregarXlsx();
  const wb = XLSX.utils.book_new();
  for (const aba of abas) {
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas);
    ws["!cols"] = aba.larguras.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, aba.nome);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
