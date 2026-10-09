/**
 * Servidor de demonstração que roda no navegador (versão publicada como artefato).
 * Responde às mesmas rotas da API real usando o mesmo motor de cálculo, as mesmas
 * validações e as mesmas regras de importação; os dados ficam em memória e numa cópia
 * no localStorage de quem está vendo.
 */
import {
  RUBRICAS_PADRAO,
  TABELAS_PADRAO,
  calcularAdiantamento,
  calcularFolhaMensal,
  dec,
  tabelaVigente,
  type ResultadoCalculo,
  type TabelasLegais as Tabelas,
} from "@folha/calculo";
import { z, ZodError } from "zod";
import { competenciaPadrao, dadosExemplo } from "../../../api/src/dados-exemplo";
import { EmpresaBody, FuncionarioBody, mensagemValidacao, opcional, RubricaBody, SindicatoBody } from "../../../api/src/esquemas";
import { CAMPOS_EMP, CAMPOS_FUNC, filtrar, planejarImportacao, type TipoImportacao } from "../../../api/src/servicos/importacao-regras";
import { numeroBR } from "../../../api/src/validacao";
import type { Auditoria, Calculo, Cargo, Empresa, Funcionario, Item, Rubrica, Sindicato, Usuario } from "../api";

type CalculoSalvo = Omit<Calculo, "funcionario" | "itens"> & { empresaId: string; itens: Item[] };
interface Lancamento {
  id: number;
  empresaId: string;
  competencia: string;
  funcionarioId: string;
  rubricaCodigo: string;
  quantidade: string | null;
  valor: string | null;
}
interface Competencia {
  empresaId: string;
  competencia: string;
  fechada: boolean;
  fechadaEm: string | null;
  fechadaPor: string | null;
}
interface Banco {
  versao: 1;
  seq: number;
  usuarios: Usuario[];
  sindicatos: Sindicato[];
  cargos: Cargo[];
  empresas: Empresa[];
  funcionarios: Funcionario[];
  rubricas: Rubrica[];
  lancamentos: Lancamento[];
  calculos: CalculoSalvo[];
  competencias: Competencia[];
  auditoria: Auditoria[];
  tabelas: Tabelas[];
}

class ErroDemo extends Error {}

const CHAVE = "folha-demo-v1";
const agora = () => new Date().toISOString();
const uid = () => (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fx = (v: unknown, casas: number) => dec(String(v ?? 0)).toFixed(casas);
const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

function limites(comp: string) {
  const [a, m] = comp.split("-").map(Number) as [number, number];
  return { inicio: `${comp}-01`, fim: `${comp}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}` };
}

/** Preenche os padrões e as escalas numéricas que o banco real aplicaria. */
function empresaCompleta(e: Partial<Empresa> & { id: string; razaoSocial: string; cnpj: string; regime: Empresa["regime"] }): Empresa {
  return {
    codigoDominio: null,
    nomeFantasia: null,
    simplesAnexoIV: false,
    cnae: null,
    fpas: null,
    codigoTerceiros: null,
    sindicatoId: null,
    responsavelId: null,
    diaPagamento: 5,
    temAdiantamento: true,
    ativa: true,
    observacoes: null,
    ...e,
    rat: fx(e.rat ?? "0.02", 6),
    fap: fx(e.fap ?? "1", 4),
    terceiros: fx(e.terceiros ?? "0.058", 6),
  } as Empresa;
}

function funcionarioCompleto(
  f: Partial<Funcionario> & { id: string; empresaId: string; matricula: number; nome: string; cpf: string; admissao: string; salario: string },
): Funcionario {
  return {
    codigoDominio: null,
    pis: null,
    dataNascimento: null,
    sexo: null,
    email: null,
    telefone: null,
    endereco: null,
    cargoId: null,
    departamento: null,
    demissao: null,
    tipoContrato: "indeterminado",
    categoria: "empregado",
    tipoSalario: "mensal",
    horasMensais: 220,
    jornada: null,
    dependentesIrrf: 0,
    filhosSalarioFamilia: 0,
    optaVt: false,
    banco: null,
    agencia: null,
    conta: null,
    pix: null,
    ...f,
    salario: fx(f.salario, 2),
    vtValorMensal: fx(f.vtValorMensal ?? "0", 2),
    percentualAdiantamento: fx(f.percentualAdiantamento ?? "0.40", 4),
  } as Funcionario;
}

function semente(): Banco {
  const d = dadosExemplo(competenciaPadrao());
  let seq = 1;
  return {
    versao: 1,
    seq: 1000,
    usuarios: d.usuarios.map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil })),
    sindicatos: d.sindicatos.map((s) => ({ ...s })),
    cargos: d.cargos.map((c) => ({ ...c })),
    empresas: d.empresas.map((e) => empresaCompleta(e)),
    funcionarios: d.funcionarios.map((f) => funcionarioCompleto(f)),
    rubricas: RUBRICAS_PADRAO.map((r) => ({ ...r, fator: r.fator ? fx(r.fator, 4) : null, ativa: r.ativa ?? true })),
    lancamentos: d.lancamentos.map((l) => ({
      id: seq++,
      ...l,
      quantidade: l.quantidade ? fx(l.quantidade, 2) : null,
      valor: l.valor ? fx(l.valor, 2) : null,
    })),
    calculos: [],
    competencias: [],
    auditoria: [],
    tabelas: TABELAS_PADRAO,
  };
}

