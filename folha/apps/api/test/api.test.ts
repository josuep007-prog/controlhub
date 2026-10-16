import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { criarApp } from "../src/app.js";
import { abrirBanco, type ConexaoDb } from "../src/db/index.js";
import { semear } from "../src/seed.js";

const COMP = "2026-09";
let conexao: ConexaoDb;
let app: FastifyInstance;

const req = async (method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, payload: payload as object, headers: { "x-usuario": "u-ana" } });
  return { status: r.statusCode, body: r.json() };
};

beforeAll(async () => {
  conexao = await abrirBanco({ dataDir: ":memory:" });
  await semear(conexao.db, COMP);
  app = await criarApp(conexao.db);
}, 60_000);

afterAll(async () => {
  await app?.close();
  await conexao?.fechar();
});

describe("cadastros", () => {
  it("lista as empresas de exemplo com funcionários ativos", async () => {
    const { body } = await req("GET", "/api/empresas");
    expect(body).toHaveLength(3);
    expect(body.find((e: { id: string }) => e.id === "e-metal").funcionariosAtivos).toBe(6);
  });

  it("recusa CPF inválido na admissão", async () => {
    const r = await req("POST", "/api/funcionarios", {
      empresaId: "e-padaria",
      nome: "Fulano de Tal",
      cpf: "111.111.111-11",
      admissao: "2026-09-01",
      salario: "2000",
    });
    expect(r.status).toBe(400);
    expect(r.body.erro).toMatch(/CPF inválido/);
  });

  it("admite funcionário com matrícula sequencial e registra auditoria", async () => {
    const r = await req("POST", "/api/funcionarios", {
      empresaId: "e-padaria",
      nome: "Teste Admissão",
      cpf: "529.982.247-25",
      admissao: "2026-09-01",
      salario: "2.100,00",
    });
    expect(r.status).toBe(200);
    expect(r.body.matricula).toBe(6);
    expect(r.body.nome).toBe("TESTE ADMISSÃO");
    const aud = await req("GET", "/api/auditoria");
    expect(aud.body[0]).toMatchObject({ acao: "admitir", usuario: "Ana Analista" });
  });
});

describe("folha", () => {
  it("calcula adiantamento e depois a mensal, que desconta o adiantamento", async () => {
    const ad = await req("POST", "/api/calcular", { competencia: COMP, tipo: "adiantamento", empresaIds: ["e-metal"] });
    expect(ad.body[0]).toMatchObject({ ok: true });

    const m = await req("POST", "/api/calcular", { competencia: COMP, tipo: "mensal", empresaIds: ["e-metal", "e-padaria", "e-clinica"] });
    expect(m.body.every((r: { ok: boolean }) => r.ok)).toBe(true);

    const { body } = await req("GET", `/api/calculos?empresaId=e-metal&competencia=${COMP}&tipo=mensal`);
    const roberto = body.find((c: { funcionario: { nome: string } }) => c.funcionario.nome === "ROBERTO CARLOS PEREIRA");
    const codigos = roberto.itens.map((i: { codigo: string }) => i.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["001", "010", "020", "901", "210", "950"]));
    expect(roberto.itens.find((i: { codigo: string }) => i.codigo === "210").valor).toBe("1680.00"); // 40% de 4.200
  });

  it("painel mostra a competência calculada", async () => {
    const { body } = await req("GET", `/api/painel?competencia=${COMP}`);
    const metal = body.find((p: { empresaId: string }) => p.empresaId === "e-metal");
    expect(metal.mensal.calculados).toBe(6);
    expect(metal.adiantamento.calculados).toBe(6);
  });

  it("relatório soma as rubricas e os encargos", async () => {
    const { body } = await req("GET", `/api/relatorios?empresaId=e-metal&competencia=${COMP}`);
    expect(body.totais.funcionarios).toBe(6);
    const liquidoSomado = body.calculos.reduce((a: number, c: { liquido: string }) => a + Number(c.liquido), 0);
    expect(Number(body.totais.liquido)).toBeCloseTo(liquidoSomado, 2);
    expect(Number(body.totais.cpp)).toBeGreaterThan(0); // presumido recolhe CPP
  });

  it("Simples Nacional não gera CPP", async () => {
    const { body } = await req("GET", `/api/relatorios?empresaId=e-padaria&competencia=${COMP}`);
    expect(body.totais.cpp).toBe("0.00");
  });

  it("competência fechada bloqueia lançamentos e recálculo até reabrir", async () => {
    expect((await req("POST", "/api/competencias/fechamento", { empresaId: "e-clinica", competencia: COMP, fechada: true })).status).toBe(200);
    const lanc = await req("PUT", "/api/lancamentos", { empresaId: "e-clinica", competencia: COMP, lancamentos: [] });
    expect(lanc.status).toBe(409);
    const calc = await req("POST", "/api/calcular", { competencia: COMP, tipo: "mensal", empresaIds: ["e-clinica"] });
    expect(calc.body[0].ok).toBe(false);
    await req("POST", "/api/competencias/fechamento", { empresaId: "e-clinica", competencia: COMP, fechada: false });
    const de_novo = await req("POST", "/api/calcular", { competencia: COMP, tipo: "mensal", empresaIds: ["e-clinica"] });
    expect(de_novo.body[0].ok).toBe(true);
  });

  it("grava lançamentos e o recálculo usa os novos valores", async () => {
    const r = await req("PUT", "/api/lancamentos", {
      empresaId: "e-padaria",
      competencia: COMP,
      lancamentos: [{ funcionarioId: "e-padaria-3", rubricaCodigo: "040", valor: "150,00" }],
    });
    expect(r.body.gravados).toBe(1);
    await req("POST", "/api/calcular", { competencia: COMP, tipo: "mensal", empresaIds: ["e-padaria"] });
    const { body } = await req("GET", `/api/calculos?empresaId=e-padaria&competencia=${COMP}`);
    const luciana = body.find((c: { funcionarioId: string }) => c.funcionarioId === "e-padaria-3");
    expect(luciana.itens.find((i: { codigo: string }) => i.codigo === "040").valor).toBe("150.00");
    expect(luciana.itens.find((i: { codigo: string }) => i.codigo === "010")).toBeUndefined();
  });
});

