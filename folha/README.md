# Folha ControlTax

Sistema de folha de pagamento próprio da ControlTax. É o primeiro passo para substituir o **Domínio** no escritório, começando pelo módulo Folha/DP.

> **Status: protótipo navegável.** Já calcula a folha mensal e o adiantamento com as tabelas de 2026, emite os relatórios e importa cadastros exportados do Domínio. Ainda **não** substitui o Domínio em produção: faltam férias, 13º, rescisão e eSocial (veja o roteiro abaixo).

## Como rodar

Requer Node 22+. Não precisa instalar banco de dados: em desenvolvimento a API usa o **PGlite**, um PostgreSQL embutido, e grava em `folha/.data/`.

```bash
cd folha
npm install
npm run dev        # API em :3333 + tela em http://localhost:5173
```

Na primeira execução, o banco vazio recebe dados de exemplo: 3 empresas fictícias, 15 funcionários e os lançamentos da competência anterior.

Para produção, compile e sirva tudo pela API:

```bash
npm run build
DATABASE_URL=postgres://usuario:senha@host/folha npm start   # tela + API em :3333
```

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL de produção. Sem ela, usa o PGlite. |
| `PGLITE_DIR` | Pasta do PGlite. Padrão: `folha/.data/pglite`. |
| `PORT` / `HOST` | Endereço do servidor. Padrão: `127.0.0.1:3333`. |
| `SEM_EXEMPLOS=1` | Não grava dados de exemplo em banco vazio. |
| `ANTHROPIC_API_KEY` | Chave da API do Claude, usada só na leitura de documentos da admissão. Sem ela, o resto do sistema funciona normalmente. |
| `ADMISSAO_MODELO` | Modelo que lê os documentos. Padrão `claude-opus-5-5`; dá para trocar por um mais barato (ex.: `claude-sonnet-5-5`) depois de comparar a qualidade nos documentos de vocês. |

### Testes

```bash
npm test            # motor de cálculo (casos-ouro) + API (PGlite em memória)
npm run typecheck
```

## Estrutura

```
folha/
├── packages/calculo   Motor de cálculo puro (sem banco): INSS, IRRF, FGTS, DSR,
│                      salário-família, VT, adiantamento. Usa decimal.js, nunca float.
├── apps/api           Fastify + Drizzle ORM + PostgreSQL/PGlite. Cadastros, lançamentos,
│                      cálculo em lote, fechamento, relatórios, importação, auditoria.
└── apps/web           React + Vite. Mesma identidade visual do Control Hub.
```

### Como a tela se organiza

A entrada é uma tela com poucos botões grandes, só com o que é rotina: **Admissão, Rescisão, Férias, Folha e Afastamentos**. O botão **Outros** reúne todo o resto (empresas, funcionários, rubricas, importação do Domínio e tabelas legais). Admissão e Folha já funcionam. Rescisão, Férias e Afastamentos aparecem como "Em breve", com a descrição do que vão cobrir, e entram na fase 1. Dentro de cada seção o topo mostra só as abas dela, com o atalho "‹ Início".

### Admissão: duas formas de começar

As duas terminam no mesmo lugar: um **rascunho para conferir**. Nada é gravado sozinho.

1. **Ficha em Excel padrão.** O sistema gera a ficha da empresa (com o CNPJ no título e uma aba de instruções). O cliente preenche uma linha por funcionário e devolve; a analista importa. O sistema confere CPF, datas e valores, recusa a ficha de outra empresa e separa as linhas **prontas** das que têm **pendência**. As prontas podem ser gravadas em lote; as demais abrem na ficha para ajuste.
2. **Documentos soltos.** A analista solta fotos (RG, CNH, carteira de trabalho, comprovantes), PDF, Word, planilha ou uma ficha fora do padrão. O Claude lê, e o resultado entra na ficha de admissão como rascunho. Cada campo mostra **de qual arquivo veio** e a **confiança** (amarelo = confira, vermelho = dúvida ou erro). Datas conflitantes entre documentos, CPF ou PIS com dígito inválido e documentos ilegíveis são apontados. O botão "confere" tira a marca de um campo; editar o campo também tira. Dados que o cadastro ainda não tem (RG, nome da mãe) aparecem à parte, para uso no eSocial.

Formatos aceitos nos documentos: JPG, PNG, WebP, GIF, PDF, Word (.docx), planilhas (.xlsx, .xls, .csv) e .txt. Não são lidos: foto HEIC do iPhone (converter para JPG) e Word antigo (.doc). Até 12 arquivos de **um** funcionário por vez; PDF até 20 MB.

**Antes de usar com cliente de verdade:**

- Os arquivos são enviados à API da Anthropic para leitura (nada fica guardado por este sistema; a auditoria registra só os nomes dos arquivos). Eles têm CPF, endereço e dados bancários: confirme o contrato com a Anthropic, a base legal e a autorização do cliente (LGPD).
- A leitura **erra**: letra manuscrita ruim, foto torta e documento cortado dão dúvida. Por isso a conferência é obrigatória e o sistema marca o que está duvidoso. Meça a qualidade com uma amostra de documentos reais antes de confiar.
- O custo é por leitura e depende do modelo e do número de páginas.
- Os rascunhos ficam só na aba do navegador, até serem gravados ou descartados.
- Esta parte foi testada com a resposta do Claude simulada. A leitura de verdade só se confirma no primeiro teste com a chave real e documentos de vocês.

### O que está pronto

