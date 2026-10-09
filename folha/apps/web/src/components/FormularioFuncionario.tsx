import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Cargo, type Funcionario, type Nota } from "../api";
import { useEstado } from "../estado";
import { norm } from "../fmt";
import { Campo, NotasCtx, useEmpresas } from "./ui";

/** Dados iniciais: o funcionário, ou um rascunho lido de ficha/documentos (cargo e CBO chegam como texto). */
export type DadosFuncionario = Partial<Funcionario> & { cargo?: string | null; cbo?: string | null };

interface Props {
  /** Presente ao editar um funcionário já gravado. */
  id?: string;
  inicial: DadosFuncionario;
  notas?: Record<string, Nota>;
  textoSalvar?: string;
  /** Texto que acompanha o botão (ex.: lembrete sobre o eSocial). */
  rodape?: string;
  onSalvo: (f: Funcionario) => void;
  onCancelar: () => void;
}

export function FormularioFuncionario({ id, inicial, notas: notasIniciais, textoSalvar, rodape, onSalvo, onCancelar }: Props) {
  const qc = useQueryClient();
  const { avisar } = useEstado();
  const empresas = useEmpresas();
  const cargos = useQuery({ queryKey: ["cargos"], queryFn: () => api.get<Cargo[]>("/api/cargos") });
  const [f, setF] = useState<DadosFuncionario>(inicial);
  const [notas, setNotas] = useState(notasIniciais ?? {});
  const [novoCargo, setNovoCargo] = useState({ nome: "", cbo: "" });

  // Cargo lido como texto: usa o do cadastro se já existe; senão deixa "Novo cargo" preenchido.
  useEffect(() => {
    if (!cargos.data || f.cargoId || !inicial.cargo) return;
    const achado = cargos.data.find((c) => norm(c.nome) === norm(inicial.cargo!));
    if (achado) setF((x) => ({ ...x, cargoId: achado.id }));
    else {
      setF((x) => ({ ...x, cargoId: "__novo" }));
      setNovoCargo({ nome: inicial.cargo!.toUpperCase(), cbo: inicial.cbo ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargos.data]);

  /** Alterar um campo é confirmá-lo: a marca de "lido de…" some. */
  const set = <K extends keyof DadosFuncionario>(k: K, v: DadosFuncionario[K] | null, chaveNota?: string) => {
    setF((x) => ({ ...x, [k]: v }));
    const n = chaveNota ?? String(k);
    setNotas((atual) => {
      if (!atual[n]) return atual;
      const { [n]: _, ...resto } = atual;
      return resto;
    });
  };
  const txt = (k: keyof DadosFuncionario) => ({
    value: (f[k] as string | number | null | undefined) ?? "",
    onChange: (ev: { target: { value: string } }) => set(k, (ev.target.value === "" ? null : ev.target.value) as never),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      let cargoId = f.cargoId;
      if (cargoId === "__novo") cargoId = (await api.post<Cargo>("/api/cargos", novoCargo)).id;
      const corpo = { ...f, cargoId };
      return id ? api.put<Funcionario>(`/api/funcionarios/${id}`, corpo) : api.post<Funcionario>("/api/funcionarios", corpo);
    },
    onSuccess: (r) => {
      qc.invalidateQueries();
      onSalvo(r);
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    salvar.mutate();
  };

  return (
    <NotasCtx.Provider value={{ notas, confirmar: (chave) => setNotas(({ [chave]: _, ...resto }) => resto) }}>
      <form className="panel" onSubmit={enviar}>
        <div className="form-sec">
          <h3>Vínculo</h3>
          <div className="campos">
            <Campo rotulo="Empresa" largo>
              <select required value={f.empresaId ?? ""} onChange={(e) => set("empresaId", e.target.value)} disabled={!!id || !!inicial.empresaId}>
                <option value="">Escolha…</option>
                {(empresas.data ?? [])
                  .filter((e) => e.ativa)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razaoSocial}
                    </option>
                  ))}
              </select>
            </Campo>
            <Campo rotulo="Data de admissão" campo="admissao">
              <input type="date" required {...txt("admissao")} />
            </Campo>
            <Campo rotulo="Tipo de contrato" campo="tipoContrato">
              <select value={f.tipoContrato} onChange={(e) => set("tipoContrato", e.target.value as Funcionario["tipoContrato"])}>
                <option value="experiencia">Experiência</option>
                <option value="indeterminado">Prazo indeterminado</option>
                <option value="determinado">Prazo determinado</option>
              </select>
            </Campo>
            <Campo rotulo="Categoria" campo="categoria">
              <select value={f.categoria} onChange={(e) => set("categoria", e.target.value as Funcionario["categoria"])}>
                <option value="empregado">Empregado (101)</option>
                <option value="aprendiz">Aprendiz (103)</option>
              </select>
            </Campo>
            <Campo rotulo="Cargo" campo="cargo">
              <select value={f.cargoId ?? ""} onChange={(e) => set("cargoId", e.target.value || null, "cargo")}>
                <option value="">—</option>
                {(cargos.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.cbo ? ` (CBO ${c.cbo})` : ""}
                  </option>
                ))}
                <option value="__novo">+ Novo cargo…</option>
              </select>
            </Campo>
            {f.cargoId === "__novo" && (
              <>
                <Campo rotulo="Nome do novo cargo">
                  <input required value={novoCargo.nome} onChange={(e) => setNovoCargo({ ...novoCargo, nome: e.target.value })} />
                </Campo>
                <Campo rotulo="CBO" campo="cbo">
                  <input className="mono" value={novoCargo.cbo} onChange={(e) => setNovoCargo({ ...novoCargo, cbo: e.target.value })} />
                </Campo>
              </>
            )}
            <Campo rotulo="Departamento" campo="departamento">
              <input {...txt("departamento")} />
            </Campo>
            {id && (
              <Campo rotulo="Data de demissão">
                <input type="date" {...txt("demissao")} />
              </Campo>
            )}
          </div>
        </div>

        <div className="form-sec">
          <h3>Dados pessoais</h3>
          <div className="campos">
            <Campo rotulo="Nome completo" largo campo="nome">
              <input required {...txt("nome")} />
            </Campo>
            <Campo rotulo="CPF" campo="cpf">
              <input required className="mono" {...txt("cpf")} />
            </Campo>
            <Campo rotulo="PIS/NIS" campo="pis">
              <input className="mono" {...txt("pis")} />
            </Campo>
            <Campo rotulo="Data de nascimento" campo="dataNascimento">
              <input type="date" {...txt("dataNascimento")} />
            </Campo>
            <Campo rotulo="Sexo" campo="sexo">
              <select value={f.sexo ?? ""} onChange={(e) => set("sexo", (e.target.value || null) as Funcionario["sexo"])}>
                <option value="">—</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </Campo>
            <Campo rotulo="E-mail" campo="email">
              <input type="email" {...txt("email")} />
            </Campo>
            <Campo rotulo="Telefone" campo="telefone">
              <input {...txt("telefone")} />
            </Campo>
            <Campo rotulo="Endereço" largo campo="endereco">
              <input {...txt("endereco")} />
            </Campo>
          </div>
        </div>

        <div className="form-sec">
          <h3>Remuneração e jornada</h3>
          <div className="campos">
            <Campo rotulo="Tipo de salário" campo="tipoSalario">
              <select value={f.tipoSalario} onChange={(e) => set("tipoSalario", e.target.value as Funcionario["tipoSalario"])}>
                <option value="mensal">Mensalista</option>
                <option value="horista">Horista</option>
              </select>
            </Campo>
            <Campo rotulo={f.tipoSalario === "horista" ? "Valor da hora (R$)" : "Salário mensal (R$)"} campo="salario">
              <input required className="mono" inputMode="decimal" {...txt("salario")} />
            </Campo>
            <Campo rotulo="Horas mensais" campo="horasMensais">
              <input type="number" min={1} max={220} {...txt("horasMensais")} />
            </Campo>
            <Campo rotulo="Jornada / escala" campo="jornada">
              <input placeholder="08:00–17:00 ou 12x36" {...txt("jornada")} />
            </Campo>
            <Campo rotulo="Adiantamento (fração do salário)">
              <input className="mono" placeholder="0,40" {...txt("percentualAdiantamento")} />
            </Campo>
          </div>
        </div>

        <div className="form-sec">
          <h3>Dependentes e benefícios</h3>
          <div className="campos">
            <Campo rotulo="Dependentes para IRRF" campo="dependentesIrrf">
              <input type="number" min={0} {...txt("dependentesIrrf")} />
            </Campo>
            <Campo rotulo="Filhos para salário-família (até 14 anos)" campo="filhosSalarioFamilia">
              <input type="number" min={0} {...txt("filhosSalarioFamilia")} />
            </Campo>
            <label className="chk" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" checked={!!f.optaVt} onChange={(e) => set("optaVt", e.target.checked)} />
              Opta por vale-transporte
            </label>
            {f.optaVt && (
              <Campo rotulo="Custo mensal do VT (R$)" campo="vtValorMensal">
                <input className="mono" inputMode="decimal" {...txt("vtValorMensal")} />
              </Campo>
            )}
          </div>
        </div>

        <div className="form-sec">
          <h3>Dados bancários</h3>
          <div className="campos">
            <Campo rotulo="Banco" campo="banco">
              <input {...txt("banco")} />
            </Campo>
            <Campo rotulo="Agência" campo="agencia">
              <input className="mono" {...txt("agencia")} />
            </Campo>
            <Campo rotulo="Conta" campo="conta">
              <input className="mono" {...txt("conta")} />
            </Campo>
            <Campo rotulo="Chave Pix" campo="pix">
              <input {...txt("pix")} />
            </Campo>
          </div>
        </div>

        <div className="form-acoes">
          {rodape && <span className="note esq">{rodape}</span>}
          <button type="button" className="fbtn" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn verde" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : (textoSalvar ?? "Salvar")}
          </button>
        </div>
      </form>
    </NotasCtx.Provider>
  );
}
