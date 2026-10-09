import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api, type Rubrica } from "../api";
import { useBusca } from "../busca";
import { Carregando, Erro, SeletorEmpresa } from "../components/ui";
import { useEstado } from "../estado";
import { brl, compLonga } from "../fmt";

interface DadosGrade {
  fechada: boolean;
  funcionarios: { id: string; nome: string; matricula: number; salario: string }[];
  rubricas: Rubrica[];
  lancamentos: { funcionarioId: string; rubricaCodigo: string; quantidade: string | null; valor: string | null }[];
}

const COLUNAS_PADRAO = ["010", "011", "015", "200", "201"];
const UNIDADE: Record<string, string> = { horas: "horas", dias: "dias", valor: "R$", percentual: "%" };
const chave = (f: string, r: string) => `${f}|${r}`;
/** Exibe "12.5" como "12,5" e mantém o que o usuário digitar. */
const paraTela = (v: string | null) => (v == null ? "" : String(Number(v)).replace(".", ","));

export function Lancamentos() {
  const { competencia, avisar } = useEstado();
  const [busca, setBusca] = useBusca();
  const qc = useQueryClient();
  const empresaId = busca.empresa;
  const q = useQuery({
    queryKey: ["lancamentos", empresaId, competencia],
    queryFn: () => api.get<DadosGrade>(`/api/lancamentos?empresaId=${empresaId}&competencia=${competencia}`),
    enabled: !!empresaId,
  });
  const [valores, setValores] = useState<Record<string, string>>({});
  const [colunas, setColunas] = useState<string[]>(COLUNAS_PADRAO);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const v: Record<string, string> = {};
    for (const l of q.data.lancamentos) v[chave(l.funcionarioId, l.rubricaCodigo)] = paraTela(l.quantidade ?? l.valor);
    setValores(v);
    setColunas([...new Set([...COLUNAS_PADRAO, ...q.data.lancamentos.map((l) => l.rubricaCodigo)])].sort());
    setSujo(false);
  }, [q.data]);

  const porCodigo = useMemo(() => new Map((q.data?.rubricas ?? []).map((r) => [r.codigo, r])), [q.data]);
  const visiveis = colunas.map((c) => porCodigo.get(c)).filter((r): r is Rubrica => !!r);
  const disponiveis = (q.data?.rubricas ?? []).filter((r) => !colunas.includes(r.codigo));

  const salvar = useMutation({
    mutationFn: () => {
      const lancamentos = Object.entries(valores)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => {
          const [funcionarioId, rubricaCodigo] = k.split("|") as [string, string];
          const r = porCodigo.get(rubricaCodigo);
          return r?.modo === "valor" ? { funcionarioId, rubricaCodigo, valor: v } : { funcionarioId, rubricaCodigo, quantidade: v };
        });
      return api.put<{ gravados: number }>("/api/lancamentos", { empresaId, competencia, lancamentos });
    },
    onSuccess: (r) => {
      avisar(`${r.gravados} lançamento(s) gravado(s). Recalcule a folha para refletir.`);
      setSujo(false);
      qc.invalidateQueries();
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  return (
    <>
      <div className="titulo">
        <h1>Lançamentos de variáveis</h1>
        <small>{compLonga(competencia)}</small>
        <div className="acoes">
          {empresaId && (
            <Link className="fbtn" to="/calculo" search={{ empresa: empresaId }}>
              Ir para o cálculo →
            </Link>
          )}
          <button className="btn verde" disabled={!sujo || salvar.isPending || q.data?.fechada} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Gravando…" : "Gravar lançamentos"}
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="barra">
          <SeletorEmpresa valor={empresaId} onChange={(id) => setBusca({ empresa: id || undefined })} />
          {q.data && disponiveis.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setColunas((c) => [...c, e.target.value].sort())}
              aria-label="Adicionar rubrica"
            >
              <option value="">+ Coluna de rubrica…</option>
              {disponiveis.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.codigo} · {r.descricao}
                </option>
              ))}
            </select>
          )}
          {sujo && <span className="tag ambar">alterações não gravadas</span>}
          {q.data && <span className="cont">{q.data.funcionarios.length} funcionário(s)</span>}
        </div>
        {!empresaId ? (
          <div className="vazio">Escolha a empresa para lançar horas extras, faltas, comissões e outros eventos do mês.</div>
        ) : q.isLoading ? (
          <Carregando />
        ) : q.error ? (
          <Erro erro={q.error} />
        ) : (
          <>
            {q.data?.fechada && (
              <div className="aviso erro" style={{ margin: 12 }}>
                Competência fechada: reabra no Cálculo para alterar lançamentos.
              </div>
            )}
            <div className="tbl-wrap">
              <table className="tbl grade">
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th className="num">Salário</th>
                    {visiveis.map((r) => (
                      <th key={r.codigo} className="rub" title={r.descricao}>
                        {r.codigo} · {r.descricao}
                        <span className="sub">{UNIDADE[r.modo]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data?.funcionarios.map((f) => (
                    <tr key={f.id}>
                      <td className="nome">
                        <b>{f.nome}</b>
                        <span className="sub">matr. {f.matricula}</span>
                      </td>
                      <td className="num">{brl(f.salario)}</td>
                      {visiveis.map((r) => {
                        const k = chave(f.id, r.codigo);
                        const v = valores[k] ?? "";
                        return (
                          <td key={r.codigo} className="cel">
                            <input
                              className={v ? "tem" : ""}
                              inputMode="decimal"
                              value={v}
                              disabled={q.data?.fechada}
                              aria-label={`${r.descricao} — ${f.nome}`}
                              onChange={(e) => {
                                setValores((x) => ({ ...x, [k]: e.target.value }));
                                setSujo(true);
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <p className="note">
        Horas aceitam decimais (15,5 = 15h30). Rubricas em R$ recebem o valor do mês. DSR sobre horas extras, INSS, IRRF, FGTS, vale-transporte e
        adiantamento são calculados pelo sistema.
      </p>
    </>
  );
}
