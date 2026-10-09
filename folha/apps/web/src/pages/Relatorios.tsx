import { useQuery } from "@tanstack/react-query";
import { api, DEMO, type Calculo, type Relatorio } from "../api";
import { useBusca, type Busca } from "../busca";
import { Carregando, Erro, SeletorEmpresa } from "../components/ui";
import { useEstado } from "../estado";
import { brl, cnpjFmt, compCurta, compLonga, cpfFmt, dataBR, REGIMES } from "../fmt";

const RELS: { id: NonNullable<Busca["rel"]>; nome: string }[] = [
  { id: "recibo", nome: "Recibo de pagamento" },
  { id: "extrato", nome: "Extrato mensal" },
  { id: "liquidos", nome: "Relatório de líquidos" },
  { id: "encargos", nome: "Resumo de encargos" },
];

function Cabecalho({ r, titulo }: { r: Relatorio; titulo: string }) {
  return (
    <div className="rel-cab">
      <div>
        <h2>{r.empresa.razaoSocial}</h2>
        <div>
          CNPJ {cnpjFmt(r.empresa.cnpj)} · {REGIMES[r.empresa.regime]}
          {r.empresa.codigoDominio ? ` · Cód. ${r.empresa.codigoDominio}` : ""}
        </div>
      </div>
      <div className="dir">
        <b>{titulo}</b>
        <div>
          {r.tipo === "adiantamento" ? "Adiantamento" : "Folha mensal"} · competência {compCurta(r.competencia)}
        </div>
      </div>
    </div>
  );
}

function Recibo({ r, c }: { r: Relatorio; c: Calculo }) {
  const fgts = c.itens.find((i) => i.tipo === "informativa" && i.codigo === "950");
  return (
    <div className="recibo">
      <div className="rel-cab" style={{ marginBottom: 4 }}>
        <div>
          <b>{r.empresa.razaoSocial}</b>
          <div>CNPJ {cnpjFmt(r.empresa.cnpj)}</div>
        </div>
        <div className="dir">
          <b>Recibo de pagamento de salário</b>
          <div>
            {r.tipo === "adiantamento" ? "Adiantamento" : "Folha mensal"} · {compLonga(r.competencia)}
          </div>
        </div>
      </div>
      <div className="linha-func">
        <div>
          <small>Matrícula</small>
          {c.funcionario.matricula}
        </div>
        <div>
          <small>Nome</small>
          <b>{c.funcionario.nome}</b>
        </div>
        <div>
          <small>Cargo</small>
          {c.funcionario.cargo ?? "—"} {c.funcionario.cbo ? `(CBO ${c.funcionario.cbo})` : ""}
        </div>
        <div>
          <small>Admissão</small>
          {dataBR(c.funcionario.admissao)}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 50 }}>Cód.</th>
            <th>Descrição</th>
            <th className="num" style={{ width: 90 }}>
              Referência
            </th>
            <th className="num" style={{ width: 100 }}>
              Vencimentos
            </th>
            <th className="num" style={{ width: 100 }}>
              Descontos
            </th>
          </tr>
        </thead>
        <tbody>
          {c.itens
            .filter((i) => i.tipo !== "informativa")
            .map((i) => (
              <tr key={i.codigo}>
                <td className="num">{i.codigo}</td>
                <td>{i.descricao}</td>
                <td className="num">{i.referencia}</td>
                <td className="num">{i.tipo === "provento" ? brl(i.valor) : ""}</td>
                <td className="num">{i.tipo === "desconto" ? brl(i.valor) : ""}</td>
              </tr>
            ))}
          <tr className="tot">
            <td colSpan={3} style={{ textAlign: "right" }}>
              Totais
            </td>
            <td className="num">{brl(c.totalProventos)}</td>
            <td className="num">{brl(c.totalDescontos)}</td>
          </tr>
          <tr className="tot">
            <td colSpan={4} style={{ textAlign: "right" }}>
              Valor líquido
            </td>
            <td className="num">{brl(c.liquido)}</td>
          </tr>
        </tbody>
      </table>
      <div className="rodape">
        <div>
          <small>Salário base</small>
          {brl(c.funcionario.salario)}
        </div>
        <div>
          <small>Base INSS</small>
          {brl(c.baseInss)}
        </div>
        <div>
          <small>Base FGTS</small>
          {brl(c.baseFgts)}
        </div>
        <div>
          <small>FGTS do mês</small>
          {brl(fgts?.valor ?? c.fgts)}
        </div>
        <div>
          <small>Base IRRF</small>
          {brl(c.baseIrrf)}
        </div>
        <div>
          <small>Dias</small>
          {c.diasTrabalhados}
        </div>
      </div>
      <div className="assin">
        <span>Data: ____/____/______</span>
        <span>Assinatura do empregado</span>
      </div>
    </div>
  );
}