- **Painel da competência:** situação de cada empresa (aberta, em lançamento, calculada, fechada) e cálculo em lote.
- **Empresas:** regime, FPAS, RAT/FAP, terceiros, sindicato, responsável e código no Domínio.
- **Funcionários:** lista, ficha e admissão completa (ficha em Excel, documentos ou em branco), com CPF validado e matrícula sequencial.
- **Rubricas:** os "eventos" do Domínio, com incidências de INSS, FGTS, IRRF e DSR. As rubricas do sistema ficam protegidas.
- **Lançamentos:** grade funcionário × rubrica para horas extras, faltas, adicional noturno, comissões etc.
- **Cálculo:**
  - folha mensal e adiantamento, com conferência por funcionário e avisos;
  - fechar ou reabrir a competência (fechada bloqueia lançamentos e recálculo).
- **Relatórios:** recibo de pagamento (2 por página A4), extrato mensal, relatório de líquidos e resumo de encargos. O botão *Imprimir / salvar PDF* gera o PDF.
- **Importação do Domínio:** planilha (Excel/CSV) de empregados ou de empresas, com prévia "novo / alterado / revisar" antes de gravar.
- **Tabelas legais:** versionadas por vigência, junto com a trilha de auditoria (quem fez o quê).

### Regras de cálculo (2026)

- **INSS:** progressivo por faixa (Portaria Interministerial MPS/MF nº 13/2026), com teto de R$ 8.475,55. O arredondamento é feito no total.
- **IRRF:**
  - Calcula pelas deduções legais (INSS + dependentes de R$ 189,59) e pelo desconto simplificado (R$ 607,20), e fica com o menor.
  - Depois aplica a **redução da Lei 15.270/2025**: até R$ 5.000 de rendimentos o imposto zera; até R$ 7.350 a redução é R$ 978,62 − 0,133145 × rendimentos.
  - A faixa é testada sobre os rendimentos tributáveis brutos.
- **FGTS:** 8%, ou 2% para aprendiz.
- **DSR sobre variáveis:** soma das variáveis ÷ dias úteis × domingos e feriados nacionais do mês.
- **Encargos patronais:** CPP de 20%, RAT × FAP e terceiros. Empresas do Simples (fora do anexo IV) não recolhem esses encargos na folha.
- **Proporcionalidade:** mês comercial de 30 dias na admissão.

As tabelas ficam em `packages/calculo/src/tabelas.ts` e são copiadas para o banco (`tabelas_legais`). **Sempre que sair norma nova, conferir na fonte oficial** e criar uma vigência nova; nunca editar a anterior.

## Importação do Domínio: o que precisamos do escritório

O reconhecimento de colunas usa os nomes mais comuns dos relatórios do Domínio (Código, Nome, CPF, PIS, Admissão, Cargo, CBO, Salário…). Para fechar o layout definitivo, precisamos de **exemplos reais exportados do Domínio Folha**:

1. relação de empregados (com salário, cargo, dependentes);
2. relação de empresas;
3. histórico de salários e férias (para a fase 2).

Com esses arquivos ajustamos os apelidos em `apps/api/src/servicos/importacao.ts`.

## Roteiro

| Fase | Entrega |
|---|---|
| **0 — protótipo** (atual) | Cadastros, folha mensal, adiantamento, relatórios, importação básica |
| 1 | Férias, 13º (1ª/2ª parcela), rescisão (TRCT), afastamentos, pensão, consignado |
| 2 | Importação completa do Domínio + **paralelo**: rodar junto com o Domínio e comparar empresa a empresa |
| 3 | eSocial (tabelas S-1000…, não periódicos S-2200/2299, periódicos S-1200/1210/1299) com certificado A1, conferência de DCTFWeb e FGTS Digital |
| 4 | Hospedagem com backup e perfis de acesso, integração com Portal do Cliente/Onvio, Gestta e Control Hub |

## Demonstração (artefato)

`npm run build:artefato -w @folha/web` gera uma página única (`apps/web/dist-artefato/folha-controltax.html`) para publicar como artefato no claude.ai. Nessa versão a API roda no próprio navegador (`apps/web/src/demo/servidor.ts`). Ela usa o mesmo motor de cálculo, as mesmas validações (`apps/api/src/esquemas.ts`), as mesmas regras de importação (`apps/api/src/servicos/importacao-regras.ts`) e os mesmos dados de exemplo (`apps/api/src/dados-exemplo.ts`) da versão instalada. Os dados ficam só no navegador de quem abre, e a impressão em PDF fica desativada, porque a moldura do artefato não permite imprimir.

## Ligação com o Control Hub

O Hub (`../index.html`) lê os blocos de ferramentas do banco compartilhado. Quando a Folha estiver publicada num endereço fixo, basta cadastrar no Hub uma ferramenta "Folha de Pagamento" com esse endereço. Não é preciso alterar código.

## Observações técnicas

- A leitura de documentos usa o Claude pelo servidor (`apps/api/src/servicos/extracao.ts`, saída estruturada com esquema). No artefato de demonstração ela usa o Claude do próprio visualizador (capacidade `sample`), e o PDF é convertido em imagens no navegador porque essa capacidade só recebe imagens. As regras (campos, ficha em Excel, normalização e conferência) ficam em `apps/api/src/admissao-regras.ts`, usadas pelos dois lados.
- A planilha é lida no navegador com SheetJS 0.18.5 (a mesma versão do `contabil.html`), carregado só na tela de importação. Antes de produção, trocar pela versão atual distribuída pelo próprio SheetJS.
- Migrations do banco ficam em `apps/api/drizzle/`. Depois de alterar `apps/api/src/db/schema.ts`, rode `npm run db:generate -w @folha/api`.
- Todo dinheiro é `numeric(14,2)` no banco e `decimal.js` no cálculo.