function carregar(): Banco {
  try {
    const b = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Banco | null;
    if (b?.versao === 1) return b;
  } catch {
    /* sem armazenamento ou dado corrompido: volta ao exemplo */
  }
  return semente();
}

let db = carregar();

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch {
    /* segue só em memória */
  }
}

export function restaurarExemplo() {
  db = semente();
  salvar();
}

function auditar(usuario: string, acao: string, entidade: string, entidadeId: string | null, detalhe?: unknown) {
  db.auditoria.unshift({ id: ++db.seq, quando: agora(), usuario, acao, entidade, entidadeId, detalhe: detalhe ?? null });
  db.auditoria = db.auditoria.slice(0, 500);
}

const empresa = (id: string) => {
  const e = db.empresas.find((x) => x.id === id);
  if (!e) throw new ErroDemo("Empresa não encontrada");
  return e;
};
const fechada = (empresaId: string, comp: string) =>
  !!db.competencias.find((c) => c.empresaId === empresaId && c.competencia === comp)?.fechada;

function funcionariosDaCompetencia(empresaId: string, comp: string) {
  const { inicio, fim } = limites(comp);
  return db.funcionarios
    .filter((f) => f.empresaId === empresaId && f.admissao <= fim && (!f.demissao || f.demissao >= inicio))
    .sort((a, b) => porNome(a.nome, b.nome));
}

