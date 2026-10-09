/** Cliente da API. Todas as chamadas levam o usuário escolhido no cabeçalho x-usuario. */

/** Versão de demonstração (artefato): sem servidor, a "API" roda no próprio navegador. */
export const DEMO = import.meta.env.VITE_DEMO === "1";

let usuarioAtual = "";
export const definirUsuario = (id: string) => {
  usuarioAtual = id;
};

export class ErroApi extends Error {}

async function chamar<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  // Condição literal para o build normal descartar o código da demonstração.
  if (import.meta.env.VITE_DEMO === "1") {
    const { chamarDemo } = await import("./demo/servidor");
    try {
      return (await chamarDemo(metodo, url, corpo, usuarioAtual)) as T;
    } catch (e) {
      throw new ErroApi((e as Error).message);
    }
  }
  const r = await fetch(url, {
    method: metodo,
    headers: { "x-usuario": usuarioAtual, ...(corpo !== undefined ? { "content-type": "application/json" } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi((json as { erro?: string }).erro ?? `Erro ${r.status}`);
  return json as T;
}

export const api = {
  get: <T>(url: string) => chamar<T>("GET", url),
  post: <T>(url: string, corpo: unknown) => chamar<T>("POST", url, corpo),
  put: <T>(url: string, corpo: unknown) => chamar<T>("PUT", url, corpo),
};

export type Regime = "simples" | "presumido" | "real";

export interface Usuario {
  id: string;
  nome: string;
  perfil: "coordenacao" | "analista";
}

export interface Sindicato {
  id: string;
  nome: string;
  codigoDominio: string | null;
  mesDataBase: number | null;
}

export interface Cargo {
  id: string;
  nome: string;
  cbo: string | null;
}

export interface Empresa {
  id: string;
  codigoDominio: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regime: Regime;
  simplesAnexoIV: boolean;
  cnae: string | null;
  fpas: string | null;
  codigoTerceiros: string | null;
  rat: string;
  fap: string;
  terceiros: string;
  sindicatoId: string | null;
  responsavelId: string | null;
  diaPagamento: number;
  temAdiantamento: boolean;
  ativa: boolean;
  observacoes: string | null;
  funcionariosAtivos?: number;
  sindicato?: string | null;
  responsavel?: string | null;
}

export interface Funcionario {
  id: string;
  empresaId: string;
  matricula: number;
  codigoDominio: string | null;
  nome: string;
  cpf: string;
  pis: string | null;
  dataNascimento: string | null;
  sexo: "F" | "M" | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cargoId: string | null;
  departamento: string | null;
  admissao: string;
  demissao: string | null;
  tipoContrato: "indeterminado" | "experiencia" | "determinado";
  categoria: "empregado" | "aprendiz";
  salario: string;
  tipoSalario: "mensal" | "horista";
  horasMensais: number;
  jornada: string | null;
  dependentesIrrf: number;
  filhosSalarioFamilia: number;
  optaVt: boolean;
  vtValorMensal: string;
  percentualAdiantamento: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  cargo?: string | null;
  cbo?: string | null;
  empresa?: string;
}

export interface Rubrica {
  codigo: string;
  descricao: string;
  tipo: "provento" | "desconto" | "informativa";
  modo: "sistema" | "horas" | "dias" | "valor" | "percentual";
  fator: string | null;
  incideInss: boolean;
  incideFgts: boolean;
  incideIrrf: boolean;
  incideDsr: boolean;
  ativa: boolean;
}

export interface LinhaPainel {
  empresaId: string;
  razaoSocial: string;
  cnpj: string;
  regime: Regime;
  temAdiantamento: boolean;
  funcionarios: number;
  lancamentos: number;
  adiantamento: { calculados: number; liquido: string; calculadoEm: string } | null;
  mensal: {
    calculados: number;
    liquido: string;
    fgts: string;
    inss: string;
    irrf: string;
    avisos: number;
    calculadoEm: string;
  } | null;
  fechada: boolean;
  fechadaPor: string | null;
}

export interface Item {
  codigo: string;
  descricao: string;
  tipo: "provento" | "desconto" | "informativa";
  referencia: string;
  valor: string;
}

export interface Calculo {
  id: number;
  funcionarioId: string;
  competencia: string;
  tipo: "mensal" | "adiantamento";
  totalProventos: string;
  totalDescontos: string;
  liquido: string;
  baseInss: string;
  baseFgts: string;
  baseIrrf: string;
  inss: string;
  irrf: string;
  fgts: string;
  cpp: string;
  rat: string;
  terceiros: string;
  diasTrabalhados: number;
  avisos: string[];
  calculadoEm: string;
  calculadoPor: string | null;
  funcionario: {
    id: string;
    nome: string;
    matricula: number;
    cpf: string;
    pis: string | null;
    admissao: string;
    salario: string;
    cargo: string | null;
    cbo: string | null;
    departamento: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    pix: string | null;
  };
  itens: Item[];
}

export interface Relatorio {
  empresa: Empresa & { sindicato: string | null };
  competencia: string;
  tipo: "mensal" | "adiantamento";
  calculos: Calculo[];
  resumoRubricas: { codigo: string; descricao: string; tipo: string; quantidade: number; valor: string }[];
  totais: Record<
    "proventos" | "descontos" | "liquido" | "baseInss" | "baseFgts" | "baseIrrf" | "inss" | "irrf" | "fgts" | "cpp" | "rat" | "terceiros",
    string
  > & { funcionarios: number };
}

export interface TabelasLegais {
  vigencia: string;
  fonte: string;
  salarioMinimo: string;
  inss: { faixas: { ate: string; aliquota: string }[] };
  irrf: {
    faixas: { ate: string | null; aliquota: string; deducao: string }[];
    deducaoDependente: string;
    descontoSimplificado: string;
    reducao: { limiteIsencao: string; reducaoMaxima: string; limiteSuperior: string; constante: string; coeficiente: string } | null;
  };
  salarioFamilia: { limiteRemuneracao: string; cota: string };
  fgts: { aliquota: string; aliquotaAprendiz: string };
  valeTransporte: { percentualDesconto: string };
}

export interface Previa {
  tipo: "funcionarios" | "empresas";
  colunas: { reconhecidas: Record<string, string>; ignoradas: string[] };
  novos: { linha: number; nome: string; dados: Record<string, unknown> }[];
  alterados: { linha: number; id: string; nome: string; mudancas: { campo: string; de: unknown; para: unknown }[] }[];
  iguais: number;
  revisar: { linha: number; nome: string; motivo: string }[];
}

export interface Auditoria {
  id: number;
  quando: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhe: unknown;
}

export type { Nota, Rascunho } from "./regras";