function Extrato({ r }: { r: Relatorio }) {
  return (
    <>
      <Cabecalho r={r} titulo="Extrato mensal" />
      {r.calculos.map((c) => (
        <div className="extrato-func" key={c.id}>
          <h4>
            {c.funcionario.matricula} · {c.funcionario.nome} — {c.funcionario.cargo ?? ""} · CPF {cpfFmt(c.funcionario.cpf)}
          </h4>
          <table>
            <tbody>
              {c.itens.map((i) => (
                <tr key={i.codigo}>
                  <td style={{ width: 50 }}>{i.codigo}</td>
                  <td>{i.descricao}</td>
                  <td className="num" style={{ width: 90 }}>
                    {i.referencia}
                  </td>
                  <td className="num" style={{ width: 100 }}>
                    {i.tipo === "provento" ? brl(i.valor) : ""}
                  </td>
                  <td className="num" style={{ width: 100 }}>
                    {i.tipo === "desconto" ? brl(i.valor) : i.tipo === "informativa" ? `(${brl(i.valor)})` : ""}
                  </td>
                </tr>
              ))}
              <tr className="tot">
                <td colSpan={3}>Líquido</td>
                <td className="num">{brl(c.totalProventos)}</td>
                <td className="num">{brl(c.liquido)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      <h4>Resumo por rubrica</h4>
      <table>
        <thead>
          <tr>
            <th>Cód.</th>
            <th>Rubrica</th>
            <th className="num">Func.</th>
            <th className="num">Proventos</th>
            <th className="num">Descontos</th>
          </tr>
        </thead>
        <tbody>
          {r.resumoRubricas.map((x) => (
            <tr key={x.codigo}>
              <td>{x.codigo}</td>
              <td>{x.descricao}</td>
              <td className="num">{x.quantidade}</td>
              <td className="num">{x.tipo === "provento" ? brl(x.valor) : ""}</td>
              <td className="num">{x.tipo === "desconto" ? brl(x.valor) : x.tipo === "informativa" ? `(${brl(x.valor)})` : ""}</td>
            </tr>
          ))}
          <tr className="tot">
            <td colSpan={3}>Totais · líquido R$ {brl(r.totais.liquido)}</td>
            <td className="num">{brl(r.totais.proventos)}</td>
            <td className="num">{brl(r.totais.descontos)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Liquidos({ r }: { r: Relatorio }) {
  return (
    <>
      <Cabecalho r={r} titulo="Relatório de líquidos" />
      <table>
        <thead>
          <tr>
            <th>Matr.</th>
            <th>Nome</th>
            <th>CPF</th>
            <th>Banco / agência / conta</th>
            <th>Pix</th>
            <th className="num">Líquido</th>
          </tr>
        </thead>
        <tbody>
          {r.calculos.map((c) => (
            <tr key={c.id}>
              <td>{c.funcionario.matricula}</td>
              <td>{c.funcionario.nome}</td>
              <td>{cpfFmt(c.funcionario.cpf)}</td>
              <td>{[c.funcionario.banco, c.funcionario.agencia, c.funcionario.conta].filter(Boolean).join(" / ") || "—"}</td>
              <td>{c.funcionario.pix ?? "—"}</td>
              <td className="num">{brl(c.liquido)}</td>
            </tr>
          ))}
          <tr className="tot">
            <td colSpan={5}>Total ({r.totais.funcionarios} funcionários)</td>
            <td className="num">{brl(r.totais.liquido)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Encargos({ r }: { r: Relatorio }) {
  const t = r.totais;
  const n = Number;
  const previdencia = n(t.inss) + n(t.cpp) + n(t.rat) + n(t.terceiros);
  const linhas: [string, string, string?][] = [
    ["Total de proventos", t.proventos],
    ["Base de cálculo do INSS", t.baseInss],
    ["INSS descontado dos segurados", t.inss],
    ["CPP patronal (20%)", t.cpp, r.empresa.regime === "simples" && !r.empresa.simplesAnexoIV ? "Simples Nacional: recolhida no DAS" : undefined],
    [`RAT ajustado (${(n(r.empresa.rat) * 100).toLocaleString("pt-BR")}% × FAP ${n(r.empresa.fap).toLocaleString("pt-BR")})`, t.rat],
    ["Outras entidades (terceiros)", t.terceiros],
    ["Total previdenciário estimado (DCTFWeb)", previdencia.toFixed(2)],
    ["Base de cálculo do FGTS", t.baseFgts],
    ["FGTS do mês (FGTS Digital)", t.fgts],
    ["Rendimentos tributáveis (IRRF)", t.baseIrrf],
    ["IRRF retido — código 0561 (DCTFWeb)", t.irrf],
  ];
  return (
    <>
      <Cabecalho r={r} titulo="Resumo de encargos" />
      <table style={{ maxWidth: 640 }}>
        <tbody>
          {linhas.map(([rot, v, obs]) => (
            <tr key={rot} className={rot.startsWith("Total previdenciário") ? "tot" : ""}>
              <td>
                {rot}
                {obs && <div style={{ fontSize: 10, color: "#666" }}>{obs}</div>}
              </td>
              <td className="num" style={{ width: 140 }}>
                {brl(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "#666", marginTop: 10 }}>
        Valores de conferência. Salário-família e deduções da DCTFWeb não estão abatidos. A apuração oficial continua sendo a do eSocial / DCTFWeb / FGTS
        Digital.
      </p>
    </>
  );
}

export function Relatorios() {
  const { competencia } = useEstado();
  const [busca, setBusca] = useBusca();
  const rel = busca.rel ?? "recibo";
  const tipo = busca.tipo ?? "mensal";
  const q = useQuery({
    queryKey: ["relatorio", busca.empresa, competencia, tipo],
    queryFn: () => api.get<Relatorio>(`/api/relatorios?empresaId=${busca.empresa}&competencia=${competencia}&tipo=${tipo}`),
    enabled: !!busca.empresa,
  });
  const r = q.data;

  return (
    <>
      <div className="titulo nao-imprime">
        <h1>Relatórios</h1>
        <small>{compLonga(competencia)}</small>
        <div className="acoes">
          {DEMO ? (
            <span className="note">Na versão instalada, o botão Imprimir gera o PDF destes relatórios.</span>
          ) : (
            <button className="btn" disabled={!r?.calculos.length} onClick={() => window.print()}>
              Imprimir / salvar PDF
            </button>
          )}
        </div>
      </div>
      <section className="panel nao-imprime">
        <div className="barra">
          <SeletorEmpresa valor={busca.empresa} onChange={(id) => setBusca({ empresa: id || undefined })} />
          <div className="seg">
            {RELS.map((x) => (
              <button key={x.id} className={rel === x.id ? "on" : ""} onClick={() => setBusca({ rel: x.id })}>
                {x.nome}
              </button>
            ))}
          </div>
          <div className="seg">
            <button className={tipo === "mensal" ? "on" : ""} onClick={() => setBusca({ tipo: "mensal" })}>
              Mensal
            </button>
            <button className={tipo === "adiantamento" ? "on" : ""} onClick={() => setBusca({ tipo: "adiantamento" })}>
              Adiantamento
            </button>
          </div>
        </div>
      </section>
      {!busca.empresa ? (
        <div className="panel vazio">Escolha a empresa.</div>
      ) : q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} />
      ) : !r?.calculos.length ? (
        <div className="panel vazio">Nada calculado nesta competência. Calcule a folha primeiro.</div>
      ) : (
        <div className="rel-papel">
          {rel === "recibo" && r.calculos.map((c) => <Recibo key={c.id} r={r} c={c} />)}
          {rel === "extrato" && <Extrato r={r} />}
          {rel === "liquidos" && <Liquidos r={r} />}
          {rel === "encargos" && <Encargos r={r} />}
        </div>
      )}
    </>
  );
}