function calcularEmpresa(empresaId: string, comp: string, tipo: "mensal" | "adiantamento", usuario: string) {
  const e = empresa(empresaId);
  if (fechada(empresaId, comp)) throw new ErroDemo(`A competência ${comp} da ${e.razaoSocial} está fechada. Reabra para recalcular.`);
  const tabela = tabelaVigente(comp, db.tabelas);
  const rubricas = db.rubricas.map((r) => ({ ...r, fator: r.fator ?? undefined }));
  const lancs = db.lancamentos.filter((l) => l.empresaId === empresaId && l.competencia === comp);
  const adiant = new Map(
    db.calculos
      .filter((c) => c.empresaId === empresaId && c.competencia === comp && c.tipo === "adiantamento")
      .map((c) => [c.funcionarioId, c.liquido]),
  );
  const empresaCalc = {
    regime: e.regime,
    simplesAnexoIV: e.simplesAnexoIV,
    ratAjustado: dec(e.rat).times(e.fap).toFixed(6),
    terceiros: e.terceiros,
  };
  const resultados: ResultadoCalculo[] = funcionariosDaCompetencia(empresaId, comp).map((f) => {
    const entrada = {
      competencia: comp,
      empresa: empresaCalc,
      funcionario: {
        id: f.id,
        nome: f.nome,
        salario: f.salario,
        tipoSalario: f.tipoSalario,
        horasMensais: f.horasMensais,
        admissao: f.admissao,
        demissao: f.demissao,
        categoria: f.categoria,
        dependentesIrrf: f.dependentesIrrf,
        filhosSalarioFamilia: f.filhosSalarioFamilia,
        valeTransporte: { opta: f.optaVt, valorMensal: f.vtValorMensal },
        percentualAdiantamento: f.percentualAdiantamento,
      },
      lancamentos: tipo === "mensal" ? lancs.filter((l) => l.funcionarioId === f.id) : [],
      rubricas,
      tabelas: tabela,
      adiantamentoPago: adiant.get(f.id),
    };
    return tipo === "mensal" ? calcularFolhaMensal(entrada) : calcularAdiantamento(entrada);
  });

  db.calculos = db.calculos.filter((c) => !(c.empresaId === empresaId && c.competencia === comp && c.tipo === tipo));
  const quando = agora();
  for (const r of resultados) {
    if (r.itens.length === 0 && r.avisos.some((a) => a.startsWith("Sem dias"))) continue;
    db.calculos.push({
      id: ++db.seq,
      empresaId,
      funcionarioId: r.funcionarioId,
      competencia: comp,
      tipo,
      totalProventos: r.totalProventos,
      totalDescontos: r.totalDescontos,
      liquido: r.liquido,
      baseInss: r.bases.inss,
      baseFgts: r.bases.fgts,
      baseIrrf: r.bases.irrf,
      inss: r.inss,
      irrf: r.irrf,
      fgts: r.fgts,
      cpp: r.encargos.cpp,
      rat: r.encargos.rat,
      terceiros: r.encargos.terceiros,
      diasTrabalhados: r.detalhe.diasTrabalhados,
      avisos: r.avisos,
      calculadoEm: quando,
      calculadoPor: usuario,
      itens: r.itens,
    });
  }
  auditar(usuario, `calcular_${tipo}`, "empresa", empresaId, { competencia: comp, funcionarios: resultados.length });
  return {
    funcionarios: resultados.length,
    liquido: resultados.reduce((a, r) => a.plus(r.liquido), dec(0)).toFixed(2),
    avisos: resultados.reduce((a, r) => a + r.avisos.length, 0),
  };
}

function calculosComItens(empresaId: string, comp: string, tipo: string): Calculo[] {
  return db.calculos
    .filter((c) => c.empresaId === empresaId && c.competencia === comp && c.tipo === tipo)
    .flatMap((c) => {
      const f = db.funcionarios.find((x) => x.id === c.funcionarioId);
      if (!f) return [];
      const cargo = db.cargos.find((x) => x.id === f.cargoId);
      const { empresaId: _e, ...resto } = c;
      return [
        {
          ...resto,
          funcionario: {
            id: f.id,
            nome: f.nome,
            matricula: f.matricula,
            cpf: f.cpf,
            pis: f.pis,
            admissao: f.admissao,
            salario: f.salario,
            cargo: cargo?.nome ?? null,
            cbo: cargo?.cbo ?? null,
            departamento: f.departamento,
            banco: f.banco,
            agencia: f.agencia,
            conta: f.conta,
            pix: f.pix,
          },
        },
      ];
    })
    .sort((a, b) => porNome(a.funcionario.nome, b.funcionario.nome));
}

const Comp = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida (AAAA-MM)");
const Tipo = z.enum(["mensal", "adiantamento"]);

