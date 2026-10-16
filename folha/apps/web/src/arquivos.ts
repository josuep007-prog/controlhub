/**
 * Prepara os arquivos que a analista solta na tela para a leitura pelo Claude:
 * foto reduzida, PDF (inteiro na versão instalada; página a página como imagem no artefato),
 * Word e planilha viram texto.
 */
import { planilhaParaTexto } from "./xlsx";

export interface ArquivoPronto {
  nome: string;
  tipo: string;
  base64?: string;
  texto?: string;
}

export interface Preparo {
  arquivos: ArquivoPronto[];
  /** Coisas que o usuário precisa saber (página cortada, arquivo ignorado). */
  avisos: string[];
}

const DEMO = import.meta.env.VITE_DEMO === "1";
const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PAGINAS_PDF = 4;
const MAX_LADO = DEMO ? 1600 : 2200;
const MAX_TEXTO = 150_000;

export const EXTENSOES_ACEITAS = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.xls,.csv,.txt";

const extensao = (nome: string) => nome.toLowerCase().split(".").pop() ?? "";

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(new Error("Não consegui ler o arquivo."));
    r.readAsDataURL(blob);
  });
}

function canvasParaBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("Não consegui converter a imagem."))), "image/jpeg", 0.85));
}

/** Reduz fotos grandes de celular e entrega em JPEG, respeitando a rotação da câmera. */
export async function reduzirImagem(arquivo: Blob, nome: string): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${nome}" não pôde ser aberto como imagem. Se for foto HEIC do iPhone, converta para JPG antes.`);
  }
  const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG com transparência não pode virar fundo preto
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvasParaBlob(canvas);
}

// ---------- PDF como imagem (só no artefato) ----------

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: { data: Uint8Array }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfPagina> }> };
}
interface PdfPagina {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}

function carregarScript(src: string): Promise<void> {
  return new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => erro(new Error("Não consegui carregar o leitor de PDF."));
    document.head.append(s);
  });
}

async function carregarPdfJs(): Promise<PdfJs> {
  const w = window as unknown as { pdfjsLib?: PdfJs };
  if (w.pdfjsLib) return w.pdfjsLib;
  await carregarScript(`${PDFJS}/pdf.min.js`);
  const lib = (window as unknown as { pdfjsLib?: PdfJs }).pdfjsLib;
  if (!lib) throw new Error("Não consegui carregar o leitor de PDF.");
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
  return lib;
}

async function pdfParaImagens(arquivo: File, avisos: string[]): Promise<ArquivoPronto[]> {
  const pdfjs = await carregarPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_PDF);
  if (pdf.numPages > paginas) avisos.push(`"${arquivo.name}" tem ${pdf.numPages} páginas; li só as ${paginas} primeiras.`);
  const saida: ArquivoPronto[] = [];
  for (let n = 1; n <= paginas; n++) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: Math.min(2.5, MAX_LADO / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    saida.push({ nome: `${arquivo.name} (pág. ${n})`, tipo: "image/jpeg", base64: await blobParaBase64(await canvasParaBlob(canvas)) });
  }
  return saida;
}

// ---------- Word e texto ----------

async function docxParaTexto(arquivo: File): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await arquivo.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error(`"${arquivo.name}" não parece um arquivo Word (.docx) válido.`);
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function prepararArquivos(arquivos: File[]): Promise<Preparo> {
  const saida: ArquivoPronto[] = [];
  const avisos: string[] = [];
  for (const f of arquivos) {
    const ext = extensao(f.name);
    if (IMAGENS.includes(f.type) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      saida.push({ nome: f.name, tipo: "image/jpeg", base64: await blobParaBase64(await reduzirImagem(f, f.name)) });
    } else if (f.type === "application/pdf" || ext === "pdf") {
      if (DEMO) saida.push(...(await pdfParaImagens(f, avisos)));
      else {
        if (f.size > 20 * 1024 * 1024) throw new Error(`"${f.name}" passa de 20 MB.`);
        saida.push({ nome: f.name, tipo: "application/pdf", base64: await blobParaBase64(f) });
      }
    } else if (ext === "docx") {
      saida.push({ nome: f.name, tipo: "text/plain", texto: (await docxParaTexto(f)).slice(0, MAX_TEXTO) });
    } else if (["xlsx", "xls", "csv"].includes(ext)) {
      saida.push({ nome: f.name, tipo: "text/plain", texto: (await planilhaParaTexto(f)).slice(0, MAX_TEXTO) });
    } else if (ext === "txt") {
      saida.push({ nome: f.name, tipo: "text/plain", texto: (await f.text()).slice(0, MAX_TEXTO) });
    } else if (ext === "doc") {
      throw new Error(`"${f.name}": Word antigo (.doc) não é lido. Salve como .docx ou PDF.`);
    } else if (ext === "heic" || ext === "heif") {
      throw new Error(`"${f.name}": foto HEIC do iPhone não é lida. Converta para JPG.`);
    } else {
      throw new Error(`"${f.name}": tipo de arquivo não suportado. Use foto (JPG, PNG), PDF, Word, planilha ou texto.`);
    }
    if (saida.at(-1)?.texto?.trim() === "") throw new Error(`"${f.name}" está vazio.`);
  }
  return { arquivos: saida, avisos };
}
