/**
 * Regras da importação de cadastros exportados do Domínio (Excel/CSV), sem banco:
 * reconhecimento de colunas pelo cabeçalho (com apelidos dos relatórios do Domínio),
 * leitura de datas e valores no formato brasileiro e a prévia novo / alterado / revisar.
 * O layout definitivo será ajustado com arquivos reais exportados pelo escritório.
 */
import { cnpjValido, cpfValido, normalizarCnpj, soDigitos } from "../validacao.js";

export type TipoImportacao = "funcionarios" | "empresas";
export type Linha = Record<string, unknown>;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const APELIDOS: Record<TipoImportacao, Record<string, string[]>> = {
  funcionarios: {
    codigoDominio: ["codigo", "cod", "codigoempregado", "codempregado", "matricula", "codigodoempregado"],
    nome: ["nome", "nomedoempregado", "empregado", "nomeempregado", "funcionario"],
    cpf: ["cpf", "cpfdoempregado"],
    pis: ["pis", "pispasep", "nis", "pisnis", "nit"],
    dataNascimento: ["nascimento", "datanascimento", "datadenascimento", "dtnascimento", "datanasc"],
    sexo: ["sexo"],
    admissao: ["admissao", "dataadmissao", "datadeadmissao", "dtadmissao"],
    demissao: ["demissao", "datademissao", "rescisao", "dataderescisao"],
    cargo: ["cargo", "funcao", "descricaocargo"],
    cbo: ["cbo"],
    departamento: ["departamento", "setor", "lotacao"],
    salario: ["salario", "salariobase", "salarioatual", "valorsalario"],
    tipoSalario: ["tiposalario", "tipodesalario"],
    horasMensais: ["horasmensais", "horasmes", "horas"],
    dependentesIrrf: ["dependentesir", "dependentesirrf", "depir", "dependentes"],
    filhosSalarioFamilia: ["dependentessf", "salariofamilia", "depsf", "filhossf"],
    email: ["email", "e-mail"],
    telefone: ["telefone", "celular", "fone"],
  },
  empresas: {
    codigoDominio: ["codigo", "cod", "codigoempresa", "codempresa"],
    razaoSocial: ["razaosocial", "nome", "empresa", "nomeempresa"],
    nomeFantasia: ["fantasia", "nomefantasia"],
    cnpj: ["cnpj", "cnpjcpf", "inscricao"],
    regime: ["regime", "tributacao", "regimetributario", "regimedetributacao"],
    cnae: ["cnae", "cnaeprincipal"],
    fpas: ["fpas"],
    rat: ["rat", "sat", "ratsat"],
    fap: ["fap"],
  },
};

function mapearColunas(tipo: TipoImportacao, cabecalhos: string[]) {
  const reconhecidas: Record<string, string> = {};
  const ignoradas: string[] = [];
  const usados = new Set<string>();
  for (const c of cabecalhos) {
    const n = norm(c);
    const campo = Object.entries(APELIDOS[tipo]).find(([campo, aps]) => !usados.has(campo) && (aps.includes(n) || norm(campo) === n))?.[0];
    if (campo) {
      reconhecidas[c] = campo;
      usados.add(campo);
    } else ignoradas.push(c);
  }
  return { reconhecidas, ignoradas };
}

