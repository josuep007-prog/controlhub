import { dec } from "@folha/calculo";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/index.js";
import { calculoItens, calculos, cargos, competencias, empresas, funcionarios, lancamentos, rubricas, sindicatos } from "../db/schema.js";
import { calcularEmpresa, competenciaFechada, funcionariosDaCompetencia } from "../servicos/calculo.js";
import { competenciaValida, ErroNegocio, numeroBR, registrarAuditoria } from "../util.js";

const Comp = z.string().refine(competenciaValida, "Competência inválida (AAAA-MM)");
const Tipo = z.enum(["mensal", "adiantamento"]);

async function calculosComItens(db: Db, empresaId: string, comp: string, tipo: "mensal" | "adiantamento") {
  const linhas = await db
    .select({ c: calculos, f: funcionarios, cargo: cargos.nome, cbo: cargos.cbo })
    .from(calculos)
    .innerJoin(funcionarios, eq(funcionarios.id, calculos.funcionarioId))
    .leftJoin(cargos, eq(cargos.id, funcionarios.cargoId))
    .where(and(eq(calculos.empresaId, empresaId), eq(calculos.competencia, comp), eq(calculos.tipo, tipo)))
    .orderBy(asc(funcionarios.nome));
  const ids = linhas.map((l) => l.c.id);
  const itens = ids.length
    ? await db.select().from(calculoItens).where(inArray(calculoItens.calculoId, ids)).orderBy(asc(calculoItens.ordem))
    : [];
  return linhas.map((l) => ({
    ...l.c,
    funcionario: {
      id: l.f.id,
      nome: l.f.nome,
      matricula: l.f.matricula,
      cpf: l.f.cpf,
      pis: l.f.pis,
      admissao: l.f.admissao,
      salario: l.f.salario,
      cargo: l.cargo,
      cbo: l.cbo,
      departamento: l.f.departamento,
      banco: l.f.banco,
      agencia: l.f.agencia,
      conta: l.f.conta,
      pix: l.f.pix,
    },
    itens: itens.filter((i) => i.calculoId === l.c.id),
  }));
}

