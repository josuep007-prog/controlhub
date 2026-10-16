import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { api, type Funcionario } from "../api";
import { FormularioFuncionario } from "../components/FormularioFuncionario";
import { Carregando, Erro } from "../components/ui";
import { useEstado } from "../estado";
import { cpfFmt } from "../fmt";

/** Ficha de um funcionário já cadastrado. A admissão nova fica em /admissao. */
export function FichaFuncionario() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const { avisar } = useEstado();
  const q = useQuery({ queryKey: ["funcionario", id], queryFn: () => api.get<Funcionario>(`/api/funcionarios/${id}`) });
  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <Erro erro={q.error} />;
  const voltar = () => navigate({ to: "/funcionarios", search: { empresa: q.data!.empresaId } });
  return (
    <>
      <div className="titulo">
        <h1>{q.data.nome}</h1>
        <small>
          Matrícula {q.data.matricula} · CPF {cpfFmt(q.data.cpf)}
        </small>
      </div>
      <FormularioFuncionario
        id={id}
        inicial={q.data}
        textoSalvar="Salvar alterações"
        onCancelar={voltar}
        onSalvo={() => {
          avisar("Cadastro atualizado");
          voltar();
        }}
      />
    </>
  );
}
