CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario" text NOT NULL,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"detalhe" jsonb
);
--> statement-breakpoint
CREATE TABLE "calculo_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"calculo_id" integer NOT NULL,
	"ordem" integer NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"tipo" text NOT NULL,
	"referencia" text DEFAULT '' NOT NULL,
	"valor" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" text NOT NULL,
	"funcionario_id" text NOT NULL,
	"competencia" text NOT NULL,
	"tipo" text NOT NULL,
	"total_proventos" numeric(14, 2) NOT NULL,
	"total_descontos" numeric(14, 2) NOT NULL,
	"liquido" numeric(14, 2) NOT NULL,
	"base_inss" numeric(14, 2) NOT NULL,
	"base_fgts" numeric(14, 2) NOT NULL,
	"base_irrf" numeric(14, 2) NOT NULL,
	"inss" numeric(14, 2) NOT NULL,
	"irrf" numeric(14, 2) NOT NULL,
	"fgts" numeric(14, 2) NOT NULL,
	"cpp" numeric(14, 2) NOT NULL,
	"rat" numeric(14, 2) NOT NULL,
	"terceiros" numeric(14, 2) NOT NULL,
	"dias_trabalhados" integer NOT NULL,
	"avisos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detalhe" jsonb,
	"calculado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"calculado_por" text
);
--> statement-breakpoint
CREATE TABLE "cargos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cbo" text
);
--> statement-breakpoint
CREATE TABLE "competencias" (
	"empresa_id" text NOT NULL,
	"competencia" text NOT NULL,
	"fechada" boolean DEFAULT false NOT NULL,
	"fechada_em" timestamp with time zone,
	"fechada_por" text,
	CONSTRAINT "competencias_empresa_id_competencia_pk" PRIMARY KEY("empresa_id","competencia")
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo_dominio" text,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"cnpj" text NOT NULL,
	"regime" text NOT NULL,
	"simples_anexo_iv" boolean DEFAULT false NOT NULL,
	"cnae" text,
	"fpas" text,
	"codigo_terceiros" text,
	"rat" numeric(8, 6) DEFAULT '0.02' NOT NULL,
	"fap" numeric(6, 4) DEFAULT '1.0000' NOT NULL,
	"terceiros" numeric(8, 6) DEFAULT '0.058' NOT NULL,
	"sindicato_id" text,
	"responsavel_id" text,
	"dia_pagamento" integer DEFAULT 5 NOT NULL,
	"tem_adiantamento" boolean DEFAULT true NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funcionarios" (
	"id" text PRIMARY KEY NOT NULL,
	"empresa_id" text NOT NULL,
	"matricula" integer NOT NULL,
	"codigo_dominio" text,
	"nome" text NOT NULL,
	"cpf" text NOT NULL,
	"pis" text,
	"data_nascimento" date,
	"sexo" text,
	"email" text,
	"telefone" text,
	"endereco" text,
	"cargo_id" text,
	"departamento" text,
	"admissao" date NOT NULL,
	"demissao" date,
	"tipo_contrato" text DEFAULT 'indeterminado' NOT NULL,
	"categoria" text DEFAULT 'empregado' NOT NULL,
	"salario" numeric(14, 2) NOT NULL,
	"tipo_salario" text DEFAULT 'mensal' NOT NULL,
	"horas_mensais" integer DEFAULT 220 NOT NULL,
	"jornada" text,
	"dependentes_irrf" integer DEFAULT 0 NOT NULL,
	"filhos_salario_familia" integer DEFAULT 0 NOT NULL,
	"opta_vt" boolean DEFAULT false NOT NULL,
	"vt_valor_mensal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"percentual_adiantamento" numeric(5, 4) DEFAULT '0.40' NOT NULL,
	"banco" text,
	"agencia" text,
	"conta" text,
	"pix" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" text NOT NULL,
	"competencia" text NOT NULL,
	"funcionario_id" text NOT NULL,
	"rubrica_codigo" text NOT NULL,
	"quantidade" numeric(10, 2),
	"valor" numeric(14, 2)
);
--> statement-breakpoint
CREATE TABLE "rubricas" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"tipo" text NOT NULL,
	"modo" text NOT NULL,
	"fator" numeric(8, 4),
	"incide_inss" boolean DEFAULT false NOT NULL,
	"incide_fgts" boolean DEFAULT false NOT NULL,
	"incide_irrf" boolean DEFAULT false NOT NULL,
	"incide_dsr" boolean DEFAULT false NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sindicatos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"codigo_dominio" text,
	"mes_data_base" integer,
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "tabelas_legais" (
	"vigencia" text PRIMARY KEY NOT NULL,
	"fonte" text NOT NULL,
	"dados" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"perfil" text DEFAULT 'analista' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calculo_itens" ADD CONSTRAINT "calculo_itens_calculo_id_calculos_id_fk" FOREIGN KEY ("calculo_id") REFERENCES "public"."calculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculos" ADD CONSTRAINT "calculos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculos" ADD CONSTRAINT "calculos_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_sindicato_id_sindicatos_id_fk" FOREIGN KEY ("sindicato_id") REFERENCES "public"."sindicatos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_rubrica_codigo_rubricas_codigo_fk" FOREIGN KEY ("rubrica_codigo") REFERENCES "public"."rubricas"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calculos_uq" ON "calculos" USING btree ("funcionario_id","competencia","tipo");--> statement-breakpoint
CREATE INDEX "calculos_empresa_comp_idx" ON "calculos" USING btree ("empresa_id","competencia","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "empresas_cnpj_uq" ON "empresas" USING btree ("cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "funcionarios_empresa_cpf_uq" ON "funcionarios" USING btree ("empresa_id","cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "funcionarios_empresa_matricula_uq" ON "funcionarios" USING btree ("empresa_id","matricula");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_uq" ON "lancamentos" USING btree ("funcionario_id","competencia","rubrica_codigo");--> statement-breakpoint
CREATE INDEX "lancamentos_empresa_comp_idx" ON "lancamentos" USING btree ("empresa_id","competencia");