import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { api, type Funcionario, type LinhaPainel } from "../api";
import { Dialogo } from "../components/ui";
import { useEstado } from "../estado";
import { compLonga } from "../fmt";

/** Ícones de traço simples; herdam a cor do botão. */
const Icone = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true">
    {children}
  </svg>
);
const ICONES = {
  admissao: (
    <Icone>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h2a5.5 5.5 0 0 1 5.5 5.5V20" />
      <path d="M19 8v6M16 11h6" />
    </Icone>
  ),
  rescisao: (
    <Icone>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h2a5.5 5.5 0 0 1 5.5 5.5V20" />
      <path d="M16 11h6" />
    </Icone>
  ),
  ferias: (
    <Icone>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </Icone>
  ),
  folha: (
    <Icone>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 15.5h7M9 19h4" />
    </Icone>
  ),
  afastamentos: (
    <Icone>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <path d="M12 8v8M8 12h8" />
    </Icone>
  ),
  outros: (
    <Icone>
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </Icone>
  ),
};

const OUTROS = [
  { to: "/empresas", titulo: "Empresas", texto: "Cadastro, regime, RAT/FAP, sindicato e responsável." },
  { to: "/funcionarios", titulo: "Funcionários", texto: "Lista, fichas e dados bancários de todos." },
  { to: "/rubricas", titulo: "Rubricas", texto: "Os eventos da folha e suas incidências." },
  { to: "/importacao", titulo: "Importar do Domínio", texto: "Empregados e empresas a partir de planilha." },
  { to: "/tabelas", titulo: "Tabelas legais", texto: "INSS, IRRF, salário-família e a trilha de auditoria." },
] as const;

function primeiroNome(nome?: string) {
  return nome?.split(" ")[0] ?? "";
}

export function Inicio() {
  const { competencia, usuario } = useEstado();
  const [outros, setOutros] = useState(false);
  const painel = useQuery({
    queryKey: ["painel", competencia],
    queryFn: () => api.get<LinhaPainel[]>(`/api/painel?competencia=${competencia}`),
  });
  const funcionarios = useQuery({ queryKey: ["funcionarios", ""], queryFn: () => api.get<Funcionario[]>("/api/funcionarios") });

  const empresas = painel.data ?? [];
  const calculadas = empresas.filter((e) => e.mensal).length;
  const fechadas = empresas.filter((e) => e.fechada).length;
  const admitidos = (funcionarios.data ?? []).filter((f) => f.admissao.startsWith(competencia)).length;

  const folhaStatus = !painel.data
    ? "Carregando…"
    : !empresas.length
      ? "Nenhuma empresa ativa"
      : `${calculadas} de ${empresas.length} empresas calculadas${fechadas ? ` · ${fechadas} fechada${fechadas > 1 ? "s" : ""}` : ""}`;
  const admissaoStatus = !funcionarios.data
    ? "Carregando…"
    : admitidos
      ? `${admitidos} admitido${admitidos > 1 ? "s" : ""} em ${compLonga(competencia)}`
      : `Nenhuma admissão em ${compLonga(competencia)}`;

  return (
    <div className="inicio">
      <div className="inicio-topo">
        <h1>Olá, {primeiroNome(usuario?.nome)}</h1>
        <p>O que você vai fazer agora? Competência de {compLonga(competencia)}.</p>
      </div>
      <nav className="dock" aria-label="Rotinas da folha">
        <Link to="/admissao" className="dock-btn" style={{ "--c": "var(--verde)" } as React.CSSProperties}>
          {ICONES.admissao}
          <b>Admissão</b>
          <small>{admissaoStatus}</small>
        </Link>
        <Link to="/rescisao" className="dock-btn" style={{ "--c": "var(--brand-red)" } as React.CSSProperties}>
          {ICONES.rescisao}
          <b>Rescisão</b>
          <small>
            <span className="tag">Em breve</span>
          </small>
        </Link>
        <Link to="/ferias" className="dock-btn" style={{ "--c": "var(--blue-deep)" } as React.CSSProperties}>
          {ICONES.ferias}
          <b>Férias</b>
          <small>
            <span className="tag">Em breve</span>
          </small>
        </Link>
        <Link to="/painel" className="dock-btn" style={{ "--c": "var(--setor)" } as React.CSSProperties}>
          {ICONES.folha}
          <b>Folha</b>
          <small>{folhaStatus}</small>
        </Link>
        <Link to="/afastamentos" className="dock-btn" style={{ "--c": "var(--ink-2)" } as React.CSSProperties}>
          {ICONES.afastamentos}
          <b>Afastamentos</b>
          <small>
            <span className="tag">Em breve</span>
          </small>
        </Link>
        <button className="dock-btn outros" onClick={() => setOutros(true)} aria-haspopup="dialog">
          {ICONES.outros}
          <b>Outros</b>
          <small>Empresas, funcionários, rubricas, importação e tabelas</small>
        </button>
      </nav>

      <Dialogo aberto={outros} titulo="Outros" onFechar={() => setOutros(false)} largura={640}>
        <div className="outros-lista">
          {OUTROS.map((o) => (
            <Link key={o.to} to={o.to} className="outros-item">
              <b>{o.titulo}</b>
              <span>{o.texto}</span>
            </Link>
          ))}
        </div>
      </Dialogo>
    </div>
  );
}
