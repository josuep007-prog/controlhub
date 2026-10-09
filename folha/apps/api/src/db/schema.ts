import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const dinheiro = (nome: string) => numeric(nome, { precision: 14, scale: 2 });
const aliquota = (nome: string) => numeric(nome, { precision: 8, scale: 6 });
const criado = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
const atualizado = () => timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow();

export const usuarios = pgTable("usuarios", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email"),
  perfil: text("perfil", { enum: ["coordenacao", "analista"] }).notNull().default("analista"),
  ativo: boolean("ativo").notNull().default(true),
});

export const sindicatos = pgTable("sindicatos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  codigoDominio: text("codigo_dominio"),
  /** Mês da data-base (1–12). */
  mesDataBase: integer("mes_data_base"),
  observacoes: text("observacoes"),
});

export const empresas = pgTable(
  "empresas",
  {
    id: text("id").primaryKey(),
    codigoDominio: text("codigo_dominio"),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    cnpj: text("cnpj").notNull(),
    regime: text("regime", { enum: ["simples", "presumido", "real"] }).notNull(),
    simplesAnexoIV: boolean("simples_anexo_iv").notNull().default(false),
    cnae: text("cnae"),
    fpas: text("fpas"),
    codigoTerceiros: text("codigo_terceiros"),
    rat: aliquota("rat").notNull().default("0.02"),
    fap: numeric("fap", { precision: 6, scale: 4 }).notNull().default("1.0000"),
    terceiros: aliquota("terceiros").notNull().default("0.058"),
    sindicatoId: text("sindicato_id").references(() => sindicatos.id),
    responsavelId: text("responsavel_id").references(() => usuarios.id),
    diaPagamento: integer("dia_pagamento").notNull().default(5),
    temAdiantamento: boolean("tem_adiantamento").notNull().default(true),
    ativa: boolean("ativa").notNull().default(true),
    observacoes: text("observacoes"),
    criadoEm: criado(),
    atualizadoEm: atualizado(),
  },
  (t) => [uniqueIndex("empresas_cnpj_uq").on(t.cnpj)],
);

export const cargos = pgTable("cargos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  cbo: text("cbo"),
});

export const funcionarios = pgTable(
  "funcionarios",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id),
    matricula: integer("matricula").notNull(),
    codigoDominio: text("codigo_dominio"),
    nome: text("nome").notNull(),
    cpf: text("cpf").notNull(),
    pis: text("pis"),
    dataNascimento: date("data_nascimento"),
    sexo: text("sexo", { enum: ["F", "M"] }),
    email: text("email"),
    telefone: text("telefone"),
    endereco: text("endereco"),
    cargoId: text("cargo_id").references(() => cargos.id),
    departamento: text("departamento"),
    admissao: date("admissao").notNull(),
    demissao: date("demissao"),
    tipoContrato: text("tipo_contrato", { enum: ["indeterminado", "experiencia", "determinado"] })
      .notNull()
      .default("indeterminado"),
    categoria: text("categoria", { enum: ["empregado", "aprendiz"] }).notNull().default("empregado"),
    salario: dinheiro("salario").notNull(),
    tipoSalario: text("tipo_salario", { enum: ["mensal", "horista"] }).notNull().default("mensal"),
    horasMensais: integer("horas_mensais").notNull().default(220),
    jornada: text("jornada"),
    dependentesIrrf: integer("dependentes_irrf").notNull().default(0),
    filhosSalarioFamilia: integer("filhos_salario_familia").notNull().default(0),
    optaVt: boolean("opta_vt").notNull().default(false),
    vtValorMensal: dinheiro("vt_valor_mensal").notNull().default("0"),
    percentualAdiantamento: numeric("percentual_adiantamento", { precision: 5, scale: 4 }).notNull().default("0.40"),
    banco: text("banco"),
    agencia: text("agencia"),
    conta: text("conta"),
    pix: text("pix"),
    criadoEm: criado(),
    atualizadoEm: atualizado(),
  },
  (t) => [
    uniqueIndex("funcionarios_empresa_cpf_uq").on(t.empresaId, t.cpf),
    uniqueIndex("funcionarios_empresa_matricula_uq").on(t.empresaId, t.matricula),
  ],
);