export function rotasFolha(app: FastifyInstance, db: Db) {
  /** Painel da competência: uma linha por empresa ativa. */
  app.get<{ Querystring: { competencia?: string } }>("/api/painel", async (req) => {
    const comp = Comp.parse(req.query.competencia);
    const lista = await db.select().from(empresas).where(eq(empresas.ativa, true)).orderBy(asc(empresas.razaoSocial));
    const [calcs, fechadas, lancs] = await Promise.all([
      db.select().from(calculos).where(eq(calculos.competencia, comp)),
      db.select().from(competencias).where(eq(competencias.competencia, comp)),
      db.select({ empresaId: lancamentos.empresaId }).from(lancamentos).where(eq(lancamentos.competencia, comp)),
    ]);
    return Promise.all(
      lista.map(async (e) => {
        const doMes = calcs.filter((c) => c.empresaId === e.id);
        const mensal = doMes.filter((c) => c.tipo === "mensal");
        const adiant = doMes.filter((c) => c.tipo === "adiantamento");
        const funcs = await funcionariosDaCompetencia(db, e.id, comp);
        const somar = (xs: typeof doMes, k: "liquido" | "fgts" | "inss" | "irrf") => xs.reduce((a, c) => a.plus(c[k]), dec(0)).toFixed(2);
        const fechada = fechadas.find((f) => f.empresaId === e.id);
        return {
          empresaId: e.id,
          razaoSocial: e.razaoSocial,
          cnpj: e.cnpj,
          regime: e.regime,
          temAdiantamento: e.temAdiantamento,
          funcionarios: funcs.length,
          lancamentos: lancs.filter((l) => l.empresaId === e.id).length,
          adiantamento: adiant.length ? { calculados: adiant.length, liquido: somar(adiant, "liquido"), calculadoEm: adiant[0]!.calculadoEm } : null,
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
          fechada: !!fechada?.fechada,
          fechadaPor: fechada?.fechadaPor ?? null,
        };
      }),
    );
  });

  /** Grade de lançamentos de variáveis da empresa na competência. */
  app.get<{ Querystring: { empresaId?: string; competencia?: string } }>("/api/lancamentos", async (req) => {
    const comp = Comp.parse(req.query.competencia);
    const empresaId = z.string().parse(req.query.empresaId);
    const [funcs, rubs, lancs, fechada] = await Promise.all([
      funcionariosDaCompetencia(db, empresaId, comp),
      db.select().from(rubricas).where(eq(rubricas.ativa, true)).orderBy(asc(rubricas.codigo)),
      db
        .select()
        .from(lancamentos)
        .where(and(eq(lancamentos.empresaId, empresaId), eq(lancamentos.competencia, comp))),
      competenciaFechada(db, empresaId, comp),
    ]);
    return {
      fechada,
      funcionarios: funcs.map((f) => ({ id: f.id, nome: f.nome, matricula: f.matricula, salario: f.salario })),
      rubricas: rubs.filter((r) => r.modo !== "sistema"),
      lancamentos: lancs,
    };
  });

  /** Substitui todos os lançamentos da empresa na competência. */
  app.put("/api/lancamentos", async (req) => {
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
      .parse(req.body);
    if (await competenciaFechada(db, b.empresaId, b.competencia)) throw new ErroNegocio("Competência fechada", 409);
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(numeroBR(v)));
    const validos = b.lancamentos
      .map((l) => ({ ...l, quantidade: num(l.quantidade), valor: num(l.valor) }))
      .filter((l) => (l.quantidade && Number(l.quantidade) !== 0) || (l.valor && Number(l.valor) !== 0));
    if (validos.some((l) => [l.quantidade, l.valor].some((v) => v !== null && !Number.isFinite(Number(v))))) {
      throw new ErroNegocio("Há valores inválidos nos lançamentos");
    }
    await db.transaction(async (tx) => {
      await tx.delete(lancamentos).where(and(eq(lancamentos.empresaId, b.empresaId), eq(lancamentos.competencia, b.competencia)));
      if (validos.length) {
        await tx.insert(lancamentos).values(validos.map((l) => ({ ...l, empresaId: b.empresaId, competencia: b.competencia })));
      }
      await registrarAuditoria(tx, req.usuario, "lancar_variaveis", "empresa", b.empresaId, {
        competencia: b.competencia,
        quantidade: validos.length,
      });
    });
    return { gravados: validos.length };
  });

  /** Calcula uma ou várias empresas. Erros de uma empresa não impedem as outras. */
  app.post("/api/calcular", async (req) => {
    const b = z.object({ competencia: Comp, tipo: Tipo, empresaIds: z.array(z.string()).min(1) }).parse(req.body);
    const resultados = [];
    for (const empresaId of b.empresaIds) {
      try {
        resultados.push({ empresaId, ok: true, ...(await calcularEmpresa(db, empresaId, b.competencia, b.tipo, req.usuario)) });
      } catch (e) {
        resultados.push({ empresaId, ok: false, erro: (e as Error).message });
      }
    }
    return resultados;
  });

  app.get<{ Querystring: { empresaId?: string; competencia?: string; tipo?: string } }>("/api/calculos", async (req) => {
    const comp = Comp.parse(req.query.competencia);
    const empresaId = z.string().parse(req.query.empresaId);
    return calculosComItens(db, empresaId, comp, Tipo.parse(req.query.tipo ?? "mensal"));
  });

  app.post("/api/competencias/fechamento", async (req) => {
    const b = z.object({ empresaId: z.string(), competencia: Comp, fechada: z.boolean() }).parse(req.body);
    if (b.fechada) {
      const [algum] = await db
        .select({ id: calculos.id })
        .from(calculos)
        .where(and(eq(calculos.empresaId, b.empresaId), eq(calculos.competencia, b.competencia), eq(calculos.tipo, "mensal")))
        .limit(1);
      if (!algum) throw new ErroNegocio("Calcule a folha mensal antes de fechar a competência");
    }
    const valores = {
      empresaId: b.empresaId,
      competencia: b.competencia,
      fechada: b.fechada,
      fechadaEm: b.fechada ? new Date() : null,
      fechadaPor: b.fechada ? req.usuario : null,
    };
    await db
      .insert(competencias)
      .values(valores)
      .onConflictDoUpdate({ target: [competencias.empresaId, competencias.competencia], set: valores });
    await registrarAuditoria(db, req.usuario, b.fechada ? "fechar_competencia" : "reabrir_competencia", "empresa", b.empresaId, {
      competencia: b.competencia,
    });
    return { ok: true };
  });

  /** Dados para os relatórios (recibo, extrato, líquidos, encargos). */
  app.get<{ Querystring: { empresaId?: string; competencia?: string; tipo?: string } }>("/api/relatorios", async (req) => {
    const comp = Comp.parse(req.query.competencia);
    const empresaId = z.string().parse(req.query.empresaId);
    const tipo = Tipo.parse(req.query.tipo ?? "mensal");
    const [linha] = await db
      .select({ e: empresas, sindicato: sindicatos.nome })
      .from(empresas)
      .leftJoin(sindicatos, eq(sindicatos.id, empresas.sindicatoId))
      .where(eq(empresas.id, empresaId));
    if (!linha) throw new ErroNegocio("Empresa não encontrada", 404);
    const lista = await calculosComItens(db, empresaId, comp, tipo);

    const porRubrica = new Map<string, { codigo: string; descricao: string; tipo: string; quantidade: number; valor: ReturnType<typeof dec> }>();
    for (const c of lista)
      for (const i of c.itens) {
        const r = porRubrica.get(i.codigo) ?? { codigo: i.codigo, descricao: i.descricao, tipo: i.tipo, quantidade: 0, valor: dec(0) };
        r.quantidade++;
        r.valor = r.valor.plus(i.valor);
        porRubrica.set(i.codigo, r);
      }
    const somar = (k: keyof (typeof lista)[number]) => lista.reduce((a, c) => a.plus(String(c[k])), dec(0)).toFixed(2);
    return {
      empresa: { ...linha.e, sindicato: linha.sindicato },
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
}