type Rota = (p: { m: RegExpMatchArray; q: URLSearchParams; corpo: unknown; usuario: string }) => unknown;
const rotas: [string, RegExp, Rota][] = [];
const rota = (metodo: string, padrao: string, fn: Rota) =>
  rotas.push([metodo, new RegExp(`^${padrao.replace(/:(\w+)/g, "([^/]+)")}$`), fn]);

// ---------- cadastros ----------
rota("GET", "/api/usuarios", () => db.usuarios);
rota("GET", "/api/sindicatos", () => [...db.sindicatos].sort((a, b) => porNome(a.nome, b.nome)));
rota("POST", "/api/sindicatos", ({ corpo, usuario }) => {
  const b = SindicatoBody.parse(corpo);
  const novo = { id: uid(), ...b, codigoDominio: b.codigoDominio ?? null, mesDataBase: b.mesDataBase ?? null } as Sindicato;
  db.sindicatos.push(novo);
  auditar(usuario, "criar", "sindicato", novo.id, b);
  return novo;
});
rota("GET", "/api/cargos", () => [...db.cargos].sort((a, b) => porNome(a.nome, b.nome)));
rota("POST", "/api/cargos", ({ corpo }) => {
  const b = z.object({ nome: z.string().trim().min(2), cbo: opcional(z.string()) }).parse(corpo);
  const novo = { id: uid(), nome: b.nome.toUpperCase(), cbo: b.cbo ?? null };
  db.cargos.push(novo);
  return novo;
});

rota("GET", "/api/empresas", () => {
  const hoje = agora().slice(0, 10);
  return [...db.empresas]
    .sort((a, b) => porNome(a.razaoSocial, b.razaoSocial))
    .map((e) => ({
      ...e,
      funcionariosAtivos: db.funcionarios.filter((f) => f.empresaId === e.id && (!f.demissao || f.demissao >= hoje)).length,
      sindicato: db.sindicatos.find((s) => s.id === e.sindicatoId)?.nome ?? null,
      responsavel: db.usuarios.find((u) => u.id === e.responsavelId)?.nome ?? null,
    }));
});
rota("GET", "/api/empresas/:id", ({ m }) => empresa(m[1]!));
rota("POST", "/api/empresas", ({ corpo, usuario }) => {
  const b = EmpresaBody.parse(corpo);
  if (db.empresas.some((e) => e.cnpj === b.cnpj)) throw new ErroDemo("Já existe empresa com este CNPJ");
  const nova = empresaCompleta({ id: uid(), ...b } as Parameters<typeof empresaCompleta>[0]);
  db.empresas.push(nova);
  auditar(usuario, "criar", "empresa", nova.id, b);
  return nova;
});
rota("PUT", "/api/empresas/:id", ({ m, corpo, usuario }) => {
  const b = EmpresaBody.parse(corpo);
  const atual = empresa(m[1]!);
  if (db.empresas.some((e) => e.cnpj === b.cnpj && e.id !== atual.id)) throw new ErroDemo("Já existe empresa com este CNPJ");
  Object.assign(atual, empresaCompleta({ ...atual, ...b } as Parameters<typeof empresaCompleta>[0]));
  auditar(usuario, "alterar", "empresa", atual.id, b);
  return { ok: true };
});