export const rubricas = pgTable("rubricas", {
  codigo: text("codigo").primaryKey(),
  descricao: text("descricao").notNull(),
  tipo: text("tipo", { enum: ["provento", "desconto", "informativa"] }).notNull(),
  modo: text("modo", { enum: ["sistema", "horas", "dias", "valor", "percentual"] }).notNull(),
  fator: numeric("fator", { precision: 8, scale: 4 }),
  incideInss: boolean("incide_inss").notNull().default(false),
  incideFgts: boolean("incide_fgts").notNull().default(false),
  incideIrrf: boolean("incide_irrf").notNull().default(false),
  incideDsr: boolean("incide_dsr").notNull().default(false),
  ativa: boolean("ativa").notNull().default(true),
});

export const competencias = pgTable(
  "competencias",
  {
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id),
    competencia: text("competencia").notNull(),
    fechada: boolean("fechada").notNull().default(false),
    fechadaEm: timestamp("fechada_em", { withTimezone: true }),
    fechadaPor: text("fechada_por"),
  },
  (t) => [primaryKey({ columns: [t.empresaId, t.competencia] })],
);

export const lancamentos = pgTable(
  "lancamentos",
  {
    id: serial("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id),
    competencia: text("competencia").notNull(),
    funcionarioId: text("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    rubricaCodigo: text("rubrica_codigo")
      .notNull()
      .references(() => rubricas.codigo),
    quantidade: numeric("quantidade", { precision: 10, scale: 2 }),
    valor: dinheiro("valor"),
  },
  (t) => [
    uniqueIndex("lancamentos_uq").on(t.funcionarioId, t.competencia, t.rubricaCodigo),
    index("lancamentos_empresa_comp_idx").on(t.empresaId, t.competencia),
  ],
);

export const calculos = pgTable(
  "calculos",
  {
    id: serial("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id),
    funcionarioId: text("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    competencia: text("competencia").notNull(),
    tipo: text("tipo", { enum: ["mensal", "adiantamento"] }).notNull(),
    totalProventos: dinheiro("total_proventos").notNull(),
    totalDescontos: dinheiro("total_descontos").notNull(),
    liquido: dinheiro("liquido").notNull(),
    baseInss: dinheiro("base_inss").notNull(),
    baseFgts: dinheiro("base_fgts").notNull(),
    baseIrrf: dinheiro("base_irrf").notNull(),
    inss: dinheiro("inss").notNull(),
    irrf: dinheiro("irrf").notNull(),
    fgts: dinheiro("fgts").notNull(),
    cpp: dinheiro("cpp").notNull(),
    rat: dinheiro("rat").notNull(),
    terceiros: dinheiro("terceiros").notNull(),
    diasTrabalhados: integer("dias_trabalhados").notNull(),
    avisos: jsonb("avisos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    detalhe: jsonb("detalhe"),
    calculadoEm: timestamp("calculado_em", { withTimezone: true }).notNull().defaultNow(),
    calculadoPor: text("calculado_por"),
  },
  (t) => [
    uniqueIndex("calculos_uq").on(t.funcionarioId, t.competencia, t.tipo),
    index("calculos_empresa_comp_idx").on(t.empresaId, t.competencia, t.tipo),
  ],
);

export const calculoItens = pgTable("calculo_itens", {
  id: serial("id").primaryKey(),
  calculoId: integer("calculo_id")
    .notNull()
    .references(() => calculos.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull(),
  codigo: text("codigo").notNull(),
  descricao: text("descricao").notNull(),
  tipo: text("tipo", { enum: ["provento", "desconto", "informativa"] }).notNull(),
  referencia: text("referencia").notNull().default(""),
  valor: dinheiro("valor").notNull(),
});

export const tabelasLegais = pgTable("tabelas_legais", {
  vigencia: text("vigencia").primaryKey(),
  fonte: text("fonte").notNull(),
  dados: jsonb("dados").notNull(),
});

export const auditoria = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  quando: timestamp("quando", { withTimezone: true }).notNull().defaultNow(),
  usuario: text("usuario").notNull(),
  acao: text("acao").notNull(),
  entidade: text("entidade").notNull(),
  entidadeId: text("entidade_id"),
  detalhe: jsonb("detalhe"),
});
