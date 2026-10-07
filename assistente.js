/* Tax, o assistente do Control Hub: mascote que passeia pela tela + conversa.
   Carregado pelo index.html (window.__hubApi). Cada módulo responde por window.__assistente (ver fiscal.html etc.).
   O entendimento das frases é feito aqui mesmo, por regras do domínio (sem IA e sem custo). */
(function () {
  "use strict";
  var H = window.__hubApi;
  if (!H || window.__assistenteHub) return;
  var doc = document;
  var MODN = {dp: "DP", contabil: "Contábil", fiscal: "Fiscal", portal: "Portal do Cliente", cardapio: "Cardápio"};

  /* ============ utilidades ============ */
  function $(s, r) { return (r || doc).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\/\-\s]/g, " ").replace(/\s+/g, " ").trim(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function hoje() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dm(d) { return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1); }
  var SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var MESES_N = MESES.map(norm);
  var reduzido = function () { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var PREF = "tx-prefs-v1";
  function lerPref() { try { return JSON.parse(localStorage.getItem(PREF) || "{}"); } catch (e) { return {}; } }
  function salvarPref(o) { try { localStorage.setItem(PREF, JSON.stringify(Object.assign(lerPref(), o))); } catch (e) {} }

  /* ============ períodos ============ */
  function mesInteiro(y, m) { return {de: new Date(y, m, 1), ate: new Date(y, m + 1, 0)}; }
  function rotPeriodo(p) {
    var h = hoje(), n = Math.round((p.de - h) / 864e5);
    if (+p.de === +p.ate) return n === 0 ? "hoje" : n === 1 ? "amanhã" : n === -1 ? "ontem" : SEM[p.de.getDay()] + ", " + dm(p.de);
    return "de " + dm(p.de) + " a " + dm(p.ate);
  }
  // Devolve {de, ate} ou null quando a frase não fala de datas.
  function periodo(t) {
    var h = hoje(), m, r;
    if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t))) {
      var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : h.getFullYear(), d = new Date(y, +m[2] - 1, +m[1]);
      if (!isNaN(d)) return {de: d, ate: d};
    }
    if ((m = /\bdia (\d{1,2})\b/.exec(t)) && +m[1] >= 1 && +m[1] <= 31) { var d2 = new Date(h.getFullYear(), h.getMonth(), +m[1]); return {de: d2, ate: d2}; }
    if (/\bdepois de amanha\b/.test(t)) return {de: addDias(h, 2), ate: addDias(h, 2)};
    if (/\bamanha\b/.test(t)) return {de: addDias(h, 1), ate: addDias(h, 1)};
    if (/\bontem\b/.test(t)) return {de: addDias(h, -1), ate: addDias(h, -1)};
    if (/\b(semana que vem|proxima semana|semana seguinte)\b/.test(t)) { var seg = addDias(h, ((8 - h.getDay()) % 7) || 7); return {de: seg, ate: addDias(seg, 6)}; }
    if ((m = /\b(?:proximos|proximas|em|nos proximos) (\d{1,3}) dias?\b/.exec(t))) return {de: h, ate: addDias(h, +m[1])};
    if (/\bproximos dias\b/.test(t)) return {de: h, ate: addDias(h, 7)};
    if (/\b(esta|essa|nesta|nessa) semana\b|\bsemana\b/.test(t)) return {de: h, ate: addDias(h, (7 - h.getDay()) % 7)};
    if (/\b(mes que vem|proximo mes)\b/.test(t)) return mesInteiro(h.getFullYear(), h.getMonth() + 1);
    for (var i = 0; i < 12; i++) if (new RegExp("\\b" + MESES_N[i] + "\\b").test(t)) { r = mesInteiro(h.getFullYear(), i); return r; }
    if (/\b(este|esse|neste|nesse|no) mes\b|\bmes\b/.test(t)) return mesInteiro(h.getFullYear(), h.getMonth());
    if (/\bhoje\b/.test(t)) return {de: h, ate: h};
    return null;
  }

  /* ============ módulos e dados ============ */
  var ALIAS_MOD = {
    dp: ["dp", "pessoal", "folha", "departamento pessoal", "dep pessoal", "rh", "funcionarios", "ferias"],
    contabil: ["contabil", "contabilidade", "balanco", "balancete"],
    fiscal: ["fiscal", "fiscais", "obrigacoes acessorias"],
    portal: ["portal", "portal do cliente", "onvio", "implantacao", "treinamento"],
    cardapio: ["cardapio", "refeitorio", "almoco", "almocar", "marmita", "cozinha"]
  };
  function detectarModulos(t) {
    var out = [];
    Object.keys(ALIAS_MOD).forEach(function (k) { if (ALIAS_MOD[k].some(function (a) { return new RegExp("(^|\\s)" + a + "(\\s|$)").test(t); })) out.push(k); });
    return out;
  }
  var ALIAS_ABA = {
    painel: ["painel", "dashboard", "resumo geral"], agenda: ["agenda", "calendario"], empresas: ["empresas", "cartoes de empresas"], fechamento: ["fechamento"],
    cadastro: ["cadastro", "importar", "importacao", "configuracao", "configuracoes"], carteira: ["carteira"], prazos: ["prazos", "vencimentos"],
    funcionarios: ["funcionarios", "funcionario", "pessoas"], sindicatos: ["convencoes", "convencao", "sindicatos", "cct"], cartela: ["cartela", "cartela de clientes"],
    ferramentas: ["ferramentas", "importador"], dashboard: ["hoje", "inicio do portal"], progresso: ["consulta"], foco: ["foco"], impedimentos: ["impedimentos", "bloqueios"], relatorios: ["relatorios", "relatorio"]
  };
  function detectarAba(t, api) {
    if (!api || !api.abas) return "";
    var melhor = "", pts = 0;
    api.abas.forEach(function (a) {
      var k = a[0], rot = norm(a[1]), p = 0;
      if (new RegExp("(^|\\s)" + rot + "(\\s|$)").test(t)) p = 3;
      (ALIAS_ABA[k] || []).forEach(function (al) { if (new RegExp("(^|\\s)" + al + "(\\s|$)").test(t)) p = Math.max(p, 2); });
      if (p > pts) { pts = p; melhor = k; }
    });
    return melhor;
  }

  var cache = {indice: null, em: 0, n: 0};
  var carregados = {};
  function apisCarregadas() { return Object.keys(carregados).map(function (k) { return carregados[k]; }).filter(Boolean); }
  var inicioCarga = null;
  // Carrega (em segundo plano) todos os módulos, uma vez, para o assistente conhecer empresas e analistas.
  function carregarTodos() {
    if (inicioCarga) return inicioCarga;
    var ks = H.modulos(), i = 0;
    inicioCarga = new Promise(function (ok) {
      (function prox() {
        if (i >= ks.length) return ok();
        var k = ks[i++];
        H.carregar(k).then(function (a) { carregados[k] = a; cache.indice = null; }).catch(function () {}).then(function () { setTimeout(prox, 150); });
      })();
    });
    return inicioCarga;
  }
  function modulo(k) {
    if (carregados[k]) return Promise.resolve(carregados[k]);
    return H.carregar(k).then(function (a) { carregados[k] = a; cache.indice = null; return a; });
  }

  var PALAVRAS_EMP = {ltda: 1, eireli: 1, epp: 1, cia: 1, sa: 1, me: 1, ss: 1, filial: 1, matriz: 1};
  function tokensEmp(nome) { return norm(nome).split(" ").filter(function (w) { return w.length >= 3 && !PALAVRAS_EMP[w] && !/^\d+$/.test(w); }); }
  function indice() {
    var apis = apisCarregadas();
    if (cache.indice && cache.n === apis.length && Date.now() - cache.t < 4000) return cache.indice;
    var por = {}, lista = [], ana = {};
    var reais = apis.some(function (a) { return !(a.exemplo && a.exemplo()) && a.empresas().length; });
    apis.forEach(function (a) {
      if (reais && a.exemplo && a.exemplo()) return;       // dados fictícios não entram quando há carteira real
      a.empresas().forEach(function (e) {
        var chave = e.cnpj && e.cnpj.length === 14 ? e.cnpj : norm(e.nome), g = por[chave];
        if (!g) { g = por[chave] = {nome: e.nome, cnpj: e.cnpj || "", refs: {}, tok: tokensEmp(e.nome)}; lista.push(g); }
        g.refs[a.modulo] = e.id;
      });
      a.analistas().forEach(function (n) { if (n) ana[norm(n)] = n; });
    });
    var df = {};
    lista.forEach(function (g) { g.tok.forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
    var N = lista.length + 1;
    lista.forEach(function (g) { g.peso = g.tok.map(function (w) { return Math.log((N + 1) / (df[w] + 0.5)) + 1; }); g.total = g.peso.reduce(function (a, b) { return a + b; }, 0); });
    cache.indice = {empresas: lista, analistas: Object.keys(ana).map(function (k) { return ana[k]; })};
    cache.n = apis.length; cache.t = Date.now();
    return cache.indice;
  }
  function casarAnalista(t, nomes) {
    var toks = t.split(" "), achou = [];
    nomes.forEach(function (n) {
      var nn = norm(n), pr = nn.split(" ")[0];
      if ((" " + t + " ").indexOf(" " + nn + " ") !== -1 || (pr.length >= 3 && toks.indexOf(pr) !== -1)) achou.push(n);
    });
    if (achou.length > 1) { var cheio = achou.filter(function (n) { return (" " + t + " ").indexOf(" " + norm(n) + " ") !== -1; }); if (cheio.length === 1) return [cheio[0]]; }
    return achou;
  }
  function parecido(a, b) {
    if (a === b) return true;
    var m = Math.min(a.length, b.length); if (m < 5) return false;
    var i = 0; while (i < m && a.charAt(i) === b.charAt(i)) i++;
    return i >= 5 && i >= m - 2;
  }
  // Empresas citadas na frase, da mais provável para a menos. `ignorar`: nomes de analistas já reconhecidos.
  function casarEmpresas(t, ignorar) {
    var ix = indice(), toks = t.split(" ").filter(Boolean), dig = (t.replace(/[^\d ]/g, "").match(/\d{8,14}/) || [])[0], out = [];
    ix.empresas.forEach(function (g) {
      if (dig && g.cnpj && g.cnpj.indexOf(dig) !== -1) { out.push({g: g, s: 2}); return; }
      var soma = 0, n = 0;
      g.tok.forEach(function (w, i) { if (ignorar[w]) return; if (toks.some(function (x) { return parecido(x, w); })) { soma += g.peso[i]; n++; } });
      if (!n || !g.total) return;
      var s = soma / g.total;
      if (s >= 0.5 && (n >= 2 || g.tok.length <= 2 || s >= 0.7)) out.push({g: g, s: s});
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out;
  }

  /* ============ base de ajuda ============ */
  var AJUDA = [
    {t: "Importar a carteira", m: "fiscal", k: "importar carteira planilha empresas cadastro xlsx fiscal", a: "No Fiscal, abra Cadastro e use “Importar carteira”. A planilha precisa das colunas Empresa, CNPJ, Regime, Atividade, Analista, IE, IM, Município e UF (há um botão para baixar o modelo). Empresas já cadastradas (mesmo CNPJ ou nome) são atualizadas, não duplicadas. Ao importar, os dados de exemplo saem.", ir: {m: "fiscal", aba: "cadastro"}},
    {t: "Importar a carteira (Contábil)", m: "contabil", k: "importar carteira planilha contabil empresas xlsx", a: "No Contábil, abra Cadastro → “Importar carteira”. Aceita a planilha limpa (Empresa, CNPJ, Tributação, Analista, Situação…) e também a planilha antiga do setor. Empresas existentes são atualizadas.", ir: {m: "contabil", aba: "cadastro"}},
    {t: "Dados de exemplo no Fiscal", m: "fiscal", k: "dados exemplo ficticios demo fiscal faixa nada gravado", a: "Enquanto o Fiscal não tem carteira no banco, ele mostra 40 empresas fictícias para você conhecer o módulo. Nada é gravado. Importe a carteira real (Cadastro) para começar de verdade.", ir: {m: "fiscal", aba: "painel"}},
    {t: "Marcar o fechamento", m: "fiscal", k: "marcar fechamento etapa documentos escrituracao apuracao guia concluir tudo lote", a: "Em Fechamento, cada empresa tem quatro etapas: documentos recebidos, escrituração, apuração e guia enviada. Clique na etapa para mudar o status (pendente, em andamento, concluída ou não se aplica). “✓ Tudo” conclui a linha inteira, e dá para selecionar várias empresas e aplicar em lote.", ir: {m: "fiscal", aba: "fechamento"}},
    {t: "Pendência do cliente", m: "fiscal", k: "pendencia cliente cobrar cobranca aguardando documento faltando", a: "Em Fechamento, a coluna “Pendência do cliente” registra o que falta o cliente mandar. Dentro do registro você marca “Cobrado de novo hoje” e “Recebido”. A empresa aparece como “aguardando cliente” enquanto a pendência existir, e a pendência some quando o fechamento é concluído.", ir: {m: "fiscal", aba: "fechamento"}},
    {t: "Marcar entrega de obrigação", m: "fiscal", k: "marcar entrega obrigacao entregue agenda pgdas dctfweb efd reinf guia", a: "Na Agenda do Fiscal, clique num dia e marque a caixinha ao lado de cada empresa para registrar a entrega. Na ficha da empresa (aba Obrigações) dá para marcar como retificada ou não se aplica.", ir: {m: "fiscal", aba: "agenda"}},
    {t: "Prazos do Fiscal", m: "fiscal", k: "prazo prazos dia vencimento catalogo conferir dia util feriado configurar", a: "O catálogo de obrigações fica em Cadastro → Obrigações e prazos (só a coordenação edita). Os dias padrão vêm marcados “conferir”: ICMS, DeSTDA e ISS mudam conforme o estado e o município. O cálculo considera dias úteis e feriados nacionais, carnaval, sexta-feira santa, Corpus Christi e os de Vitória/ES (N. Sra. da Penha e da Vitória); outros feriados locais não entram.", ir: {m: "fiscal", aba: "cadastro"}},
    {t: "Saúde da empresa", m: "fiscal", k: "saude anel empresa percentual fiscal em dia", a: "O anel de cada empresa no Fiscal mostra a % de fechamentos e entregas em dia nos últimos 90 dias. Verde a partir de 90%, laranja de 70% a 89%, vermelho abaixo disso.", ir: {m: "fiscal", aba: "empresas"}},
    {t: "Prazo interno do fechamento", m: "fiscal", k: "prazo interno fechamento atrasada dia 20 limite", a: "No Fiscal, o fechamento do mês fica atrasado depois do dia 20 do mês seguinte. Esse dia se muda em Cadastro (“Prazo interno do fechamento”).", ir: {m: "fiscal", aba: "cadastro"}},
    {t: "Fechado até (Contábil)", m: "contabil", k: "fechado ate atraso meses contabil fechamento clique avancar falta informar", a: "No Contábil, cada célula diz até que mês a etapa está concluída. Clicar avança e marca de uma vez os meses que faltavam. “Falta informar” significa que a planilha antiga não tinha registro dessa etapa.", ir: {m: "contabil", aba: "fechamento"}},
    {t: "Vencimentos de impostos (Contábil)", m: "contabil", k: "vencimento imposto das irpj guia apurado prazo contabil", a: "Na aba Prazos do Contábil aparecem os vencimentos de impostos por tributação. Marque, em cada vencimento, se o imposto foi apurado e se a guia foi enviada ao cliente. Os dias se configuram em Cadastro.", ir: {m: "contabil", aba: "prazos"}},
    {t: "Agenda do DP", m: "dp", k: "agenda dp lembrete lembretes meus criar dia calendario", a: "Na Agenda do DP, o calendário junta prazos gerais, rotinas das empresas, datas-base e eventos de funcionários. Clique num dia para ver tudo dele; o “+” no dia cria um lembrete só seu (pode repetir). Os seus lembretes ficam numa área privada: só você vê.", ir: {m: "dp", aba: "agenda"}},
    {t: "Prazos gerais do DP", m: "dp", k: "prazos gerais dp esocial fgts salario darf sugeridos", a: "Em Agenda → “Prazos gerais…” ficam as datas que valem para todas as empresas ativas (salários, eSocial, FGTS…). O botão “Adicionar prazos legais sugeridos” traz uma base para você conferir. Em cada empresa, desmarque o que ela não faz.", ir: {m: "dp", aba: "agenda"}},
    {t: "Convenções coletivas", m: "dp", k: "convencao convencoes cct sindicato data base reajuste vigencia dominio importar", a: "A aba Convenções controla CCTs, vigência, data-base e reajuste. Importe a lista de sindicatos do Domínio (PDF), cadastre as convenções e o sistema liga tudo pelo CNPJ. Ele avisa convenção vencendo, aditivo pendente e reajuste ainda não aplicado.", ir: {m: "dp", aba: "sindicatos"}},
    {t: "Cartela de clientes", m: "dp", k: "cartela clientes analista mover empresas ausencia ferias cobertura simular reserva", a: "Na Cartela você distribui as empresas entre os analistas: troque o responsável na linha, selecione várias para mover em lote ou arraste até o analista. Em “Ausências” registre férias e quem cobre; “Simular” testa mudanças sem salvar.", ir: {m: "dp", aba: "cartela"}},
    {t: "Importador Domínio", m: "dp", k: "importador dominio rpa lancamentos rubricas txt arquivo", a: "Em DP → Ferramentas, o Importador Domínio gera o arquivo .txt de RPA e lançamentos de rubricas, com conferência linha a linha antes de baixar.", ir: {m: "dp", aba: "ferramentas"}},
    {t: "Etapas do Portal do Cliente", m: "portal", k: "etapas portal habilitacao treinamento analista cadastro usuario cliente implantacao", a: "O Portal acompanha quatro etapas por setor: habilitação no Domínio, treinamento do analista, cadastro do usuário do cliente e treinamento dos clientes. Contato treinado já conta como habilitação concluída e usuário ativo.", ir: {m: "portal", aba: "dashboard"}},
    {t: "Impedimentos no Portal", m: "portal", k: "impedimento impedimentos bloqueio portal empresa", a: "Na aba Impedimentos ficam as empresas, setores e pessoas travados, com o motivo, desde quando e de quem se aguarda retorno.", ir: {m: "portal", aba: "impedimentos"}},
    {t: "Cardápio", m: "cardapio", k: "cardapio editar cadastrar dia semana feriado refeitorio", a: "O Cardápio mostra a semana atual e muda sozinho na virada do dia. Quem tem permissão de edição vê o botão para cadastrar ou editar cada dia e marcar feriados.", ir: {m: "cardapio", aba: ""}},
    {t: "Ações pelo assistente", k: "acao acoes marcar concluir fechar pendencia lembrete lembra entrega etapa tax assistente confirmar desfazer", a: "Eu também faço: “marca a escrituração da Alfa como concluída”, “dá baixa no PGDAS-D da Beta”, “registra pendência na Alfa: extrato do Itaú”, “fecha a Beta” e “me lembra de ligar para o cliente amanhã às 14h”. Sempre mostro um cartão e só gravo depois do seu Confirmar (ou de um “sim”); dá para Desfazer em seguida. Respeito a permissão: só a coordenação ou o analista da carteira marca."},
    {t: "Busca global", k: "busca buscar pesquisar atalho procurar ctrl k", a: "Aperte “/” ou Ctrl+K em qualquer tela do Hub para buscar empresas, funcionários, lembretes e ferramentas."},
    {t: "Tema claro e escuro", k: "tema escuro claro dark noite", a: "Use o botão “Tema” na barra lateral (ou a tecla T na tela inicial) para alternar entre claro e escuro."},
    {t: "Chamar o assistente", k: "tax assistente mascote chamar conversar atalho", a: "Eu ando pela tela como se o layout fosse chão e parede: caminho pelo topo dos cartões e botões, pulo degraus e caio quando o chão some. Clique num espaço vazio e eu vou até lá. Clicando em mim, abre a conversa; em “🎨 Visual” você troca o meu desenho. Aperte Ctrl+J para abrir a conversa a qualquer hora."}
  ];
  var VAZIAS = " como funciona funcionam faco fazer posso fazemos qual quais onde fica para pra isso esse essa esta uma uns que sobre tenho duvida quero saber preciso usar uso ";
  function buscarAjuda(t, mods, minimo) {
    var toks = t.split(" ").filter(function (w) { return w.length >= 3 && VAZIAS.indexOf(" " + w + " ") === -1; }), melhor = null, pts = 0;
    AJUDA.forEach(function (e) {
      var base = norm(e.k + " " + e.t).split(" "), p = 0;
      toks.forEach(function (w) { if (base.indexOf(w) !== -1) p += 2; else if (base.some(function (b) { return parecido(w, b); })) p += 1; });
      if (e.m && mods.indexOf(e.m) !== -1) p += 2;
      if (p > pts) { pts = p; melhor = e; }
    });
    return pts >= (minimo || 3) ? melhor : null;
  }

  /* ============ intenções ============ */
  var RX = {
    saudacao: /^(oi|ola|ola tax|oi tax|e ai|eai|opa|hey|salve|bom dia|boa tarde|boa noite)( |$)/,
    obrigado: /\b(obrigad|brigad|valeu|thanks)/,
    quem: /\b(quem (e|eh) voce|quem es|o que voce (faz|sabe|pode)|pra que voce serve|para que voce serve|o que (eu )?posso (te )?(perguntar|pedir)|comandos|me ajuda|ajuda)\b/,
    navegar: /(^| )(abr[aei]r?|abre|ir para|ir pra|vai para|vai pra|va para|leva|levar|mostr[ae]r?|mostra|quero ver|ver|navegar|entrar|acessar|acesse|volta|voltar)( |$)/,
    cliente: /\b(aguard\w* (o |a )?(cliente|retorno|resposta)|pendencias? (do|de) clientes?|cobrar|cobranca|cliente (nao )?(mandou|enviou)|esperando (o )?cliente)\b/,
    atrasos: /\b(atras|vencid|pendent|em aberto|falt|bloquead|impedi|problema|urgent|alerta|aviso|nao (foi|foram) (feito|entregue)|estourou)/,
    cardapio: /\b(cardapio|almoc|comer\b|refeitorio|prato|sobremesa|marmita)/,
    vencimentos: /\b(venc|prazo|entreg|agenda|compromiss|obrigac|calendario|guias?\b|o que (tem|temos|ha|rola)\b|vai ter\b)/,
    carteira: /\b(carteira|quantas empresas|quantos clientes|quantas)\b/,
    empresa: /\b(empresa|cliente|situacao|como (esta|ta|anda)|me fala|fala (da|do|sobre)|ficha|dados d[aeo]|informacoes)\b/,
    ajuda: /^(como|onde|o que (e|significa|quer dizer)|para que serve|pra que serve|qual a diferenca|duvida|tenho uma duvida|passo a passo|tutorial)\b|\b(como (faco|faz|eu|se)|onde (fica|vejo|encontro|clico)|ensina)\b/,
  };

  /* ============ resposta ============ */
  var ctx = {intent: "", mods: [], analista: "", per: null, empresa: null};
  var euNome = null;
  function quemSou() {
    if (euNome !== null) return Promise.resolve(euNome);
    try {
      if (!window.claude || !window.claude.use) { euNome = ""; return Promise.resolve(""); }
      return window.claude.use("user").then(function (u) { return u && u.name ? u.name() : ""; }).catch(function () { return ""; }).then(function (n) { euNome = n || ""; return euNome; });
    } catch (e) { euNome = ""; return Promise.resolve(""); }
  }
  function casarEu(nomes) {
    var t = norm(euNome || "").split(" ").filter(Boolean), melhor = "", pts = 0;
    nomes.forEach(function (n) { var a = norm(n).split(" "); if (a[0] !== t[0]) return; var p = a.filter(function (x) { return t.indexOf(x) !== -1; }).length; if (p > pts) { pts = p; melhor = n; } });
    return melhor;
  }

  function nomesAbas(mod) { var a = carregados[mod]; return a && a.abas ? a.abas : []; }
  var T = function (texto) { return {tipo: "texto", texto: texto}; };
  var CH = function (itens) { return {tipo: "chips", itens: itens}; };
  function sugestoes() {
    var ativo = H.ativo();
    var base = {
      fiscal: ["Entregas da semana no Fiscal", "Empresas com atraso no Fiscal", "Abrir o fechamento do Fiscal", "Como importo a carteira?"],
      contabil: ["Vencimentos do Contábil nesta semana", "Fechamento atrasado no Contábil", "Aguardando cliente no Contábil", "Abrir prazos do Contábil"],
      dp: ["O que vence hoje no DP?", "Alertas do DP", "Abrir a cartela de clientes", "Como funciona a cartela?"],
      portal: ["Impedimentos no Portal", "Treinamentos desta semana", "Abrir o Portal do Cliente", "Quais as etapas do portal?"],
      cardapio: ["Cardápio de hoje", "Cardápio de amanhã", "Cardápio da semana"]
    }[ativo];
    return base || ["O que vence hoje?", "Quem está atrasado?", "Cardápio de hoje", "O que você sabe fazer?"];
  }

  // Entende a frase e devolve a lista de blocos da resposta.
  function responder(texto) {
    var t = norm(texto);
    if (!t) return Promise.resolve([T("Pode escrever a pergunta que eu respondo.")]);
    if (pendente && /^(sim|confirmo|confirma|confirmar|pode|pode sim|ok|isso|isso mesmo|manda ver|faz)$/.test(t)) { var c1 = pendente; return c1.confirmar().then(function () { return []; }); }
    if (pendente && /^(nao|cancela|cancelar|deixa|deixa pra la|esquece)$/.test(t)) { var c2 = pendente; c2.cancelar(); return Promise.resolve([]); }
    var porRegras = function (aviso) { return carregarTodos().then(quemSou).then(function () { return entender(texto, t); }).then(function (bl) { return aviso ? [{tipo: "rodape", texto: aviso}].concat(bl) : bl; }); };
    return Promise.all([iaPronta, quemSou()]).then(function () {
      if (!iaOk) return porRegras("");
      return perguntarIA(texto).then(function (bl) { return bl || porRegras(iaAviso); });
    });
  }

  function entender(texto, t) {
    var ix = indice(), nomesAna = ix.analistas;
    var anaMatch = casarAnalista(t, nomesAna);
    var ignorar = {};
    anaMatch.forEach(function (n) { ignorar[norm(n).split(" ")[0]] = 1; });
    var emps = casarEmpresas(t, ignorar);
    var mods = detectarModulos(t), per = periodo(t);
    var euRef = /\b(minha|minhas|meu|meus|eu)\b/.test(t) && !anaMatch.length;
    var analista = anaMatch.length === 1 ? anaMatch[0] : "";
    if (euRef && euNome) analista = casarEu(nomesAna) || "";
    var navega = RX.navegar.test(t);
    var intent = "";

    var pedido = (!/^(como|onde|qual|quais|quando|quem|o que|por que|porque|quanto)\b/.test(t) && texto.indexOf("?") === -1) ? detectarAcao(t, texto, emps, mods, per) : null;
    if (pedido) return prepararAcao(pedido, texto);

    if (RX.saudacao.test(t) && t.split(" ").length <= 4) intent = "saudacao";
    else if (RX.obrigado.test(t)) intent = "obrigado";
    else if (RX.quem.test(t)) intent = "quem";
    else if (RX.ajuda.test(t) && !emps.length) intent = "ajuda";
    else if (emps.length && (!anaMatch.length || emps[0].s >= 1)) intent = "empresa";
    else if (navega && (mods.length || /\b(inicio|home|tela inicial)\b/.test(t) || detectarAba(t, carregados[mods[0]]))) intent = "navegar";
    else if (RX.cliente.test(t)) intent = "cliente";
    else if (RX.cardapio.test(t)) intent = "cardapio";
    else if (RX.atrasos.test(t)) intent = "atrasos";
    else if (RX.vencimentos.test(t)) intent = "vencimentos";
    else if (RX.carteira.test(t)) intent = "carteira";
    else if (RX.empresa.test(t)) intent = "empresa";
    if (!intent && (anaMatch.length || per || mods.length) && ctx.intent && ctx.intent !== "empresa") intent = ctx.intent;      // "e do Bruno?", "e amanhã?"
    if (!intent && anaMatch.length) intent = "carteira";
    if (!intent) { var aj = buscarAjuda(t, mods); if (aj) intent = "ajuda"; }

    if (anaMatch.length > 1 && !analista && intent !== "navegar") {
      return Promise.resolve([T("Achei mais de um analista com esse nome. Qual deles?"), CH(anaMatch.slice(0, 6).map(function (n) { return {rot: n, enviar: trocarNome(texto, n)}; }))]);
    }
    if (euRef && !analista && /(minha|minhas|meu|meus)/.test(t) && ["atrasos", "vencimentos", "carteira", "cliente"].indexOf(intent) !== -1) {
      return Promise.resolve([T("Não consegui descobrir qual analista é você. De quem você quer ver?"), CH(nomesAna.slice(0, 8).map(function (n) { return {rot: n, enviar: texto.replace(/minhas?|meus?/gi, "do") + " " + n}; }))]);
    }
    if (!mods.length && ctx.mods.length && (intent === ctx.intent) && !anaMatch.length && !per && !emps.length && /^(e|e o|e a|e no|e na)\b/.test(t)) mods = ctx.mods;
    var p = {intent: intent, mods: mods, analista: analista, per: per, t: t, texto: texto};
    ctx.intent = intent === "empresa" ? ctx.intent : intent || ctx.intent;
    if (intent !== "saudacao" && intent !== "obrigado" && intent !== "quem" && intent !== "ajuda") { ctx.mods = mods; if (analista) ctx.analista = analista; if (per) ctx.per = per; }

    switch (intent) {
      case "saudacao": return Promise.resolve([T("Oi! Sou o Tax, o assistente do Hub. Pergunte sobre prazos, atrasos, empresas ou cardápio, ou peça para abrir uma tela."), CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))]);
      case "obrigado": return Promise.resolve([T("Por nada! É só chamar. 🙂")]);
      case "quem": return Promise.resolve(quem());
      case "ajuda": return Promise.resolve(ajuda(p));
      case "navegar": return navegar(p);
      case "empresa": return empresa(p, emps);
      case "vencimentos": case "atrasos": case "cliente": case "carteira": return consulta(p);
      case "cardapio": return consulta(p);
      default: return Promise.resolve(naoEntendi(p));
    }
  }

  function trocarNome(texto, nome) {
    var pr = norm(nome).split(" ")[0], ok = false;
    var r = texto.split(/(\s+)/).map(function (w) { if (!ok && norm(w) === pr) { ok = true; return nome; } return w; }).join("");
    return ok ? r : texto + " " + nome;
  }

  /* ============ ações (sempre com confirmação) ============ */
  var STOP_ETAPA = {de: 1, do: 1, da: 1, dos: 1, das: 1, e: 1, ao: 1, em: 1, para: 1, ao: 1};
  function limpo(t) { return " " + t.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " "; }
  function melhorPorTokens(tt, itens, rotulos) {
    // itens: lista; rotulos(i) -> lista de textos alternativos. Devolve {item, pts, empate}
    var melhor = null, pts = 0, empate = [];
    itens.forEach(function (it) {
      var p = 0;
      rotulos(it).forEach(function (r) {
        var ws = limpo(norm(r)).trim().split(" ").filter(function (w) { return w && !STOP_ETAPA[w] && w.length >= 2; });
        if (!ws.length) return;
        var hits = ws.filter(function (w) { return tt.indexOf(" " + w + " ") !== -1 || (w.length >= 5 && tt.indexOf(" " + w.slice(0, 5)) !== -1); }).length;
        if (!hits) return;
        var q = hits / ws.length + (hits === ws.length ? 1 : 0) + (ws.length === 1 ? 0 : 0.1 * hits);
        if (q > p) p = q;
      });
      if (p > pts + 1e-9) { pts = p; melhor = it; empate = [it]; }
      else if (p && Math.abs(p - pts) < 1e-9) empate.push(it);
    });
    return {item: melhor, pts: pts, empate: empate};
  }
  function detectarAcao(t, texto, emps, mods, per) {
    var tt = limpo(t);
    // lembrete pessoal (DP): não precisa de empresa
    if (/\b(me lembr\w*|lembra (de|pra|para) |(cria\w*|novo|adiciona\w*|coloca\w*|anota\w*)( um| o)? lembrete)\b/.test(t)) {
      var hora = (/\b(\d{1,2})\s?(?:h|:)\s?(\d{2})?\b/.exec(t) || []);
      var h = hora[1] && +hora[1] <= 23 ? pad2(+hora[1]) + ":" + (hora[2] || "00") : "";
      var txt = texto.replace(/^\s*(por favor[, ]*)?/i, "").replace(/\b(me )?lembr(a|e|ar)\b( de| que| para| pra)?/i, "").replace(/\b(cria\w*|novo|adiciona\w*|coloca\w*|anota\w*)( um| o)? lembrete( de| para| pra| que| sobre)?/i, "")
        .replace(/(^|\s)(depois de amanh[ãa]|amanh[ãa]|hoje|ontem)(?=[\s,.;]|$)/ig, " ").replace(/\bdia \d{1,2}\b/ig, "").replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "").replace(/(^|\s)(às|as)\s+\d{1,2}(h|:)?\d{0,2}h?(?=\s|$)/ig, " ").replace(/(^|\s)\d{1,2}\s?h(\d{2})?(?=\s|$)/ig, " ")
        .replace(/\bna (segunda|terça|quarta|quinta|sexta)\b/ig, "").replace(/\s+/g, " ").replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, "");
      return {tipo: "lembrete", mod: "dp", texto: txt, data: per ? ymd(per.de) : ymd(hoje()), hora: h, emp: emps.length ? emps[0] : null};
    }
    if (!emps.length) return null;
    var verbo = /\b(marc\w*|conclu\w*|finaliz\w*|fech\w*|dar? baixa|baixa|registr\w*|lanc\w*|anot\w*|cobr\w*|desmarc\w*|reabr\w*|desfaz\w*|retific\w*|entreg\w*|receb\w*|chegou|chegaram|mandou|enviou|enviei|transmiti\w*|termin\w*|inici\w*|comec\w*|coloca\w*|poe|bota)\b/.test(t);
    if (!verbo) return null;
    if (emps.length > 1 && emps[1].s >= emps[0].s * 0.92) return {tipo: "ambigua", emps: emps.slice(0, 5)};
    var e = emps[0], modsEmp = Object.keys(e.g.refs);
    var status = /\b(desmarc\w*|reabr\w*|desfaz\w*|volta\w*|pendente)\b/.test(t) ? "" : /\b(inici\w*|comec\w*|em andamento|andamento)\b/.test(t) ? "a" : /\bretific\w*\b/.test(t) ? "r" : "c";
    var comp = per && ymd(per.de).slice(0, 7) === ymd(per.ate).slice(0, 7) && /\b(competencia|fechamento|de |do mes|em |mes)\b/.test(t) && !/\b(hoje|amanha|ontem|dia \d)/.test(t) ? ymd(per.de).slice(0, 7) : "";
    // pendência do cliente
    var temPend = /\b(pendencia|pendente do cliente|aguardando|falta o cliente|cliente (nao )?(mandou|enviou)|cobrei|cobrado|cobranca|cobrar de novo)\b/.test(t) || /\bcliente\b.*\b(mandou|enviou|chegou)\b|\b(receb\w+|chegou|chegaram)\b.*\b(do|da) cliente\b/.test(t);
    if (temPend) {
      var modo = /\b(cobrei|cobrado|cobranca|cobrar de novo)\b/.test(t) ? "cobrado" : /\b(receb\w+|chegou|chegaram|mandou|enviou|resolvid\w+|resolveu)\b/.test(t) && !/\bnao\b/.test(t) ? "recebida" : "registrar";
      var tx = "";
      if (modo === "registrar") {
        var i = texto.indexOf(":");
        tx = i >= 0 ? texto.slice(i + 1) : texto.replace(/^.*?\b(pend[êe]ncia|falta(ndo)?|aguardando)( do cliente| d[oa] cliente)?( de| do| da| dos| das| o| a| os| as)?\b/i, "");
        if (i < 0 && tx === texto) tx = "";
        tx = tx.replace(/\b(na|no|da|do) [^,:;]*$/i, function (m) { return m; }).replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, "");
      }
      return {tipo: "pendencia", modo: modo, texto: tx, emp: e, mods: mods, comp: comp};
    }
    // obrigação (Fiscal) e etapa (Fiscal/Contábil): usam o vocabulário dos módulos
    var vf = carregados.fiscal && carregados.fiscal.vocab ? carregados.fiscal.vocab() : null, vc = carregados.contabil && carregados.contabil.vocab ? carregados.contabil.vocab() : null;
    if (vf && modsEmp.indexOf("fiscal") !== -1 && vf.obrigacoes.length) {
      var ob = melhorPorTokens(tt, vf.obrigacoes, function (o) { return [o.l]; });
      if (ob.item && ob.pts >= 0.5 && !/\b(etapa|escrituracao|apuracao|fechamento)\b/.test(t)) {
        if (ob.empate.length > 1) return {tipo: "ambigua_ob", emp: e, opcoes: ob.empate, texto: texto};
        return {tipo: "entrega", mod: "fiscal", emp: e, ob: ob.item.k, rotulo: ob.item.l, status: status === "a" ? "c" : status, comp: comp};
      }
    }
    var mods = mods.filter(function (m) { return m === "fiscal" || m === "contabil"; });
    var cands = [];
    if (vf && modsEmp.indexOf("fiscal") !== -1) cands.push(["fiscal", vf.etapas]);
    if (vc && modsEmp.indexOf("contabil") !== -1) cands.push(["contabil", vc.etapas]);
    var achados = [];
    cands.forEach(function (c) {
      if (mods.length && mods.indexOf(c[0]) === -1) return;
      var r = melhorPorTokens(tt, c[1], function (x) { return [x.c, x.l]; });
      if (r.item && r.pts >= 1 && r.empate.length === 1) achados.push({mod: c[0], et: r.item});
    });
    if (achados.length === 1) return {tipo: "etapa", mod: achados[0].mod, emp: e, etapa: achados[0].et.k, rotulo: achados[0].et.l, status: status, comp: comp};
    if (achados.length > 1) return {tipo: "ambigua_mod", emp: e, mods: achados.map(function (a) { return a.mod; }), texto: texto};
    // fechar a empresa
    if (/\b(fech\w+|conclu\w+|finaliz\w+|termin\w+)\b/.test(t) && !/\b(mes|ano)\b.*\bcontab/.test(t)) return {tipo: "fechar", emp: e, mods: mods, comp: comp};
    return null;
  }
  function escolherModulo(pedido, candidatos) {
    // candidatos: módulos onde a empresa existe e que sabem agir
    var sel = (pedido.mods || []).filter(function (m) { return m === "fiscal" || m === "contabil"; });
    var c = candidatos.filter(function (m) { return !sel.length || sel.indexOf(m) !== -1; });
    if (!c.length) c = candidatos;
    if (c.length === 1) return c[0];
    var ativo = H.ativo();
    if (c.indexOf(ativo) !== -1) return ativo;
    return c.length ? "?" : "";
  }
  var pendente = null;
  function prepararAcao(pd, texto) {
    if (pd.tipo === "ambigua") {
      return Promise.resolve([T("Achei mais de uma empresa parecida. Qual delas?"), CH(pd.emps.map(function (x) { return {rot: x.g.nome, enviar: substituirEmpresa(texto, x.g.nome)}; }))]);
    }
    if (pd.tipo === "ambigua_ob") {
      return Promise.resolve([T("Qual obrigação você quer dizer?"), CH(pd.opcoes.slice(0, 6).map(function (o) { return {rot: o.l, enviar: texto + " " + o.l}; }))]);
    }
    if (pd.tipo === "ambigua_mod") {
      return Promise.resolve([T("Essa empresa está em mais de um módulo. Em qual?"), CH(pd.mods.map(function (m) { return {rot: MODN[m], enviar: texto + " no " + MODN[m]}; }))]);
    }
    var e = pd.emp, mod = pd.mod;
    if (pd.tipo === "lembrete") mod = "dp";
    else if (!mod) {
      var cand = Object.keys(e.g.refs).filter(function (m) { return m === "fiscal" || m === "contabil"; });
      if (!cand.length) return Promise.resolve([T("Só consigo marcar etapas e pendências em empresas do Fiscal ou do Contábil, e essa não está em nenhum dos dois.")]);
      mod = escolherModulo(pd, cand);
      if (mod === "?") return Promise.resolve([T("“" + e.g.nome + "” está no Fiscal e no Contábil. Em qual deles?"), CH(cand.map(function (m) { return {rot: MODN[m], enviar: texto + " no " + MODN[m]}; }))]);
    }
    return modulo(mod).then(function (a) {
      if (!a || !a.acao) return [T("Ainda não consigo fazer isso no " + MODN[mod] + ".")];
      var id = e ? e.g.refs[mod] : "";
      var p = {id: id, etapa: pd.etapa, status: pd.status, ob: pd.ob, modo: pd.modo, texto: pd.texto, comp: pd.comp, data: pd.data, hora: pd.hora};
      var plano = a.acao(pd.tipo, p);
      if (!plano || plano.erro) return [T(plano && plano.erro ? plano.erro : "Não consegui preparar essa ação.")];
      return [{tipo: "confirma", plano: plano, mod: mod, titulo: plano.titulo}];
    });
  }
  function substituirEmpresa(texto, nome) {
    var q = norm(nome).split(" ").filter(function (w) { return w.length >= 3; });
    var ws = texto.split(/(\s+)/), out = [], colocou = false;
    ws.forEach(function (w) { if (q.some(function (x) { return norm(w).indexOf(x.slice(0, 5)) === 0 && norm(w).length >= 3; })) { if (!colocou) { out.push(nome); colocou = true; } } else out.push(w); });
    return colocou ? out.join("").replace(/\s+/g, " ") : texto + " " + nome;
  }


  /* ============ IA opcional (capability "sample": gasta o plano de quem clicou) ============ */
  var iaOk = false, iaNs = null, iaOcupada = false;
  var iaPronta = Promise.resolve();
  function iniciarIA() {
    try {
      if (!window.claude || !window.claude.use) return;
      iaPronta = window.claude.use("sample").then(function (ns) {
        if (!ns || typeof ns !== "function") return null;
        return Promise.resolve(ns.limits ? ns.limits() : null).then(function (l) { if (l && l.tools) { iaNs = ns; iaOk = true; } }, function () {});
      }).catch(function () {});
    } catch (e) {}
  }
  function compacto(r, max) {
    if (!r) return {total: 0, linhas: []};
    var ls = (r.linhas || []).slice(0, max || 15).map(function (l) { return {t: l.t, sub: l.sub, data: l.data}; });
    return {titulo: r.titulo, total: r.total, linhas: ls};
  }
  function anexarLista(extras, mod, r, a) {
    var tit = MODN[mod] + " · " + (r.titulo || "");
    if (extras.some(function (x) { return x.tipo === "linhas" && x.titulo === tit; })) return;
    extras.push({tipo: "linhas", titulo: tit, nota: a && a.exemplo && a.exemplo() ? "dados de exemplo" : "", linhas: r.linhas.slice(0, 8).map(function (l) { return Object.assign({mod: mod}, l); }),
      mais: r.linhas.length > 8 && r.verTudo ? {rot: "Ver os " + r.total + " no " + MODN[mod], acao: function () { return abrirItem(mod, r.verTudo); }} : null});
  }
  function ferramentasIA(cartoes) {
    var MODS = ["dp", "contabil", "fiscal", "portal", "cardapio"];
    return [
      {name: "consultar", description: "Consulta dados de um módulo do Control Hub. tipo: vencimentos (entregas/prazos num período), atrasos, pendencias (aguardando o cliente), carteira (empresas por analista) ou cardapio. Datas em AAAA-MM-DD; sem datas = hoje.",
        inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, tipo: {type: "string", enum: ["vencimentos", "atrasos", "pendencias", "carteira", "cardapio"]}, de: {type: "string"}, ate: {type: "string"}, analista: {type: "string"}}, required: ["modulo", "tipo"]},
        execute: function (i) { return modulo(i.modulo).then(function (a) { if (!a) return "Módulo indisponível."; var r = a.consultar(i.tipo, {de: i.de || ymd(hoje()), ate: i.ate || i.de || ymd(hoje()), analista: i.analista || ""}); if (r && r.linhas && r.linhas.length) anexarLista(cartoes, i.modulo, r, a); if (r && a.exemplo && a.exemplo()) { r = Object.assign({}, r, {aviso: "dados de exemplo"}); } return r ? compacto(r) : "Esse módulo não tem esse tipo de consulta."; }); }},
      {name: "empresa", description: "Situação de uma empresa pelo nome ou CNPJ, em todos os módulos onde ela existe.",
        inputSchema: {type: "object", properties: {consulta: {type: "string"}}, required: ["consulta"]},
        execute: function (i) {
          return carregarTodos().then(function () {
            var es = casarEmpresas(norm(i.consulta), {});
            if (!es.length) return "Não achei empresa com esse nome/CNPJ.";
            var g = es[0].g, out = {nome: g.nome, cnpj: g.cnpj, outrasParecidas: es.slice(1, 4).map(function (x) { return x.g.nome; }), modulos: {}};
            return Promise.all(Object.keys(g.refs).map(function (m) { return modulo(m).then(function (a) { var r = a && a.consultar("empresa", {id: g.refs[m]}); if (r) { out.modulos[m] = compacto(r, 12); anexarLista(cartoes, m, {titulo: g.nome, total: r.total, linhas: r.linhas}, a); } }); })).then(function () { return out; });
          });
        }},
      {name: "analistas", description: "Lista os analistas conhecidos (nomes completos).", inputSchema: {type: "object", properties: {}}, execute: function () { return carregarTodos().then(function () { return indice().analistas; }); }},
      {name: "ajuda", description: "Busca na base de ajuda do Control Hub como usar uma função.", inputSchema: {type: "object", properties: {pergunta: {type: "string"}}, required: ["pergunta"]},
        execute: function (i) { var e = buscarAjuda(norm(i.pergunta), [], 2); return e ? {titulo: e.t, texto: e.a} : "Sem entrada na base de ajuda."; }},
      {name: "abrir", description: "Abre um módulo (e uma aba) na tela do usuário.", inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, aba: {type: "string"}}, required: ["modulo"]},
        execute: function (i) { return abrirItem(i.modulo, {aba: i.aba || "", manter: true}).then(function () { return "Aberto."; }); }},
      {name: "preparar_acao", description: "Prepara uma alteração para o usuário confirmar num cartão. NÃO grava nada: diga ao usuário que ele precisa clicar em Confirmar. tipo: etapa (marcar etapa do fechamento; informe etapa e status), fechar (concluir todas as etapas), pendencia (modo registrar/recebida/cobrado; texto = o que falta o cliente mandar), entrega (obrigação do Fiscal; informe obrigacao e status), lembrete (lembrete pessoal; texto, data AAAA-MM-DD, hora HH:MM).",
        inputSchema: {type: "object", properties: {tipo: {type: "string", enum: ["etapa", "fechar", "pendencia", "entrega", "lembrete"]}, empresa: {type: "string"}, modulo: {type: "string", enum: ["fiscal", "contabil"]}, etapa: {type: "string"}, obrigacao: {type: "string"}, status: {type: "string", enum: ["concluida", "em_andamento", "pendente", "entregue", "retificada"]}, modo: {type: "string", enum: ["registrar", "recebida", "cobrado"]}, texto: {type: "string"}, data: {type: "string"}, hora: {type: "string"}, competencia: {type: "string"}}, required: ["tipo"]},
        execute: function (i) {
          return carregarTodos().then(function () {
            var pd = {tipo: i.tipo, mod: i.modulo || "", status: {concluida: "c", entregue: "c", retificada: "r", em_andamento: "a", pendente: ""}[i.status || "concluida"], modo: i.modo, texto: i.texto, comp: i.competencia, data: i.data, hora: i.hora, mods: i.modulo ? [i.modulo] : []};
            if (i.tipo !== "lembrete") {
              var es = casarEmpresas(norm(i.empresa || ""), {});
              if (!es.length) return "Não achei essa empresa.";
              if (es.length > 1 && es[1].s >= es[0].s * 0.92) return "Empresa ambígua: " + es.slice(0, 4).map(function (x) { return x.g.nome; }).join("; ");
              pd.emp = es[0];
              if (i.tipo === "etapa" || i.tipo === "entrega") {
                var tt = limpo(norm(i.etapa || i.obrigacao || "")), mods = Object.keys(pd.emp.g.refs), ok = false;
                mods.forEach(function (m) {
                  var a = carregados[m]; if (!a || !a.vocab || ok) return; var v = a.vocab();
                  var lista = i.tipo === "entrega" ? v.obrigacoes : v.etapas; if (!lista.length) return;
                  var r = melhorPorTokens(tt, lista, function (x) { return [x.c || x.l, x.l]; });
                  if (r.item && r.pts >= 0.5) { ok = true; pd.mod = m; if (i.tipo === "entrega") pd.ob = r.item.k; else pd.etapa = r.item.k; }
                });
                if (!ok) return "Não reconheci essa " + (i.tipo === "entrega" ? "obrigação" : "etapa") + ".";
              }
            }
            return prepararAcao(pd, "").then(function (bl) {
              var c = bl.filter(function (b) { return b.tipo === "confirma"; })[0];
              if (!c) return (bl[0] && bl[0].texto) || "Não consegui preparar.";
              cartoes.push(c);
              return "Cartão de confirmação preparado (" + c.plano.titulo + ": " + (c.plano.linhas || []).join("; ") + "). Nada foi gravado: o usuário precisa clicar em Confirmar.";
            });
          });
        }}
    ];
  }
  var conversa = [], iaAviso = "", bolhaAtual = null;
  // Responde tudo pela IA (capability "sample", plano de quem usa). Devolve null quando a IA não pôde responder: aí entram as regras.
  function perguntarIA(texto) {
    if (iaOcupada) return Promise.resolve([T("Ainda estou pensando na pergunta anterior.")]);
    iaOcupada = true;
    var extras = [], tmp = null, proprio = false, dots = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>';
    if (bolhaAtual && bolhaAtual.isConnected) tmp = bolhaAtual;
    else if (msgs) { tmp = doc.createElement("div"); tmp.className = "tx-m-b"; msgs.appendChild(tmp); proprio = true; }
    if (tmp) { tmp.innerHTML = dots; rolar(); }
    var fimBolha = function (falhou) { if (!tmp) return; if (proprio) tmp.remove(); else if (falhou) tmp.innerHTML = dots; };
    var ativo = H.ativo(), nomeAtivo = MODN[ativo] || "tela inicial";
    var regras = "Você é o Tax, o assistente (mascote) do Control Hub da ControlTax, um escritório de contabilidade. Módulos: DP (departamento pessoal: empresas, funcionários, agenda, convenções, cartela de clientes), Contábil (fechamento mensal, prazos de impostos), Fiscal (obrigações acessórias, agenda de entregas, fechamento), Portal do Cliente (implantação do Onvio) e Cardápio (refeitório).\n" +
      "Hoje é " + ymd(hoje()) + " (" + hoje().toLocaleDateString("pt-BR", {weekday: "long"}) + "). A pessoa está em: " + nomeAtivo + "." + (euNome ? " Quem fala com você: " + euNome + "." : "") + "\n" +
      "Regras: responda em português do Brasil, curto e simpático (no máximo 4 frases ou uma lista curta). Use as ferramentas para qualquer dado; nunca invente empresas, datas ou números. " +
      "As consultas que você fizer aparecem para a pessoa como listas clicáveis logo abaixo da sua resposta: não repita item por item, resuma (quantos, os mais urgentes, o que fazer). " +
      "Para mudar algo (marcar etapa, entrega, pendência, fechar, lembrete) use preparar_acao: a pessoa confirma num cartão; diga que falta confirmar e nunca diga que já foi feito. " +
      "Para mostrar uma tela use abrir. Se a pergunta for sobre como usar o sistema, use ajuda. Se faltar informação (qual empresa, qual período), pergunte. Se um módulo vier marcado como dados de exemplo, avise.";
    conversa.push({role: "user", content: texto});
    if (conversa.length > 12) conversa = conversa.slice(-12);
    while (conversa.length && conversa[0].role !== "user") conversa.shift();
    var turnos = conversa.map(function (m, i) { return {role: m.role, content: i === 0 ? regras + "\n\n" + m.content : m.content}; });
    return iaNs(turnos, {tools: ferramentasIA(extras), modelTier: "quick", cache: false, onText: function (u) { if (!tmp) return; var n = tmp.querySelector(".tx-ia"); if (!n) { tmp.innerHTML = '<div class="tx-t1 tx-ia"></div>'; n = tmp.firstChild; } n.innerHTML = mdHtml(u.text); rolar(); }})
      .then(function (r) {
        fimBolha(false); iaOcupada = false;
        var txt = (r && r.text || "").trim() || "Pronto.";
        conversa.push({role: "assistant", content: txt});
        return [{tipo: "md", texto: txt}].concat(extras);
      })
      .catch(function (e) {
        fimBolha(true); iaOcupada = false;
        conversa.pop();
        var cod = e && e.code;
        if (cod === "not_granted" || cod === "tools_unavailable") { iaOk = false; iaAviso = "Sem autorização para usar a IA: respondendo pelas regras do assistente."; return null; }
        if (cod === "rate_limited") { iaAviso = "A IA está ocupada agora: respondendo pelas regras."; return null; }
        if (e && e.text) return [{tipo: "md", texto: e.text}].concat(extras);
        iaAviso = "A IA não respondeu: respondendo pelas regras."; return null;
      });
  }
  // Markdown mínimo da IA: **negrito**, listas e quebras de linha (todo o resto vira texto).
  function mdHtml(t) {
    return esc(String(t || "")).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\n)\s*[-*•]\s+/g, "$1• ").replace(/`([^`]+)`/g, "<b>$1</b>");
  }

  function quem() {
    return [T("Eu consigo:\n• responder o que vence, o que está atrasado e quem está aguardando o cliente (DP, Contábil, Fiscal e Portal);\n• mostrar a situação de uma empresa pelo nome ou CNPJ;\n• ver a carteira de um analista;\n• dizer o cardápio do dia;\n• abrir qualquer tela (“abrir a agenda do Fiscal”);\n• tirar dúvidas de como usar."),
      CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))];
  }
  function naoEntendi(p) {
    var ch = sugestoes().map(function (s) { return {rot: s, enviar: s}; });
    return [T("Não entendi bem. Tente perguntar de outro jeito, por exemplo:"), CH(ch)];
  }
  function ajuda(p) {
    var e = buscarAjuda(p.t, p.mods, 2);
    if (!e) return naoEntendi(p);
    var out = [{tipo: "ajuda", titulo: e.t, texto: e.a}];
    if (e.ir) out.push(CH([{rot: "Abrir " + (e.ir.aba ? "essa tela" : MODN[e.ir.m]), acao: function () { return abrirItem(e.ir.m, {aba: e.ir.aba}); }}]));
    return out;
  }

  /* ---------- consultas ---------- */
  var TIT_PADRAO = {vencimentos: "vencimentos", atrasos: "atrasos", cliente: "pendencias", carteira: "carteira", cardapio: "cardapio"};
  function modulosPara(p) {
    if (p.intent === "cardapio") return ["cardapio"];
    if (p.mods.length) return p.mods;
    if (p.intent === "cliente") return ["contabil", "fiscal"];
    if (p.intent === "carteira") return ["dp", "contabil", "fiscal", "portal"];
    return ["dp", "contabil", "fiscal", "portal"];
  }
  function consulta(p) {
    var per = p.per;
    if (!per) per = p.intent === "cardapio" ? {de: hoje(), ate: hoje()} : p.intent === "vencimentos" ? {de: hoje(), ate: addDias(hoje(), 7)} : {de: hoje(), ate: hoje()};
    var tipo = TIT_PADRAO[p.intent], mods = modulosPara(p);
    var pedidos = mods.map(function (k) { return modulo(k).then(function (a) { return a ? {k: k, a: a, r: a.consultar(tipo, {de: ymd(per.de), ate: ymd(per.ate), analista: p.analista})} : {k: k}; }).catch(function () { return {k: k}; }); });
    return Promise.all(pedidos).then(function (res) {
      var out = [], unico = res.filter(function (x) { return x.r; }).length === 1, nada = true;
      var cab = {vencimentos: "Datas e entregas", atrasos: "Atrasos e alertas", cliente: "Aguardando o cliente", carteira: "Carteira", cardapio: "Cardápio"}[p.intent] + (p.intent === "vencimentos" || p.intent === "cardapio" ? " · " + rotPeriodo(per) : "") + (p.analista ? " · " + p.analista : "");
      var vazios = [];
      res.forEach(function (x) {
        if (!x.r) { if (x.a === null || !x.a) vazios.push(MODN[x.k]); return; }
        var ls = x.r.linhas || [];
        if (!ls.length) { vazios.push(MODN[x.k]); return; }
        nada = false;
        var lim = unico ? 10 : 5;
        out.push({tipo: "linhas", titulo: MODN[x.k] + " · " + x.r.total, nota: x.a.exemplo && x.a.exemplo() ? "dados de exemplo" : "", linhas: ls.slice(0, lim).map(function (l) { return Object.assign({mod: x.k}, l); }),
          mais: (ls.length > lim || x.r.verTudo) ? {rot: ls.length > lim ? "Ver todas as " + x.r.total + " no " + MODN[x.k] : "Abrir no " + MODN[x.k], acao: function () { var v = x.r.verTudo || (ls[0] && ls[0].abrir && {aba: ls[0].abrir.aba, opts: ls[0].abrir.opts}) || {aba: ""}; return abrirItem(x.k, v); }} : null});
      });
      if (nada) {
        var quem = p.analista ? " para " + p.analista : "";
        return [T(p.intent === "atrasos" ? "Nada atrasado" + quem + (p.mods.length ? " nesse módulo" : "") + ". 👏" : p.intent === "cliente" ? "Ninguém aguardando o cliente" + quem + "." : p.intent === "cardapio" ? "Não achei cardápio para " + rotPeriodo(per) + "." : "Nada encontrado" + quem + " para " + rotPeriodo(per) + ".")];
      }
      out.unshift({tipo: "cab", texto: cab});
      if (vazios.length && !p.mods.length) out.push({tipo: "rodape", texto: "Sem itens em: " + vazios.join(", ") + "."});
      return out;
    });
  }

  /* ---------- empresa ---------- */
  function empresa(p, emps) {
    if (!emps.length) return Promise.resolve([T("Qual empresa? Diga o nome ou o CNPJ."), ]);
    var topo = emps[0], pares = emps.filter(function (x) { return topo.s - x.s < 0.1; });
    if (pares.length > 1 && topo.s < 1.5) return Promise.resolve([T("Achei mais de uma empresa parecida. Qual delas?"), CH(pares.slice(0, 6).map(function (x) { return {rot: x.g.nome, enviar: (RX.navegar.test(p.t) ? "abrir " : "") + x.g.nome + (x.g.cnpj ? " " + x.g.cnpj : "")}; }))]);
    var g = topo.g, ks = Object.keys(g.refs), abrir = RX.navegar.test(p.t);
    var vistos = ks.map(function (k) { return modulo(k).then(function (a) { return a ? {k: k, a: a, r: a.consultar("empresa", {id: g.refs[k]})} : {k: k}; }).catch(function () { return {k: k}; }); });
    return Promise.all(vistos).then(function (res) {
      var out = [{tipo: "cab", texto: g.nome + (g.cnpj ? " · " + g.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "")}], chips = [];
      res.forEach(function (x) {
        if (!x.r) return;
        out.push({tipo: "linhas", titulo: MODN[x.k], nota: x.a.exemplo && x.a.exemplo() ? "dados de exemplo" : "", linhas: x.r.linhas.slice(0, 8).map(function (l) { return Object.assign({mod: x.k}, l); })});
        chips.push({rot: "Abrir no " + MODN[x.k], acao: function () { return abrirItem(x.k, {empresa: g.refs[x.k], aba: x.r.abrirFicha ? x.r.abrirFicha.aba : ""}); }});
      });
      if (out.length === 1) return [T("Encontrei “" + g.nome + "”, mas os módulos não trouxeram informações dela agora.")];
      if (abrir && chips.length === 1) { chips[0].acao(); return out.concat([T("Abri a ficha para você.")]); }
      return out.concat([CH(chips)]);
    });
  }

  /* ---------- navegação ---------- */
  var OPT_ANA = {fiscal: {agenda: "ag.ana", empresas: "em.ana", fechamento: "fx.ana"}, contabil: {fechamento: "fx.ana", carteira: "ct.ana", prazos: "ob.ana"}};
  function abrirItem(mod, ab) {
    ab = ab || {};
    if (!ab.manter) fecharPainel();
    H.abrirModulo(mod);
    return modulo(mod).then(function (a) {
      if (!a) return false;
      if (ab.empresa && a.abrirEmpresa) return a.abrirEmpresa(ab.empresa, ab.aba);
      if (ab.aba || mod === "cardapio") return a.irPara(ab.aba, ab.opts);
      return true;
    });
  }
  function navegar(p) {
    var t = p.t;
    if (/\b(inicio|home|tela inicial|pagina inicial)\b/.test(t) && !p.mods.length) { fecharPainel(); H.inicio(); return Promise.resolve([T("Pronto, voltei para o início.")]); }
    var mod = p.mods[0] || H.ativo();
    if (!mod || mod === "home") return Promise.resolve([T("Para qual módulo?"), CH(H.modulos().map(function (k) { return {rot: MODN[k], enviar: "abrir " + MODN[k]}; }))]);
    return modulo(mod).then(function (a) {
      var aba = detectarAba(t, a), opts = {};
      if (aba && p.analista && OPT_ANA[mod] && OPT_ANA[mod][aba]) opts[OPT_ANA[mod][aba]] = p.analista;
      if (p.per && aba === "agenda") {
        if (mod === "fiscal") { opts["ag.mes"] = ymd(p.per.de).slice(0, 7); opts["ag.dia"] = ymd(p.per.de); }
        else if (mod === "dp") opts.dia = ymd(p.per.de);
      }
      if (mod === "cardapio" && p.per) opts.dia = ymd(p.per.de);
      var nome = MODN[mod] + (aba ? " · " + ((a.abas.filter(function (x) { return x[0] === aba; })[0] || [])[1] || aba) : "");
      return abrirItem(mod, {aba: aba, opts: opts}).then(function () { return [T("Abrindo " + nome + (p.analista ? " (" + p.analista + ")" : "") + ".")]; });
    });
  }

  /* ============ mascote ============ */
  var CEL = 4, COLS = 14, W = CEL * COLS, HM = 44;
  var el = null, painel = null, pos = {x: 0, y: 0}, fx = 0, fy = 0, tWander = 0, tSono = 0, andando = false, aberto = false, oculto = false, dormiu = false;
  /* Visuais: pixel art (cada letra é uma cor da paleta; "E" = olhos; "." = vazio). Pernas em dois quadros para o passo. */
  var SKINS = {
    laranja: {nome: "Laranjinha", body: "O", pal: {O: "#E07A3F", D: "#B2531F", E: "#241510"},
      rows: ["...OOOOOOOO...", "...OOOOOOOO...", "...OOEOOEOO...", "...OOEOOEOO...", "..OOOOOOOOOO..", "..OOOOOOOOOO..", "...OOOOOOOO...", "...OOOOOOOO...", "...DDDDDDDD..."],
      legsA: ["...O.O..O.O...", "...D.D..D.D..."], legsB: ["....O.OO.O....", "....D.DD.D...."]},
    controltax: {nome: "ControlTax", body: "B", pal: {B: "#3C659B", R: "#C2000C", E: "#101820"},
      rows: ["......RR......", "......RR......", "..BBBBBBBBBB..", "..BBBBBBBBBB..", "..BBEEBBEEBB..", "..BBEEBBEEBB..", "..BBBBBBBBBB..", "..RRRRRRRRRR..", "...BBBBBBBB..."],
      legsA: ["...BB....BB...", "...BB....BB..."], legsB: ["....BB..BB....", "....BB..BB...."]},
    fantasma: {nome: "Fantasminha", body: "G", pal: {G: "#6FC3F0", W: "#FFFFFF", E: "#1B3A8A"},
      rows: ["....GGGGGG....", "..GGGGGGGGGG..", ".GGGGGGGGGGGG.", ".GGWWGGGGWWGG.", ".GGWEGGGGWEGG.", ".GGGGGGGGGGGG.", ".GGGGGGGGGGGG.", ".GGGGGGGGGGGG.", ".GGGGGGGGGGGG."],
      legsA: [".GGG..GG..GGG.", ".GGG..GG..GGG."], legsB: [".GG..GGGG..GG.", ".GG..GGGG..GG."]},
    alien: {nome: "Alienzinho", body: "A", pal: {A: "#5FD068", E: "#10301A"},
      rows: ["..A........A..", "...A......A...", "..AAAAAAAAAA..", ".AAEEAAAAEEAA.", "AAAEEAAAAEEAAA", "AAAAAAAAAAAAAA", "A.AAAAAAAAAA.A", "A.A........A.A"],
      legsA: ["...AA....AA...", "..AA......AA.."], legsB: ["....AA..AA....", "...AA....AA..."]},
    gato: {nome: "Gatinho", body: "C", pal: {C: "#E6B15A", P: "#E87A8F", E: "#2B2B2B"},
      rows: [".C..........C.", ".CC........CC.", ".CCCCCCCCCCCC.", ".CCCCCCCCCCCC.", ".CCECCCCCCECC.", ".CCECCCCCCECC.", ".CCCCCPPCCCCC.", "..CCCCCCCCCC..", "..CCCCCCCCCC.."],
      legsA: ["..CC......CC..", "..CC......CC.."], legsB: ["...CC....CC...", "...CC....CC..."]}
  };
  var skinKey = "laranja";
  function skinDe(k) { return SKINS[k] || SKINS.laranja; }
  function altura(k) { var s = skinDe(k); return (s.rows.length + 2) * CEL; }
  function runs(linhas, y0, cor, so) {
    var out = "";
    linhas.forEach(function (ln, j) {
      for (var i = 0; i < ln.length;) {
        var ch = ln.charAt(i); if (ch === ".") { i++; continue; }
        var k = i; while (k < ln.length && ln.charAt(k) === ch) k++;
        var c = cor(ch); if (c && (!so || so(ch))) out += '<rect x="' + i + '" y="' + (y0 + j) + '" width="' + (k - i) + '" height="1" fill="' + c + '"/>';
        i = k;
      }
    });
    return out;
  }
  function svgSkin(key) {
    var s = skinDe(key), n = s.rows.length, p = s.pal;
    var corpo = runs(s.rows, 0, function (ch) { return ch === "E" ? p[s.body] : p[ch]; });
    var eo = runs(s.rows, 0, function (ch) { return p.E; }, function (ch) { return ch === "E"; });
    var ec = ""; s.rows.forEach(function (ln, j) { for (var i = 0; i < ln.length; i++) if (ln.charAt(i) === "E") ec += '<rect x="' + i + '" y="' + (j + 0.6) + '" width="1" height="0.4" fill="' + p.E + '"/>'; });
    return '<svg viewBox="0 0 ' + COLS + ' ' + (n + 2) + '" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><g>' + corpo + '</g>' +
      '<g class="tx-lA">' + runs(s.legsA, n, function (ch) { return p[ch]; }) + '</g><g class="tx-lB">' + runs(s.legsB, n, function (ch) { return p[ch]; }) + '</g>' +
      '<g class="tx-eo">' + eo + '</g><g class="tx-ec">' + ec + '</g></svg>';
  }
  var CSS = '#tx-mascote{position:fixed;left:0;top:0;width:' + W + 'px;height:var(--tx-hm,44px);z-index:525;cursor:pointer;outline:none;will-change:transform;-webkit-tap-highlight-color:transparent;user-select:none}' +
    '#tx-mascote.tx-oculto,#tx-painel.tx-oculto{display:none}#tx-mascote.tx-poof{opacity:0;transition:opacity .16s}' +
    '#tx-mascote .tx-corpo{position:absolute;inset:0}#tx-mascote .tx-face{position:absolute;inset:0}#tx-mascote.tx-esq .tx-face{transform:scaleX(-1)}' +
    '#tx-mascote .tx-sombra{position:absolute;left:8px;right:8px;bottom:-2px;height:5px;border-radius:50%;background:rgba(16,24,32,.25)}' +
    '#tx-mascote:focus-visible .tx-corpo{filter:drop-shadow(0 0 2px #6BAAC9) drop-shadow(0 0 2px #6BAAC9)}#tx-mascote:hover .tx-corpo{filter:brightness(1.1)}' +
    '#tx-mascote .tx-lB{visibility:hidden}#tx-mascote .tx-ec{visibility:hidden}' +
    '#tx-mascote.tx-andando .tx-lA{animation:txVA .34s steps(1) infinite}#tx-mascote.tx-andando .tx-lB{animation:txVB .34s steps(1) infinite}' +
    '#tx-mascote.tx-andando .tx-corpo{animation:txBob .34s steps(1) infinite}' +
    '#tx-mascote.tx-pulo .tx-lA{visibility:hidden}#tx-mascote.tx-pulo .tx-lB{visibility:visible}' +
    '#tx-mascote .tx-eo{animation:txPisca 5.5s steps(1) infinite}#tx-mascote .tx-ec{animation:txPisca2 5.5s steps(1) infinite}' +
    '#tx-mascote.tx-dorme .tx-eo{animation:none;visibility:hidden}#tx-mascote.tx-dorme .tx-ec{animation:none;visibility:visible}' +
    '#tx-mascote.tx-parado .tx-corpo{animation:txRespira 3s ease-in-out infinite}#tx-mascote.tx-acena .tx-corpo{animation:txPula .32s ease-out 4}' +
    '#tx-mascote .tx-z{position:absolute;right:-6px;top:-8px;font:700 13px Archivo,sans-serif;color:var(--blue-deep,#3C659B);opacity:0}#tx-mascote.tx-dorme .tx-z{animation:txZ 2.4s ease-out infinite}' +
    '#tx-mascote .tx-balao{position:absolute;bottom:calc(var(--tx-hm,44px) + 8px);left:50%;transform:translateX(-50%) scale(.9);transform-origin:50% 100%;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:10px;padding:6px 10px;font:600 12px "IBM Plex Sans",sans-serif;white-space:nowrap;box-shadow:0 6px 18px rgba(16,24,32,.18);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s}' +
    '#tx-mascote .tx-balao.on{opacity:1;transform:translateX(-50%) scale(1)}' +
    '@keyframes txVA{0%{visibility:visible}50%{visibility:hidden}}@keyframes txVB{0%{visibility:hidden}50%{visibility:visible}}@keyframes txBob{50%{transform:translateY(-3px)}}' +
    '@keyframes txPisca{0%,94%{visibility:visible}95%,97%{visibility:hidden}98%,100%{visibility:visible}}@keyframes txPisca2{0%,94%{visibility:hidden}95%,97%{visibility:visible}98%,100%{visibility:hidden}}' +
    '@keyframes txRespira{50%{transform:translateY(-1px)}}@keyframes txPula{40%{transform:translateY(-14px)}}@keyframes txZ{0%{opacity:0;transform:translate(0,4px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-10px)}}' +
    '@media (prefers-reduced-motion:reduce){#tx-mascote *{animation:none!important}}' +
    '#tx-painel{position:fixed;z-index:526;width:min(380px,calc(100vw - 16px));height:min(540px,calc(100vh - 24px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.32);overflow:hidden;font:13px "IBM Plex Sans",sans-serif;animation:txPainel .18s ease-out}' +
    '@keyframes txPainel{from{opacity:0;transform:translateY(8px) scale(.98)}}' +
    '#tx-painel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--rule,#DCE3E9);background:var(--surface-2,#F5F8FA)}' +
    '#tx-painel header b{font:700 14px Archivo,sans-serif;display:block;line-height:1.1}#tx-painel header small{display:block;font-size:11px;color:var(--ink-3,#5F6D77)}' +
    '#tx-painel header .tx-t{flex:1;min-width:0}#tx-painel header button{border:0;background:none;color:var(--ink-3,#5F6D77);cursor:pointer;border-radius:4px;padding:5px 7px;font:600 11.5px "IBM Plex Sans",sans-serif}#tx-painel header button:hover{background:var(--surface-3,#EAEFF3);color:var(--ink,#101820)}' +
    '#tx-skins{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid var(--rule,#DCE3E9);background:var(--surface,#fff)}#tx-skins[hidden]{display:none}' +
    '.tx-sk{display:flex;flex-direction:column;align-items:center;gap:3px;border:1px solid var(--rule,#DCE3E9);background:var(--surface-2,#F5F8FA);color:var(--ink-2,#47545F);border-radius:8px;padding:6px 8px;font:600 10.5px "IBM Plex Sans",sans-serif;cursor:pointer}.tx-sk:hover{border-color:var(--blue-deep,#3C659B)}.tx-sk.on{border-color:var(--blue-deep,#3C659B);box-shadow:inset 0 0 0 1px var(--blue-deep,#3C659B)}.tx-sk-i{width:42px;height:34px;display:block}' +
    '#tx-painel .tx-av{width:32px;height:30px;flex:none}' +
    '#tx-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}' +
    '.tx-m-u{align-self:flex-end;max-width:85%;background:var(--blue-deep,#3C659B);color:#fff;padding:7px 11px;border-radius:12px 12px 3px 12px;white-space:pre-wrap;overflow-wrap:anywhere}' +
    ':root[data-theme="dark"] .tx-m-u{color:#0B1015}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .tx-m-u{color:#0B1015}}' +
    '.tx-m-b{align-self:stretch;max-width:100%;display:flex;flex-direction:column;gap:6px}' +
    '.tx-t1{align-self:flex-start;max-width:96%;background:var(--surface-2,#F5F8FA);border:1px solid var(--rule,#DCE3E9);padding:7px 11px;border-radius:12px 12px 12px 3px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}' +
    '.tx-cab{font:700 12px Archivo,sans-serif;color:var(--ink-2,#47545F);text-transform:uppercase;letter-spacing:.04em;padding:0 2px}' +
    '.tx-bloco{border:1px solid var(--rule,#DCE3E9);border-radius:8px;overflow:hidden;background:var(--surface,#fff)}' +
    '.tx-bloco h4{margin:0;padding:6px 10px;background:var(--surface-2,#F5F8FA);border-bottom:1px solid var(--rule,#DCE3E9);font:700 12px Archivo,sans-serif;display:flex;gap:8px;align-items:baseline}' +
    '.tx-bloco h4 small{font:500 11px "IBM Plex Sans",sans-serif;color:var(--sector-fiscal,#6A4FA0)}' +
    '.tx-lin{display:grid;grid-template-columns:8px minmax(0,1fr);gap:8px;padding:7px 10px;border:0;border-top:1px solid var(--rule,#DCE3E9);width:100%;text-align:left;background:none;color:inherit;font:inherit;cursor:default}' +
    '.tx-lin:first-of-type{border-top:0}button.tx-lin{cursor:pointer}button.tx-lin:hover{background:var(--surface-2,#F5F8FA)}button.tx-lin:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:-2px}' +
    '.tx-lin i{width:8px;height:8px;border-radius:50%;margin-top:5px;background:var(--rule-strong,#C2CCD5)}.tx-lin.late i{background:var(--dp-late,#C2000C)}.tx-lin.warn i{background:var(--dp-today,#B5530C)}.tx-lin.ok i{background:var(--dp-ok,#167A45)}' +
    '.tx-lin b{display:block;font-weight:600;overflow-wrap:anywhere}.tx-lin span{display:block;font-size:11.5px;color:var(--ink-3,#5F6D77);overflow-wrap:anywhere}' +
    '.tx-mais{display:block;width:100%;border:0;border-top:1px solid var(--rule,#DCE3E9);background:var(--surface-2,#F5F8FA);color:var(--blue-deep,#3C659B);font:600 12px "IBM Plex Sans",sans-serif;padding:7px 10px;text-align:left;cursor:pointer}.tx-mais:hover{text-decoration:underline}' +
    '.tx-conf{border:1px solid var(--blue-deep,#3C659B);border-radius:8px;background:var(--surface,#fff);padding:10px 12px;display:flex;flex-direction:column;gap:5px}.tx-conf-ocupado{opacity:.6;pointer-events:none}' +
    '.tx-conf-h{font:700 12px Archivo,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--blue-deep,#3C659B)}.tx-conf-ok .tx-conf-h{color:var(--dp-ok,#167A45)}.tx-conf-erro .tx-conf-h{color:var(--dp-late,#C2000C)}.tx-conf-cancelado{border-color:var(--rule,#DCE3E9)}.tx-conf-cancelado .tx-conf-h{color:var(--ink-3,#5F6D77)}' +
    '.tx-conf-e{font-weight:700}.tx-conf-l{color:var(--ink-2,#47545F);overflow-wrap:anywhere}.tx-conf-av{font-size:11.5px;color:var(--dp-today,#B5530C)}' +
    '.tx-conf-b{display:flex;gap:6px;margin-top:4px}.tx-cb{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink,#101820);border-radius:6px;padding:6px 12px;font:600 12.5px "IBM Plex Sans",sans-serif;cursor:pointer}.tx-cb:hover{border-color:var(--blue-deep,#3C659B)}.tx-cb-ok{background:var(--blue-deep,#3C659B);border-color:var(--blue-deep,#3C659B);color:#fff}' +
    ':root[data-theme="dark"] .tx-cb-ok{color:#0B1015}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .tx-cb-ok{color:#0B1015}}' +
    '.tx-chips{display:flex;flex-wrap:wrap;gap:6px}.tx-chip{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--blue-deep,#3C659B);border-radius:14px;padding:5px 11px;font:600 12px "IBM Plex Sans",sans-serif;cursor:pointer;text-align:left}.tx-chip:hover{background:var(--blue-pale,#DCE8F1);border-color:var(--blue-deep,#3C659B)}' +
    '.tx-rod{font-size:11.5px;color:var(--ink-3,#5F6D77);padding:0 2px}' +
    '.tx-aj{border-left:3px solid var(--blue-deep,#3C659B);background:var(--surface-2,#F5F8FA);border-radius:4px 10px 10px 4px;padding:8px 11px;line-height:1.45}.tx-aj b{display:block;margin-bottom:3px;font-family:Archivo,sans-serif}' +
    '#tx-painel form{display:flex;gap:6px;padding:8px;border-top:1px solid var(--rule,#DCE3E9);background:var(--surface,#fff)}' +
    '#tx-painel form input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;font-size:13px}#tx-painel form button{border:0;border-radius:8px;background:var(--blue-deep,#3C659B);color:#fff;font:600 12.5px "IBM Plex Sans",sans-serif;padding:0 14px;cursor:pointer}' +
    ':root[data-theme="dark"] #tx-painel form button{color:#0B1015}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #tx-painel form button{color:#0B1015}}' +
    '.tx-pensa{display:inline-flex;gap:4px;padding:9px 12px}.tx-pensa i{width:6px;height:6px;border-radius:50%;background:var(--ink-3,#5F6D77);animation:txPensa 1s infinite}.tx-pensa i:nth-child(2){animation-delay:.15s}.tx-pensa i:nth-child(3){animation-delay:.3s}@keyframes txPensa{50%{transform:translateY(-4px);opacity:.4}}' +
    '@media (max-width:600px){#tx-painel{left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto;height:min(72vh,560px)}}';

  function vw() { return Math.min(doc.documentElement.clientWidth || innerWidth, innerWidth); }
  function vh() { return Math.min(doc.documentElement.clientHeight || innerHeight, innerHeight); }
  function classe(add, rem) { (rem || []).forEach(function (c) { el.classList.remove(c); }); (add || []).forEach(function (c) { el.classList.add(c); }); }
  function balao(txt, ms) {
    var b = $(".tx-balao", el); if (!b) return;
    b.textContent = txt; b.classList.add("on"); clearTimeout(b.__t); b.__t = setTimeout(function () { b.classList.remove("on"); }, ms || 3200);
  }
  function acordar() { dormiu = false; classe([], ["tx-dorme"]); clearTimeout(tSono); tSono = setTimeout(adormecer, 120000); }
  function adormecer() { if (aberto || andando) { tSono = setTimeout(adormecer, 30000); return; } dormiu = true; classe(["tx-dorme"], ["tx-acena"]); }

  /* ---------- física: o layout vira chão e parede ----------
     Plataformas = topo de cada bloco visível com fundo/borda/sombra (cartões, botões, tabelas, cabeçalhos…);
     o chão é a base da janela. O Tax anda pelo topo, sobe degraus baixos pulando, desce caindo e dá a volta em paredes altas. */
  var JUMP = 240, VEL = 78, GRAV = 1700;
  var plats = [], platT = 0, plano = null, tw = null, modo = "parado", rafId = 0, tUlt = 0, dirMov = 1, vy = 0, atual = null;
  function hw() { return W / 2 - 6; }
  function quadroVisivel() {
    var r = null;
    try { H.quadros().forEach(function (f) { try { if (!f.hidden && f.contentDocument && f.contentDocument.body) { var b = f.getBoundingClientRect(); if (b.width > 100) r = {f: f, rect: b, d: f.contentDocument}; } } catch (e) {} }); } catch (e) {}
    return r;
  }
  function minX() { var q = quadroVisivel(); return q ? Math.max(0, q.rect.left) : 0; }
  function coletar() {
    var q = quadroVisivel(), d = q ? q.d : doc, ox = q ? q.rect.left : 0, oy = q ? q.rect.top : 0, VW = vw(), VH = vh(), out = [], all, view;
    try { all = d.body.getElementsByTagName("*"); view = d.defaultView; } catch (e) { all = []; }
    var n = Math.min(all.length, 4500), mx = minX();
    for (var i = 0; i < n; i++) {
      var e = all[i];
      if (e.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
      var r = e.getBoundingClientRect(), w = r.width, h = r.height;
      if (w < 70 || h < 26 || (w > VW * 0.97 && h > VH * 0.7)) continue;
      var L = r.left + ox, T = r.top + oy, R = r.right + ox, B = r.bottom + oy;
      if (T < 44 || T > VH - 36 || R < mx + 10 || L > VW - 10) continue;
      var cs; try { cs = view.getComputedStyle(e); } catch (x) { continue; }
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.2) continue;
      var tem = false, bg = cs.backgroundColor;
      if (bg && bg !== "transparent") { var m = /rgba\([^)]*,\s*([\d.]+)\)$/.exec(bg); tem = !m || +m[1] > 0.15; }
      if (!tem && parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== "none") tem = true;
      if (!tem && cs.boxShadow && cs.boxShadow !== "none") tem = true;
      if (!tem) continue;
      if (e.closest && e.closest("#tx-mascote,#tx-painel")) continue;
      out.push({l: Math.max(mx, L), r: Math.min(VW, R), t: T, b: B});
    }
    out.sort(function (a, b) { return a.t - b.t || a.l - b.l; });
    var fim = [];
    out.forEach(function (p) { if (fim.length < 320 && !fim.some(function (o) { return Math.abs(o.t - p.t) < 3 && Math.abs(o.l - p.l) < 8 && Math.abs(o.r - p.r) < 8; })) fim.push(p); });
    fim.push({l: mx, r: VW, t: VH - 2, b: VH + 40, piso: true});
    return fim;
  }
  function atualizarPlats() { plats = coletar(); platT = Date.now(); }
  function apoio(x, y, tol) {
    var m = null, dm = 1e9;
    plats.forEach(function (p) { if (x >= p.l - 2 && x <= p.r + 2) { var dd = Math.abs(p.t - y); if (dd <= tol && dd < dm) { dm = dd; m = p; } } });
    return m;
  }
  function abaixo(x, y) {
    var m = null;
    plats.forEach(function (p) { if (x >= p.l - 2 && x <= p.r + 2 && p.t >= y + 1 && (!m || p.t < m.t)) m = p; });
    return m || plats[plats.length - 1];
  }
  function parede(d) {
    var h = hw();
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (p.piso || p.t >= fy - 6 || p.b <= fy - HM + 8) continue;
      if (fx >= p.l - 1 && fx <= p.r + 1) continue;
      if (d > 0 && fx < p.l && fx + h + 3 >= p.l) return p;
      if (d < 0 && fx > p.r && fx - h - 3 <= p.r) return p;
    }
    return null;
  }
  // Como ir da plataforma A para a B: ponto de partida em A, de chegada em B e tipo do movimento.
  function aresta(A, B) {
    var dy = A.t - B.t, h = hw() + 2, dir;
    if (dy > JUMP) return null;
    var gap;
    if (B.l >= A.r - 12) { dir = 1; gap = B.l - A.r; } else if (B.r <= A.l + 12) { dir = -1; gap = A.l - B.r; } else gap = null;
    if (gap === null && dy > 6) {
      // B mais alta e sobreposta: pula direto para cima, no trecho em comum
      var o0 = Math.max(A.l, B.l), o1 = Math.min(A.r, B.r);
      if (o1 - o0 < 2 * h) return null;
      var ox = Math.max(o0 + h, Math.min(o1 - h, (o0 + o1) / 2));
      return {tipo: "sobe", dir: 1, a: ox, b: ox};
    }
    if (dy > 6 || Math.abs(dy) <= 6) {
      if (gap === null || gap > (dy > 6 ? 70 : 80)) return null;
      return dir > 0 ? {tipo: dy > 6 ? "sobe" : "plano", dir: 1, a: A.r - 6, b: Math.min(B.r - h, B.l + 14)} : {tipo: dy > 6 ? "sobe" : "plano", dir: -1, a: A.l + 6, b: Math.max(B.l + h, B.r - 14)};
    }
    // B mais baixa: sai pela borda de A e cai
    if (B.l <= A.r + 140 && B.r >= A.r + 6 && B.r - B.l > 2 * h) return {tipo: "desce", dir: 1, a: A.r - 6, b: Math.max(B.l + h, Math.min(A.r + 26, B.r - h))};
    if (B.r >= A.l - 140 && B.l <= A.l - 6 && B.r - B.l > 2 * h) return {tipo: "desce", dir: -1, a: A.l + 6, b: Math.min(B.r - h, Math.max(A.l - 26, B.l + h))};
    return null;
  }
  function bfs(origem) {
    var prev = new Map(), fila = [origem], vis = new Set([origem]);
    while (fila.length) {
      var A = fila.shift();
      for (var i = 0; i < plats.length; i++) {
        var B = plats[i]; if (vis.has(B)) continue;
        var e = aresta(A, B); if (!e) continue;
        vis.add(B); prev.set(B, {de: A, e: e}); fila.push(B);
      }
    }
    return prev;
  }
  function passosAte(prev, origem, destino, xFinal) {
    var cadeia = [], p = destino;
    while (p && p !== origem) { var r = prev.get(p); if (!r) return null; cadeia.unshift({de: r.de, para: p, e: r.e}); p = r.de; }
    var passos = [];
    cadeia.forEach(function (c) {
      passos.push({tipo: "anda", x: c.e.a});
      var dx = c.e.b - c.e.a, desce = c.e.tipo === "desce";
      var T = desce ? Math.max(0.28, Math.sqrt(2 * Math.max(1, c.para.t - c.de.t) / GRAV)) + Math.abs(dx) / 900 : 0.42 + Math.hypot(dx, c.para.t - c.de.t) / 800;
      passos.push({tipo: "salta", x0: c.e.a, y0: c.de.t, x1: c.e.b, y1: c.para.t, T: T, arc: desce ? 12 : Math.max(24, c.de.t - c.para.t + 30), desce: desce, plat: c.para});
    });
    passos.push({tipo: "anda", x: xFinal});
    return passos;
  }
  function desenhar() {
    pos = {x: fx - W / 2, y: fy - HM};
    el.style.transform = "translate3d(" + Math.round(pos.x) + "px," + Math.round(pos.y) + "px,0)";
    if (aberto) posicionarPainel();
  }
  function parado() { modo = "parado"; andando = false; classe(["tx-parado"], ["tx-andando", "tx-pulo"]); }
  function proximoPasso() {
    if (!plano) { parado(); return; }
    var s = plano.passos.shift();
    if (!s) { var fim = plano.fim; plano = null; parado(); agendarPasseio(); if (fim) fim(); return; }
    if (s.tipo === "anda") {
      if (Math.abs(s.x - fx) < 1.5) { proximoPasso(); return; }
      modo = "anda"; andando = true; alvoX = s.x; dirMov = s.x >= fx ? 1 : -1;
      classe(["tx-andando", dirMov > 0 ? "tx-dir" : "tx-esq"], ["tx-parado", "tx-pulo", dirMov > 0 ? "tx-esq" : "tx-dir"]);
    } else {
      modo = "salta"; andando = true; tw = s; tw.t = 0; fx = s.x0; fy = s.y0; dirMov = s.x1 >= s.x0 ? 1 : -1;
      classe(["tx-pulo", dirMov > 0 ? "tx-dir" : "tx-esq"], ["tx-parado", "tx-andando", dirMov > 0 ? "tx-esq" : "tx-dir"]);
    }
    iniciarRaf();
  }
  var alvoX = 0;
  function aterrissar(p) { atual = p; fy = p.t; vy = 0; }
  function cair() {
    modo = "queda"; andando = true; vy = 0; plano = plano || null;
    classe(["tx-pulo"], ["tx-parado", "tx-andando"]);
    iniciarRaf();
  }
  function iniciarRaf() { if (!rafId) { tUlt = 0; rafId = requestAnimationFrame(tick); } }
  function tick(ts) {
    rafId = 0;
    if (doc.hidden) { if (modo !== "parado") rafId = requestAnimationFrame(tick); return; }
    var dt = tUlt ? Math.min(0.05, (ts - tUlt) / 1000) : 0.016; tUlt = ts;
    if (Date.now() - platT > 600) {
      var f0 = {x: fx, y: fy}; atualizarPlats();
      if (modo === "anda") { var ap0 = apoio(fx, fy, 40); if (ap0) { fy = ap0.t; atual = ap0; } else cair(); }
    }
    if (modo === "anda") {
      var h = hw(), mn = minX() + h, mxx = vw() - h, passo = VEL * dt * dirMov;
      var w = parede(dirMov);
      if (w) {
        if (w.t >= fy - JUMP && plano) {
          var x1 = dirMov > 0 ? Math.min(w.r - h, w.l + 14) : Math.max(w.l + h, w.r - 14), desti = plano.destino;
          var T = 0.4;
          plano.passos = [{tipo: "salta", x0: fx, y0: fy, x1: x1, y1: w.t, T: T, arc: Math.max(24, fy - w.t + 26), desce: false, plat: w}];
          plano.replanejar = desti;
          proximoPasso(); rafId = rafId || requestAnimationFrame(tick); return;
        }
        // parede alta demais: desiste do trajeto (o passeio só dá meia-volta)
        if (plano && plano.destino) { var d0 = plano.destino, f1 = plano.fim; plano = null; teletransportar(d0.x, d0.t, f1); return; }
        plano = null; parado(); agendarPasseio(); return;
      }
      var nx = fx + passo;
      if (nx < mn || nx > mxx) { plano = null; parado(); agendarPasseio(); return; }
      var chegou = (alvoX - fx) * (alvoX - (nx)) <= 0;
      fx = chegou ? alvoX : nx;
      desenhar();
      if (chegou) proximoPasso(); else rafId = requestAnimationFrame(tick);
      return;
    }
    if (modo === "salta") {
      tw.t += dt;
      var u = Math.min(1, tw.t / tw.T);
      fx = tw.x0 + (tw.x1 - tw.x0) * u;
      fy = tw.desce ? tw.y0 + (tw.y1 - tw.y0) * u * u - 4 * tw.arc * u * (1 - u) : tw.y0 + (tw.y1 - tw.y0) * u - 4 * tw.arc * u * (1 - u);
      desenhar();
      if (u >= 1) {
        fx = tw.x1; fy = tw.y1;
        var ap = apoio(fx, fy, 10);
        if (!ap) { cair(); rafId = rafId || requestAnimationFrame(tick); return; }
        aterrissar(ap); desenhar();
        if (plano && plano.replanejar) { var d1 = plano.replanejar, f2 = plano.fim, dd = plano.destino; plano.replanejar = null; plano.tent = (plano.tent || 0) + 1; if (plano.tent > 3) { plano = null; teletransportar(dd.x, dd.t, f2); return; } plano = null; irPara(dd.p, dd.x, f2, (dd.tent || 0) + 1); return; }
        proximoPasso();
      } else rafId = requestAnimationFrame(tick);
      return;
    }
    if (modo === "queda") {
      var antes = fy; vy += GRAV * dt; fy += vy * dt;
      var pouso = null;
      plats.forEach(function (p) { if (fx >= p.l - 2 && fx <= p.r + 2 && p.t >= antes - 1 && p.t <= fy + 1 && (!pouso || p.t < pouso.t)) pouso = p; });
      if (pouso) { aterrissar(pouso); desenhar(); if (plano && plano.destino && !plano.passos.length) { var q = plano.destino, f3 = plano.fim; plano = null; irPara(q.p, q.x, f3, 0); } else if (plano) proximoPasso(); else { parado(); agendarPasseio(); } return; }
      desenhar(); rafId = requestAnimationFrame(tick);
    }
  }
  function teletransportar(x, y, fim) {
    if (window.__txDebug) console.log("[tx] poof", Math.round(fx), Math.round(fy), "->", Math.round(x), Math.round(y), String(new Error().stack).split("\n")[2]);
    modo = "poof"; plano = null; andando = false;
    classe(["tx-poof"], []);
    setTimeout(function () {
      fx = x; fy = y; atual = apoio(fx, fy, 10); desenhar();
      classe([], ["tx-poof"]); parado(); agendarPasseio(); if (fim) fim();
    }, 190);
  }
  // Vai até x na plataforma `plat` (usa o grafo de plataformas; sem caminho, some e reaparece lá).
  function irPara(plat, x, fim, tent) {
    acordar(); if (!el) return;
    if (!plat) plat = plats[plats.length - 1];
    if (plats.indexOf(plat) === -1) { var q = plat; plat = null; plats.forEach(function (p) { if (!plat && Math.abs(p.t - q.t) < 4 && Math.abs(p.l - q.l) < 6 && Math.abs(p.r - q.r) < 6) plat = p; }); plat = plat || plats[plats.length - 1]; }
    var h = hw(), xf = Math.max(plat.l + h + 2, Math.min(plat.r - h - 2, x));
    if (plat.r - plat.l < 2 * h + 4) xf = (plat.l + plat.r) / 2;
    var destino = {p: plat, x: xf, t: plat.t, tent: tent || 0};
    if (reduzido()) { teletransportar(xf, plat.t, fim); return; }
    var cur = apoio(fx, fy, 8);
    if (!cur) { plano = {passos: [], fim: fim, destino: destino}; atualizarPlats(); cair(); return; }
    if (cur === plat) { plano = {passos: [{tipo: "anda", x: xf}], fim: fim, destino: destino}; proximoPasso(); return; }
    var prev = bfs(cur);
    var passos = prev.has(plat) ? passosAte(prev, cur, plat, xf) : null;
    if (!passos) { teletransportar(xf, plat.t, fim); return; }
    plano = {passos: passos, fim: fim, destino: destino};
    proximoPasso();
  }
  function parar() {
    if (modo === "parado") return;
    if (modo === "salta" && tw) { fx = tw.x1; fy = tw.y1; }
    plano = null;
    if (modo === "queda" || modo === "salta") { var ap = apoio(fx, fy, 12) || abaixo(fx, fy); fy = ap.t; atual = ap; }
    desenhar(); parado();
  }
  function destinoPara(pt) {
    var m = null;
    plats.forEach(function (p) { if (pt.x >= p.l - 18 && pt.x <= p.r + 18 && p.t >= pt.y - 14 && (!m || p.t < m.t)) m = p; });
    return m || plats[plats.length - 1];
  }
  function agendarPasseio() {
    clearTimeout(tWander);
    tWander = setTimeout(function () {
      if (!aberto && !oculto && !dormiu && modo === "parado" && !doc.hidden && !reduzido()) passear();
      else agendarPasseio();
    }, rnd(4500, 11000));
  }
  function passear() {
    atualizarPlats();
    var cur = apoio(fx, fy, 10);
    if (!cur) { cair(); return; }
    atual = cur;
    if (Math.random() < 0.4) {
      var prev = bfs(cur), alc = []; prev.forEach(function (v, k) { alc.push(k); });
      if (alc.length) { var alvo = alc[Math.floor(Math.random() * alc.length)]; irPara(alvo, rnd(alvo.l, alvo.r), null, 0); return; }
    }
    var h = hw(), lo = Math.max(cur.l + h + 2, minX() + h), hi = Math.min(cur.r - h - 2, vw() - h);
    if (hi - lo < 20) { agendarPasseio(); return; }
    var dist = rnd(50, 240) * (Math.random() < 0.5 ? -1 : 1), x = Math.max(lo, Math.min(hi, fx + dist));
    plano = {passos: [{tipo: "anda", x: x}], fim: null, destino: null};
    proximoPasso();
  }
  function chamar(pt) {
    atualizarPlats();
    var D = destinoPara(pt);
    irPara(D, pt.x, function () { classe(["tx-acena"], []); balao(["Oi! Estou aqui.", "Chamou?", "Pois não!"][Math.floor(Math.random() * 3)], 2600); setTimeout(function () { classe([], ["tx-acena"]); }, 1400); }, 0);
  }
  function reapoiar() {
    if (!el) return;
    atualizarPlats();
    if (modo !== "parado") return;
    var ap = apoio(fx, fy, 60);
    if (ap) { fy = ap.t; atual = ap; desenhar(); } else cair();
  }
  function colocarInicial() {
    atualizarPlats();
    fx = Math.max(minX() + hw(), vw() - 60); fy = plats[plats.length - 1].t; atual = plats[plats.length - 1]; desenhar();
  }
  function mostrar() { oculto = false; el.classList.remove("tx-oculto"); acordar(); }

  // Clique "vazio": nada interativo por perto (botão, link, campo, linha clicável…).
  function interativo(alvo) {
    for (var n = alvo, i = 0; n && n.nodeType === 1 && i < 10; n = n.parentElement, i++) {
      if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY|DIALOG|OPTION|IFRAME)$/.test(n.tagName)) return true;
      var r = n.getAttribute && n.getAttribute("role");
      if (r && /button|tab|link|menuitem|option|checkbox|switch|row|gridcell/.test(r)) return true;
      if (n.isContentEditable || (n.hasAttribute && n.hasAttribute("draggable") && n.getAttribute("draggable") === "true")) return true;
      var cs; try { cs = n.ownerDocument.defaultView.getComputedStyle(n); } catch (e) { continue; }
      if (/pointer|text|grab|move|help/.test(cs.cursor)) return true;
    }
    return false;
  }
  function aoClicar(ev, quadro) {
    if (ev.button || oculto || !el) return;
    var alvo = ev.target; if (!alvo || !alvo.closest) return;
    if (alvo.closest("#tx-mascote,#tx-painel,.pop,#toasts,#toast")) return;
    var sel = (ev.view || window).getSelection && (ev.view || window).getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return;
    if (interativo(alvo)) return;
    if (aberto) { fecharPainel(); return; }
    var pt = {x: ev.clientX, y: ev.clientY};
    if (quadro) { var r = quadro.getBoundingClientRect(); pt.x += r.left; pt.y += r.top; }
    chamar(pt);
  }
  function ligarQuadros() {
    H.quadros().forEach(function (f) {
      try {
        var d = f.contentDocument;
        if (!d || !d.body || d.__tx) return;
        d.__tx = 1;
        d.addEventListener("click", function (ev) { aoClicar(ev, f); });
        d.addEventListener("keydown", aoTecla);
        var ts = 0; d.addEventListener("scroll", function () { clearTimeout(ts); ts = setTimeout(reapoiar, 120); }, true);
      } catch (e) {}
    });
  }
  function algumDialogo() {
    if (doc.querySelector("dialog[open]")) return true;
    var c = $("#cmdk"); if (c && !c.hidden) return true;
    var achou = false;
    H.quadros().forEach(function (f) { try { if (!f.hidden && f.contentDocument && f.contentDocument.querySelector("dialog[open]")) achou = true; } catch (e) {} });
    return achou;
  }
  function aoTecla(ev) {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "j" || ev.key === "J")) { ev.preventDefault(); if (oculto) mostrar(); aberto ? fecharPainel() : abrirPainel(); return; }
    if (ev.key === "Escape" && aberto && !doc.querySelector("dialog[open]")) fecharPainel();
  }

  /* ============ painel de conversa ============ */
  var msgs = null, hist = [];
  function montarPainel() {
    painel = doc.createElement("section");
    painel.id = "tx-painel"; painel.setAttribute("role", "dialog"); painel.setAttribute("aria-label", "Conversa com o assistente Tax"); painel.hidden = true;
    painel.innerHTML = '<header><span class="tx-av">' + svgSkin(skinKey) + '</span><div class="tx-t"><b>Tax</b><small id="tx-sub">assistente do Control Hub · com IA</small></div><button type="button" id="tx-visual" title="Mudar o visual do Tax" aria-label="Mudar o visual do Tax">🎨 Visual</button><button type="button" id="tx-fecha" aria-label="Fechar a conversa">✕</button></header>' +
      '<div id="tx-skins" hidden></div>' +
      '<div id="tx-msgs" aria-live="polite"></div>' +
      '<form autocomplete="off"><input id="tx-in" type="text" maxlength="300" placeholder="Pergunte ou peça algo…" aria-label="Mensagem para o Tax"><button type="submit">Enviar</button></form>';
    doc.body.appendChild(painel);
    msgs = $("#tx-msgs", painel);
    $("#tx-fecha", painel).onclick = fecharPainel;
    $("#tx-visual", painel).onclick = abrirVisuais;
    $("form", painel).onsubmit = function (e) { e.preventDefault(); var i = $("#tx-in", painel), v = i.value.trim(); if (!v) return; i.value = ""; enviar(v); };
  }
  function posicionarPainel() {
    if (!painel || !aberto) return;
    var pw = Math.min(380, vw() - 16), ph = Math.min(540, vh() - 24);
    var x = pos.x + W / 2 - pw / 2, y = pos.y - ph - 10;
    if (y < 8) y = Math.min(pos.y + HM + 10, vh() - ph - 8);
    x = Math.max(8, Math.min(vw() - pw - 8, x)); y = Math.max(8, Math.min(vh() - ph - 8, y));
    painel.style.left = x + "px"; painel.style.top = y + "px";
  }
  function rolar() { msgs.scrollTop = msgs.scrollHeight; }
  function addUser(txt) { var d = doc.createElement("div"); d.className = "tx-m-u"; d.textContent = txt; msgs.appendChild(d); rolar(); }
  function addBot(blocos) {
    if (!blocos || !blocos.length) return null;
    var d = doc.createElement("div"); d.className = "tx-m-b";
    blocos.forEach(function (b) { var n = blocoDom(b); if (n) d.appendChild(n); });
    msgs.appendChild(d);
    if (d.offsetHeight > msgs.clientHeight) msgs.scrollTop = d.offsetTop - msgs.offsetTop - 6; else rolar();
    return d;
  }
  function blocoDom(b) {
    var d;
    if (b.tipo === "md") { d = doc.createElement("div"); d.className = "tx-t1"; d.innerHTML = mdHtml(b.texto); return d; }
    if (b.tipo === "texto") { d = doc.createElement("div"); d.className = "tx-t1"; d.textContent = b.texto; return d; }
    if (b.tipo === "cab") { d = doc.createElement("div"); d.className = "tx-cab"; d.textContent = b.texto; return d; }
    if (b.tipo === "rodape") { d = doc.createElement("div"); d.className = "tx-rod"; d.textContent = b.texto; return d; }
    if (b.tipo === "ajuda") { d = doc.createElement("div"); d.className = "tx-aj"; d.innerHTML = "<b>" + esc(b.titulo) + "</b>" + esc(b.texto); return d; }
    if (b.tipo === "chips") {
      d = doc.createElement("div"); d.className = "tx-chips";
      b.itens.forEach(function (c) {
        var x = doc.createElement("button"); x.type = "button"; x.className = "tx-chip"; x.textContent = c.rot;
        x.onclick = function () { if (c.enviar) enviar(c.enviar); else if (c.acao) { var r = c.acao(); if (r && r.then) r.then(function (bl) { if (Array.isArray(bl)) addBot(bl); }).catch(function () {}); } };
        d.appendChild(x);
      });
      return d;
    }
    if (b.tipo === "confirma") return cartaoConfirma(b);
    if (b.tipo === "linhas") {
      d = doc.createElement("div"); d.className = "tx-bloco";
      var h = doc.createElement("h4"); h.textContent = b.titulo; if (b.nota) { var s = doc.createElement("small"); s.textContent = b.nota; h.appendChild(s); } d.appendChild(h);
      b.linhas.forEach(function (l) {
        var x = doc.createElement(l.abrir ? "button" : "div"); x.className = "tx-lin " + (l.tom || "");
        if (l.abrir) { x.type = "button"; x.title = "Abrir no " + MODN[l.mod]; x.onclick = function () { abrirItem(l.mod, l.abrir); }; }
        x.innerHTML = "<i></i><div><b>" + esc(l.t) + "</b>" + (l.sub ? "<span>" + esc(l.sub) + "</span>" : "") + "</div>";
        d.appendChild(x);
      });
      if (b.mais) { var m = doc.createElement("button"); m.type = "button"; m.className = "tx-mais"; m.textContent = b.mais.rot + " ›"; m.onclick = function () { var r = b.mais.acao(); if (r && r.then) r.catch(function () {}); }; d.appendChild(m); }
      return d;
    }
    return null;
  }

  // Cartão de confirmação: nada grava antes do clique em "Confirmar" (ou de um "sim" na conversa).
  function cartaoConfirma(b) {
    var pl = b.plano, d = doc.createElement("div"); d.className = "tx-conf";
    var ctl = {feito: false};
    function pintar(estado, msg) {
      d.innerHTML = "";
      var h = doc.createElement("div"); h.className = "tx-conf-h"; h.textContent = estado === "ok" ? "Feito" : estado === "cancelado" ? "Cancelado" : estado === "desfeito" ? "Desfeito" : estado === "erro" ? "Não consegui" : (pl.titulo || "Confirmar");
      d.appendChild(h);
      d.className = "tx-conf" + (estado ? " tx-conf-" + estado : "");
      if (estado === "ok" || estado === "erro" || estado === "desfeito") { var m = doc.createElement("div"); m.className = "tx-conf-l"; m.textContent = msg || ""; d.appendChild(m); }
      else {
        if (pl.empresa) { var em = doc.createElement("div"); em.className = "tx-conf-e"; em.textContent = pl.empresa; d.appendChild(em); }
        (pl.linhas || []).forEach(function (l) { var x = doc.createElement("div"); x.className = "tx-conf-l"; x.textContent = l; d.appendChild(x); });
        if (pl.aviso) { var av = doc.createElement("div"); av.className = "tx-conf-av"; av.textContent = pl.aviso; d.appendChild(av); }
      }
      var bt = doc.createElement("div"); bt.className = "tx-conf-b";
      function btn(rot, cls, fn) { var x = doc.createElement("button"); x.type = "button"; x.className = "tx-cb " + cls; x.textContent = rot; x.onclick = fn; bt.appendChild(x); return x; }
      if (!estado) { btn("Confirmar", "tx-cb-ok", ctl.confirmar); btn("Cancelar", "", ctl.cancelar); }
      else if (estado === "ok" && pl.desfazer) btn("Desfazer", "", ctl.desfazer);
      if (bt.children.length) d.appendChild(bt);
    }
    ctl.confirmar = function () {
      if (ctl.feito) return Promise.resolve(); ctl.feito = true; if (pendente === ctl) pendente = null;
      d.classList.add("tx-conf-ocupado");
      return Promise.resolve().then(function () { return pl.executar(); }).then(function (msg) { pintar("ok", msg || "Pronto."); }, function (e) { console.error(e); pintar("erro", "Não foi possível salvar. Nada foi alterado ou a gravação falhou: confira a tela do módulo."); });
    };
    ctl.cancelar = function () { if (ctl.feito) return; ctl.feito = true; if (pendente === ctl) pendente = null; pintar("cancelado", ""); };
    ctl.desfazer = function () { d.classList.add("tx-conf-ocupado"); return Promise.resolve().then(function () { return pl.desfazer(); }).then(function () { pintar("desfeito", "Voltei ao que estava antes."); }, function () { pintar("erro", "Não consegui desfazer. Ajuste direto no módulo."); }); };
    pendente = ctl;
    pintar("", "");
    return d;
  }
  function enviar(txt) {
    addUser(txt);
    var pensa = doc.createElement("div"); pensa.className = "tx-m-b"; pensa.innerHTML = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>'; msgs.appendChild(pensa); rolar(); bolhaAtual = pensa;
    var temModulos = apisCarregadas().length >= H.modulos().length;
    var lento = setTimeout(function () { if (!temModulos && !iaOk) { var s = $(".tx-pensa", pensa); if (s) s.insertAdjacentHTML("afterend", '<span class="tx-rod" style="padding:9px 0">carregando os módulos…</span>'); } }, 900);
    responder(txt).then(function (bl) { clearTimeout(lento); pensa.remove(); hist.push({u: txt}); addBot(bl); }).catch(function (e) { clearTimeout(lento); pensa.remove(); console.error(e); addBot([T("Tive um problema para responder agora. Tente de novo em instantes.")]); });
  }
  function abrirPainel() {
    if (!painel) montarPainel();
    parar(); acordar();
    var sub = $("#tx-sub", painel); if (sub) sub.textContent = iaOk ? "assistente do Control Hub · com IA" : "assistente do Control Hub";
    aberto = true; painel.hidden = false; painel.classList.remove("tx-oculto");
    posicionarPainel();
    if (!msgs.children.length) {
      addBot([T(iaOk ? "Oi! Eu sou o Tax. Pergunte do seu jeito: prazos, atrasos, empresas, cardápio, como usar o Hub… Também abro telas e preparo alterações para você confirmar." : "Oi! Eu sou o Tax. Posso responder sobre prazos, atrasos, empresas e cardápio, abrir telas e tirar dúvidas de uso."), CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))]);
    }
    carregarTodos();
    setTimeout(function () { var i = $("#tx-in", painel); if (i) i.focus(); }, 30);
  }
  function fecharPainel() { if (!painel) return; aberto = false; painel.hidden = true; if (el) el.focus({preventScroll: true}); }


  /* ---------- visuais ---------- */
  function aplicarSkin(k) {
    if (!SKINS[k]) return;
    skinKey = k; salvarPref({skin: k});
    HM = altura(k); el.style.setProperty("--tx-hm", HM + "px");
    $(".tx-face", el).innerHTML = svgSkin(k);
    if (painel) { var av = $(".tx-av", painel); if (av) av.innerHTML = svgSkin(k); }
    reapoiar(); desenhar();
    balao("Gostei! 😄", 1600); classe(["tx-acena"], []); setTimeout(function () { classe([], ["tx-acena"]); }, 1400);
  }
  function abrirVisuais() {
    var box = $("#tx-skins", painel);
    if (!box.hidden) { box.hidden = true; return; }
    box.innerHTML = "";
    Object.keys(SKINS).forEach(function (k) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "tx-sk" + (k === skinKey ? " on" : ""); b.title = SKINS[k].nome;
      b.innerHTML = '<span class="tx-sk-i">' + svgSkin(k) + '</span><span>' + SKINS[k].nome + '</span>';
      b.onclick = function () { aplicarSkin(k); box.hidden = true; };
      box.appendChild(b);
    });
    box.hidden = false;
  }

  /* ============ início ============ */
  function iniciar() {
    iniciarIA();
    if (lerPref().dispensado) salvarPref({dispensado: ""});
    var st = doc.createElement("style"); st.id = "tx-css"; st.textContent = CSS; doc.head.appendChild(st);
    el = doc.createElement("div"); el.id = "tx-mascote"; el.className = "tx-parado"; el.setAttribute("role", "button"); el.tabIndex = 0;
    el.setAttribute("aria-label", "Abrir o assistente Tax"); el.title = "Tax, o assistente do Hub";
    skinKey = SKINS[lerPref().skin] ? lerPref().skin : "laranja"; HM = altura(skinKey); el.style.setProperty("--tx-hm", HM + "px");
    el.innerHTML = '<div class="tx-sombra"></div><div class="tx-corpo"><div class="tx-face">' + svgSkin(skinKey) + '</div></div><span class="tx-z" aria-hidden="true">z</span><div class="tx-balao" role="status"></div>';
    if (oculto) el.classList.add("tx-oculto");
    doc.body.appendChild(el);
    colocarInicial();
    el.addEventListener("click", function (e) { e.stopPropagation(); if (dormiu) { acordar(); balao("Hã? Já acordei!", 2000); return; } aberto ? fecharPainel() : abrirPainel(); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aberto ? fecharPainel() : abrirPainel(); } });
    doc.addEventListener("click", function (ev) { aoClicar(ev, null); });
    doc.addEventListener("keydown", aoTecla);
    window.addEventListener("resize", function () { reapoiar(); posicionarPainel(); });
    var tScroll = 0; doc.addEventListener("scroll", function () { clearTimeout(tScroll); tScroll = setTimeout(reapoiar, 120); }, true);
    setInterval(function () { if (modo === "parado" && !doc.hidden && !aberto) reapoiar(); }, 1500);
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) agendarPasseio(); });
    setInterval(function () {
      ligarQuadros();
      var esconde = oculto || algumDialogo();
      el.classList.toggle("tx-oculto", esconde);
      if (painel) painel.classList.toggle("tx-oculto", algumDialogo() && !aberto ? true : false);
    }, 600);
    ligarQuadros(); agendarPasseio(); acordar();
    if (!oculto && !lerPref().visto) { salvarPref({visto: 1}); setTimeout(function () { balao("Oi! Sou o Tax. Clique em mim para conversar.", 5200); classe(["tx-acena"], []); setTimeout(function () { classe([], ["tx-acena"]); }, 2000); }, 1800); }
  }

  window.__assistenteHub = {
    perguntar: function (t) { return responder(t); },
    mostrar: mostrar, abrir: abrirPainel, fechar: fecharPainel, versao: 1,
    estado: function () { return {aberto: aberto, oculto: oculto, andando: andando, dormiu: dormiu, pos: pos, modo: modo, pes: {x: fx, y: fy}, plataformas: plats.length}; },
    irPara: function (x, y) { chamar({x: x, y: y}); }, plataformas: function () { return plats.slice(); }, visual: function (k) { aplicarSkin(k); }, skins: function () { return Object.keys(SKINS); }
  };
  if (doc.body) iniciar(); else doc.addEventListener("DOMContentLoaded", iniciar);
})();
