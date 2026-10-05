# Control Hub (ControlTax) — preferências do projeto

Painel interno da ControlTax. Arquivos: `index.html` (tudo), `portal.html` (Portal do Cliente) e `importador.js` (ferramenta Importador Domínio do DP, carregada sob demanda). Responder sempre em português.

## Design (preferências da usuária)
- **Nada de formas arredondadas demais.** Cantos retos ou quase retos: 3–4px em chips, etiquetas, botões, cartões, avatares e blocos; até 6px só em janelas grandes. Sem pílulas (raio 999px/14px+). Círculo só onde é semanticamente um ponto ou gráfico (pontos de status, anéis de progresso, rosca).
- **Paleta da marca ControlTax:** vermelho (`--brand-red`) e azul (`--blue-deep`, `--blue-mid`). Evitar tons amarelados/alaranjados e roxo; "vencendo" usa o vermelho-coral `--cv-soon`. Verde só para "em dia/ok".
- **Minimalista e enxuto:** menos caixas, bordas e ícones decorativos; textos nunca cortados com "…" (quebrar linha); rolagem sutil quando a lista é longa.
- **Janelas (dialogs) com título:** título fixo no topo, botões (Excluir / Fechar / Salvar) fixos no rodapé, só o miolo rola. Vale para todas as janelas do mesmo tipo.
- Telas de consulta são somente leitura; edição fica no cadastro, e clicar no nome leva ao cadastro.
- Sem rolagem horizontal da página em 390–1500px; testar claro e escuro.

## Dados
- **Filial** = empresa com CNPJ de 14 posições cuja ordem (9ª a 12ª) não é 0001 (`ehFilial`). Sempre que exibir o nome de uma empresa em HTML, usar `nomeEmpHtml(e)` para mostrar a marcação discreta “filial”.

## Fluxo de trabalho
- Testar com Playwright (servidor `python3 -m http.server 8765`, pdf.js servido localmente) antes de publicar.
- Commit + push e publicar sempre no mesmo artefato: https://claude.ai/artifact/SGDHdEfbJi2qBjfNRo3vXS (`index.html` + `portal.html` + `importador.js`).
- Aplicar as melhorias direto, sem pedir permissão a cada passo.

## Ferramentas (DP)
- `importador.js` é gerado por `scratchpad/imp/build.sh` a partir de `head.js` + `core.js` (saída de `port.py`, que porta o gerador original) + `tail.js`. Editar as partes, nunca o arquivo final. Começa com BOM UTF-8, porque é servido sem charset.
- Bibliotecas pesadas (SheetJS, pdf.js) vêm do cdnjs sob demanda, nunca embutidas.
- A regra de negócio do gerador não muda: há teste de regressão byte a byte contra o HTML original (`scratchpad/imp/reg.js`).
