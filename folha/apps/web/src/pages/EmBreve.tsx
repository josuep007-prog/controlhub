import { Link } from "@tanstack/react-router";

interface Props {
  titulo: string;
  resumo: string;
  itens: string[];
}

function EmBreve({ titulo, resumo, itens }: Props) {
  return (
    <>
      <div className="titulo">
        <h1>{titulo}</h1>
        <span className="tag ambar">Em breve</span>
      </div>
      <section className="panel pad" style={{ maxWidth: 720 }}>
        <p style={{ margin: "0 0 12px" }}>{resumo}</p>
        <h3 className="sec">O que vai cobrir</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          {itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="note" style={{ marginTop: 14 }}>
          Esta rotina entra na fase 1 do roteiro, depois que a folha mensal estiver validada em paralelo com o Domínio.
        </p>
        <p style={{ margin: "14px 0 0" }}>
          <Link className="fbtn" to="/">
            ‹ Voltar ao início
          </Link>
        </p>
      </section>
    </>
  );
}

export const Rescisao = () => (
  <EmBreve
    titulo="Rescisão"
    resumo="Cálculo do desligamento do funcionário, do aviso prévio até a guia do FGTS."
    itens={[
      "Tipos de desligamento: sem justa causa, pedido de demissão, justa causa, acordo e término de contrato",
      "Aviso prévio trabalhado ou indenizado, com os dias proporcionais ao tempo de casa",
      "Saldo de salário, 13º e férias vencidas e proporcionais com o terço constitucional",
      "Multa de 40% do FGTS e guia rescisória",
      "Termo de rescisão (TRCT) para imprimir e evento de desligamento do eSocial (S-2299)",
    ]}
  />
);

export const Ferias = () => (
  <EmBreve
    titulo="Férias"
    resumo="Programação e cálculo das férias, com o recibo e o aviso para o funcionário."
    itens={[
      "Períodos aquisitivos e concessivos, com alerta de férias vencendo",
      "Gozo integral, em até três períodos ou com abono pecuniário",
      "Cálculo com o terço constitucional, média de variáveis e descontos de INSS e IRRF",
      "Pagamento até dois dias antes do início, com recibo e aviso de férias",
      "Reflexo na folha do mês e no 13º",
    ]}
  />
);

export const Afastamentos = () => (
  <EmBreve
    titulo="Afastamentos"
    resumo="Registro dos períodos em que o funcionário não trabalha, com o reflexo na folha."
    itens={[
      "Doença e acidente de trabalho: 15 dias pela empresa e o restante pelo INSS",
      "Licença-maternidade e paternidade",
      "Faltas justificadas, licenças e suspensões",
      "Dias afastados descontados do salário e das bases de INSS e FGTS",
      "Evento de afastamento temporário do eSocial (S-2230)",
    ]}
  />
);