/** Aceita 31/12/2024, 2024-12-31 e número serial do Excel. */
export function lerData(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 59 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${ano}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Aceita 1.234,56 · 1234.56 · R$ 1.234,56 · número. */
export function lerValor(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v.toFixed(2);
  let s = String(v).replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function lerRegime(v: unknown): "simples" | "presumido" | "real" | null {
  const n = norm(String(v ?? ""));
  if (!n) return null;
  if (n.includes("simples")) return "simples";
  if (n.includes("presumido")) return "presumido";
  if (n.includes("real")) return "real";
  return null;
}

const texto = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s || null;
};

type Mudanca = { campo: string; de: unknown; para: unknown };
export interface Previa {
  tipo: TipoImportacao;
  colunas: { reconhecidas: Record<string, string>; ignoradas: string[] };
  novos: { linha: number; nome: string; dados: Record<string, unknown> }[];
  alterados: { linha: number; id: string; nome: string; mudancas: Mudanca[]; dados: Record<string, unknown> }[];
  iguais: number;
  revisar: { linha: number; nome: string; motivo: string }[];
}

function lerLinhaFuncionario(campos: Record<string, unknown>) {
  const d: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== "") d[k] = v;
  };
  set("codigoDominio", texto(campos.codigoDominio));
  set("nome", texto(campos.nome)?.toUpperCase());
  set("cpf", soDigitos(campos.cpf) ? soDigitos(campos.cpf).padStart(11, "0") : null);
  set("pis", soDigitos(campos.pis) || null);
  set("dataNascimento", lerData(campos.dataNascimento));
  const sexo = norm(String(campos.sexo ?? ""));
  set("sexo", sexo.startsWith("f") ? "F" : sexo.startsWith("m") ? "M" : null);
  set("admissao", lerData(campos.admissao));
  set("demissao", lerData(campos.demissao));
  set("cargo", texto(campos.cargo));
  set("cbo", soDigitos(campos.cbo) || null);
  set("departamento", texto(campos.departamento));
  set("salario", lerValor(campos.salario));
  const ts = norm(String(campos.tipoSalario ?? ""));
  set("tipoSalario", ts.startsWith("hor") ? "horista" : ts.startsWith("men") ? "mensal" : null);
  if (campos.horasMensais != null && campos.horasMensais !== "") set("horasMensais", Number(campos.horasMensais) || null);
  if (campos.dependentesIrrf != null && campos.dependentesIrrf !== "") set("dependentesIrrf", Number(campos.dependentesIrrf) || 0);
  if (campos.filhosSalarioFamilia != null && campos.filhosSalarioFamilia !== "")
    set("filhosSalarioFamilia", Number(campos.filhosSalarioFamilia) || 0);
  set("email", texto(campos.email));
  set("telefone", texto(campos.telefone));
  return d;
}

function lerLinhaEmpresa(campos: Record<string, unknown>) {
  const d: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== "") d[k] = v;
  };
  set("codigoDominio", texto(campos.codigoDominio));
  set("razaoSocial", texto(campos.razaoSocial)?.toUpperCase());
  set("nomeFantasia", texto(campos.nomeFantasia));
  set("cnpj", normalizarCnpj(String(campos.cnpj ?? "")) || null);
  set("regime", lerRegime(campos.regime));
  set("cnae", soDigitos(campos.cnae) || null);
  set("fpas", soDigitos(campos.fpas) || null);
  const pct = (v: unknown) => {
    const x = lerValor(v);
    if (x == null) return null;
    const n = Number(x);
    return (n > 1 ? n / 100 : n).toFixed(6);
  };
  set("rat", pct(campos.rat));
  if (campos.fap != null && campos.fap !== "") set("fap", Number(lerValor(campos.fap)).toFixed(4));
  return d;
}

const comparavel = (v: unknown) => (v == null ? "" : String(v).replace(/\.0+$/, ""));

function diferencas(atual: Record<string, unknown>, novo: Record<string, unknown>, ignorar: string[] = []): Mudanca[] {
  return Object.entries(novo)
    .filter(([k]) => !ignorar.includes(k) && k in atual)
    .filter(([k, v]) => {
      const a = atual[k];
      if (typeof a === "string" && /^\d+\.\d+$/.test(a) && typeof v === "string") return Number(a) !== Number(v);
      return comparavel(a) !== comparavel(v);
    })
    .map(([campo, para]) => ({ campo, de: atual[campo] ?? null, para }));
}

/** Cadastros já existentes que a prévia compara com o arquivo. */
export interface Existentes {
  empresas: { id: string; cnpj: string; razaoSocial: string }[];
  /** Funcionários da empresa de destino. */
  funcionarios: { id: string; cpf: string; nome: string }[];
}