rota("GET", "/api/funcionarios", ({ q }) => {
  const empresaId = q.get("empresaId");
  return db.funcionarios
    .filter((f) => !empresaId || f.empresaId === empresaId)
    .map((f) => {
      const cargo = db.cargos.find((c) => c.id === f.cargoId);
      return { ...f, cargo: cargo?.nome ?? null, cbo: cargo?.cbo ?? null, empresa: db.empresas.find((e) => e.id === f.empresaId)?.razaoSocial };
    })
    .sort((a, b) => porNome(a.empresa ?? "", b.empresa ?? "") || porNome(a.nome, b.nome));
});
rota("GET", "/api/funcionarios/:id", ({ m }) => {
  const f = db.funcionarios.find((x) => x.id === m[1]);
  if (!f) throw new ErroDemo("Funcionário não encontrado");
  return f;
});
rota("POST", "/api/funcionarios", ({ corpo, usuario }) => {
  const b = FuncionarioBody.parse(corpo);
  if (db.funcionarios.some((f) => f.empresaId === b.empresaId && f.cpf === b.cpf && !f.demissao)) {
    throw new ErroDemo("Já existe funcionário ativo com este CPF nesta empresa");
  }
  const matricula = b.matricula ?? Math.max(0, ...db.funcionarios.filter((f) => f.empresaId === b.empresaId).map((f) => f.matricula)) + 1;
  const novo = funcionarioCompleto({ id: uid(), ...b, matricula } as Parameters<typeof funcionarioCompleto>[0]);
  db.funcionarios.push(novo);
  auditar(usuario, "admitir", "funcionario", novo.id, { nome: b.nome, empresaId: b.empresaId });
  return novo;
});
rota("PUT", "/api/funcionarios/:id", ({ m, corpo, usuario }) => {
  const b = FuncionarioBody.parse(corpo);
  const atual = db.funcionarios.find((x) => x.id === m[1]);
  if (!atual) throw new ErroDemo("Funcionário não encontrado");
  Object.assign(atual, funcionarioCompleto({ ...atual, ...b, matricula: b.matricula ?? atual.matricula } as Parameters<typeof funcionarioCompleto>[0]));
  auditar(usuario, "alterar", "funcionario", atual.id, b);
  return { ok: true };
});

rota("GET", "/api/rubricas", () => [...db.rubricas].sort((a, b) => a.codigo.localeCompare(b.codigo)));
rota("POST", "/api/rubricas", ({ corpo, usuario }) => {
  const b = RubricaBody.parse(corpo);
  if (db.rubricas.some((r) => r.codigo === b.codigo)) throw new ErroDemo(`Já existe a rubrica ${b.codigo}`);
  db.rubricas.push({ ...b, fator: b.fator ? fx(b.fator, 4) : null });
  auditar(usuario, "criar", "rubrica", b.codigo, b);
  return b;
});
rota("PUT", "/api/rubricas/:codigo", ({ m, corpo, usuario }) => {
  const atual = db.rubricas.find((r) => r.codigo === m[1]);
  if (!atual) throw new ErroDemo("Rubrica não encontrada");
  if (atual.modo === "sistema") {
    Object.assign(atual, z.object({ descricao: z.string().trim().min(2), ativa: z.boolean() }).parse(corpo));
  } else {
    const { codigo: _c, ...b } = RubricaBody.parse({ ...(corpo as object), codigo: atual.codigo });
    Object.assign(atual, { ...b, fator: b.fator ? fx(b.fator, 4) : null });
  }
  auditar(usuario, "alterar", "rubrica", atual.codigo, corpo);
  return { ok: true };
});

rota("GET", "/api/tabelas", () => db.tabelas);
rota("GET", "/api/auditoria", ({ q }) => db.auditoria.slice(0, Math.min(Number(q.get("limite")) || 100, 500)));

