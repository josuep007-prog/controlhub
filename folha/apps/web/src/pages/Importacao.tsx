import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Previa } from "../api";
import { SeletorEmpresa } from "../components/ui";
import { useEstado } from "../estado";
import { brl } from "../fmt";

type Tipo = "funcionarios" | "empresas";

/** Lê a primeira planilha; o cabeçalho é a primeira linha com 3+ células preenchidas. */
async function lerArquivo(arquivo: File): Promise<Record<string, unknown>[]> {
  // No artefato a SheetJS vem do cdnjs (window.XLSX); na versão instalada, carrega sob demanda.
  const XLSX = import.meta.env.VITE_DEMO === "1" ? (window as unknown as { XLSX: typeof import("xlsx") }).XLSX : await import("xlsx");
  const buf = await arquivo.arrayBuffer();
  const wb = arquivo.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true })
    : XLSX.read(buf, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  const iCab = matriz.findIndex((l) => l.filter((c) => String(c).trim()).length >= 3);
  if (iCab < 0) return [];
  const cab = matriz[iCab]!.map((c) => String(c).trim());
  return matriz
    .slice(iCab + 1)
    .filter((l) => l.some((c) => String(c).trim()))
    .map((l) => Object.fromEntries(cab.flatMap((h, i) => (h ? [[h, l[i]]] : []))));
}

const mostrar = (campo: string, v: unknown) => (v == null ? "—" : campo === "salario" ? brl(String(v)) : String(v));

export function Importacao() {
  const { avisar } = useEstado();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("funcionarios");
  const [empresaId, setEmpresaId] = useState("");
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);

  const gerarPrevia = useMutation({
    mutationFn: (ls: Record<string, unknown>[]) => api.post<Previa>("/api/importacao/previa", { tipo, empresaId: empresaId || undefined, linhas: ls }),
    onSuccess: setPrevia,
    onError: (e) => avisar((e as Error).message, true),
  });
  const aplicar = useMutation({
    mutationFn: () =>
      api.post<{ inseridos: number; atualizados: number; revisar: number }>("/api/importacao/aplicar", {
        tipo,
        empresaId: empresaId || undefined,
        linhas,
      }),
    onSuccess: (r) => {
      avisar(`${r.inseridos} incluído(s), ${r.atualizados} atualizado(s). ${r.revisar} linha(s) ficaram para revisar.`);
      setPrevia(null);
      setLinhas([]);
      setNomeArquivo("");
      qc.invalidateQueries();
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  const escolher = async (arq: File | undefined) => {
    if (!arq) return;
    try {
      const ls = await lerArquivo(arq);
      if (!ls.length) return avisar("Não encontrei linhas com cabeçalho no arquivo.", true);
      setLinhas(ls);
      setNomeArquivo(arq.name);
      gerarPrevia.mutate(ls);
    } catch (e) {
      avisar(`Não consegui ler o arquivo: ${(e as Error).message}`, true);
    }
  };

  const podeEscolher = tipo === "empresas" || !!empresaId;

  return (
    <>
      <div className="titulo">
        <h1>Importar do Domínio</h1>
        <small>Excel (.xlsx/.xls) ou CSV exportados do Domínio Folha</small>
      </div>
      <section className="panel">
        <div className="barra">
          <div className="seg">
            {(["funcionarios", "empresas"] as const).map((t) => (
              <button
                key={t}
                className={tipo === t ? "on" : ""}
                onClick={() => {
                  setTipo(t);
                  setPrevia(null);
                }}
              >
                {t === "funcionarios" ? "Empregados" : "Empresas"}
              </button>
            ))}
          </div>
          {tipo === "funcionarios" && (
            <SeletorEmpresa
              valor={empresaId}
              onChange={(id) => {
                setEmpresaId(id);
                setPrevia(null);
              }}
            />
          )}
          <label className={`fbtn${podeEscolher ? "" : " disabled"}`} style={podeEscolher ? undefined : { opacity: 0.45, pointerEvents: "none" }}>
            Escolher arquivo…
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                escolher(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {nomeArquivo && (
            <span className="cont">
              {nomeArquivo} · {linhas.length} linha(s)
            </span>
          )}
        </div>
        {!previa ? (
          <div className="pad">
            <p className="note">
              {tipo === "funcionarios"
                ? "No Domínio Folha, exporte a relação de empregados da empresa para Excel. Colunas reconhecidas: Código, Nome, CPF, PIS, Nascimento, Sexo, Admissão, Demissão, Cargo, CBO, Departamento, Salário, Dependentes IR, Dependentes SF, E-mail, Telefone. Escolha antes a empresa de destino."
                : "Exporte a relação de empresas. Colunas reconhecidas: Código, Razão social, Fantasia, CNPJ, Regime/Tributação, CNAE, FPAS, RAT, FAP."}
            </p>
            <p className="note" style={{ marginTop: 6 }}>
              Nada é gravado antes da conferência: primeiro aparece a prévia com o que é novo, o que muda e o que precisa de revisão.
            </p>
          </div>
        ) : (
          <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="kpis">
              <div className="panel kpi verde">
                <b>{previa.novos.length}</b>
                <span>novos</span>
              </div>
              <div className="panel kpi azul">
                <b>{previa.alterados.length}</b>
                <span>com alteração</span>
              </div>
              <div className="panel kpi">
                <b>{previa.iguais}</b>
                <span>sem mudança</span>
              </div>
              <div className={`panel kpi ${previa.revisar.length ? "vermelho" : ""}`}>
                <b>{previa.revisar.length}</b>
                <span>para revisar (não entram)</span>
              </div>
            </div>
            <p className="note">
              Colunas reconhecidas:{" "}
              {Object.entries(previa.colunas.reconhecidas)
                .map(([c, campo]) => `${c} → ${campo}`)
                .join(" · ") || "nenhuma"}
              {previa.colunas.ignoradas.length > 0 && <> · Ignoradas: {previa.colunas.ignoradas.join(", ")}</>}
            </p>
            {previa.novos.length > 0 && (
              <details open>
                <summary>
                  <b>Novos ({previa.novos.length})</b>
                </summary>
                <ul>
                  {previa.novos.map((n) => (
                    <li key={n.linha}>
                      linha {n.linha}: {n.nome}
                      {n.dados.salario ? ` — R$ ${brl(String(n.dados.salario))}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {previa.alterados.length > 0 && (
              <details open>
                <summary>
                  <b>Alterados ({previa.alterados.length})</b>
                </summary>
                <ul>
                  {previa.alterados.map((a) => (
                    <li key={a.linha}>
                      {a.nome}:{" "}
                      {a.mudancas.map((m) => `${m.campo} ${mostrar(m.campo, m.de)} → ${mostrar(m.campo, m.para)}`).join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {previa.revisar.length > 0 && (
              <details open>
                <summary>
                  <b>Revisar ({previa.revisar.length})</b>
                </summary>
                <ul>
                  {previa.revisar.map((r) => (
                    <li key={r.linha}>
                      linha {r.linha}: {r.nome} — {r.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="fbtn" onClick={() => setPrevia(null)}>
                Descartar
              </button>
              <button
                className="btn verde"
                disabled={aplicar.isPending || !(previa.novos.length + previa.alterados.length)}
                onClick={() => aplicar.mutate()}
              >
                {aplicar.isPending ? "Gravando…" : `Gravar ${previa.novos.length + previa.alterados.length} registro(s)`}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
