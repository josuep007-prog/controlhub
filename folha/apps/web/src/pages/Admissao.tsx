import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
import { api, type Cargo, type Funcionario, type Rascunho } from "../api";
import { prepararArquivos, EXTENSOES_ACEITAS } from "../arquivos";
import { salvarArquivo } from "../baixar";
import { useBusca } from "../busca";
import { FormularioFuncionario, type DadosFuncionario } from "../components/FormularioFuncionario";
import { SeletorEmpresa, useEmpresas } from "../components/ui";
import { useEstado, type RascunhoLocal } from "../estado";
import { cnpjFmt, norm } from "../fmt";
import { cnpjDaFicha, lerFicha, montarModelo } from "../regras";
import { gerarXlsx, lerPlanilha } from "../xlsx";

type Modo = "excel" | "documentos" | "manual";

const PADROES: DadosFuncionario = {
  tipoContrato: "experiencia",
  categoria: "empregado",
  tipoSalario: "mensal",
  horasMensais: 220,
  dependentesIrrf: 0,
  filhosSalarioFamilia: 0,
  optaVt: false,
  vtValorMensal: "0",
  percentualAdiantamento: "0.40",
};

const paraFormulario = (r: RascunhoLocal): DadosFuncionario => ({ ...PADROES, ...(r.dados as DadosFuncionario), empresaId: r.empresaId });
const temDuvida = (r: Rascunho) => Object.values(r.notas).some((n) => n.confianca === "baixa");
/** Ficha do cliente sem pendência nem dúvida: pode ser gravada em lote. */
const estaPronta = (r: Rascunho) => r.origem === "excel" && r.pendencias.length === 0 && !temDuvida(r);

