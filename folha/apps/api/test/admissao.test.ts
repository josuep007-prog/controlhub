import Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CAMPOS,
  RespostaExtracaoSchema,
  cnpjDaFicha,
  lerFicha,
  montarModelo,
  montarRascunhoDeExtracao,
  normalizarValor,
  pisValido,
  validarDados,
  defDoCampo,
  type RespostaExtracao,
} from "../src/admissao-regras.js";
import { criarApp } from "../src/app.js";
import { abrirBanco, type ConexaoDb } from "../src/db/index.js";
import { semear } from "../src/seed.js";
import { criarExtratorClaude, type Extrator } from "../src/servicos/extracao.js";

const norm = (chave: string, bruto: unknown) => normalizarValor(defDoCampo(chave)!, bruto);
const HOJE = "2026-10-09";

describe("normalização de valores", () => {
  it("CPF: aceita máscara, restaura zeros do Excel e avisa dígito errado", () => {
    expect(norm("cpf", "529.982.247-25")).toEqual({ valor: "52998224725" });
    expect(norm("cpf", 1234567890).valor).toBe("01234567890");
    expect(norm("cpf", "111.111.111-11").aviso).toMatch(/inválido/);
  });
  it("PIS: confere o dígito verificador", () => {
    expect(pisValido("12345678919")).toBe(true);
    expect(pisValido("12345678910")).toBe(false);
    expect(norm("pis", "123.45678.91-9").aviso).toBeUndefined();
    expect(norm("pis", "123.45678.91-0").aviso).toMatch(/inválido/);
  });
  it("datas: texto, serial do Excel e data impossível", () => {
    expect(norm("admissao", "01/10/2026").valor).toBe("2026-10-01");
    expect(norm("admissao", 46296).valor).toBe("2026-10-01");
    expect(norm("admissao", "31/02/2026").aviso).toMatch(/inexistente/);
    expect(norm("admissao", "ontem").valor).toBeNull();
  });
  it("salário, sim/não e enums em português", () => {
    expect(norm("salario", "R$ 2.100,00").valor).toBe("2100.00");
    expect(norm("optaVt", "Sim").valor).toBe(true);
    expect(norm("optaVt", "Não").valor).toBe(false);
    expect(norm("tipoContrato", "Experiência").valor).toBe("experiencia");
    expect(norm("categoria", "Aprendiz").valor).toBe("aprendiz");
    expect(norm("sexo", "Feminino").valor).toBe("F");
  });
  it("célula vazia não vira valor", () => {
    expect(norm("nome", "   ")).toEqual({ valor: null });
  });
});

describe("validação entre campos", () => {
  it("menor de 16 sem ser aprendiz", () => {
    // 13 anos: não pode trabalhar de jeito nenhum
    expect(validarDados({ dataNascimento: "2013-05-01", admissao: "2026-10-01", categoria: "empregado" }, HOJE).dataNascimento).toMatch(/14/);
    // 15 anos: só como aprendiz
    expect(validarDados({ dataNascimento: "2011-05-01", admissao: "2026-10-01", categoria: "empregado" }, HOJE).dataNascimento).toMatch(/aprendiz/);
    expect(validarDados({ dataNascimento: "2011-05-01", admissao: "2026-10-01", categoria: "aprendiz" }, HOJE).dataNascimento).toBeUndefined();
    // 16 anos completos na admissão: ok
    expect(validarDados({ dataNascimento: "2010-09-01", admissao: "2026-10-01", categoria: "empregado" }, HOJE).dataNascimento).toBeUndefined();
  });
  it("admissão muito distante e VT sem custo", () => {
    expect(validarDados({ admissao: "2027-03-01" }, HOJE).admissao).toMatch(/90 dias/);
    expect(validarDados({ optaVt: true }, HOJE).vtValorMensal).toBeDefined();
  });
});

