import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, type Rubrica } from "../api";
import { Campo, Carregando, Dialogo, Erro } from "../components/ui";
import { useEstado } from "../estado";

const MODOS: Record<Rubrica["modo"], string> = {
  sistema: "Calculada pelo sistema",
  horas: "Horas × valor-hora × fator",
  dias: "Dias × valor-dia × fator",
  valor: "Valor informado",
  percentual: "% sobre o salário",
};

const NOVA: Rubrica = {
  codigo: "",
  descricao: "",
  tipo: "provento",
  modo: "valor",
  fator: null,
  incideInss: true,
  incideFgts: true,
  incideIrrf: true,
  incideDsr: false,
  ativa: true,
};

function FormRubrica({ inicial, nova, onFechar }: { inicial: Rubrica; nova: boolean; onFechar: () => void }) {
  const [r, setR] = useState(inicial);
  const { avisar } = useEstado();
  const qc = useQueryClient();
  const sistema = r.modo === "sistema";
  const salvar = useMutation({
    mutationFn: () => (nova ? api.post("/api/rubricas", r) : api.put(`/api/rubricas/${r.codigo}`, r)),
    onSuccess: () => {
      avisar("Rubrica gravada");
      qc.invalidateQueries({ queryKey: ["rubricas"] });
      onFechar();
    },
    onError: (e) => avisar((e as Error).message, true),
  });
  const set = <K extends keyof Rubrica>(k: K, v: Rubrica[K]) => setR((x) => ({ ...x, [k]: v }));
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    salvar.mutate();
  };
  const inc = (k: "incideInss" | "incideFgts" | "incideIrrf" | "incideDsr", rot: string) => (
    <label className="chk">
      <input type="checkbox" disabled={sistema} checked={r[k]} onChange={(e) => set(k, e.target.checked)} /> {rot}
    </label>
  );
  return (
    <form onSubmit={enviar}>
      <div className="form-sec">
        {sistema && (
          <div className="aviso" style={{ marginBottom: 12 }}>
            Rubrica calculada pelo motor da folha: só a descrição e a situação podem mudar.
          </div>
        )}
        <div className="campos">
          <Campo rotulo="Código (3 dígitos)">
            <input className="mono" required disabled={!nova} value={r.codigo} onChange={(e) => set("codigo", e.target.value)} />
          </Campo>
          <Campo rotulo="Descrição" largo>
            <input required value={r.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </Campo>
          <Campo rotulo="Tipo">
            <select disabled={sistema} value={r.tipo} onChange={(e) => set("tipo", e.target.value as Rubrica["tipo"])}>
              <option value="provento">Provento</option>
              <option value="desconto">Desconto</option>
              <option value="informativa">Informativa</option>
            </select>
          </Campo>
          <Campo rotulo="Forma de cálculo">
            <select disabled={sistema} value={r.modo} onChange={(e) => set("modo", e.target.value as Rubrica["modo"])}>
              {Object.entries(MODOS)
                .filter(([k]) => sistema || k !== "sistema")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </Campo>
          {(r.modo === "horas" || r.modo === "dias") && (
            <Campo rotulo="Fator (1,5 = 50% a mais)">
              <input className="mono" value={r.fator ?? ""} onChange={(e) => set("fator", e.target.value || null)} />
            </Campo>
          )}
        </div>
      </div>
      <div className="form-sec">
        <h3>Incidências</h3>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {inc("incideInss", "INSS")}
          {inc("incideFgts", "FGTS")}
          {inc("incideIrrf", "IRRF")}
          {inc("incideDsr", "Entra no DSR")}
          <label className="chk">
            <input type="checkbox" checked={r.ativa} onChange={(e) => set("ativa", e.target.checked)} /> Ativa
          </label>
        </div>
      </div>
      <div className="form-acoes">
        <button type="button" className="fbtn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn verde" disabled={salvar.isPending}>
          Salvar
        </button>
      </div>
    </form>
  );
}

export function Rubricas() {
  const q = useQuery({ queryKey: ["rubricas"], queryFn: () => api.get<Rubrica[]>("/api/rubricas") });
  const [edit, setEdit] = useState<{ r: Rubrica; nova: boolean } | null>(null);
  if (q.isLoading) return <Carregando />;
  if (q.error) return <Erro erro={q.error} />;
  const sim = (b: boolean) => (b ? "✓" : "");
  return (
    <>
      <div className="titulo">
        <h1>Rubricas</h1>
        <small>os "eventos" do Domínio</small>
        <div className="acoes">
          <button className="btn setor" onClick={() => setEdit({ r: { ...NOVA }, nova: true })}>
            + Rubrica
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Cálculo</th>
                <th>INSS</th>
                <th>FGTS</th>
                <th>IRRF</th>
                <th>DSR</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.codigo} className={r.ativa ? "" : "inativo"}>
                  <td className="mono">{r.codigo}</td>
                  <td>
                    <button className="linkish" onClick={() => setEdit({ r, nova: false })}>
                      {r.descricao}
                    </button>
                  </td>
                  <td>
                    <span className={`tag ${r.tipo === "provento" ? "verde" : r.tipo === "desconto" ? "vermelho" : ""}`}>{r.tipo}</span>
                  </td>
                  <td>
                    {MODOS[r.modo]}
                    {r.fator && r.modo !== "sistema" ? ` (${Number(r.fator).toLocaleString("pt-BR")})` : ""}
                  </td>
                  <td>{sim(r.incideInss)}</td>
                  <td>{sim(r.incideFgts)}</td>
                  <td>{sim(r.incideIrrf)}</td>
                  <td>{sim(r.incideDsr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialogo aberto={!!edit} titulo={edit?.nova ? "Nova rubrica" : `Rubrica ${edit?.r.codigo}`} onFechar={() => setEdit(null)} largura={680}>
        {edit && <FormRubrica key={edit.r.codigo || "nova"} inicial={edit.r} nova={edit.nova} onFechar={() => setEdit(null)} />}
      </Dialogo>
    </>
  );
}
