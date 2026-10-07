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
    {t: "Chamar o assistente", k: "tax assistente mascote chamar conversar dispensar esconder voltar atalho", a: "Clique num espaço vazio da tela e eu vou até lá. Clicando em mim, abre a conversa. Para me dispensar, use “Dormir por hoje” no topo da conversa; aperte Ctrl+J para me chamar de volta a qualquer hora."}
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
    dormir: /\b(some|vai embora|dormir|esconde|tchau|dispensar|chega)\b/
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
    if (iaOk && /^(ia|ai|claude)[ :,]/.test(t)) return perguntarIA(texto.replace(/^\s*(ia|ai|claude)[ :,]+/i, ""));
    if (RX.dormir.test(t) && t.split(" ").length <= 4) { setTimeout(dormirHoje, 600); return Promise.resolve([T("Tá bom! Volto amanhã, ou é só apertar Ctrl+J. 👋")]); }
    return carregarTodos().then(quemSou).then(function () { return entender(texto, t); });
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
  function iniciarIA() {
    try {
      if (!window.claude || !window.claude.use) return;
      window.claude.use("sample").then(function (ns) {
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
  function ferramentasIA(cartoes) {
    var MODS = ["dp", "contabil", "fiscal", "portal", "cardapio"];
    return [
      {name: "consultar", description: "Consulta dados de um módulo do Control Hub. tipo: vencimentos (entregas/prazos num período), atrasos, pendencias (aguardando o cliente), carteira (empresas por analista) ou cardapio. Datas em AAAA-MM-DD; sem datas = hoje.",
        inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, tipo: {type: "string", enum: ["vencimentos", "atrasos", "pendencias", "carteira", "cardapio"]}, de: {type: "string"}, ate: {type: "string"}, analista: {type: "string"}}, required: ["modulo", "tipo"]},
        execute: function (i) { return modulo(i.modulo).then(function (a) { if (!a) return "Módulo indisponível."; var r = a.consultar(i.tipo, {de: i.de || ymd(hoje()), ate: i.ate || i.de || ymd(hoje()), analista: i.analista || ""}); return r ? compacto(r) : "Esse módulo não tem esse tipo de consulta."; }); }},
      {name: "empresa", description: "Situação de uma empresa pelo nome ou CNPJ, em todos os módulos onde ela existe.",
        inputSchema: {type: "object", properties: {consulta: {type: "string"}}, required: ["consulta"]},
        execute: function (i) {
          return carregarTodos().then(function () {
            var es = casarEmpresas(norm(i.consulta), {});
            if (!es.length) return "Não achei empresa com esse nome/CNPJ.";
            var g = es[0].g, out = {nome: g.nome, cnpj: g.cnpj, outrasParecidas: es.slice(1, 4).map(function (x) { return x.g.nome; }), modulos: {}};
            return Promise.all(Object.keys(g.refs).map(function (m) { return modulo(m).then(function (a) { var r = a && a.consultar("empresa", {id: g.refs[m]}); if (r) out.modulos[m] = compacto(r, 12); }); })).then(function () { return out; });
          });
        }},
      {name: "analistas", description: "Lista os analistas conhecidos (nomes completos).", inputSchema: {type: "object", properties: {}}, execute: function () { return carregarTodos().then(function () { return indice().analistas; }); }},
      {name: "ajuda", description: "Busca na base de ajuda do Control Hub como usar uma função.", inputSchema: {type: "object", properties: {pergunta: {type: "string"}}, required: ["pergunta"]},
        execute: function (i) { var e = buscarAjuda(norm(i.pergunta), [], 2); return e ? {titulo: e.t, texto: e.a} : "Sem entrada na base de ajuda."; }},
      {name: "abrir", description: "Abre um módulo (e uma aba) na tela do usuário.", inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, aba: {type: "string"}}, required: ["modulo"]},
        execute: function (i) { return abrirItem(i.modulo, {aba: i.aba || ""}).then(function () { return "Aberto."; }); }},
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
  function perguntarIA(texto) {
    if (!iaOk) return Promise.resolve([T("A IA não está disponível aqui.")]);
    if (iaOcupada) return Promise.resolve([T("Ainda estou pensando na pergunta anterior.")]);
    iaOcupada = true;
    var cartoes = [], tmp = null;
    if (msgs) { tmp = doc.createElement("div"); tmp.className = "tx-m-b"; tmp.innerHTML = '<div class="tx-t1 tx-ia">✨ Pensando com IA…</div>'; msgs.appendChild(tmp); rolar(); }
    var regras = "Você é o Tax, assistente do Control Hub da ControlTax (escritório contábil: DP, Contábil, Fiscal, Portal do Cliente, Cardápio). Hoje é " + ymd(hoje()) + ". Responda em português do Brasil, curto e direto, só com o que as ferramentas devolverem; nunca invente dados. Se a pessoa pedir para marcar/registrar algo, use preparar_acao (ela confirma no cartão) e avise que falta confirmar. Dados de Fiscal em modo exemplo vêm marcados como tal pelo módulo (se vier 'exemplo', avise).";
    var turnos = [{role: "user", content: regras + "\n\nPergunta: " + texto}];
    return iaNs(turnos, {tools: ferramentasIA(cartoes), modelTier: "quick", cache: false, onText: function (u) { var n = tmp && tmp.querySelector(".tx-ia"); if (n) { n.textContent = u.text; rolar(); } }})
      .then(function (r) { if (tmp) tmp.remove(); iaOcupada = false; var out = [T((r && r.text) || "Não consegui responder.")]; return out.concat(cartoes); })
      .catch(function (e) {
        if (tmp) tmp.remove(); iaOcupada = false;
        var cod = e && e.code;
        if (cod === "not_granted") { iaOk = false; return [T("Sem a autorização para usar a IA. Sigo só com as minhas regras.")]; }
        if (cod === "rate_limited") return [T("A IA recebeu perguntas demais agora. Tente de novo em instantes.")];
        var parc = e && e.text ? [T(e.text)] : [T("Não consegui usar a IA agora.")];
        return parc.concat(cartoes);
      });
  }

  function quem() {
    return [T("Eu consigo:\n• responder o que vence, o que está atrasado e quem está aguardando o cliente (DP, Contábil, Fiscal e Portal);\n• mostrar a situação de uma empresa pelo nome ou CNPJ;\n• ver a carteira de um analista;\n• dizer o cardápio do dia;\n• abrir qualquer tela (“abrir a agenda do Fiscal”);\n• tirar dúvidas de como usar."),
      CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))];
  }
  function naoEntendi(p) {
    var ch = sugestoes().map(function (s) { return {rot: s, enviar: s}; });
    if (iaOk && p && p.texto) ch.unshift({rot: "✨ Perguntar com IA", acao: function () { return perguntarIA(p.texto); }});
    return [T(iaOk && p && p.texto ? "Não entendi pelas minhas regras. Posso tentar com IA (usa o seu plano do Claude), ou tente de outro jeito:" : "Não entendi bem. Tente perguntar de outro jeito, por exemplo:"), CH(ch)];
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
    fecharPainel();
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
  var W = 56, HM = 66;
  var el = null, painel = null, pos = {x: 0, y: 0}, tAnda = 0, tWander = 0, tSono = 0, andando = false, aberto = false, oculto = false, dormiu = false;
  var SVG = '<svg viewBox="0 0 64 76" width="100%" height="100%" aria-hidden="true" focusable="false">' +
    '<g class="tx-antena"><line x1="32" y1="9" x2="32" y2="17" stroke="#47545F" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="7" r="4.2" fill="#C2000C"/></g>' +
    '<rect class="tx-pe tx-pe-e" x="20" y="62" width="10" height="12" rx="5" fill="#2B4A75"/><rect class="tx-pe tx-pe-d" x="34" y="62" width="10" height="12" rx="5" fill="#2B4A75"/>' +
    '<rect class="tx-braco tx-braco-e" x="3" y="34" width="10" height="21" rx="5" fill="#3C659B"/><rect class="tx-braco tx-braco-d" x="51" y="34" width="10" height="21" rx="5" fill="#3C659B"/>' +
    '<rect x="9" y="15" width="46" height="52" rx="21" fill="#3C659B"/><rect x="9" y="15" width="46" height="52" rx="21" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>' +
    '<rect x="15" y="21" width="34" height="28" rx="13" fill="#EAF2FA"/>' +
    '<g class="tx-olhos"><ellipse cx="25" cy="34" rx="4.2" ry="5.4" fill="#101820"/><ellipse cx="39" cy="34" rx="4.2" ry="5.4" fill="#101820"/><circle cx="26.4" cy="32" r="1.4" fill="#fff"/><circle cx="40.4" cy="32" r="1.4" fill="#fff"/></g>' +
    '<ellipse cx="20.5" cy="41" rx="3" ry="1.8" fill="#E8474B" opacity=".35"/><ellipse cx="43.5" cy="41" rx="3" ry="1.8" fill="#E8474B" opacity=".35"/>' +
    '<path class="tx-boca" d="M27.5 42.5 q4.5 4.2 9 0" stroke="#101820" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<path d="M23 59 l18 -7" stroke="#C2000C" stroke-width="4.2" stroke-linecap="round"/><path d="M31 61 l11 -4.5" stroke="#8CC6EC" stroke-width="3" stroke-linecap="round"/></svg>';
  var CSS = '#tx-mascote{position:fixed;left:0;top:0;width:' + W + 'px;height:' + HM + 'px;z-index:525;cursor:pointer;outline:none;will-change:transform;-webkit-tap-highlight-color:transparent;user-select:none}' +
    '#tx-mascote.tx-oculto,#tx-painel.tx-oculto{display:none}' +
    '#tx-mascote .tx-corpo{position:absolute;inset:0;transform-origin:50% 100%}' +
    '#tx-mascote .tx-sombra{position:absolute;left:10px;right:10px;bottom:-3px;height:7px;border-radius:50%;background:rgba(16,24,32,.28);filter:blur(2px)}' +
    '#tx-mascote:focus-visible .tx-corpo{filter:drop-shadow(0 0 0 #fff) drop-shadow(0 0 3px #6BAAC9) drop-shadow(0 0 3px #6BAAC9)}' +
    '#tx-mascote:hover .tx-corpo{filter:brightness(1.08)}' +
    '#tx-mascote .tx-pe,#tx-mascote .tx-braco,#tx-mascote .tx-olhos{transform-box:fill-box;transform-origin:center}' +
    '#tx-mascote .tx-braco-d{transform-origin:20% 15%}#tx-mascote .tx-braco-e{transform-origin:80% 15%}' +
    '#tx-mascote.tx-parado .tx-corpo{animation:txRespira 3.2s ease-in-out infinite}' +
    '#tx-mascote .tx-olhos{animation:txPisca 5.5s infinite}' +
    '#tx-mascote.tx-andando .tx-corpo{animation:txBalanca .3s ease-in-out infinite alternate}' +
    '#tx-mascote.tx-andando .tx-pe-e{animation:txPasso .3s ease-in-out infinite alternate}#tx-mascote.tx-andando .tx-pe-d{animation:txPasso .3s ease-in-out infinite alternate-reverse}' +
    '#tx-mascote.tx-andando .tx-braco-e{animation:txSwing .3s ease-in-out infinite alternate}#tx-mascote.tx-andando .tx-braco-d{animation:txSwing .3s ease-in-out infinite alternate-reverse}' +
    '#tx-mascote.tx-dir .tx-olhos{translate:2px 0}#tx-mascote.tx-esq .tx-olhos{translate:-2px 0}' +
    '#tx-mascote.tx-acena .tx-braco-d{animation:txAcena .45s ease-in-out 4 alternate}' +
    '#tx-mascote.tx-dorme .tx-olhos{animation:none;transform:scaleY(.12) translateY(3px)}#tx-mascote.tx-dorme .tx-corpo{animation:txRespira 4s ease-in-out infinite}' +
    '#tx-mascote .tx-z{position:absolute;right:-6px;top:-8px;font:700 13px Archivo,sans-serif;color:var(--blue-deep,#3C659B);opacity:0}#tx-mascote.tx-dorme .tx-z{animation:txZ 2.4s ease-out infinite}' +
    '#tx-mascote .tx-balao{position:absolute;bottom:' + (HM + 8) + 'px;left:50%;transform:translateX(-50%) scale(.9);transform-origin:50% 100%;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:10px;padding:6px 10px;font:600 12px "IBM Plex Sans",sans-serif;white-space:nowrap;box-shadow:var(--shadow-1,0 2px 8px rgba(0,0,0,.15));opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}' +
    '#tx-mascote .tx-balao.on{opacity:1;transform:translateX(-50%) scale(1)}' +
    '@keyframes txRespira{50%{transform:translateY(-2px) scaleY(1.02)}}@keyframes txPisca{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}' +
    '@keyframes txBalanca{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-3px) rotate(3deg)}}@keyframes txPasso{from{transform:translateY(0)}to{transform:translateY(-5px)}}' +
    '@keyframes txSwing{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}@keyframes txAcena{from{transform:rotate(0)}to{transform:rotate(-125deg)}}@keyframes txZ{0%{opacity:0;transform:translate(0,4px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-10px)}}' +
    '@media (prefers-reduced-motion:reduce){#tx-mascote *{animation:none!important}}' +
    '#tx-painel{position:fixed;z-index:526;width:min(380px,calc(100vw - 16px));height:min(540px,calc(100vh - 24px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.32);overflow:hidden;font:13px "IBM Plex Sans",sans-serif;animation:txPainel .18s ease-out}' +
    '@keyframes txPainel{from{opacity:0;transform:translateY(8px) scale(.98)}}' +
    '#tx-painel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--rule,#DCE3E9);background:var(--surface-2,#F5F8FA)}' +
    '#tx-painel header b{font:700 14px Archivo,sans-serif;display:block;line-height:1.1}#tx-painel header small{display:block;font-size:11px;color:var(--ink-3,#5F6D77)}' +
    '#tx-painel header .tx-t{flex:1;min-width:0}#tx-painel header button{border:0;background:none;color:var(--ink-3,#5F6D77);cursor:pointer;border-radius:4px;padding:5px 7px;font:600 11.5px "IBM Plex Sans",sans-serif}#tx-painel header button:hover{background:var(--surface-3,#EAEFF3);color:var(--ink,#101820)}' +
    '#tx-painel .tx-av{width:30px;height:34px;flex:none}' +
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
    '@media (max-width:600px){#tx-painel{left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto;height:min(72vh,560px)}#tx-mascote{transform:scale(.9)}}';

  function vw() { return doc.documentElement.clientWidth || innerWidth; }
  function vh() { return doc.documentElement.clientHeight || innerHeight; }
  function limite(x, y) { return {x: Math.max(4, Math.min(vw() - W - 4, x)), y: Math.max(4, Math.min(vh() - HM - 4, y))}; }
  function colocar(x, y) { pos = limite(x, y); el.style.transition = "none"; el.style.transform = "translate(" + pos.x + "px," + pos.y + "px)"; }
  function posicaoAtual() { var r = el.getBoundingClientRect(); return {x: r.left, y: r.top}; }
  function classe(add, rem) { (rem || []).forEach(function (c) { el.classList.remove(c); }); (add || []).forEach(function (c) { el.classList.add(c); }); }
  function balao(txt, ms) {
    var b = $(".tx-balao", el); if (!b) return;
    b.textContent = txt; b.classList.add("on"); clearTimeout(b.__t); b.__t = setTimeout(function () { b.classList.remove("on"); }, ms || 3200);
  }
  function acordar() { dormiu = false; classe([], ["tx-dorme"]); clearTimeout(tSono); tSono = setTimeout(adormecer, 120000); }
  function adormecer() { if (aberto || andando) { tSono = setTimeout(adormecer, 30000); return; } dormiu = true; classe(["tx-dorme"], ["tx-acena"]); }
  // Caminha até (x, y), com os pés no ponto; chama `fim` ao chegar.
  function andar(x, y, fim) {
    acordar();
    var a = posicaoAtual(), alvo = limite(x, y), dx = alvo.x - a.x, dy = alvo.y - a.y, dist = Math.sqrt(dx * dx + dy * dy);
    clearTimeout(tAnda);
    if (dist < 4 || reduzido()) { colocar(alvo.x, alvo.y); andando = false; classe(["tx-parado"], ["tx-andando"]); if (fim) fim(); return; }
    var dur = Math.max(350, dist / 0.16);
    andando = true;
    classe(["tx-andando", dx >= 0 ? "tx-dir" : "tx-esq"], ["tx-parado", "tx-dir", "tx-esq", "tx-acena"]);
    el.style.transition = "transform " + dur + "ms cubic-bezier(.35,.1,.3,1)";
    el.style.transform = "translate(" + alvo.x + "px," + alvo.y + "px)";
    pos = alvo;
    tAnda = setTimeout(function () { andando = false; classe(["tx-parado"], ["tx-andando", "tx-dir", "tx-esq"]); if (fim) fim(); }, dur + 30);
  }
  function parar() { if (!andando) return; var a = posicaoAtual(); clearTimeout(tAnda); colocar(a.x, a.y); andando = false; classe(["tx-parado"], ["tx-andando", "tx-dir", "tx-esq"]); }
  function agendarPasseio() {
    clearTimeout(tWander);
    tWander = setTimeout(function () {
      if (!aberto && !oculto && !dormiu && !andando && !doc.hidden && !reduzido()) andar(rnd(8, vw() - W - 8), vh() - HM - rnd(12, 110));
      agendarPasseio();
    }, rnd(6000, 15000));
  }
  function chamar(pt) {
    andar(pt.x - W / 2, pt.y - HM, function () { classe(["tx-acena"], []); balao(["Oi! Estou aqui.", "Chamou?", "Pois não!"][Math.floor(Math.random() * 3)], 2600); setTimeout(function () { classe([], ["tx-acena"]); }, 1900); });
  }
  function dormirHoje() { oculto = true; fecharPainel(); el.classList.add("tx-oculto"); salvarPref({dispensado: ymd(hoje())}); }
  function mostrar() { oculto = false; salvarPref({dispensado: ""}); el.classList.remove("tx-oculto"); colocar(vw() - W - 24, vh() - HM - 16); acordar(); }

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
    painel.innerHTML = '<header><span class="tx-av">' + SVG + '</span><div class="tx-t"><b>Tax</b><small id="tx-sub">assistente do Control Hub</small></div><button type="button" id="tx-dorme" title="Esconde o assistente até amanhã (Ctrl+J chama de volta)">Dormir por hoje</button><button type="button" id="tx-fecha" aria-label="Fechar a conversa">✕</button></header>' +
      '<div id="tx-msgs" aria-live="polite"></div>' +
      '<form autocomplete="off"><input id="tx-in" type="text" maxlength="300" placeholder="Pergunte ou peça algo…" aria-label="Mensagem para o Tax"><button type="submit">Enviar</button></form>';
    doc.body.appendChild(painel);
    msgs = $("#tx-msgs", painel);
    $("#tx-fecha", painel).onclick = fecharPainel;
    $("#tx-dorme", painel).onclick = dormirHoje;
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
    var pensa = doc.createElement("div"); pensa.className = "tx-m-b"; pensa.innerHTML = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>'; msgs.appendChild(pensa); rolar();
    var temModulos = apisCarregadas().length >= H.modulos().length;
    var lento = setTimeout(function () { if (!temModulos) { var s = $(".tx-pensa", pensa); if (s) s.insertAdjacentHTML("afterend", '<span class="tx-rod" style="padding:9px 0">carregando os módulos…</span>'); } }, 900);
    responder(txt).then(function (bl) { clearTimeout(lento); pensa.remove(); hist.push({u: txt}); addBot(bl); }).catch(function (e) { clearTimeout(lento); pensa.remove(); console.error(e); addBot([T("Tive um problema para responder agora. Tente de novo em instantes.")]); });
  }
  function abrirPainel() {
    if (!painel) montarPainel();
    parar(); acordar();
    aberto = true; painel.hidden = false; painel.classList.remove("tx-oculto");
    posicionarPainel();
    if (!msgs.children.length) {
      addBot([T("Oi! Eu sou o Tax. Posso responder sobre prazos, atrasos, empresas e cardápio, abrir telas e tirar dúvidas de uso."), CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))]);
    }
    carregarTodos();
    setTimeout(function () { var i = $("#tx-in", painel); if (i) i.focus(); }, 30);
  }
  function fecharPainel() { if (!painel) return; aberto = false; painel.hidden = true; if (el) el.focus({preventScroll: true}); }

  /* ============ início ============ */
  function iniciar() {
    iniciarIA();
    if (lerPref().dispensado === ymd(hoje())) oculto = true;
    var st = doc.createElement("style"); st.id = "tx-css"; st.textContent = CSS; doc.head.appendChild(st);
    el = doc.createElement("div"); el.id = "tx-mascote"; el.className = "tx-parado"; el.setAttribute("role", "button"); el.tabIndex = 0;
    el.setAttribute("aria-label", "Abrir o assistente Tax"); el.title = "Tax, o assistente do Hub";
    el.innerHTML = '<div class="tx-sombra"></div><div class="tx-corpo">' + SVG + '</div><span class="tx-z" aria-hidden="true">z</span><div class="tx-balao" role="status"></div>';
    if (oculto) el.classList.add("tx-oculto");
    doc.body.appendChild(el);
    colocar(vw() - W - 24, vh() - HM - 16);
    el.addEventListener("click", function (e) { e.stopPropagation(); if (dormiu) { acordar(); balao("Hã? Já acordei!", 2000); return; } aberto ? fecharPainel() : abrirPainel(); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aberto ? fecharPainel() : abrirPainel(); } });
    doc.addEventListener("click", function (ev) { aoClicar(ev, null); });
    doc.addEventListener("keydown", aoTecla);
    window.addEventListener("resize", function () { colocar(pos.x, pos.y); posicionarPainel(); });
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
    estado: function () { return {aberto: aberto, oculto: oculto, andando: andando, dormiu: dormiu, pos: pos}; }
  };
  if (doc.body) iniciar(); else doc.addEventListener("DOMContentLoaded", iniciar);
})();
