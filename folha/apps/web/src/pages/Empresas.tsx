import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { api, type Empresa, type Sindicato } from "../api";
import { Campo, Carregando, Dialogo, Erro, useEmpresas } from "../components/ui";
import { useEstado } from "../estado";
import { cnpjFmt, norm, pct, REGIMES } from "../fmt";

const VAZIA: Partial<Empresa> = {
  regime: "simples",
  rat: "0.02",
  fap: "1.0000",
  terceiros: "0.058",
  diaPagamento: 5,
  temAdiantamento: true,
  ativa: true,
  simplesAnexoIV: false,
};

function FichaEmpresa({ empresa, onFechar }: { empresa: Partial<Empresa>; onFechar: () => void }) {
  const { avisar, usuarios } = useEstado();
  const qc = useQueryClient();
  const [e, setE] = useState<Partial<Empresa>>(empresa);
  const { data: sindicatos = [] } = useQuery({ queryKey: ["sindicatos"], queryFn: () => api.get<Sindicato[]>("/api/sindicatos") });
  const set = <K extends keyof Empresa>(k: K, v: Empresa[K]) => setE((x) => ({ ...x, [k]: v }));
  const salvar = useMutation({
    mutationFn: () => (e.id ? api.put(`/api/empresas/${e.id}`, e) : api.post("/api/empresas", e)),
    onSuccess: () => {
      avisar(e.id ? "Empresa atualizada" : "Empresa cadastrada");
      qc.invalidateQueries();
      onFechar();
    },
    onError: (err) => avisar((err as Error).message, true),
  });
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    salvar.mutate();
  };
  const txt = (k: keyof Empresa) => ({
    value: (e[k] as string | null | undefined) ?? "",
    onChange: (ev: { target: { value: string } }) => set(k, ev.target.value as never),
  });

  return (
    <form onSubmit={enviar}>
      <div className="form-sec">
        <h3>Identificação</h3>
        <div className="campos">
          <Campo rotulo="Razão social" largo>
            <input required {...txt("razaoSocial")} />
          </Campo>
          <Campo rotulo="Nome fantasia">
            <input {...txt("nomeFantasia")} />
          </Campo>
          <Campo rotulo="CNPJ">
            <input required className="mono" {...txt("cnpj")} />
          </Campo>
          <Campo rotulo="Código no Domínio">
            <input className="mono" {...txt("codigoDominio")} />
          </Campo>
          <Campo rotulo="CNAE">
            <input className="mono" {...txt("cnae")} />
          </Campo>
        </div>
      </div>
      <div className="form-sec">
        <h3>Tributação da folha</h3>
        <div className="campos">
          <Campo rotulo="Regime">
            <select value={e.regime} onChange={(ev) => set("regime", ev.target.value as Empresa["regime"])}>
              {Object.entries(REGIMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          {e.regime === "simples" && (
            <label className="chk" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" checked={!!e.simplesAnexoIV} onChange={(ev) => set("simplesAnexoIV", ev.target.checked)} />
              Anexo IV (recolhe CPP na folha)
            </label>
          )}
          <Campo rotulo="FPAS">
            <input className="mono" {...txt("fpas")} />
          </Campo>
          <Campo rotulo="Código de terceiros">
            <input className="mono" {...txt("codigoTerceiros")} />
          </Campo>
          <Campo rotulo="RAT (ex.: 0,02 = 2%)">
            <input className="mono" {...txt("rat")} />
          </Campo>
          <Campo rotulo="FAP">
            <input className="mono" {...txt("fap")} />
          </Campo>
          <Campo rotulo="Terceiros (ex.: 0,058)">
            <input className="mono" {...txt("terceiros")} />
          </Campo>
        </div>
      </div>
      <div className="form-sec">
        <h3>Rotina</h3>
        <div className="campos">
          <Campo rotulo="Sindicato">
            <select value={e.sindicatoId ?? ""} onChange={(ev) => set("sindicatoId", ev.target.value || null)}>
              <option value="">—</option>
              {sindicatos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Analista responsável">
            <select value={e.responsavelId ?? ""} onChange={(ev) => set("responsavelId", ev.target.value || null)}>
              <option value="">—</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Dia do pagamento">
            <input type="number" min={1} max={31} value={e.diaPagamento ?? 5} onChange={(ev) => set("diaPagamento", Number(ev.target.value))} />
          </Campo>
          <label className="chk" style={{ alignSelf: "end", paddingBottom: 8 }}>
            <input type="checkbox" checked={!!e.temAdiantamento} onChange={(ev) => set("temAdiantamento", ev.target.checked)} />
            Paga adiantamento quinzenal
          </label>
          <label className="chk" style={{ alignSelf: "end", paddingBottom: 8 }}>
            <input type="checkbox" checked={!!e.ativa} onChange={(ev) => set("ativa", ev.target.checked)} />
            Empresa ativa
          </label>
          <Campo rotulo="Observações" largo>
            <textarea rows={2} {...txt("observacoes")} />
          </Campo>
        </div>
      </div>
      <div className="form-acoes">
        {e.id && (
          <Link className="fbtn esq" to="/funcionarios" search={{ empresa: e.id }}>
            Ver funcionários
          </Link>
        )}
        <button type="button" className="fbtn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn verde" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function Empresas() {
  const q = useEmpresas();
  const [busca, setBusca] = useState("");
  const [ficha, setFicha] = useState<Partial<Empresa> | null>(null);
  if (q.isLoading) return <Carregando />;
  if (q.error) return <Erro erro={q.error} />;
  const termo = norm(busca);
  const lista = (q.data ?? []).filter(
    (e) => !termo || norm(`${e.razaoSocial} ${e.nomeFantasia ?? ""} ${e.cnpj} ${e.codigoDominio ?? ""}`).includes(termo),
  );
  return (
    <>
      <div className="titulo">
        <h1>Empresas</h1>
        <small>{q.data?.length} cadastradas</small>
        <div className="acoes">
          <button className="btn setor" onClick={() => setFicha({ ...VAZIA })}>
            + Empresa
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="barra">
          <input type="search" placeholder="Buscar por nome, CNPJ ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <span className="cont">{lista.length} empresa(s)</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Regime</th>
                <th>RAT × FAP</th>
                <th>Sindicato</th>
                <th>Responsável</th>
                <th className="num">Func. ativos</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className={e.ativa ? "" : "inativo"}>
                  <td className="mono">{e.codigoDominio}</td>
                  <td>
                    <button className="linkish" onClick={() => setFicha(e)}>
                      {e.razaoSocial}
                    </button>
                    {!e.ativa && <span className="tag">inativa</span>}
                  </td>
                  <td className="mono">{cnpjFmt(e.cnpj)}</td>
                  <td>{REGIMES[e.regime]}</td>
                  <td className="mono">
                    {pct(e.rat)} × {Number(e.fap).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                  </td>
                  <td>{e.sindicato ?? "—"}</td>
                  <td>{e.responsavel ?? "—"}</td>
                  <td className="num">{e.funcionariosAtivos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialogo aberto={!!ficha} titulo={ficha?.id ? ficha.razaoSocial : "Nova empresa"} onFechar={() => setFicha(null)}>
        {ficha && <FichaEmpresa key={ficha.id ?? "nova"} empresa={ficha} onFechar={() => setFicha(null)} />}
      </Dialogo>
    </>
  );
}
