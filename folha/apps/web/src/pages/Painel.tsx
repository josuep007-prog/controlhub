import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api, type LinhaPainel } from "../api";
import { Carregando, Erro } from "../components/ui";
import { useEstado } from "../estado";
import { brl, cnpjFmt, compLonga, dataHoraBR, REGIMES } from "../fmt";

function status(l: LinhaPainel) {
  if (l.fechada) return <span className="tag verde">Fechada</span>;
  if (l.mensal) return <span className="tag azul">Calculada</span>;
  if (l.lancamentos) return <span className="tag ambar">Em lançamento</span>;
  return <span className="tag">Aberta</span>;
}

export function Painel() {
  const { competencia, avisar } = useEstado();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["painel", competencia],
    queryFn: () => api.get<LinhaPainel[]>(`/api/painel?competencia=${competencia}`),
  });
  const calcular = useMutation({
    mutationFn: (v: { tipo: "mensal" | "adiantamento"; empresaIds: string[] }) =>
      api.post<{ empresaId: string; ok: boolean; erro?: string }[]>("/api/calcular", { competencia, ...v }),
    onSuccess: (r) => {
      const erros = r.filter((x) => !x.ok);
      avisar(erros.length ? `${r.length - erros.length} calculada(s); ${erros.length} com erro: ${erros[0]?.erro}` : `${r.length} empresa(s) calculada(s)`, !!erros.length);
      qc.invalidateQueries();
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  if (q.isLoading) return <Carregando />;
  if (q.error) return <Erro erro={q.error} />;
  const linhas = q.data ?? [];
  const abertas = linhas.filter((l) => !l.fechada);
  const semCalculo = abertas.filter((l) => !l.mensal && l.funcionarios > 0);
  const fechadas = linhas.filter((l) => l.fechada).length;
  const totalLiq = linhas.reduce((a, l) => a + Number(l.mensal?.liquido ?? 0), 0);
  const totalFunc = linhas.reduce((a, l) => a + l.funcionarios, 0);
  const avisos = linhas.reduce((a, l) => a + (l.mensal?.avisos ?? 0), 0);

  return (
    <>
      <div className="titulo">
        <h1>Painel da competência</h1>
        <small>{compLonga(competencia)}</small>
        <div className="acoes">
          <button
            className="fbtn"
            disabled={calcular.isPending || !abertas.some((l) => l.temAdiantamento)}
            onClick={() => calcular.mutate({ tipo: "adiantamento", empresaIds: abertas.filter((l) => l.temAdiantamento).map((l) => l.empresaId) })}
          >
            Calcular adiantamentos
          </button>
          <button
            className="btn setor"
            disabled={calcular.isPending || !abertas.length}
            onClick={() => calcular.mutate({ tipo: "mensal", empresaIds: abertas.map((l) => l.empresaId) })}
          >
            {calcular.isPending ? "Calculando…" : "Calcular folha de todas as abertas"}
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="panel kpi azul">
          <b>{linhas.length}</b>
          <span>empresas ativas</span>
        </div>
        <div className="panel kpi">
          <b>{totalFunc}</b>
          <span>funcionários na competência</span>
        </div>
        <div className={`panel kpi ${semCalculo.length ? "ambar" : "verde"}`}>
          <b>{semCalculo.length}</b>
          <span>sem folha calculada</span>
        </div>
        <div className="panel kpi verde">
          <b>
            {fechadas}/{linhas.length}
          </b>
          <span>competências fechadas</span>
        </div>
        <div className="panel kpi">
          <b>R$ {brl(totalLiq)}</b>
          <span>líquido total da folha</span>
        </div>
        <div className={`panel kpi ${avisos ? "vermelho" : ""}`}>
          <b>{avisos}</b>
          <span>avisos no cálculo</span>
        </div>
      </div>

      <section className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Regime</th>
                <th className="num">Func.</th>
                <th className="num">Lançamentos</th>
                <th>Adiantamento</th>
                <th>Folha mensal</th>
                <th className="num">Líquido</th>
                <th className="num">FGTS</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.empresaId}>
                  <td>
                    <b>{l.razaoSocial}</b>
                    <span className="sub mono">{cnpjFmt(l.cnpj)}</span>
                  </td>
                  <td>{REGIMES[l.regime]}</td>
                  <td className="num">{l.funcionarios}</td>
                  <td className="num">{l.lancamentos || "—"}</td>
                  <td>
                    {!l.temAdiantamento ? (
                      <span className="sub">não usa</span>
                    ) : l.adiantamento ? (
                      <span className="tag verde">R$ {brl(l.adiantamento.liquido)}</span>
                    ) : (
                      <span className="tag">pendente</span>
                    )}
                  </td>
                  <td>
                    {l.mensal ? (
                      <>
                        {l.mensal.calculados} calculado(s)
                        <span className="sub">{dataHoraBR(l.mensal.calculadoEm)}</span>
                      </>
                    ) : (
                      <span className="sub">não calculada</span>
                    )}
                    {!!l.mensal?.avisos && <span className="tag vermelho">{l.mensal.avisos} aviso(s)</span>}
                  </td>
                  <td className="num">{l.mensal ? brl(l.mensal.liquido) : "—"}</td>
                  <td className="num">{l.mensal ? brl(l.mensal.fgts) : "—"}</td>
                  <td>{status(l)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="fbtn" to="/lancamentos" search={{ empresa: l.empresaId }}>
                      Lançar
                    </Link>{" "}
                    <Link className="fbtn" to="/calculo" search={{ empresa: l.empresaId }}>
                      Cálculo
                    </Link>{" "}
                    <Link className="fbtn" to="/relatorios" search={{ empresa: l.empresaId }}>
                      Relatórios
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!linhas.length && <div className="vazio">Nenhuma empresa ativa. Cadastre em Empresas ou importe do Domínio.</div>}
      </section>
      <p className="note">
        Fluxo da competência: lançar variáveis → calcular adiantamento (dia 15/20) → calcular folha mensal → conferir relatórios → fechar a competência no
        Cálculo.
      </p>
    </>
  );
}