/** Prévia pura: separa o arquivo em novos, alterados, iguais e linhas para revisar. */
export function planejarImportacao(tipo: TipoImportacao, linhas: Linha[], existentes: Existentes): Previa {
  const cabecalhos = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const colunas = mapearColunas(tipo, cabecalhos);
  const previa: Previa = { tipo, colunas, novos: [], alterados: [], iguais: 0, revisar: [] };
  const camposDe = (l: Linha) =>
    Object.fromEntries(Object.entries(l).flatMap(([k, v]) => (colunas.reconhecidas[k] ? [[colunas.reconhecidas[k], v]] : [])));

  if (tipo === "empresas") {
    const porCnpj = new Map(existentes.empresas.map((e) => [normalizarCnpj(e.cnpj), e]));
    const vistos = new Set<string>();
    linhas.forEach((l, i) => {
      const linha = i + 2;
      const d = lerLinhaEmpresa(camposDe(l));
      const nome = String(d.razaoSocial ?? d.cnpj ?? `linha ${linha}`);
      const cnpj = d.cnpj as string | undefined;
      if (!cnpj) return previa.revisar.push({ linha, nome, motivo: "Sem CNPJ" });
      if (!cnpjValido(cnpj)) return previa.revisar.push({ linha, nome, motivo: `CNPJ inválido: ${cnpj}` });
      if (vistos.has(cnpj)) return previa.revisar.push({ linha, nome, motivo: "CNPJ repetido no arquivo" });
      vistos.add(cnpj);
      const atual = porCnpj.get(cnpj);
      if (atual) {
        const mudancas = diferencas(atual as Record<string, unknown>, d, ["cnpj"]);
        if (mudancas.length) previa.alterados.push({ linha, id: atual.id, nome: atual.razaoSocial, mudancas, dados: d });
        else previa.iguais++;
        return;
      }
      if (!d.razaoSocial) return previa.revisar.push({ linha, nome, motivo: "Sem razão social" });
      if (!d.regime) return previa.revisar.push({ linha, nome, motivo: "Regime tributário não reconhecido" });
      previa.novos.push({ linha, nome, dados: d });
    });
    return previa;
  }

  const porCpf = new Map(existentes.funcionarios.map((f) => [f.cpf, f]));
  const vistos = new Set<string>();
  linhas.forEach((l, i) => {
    const linha = i + 2;
    const d = lerLinhaFuncionario(camposDe(l));
    const nome = String(d.nome ?? `linha ${linha}`);
    const cpf = d.cpf as string | undefined;
    if (!cpf) return previa.revisar.push({ linha, nome, motivo: "Sem CPF" });
    if (!cpfValido(cpf)) return previa.revisar.push({ linha, nome, motivo: `CPF inválido: ${cpf}` });
    if (vistos.has(cpf)) return previa.revisar.push({ linha, nome, motivo: "CPF repetido no arquivo" });
    vistos.add(cpf);
    const atual = porCpf.get(cpf);
    if (atual) {
      const mudancas = diferencas(atual as Record<string, unknown>, d, ["cpf", "cargo", "cbo"]);
      if (mudancas.length) previa.alterados.push({ linha, id: atual.id, nome: atual.nome, mudancas, dados: d });
      else previa.iguais++;
      return;
    }
    const faltando = ["nome", "admissao", "salario"].filter((k) => !d[k]);
    if (faltando.length) return previa.revisar.push({ linha, nome, motivo: `Falta: ${faltando.join(", ")}` });
    previa.novos.push({ linha, nome, dados: d });
  });
  return previa;
}

export const CAMPOS_FUNC = new Set([
  "codigoDominio", "nome", "pis", "dataNascimento", "sexo", "admissao", "demissao", "departamento", "salario",
  "tipoSalario", "horasMensais", "dependentesIrrf", "filhosSalarioFamilia", "email", "telefone",
]);
export const CAMPOS_EMP = new Set(["codigoDominio", "razaoSocial", "nomeFantasia", "regime", "cnae", "fpas", "rat", "fap"]);
export const filtrar = (d: Record<string, unknown>, permitidos: Set<string>) =>
  Object.fromEntries(Object.entries(d).filter(([k]) => permitidos.has(k)));