export function Admissao() {
  const { rascunhos, adicionarRascunhos, atualizarRascunho, removerRascunho, avisar } = useEstado();
  const [busca, setBusca] = useBusca();
  const empresaId = busca.empresa;
  const empresas = useEmpresas();
  const empresa = empresas.data?.find((e) => e.id === empresaId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [modo, setModo] = useState<Modo>("excel");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [escolhidos, setEscolhidos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const inputFicha = useRef<HTMLInputElement>(null);
  const inputDocs = useRef<HTMLInputElement>(null);
  const cargos = useQuery({ queryKey: ["cargos"], queryFn: () => api.get<Cargo[]>("/api/cargos") });

  const nomeEmpresa = (id: string) => empresas.data?.find((e) => e.id === id)?.razaoSocial ?? "";
  const rascunho = rascunhos.find((r) => r.id === aberto);

  // ---------- 1. ficha em Excel ----------

  const baixarFicha = async () => {
    if (!empresa) return;
    setErro(null);
    try {
      const bytes = await gerarXlsx(montarModelo(empresa));
      const slug = norm(empresa.nomeFantasia ?? empresa.razaoSocial).replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      const r = await salvarArquivo(`ficha-admissao-${slug}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      if (r === "salvo") avisar("Ficha gerada. Envie para o cliente preencher.");
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const importarFicha = async (arquivo: File | undefined) => {
    if (!arquivo || !empresa) return;
    setErro(null);
    setOcupado("Lendo a ficha…");
    try {
      const planilha = await lerPlanilha(arquivo);
      const cnpj = cnpjDaFicha(planilha.titulo);
      if (cnpj && cnpj !== empresa.cnpj.replace(/\W/g, "").toUpperCase()) {
        throw new Error(`Esta ficha é de outra empresa (CNPJ ${cnpjFmt(cnpj)}). Você escolheu ${empresa.razaoSocial}.`);
      }
      const leitura = lerFicha(planilha.linhas, planilha.primeiraLinha);
      if (leitura.colunasFaltando.length) {
        throw new Error(`Faltam colunas obrigatórias na planilha: ${leitura.colunasFaltando.join(", ")}. Use a ficha exportada pelo sistema, sem mudar os títulos.`);
      }
      if (!leitura.rascunhos.length) throw new Error("Não encontrei nenhum funcionário preenchido na ficha.");
      adicionarRascunhos(leitura.rascunhos.map((r) => ({ ...r, empresaId: empresa.id })));
      const prontas = leitura.rascunhos.filter(estaPronta).length;
      avisar(`${leitura.rascunhos.length} funcionário(s) lido(s): ${prontas} pronto(s), ${leitura.rascunhos.length - prontas} para conferir.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
      if (inputFicha.current) inputFicha.current.value = "";
    }
  };

  // ---------- 2. documentos ----------

  const somarArquivos = (lista: FileList | File[]) => {
    setErro(null);
    // Copia já: a lista do campo é "viva" e esvazia quando o campo é limpo logo depois.
    const novos = Array.from(lista);
    setEscolhidos((atual) => [...atual, ...novos].slice(0, 12));
  };
  const soltar = (ev: DragEvent) => {
    ev.preventDefault();
    setArrastando(false);
    if (empresa) somarArquivos(ev.dataTransfer.files);
  };

  const lerDocumentos = async () => {
    if (!empresa || !escolhidos.length) return;
    setErro(null);
    setOcupado("Lendo os documentos… pode levar até um minuto.");
    try {
      const { arquivos, avisos } = await prepararArquivos(escolhidos);
      const r = await api.post<Rascunho>("/api/admissao/extrair", { empresaId: empresa.id, arquivos });
      const [novo] = adicionarRascunhos([{ ...r, avisos: [...avisos, ...r.avisos], empresaId: empresa.id }]);
      setEscolhidos([]);
      if (novo) setAberto(novo.id);
      avisar(r.pendencias.length ? `Documentos lidos. Faltam ${r.pendencias.length} dado(s).` : "Documentos lidos. Confira os campos antes de gravar.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  // ---------- 3. em branco ----------

  const abrirEmBranco = () => {
    if (!empresa) return;
    const [novo] = adicionarRascunhos([{ origem: "manual", rotulo: "Novo funcionário", dados: {}, notas: {}, pendencias: [], outros: [], avisos: [], documentos: [], empresaId: empresa.id }]);
    if (novo) setAberto(novo.id);
  };

  // ---------- gravar ----------

  const gravarEmLote = async () => {
    setConfirmandoLote(false);
    const prontas = rascunhos.filter(estaPronta);
    const conhecidos = [...(cargos.data ?? [])];
    let gravadas = 0;
    setOcupado(`Gravando ${prontas.length} admissão(ões)…`);
    for (const r of prontas) {
      try {
        const nomeCargo = typeof r.dados.cargo === "string" ? r.dados.cargo : "";
        let cargoId = conhecidos.find((c) => norm(c.nome) === norm(nomeCargo))?.id ?? null;
        if (nomeCargo && !cargoId) {
          const novo = await api.post<Cargo>("/api/cargos", { nome: nomeCargo, cbo: typeof r.dados.cbo === "string" ? r.dados.cbo : "" });
          conhecidos.push(novo);
          cargoId = novo.id;
        }
        await api.post<Funcionario>("/api/funcionarios", { ...PADROES, ...r.dados, empresaId: r.empresaId, cargoId });
        removerRascunho(r.id);
        gravadas++;
      } catch (e) {
        atualizarRascunho(r.id, { pendencias: [...r.pendencias.filter((p) => !p.startsWith("Não gravou")), `Não gravou: ${(e as Error).message}`] });
      }
    }
    setOcupado(null);
    qc.invalidateQueries();
    avisar(gravadas === prontas.length ? `${gravadas} admissão(ões) gravada(s).` : `${gravadas} de ${prontas.length} gravadas. As demais ficaram com o motivo na lista.`, gravadas !== prontas.length);
  };

  // ---------- conferência de um rascunho ----------

  if (rascunho) {
    return (
      <>
        <div className="titulo">
          <h1>{rascunho.origem === "manual" ? "Nova admissão" : "Conferir admissão"}</h1>
          <small>{nomeEmpresa(rascunho.empresaId)}</small>
          <div className="acoes">
            <button className="fbtn" onClick={() => setAberto(null)}>
              ‹ Voltar aos rascunhos
            </button>
          </div>
        </div>
        {rascunho.pendencias.length > 0 && (
          <div className="aviso erro">
            <div>
              <b>Para gravar, falta resolver:</b> {rascunho.pendencias.join("; ")}.
            </div>
          </div>
        )}
        {rascunho.avisos.length > 0 && (
          <div className="aviso">
            <div>
              <b>Atenção:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {rascunho.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {rascunho.origem === "documentos" && (
          <section className="panel pad" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            <div>
              <h3 className="sec">Documentos lidos</h3>
              <ul className="lista-doc">
                {rascunho.documentos.map((d) => (
                  <li key={d.arquivo}>
                    {d.arquivo} <span className={`tag ${d.legivel ? "verde" : "vermelho"}`}>{d.tipo.replace(/_/g, " ")}{d.legivel ? "" : " · ilegível"}</span>
                  </li>
                ))}
              </ul>
            </div>
            {rascunho.outros.length > 0 && (
              <div>
                <h3 className="sec">
                  Também encontrei <small>ainda sem campo no cadastro; será usado no eSocial</small>
                </h3>
                <ul className="lista-doc">
                  {rascunho.outros.map((o, i) => (
                    <li key={i}>
                      <b>{o.rotulo}:</b> {o.valor} <span className="sub">{o.arquivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        <FormularioFuncionario
          key={rascunho.id}
          inicial={paraFormulario(rascunho)}
          notas={rascunho.notas}
          textoSalvar="Gravar admissão"
          rodape="Só grava quando você clicar. O eSocial (S-2200) fica para a fase 3."
          onCancelar={() => setAberto(null)}
          onSalvo={(f) => {
            removerRascunho(rascunho.id);
            setAberto(null);
            avisar(`Admissão gravada: ${f.nome}, matrícula ${f.matricula}.`);
          }}
        />
      </>
    );
  }

  // ---------- tela principal ----------

  const prontas = rascunhos.filter(estaPronta);
  const semEmpresa = !empresa;

  return (
    <>
      <div className="titulo">
        <h1>Admissão</h1>
        <small>Escolha como começar. Nada é gravado antes de você conferir.</small>
      </div>

      <section className="panel">
        <div className="barra">
          <SeletorEmpresa valor={empresaId} onChange={(id) => setBusca({ empresa: id || undefined })} />
          <div className="seg">
            <button className={modo === "excel" ? "on" : ""} onClick={() => setModo("excel")}>
              Ficha em Excel
            </button>
            <button className={modo === "documentos" ? "on" : ""} onClick={() => setModo("documentos")}>
              Documentos
            </button>
            <button className={modo === "manual" ? "on" : ""} onClick={() => setModo("manual")}>
              Em branco
            </button>
          </div>
        </div>

        {semEmpresa && <div className="vazio">Escolha a empresa que vai contratar.</div>}

        {!semEmpresa && modo === "excel" && (
          <div className="passos">
            <div className="passo">
              <b>1. Baixar a ficha</b>
              <p>Gera a ficha padrão com os dados de {empresa.razaoSocial}. Envie ao cliente para ele preencher uma linha por funcionário.</p>
              <button className="btn setor" onClick={baixarFicha} disabled={!!ocupado}>
                Baixar ficha em Excel
              </button>
            </div>
            <div className="passo">
              <b>2. Importar a ficha preenchida</b>
              <p>O sistema lê as linhas, confere CPF, datas e valores e mostra o que está pronto e o que precisa de ajuste.</p>
              <button className="btn" onClick={() => inputFicha.current?.click()} disabled={!!ocupado}>
                Escolher ficha preenchida…
              </button>
              <input ref={inputFicha} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => importarFicha(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {!semEmpresa && modo === "documentos" && (
          <div className="pad" style={{ display: "grid", gap: 12 }}>
            <div
              className={`soltar${arrastando ? " sobre" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
              role="button"
              tabIndex={0}
              onClick={() => inputDocs.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputDocs.current?.click()}
            >
              <b>Solte aqui os documentos de um funcionário</b>
              <span>RG, CNH, CPF, carteira de trabalho, comprovante de residência, ficha preenchida em qualquer modelo. Foto, PDF, Word ou planilha.</span>
              <span className="sub">ou clique para escolher · até 12 arquivos</span>
              <input
                ref={inputDocs}
                type="file"
                multiple
                accept={EXTENSOES_ACEITAS}
                hidden
                onChange={(e) => {
                  if (e.target.files) somarArquivos(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {escolhidos.length > 0 && (
              <>
                <ul className="lista-doc">
                  {escolhidos.map((f, i) => (
                    <li key={`${f.name}-${i}`}>
                      {f.name} <span className="sub">{(f.size / 1024).toFixed(0)} KB</span>{" "}
                      <button className="linkish" onClick={() => setEscolhidos((l) => l.filter((_, j) => j !== i))} aria-label={`Tirar ${f.name}`}>
                        tirar
                      </button>
                    </li>
                  ))}
                </ul>
                <div>
                  <button className="btn setor" onClick={lerDocumentos} disabled={!!ocupado}>
                    Ler documentos
                  </button>
                </div>
              </>
            )}
            <p className="note">
              Os arquivos são enviados ao Claude para leitura e não ficam guardados pelo sistema. Eles contêm dados pessoais (CPF, endereço, banco): use só com a autorização do cliente. O resultado
              é sempre um rascunho para você conferir.
            </p>
          </div>
        )}

        {!semEmpresa && modo === "manual" && (
          <div className="passos">
            <div className="passo">
              <b>Preencher à mão</b>
              <p>Abre a ficha em branco de {empresa.razaoSocial} para digitar os dados.</p>
              <button className="btn setor" onClick={abrirEmBranco}>
                Abrir ficha em branco
              </button>
            </div>
          </div>
        )}

        {ocupado && (
          <div className="aviso ok" style={{ margin: 12 }} role="status">
            <span className="girando" aria-hidden="true" /> {ocupado}
          </div>
        )}
        {erro && (
          <div className="aviso erro" style={{ margin: 12 }} role="alert">
            {erro}
          </div>
        )}
      </section>

      {rascunhos.length > 0 && (
        <section className="panel">
          <div className="barra">
            <b>Para conferir ({rascunhos.length})</b>
            {prontas.length > 0 &&
              (confirmandoLote ? (
                <>
                  <span>Gravar {prontas.length} admissão(ões) sem revisar uma a uma?</span>
                  <button className="fbtn" onClick={() => setConfirmandoLote(false)}>
                    Cancelar
                  </button>
                  <button className="btn verde" onClick={gravarEmLote}>
                    Gravar {prontas.length}
                  </button>
                </>
              ) : (
                <button className="fbtn" onClick={() => setConfirmandoLote(true)} disabled={!!ocupado}>
                  Gravar as {prontas.length} prontas
                </button>
              ))}
            <span className="cont">Ficam só nesta aba até você gravar ou descartar.</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Empresa</th>
                  <th>Origem</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rascunhos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="linkish" onClick={() => setAberto(r.id)}>
                        {r.rotulo}
                      </button>
                    </td>
                    <td>{nomeEmpresa(r.empresaId)}</td>
                    <td>{r.origem === "excel" ? "Ficha em Excel" : r.origem === "documentos" ? "Documentos" : "Em branco"}</td>
                    <td>
                      {r.pendencias.length > 0 ? (
                        <span className="tag vermelho" title={r.pendencias.join("; ")}>
                          {r.pendencias.length} pendência(s): {r.pendencias[0]}
                        </span>
                      ) : temDuvida(r) ? (
                        <span className="tag ambar">conferir campos</span>
                      ) : r.origem === "documentos" ? (
                        <span className="tag azul">revisar antes de gravar</span>
                      ) : (
                        <span className="tag verde">pronta</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="fbtn" onClick={() => setAberto(r.id)}>
                        Revisar
                      </button>{" "}
                      <button className="fbtn" onClick={() => removerRascunho(r.id)}>
                        Descartar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="note">
        <button className="linkish" onClick={() => navigate({ to: "/funcionarios", search: { empresa: empresaId } })}>
          Ver funcionários já cadastrados
        </button>
      </p>
    </>
  );
}
