/* Módulo Configurações do Control Hub.
   Uma aba para o Hub em geral, uma para cada sistema (DP, Contábil, Fiscal, Portal do Cliente, Cardápio) e uma para o assistente.
   - Hub e DP: controles nativos, ligados ao que já existe no Hub (window.__hubApi.cfg).
   - Contábil e Fiscal: abrem a própria página do módulo em "modo configurações" (?cfg=1), que mostra só o cartão de configurações.
   - Assistente: as mesmas opções do ⚙ do chat, desenhadas aqui (window.__assistenteHub.configurar). */
(function () {
  "use strict";
  if (window.__config) return;
  var doc = document, H = function () { return window.__hubApi || null; }, A = function () { return window.__auth || null; };
  var NOMES = {dp: "Departamento Pessoal", contabil: "Contábil", fiscal: "Fiscal", portal: "Portal do Cliente", cardapio: "Cardápio"};
  var NIVEL = {coord: "Coordenador", analista: "Analista", consulta: "Consulta"};
  var ABAS = [
    {k: "geral", rot: "Geral", sub: "Aparência, conta e atalhos"},
    {k: "dp", rot: "Departamento Pessoal", sub: "Equipe, prazos gerais, convenções, backup"},
    {k: "contabil", rot: "Contábil", sub: "Início do controle e vencimentos"},
    {k: "fiscal", rot: "Fiscal", sub: "Catálogo de obrigações e prazos"},
    {k: "portal", rot: "Portal do Cliente", sub: "Acesso e dados"},
    {k: "cardapio", rot: "Cardápio", sub: "Acesso e uso"},
    {k: "assistente", rot: "Assistente (Tax)", sub: "Conversa, mascote, avisos e equipe"}
  ];
  var IFRAMES = {contabil: "contabil.html?cfg=1", fiscal: "fiscal.html?cfg=1"};
  var st = {raiz: null, aba: "geral", frames: {}, medidor: null, tema: null};

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function podeVer(k) { var a = A(); return !a || a.podeVer(k); }
  function nivel(k) { var a = A(); return a ? a.nivel(k) : "coord"; }
  function ehAdmin() { var a = A(); return !a || a.ehAdmin(); }
  function card(titulo, sub, corpo, extra) {
    return '<section class="cf-card' + (extra ? " " + extra : "") + '"><div class="cf-card-h"><h3>' + esc(titulo) + "</h3>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + '</div><div class="cf-card-b">' + corpo + "</div></section>";
  }
  function linhaInfo(rot, val) { return '<div class="cf-li"><span>' + esc(rot) + "</span><b>" + val + "</b></div>"; }

  var CSS = '' +
    '#config-root{display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px;padding:4px 18px 40px;align-items:start}' +
    '.cf-nav{display:flex;flex-direction:column;gap:4px;position:sticky;top:12px}' +
    '.cf-tab{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:1px;padding:9px 12px;border-radius:var(--r,4px);border:1px solid transparent;color:var(--ink-2)}' +
    '.cf-tab b{font:600 13.5px var(--display,Archivo,sans-serif);color:var(--ink)}.cf-tab span{font-size:11.5px;color:var(--ink-3)}' +
    '.cf-tab:hover{background:var(--surface-2,rgba(127,127,127,.08))}.cf-tab:focus-visible{outline:2px solid var(--blue-deep);outline-offset:1px}' +
    '.cf-tab[aria-selected=true]{background:var(--surface);border-color:var(--rule-strong);box-shadow:inset 3px 0 0 var(--brand-red)}' +
    '.cf-sep{height:1px;background:var(--rule);margin:6px 4px}' +
    '.cf-main{display:flex;flex-direction:column;gap:14px;min-width:0}' +
    '.cf-tit{display:flex;flex-direction:column;gap:2px;margin-bottom:2px}.cf-tit h2{margin:0;font:700 20px var(--display,Archivo,sans-serif)}.cf-tit p{margin:0;color:var(--ink-3);font-size:12.5px}' +
    '.cf-card{background:var(--surface);border:1px solid var(--rule);border-radius:var(--r,4px);min-width:0}' +
    '.cf-card-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid var(--rule)}.cf-card-h h3{margin:0;font:600 14px var(--display,Archivo,sans-serif)}.cf-card-h span{font-size:11.5px;color:var(--ink-3)}' +
    '.cf-card-b{padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:13px}' +
    '.cf-card-b p{margin:0;color:var(--ink-2);line-height:1.45}.cf-nota{font-size:11.5px;color:var(--ink-3)}' +
    '.cf-li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed var(--rule)}.cf-li:last-child{border-bottom:0}.cf-li span{color:var(--ink-3)}' +
    '.cf-linha{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.cf-chips{display:flex;flex-wrap:wrap;gap:6px}.cf-chip{padding:3px 10px;border-radius:999px;background:var(--surface-2,rgba(127,127,127,.1));border:1px solid var(--rule);font-size:12px}' +
    '.cf-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}.cf-stat{border:1px solid var(--rule);border-radius:var(--r,4px);padding:8px 10px}.cf-stat b{display:block;font:600 20px var(--mono,monospace)}.cf-stat span{font-size:11.5px;color:var(--ink-3)}' +
    '.cf-tab-m{width:100%;border-collapse:collapse;font-size:12.5px}.cf-tab-m th,.cf-tab-m td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)}.cf-tab-m th{font:700 11px var(--display,Archivo,sans-serif);text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3)}' +
    '.cf-nv{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;border:1px solid var(--rule-strong)}.cf-nv.coord{background:var(--blue-pale);color:var(--blue-deep)}.cf-nv.nenhum{color:var(--ink-3);border-style:dashed}' +
    '.cf-form{display:flex;gap:8px;flex-wrap:wrap}.cf-form input{font:inherit;padding:6px 9px;border:1px solid var(--rule-strong);border-radius:var(--r,4px);background:var(--surface);color:var(--ink);min-width:200px}' +
    '.cf-msg{font-size:12px;color:var(--ink-3)}.cf-msg.erro{color:var(--brand-red)}' +
    '.cf-frame{width:100%;border:0;display:block;min-height:240px;background:transparent}.cf-frame-v{border-radius:var(--r,4px)}' +
    '.cf-kbd{font:600 11.5px var(--mono,monospace);border:1px solid var(--rule-strong);border-bottom-width:2px;border-radius:4px;padding:1px 6px;background:var(--surface-2,rgba(127,127,127,.08))}' +
    '.tx-cfg-page{display:flex;flex-direction:column;gap:8px;font-size:13px}.tx-cfg-page .tx-cfg-sec{font:700 11px var(--display,Archivo,sans-serif);text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)}.tx-cfg-page .tx-cfg-sec:first-child{margin-top:0;border-top:0;padding-top:0}' +
    '.tx-cfg-page .tx-cfg-it{display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.4}.tx-cfg-page .tx-cfg-it input[type=text],.tx-cfg-page .tx-cfg-it select,.tx-cfg-page .tx-cfg-it textarea{font:inherit;padding:5px 8px;border:1px solid var(--rule-strong);border-radius:var(--r,4px);background:var(--surface);color:var(--ink)}' +
    '.tx-cfg-page .tx-cfg-it textarea{width:100%;min-height:80px}.tx-cfg-page .tx-cfg-area{flex-direction:column;align-items:stretch}.tx-cfg-page .tx-cfg-bool{flex-wrap:nowrap;align-items:flex-start}.tx-cfg-page .tx-cfg-bool input{margin:3px 0 0;flex:none}' +
    '.tx-cfg-page .tx-cb{align-self:flex-start;font:600 12.5px var(--body,sans-serif);padding:6px 12px;border:1px solid var(--rule-strong);border-radius:var(--r,4px);background:var(--surface);color:var(--ink-2);cursor:pointer}.tx-cfg-page .tx-cb:hover{border-color:var(--blue-deep);color:var(--blue-deep)}' +
    '.tx-cfg-page .tx-cfg-det{display:block;border:1px solid var(--rule);border-radius:var(--r,4px);padding:0}.tx-cfg-page .tx-cfg-det summary{cursor:pointer;padding:9px 12px;font-weight:600}.tx-cfg-page .tx-cfg-det-c{padding:4px 12px 12px}' +
    '.tx-cfg-page .tx-cfg-uso{font-size:12px;color:var(--ink-3);margin-top:10px}' +
    '.tx-cfg-page .tx-aj-form{display:flex;flex-direction:column;gap:6px}.tx-cfg-page .tx-aj-form input,.tx-cfg-page .tx-aj-form textarea{font:inherit;padding:6px 9px;border:1px solid var(--rule-strong);border-radius:var(--r,4px);background:var(--surface);color:var(--ink)}' +
    '@media (max-width:820px){#config-root{grid-template-columns:1fr;padding:4px 12px 40px}.cf-nav{flex-direction:row;overflow-x:auto;position:static;padding-bottom:4px}.cf-tab{flex:none;min-width:140px}.cf-sep{display:none}}';

  function injetarCss() {
    if (doc.getElementById("cf-css")) return;
    var s = doc.createElement("style"); s.id = "cf-css"; s.textContent = CSS; doc.head.appendChild(s);
  }

  /* ---------- abas ---------- */
  function abasVisiveis() {
    return ABAS.filter(function (a) { return a.k === "geral" || a.k === "assistente" || podeVer(a.k); });
  }
  function desenharNav() {
    var vis = abasVisiveis();
    var h = vis.map(function (a, i) {
      return (a.k === "dp" || a.k === "assistente" ? '<div class="cf-sep" role="presentation"></div>' : "") + '<button type="button" class="cf-tab" role="tab" data-aba="' + a.k + '" aria-selected="' + (a.k === st.aba) + '"><b>' + esc(a.rot) + "</b><span>" + esc(a.sub) + "</span></button>";
    }).join("");
    st.nav.innerHTML = h;
  }
  function irPara(k) {
    var vis = abasVisiveis().map(function (a) { return a.k; });
    if (vis.indexOf(k) === -1) k = "geral";
    st.aba = k;
    desenharNav();
    desenharAba();
    try { st.raiz.scrollIntoView({block: "nearest"}); } catch (e) {}
  }
  function desenharAba() {
    var a = ABAS.filter(function (x) { return x.k === st.aba; })[0];
    // os quadros dos módulos ficam guardados (não perdem o que está sendo editado ao trocar de aba)
    Object.keys(st.frames).forEach(function (k) { if (st.frames[k].el.parentNode) st.frames[k].el.parentNode.removeChild(st.frames[k].el); });
    st.main.innerHTML = '<div class="cf-tit"><h2>' + esc(a.rot) + "</h2><p>" + esc(a.sub) + "</p></div><div id=\"cf-corpo\" class=\"cf-main\"></div>";
    var c = st.main.querySelector("#cf-corpo");
    ({geral: abaGeral, dp: abaDp, contabil: abaModulo, fiscal: abaModulo, portal: abaPortal, cardapio: abaCardapio, assistente: abaAssistente})[st.aba](c, st.aba);
  }

  /* ---------- acesso (comum aos sistemas) ---------- */
  function cartaoAcesso(k) {
    var n = nivel(k), a = A(), ana = a && a.analista ? a.analista(k) : "";
    var corpo = linhaInfo("Seu nível", '<span class="cf-nv ' + (n === "coord" ? "coord" : "") + '">' + esc(NIVEL[n] || "Sem acesso") + "</span>") +
      (n === "analista" ? linhaInfo("Analista ligado ao seu usuário", esc(ana || "ainda não definido")) : "") +
      '<p class="cf-nota">' + ({coord: "Você edita tudo neste módulo, inclusive as configurações.", analista: "Você edita só a própria carteira. As configurações são da coordenação.", consulta: "Você só consulta. As configurações são da coordenação."}[n] || "") + (ehAdmin() ? " Para mudar o nível de alguém, use Usuários e acesso." : " Para mudar o seu nível, fale com o administrador.") + "</p>" +
      '<div class="cf-linha"><button type="button" class="btn btn-sm" data-abrir-mod="' + k + '">Abrir ' + esc(NOMES[k]) + "</button>" + (ehAdmin() ? '<button type="button" class="btn btn-sm" data-abrir-mod="usuarios">Usuários e acesso</button>' : "") + "</div>";
    return card("Acesso e permissões", "o que você pode fazer aqui", corpo);
  }

  /* ---------- Geral ---------- */
  function abaGeral(c) {
    var h = H(), tema = h ? h.cfg.tema() : "light", a = A(), u = a && a.usuario ? a.usuario() : null;
    var aparencia = '<div class="cf-linha"><div class="seg" role="group" aria-label="Tema"><button type="button" data-tema="light" class="' + (tema === "light" ? "on" : "") + '" aria-pressed="' + (tema === "light") + '">Claro</button><button type="button" data-tema="dark" class="' + (tema === "dark" ? "on" : "") + '" aria-pressed="' + (tema === "dark") + '">Escuro</button></div></div><p class="cf-nota">O tema vale para o Hub, os módulos e o assistente, e fica guardado neste navegador.</p>';
    var mods = ["dp", "contabil", "fiscal", "portal", "cardapio"].map(function (k) {
      var n = nivel(k), ana = a && a.analista ? a.analista(k) : "";
      return "<tr><td>" + esc(NOMES[k]) + '</td><td><span class="cf-nv ' + (n === "coord" ? "coord" : !n ? "nenhum" : "") + '">' + esc(NIVEL[n] || "Sem acesso") + "</span></td><td>" + esc(n === "analista" ? ana || "—" : "") + "</td></tr>";
    }).join("");
    var conta = u ? linhaInfo("Nome", esc(u.nome)) + linhaInfo("Usuário", esc(u.login || "")) + (u.email ? linhaInfo("E-mail", esc(u.email)) : "") + linhaInfo("Administrador", u.admin ? "sim" : "não") : '<p class="cf-nota">O login do Hub não está ativo nesta sessão: todos os módulos abrem com acesso total.</p>';
    conta += '<table class="cf-tab-m"><thead><tr><th>Módulo</th><th>Nível</th><th>Analista ligado</th></tr></thead><tbody>' + mods + "</tbody></table>" +
      (u ? '<div class="cf-linha"><button type="button" class="btn btn-sm" data-conta="senha">Trocar senha</button><button type="button" class="btn btn-sm" data-conta="sair">Sair</button></div>' : "");
    var adm = ehAdmin() && a ? card("Administração", "só o administrador vê", '<p>Cadastros novos, níveis de acesso por módulo e o uso do banco de dados do artefato.</p><div class="cf-linha"><button type="button" class="btn btn-sm" data-abrir-mod="usuarios">Usuários e acesso</button><button type="button" class="btn btn-sm" data-abrir-mod="uso">Uso do banco</button></div>') : "";
    var atalhos = '<div class="cf-li"><span>Buscar empresa, funcionário ou ferramenta</span><b><span class="cf-kbd">Ctrl</span> + <span class="cf-kbd">K</span> ou <span class="cf-kbd">/</span></b></div><div class="cf-li"><span>Abrir ou fechar o chat do assistente</span><b><span class="cf-kbd">Ctrl</span> + <span class="cf-kbd">J</span></b></div><div class="cf-li"><span>Trocar o tema dentro de um módulo</span><b><span class="cf-kbd">T</span></b></div><div class="cf-li"><span>Fechar janelas e menus</span><b><span class="cf-kbd">Esc</span></b></div>';
    c.innerHTML = card("Aparência", "tema do Hub", aparencia) + card("Sua conta", "nível de acesso em cada módulo", conta) + adm + card("Atalhos de teclado", "", atalhos) +
      card("Onde fica cada configuração", "", '<p>As configurações de cada sistema ficam na aba do próprio sistema, e as do assistente na aba <b>Assistente (Tax)</b>. As preferências de aparência e as do chat são guardadas neste navegador; o que é da equipe (limite de IA, instruções, departamentos, ajuda) vale para todos.</p>');
  }

  /* ---------- DP ---------- */
  function abaDp(c) {
    var h = H(), d = h && h.cfg ? h.cfg.dp : null;
    if (!d) { c.innerHTML = card("Departamento Pessoal", "", "<p>O módulo ainda está carregando. Abra a aba de novo em instantes.</p>"); return; }
    var r = d.resumo(), pode = d.podeEditar();
    var stats = '<div class="cf-stats">' + [["empresas ativas", r.empresas], ["analistas na equipe", r.equipe], ["prazos gerais", r.gerais], ["sindicatos", r.sindicatos], ["convenções", r.convencoes], ["ausências registradas", r.ausencias]].map(function (x) { return '<div class="cf-stat"><b>' + x[1] + "</b><span>" + x[0] + "</span></div>"; }).join("") + "</div>";
    var equipe = '<div class="cf-chips">' + (d.equipe().map(function (n) { return '<span class="cf-chip">' + esc(n) + "</span>"; }).join("") || '<span class="cf-nota">Ninguém cadastrado ainda.</span>') + "</div>" +
      (pode ? '<form class="cf-form" data-equipe-form><input type="text" maxlength="80" placeholder="Nome do novo analista" aria-label="Nome do novo analista" autocomplete="off"><button type="submit" class="btn btn-sm btn-primary">Adicionar à equipe</button></form><span class="cf-msg" id="cf-eq-msg"></span>' : "") +
      '<p class="cf-nota">Para tirar alguém da equipe ou passar a carteira dele, use a Cartela de clientes (ela redistribui as empresas antes).</p>';
    var gerais = '<p>Datas que valem para todas as empresas ativas (salários, eSocial, FGTS…). Hoje há <b>' + r.gerais + "</b> prazo(s) geral(is) cadastrado(s).</p><div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-dp=\"gerais\">" + (pode ? "Editar prazos gerais" : "Ver prazos gerais") + "</button></div>";
    var conv = "<p>Cadastro de sindicatos, importação da lista do Domínio, convenções coletivas (CCT), pisos, reajustes e contribuições.</p><div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-dp=\"convencoes\">Cadastro de sindicatos e convenções</button><button type=\"button\" class=\"btn btn-sm\" data-dp=\"cartela\">Cartela e ausências</button></div>";
    var imp = "<p>RPA e lançamentos de rubricas: modelo travado para o cliente, conferência linha a linha e arquivo .txt para o Domínio.</p><div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-dp=\"importador\">Abrir o Importador Domínio</button></div>";
    var bk = "<p>Baixa um arquivo com empresas, prazos gerais, sindicatos, convenções e cobertura. Serve como cópia de segurança.</p><div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-dp=\"backup\">Baixar backup (JSON)</button>" + (pode ? "<button type=\"button\" class=\"btn btn-sm\" data-dp=\"importar\">Importar backup…</button>" : "") + "</div>";
    c.innerHTML = card("Resumo", "o que está cadastrado no DP", stats) + card("Equipe de analistas", pode ? "coordenação" : "só a coordenação altera", equipe) + card("Prazos gerais", "valem para todas as empresas", gerais) + card("Convenções e sindicatos", "", conv) + card("Importador Domínio", "ferramenta do DP", imp) + card("Backup", "cópia de segurança", bk) + cartaoAcesso("dp");
  }

  /* ---------- Contábil e Fiscal: página do módulo em modo configurações ---------- */
  function abaModulo(c, k) {
    var corpo = '<div id="cf-quadro-' + k + '"></div>';
    c.innerHTML = card(k === "fiscal" ? "Obrigações e prazos" : "Início do controle e vencimentos", "as mesmas configurações do módulo, agora aqui", corpo) + cartaoAcesso(k);
    var alvo = c.querySelector("#cf-quadro-" + k);
    var f = st.frames[k];
    if (!f) {
      var el = doc.createElement("iframe"); el.className = "cf-frame"; el.title = "Configurações do " + NOMES[k]; el.src = IFRAMES[k];
      el.addEventListener("load", function () { aplicarTemaFrame(el); medir(el); });
      f = st.frames[k] = {el: el};
    }
    alvo.appendChild(f.el);
    aplicarTemaFrame(f.el); medir(f.el);
  }
  function aplicarTemaFrame(el) { try { var t = doc.documentElement.dataset.theme; if (t && el.contentDocument) el.contentDocument.documentElement.dataset.theme = t; } catch (e) {} }
  function medir(el) {
    try {
      var d = el.contentDocument; if (!d || !d.documentElement) return;
      var h = Math.max(d.body ? d.body.scrollHeight : 0, d.documentElement.scrollHeight);
      if (h && Math.abs((parseInt(el.style.height, 10) || 0) - h) > 2) el.style.height = h + "px";
    } catch (e) {}
  }

  /* ---------- Portal e Cardápio ---------- */
  function abaPortal(c) {
    c.innerHTML = card("Configurações do módulo", "", "<p>O Portal do Cliente não tem configurações próprias: ele usa o cadastro de empresas, setores e pessoas do Hub. Backup e importação de planilhas ficam dentro do próprio módulo.</p><div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-abrir-mod=\"portal\">Abrir o Portal do Cliente</button></div>") + cartaoAcesso("portal");
  }
  function abaCardapio(c) {
    var n = nivel("cardapio");
    c.innerHTML = card("Configurações do módulo", "", "<p>O Cardápio não tem configurações próprias. A coordenação cadastra cada dia direto na semana (prato, guarnição, salada e sobremesa) e marca feriados como “sem serviço”.</p>" + linhaInfo("Quem edita o cardápio", n === "coord" ? "você (coordenação)" : "só a coordenação") + "<div class=\"cf-linha\"><button type=\"button\" class=\"btn btn-sm\" data-abrir-mod=\"cardapio\">Abrir o Cardápio</button></div>") + cartaoAcesso("cardapio");
  }

  /* ---------- Assistente ---------- */
  function abaAssistente(c) {
    c.innerHTML = card("Assistente (Tax)", "as mesmas opções do ⚙ do chat", '<p class="cf-nota">As opções de Conversa, Mascote e Avisos valem só para este navegador. A seção “Equipe (coordenação)” vale para todos e só aparece para quem coordena.</p><div class="cf-linha"><button type="button" class="btn btn-sm" data-assist="abrir">Abrir o chat</button></div><div id="cf-assist" class="tx-cfg-page"><span class="cf-msg">Carregando as opções do assistente…</span></div>');
    var alvo = c.querySelector("#cf-assist"), t0 = Date.now();
    (function tenta() {
      if (st.aba !== "assistente" || !alvo.isConnected) return;
      var ah = window.__assistenteHub;
      if (ah && ah.configurar) { alvo.innerHTML = ""; try { ah.configurar(alvo); } catch (e) { alvo.innerHTML = '<span class="cf-msg erro">Não foi possível desenhar as opções do assistente.</span>'; } return; }
      if (Date.now() - t0 > 15000) { alvo.innerHTML = '<span class="cf-msg erro">O assistente ainda não carregou. Atualize a página e abra esta aba de novo.</span>'; return; }
      setTimeout(tenta, 300);
    })();
  }

  /* ---------- eventos ---------- */
  function aoClicar(e) {
    var t = e.target, h = H();
    var ab = t.closest("[data-aba]"); if (ab) { irPara(ab.getAttribute("data-aba")); return; }
    var tm = t.closest("[data-tema]"); if (tm && h) { h.cfg.setTema(tm.getAttribute("data-tema")); desenharAba(); Object.keys(st.frames).forEach(function (k) { aplicarTemaFrame(st.frames[k].el); }); return; }
    var am = t.closest("[data-abrir-mod]"); if (am && h) { h.abrirModulo(am.getAttribute("data-abrir-mod")); return; }
    var co = t.closest("[data-conta]"); if (co && A()) { if (co.getAttribute("data-conta") === "senha") A().trocarSenha(); else A().sair(); return; }
    var dp = t.closest("[data-dp]"); if (dp && h && h.cfg.dp) {
      var d = h.cfg.dp, a = dp.getAttribute("data-dp");
      if (a === "gerais") d.abrirGerais(); else if (a === "backup") d.backup(); else if (a === "importar") d.importar();
      else if (a === "convencoes") d.abrirConvencoes(); else if (a === "importador") d.abrirImportador(); else if (a === "cartela") d.abrir("cartela");
      return;
    }
    if (t.closest("[data-assist=abrir]") && window.__assistenteHub) { window.__assistenteHub.abrir(); }
  }
  function aoEnviar(e) {
    var f = e.target.closest("[data-equipe-form]"); if (!f) return;
    e.preventDefault();
    var inp = f.querySelector("input"), msg = st.main.querySelector("#cf-eq-msg"), h = H();
    var erro = h && h.cfg.dp ? h.cfg.dp.equipeAdd(inp.value) : "O DP não está disponível.";
    if (erro) { msg.textContent = erro; msg.className = "cf-msg erro"; return; }
    var nome = inp.value.trim(); desenharAba();
    var m2 = st.main.querySelector("#cf-eq-msg"); if (m2) m2.textContent = nome + " entrou na equipe.";
  }

  function montar(raiz, opcoes) {
    injetarCss();
    opcoes = opcoes || {};
    if (st.raiz !== raiz || !raiz.firstChild) {
      st.raiz = raiz; st.frames = {};
      raiz.innerHTML = '<nav class="cf-nav" role="tablist" aria-label="Configurações por sistema"></nav><div class="cf-corpo-w"></div>';
      st.nav = raiz.querySelector(".cf-nav"); st.main = raiz.querySelector(".cf-corpo-w");
      raiz.addEventListener("click", aoClicar); raiz.addEventListener("submit", aoEnviar);
      if (!st.medidor) st.medidor = setInterval(function () { Object.keys(st.frames).forEach(function (k) { if (st.frames[k].el.isConnected) medir(st.frames[k].el); }); }, 700);
      var ob = new MutationObserver(function () { Object.keys(st.frames).forEach(function (k) { aplicarTemaFrame(st.frames[k].el); }); });
      ob.observe(doc.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
    }
    st.aba = opcoes.aba && ABAS.some(function (a) { return a.k === opcoes.aba; }) ? opcoes.aba : (opcoes.aba === undefined ? st.aba : "geral");
    irPara(st.aba);
  }

  window.__config = {montar: montar, irPara: irPara, aba: function () { return st.aba; }, versao: 1};
})();
