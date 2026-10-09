/**
 * Leitura de documentos de admissão pelo Claude.
 *
 * Os arquivos vão para a API da Anthropic (fora do servidor do escritório). Eles contêm dados pessoais
 * (CPF, endereço, dados bancários): confirme o contrato e a base legal (LGPD) antes de usar com clientes reais.
 * Nada do que é enviado fica guardado por este sistema.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { INSTRUCOES_EXTRACAO, RespostaExtracaoSchema, rotuloArquivo, type RespostaExtracao } from "../admissao-regras.js";
import { ErroNegocio } from "../util.js";

export interface ArquivoEntrada {
  nome: string;
  /** Tipo MIME. Para arquivo já convertido em texto (docx, planilha), "text/plain". */
  tipo: string;
  base64?: string;
  texto?: string;
}

export interface PedidoExtracao {
  empresa: { razaoSocial: string; cnpj: string };
  arquivos: ArquivoEntrada[];
}

/** Quem lê os documentos. O servidor usa o Claude; os testes passam um falso. */
export type Extrator = (pedido: PedidoExtracao) => Promise<RespostaExtracao>;

export const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_ARQUIVOS = 12;
export const MAX_BYTES_ARQUIVO = 20 * 1024 * 1024;
/** Modelo padrão; pode ser trocado por ADMISSAO_MODELO (ex.: um modelo mais barato). */
export const MODELO_PADRAO = "claude-opus-5-5";

export function validarArquivos(arquivos: ArquivoEntrada[]) {
  if (!arquivos.length) throw new ErroNegocio("Envie pelo menos um documento.");
  if (arquivos.length > MAX_ARQUIVOS) throw new ErroNegocio(`Envie no máximo ${MAX_ARQUIVOS} arquivos de cada vez.`);
  for (const a of arquivos) {
    const ehImagem = (IMAGENS as readonly string[]).includes(a.tipo);
    const ehPdf = a.tipo === "application/pdf";
    const ehTexto = a.tipo === "text/plain";
    if (!ehImagem && !ehPdf && !ehTexto) {
      throw new ErroNegocio(`"${a.nome}": tipo de arquivo não suportado (${a.tipo || "desconhecido"}). Use foto JPG/PNG/WebP, PDF, Word ou planilha.`);
    }
    if (ehTexto ? !a.texto?.trim() : !a.base64) throw new ErroNegocio(`"${a.nome}": arquivo vazio.`);
    if (!ehTexto && (a.base64!.length * 3) / 4 > MAX_BYTES_ARQUIVO) throw new ErroNegocio(`"${a.nome}" passa de 20 MB.`);
  }
}

/** Conteúdo da mensagem: cada arquivo vem depois de uma linha com o nome, e a tarefa por último. */
export function montarConteudo(pedido: PedidoExtracao): Anthropic.ContentBlockParam[] {
  const blocos: Anthropic.ContentBlockParam[] = [];
  for (const a of pedido.arquivos) {
    blocos.push({ type: "text", text: rotuloArquivo(a.nome) });
    if (a.tipo === "application/pdf") {
      blocos.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64! } });
    } else if (a.tipo === "text/plain") {
      blocos.push({ type: "text", text: `Conteúdo do arquivo "${a.nome}":\n${a.texto}` });
    } else {
      blocos.push({
        type: "image",
        source: { type: "base64", media_type: a.tipo as (typeof IMAGENS)[number], data: a.base64! },
      });
    }
  }
  blocos.push({
    type: "text",
    text: `A empresa contratante é ${pedido.empresa.razaoSocial} (CNPJ ${pedido.empresa.cnpj}); esses dados não são do funcionário. Leia os arquivos acima e devolva os campos do funcionário.`,
  });
  return blocos;
}

export function criarExtratorClaude(opcoes: { client?: Anthropic; modelo?: string } = {}): Extrator {
  const modelo = opcoes.modelo ?? process.env.ADMISSAO_MODELO ?? MODELO_PADRAO;
  return async (pedido) => {
    validarArquivos(pedido.arquivos);
    const client = opcoes.client ?? new Anthropic();
    try {
      const resposta = await client.messages.parse({
        model: modelo,
        max_tokens: 16000,
        system: INSTRUCOES_EXTRACAO,
        messages: [{ role: "user", content: montarConteudo(pedido) }],
        output_config: { effort: "medium", format: zodOutputFormat(RespostaExtracaoSchema) },
      });
      if (resposta.stop_reason === "refusal") {
        throw new ErroNegocio("O Claude se recusou a ler estes arquivos. Tente com a foto ou o PDF do documento original.", 422);
      }
      if (resposta.stop_reason === "max_tokens" || !resposta.parsed_output) {
        throw new ErroNegocio("Não consegui ler a resposta do Claude por completo. Tente com menos arquivos de cada vez.", 502);
      }
      return resposta.parsed_output;
    } catch (erro) {
      if (erro instanceof ErroNegocio) throw erro;
      if (erro instanceof Anthropic.AuthenticationError || erro instanceof Anthropic.PermissionDeniedError) {
        throw new ErroNegocio("A leitura de documentos não está configurada: o servidor não tem acesso válido à API do Claude (defina ANTHROPIC_API_KEY).", 503);
      }
      if (erro instanceof Anthropic.RateLimitError) throw new ErroNegocio("Muitas leituras ao mesmo tempo. Espere um minuto e tente de novo.", 429);
      if (erro instanceof Anthropic.BadRequestError) throw new ErroNegocio(`O Claude recusou o pedido: ${erro.message}`, 422);
      if (erro instanceof Anthropic.APIError) throw new ErroNegocio("O serviço do Claude não respondeu. Tente de novo em instantes.", 502);
      // Sem chave nenhuma o SDK avisa antes de chamar a rede.
      if (erro instanceof Error && /authentication method|apiKey|api key/i.test(erro.message)) {
        throw new ErroNegocio("A leitura de documentos não está configurada: defina ANTHROPIC_API_KEY no servidor.", 503);
      }
      throw erro;
    }
  };
}
