import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Cargo, type Funcionario } from "../api";
import { useBusca } from "../busca";
import { Campo, Carregando, Erro, useEmpresas } from "../components/ui";
import { useEstado } from "../estado";
import { cpfFmt } from "../fmt";

const NOVO: Partial<Funcionario> = {
  tipoContrato: "experiencia",
  categoria: "empregado",
  tipoSalario: "mensal",
  horasMensais: 220,
  dependentesIrrf: 0,
  filhosSalarioFamilia: 0,
  optaVt: false,
  vtValorMensal: "0",
  percentualAdiantamento: "0.40",
  admissao: new Date().toISOString().slice(0, 10),
};

export function FichaFuncionario() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const [busca] = useBusca();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { avisar } = useEstado();
  const empresas = useEmpresas();
  const cargos = useQuery({ queryKey: ["cargos"], queryFn: () => api.get<Cargo[]>("/api/cargos") });
  const atual = useQuery({
    queryKey: ["funcionario", id],
    queryFn: () => api.get<Funcionario>(`/api/funcionarios/${id}`),
    enabled: !!id,
  });
  const [f, setF] = useState<Partial<Funcionario>>(() => ({ ...NOVO, empresaId: busca.empresa }));
  const [novoCargo, setNovoCargo] = useState({ nome: "", cbo: "" });
  useEffect(() => {
    if (atual.data) setF(atual.data);
  }, [atual.data]);

  const set = <K extends keyof Funcionario>(k: K, v: Funcionario[K] | null) => setF((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof Funcionario) => ({
    value: (f[k] as string | number | null | undefined) ?? "",
    onChange: (ev: { target: { value: string } }) => set(k, (ev.target.value === "" ? null : ev.target.value) as never),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      let cargoId = f.cargoId;
      if (cargoId === "__novo") {
        const c = await api.post<Cargo>("/api/cargos", novoCargo);
        cargoId = c.id;
      }
      const corpo = { ...f, cargoId };
      return id ? api.put(`/api/funcionarios/${id}`, corpo) : api.post<Funcionario>("/api/funcionarios", corpo);
    },
    onSuccess: (r) => {
      qc.invalidateQueries();
      avisar(id ? "Cadastro atualizado" : `Admissão gravada — matrícula ${(r as Funcionario).matricula}`);
      navigate({ to: "/funcionarios", search: { empresa: f.empresaId } });
    },
    onError: (e) => avisar((e as Error).message, true),
  });

  if (id && atual.isLoading) return <Carregando />;
  if (atual.error) return <Erro erro={atual.error} />;
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    salvar.mutate();
  };

  return (
    <>
      <div className="titulo">
        <h1>{id ? f.nome : "Admissão de funcionário"}</h1>
        {id && (
          <small>
            Matrícula {f.matricula} · CPF {cpfFmt(f.cpf ?? "")}
          </small>
        )}
      </div>
      <form className="panel" onSubmit={enviar}>
        <div className="form-sec">
          <h3>Vínculo</h3>
          <div className="campos">
            <Campo rotulo="Empresa" largo>
              <select required value={f.empresaId ?? ""} onChange={(e) => set("empresaId", e.target.value)} disabled={!!id}>
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
            <Campo rotulo="Data de admissão">
              <input type="date" required {...txt("admissao")} />
            </Campo>
            <Campo rotulo="Tipo de contrato">
              <select value={f.tipoContrato} onChange={(e) => set("tipoContrato", e.target.value as Funcionario["tipoContrato"])}>
                <option value="experiencia">Experiência</option>
                <option value="indeterminado">Prazo indeterminado</option>
                <option value="determinado">Prazo determinado</option>
              </select>
            </Campo>
            <Campo rotulo="Categoria">
              <select value={f.categoria} onChange={(e) => set("categoria", e.target.value as Funcionario["categoria"])}>
                <option value="empregado">Empregado (101)</option>
                <option value="aprendiz">Aprendiz (103)</option>
              </select>
            </Campo>
            <Campo rotulo="Cargo">
              <select value={f.cargoId ?? ""} onChange={(e) => set("cargoId", e.target.value || null)}>
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
                <Campo rotulo="CBO">
                  <input className="mono" value={novoCargo.cbo} onChange={(e) => setNovoCargo({ ...novoCargo, cbo: e.target.value })} />
                </Campo>
              </>
            )}
            <Campo rotulo="Departamento">
              <input {...txt("departamento")} />
            </Campo>
            <Campo rotulo="Data de demissão">
              <input type="date" {...txt("demissao")} />
            </Campo>
          </div>
        </div>

        <div className="form-sec">
          <h3>Dados pessoais</h3>
          <div className="campos">
            <Campo rotulo="Nome completo" largo>
              <input required {...txt("nome")} />
            </Campo>
            <Campo rotulo="CPF">
              <input required className="mono" {...txt("cpf")} />
            </Campo>
            <Campo rotulo="PIS/NIS">
              <input className="mono" {...txt("pis")} />
            </Campo>
            <Campo rotulo="Data de nascimento">
              <input type="date" {...txt("dataNascimento")} />
            </Campo>
            <Campo rotulo="Sexo">
              <select value={f.sexo ?? ""} onChange={(e) => set("sexo", (e.target.value || null) as Funcionario["sexo"])}>
                <option value="">—</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </Campo>
            <Campo rotulo="E-mail">
              <input type="email" {...txt("email")} />
            </Campo>
            <Campo rotulo="Telefone">
              <input {...txt("telefone")} />
            </Campo>
            <Campo rotulo="Endereço" largo>
              <input {...txt("endereco")} />
            </Campo>
          </div>
        </div>

        <div className="form-sec">
          <h3>Remuneração e jornada</h3>
          <div className="campos">
            <Campo rotulo="Tipo de salário">
              <select value={f.tipoSalario} onChange={(e) => set("tipoSalario", e.target.value as Funcionario["tipoSalario"])}>
                <option value="mensal">Mensalista</option>
                <option value="horista">Horista</option>
              </select>
            </Campo>
            <Campo rotulo={f.tipoSalario === "horista" ? "Valor da hora (R$)" : "Salário mensal (R$)"}>
              <input required className="mono" inputMode="decimal" {...txt("salario")} />
            </Campo>
            <Campo rotulo="Horas mensais">
              <input type="number" min={1} max={220} {...txt("horasMensais")} />
            </Campo>
            <Campo rotulo="Jornada / escala">
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
            <Campo rotulo="Dependentes para IRRF">
              <input type="number" min={0} {...txt("dependentesIrrf")} />
            </Campo>
            <Campo rotulo="Filhos para salário-família (até 14 anos)">
              <input type="number" min={0} {...txt("filhosSalarioFamilia")} />
            </Campo>
            <label className="chk" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" checked={!!f.optaVt} onChange={(e) => set("optaVt", e.target.checked)} />
              Opta por vale-transporte
            </label>
            {f.optaVt && (
              <Campo rotulo="Custo mensal do VT (R$)">
                <input className="mono" inputMode="decimal" {...txt("vtValorMensal")} />
              </Campo>
            )}
          </div>
        </div>

        <div className="form-sec">
          <h3>Dados bancários</h3>
          <div className="campos">
            <Campo rotulo="Banco">
              <input {...txt("banco")} />
            </Campo>
            <Campo rotulo="Agência">
              <input className="mono" {...txt("agencia")} />
            </Campo>
            <Campo rotulo="Conta">
              <input className="mono" {...txt("conta")} />
            </Campo>
            <Campo rotulo="Chave Pix">
              <input {...txt("pix")} />
            </Campo>
          </div>
        </div>

        <div className="form-acoes">
          <span className="note esq">eSocial (S-2200) fica para a fase 3: aqui grava só o cadastro interno.</span>
          <Link className="fbtn" to="/funcionarios" search={{ empresa: f.empresaId }}>
            Cancelar
          </Link>
          <button className="btn verde" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : id ? "Salvar alterações" : "Gravar admissão"}
          </button>
        </div>
      </form>
    </>
  );
}
