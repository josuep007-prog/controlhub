import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { api, type Funcionario } from "../api";
import { useBusca } from "../busca";
import { Carregando, Erro, SeletorEmpresa } from "../components/ui";
import { brl, cpfFmt, dataBR, norm } from "../fmt";

export function Funcionarios() {
  const [busca, setBusca] = useBusca();
  const [termo, setTermo] = useState("");
  const [situacao, setSituacao] = useState<"ativos" | "demitidos" | "todos">("ativos");
  const q = useQuery({
    queryKey: ["funcionarios", busca.empresa ?? ""],
    queryFn: () => api.get<Funcionario[]>(`/api/funcionarios${busca.empresa ? `?empresaId=${busca.empresa}` : ""}`),
  });
  const hoje = new Date().toISOString().slice(0, 10);
  const t = norm(termo);
  const lista = (q.data ?? []).filter((f) => {
    const demitido = !!f.demissao && f.demissao < hoje;
    if (situacao === "ativos" && demitido) return false;
    if (situacao === "demitidos" && !demitido) return false;
    return !t || norm(`${f.nome} ${f.cpf} ${f.matricula} ${f.cargo ?? ""}`).includes(t);
  });

  return (
    <>
      <div className="titulo">
        <h1>Funcionários</h1>
        <div className="acoes">
          <Link className="btn setor" to="/funcionarios/novo" search={{ empresa: busca.empresa }}>
            + Admissão
          </Link>
        </div>
      </div>
      <section className="panel">
        <div className="barra">
          <SeletorEmpresa todas valor={busca.empresa} onChange={(id) => setBusca({ empresa: id || undefined })} />
          <input type="search" placeholder="Buscar por nome, CPF, matrícula ou cargo…" value={termo} onChange={(e) => setTermo(e.target.value)} />
          <div className="seg">
            {(["ativos", "demitidos", "todos"] as const).map((s) => (
              <button key={s} className={situacao === s ? "on" : ""} onClick={() => setSituacao(s)}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <span className="cont">{lista.length} funcionário(s)</span>
        </div>
        {q.isLoading ? (
          <Carregando />
        ) : q.error ? (
          <Erro erro={q.error} />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">Matr.</th>
                  <th>Nome</th>
                  {!busca.empresa && <th>Empresa</th>}
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Admissão</th>
                  <th className="num">Salário</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td className="num">{f.matricula}</td>
                    <td>
                      <Link to="/funcionarios/$id" params={{ id: f.id }}>
                        <b>{f.nome}</b>
                      </Link>
                    </td>
                    {!busca.empresa && <td>{f.empresa}</td>}
                    <td className="mono">{cpfFmt(f.cpf)}</td>
                    <td>
                      {f.cargo ?? "—"}
                      {f.cbo && <span className="sub mono">CBO {f.cbo}</span>}
                    </td>
                    <td>{dataBR(f.admissao)}</td>
                    <td className="num">
                      {brl(f.salario)}
                      {f.tipoSalario === "horista" && <span className="sub">por hora</span>}
                    </td>
                    <td>
                      {f.demissao && f.demissao < hoje ? (
                        <span className="tag">demitido {dataBR(f.demissao)}</span>
                      ) : f.tipoContrato === "experiencia" ? (
                        <span className="tag ambar">experiência</span>
                      ) : f.categoria === "aprendiz" ? (
                        <span className="tag azul">aprendiz</span>
                      ) : (
                        <span className="tag verde">ativo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!lista.length && <div className="vazio">Nenhum funcionário encontrado.</div>}
          </div>
        )}
      </section>
    </>
  );
}