describe("ficha em Excel", () => {
  const modelo = montarModelo({ razaoSocial: "PADARIA PÃO DOURADO LTDA", cnpj: "11222333000181" });

  it("o modelo tem uma coluna por campo, instruções e o CNPJ no título", () => {
    const [aba, instrucoes] = modelo;
    expect(aba!.nome).toBe("Admissão");
    expect(aba!.linhas[3]).toHaveLength(CAMPOS.length);
    expect(aba!.linhas[3]![0]).toBe("Nome completo *");
    expect(String(aba!.linhas[0]![0])).toContain("11.222.333/0001-81");
    expect(instrucoes!.linhas).toHaveLength(CAMPOS.length + 1);
    expect(cnpjDaFicha(String(aba!.linhas[0]![0]))).toBe("11222333000181");
    expect(cnpjDaFicha("sem cnpj aqui")).toBeNull();
  });

  /** Simula o que a biblioteca de planilhas devolve: um objeto por linha, com os títulos do cabeçalho. */
  const linhaDe = (cab: (string | number)[], valores: Record<string, unknown>) =>
    Object.fromEntries(cab.map((h) => [String(h), valores[String(h).replace(/ \*$/, "")] ?? ""]));
  const cab = modelo[0]!.linhas[3]!;

  it("lê linhas válidas, ignora a de exemplo e as vazias", () => {
    const leitura = lerFicha(
      [
        linhaDe(cab, { "Nome completo": "EXEMPLO (apague esta linha)", CPF: "000.000.000-00" }),
        linhaDe(cab, { "Nome completo": "joana pereira", CPF: "529.982.247-25", "Data de nascimento": "15/03/1990", "Data de admissão": "01/10/2026", Cargo: "Atendente", "Salário (R$)": "1.850,00", "Opta por vale-transporte": "Sim", "Custo mensal do VT (R$)": "220,00" }),
        linhaDe(cab, {}),
      ],
      5,
    );
    expect(leitura.colunasFaltando).toEqual([]);
    expect(leitura.rascunhos).toHaveLength(1);
    const r = leitura.rascunhos[0]!;
    expect(r.rotulo).toBe("JOANA PEREIRA");
    expect(r.dados).toMatchObject({ nome: "JOANA PEREIRA", cpf: "52998224725", admissao: "2026-10-01", salario: "1850.00", optaVt: true, vtValorMensal: "220.00" });
    expect(r.notas.cpf).toMatchObject({ origem: "Linha 6 da ficha", confianca: "alta" });
    expect(r.pendencias).toEqual([]);
  });

  it("aponta o que falta e o que está errado", () => {
    const [r] = lerFicha([linhaDe(cab, { "Nome completo": "Sem Dados", CPF: "111.111.111-11", "Data de admissão": "31/02/2026" })]).rascunhos;
    expect(r!.pendencias).toEqual(expect.arrayContaining(["Falta data de admissão", "Falta salário", "CPF inválido"]));
    expect(r!.avisos.join(" ")).toMatch(/inexistente/);
    expect(r!.notas.cpf!.confianca).toBe("baixa");
  });

  it("avisa quando a planilha perdeu colunas obrigatórias", () => {
    const leitura = lerFicha([{ "Nome completo": "Fulano", CPF: "52998224725" }]);
    expect(leitura.colunasFaltando).toEqual(expect.arrayContaining(["Data de admissão", "Salário (R$)"]));
  });

  it("aceita títulos digitados à mão", () => {
    const leitura = lerFicha([{ Nome: "Ana", CPF: "529.982.247-25", Admissão: "01/10/2026", Salario: "2000", "Coluna estranha": "x" }]);
    expect(leitura.colunasIgnoradas).toEqual(["Coluna estranha"]);
    expect(leitura.rascunhos[0]!.dados.salario).toBe("2000.00");
  });
});

