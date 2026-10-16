/** Validação dos cadastros (zod), compartilhada pela API e pela demonstração no navegador. */
import { z, type ZodError } from "zod";
import { cnpjValido, cpfValido, normalizarCnpj, numeroBR, soDigitos } from "./validacao.js";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
const valor = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = numeroBR(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: "custom", message: "Número inválido" });
    return z.NEVER;
  }
  return String(n);
});
export const opcional = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => (v === "" ? null : v));

export const EmpresaBody = z.object({
  codigoDominio: opcional(z.string()),
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  nomeFantasia: opcional(z.string()),
  cnpj: z.string().transform(normalizarCnpj).refine(cnpjValido, "CNPJ inválido"),
  regime: z.enum(["simples", "presumido", "real"]),
  simplesAnexoIV: z.boolean().default(false),
  cnae: opcional(z.string()),
  fpas: opcional(z.string()),
  codigoTerceiros: opcional(z.string()),
  rat: valor.default("0.02"),
  fap: valor.default("1"),
  terceiros: valor.default("0.058"),
  sindicatoId: opcional(z.string()),
  responsavelId: opcional(z.string()),
  diaPagamento: z.coerce.number().int().min(1).max(31).default(5),
  temAdiantamento: z.boolean().default(true),
  ativa: z.boolean().default(true),
  observacoes: opcional(z.string()),
});

export const FuncionarioBody = z.object({
  empresaId: z.string(),
  matricula: z.coerce.number().int().positive().optional(),
  codigoDominio: opcional(z.string()),
  nome: z.string().trim().min(3, "Informe o nome completo").transform((s) => s.toUpperCase()),
  cpf: z.string().transform(soDigitos).refine(cpfValido, "CPF inválido"),
  pis: opcional(z.string().transform(soDigitos)),
  dataNascimento: opcional(data),
  sexo: opcional(z.enum(["F", "M"])),
  email: opcional(z.string()),
  telefone: opcional(z.string()),
  endereco: opcional(z.string()),
  cargoId: opcional(z.string()),
  departamento: opcional(z.string()),
  admissao: data,
  demissao: opcional(data),
  tipoContrato: z.enum(["indeterminado", "experiencia", "determinado"]).default("indeterminado"),
  categoria: z.enum(["empregado", "aprendiz"]).default("empregado"),
  salario: valor.refine((v) => Number(v) > 0, "Salário deve ser maior que zero"),
  tipoSalario: z.enum(["mensal", "horista"]).default("mensal"),
  horasMensais: z.coerce.number().int().min(1).max(220).default(220),
  jornada: opcional(z.string()),
  dependentesIrrf: z.coerce.number().int().min(0).default(0),
  filhosSalarioFamilia: z.coerce.number().int().min(0).default(0),
  optaVt: z.boolean().default(false),
  vtValorMensal: valor.default("0"),
  percentualAdiantamento: valor.default("0.40"),
  banco: opcional(z.string()),
  agencia: opcional(z.string()),
  conta: opcional(z.string()),
  pix: opcional(z.string()),
});

export const RubricaBody = z.object({
  codigo: z.string().regex(/^\d{3}$/, "Código com 3 dígitos"),
  descricao: z.string().trim().min(2),
  tipo: z.enum(["provento", "desconto", "informativa"]),
  modo: z.enum(["horas", "dias", "valor", "percentual"]),
  fator: opcional(valor),
  incideInss: z.boolean(),
  incideFgts: z.boolean(),
  incideIrrf: z.boolean(),
  incideDsr: z.boolean(),
  ativa: z.boolean().default(true),
});

export const SindicatoBody = z.object({
  nome: z.string().trim().min(2),
  cnpj: opcional(z.string()),
  codigoDominio: opcional(z.string()),
  mesDataBase: z.coerce.number().int().min(1).max(12).nullish(),
  observacoes: opcional(z.string()),
});

/** Mensagem única e legível a partir dos erros de validação. */
export const mensagemValidacao = (erro: ZodError) =>
  erro.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
