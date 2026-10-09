import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DEMO } from "../api";
import { useEstado } from "../estado";
import { compLonga, compShift } from "../fmt";

const ABAS = [
  { to: "/", rotulo: "Painel" },
  { to: "/empresas", rotulo: "Empresas" },
  { to: "/funcionarios", rotulo: "Funcionários" },
  { to: "/lancamentos", rotulo: "Lançamentos" },
  { to: "/calculo", rotulo: "Cálculo" },
  { to: "/relatorios", rotulo: "Relatórios" },
  { to: "/rubricas", rotulo: "Rubricas" },
  { to: "/importacao", rotulo: "Importar" },
  { to: "/tabelas", rotulo: "Tabelas" },
] as const;

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
          <nav className="navtabs" aria-label="Seções">
            {ABAS.map((a) => (
              <Link key={a.to} to={a.to} activeProps={{ className: "on" }} activeOptions={{ exact: a.to === "/" }}>
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