describe("leitura de documentos: resposta do Claude → rascunho", () => {
  const base: RespostaExtracao = {
    documentos: [
      { arquivo: "rg.jpg", tipo: "rg", legivel: true },
      { arquivo: "ficha.pdf", tipo: "ficha_admissao", legivel: true },
    ],
    campos: [
      { campo: "nome", valor: "Carlos Eduardo Souza", confianca: "alta", arquivo: "rg.jpg" },
      { campo: "cpf", valor: "529.982.247-25", confianca: "alta", arquivo: "rg.jpg" },
      { campo: "dataNascimento", valor: "22/07/1994", confianca: "alta", arquivo: "rg.jpg" },
      { campo: "admissao", valor: "01/10/2026", confianca: "media", arquivo: "ficha.pdf" },
      { campo: "salario", valor: "2.350,00", confianca: "media", arquivo: "ficha.pdf" },
      { campo: "cargo", valor: "Padeiro", confianca: "alta", arquivo: "ficha.pdf" },
    ],
    outros: [{ rotulo: "Nome da mãe", valor: "Ana Souza", arquivo: "rg.jpg" }],
    avisos: [],
  };

  it("normaliza, guarda a origem e a confiança de cada campo", () => {
    const r = montarRascunhoDeExtracao(base, { hoje: HOJE });
    expect(r.origem).toBe("documentos");
    expect(r.rotulo).toBe("CARLOS EDUARDO SOUZA");
    expect(r.dados).toMatchObject({ cpf: "52998224725", dataNascimento: "1994-07-22", admissao: "2026-10-01", salario: "2350.00", cargo: "Padeiro" });
    expect(r.notas.salario).toMatchObject({ origem: "ficha.pdf", confianca: "media" });
    expect(r.outros).toEqual([{ rotulo: "Nome da mãe", valor: "Ana Souza", arquivo: "rg.jpg" }]);
    expect(r.pendencias).toEqual([]);
  });

  it("CPF lido errado fica com baixa confiança e vira pendência", () => {
    const r = montarRascunhoDeExtracao({ ...base, campos: base.campos.map((c) => (c.campo === "cpf" ? { ...c, valor: "529.982.247-26" } : c)) }, { hoje: HOJE });
    expect(r.notas.cpf!.confianca).toBe("baixa");
    expect(r.notas.cpf!.aviso).toMatch(/inválido/);
    expect(r.pendencias).toContain("CPF inválido");
  });

  it("valores diferentes entre documentos: usa o de maior confiança e avisa", () => {
    const r = montarRascunhoDeExtracao(
      { ...base, campos: [...base.campos, { campo: "dataNascimento", valor: "22/01/1994", confianca: "baixa", arquivo: "ficha.pdf" }] },
      { hoje: HOJE },
    );
    expect(r.dados.dataNascimento).toBe("1994-07-22");
    expect(r.notas.dataNascimento!.confianca).toBe("baixa");
    expect(r.notas.dataNascimento!.aviso).toMatch(/Documentos diferentes/);
    expect(r.avisos.join(" ")).toMatch(/valores diferentes/);
  });

  it("documento ilegível entra nos avisos; o que falta vira pendência", () => {
    const r = montarRascunhoDeExtracao(
      { documentos: [{ arquivo: "foto.jpg", tipo: "outro", legivel: false }], campos: [{ campo: "nome", valor: "Fulano", confianca: "baixa", arquivo: "foto.jpg" }], outros: [], avisos: [] },
      { hoje: HOJE },
    );
    expect(r.avisos).toContain("foto.jpg está ilegível ou cortado.");
    expect(r.pendencias).toEqual(expect.arrayContaining(["Falta cpf", "Falta data de admissão"]));
  });

  it("o esquema recusa campo que não existe no cadastro", () => {
    expect(RespostaExtracaoSchema.safeParse({ ...base, campos: [{ campo: "rg", valor: "1", confianca: "alta", arquivo: "a" }] }).success).toBe(false);
  });
});