// ---------- folha ----------
rota("GET", "/api/painel", ({ q }) => {
  const comp = Comp.parse(q.get("competencia"));
  return db.empresas
    .filter((e) => e.ativa)
    .sort((a, b) => porNome(a.razaoSocial, b.razaoSocial))
    .map((e) => {
      const doMes = db.calculos.filter((c) => c.empresaId === e.id && c.competencia === comp);
      const mensal = doMes.filter((c) => c.tipo === "mensal");
      const ad = doMes.filter((c) => c.tipo === "adiantamento");
      const somar = (xs: CalculoSalvo[], k: "liquido" | "fgts" | "inss" | "irrf") => xs.reduce((a, c) => a.plus(c[k]), dec(0)).toFixed(2);
      const fech = db.competencias.find((c) => c.empresaId === e.id && c.competencia === comp);
      return {
        empresaId: e.id,
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        regime: e.regime,
        temAdiantamento: e.temAdiantamento,
        funcionarios: funcionariosDaCompetencia(e.id, comp).length,
        lancamentos: db.lancamentos.filter((l) => l.empresaId === e.id && l.competencia === comp).length,
        adiantamento: ad.length ? { calculados: ad.length, liquido: somar(ad, "liquido"), calculadoEm: ad[0]!.calculadoEm } : null,
        mensal: mensal.length
          ? {
              calculados: mensal.length,
              liquido: somar(mensal, "liquido"),
              fgts: somar(mensal, "fgts"),
              inss: somar(mensal, "inss"),
              irrf: somar(mensal, "irrf"),
              avisos: mensal.reduce((a, c) => a + c.avisos.length, 0),
              calculadoEm: mensal[0]!.calculadoEm,
            }
          : null,
        fechada: !!fech?.fechada,
        fechadaPor: fech?.fechadaPor ?? null,
      };
    });
});

rota("GET", "/api/lancamentos", ({ q }) => {
  const comp = Comp.parse(q.get("competencia"));
  const empresaId = z.string().parse(q.get("empresaId"));
  return {
    fechada: fechada(empresaId, comp),
    funcionarios: funcionariosDaCompetencia(empresaId, comp).map((f) => ({ id: f.id, nome: f.nome, matricula: f.matricula, salario: f.salario })),
    rubricas: db.rubricas.filter((r) => r.ativa && r.modo !== "sistema").sort((a, b) => a.codigo.localeCompare(b.codigo)),
    lancamentos: db.lancamentos.filter((l) => l.empresaId === empresaId && l.competencia === comp),
  };
});
rota("PUT", "/api/lancamentos", ({ corpo, usuario }) => {
  const b = z
    .object({
      empresaId: z.string(),
      competencia: Comp,
      lancamentos: z.array(
        z.object({
          funcionarioId: z.string(),
          rubricaCodigo: z.string(),
          quantidade: z.union([z.string(), z.number()]).nullish(),
          valor: z.union([z.string(), z.number()]).nullish(),
        }),
      ),
    })
    .parse(corpo);
  if (fechada(b.empresaId, b.competencia)) throw new ErroDemo("Competência fechada");
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : numeroBR(v));
  const validos = b.lancamentos
    .map((l) => ({ ...l, quantidade: num(l.quantidade), valor: num(l.valor) }))
    .filter((l) => (l.quantidade !== null && l.quantidade !== 0) || (l.valor !== null && l.valor !== 0));
  if (validos.some((l) => [l.quantidade, l.valor].some((v) => v !== null && !Number.isFinite(v)))) {
    throw new ErroDemo("Há valores inválidos nos lançamentos");
  }
  db.lancamentos = db.lancamentos.filter((l) => !(l.empresaId === b.empresaId && l.competencia === b.competencia));
  for (const l of validos) {
    db.lancamentos.push({
      id: ++db.seq,
      empresaId: b.empresaId,
      competencia: b.competencia,
      funcionarioId: l.funcionarioId,
      rubricaCodigo: l.rubricaCodigo,
      quantidade: l.quantidade === null ? null : fx(l.quantidade, 2),
      valor: l.valor === null ? null : fx(l.valor, 2),
    });
  }
  auditar(usuario, "lancar_variaveis", "empresa", b.empresaId, { competencia: b.competencia, quantidade: validos.length });
  return { gravados: validos.length };
});

