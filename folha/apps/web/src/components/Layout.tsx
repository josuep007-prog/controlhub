import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DEMO } from "../api";
import { useEstado } from "../estado";
import { compLonga, compShift } from "../fmt";

/** Abas de cada seção. A tela inicial não mostra abas: os botões grandes fazem esse papel. */
const SECOES = {
  folha: {
    rotulo: "Folha",
    abas: [
      { to: "/painel", rotulo: "Painel" },
      { to: "/lancamentos", rotulo: "Lançamentos" },
      { to: "/calculo", rotulo: "Cálculo" },
      { to: "/relatorios", rotulo: "Relatórios" },
    ],
  },
  outros: {
    rotulo: "Outros",
    abas: [
      { to: "/empresas", rotulo: "Empresas" },
      { to: "/funcionarios", rotulo: "Funcionários" },
      { to: "/rubricas", rotulo: "Rubricas" },
      { to: "/importacao", rotulo: "Importar" },
      { to: "/tabelas", rotulo: "Tabelas" },
    ],
  },
} as const;

function secaoDe(caminho: string): keyof typeof SECOES | null {
  if (caminho === "/funcionarios/novo") return null; // admissão: tela de trabalho própria
  for (const [chave, sec] of Object.entries(SECOES)) {
    if (sec.abas.some((a) => caminho === a.to || caminho.startsWith(`${a.to}/`))) return chave as keyof typeof SECOES;
  }
  return null;
}

function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.getAttribute("data-theme") ?? "");
  useEffect(() => {
    if (tema) document.documentElement.setAttribute("data-theme", tema);
    else document.documentElement.removeAttribute("data-theme");
    try {
      if (tema) localStorage.setItem("controlhub-theme", tema);
    } catch {
      /* ok */
    }
  }, [tema]);
  const escuro = tema ? tema === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { escuro, alternar: () => setTema(escuro ? "light" : "dark") };
}

/** Faixa da versão de demonstração: avisa que os dados são fictícios e permite recomeçar. */
function FaixaDemo() {
  const qc = useQueryClient();
  const { avisar } = useEstado();
  const [confirmando, setConfirmando] = useState(false);
  const restaurar = async () => {
    const { restaurarExemplo } = await import("../demo/servidor");
    restaurarExemplo();
    setConfirmando(false);
    await qc.invalidateQueries();
    avisar("Dados de exemplo restaurados");
  };
  return (
    <div className="demo-faixa">
      <div className="wrap">
        <span>
          <b>Demonstração</b> com empresas e funcionários fictícios. O que você altera fica só neste navegador.
        </span>
        <span className="acoes">
          {confirmando ? (
            <>
              <span>Apagar suas alterações e voltar ao exemplo?</span>
              <button className="fbtn" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
              <button className="btn" onClick={restaurar}>
                Restaurar
              </button>
            </>
          ) : (
            <button className="fbtn" onClick={() => setConfirmando(true)}>
              Restaurar dados de exemplo
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export function Layout() {
  const { competencia, setCompetencia, usuarios, usuario, setUsuarioId } = useEstado();
  const { escuro, alternar } = useTema();
  const caminho = useRouterState({ select: (st) => st.location.pathname });
  const secao = secaoDe(caminho);
  return (
    <>
      <header className="masthead">
        <div className="wrap mh-in">
          <Link to="/" className="brand">
            <span className="wordmark">
              <span className="c">Control</span>
              <span className="t">Tax</span>
            </span>
            <span className="brand-tag">Folha de Pagamento</span>
          </Link>
          <nav className="navtabs" aria-label="Navegação">
            {caminho !== "/" && (
              <Link to="/" className="voltar">
                ‹ Início
              </Link>
            )}
            {secao && <span className="secao">{SECOES[secao].rotulo}</span>}
            {secao &&
              SECOES[secao].abas.map((a) => (
                <Link key={a.to} to={a.to} activeProps={{ className: "on" }}>
                  {a.rotulo}
                </Link>
              ))}
          </nav>
          <div className="mh-dir">
            <div className="compnav" title="Competência em trabalho">
              <button onClick={() => setCompetencia(compShift(competencia, -1))} aria-label="Competência anterior">
                ‹
              </button>
              <b>{compLonga(competencia)}</b>
              <button onClick={() => setCompetencia(compShift(competencia, 1))} aria-label="Próxima competência">
                ›
              </button>
            </div>
            <select value={usuario?.id ?? ""} onChange={(e) => setUsuarioId(e.target.value)} aria-label="Usuário">
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
            <button className="theme-btn" onClick={alternar} title="Tema claro/escuro" aria-label="Alternar tema">
              {escuro ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>
      {DEMO && <FaixaDemo />}
      <main className="wrap">
        <Outlet />
      </main>
    </>
  );
}