describe("importação do Domínio", () => {
  const linhas = [
    { Código: "50", "Nome do Empregado": "Novo Importado", CPF: "390.533.447-05", Admissão: "01/08/2026", Salário: "2.500,00", Cargo: "Estoquista", CBO: "414105" },
    { Código: "1", "Nome do Empregado": "MARIA APARECIDA DOS SANTOS", CPF: "", Admissão: "12/03/2018", Salário: "2.350,00" },
    { Código: "51", "Nome do Empregado": "Sem Admissão", CPF: "111.444.777-35", Salário: "2.000,00" },
  ];

  it("prévia separa novos, alterados e revisar", async () => {
    const empresas = await req("GET", "/api/funcionarios?empresaId=e-padaria");
    const maria = empresas.body.find((f: { matricula: number }) => f.matricula === 1);
    linhas[1]!.CPF = maria.cpf;
    linhas[1]!.Salário = "2.600,00";

    const { status, body } = await req("POST", "/api/importacao/previa", { tipo: "funcionarios", empresaId: "e-padaria", linhas });
    expect(status).toBe(200);
    expect(body.colunas.reconhecidas).toMatchObject({ "Nome do Empregado": "nome", Salário: "salario", Admissão: "admissao" });
    expect(body.novos.map((n: { nome: string }) => n.nome)).toEqual(["NOVO IMPORTADO"]);
    expect(body.alterados[0].mudancas).toEqual([{ campo: "salario", de: "2350.00", para: "2600.00" }]);
    expect(body.revisar[0].motivo).toMatch(/admissao/);
  });

  it("aplicar grava e cria o cargo", async () => {
    const { body } = await req("POST", "/api/importacao/aplicar", { tipo: "funcionarios", empresaId: "e-padaria", linhas });
    expect(body).toEqual({ inseridos: 1, atualizados: 1, revisar: 1 });
    const funcs = await req("GET", "/api/funcionarios?empresaId=e-padaria");
    const novo = funcs.body.find((f: { nome: string }) => f.nome === "NOVO IMPORTADO");
    expect(novo).toMatchObject({ matricula: 50, cargo: "ESTOQUISTA", admissao: "2026-08-01", salario: "2500.00" });
  });

  it("importa empresas pelo CNPJ", async () => {
    const { body } = await req("POST", "/api/importacao/previa", {
      tipo: "empresas",
      linhas: [
        { Código: "400", "Razão Social": "Nova Empresa Importada", CNPJ: "11.444.777/0001-61", Tributação: "Lucro Presumido", RAT: "2" },
        { Código: "401", "Razão Social": "CNPJ Errado", CNPJ: "11.222.333/0001-00", Tributação: "Simples Nacional" },
      ],
    });
    expect(body.novos).toHaveLength(1);
    expect(body.novos[0].dados).toMatchObject({ regime: "presumido", rat: "0.020000" });
    expect(body.revisar[0].motivo).toMatch(/CNPJ inválido/);
  });
});