rota("POST", "/api/calcular", ({ corpo, usuario }) => {
  const b = z.object({ competencia: Comp, tipo: Tipo, empresaIds: z.array(z.string()).min(1) }).parse(corpo);
  return b.empresaIds.map((empresaId) => {
    try {
      return { empresaId, ok: true, ...calcularEmpresa(empresaId, b.competencia, b.tipo, usuario) };
    } catch (e) {
      return { empresaId, ok: false, erro: (e as Error).message };
    }
  });
});
rota("GET", "/api/calculos", ({ q }) =>
  calculosComItens(z.string().parse(q.get("empresaId")), Comp.parse(q.get("competencia")), Tipo.parse(q.get("tipo") ?? "mensal")),
);
rota("POST", "/api/competencias/fechamento", ({ corpo, usuario }) => {
  const b = z.object({ empresaId: z.string(), competencia: Comp, fechada: z.boolean() }).parse(corpo);
  if (b.fechada && !db.calculos.some((c) => c.empresaId === b.empresaId && c.competencia === b.competencia && c.tipo === "mensal")) {
    throw new ErroDemo("Calcule a folha mensal antes de fechar a competência");
  }
  const valores = { ...b, fechadaEm: b.fechada ? agora() : null, fechadaPor: b.fechada ? usuario : null };
  const i = db.competencias.findIndex((c) => c.empresaId === b.empresaId && c.competencia === b.competencia);
  if (i >= 0) db.competencias[i] = valores;
  else db.competencias.push(valores);
  auditar(usuario, b.fechada ? "fechar_competencia" : "reabrir_competencia", "empresa", b.empresaId, { competencia: b.competencia });
  return { ok: true };
});

rota("GET", "/api/relatorios", ({ q }) => {
  const comp = Comp.parse(q.get("competencia"));
  const e = empresa(z.string().parse(q.get("empresaId")));
  const tipo = Tipo.parse(q.get("tipo") ?? "mensal");
  const lista = calculosComItens(e.id, comp, tipo);
  const porRubrica = new Map<string, { codigo: string; descricao: string; tipo: string; quantidade: number; valor: ReturnType<typeof dec> }>();
  for (const c of lista)
    for (const i of c.itens) {
      const r = porRubrica.get(i.codigo) ?? { codigo: i.codigo, descricao: i.descricao, tipo: i.tipo, quantidade: 0, valor: dec(0) };
      r.quantidade++;
      r.valor = r.valor.plus(i.valor);
      porRubrica.set(i.codigo, r);
    }
  const somar = (k: keyof Calculo) => lista.reduce((a, c) => a.plus(String(c[k])), dec(0)).toFixed(2);
  return {
    empresa: { ...e, sindicato: db.sindicatos.find((s) => s.id === e.sindicatoId)?.nome ?? null },
    competencia: comp,
    tipo,
    calculos: lista,
    resumoRubricas: [...porRubrica.values()]
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map((r) => ({ ...r, valor: r.valor.toFixed(2) })),
    totais: {
      funcionarios: lista.length,
      proventos: somar("totalProventos"),
      descontos: somar("totalDescontos"),
      liquido: somar("liquido"),
      baseInss: somar("baseInss"),
      baseFgts: somar("baseFgts"),
      baseIrrf: somar("baseIrrf"),
      inss: somar("inss"),
      irrf: somar("irrf"),
      fgts: somar("fgts"),
      cpp: somar("cpp"),
      rat: somar("rat"),
      terceiros: somar("terceiros"),
    },
  };
});

