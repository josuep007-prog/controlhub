import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { api, type Calculo as TCalculo, type LinhaPainel } from "../api";
import { useBusca } from "../busca";
import { Carregando, Erro, SeletorEmpresa } from "../components/ui";
import { useEstado } from "../estado";
import { brl, compLonga, dataHoraBR } from "../fmt";

export function TabelaItens({ c }: { c: TCalculo }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Cód.</th>
          <th>Descrição</th>
          <th className="num">Referência</th>
          <th className="num">Proventos</th>
          <th className="num">Descontos</th>
        </tr>
      </thead>
      <tbody>
        {c.itens.map((i) => (
          <tr key={i.codigo} style={i.tipo === "informativa" ? { color: "var(--ink-3)" } : undefined}>
            <td className="mono">{i.codigo}</td>
            <td>{i.descricao}</td>
            <td className="num">{i.referencia}</td>
            <td className="num">{i.tipo === "provento" ? brl(i.valor) : ""}</td>
            <td className="num">{i.tipo === "desconto" ? brl(i.valor) : i.tipo === "informativa" ? `(${brl(i.valor)})` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Calculo() {
  const { competencia, avisar } = useEstado();
  const [busca, setBusca] = useBusca();
  const tipo = busca.tipo ?? "mensal";
  const empresaId = busca.empresa;
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<number | null>(null);

  const painel = useQuery({
    queryKey: ["painel", competencia],
    queryFn: () => api.get<LinhaPainel[]>(`/api/painel?competencia=${competencia}`),
  });
  const linha = painel.data?.find((l) => l.empresaId === empresaId);
  const q = useQuery({
    queryKey: ["calculos", empresaId, competencia, tipo],
    queryFn: () => api.get<TCalculo[]>(`/api/calculos?empresaId=${empresaId}&competencia=${competencia}&tipo=${tipo}`),
    enabled: !!empresaId,
  });

  const calcular = useMutation({
    mutationFn: () => api.post<{ ok: boolean; erro?: string; funcionarios?: number }[]>("/api/calcular", { competencia, tipo, empresaIds: [empresaId] }),
    onSuccess: (r) => {
      const x = r[0];
      if (x?.ok) avisar(`${tipo === "mensal" ? "Folha" : "Adiantamento"} calculado: ${x.funcionarios} funcionário(s)`);
      else avisar(x?.erro ?? "Erro no cálculo", true);
      qc.invalidateQueries();
    },
    onError: (e) => avisar((e as Error).message, true),
  });
  const fechar = useMutation({
    mutationFn: (fechada: boolean) => api.post("/api/competencias/fechamento", { empresaId, competencia, fechada }),
    onSuccess: (_r, fechada) => {
      avisar(fechada ? "Competência fechada" : "Competência reaberta");
      qc.invalidateQueries();
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  const lista = q.data ?? [];
  const soma = (k: keyof TCalculo) => lista.reduce((a, c) => a + Number(c[k]), 0);
  const comAviso = lista.filter((c) => c.avisos.length);

  return (
    <>
      <div className="titulo">
        <h1>Cálculo da folha</h1>
        <small>{compLonga(competencia)}</small>
        <div className="acoes">
          {empresaId && lista.length > 0 && (
            <Link className="fbtn" to="/relatorios" search={{ empresa: empresaId, tipo }}>
              Relatórios →
            </Link>
          )}
          {empresaId && tipo === "mensal" && (
            <button className="fbtn" disabled={fechar.isPending} onClick={() => fechar.mutate(!linha?.fechada)}>
              {linha?.fechada ? "Reabrir competência" : "Fechar competência"}
            </button>
          )}
          <button className="btn setor" disabled={!empresaId || calcular.isPending || linha?.fechada} onClick={() => calcular.mutate()}>
            {calcular.isPending ? "Calculando…" : lista.length ? "Recalcular" : "Calcular"}
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="barra">
          <SeletorEmpresa valor={empresaId} onChange={(id) => setBusca({ empresa: id || undefined })} />
          <div className="seg">
            <button className={tipo === "mensal" ? "on" : ""} onClick={() => setBusca({ tipo: "mensal" })}>
              Folha mensal
            </button>
            <button className={tipo === "adiantamento" ? "on" : ""} onClick={() => setBusca({ tipo: "adiantamento" })}>
              Adiantamento
            </button>
          </div>
          {linha?.fechada && <span className="tag verde">fechada por {linha.fechadaPor}</span>}
          {lista[0] && (
            <span className="cont">
              calculado em {dataHoraBR(lista[0].calculadoEm)} por {lista[0].calculadoPor}
            </span>
          )}
        </div>
        {!empresaId ? (
          <div className="vazio">Escolha a empresa para calcular e conferir a folha.</div>
        ) : q.isLoading ? (
          <Carregando />
        ) : q.error ? (
          <Erro erro={q.error} />
        ) : !lista.length ? (
          <div className="vazio">Ainda não calculado nesta competência.</div>
        ) : (
          <>
            {comAviso.length > 0 && (
              <div className="aviso" style={{ margin: 12 }}>
                <div>
                  <b>{comAviso.length} funcionário(s) com aviso:</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {comAviso.map((c) => (
                      <li key={c.id}>
                        {c.funcionario.nome}: {c.avisos.join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="num">Matr.</th>
                    <th>Funcionário</th>
                    <th className="num">Dias</th>
                    <th className="num">Proventos</th>
                    <th className="num">Descontos</th>
                    <th className="num">Líquido</th>
                    {tipo === "mensal" && (
                      <>
                        <th className="num">Base INSS</th>
                        <th className="num">INSS</th>
                        <th className="num">IRRF</th>
                        <th className="num">FGTS</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <Fragment key={c.id}>
                      <tr className={aberto === c.id ? "aberto" : ""}>
                        <td className="num">{c.funcionario.matricula}</td>
                        <td>
                          <button className="linkish" onClick={() => setAberto(aberto === c.id ? null : c.id)} aria-expanded={aberto === c.id}>
                            {aberto === c.id ? "▾" : "▸"} {c.funcionario.nome}
                          </button>
                          {c.avisos.length > 0 && <span className="tag ambar">aviso</span>}
                        </td>
                        <td className="num">{c.diasTrabalhados}</td>
                        <td className="num">{brl(c.totalProventos)}</td>
                        <td className="num">{brl(c.totalDescontos)}</td>
                        <td className="num">
                          <b>{brl(c.liquido)}</b>
                        </td>
                        {tipo === "mensal" && (
                          <>
                            <td className="num">{brl(c.baseInss)}</td>
                            <td className="num">{brl(c.inss)}</td>
                            <td className="num">{brl(c.irrf)}</td>
                            <td className="num">{brl(c.fgts)}</td>
                          </>
                        )}
                      </tr>
                      {aberto === c.id && (
                        <tr>
                          <td colSpan={10} className="itens-calc">
                            <TabelaItens c={c} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td>Total ({lista.length})</td>
                    <td></td>
                    <td className="num">{brl(soma("totalProventos"))}</td>
                    <td className="num">{brl(soma("totalDescontos"))}</td>
                    <td className="num">{brl(soma("liquido"))}</td>
                    {tipo === "mensal" && (
                      <>
                        <td className="num">{brl(soma("baseInss"))}</td>
                        <td className="num">{brl(soma("inss"))}</td>
                        <td className="num">{brl(soma("irrf"))}</td>
                        <td className="num">{brl(soma("fgts"))}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
