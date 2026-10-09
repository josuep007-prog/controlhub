import { and, asc, count, desc, eq, isNull, max, or, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/index.js";
import { auditoria, cargos, empresas, funcionarios, rubricas, sindicatos, usuarios } from "../db/schema.js";
import { carregarTabelas } from "../servicos/calculo.js";
import { EmpresaBody, FuncionarioBody, opcional, RubricaBody, SindicatoBody } from "../esquemas.js";
import { ErroNegocio, registrarAuditoria, uid } from "../util.js";

export function rotasCadastros(app: FastifyInstance, db: Db) {
  app.get("/api/usuarios", () => db.select().from(usuarios).where(eq(usuarios.ativo, true)).orderBy(asc(usuarios.nome)));

  // Sindicatos
  app.get("/api/sindicatos", () => db.select().from(sindicatos).orderBy(asc(sindicatos.nome)));
  app.post("/api/sindicatos", async (req) => {
    const b = SindicatoBody.parse(req.body);
    const novo = { id: uid(), ...b };
    await db.insert(sindicatos).values(novo);
    await registrarAuditoria(db, req.usuario, "criar", "sindicato", novo.id, b);
    return novo;
  });
  app.put<{ Params: { id: string } }>("/api/sindicatos/:id", async (req) => {
    const b = SindicatoBody.parse(req.body);
    await db.update(sindicatos).set(b).where(eq(sindicatos.id, req.params.id));
    await registrarAuditoria(db, req.usuario, "alterar", "sindicato", req.params.id, b);
    return { ok: true };
  });

  // Cargos
  app.get("/api/cargos", () => db.select().from(cargos).orderBy(asc(cargos.nome)));
  app.post("/api/cargos", async (req) => {
    const b = z.object({ nome: z.string().trim().min(2), cbo: opcional(z.string()) }).parse(req.body);
    const novo = { id: uid(), nome: b.nome.toUpperCase(), cbo: b.cbo ?? null };
    await db.insert(cargos).values(novo);
    return novo;
  });

  // Empresas
  app.get("/api/empresas", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const ativos = db
      .select({ empresaId: funcionarios.empresaId, n: count().as("n") })
      .from(funcionarios)
      .where(or(isNull(funcionarios.demissao), gte(funcionarios.demissao, hoje)))
      .groupBy(funcionarios.empresaId)
      .as("ativos");
    const linhas = await db
      .select({ empresa: empresas, funcionariosAtivos: ativos.n, sindicato: sindicatos.nome, responsavel: usuarios.nome })
      .from(empresas)
      .leftJoin(ativos, eq(ativos.empresaId, empresas.id))
      .leftJoin(sindicatos, eq(sindicatos.id, empresas.sindicatoId))
      .leftJoin(usuarios, eq(usuarios.id, empresas.responsavelId))
      .orderBy(asc(empresas.razaoSocial));
    return linhas.map((l) => ({
      ...l.empresa,
      funcionariosAtivos: Number(l.funcionariosAtivos ?? 0),
      sindicato: l.sindicato,
      responsavel: l.responsavel,
    }));
  });
  app.get<{ Params: { id: string } }>("/api/empresas/:id", async (req) => {
    const [e] = await db.select().from(empresas).where(eq(empresas.id, req.params.id));
    if (!e) throw new ErroNegocio("Empresa não encontrada", 404);
    return e;
  });
  app.post("/api/empresas", async (req) => {
    const b = EmpresaBody.parse(req.body);
    const [existe] = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.cnpj, b.cnpj));
    if (existe) throw new ErroNegocio("Já existe empresa com este CNPJ", 409);
    const nova = { id: uid(), ...b };
    await db.insert(empresas).values(nova);
    await registrarAuditoria(db, req.usuario, "criar", "empresa", nova.id, b);
    return nova;
  });
  app.put<{ Params: { id: string } }>("/api/empresas/:id", async (req) => {
    const b = EmpresaBody.parse(req.body);
    const [outra] = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.cnpj, b.cnpj));
    if (outra && outra.id !== req.params.id) throw new ErroNegocio("Já existe empresa com este CNPJ", 409);
    await db
      .update(empresas)
      .set({ ...b, atualizadoEm: new Date() })
      .where(eq(empresas.id, req.params.id));
    await registrarAuditoria(db, req.usuario, "alterar", "empresa", req.params.id, b);
    return { ok: true };
  });

  // Funcionários
  app.get<{ Querystring: { empresaId?: string } }>("/api/funcionarios", async (req) => {
    const filtro = req.query.empresaId ? eq(funcionarios.empresaId, req.query.empresaId) : undefined;
    const linhas = await db
      .select({ f: funcionarios, cargo: cargos.nome, cbo: cargos.cbo, empresa: empresas.razaoSocial })
      .from(funcionarios)
      .leftJoin(cargos, eq(cargos.id, funcionarios.cargoId))
      .innerJoin(empresas, eq(empresas.id, funcionarios.empresaId))
      .where(filtro)
      .orderBy(asc(empresas.razaoSocial), asc(funcionarios.nome));
    return linhas.map((l) => ({ ...l.f, cargo: l.cargo, cbo: l.cbo, empresa: l.empresa }));
  });
  app.get<{ Params: { id: string } }>("/api/funcionarios/:id", async (req) => {
    const [f] = await db.select().from(funcionarios).where(eq(funcionarios.id, req.params.id));
    if (!f) throw new ErroNegocio("Funcionário não encontrado", 404);
    return f;
  });
  app.post("/api/funcionarios", async (req) => {
    const b = FuncionarioBody.parse(req.body);
    const [dup] = await db
      .select({ id: funcionarios.id })
      .from(funcionarios)
      .where(and(eq(funcionarios.empresaId, b.empresaId), eq(funcionarios.cpf, b.cpf), isNull(funcionarios.demissao)));
    if (dup) throw new ErroNegocio("Já existe funcionário ativo com este CPF nesta empresa", 409);
    let matricula = b.matricula;
    if (!matricula) {
      const [m] = await db
        .select({ m: max(funcionarios.matricula) })
        .from(funcionarios)
        .where(eq(funcionarios.empresaId, b.empresaId));
      matricula = (m?.m ?? 0) + 1;
    }
    const novo = { id: uid(), ...b, matricula };
    await db.insert(funcionarios).values(novo);
    await registrarAuditoria(db, req.usuario, "admitir", "funcionario", novo.id, { nome: b.nome, empresaId: b.empresaId });
    return novo;
  });
  app.put<{ Params: { id: string } }>("/api/funcionarios/:id", async (req) => {
    const b = FuncionarioBody.parse(req.body);
    await db
      .update(funcionarios)
      .set({ ...b, atualizadoEm: new Date() })
      .where(eq(funcionarios.id, req.params.id));
    await registrarAuditoria(db, req.usuario, "alterar", "funcionario", req.params.id, b);
    return { ok: true };
  });

  // Rubricas
  app.get("/api/rubricas", () => db.select().from(rubricas).orderBy(asc(rubricas.codigo)));
  app.post("/api/rubricas", async (req) => {
    const b = RubricaBody.parse(req.body);
    const [existe] = await db.select().from(rubricas).where(eq(rubricas.codigo, b.codigo));
    if (existe) throw new ErroNegocio(`Já existe a rubrica ${b.codigo}`, 409);
    await db.insert(rubricas).values(b);
    await registrarAuditoria(db, req.usuario, "criar", "rubrica", b.codigo, b);
    return b;
  });
  app.put<{ Params: { codigo: string } }>("/api/rubricas/:codigo", async (req) => {
    const [atual] = await db.select().from(rubricas).where(eq(rubricas.codigo, req.params.codigo));
    if (!atual) throw new ErroNegocio("Rubrica não encontrada", 404);
    if (atual.modo === "sistema") {
      // Rubricas do sistema: só descrição e situação podem mudar.
      const b = z.object({ descricao: z.string().trim().min(2), ativa: z.boolean() }).parse(req.body);
      await db.update(rubricas).set(b).where(eq(rubricas.codigo, req.params.codigo));
    } else {
      const { codigo: _c, ...b } = RubricaBody.parse({ ...(req.body as object), codigo: req.params.codigo });
      await db.update(rubricas).set(b).where(eq(rubricas.codigo, req.params.codigo));
    }
    await registrarAuditoria(db, req.usuario, "alterar", "rubrica", req.params.codigo, req.body);
    return { ok: true };
  });

  app.get("/api/tabelas", () => carregarTabelas(db));

  app.get<{ Querystring: { limite?: string } }>("/api/auditoria", (req) =>
    db
      .select()
      .from(auditoria)
      .orderBy(desc(auditoria.id))
      .limit(Math.min(Number(req.query.limite) || 100, 500)),
  );

  app.get("/api/saude", async () => {
    const r = await db.execute(sql`select 1 as ok`);
    return { ok: true, banco: !!r };
  });
}
