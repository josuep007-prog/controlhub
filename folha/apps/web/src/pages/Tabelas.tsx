import { useQuery } from "@tanstack/react-query";
import { api, type Auditoria, type TabelasLegais } from "../api";
import { Carregando, Erro } from "../components/ui";
import { brl, compCurta, dataHoraBR, pct } from "../fmt";

const ACOES: Record<string, string> = {
  admitir: "Admissão",
  criar: "Cadastro",
  alterar: "Alteração",
  importar: "Importação",
  lancar_variaveis: "Lançamentos",
  calcular_mensal: "Cálculo mensal",
  calcular_adiantamento: "Cálculo de adiantamento",
  fechar_competencia: "Fechou competência",
  reabrir_competencia: "Reabriu competência",
};

function Tabela({ t }: { t: TabelasLegais }) {
  let anterior = 0;
  return (
    <section className="panel">
      <div className="barra">
        <b>Vigência a partir de {compCurta(t.vigencia)}</b>
        <span className="cont">Salário mínimo R$ {brl(t.salarioMinimo)}</span>
      </div>
      <div className="pad" style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
        <div>
          <h3 className="sec">INSS — empregado</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Salário de contribuição</th>
                <th className="num">Alíquota</th>
              </tr>
            </thead>
            <tbody>
              {t.inss.faixas.map((f) => {
                const de = anterior;
                anterior = Number(f.ate) + 0.01;
                return (
                  <tr key={f.ate}>
                    <td className="mono">
                      {de ? `de ${brl(de)} ` : ""}até {brl(f.ate)}
                    </td>
                    <td className="num">{pct(f.aliquota, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 6 }}>
            Progressiva por faixa. Teto R$ {brl(t.inss.faixas.at(-1)?.ate ?? 0)}.
          </p>
        </div>
        <div>
          <h3 className="sec">IRRF — mensal</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Base de cálculo</th>
                <th className="num">Alíquota</th>
                <th className="num">Dedução</th>
              </tr>
            </thead>
            <tbody>
              {t.irrf.faixas.map((f, i) => (
                <tr key={i}>
                  <td className="mono">{f.ate ? `até ${brl(f.ate)}` : "acima"}</td>
                  <td className="num">{Number(f.aliquota) ? pct(f.aliquota, 1) : "isento"}</td>
                  <td className="num">{brl(f.deducao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 6 }}>
            Dependente R$ {brl(t.irrf.deducaoDependente)} · desconto simplificado R$ {brl(t.irrf.descontoSimplificado)}.
            {t.irrf.reducao && (
              <>
                {" "}
                Redução (Lei 15.270/2025): até R$ {brl(t.irrf.reducao.limiteIsencao)} zera o imposto (até R$ {brl(t.irrf.reducao.reducaoMaxima)}); até R${" "}
                {brl(t.irrf.reducao.limiteSuperior)} reduz {brl(t.irrf.reducao.constante)} − {t.irrf.reducao.coeficiente.replace(".", ",")} × rendimentos.
              </>
            )}
          </p>
        </div>
        <div>
          <h3 className="sec">Outros</h3>
          <table className="tbl">
            <tbody>
              <tr>
                <td>Salário-família — cota</td>
                <td className="num">R$ {brl(t.salarioFamilia.cota)}</td>
              </tr>
              <tr>
                <td>Salário-família — remuneração até</td>
                <td className="num">R$ {brl(t.salarioFamilia.limiteRemuneracao)}</td>
              </tr>
              <tr>
                <td>FGTS / aprendiz</td>
                <td className="num">
                  {pct(t.fgts.aliquota)} / {pct(t.fgts.aliquotaAprendiz)}
                </td>
              </tr>
              <tr>
                <td>Vale-transporte (desconto)</td>
                <td className="num">{pct(t.valeTransporte.percentualDesconto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="pad" style={{ borderTop: "1px solid var(--rule)" }}>
        <p className="note">Fonte: {t.fonte}</p>
      </div>
    </section>
  );
}

export function Tabelas() {
  const tabelas = useQuery({ queryKey: ["tabelas"], queryFn: () => api.get<TabelasLegais[]>("/api/tabelas") });
  const aud = useQuery({ queryKey: ["auditoria"], queryFn: () => api.get<Auditoria[]>("/api/auditoria?limite=50") });
  return (
    <>
      <div className="titulo">
        <h1>Tabelas legais</h1>
        <small>usadas pelo cálculo, por vigência</small>
      </div>
      {tabelas.isLoading ? <Carregando /> : tabelas.error ? <Erro erro={tabelas.error} /> : tabelas.data?.map((t) => <Tabela key={t.vigencia} t={t} />)}
      <section className="panel">
        <div className="barra">
          <b>Últimas alterações (auditoria)</b>
        </div>
        {aud.data && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>O quê</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {aud.data.map((a) => (
                  <tr key={a.id}>
                    <td>{dataHoraBR(a.quando)}</td>
                    <td>{a.usuario}</td>
                    <td>
                      {ACOES[a.acao] ?? a.acao} · {a.entidade}
                    </td>
                    <td className="sub" style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.detalhe ? JSON.stringify(a.detalhe) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!aud.data.length && <div className="vazio">Nada registrado ainda.</div>}
          </div>
        )}
      </section>
    </>
  );
}