describe("chamada ao Claude (SDK real, rede simulada)", () => {
  /** Responde como a API responderia e guarda o corpo enviado. */
  function clienteFalso(respostaJson: unknown, opcoes: { stop?: string } = {}) {
    const enviados: { url: string; corpo: Record<string, unknown> }[] = [];
    const fetchFalso = (async (url: unknown, init?: RequestInit) => {
      enviados.push({ url: String(url), corpo: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          id: "msg_1",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: JSON.stringify(respostaJson) }],
          stop_reason: opcoes.stop ?? "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    return { client: new Anthropic({ apiKey: "chave-de-teste", fetch: fetchFalso, maxRetries: 0 }), enviados };
  }

  const pedido = {
    empresa: { razaoSocial: "PADARIA PÃO DOURADO LTDA", cnpj: "11222333000181" },
    arquivos: [
      { nome: "rg.jpg", tipo: "image/jpeg", base64: "QUJD" },
      { nome: "ficha.pdf", tipo: "application/pdf", base64: "UERG" },
      { nome: "ficha.docx", tipo: "text/plain", texto: "Nome: Fulano" },
    ],
  };
  const resposta: RespostaExtracao = { documentos: [], campos: [{ campo: "nome", valor: "Fulano", confianca: "alta", arquivo: "rg.jpg" }], outros: [], avisos: [] };

  it("envia imagem, PDF e texto, com o formato de saída e o modelo certos", async () => {
    const { client, enviados } = clienteFalso(resposta);
    const lido = await criarExtratorClaude({ client })(pedido);
    expect(lido.campos[0]!.valor).toBe("Fulano");

    expect(enviados).toHaveLength(1);
    const { url, corpo } = enviados[0]!;
    expect(url).toContain("/v1/messages");
    expect(corpo.model).toBe("claude-opus-5-5");
    expect(String(corpo.system)).toContain("Não invente nem deduza");
    const conteudo = (corpo.messages as { content: { type: string; text?: string; source?: { type: string; media_type: string } }[] }[])[0]!.content;
    expect(conteudo.map((b) => b.type)).toEqual(["text", "image", "text", "document", "text", "text", "text"]);
    expect(conteudo[0]!.text).toBe("Arquivo: rg.jpg");
    expect(conteudo[1]!.source).toMatchObject({ type: "base64", media_type: "image/jpeg" });
    expect(conteudo[3]!.source).toMatchObject({ type: "base64", media_type: "application/pdf" });
    expect(conteudo[5]!.text).toContain("Nome: Fulano");
    expect(conteudo.at(-1)!.text).toContain("PADARIA PÃO DOURADO LTDA");
    const saida = corpo.output_config as { format: { type: string; schema: { properties: Record<string, unknown> } } };
    expect(saida.format.type).toBe("json_schema");
    expect(Object.keys(saida.format.schema.properties)).toEqual(["documentos", "campos", "outros", "avisos"]);
    expect(corpo).not.toHaveProperty("thinking");
    expect(corpo).not.toHaveProperty("temperature");
  });

  it("recusa do Claude vira mensagem clara", async () => {
    const { client } = clienteFalso(resposta, { stop: "refusal" });
    await expect(criarExtratorClaude({ client })(pedido)).rejects.toThrow(/recusou/);
  });

  it("recusa arquivos que o Claude não lê antes de gastar chamada", async () => {
    const { client, enviados } = clienteFalso(resposta);
    await expect(criarExtratorClaude({ client })({ ...pedido, arquivos: [{ nome: "foto.heic", tipo: "image/heic", base64: "QQ==" }] })).rejects.toThrow(/não suportado/);
    expect(enviados).toHaveLength(0);
  });

  it("erro de autenticação vira aviso de configuração", async () => {
    const fetch401 = (async () => new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;
    const client = new Anthropic({ apiKey: "x", fetch: fetch401, maxRetries: 0 });
    await expect(criarExtratorClaude({ client })(pedido)).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("rota /api/admissao/extrair", () => {
  const COMP = "2026-09";
  let conexao: ConexaoDb;
  let app: FastifyInstance;
  let recebido: Parameters<Extrator>[0] | undefined;

  const falso: Extrator = async (p) => {
    recebido = p;
    return {
      documentos: [{ arquivo: "rg.jpg", tipo: "rg", legivel: true }],
      campos: [
        { campo: "nome", valor: "Beatriz Lima", confianca: "alta", arquivo: "rg.jpg" },
        { campo: "cpf", valor: "529.982.247-25", confianca: "alta", arquivo: "rg.jpg" },
      ],
      outros: [],
      avisos: [],
    };
  };

  beforeAll(async () => {
    conexao = await abrirBanco({ dataDir: ":memory:" });
    await semear(conexao.db, COMP);
    app = await criarApp(conexao.db, { extrator: falso });
  }, 60_000);
  afterAll(async () => {
    await app?.close();
    await conexao?.fechar();
  });

  const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/admissao/extrair", payload: payload as object, headers: { "x-usuario": "u-ana" } });

  it("devolve o rascunho com as pendências e passa os dados da empresa ao leitor", async () => {
    const r = await post({ empresaId: "e-padaria", arquivos: [{ nome: "rg.jpg", tipo: "image/jpeg", base64: "QUJD" }] });
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(corpo.rotulo).toBe("BEATRIZ LIMA");
    expect(corpo.dados.cpf).toBe("52998224725");
    expect(corpo.pendencias).toEqual(expect.arrayContaining(["Falta data de admissão", "Falta salário"]));
    expect(recebido?.empresa.razaoSocial).toContain("PADARIA");
  });

  it("não grava funcionário e registra só os nomes dos arquivos na auditoria", async () => {
    const antes = (await app.inject({ method: "GET", url: "/api/funcionarios?empresaId=e-padaria" })).json().length;
    await post({ empresaId: "e-padaria", arquivos: [{ nome: "rg.jpg", tipo: "image/jpeg", base64: "QUJD" }] });
    const depois = (await app.inject({ method: "GET", url: "/api/funcionarios?empresaId=e-padaria" })).json().length;
    expect(depois).toBe(antes);
    const aud = (await app.inject({ method: "GET", url: "/api/auditoria?limite=1" })).json()[0];
    expect(aud).toMatchObject({ acao: "ler_documentos", usuario: "Ana Analista" });
    expect(JSON.stringify(aud.detalhe)).not.toContain("QUJD");
  });

  it("empresa inexistente e corpo inválido", async () => {
    expect((await post({ empresaId: "nao-existe", arquivos: [{ nome: "a.jpg", tipo: "image/jpeg", base64: "QQ==" }] })).statusCode).toBe(404);
    expect((await post({ empresaId: "e-padaria", arquivos: [] })).statusCode).toBe(400);
  });
});
