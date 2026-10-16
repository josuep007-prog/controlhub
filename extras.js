/* Extras do Control Hub: sino de notificações, mural de avisos, rotinas do escritório, painel da coordenação e registro de alterações.
   Carregado pelo hub.js depois do login. Dados no banco do Hub: hub_mural/<id>, hub_lidos/<pessoa>, hub_rotinas/<id>, hub_log/<dia>. */
(function () {
  "use strict";
  if (window.__extras) return;
  var doc = document, H = function () { return window.__hubApi || {}; };
  var E = {db: null, me: "", nome: "", coord: false, mural: [], lidos: {}, confirmacoes: {}, rotinas: [], notifs: [], iniciado: false, painelAberto: false, aba: {coord: "geral"}};
  var MODN = {dp: "DP", contabil: "Contábil", fiscal: "Fiscal", portal: "Portal", cardapio: "Cardápio"};

  /* ---------- utilitários ---------- */
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sv(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hoje() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dmy(s) { return String(s || "").split("-").reverse().join("/"); }
  function uid() { return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function atras(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return "agora há pouco";
    var m = Math.round(s / 60); if (m < 60) return "há " + m + " min";
    var h = Math.round(m / 60); if (h < 24) return "há " + h + " h";
    var d = Math.round(h / 24); return d === 1 ? "ontem" : "há " + d + " dias";
  }
  function toast(m) { var h = H(); if (h.toast) h.toast(m); }
  var ICO = {
    sino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8.5a6 6 0 0 1 12 0c0 6.2 2.6 7.8 2.6 7.8H3.4S6 14.7 6 8.5Z"/><path d="M10.2 20a2 2 0 0 0 3.6 0"/></svg>',
    mural: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>',
    tax: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="3"/><path d="M9.5 11v1.4M14.5 11v1.4M12 3v3"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>'
  };

  /* ---------- estilos ---------- */
  var CSS = '' +
    '.xs-sino{all:unset;box-sizing:border-box;position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--surface,#fff);color:var(--ink-2,#47545F);border:1px solid var(--rule-strong,#C2CCD5);box-shadow:0 2px 8px rgba(16,24,32,.12);transition:transform .15s,box-shadow .15s,color .15s}' +
    '.xs-sino:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(16,24,32,.18);color:var(--blue-deep,#3C659B)}.xs-sino:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:2px}' +
    '.xs-sino svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform-origin:50% 8%}' +
    '.xs-sino.toca svg{animation:xs-balanca .9s ease-in-out 1}' +
    '@keyframes xs-balanca{0%,100%{transform:rotate(0)}15%{transform:rotate(16deg)}30%{transform:rotate(-14deg)}45%{transform:rotate(10deg)}60%{transform:rotate(-7deg)}75%{transform:rotate(3deg)}}' +
    '.xs-n{position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--brand-red,#C2000C);color:#fff;font:600 11px/20px var(--mono,monospace);text-align:center;border:2px solid var(--surface,#fff);box-sizing:border-box;line-height:16px}' +
    '.xs-n[hidden]{display:none}' +
    '#xs-sino-home{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);right:64px;z-index:70;width:38px;height:38px}#xs-sino-home svg{width:18px;height:18px}#xs-sino-home .xs-n{top:-6px;right:-6px;min-width:18px;height:18px;font-size:10px;line-height:14px;padding:0 4px}body.in-module #xs-sino-home{display:none}' +
    '.xs-rail .card-icon{position:relative}.xs-rail .xs-n{top:-6px;right:-6px;border-color:var(--surface-2,#fff)}' +
    '#xs-painel{position:fixed;z-index:60;width:min(392px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 90px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:14px;box-shadow:0 18px 48px rgba(16,24,32,.28);overflow:hidden;animation:xs-entra .16s ease-out}' +
    '@keyframes xs-entra{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}' +
    '#xs-painel[hidden]{display:none}' +
    '.xs-ph{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}.xs-ph h3{margin:0;font:700 15px var(--display,Archivo,sans-serif);flex:1}.xs-ph button{all:unset;cursor:pointer;font-size:12px;color:var(--blue-deep,#3C659B);font-weight:600;padding:3px 6px;border-radius:4px}.xs-ph button:hover{background:var(--blue-pale,#DCE8F1)}.xs-ph button:focus-visible{outline:2px solid var(--blue-deep,#3C659B)}' +
    '.xs-lista{overflow:auto;padding:2px 8px 8px;display:flex;flex-direction:column;gap:2px}' +
    '.xs-sec{font:700 10.5px var(--display,Archivo,sans-serif);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3,#5F6D77);padding:10px 8px 4px}' +
    '.xs-it{all:unset;box-sizing:border-box;display:grid;grid-template-columns:36px 1fr auto;gap:11px;align-items:start;padding:10px 8px;border-radius:10px;cursor:pointer;position:relative}.xs-it:hover{background:var(--surface-2,#F5F8FA)}.xs-it:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:-2px}' +
    '.xs-ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}.xs-ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.xs-ic.xs-imp{background:rgba(194,0,12,.13);color:#D3202B}.xs-ic.tax{background:var(--warn-soft,#FBEBDD);color:var(--status-warn,#B5530C)}' +
    '.xs-tx{min-width:0}.xs-tx b{display:block;font:600 13px/1.3 var(--body,sans-serif);overflow-wrap:anywhere}.xs-tx>span{display:block;font-size:12px;color:var(--ink-3,#5F6D77);margin-top:1px;overflow-wrap:anywhere}.xs-tx small{display:block;font-size:11px;color:var(--ink-3,#5F6D77);margin-top:3px}' +
    '.xs-dot{width:9px;height:9px;border-radius:50%;background:var(--blue-deep,#3C659B);margin-top:6px}.xs-it.lida .xs-dot{visibility:hidden}.xs-it.lida .xs-tx b{font-weight:500;color:var(--ink-2,#47545F)}' +
    '.xs-tag{display:inline-block;font:600 10px var(--body,sans-serif);padding:0 6px;border-radius:999px;background:rgba(194,0,12,.13);color:#D3202B;margin-left:6px;vertical-align:1px}' +
    '.xs-vazio{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 20px 38px;color:var(--ink-3,#5F6D77);text-align:center}.xs-vazio svg{width:46px;height:46px;fill:none;stroke:var(--status-green,#167A45);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.xs-vazio b{color:var(--ink,#101820);font:600 14px var(--display,Archivo,sans-serif)}' +
    '.xs-pf{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--rule,#DCE3E9);background:var(--surface-2,#F5F8FA)}.xs-pf .btn{flex:1;justify-content:center}' +
    /* módulos */
    '.xm{max-width:1180px;margin:0 auto;padding:6px 18px 50px;display:flex;flex-direction:column;gap:14px}' +
    '.xm .x-abas{display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--rule)}.xm .x-abas button{all:unset;cursor:pointer;padding:9px 14px;font:600 13px var(--display,Archivo,sans-serif);color:var(--ink-2);border-bottom:3px solid transparent;white-space:nowrap}.xm .x-abas button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--brand-red)}.xm .x-abas button:focus-visible{outline:2px solid var(--blue-deep)}' +
    '.xm .x-grid{display:grid;gap:12px}.xm .x-g4{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.xm .x-g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}' +
    '.xm .x-card{background:var(--surface);border:1px solid var(--rule);border-radius:4px;min-width:0}.xm .x-card>h3{margin:0;font:600 14px var(--display,Archivo,sans-serif);padding:11px 14px;border-bottom:1px solid var(--rule);display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.xm .x-card>h3 span{font:400 11.5px var(--body,sans-serif);color:var(--ink-3)}.xm .x-cb{padding:12px 14px}' +
    '.xm .x-kpi{padding:12px 14px;border:1px solid var(--rule);background:var(--surface);border-radius:4px}.xm .x-kpi b{display:block;font:600 26px var(--mono,monospace);font-variant-numeric:tabular-nums}.xm .x-kpi span{font-size:12px;color:var(--ink-3)}.xm .x-kpi.late b{color:var(--dp-late,#B3261E)}.xm .x-kpi.warn b{color:var(--status-warn,#B5530C)}.xm .x-kpi.ok b{color:var(--status-green,#167A45)}' +
    '.xm .x-bar{display:grid;grid-template-columns:130px 1fr 44px;gap:10px;align-items:center;padding:5px 0;font-size:12.5px}.xm .x-bar .t{height:10px;background:var(--surface-2);border:1px solid var(--rule);border-radius:2px;overflow:hidden}.xm .x-bar .t i{display:block;height:100%}.xm .x-bar b{font:500 12px var(--mono,monospace);text-align:right}' +
    '.xm .s-late{background:var(--dp-late,#B3261E)}.xm .s-warn{background:var(--status-warn,#B5530C)}.xm .s-ok{background:var(--status-green,#167A45)}' +
    '.xm .x-pill{display:inline-block;font:600 11px var(--body,sans-serif);padding:1px 8px;border-radius:999px;background:var(--blue-pale);color:var(--blue-deep)}.xm .x-pill.late{background:var(--brand-red-soft);color:var(--brand-red)}.xm .x-pill.warn{background:var(--warn-soft);color:var(--status-warn)}.xm .x-pill.ok{background:var(--green-soft,#E1F2E8);color:var(--status-green)}' +
    '.xm table{width:100%;border-collapse:collapse;font-size:12.5px}.xm th,.xm td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--rule);vertical-align:top}.xm th{font:700 10.5px var(--display,Archivo,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}.xm .x-sc{overflow-x:auto}' +
    '.xm .x-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.xm input[type=text],.xm input[type=date],.xm select,.xm textarea{font:inherit;padding:6px 9px;border:1px solid var(--rule-strong);border-radius:4px;background:var(--surface);color:var(--ink);min-width:0}.xm textarea{width:100%;min-height:90px}' +
    '.xm .x-ev{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:9px 0;border-bottom:1px solid var(--rule)}.xm .x-ev:last-child{border-bottom:0}.xm .x-ev .h{font:500 11.5px var(--mono,monospace);color:var(--ink-3)}.xm .x-ev .m{font-size:12px;color:var(--ink-3)}' +
    '.xm .x-rot{border:1px solid var(--rule);border-radius:4px;background:var(--surface)}.xm .x-rot summary{cursor:pointer;padding:11px 14px;display:flex;gap:10px;align-items:center;list-style:none;flex-wrap:wrap}.xm .x-rot summary::-webkit-details-marker{display:none}.xm .x-rot summary b{font:600 14px var(--display,Archivo,sans-serif)}.xm .x-rot .sp{flex:1}' +
    '.xm .x-rot .sub{padding:0 14px 6px;color:var(--ink-3);font-size:12px}.xm .x-rot ol{margin:0;padding:4px 14px 12px;list-style:none;display:flex;flex-direction:column;gap:6px}.xm .x-rot li{display:flex;gap:9px;align-items:flex-start}.xm .x-rot li input{margin-top:3px}.xm .x-rot li.f label{color:var(--ink-3);text-decoration:line-through}' +
    '.xm .x-prog{height:6px;background:var(--surface-2);border:1px solid var(--rule);border-radius:3px;overflow:hidden;width:90px}.xm .x-prog i{display:block;height:100%;background:var(--status-green)}' +
    '.xm .x-rec{border:1px solid var(--rule);border-left:4px solid var(--blue-deep);border-radius:4px;padding:10px 12px;background:var(--surface)}.xm .x-rec.x-imp{border-left-color:var(--brand-red)}.xm .x-rec .top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--ink-3)}.xm .x-rec p{margin:4px 0 0}' +
    '.xm .x-vazio{color:var(--ink-3);padding:16px;text-align:center}.xm .x-nota{font-size:12px;color:var(--ink-3);border:1px dashed var(--rule-strong);border-radius:4px;padding:8px 12px;background:var(--surface)}' +
    '.xm .btn{border:1px solid var(--rule-strong);background:var(--surface);border-radius:4px;padding:6px 12px;font-weight:600;font-size:12.5px;color:var(--ink-2);cursor:pointer}.xm .btn:hover{border-color:var(--blue-deep);color:var(--blue-deep)}.xm .btn.p{background:var(--blue-deep);border-color:var(--blue-deep);color:var(--surface)}.xm .btn:disabled{opacity:.6;cursor:default}' +
    '@media (max-width:560px){.xm .x-bar{grid-template-columns:96px 1fr 38px}.xm .x-ev{grid-template-columns:1fr}.xm{padding-inline:12px}}' +
    '.xs-lista{scrollbar-gutter:auto}' +
    '@supports not selector(::-webkit-scrollbar){.xs-lista{scrollbar-width:thin;scrollbar-color:transparent transparent}.xs-lista:hover{scrollbar-color:color-mix(in srgb,var(--ink-3,#5F6D77) 40%,transparent) transparent}}' +
    '.xs-lista::-webkit-scrollbar{width:8px}.xs-lista::-webkit-scrollbar-track{background:transparent;margin:6px 0}' +
    '.xs-lista::-webkit-scrollbar-thumb{background:transparent;border-radius:10px;border:2px solid transparent;background-clip:content-box;min-height:36px;transition:background .2s}' +
    '.xs-lista:hover::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ink-3,#5F6D77) 34%,transparent);background-clip:content-box}' +
    '.xs-lista::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--blue-deep,#3C659B) 60%,transparent);background-clip:content-box}' +
    '@media (prefers-reduced-motion:reduce){.xs-sino.toca svg,#xs-painel{animation:none}.xs-sino{transition:none}}';
  function css() { if (doc.getElementById("xs-css")) return; var s = doc.createElement("style"); s.id = "xs-css"; s.textContent = CSS; doc.head.appendChild(s); }

  /* ---------- notificações (sino) ---------- */
  function guardaNotifs() { sv("hub-notifs-v1", E.notifs.slice(0, 40)); }
  function notificar(n) {
    if (!n || !n.t) return;
    var k = String(n.t).slice(0, 120);
    if (E.notifs.some(function (x) { return x.t === k && Date.now() - x.em < 6 * 36e5; })) return;
    E.notifs.unshift({id: uid(), t: k, s: n.s || "Assistente", tipo: n.tipo || "tax", em: Date.now(), lida: false, ir: n.ir || ""});
    E.notifs = E.notifs.slice(0, 40); guardaNotifs(); desenhaSino(true);
  }
  function muralAtivo() { var h = ymd(hoje()); return E.mural.filter(function (m) { return !m.ate || m.ate >= h; }).sort(function (a, b) { return (b.imp - a.imp) || (b.em - a.em); }); }
  function muralNaoLido() { return muralAtivo().filter(function (m) { return !E.lidos[m.id]; }); }
  function itensSino() {
    var l = [];
    var a = null; try { a = window.__auth && window.__auth.ehAdmin() ? window.__auth.pendentes() : 0; } catch (e) {}
    if (a > 0) l.unshift({k: "p", tipo: "user", imp: true, t: a + " cadastro(s) aguardando liberação", s: "Defina o nível de acesso de cada pessoa.", d: "Usuários e acesso", lida: false, ir: "usuarios"});
    E.notifs.forEach(function (n) { l.push({k: "n:" + n.id, tipo: n.tipo, imp: false, t: n.t, s: n.s, d: atras(n.em), lida: n.lida, ir: n.ir || "tax", em: n.em}); });
    return l;
  }
  function naoLidas() { return itensSino().filter(function (i) { return !i.lida; }).length; }
  var ultN = -1;
  function desenhaSino(tocar) {
    var n = naoLidas();
    [].forEach.call(doc.querySelectorAll(".xs-n"), function (b) { b.textContent = n > 99 ? "99+" : n; b.hidden = !n; });
    [].forEach.call(doc.querySelectorAll(".xs-sino"), function (b) { b.setAttribute("aria-label", n ? "Notificações: " + n + " não lida(s)" : "Notificações"); if ((tocar || n > ultN) && n && ultN >= 0) { b.classList.remove("toca"); void b.offsetWidth; b.classList.add("toca"); } });
    ultN = n;
    if (E.painelAberto) desenhaPainel();
  }
  function iconeDe(i) { return '<span class="xs-ic ' + (i.imp ? "xs-imp" : i.tipo === "tax" ? "tax" : "") + '">' + (ICO[i.tipo === "mural" ? "mural" : i.tipo === "user" ? "user" : "tax"]) + "</span>"; }
  function desenhaPainel() {
    var p = doc.getElementById("xs-painel"); if (!p) return;
    var l = itensSino(), n = l.filter(function (i) { return !i.lida; }).length;
    var novos = l.filter(function (i) { return !i.lida; }), antigos = l.filter(function (i) { return i.lida; }).slice(0, 8);
    var it = function (i) { return '<button type="button" class="xs-it' + (i.lida ? " lida" : "") + '" data-ir="' + esc(i.ir) + '" data-k="' + esc(i.k) + '">' + iconeDe(i) + '<span class="xs-tx"><b>' + esc(i.t) + (i.imp && i.tipo === "mural" ? '<span class="xs-tag">importante</span>' : "") + "</b>" + (i.s ? "<span>" + esc(String(i.s).slice(0, 110)) + "</span>" : "") + "<small>" + esc(i.d) + '</small></span><span class="xs-dot"></span></button>'; };
    p.innerHTML = '<div class="xs-ph"><h3>Notificações</h3>' + (n ? '<button type="button" data-tudo>Marcar tudo como lido</button>' : "") + '</div><div class="xs-lista">' +
      (l.length ? (novos.length ? '<div class="xs-sec">Novas · ' + novos.length + "</div>" + novos.map(it).join("") : "") + (antigos.length ? '<div class="xs-sec">Anteriores</div>' + antigos.map(it).join("") : "") : '<div class="xs-vazio">' + ICO.ok + "<b>Tudo em dia</b><span>Quando o assistente tiver um aviso, ele aparece aqui.</span></div>") +
      '</div>';
  }
  function posiciona() {
    var p = doc.getElementById("xs-painel"); if (!p) return;
    var emMod = doc.body.classList.contains("in-module");
    if (emMod) { p.style.left = "76px"; p.style.right = "auto"; p.style.top = "calc(env(safe-area-inset-top,0px) + 70px)"; }
    else { p.style.right = "16px"; p.style.left = "auto"; p.style.top = "calc(env(safe-area-inset-top,0px) + 62px)"; }
  }
  function abrePainel(abrir) {
    var p = doc.getElementById("xs-painel"); if (!p) return;
    E.painelAberto = abrir === undefined ? p.hidden : abrir;
    p.hidden = !E.painelAberto; if (E.painelAberto) { posiciona(); desenhaPainel(); }
    [].forEach.call(doc.querySelectorAll(".xs-sino"), function (b) { b.setAttribute("aria-expanded", String(E.painelAberto)); });
  }
  function irPara(dest, k) {
    var h = H(); abrePainel(false);
    if (k && k.indexOf("n:") === 0) { E.notifs.forEach(function (n) { if ("n:" + n.id === k) n.lida = true; }); guardaNotifs(); desenhaSino(); }
    if (dest === "tax") { try { window.__assistenteHub && window.__assistenteHub.abrir(); } catch (e) {} return; }
    if (h.abrirModulo) h.abrirModulo(dest);
  }
  function marcaTudo() {
    E.notifs.forEach(function (n) { n.lida = true; }); guardaNotifs();
    desenhaSino();
  }
  function montaSino() {
    css();
    if (!doc.getElementById("xs-sino-home")) {
      var b = doc.createElement("button"); b.type = "button"; b.id = "xs-sino-home"; b.className = "xs-sino"; b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false");
      b.innerHTML = ICO.sino + '<span class="xs-n" hidden>0</span>'; doc.body.appendChild(b);
    }
    var busca = doc.querySelector("#side-rail [data-cmdk]"), apos = busca ? busca.closest(".card") : null;
    if (apos && !doc.getElementById("xs-sino-rail")) {
      var c = doc.createElement("div"); c.className = "card xs-rail"; c.id = "xs-sino-rail"; c.style.setProperty("--accent", "#C2000C");
      c.innerHTML = '<button type="button" class="card-stretch xs-sino-b" aria-label="Notificações"></button><div class="card-icon"><svg class="ic ic-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8.5a6 6 0 0 1 12 0c0 6.2 2.6 7.8 2.6 7.8H3.4S6 14.7 6 8.5Z"/><path d="M10.2 20a2 2 0 0 0 3.6 0"/></svg><span class="xs-n" hidden>0</span></div><div class="card-title">Notificações</div>';
      apos.insertAdjacentElement("afterend", c);
    }
    if (!doc.getElementById("xs-painel")) { var p = doc.createElement("div"); p.id = "xs-painel"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Notificações"); doc.body.appendChild(p); }
    doc.addEventListener("click", function (e) {
      if (e.target.closest("#xs-sino-home,.xs-sino-b")) { abrePainel(); return; }
      var tudo = e.target.closest("[data-tudo]"); if (tudo) { marcaTudo(); return; }
      var it = e.target.closest("#xs-painel [data-ir]"); if (it) { irPara(it.getAttribute("data-ir"), it.getAttribute("data-k")); return; }
      if (!e.target.closest("#xs-painel")) abrePainel(false);
    });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && E.painelAberto) abrePainel(false); });
    try { window.__auth && window.__auth.onPendentes && window.__auth.onPendentes(function () { desenhaSino(); }); } catch (e) {}
    setInterval(function () { if (E.painelAberto) desenhaPainel(); }, 60000);
    desenhaSino();
  }

  /* ---------- mural: dados ---------- */
  function confirmar(ids) {
    if (!E.db || !E.me) return Promise.resolve();
    ids.forEach(function (i) { E.lidos[i] = Date.now(); });
    var ref = E.db.doc("hub_lidos/" + E.me);
    return ref.set({nome: E.nome, ids: E.lidos}).then(function () { desenhaSino(); }).catch(function () { toast("Não consegui registrar a leitura agora."); });
  }
  function ligaMural() {}

  /* ---------- módulo: Mural de avisos ---------- */
  function renderMural() {
    var raiz = E.raiz; if (!raiz || E.vista !== "mural") return;
    var lista = muralAtivo(), exp = E.mural.filter(function (m) { return m.ate && m.ate < ymd(hoje()); });
    var form = E.coord ? '<div class="x-card"><h3>Novo aviso<span>só a coordenação publica</span></h3><div class="x-cb"><form class="x-tools" id="xmForm" style="align-items:flex-start"><input type="text" id="mT" placeholder="Título" maxlength="70" required style="flex:1;min-width:180px" aria-label="Título do aviso"><input type="text" id="mX" placeholder="Texto do aviso" maxlength="240" required style="flex:2;min-width:220px" aria-label="Texto do aviso"><select id="mV" aria-label="Validade"><option value="1">vale por 1 dia</option><option value="7" selected>vale por 7 dias</option><option value="30">vale por 30 dias</option><option value="0">sem data final</option></select><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="mI"> importante</label><button class="btn p" type="submit">Publicar</button></form></div></div>' : "";
    raiz.innerHTML = '<div class="xm">' + form + (lista.length ? lista.map(function (m) {
      var lido = !!E.lidos[m.id];
      return '<div class="x-rec' + (m.imp ? " x-imp" : "") + '"><div class="top"><span>' + esc(m.autor || "Coordenação") + " · " + atras(m.em) + (m.ate ? " · vale até " + dmy(m.ate) : "") + "</span>" + (m.imp ? '<span class="x-pill late">importante</span>' : "") + "</div><p><b>" + esc(m.t) + "</b></p><p>" + esc(m.x) + '</p><div class="x-tools" style="margin-top:8px"><button class="btn" data-lido="' + esc(m.id) + '"' + (lido ? " disabled>Li e entendi ✓" : ">Li e entendi") + "</button>" + (E.coord ? '<span style="font-size:12px;color:var(--ink-3)">' + (E.confirmacoes[m.id] || 0) + " pessoa(s) confirmaram</span><button class=\"btn\" data-apaga=\"" + esc(m.id) + '">Apagar</button>' : "") + "</div></div>";
    }).join("") : '<div class="x-card"><div class="x-vazio">Nenhum aviso no mural agora.' + (E.coord ? " Publique o primeiro acima." : "") + "</div></div>") + (E.coord && exp.length ? '<p class="x-nota">' + exp.length + " aviso(s) vencido(s) saíram do mural. <button class=\"btn\" data-limpa>Apagar os vencidos</button></p>" : "") + "</div>";
  }
  function acoesMural(e) {
    var t = e.target, b;
    if ((b = t.closest("[data-lido]"))) { confirmar([b.getAttribute("data-lido")]); return; }
    if ((b = t.closest("[data-apaga]"))) { var id = b.getAttribute("data-apaga"); E.db.doc("hub_mural/" + id).delete().then(function () { E.mural = E.mural.filter(function (m) { return m.id !== id; }); desenhaSino(); renderMural(); }).catch(function () { toast("Não consegui apagar o aviso."); }); return; }
    if (t.closest("[data-limpa]")) { E.mural.filter(function (m) { return m.ate && m.ate < ymd(hoje()); }).forEach(function (m) { E.db.doc("hub_mural/" + m.id).delete().catch(function () {}); }); }
  }
  function enviaMural(e) {
    var f = e.target.closest("#xmForm"); if (!f) return; e.preventDefault();
    var t = doc.getElementById("mT").value.trim(), x = doc.getElementById("mX").value.trim(), dias = +doc.getElementById("mV").value;
    if (!t || !x) return;
    var id = "m" + Date.now().toString(36);
    var novo = {t: t, x: x, imp: doc.getElementById("mI").checked, autor: E.nome || "Coordenação", em: Date.now(), ate: dias ? ymd(addDias(hoje(), dias)) : ""};
    E.db.doc("hub_mural/" + id).set(novo).then(function () { if (!E.mural.some(function (m) { return m.id === id; })) E.mural.push(Object.assign({id: id}, novo)); desenhaSino(); renderMural(); toast("Aviso publicado."); }).catch(function () { toast("Não consegui publicar o aviso."); });
    f.reset();
  }

  /* ---------- módulo: Rotinas do escritório ---------- */
  var EXEMPLOS = [
    {t: "Habilitar uma empresa no Portal do Cliente", m: "DP / Portal", sub: "Habilitação no Domínio e e-mail ao cliente", p: ["Abrir a empresa no Domínio e conferir o cadastro", "Habilitar os módulos Onvio da empresa", "Registrar a habilitação na etapa do Portal", "Enviar e-mail ao cliente pedindo nome e e-mail de quem terá acesso", "Conferir se o cliente respondeu e cadastrar os usuários"]},
    {t: "Arquivar relatórios da folha por empresa", m: "DP", sub: "Pela empresa e competência que estão dentro do PDF", p: ["Identificar a empresa e a competência pelo conteúdo do PDF", "Escolher a estrutura ADIANTAMENTO ou FOLHA", "Renomear conforme o tipo de relatório", "Salvar na pasta da empresa", "Limpar a pasta de origem"]},
    {t: "Renomear e arquivar guias de FGTS e DARF", m: "DP", sub: "O tipo da guia vale pelo conteúdo, não pelo nome do arquivo", p: ["Abrir cada PDF e identificar o tipo real da guia", "Renomear conforme o padrão do tipo", "Achar a pasta da empresa pelo CNPJ", "Arquivar e conferir se não ficou nada solto"]},
    {t: "Fechamento mensal do Fiscal", m: "Fiscal", sub: "Antes do prazo interno do fechamento", p: ["Conferir pendências do cliente", "Apurar impostos da competência", "Marcar as etapas no módulo", "Enviar guias ao cliente", "Fechar a empresa"]}
  ];
  var feitas = {};
  function feitasDe() { feitas = ls("hub-rot-feitas-" + (E.me || "x"), {}); }
  function renderRotinas() {
    var raiz = E.raiz; if (!raiz || E.vista !== "rotinas") return;
    if (E.editando) return;
    feitasDe();
    var q = (E.rq || "").toLowerCase();
    var vis = E.rotinas.filter(function (r) { return !q || (r.t + " " + r.m + " " + r.sub).toLowerCase().indexOf(q) >= 0; });
    var aberto = {}; [].forEach.call(raiz.querySelectorAll("details.x-rot[open]"), function (d) { aberto[d.getAttribute("data-id")] = 1; });
    raiz.innerHTML = '<div class="xm"><div class="x-tools"><input type="text" id="rBusca" placeholder="Buscar rotina… (ex.: portal, fgts)" aria-label="Buscar rotina" value="' + esc(E.rq || "") + '" style="flex:1;min-width:200px">' + (E.coord ? '<button class="btn p" data-nova>Nova rotina</button>' : "") + '</div><div id="rLista" style="display:flex;flex-direction:column;gap:10px">' +
      (vis.map(function (r) {
        var f = feitas[r.id] || [], n = r.p.filter(function (_, i) { return f[i]; }).length;
        return '<details class="x-rot" data-id="' + esc(r.id) + '"' + (aberto[r.id] ? " open" : "") + "><summary><b>" + esc(r.t) + '</b><span class="x-pill">' + esc(r.m) + "</span>" + (r.ok ? "" : '<span class="x-pill warn">a conferir</span>') + '<span class="sp"></span><span class="x-prog"><i style="width:' + Math.round(n / Math.max(1, r.p.length) * 100) + '%"></i></span><span style="font:500 11.5px var(--mono,monospace);color:var(--ink-3)">' + n + "/" + r.p.length + '</span></summary><div class="sub">' + esc(r.sub) + "</div><ol>" + r.p.map(function (s, i) { return '<li class="' + (f[i] ? "f" : "") + '"><input type="checkbox" id="r-' + esc(r.id) + i + '" data-r="' + esc(r.id) + '" data-i="' + i + '"' + (f[i] ? " checked" : "") + '><label for="r-' + esc(r.id) + i + '">' + esc(s) + "</label></li>"; }).join("") + "</ol>" + (E.coord ? '<div class="x-tools" style="padding:0 14px 12px"><button class="btn" data-edita="' + esc(r.id) + '">Editar</button><button class="btn" data-zera="' + esc(r.id) + '">Desmarcar passos</button></div>' : '<div class="x-tools" style="padding:0 14px 12px"><button class="btn" data-zera="' + esc(r.id) + '">Desmarcar passos</button></div>') + "</details>";
      }).join("") || '<div class="x-card"><div class="x-vazio">' + (E.rotinas.length ? "Nenhuma rotina encontrada." : "Ainda não há rotinas cadastradas.") + "</div></div>") + "</div>" +
      (E.coord && !E.rotinas.length ? '<p class="x-nota">Para começar, dá para criar quatro rotinas de exemplo (habilitar Portal, arquivar folha, guias de FGTS e fechamento do Fiscal). Elas entram marcadas como “a conferir”: revise os passos antes de o time usar. <button class="btn" data-exemplos>Criar rotinas de exemplo</button></p>' : "") + "</div>";
    var bb = doc.getElementById("rBusca"); if (bb && E.rfoco) { bb.focus(); bb.setSelectionRange(bb.value.length, bb.value.length); }
  }
  function editor(r) {
    E.editando = r || {};
    var x = r || {t: "", m: "", sub: "", p: [], ok: false};
    E.raiz.innerHTML = '<div class="xm"><div class="x-card"><h3>' + (r ? "Editar rotina" : "Nova rotina") + '<span>cada linha é um passo</span></h3><div class="x-cb"><form id="rForm" style="display:flex;flex-direction:column;gap:10px"><input type="text" id="eT" placeholder="Nome da rotina" maxlength="90" required value="' + esc(x.t) + '" aria-label="Nome da rotina"><div class="x-tools"><input type="text" id="eM" placeholder="Setor (DP, Fiscal…)" maxlength="30" value="' + esc(x.m) + '" aria-label="Setor"><input type="text" id="eS" placeholder="Resumo" maxlength="140" value="' + esc(x.sub) + '" style="flex:1;min-width:200px" aria-label="Resumo"></div><textarea id="eP" placeholder="Um passo por linha" aria-label="Passos">' + esc(x.p.join("\n")) + '</textarea><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="eO"' + (x.ok ? " checked" : "") + '> Passos conferidos pela coordenação</label><div class="x-tools"><button class="btn p" type="submit">Salvar</button><button class="btn" type="button" data-cancela>Cancelar</button>' + (r ? '<button class="btn" type="button" data-exclui="' + esc(r.id) + '">Excluir rotina</button>' : "") + "</div></form></div></div></div>";
  }
  function acoesRotinas(e) {
    var t = e.target, b;
    if (t.closest("[data-nova]")) { editor(null); return; }
    if ((b = t.closest("[data-edita]"))) { editor(E.rotinas.filter(function (r) { return r.id === b.getAttribute("data-edita"); })[0]); return; }
    if (t.closest("[data-cancela]")) { E.editando = null; renderRotinas(); return; }
    if ((b = t.closest("[data-exclui]"))) { var id = b.getAttribute("data-exclui"); E.db.doc("hub_rotinas/" + id).delete().then(function () { E.rotinas = E.rotinas.filter(function (r) { return r.id !== id; }); E.editando = null; renderRotinas(); }); return; }
    if ((b = t.closest("[data-zera]"))) { feitas[b.getAttribute("data-zera")] = []; sv("hub-rot-feitas-" + (E.me || "x"), feitas); renderRotinas(); return; }
    if (t.closest("[data-exemplos]")) { EXEMPLOS.forEach(function (x, i) { var id = "ex" + (i + 1); E.db.doc("hub_rotinas/" + id).set({t: x.t, m: x.m, sub: x.sub, p: x.p, ok: false, em: Date.now()}).then(function () { if (!E.rotinas.some(function (r) { return r.id === id; })) { E.rotinas.push({id: id, t: x.t, m: x.m, sub: x.sub, p: x.p, ok: false, em: Date.now()}); renderRotinas(); } }); }); }
  }
  function mudaRotinas(e) {
    var t = e.target; if (!t.getAttribute) return;
    if (t.id === "rBusca") { E.rq = t.value; E.rfoco = true; renderRotinas(); E.rfoco = false; return; }
    if (t.getAttribute("data-r")) { var id = t.getAttribute("data-r"); feitasDe(); var a = feitas[id] = feitas[id] || []; a[+t.getAttribute("data-i")] = t.checked; sv("hub-rot-feitas-" + (E.me || "x"), feitas); renderRotinas(); }
  }
  function enviaRotina(e) {
    var f = e.target.closest("#rForm"); if (!f) return; e.preventDefault();
    var r = E.editando && E.editando.id ? E.editando : null, id = r ? r.id : "r" + Date.now().toString(36);
    var p = doc.getElementById("eP").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 40);
    if (!p.length) { toast("Escreva pelo menos um passo."); return; }
    var rr = {t: doc.getElementById("eT").value.trim(), m: doc.getElementById("eM").value.trim(), sub: doc.getElementById("eS").value.trim(), p: p, ok: doc.getElementById("eO").checked, em: Date.now()};
    E.db.doc("hub_rotinas/" + id).set(rr).then(function () { E.rotinas = E.rotinas.filter(function (x) { return x.id !== id; }).concat([Object.assign({id: id}, rr)]); E.editando = null; renderRotinas(); }).catch(function () { toast("Não consegui salvar a rotina."); });
  }

  /* ---------- módulo: Painel da coordenação ---------- */
  function pts(a) { return a.atr * 3 + a.cli + a.emp * 0.15 + a.fr * 0.3; }
  // Departamentos que esta pessoa enxerga no painel: o administrador vê todos; o gestor vê só os módulos em que é coordenador.
  function permitidos() {
    var h = H(), todos = ["dp", "contabil", "fiscal", "portal"], adm = h.cfg && h.cfg.ehAdmin ? h.cfg.ehAdmin() : true;
    return todos.filter(function (m) { return adm || (h.nivel ? h.nivel(m) === "coord" : true); });
  }
  function coletar() {
    var h = H(), hj = hoje(), perm = permitidos(), mods = (h.modulos ? h.modulos() : []).filter(function (m) { return perm.indexOf(m) !== -1; });
    return Promise.all(mods.map(function (m) { return Promise.resolve(h.carregar(m)).then(function (a) { return {m: m, a: a}; }).catch(function () { return {m: m, a: null}; }); })).then(function (res) {
      var por = {}, atr = [], atrL = [], venc = [], aus = [], exemplos = [], total = {emp: 0, atr: 0, cli: 0}, status = [];
      res.forEach(function (r) {
        var nm = MODN[r.m];
        if (!r.a) { status.push({m: nm, k: "erro", t: "não carregou"}); return; }
        if (r.a.exemplo && r.a.exemplo()) { exemplos.push(nm); status.push({m: nm, k: "aviso", t: "dados de exemplo, fora das contas"}); return; }
        if (r.a.pronto && !r.a.pronto()) { status.push({m: nm, k: "erro", t: "ainda carregando: use Atualizar"}); return; }
        try {
        var avisos = [], seguro = function (tipo, p) { try { return r.a.consultar(tipo, p); } catch (e) { avisos.push(tipo); return null; } };
        var c = seguro("carteira", {}), at = seguro("atrasos", {de: ymd(hj), ate: ymd(hj)}), v = seguro("vencimentos", {de: ymd(hj), ate: ymd(addDias(hj, 4))});
        ((c && c.linhas) || []).forEach(function (l) {
          var d = l.dados; if (!d || !d.analista || /^\(sem/.test(d.analista)) return;
          var k = d.analista.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).slice(0, 2).join(" "), q = por[k] = por[k] || {n: d.analista, mods: {}};
          var x = q.mods[r.m] = {emp: d.empresas || 0, atr: d.atrasadas || 0, cli: d.aguardandoCliente || 0, fr: d.frentes || 0};
          total.emp += x.emp; total.atr += x.atr; total.cli += x.cli;
        });
        if (at) { atr.push({m: r.m, n: at.total || (at.linhas || []).length}); ((at.linhas) || []).slice(0, 12).forEach(function (l) { atrL.push({m: r.m, t: l.t, s: l.sub, tom: l.tom}); }); }
        ((v && v.linhas) || []).filter(function (l) { return l.tom !== "ok"; }).forEach(function (l) { venc.push({m: r.m, t: l.t, s: l.sub, d: l.data || ""}); });
        if (r.m === "dp") { var au = seguro("ausencias", {de: ymd(hj), ate: ymd(addDias(hj, 14))}); aus = (au && au.linhas) || []; }
        var nEmp = 0; ((c && c.linhas) || []).forEach(function (l) { nEmp += (l.dados && l.dados.empresas) || 0; });
        status.push(nEmp ? {m: nm, k: avisos.length ? "aviso" : "ok", t: nEmp + " empresa(s)" + (avisos.length ? " (falhou: " + avisos.join(", ") + ")" : "")} : {m: nm, k: "aviso", t: "sem carteira por analista (a consulta não devolveu dados)"});
        } catch (e) { status.push({m: nm, k: "erro", t: "erro ao consultar (" + String(e && e.message || e).slice(0, 80) + ")"}); }
      });
      venc.sort(function (a, b) { return (a.d || "9").localeCompare(b.d || "9"); });
      return {por: Object.keys(por).map(function (k) { var q = por[k], s = {emp: 0, atr: 0, cli: 0, fr: 0}; Object.keys(q.mods).forEach(function (m) { ["emp", "atr", "cli", "fr"].forEach(function (c) { s[c] += q.mods[m][c]; }); }); return {n: q.n, mods: q.mods, s: s}; }), atr: atr, venc: venc.slice(0, 14), aus: aus, exemplos: exemplos, total: total, status: status, atrL: atrL};
    });
  }
  // Um cartão por setor, lado a lado, com os números de cada um e o atalho para o detalhe.
  function cartoesSetor(d) {
    var perm = permitidos();
    return '<div class="x-card"><h3>Por setor<span>todos os departamentos lado a lado · clique para ver o detalhe</span></h3><div class="x-cb"><div class="x-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">' + perm.map(function (m) {
      var nm = MODN[m], st = (d.status || []).filter(function (x) { return x.m === nm; })[0] || {k: "erro", t: "sem resposta"};
      var T = {emp: 0, atr: 0, cli: 0, an: 0}; d.por.forEach(function (a) { var x = a.mods[m]; if (x) { T.emp += x.emp; T.atr += x.atr; T.cli += x.cli; T.an++; } });
      var venc = d.venc.filter(function (v) { return v.m === m; }).length;
      return '<button type="button" data-ab="' + m + '" style="all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:8px;border:1px solid var(--rule);border-radius:4px;padding:12px 14px;background:var(--surface-2)" aria-label="Ver detalhes de ' + esc(nm) + '"><span style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font:600 14px var(--display,Archivo,sans-serif)">' + esc(nm) + '</b><span class="x-pill ' + (st.k === "ok" ? "ok" : st.k === "erro" ? "late" : "warn") + '">' + (st.k === "ok" ? "ok" : st.k === "erro" ? "sem dados" : "atenção") + '</span></span>' +
        '<span style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11.5px;color:var(--ink-3)"><span><b style="display:block;font:600 20px var(--mono,monospace);color:var(--ink)">' + T.emp + '</b>empresas</span><span><b style="display:block;font:600 20px var(--mono,monospace);color:' + (T.atr ? "var(--dp-late,#B3261E)" : "var(--ink)") + '">' + T.atr + '</b>atrasos</span><span><b style="display:block;font:600 20px var(--mono,monospace);color:' + (T.cli ? "var(--status-warn,#B5530C)" : "var(--ink)") + '">' + T.cli + '</b>com cliente</span></span>' +
        '<span style="font-size:11.5px;color:var(--ink-3)">' + T.an + " analista(s) · " + venc + " prazo(s) próximo(s)<br>" + esc(st.t) + "</span></button>";
    }).join("") + "</div></div></div>";
  }
  function renderGeral(d) {
    var ord = d.por.slice().sort(function (a, b) { return pts(b.s) - pts(a.s); }), mx = Math.max.apply(null, ord.map(function (a) { return pts(a.s); }).concat([1]));
    var mods = Object.keys(MODN).filter(function (m) { return d.por.some(function (a) { return a.mods[m]; }); });
    var h = cartoesSetor(d) + '<div class="x-grid x-g4"><div class="x-kpi"><b>' + d.total.emp + '</b><span>empresas na carteira (soma dos módulos)</span></div><div class="x-kpi late"><b>' + d.total.atr + '</b><span>atrasos e alertas</span></div><div class="x-kpi warn"><b>' + d.total.cli + '</b><span>aguardando o cliente</span></div><div class="x-kpi ok"><b>' + d.aus.length + "</b><span>ausência(s) de analistas nos próximos 14 dias</span></div></div>";
    h += '<div class="x-grid x-g2"><div class="x-card"><h3>Carga por analista<span>atrasos × 3 + aguardando cliente + empresas × 0,15 + frentes × 0,3</span></h3><div class="x-cb">' + (ord.map(function (a) { var p = pts(a.s); return '<div class="x-bar"><span>' + esc(a.n) + '</span><span class="t"><i class="' + (p > mx * .8 ? "s-late" : p > mx * .5 ? "s-warn" : "s-ok") + '" style="width:' + Math.max(2, Math.round(p / mx * 100)) + '%"></i></span><b>' + p.toFixed(1).replace(".", ",") + "</b></div>"; }).join("") || '<div class="x-vazio">Sem carteira por analista ainda.</div>') + "</div></div>";
    h += '<div class="x-card"><h3>Atrasos por módulo e analista<span>quem precisa de ajuda</span></h3><div class="x-cb x-sc"><table><thead><tr><th>Analista</th>' + mods.map(function (m) { return "<th>" + MODN[m] + "</th>"; }).join("") + "<th>Total</th></tr></thead><tbody>" + d.por.slice().sort(function (a, b) { return b.s.atr - a.s.atr; }).map(function (a) { return "<tr><td>" + esc(a.n) + "</td>" + mods.map(function (m) { var v = a.mods[m] ? a.mods[m].atr : 0; return "<td>" + (v ? '<span class="x-pill ' + (v >= 3 ? "late" : "warn") + '">' + v + "</span>" : '<span style="color:var(--ink-3)">0</span>') + "</td>"; }).join("") + "<td><b>" + a.s.atr + "</b></td></tr>"; }).join("") + "</tbody></table></div></div></div>";
    h += '<div class="x-grid x-g2"><div class="x-card"><h3>Prazos de hoje e dos próximos dias<span>pendentes, todos os módulos</span></h3><div class="x-cb x-sc"><table><tbody>' + (d.venc.map(function (v) { return '<tr><td style="white-space:nowrap">' + (v.d ? dmy(v.d).slice(0, 5) : "") + "</td><td><b>" + esc(v.t) + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(v.s || "") + '</div></td><td><span class="x-pill">' + MODN[v.m] + "</span></td></tr>"; }).join("") || '<tr><td class="x-vazio">Nada pendente nos próximos dias.</td></tr>') + "</tbody></table></div></div>";
    h += '<div class="x-card"><h3>Ausências e cobertura<span>Cartela do DP</span></h3><div class="x-cb x-sc"><table><tbody>' + (d.aus.map(function (a) { return "<tr><td><b>" + esc(a.t) + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(a.sub) + "</div></td><td>" + (a.tom === "warn" ? '<span class="x-pill warn">sem cobertura</span>' : "") + "</td></tr>"; }).join("") || '<tr><td class="x-vazio">Nenhuma ausência registrada.</td></tr>') + "</tbody></table></div></div></div>";
    if (d.exemplos.length) h += '<p class="x-nota">' + d.exemplos.join(", ") + " está com dados de exemplo e não entrou nas contas.</p>";
    return h;
  }
  function renderSetor(d, m) {
    var nm = MODN[m], st = (d.status || []).filter(function (x) { return x.m === nm; })[0];
    var rows = d.por.filter(function (a) { return a.mods[m]; }).map(function (a) { var x = a.mods[m]; return {n: a.n, emp: x.emp, atr: x.atr, cli: x.cli, fr: x.fr}; });
    var T = rows.reduce(function (t, r) { t.emp += r.emp; t.atr += r.atr; t.cli += r.cli; return t; }, {emp: 0, atr: 0, cli: 0});
    var p = function (r) { return r.atr * 3 + r.cli + r.emp * 0.15 + r.fr * 0.3; }, ord = rows.slice().sort(function (a, b) { return p(b) - p(a); }), mx = Math.max.apply(null, ord.map(p).concat([1]));
    var venc = d.venc.filter(function (v) { return v.m === m; }), itens = (d.atrL || []).filter(function (l) { return l.m === m; });
    var h = '<div class="x-tools" style="margin-bottom:2px">' + (st ? '<span class="x-pill ' + (st.k === "ok" ? "ok" : st.k === "erro" ? "late" : "warn") + '">' + esc(st.t) + "</span>" : "") + "</div>";
    h += '<div class="x-grid x-g4"><div class="x-kpi"><b>' + T.emp + '</b><span>empresas no ' + esc(nm) + '</span></div><div class="x-kpi late"><b>' + T.atr + '</b><span>atrasos e alertas</span></div><div class="x-kpi warn"><b>' + T.cli + '</b><span>aguardando o cliente</span></div><div class="x-kpi"><b>' + rows.length + '</b><span>analistas com carteira</span></div></div>';
    h += '<div class="x-grid x-g2"><div class="x-card"><h3>Carga por analista<span>' + esc(nm) + '</span></h3><div class="x-cb">' + (ord.map(function (r) { var v = p(r); return '<div class="x-bar"><span>' + esc(r.n) + '</span><span class="t"><i class="' + (v > mx * .8 ? "s-late" : v > mx * .5 ? "s-warn" : "s-ok") + '" style="width:' + Math.max(2, Math.round(v / mx * 100)) + '%"></i></span><b>' + r.emp + " emp. · " + r.atr + ' atr.</b></div>'; }).join("") || '<div class="x-vazio">Sem carteira por analista neste setor.</div>') + '</div></div>';
    h += '<div class="x-card"><h3>Itens atrasados e alertas<span>' + esc(nm) + '</span></h3><div class="x-cb x-sc"><table><tbody>' + (itens.map(function (l) { return "<tr><td><b>" + esc(l.t) + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(l.s || "") + "</div></td></tr>"; }).join("") || '<tr><td class="x-vazio">Nada atrasado neste setor. 👏</td></tr>') + "</tbody></table></div></div></div>";
    h += '<div class="x-grid x-g2"><div class="x-card"><h3>Prazos dos próximos dias<span>pendentes</span></h3><div class="x-cb x-sc"><table><tbody>' + (venc.map(function (v) { return '<tr><td style="white-space:nowrap">' + (v.d ? dmy(v.d).slice(0, 5) : "") + "</td><td><b>" + esc(v.t) + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(v.s || "") + "</div></td></tr>"; }).join("") || '<tr><td class="x-vazio">Nada pendente nos próximos dias.</td></tr>') + "</tbody></table></div></div>";
    h += m === "dp" ? '<div class="x-card"><h3>Ausências e cobertura<span>Cartela do DP</span></h3><div class="x-cb x-sc"><table><tbody>' + (d.aus.map(function (a) { return "<tr><td><b>" + esc(a.t) + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(a.sub) + "</div></td><td>" + (a.tom === "warn" ? '<span class="x-pill warn">sem cobertura</span>' : "") + "</td></tr>"; }).join("") || '<tr><td class="x-vazio">Nenhuma ausência registrada.</td></tr>') + "</tbody></table></div></div>" : "";
    return h + "</div>";
  }
  var LOGN = 7;
  function lerLog(dias) {
    var out = [], ps = [];
    for (var i = 0; i < dias; i++) (function (dia) { ps.push(E.db.doc("hub_log/" + dia).get().then(function (s) { var x = s && s.exists !== false && s.data ? s.data() || {} : {}; (x.itens || []).forEach(function (it) { out.push(Object.assign({dia: dia}, it)); }); }).catch(function () {})); })(ymd(addDias(hoje(), -i)));
    return Promise.all(ps).then(function () { return out.sort(function (a, b) { return (b.em || 0) - (a.em || 0); }); });
  }
  function renderLog(itens) {
    var f = E.logF = E.logF || {u: "", m: ""}, us = [], ms = [];
    itens.forEach(function (e) { if (us.indexOf(e.u) < 0) us.push(e.u); if (ms.indexOf(e.m) < 0) ms.push(e.m); });
    var vis = itens.filter(function (e) { return (!f.u || e.u === f.u) && (!f.m || e.m === f.m); });
    var sel = function (id, l, v, ph) { return '<select id="' + id + '" aria-label="' + ph + '"><option value="">' + ph + "</option>" + l.map(function (x) { return "<option" + (x === v ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>"; };
    return '<div class="x-card"><h3>Quem mudou o quê<span>' + vis.length + " de " + itens.length + " registros dos últimos " + LOGN + ' dias</span></h3><div class="x-cb"><div class="x-tools" style="margin-bottom:8px">' + sel("lU", us, f.u, "Todas as pessoas") + sel("lM", ms, f.m, "Todos os módulos") + '<button class="btn" data-mais-log>Ver mais ' + 7 + ' dias</button></div>' +
      (vis.slice(0, 200).map(function (e) { var d = new Date(e.em || 0); return '<div class="x-ev"><span class="h">' + (e.dia === ymd(hoje()) ? pad(d.getHours()) + ":" + pad(d.getMinutes()) : dmy(e.dia).slice(0, 5) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())) + '</span><div><b>' + esc(e.t) + '</b><div class="m">' + esc(e.u) + " · " + esc(e.m) + '</div></div></div>'; }).join("") || '<div class="x-vazio">Nenhum registro com esses filtros.</div>') + '</div></div><p class="x-nota">O registro guarda quem gravou, em qual módulo e quando, por 30 dias. Ele não guarda o valor anterior, então o desfazer continua sendo o do assistente (últimos pedidos) e o histórico de cada empresa.</p>';
  }

  /* ---------- relatório mensal por setor e por analista (copiar ou baixar) ---------- */
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var f1 = function (n) { return (Math.round(n * 10) / 10).toString().replace(".", ","); };
  // Monta o relatório como seções {h, cab, linhas}; o mesmo modelo vira tela, texto e planilha.
  function relatorio(d, setor, log) {
    var hj = hoje(), perm = permitidos(), mods = setor && perm.indexOf(setor) !== -1 ? [setor] : perm, nomes = mods.map(function (m) { return MODN[m]; });
    var ini = ymd(new Date(hj.getFullYear(), hj.getMonth(), 1)), sec = [], destaques = [];
    var okSt = function (m) { var st = (d.status || []).filter(function (x) { return x.m === MODN[m]; })[0]; return !st || st.k === "ok" || st.k === "aviso" && !/exemplo|ainda carregando|não carregou/.test(st.t); };
    var com = mods.filter(function (m) { return d.por.some(function (a) { return a.mods[m]; }); });
    var fora = mods.filter(function (m) { return com.indexOf(m) === -1; });
    var T = {emp: 0, atr: 0, cli: 0}, an = {};
    var linhasSetor = com.map(function (m) {
      var t = {emp: 0, atr: 0, cli: 0, an: 0}; d.por.forEach(function (a) { var x = a.mods[m]; if (x) { t.emp += x.emp; t.atr += x.atr; t.cli += x.cli; t.an++; an[a.n] = 1; } });
      T.emp += t.emp; T.atr += t.atr; T.cli += t.cli;
      var st = (d.status || []).filter(function (x) { return x.m === MODN[m]; })[0];
      return [MODN[m], t.emp, t.an, t.atr, t.cli, d.venc.filter(function (v) { return v.m === m; }).length, st ? st.t : ""];
    });
    var pessoas = d.por.map(function (a) {
      var tt = {emp: 0, atr: 0, cli: 0, fr: 0}, ms = [];
      com.forEach(function (m) { var x = a.mods[m]; if (x) { ms.push(MODN[m]); tt.emp += x.emp; tt.atr += x.atr; tt.cli += x.cli; tt.fr += x.fr; } });
      return ms.length ? {n: a.n, ms: ms, t: tt, p: pts(tt)} : null;
    }).filter(Boolean).sort(function (a, b) { return b.p - a.p; });
    var vencs = d.venc.filter(function (v) { return mods.indexOf(v.m) !== -1; });
    var atrs = (d.atrL || []).filter(function (l) { return mods.indexOf(l.m) !== -1; });
    var logM = (log || []).filter(function (e) { return e.dia >= ini && nomes.indexOf(e.m) !== -1 && !/^Desfez:/.test(e.t || ""); });
    var evo = null;
    try {
      var h0 = ls("tx-atrasos-v1", {}), ks = Object.keys(h0).filter(function (k) { return k >= ini && k < ymd(hj); }).sort();
      if (ks.length) { var a0 = 0; com.forEach(function (m) { a0 += +h0[ks[0]][m] || 0; }); evo = {de: ks[0], a0: a0}; }
    } catch (e) {}
    // destaques em frases
    if (pessoas.length) destaques.push([pessoas[0].n + " tem a maior carga (" + f1(pessoas[0].p) + " pontos; " + pessoas[0].t.atr + " atraso(s), " + pessoas[0].t.cli + " aguardando cliente)."]);
    var maisAtr = linhasSetor.slice().sort(function (a, b) { return b[3] - a[3]; })[0];
    if (maisAtr && maisAtr[3]) destaques.push(["O setor com mais atrasos é " + maisAtr[0] + " (" + maisAtr[3] + ")."]);
    if (T.cli) destaques.push([T.cli + " empresa(s)/frente(s) aguardando o cliente."]);
    if (d.aus && d.aus.length && mods.indexOf("dp") !== -1) destaques.push([d.aus.length + " ausência(s) de analistas nos próximos 14 dias (Cartela do DP)."]);
    if (evo) { var dlt = T.atr - evo.a0; destaques.push(["Atrasos: " + evo.a0 + " em " + dmy(evo.de) + " → " + T.atr + " hoje (" + (dlt > 0 ? "+" : "") + dlt + "). Histórico guardado neste navegador."]); }
    if (!destaques.length) destaques.push(["Sem pontos de atenção nos dados lidos."]);
    sec.push({h: "Destaques", cab: [], linhas: destaques});
    sec.push({h: "Resumo", cab: ["Indicador", "Valor"], linhas: [["Empresas na carteira (soma dos setores)", T.emp], ["Analistas", Object.keys(an).length], ["Atrasos e alertas hoje", d.atr.filter(function (x) { return mods.indexOf(x.m) !== -1; }).reduce(function (t, x) { return t + (x.n || 0); }, 0)], ["Aguardando o cliente", T.cli], ["Prazos nos próximos 5 dias", vencs.length], ["Alterações registradas no mês", logM.length]]});
    sec.push({h: "Por setor", cab: ["Setor", "Empresas", "Analistas", "Atrasos", "Aguardando cliente", "Prazos próximos", "Leitura dos dados"], linhas: linhasSetor});
    sec.push({h: "Por analista", cab: ["Analista", "Setores", "Empresas", "Atrasos", "Aguardando cliente", "Pontos de carga"], linhas: pessoas.map(function (a) { return [a.n, a.ms.join(" + "), a.t.emp, a.t.atr, a.t.cli, f1(a.p)]; })});
    if (atrs.length) sec.push({h: "Principais atrasos e alertas", cab: ["Setor", "Item", "Detalhe"], linhas: atrs.slice(0, 30).map(function (l) { return [MODN[l.m], l.t, l.s || ""]; })});
    if (vencs.length) sec.push({h: "Próximos prazos", cab: ["Setor", "Item", "Detalhe", "Data"], linhas: vencs.map(function (v) { return [MODN[v.m], v.t, v.s || "", v.d ? dmy(v.d) : ""]; })});
    if (mods.indexOf("dp") !== -1 && d.aus && d.aus.length) sec.push({h: "Ausências e cobertura (14 dias)", cab: ["Quem", "Período e cobertura"], linhas: d.aus.map(function (l) { return [l.t, l.sub || ""]; })});
    var pp = {}, ss = {}; logM.forEach(function (e) { pp[e.u] = (pp[e.u] || 0) + 1; ss[e.m] = (ss[e.m] || 0) + 1; });
    sec.push({h: "Movimentação no mês (registro de alterações)", cab: ["Quem / setor", "Alterações"], linhas: Object.keys(ss).sort(function (a, b) { return ss[b] - ss[a]; }).map(function (k) { return ["Setor " + k, ss[k]]; }).concat(Object.keys(pp).sort(function (a, b) { return pp[b] - pp[a]; }).slice(0, 10).map(function (k) { return [k, pp[k]]; }))});
    var notas = [];
    if (fora.length) notas.push("Fora do relatório (sem dados de carteira por analista): " + fora.map(function (m) { return MODN[m]; }).join(", ") + ".");
    if (d.exemplos && d.exemplos.length) notas.push("Dados de exemplo não entram nas contas: " + d.exemplos.join(", ") + ".");
    notas.push("Situação lida em " + pad(hj.getDate()) + "/" + pad(hj.getMonth() + 1) + " às " + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) + ". Alterações: registro dos últimos 30 dias, a partir de " + dmy(ini) + ".");
    return {titulo: "Relatório mensal — " + MESES[hj.getMonth()] + " de " + hj.getFullYear() + (mods.length === 1 ? " — " + MODN[mods[0]] : ""), sec: sec, notas: notas};
  }
  function relHtml(r, setor) {
    var perm = permitidos(), h = '<div class="x-tools" style="margin:0 0 10px">' + (perm.length > 1 ? '<label>Setor <select id="relS" aria-label="Setor do relatório"><option value="">Todos os setores</option>' + perm.map(function (m) { return '<option value="' + m + '"' + (setor === m ? " selected" : "") + ">" + esc(MODN[m]) + "</option>"; }).join("") + "</select></label>" : "") +
      '<button class="btn" data-rel-copia>Copiar texto</button><button class="btn" data-rel-baixa>Baixar planilha</button></div>';
    h += '<div class="x-card"><h3>' + esc(r.titulo) + "<span>pronto para copiar ou baixar</span></h3></div>";
    r.sec.forEach(function (x) {
      if (!x.cab.length) { h += '<div class="x-card"><h3>' + esc(x.h) + '</h3><div class="x-cb"><ul style="margin:0;padding-left:18px">' + x.linhas.map(function (l) { return "<li>" + esc(l[0]) + "</li>"; }).join("") + "</ul></div></div>"; return; }
      h += '<div class="x-card"><h3>' + esc(x.h) + '</h3><div class="x-cb x-sc"><table><thead><tr>' + x.cab.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + (x.linhas.map(function (l) { return "<tr>" + l.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") || '<tr><td colspan="' + x.cab.length + '">Nada a mostrar.</td></tr>') + "</tbody></table></div></div>";
    });
    return h + '<div class="x-nota">' + r.notas.map(esc).join("<br>") + "</div>";
  }
  function relTexto(r) {
    var o = [r.titulo, ""];
    r.sec.forEach(function (x) {
      o.push(x.h.toUpperCase());
      if (!x.cab.length) x.linhas.forEach(function (l) { o.push("• " + l[0]); });
      else if (x.cab.length === 2) x.linhas.forEach(function (l) { o.push("• " + l[0] + ": " + l[1]); });
      else x.linhas.forEach(function (l) { o.push("• " + l.map(function (c, i) { return c === "" ? "" : (i ? x.cab[i] + ": " : "") + c; }).filter(Boolean).join(" · ")); });
      o.push("");
    });
    return o.concat(r.notas).join("\n");
  }
  function relLinhas(r) {
    var o = [[r.titulo], []];
    r.sec.forEach(function (x) { o.push([x.h]); if (x.cab.length) o.push(x.cab); x.linhas.forEach(function (l) { o.push(l); }); o.push([]); });
    r.notas.forEach(function (n) { o.push([n]); });
    return o;
  }
  function copiaRel(t) {
    var ok = function () { toast("Relatório copiado."); }, vel = function () { try { var a = doc.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;left:-9999px"; doc.body.appendChild(a); a.select(); var k = doc.execCommand("copy"); a.remove(); if (k) ok(); else toast("Não consegui copiar."); } catch (e) { toast("Não consegui copiar."); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, vel); return; } } catch (e) {}
    vel();
  }
  function baixaRel(r) {
    var linhas = relLinhas(r), nome = "relatorio-" + ymd(hoje()) + (E.relSetor ? "-" + E.relSetor : "");
    var salva = function (n, blob) {
      var fim = function (d) { if (d) return d.save({filename: n, data: blob}).then(function () { toast("Planilha baixada."); }, function () { toast("Não consegui baixar."); }); try { var a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = n; doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast("Planilha baixada."); } catch (e) { toast("Não consegui baixar."); } };
      try { return window.claude.use("downloads").then(fim, function () { fim(null); }); } catch (e) { fim(null); }
    };
    if (window.XLSX && window.XLSX.utils) {
      try { var ws = XLSX.utils.aoa_to_sheet(linhas), wb = XLSX.utils.book_new(); ws["!cols"] = [{wch: 34}, {wch: 26}, {wch: 14}, {wch: 14}, {wch: 18}, {wch: 16}, {wch: 40}]; XLSX.utils.book_append_sheet(wb, ws, "Relatório"); salva(nome + ".xlsx", new Blob([XLSX.write(wb, {type: "array", bookType: "xlsx"})], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})); return; } catch (e) {}
    }
    var csv = "﻿" + linhas.map(function (r2) { return r2.map(function (c) { c = String(c == null ? "" : c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n");
    salva(nome + ".csv", new Blob([csv], {type: "text/csv;charset=utf-8"}));
  }

  /* ---------- erros de tela (só administrador) ---------- */
  function lerErros(dias) {
    var ps = [], out = [];
    for (var i = 0; i < dias; i++) (function (dia) { ps.push(E.db.doc("hub_erros/" + dia).get().then(function (s) { var x = s && s.exists !== false && s.data ? s.data() || {} : {}; (x.itens || []).forEach(function (it) { out.push(Object.assign({dia: dia}, it)); }); }).catch(function () {})); })(ymd(addDias(hoje(), -i)));
    return Promise.all(ps).then(function () {
      var por = {}; out.forEach(function (e) { var k = e.k || (e.m + "|" + e.t + "|" + e.a), q = por[k] = por[k] || {k: k, m: e.m, t: e.t, a: e.a, c: 0, em: 0, us: [], nv: [], dias: {}}; q.c += e.c || 1; q.em = Math.max(q.em, e.em || 0); (e.us || []).forEach(function (u) { if (q.us.indexOf(u) < 0) q.us.push(u); }); (e.nv || []).forEach(function (n) { if (q.nv.indexOf(n) < 0) q.nv.push(n); }); q.dias[e.dia] = 1; });
      return Object.keys(por).map(function (k) { return por[k]; }).sort(function (a, b) { return b.em - a.em; });
    });
  }
  function renderErros(l) {
    var quando = function (t) { var d = new Date(t); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    var nomeMod = function (m) { return MODN[m] || (m ? m : "Hub"); };
    return '<div class="x-card"><h3>Erros de tela<span>o que quebrou no navegador de alguém · últimos 14 dias · ' + l.length + ' tipo(s)</span></h3><div class="x-cb x-sc">' + (l.length ? '<table><thead><tr><th>Último</th><th>Onde</th><th>Mensagem</th><th>Vezes</th><th>Quem</th><th>Navegador</th></tr></thead><tbody>' + l.slice(0, 80).map(function (e) { return "<tr><td>" + quando(e.em) + "</td><td>" + esc(nomeMod(e.m)) + (e.a ? '<br><small>' + esc(e.a) + "</small>" : "") + "</td><td>" + esc(e.t) + "</td><td>" + e.c + "</td><td>" + esc(e.us.slice(0, 3).join(", ")) + (e.us.length > 3 ? " +" + (e.us.length - 3) : "") + "</td><td>" + esc(e.nv.slice(0, 2).join(", ")) + "</td></tr>"; }).join("") + "</tbody></table>" : '<div class="x-vazio">Nenhum erro registrado nos últimos 14 dias. 🎉</div>') + '</div></div>' +
      '<div class="x-tools"><button class="btn" data-erros-copia>Copiar para o suporte</button><button class="btn" data-erros-limpa>Limpar registros</button><button class="btn" data-atualiza>Atualizar</button></div><div class="x-nota">Só erros que o navegador reporta (falhas de código e promessas rejeitadas). Mensagens de rede bloqueada e avisos sem importância são ignorados. O mesmo erro, na mesma tela, é contado uma vez por 10 minutos por aparelho.</div>';
  }

  /* ---------- minhas últimas alterações (com Desfazer) ---------- */
  function altModos() { var m = E.altModo || "minhas"; return '<div class="x-tools" style="margin-bottom:10px"><button class="btn' + (m === "minhas" ? " btn-primary" : "") + '" data-alt-modo="minhas">Minhas alterações</button><button class="btn' + (m === "equipe" ? " btn-primary" : "") + '" data-alt-modo="equipe">Toda a equipe</button></div>'; }
  function renderMinhas() {
    var D = H().desfazer, l = D ? D.lista() : [];
    var hora = function (t) { var d = new Date(t), h = ymd(hoje()) === ymd(d) ? "hoje" : pad(d.getDate()) + "/" + pad(d.getMonth() + 1); return h + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    return altModos() + '<div class="x-card"><h3>Minhas últimas alterações<span>as últimas 15 gravações feitas por você neste navegador, até 20 h · Ctrl+Z desfaz a última</span></h3><div class="x-cb x-sc">' +
      (l.length ? '<table><thead><tr><th>Quando</th><th>Onde</th><th>O que mudou</th><th></th></tr></thead><tbody>' + l.map(function (e, i) { return "<tr><td>" + hora(e.em) + "</td><td>" + esc(e.m) + "</td><td>" + esc(e.t) + '</td><td><button class="btn" data-minha-desfaz="' + i + '">Desfazer</button></td></tr>'; }).join("") + "</tbody></table>" : '<div class="x-vazio">Nada para desfazer por enquanto. As alterações que você gravar aparecem aqui.</div>') +
      '</div></div><div class="x-nota">Só desfaz o que você mesmo gravou. Se o registro foi alterado depois (por você ou por outra pessoa), o Hub avisa antes de desfazer. Gravações em lote, como importações, não entram na lista.</div>';
  }

  /* ---------- toda a equipe: o que cada pessoa mexeu (com ponto de restauração para o administrador) ---------- */
  function lerRestauros() {
    return Promise.resolve(E.db.collection("hub_restauro").get()).then(function (s) { return (s.docs || []).map(function (d) { return Object.assign({id: d.id}, d.data() || {}); }); }).catch(function () { return []; });
  }
  function carregaEquipe() {
    return Promise.all([lerLog(31), lerRestauros()]).then(function (r) {
      var log = r[0], res = r[1], usados = {}, adm = H().cfg && H().cfg.ehAdmin && H().cfg.ehAdmin(), ok = permitidos().map(function (m) { return MODN[m]; });
      // limpa pontos com mais de 7 dias (só o administrador)
      if (adm) res.filter(function (x) { return (x.em || 0) < Date.now() - 7 * 864e5; }).forEach(function (x) { E.db.doc("hub_restauro/" + x.id).delete().catch(function () {}); });
      var lista = log.filter(function (e) { return adm || ok.indexOf(e.m) !== -1; }).map(function (e) {
        var melhor = null; res.forEach(function (x) { if (usados[x.id] || x.u !== e.u || x.t !== e.t || Math.abs((x.em || 0) - (e.em || 0)) > 120000) return; if (!melhor || Math.abs(x.em - e.em) < Math.abs(melhor.em - e.em)) melhor = x; });
        if (melhor) usados[melhor.id] = 1;
        return Object.assign({}, e, {rest: melhor});
      });
      E.altEquipe = lista; return lista;
    });
  }
  function renderEquipe(lista) {
    var f = E.altF = E.altF || {u: "", m: "", q: ""}, adm = H().cfg && H().cfg.ehAdmin && H().cfg.ehAdmin(), us = [], ms = [];
    lista.forEach(function (e) { if (us.indexOf(e.u) < 0) us.push(e.u); if (ms.indexOf(e.m) < 0) ms.push(e.m); });
    var q = (f.q || "").toLowerCase(), vis = lista.filter(function (e) { return (!f.u || e.u === f.u) && (!f.m || e.m === f.m) && (!q || (e.t + " " + e.u).toLowerCase().indexOf(q) >= 0); });
    var sel = function (id, l, v, ph) { return '<select id="' + id + '" aria-label="' + ph + '"><option value="">' + ph + "</option>" + l.map(function (x) { return '<option' + (x === v ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>"; };
    var quando = function (t) { var d = new Date(t || 0); return (ymd(d) === ymd(hoje()) ? "hoje" : pad(d.getDate()) + "/" + pad(d.getMonth() + 1)) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    var acao = function (e) {
      if (!e.rest) return '<span class="x-dim" title="Sem ponto de restauração: gravação em lote, registro grande ou feita antes desta versão">—</span>';
      if (e.rest.desfeito) return '<span class="x-dim">desfeito' + (e.rest.desfeitoPor ? " por " + esc(e.rest.desfeitoPor) : "") + "</span>";
      if (e.rest.semAntes) return '<span class="x-dim" title="Registro grande demais">sem restauração</span>';
      return adm ? '<button class="btn" data-eq-desfaz="' + esc(e.rest.id) + '">Desfazer</button>' : '<span class="x-dim">pode ser desfeito pelo administrador</span>';
    };
    return '<div class="x-tools" style="margin-bottom:10px">' + sel("eqU", us, f.u, "Todas as pessoas") + sel("eqM", ms, f.m, "Todos os módulos") + '<input type="text" id="eqQ" placeholder="Buscar no texto…" value="' + esc(f.q || "") + '" aria-label="Buscar"><span class="x-dim">' + vis.length + " de " + lista.length + "</span></div>" +
      '<div class="x-card"><h3>Alterações de toda a equipe<span>quem mexeu no quê · últimos 30 dias' + (adm ? " · você, administrador, pode desfazer o que tiver ponto de restauração (7 dias)" : "") + '</span></h3><div class="x-cb x-sc">' +
      (vis.length ? '<table><thead><tr><th>Quando</th><th>Quem</th><th>Onde</th><th>O que mudou</th><th></th></tr></thead><tbody>' + vis.slice(0, 200).map(function (e) { return "<tr><td>" + quando(e.em) + "</td><td>" + esc(e.u) + "</td><td>" + esc(e.m) + "</td><td>" + esc(e.t) + "</td><td>" + acao(e) + "</td></tr>"; }).join("") + "</tbody></table>" : '<div class="x-vazio">Nenhuma alteração com esses filtros.</div>') + "</div></div>" +
      '<div class="x-nota">O ponto de restauração guarda o registro como estava antes de cada gravação (até 150 KB) por 7 dias. Se o registro foi alterado depois, o Hub avisa antes de desfazer. Gravações em lote (importações) e alterações anteriores a esta versão não têm ponto de restauração.</div>';
  }

  /* ---------- linha do tempo por empresa ---------- */
  var ETAPA_L = {habilitacaoDominio: "Habilitação no Domínio", treinamentoAnalista: "Treinamento do analista", treinamentoCliente: "Treinamento dos clientes", cadastroUsuario: "Cadastro do usuário do cliente", alinhamento: "Alinhamento com o gestor"};
  var ST_L = {pendente: "Pendente", agendado: "Agendado", andamento: "Em andamento", concluido: "Concluído"};
  var SET_L = {pessoal: "Pessoal", contabil: "Contábil", fiscal: "Fiscal"};
  function nrm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function lerCol(c) { return Promise.resolve(E.db.collection(c).get()).then(function (s) { return (s.docs || []).map(function (d) { return Object.assign({id: d.id}, d.data() || {}); }); }).catch(function () { return []; }); }
  function lerEmpresasTl() {
    return Promise.all([lerCol("empresas"), lerCol("dp_empresas")]).then(function (r) {
      var mapa = {}; r[0].concat(r[1]).forEach(function (e) { var n = e.nome || e.razao || e.razaoSocial || ""; if (n && !mapa[nrm(n)]) mapa[nrm(n)] = n; });
      return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    });
  }
  function frase(e) {
    var s = e.setor ? SET_L[e.setor] || e.setor : "", p = ST_L[e.para] || e.para || "", d = ST_L[e.de] || "";
    var mud = p ? ": " + (d && d !== p ? d + " → " : "") + p : "";
    switch (e.tipo) {
      case "etapa": return [ETAPA_L[e.item] || e.item || "Etapa", mud, s ? " · " + s : ""].join("");
      case "alinhamento": return "Alinhamento com o gestor" + (s ? " · " + s : "") + mud;
      case "setor": return "Setor " + s + (e.para === "removido" ? " removido da empresa" : " adicionado à empresa");
      case "empresa": return "Empresa cadastrada";
      case "contato": return "Contato cadastrado: " + (e.nome || "");
      case "treino-contato": return "Treinamento de " + (e.nome || "contato") + mud;
      case "cadastro-contato": return "Cadastro no Onvio de " + (e.nome || "contato") + mud;
      case "treino-func": return "Treinamento de " + (e.nome || "funcionário") + " (equipe)" + mud;
      case "impedimento": return (e.para === "removido" ? "Impedimento resolvido" : "Impedimento registrado") + (e.texto ? ": " + e.texto : "") + (e.resolucao ? " · como: " + e.resolucao : "");
      default: return e.texto || e.tipo || "Atividade";
    }
  }
  function carregaTempo(nome) {
    var n = nrm(nome);
    return Promise.all([lerCol("historico"), lerLog(60), lerCol("empresas"), lerCol("contatos"), lerCol("funcionarios")]).then(function (r) {
      var ids = {}; r[2].forEach(function (e) { if (nrm(e.nome) === n) ids[e.id] = e; });
      var ev = [];
      r[0].forEach(function (d) { (d.eventos || []).forEach(function (e) {
        if (e.tipo === "acesso" || e.tipo === "acesso-contato") return;
        if (!(e.empresaId && ids[e.empresaId]) && nrm(e.empresaNome) !== n) return;
        var t = Date.parse(e.em || ""); if (isNaN(t)) return;
        ev.push({em: t, k: "portal", ic: "◆", t: frase(e), u: e.por ? "" : "", m: "Portal"});
      }); });
      r[1].forEach(function (e) { if (nrm(e.t).indexOf(n) >= 0) ev.push({em: e.em || 0, k: "hub", ic: "✎", t: e.t, u: e.u, m: e.m}); });
      var emp = null; Object.keys(ids).forEach(function (k) { emp = emp || ids[k]; });
      var prox = [], hojeS = ymd(hoje());
      r[3].forEach(function (c) { if (ids[c.empresaId] && c.statusTreinamento === "agendado" && c.agendadoPara) prox.push({d: c.agendadoPara, h: c.agendadoHora || "", t: "Treinamento de " + (c.nome || "contato") + (c.agendadoPara < hojeS ? " (atrasado)" : ""), atraso: c.agendadoPara < hojeS}); });
      if (emp && emp.focoPrazo) prox.push({d: emp.focoPrazo, h: "", t: "Prazo da empresa em foco", atraso: emp.focoPrazo < hojeS});
      var imp = emp && emp.impedimento && emp.impedimento.ativo ? emp.impedimento : null;
      var proxAcao = emp && emp.focoProxAcao ? emp.focoProxAcao + (emp.focoAguardando ? " (" + emp.focoAguardando + ")" : "") : "";
      var ctt = r[3].filter(function (c) { return ids[c.empresaId]; }).length;
      prox.sort(function (a, b) { return (a.d + a.h).localeCompare(b.d + b.h); });
      ev.sort(function (a, b) { return b.em - a.em; });
      return {nome: nome, ev: ev, prox: prox, imp: imp, proxAcao: proxAcao, foco: !!(emp && emp.emFoco), contatos: ctt};
    });
  }
  function renderTempo() {
    var T = E.tempo || {}, nomes = T.nomes || [], q = T.q || "", m = T.m;
    var f = T.f || "";
    var bar = '<div class="x-tools"><input type="text" id="tlQ" list="tlNomes" placeholder="Digite o nome da empresa…" value="' + esc(q) + '" aria-label="Empresa" style="flex:1;min-width:220px"><datalist id="tlNomes">' + nomes.slice(0, 400).map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + '</datalist><button class="btn p" data-tl-ver>Ver linha do tempo</button></div>';
    if (!m) return bar + '<div class="x-vazio">Escolha uma empresa para ver tudo o que aconteceu com ela: etapas do Portal, treinamentos, contatos e alterações feitas no Hub, em ordem.</div>';
    if (m.carregando) return bar + '<div class="x-vazio">Montando a linha do tempo…</div>';
    if (m.erro) return bar + '<div class="x-nota">Não consegui montar a linha do tempo. <button class="btn" data-tl-ver>Tentar de novo</button></div>';
    var quando = function (t) { var d = new Date(t); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    var vis = m.ev.filter(function (e) { return !f || e.k === f; });
    var chip = function (v, r) { return '<button class="btn' + (f === v ? " p" : "") + '" data-tl-f="' + v + '">' + r + "</button>"; };
    var topo = '<div class="x-card"><h3>' + esc(m.nome) + '<span>' + m.contatos + " contato(s)" + (m.foco ? " · em foco" : "") + '</span></h3><div class="x-cb">' +
      (m.proxAcao ? '<p><b>Próxima ação:</b> ' + esc(m.proxAcao) + "</p>" : "") +
      (m.imp ? '<p><b>Impedimento:</b> ' + esc(m.imp.descricao || "") + (m.imp.desde ? " (desde " + dmy(m.imp.desde) + ")" : "") + "</p>" : "") +
      (m.prox.length ? "<p><b>Próximos passos:</b></p>" + m.prox.slice(0, 8).map(function (p) { return '<div class="x-ev"><span class="h">' + dmy(p.d) + (p.h ? " " + esc(p.h) : "") + "</span><div" + (p.atraso ? ' style="color:var(--red,#c0392b)"' : "") + "><b>" + esc(p.t) + "</b></div></div>"; }).join("") : '<p class="x-dim">Nada agendado.</p>') +
      "</div></div>";
    var lista = '<div class="x-card"><h3>Histórico<span>' + vis.length + " de " + m.ev.length + ' registros</span></h3><div class="x-cb"><div class="x-tools" style="margin-bottom:8px">' + chip("", "Tudo") + chip("portal", "Portal") + chip("hub", "Alterações no Hub") + "</div>" +
      (vis.slice(0, 300).map(function (e) { return '<div class="x-ev"><span class="h">' + quando(e.em) + "</span><div><b>" + esc(e.ic + " " + e.t) + "</b>" + (e.u || e.m ? '<div class="m">' + esc([e.u, e.m].filter(Boolean).join(" · ")) + "</div>" : "") + "</div></div>"; }).join("") || '<div class="x-vazio">Nenhum registro para essa empresa.</div>') +
      '</div></div><p class="x-nota">Reúne o registro de atividades do Portal e as alterações do Hub (últimos 60 dias) que citam o nome da empresa.</p>';
    return bar + topo + lista;
  }
  function repintaTempo(foco) { var c = E.raiz && E.raiz.querySelector("#xmCorpo"); if (!c || E.vista !== "coord" || E.aba.coord !== "tempo") return; c.innerHTML = renderTempo(); if (foco) { var n = c.querySelector("#tlQ"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } }
  function verTempo(nome) {
    var T = E.tempo = E.tempo || {}; var ex0 = (T.nomes || []).filter(function (x) { return nrm(x) === nrm(nome); })[0]; if (ex0) nome = ex0; T.q = nome; if (!nome) return;
    T.m = {carregando: true}; repintaTempo();
    carregaTempo(nome).then(function (m) { if (E.tempo === T && T.q === nome) { T.m = m; repintaTempo(); } }).catch(function () { if (E.tempo === T) { T.m = {erro: true}; repintaTempo(); } });
  }
  function abasCoord() {
    var perm = permitidos(), l = [];
    if (perm.length > 1) l.push(["geral", "Visão geral"]);
    perm.forEach(function (m) { l.push([m, MODN[m]]); });
    l.push(["rel", "Relatório"]);
    l.push(["tempo", "Linha do tempo"]);
    l.push(["minhas", "Minhas alterações"]);
    if (H().cfg && H().cfg.ehAdmin && H().cfg.ehAdmin()) l.push(["erros", "Erros de tela"]);
    l.push(["log", "Registro de alterações"]);
    return l;
  }
  function pintaCoord() {
    var corpo = E.raiz.querySelector("#xmCorpo"), aba = E.aba.coord, d = E.dadosCoord;
    if (!corpo) return;
    if (aba === "tempo") { var T0 = E.tempo = E.tempo || {}; corpo.innerHTML = renderTempo(); if (!T0.nomes) lerEmpresasTl().then(function (l) { T0.nomes = l; if (E.tempo === T0) { var dl = E.raiz && E.raiz.querySelector("#tlNomes"); if (dl) dl.innerHTML = l.slice(0, 400).map(function (x) { return '<option value="' + esc(x) + '">'; }).join(""); } }); return; }
    if (aba === "minhas" && E.altModo === "equipe") { corpo.innerHTML = altModos() + '<div class="x-vazio">Carregando…</div>'; carregaEquipe().then(function (l) { if (E.vista === "coord" && E.aba.coord === "minhas" && E.altModo === "equipe") corpo.innerHTML = altModos() + renderEquipe(l); }).catch(function () { corpo.innerHTML = altModos() + '<div class="x-nota">Não consegui ler as alterações. <button class="btn" data-atualiza>Tentar de novo</button></div>'; }); return; }
    if (aba === "minhas") { corpo.innerHTML = renderMinhas(); if (!E.ligouDesfazer && H().desfazer && H().desfazer.aoMudar) { E.ligouDesfazer = true; H().desfazer.aoMudar(function () { if (E.vista === "coord" && E.aba.coord === "minhas") { var c = E.raiz && E.raiz.querySelector("#xmCorpo"); if (c) c.innerHTML = renderMinhas(); } }); } return; }
    if (aba === "erros") { corpo.innerHTML = '<div class="x-vazio">Carregando…</div>'; lerErros(14).then(function (l) { E.errosLista = l; if (E.vista === "coord" && E.aba.coord === "erros") corpo.innerHTML = renderErros(l); }).catch(function () { corpo.innerHTML = '<div class="x-nota">Não consegui ler os erros. <button class="btn" data-atualiza>Tentar de novo</button></div>'; }); return; }
    if (aba === "log") { corpo.innerHTML = '<div class="x-vazio">Carregando…</div>'; lerLog(LOGN).then(function (it) { var adm = H().cfg && H().cfg.ehAdmin && H().cfg.ehAdmin(), ok = permitidos().map(function (m) { return MODN[m]; }); E.logItens = adm ? it : it.filter(function (e) { return ok.indexOf(e.m) !== -1; }); if (E.vista === "coord" && E.aba.coord === "log") corpo.innerHTML = renderLog(E.logItens); }); return; }
    if (!d) { corpo.innerHTML = '<div class="x-vazio">Carregando…</div>'; return; }
    if (aba === "rel") { corpo.innerHTML = '<div class="x-vazio">Montando o relatório…</div>'; lerLog(31).then(function (it) { var adm = H().cfg && H().cfg.ehAdmin && H().cfg.ehAdmin(); if (E.vista !== "coord" || E.aba.coord !== "rel") return; E.relModelo = relatorio(d, E.relSetor || "", adm ? it : it.filter(function (e) { return permitidos().map(function (m) { return MODN[m]; }).indexOf(e.m) !== -1; })); corpo.innerHTML = relHtml(E.relModelo, E.relSetor || "") + '<div class="x-tools"><button class="btn" data-atualiza>Atualizar</button></div>'; }).catch(function () { corpo.innerHTML = '<div class="x-nota">Não consegui montar o relatório. <button class="btn" data-atualiza>Tentar de novo</button></div>'; }); return; }
    corpo.innerHTML = (aba === "geral" ? renderGeral(d) : renderSetor(d, aba)) + '<div class="x-tools"><button class="btn" data-atualiza>Atualizar</button></div>';
  }
  function carregaCoord() {
    coletar().catch(function (e) { var c = E.raiz && E.raiz.querySelector("#xmCorpo"); if (c) c.innerHTML = '<div class="x-nota">Não consegui ler os dados dos módulos: ' + esc(e && e.message || e) + ' <button class="btn" data-atualiza>Tentar de novo</button></div>'; return null; }).then(function (d) {
      if (!d) return;
      E.dadosCoord = d; if (E.vista === "coord" && E.aba.coord !== "log") pintaCoord();
      var pend = (d.status || []).some(function (x) { return x.k === "erro"; }); E.tent = pend ? (E.tent || 0) + 1 : 0;
      if (pend && E.tent <= 3) setTimeout(function () { if (E.vista === "coord") carregaCoord(); }, 8000);
    });
  }
  function montaCoord(raiz, recarrega) {
    var abas = abasCoord(); if (!abas.some(function (a) { return a[0] === E.aba.coord; })) E.aba.coord = abas[0][0];
    raiz.innerHTML = '<div class="xm"><div class="x-abas" role="tablist">' + abas.map(function (a) { return '<button role="tab" data-ab="' + a[0] + '" aria-selected="' + (E.aba.coord === a[0]) + '">' + esc(a[1]) + "</button>"; }).join("") + '</div><div id="xmCorpo"></div></div>';
    if (recarrega !== false || !E.dadosCoord) { E.dadosCoord = recarrega === false ? E.dadosCoord : null; carregaCoord(); }
    pintaCoord();
  }
  function acoesCoord(e) {
    var t = e.target, b;
    if ((b = t.closest("[data-ab]"))) { E.aba.coord = b.getAttribute("data-ab"); montaCoord(E.raiz, false); return; }
    if (t.closest("[data-atualiza]")) { E.tent = 0; montaCoord(E.raiz, true); return; }
    if (t.closest("[data-tl-ver]")) { var qi = E.raiz.querySelector("#tlQ"); verTempo(qi ? qi.value.trim() : ""); return; }
    if ((b = t.closest("[data-tl-f]"))) { E.tempo.f = b.getAttribute("data-tl-f"); repintaTempo(); return; }
    if ((b = t.closest("[data-alt-modo]"))) { E.altModo = b.getAttribute("data-alt-modo"); pintaCoord(); return; }
    if ((b = t.closest("[data-eq-desfaz]"))) { var rid = b.getAttribute("data-eq-desfaz"), reg = (E.altEquipe || []).map(function (x) { return x.rest; }).filter(function (x) { return x && x.id === rid; })[0], D2 = H().desfazer; if (reg && D2 && D2.restaurar) { b.disabled = true; Promise.resolve(D2.restaurar(reg)).then(function (ok) { if (ok) { reg.desfeito = true; var c = E.raiz && E.raiz.querySelector("#xmCorpo"); if (c && E.altModo === "equipe") c.innerHTML = altModos() + renderEquipe(E.altEquipe || []); } else b.disabled = false; }); } return; }
    if ((b = t.closest("[data-minha-desfaz]"))) { var D = H().desfazer; if (D) { var pr = D.fazer(+b.getAttribute("data-minha-desfaz")); Promise.resolve(pr).then(function () { var c = E.raiz && E.raiz.querySelector("#xmCorpo"); if (c && E.aba.coord === "minhas") c.innerHTML = renderMinhas(); }); } return; }
    if (t.closest("[data-erros-copia]")) { var el = E.errosLista || []; copiaRel("Erros de tela (Control Hub) — " + pad(hoje().getDate()) + "/" + pad(hoje().getMonth() + 1) + "\n\n" + (el.length ? el.slice(0, 30).map(function (e) { return "• " + (MODN[e.m] || e.m || "Hub") + (e.a ? " (" + e.a + ")" : "") + " — " + e.t + " — " + e.c + "x, " + e.us.slice(0, 3).join(", ") + ", " + e.nv.slice(0, 2).join(", "); }).join("\n") : "Nenhum erro registrado.")); return; }
    if ((b = t.closest("[data-erros-limpa]"))) { if (!b.getAttribute("data-sim")) { b.setAttribute("data-sim", "1"); b.textContent = "Clique de novo para apagar tudo"; setTimeout(function () { if (b.isConnected) { b.removeAttribute("data-sim"); b.textContent = "Limpar registros"; } }, 4000); return; } var ps = []; for (var i = 0; i < 32; i++) ps.push(E.db.doc("hub_erros/" + ymd(addDias(hoje(), -i))).delete().catch(function () {})); Promise.all(ps).then(function () { E.errosLista = []; toast("Registros de erros apagados."); montaCoord(E.raiz, false); }); return; }
    if (t.closest("[data-rel-copia]")) { if (E.relModelo) copiaRel(relTexto(E.relModelo)); return; }
    if (t.closest("[data-rel-baixa]")) { if (E.relModelo) baixaRel(E.relModelo); return; }
    if (t.closest("[data-mais-log]")) { LOGN += 7; montaCoord(E.raiz, false); }
  }
  function mudaCoord(e) { if (e.target.id === "tlQ") { verTempo(e.target.value.trim()); return; } if (e.target.id === "eqU" || e.target.id === "eqM") { E.altF = E.altF || {u: "", m: "", q: ""}; E.altF[e.target.id === "eqU" ? "u" : "m"] = e.target.value; var c0 = E.raiz.querySelector("#xmCorpo"); if (c0) c0.innerHTML = altModos() + renderEquipe(E.altEquipe || []); return; } if (e.target.id === "relS") { E.relSetor = e.target.value; pintaCoord(); return; } var m = {lU: "u", lM: "m"}[e.target.id]; if (m) { E.logF[m] = e.target.value; var c = E.raiz.querySelector("#xmCorpo"); if (c) c.innerHTML = renderLog(E.logItens || []); } }

  /* ---------- montagem dos módulos ---------- */
  var ligado = false;
  function ligaEventos(raiz) {
    if (ligado) return; ligado = true;
    raiz.addEventListener("click", function (e) { if (E.vista === "mural") acoesMural(e); else if (E.vista === "rotinas") acoesRotinas(e); else if (E.vista === "coord") acoesCoord(e); });
    raiz.addEventListener("change", function (e) { if (E.vista === "rotinas") mudaRotinas(e); else if (E.vista === "coord") mudaCoord(e); });
    raiz.addEventListener("input", function (e) { if (E.vista === "rotinas" && e.target.id === "rBusca") mudaRotinas(e); else if (E.vista === "coord" && e.target.id === "tlQ") { E.tempo = E.tempo || {}; E.tempo.q = e.target.value; var ex = (E.tempo.nomes || []).filter(function (x) { return nrm(x) === nrm(e.target.value); })[0]; if (ex && (e.inputType === "insertReplacementText" || !e.inputType)) verTempo(ex); } else if (E.vista === "coord" && e.target.id === "eqQ") { E.altF = E.altF || {u: "", m: "", q: ""}; E.altF.q = e.target.value; var c1 = E.raiz.querySelector("#xmCorpo"); if (c1) { c1.innerHTML = altModos() + renderEquipe(E.altEquipe || []); var n = c1.querySelector("#eqQ"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } } });
    raiz.addEventListener("submit", function (e) { if (E.vista === "mural") enviaMural(e); else if (E.vista === "rotinas") enviaRotina(e); });
  }
  function montar(tipo, raiz) {
    css(); E.raiz = raiz; E.vista = tipo; E.editando = null; ligaEventos(raiz);
    if (!E.db) { raiz.innerHTML = '<div class="xm"><div class="x-nota">Esta tela precisa do banco do Hub. Abra o Hub entrando na sua conta.</div></div>'; return; }
    if (tipo === "coord") { if (!E.coord) raiz.innerHTML = '<div class="xm"><div class="x-nota">O painel da coordenação é só para quem coordena algum módulo.</div></div>'; else { try { montaCoord(raiz); } catch (e) { raiz.innerHTML = '<div class="xm"><div class="x-nota">Não consegui montar o painel: ' + esc(e && e.message || e) + "</div></div>"; } } }
  }
  function iniciar() {
    if (E.iniciado) return; E.iniciado = true;
    var h = H(); E.db = h.db ? h.db() : null; E.me = h.meId ? h.meId() : ""; E.nome = h.meNome ? h.meNome() : ""; E.coord = h.temCoord ? !!h.temCoord() : false;
    E.notifs = ls("hub-notifs-v1", []);
    (h.notifPendentes ? h.notifPendentes() : []).forEach(notificar);
    montaSino(); ligaMural();
  }
  window.__extras = {iniciar: iniciar, montar: montar, notificar: notificar, versao: 1};
})();