// ---------- importação ----------
const CorpoImport = z.object({
  tipo: z.enum(["funcionarios", "empresas"]),
  empresaId: z.string().optional(),
  linhas: z.array(z.record(z.string(), z.unknown())).min(1, "Arquivo sem linhas").max(5000),
});
function previa(b: z.infer<typeof CorpoImport>) {
  if (b.tipo === "empresas") return planejarImportacao("empresas", b.linhas, { empresas: db.empresas, funcionarios: [] });
  if (!b.empresaId) throw new ErroDemo("Escolha a empresa de destino dos funcionários");
  empresa(b.empresaId);
  return planejarImportacao("funcionarios" as TipoImportacao, b.linhas, {
    empresas: [],
    funcionarios: db.funcionarios.filter((f) => f.empresaId === b.empresaId),
  });
}
rota("POST", "/api/importacao/previa", ({ corpo }) => previa(CorpoImport.parse(corpo)));
rota("POST", "/api/importacao/aplicar", ({ corpo, usuario }) => {
  const b = CorpoImport.parse(corpo);
  const p = previa(b);
  if (b.tipo === "empresas") {
    for (const n of p.novos) {
      db.empresas.push(empresaCompleta({ id: uid(), ...filtrar(n.dados, CAMPOS_EMP), cnpj: n.dados.cnpj, razaoSocial: n.dados.razaoSocial, regime: n.dados.regime } as Parameters<typeof empresaCompleta>[0]));
    }
    for (const a of p.alterados) {
      const e = empresa(a.id);
      Object.assign(e, empresaCompleta({ ...e, ...filtrar(a.dados, CAMPOS_EMP) } as Parameters<typeof empresaCompleta>[0]));
    }
  } else {
    const daEmpresa = db.funcionarios.filter((f) => f.empresaId === b.empresaId);
    const usadas = new Set(daEmpresa.map((f) => f.matricula));
    let proxima = Math.max(0, ...usadas) + 1;
    const cargoId = (nome: unknown, cbo: unknown) => {
      if (!nome) return null;
      const achado = db.cargos.find((c) => c.nome.toUpperCase() === String(nome).toUpperCase());
      if (achado) return achado.id;
      const novo = { id: uid(), nome: String(nome).toUpperCase(), cbo: cbo ? String(cbo) : null };
      db.cargos.push(novo);
      return novo.id;
    };
    for (const n of p.novos) {
      const cod = Number(n.dados.codigoDominio);
      let matricula = Number.isInteger(cod) && cod > 0 && !usadas.has(cod) ? cod : proxima;
      while (usadas.has(matricula)) matricula = ++proxima;
      usadas.add(matricula);
      if (matricula >= proxima) proxima = matricula + 1;
      db.funcionarios.push(
        funcionarioCompleto({
          id: uid(),
          empresaId: b.empresaId!,
          matricula,
          ...filtrar(n.dados, CAMPOS_FUNC),
          nome: n.dados.nome,
          cpf: n.dados.cpf,
          admissao: n.dados.admissao,
          salario: n.dados.salario,
          cargoId: cargoId(n.dados.cargo, n.dados.cbo),
        } as Parameters<typeof funcionarioCompleto>[0]),
      );
    }
    for (const a of p.alterados) {
      const f = db.funcionarios.find((x) => x.id === a.id);
      if (f) Object.assign(f, funcionarioCompleto({ ...f, ...filtrar(a.dados, CAMPOS_FUNC) } as Parameters<typeof funcionarioCompleto>[0]));
    }
  }
  auditar(usuario, "importar", b.tipo, b.empresaId ?? null, { inseridos: p.novos.length, atualizados: p.alterados.length, revisar: p.revisar.length });
  return { inseridos: p.novos.length, atualizados: p.alterados.length, revisar: p.revisar.length };
});

/** Atende uma chamada como a API real atenderia. Erros saem com a mesma mensagem. */
export async function chamarDemo(metodo: string, url: string, corpo: unknown, usuarioId: string): Promise<unknown> {
  const u = new URL(url, "http://demo.local");
  const usuario = db.usuarios.find((x) => x.id === usuarioId)?.nome ?? "sistema";
  for (const [m, re, fn] of rotas) {
    const achou = m === metodo ? u.pathname.match(re) : null;
    if (!achou) continue;
    try {
      const r = fn({ m: achou, q: u.searchParams, corpo, usuario });
      if (metodo !== "GET") salvar();
      // Cópia profunda: a tela nunca segura referência ao "banco".
      return JSON.parse(JSON.stringify(r ?? null));
    } catch (e) {
      if (e instanceof ZodError) throw new ErroDemo(mensagemValidacao(e));
      throw e;
    }
  }
  throw new ErroDemo("Rota não encontrada");
}
