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
  function lerLS(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nomeTax() { return String(lerPref().nome || "Tax").trim().slice(0, 20) || "Tax"; }
  // Quem pode ver tudo (coordenação/editores do artefato): sem isso, CPFs aparecem mascarados nas respostas.
  var podeVerTudo = false, ehCoord = false;
  function mascarar(s) { return podeVerTudo ? String(s == null ? "" : s) : String(s == null ? "" : s).replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**"); }
  // Uso da IA por dia (neste navegador).
  var USO = "tx-uso-v1";
  function usoHoje() { var u = lerLS(USO, {}); return u.dia === ymd(hoje()) ? +u.n || 0 : 0; }
  function contarUso() { var n = usoHoje() + 1; gravarLS(USO, {dia: ymd(hoje()), n: n}); gravarLS("tx-uso-tot", (+lerLS("tx-uso-tot", 0) || 0) + 1); return n; }
  // Configuração da equipe (banco do Hub, editada pela coordenação; ver lote "equipe").
  var cfgEquipe = {limiteDia: 0, instrucoes: ""};
  function copiarTexto(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return copiarVelho(t); }); } catch (e) {}
    return Promise.resolve(copiarVelho(t));
  }
  function copiarVelho(t) { try { var a = doc.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;left:-9999px"; doc.body.appendChild(a); a.select(); var ok = doc.execCommand("copy"); a.remove(); return ok; } catch (e) { return false; } }
  var dlNs = null;
  function usarDownloads() { if (dlNs !== null) return Promise.resolve(dlNs); try { return window.claude && window.claude.use ? window.claude.use("downloads").then(function (d) { dlNs = d || false; return dlNs; }, function () { dlNs = false; return false; }) : Promise.resolve(false); } catch (e) { return Promise.resolve(false); } }
  function salvarArquivo(nome, blob) {
    return usarDownloads().then(function (d) {
      if (d) return d.save({filename: nome, data: blob}).then(function () { return true; }, function () { return false; });
      try { var a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return true; } catch (e) { return false; }
    });
  }
  // Planilha de uma lista de linhas {t, sub, data, mod}: .xlsx quando o leitor de planilhas já está carregado no Hub, senão .csv (abre no Excel).
  function exportarLinhas(titulo, linhas) {
    var cab = ["Item", "Detalhe", "Data", "Módulo"];
    var rows = linhas.map(function (l) { return [mascarar(l.t), mascarar(l.sub || ""), l.data ? l.data.split("-").reverse().join("/") : "", MODN[l.mod] || ""]; });
    var nome = (norm(titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lista").slice(0, 60) + "-" + ymd(hoje());
    if (window.XLSX && window.XLSX.utils) {
      try {
        var ws = XLSX.utils.aoa_to_sheet([cab].concat(rows)), wb = XLSX.utils.book_new();
        ws["!cols"] = [{wch: 48}, {wch: 60}, {wch: 12}, {wch: 16}];
        XLSX.utils.book_append_sheet(wb, ws, "Lista");
        var buf = XLSX.write(wb, {type: "array", bookType: "xlsx"});
        return salvarArquivo(nome + ".xlsx", new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      } catch (e) {}
    }
    var csv = "﻿" + [cab].concat(rows).map(function (r) { return r.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n");
    return salvarArquivo(nome + ".csv", new Blob([csv], {type: "text/csv;charset=utf-8"}));
  }

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
    if (/\b(proxima quinzena|proximos 15 dias)\b/.test(t)) return {de: h, ate: addDias(h, 15)};
    if (/\b(ate o )?fim do mes\b/.test(t)) return {de: h, ate: new Date(h.getFullYear(), h.getMonth() + 1, 0)};
    if ((m = /\bate o dia (\d{1,2})\b/.exec(t)) && +m[1] >= 1 && +m[1] <= 31) { var lim = new Date(h.getFullYear(), h.getMonth(), +m[1]); if (lim < h) lim = new Date(h.getFullYear(), h.getMonth() + 1, +m[1]); return {de: h, ate: lim}; }
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
  // Distância de edição com corte (para erros de digitação: "contrutora" ≈ "construtora").
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var ant = [], cur, i, j;
    for (j = 0; j <= b.length; j++) ant[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var menor = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); if (cur[j] < menor) menor = cur[j]; }
      if (menor > max) return max + 1;
      ant = cur;
    }
    return ant[b.length];
  }
  function parecido(a, b) {
    if (a === b) return true;
    var m = Math.min(a.length, b.length); if (m < 5) return false;
    var i = 0; while (i < m && a.charAt(i) === b.charAt(i)) i++;
    if (i >= 5 && i >= m - 2) return true;
    if (a.charAt(0) !== b.charAt(0)) return false;
    var lim = m >= 8 ? 2 : 1;
    return lev(a, b, lim) <= lim;
  }
  // Empresas citadas na frase, da mais provável para a menos. `ignorar`: nomes de analistas já reconhecidos.
  function casarEmpresas(t, ignorar) {
    var ix = indice(), toks = t.split(" ").filter(Boolean), dig = (t.replace(/[^\d ]/g, "").match(/\d{8,14}/) || [])[0], out = [];
    var tt0 = " " + t + " ";
    Object.keys(apelidos).forEach(function (k) {
      if (tt0.indexOf(" " + k + " ") === -1) return;
      var ap = apelidos[k], g0 = ix.empresas.filter(function (g) { return (ap.cnpj && g.cnpj === ap.cnpj) || norm(g.nome) === norm(ap.empresa); })[0];
      if (g0) out.push({g: g0, s: 3, apelido: true});
    });
    ix.empresas.forEach(function (g) {
      if (out.some(function (o) { return o.g === g; })) return;
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
    {t: "Ações do DP pelo assistente", m: "dp", k: "dp trocar responsavel carteira passar transferir analista ausencia ferias afastamento licenca cobertura cobre anotar historico nota empresa tax assistente", a: "No DP eu também faço: “passa a Importbras para o Bruno” (troca o responsável), “anota no histórico da Importbras: cliente manda as variáveis dia 25” e “registra férias da Maria de 10/11 a 25/11, o Bruno cobre” (ausência com cobertura na Cartela). Mostro um cartão com o que vai mudar e só gravo depois do Confirmar; dá para Desfazer em seguida. Quem só consulta o DP não consegue gravar. Se a empresa estiver em mais de um módulo, eu pergunto em qual."},
    {t: "Login e níveis de acesso", k: "login senha entrar sair acesso nivel niveis permissao coordenador analista consulta administrador usuario cadastro trocar senha esqueci", a: "O Hub tem login próprio, separado da conta do Claude. Quem ainda não tem conta cria uma na tela de entrada e espera o administrador liberar. Cada pessoa tem um nível por módulo: Coordenador (edita tudo no módulo), Analista (edita só a própria carteira, pelo nome de analista ligado ao usuário) e Consulta (só vê). Sem nível, o módulo some do Hub. Para trocar a senha ou sair, clique no seu avatar (canto da tela inicial ou barra lateral). Esqueceu a senha? Peça ao administrador uma senha provisória: você será obrigado a trocá-la ao entrar. O administrador gerencia tudo em Usuários."},
    {t: "Comandos rápidos do assistente", k: "comandos barra atalho slash hoje semana atrasos carga desfazer glossario", a: "No chat, digite / para ver os comandos: /hoje, /semana, /atrasos, /cliente, /cardapio, /empresa nome, /abrir tela, /carga (carga por analista), /glossario termo, /desfazer (desfaz o que eu gravei na última hora), /limpar e /config. Eles respondem na hora, sem gastar IA."},
    {t: "Ações em lote pelo assistente", k: "lote varias empresas todas de uma vez marcar em lote", a: "Peça, por exemplo, “marca o PGDAS-D como entregue para todas do Bruno” ou “marca a guia do DAS como enviada para as empresas X, Y e Z”. Eu mostro um cartão com a lista de tudo o que vai mudar; só gravo depois do Confirmar, e o Desfazer volta tudo."},
    {t: "Apelidos de empresas", k: "apelido apelidos nome curto padaria", a: "Diga “a padaria do centro é a Panificadora Silva” e eu guardo o apelido (com confirmação) para toda a equipe usar nas próximas perguntas."},
    {t: "Busca global", k: "busca buscar pesquisar atalho procurar ctrl k", a: "Aperte “/” ou Ctrl+K em qualquer tela do Hub para buscar empresas, funcionários, lembretes e ferramentas. A última opção da busca manda o texto como pergunta para o assistente."},
    {t: "Tema claro e escuro", k: "tema escuro claro dark noite", a: "Use o botão “Tema” na barra lateral (ou a tecla T na tela inicial) para alternar entre claro e escuro."},
    {t: "Chamar o assistente", k: "tax assistente mascote chamar conversar atalho", a: "Eu ando pela tela como se o layout fosse chão e parede: caminho pelo topo dos cartões e botões, pulo degraus e caio quando o chão some. Clique num espaço vazio e eu vou até lá. Clicando em mim, abre a conversa; em “🎨 Visual” você troca o meu desenho. Aperte Ctrl+J para abrir a conversa a qualquer hora."}
  ];
  // Glossário do setor (respondido sem IA; a IA também consulta).
  var GLOSSARIO = {
    "das": "DAS: Documento de Arrecadação do Simples Nacional, a guia mensal que paga os tributos do Simples. Vence no dia 20 do mês seguinte.",
    "pgdas-d": "PGDAS-D: programa onde se apura o Simples Nacional do mês e se gera o DAS. Entregue até o dia 20 do mês seguinte.",
    "defis": "DEFIS: Declaração de Informações Socioeconômicas e Fiscais, anual, das empresas do Simples Nacional (até 31 de março).",
    "dctfweb": "DCTFWeb: declaração mensal dos débitos previdenciários e de terceiros (vindos do eSocial e da EFD-Reinf); gera a DARF de INSS.",
    "dctf": "DCTF: Declaração de Débitos e Créditos Tributários Federais (IRPJ, CSLL, PIS, COFINS, IPI…) para empresas fora do Simples.",
    "efd-reinf": "EFD-Reinf: escrituração das retenções e outras informações fiscais (serviços tomados com retenção, CPRB…); alimenta a DCTFWeb.",
    "reinf": "EFD-Reinf: escrituração das retenções e outras informações fiscais (serviços tomados com retenção, CPRB…); alimenta a DCTFWeb.",
    "efd icms ipi": "EFD ICMS/IPI (SPED Fiscal): escrituração mensal de entradas, saídas e apuração do ICMS e do IPI.",
    "sped fiscal": "SPED Fiscal (EFD ICMS/IPI): escrituração mensal de entradas, saídas e apuração do ICMS e do IPI.",
    "efd contribuicoes": "EFD-Contribuições: escrituração mensal do PIS e da COFINS (Lucro Presumido e Real).",
    "sped": "SPED: Sistema Público de Escrituração Digital, o conjunto de arquivos digitais (ECD, ECF, EFD…) enviados à Receita.",
    "ecd": "ECD: Escrituração Contábil Digital, os livros contábeis (Diário e Razão) em formato digital; anual.",
    "ecf": "ECF: Escrituração Contábil Fiscal, anual, com a apuração do IRPJ e da CSLL (substituiu a DIPJ).",
    "esocial": "eSocial: sistema que reúne as informações trabalhistas, previdenciárias e fiscais dos empregados (admissões, folha, afastamentos, desligamentos).",
    "fgts digital": "FGTS Digital: plataforma do governo para apurar e emitir as guias do FGTS a partir das informações do eSocial.",
    "fgts": "FGTS: Fundo de Garantia do Tempo de Serviço, 8% da remuneração depositados mensalmente pelo empregador (pelo FGTS Digital).",
    "darf": "DARF: Documento de Arrecadação de Receitas Federais, a guia para pagar tributos federais.",
    "dirf": "DIRF: declaração anual do imposto retido na fonte. Foi substituída pelo eSocial e pela EFD-Reinf a partir de 2025.",
    "rais": "RAIS: relação anual de informações sociais; hoje substituída pelo eSocial para quem já o envia.",
    "caged": "CAGED: cadastro de admitidos e desligados; hoje as informações vêm do eSocial.",
    "icms": "ICMS: imposto estadual sobre circulação de mercadorias e alguns serviços (transporte, comunicação).",
    "icms st": "ICMS-ST (substituição tributária): o ICMS de toda a cadeia é recolhido antecipadamente por um contribuinte (normalmente o fabricante ou importador).",
    "difal": "DIFAL: diferencial de alíquota do ICMS em operações interestaduais para consumidor final.",
    "iss": "ISS: Imposto Sobre Serviços, municipal; cada prefeitura define alíquotas, prazos e declarações.",
    "ipi": "IPI: Imposto sobre Produtos Industrializados, federal, para indústrias e equiparadas.",
    "pis": "PIS: contribuição federal sobre o faturamento (cumulativo no Presumido, não cumulativo no Real).",
    "cofins": "COFINS: contribuição federal sobre o faturamento (cumulativa no Presumido, não cumulativa no Real).",
    "irpj": "IRPJ: Imposto de Renda da Pessoa Jurídica, trimestral ou anual (Presumido e Real).",
    "csll": "CSLL: Contribuição Social sobre o Lucro Líquido, apurada junto com o IRPJ.",
    "simples nacional": "Simples Nacional: regime unificado para micro e pequenas empresas, com uma guia só (DAS) e limite de faturamento de R$ 4,8 milhões por ano.",
    "lucro presumido": "Lucro Presumido: regime em que IRPJ e CSLL são calculados sobre uma margem de lucro presumida do faturamento.",
    "lucro real": "Lucro Real: regime em que IRPJ e CSLL são calculados sobre o lucro contábil ajustado; obrigatório acima de R$ 78 milhões de faturamento e para algumas atividades.",
    "mei": "MEI: Microempreendedor Individual, faturamento até R$ 81 mil por ano, paga um valor fixo mensal (DAS-MEI) e entrega a DASN-SIMEI anual.",
    "destda": "DeSTDA: declaração mensal do ICMS-ST, DIFAL e antecipação para empresas do Simples Nacional.",
    "gia": "GIA: Guia de Informação e Apuração do ICMS, declaração estadual (em alguns estados substituída pela EFD).",
    "nfe": "NF-e: Nota Fiscal Eletrônica de produtos (modelo 55).",
    "nfse": "NFS-e: Nota Fiscal de Serviços Eletrônica, emitida no padrão da prefeitura ou no padrão nacional.",
    "cct": "CCT: Convenção Coletiva de Trabalho, acordo entre sindicatos patronal e de empregados com piso, reajuste e regras da categoria; tem vigência e data-base.",
    "data-base": "Data-base: mês do ano em que a categoria negocia o reajuste salarial da convenção coletiva.",
    "data base": "Data-base: mês do ano em que a categoria negocia o reajuste salarial da convenção coletiva.",
    "periodo aquisitivo": "Período aquisitivo: os 12 meses de trabalho que dão direito a 30 dias de férias.",
    "periodo concessivo": "Período concessivo: os 12 meses seguintes ao aquisitivo, dentro dos quais a empresa precisa conceder as férias; depois disso são devidas em dobro.",
    "aviso previo": "Aviso prévio: 30 dias, mais 3 dias por ano completo trabalhado na empresa, até 90 dias (Lei 12.506/2011).",
    "rpa": "RPA: Recibo de Pagamento a Autônomo, usado para pagar quem presta serviço sem vínculo (com retenção de INSS e IR quando cabíveis).",
    "pro-labore": "Pró-labore: remuneração dos sócios pelo trabalho na empresa, com INSS de 11% do sócio e contribuição patronal conforme o regime.",
    "competencia": "Competência: o mês a que os fatos se referem (ex.: a competência 09/2026 é fechada e paga em outubro).",
    "escrituracao": "Escrituração: lançar e organizar os documentos (notas, extratos) nos livros fiscais ou contábeis.",
    "apuracao": "Apuração: calcular quanto de imposto é devido no período a partir da escrituração.",
    "balancete": "Balancete: relatório com os saldos das contas contábeis num período, usado para conferir o fechamento.",
    "onvio": "Onvio: portal da Thomson Reuters (Domínio) onde o cliente acessa e envia documentos; acompanhado no módulo Portal do Cliente.",
    "dominio": "Domínio: sistema contábil da Thomson Reuters usado pelo escritório (folha, escrita fiscal, contabilidade)."
  };
  function buscarGlossario(t) {
    var tt = " " + norm(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ", melhor = "", tam = 0;
    Object.keys(GLOSSARIO).forEach(function (k) { var kk = " " + k.replace(/-/g, " ") + " "; if (tt.indexOf(kk) !== -1 && k.length > tam) { melhor = k; tam = k.length; } });
    return melhor ? GLOSSARIO[melhor] : "";
  }
  var VAZIAS = " como funciona funcionam faco fazer posso fazemos qual quais onde fica para pra isso esse essa esta uma uns que sobre tenho duvida quero saber preciso usar uso ";
  function buscarAjuda(t, mods, minimo) {
    var toks = t.split(" ").filter(function (w) { return w.length >= 3 && VAZIAS.indexOf(" " + w + " ") === -1; }), melhor = null, pts = 0;
    AJUDA.concat(ajudaEquipe).forEach(function (e) {
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
  function AUTH() { return window.__auth || null; }
  function quemSou() {
    if (euNome !== null) return Promise.resolve(euNome);
    if (AUTH() && AUTH().usuario()) { euNome = AUTH().usuario().nome || ""; return Promise.resolve(euNome); }
    try {
      if (!window.claude || !window.claude.use) { euNome = ""; return Promise.resolve(""); }
      return window.claude.use("user").then(function (u) { return u && u.name ? u.name() : ""; }).catch(function () { return ""; }).then(function (n) { euNome = n || ""; return euNome; });
    } catch (e) { euNome = ""; return Promise.resolve(""); }
  }
  function casarEu(nomes) {
    // com login do Hub, vale o nome de analista ligado à pessoa em algum módulo
    if (AUTH() && AUTH().usuario()) {
      var lig = ["dp", "contabil", "fiscal", "portal"].map(function (m) { return AUTH().analista(m); }).filter(Boolean);
      for (var q = 0; q < lig.length; q++) { var achou = nomes.filter(function (n) { return norm(n) === norm(lig[q]); })[0]; if (achou) return achou; }
    }
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
  // op: {forcarIA, imagens, oculto (texto que vai para a IA no lugar do digitado)}
  function responder(texto, op) {
    op = op || {};
    var t = norm(texto);
    if (!t) return Promise.resolve([T("Pode escrever a pergunta que eu respondo.")]);
    if (pendente && /^(sim|confirmo|confirma|confirmar|pode|pode sim|ok|isso|isso mesmo|manda ver|faz)$/.test(t)) { var c1 = pendente; return c1.confirmar().then(function () { return []; }); }
    if (pendente && /^(nao|cancela|cancelar|deixa|deixa pra la|esquece)$/.test(t)) { var c2 = pendente; c2.cancelar(); return Promise.resolve([]); }
    var porRegras = function (aviso) { return carregarTodos().then(quemSou).then(function () { return entender(texto, t); }).then(function (bl) { return aviso ? [{tipo: "rodape", texto: aviso}].concat(bl) : bl; }); };
    return Promise.all([iaPronta, quemSou()]).then(function () {
      if (!iaOk) return op.imagens && op.imagens.length ? [T("Para ler imagens eu preciso da IA, que não está disponível agora.")] : porRegras("");
      var lim = +cfgEquipe.limiteDia || 0;
      if (lim && usoHoje() >= lim && !op.forcarIA) return porRegras("Limite de " + lim + " perguntas à IA por dia atingido (definido pela coordenação): respondendo pelas regras.");
      var viaIA = function () { return perguntarIA(op.oculto || texto, op).then(function (bl) { return bl || porRegras(iaAviso); }); };
      if (lerPref().economia && !op.forcarIA && !(op.imagens && op.imagens.length)) {
        return carregarTodos().then(function () { return entender(texto, t); }).then(function (bl) {
          if (!bl || bl.naoEntendi) return viaIA();
          return bl.concat([{tipo: "rodape", texto: "Modo economia: respondido sem IA."}, CH([{rot: "Perguntar à IA", enviar: texto, forcarIA: true}])]);
        });
      }
      return viaIA();
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

    var pedido = (!/^(como|onde|qual|quais|quando|quem|o que|por que|porque|quanto)\b/.test(t) && texto.indexOf("?") === -1) ? detectarAcao(t, texto, emps, mods, per, anaMatch) : null;
    if (pedido) return prepararAcao(pedido, texto);
    var gl = buscarGlossario(t);
    if (gl && (/^(o que (e|eh|sao|significa)|significad|o que quer dizer|que e|qual o significado|define|definicao)/.test(t) || t.split(" ").length <= 3)) {
      return Promise.resolve([{tipo: "ajuda", titulo: "Glossário", texto: gl}]);
    }

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
    if (!intent && (anaMatch.length || per || mods.length) && ctx.intent && ctx.intent !== "empresa" && ["saudacao", "obrigado", "quem", "ajuda"].indexOf(ctx.intent) === -1) intent = ctx.intent;      // "e do Bruno?", "e amanhã?"
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
  // Em que módulo agir quando a empresa existe em mais de um: o citado na frase, o que está aberto ou, se só há um, ele; senão pergunta.
  function alvoModulo(mods, e) {
    var ok = ["dp", "fiscal", "contabil"], refs = Object.keys(e.g.refs).filter(function (m) { return ok.indexOf(m) !== -1; });
    var ex = (mods || []).filter(function (m) { return ok.indexOf(m) !== -1; });
    if (ex.length === 1) return {mod: ex[0]};
    var cand = ex.length ? ex : refs;
    if (cand.length === 1) return {mod: cand[0]};
    var at = H.ativo(); if (cand.indexOf(at) !== -1) return {mod: at};
    return cand.length ? {ambig: cand} : {mod: "dp"};
  }
  function detectarAcao(t, texto, emps, mods, per, anaMatch) {
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
    // ---- DP: ausência de analista (férias, afastamento, licença) com cobertura; não precisa de empresa ----
    var anas = anaMatch || [], dts = [], rxd = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, md;
    while ((md = rxd.exec(t))) if (+md[1] >= 1 && +md[1] <= 31 && +md[2] >= 1 && +md[2] <= 12) dts.push(md);
    var mAus = /\b(ferias|afastament\w*|licenca|atestado|ausenc\w*)\b/.exec(t);
    if (anas.length && mAus && !/\b(mostr\w*|ver|veja|lista\w*|consult\w*|quais|quem|qual)\b/.test(t) && (dts.length >= 2 || /\b(registr\w*|cadastr\w*|lanc\w*|marc\w*|coloc\w*|poe|anot\w*|agend\w*|cri(a|e|ar)|adicion\w*|programa\w*)\b/.test(t))) {
      var toks = t.split(" "), ausente = "", cobre = "";
      var iNome = function (n) { var f = norm(n).split(" ")[0]; return toks.indexOf(f); };
      if (anas.length === 1) ausente = anas[0];
      else if (anas.length === 2) {
        var cue = -1; toks.forEach(function (w, q) { if (cue < 0 && /^(cobre|cobrindo|cobertura|cobrir|substitui\w*|substituto|substituta|lugar)$/.test(w)) cue = q; });
        var i0 = iNome(anas[0]), i1 = iNome(anas[1]);
        if (cue >= 0 && i0 >= 0 && i1 >= 0 && Math.abs(i0 - cue) !== Math.abs(i1 - cue)) { if (Math.abs(i0 - cue) < Math.abs(i1 - cue)) { cobre = anas[0]; ausente = anas[1]; } else { cobre = anas[1]; ausente = anas[0]; } }
      }
      if (!ausente) return {tipo: "pergunta", texto: anas.length > 1 ? "Quem vai se ausentar e quem cobre? Por exemplo: “registra férias da Maria de 10/11 a 25/11, o Bruno cobre”." : "Qual analista vai se ausentar?"};
      var h0 = hoje(), mkD = function (m, minD) { var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : h0.getFullYear(), d = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && minD && d < minD) d = new Date(y + 1, +m[2] - 1, +m[1]); return d; };
      var ini = "", fim = "";
      if (dts.length) { var d1 = mkD(dts[0], addDias(h0, -60)), d2 = dts.length > 1 ? mkD(dts[1], d1) : d1; ini = ymd(d1); fim = ymd(d2); }
      var mot = /^ferias/.test(mAus[1]) ? "ferias" : /^(afastament|atestado)/.test(mAus[1]) ? "afastamento" : /^licenca/.test(mAus[1]) ? "licenca" : "";
      return {tipo: "ausencia", mod: "dp", params: {analista: ausente, motivo: mot, inicio: ini, fim: fim, para: cobre}};
    }
    if (!emps.length) return null;
    // ---- DP, Fiscal ou Contábil: passar a empresa para outro analista ----
    if (anas.length === 1 && /\b(passa|passe|passar|transfere|transfira|transferir|muda|mude|mudar|troca|troque|trocar|coloca|coloque|poe|ponha|atribui|atribua)\b/.test(t) && !/\b(lembrete|etapa|pendencia|entrega|obrigacao)\b/.test(t)
        && new RegExp("\\b(para|pra|pro|ao|carteira d[oa]|responsavel d[oa])\\s+(?:o |a )?" + norm(anas[0]).split(" ")[0] + "\\b").test(t)) {
      if (emps.length > 1 && emps[1].s >= emps[0].s * 0.92) return {tipo: "ambigua", emps: emps.slice(0, 5)};
      var alT = alvoModulo(mods, emps[0]);
      if (alT.ambig) return {tipo: "ambigua_mod", emp: emps[0], mods: alT.ambig, texto: texto};
      return {tipo: "transferir", mod: alT.mod, emp: emps[0], params: {para: anas[0]}};
    }
    // ---- anotar na ficha / no histórico da empresa ----
    if (/\b(anot\w*|registr\w*|adicion\w*|escrev\w*|poe|coloc\w*|deix\w*)\b/.test(t) && /\b(historico|ficha|observacao|observacoes|nota(?! fiscal))\b/.test(t)) {
      if (emps.length > 1 && emps[1].s >= emps[0].s * 0.92) return {tipo: "ambigua", emps: emps.slice(0, 5)};
      var alO = alvoModulo(mods, emps[0]);
      if (alO.ambig) return {tipo: "ambigua_mod", emp: emps[0], mods: alO.ambig, texto: texto};
      var tx2 = "", ic2 = texto.indexOf(":"), mq = /\bque\s+([\s\S]+)$/i.exec(texto);
      if (ic2 >= 0) tx2 = texto.slice(ic2 + 1); else if (mq) tx2 = mq[1];
      return {tipo: "observacao", mod: alO.mod, emp: emps[0], texto: tx2.replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, "")};
    }
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
    if (pd.tipo === "pergunta") return Promise.resolve([T(pd.texto)]);
    if (pd.tipo === "ambigua") {
      return Promise.resolve([T("Achei mais de uma empresa parecida. Qual delas?"), CH(pd.emps.map(function (x) { return {rot: x.g.nome, enviar: substituirEmpresa(texto, x.g.nome)}; }))]);
    }
    if (pd.tipo === "ambigua_ob") {
      return Promise.resolve([T("Qual obrigação você quer dizer?"), CH(pd.opcoes.slice(0, 6).map(function (o) { return {rot: o.l, enviar: texto + " " + o.l}; }))]);
    }
    if (pd.tipo === "ambigua_mod") {
      return Promise.resolve([T("Essa empresa está em mais de um módulo. Em qual?"), CH(pd.mods.map(function (m) { return {rot: MODN[m], enviar: texto + " no " + MODN[m]}; }))]);
    }
    return montarPlano(pd, texto).then(function (r) {
      if (r.blocos) return r.blocos;
      return [{tipo: "confirma", plano: r.plano, mod: r.mod, titulo: r.plano.titulo}];
    });
  }
  // Monta o plano de uma ação num módulo (nada grava). Devolve {plano, mod} ou {blocos} (pergunta/erro).
  var SO_MOD = {lembrete: "dp", cardapio: "cardapio", etapa_portal: "portal", imposto: "contabil"};
  var TIPO_PONTE = {etapa_portal: "etapa"};
  function montarPlano(pd, texto) {
    texto = texto || "";
    var e = pd.emp, mod = pd.mod || SO_MOD[pd.tipo] || "";
    if (SO_MOD[pd.tipo]) mod = SO_MOD[pd.tipo];
    else if (!mod) {
      var cand = Object.keys(e.g.refs).filter(function (m) { return m === "fiscal" || m === "contabil"; });
      if (!cand.length) return Promise.resolve({blocos: [T("Só consigo fazer isso em empresas do Fiscal ou do Contábil, e “" + e.g.nome + "” não está em nenhum dos dois.")]});
      mod = escolherModulo(pd, cand);
      if (mod === "?") return Promise.resolve({blocos: [T("“" + e.g.nome + "” está no Fiscal e no Contábil. Em qual deles?"), CH(cand.map(function (m) { return {rot: MODN[m], enviar: texto + " no " + MODN[m]}; }))]});
    }
    return modulo(mod).then(function (a) {
      if (!a || !a.acao) return {blocos: [T("Ainda não consigo fazer isso no " + MODN[mod] + ".")]};
      var id = e ? e.g.refs[mod] : "";
      if (e && !id && pd.tipo !== "lembrete") return {blocos: [T("“" + e.g.nome + "” não está no " + MODN[mod] + ".")]};
      var p = Object.assign({}, pd.params || {}, {id: id, etapa: pd.etapa, status: pd.status, ob: pd.ob, modo: pd.modo, texto: pd.texto, comp: pd.comp, data: pd.data, hora: pd.hora});
      var plano = a.acao(TIPO_PONTE[pd.tipo] || pd.tipo, p);
      if (!plano || plano.erro) return {blocos: [T(plano && plano.erro ? plano.erro : "Não consegui preparar essa ação.")], erro: plano && plano.erro ? plano.erro : "Não consegui preparar essa ação."};
      return {plano: plano, mod: mod};
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
        return Promise.resolve(ns.limits ? ns.limits() : null).then(function (l) { iaLimites = l || null; if (l && l.tools) { iaNs = ns; iaOk = true; } }, function () {});
      }).catch(function () {});
      if (AUTH()) { var adm = AUTH().ehAdmin(), algum = ["dp", "contabil", "fiscal", "portal", "cardapio"].some(function (m) { return AUTH().nivel(m) === "coord"; }); ehCoord = adm; podeVerTudo = adm || algum; }
      else window.claude.use("user").then(function (u) {
        if (!u) return;
        try { var ce = u.canEdit ? u.canEdit() : false; Promise.resolve(ce).then(function (v) { ehCoord = !!v; podeVerTudo = !!v; }); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }
  var iaLimites = null;
  // Quantas imagens / quais tipos a IA aceita nesta tela (null = não aceita).
  function limitesImagem() { return iaOk && iaLimites && iaLimites.images ? iaLimites.images : null; }
  function compacto(r, max) {
    if (!r) return {total: 0, linhas: []};
    var ls = (r.linhas || []).slice(0, max || 15).map(function (l) { var o = {t: mascarar(l.t), sub: mascarar(l.sub), data: l.data}; if (l.dados) o.dados = l.dados; return o; });
    var o = {titulo: r.titulo, total: r.total, linhas: ls};
    if (r.resumo) o.resumo = r.resumo;
    return o;
  }
  function anexarLista(extras, mod, r, a) {
    var tit = MODN[mod] + " · " + (r.titulo || "");
    if (extras.some(function (x) { return x.tipo === "linhas" && x.titulo === tit; })) return;
    extras.push({tipo: "linhas", titulo: tit, nota: a && a.exemplo && a.exemplo() ? "dados de exemplo" : "", linhas: r.linhas.slice(0, 8).map(function (l) { return Object.assign({mod: mod}, l); }), todas: r.linhas.map(function (l) { return Object.assign({mod: mod}, l); }),
      mais: r.linhas.length > 8 && r.verTudo ? {rot: "Ver os " + r.total + " no " + MODN[mod], acao: function () { return abrirItem(mod, r.verTudo); }} : null});
  }
  // Acha a empresa pelo texto (nome, CNPJ ou apelido). Devolve {g} ou {erro}.
  function acharEmpresa(txt) {
    var es = casarEmpresas(norm(txt || ""), {});
    if (!es.length) return {erro: "Não achei a empresa “" + txt + "”."};
    if (es.length > 1 && es[1].s >= es[0].s * 0.92 && es[0].s < 2) return {erro: "Empresa ambígua: " + es.slice(0, 4).map(function (x) { return x.g.nome; }).join("; ") + ". Pergunte qual."};
    return {g: es[0].g, x: es[0]};
  }
  var STATUS_IA = {concluida: "c", entregue: "c", retificada: "r", em_andamento: "a", pendente: ""};
  // Converte os argumentos das ferramentas (preparar_acao / preparar_lote) num pedido para montarPlano.
  function pedidoDe(i, emp) {
    var pd = {tipo: i.tipo, mod: i.modulo || "", status: STATUS_IA[i.status || "concluida"], modo: i.modo, texto: i.texto, comp: i.competencia, data: i.data, hora: i.hora, mods: i.modulo ? [i.modulo] : [],
      params: {imposto: "", valor: i.valor, para: i.para, rep: i.repetir, dia: i.data, principal: i.principal, guarnicao: i.guarnicao, salada: i.salada, sobremesa: i.sobremesa, feriado: i.feriado, setor: i.setor}};
    if (i.tipo === "ausencia") { pd.mod = "dp"; pd.mods = ["dp"]; pd.params.analista = i.analista; pd.params.inicio = i.inicio; pd.params.fim = i.fim; pd.params.motivo = i.motivo; return {pd: pd}; }
    if (i.tipo === "cardapio" || i.tipo === "lembrete") { if (i.tipo === "lembrete" && emp) pd.emp = emp; return {pd: pd}; }
    if (!emp) return {erro: "Diga a empresa."};
    pd.emp = emp;
    var tt = limpo(norm(i.etapa || i.obrigacao || i.imposto || "")), ok = false;
    if (i.tipo === "etapa" || i.tipo === "entrega" || i.tipo === "imposto" || i.tipo === "etapa_portal") {
      var mods = i.tipo === "imposto" ? ["contabil"] : i.tipo === "etapa_portal" ? ["portal"] : Object.keys(emp.g.refs);
      if (pd.mod && i.tipo === "etapa") mods = [pd.mod];
      var noMod = mods.filter(function (m) { return emp.g.refs[m]; });
      if (!noMod.length) return {erro: "“" + emp.g.nome + "” não está no " + mods.map(function (m) { return MODN[m]; }).join(" nem no ") + "."};
      mods.forEach(function (m) {
        var a = carregados[m]; if (!a || !a.vocab || ok || !emp.g.refs[m]) return; var v = a.vocab();
        var lista = i.tipo === "entrega" ? v.obrigacoes : i.tipo === "imposto" ? (v.impostos || []) : v.etapas; if (!lista || !lista.length) return;
        var r = melhorPorTokens(tt, lista, function (x) { return [x.c || x.l, x.l]; });
        if (r.item && r.pts >= 0.5) { ok = true; pd.mod = m; if (i.tipo === "entrega") pd.ob = r.item.k; else if (i.tipo === "imposto") pd.params.imposto = r.item.k; else pd.etapa = r.item.k; }
      });
      if (!ok) return {erro: "Não reconheci “" + (i.etapa || i.obrigacao || i.imposto || "") + "”" + (i.tipo === "etapa_portal" ? " (etapas do Portal: Habilitação no Domínio, Treinamento do analista)" : "") + "."};
      if (i.tipo === "etapa_portal") pd.status = {c: "concluido", a: "andamento", "": "pendente", r: "concluido"}[pd.status];
    }
    return {pd: pd};
  }
  // Ações feitas pelo assistente nesta sessão (para "desfazer tudo da última hora").
  var feitosSessao = [];
  function cartaoLote(planos, falhas, titulo) {
    var linhas = planos.map(function (x) { return (x.plano.empresa ? x.plano.empresa + ": " : "") + (x.plano.linhas || [])[0]; });
    if (linhas.length > 25) linhas = linhas.slice(0, 25).concat(["… e mais " + (planos.length - 25)]);
    return {tipo: "confirma", titulo: titulo, plano: {titulo: titulo + " (" + planos.length + ")", empresa: "", linhas: linhas, aviso: falhas.length ? falhas.length + " não entram: " + falhas.slice(0, 4).join(" · ") + (falhas.length > 4 ? "…" : "") : "",
      executar: function () {
        var ok = 0, erros = 0;
        return planos.reduce(function (pr, x) { return pr.then(function () { return Promise.resolve().then(function () { return x.plano.executar(); }).then(function () { ok++; x.feito = true; }, function () { erros++; }); }); }, Promise.resolve())
          .then(function () { return ok + " feita(s)" + (erros ? ", " + erros + " com erro" : "") + "."; });
      },
      desfazer: function () {
        return planos.slice().reverse().reduce(function (pr, x) { return pr.then(function () { return x.feito && x.plano.desfazer ? Promise.resolve().then(function () { return x.plano.desfazer(); }).catch(function () {}) : null; }); }, Promise.resolve());
      }}};
  }
  // Agrega a carteira de cada módulo por analista.
  function cargaAnalistas() {
    return carregarTodos().then(function () {
      var por = {};
      ["fiscal", "contabil", "dp", "portal"].forEach(function (m) {
        var a = carregados[m]; if (!a) return;
        var r = a.consultar("carteira", {}); if (!r) return;
        r.linhas.forEach(function (l) { var d = l.dados; if (!d || !d.analista || /^\(sem/.test(d.analista)) return; var k = norm(d.analista).split(" ").slice(0, 2).join(" "); var q = por[k] = por[k] || {analista: d.analista, modulos: {}, pontos: 0}; q.modulos[MODN[m]] = Object.assign({}, d, {analista: undefined}); q.pontos += (d.atrasadas || 0) * 3 + (d.aguardandoCliente || 0) + (d.empresas || 0) * 0.15 + (d.frentes || 0) * 0.3; });
      });
      return Object.keys(por).map(function (k) { var q = por[k]; q.pontos = Math.round(q.pontos * 10) / 10; return q; }).sort(function (a, b) { return b.pontos - a.pontos; });
    });
  }
  function listarTudo() {
    return carregarTodos().then(function () {
      var out = [];
      Object.keys(carregados).forEach(function (m) { var a = carregados[m]; if (!a || !a.listar) return; if (a.exemplo && a.exemplo() && indice().empresas.length > 0 && apisCarregadas().some(function (b) { return b !== a && b.listar && b.listar().length; })) { /* exemplo convive com real: marca */ } a.listar().forEach(function (x) { out.push(Object.assign({modulo: m, exemplo: !!(a.exemplo && a.exemplo())}, x)); }); });
      return out;
    });
  }
  function contem(a, b) { return !b || norm(a).indexOf(norm(b)) !== -1; }
  // Calendário simples para cálculos (feriados vêm do Fiscal quando carregado).
  function feriadosEntre(de, ate) {
    var a = carregados.fiscal; if (!a) return {};
    var r = a.consultar("feriados", {de: ymd(de), ate: ymd(ate)}), m = {};
    (r && r.linhas || []).forEach(function (l) { m[l.data] = 1; });
    return m;
  }
  function calcular(i) {
    var d = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
    var aviso = " (estimativa: confira na legislação, na convenção e no sistema de folha)";
    if (i.tipo === "aviso_previo") {
      var a0 = d(i.admissao), a1 = d(i.desligamento) || hoje(); if (!a0) return "Informe a data de admissão (AAAA-MM-DD).";
      var anos = a1.getFullYear() - a0.getFullYear(); if (a1.getMonth() < a0.getMonth() || (a1.getMonth() === a0.getMonth() && a1.getDate() < a0.getDate())) anos--;
      anos = Math.max(0, anos);
      var dias = Math.min(90, 30 + 3 * anos);
      return {anosCompletos: anos, diasDeAviso: dias, regra: "30 dias + 3 por ano completo, até 90 (Lei 12.506/2011)", fimDoAvisoSeTrabalhadoDesde: i.desligamento ? ymd(addDias(a1, dias - 1)) : "", aviso: aviso};
    }
    if (i.tipo === "ferias_dias") {
      var f = Math.max(0, +i.faltas || 0), dd = f <= 5 ? 30 : f <= 14 ? 24 : f <= 23 ? 18 : f <= 32 ? 12 : 0;
      return {faltasInjustificadas: f, diasDeFerias: dd, regra: "CLT art. 130: até 5 faltas 30 dias; 6-14: 24; 15-23: 18; 24-32: 12; mais de 32: perde o direito", aviso: aviso};
    }
    if (i.tipo === "ferias_proporcionais") {
      var p0 = d(i.inicio_periodo || i.admissao), p1 = d(i.data) || hoje(); if (!p0) return "Informe o início do período aquisitivo ou a admissão (AAAA-MM-DD).";
      var meses = 0, c = new Date(p0);
      while (meses < 12) { var prox = new Date(c); prox.setMonth(prox.getMonth() + 1); if (prox <= addDias(p1, 1)) { meses++; c = prox; } else { var resto = Math.round((p1 - c) / 864e5) + 1; if (resto >= 15) meses++; break; } }
      return {avos: Math.min(12, meses) + "/12", diasProporcionais: Math.round(Math.min(12, meses) / 12 * 30 * 10) / 10, regra: "1/12 por mês trabalhado ou fração de 15 dias ou mais", aviso: aviso};
    }
    if (i.tipo === "dias_uteis") {
      var x0 = d(i.de), x1 = d(i.ate); if (!x0 || !x1) return "Informe de e ate (AAAA-MM-DD).";
      var fer = feriadosEntre(x0, x1), n = 0; for (var q = new Date(x0); q <= x1; q = addDias(q, 1)) if (q.getDay() % 6 && !fer[ymd(q)]) n++;
      return {diasUteis: n, considera: carregados.fiscal ? "fins de semana e feriados nacionais e de Vitória/ES" : "só fins de semana (Fiscal não carregado)"};
    }
    if (i.tipo === "somar_dias_uteis") {
      var b0 = d(i.data) || hoje(), n2 = +i.dias || 0, fer2 = feriadosEntre(b0, addDias(b0, n2 * 2 + 20)), cur = new Date(b0), k = 0;
      while (k < n2) { cur = addDias(cur, 1); if (cur.getDay() % 6 && !fer2[ymd(cur)]) k++; }
      return {data: ymd(cur), diaDaSemana: SEM[cur.getDay()]};
    }
    return "Tipo de cálculo desconhecido.";
  }
  // Apelidos de empresas cadastrados pela equipe (banco do Hub, coleção tax_apelidos).
  var apelidos = {}, dbTax = null, dbTaxP = null;
  function usarDb() {
    if (!dbTaxP) dbTaxP = (window.claude && window.claude.use ? window.claude.use("db") : Promise.resolve(null)).then(function (d) { dbTax = d || null; return dbTax; }, function () { return null; });
    return dbTaxP;
  }
  function ouvirApelidos() {
    usarDb().then(function (db) {
      if (!db) return;
      try { db.collection("tax_apelidos").onSnapshot(function (snap) { var m = {}; snap.docs.forEach(function (d) { var x = d.data() || {}; if (x.apelido && (x.empresa || x.cnpj)) m[norm(x.apelido)] = {empresa: x.empresa || "", cnpj: x.cnpj || ""}; }); apelidos = m; cache.indice = null; }, function () {}); } catch (e) {}
    });
  }
  function slug(t) { return norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x"; }

  function divergencias(rows) {
    var reais = rows.filter(function (x) { return !x.exemplo; }), out = [], porCnpj = {};
    reais.forEach(function (x) {
      if (!x.analista) out.push({t: "Sem analista: " + x.nome, sub: MODN[x.modulo], tom: "warn", mod: x.modulo, abrir: {empresa: x.id}});
      if (!x.cnpj) out.push({t: "Sem CNPJ: " + x.nome, sub: MODN[x.modulo], tom: "", mod: x.modulo, abrir: {empresa: x.id}});
      if (x.cnpj) (porCnpj[x.cnpj] = porCnpj[x.cnpj] || []).push(x);
    });
    var ativo = function (x) { var s = norm(x.situacao || "ativa"); return /^ativ/.test(s); };
    Object.keys(porCnpj).forEach(function (c) {
      var g = porCnpj[c]; if (g.length < 2) return;
      var at = g.filter(ativo), in2 = g.filter(function (x) { return !ativo(x); });
      if (at.length && in2.length) out.push({t: "Situação diferente: " + g[0].nome, sub: g.map(function (x) { return MODN[x.modulo] + ": " + (x.situacao || "ativa"); }).join(" · "), tom: "late", mod: in2[0].modulo, abrir: {empresa: in2[0].id}});
      var nomes = {}; g.forEach(function (x) { nomes[norm(x.nome).replace(/\b(ltda|me|epp|eireli|s a|sa)\b/g, "").trim()] = x.nome; });
      if (Object.keys(nomes).length > 1) out.push({t: "Nomes diferentes para o CNPJ " + c, sub: g.map(function (x) { return MODN[x.modulo] + ": " + x.nome; }).join(" · "), tom: "", mod: g[0].modulo, abrir: {empresa: g[0].id}});
    });
    return out;
  }
  function ferramentasIA(cartoes) {
    var MODS = ["dp", "contabil", "fiscal", "portal", "cardapio"];
    var TIPOS = ["vencimentos", "atrasos", "pendencias", "carteira", "cardapio", "competencia", "historico", "prazosConferir", "feriados", "fechado", "impostos", "funil", "semTreinamento", "onvio", "convencao", "convencoes", "funcionarios", "lembretes", "uso"];
    return [
      {name: "consultar", description: "Consulta dados de um módulo do Control Hub. Tipos por módulo — todos (menos cardápio): vencimentos (entregas/prazos num período), atrasos, carteira (empresas por analista); fiscal/contabil/portal: pendencias (aguardando o cliente; no Fiscal ordenado por dias parado); fiscal e contabil: competencia (o que falta para fechar uma competência AAAA-MM, com resumo por analista para comparar meses), historico (empresa); fiscal: prazosConferir, feriados; contabil: fechado (fechado até de cada empresa), impostos (apurado/guia enviada por vencimento); portal: funil (implantação), semTreinamento (contatos de clientes), onvio (usuários do PDF do Onvio para conferir); dp: historico (empresa), convencao (empresa: piso, reajuste, vigência), convencoes (todas, data-base), funcionarios (admissões recentes, férias, afastados), lembretes (os seus), uso (uso do banco); cardapio: cardapio. Datas AAAA-MM-DD; sem datas = hoje.",
        inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, tipo: {type: "string", enum: TIPOS}, de: {type: "string"}, ate: {type: "string"}, analista: {type: "string"}, competencia: {type: "string", description: "AAAA-MM"}, empresa: {type: "string", description: "nome ou CNPJ (para historico/convencao)"}}, required: ["modulo", "tipo"]},
        execute: function (i) {
          return carregarTodos().then(function () { return modulo(i.modulo); }).then(function (a) {
            if (!a) return "Módulo indisponível.";
            var p = {de: i.de || ymd(hoje()), ate: i.ate || i.de || ymd(hoje()), analista: i.analista || "", comp: i.competencia || ""};
            if (i.empresa) { var f = acharEmpresa(i.empresa); if (f.erro) return f.erro; p.id = f.g.refs[i.modulo]; if (!p.id) return "“" + f.g.nome + "” não está no " + MODN[i.modulo] + "."; }
            var r = a.consultar(i.tipo, p);
            if (r && r.linhas && r.linhas.length) anexarLista(cartoes, i.modulo, r, a);
            if (r && a.exemplo && a.exemplo()) r = Object.assign({}, r, {aviso: "dados de exemplo"});
            return r ? compacto(r, 25) : "Esse módulo não tem esse tipo de consulta.";
          });
        }},
      {name: "empresa", description: "Ficha completa de uma empresa (pelo nome, CNPJ ou apelido) em todos os módulos onde ela existe: DP, Contábil, Fiscal e Portal.",
        inputSchema: {type: "object", properties: {consulta: {type: "string"}}, required: ["consulta"]},
        execute: function (i) {
          return carregarTodos().then(function () {
            var es = casarEmpresas(norm(i.consulta), {});
            if (!es.length) return "Não achei empresa com esse nome/CNPJ.";
            var g = es[0].g, out = {nome: g.nome, cnpj: g.cnpj, outrasParecidas: es.slice(1, 4).map(function (x) { return x.g.nome; }), modulos: {}};
            return Promise.all(Object.keys(g.refs).map(function (m) { return modulo(m).then(function (a) { var r = a && a.consultar("empresa", {id: g.refs[m]}); if (r) { out.modulos[m] = compacto(r, 12); anexarLista(cartoes, m, {titulo: g.nome, total: r.total, linhas: r.linhas}, a); } }); })).then(function () { return out; });
          });
        }},
      {name: "buscar_empresas", description: "Busca e filtra empresas em todos os módulos (combinando filtros): texto (nome, CNPJ parcial, IE, IM, município, grupo), analista, modulo, regime/tributação, municipio, uf, situacao, so_atrasadas, so_aguardando_cliente, sem_analista. Devolve a lista (até 40) e o total.",
        inputSchema: {type: "object", properties: {texto: {type: "string"}, analista: {type: "string"}, modulo: {type: "string", enum: ["dp", "contabil", "fiscal"]}, regime: {type: "string"}, municipio: {type: "string"}, uf: {type: "string"}, situacao: {type: "string"}, so_atrasadas: {type: "boolean"}, so_aguardando_cliente: {type: "boolean"}, sem_analista: {type: "boolean"}}},
        execute: function (i) {
          return listarTudo().then(function (rows) {
            var dig = String(i.texto || "").replace(/\D/g, "");
            var f = rows.filter(function (x) {
              if (i.modulo && x.modulo !== i.modulo) return false;
              if (i.texto && !(contem(x.nome, i.texto) || (dig.length >= 4 && String(x.cnpj).indexOf(dig) !== -1) || contem(x.ie, i.texto) || contem(x.im, i.texto) || contem(x.municipio, i.texto) || contem(x.grupo, i.texto))) return false;
              if (i.analista && !(contem(x.analista, i.analista) || contem(x.apoio, i.analista) || contem(x.analistaEfetivo, i.analista))) return false;
              if (i.regime && !(contem(x.regime, i.regime) || contem(x.tributacao, i.regime))) return false;
              if (i.municipio && !contem(x.municipio, i.municipio)) return false;
              if (i.uf && norm(x.uf) !== norm(i.uf)) return false;
              if (i.situacao && !contem(x.situacao, i.situacao)) return false;
              if (i.so_atrasadas && !x.atraso) return false;
              if (i.so_aguardando_cliente && !x.aguardandoCliente) return false;
              if (i.sem_analista && x.analista) return false;
              return true;
            });
            var linhas = f.map(function (x) { return {t: x.nome, sub: [MODN[x.modulo], x.analista || "sem analista", x.regime || x.tributacao, x.municipio ? x.municipio + (x.uf ? "/" + x.uf : "") : "", x.atraso ? "com atraso" : "", x.aguardandoCliente ? "aguardando cliente" : "", x.exemplo ? "exemplo" : ""].filter(Boolean).join(" · "), tom: x.atraso ? "late" : x.aguardandoCliente ? "warn" : "", mod: x.modulo, abrir: {empresa: x.id}}; });
            if (linhas.length) cartoes.push({tipo: "linhas", titulo: "Empresas encontradas · " + linhas.length, linhas: linhas.slice(0, 8), todas: linhas, nota: ""});
            return {total: f.length, empresas: f.slice(0, 40).map(function (x) { var o = {}; ["modulo", "nome", "cnpj", "analista", "regime", "tributacao", "municipio", "uf", "situacao", "atraso", "aguardandoCliente", "funcionarios", "exemplo"].forEach(function (k) { if (x[k] !== undefined && x[k] !== "") o[k] = x[k]; }); return o; })};
          });
        }},
      {name: "carga_analistas", description: "Carga de trabalho de cada analista somando os módulos (empresas, atrasadas, aguardando cliente, frentes do Portal). Use para 'quem está mais sobrecarregado' e 'quem pode ajudar' (menor pontuação no mesmo módulo).",
        inputSchema: {type: "object", properties: {}}, execute: function () { return cargaAnalistas(); }},
      {name: "conferir_cadastros", description: "Procura divergências de cadastro entre os módulos: empresas sem analista, sem CNPJ, com situação diferente entre setores (ex.: inativa no DP e ativa no Contábil) ou com nomes diferentes para o mesmo CNPJ.",
        inputSchema: {type: "object", properties: {}},
        execute: function () {
          return listarTudo().then(function (rows) {
            var out = divergencias(rows);
            if (out.length) cartoes.push({tipo: "linhas", titulo: "Divergências de cadastro · " + out.length, linhas: out.slice(0, 8), todas: out, nota: ""});
            return {total: out.length, itens: out.slice(0, 40).map(function (l) { return l.t + " — " + l.sub; })};
          });
        }},
      {name: "analistas", description: "Lista os analistas conhecidos (nomes completos).", inputSchema: {type: "object", properties: {}}, execute: function () { return carregarTodos().then(function () { return indice().analistas; }); }},
      {name: "ajuda", description: "Busca na base de ajuda do Control Hub como usar uma função.", inputSchema: {type: "object", properties: {pergunta: {type: "string"}}, required: ["pergunta"]},
        execute: function (i) { var e = buscarAjuda(norm(i.pergunta), [], 2); return e ? {titulo: e.t, texto: e.a} : "Sem entrada na base de ajuda."; }},
      {name: "glossario", description: "Explica um termo, sigla ou obrigação do setor contábil/fiscal/DP (DAS, DCTFWeb, EFD-Reinf, CCT, período concessivo…).", inputSchema: {type: "object", properties: {termo: {type: "string"}}, required: ["termo"]},
        execute: function (i) { return buscarGlossario(i.termo) || "Termo fora do glossário: explique com cuidado e diga que é uma explicação geral."; }},
      {name: "calcular", description: "Cálculos de DP e de prazos (estimativas): aviso_previo (admissao, desligamento), ferias_dias (faltas), ferias_proporcionais (inicio_periodo ou admissao, data), dias_uteis (de, ate), somar_dias_uteis (data, dias). Datas AAAA-MM-DD.",
        inputSchema: {type: "object", properties: {tipo: {type: "string", enum: ["aviso_previo", "ferias_dias", "ferias_proporcionais", "dias_uteis", "somar_dias_uteis"]}, admissao: {type: "string"}, desligamento: {type: "string"}, faltas: {type: "number"}, inicio_periodo: {type: "string"}, data: {type: "string"}, de: {type: "string"}, ate: {type: "string"}, dias: {type: "number"}}, required: ["tipo"]},
        execute: function (i) { return carregarTodos().then(function () { return calcular(i); }); }},
      {name: "grafico", description: "Mostra um gráfico de barras pequeno no chat (comparações, rankings, contagens). itens: [{rotulo, valor}] com no máximo 12.",
        inputSchema: {type: "object", properties: {titulo: {type: "string"}, unidade: {type: "string"}, itens: {type: "array", items: {type: "object", properties: {rotulo: {type: "string"}, valor: {type: "number"}}, required: ["rotulo", "valor"]}}}, required: ["titulo", "itens"]},
        execute: function (i) { cartoes.push({tipo: "grafico", titulo: i.titulo, unidade: i.unidade || "", itens: (i.itens || []).slice(0, 12)}); return "Gráfico exibido abaixo da resposta."; }},
      {name: "abrir", description: "Abre um módulo (e uma aba) na tela do usuário.", inputSchema: {type: "object", properties: {modulo: {type: "string", enum: MODS}, aba: {type: "string"}}, required: ["modulo"]},
        execute: function (i) { return abrirItem(i.modulo, {aba: i.aba || "", manter: true}).then(function () { return "Aberto."; }); }},
      {name: "preparar_acao", description: "Prepara UMA alteração para o usuário confirmar num cartão. NÃO grava nada: diga que falta clicar em Confirmar. tipo: etapa (etapa do fechamento Fiscal/Contábil; etapa + status; status pendente = reabrir), fechar (concluir todas as etapas), pendencia (modo registrar/recebida/cobrado; texto = o que falta o cliente mandar, pode incluir prazo e quem cobrar), entrega (obrigação do Fiscal; obrigacao + status), imposto (Contábil: imposto + valor apurado/guia/na/pendente), transferir (Fiscal/Contábil: só coordenação; no DP qualquer editor; para = analista), observacao (anota texto na ficha; no DP vai para o histórico da empresa), ausencia (só DP: analista, motivo ferias/afastamento/licenca, inicio e fim AAAA-MM-DD, para = quem cobre; sem empresa), etapa_portal (Portal: etapa Habilitação no Domínio ou Treinamento do analista, setor pessoal/contabil/fiscal, status), cardapio (data + principal, guarnicao, salada, sobremesa, ou feriado), lembrete (lembrete pessoal: texto, data, hora HH:MM, repetir nao/diaria/util/semanal/mensal/anual; empresa opcional).",
        inputSchema: {type: "object", properties: {tipo: {type: "string", enum: ["etapa", "fechar", "pendencia", "entrega", "imposto", "transferir", "observacao", "etapa_portal", "cardapio", "lembrete", "ausencia"]}, empresa: {type: "string"}, modulo: {type: "string", enum: ["fiscal", "contabil", "dp"]}, analista: {type: "string"}, inicio: {type: "string"}, fim: {type: "string"}, motivo: {type: "string", enum: ["ferias", "afastamento", "licenca"]}, etapa: {type: "string"}, obrigacao: {type: "string"}, imposto: {type: "string"}, valor: {type: "string", enum: ["apurado", "guia", "na", "pendente"]}, status: {type: "string", enum: ["concluida", "em_andamento", "pendente", "entregue", "retificada"]}, modo: {type: "string", enum: ["registrar", "recebida", "cobrado"]}, texto: {type: "string"}, para: {type: "string"}, setor: {type: "string"}, data: {type: "string"}, hora: {type: "string"}, repetir: {type: "string", enum: ["nao", "diaria", "util", "semanal", "mensal", "anual"]}, competencia: {type: "string"}, principal: {type: "string"}, guarnicao: {type: "string"}, salada: {type: "string"}, sobremesa: {type: "string"}, feriado: {type: "string"}}, required: ["tipo"]},
        execute: function (i) {
          return carregarTodos().then(function () {
            var emp = null;
            if (i.empresa) { var f = acharEmpresa(i.empresa); if (f.erro) return f.erro; emp = f.x; }
            var r = pedidoDe(i, emp); if (r.erro) return r.erro;
            return montarPlano(r.pd, "").then(function (m) {
              if (m.blocos) return m.erro || (m.blocos[0] && m.blocos[0].texto) || "Não consegui preparar.";
              cartoes.push({tipo: "confirma", plano: m.plano, mod: m.mod, titulo: m.plano.titulo});
              return "Cartão de confirmação preparado (" + m.plano.titulo + ": " + (m.plano.linhas || []).join("; ") + "). Nada foi gravado: o usuário precisa clicar em Confirmar.";
            });
          });
        }},
      {name: "preparar_lote", description: "Prepara a MESMA alteração para várias empresas de uma vez, num único cartão de confirmação (com prévia em lista e Desfazer). Informe empresas (lista de nomes) ou um filtro (analista, modulo, so_atrasadas, so_aguardando_cliente). Mesmos campos de preparar_acao (tipos etapa, fechar, entrega, imposto, pendencia cobrado/recebida, transferir, observacao). Máximo 60 empresas.",
        inputSchema: {type: "object", properties: {tipo: {type: "string", enum: ["etapa", "fechar", "entrega", "imposto", "pendencia", "transferir", "observacao"]}, empresas: {type: "array", items: {type: "string"}}, filtro_analista: {type: "string"}, filtro_modulo: {type: "string", enum: ["fiscal", "contabil"]}, so_atrasadas: {type: "boolean"}, so_aguardando_cliente: {type: "boolean"}, modulo: {type: "string", enum: ["fiscal", "contabil"]}, etapa: {type: "string"}, obrigacao: {type: "string"}, imposto: {type: "string"}, valor: {type: "string"}, status: {type: "string"}, modo: {type: "string"}, texto: {type: "string"}, para: {type: "string"}, competencia: {type: "string"}}, required: ["tipo"]},
        execute: function (i) {
          return listarTudo().then(function (rows) {
            var alvos = [];
            if (i.empresas && i.empresas.length) {
              var falt = [];
              i.empresas.slice(0, 60).forEach(function (n) { var f = acharEmpresa(n); if (f.erro) falt.push(n); else alvos.push(f.x); });
              if (!alvos.length) return "Não achei nenhuma dessas empresas.";
            } else {
              var mod = i.filtro_modulo || i.modulo || (i.tipo === "entrega" ? "fiscal" : i.tipo === "imposto" ? "contabil" : "");
              if (!mod) return "Diga o módulo (fiscal ou contabil) ou a lista de empresas.";
              var vistos = {};
              rows.filter(function (x) { return x.modulo === mod && (!i.filtro_analista || contem(x.analista, i.filtro_analista)) && (!i.so_atrasadas || x.atraso) && (!i.so_aguardando_cliente || x.aguardandoCliente); }).forEach(function (x) {
                var g = indice().empresas.filter(function (y) { return y.refs[mod] === x.id; })[0]; if (g && !vistos[g.nome]) { vistos[g.nome] = 1; alvos.push({g: g, s: 1}); }
              });
              if (!alvos.length) return "Nenhuma empresa nesse filtro.";
              if (!i.modulo) i.modulo = mod;
            }
            alvos = alvos.slice(0, 60);
            var planos = [], falhas = [];
            return alvos.reduce(function (pr, emp) {
              return pr.then(function () {
                var r = pedidoDe(i, emp); if (r.erro) { falhas.push(emp.g.nome + ": " + r.erro); return; }
                return montarPlano(r.pd, "").then(function (m) { if (m.plano) planos.push(m); else falhas.push(emp.g.nome + ": " + (m.erro || "não dá")); });
              });
            }, Promise.resolve()).then(function () {
              if (!planos.length) return "Nenhuma alteração possível: " + falhas.slice(0, 5).join("; ");
              cartoes.push(cartaoLote(planos, falhas, "Alteração em lote"));
              return "Cartão em lote preparado com " + planos.length + " empresa(s)" + (falhas.length ? "; " + falhas.length + " ficaram de fora (" + falhas.slice(0, 3).join("; ") + ")" : "") + ". Nada foi gravado: o usuário precisa confirmar.";
            });
          });
        }},
      {name: "guardar_apelido", description: "Prepara (com confirmação) um apelido para uma empresa, usado pela equipe nas próximas perguntas (ex.: “padaria do centro” = Panificadora X).",
        inputSchema: {type: "object", properties: {apelido: {type: "string"}, empresa: {type: "string"}}, required: ["apelido", "empresa"]},
        execute: function (i) {
          return carregarTodos().then(usarDb).then(function (db) {
            if (!db) return "Sem banco para guardar apelidos.";
            var f = acharEmpresa(i.empresa); if (f.erro) return f.erro;
            var ap = String(i.apelido || "").trim().slice(0, 60); if (ap.length < 3) return "Apelido curto demais.";
            var k = "tax_apelidos/" + slug(ap), antes = apelidos[norm(ap)];
            cartoes.push({tipo: "confirma", titulo: "Guardar apelido", plano: {titulo: "Guardar apelido", empresa: f.g.nome, linhas: ["“" + ap + "” passa a significar " + f.g.nome + (antes ? " (antes: " + antes.empresa + ")" : "")], aviso: "Vale para toda a equipe.",
              executar: function () { return db.doc(k).set({apelido: ap, empresa: f.g.nome, cnpj: f.g.cnpj || "", em: new Date().toISOString()}).then(function () { return "Apelido guardado."; }); },
              desfazer: function () { return antes ? db.doc(k).set({apelido: ap, empresa: antes.empresa, cnpj: antes.cnpj, em: new Date().toISOString()}) : db.doc(k).delete(); }}});
            return "Cartão de confirmação do apelido preparado. Nada foi gravado ainda.";
          });
        }}
    ].concat(FERRAMENTAS_EXTRA.map(function (fn) { return fn(cartoes); }));
  }
  var FERRAMENTAS_EXTRA = [];
  var conversa = lerConversa(), iaAviso = "", bolhaAtual = null;
  function lerConversa() { var c = lerLS("tx-conv-v1", null); return c && c.t && Date.now() - c.t < 3 * 864e5 && Array.isArray(c.c) ? c.c : []; }
  function guardarConversa() { gravarLS("tx-conv-v1", {t: Date.now(), c: conversa.slice(-12)}); }
  // Última linha "» a | b | c" = próximas perguntas sugeridas pela IA (viram botões).
  function separarSeguintes(txt) {
    var m = /\n?[ \t]*»[ \t]*([^\n]*)\s*$/.exec(txt || "");
    if (!m) return {texto: txt, seg: []};
    return {texto: txt.slice(0, m.index).trim(), seg: m[1].split("|").map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length <= 80; }).slice(0, 3)};
  }
  function regrasIA() {
    var ativo = H.ativo(), nomeAtivo = MODN[ativo] || "tela inicial", p = lerPref();
    return "Você é o " + nomeTax() + ", o assistente (mascote) do Control Hub da ControlTax, um escritório de contabilidade em Vitória/ES. Módulos: DP (departamento pessoal: empresas, funcionários, agenda, convenções, cartela de clientes), Contábil (fechamento mensal, prazos de impostos, obrigações anuais), Fiscal (obrigações acessórias, agenda de entregas, fechamento), Portal do Cliente (implantação do Onvio) e Cardápio (refeitório).\n" +
      "Hoje é " + ymd(hoje()) + " (" + hoje().toLocaleDateString("pt-BR", {weekday: "long"}) + "), " + pad2(new Date().getHours()) + "h. A pessoa está em: " + nomeAtivo + "." + (euNome ? " Quem fala com você: " + euNome + "." : "") + "\n" +
      "Módulos que esta pessoa pode usar: " + H.modulos().map(function (k) { return MODN[k]; }).join(", ") + (AUTH() ? ". Ela não tem acesso aos outros: se pedirem algo deles, diga que o acesso não foi liberado e sugira falar com o administrador. " : ". ") + (AUTH() && AUTH().usuario() && !AUTH().ehAdmin() ? "Os níveis são Coordenador (edita tudo no módulo), Analista (edita só a própria carteira) e Consulta (só vê): se uma ação for recusada por permissão, explique isso com simpatia.\n" : "\n") +
      "Regras: responda em português do Brasil, curto e simpático (no máximo 4 frases ou uma lista curta), a não ser que peçam mais detalhes ou outro formato (tabela em markdown, tópicos, só o número). Use as ferramentas para qualquer dado; nunca invente empresas, datas ou números. " +
      "Diga de onde veio a informação quando ajudar (ex.: “no Fiscal › Agenda”). As consultas que você fizer aparecem para a pessoa como listas clicáveis logo abaixo da sua resposta: não repita item por item, resuma (quantos, os mais urgentes, o que fazer). " +
      "Para mudar algo use preparar_acao (ou preparar_lote para várias empresas): a pessoa confirma num cartão; diga que falta confirmar e nunca diga que já foi feito. " +
      "Para comparar meses ou ver tendência, consulte competencia de cada mês; para números lado a lado use grafico; para filtros combinados use buscar_empresas; para carga da equipe use carga_analistas. " +
      "Para mostrar uma tela use abrir. Para termos do setor (siglas, obrigações) use glossario; para como usar o sistema, use ajuda. Se faltar informação (qual empresa, qual período), pergunte. Se um módulo vier marcado como dados de exemplo, avise. " +
      "Se pedirem rascunho de e-mail ou WhatsApp para cliente, escreva o texto pronto, cordial e objetivo, assinado “Equipe ControlTax”, só com dados que você consultou. Se pedirem para explicar ao cliente, use linguagem simples, sem siglas soltas. " +
      (p.iniciante ? "A pessoa é nova no setor: explique os termos e o porquê de cada passo, com calma. " : "") +
      (cfgEquipe.instrucoes ? "\nInstruções da coordenação: " + String(cfgEquipe.instrucoes).slice(0, 1500) + "\n" : "") +
      "Termine SEMPRE com uma última linha começando com » e 2 ou 3 próximas perguntas ou pedidos curtos que a pessoa provavelmente fará, separados por | (ex.: » Abrir a agenda | E amanhã?).";
  }
  // Responde tudo pela IA (capability "sample", plano de quem usa). Devolve null quando a IA não pôde responder: aí entram as regras.
  function perguntarIA(texto, op) {
    op = op || {};
    if (iaOcupada) return Promise.resolve([T("Ainda estou pensando na pergunta anterior.")]);
    iaOcupada = true; pensando(true);
    var extras = [], tmp = null, proprio = false, dots = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>';
    if (bolhaAtual && bolhaAtual.isConnected) tmp = bolhaAtual;
    else if (msgs) { tmp = doc.createElement("div"); tmp.className = "tx-m-b"; msgs.appendChild(tmp); proprio = true; }
    if (tmp) { tmp.innerHTML = dots; rolar(); }
    var fimBolha = function (falhou) { pensando(false); if (!tmp) return; if (proprio) tmp.remove(); else if (falhou) tmp.innerHTML = dots; };
    var imgs = op.imagens && op.imagens.length ? op.imagens : null;
    conversa.push({role: "user", content: texto + (imgs ? "\n(Anexei " + imgs.length + " imagem(ns) nesta mensagem: leia e use o que estiver nelas.)" : "")});
    if (conversa.length > 12) conversa = conversa.slice(-12);
    while (conversa.length && conversa[0].role !== "user") conversa.shift();
    var regras = regrasIA();
    var turnos = conversa.map(function (m, i) { return {role: m.role, content: i === 0 ? regras + "\n\n" + m.content : m.content}; });
    var opts = {tools: ferramentasIA(extras), modelTier: "quick", cache: false, onText: function (u) { if (!tmp) return; var n = tmp.querySelector(".tx-ia"); if (!n) { tmp.innerHTML = '<div class="tx-t1 tx-ia"></div>'; n = tmp.firstChild; } n.innerHTML = mdHtml(String(u.text || "").replace(/\n?[ \t]*»[^\n]*$/, "")); rolar(); }};
    if (imgs) opts.images = imgs;
    contarUso(); atualizarSub();
    registrarPergunta(texto, "ia");
    return iaNs(turnos, opts)
      .then(function (r) {
        fimBolha(false); iaOcupada = false;
        var bruto = (r && r.text || "").trim() || "Pronto.", s = separarSeguintes(bruto), txt = s.texto || "Pronto.";
        conversa.push({role: "assistant", content: txt}); guardarConversa();
        var out = [{tipo: "md", texto: txt, acoes: true, pergunta: texto}].concat(extras);
        if (s.seg.length) out.push(CH(s.seg.map(function (x) { return {rot: x, enviar: x}; })));
        return out;
      })
      .catch(function (e) {
        fimBolha(true); iaOcupada = false;
        conversa.pop();
        var cod = e && e.code;
        if (cod === "not_granted" || cod === "tools_unavailable") { iaOk = false; atualizarSub(); iaAviso = "Sem autorização para usar a IA: respondendo pelas regras do assistente."; return null; }
        if (cod === "images_unavailable" || cod === "image_rejected") return [T(cod === "image_rejected" ? "Não consegui ler essa imagem (tipo ou tamanho não aceito)." : "Esta tela não consegue enviar imagens para a IA.")];
        if (cod === "rate_limited") { iaAviso = "A IA está ocupada agora: respondendo pelas regras."; return null; }
        if (e && e.text) return [{tipo: "md", texto: separarSeguintes(e.text).texto, acoes: true, pergunta: texto}].concat(extras);
        iaAviso = "A IA não respondeu: respondendo pelas regras."; return null;
      });
  }
  // Markdown da IA: **negrito**, *itálico*, `código`, títulos, listas e tabelas (todo o resto vira texto).
  function mdHtml(t) {
    var ls = String(t || "").split("\n"), out = [], i = 0;
    function inl(s) { return mascarar(esc(s)).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<b>$1</b>"); }
    function cels(l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); }
    while (i < ls.length) {
      var l = ls[i];
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < ls.length && /^\s*\|?\s*:?-{2,}/.test(ls[i + 1])) {
        var cab = cels(l), rows = []; i += 2;
        while (i < ls.length && /^\s*\|.*\|\s*$/.test(ls[i])) { rows.push(cels(ls[i])); i++; }
        out.push('<span class="tx-tab"><table><thead><tr>' + cab.map(function (c) { return "<th>" + inl(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inl(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></span>");
        continue;
      }
      if (/^#{1,4}\s+/.test(l)) out.push("<b>" + inl(l.replace(/^#+\s+/, "")) + "</b>");
      else if (/^\s*[-*•]\s+/.test(l)) out.push("• " + inl(l.replace(/^\s*[-*•]\s+/, "")));
      else out.push(inl(l));
      i++;
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  function quem() {
    return [T("Eu consigo:\n• responder o que vence, o que está atrasado e quem está aguardando o cliente (DP, Contábil, Fiscal e Portal);\n• mostrar a situação de uma empresa pelo nome ou CNPJ;\n• ver a carteira de um analista;\n• dizer o cardápio do dia;\n• abrir qualquer tela (“abrir a agenda do Fiscal”);\n• tirar dúvidas de como usar."),
      CH(sugestoes().map(function (s) { return {rot: s, enviar: s}; }))];
  }
  function naoEntendi(p) {
    var ch = sugestoes().map(function (s) { return {rot: s, enviar: s}; });
    var r = [T("Não entendi bem. Tente perguntar de outro jeito, por exemplo:"), CH(ch)];
    r.naoEntendi = true;
    return r;
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
        out.push({tipo: "linhas", titulo: MODN[x.k] + " · " + x.r.total, nota: x.a.exemplo && x.a.exemplo() ? "dados de exemplo" : "", linhas: ls.slice(0, lim).map(function (l) { return Object.assign({mod: x.k}, l); }), todas: ls.map(function (l) { return Object.assign({mod: x.k}, l); }),
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
        out.push({tipo: "linhas", titulo: MODN[x.k], nota: x.a.exemplo && x.a.exemplo() ? "dados de exemplo" : "", linhas: x.r.linhas.slice(0, 8).map(function (l) { return Object.assign({mod: x.k}, l); }), todas: x.r.linhas.map(function (l) { return Object.assign({mod: x.k}, l); })});
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
      legsA: ["..CC......CC..", "..CC......CC.."], legsB: ["...CC....CC...", "...CC....CC..."]}    ,coruja: {nome: "Corujinha", body: "B", pal: {B: "#8B5E3C", W: "#F3E3C3", Y: "#F2B705", E: "#1E1208"},
      rows: ["..B........B..", "..BB......BB..", "..BBBBBBBBBB..", ".BWWWBBBBWWWB.", ".BWEWBBBBWEWB.", ".BWWWBYYBWWWB.", ".BBBBBYYBBBBB.", ".BBWWWWWWWWBB.", "..BWWWWWWWWB.."],
      legsA: ["....Y....Y....", "...YY....YY..."], legsB: [".....Y..Y.....", "....YY..YY...."]},
    cacto: {nome: "Cactinho", body: "G", pal: {G: "#4CAF50", D: "#2E7D32", F: "#E91E63", P: "#C8693A", E: "#10301A"},
      rows: ["......FF......", ".....GGGG.....", "..G..GGGG..G..", "..G.GEGGEG.G..", "..GGGGGGGGGG..", ".....GGGG.....", ".....GDGG.....", "....PPPPPP....", "....PPPPPP...."],
      legsA: ["....PP..PP....", "....P....P...."], legsB: [".....PPPP.....", ".....P..P....."]},
    calculadora: {nome: "Calculadora", body: "C", pal: {C: "#8A97A3", S: "#B8E0A8", K: "#3B4650", E: "#1D3B14"},
      rows: ["..CCCCCCCCCC..", "..CSSSSSSSSC..", "..CSESSSSESC..", "..CSSSSSSSSC..", "..CCCCCCCCCC..", "..CKCKCKCKCC..", "..CCCCCCCCCC..", "..CKCKCKCKCC..", "..CCCCCCCCCC.."],
      legsA: ["...CC....CC...", "...CC....CC..."], legsB: ["....CC..CC....", "....CC..CC...."]}
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
    '#tx-mascote .tx-balao{position:absolute;bottom:calc(var(--tx-hm,44px) + 8px);left:50%;transform:translateX(-50%) scale(.9);transform-origin:50% 100%;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:10px;padding:6px 10px;font:600 12px "IBM Plex Sans",sans-serif;white-space:normal;width:max-content;max-width:240px;line-height:1.35;text-align:center;box-shadow:0 6px 18px rgba(16,24,32,.18);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s}' +
    '#tx-mascote .tx-badge{position:absolute;top:-6px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--brand-red,#C2000C);color:#fff;font:700 10px/16px "IBM Plex Sans",sans-serif;text-align:center;box-shadow:0 0 0 2px var(--surface,#fff)}#tx-mascote .tx-badge[hidden]{display:none}' +
    '#tx-mascote .tx-balao.on{opacity:1;transform:translateX(-50%) scale(1)}' +
    '@keyframes txVA{0%{visibility:visible}50%{visibility:hidden}}@keyframes txVB{0%{visibility:hidden}50%{visibility:visible}}@keyframes txBob{50%{transform:translateY(-3px)}}' +
    '@keyframes txPisca{0%,94%{visibility:visible}95%,97%{visibility:hidden}98%,100%{visibility:visible}}@keyframes txPisca2{0%,94%{visibility:hidden}95%,97%{visibility:visible}98%,100%{visibility:hidden}}' +
    '@keyframes txRespira{50%{transform:translateY(-1px)}}@keyframes txPula{40%{transform:translateY(-14px)}}@keyframes txZ{0%{opacity:0;transform:translate(0,4px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-10px)}}' +
    '#tx-mascote .tx-emo{position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-size:15px;opacity:0;pointer-events:none}#tx-mascote .tx-emo.on{animation:txEmo 1.6s ease-out}@keyframes txEmo{0%{opacity:0;transform:translate(-50%,6px) scale(.6)}15%{opacity:1;transform:translate(-50%,-4px) scale(1.1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-18px)}}' +
    '#tx-mascote .tx-chapeu{position:absolute;left:0;width:100%;height:16px;top:-12px;pointer-events:none}#tx-mascote .tx-ov{position:absolute;inset:0;pointer-events:none}' +
    '#tx-mascote.tx-le .tx-corpo{transform:translateY(3px) scaleY(.92);transform-origin:50% 100%}#tx-mascote.tx-le .tx-eo{animation:none}' +
    '#tx-mascote.tx-pensando .tx-corpo{animation:txRespira 1s ease-in-out infinite}#tx-mascote.tx-pensando .tx-balao{font-size:16px;letter-spacing:2px;border-radius:14px}' +
    '#tx-mascote.tx-porta .tx-corpo{animation:txPorta .6s ease-in-out}@keyframes txPorta{0%,100%{transform:scaleX(1)}45%{transform:scaleX(.08)}}' +
    '#tx-mascote.tx-segura .tx-corpo{transform:translateY(-4px) rotate(-6deg);transition:transform .12s}#tx-mascote.tx-segura .tx-lA{visibility:hidden}#tx-mascote.tx-segura .tx-lB{visibility:visible}' +
    '#tx-mascote.tx-escondido{opacity:.38;filter:saturate(.6)}#tx-mascote.tx-escondido .tx-sombra{display:none}' +
    '#tx-mascote.tx-arrastado{cursor:grabbing}#tx-mascote.tx-arrastado .tx-corpo{transform:rotate(-8deg) scale(1.05)}' +
    '.tx-pegada{position:fixed;z-index:524;width:5px;height:3px;border-radius:2px;background:var(--ink-3,#5F6D77);opacity:.35;pointer-events:none;animation:txPeg 1.3s ease-out forwards}@keyframes txPeg{to{opacity:0}}' +
    '.tx-destaque{position:fixed;z-index:524;border:3px solid var(--brand-red,#C2000C);border-radius:8px;box-shadow:0 0 0 4px rgba(194,0,12,.18);pointer-events:none;animation:txDest 1.2s ease-in-out 3}@keyframes txDest{50%{box-shadow:0 0 0 10px rgba(194,0,12,0)}}' +
    ':root[data-theme="dark"] #tx-mascote .tx-face{filter:brightness(1.12) drop-shadow(0 0 1px rgba(255,255,255,.35))}:root[data-theme="dark"] #tx-mascote .tx-sombra{background:rgba(0,0,0,.5)}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #tx-mascote .tx-face{filter:brightness(1.12) drop-shadow(0 0 1px rgba(255,255,255,.35))}}' +
    '.tx-vis-sec{width:100%;font:700 11px Archivo,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3,#5F6D77);margin-top:4px}.tx-sk.off{opacity:.45;cursor:not-allowed}.tx-conq{width:100%;font-size:11.5px;color:var(--ink-2,#47545F)}' +
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
    '#tx-painel:not(.tx-doca){resize:both;min-width:300px;min-height:360px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)}' +
    '#tx-painel.tx-doca{left:auto!important;right:0!important;top:0!important;bottom:0;width:min(420px,100vw)!important;height:100vh!important;border-radius:0;border-width:0 0 0 1px;animation:none}' +
    '#tx-painel header button[aria-pressed="true"]{background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}' +
    '.tx-gaveta{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid var(--rule,#DCE3E9);background:var(--surface,#fff);max-height:55%;overflow:auto}.tx-gaveta[hidden]{display:none}' +
    '#tx-cfg{flex-direction:column;flex-wrap:nowrap;gap:7px;font-size:12.5px}.tx-cfg-sec{font:700 11px Archivo,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3,#5F6D77);margin-top:4px}' +
    '.tx-cfg-it{display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.35}.tx-cfg-it input[type=text],.tx-cfg-it select,.tx-cfg-it textarea{font:inherit;padding:4px 7px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.tx-cfg-it textarea{width:100%;min-height:70px}.tx-cfg-area{flex-direction:column;align-items:stretch}' +
    '.tx-cfg-bool{flex-wrap:nowrap;align-items:flex-start}.tx-cfg-bool input{margin:2px 0 0;flex:none}' +
    '.tx-aj-form{display:flex;flex-direction:column;gap:5px;margin-top:4px}.tx-aj-form input,.tx-aj-form textarea{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.tx-aj-form .tx-cb{align-self:flex-start}.tx-conf-l .tx-mini{margin-left:4px}' +
    '.tx-cfg-uso{font-size:11.5px;color:var(--ink-3,#5F6D77)}#tx-cfg .tx-cb{align-self:flex-start;padding:4px 10px;font-size:12px}' +
    '.tx-fixo{display:inline-flex;align-items:center;gap:2px}.tx-fixo-x{border:0;background:none;color:var(--ink-3,#5F6D77);cursor:pointer;font-size:11px;padding:2px 4px}' +
    '.tx-md{display:flex;flex-direction:column;gap:3px;align-self:stretch}.tx-acts{display:flex;flex-wrap:wrap;gap:2px;padding-left:4px}' +
    '.tx-mini{border:0;background:none;color:var(--ink-3,#5F6D77);font:600 11px "IBM Plex Sans",sans-serif;padding:3px 6px;border-radius:5px;cursor:pointer;line-height:1.2}.tx-mini:hover{background:var(--surface-3,#EAEFF3);color:var(--ink,#101820)}.tx-mini.on{background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}' +
    '.tx-bloco h4 .tx-h4t{flex:1;min-width:0}.tx-bloco h4 .tx-h4a{display:inline-flex;gap:0;margin-left:auto}.tx-bloco h4 .tx-mini{padding:1px 5px}' +
    '.tx-tab{display:block;overflow-x:auto;margin:2px 0;white-space:normal}.tx-tab table{border-collapse:collapse;font-size:12px;min-width:100%}.tx-tab th,.tx-tab td{border:1px solid var(--rule,#DCE3E9);padding:3px 7px;text-align:left;vertical-align:top}.tx-tab th{background:var(--surface-3,#EAEFF3);font-weight:700}' +
    '.tx-sep{align-self:center;font-size:11px;color:var(--ink-3,#5F6D77);border-bottom:1px dashed var(--rule-strong,#C2CCD5);padding:0 10px 2px}' +
    '#tx-sug{position:absolute;left:8px;right:8px;bottom:54px;z-index:2;background:var(--surface,#fff);border:1px solid var(--rule-strong,#C2CCD5);border-radius:8px;box-shadow:0 8px 24px rgba(16,24,32,.18);max-height:230px;overflow:auto;display:flex;flex-direction:column}#tx-sug[hidden]{display:none}' +
    '.tx-sg{display:flex;flex-direction:column;align-items:flex-start;border:0;background:none;color:inherit;text-align:left;padding:6px 10px;cursor:pointer;font:inherit}.tx-sg span{font-size:11px;color:var(--ink-3,#5F6D77)}.tx-sg:hover,.tx-sg.on{background:var(--blue-pale,#DCE8F1)}' +
    '#tx-anx{display:flex;gap:6px;padding:6px 8px 0}#tx-anx[hidden]{display:none}.tx-anx-i{position:relative}.tx-anx-i img{width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--rule,#DCE3E9)}.tx-anx-i button{position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:18px;height:18px;font-size:10px;background:var(--ink,#101820);color:var(--surface,#fff);cursor:pointer}' +
    '#tx-painel form .tx-ib{background:none;color:var(--ink-2,#47545F);padding:0 7px;font-size:15px}#tx-painel form .tx-ib[hidden]{display:none}#tx-painel form .tx-ib.on{color:var(--brand-red,#C2000C);animation:txPensa 1s infinite}' +
    '.tx-graf{margin:0;border:1px solid var(--rule,#DCE3E9);border-radius:8px;padding:8px 10px;background:var(--surface,#fff);display:flex;flex-direction:column;gap:5px}.tx-graf figcaption{font:700 12px Archivo,sans-serif;color:var(--ink-2,#47545F);margin-bottom:2px}' +
    '.tx-gr{display:grid;grid-template-columns:minmax(0,38%) minmax(0,1fr) auto;gap:8px;align-items:center;font-size:11.5px}.tx-gr-r{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-2,#47545F)}.tx-gr-t{height:8px;background:var(--surface-3,#EAEFF3);border-radius:0 4px 4px 0;display:block}.tx-gr-t i{display:block;height:100%;background:var(--blue-deep,#3C659B);border-radius:0 4px 4px 0}.tx-gr b{font-variant-numeric:tabular-nums;color:var(--ink,#101820);font-weight:600}' +
    '#tx-painel.tx-grande{font-size:15px}#tx-painel.tx-grande .tx-lin span,#tx-painel.tx-grande .tx-rod{font-size:13px}#tx-painel.tx-grande .tx-chip{font-size:13.5px}' +
    '#tx-painel.tx-contraste{--surface:#fff;--surface-2:#fff;--surface-3:#e6e6e6;--ink:#000;--ink-2:#000;--ink-3:#222;--rule:#000;--rule-strong:#000;--blue-deep:#0033a0;--blue-pale:#d6e2ff}#tx-painel.tx-contraste .tx-t1,#tx-painel.tx-contraste .tx-bloco{border-width:2px}' +
    '@media (max-width:600px){#tx-painel{left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto!important;height:min(72vh,560px)!important;resize:none}#tx-mascote{transition:none}}';

  function vw() { return Math.min(doc.documentElement.clientWidth || innerWidth, innerWidth); }
  function vh() { return Math.min(doc.documentElement.clientHeight || innerHeight, innerHeight); }
  function classe(add, rem) { (rem || []).forEach(function (c) { el.classList.remove(c); }); (add || []).forEach(function (c) { el.classList.add(c); }); }
  function balao(txt, ms) {
    var b = $(".tx-balao", el); if (!b) return;
    b.textContent = txt; b.style.marginLeft = "0px"; b.classList.add("on"); clearTimeout(b.__t); b.__t = setTimeout(function () { b.classList.remove("on"); }, ms || 3200);
    try { var r = b.getBoundingClientRect(), dx = 0; if (r.right > vw() - 8) dx = vw() - 8 - r.right; else if (r.left < 8) dx = 8 - r.left; b.style.marginLeft = dx + "px"; } catch (e) {}
  }
  function acordar() { dormiu = false; classe([], ["tx-dorme"]); clearTimeout(tSono); var hr = new Date().getHours(); tSono = setTimeout(adormecer, hr >= 19 || hr < 7 ? 40000 : 120000); }
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
      var h = hw(), mn = minX() + h, mxx = vw() - h, passo = VEL * velFator() * dt * dirMov; pegada();
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
  // No celular o Tax fica quieto no canto (toque abre a conversa).
  function celular() { return vw() <= 600; }
  var parado2 = function () { return false; };
  function agendarPasseio() {
    clearTimeout(tWander);
    tWander = setTimeout(function () {
      if (!aberto && !oculto && !dormiu && modo === "parado" && !doc.hidden && !reduzido() && !celular() && !parado2()) passear();
      else agendarPasseio();
    }, rnd(4500, 11000) / velFator());
  }
  function passear() {
    atualizarPlats();
    var cur = apoio(fx, fy, 10);
    if (!cur) { cair(); return; }
    atual = cur;
    if (Math.random() < 0.4) {
      var prev = bfs(cur), alc = []; prev.forEach(function (v, k) { alc.push(k); });
      var bons = alc.filter(bomLugar); if (bons.length) alc = bons;
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
  // Rolagem: o mascote se segura (o chão está se mexendo).
  var tSeg = 0;
  function segurar() { if (!el || modo !== "parado") return; el.classList.add("tx-segura"); clearTimeout(tSeg); tSeg = setTimeout(function () { el.classList.remove("tx-segura"); }, 450); }
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
    if (ev.button || oculto || !el || celular()) return;
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
        var ts = 0; d.addEventListener("scroll", function () { segurar(); clearTimeout(ts); ts = setTimeout(reapoiar, 120); }, true);
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
  var msgs = null, hist = [], anexos = [], SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var HIST = "tx-hist-v1", FIXOS = "tx-fixos-v1";
  function guardarHist(r, x) { if (!x) return; var h = lerLS(HIST, []); h.push({r: r, x: String(x).slice(0, 1500), t: Date.now()}); gravarLS(HIST, h.slice(-40)); }
  function textoDosBlocos(bl) {
    var out = [];
    (bl || []).forEach(function (b) {
      if (b.tipo === "md" || b.tipo === "texto" || b.tipo === "cab") out.push(b.texto);
      else if (b.tipo === "ajuda") out.push("**" + b.titulo + "**\n" + b.texto);
      else if (b.tipo === "linhas") out.push("**" + b.titulo + "**\n" + b.linhas.slice(0, 5).map(function (l) { return "- " + l.t + (l.sub ? " (" + l.sub + ")" : ""); }).join("\n"));
      else if (b.tipo === "confirma") out.push("[cartão: " + (b.plano.titulo || "ação") + "]");
    });
    return out.join("\n");
  }
  // Configurações do assistente (cada lote acrescenta itens).
  var CFG = [
    {sec: "Conversa", itens: [
      {k: "nome", rot: "Nome do assistente", tipo: "texto", ph: "Tax", ao: function () { atualizarNome(); }},
      {k: "iniciante", rot: "Modo iniciante: explica os termos e o porquê de cada passo", tipo: "bool"},
      {k: "economia", rot: "Modo economia: perguntas simples respondidas sem IA", tipo: "bool"},
      {k: "lerVoz", rot: "Ler as respostas em voz alta", tipo: "bool"},
      {k: "fonteGrande", rot: "Letra maior no chat", tipo: "bool", ao: aplicarVisualPainel},
      {k: "contraste", rot: "Alto contraste no chat", tipo: "bool", ao: aplicarVisualPainel},
      {k: "doca", rot: "Chat fixo na lateral da tela", tipo: "bool", ao: aplicarVisualPainel},
      {rot: "Desfazer o que o assistente gravou na última hora", tipo: "botao", ao: function () { var g = $("#tx-cfg", painel); if (g) g.hidden = true; addUser("/desfazer"); desfazerRecentes().then(function (bl) { addBot(bl); }); }}
    ]}
  ];
  var COMANDOS = [
    ["/hoje", "o que vence hoje", "O que vence hoje"], ["/semana", "o que vence esta semana", "Vencimentos da semana"],
    ["/atrasos", "quem está atrasado", "Quem está atrasado"], ["/cliente", "pendências do cliente", "Aguardando o cliente"],
    ["/cardapio", "cardápio da semana", "Cardápio da semana"], ["/empresa", "", "Ficha de uma empresa: /empresa nome"],
    ["/abrir", "", "Abrir uma tela: /abrir fiscal agenda"], ["/limpar", "", "Apagar esta conversa"],
    ["/config", "", "Configurações do assistente"], ["/ajuda", "", "Lista de comandos"]
  ];
  function comando(txt) {
    var m = /^\/(\S+)\s*(.*)$/.exec(txt.trim()), c = m ? m[1].toLowerCase() : "", resto = m ? m[2] : "";
    var dir = COMANDOS.filter(function (x) { return x[0] === "/" + c; })[0];
    var extra = (COMANDOS_EXTRA[c] || null);
    if (extra) return extra(resto);
    if (c === "limpar") { limparConversa(); return null; }
    if (c === "config") { abrirConfig(); return null; }
    if (c === "empresa") return resto ? porRegrasDireto("empresa " + resto) : Promise.resolve([T("Diga o nome: /empresa Alfa Comércio")]);
    if (c === "abrir") return resto ? porRegrasDireto("abrir " + resto) : Promise.resolve([T("Diga a tela: /abrir fiscal agenda")]);
    if (dir && dir[1]) return porRegrasDireto(dir[1] + (resto ? " " + resto : ""));
    return Promise.resolve([{tipo: "ajuda", titulo: "Comandos (respondidos sem IA)", texto: COMANDOS.concat(Object.keys(COMANDOS_EXTRA).map(function (k) { return ["/" + k, "", COMANDOS_EXTRA[k].rot || ""]; })).map(function (x) { return x[0] + " · " + x[2]; }).join("\n")}]);
  }
  var COMANDOS_EXTRA = {};
  function porRegrasDireto(frase) { return carregarTodos().then(quemSou).then(function () { return entender(frase, norm(frase)); }); }
  function limparConversa() {
    conversa = []; guardarConversa(); gravarLS(HIST, []);
    if (msgs) { msgs.innerHTML = ""; boasVindas(false); }
  }
  function atualizarSub() {
    var sub = painel && $("#tx-sub", painel); if (!sub) return;
    var n = usoHoje();
    sub.textContent = iaOk ? "com IA · " + (n ? n + (n === 1 ? " pergunta hoje" : " perguntas hoje") : "assistente do Control Hub") : "assistente do Control Hub";
  }
  function atualizarNome() {
    if (painel) { var b = $("header b", painel); if (b) b.textContent = nomeTax(); }
    if (el) { el.setAttribute("aria-label", "Abrir o assistente " + nomeTax()); el.title = nomeTax() + ", o assistente do Hub"; }
  }
  function aplicarVisualPainel() {
    if (!painel) return;
    var p = lerPref();
    painel.classList.toggle("tx-grande", !!p.fonteGrande);
    painel.classList.toggle("tx-contraste", !!p.contraste);
    painel.classList.toggle("tx-doca", !!p.doca);
    var bd = $("#tx-doca-b", painel); if (bd) bd.setAttribute("aria-pressed", p.doca ? "true" : "false");
    if (!p.doca && p.tam && p.tam.w) { painel.style.width = p.tam.w + "px"; painel.style.height = p.tam.h + "px"; } else { painel.style.width = ""; painel.style.height = ""; }
    posicionarPainel();
  }
  function montarPainel() {
    painel = doc.createElement("section");
    painel.id = "tx-painel"; painel.setAttribute("role", "dialog"); painel.setAttribute("aria-label", "Conversa com o assistente"); painel.hidden = true;
    painel.innerHTML = '<header><span class="tx-av">' + svgSkin(skinKey) + '</span><div class="tx-t"><b></b><small id="tx-sub">assistente do Control Hub</small></div>' +
      '<button type="button" id="tx-fixos-b" title="Perguntas fixadas" aria-label="Perguntas fixadas">📌</button>' +
      '<button type="button" id="tx-visual" title="Mudar o visual" aria-label="Mudar o visual">🎨</button>' +
      '<button type="button" id="tx-cfg-b" title="Configurações" aria-label="Configurações">⚙</button>' +
      '<button type="button" id="tx-doca-b" title="Fixar o chat na lateral" aria-label="Fixar o chat na lateral" aria-pressed="false">◨</button>' +
      '<button type="button" id="tx-fecha" aria-label="Fechar a conversa">✕</button></header>' +
      '<div id="tx-skins" class="tx-gaveta" hidden></div><div id="tx-cfg" class="tx-gaveta" hidden></div><div id="tx-fixos" class="tx-gaveta" hidden></div>' +
      '<div id="tx-msgs" aria-live="polite"></div>' +
      '<div id="tx-sug" role="listbox" hidden></div><div id="tx-anx" hidden></div>' +
      '<form autocomplete="off"><button type="button" class="tx-ib" id="tx-clipe" title="Anexar imagem (print, foto de documento)" aria-label="Anexar imagem" hidden>📎</button><input type="file" id="tx-arq" accept="image/*" multiple hidden>' +
      '<input id="tx-in" type="text" maxlength="600" placeholder="Pergunte, peça algo ou digite / para comandos" aria-label="Mensagem para o assistente" aria-autocomplete="list" aria-controls="tx-sug">' +
      '<button type="button" class="tx-ib" id="tx-mic" title="Falar a pergunta" aria-label="Falar a pergunta" hidden>🎤</button><button type="submit" id="tx-env">Enviar</button></form>';
    doc.body.appendChild(painel);
    msgs = $("#tx-msgs", painel);
    atualizarNome();
    $("#tx-fecha", painel).onclick = fecharPainel;
    $("#tx-visual", painel).onclick = abrirVisuais;
    $("#tx-cfg-b", painel).onclick = abrirConfig;
    $("#tx-fixos-b", painel).onclick = abrirFixos;
    $("#tx-doca-b", painel).onclick = function () { salvarPref({doca: !lerPref().doca}); aplicarVisualPainel(); };
    var inp = $("#tx-in", painel);
    $("form", painel).onsubmit = function (e) {
      e.preventDefault();
      if (sugAtivo()) { escolherSug(); return; }
      var v = inp.value.trim(); if (!v && !anexos.length) return;
      inp.value = ""; fecharSug();
      enviar(v || "O que tem nesta imagem?");
    };
    inp.addEventListener("input", atualizarSug);
    inp.addEventListener("keydown", teclaSug);
    inp.addEventListener("blur", function () { setTimeout(fecharSug, 150); });
    inp.addEventListener("paste", function (e) {
      var lim = limitesImagem(); if (!lim || !e.clipboardData) return;
      var fs = [].slice.call(e.clipboardData.files || []).filter(function (f) { return /^image\//.test(f.type); });
      if (fs.length) { e.preventDefault(); anexar(fs); }
    });
    $("#tx-clipe", painel).onclick = function () { $("#tx-arq", painel).click(); };
    $("#tx-arq", painel).onchange = function () { anexar([].slice.call(this.files || [])); this.value = ""; };
    if (SR) { $("#tx-mic", painel).hidden = false; $("#tx-mic", painel).onclick = ouvir; }
    try { new ResizeObserver(function () { if (!aberto || lerPref().doca || !painel.style.width) return; salvarPref({tam: {w: painel.offsetWidth, h: painel.offsetHeight}}); }).observe(painel); } catch (e) {}
    painel.addEventListener("mouseup", function () { if (!lerPref().doca && (painel.style.width || painel.style.height)) salvarPref({tam: {w: painel.offsetWidth, h: painel.offsetHeight}}); });
    aplicarVisualPainel();
  }
  function posicionarPainel() {
    if (!painel || !aberto) return;
    if (lerPref().doca) { painel.style.left = ""; painel.style.top = ""; return; }
    if (vw() <= 600) { painel.style.left = ""; painel.style.top = ""; return; }
    var pw = Math.min(painel.offsetWidth || 380, vw() - 16), ph = Math.min(painel.offsetHeight || 540, vh() - 24);
    var x = pos.x + W / 2 - pw / 2, y = pos.y - ph - 10;
    if (y < 8) y = Math.min(pos.y + HM + 10, vh() - ph - 8);
    x = Math.max(8, Math.min(vw() - pw - 8, x)); y = Math.max(8, Math.min(vh() - ph - 8, y));
    painel.style.left = x + "px"; painel.style.top = y + "px";
  }
  function gavetas(id) {
    ["tx-skins", "tx-cfg", "tx-fixos"].forEach(function (g) { var x = $("#" + g, painel); if (x && g !== id) x.hidden = true; });
    var box = $("#" + id, painel); if (!box) return null;
    if (!box.hidden) { box.hidden = true; return null; }
    box.innerHTML = ""; box.hidden = false; return box;
  }
  function abrirConfig() {
    if (!painel) montarPainel();
    var box = gavetas("tx-cfg"); if (!box) return;
    var p = lerPref();
    CFG.forEach(function (s) {
      if (s.so && !s.so()) return;
      var h = doc.createElement("div"); h.className = "tx-cfg-sec"; h.textContent = s.sec; box.appendChild(h);
      s.itens.forEach(function (it) {
        if (it.so && !it.so()) return;
        var lb = doc.createElement("label"); lb.className = "tx-cfg-it tx-cfg-" + it.tipo;
        if (it.tipo === "bool") {
          var c = doc.createElement("input"); c.type = "checkbox"; c.checked = it.padrao ? p[it.k] !== false : !!p[it.k];
          c.onchange = function () { var o = {}; o[it.k] = c.checked; salvarPref(o); if (it.ao) it.ao(c.checked); };
          lb.appendChild(c); lb.appendChild(doc.createTextNode(" " + it.rot));
        } else if (it.tipo === "sel") {
          lb.appendChild(doc.createTextNode(it.rot + " "));
          var s2 = doc.createElement("select");
          it.opcoes.forEach(function (o) { var op = doc.createElement("option"); op.value = o[0]; op.textContent = o[1]; s2.appendChild(op); });
          s2.value = p[it.k] != null ? p[it.k] : it.opcoes[0][0];
          s2.onchange = function () { var o = {}; o[it.k] = s2.value; salvarPref(o); if (it.ao) it.ao(s2.value); };
          lb.appendChild(s2);
        } else if (it.tipo === "botao") {
          var b = doc.createElement("button"); b.type = "button"; b.className = "tx-cb"; b.textContent = it.rot; b.onclick = function (ev) { ev.preventDefault(); it.ao(b); }; lb.appendChild(b);
        } else if (it.tipo === "info") {
          lb.textContent = typeof it.rot === "function" ? it.rot() : it.rot;
        } else {
          lb.appendChild(doc.createTextNode(it.rot + " "));
          var t = doc.createElement(it.tipo === "area" ? "textarea" : "input"); if (it.tipo !== "area") t.type = "text"; t.value = it.valor ? it.valor() : (p[it.k] || ""); t.placeholder = it.ph || ""; t.maxLength = it.max || 20;
          t.onchange = function () { if (it.salvar) it.salvar(t.value); else { var o = {}; o[it.k] = t.value.trim(); salvarPref(o); } if (it.ao) it.ao(t.value); };
          lb.appendChild(t);
        }
        box.appendChild(lb);
      });
    });
    var uso = doc.createElement("div"); uso.className = "tx-cfg-uso";
    uso.textContent = "IA neste navegador: " + usoHoje() + " pergunta(s) hoje, " + (+lerLS("tx-uso-tot", 0) || 0) + " no total. Cada pergunta à IA usa o plano do Claude de quem pergunta." + (cfgEquipe.limiteDia ? " Limite da equipe: " + cfgEquipe.limiteDia + " por dia." : "");
    box.appendChild(uso);
    var lim = doc.createElement("button"); lim.type = "button"; lim.className = "tx-cb"; lim.textContent = "Apagar esta conversa"; lim.onclick = function () { limparConversa(); box.hidden = true; }; box.appendChild(lim);
  }
  function abrirFixos() {
    var box = gavetas("tx-fixos"); if (!box) return;
    var fx2 = lerLS(FIXOS, []);
    if (!fx2.length) { box.innerHTML = '<div class="tx-rod">Nenhuma pergunta fixada. Use 📌 embaixo de uma resposta para guardar a pergunta aqui.</div>'; return; }
    fx2.forEach(function (q, i) {
      var w = doc.createElement("span"); w.className = "tx-fixo";
      var b = doc.createElement("button"); b.type = "button"; b.className = "tx-chip"; b.textContent = q; b.onclick = function () { box.hidden = true; enviar(q); };
      var x = doc.createElement("button"); x.type = "button"; x.className = "tx-fixo-x"; x.textContent = "✕"; x.title = "Desafixar"; x.setAttribute("aria-label", "Desafixar " + q);
      x.onclick = function () { var l = lerLS(FIXOS, []); l.splice(i, 1); gravarLS(FIXOS, l); box.hidden = true; abrirFixos(); };
      w.appendChild(b); w.appendChild(x); box.appendChild(w);
    });
  }
  function fixar(q) { var l = lerLS(FIXOS, []).filter(function (x) { return x !== q; }); l.unshift(q); gravarLS(FIXOS, l.slice(0, 10)); }

  /* ---- autocompletar: comandos com "/", nomes de empresas e analistas ---- */
  var sugIdx = -1, sugItens = [];
  function sugAtivo() { var s = $("#tx-sug", painel); return s && !s.hidden && sugIdx >= 0; }
  function fecharSug() { var s = painel && $("#tx-sug", painel); if (s) s.hidden = true; sugIdx = -1; sugItens = []; }
  function atualizarSug() {
    var inp = $("#tx-in", painel), v = inp.value, s = $("#tx-sug", painel), itens = [];
    if (/^\/\S*$/.test(v)) {
      var c = v.toLowerCase();
      itens = COMANDOS.concat(Object.keys(COMANDOS_EXTRA).map(function (k) { return ["/" + k, "", COMANDOS_EXTRA[k].rot || ""]; })).filter(function (x) { return x[0].indexOf(c) === 0; }).map(function (x) { return {rot: x[0], sub: x[2], valor: x[0] + " "}; });
    } else {
      var m = /(\S{3,})$/.exec(v);
      if (m && apisCarregadas().length) {
        var w = norm(m[1]), ix = indice(), achou = {};
        ix.empresas.forEach(function (g) { if (itens.length >= 6) return; if (norm(g.nome).split(" ").some(function (t) { return t.indexOf(w) === 0; }) && !achou[g.nome]) { achou[g.nome] = 1; itens.push({rot: g.nome, sub: "empresa · " + Object.keys(g.refs).map(function (k) { return MODN[k]; }).join(", "), valor: v.slice(0, m.index) + g.nome}); } });
        ix.analistas.forEach(function (n) { if (itens.length >= 8) return; if (norm(n).split(" ").some(function (t) { return t.indexOf(w) === 0; })) itens.push({rot: n, sub: "analista", valor: v.slice(0, m.index) + n}); });
        if (itens.length === 1 && norm(itens[0].rot) === norm(v.slice(m.index))) itens = [];
      }
    }
    sugItens = itens; sugIdx = -1;
    if (!itens.length) { s.hidden = true; return; }
    s.innerHTML = "";
    itens.forEach(function (it, i) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "tx-sg"; b.setAttribute("role", "option");
      b.innerHTML = "<b>" + esc(it.rot) + "</b><span>" + esc(it.sub || "") + "</span>";
      b.onmousedown = function (e) { e.preventDefault(); sugIdx = i; escolherSug(); };
      s.appendChild(b);
    });
    s.hidden = false;
  }
  function teclaSug(e) {
    var s = $("#tx-sug", painel); if (s.hidden || !sugItens.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : -1) + sugItens.length) % sugItens.length; [].forEach.call(s.children, function (c, i) { c.classList.toggle("on", i === sugIdx); }); }
    else if (e.key === "Tab") { e.preventDefault(); if (sugIdx < 0) sugIdx = 0; escolherSug(); }
    else if (e.key === "Escape") { e.stopPropagation(); fecharSug(); }
  }
  function escolherSug() { var it = sugItens[sugIdx]; if (!it) return; var inp = $("#tx-in", painel); inp.value = it.valor; fecharSug(); inp.focus(); }

  /* ---- anexos (imagens para a IA) ---- */
  function anexar(fs) {
    var lim = limitesImagem(); if (!lim) return;
    var tipos = lim.mediaTypes || [];
    fs.forEach(function (f) { if ((!tipos.length || tipos.indexOf(f.type) !== -1) && anexos.length < (lim.maxCount || 1)) anexos.push(f); });
    pintarAnexos();
  }
  function pintarAnexos() {
    var a = $("#tx-anx", painel); a.innerHTML = "";
    anexos.forEach(function (f, i) {
      var w = doc.createElement("span"); w.className = "tx-anx-i";
      var im = doc.createElement("img"); im.alt = f.name || "imagem"; try { im.src = URL.createObjectURL(f); } catch (e) {}
      var x = doc.createElement("button"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Tirar anexo"); x.onclick = function () { anexos.splice(i, 1); pintarAnexos(); };
      w.appendChild(im); w.appendChild(x); a.appendChild(w);
    });
    a.hidden = !anexos.length;
  }
  function atualizarClipe() { var c = painel && $("#tx-clipe", painel); if (c) c.hidden = !limitesImagem(); }

  /* ---- voz: ditar a pergunta e ouvir a resposta ---- */
  var rec = null;
  function ouvir() {
    var b = $("#tx-mic", painel), inp = $("#tx-in", painel);
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    try { rec = new SR(); } catch (e) { b.hidden = true; return; }
    rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = false;
    var final = "";
    rec.onresult = function (ev) { var t = ""; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; inp.value = t; if (ev.results[ev.results.length - 1].isFinal) final = t; };
    rec.onerror = function (ev) { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { b.hidden = true; addBot([{tipo: "rodape", texto: "O microfone está bloqueado nesta página: digite a pergunta."}]); } };
    rec.onend = function () { b.classList.remove("on"); rec = null; var v = (final || "").trim(); if (v) { inp.value = ""; enviar(v); } };
    b.classList.add("on");
    try { rec.start(); } catch (e) { rec = null; b.classList.remove("on"); }
  }
  function falar(txt) {
    try {
      var s = window.speechSynthesis; if (!s) return false;
      s.cancel();
      var u = new SpeechSynthesisUtterance(String(txt).replace(/[*#`|»•]/g, " ").replace(/\s+/g, " ").slice(0, 1200));
      u.lang = "pt-BR";
      var v = s.getVoices().filter(function (x) { return /^pt(-|_)BR/i.test(x.lang); })[0]; if (v) u.voice = v;
      s.speak(u); return true;
    } catch (e) { return false; }
  }

  function rolar() { msgs.scrollTop = msgs.scrollHeight; }
  function addUser(txt, semGuardar) { var d = doc.createElement("div"); d.className = "tx-m-u"; d.textContent = txt; msgs.appendChild(d); rolar(); if (!semGuardar) guardarHist("u", txt); }
  function addBot(blocos, semGuardar) {
    if (!blocos || !blocos.length) return null;
    var d = doc.createElement("div"); d.className = "tx-m-b";
    blocos.forEach(function (b) { var n = blocoDom(b); if (n) d.appendChild(n); });
    msgs.appendChild(d);
    if (d.offsetHeight > msgs.clientHeight) msgs.scrollTop = d.offsetTop - msgs.offsetTop - 6; else rolar();
    if (!semGuardar) guardarHist("b", textoDosBlocos(blocos));
    return d;
  }
  function botaoMini(rot, titulo, fn) { var x = doc.createElement("button"); x.type = "button"; x.className = "tx-mini"; x.textContent = rot; x.title = titulo; x.setAttribute("aria-label", titulo); x.onclick = function () { fn(x); }; return x; }
  function barraAcoes(b) {
    var bar = doc.createElement("div"); bar.className = "tx-acts";
    var q = b.pergunta || "";
    bar.appendChild(botaoMini("Explicar melhor", "Explicar melhor", function () { enviar("Explicar melhor", {oculto: "Explique melhor e com mais detalhes a sua resposta anterior."}); }));
    if (q) bar.appendChild(botaoMini("↻", "Responder de outro jeito", function () {
      if (conversa.length && conversa[conversa.length - 1].role === "assistant") { conversa.pop(); if (conversa.length && conversa[conversa.length - 1].role === "user") conversa.pop(); }
      enviar("↻ " + q, {oculto: q + "\n(Responda de outro jeito, mais claro.)"});
    }));
    var avaliou = false;
    function aval(bom, x) {
      if (avaliou) return; avaliou = true; x.classList.add("on");
      registrarFeedback(q, b.texto, bom);
      if (!bom) addBot([T("Obrigado pelo aviso! Quer que eu tente de outro jeito?"), CH([{rot: "Tentar de novo", enviar: "↻ " + q, oculto: q + "\n(A resposta anterior não ajudou. Responda de outro jeito, mais claro e completo.)"}])]);
    }
    bar.appendChild(botaoMini("👍", "Resposta útil", function (x) { aval(true, x); }));
    bar.appendChild(botaoMini("👎", "Resposta não ajudou", function (x) { aval(false, x); }));
    bar.appendChild(botaoMini("⧉", "Copiar a resposta", function (x) { copiarTexto(b.texto.replace(/\*\*/g, "")).then(function (ok) { x.textContent = ok ? "✓" : "✕"; setTimeout(function () { x.textContent = "⧉"; }, 1500); }); }));
    if (window.speechSynthesis) bar.appendChild(botaoMini("🔊", "Ouvir a resposta", function () { falar(b.texto); }));
    if (q) bar.appendChild(botaoMini("📌", "Fixar esta pergunta", function (x) { fixar(q); x.classList.add("on"); x.title = "Fixada"; }));
    return bar;
  }
  function blocoDom(b) {
    var d;
    if (b.tipo === "md") {
      d = doc.createElement("div"); d.className = "tx-md";
      var bolha = doc.createElement("div"); bolha.className = "tx-t1"; bolha.innerHTML = mdHtml(b.texto); d.appendChild(bolha);
      if (b.acoes) { d.appendChild(barraAcoes(b)); if (lerPref().lerVoz) setTimeout(function () { falar(b.texto); }, 50); }
      return d;
    }
    if (b.tipo === "texto") { d = doc.createElement("div"); d.className = "tx-t1"; d.textContent = mascarar(b.texto); return d; }
    if (b.tipo === "cab") { d = doc.createElement("div"); d.className = "tx-cab"; d.textContent = b.texto; return d; }
    if (b.tipo === "rodape") { d = doc.createElement("div"); d.className = "tx-rod"; d.textContent = b.texto; return d; }
    if (b.tipo === "ajuda") { d = doc.createElement("div"); d.className = "tx-aj"; d.innerHTML = "<b>" + esc(b.titulo) + "</b>" + esc(b.texto); return d; }
    if (b.tipo === "chips") {
      d = doc.createElement("div"); d.className = "tx-chips";
      b.itens.forEach(function (c) {
        var x = doc.createElement("button"); x.type = "button"; x.className = "tx-chip"; x.textContent = c.rot;
        x.onclick = function () { if (c.enviar) enviar(c.enviar, {forcarIA: c.forcarIA, oculto: c.oculto}); else if (c.acao) { var r = c.acao(); if (r && r.then) r.then(function (bl) { if (Array.isArray(bl)) addBot(bl); }).catch(function () {}); } };
        d.appendChild(x);
      });
      return d;
    }
    if (b.tipo === "confirma") return cartaoConfirma(b);
    if (b.tipo === "grafico") return graficoDom(b);
    if (b.tipo === "linhas") {
      d = doc.createElement("div"); d.className = "tx-bloco";
      var h = doc.createElement("h4"); var ht = doc.createElement("span"); ht.className = "tx-h4t"; ht.textContent = b.titulo; h.appendChild(ht);
      if (b.nota) { var s = doc.createElement("small"); s.textContent = b.nota; h.appendChild(s); }
      var todas = b.todas || b.linhas;
      var ac = doc.createElement("span"); ac.className = "tx-h4a";
      ac.appendChild(botaoMini("⬇", "Baixar a lista em planilha (" + todas.length + " itens)", function (x) { exportarLinhas(b.titulo, todas).then(function (ok) { x.textContent = ok ? "✓" : "⬇"; setTimeout(function () { x.textContent = "⬇"; }, 1800); }); }));
      ac.appendChild(botaoMini("⧉", "Copiar a lista", function (x) { copiarTexto(b.titulo + "\n" + todas.map(function (l) { return "• " + mascarar(l.t) + (l.sub ? " — " + mascarar(l.sub) : ""); }).join("\n")).then(function (ok) { x.textContent = ok ? "✓" : "✕"; setTimeout(function () { x.textContent = "⧉"; }, 1500); }); }));
      h.appendChild(ac);
      d.appendChild(h);
      b.linhas.forEach(function (l) {
        var x = doc.createElement(l.abrir ? "button" : "div"); x.className = "tx-lin " + (l.tom || "");
        if (l.abrir) { x.type = "button"; x.title = "Abrir no " + MODN[l.mod]; x.onclick = function () { abrirItem(l.mod, l.abrir, l).then(function () { if (!l.abrir.empresa) setTimeout(function () { mostrarNaTela(String(l.t).split(" · ")[0].replace(/^(Treinamento|Impedimento|Admissão recente|Férias|Afastado|Sem analista|Sem CNPJ):\s*/, "")); }, 700); }); }; }
        x.innerHTML = "<i></i><div><b>" + esc(mascarar(l.t)) + "</b>" + (l.sub ? "<span>" + esc(mascarar(l.sub)) + "</span>" : "") + "</div>";
        d.appendChild(x);
      });
      if (b.mais) { var m = doc.createElement("button"); m.type = "button"; m.className = "tx-mais"; m.textContent = b.mais.rot + " ›"; m.onclick = function () { var r = b.mais.acao(); if (r && r.then) r.catch(function () {}); }; d.appendChild(m); }
      return d;
    }
    return null;
  }
  // Gráfico de barras horizontais pequeno (dentro do chat).
  function graficoDom(b) {
    var d = doc.createElement("figure"); d.className = "tx-graf";
    var cap = doc.createElement("figcaption"); cap.textContent = b.titulo || ""; d.appendChild(cap);
    var itens = (b.itens || []).filter(function (x) { return isFinite(+x.valor); }).slice(0, 12), max = Math.max.apply(null, itens.map(function (x) { return +x.valor; }).concat([0]));
    itens.forEach(function (x) {
      var r = doc.createElement("div"); r.className = "tx-gr";
      var rot = doc.createElement("span"); rot.className = "tx-gr-r"; rot.textContent = x.rotulo; rot.title = x.rotulo;
      var trilho = doc.createElement("span"); trilho.className = "tx-gr-t";
      var barra = doc.createElement("i"); barra.style.width = (max > 0 ? Math.max(2, +x.valor / max * 100) : 0) + "%"; trilho.appendChild(barra);
      var v = doc.createElement("b"); v.textContent = (+x.valor).toLocaleString("pt-BR") + (b.unidade ? " " + b.unidade : "");
      r.appendChild(rot); r.appendChild(trilho); r.appendChild(v); d.appendChild(r);
    });
    return d;
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
      return Promise.resolve().then(function () { return pl.executar(); }).then(function (msg) { pintar("ok", msg || "Pronto."); feitosSessao.push({t: Date.now(), plano: pl, ctl: ctl}); aoConfirmar(pl); }, function (e) { console.error(e); pintar("erro", "Não foi possível salvar. Nada foi alterado ou a gravação falhou: confira a tela do módulo."); });
    };
    ctl.cancelar = function () { if (ctl.feito) return; ctl.feito = true; if (pendente === ctl) pendente = null; pintar("cancelado", ""); };
    ctl.desfazer = function () { d.classList.add("tx-conf-ocupado"); return Promise.resolve().then(function () { return pl.desfazer(); }).then(function () { ctl.desfeito = true; pintar("desfeito", "Voltei ao que estava antes."); }, function () { pintar("erro", "Não consegui desfazer. Ajuste direto no módulo."); }); };
    pendente = ctl;
    pintar("", "");
    return d;
  }
  function enviar(txt, op) {
    op = op || {};
    if (!painel) montarPainel();
    fecharSug();
    if (/^\//.test(txt)) {
      addUser(txt);
      var rc = comando(txt);
      if (rc && rc.then) {
        var pc = doc.createElement("div"); pc.className = "tx-m-b"; pc.innerHTML = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>'; msgs.appendChild(pc); rolar();
        rc.then(function (bl) { pc.remove(); addBot(bl); }).catch(function () { pc.remove(); addBot([T("Não consegui executar esse comando.")]); });
      }
      return;
    }
    var imgs = anexos.slice(); anexos = []; if (painel) pintarAnexos();
    contarPergunta();
    if (/esconde.?esconde/i.test(txt)) { addUser(txt); addBot([T("Valendo! Fecha os olhos… 🙈 Agora me ache e clique em mim.")]); setTimeout(comecarEsconde, 1200); return; }
    addUser(txt + (imgs.length ? "  📎" + imgs.length : ""));
    var pensa = doc.createElement("div"); pensa.className = "tx-m-b"; pensa.innerHTML = '<div class="tx-t1 tx-pensa"><i></i><i></i><i></i></div>'; msgs.appendChild(pensa); rolar(); bolhaAtual = pensa;
    var temModulos = apisCarregadas().length >= H.modulos().length;
    var lento = setTimeout(function () { if (!temModulos && !iaOk) { var s = $(".tx-pensa", pensa); if (s) s.insertAdjacentHTML("afterend", '<span class="tx-rod" style="padding:9px 0">carregando os módulos…</span>'); } }, 900);
    responder(txt, {forcarIA: op.forcarIA, oculto: op.oculto, imagens: imgs}).then(function (bl) {
      clearTimeout(lento); pensa.remove(); hist.push({u: txt}); addBot(bl);
      if (bl && bl.naoEntendi) registrarPergunta(txt, "nao_entendi");
      aoResponder(bl);
    }).catch(function (e) { clearTimeout(lento); pensa.remove(); console.error(e); addBot([T("Tive um problema para responder agora. Tente de novo em instantes.")]); });
  }
  // Ganchos preenchidos por outras partes (mascote, avisos, equipe).
  var aoConfirmar = function () {}, aoSituacao = function () {};
  var emote = function () {};
  // Desfaz, do mais recente para o mais antigo, o que o assistente gravou na última hora (com confirmação).
  function desfazerRecentes() {
    var lim = Date.now() - 36e5, lista = feitosSessao.filter(function (x) { return x.t >= lim && !x.ctl.desfeito && x.plano.desfazer; });
    if (!lista.length) return Promise.resolve([T("Não há ações minhas da última hora para desfazer.")]);
    var planos = lista.slice().reverse().map(function (x) { return {plano: {titulo: x.plano.titulo, empresa: x.plano.empresa, linhas: ["desfazer: " + ((x.plano.linhas || [])[0] || x.plano.titulo)], executar: function () { return Promise.resolve().then(function () { return x.plano.desfazer(); }).then(function () { x.ctl.desfeito = true; }); }}}; });
    var c = cartaoLote(planos, [], "Desfazer o que fiz na última hora");
    c.plano.desfazer = null;
    return Promise.resolve([c]);
  }
  COMANDOS_EXTRA.desfazer = function () { return desfazerRecentes(); }; COMANDOS_EXTRA.desfazer.rot = "Desfazer o que o assistente gravou na última hora";
  COMANDOS_EXTRA.carga = function () { return cargaAnalistas().then(function (l) { return l.length ? [{tipo: "grafico", titulo: "Carga por analista (pontos: atrasos ×3, aguardando cliente, empresas)", itens: l.slice(0, 12).map(function (q) { return {rotulo: q.analista, valor: q.pontos}; })}, {tipo: "rodape", texto: "Pergunte “quem pode ajudar o Bruno?” para uma sugestão."}] : [T("Sem dados de carteira ainda.")]; }); }; COMANDOS_EXTRA.carga.rot = "Carga de trabalho por analista";
  COMANDOS_EXTRA.glossario = function (r) { var g = buscarGlossario(r || ""); return Promise.resolve(g ? [{tipo: "ajuda", titulo: "Glossário", texto: g}] : [T("Não tenho esse termo no glossário" + (r ? ": “" + r + "”" : "") + ". Termos: " + Object.keys(GLOSSARIO).slice(0, 30).join(", ") + "…")]); }; COMANDOS_EXTRA.glossario.rot = "Significado de um termo: /glossario DCTFWeb";
  var aoResponder = function () {}, pensando = function () {}, registrarPergunta = function () {}, registrarFeedback = function () {};
  function boasVindas(retomou) {
    var fixados = lerLS(FIXOS, []).slice(0, 4).map(function (q) { return {rot: "📌 " + q, enviar: q}; });
    var ch = fixados.concat(sugestoes().map(function (s) { return {rot: s, enviar: s}; })).slice(0, 7);
    var oi = retomou ? "Continuando de onde paramos. Pode perguntar, ou comece do zero." :
      (iaOk ? "Oi! Eu sou o " + nomeTax() + ". Pergunte do seu jeito: prazos, atrasos, empresas, cardápio, como usar o Hub… Também abro telas, preparo alterações para você confirmar e rascunho mensagens. Digite / para ver os comandos." : "Oi! Eu sou o " + nomeTax() + ". Posso responder sobre prazos, atrasos, empresas e cardápio, abrir telas e tirar dúvidas de uso. Digite / para ver os comandos.");
    var bl = [T(oi), CH(ch)];
    if (retomou) bl.push(CH([{rot: "Começar do zero", acao: function () { limparConversa(); }}]));
    addBot(bl, true);
  }
  function abrirPainel() {
    if (!painel) montarPainel();
    parar(); acordar();
    atualizarSub(); atualizarClipe();
    aberto = true; painel.hidden = false; painel.classList.remove("tx-oculto");
    aplicarVisualPainel();
    if (!msgs.children.length) {
      var h = lerLS(HIST, []);
      if (h.length) {
        var ult = h[h.length - 1].t, dt = new Date(ult);
        var sep = doc.createElement("div"); sep.className = "tx-sep"; sep.textContent = "Conversa anterior · " + dm(dt) + " " + pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()); msgs.appendChild(sep);
        h.slice(-16).forEach(function (m) { if (m.r === "u") addUser(m.x, true); else addBot([{tipo: "md", texto: m.x}], true); });
        var sep2 = doc.createElement("div"); sep2.className = "tx-sep"; sep2.textContent = "agora"; msgs.appendChild(sep2);
        boasVindas(true);
      } else boasVindas(false);
    }
    if (filaAvisos.length) mostrarFila();
    carregarTodos();
    setTimeout(function () { var i = $("#tx-in", painel); if (i) i.focus(); rolar(); }, 30);
  }
  function fecharPainel() { if (!painel) return; aberto = false; painel.hidden = true; fecharSug(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} if (el) el.focus({preventScroll: true}); }


  /* ---------- visuais ---------- */
  function aplicarSkin(k) {
    if (!SKINS[k]) return;
    skinKey = k; salvarPref({skin: k});
    HM = altura(k); el.style.setProperty("--tx-hm", HM + "px");
    acKey = ""; atualizarAcessorios();
    if (painel) { var av = $(".tx-av", painel); if (av) av.innerHTML = svgSkin(k); }
    reapoiar(); desenhar();
    balao("Gostei! 😄", 1600); classe(["tx-acena"], []); setTimeout(function () { classe([], ["tx-acena"]); }, 1400);
  }
  function abrirVisuais() {
    var box = gavetas("tx-skins"); if (!box) return;
    Object.keys(SKINS).forEach(function (k) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "tx-sk" + (k === skinKey ? " on" : ""); b.title = SKINS[k].nome;
      b.innerHTML = '<span class="tx-sk-i">' + svgSkin(k) + '</span><span>' + SKINS[k].nome + '</span>';
      b.onclick = function () { aplicarSkin(k); box.hidden = true; };
      box.appendChild(b);
    });
    var hs = doc.createElement("div"); hs.className = "tx-vis-sec"; hs.textContent = "Chapéu"; box.appendChild(hs);
    var atual = lerPref().chapeu || "auto";
    [["auto", "Automático", ""], ["nenhum", "Nenhum", ""]].concat(Object.keys(CONQ).map(function (k) { return [CONQ[k].premio, CHAPEUS[CONQ[k].premio].nome, k]; }).filter(function (x, i, arr) { return arr.findIndex(function (y) { return y[0] === x[0]; }) === i; })).forEach(function (o) {
      var ok = !o[2] || conquistado(o[0]), c = doc.createElement("button"); c.type = "button"; c.className = "tx-sk" + (atual === o[0] ? " on" : "") + (ok ? "" : " off");
      c.title = ok ? o[1] : "Conquiste: " + CONQ[o[2]].nome; c.disabled = !ok;
      c.innerHTML = '<span class="tx-sk-i">' + (CHAPEUS[o[0]] ? svgRows(CHAPEUS[o[0]].rows, CHAPEUS[o[0]].pal) : '') + '</span><span>' + esc(ok ? o[1] : "🔒 " + o[1]) + '</span>';
      c.onclick = function () { salvarPref({chapeu: o[0]}); acKey = ""; atualizarAcessorios(); box.hidden = true; balao("Que tal? 😎", 1600); };
      box.appendChild(c);
    });
    var cq = stats().conq || {}, cs = doc.createElement("div"); cs.className = "tx-conq";
    cs.textContent = "Conquistas: " + Object.keys(CONQ).map(function (k) { return (cq[k] ? "🏆 " : "🔒 ") + CONQ[k].nome; }).join(" · ");
    box.appendChild(cs);
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
    el.innerHTML = '<div class="tx-sombra"></div><div class="tx-corpo"><div class="tx-face">' + svgSkin(skinKey) + '</div></div><span class="tx-z" aria-hidden="true">z</span><span class="tx-emo" aria-hidden="true"></span><div class="tx-balao" role="status"></div>';
    if (oculto) el.classList.add("tx-oculto");
    doc.body.appendChild(el);
    atualizarNome();
    colocarInicial();
    el.addEventListener("click", function (e) { e.stopPropagation(); if (arrastou) return; if (esconde.ativo) { achouEsconde(); return; } if (dormiu) { acordar(); balao("Hã? Já acordei!", 2000); return; } aberto ? fecharPainel() : abrirPainel(); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aberto ? fecharPainel() : abrirPainel(); } });
    doc.addEventListener("click", function (ev) { aoClicar(ev, null); });
    doc.addEventListener("keydown", aoTecla);
    window.addEventListener("resize", function () { reapoiar(); posicionarPainel(); });
    var tScroll = 0; doc.addEventListener("scroll", function () { segurar(); clearTimeout(tScroll); tScroll = setTimeout(reapoiar, 120); }, true);
    setInterval(function () { if (modo === "parado" && !doc.hidden && !aberto) reapoiar(); }, 1500);
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) agendarPasseio(); });
    setInterval(function () {
      ligarQuadros();
      var esconde = oculto || algumDialogo();
      el.classList.toggle("tx-oculto", esconde);
      if (painel) painel.classList.toggle("tx-oculto", algumDialogo() && !aberto ? true : false);
    }, 600);
    ligarQuadros(); agendarPasseio(); acordar(); ouvirApelidos(); iniciarAvisos(); atualizarBadge(); iniciarMascoteExtra(); iniciarEquipe();
    if (!oculto && !lerPref().visto) { salvarPref({visto: 1}); setTimeout(function () { balao("Oi! Sou o Tax. Clique em mim para conversar.", 5200); classe(["tx-acena"], []); setTimeout(function () { classe([], ["tx-acena"]); }, 2000); }, 1800); }
  }

  /* ============ mascote: comportamento, acessórios, emotes, conquistas e som ============ */
  function velFator() { return {lento: 0.6, normal: 1, rapido: 1.6}[lerPref().vel] || 1; }
  var digitandoAte = 0, ultMouse = {x: -1, y: -1, t: Date.now()};
  parado2 = function () { return lerPref().parado || Date.now() < digitandoAte || esconde.ativo; };
  // Lugar bom para ficar: o espaço logo acima da plataforma não tem botão, campo nem link.
  function bomLugar(p) {
    if (p.piso) return true;
    try {
      var q = quadroVisivel(), d = q ? q.d : doc, ox = q ? q.rect.left : 0, oy = q ? q.rect.top : 0, cx = (p.l + p.r) / 2;
      var e = d.elementFromPoint(cx - ox, p.t - oy - HM / 2);
      return !e || !interativo(e);
    } catch (e) { return true; }
  }
  /* ---- acessórios em pixel art (chapéus por estação, setor ou conquista; óculos e gravata) ---- */
  var CHAPEUS = {
    natal: {nome: "Gorro de Natal", pal: {R: "#D7263D", W: "#FFFFFF"}, rows: ["........WW....", ".......RR.....", "....RRRRR.....", "...WWWWWWWW..."]},
    junina: {nome: "Chapéu de palha", pal: {Y: "#E3B341", D: "#B07D1E"}, rows: ["......YY......", ".....YYYY.....", "....YDDDDY....", "..YYYYYYYYYY.."]},
    festa: {nome: "Chapéu de festa", pal: {Y: "#F2C14E", P: "#C2185B", B: "#3C9EE7"}, rows: ["......Y.......", "......P.......", ".....PBP......", "....PBPBP....."]},
    carnaval: {nome: "Confete", pal: {P: "#E91E63", Y: "#FFC107", G: "#4CAF50", B: "#2196F3"}, rows: ["..P....Y...G..", "....G.....B...", ".Y.....P....Y.", ".............."]},
    coroa: {nome: "Coroa", pal: {Y: "#F4C430", R: "#D7263D"}, rows: ["..............", "...Y..R..Y....", "...YY.YY.YY...", "...YYYYYYYY..."]},
    bone: {nome: "Boné", pal: {B: "#3C659B", W: "#FFFFFF"}, rows: ["..............", ".....BBBB.....", "....BBWBBB....", "....BBBBBBBBB."]},
    laco: {nome: "Laço", pal: {P: "#E85D9E"}, rows: ["..............", "..............", "........P.P...", ".........P...."]},
    capacete: {nome: "Capacete do DP", pal: {Y: "#F2B705", D: "#C99A04"}, rows: ["..............", ".....YYYY.....", "....YYYYYY....", "...DDDDDDDD..."]}
  };
  function svgRows(rows, pal) {
    var n = rows.length;
    return '<svg viewBox="0 0 14 ' + n + '" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + runs(rows, 0, function (ch) { return pal[ch]; }) + '</svg>';
  }
  function chapeuAtual() {
    var p = lerPref(), m = new Date().getMonth(), d = new Date().getDate();
    if (p.chapeu && p.chapeu !== "auto" && p.chapeu !== "nenhum" && conquistado(p.chapeu)) return p.chapeu;
    if (p.chapeu === "nenhum") return "";
    if (p.sazonal !== false) {
      if (m === 11 && d >= 26) return "festa";
      if (m === 11) return "natal";
      if (m === 5 || (m === 6 && d <= 15)) return "junina";
      if (m === 1 || (m === 2 && d <= 5)) return "carnaval";
    }
    if (p.acSetor !== false && H.ativo() === "dp") return "capacete";
    return "";
  }
  function overlaySkin() {
    var s = skinDe(skinKey), n = s.rows.length, out = "", p = lerPref(), at = H.ativo();
    if (p.acSetor === false) return "";
    var er = -1, ec = [];
    s.rows.forEach(function (ln, j) { if (er < 0 && ln.indexOf("E") !== -1) { er = j; for (var i = 0; i < ln.length; i++) if (ln.charAt(i) === "E") ec.push(i); } });
    if (at === "fiscal" && er >= 0) {
      var grupos = []; ec.forEach(function (c) { var g = grupos[grupos.length - 1]; if (g && c - g[1] <= 1) g[1] = c; else grupos.push([c, c]); });
      grupos.forEach(function (g) { out += '<rect x="' + (g[0] - 0.6) + '" y="' + (er - 0.5) + '" width="' + (g[1] - g[0] + 2.2) + '" height="' + 2 + '" fill="rgba(140,198,236,.25)" stroke="#101820" stroke-width=".35"/>'; });
      if (grupos.length > 1) out += '<rect x="' + (grupos[0][1] + 1.6) + '" y="' + (er + 0.1) + '" width="' + (grupos[1][0] - grupos[0][1] - 2.2) + '" height=".35" fill="#101820"/>';
    }
    if (at === "contabil") { var r = Math.max(er + 3, n - 4); out += '<rect x="6.2" y="' + r + '" width="1.6" height=".9" fill="#C2000C"/><rect x="6.5" y="' + (r + .9) + '" width="1" height="2.1" fill="#C2000C"/><rect x="6.75" y="' + (r + 3) + '" width=".5" height=".5" fill="#8E0009"/>'; }
    if (!out) return "";
    return '<svg class="tx-ov" viewBox="0 0 ' + COLS + ' ' + (n + 2) + '" width="100%" height="100%" aria-hidden="true" focusable="false">' + out + '</svg>';
  }
  var acKey = "";
  function atualizarAcessorios() {
    if (!el) return;
    var face = $(".tx-face", el); if (!face) return;
    var ch = chapeuAtual(), ov = overlaySkin(), k = skinKey + "|" + ch + "|" + ov.length + "|" + H.ativo();
    if (k === acKey) return; acKey = k;
    face.innerHTML = svgSkin(skinKey) + ov + (ch ? '<span class="tx-chapeu">' + svgRows(CHAPEUS[ch].rows, CHAPEUS[ch].pal) + '</span>' : "");
  }
  /* ---- emotes, pensamento e som ---- */
  var actx = null;
  function som(tipo) {
    if (!lerPref().sons) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var notas = {pulo: [[660, .05]], festa: [[523, .08], [659, .08], [784, .14]], alerta: [[880, .08], [660, .12]], erro: [[330, .1], [262, .16]], achou: [[784, .07], [988, .07], [1319, .16]]}[tipo] || [[600, .05]], t = actx.currentTime;
      notas.forEach(function (n) { var o = actx.createOscillator(), g = actx.createGain(); o.type = "square"; o.frequency.value = n[0]; g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.001, t + n[1]); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + n[1] + .01); t += n[1]; });
    } catch (e) {}
  }
  emote = function (tipo) {
    if (!el || (emFoco() && tipo === "alerta")) return;
    var e = $(".tx-emo", el); if (!e) return;
    var txt = {festa: "✨", alerta: "❗", suor: "💦", triste: "😟", amor: "💙", ok: "👍", achou: "🎉", porta: "🚪", sono: "💤"}[tipo] || "❔";
    e.textContent = txt; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on");
    if (tipo === "festa" || tipo === "alerta" || tipo === "achou") { classe(["tx-acena"], []); setTimeout(function () { classe([], ["tx-acena"]); }, 1300); }
    som(tipo === "triste" ? "erro" : tipo === "achou" ? "achou" : tipo === "festa" ? "festa" : tipo === "alerta" ? "alerta" : "");
  };
  pensando = function (on) {
    if (!el) return;
    el.classList.toggle("tx-pensando", !!on);
    var b = $(".tx-balao", el); if (!b) return;
    if (on && !aberto) { b.textContent = "…"; b.classList.add("on"); clearTimeout(b.__t); }
    else if (!on && b.textContent === "…") b.classList.remove("on");
  };
  /* ---- mostrar na tela: rola até o texto, destaca e o Tax vai até lá ---- */
  function mostrarNaTela(texto) {
    var alvoN = norm(texto); if (alvoN.length < 3) return false;
    var q = quadroVisivel(), d = q ? q.d : doc, ox = q ? q.rect.left : 0, oy = q ? q.rect.top : 0, melhor = null, area = 1e12;
    try {
      var tw = d.createTreeWalker(d.body, NodeFilter.SHOW_ELEMENT), n;
      while ((n = tw.nextNode())) {
        if (n.closest && n.closest("#tx-painel,#tx-mascote,script,style,dialog:not([open])")) continue;
        var tx = n.textContent; if (!tx || tx.length > 400) continue;
        if (norm(tx).indexOf(alvoN) === -1) continue;
        var r = n.getBoundingClientRect(); if (!r.width || !r.height) continue;
        var a = r.width * r.height; if (a < area) { area = a; melhor = n; }
      }
    } catch (e) { return false; }
    if (!melhor) return false;
    var alvoEl = melhor.closest("tr,li,article,.card,[role=row],button,a") || melhor;
    try { alvoEl.scrollIntoView({block: "center", behavior: reduzido() ? "auto" : "smooth"}); } catch (e) { alvoEl.scrollIntoView(); }
    setTimeout(function () {
      var r = alvoEl.getBoundingClientRect(), hl = doc.createElement("div");
      hl.className = "tx-destaque"; hl.style.cssText = "left:" + (r.left + ox - 4) + "px;top:" + (r.top + oy - 4) + "px;width:" + (r.width + 8) + "px;height:" + (r.height + 8) + "px";
      doc.body.appendChild(hl); setTimeout(function () { hl.remove(); }, 4200);
      if (!celular() && !lerPref().parado) chamar({x: Math.min(r.right + ox - 20, vw() - 40), y: r.top + oy - 4});
      emote("ok");
    }, 450);
    return true;
  }
  FERRAMENTAS_EXTRA.push(function () {
    return {name: "mostrar_na_tela", description: "Rola a tela até um texto (empresa, obrigação, funcionário…) e destaca o item, com o mascote indo até ele. Use depois de abrir a tela certa.",
      inputSchema: {type: "object", properties: {texto: {type: "string"}, modulo: {type: "string", enum: ["dp", "contabil", "fiscal", "portal", "cardapio"]}, aba: {type: "string"}}, required: ["texto"]},
      execute: function (i) {
        var abre = i.modulo ? abrirItem(i.modulo, {aba: i.aba || "", manter: true}) : Promise.resolve();
        return abre.then(function () { return new Promise(function (ok) { setTimeout(function () { ok(mostrarNaTela(i.texto) ? "Destacado na tela." : "Não achei esse texto na tela aberta."); }, i.modulo ? 900 : 50); }); });
      }};
  });
  /* ---- esconde-esconde ---- */
  var esconde = {ativo: false, t0: 0};
  function comecarEsconde() {
    if (celular()) return [T("No celular eu fico no canto, não dá para brincar de esconde-esconde. 😅")];
    fecharPainel(); atualizarPlats();
    var cand = plats.filter(function (p) { return !p.piso && p.r - p.l > 80 && Math.abs(p.l - fx) > 250; }), alvo = cand[Math.floor(Math.random() * cand.length)] || plats[plats.length - 1];
    esconde.ativo = true; esconde.t0 = Date.now();
    teletransportar(rnd(alvo.l + 30, alvo.r - 30), alvo.t, function () { el.classList.add("tx-escondido"); });
    return [];
  }
  function achouEsconde() {
    var seg = Math.round((Date.now() - esconde.t0) / 1000); esconde.ativo = false; el.classList.remove("tx-escondido");
    emote("achou"); balao("Achou! Em " + seg + " s. 🎉", 3500); conquistar("esconde");
  }
  COMANDOS_EXTRA.esconde = function () { return Promise.resolve(comecarEsconde()); }; COMANDOS_EXTRA.esconde.rot = "Brincar de esconde-esconde com o mascote";
  /* ---- conquistas (desbloqueiam chapéus) ---- */
  var CONQ = {
    primeira: {nome: "Primeira conversa", premio: "laco"},
    perguntas10: {nome: "10 perguntas", premio: "bone"},
    acoes5: {nome: "5 alterações confirmadas pelo assistente", premio: "festa"},
    esconde: {nome: "Achou o mascote no esconde-esconde", premio: "coroa"},
    dias5: {nome: "5 dias úteis seguidos usando o Hub", premio: "coroa"},
    zerou: {nome: "Zerou os atrasos da carteira", premio: "festa"}
  };
  function stats() { return lerLS("tx-stats-v1", {perguntas: 0, acoes: 0, dias: [], conq: {}}); }
  function conquistado(chapeu) { var c = stats().conq || {}; return Object.keys(c).some(function (k) { return CONQ[k] && CONQ[k].premio === chapeu; }); }
  function conquistar(k) {
    var s = stats(); s.conq = s.conq || {};
    if (s.conq[k] || !CONQ[k]) return;
    s.conq[k] = ymd(hoje()); gravarLS("tx-stats-v1", s);
    setTimeout(function () { emote("festa"); balao("🏆 Conquista: " + CONQ[k].nome + "! Ganhei: " + CHAPEUS[CONQ[k].premio].nome + " (em 🎨 Visual).", 6000); }, 600);
  }
  function contarPergunta() { var s = stats(); s.perguntas = (s.perguntas || 0) + 1; gravarLS("tx-stats-v1", s); if (s.perguntas === 1) conquistar("primeira"); if (s.perguntas >= 10) conquistar("perguntas10"); }
  function contarDia() {
    var s = stats(), h = ymd(hoje()); s.dias = s.dias || [];
    if (s.dias[s.dias.length - 1] !== h) { s.dias.push(h); s.dias = s.dias.slice(-30); gravarLS("tx-stats-v1", s); }
    var seq = 1;
    for (var i = s.dias.length - 1; i > 0; i--) {
      var a = new Date(s.dias[i] + "T12:00:00"), b = new Date(s.dias[i - 1] + "T12:00:00"), gap = Math.round((a - b) / 864e5);
      var ok = gap === 1 || (gap <= 3 && a.getDay() === 1);
      if (ok) seq++; else break;
    }
    if (seq >= 5) conquistar("dias5");
  }
  aoConfirmar = function () { var s = stats(); s.acoes = (s.acoes || 0) + 1; gravarLS("tx-stats-v1", s); if (s.acoes >= 5) conquistar("acoes5"); emote("festa"); };
  aoSituacao = function (s, av) {
    var t = totalAtrasos(s), ant = av.snapAnt && av.snapAnt.atrasos ? Object.keys(av.snapAnt.atrasos).reduce(function (x, k) { return x + (av.snapAnt.atrasos[k] || 0); }, 0) : 0;
    if (t === 0 && ant > 0) conquistar("zerou");
    if (t >= 15) setTimeout(function () { emote("suor"); }, 9000);
  };
  /* ---- frases de personalidade ---- */
  var FRASES = ["Psiu, qualquer coisa é só me chamar.", "Já tomou água hoje? 💧", "Dica: digite / no chat para ver os atalhos.", "Pergunte “o que vence hoje?” que eu respondo.", "Eu também sei o cardápio do almoço. 🍽️", "Dica: arraste-me para onde quiser.", "Posso marcar entregas em lote, é só pedir.", "Ctrl+K busca no Hub inteiro (e pergunta para mim)."];
  function fraseAleatoria() {
    var h = new Date().getHours();
    var extras = h < 10 ? ["Bom dia! ☀️ Bora começar?"] : h >= 17 ? ["Quase lá! Último gás do dia. 💪"] : ["Boa tarde! Como vai o fechamento?"];
    var l = FRASES.concat(extras); return l[Math.floor(Math.random() * l.length)];
  }
  /* ---- arrastar o mascote ---- */
  var arrasto = null, arrastou = false;
  function ligarArrasto() {
    el.addEventListener("pointerdown", function (e) {
      if (e.button || celular()) return;
      arrasto = {x0: e.clientX, y0: e.clientY, dx: e.clientX - fx, dy: e.clientY - fy, mov: false, id: e.pointerId};
    });
    el.addEventListener("pointermove", function (e) {
      if (!arrasto) return;
      if (!arrasto.mov && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 6) return;
      if (!arrasto.mov) { arrasto.mov = true; try { el.setPointerCapture(arrasto.id); } catch (x) {} parar(); plano = null; modo = "arrasto"; el.classList.add("tx-arrastado"); }
      fx = Math.max(minX() + hw(), Math.min(vw() - hw(), e.clientX - arrasto.dx)); fy = Math.max(HM, Math.min(vh() - 2, e.clientY - arrasto.dy)); desenhar();
    });
    var soltar = function () {
      if (!arrasto) return;
      var mov = arrasto.mov; arrasto = null;
      if (!mov) return;
      arrastou = true; setTimeout(function () { arrastou = false; }, 50);
      el.classList.remove("tx-arrastado"); atualizarPlats(); modo = "parado"; cair(); som("pulo");
    };
    el.addEventListener("pointerup", soltar); el.addEventListener("pointercancel", soltar);
  }
  /* ---- pegadas ---- */
  var ultPegada = 0;
  function pegada() {
    if (!lerPref().pegadas || modo !== "anda" || Date.now() - ultPegada < 160) return;
    ultPegada = Date.now();
    var p = doc.createElement("i"); p.className = "tx-pegada"; p.style.left = (fx - 3 + (Math.random() * 6 - 3)) + "px"; p.style.top = (fy - 3) + "px";
    doc.body.appendChild(p); setTimeout(function () { p.remove(); }, 1300);
  }
  /* ---- ligações com a página (mouse, teclado, toasts, troca de módulo) ---- */
  function ligarDoc(d, quadro) {
    if (!d || d.__tx2) return; d.__tx2 = 1;
    d.addEventListener("mousemove", function (e) {
      var x = e.clientX, y = e.clientY; if (quadro) { var r = quadro.getBoundingClientRect(); x += r.left; y += r.top; }
      ultMouse = {x: x, y: y, t: Date.now()};
      if (el && el.classList.contains("tx-le")) el.classList.remove("tx-le");
      checarSairDaFrente(x, y, e.target);
    }, {passive: true});
    d.addEventListener("keydown", function (e) { var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) && !(t.closest && t.closest("#tx-painel"))) digitandoAte = Date.now() + 12000; }, true);
    var vigia = function (n) {
      try {
        new MutationObserver(function () {
          var txt = (n.textContent || "").trim(); if (!txt || n.__ult === txt) return; n.__ult = txt;
          if (n.id === "toast" && !n.classList.contains("show")) return;
          if (/não foi poss|nao foi poss|erro|falhou|sem permiss|não tem permiss/i.test(txt)) emote("triste");
          else if (/salv|registrad|criad|marcad|conclu|entreg|feito|pronto|importad|atualizad|aplicad/i.test(txt)) emote("ok");
        }).observe(n, {childList: true, subtree: true, characterData: true, attributes: n.id === "toast"});
      } catch (e) {}
    };
    ["#toast", "#toasts"].forEach(function (s) { var n = d.querySelector(s); if (n) vigia(n); });
  }
  var saiuEm = 0;
  function checarSairDaFrente(x, y, alvo) {
    if (!el || aberto || modo !== "parado" || celular() || esconde.ativo || Date.now() - saiuEm < 2500) return;
    var r = el.getBoundingClientRect();
    var perto = x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 10, emCima = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (!perto || emCima || !alvo || !interativo(alvo)) return;
    saiuEm = Date.now();
    var cur = apoio(fx, fy, 10) || plats[plats.length - 1], dir = x < fx ? 1 : -1, nx = fx + dir * 90;
    if (nx < cur.l + hw() || nx > cur.r - hw()) nx = fx - dir * 90;
    nx = Math.max(cur.l + hw(), Math.min(cur.r - hw(), nx));
    plano = {passos: [{tipo: "anda", x: nx}], fim: null, destino: null}; proximoPasso();
    balao(["Opa, licença!", "Saindo da frente!", "Foi mal! 🙈"][Math.floor(Math.random() * 3)], 1500);
  }
  var ultAtivo = null;
  function vigiarModulo() {
    var a = H.ativo();
    if (ultAtivo !== null && a !== ultAtivo && el && !oculto) { el.classList.add("tx-porta"); setTimeout(function () { el.classList.remove("tx-porta"); }, 700); if (Math.random() < 0.5) emote("porta"); }
    ultAtivo = a; atualizarAcessorios();
  }
  function iniciarMascoteExtra() {
    ligarArrasto(); ligarDoc(doc, null); contarDia(); atualizarAcessorios();
    setInterval(function () { H.quadros().forEach(function (f) { try { if (f.contentDocument && f.contentDocument.body) ligarDoc(f.contentDocument, f); } catch (e) {} }); vigiarModulo(); }, 1200);
    // ler junto (mouse parado) e seguir o mouse de longe
    setInterval(function () {
      if (!el || aberto || oculto || doc.hidden || modo !== "parado" || esconde.ativo) return;
      var parado3 = Date.now() - ultMouse.t;
      if (parado3 > 25000 && !el.classList.contains("tx-le") && !dormiu) el.classList.add("tx-le");
      if (lerPref().seguir && !lerPref().parado && ultMouse.x >= 0 && parado3 < 4000 && Math.abs(ultMouse.x - fx) > 260 && !celular()) {
        var alvoX = ultMouse.x + (ultMouse.x > fx ? -130 : 130); chamarSilencioso({x: alvoX, y: ultMouse.y});
      }
    }, 4000);
    // frases de vez em quando
    (function prox() { setTimeout(function () { if (lerPref().frases !== false && !aberto && !oculto && !doc.hidden && !emFoco() && !esconde.ativo && !dormiu) balao(fraseAleatoria(), 4200); prox(); }, rnd(4, 9) * 6e4); })();
  }
  function chamarSilencioso(pt) { atualizarPlats(); var D = destinoPara(pt); irPara(D, pt.x, null, 0); }
  CFG.push({sec: "Mascote", itens: [
    {k: "vel", rot: "Velocidade:", tipo: "sel", opcoes: [["normal", "normal"], ["lento", "calmo"], ["rapido", "agitado"]]},
    {k: "parado", rot: "Ficar parado (não passear)", tipo: "bool"},
    {k: "seguir", rot: "Seguir o mouse de longe", tipo: "bool"},
    {k: "pegadas", rot: "Deixar pegadas ao andar", tipo: "bool"},
    {k: "frases", rot: "Falar frases de vez em quando", tipo: "bool", padrao: true},
    {k: "sazonal", rot: "Chapéu da época (Natal, São João, Carnaval)", tipo: "bool", padrao: true, ao: function () { acKey = ""; atualizarAcessorios(); }},
    {k: "acSetor", rot: "Acessório do setor (capacete no DP, óculos no Fiscal, gravata no Contábil)", tipo: "bool", padrao: true, ao: function () { acKey = ""; atualizarAcessorios(); }},
    {k: "sons", rot: "Sons em 8 bits", tipo: "bool"},
    {rot: "Brincar de esconde-esconde", tipo: "botao", ao: function () { comecarEsconde(); }}
  ]});

  /* ============ avisos proativos (sem IA: só regras sobre os dados dos módulos) ============ */
  var AV = "tx-avisos-v1", AG = "tx-agendados-v1", filaAvisos = [];
  function lerAv() {
    var a = lerLS(AV, {});
    if (a.dia !== ymd(hoje())) a = {dia: ymd(hoje()), alertados: {}, pend: a.pend || null, snap: a.snap || null, snapAnt: a.snap || a.snapAnt || null};
    a.alertados = a.alertados || {};
    return a;
  }
  function gravarAv(a) { gravarLS(AV, a); }
  function emFoco() { return (+lerPref().focoAte || 0) > Date.now(); }
  function opt(k) { return lerPref()["av_" + k] !== false; }
  function algumAviso() { return ["resumo", "sexta", "prazos", "lembretes", "cliente"].some(opt); }
  function diasUteisDepois(d, n) {
    var fer = feriadosEntre(d, addDias(d, n * 2 + 15)), c = new Date(d), k = 0;
    while (k < n) { c = addDias(c, 1); if (c.getDay() % 6 && !fer[ymd(c)]) k++; }
    return c;
  }
  // Fotografia do momento: vencimentos, atrasos, pendências do cliente e pontos de atenção.
  function situacao() {
    return carregarTodos().then(quemSou).then(function () {
      var h = hoje(), ate2 = diasUteisDepois(h, 2), meu = euNome ? casarEu(indice().analistas) : "";
      var s = {meu: meu, vencHoje: [], prox: [], atrasos: {}, pend: {}, lembretes: [], feriados: [], atencao: [], exemplo: []};
      ["dp", "contabil", "fiscal", "portal"].forEach(function (m) {
        var a = carregados[m]; if (!a) return;
        if (a.exemplo && a.exemplo()) { s.exemplo.push(m); return; }
        try {
          var v = a.consultar("vencimentos", {de: ymd(h), ate: ymd(ate2), analista: meu}) || {linhas: []};
          v.linhas.forEach(function (l) { if (l.tom === "ok") return; var x = Object.assign({mod: m}, l); if (l.data === ymd(h)) s.vencHoje.push(x); else if (l.data > ymd(h)) s.prox.push(x); });
          var at = a.consultar("atrasos", {analista: meu}); if (at) s.atrasos[m] = at.total;
          if (m === "fiscal" || m === "contabil") { var pd = a.consultar("pendencias", {analista: meu}); var mp = {}; (pd && pd.linhas || []).forEach(function (l) { mp[l.t] = l.sub; }); s.pend[m] = mp; }
          if (m === "dp") {
            var lb = a.consultar("lembretes", {de: ymd(h), ate: ymd(h)}); (lb && lb.linhas || []).forEach(function (l) { if (l.dados && !l.dados.feito) s.lembretes.push(Object.assign({mod: "dp"}, l)); });
            var cv = a.consultar("convencoes", {}), mesN = norm(MESES[h.getMonth()]);
            (cv && cv.linhas || []).forEach(function (l) { if (l.dados && norm(l.dados.dataBase) === mesN) s.atencao.push(Object.assign({mod: "dp"}, l, {t: "Data-base neste mês: " + l.t.replace(/^Convenção /, "")})); });
            var fe = (at && at.linhas || []).filter(function (l) { return /f[ée]rias/i.test(l.t); });
            if (fe.length) s.atencao.push({mod: "dp", t: fe.length + " alerta(s) de férias no DP", sub: fe.slice(0, 3).map(function (l) { return l.t; }).join(" · "), tom: "late", abrir: fe[0].abrir});
            var us = a.consultar("uso", {}); (us && us.linhas || []).forEach(function (l) { if (l.dados && l.dados.docs > 4000) s.atencao.push(Object.assign({mod: "dp"}, l, {t: "Banco perto do limite: " + l.t})); });
          }
        } catch (e) { if (window.__txDebug) console.error(e); }
      });
      var fi = carregados.fiscal;
      if (fi) { var fr = fi.consultar("feriados", {de: ymd(h), ate: ymd(addDias(h, 7))}); s.feriados = (fr && fr.linhas || []).map(function (l) { return Object.assign({mod: "fiscal"}, l); }); }
      var ca = carregados.cardapio;
      if (ca && ca.podeEditar && ca.podeEditar()) {
        var cd = ca.consultar("cardapio", {de: ymd(h), ate: ymd(addDias(h, 6))}), falta = (cd && cd.linhas || []).filter(function (l) { return /ainda não cadastrado/.test(l.sub); });
        if (falta.length) s.atencao.push({mod: "cardapio", t: "Cardápio sem cadastro: " + falta.map(function (l) { return l.t.split(",")[0].toLowerCase() + " " + l.data.slice(8); }).join(", "), sub: "você pode editar o cardápio", tom: "warn", abrir: {aba: "", opts: {dia: falta[0].data}}});
      }
      return listarTudo().then(function (rows) { s.divergencias = divergencias(rows); return s; });
    });
  }
  function totalAtrasos(s) { return Object.keys(s.atrasos).reduce(function (t, k) { return t + (s.atrasos[k] || 0); }, 0); }
  function linhasBloco(titulo, ls, max) { return {tipo: "linhas", titulo: titulo + " · " + ls.length, linhas: ls.slice(0, max || 6), todas: ls, nota: ""}; }
  function mudancas(s, ant) {
    if (!ant) return "";
    var ps = Object.keys(s.atrasos).filter(function (k) { return ant.atrasos && ant.atrasos[k] != null && ant.atrasos[k] !== s.atrasos[k]; }).map(function (k) { var d = s.atrasos[k] - ant.atrasos[k]; return MODN[k] + " " + ant.atrasos[k] + " → " + s.atrasos[k] + " (" + (d > 0 ? "+" : "") + d + ")"; });
    return ps.length ? "Desde a sua última visita (" + dm(new Date(ant.t)) + "), atrasos: " + ps.join(" · ") + "." : "";
  }
  function snapDe(s) { return {t: Date.now(), atrasos: s.atrasos}; }
  // Resumo do dia (também em /resumo). Devolve {blocos, curto}.
  function montarResumo(s, tipo) {
    var h = new Date(), saud = h.getHours() < 12 ? "Bom dia" : h.getHours() < 18 ? "Boa tarde" : "Boa noite", av = lerAv();
    var bl = [{tipo: "cab", texto: (tipo === "sexta" ? "Resumo da semana · " : "Resumo do dia · ") + SEM[h.getDay()] + ", " + dm(h) + (s.meu ? " · carteira de " + s.meu : "")}];
    var nAt = totalAtrasos(s), partes = [];
    partes.push(s.vencHoje.length ? s.vencHoje.length + (s.vencHoje.length === 1 ? " prazo vence hoje" : " prazos vencem hoje") : "nada vence hoje");
    if (s.prox.length) partes.push(s.prox.length + " nos próximos 2 dias úteis");
    partes.push(nAt ? nAt + " atraso(s) no total" : "nenhum atraso");
    bl.push(T(saud + (euNome ? ", " + euNome.split(" ")[0] : "") + "! " + partes.join(", ") + "."));
    if (s.vencHoje.length) bl.push(linhasBloco("Vence hoje", s.vencHoje));
    if (s.prox.length) bl.push(linhasBloco("Próximos 2 dias úteis", s.prox));
    if (nAt) bl.push({tipo: "grafico", titulo: "Atrasos por módulo", itens: Object.keys(s.atrasos).filter(function (k) { return s.atrasos[k]; }).map(function (k) { return {rotulo: MODN[k], valor: s.atrasos[k]}; })});
    var mud = mudancas(s, av.snapAnt); if (mud) bl.push({tipo: "rodape", texto: mud});
    var at = s.atencao.slice();
    s.feriados.forEach(function (f) { at.push(Object.assign({}, f, {t: "Feriado: " + f.t, sub: "os prazos que caem nele mudam de dia"})); });
    s.lembretes.forEach(function (l) { at.push(l); });
    if (s.divergencias && s.divergencias.length) at.push({t: s.divergencias.length + " divergência(s) de cadastro entre os setores", sub: s.divergencias.slice(0, 2).map(function (x) { return x.t; }).join(" · "), tom: "warn", mod: s.divergencias[0].mod, abrir: s.divergencias[0].abrir});
    if (at.length) bl.push(linhasBloco("Atenção", at));
    if (s.exemplo.length) bl.push({tipo: "rodape", texto: "Sem avisos de " + s.exemplo.map(function (m) { return MODN[m]; }).join(", ") + ": está com dados de exemplo."});
    bl.push(CH([{rot: "O que vence esta semana", enviar: "/semana"}, {rot: "Quem está atrasado", enviar: "/atrasos"}, {rot: "Silenciar avisos por 1h", acao: function () { focar(); return Promise.resolve([T("Ok, fico quieto por 1 hora. 🤫")]); }}]));
    var curto = saud + "! " + (s.vencHoje.length ? s.vencHoje.length + " vence(m) hoje" : "Nada vence hoje") + (nAt ? ", " + nAt + " atraso(s)" : "") + ". Clique em mim.";
    return {blocos: bl, curto: curto};
  }
  // Nota do mês: no começo do mês, quanto cada analista fechou da competência anterior.
  function notaDoMes() {
    var h = hoje(); if (h.getDate() > 6) return [];
    var comp = ymd(new Date(h.getFullYear(), h.getMonth() - 1, 1)).slice(0, 7), out = [];
    ["fiscal", "contabil"].forEach(function (m) {
      var a = carregados[m]; if (!a || (a.exemplo && a.exemplo())) return;
      var r = a.consultar("competencia", {comp: comp}); if (!r || !r.resumo || !r.resumo.length) return;
      out.push({tipo: "grafico", titulo: MODN[m] + ": % fechado de " + MESES[+comp.slice(5) - 1] + " por analista", unidade: "%", itens: r.resumo.filter(function (q) { return q.empresas; }).map(function (q) { return {rotulo: q.analista, valor: Math.round(q.fechadas / q.empresas * 100)}; }).sort(function (a2, b2) { return b2.valor - a2.valor; })});
    });
    return out;
  }
  function avisar(curto, blocos) {
    filaAvisos.push(blocos);
    if (aberto) { mostrarFila(); return; }
    atualizarBadge();
    if (emFoco()) return;
    balao(curto, 8000); emote("alerta");
  }
  function mostrarFila() { if (!msgs) return; var f = filaAvisos; filaAvisos = []; f.forEach(function (b) { addBot(b); }); atualizarBadge(); }
  function atualizarBadge() { if (!el) return; var b = $(".tx-badge", el); if (!b) { b = doc.createElement("span"); b.className = "tx-badge"; b.setAttribute("aria-hidden", "true"); el.appendChild(b); } b.textContent = filaAvisos.length ? String(filaAvisos.length) : ""; b.hidden = !filaAvisos.length; el.setAttribute("aria-label", "Abrir o assistente " + nomeTax() + (filaAvisos.length ? " (" + filaAvisos.length + " aviso(s))" : "")); }
  function focar() { var ate = Date.now() + 36e5; salvarPref({focoAte: ate}); balao("Modo foco: sem avisos até " + pad2(new Date(ate).getHours()) + ":" + pad2(new Date(ate).getMinutes()) + ".", 3000); }
  // Primeira checagem do dia: resumo (e de sexta à tarde, o da semana).
  function checarDia() {
    if (!algumAviso()) return;
    situacao().then(function (s) {
      var av = lerAv(), agora = new Date();
      var novos = s.vencHoje.concat(s.prox).map(function (l) { return l.mod + "|" + l.t + "|" + l.data; });
      if (opt("resumo") && !av.resumo) {
        var r = montarResumo(s, "dia"); av.resumo = 1; novos.forEach(function (k) { av.alertados[k] = 1; });
        avisar(r.curto, r.blocos.concat(notaDoMes()));
      } else if (opt("prazos")) {
        var nv = s.vencHoje.concat(s.prox).filter(function (l) { return !av.alertados[l.mod + "|" + l.t + "|" + l.data]; });
        if (nv.length) { nv.forEach(function (l) { av.alertados[l.mod + "|" + l.t + "|" + l.data] = 1; }); avisar("⏰ " + nv.length + " prazo(s) chegando: " + nv[0].t, [T("Prazos chegando (hoje e nos próximos 2 dias úteis):"), linhasBloco("Prazos", nv)]); }
      }
      if (opt("sexta") && agora.getDay() === 5 && agora.getHours() >= 15 && !av.sexta) {
        av.sexta = 1;
        var seg = diasUteisDepois(hoje(), 1), carregadas = [];
        ["dp", "contabil", "fiscal", "portal"].forEach(function (m) { var a = carregados[m]; if (!a || (a.exemplo && a.exemplo())) return; var v = a.consultar("vencimentos", {de: ymd(addDias(hoje(), -4)), ate: ymd(seg), analista: s.meu}); (v && v.linhas || []).forEach(function (l) { if (l.tom !== "ok") carregadas.push(Object.assign({mod: m}, l)); }); });
        var ficou = carregadas.filter(function (l) { return l.data <= ymd(hoje()); }), segunda = carregadas.filter(function (l) { return l.data > ymd(hoje()); });
        var bl = [{tipo: "cab", texto: "Resumo da semana"}, T(ficou.length || segunda.length ? "Antes do fim de semana: " + ficou.length + " item(ns) da semana ainda pendente(s) e " + segunda.length + " vencendo no próximo dia útil (" + SEM[seg.getDay()] + ")." : "Semana limpa: nada pendente e nada vencendo no próximo dia útil. Bom descanso! 🎉")];
        if (ficou.length) bl.push(linhasBloco("Ficou pendente na semana", ficou));
        if (segunda.length) bl.push(linhasBloco("Vence no próximo dia útil", segunda));
        avisar("Resumo da semana: " + ficou.length + " pendente(s), " + segunda.length + " para " + SEM[seg.getDay()] + ".", bl);
      }
      // pendências do cliente que saíram de "aguardando" desde a última checagem
      if (opt("cliente") && av.pend) {
        var sairam = [];
        Object.keys(s.pend).forEach(function (m) { var antes = av.pend[m] || {}; Object.keys(antes).forEach(function (n) { if (!s.pend[m][n]) sairam.push({mod: m, t: n, sub: "saiu de “aguardando o cliente” (" + MODN[m] + ")", tom: "ok"}); }); });
        if (sairam.length) avisar("📬 " + sairam.length + " pendência(s) do cliente resolvida(s)", [T("Chegou do cliente (ou foi encerrada) desde a última vez:"), linhasBloco("Pendências encerradas", sairam)]);
      }
      aoSituacao(s, av);
      av.pend = s.pend; av.snap = snapDe(s);
      gravarAv(av);
    }).catch(function (e) { if (window.__txDebug) console.error(e); });
  }
  // Lembretes do DP no horário e agendamentos do assistente (a cada 30 s).
  function checarHorarios() {
    var agora = Date.now(), av = lerAv(), mudou = false;
    if (opt("lembretes") && carregados.dp) {
      try {
        var lb = carregados.dp.consultar("lembretes", {de: ymd(hoje()), ate: ymd(hoje())});
        (lb && lb.linhas || []).forEach(function (l) {
          var d = l.dados || {}; if (!d.hora || d.feito) return;
          var hm = d.hora.split(":"), quando = new Date(); quando.setHours(+hm[0], +hm[1] || 0, 0, 0);
          var k = "lem|" + d.texto + "|" + d.hora;
          if (!av.alertados[k] && agora >= quando - 5 * 6e4 && agora <= quando + 30 * 6e4) { av.alertados[k] = 1; mudou = true; avisar("🔔 " + d.hora + " · " + d.texto, [T("🔔 Lembrete das " + d.hora + ": " + d.texto), linhasBloco("Lembrete", [Object.assign({mod: "dp"}, l)])]); }
        });
      } catch (e) {}
    }
    var ag = lerLS(AG, []), resto = [];
    ag.forEach(function (x) {
      if (x.quando > agora) { resto.push(x); return; }
      var atraso = agora - x.quando > 10 * 6e4;
      avisar("⏰ " + x.texto, [T("⏰ " + (atraso ? "(era para " + pad2(new Date(x.quando).getHours()) + ":" + pad2(new Date(x.quando).getMinutes()) + ") " : "") + x.texto + (x.mod ? "\nAbri " + MODN[x.mod] + (x.aba ? " · " + x.aba : "") + " para você." : ""))]);
      if (x.mod) abrirItem(x.mod, {aba: x.aba || "", manter: true}).catch(function () {});
    });
    if (resto.length !== ag.length) gravarLS(AG, resto);
    if (mudou) gravarAv(av);
  }
  function agendamentosBlocos() {
    var ag = lerLS(AG, []);
    if (!ag.length) return [T("Nenhum agendamento. Peça, por exemplo: “amanhã às 9h me lembre de conferir a agenda e abra o Fiscal”.")];
    return [T("Seus agendamentos (neste navegador):"), CH(ag.map(function (x) { var d = new Date(x.quando); return {rot: "✕ " + dm(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + " · " + x.texto, acao: function () { gravarLS(AG, lerLS(AG, []).filter(function (y) { return y.id !== x.id; })); return Promise.resolve([T("Agendamento cancelado: " + x.texto)]); }}; }))];
  }
  COMANDOS_EXTRA.resumo = function () { return situacao().then(function (s) { var r = montarResumo(s, "dia"); return r.blocos.concat(notaDoMes()); }); }; COMANDOS_EXTRA.resumo.rot = "Resumo do dia (prazos, atrasos e pontos de atenção)";
  COMANDOS_EXTRA.foco = function () { if (emFoco()) { salvarPref({focoAte: 0}); return Promise.resolve([T("Modo foco desligado: volto a avisar.")]); } focar(); return Promise.resolve([T("Modo foco por 1 hora: guardo os avisos e mostro quando você abrir a conversa.")]); }; COMANDOS_EXTRA.foco.rot = "Silenciar os avisos por 1 hora (ou religar)";
  COMANDOS_EXTRA.agendados = function () { return Promise.resolve(agendamentosBlocos()); }; COMANDOS_EXTRA.agendados.rot = "Ver e cancelar agendamentos";
  FERRAMENTAS_EXTRA.push(function (cartoes) {
    return {name: "agendar", description: "Agenda um aviso do assistente para um horário (funciona enquanto o Hub estiver aberto neste navegador; se estiver fechado, avisa na próxima abertura). Pode abrir uma tela no horário. Prepara um cartão de confirmação.",
      inputSchema: {type: "object", properties: {quando: {type: "string", description: "AAAA-MM-DDTHH:MM (horário local)"}, texto: {type: "string"}, abrir_modulo: {type: "string", enum: ["dp", "contabil", "fiscal", "portal", "cardapio"]}, abrir_aba: {type: "string"}}, required: ["quando", "texto"]},
      execute: function (i) {
        var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(i.quando || ""); if (!m) return "Horário inválido: use AAAA-MM-DDTHH:MM.";
        var q = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); if (q < Date.now() - 6e4) return "Esse horário já passou.";
        var x = {id: "a" + Date.now().toString(36), quando: +q, texto: String(i.texto || "").slice(0, 160), mod: i.abrir_modulo || "", aba: i.abrir_aba || ""};
        cartoes.push({tipo: "confirma", titulo: "Agendar aviso", plano: {titulo: "Agendar aviso", empresa: "", linhas: [dm(q) + " às " + pad2(q.getHours()) + ":" + pad2(q.getMinutes()) + ": " + x.texto].concat(x.mod ? ["e abrir " + MODN[x.mod] + (x.aba ? " · " + x.aba : "")] : []), aviso: "Fica neste navegador; avisa enquanto o Hub estiver aberto.",
          executar: function () { var l = lerLS(AG, []); l.push(x); gravarLS(AG, l); return Promise.resolve("Agendado."); },
          desfazer: function () { gravarLS(AG, lerLS(AG, []).filter(function (y) { return y.id !== x.id; })); return Promise.resolve(); }}});
        return "Cartão de agendamento preparado; falta o usuário confirmar.";
      }};
  });
  CFG.push({sec: "Avisos", itens: [
    {k: "av_resumo", rot: "Resumo do dia na primeira abertura", tipo: "bool", padrao: true},
    {k: "av_sexta", rot: "Resumo da semana na sexta à tarde", tipo: "bool", padrao: true},
    {k: "av_prazos", rot: "Avisar prazos chegando (2 dias úteis)", tipo: "bool", padrao: true},
    {k: "av_lembretes", rot: "Lembretes do DP no horário", tipo: "bool", padrao: true},
    {k: "av_cliente", rot: "Avisar quando sair pendência do cliente", tipo: "bool", padrao: true},
    {rot: "Silenciar avisos por 1 hora", tipo: "botao", ao: function (b) { focar(); b.textContent = "Silenciado por 1 hora"; }}
  ]});
  function iniciarAvisos() {
    setTimeout(function () { if (algumAviso()) checarDia(); }, 7000);
    setInterval(function () { if (!doc.hidden && algumAviso()) checarDia(); }, 10 * 6e4);
    setInterval(function () { if (!doc.hidden) checarHorarios(); }, 30000);
    setTimeout(checarHorarios, 9000);
  }

  /* ============ equipe: configuração compartilhada, ajuda da equipe, registros e painel da coordenação ============ */
  // Banco do Hub: tax_config/geral {limiteDia, instrucoes}; tax_ajuda/{id} {t, k, a}; registros por dia em tax_perguntas, tax_feedback e tax_acoes ({itens: {id: {...}}}).
  var userNs = null, meuId = "", ajudaEquipe = [];
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function registrarNoDia(col, item) {
    return usarDb().then(function (db) {
      if (!db) return;
      var ref = db.doc(col + "/" + ymd(hoje())), o = {}; o[rid()] = item;
      return ref.update({itens: o}).catch(function () { return ref.set({itens: o}); });
    }).catch(function () {});
  }
  registrarPergunta = function (texto, modo) { registrarNoDia("tax_perguntas", {q: String(texto).slice(0, 200), modo: modo, em: new Date().toISOString()}); };
  registrarFeedback = function (q, r, bom) { registrarNoDia("tax_feedback", {q: String(q || "").slice(0, 200), r: String(r || "").slice(0, 300), bom: !!bom, em: new Date().toISOString()}); };
  var aoConfirmarAntes = aoConfirmar;
  aoConfirmar = function (pl) { aoConfirmarAntes(pl); if (/dados de exemplo/i.test(pl.aviso || "")) return; registrarNoDia("tax_acoes", {titulo: pl.titulo || "", empresa: pl.empresa || "", linha: ((pl.linhas || [])[0] || "").slice(0, 200), quem: meuId, em: new Date().toISOString()}); };
  function iniciarEquipe() {
    try {
      if (AUTH() && AUTH().usuario()) meuId = AUTH().usuario().id;
      if (window.claude && window.claude.use) window.claude.use("user").then(function (u) { userNs = u || null; if (!AUTH() && u && u.id) Promise.resolve(u.id()).then(function (i) { meuId = i || ""; }, function () {}); }).catch(function () {});
    } catch (e) {}
    usarDb().then(function (db) {
      if (!db) return;
      try { db.doc("tax_config/geral").onSnapshot(function (d) { var x = d && d.exists !== false && d.data ? d.data() || {} : {}; cfgEquipe = {limiteDia: Math.max(0, +x.limiteDia || 0), instrucoes: String(x.instrucoes || "").slice(0, 1500)}; }, function () {}); } catch (e) {}
      try { db.collection("tax_ajuda").onSnapshot(function (snap) { ajudaEquipe = snap.docs.map(function (d) { var x = d.data() || {}; return {id: d.id, t: String(x.t || ""), k: String(x.k || ""), a: String(x.a || ""), equipe: true}; }).filter(function (x) { return x.t && x.a; }); }, function () {}); } catch (e) {}
    });
  }
  function salvarCfgEquipe(campo, valor) {
    return usarDb().then(function (db) {
      if (!db) throw new Error("sem banco");
      var o = {}; o[campo] = valor; var ref = db.doc("tax_config/geral");
      return ref.update(o).catch(function () { return ref.set(Object.assign({limiteDia: cfgEquipe.limiteDia, instrucoes: cfgEquipe.instrucoes}, o)); });
    }).then(function () { balao("Configuração da equipe salva.", 1800); }, function () { balao("Não consegui salvar (sem permissão?).", 2500); });
  }
  // Editor da base de ajuda da equipe (no chat, só para a coordenação).
  function editorAjuda() {
    var d = doc.createElement("div"); d.className = "tx-conf";
    var h = doc.createElement("div"); h.className = "tx-conf-h"; h.textContent = "Base de ajuda da equipe"; d.appendChild(h);
    ajudaEquipe.forEach(function (x) {
      var l = doc.createElement("div"); l.className = "tx-conf-l"; l.textContent = "• " + x.t + ": " + x.a.slice(0, 90) + (x.a.length > 90 ? "…" : "");
      var b = botaoMini("✕", "Excluir “" + x.t + "”", function () { usarDb().then(function (db) { return db && db.doc("tax_ajuda/" + x.id).delete(); }).then(function () { l.remove(); }, function () { b.textContent = "!"; }); });
      l.appendChild(b); d.appendChild(l);
    });
    var f = doc.createElement("form"); f.className = "tx-aj-form";
    f.innerHTML = '<input name="t" maxlength="80" placeholder="Pergunta ou título (ex.: Como pedir o extrato ao cliente)" required><input name="k" maxlength="200" placeholder="Palavras-chave (opcional)"><textarea name="a" maxlength="1200" rows="3" placeholder="Resposta" required></textarea><button type="submit" class="tx-cb tx-cb-ok">Adicionar</button>';
    f.onsubmit = function (e) {
      e.preventDefault();
      var t = f.elements.t.value.trim(), a = f.elements.a.value.trim(); if (!t || !a) return;
      usarDb().then(function (db) { if (!db) throw new Error(); return db.doc("tax_ajuda/" + slug(t) + "-" + rid().slice(-4)).set({t: t, k: f.elements.k.value.trim(), a: a, em: new Date().toISOString()}); })
        .then(function () { f.reset(); var l = doc.createElement("div"); l.className = "tx-conf-l"; l.textContent = "✓ " + t; d.insertBefore(l, f); }, function () { var l = doc.createElement("div"); l.className = "tx-conf-av"; l.textContent = "Não consegui salvar (sem permissão?)."; d.insertBefore(l, f); });
    };
    d.appendChild(f);
    return d;
  }
  // Painel da coordenação: perguntas mais feitas, não entendidas, avaliações e ações dos últimos dias.
  function painelCoordenacao(dias) {
    dias = dias || 30;
    return usarDb().then(function (db) {
      if (!db) return [T("Sem banco do Hub nesta tela.")];
      var ds = []; for (var i = 0; i < dias; i++) ds.push(ymd(addDias(hoje(), -i)));
      var ler = function (col) { return Promise.all(ds.map(function (d) { return db.doc(col + "/" + d).get().then(function (s) { var x = s && s.exists !== false && s.data ? s.data() || {} : {}; return Object.keys(x.itens || {}).map(function (k) { return Object.assign({dia: d}, x.itens[k]); }); }, function () { return []; }); })).then(function (l) { return [].concat.apply([], l); }); };
      return Promise.all([ler("tax_perguntas"), ler("tax_feedback"), ler("tax_acoes")]).then(function (r) {
        var pq = r[0], fb = r[1], ac = r[2], cont = {}, rot = {};
        pq.forEach(function (x) { var k = norm(x.q).replace(/[^a-z0-9 ]/g, "").slice(0, 60); if (!k) return; cont[k] = (cont[k] || 0) + 1; rot[k] = rot[k] || x.q; });
        var top = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; }).slice(0, 10);
        var nao = pq.filter(function (x) { return x.modo === "nao_entendi"; }), ruins = fb.filter(function (x) { return !x.bom; }), bons = fb.filter(function (x) { return x.bom; });
        var bl = [{tipo: "cab", texto: "Painel do assistente · últimos " + dias + " dias"},
          T(pq.length + " pergunta(s) registradas, " + nao.length + " não entendida(s), " + bons.length + " 👍 e " + ruins.length + " 👎, " + ac.length + " alteração(ões) confirmada(s) pelo assistente. As perguntas são registradas sem o nome de quem perguntou.")];
        if (top.length) bl.push({tipo: "grafico", titulo: "Perguntas mais feitas", itens: top.map(function (k) { return {rotulo: rot[k], valor: cont[k]}; })});
        if (nao.length) bl.push(linhasBloco("Não entendidas (sugestão: criar na base de ajuda)", nao.slice(-40).reverse().map(function (x) { return {t: x.q, sub: x.dia.split("-").reverse().join("/")}; })));
        if (ruins.length) bl.push(linhasBloco("Respostas que não ajudaram", ruins.slice(-40).reverse().map(function (x) { return {t: x.q, sub: x.r, tom: "warn"}; })));
        var ids = ac.map(function (x) { return x.quem; }).filter(Boolean);
        var unicos = ids.filter(function (v, i, a) { return a.indexOf(v) === i; });
        var nomes = !unicos.length ? Promise.resolve({}) : AUTH() ? AUTH().perfis(unicos, function (l) { return userNs && userNs.profiles ? userNs.profiles(l) : Promise.resolve({}); }).catch(function () { return {}; }) : userNs && userNs.profiles ? Promise.resolve(userNs.profiles(unicos)).catch(function () { return {}; }) : Promise.resolve({});
        return nomes.then(function (ps) {
          if (ac.length) bl.push(linhasBloco("Alterações feitas pelo assistente", ac.slice().sort(function (a, b) { return a.em < b.em ? 1 : -1; }).slice(0, 60).map(function (x) { var n = x.quem && ps && ps[x.quem] && ps[x.quem].name || "alguém"; return {t: (x.empresa ? x.empresa + ": " : "") + (x.linha || x.titulo), sub: x.titulo + " · " + n + " · " + new Date(x.em).toLocaleString("pt-BR", {dateStyle: "short", timeStyle: "short"})}; })));
          return bl;
        });
      });
    });
  }
  COMANDOS_EXTRA.painel = function () { return ehCoord ? painelCoordenacao(30) : Promise.resolve([T("O painel do assistente é só do administrador.")]); }; COMANDOS_EXTRA.painel.rot = "Painel do assistente (coordenação)";
  CFG.push({sec: "Equipe (coordenação)", so: function () { return ehCoord; }, itens: [
    {rot: "Limite de perguntas à IA por pessoa/dia (0 = sem limite):", tipo: "texto", max: 4, valor: function () { return String(cfgEquipe.limiteDia || 0); }, salvar: function (v) { salvarCfgEquipe("limiteDia", Math.max(0, parseInt(v, 10) || 0)); }},
    {rot: "Instruções para a IA (tom, regras, termos internos):", tipo: "area", max: 1500, valor: function () { return cfgEquipe.instrucoes || ""; }, salvar: function (v) { salvarCfgEquipe("instrucoes", String(v).trim().slice(0, 1500)); }},
    {rot: "Editar a base de ajuda da equipe", tipo: "botao", ao: function () { var g = $("#tx-cfg", painel); if (g) g.hidden = true; addBot([T("Perguntas e respostas da equipe (entram na ajuda do assistente e da IA):")], true); var m = msgs.lastChild; m.appendChild(editorAjuda()); rolar(); }},
    {rot: "Abrir o painel do assistente", tipo: "botao", ao: function () { var g = $("#tx-cfg", painel); if (g) g.hidden = true; addUser("/painel"); painelCoordenacao(30).then(function (bl) { addBot(bl); }); }}
  ]});

  window.__assistenteHub = {
    perguntar: function (t) { return responder(t); },
    perguntarNoChat: function (t) { if (oculto) mostrar(); if (!aberto) abrirPainel(); enviar(t); },
    nome: nomeTax,
    mostrar: mostrar, abrir: abrirPainel, fechar: fecharPainel, versao: 1,
    estado: function () { return {aberto: aberto, oculto: oculto, andando: andando, dormiu: dormiu, pos: pos, modo: modo, pes: {x: fx, y: fy}, plataformas: plats.length}; },
    irPara: function (x, y) { chamar({x: x, y: y}); }, plataformas: function () { return plats.slice(); }, visual: function (k) { aplicarSkin(k); }, skins: function () { return Object.keys(SKINS); }
  };
  if (doc.body) iniciar(); else doc.addEventListener("DOMContentLoaded", iniciar);
})();
