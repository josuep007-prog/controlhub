(function(){
"use strict";
/* POP Master · modo Planeta do Mapa de processos (visual de holograma).
   Globo que vira mapa: de longe é um planeta (projeção ortográfica); com a roda do mouse ele se desenrola
   num mapa plano (equirretangular) e o zoom segue até cada processo.
   Departamento = continente · Setor = país · Atividade = região · Tarefa = cidade · POP = linha que sai da cidade.
   Dados de verdade no desenho: os arcos são o SIPOC (fornecedor → processo → cliente, quando o nome bate com
   um lugar do mapa) e os satélites são os sistemas usados nos POPs.
   A geografia é calculada dos dados de forma determinística (mesmos dados, mesmo mapa).
   Carregado sob demanda por pop.js, que passa a API em PopPlaneta.render(api, el). */

var API = null, raiz = null, cv = null, ctx = null, painel = null, dica = null, buscaBox = null, elNiveis = null, elLeitura = null, elTrilha = null, elTour = null;
var W = 0, H = 0, DPR = 1, CX = 0, CY = 0, RR = 1, TD = 0;
var V = {lon: 0, lat: 10, k: 1};            // centro da vista e zoom (1 = globo inteiro)
var MUNDO = null, assinatura = "", ultimoFoco = "", hover = null, destaque = null, selNo = null, sistemaSel = "";
var anima = null, Z = null, inercia = null, arr = null, pin = null, pontos = {}, tRoda = 0;
var T = 0, tAnterior = 0, laco = 0, pend = false, ultimoToque = 0, ponteiroDentro = false, quadroN = 0;
var intro = null, tour = null, nivelAtual = -1, leituraAtual = "";
var REDUZ = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var PARADAS = [1, 3.4, 10, 28, 80, 200];
var NIVEIS = ["Planeta", "Departamentos", "Setores", "Atividades", "Tarefas", "Procedimentos"];
var MAR = "#050C18", TXT = "#EAF6FF", SUB = "#8FB2D0", CIANO = [95, 225, 255];
var ST = {apr: [61, 245, 176], rev: [255, 184, 77], ras: [143, 163, 184], venc: [255, 77, 109], info: [110, 200, 255]};

/* ---------- utilidades ---------- */
function hash(s){ var h = 2166136261; s = String(s); for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function rad(d){ return d * Math.PI / 180; }
function deg(r){ return r * 180 / Math.PI; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function suave(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function wrap(l){ while(l > 180) l -= 360; while(l < -180) l += 360; return l; }
function mod(a, n){ return ((a % n) + n) % n; }
function frac(x){ return x - Math.floor(x); }
function esc(s){ return API.esc(s); }
function plural(n, s, p){ return n + " " + (n === 1 ? s : (p || s + "s")); }
function nrm(s){ return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function corta(s, n){ s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function rgba(c, a){ return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
// versão luminosa da cor do departamento (mesmo matiz, mais luz e saturação) para ler bem no escuro
function neon(hex){
  var n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0, s = 0, l = (mx + mn) / 2;
  if(d){ s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  s = Math.max(s, 0.74); l = 0.64;
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  var f = function(t){ t = frac(t); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
// brilho: um sprite radial por cor, desenhado em modo aditivo (bem mais leve que shadowBlur)
var sprites = {};
function brilho(c){
  var k = c.join(","); if(sprites[k]) return sprites[k];
  var s = document.createElement("canvas"); s.width = s.height = 64;
  var x = s.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgba(c, 1)); g.addColorStop(0.22, rgba(c, 0.55)); g.addColorStop(0.6, rgba(c, 0.12)); g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (sprites[k] = s);
}
function luz(x, y, r, c, a){ ctx.globalAlpha = a; ctx.drawImage(brilho(c), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
var cacheFundo = null, cacheGlobo = null;
function telaAux(w, h, f){ var c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d")); return c; }
function fundoPronto(){
  var w = cv.width, h = cv.height;
  if(cacheFundo && cacheFundo.width === w && cacheFundo.height === h) return cacheFundo;
  return (cacheFundo = telaAux(w, h, function(x){
    x.fillStyle = "#02050B"; x.fillRect(0, 0, w, h);
    var m = Math.max(w, h), n1 = x.createRadialGradient(w * 0.18, h * 0.2, 0, w * 0.18, h * 0.2, m * 0.55), n2 = x.createRadialGradient(w * 0.86, h * 0.84, 0, w * 0.86, h * 0.84, m * 0.5);
    n1.addColorStop(0, "rgba(52,84,190,.22)"); n1.addColorStop(1, "rgba(52,84,190,0)"); n2.addColorStop(0, "rgba(20,150,170,.16)"); n2.addColorStop(1, "rgba(20,150,170,0)");
    x.fillStyle = n1; x.fillRect(0, 0, w, h); x.fillStyle = n2; x.fillRect(0, 0, w, h);
  }));
}
// sprites da esfera (atmosfera + corpo, e luz da borda), feitos no tamanho do globo em repouso:
// parado, é cópia 1:1; no zoom, são só ampliados
function globoPronto(){
  var R = Math.round(R0() * DPR);
  if(cacheGlobo && cacheGlobo.R === R) return cacheGlobo;
  var S = Math.ceil(R * 2.6), c = S / 2, disco = function(x){ x.beginPath(); x.arc(c, c, R, 0, 7); };
  var atm = function(x){ var g = x.createRadialGradient(c, c, R * 0.96, c, c, R * 1.28); g.addColorStop(0, "rgba(70,190,255,.42)"); g.addColorStop(0.35, "rgba(50,130,255,.14)"); g.addColorStop(1, "rgba(30,80,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(c, c, R * 1.28, 0, 7); x.fill(); };
  var corpo = function(x){ var g = x.createRadialGradient(c - R * 0.35, c - R * 0.45, R * 0.05, c, c, R); g.addColorStop(0, "#12406B"); g.addColorStop(0.55, "#08203C"); g.addColorStop(1, "#030A16"); x.fillStyle = g; disco(x); x.fill(); };
  return (cacheGlobo = {
    R: R, S: S,
    atm: telaAux(S, S, atm), corpo: telaAux(S, S, corpo), tudo: telaAux(S, S, function(x){ atm(x); corpo(x); }),
    luz: telaAux(S, S, function(x){
      var g = x.createRadialGradient(c, c, R * 0.7, c, c, R); g.addColorStop(0, "rgba(90,200,255,0)"); g.addColorStop(0.86, "rgba(90,200,255,.10)"); g.addColorStop(1, "rgba(130,225,255,.38)"); x.fillStyle = g; disco(x); x.fill();
      var sm = x.createRadialGradient(c - R * 0.4, c - R * 0.45, R * 0.7, c - R * 0.1, c - R * 0.1, R * 1.25); sm.addColorStop(0, "rgba(0,4,14,0)"); sm.addColorStop(1, "rgba(0,4,14,.5)"); x.fillStyle = sm; disco(x); x.fill();
    })
  });
}
function carimbo(img, R, alfa){
  var g = cacheGlobo, d = g.S * (R * DPR / g.R);
  ctx.globalAlpha = alfa; ctx.setTransform(1, 0, 0, 1, 0, 0);
  if(Math.abs(d - g.S) < 0.5) ctx.drawImage(img, Math.round(CX * DPR - g.S / 2), Math.round(CY * DPR - g.S / 2));
  else ctx.drawImage(img, CX * DPR - d / 2, CY * DPR - d / 2, d, d);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
}
var pontilhado = null;
function padrao(){
  if(pontilhado) return pontilhado;
  var s = document.createElement("canvas"); s.width = s.height = 7;
  var x = s.getContext("2d"); x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(0, 0, 1.2, 1.2); x.fillRect(3.5, 3.5, 1.2, 1.2);
  return (pontilhado = ctx.createPattern(s, "repeat"));
}

/* ---------- posições fixas dos continentes (vizinhança por afinidade) ---------- */
var CASAS = {
  "Contábil": [0, 4], "Fiscal": [-38, 24], "Fiscal Simples Nacional": [-46, -14], "Pessoal": [38, 20], "Gestão de Pessoas": [50, -16],
  "Societário": [4, -36], "Financeiro": [-16, 50], "Comercial": [34, 52], "TI": [100, 10], "Inovação": [122, -26], "Projetos": [96, 46]
};
var VAGAS = [[-104, 16], [-126, -24], [170, 8], [-160, 36], [166, -44], [-84, -50]];
var ESTRELAS = [];
for(var ei = 0; ei < 260; ei++) ESTRELAS.push({u: hash("u" + ei), v: hash("v" + ei), d: 0.25 + hash("d" + ei) * 0.75, r: 0.4 + hash("r" + ei) * 1.3, a: 0.25 + hash("a" + ei) * 0.6, w: 0.6 + hash("w" + ei) * 2.2, f: hash("f" + ei) * 6.28, azul: hash("z" + ei) > 0.7});

/* ---------- geometria no plano local de cada continente (graus "achatados") ---------- */
function paraGeo(c, x, y){ return [wrap(c.lon + x / Math.cos(rad(c.lat))), c.lat + y]; }
// Ruído de valor 2D com várias oitavas (determinístico pela semente).
function h2(seed, x, y){ var h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido2(seed, x, y){
  var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  var a = h2(seed, xi, yi), b = h2(seed, xi + 1, yi), c = h2(seed, xi, yi + 1), d = h2(seed, xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(seed, x, y){ var s = 0, amp = 1, f = 1, tot = 0; for(var o = 0; o < 5; o++){ s += amp * ruido2(seed + o * 1013, x * f, y * f); tot += amp; amp *= 0.5; f *= 2.03; } return s / tot; }
function area(poly){ var a = 0; for(var i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return Math.abs(a / 2); }
// Linhas de mesmo valor de um campo numa grade (marching squares), devolvidas como laços fechados.
function contornos(val, N, cs, E, nivel){
  var M = N + 1, pts = {}, viz = {}, i, j;
  var cruz = function(i, j, d){
    var k = (j * M + i) * 2 + d;
    if(!pts[k]){ var a = val[j * M + i] - nivel, b = (d ? val[(j + 1) * M + i] : val[j * M + i + 1]) - nivel, t = a / (a - b); pts[k] = d ? [-E + i * cs, -E + (j + t) * cs] : [-E + (i + t) * cs, -E + j * cs]; }
    return k;
  };
  var liga = function(a, b){ (viz[a] || (viz[a] = [])).push(b); (viz[b] || (viz[b] = [])).push(a); };
  for(j = 0; j < N; j++) for(i = 0; i < N; i++){
    var c = (val[j * M + i] > nivel ? 1 : 0) | (val[j * M + i + 1] > nivel ? 2 : 0) | (val[(j + 1) * M + i + 1] > nivel ? 4 : 0) | (val[(j + 1) * M + i] > nivel ? 8 : 0);
    if(c === 0 || c === 15) continue;
    var Tp = function(){ return cruz(i, j, 0); }, Rt = function(){ return cruz(i + 1, j, 1); }, Bt = function(){ return cruz(i, j + 1, 0); }, Lf = function(){ return cruz(i, j, 1); };
    if(c === 1 || c === 14) liga(Lf(), Tp());
    else if(c === 2 || c === 13) liga(Tp(), Rt());
    else if(c === 3 || c === 12) liga(Lf(), Rt());
    else if(c === 4 || c === 11) liga(Rt(), Bt());
    else if(c === 6 || c === 9) liga(Tp(), Bt());
    else if(c === 7 || c === 8) liga(Lf(), Bt());
    else if(c === 5){ liga(Lf(), Tp()); liga(Rt(), Bt()); }
    else { liga(Tp(), Rt()); liga(Lf(), Bt()); }
  }
  var usados = {}, lacos = [];
  Object.keys(viz).forEach(function(k0){
    if(usados[k0]) return;
    var laco = [], ant = null, cur = k0, g = 0;
    while(cur != null && !usados[cur] && g++ < 20000){
      usados[cur] = 1; laco.push(pts[cur]);
      var v = viz[cur], prox = String(v[0]) !== String(ant) ? v[0] : v[1];
      ant = cur; cur = prox == null ? null : String(prox);
    }
    if(laco.length > 5) lacos.push(laco);
  });
  return lacos;
}
// arredonda os cantos (Chaikin), para a costa não parecer feita de retas
function alisar(poly){
  var out = [];
  for(var i = 0; i < poly.length; i++){ var a = poly[i], b = poly[(i + 1) % poly.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
  return out;
}
// Forma de continente: um relevo (núcleo + massas de terra alongadas + ruído) cortado no nível do mar.
// Sai com penínsulas, golfos, cabos e ilhas, e é sempre a mesma para o mesmo nome.
// O miolo (raio 0,6 R) é sempre terra, para as cidades não caírem no mar.
function continente(R, sem){
  var N = 76, E = 1.72 * R, cs = 2 * E / N, M = N + 1, val = new Float32Array(M * M), seed = Math.floor(hash(sem + "seed") * 4294967296) | 0, lobos = [], i, j;
  lobos.push({cx: 0, cy: 0, a: (0.74 + hash(sem + "ca") * 0.14) * R, b: (0.56 + hash(sem + "cb") * 0.14) * R, rot: hash(sem + "cr") * Math.PI});
  var nl = 2 + Math.floor(hash(sem + "nl") * 3), base = hash(sem + "lb") * 6.283;
  for(i = 0; i < nl; i++){
    var dir = base + i * 6.283 / nl + (hash(sem + "lj" + i) - 0.5) * 1.1, dist = (0.42 + hash(sem + "ld" + i) * 0.26) * R;
    lobos.push({cx: Math.cos(dir) * dist, cy: Math.sin(dir) * dist, a: (0.46 + hash(sem + "lx" + i) * 0.36) * R, b: (0.24 + hash(sem + "ly" + i) * 0.26) * R, rot: dir + (hash(sem + "lr" + i) - 0.5) * 1.2});
  }
  lobos.forEach(function(l){ l.c = Math.cos(l.rot); l.s = Math.sin(l.rot); });
  for(j = 0; j < M; j++) for(i = 0; i < M; i++){
    var x = -E + i * cs, y = -E + j * cs, g = -9, d = Math.hypot(x, y);
    if(i === 0 || j === 0 || i === N || j === N){ val[j * M + i] = -1; continue; }
    for(var q = 0; q < lobos.length; q++){ var l = lobos[q], dx = x - l.cx, dy = y - l.cy, u = (dx * l.c + dy * l.s) / l.a, w = (-dx * l.s + dy * l.c) / l.b, e = 1 - (u * u + w * w); if(e > g) g = e; }
    var v = Math.max(g, -1.2) + 0.46 * fbm(seed, x / R * 2.3 + 40, y / R * 2.3 + 40) - 0.1;
    if(d < 0.6 * R) v = Math.max(v, 0.04 + (0.6 * R - d) / R);
    val[j * M + i] = v;
  }
  var lacos = contornos(val, N, cs, E, 0), principal = null, ilhasL = [];
  lacos.forEach(function(l){ if(dentro([0, 0], l) && (!principal || area(l) > area(principal))) principal = l; });
  if(!principal){ principal = []; for(i = 0; i < 40; i++) principal.push([Math.cos(i / 40 * 6.283) * R * 0.7, Math.sin(i / 40 * 6.283) * R * 0.7]); }
  lacos.forEach(function(l){ if(l !== principal && !dentro(l[0], principal) && area(l) > R * R * 0.003) ilhasL.push(l); });
  ilhasL.sort(function(a, b){ return area(b) - area(a); });
  var curvas = [0.3, 0.62].map(function(nv){ var m = null; contornos(val, N, cs, E, nv).forEach(function(l){ if(!m || area(l) > area(m)) m = l; }); return m; }).filter(Boolean);
  return {forma: alisar(alisar(principal)), ilhas: ilhasL.slice(0, 6).map(alisar), curvas: curvas.map(alisar)};
}
function dentro(pt, poly){
  var c = false;
  for(var i = 0, j = poly.length - 1; i < poly.length; j = i++){
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if(((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
// Célula de Voronoi da semente i (meio-planos), recortada numa caixa.
function celula(seeds, i, cx){
  var poly = [[-cx, -cx], [cx, -cx], [cx, cx], [-cx, cx]], s = seeds[i];
  for(var j = 0; j < seeds.length && poly.length; j++){
    if(j === i) continue;
    var o = seeds[j], mx = (s[0] + o[0]) / 2, my = (s[1] + o[1]) / 2, nx = o[0] - s[0], ny = o[1] - s[1];
    var lado = function(p){ return (p[0] - mx) * nx + (p[1] - my) * ny; }, out = [];
    for(var k = 0; k < poly.length; k++){
      var a = poly[k], b = poly[(k + 1) % poly.length], la = lado(a), lb = lado(b);
      if(la <= 0) out.push(a);
      if((la < 0 && lb > 0) || (la > 0 && lb < 0)){ var t = la / (la - lb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    poly = out;
  }
  return poly;
}
function girassol(n, R, giro){
  var out = [];
  for(var i = 0; i < n; i++){ var r = R * Math.sqrt((i + 0.5) / Math.max(n, 5)), a = i * 2.39996 + giro; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
}
function distMin(seeds, i, padraoD){ var m = padraoD; seeds.forEach(function(o, j){ if(j !== i){ var d = Math.hypot(o[0] - seeds[i][0], o[1] - seeds[i][1]); if(d < m) m = d; } }); return m; }
function vetor(g){ var lo = rad(g[0]), la = rad(g[1]); return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; }

/* ---------- estatísticas de um conjunto de POPs ---------- */
function stats(pops){
  var s = {n: pops.length, apr: 0, rev: 0, ras: 0, venc: 0, essNaoLido: 0, riscoAlto: 0, nasc: "9999"};
  pops.forEach(function(p){
    if(p.status === "aprovado") s.apr++; else if(p.status === "revisao") s.rev++; else s.ras++;
    if(API.vencida(p)) s.venc++;
    var l = API.lidoInfo(p.id); if(p.essencial && !(l && l.v === p.versao)) s.essNaoLido++;
    if(p.riscos.some(function(r){ return r.nivel === "Alto" && !r.controle; })) s.riscoAlto++;
    if(p.criadoEm && p.criadoEm < s.nasc) s.nasc = p.criadoEm;
  });
  return s;
}
function popsDe(o){ return Array.isArray(o) ? o : Object.keys(o).reduce(function(a, k){ return a.concat(popsDe(o[k])); }, []); }
function ordemNasc(o){
  return Object.keys(o).map(function(k){ return {k: k, st: stats(popsDe(o[k]))}; })
    .sort(function(a, b){ return a.st.nasc.localeCompare(b.st.nasc) || a.k.localeCompare(b.k, "pt-BR"); });
}

/* ---------- nós: pai, continente, posição e chave ---------- */
function ehLugar(no){ return !!no && (no.nivel === "dep" || no.nivel === "set" || no.nivel === "at" || no.nivel === "ta"); }
function pai(no){ return no.nivel === "set" ? no.dep : no.nivel === "at" ? no.set : no.nivel === "ta" ? no.at : null; }
function contDe(no){ while(no && no.nivel !== "dep") no = pai(no); return no || null; }
function ehDentro(n, anc){ while(n){ if(n === anc) return true; n = pai(n); } return false; }
function geoNo(no){ return no.nivel === "dep" ? [no.lon, no.lat] : paraGeo(contDe(no), no.x, no.y); }
function chaveDe(no){ var p = [], n = no; while(n){ p.unshift(n.nome); n = pai(n); } return no.nivel + "|" + p.join("|"); }
function mDe(no){
  var m = {dep: "", set: "", at: "", ta: ""}, n = no;
  while(n){ m[n.nivel] = n.nome; n = pai(n); }
  return m;
}

/* ---------- monta o mundo a partir da árvore do POP Master ---------- */
function montarMundo(t){
  var deps = API.DEPS.map(function(d){ return d.n; }).concat(Object.keys(t).filter(function(d){ return !API.DEP[d]; }));
  var vaga = 0, mundo = {conts: [], cidades: [], arcos: [], sistemas: []}, indice = {}, listas = {dep: [], set: [], at: [], ta: []};
  deps.forEach(function(dn){
    var sub = t[dn] || {}, pops = popsDe(sub), st = stats(pops);
    var casaC = CASAS[dn] || VAGAS[vaga++ % VAGAS.length];
    var R = pops.length ? clamp(7.4 + 0.9 * Math.sqrt(pops.length), 8, 10.2) : 5;
    var c = {nivel: "dep", nome: dn, sigla: (API.DEP[dn] && API.DEP[dn].s) || dn.slice(0, 3).toUpperCase(), lon: casaC[0], lat: casaC[1], R: R, cor: API.depCor(dn), st: st, vazio: !pops.length, oficial: !!API.DEP[dn], filhos: []};
    c.neon = neon(c.cor);
    var geoC = continente(R, dn); c.forma = geoC.forma; c.ilhas = geoC.ilhas; c.curvas = geoC.curvas; c.sombra = c.forma.filter(function(_, i){ return i % 6 === 0; }); c.formaLonge = c.forma.filter(function(_, i){ return i % 4 === 0; });
    c.ext = 0; c.sul = 0; c.forma.forEach(function(p){ c.ext = Math.max(c.ext, Math.hypot(p[0], p[1])); c.sul = Math.max(c.sul, -p[1]); });
    listas.dep.push(c);
    var setores = ordemNasc(sub), sSeeds = girassol(setores.length, R * 0.5, hash(dn) * 6.28);
    setores.forEach(function(so, i){
      var sNo = sub[so.k], raio = setores.length === 1 ? R * 0.52 : distMin(sSeeds, i, R) * 0.5;
      var s = {nivel: "set", nome: so.k, dep: c, x: sSeeds[i][0], y: sSeeds[i][1], st: so.st, filhos: [], cel: celula(sSeeds, i, R * 1.75)};
      listas.set.push(s);
      var ats = ordemNasc(sNo), aSeeds = girassol(ats.length, raio, hash(dn + so.k) * 6.28).map(function(p){ return [p[0] + s.x, p[1] + s.y]; });
      ats.forEach(function(ao, j){
        var aNo = sNo[ao.k], raioA = ats.length === 1 ? raio * 0.7 : distMin(aSeeds, j, raio) * 0.45;
        var a = {nivel: "at", nome: ao.k, set: s, x: aSeeds[j][0], y: aSeeds[j][1], st: ao.st, filhos: [], cel: celula(aSeeds, j, R * 1.75)};
        listas.at.push(a);
        var tas = ordemNasc(aNo), tSeeds = girassol(tas.length, raioA, hash(dn + so.k + ao.k) * 6.28).map(function(p){ return [p[0] + a.x, p[1] + a.y]; });
        tas.forEach(function(to, m){
          var cens = aNo[to.k], ps = popsDe(cens);
          var ci = {nivel: "ta", nome: to.k, at: a, x: tSeeds[m][0], y: tSeeds[m][1], st: to.st, cens: cens, pops: ps, fase: hash(dn + so.k + ao.k + to.k)};
          a.filhos.push(ci); mundo.cidades.push(ci); listas.ta.push(ci);
        });
        s.filhos.push(a);
      });
      c.filhos.push(s);
    });
    mundo.conts.push(c);
  });
  // índice de nomes (do mais geral ao mais específico) para ligar o SIPOC a lugares do mapa
  ["dep", "set", "at", "ta"].forEach(function(nv){ listas[nv].forEach(function(no){ var k = nrm(no.nome); if(k && !/^\(sem /.test(k) && !indice[k]) indice[k] = no; }); });
  // arcos: fornecedor → processo e processo → cliente
  var vistos = {};
  var liga = function(de, para){
    if(!de || !para || de === para || ehDentro(de, para) || ehDentro(para, de)) return;
    var k = chaveDe(de) + ">" + chaveDe(para); if(vistos[k] || mundo.arcos.length >= 160) return; vistos[k] = 1;
    var a = geoNo(de), b = geoNo(para), A = vetor(a), B = vetor(b), om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)), pts = [];
    var h = Math.min(0.34, om * 0.3), so = Math.sin(om) || 1;
    for(var i = 0; i <= 26; i++){
      var s = i / 26, k1 = Math.sin((1 - s) * om) / so, k2 = Math.sin(s * om) / so;
      var x = A[0] * k1 + B[0] * k2, y = A[1] * k1 + B[1] * k2, z = A[2] * k1 + B[2] * k2;
      pts.push(om < 1e-5 ? [a[0], a[1], 0] : [deg(Math.atan2(y, x)), deg(Math.asin(clamp(z, -1, 1))), h * Math.sin(Math.PI * s)]);
    }
    mundo.arcos.push({de: de, para: para, pts: pts, cor: contDe(de).neon, fase: hash(k), vel: 0.16 + hash(k + "v") * 0.1});
  };
  mundo.cidades.forEach(function(ci){ ci.pops.forEach(function(p){
    (p.fornecedores || []).forEach(function(f){ liga(indice[nrm(f)], ci); });
    (p.clientes || []).forEach(function(f){ liga(ci, indice[nrm(f)]); });
  }); });
  // sistemas usados nos POPs: os mais citados viram satélites
  var sis = {};
  mundo.cidades.forEach(function(ci){ ci.pops.forEach(function(p){ (p.sistemas || []).forEach(function(s){
    var k = nrm(s); if(!k) return;
    var o = sis[k] || (sis[k] = {nivel: "sis", key: k, nome: s, pops: [], cidades: []});
    if(o.pops.indexOf(p) < 0) o.pops.push(p); if(o.cidades.indexOf(ci) < 0) o.cidades.push(ci);
  }); }); });
  mundo.sistemas = Object.keys(sis).map(function(k){ return sis[k]; }).sort(function(a, b){ return b.pops.length - a.pops.length || a.nome.localeCompare(b.nome, "pt-BR"); });
  mundo.sistemas.slice(0, 6).forEach(function(s, i){
    s.orb = {rho: 1.27 + 0.065 * i, incl: rad(13 + hash(s.key + "i") * 15), roll: rad(-32 + hash(s.key + "r") * 64), fase: hash(s.key) * 6.28, vel: (0.09 + hash(s.key + "v") * 0.05) * (i % 2 ? -1 : 1)};
  });
  return mundo;
}

/* ---------- projeção: ortográfica (globo) que se desenrola em equirretangular (mapa) ---------- */
function R0(){ return Math.min(W, H) * 0.4; }
function tDesenrolar(){ return suave(1.5, 3.4, V.k); }
function prepara(){ TD = tDesenrolar(); RR = R0() * V.k; CX = W / 2; CY = H / 2; }
// alt = altura acima da superfície (fração do raio): no globo afasta do centro; no mapa plano sobe na tela
function proj(lon, lat, alt){
  alt = alt || 0;
  var R = RR, t = TD, l = rad(wrap(lon - V.lon)), f = rad(lat), f0 = rad(V.lat), a = 1 + alt;
  var cf = Math.cos(f), sf = Math.sin(f), c0 = Math.cos(f0), s0 = Math.sin(f0), cl = Math.cos(l);
  var cosc = s0 * sf + c0 * cf * cl;
  var ox = R * a * cf * Math.sin(l), oy = -R * a * (c0 * sf - s0 * cf * cl);
  var ex = R * l, ey = -R * (f - f0) - alt * R * 0.55;
  return {x: CX + ox * (1 - t) + ex * t, y: CY + oy * (1 - t) + ey * t, vis: t > 0.55 || cosc > 0.02 || (alt > 0 && ox * ox + oy * oy > R * R), z: cosc, l: l};
}
function inversa(px, py){
  var R = RR, t = TD, x = px - CX, y = py - CY;
  if(t >= 0.5) return [wrap(V.lon + deg(x / R)), clamp(V.lat - deg(y / R), -89, 89)];
  var rho = Math.hypot(x, y); if(rho > R) return null;
  var c = Math.asin(rho / R), f0 = rad(V.lat), ny = -y;
  var lat = rho ? Math.asin(Math.cos(c) * Math.sin(f0) + ny * Math.sin(c) * Math.cos(f0) / rho) : f0;
  var lon = rad(V.lon) + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(f0) - ny * Math.sin(c) * Math.sin(f0));
  return [wrap(deg(lon)), deg(lat)];
}
function ancorar(geo, px, py){
  if(!geo) return;
  for(var it = 0; it < 3; it++){ var q = proj(geo[0], geo[1]); V.lon = wrap(V.lon + deg((q.x - px) / RR)); V.lat = clamp(V.lat - deg((q.y - py) / RR), -70, 70); }
}
function altPlaca(){ return 0.034 * (1 - TD); }
function naTela(q, m){ return q.x > -m && q.y > -m && q.x < W + m && q.y < H + m; }

/* ---------- desenho ---------- */
var rotulos = [], alvos = [];
function caminhoGeo(c, pts, fechar, alt){
  ctx.beginPath();
  // as coordenadas geográficas de cada forma são calculadas uma vez só
  var G = pts._g || (pts._g = pts.map(function(p){ return paraGeo(c, p[0], p[1]); })), ok = false, ant = 0;
  for(var i = 0; i < G.length; i++){
    var q = proj(G[i][0], G[i][1], alt);
    if(!q.vis || (ok && Math.abs(q.l - ant) > 3)){ ok = false; if(!q.vis) continue; }
    if(!ok){ ctx.moveTo(q.x, q.y); ok = true; } else ctx.lineTo(q.x, q.y);
    ant = q.l;
  }
  if(fechar) ctx.closePath();
}
function linhaGeo(f, n){
  ctx.beginPath(); var ok = false, ant = 0;
  for(var i = 0; i <= n; i++){
    var g = f(i / n), q = proj(g[0], g[1]);
    if(!q.vis || (ok && Math.abs(q.l - ant) > 3)){ ok = false; if(!q.vis) continue; }
    if(!ok){ ctx.moveTo(q.x, q.y); ok = true; } else ctx.lineTo(q.x, q.y);
    ant = q.l;
  }
  ctx.stroke();
}
function rotulo(txt, x, y, o){
  o = o || {};
  ctx.font = (o.peso || 600) + " " + (o.tam || 12) + "px " + (o.fonte || "'IBM Plex Sans', system-ui, sans-serif");
  if("letterSpacing" in ctx) ctx.letterSpacing = (o.esp || 0) + "px";
  var w = ctx.measureText(txt).width, h = (o.tam || 12) + 4, r = {x: (o.esq ? x : x - w / 2) - 3, y: y - h / 2, w: w + 6, h: h};
  if(!o.forca && rotulos.some(function(b){ return r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y; })) return false;
  rotulos.push(r);
  ctx.textAlign = o.esq ? "left" : "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(2,8,18,.88)"; ctx.lineJoin = "round"; ctx.strokeText(txt, x, y);
  ctx.fillStyle = o.cor || TXT; ctx.fillText(txt, x, y);
  return true;
}
function corSt(st){ return st.venc ? ST.venc : st.rev ? ST.rev : st.ras && !st.apr ? ST.ras : ST.apr; }
function introP(){ if(!intro) return 1; return clamp((performance.now() - intro.t0) / 1900, 0, 1); }

function desenhar(){
  if(!ctx || !MUNDO || !W) return;
  rotulos = []; alvos = []; prepara();
  var t = TD, R = RR, ip = introP(), i;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([]);
  if("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  fundo(t);
  // esfera e mar
  ctx.save();
  if(t < 0.98){
    var gl = globoPronto();
    if(t < 0.02 && ip >= 1) carimbo(gl.tudo, R, 1);
    else {
      carimbo(gl.atm, R, (1 - t) * ip);
      if(t > 0.02){ ctx.globalAlpha = t; ctx.fillStyle = MAR; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      carimbo(gl.corpo, R, 1 - t * 0.9);
    }
    if(t < 0.02){ ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.clip(); }
  } else { ctx.fillStyle = MAR; ctx.fillRect(0, 0, W, H); }
  if(t > 0.3) gradeInfinita(t);
  reticulado(t, ip);
  if(t < 0.02 && !REDUZ){
    var vy = CY - R * 1.2 + frac(T * 0.11) * R * 2.4, vg = ctx.createLinearGradient(0, vy - 46, 0, vy + 6);
    vg.addColorStop(0, "rgba(120,225,255,0)"); vg.addColorStop(0.85, "rgba(120,225,255,.10)"); vg.addColorStop(1, "rgba(160,240,255,.22)");
    ctx.fillStyle = vg; ctx.fillRect(CX - R, vy - 46, R * 2, 52);
  }
  ctx.restore();
  // continentes (placas que flutuam um pouco acima da esfera)
  var hc = ehLugar(hover) ? contDe(hover) : null, sc = selNo ? contDe(selNo) : null;
  for(i = 0; i < MUNDO.conts.length; i++){
    var ai = intro ? clamp(ip * 2.4 - i * 0.1, 0, 1) : 1;
    if(ai > 0) desenharCont(MUNDO.conts[i], ai, MUNDO.conts[i] === hc, MUNDO.conts[i] === sc);
  }
  if(ip > 0.6) desenharArcos((ip - 0.6) / 0.4);
  if(ip > 0.4){ ctx.globalAlpha = 1; for(i = 0; i < MUNDO.cidades.length; i++) desenharCidade(MUNDO.cidades[i], (ip - 0.4) / 0.6); }
  // luz da borda e sombra da esfera
  if(t < 0.98){
    carimbo(globoPronto().luz, R, (1 - t) * ip);
    anelHud(R, (1 - t) * ip);
    if(t < 0.5) desenharSatelites(R, (1 - t * 2) * ip);
  }
  ctx.globalAlpha = ip;
  desenharRotulos();
  ctx.globalAlpha = 1;
  if(ehLugar(hover)) reticulo(hover, CIANO, 1);
  if(ehLugar(destaque) && destaque !== hover) reticulo(destaque, [255, 255, 255], 1);
  if(t > 0.5) miniGlobo(suave(0.5, 1, t));
  hudDom();
}
function fundo(t){
  if(t >= 0.98){ ctx.fillStyle = "#02050B"; ctx.fillRect(0, 0, W, H); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fundoPronto(), 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  var a = 1 - t;
  var Wp = W + 80, Hp = H + 80;
  for(var i = 0; i < ESTRELAS.length; i++){
    var s = ESTRELAS[i], x = mod(s.u * Wp - V.lon * s.d * 2.4, Wp) - 40, y = mod(s.v * Hp + V.lat * s.d * 2.4, Hp) - 40;
    ctx.globalAlpha = a * s.a * (REDUZ ? 0.8 : 0.62 + 0.38 * Math.sin(T * s.w + s.f));
    ctx.fillStyle = s.azul ? "#9FD8FF" : "#F2F7FF"; ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}
// grade "infinita" do mapa plano: presa ao mundo, ganha linhas novas a cada oitava de zoom
function gradeInfinita(t){
  var o = Math.log(V.k) / Math.LN2, fr = o - Math.floor(o), s = 46 * Math.pow(2, fr), a = suave(0.3, 1, t);
  var x0 = CX - RR * rad(V.lon), y0 = CY + RR * rad(V.lat);
  var passo = function(esp, alfa){
    ctx.strokeStyle = "rgba(110,200,255," + alfa + ")"; ctx.lineWidth = 1; ctx.beginPath();
    for(var x = mod(x0, esp); x < W; x += esp){ ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for(var y = mod(y0, esp); y < H; y += esp){ ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  };
  passo(s, 0.055 * a); passo(s / 2, 0.055 * a * fr);
}
function reticulado(t, ip){
  var la, lo, q;
  ctx.fillStyle = "rgba(125,212,255,.36)"; ctx.globalAlpha = ip * (1 - 0.5 * t);
  for(la = -78; la <= 78; la += 6) for(lo = -180; lo < 180; lo += 6){
    q = proj(lo, la); if(!q.vis || q.x < 0 || q.y < 0 || q.x > W || q.y > H) continue;
    ctx.fillRect(q.x - 0.6, q.y - 0.6, 1.3, 1.3);
  }
  ctx.globalAlpha = ip; ctx.lineWidth = 1;
  for(lo = -180; lo < 180; lo += 30){ ctx.strokeStyle = "rgba(110,200,255,.12)"; linhaGeo(function(s){ return [lo, -80 + 160 * s]; }, 40); }
  for(la = -60; la <= 60; la += 30){ ctx.strokeStyle = la ? "rgba(110,200,255,.12)" : "rgba(130,220,255,.34)"; linhaGeo(function(s){ return [-180 + 360 * s, la]; }, 72); }
  ctx.globalAlpha = 1;
}
function desenharCont(c, alfa, noHover, noSel){
  var q0 = proj(c.lon, c.lat); if(!q0.vis && TD < 0.55) return;
  if(TD > 0.55){ var mh = RR * rad(c.ext * 1.3), mw = mh / Math.cos(rad(c.lat)); if(q0.x + mw < 0 || q0.x - mw > W || q0.y + mh < 0 || q0.y - mh > H) return; }
  var A = altPlaca(), n = c.neon, k = V.k, fz = 1 - 0.62 * suave(8, 60, k);
  var forma = RR * rad(c.ext) < 170 ? c.formaLonge : c.forma;   // de longe, a costa simplificada basta
  ctx.save(); ctx.globalAlpha = alfa;
  if(A > 0.004){ caminhoGeo(c, c.sombra, true, 0); ctx.fillStyle = "rgba(0,3,10,.42)"; ctx.fill(); }
  caminhoGeo(c, forma, true, A);
  if(c.vazio){
    ctx.fillStyle = "rgba(150,190,230," + (noHover ? 0.10 : 0.035) + ")"; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(160,200,240," + (noHover ? 0.8 : 0.42) + ")"; ctx.setLineDash([5, 5]); ctx.lineDashOffset = REDUZ ? 0 : -T * 9; ctx.stroke();
    c.ilhas.forEach(function(il){ caminhoGeo(c, il, true, A); ctx.stroke(); }); ctx.setLineDash([]);
  } else {
    ctx.fillStyle = rgba(n, (0.17 + (noHover ? 0.12 : 0) + (noSel ? 0.05 : 0)) * fz); ctx.fill();
    ctx.globalAlpha = alfa * 0.22; ctx.fillStyle = padrao(); ctx.fill(); ctx.globalAlpha = alfa;
    ctx.lineJoin = "round"; ctx.lineWidth = 6; ctx.strokeStyle = rgba(n, 0.2); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(n, 0.95); ctx.stroke();
    c.ilhas.forEach(function(il){ caminhoGeo(c, il, true, A); ctx.fillStyle = rgba(n, 0.2 * fz); ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(n, 0.85); ctx.stroke(); });
    caminhoGeo(c, forma, true, A);
    if(k < 3.4){
      // curvas de nível: dão relevo à placa enquanto os setores ainda não aparecem
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(n, 0.2 * (1 - suave(2.2, 3.4, k)));
      c.curvas.forEach(function(cv2){ caminhoGeo(c, cv2, true, A); ctx.stroke(); });
      caminhoGeo(c, forma, true, A);
    }
    if(k > 2.2){
      ctx.clip();
      var tons = [0.05, 0.13, 0.02, 0.10, 0.17, 0.07], fa = suave(2.2, 3.4, k);
      c.filhos.forEach(function(s, i){
        var sel = selNo && ehDentro(selNo, s), hv = ehLugar(hover) && ehDentro(hover, s) && k > 2.4;
        caminhoGeo(c, s.cel, true, A);
        ctx.fillStyle = rgba(n, (tons[i % tons.length] + (sel ? 0.08 : 0) + (hv ? 0.07 : 0)) * fa * fz); ctx.fill();
        ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = rgba(n, (sel ? 0.9 : 0.5) * fa); ctx.stroke();
        if(k > 7 && s.filhos.length > 1){
          ctx.save(); caminhoGeo(c, s.cel, true, A); ctx.clip();
          ctx.setLineDash([2, 4]); ctx.lineWidth = 0.9; ctx.strokeStyle = rgba(n, 0.38);
          s.filhos.forEach(function(a){ caminhoGeo(c, a.cel, true, A); ctx.stroke(); });
          ctx.setLineDash([]); ctx.restore();
        }
      });
    }
  }
  ctx.restore();
  alvos.push({no: c});
}
function desenharArcos(alfa){
  if(!MUNDO.arcos.length) return;
  var A = altPlaca();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  MUNDO.arcos.forEach(function(ar){
    var liga = selNo && (ehDentro(ar.de, selNo) !== ehDentro(ar.para, selNo)), forca = (liga ? 1 : selNo ? 0.35 : 0.6) * alfa, pts = [], i, q, ok = false, ant = 0;
    ctx.beginPath();
    for(i = 0; i < ar.pts.length; i++){
      q = proj(ar.pts[i][0], ar.pts[i][1], A + ar.pts[i][2]); pts.push(q);
      if(!q.vis || (ok && Math.abs(q.l - ant) > 3)){ ok = false; if(!q.vis) continue; }
      if(!ok){ ctx.moveTo(q.x, q.y); ok = true; } else ctx.lineTo(q.x, q.y);
      ant = q.l;
    }
    ctx.lineWidth = liga ? 4.5 : 3.5; ctx.strokeStyle = rgba(ar.cor, 0.10 * forca); ctx.stroke();
    ctx.lineWidth = liga ? 1.5 : 1; ctx.strokeStyle = rgba(ar.cor, 0.62 * forca); ctx.stroke();
    if(REDUZ) return;
    for(var j = 0; j < 2; j++){
      var s = frac(T * ar.vel + ar.fase + j * 0.5) * (pts.length - 1), i0 = Math.floor(s), f = s - i0, a = pts[i0], b = pts[Math.min(i0 + 1, pts.length - 1)];
      if(!a.vis || !b.vis || Math.abs(a.l - b.l) > 3) continue;
      var x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      if(x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      luz(x, y, liga ? 9 : 7, ar.cor, 0.9 * forca); luz(x, y, 3, [255, 255, 255], 0.9 * forca);
    }
  });
  ctx.restore();
}
function desenharCidade(ci, alfa){
  var c = contDe(ci), A = altPlaca(), g = paraGeo(c, ci.x, ci.y), q = proj(g[0], g[1], A), k = V.k;
  ci._q = null; ci._r = 0;
  if(!q.vis) return;
  ci._q = q;
  if(!naTela(q, 140)) return;
  var cor = corSt(ci.st), n = c.neon, noSis = sistemaSel && MUNDO.sisSel && MUNDO.sisSel.cidades.indexOf(ci) >= 0;
  var r = clamp(2.5 + Math.sqrt(ci.st.n) * 1.6 + (k - 5) * 0.08, 3, 11), fS = 1 - suave(4, 9, k);
  ctx.save(); ctx.globalAlpha = alfa;
  // espigão de luz: de longe, cada tarefa é um facho que sai da superfície
  if(fS > 0.01){
    var h = Math.min(0.2, 0.05 + 0.032 * Math.sqrt(ci.st.n)) * fS, q2 = proj(g[0], g[1], A + h), dx = q2.x - q.x, dy = q2.y - q.y, L = Math.hypot(dx, dy);
    if(L > 64){ dx *= 64 / L; dy *= 64 / L; L = 64; }
    var tx = q.x + dx, ty = q.y + dy;
    if(L > 1.5){
      var gr = ctx.createLinearGradient(q.x, q.y, tx, ty); gr.addColorStop(0, rgba(cor, 0.05)); gr.addColorStop(1, rgba(cor, 0.95));
      ctx.strokeStyle = gr; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(tx, ty); ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    var pis = REDUZ ? 0.8 : 0.7 + 0.3 * Math.sin(T * 2.2 + ci.fase * 6.28);
    luz(tx, ty, (noSis ? 13 : 8) * fS + 3, cor, alfa * pis); luz(tx, ty, 2.6, [255, 255, 255], alfa * 0.9 * fS);
    ctx.globalCompositeOperation = "source-over";
  }
  if(k > 5){
    var fN = suave(5, 7, k);
    ctx.globalAlpha = alfa * fN;
    // linhas dos POPs (circuito) quando bem perto
    if(k > 40) linhasPop(c, ci, q, n);
    ctx.globalCompositeOperation = "lighter";
    luz(q.x, q.y, r * 3.4, cor, alfa * fN * 0.6);
    if(!REDUZ){
      var vel = ci.st.venc ? 0.8 : 0.33, ph = frac(T * vel + ci.fase);
      ctx.strokeStyle = rgba(cor, (1 - ph) * 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.x, q.y, r + 3 + ph * 18, 0, 7); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath(); ctx.arc(q.x, q.y, r + 2.2, 0, 7); ctx.fillStyle = rgba(cor, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fillStyle = "#06101E"; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.45, 0, 7); ctx.fillStyle = rgba(n, 1); ctx.fill();
    if(ci.st.essNaoLido){ ctx.fillStyle = rgba(ST.info, 1); ctx.beginPath(); ctx.moveTo(q.x + r * 0.6, q.y - r - 9); ctx.lineTo(q.x + r * 0.6 + 8, q.y - r - 6); ctx.lineTo(q.x + r * 0.6, q.y - r - 3); ctx.fill(); ctx.strokeStyle = rgba(ST.info, 1); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x + r * 0.6, q.y - r - 9); ctx.lineTo(q.x + r * 0.6, q.y - r + 1); ctx.stroke(); }
    if(ci.st.riscoAlto){ ctx.fillStyle = rgba(ST.venc, 1); ctx.beginPath(); ctx.moveTo(q.x - r - 6, q.y - r - 1); ctx.lineTo(q.x - r - 1, q.y - r - 10); ctx.lineTo(q.x - r + 4, q.y - r - 1); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#1A0208"; ctx.font = "700 7px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("!", q.x - r - 1, q.y - r - 3); }
    if(ci === selNo || noSis){
      ctx.strokeStyle = noSis ? "rgba(255,255,255,.9)" : rgba(CIANO, 0.95); ctx.lineWidth = 1.4; ctx.setLineDash([7, 5]); ctx.lineDashOffset = REDUZ ? 0 : -T * 16;
      ctx.beginPath(); ctx.arc(q.x, q.y, r + 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    ci._r = r;
    alvos.push({no: ci, x: q.x, y: q.y, r: r + 7});
  }
  ctx.restore();
}
// Bem de perto, cada POP vira uma linha de metrô: sai da cidade, segue na horizontal e cada passo é uma estação.
function linhasPop(c, ci, q, n){
  var e = clamp((V.k - 40) / 160, 0, 1), np = ci.pops.length, passo = 9 + 29 * e, vao = 26 + 64 * e, entrada = 22 + 34 * e, comTexto = e > 0.72;
  ci.pops.forEach(function(p, i){
    var dy = (i - (np - 1) / 2) * vao, y = q.y + dy, xd = q.x + Math.abs(dy), xs = q.x + Math.max(entrada, Math.abs(dy) + 16), tot = p.passos.length, ns = Math.min(tot || 1, 24), xe = xs + passo * ns;
    var cor = p.status === "aprovado" ? n : p.status === "revisao" ? ST.rev : ST.ras, venc = API.vencida(p);
    var hvPop = hover && (hover.nivel === "pop" || hover.nivel === "passo") && hover.pop === p;
    var traco = function(){ ctx.beginPath(); ctx.moveTo(q.x, q.y); if(dy) ctx.lineTo(xd, y); ctx.lineTo(xe, y); ctx.stroke(); };
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(cor, hvPop ? 0.3 : 0.16); ctx.lineWidth = 10; traco();
    ctx.strokeStyle = rgba(cor, 0.95); ctx.lineWidth = 2.6; ctx.setLineDash(p.status === "rascunho" ? [4, 6] : p.status === "revisao" ? [12, 6] : []); traco(); ctx.setLineDash([]);
    alvos.push({no: {nivel: "pop", pop: p, cidade: ci}, seg: [q.x, q.y, xd, y]});
    alvos.push({no: {nivel: "pop", pop: p, cidade: ci}, x: xe, y: y, r: 13, seg: [xd, y, xe, y]});
    // luz que percorre a linha (o fluxo do processo)
    ctx.globalCompositeOperation = "lighter";
    if(!REDUZ){
      var l1 = Math.abs(dy) * 1.4142, l2 = xe - xd, s = frac(T * 0.22 + hash(p.id)) * (l1 + l2), px = s < l1 ? q.x + s / 1.4142 : xd + (s - l1), py = s < l1 ? q.y + (dy < 0 ? -1 : 1) * s / 1.4142 : y;
      luz(px, py, 9, cor, 0.95); luz(px, py, 3.2, [255, 255, 255], 0.9);
    }
    luz(xe, y, venc ? 15 : 11, venc ? ST.venc : cor, 0.8);
    ctx.globalCompositeOperation = "source-over";
    for(var j = 0; j < ns; j++){
      var fx = xs + passo * j, ps = p.passos[j], dec = ps && ps.tipo === "decisao", hv = hover && hover.nivel === "passo" && hover.pop === p && hover.i === j, rr = (dec ? 5 : 3.4) * (0.7 + 0.3 * e) + (hv ? 2 : 0);
      if(fx < -30 || fx > W + 30 || y < -30 || y > H + 120) continue;
      ctx.fillStyle = hv ? "#FFFFFF" : "#06101E"; ctx.strokeStyle = dec ? "#FFFFFF" : rgba(cor, 1); ctx.lineWidth = 1.6;
      ctx.beginPath(); if(dec){ ctx.moveTo(fx, y - rr); ctx.lineTo(fx + rr, y); ctx.lineTo(fx, y + rr); ctx.lineTo(fx - rr, y); ctx.closePath(); } else ctx.arc(fx, y, rr, 0, 7);
      ctx.fill(); ctx.stroke();
      if(ps){
        alvos.push({no: {nivel: "passo", pop: p, i: j, cidade: ci}, x: fx, y: y, r: Math.max(7, passo * 0.45)});
        if(comTexto){
          var tx = (j + 1) + " " + corta(ps.texto, 26);
          ctx.save(); ctx.translate(fx + 3, y - 9); ctx.rotate(-0.56);
          ctx.globalAlpha *= suave(0.72, 0.9, e);
          ctx.font = (hv ? 600 : 500) + " 10.5px 'IBM Plex Sans', system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(2,8,18,.85)"; ctx.strokeText(tx, 0, 0);
          ctx.fillStyle = hv ? "#FFFFFF" : dec ? "#FFE2B0" : "#BFD9EF"; ctx.fillText(tx, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.fillStyle = venc ? rgba(ST.venc, 1) : rgba(cor, 1); ctx.beginPath(); ctx.arc(xe, y, 5, 0, 7); ctx.fill();
    if(hvPop){ ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(xe, y, 9, 0, 7); ctx.stroke(); }
    p._rot = {x: xe + 14, y: y, txt: (p.codigo ? p.codigo + " · " : "") + (p.variacao || p.cenario) + (tot > ns ? " · +" + (tot - ns) + " passos" : "")};
  });
}
function anelHud(R, alfa){
  if(alfa < 0.02) return;
  var r = R * 1.105, C = Math.PI * 2;
  ctx.save(); ctx.globalAlpha = alfa;
  ctx.strokeStyle = "rgba(110,215,255,.22)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(CX, CY, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = "rgba(110,215,255,.5)"; ctx.lineWidth = 4; ctx.setLineDash([1, C * (r + 4) / 120 - 1]); ctx.lineDashOffset = rad(V.lon) * (r + 4);
  ctx.beginPath(); ctx.arc(CX, CY, r + 4, 0, 7); ctx.stroke();
  ctx.strokeStyle = "rgba(150,230,255,.85)"; ctx.lineWidth = 9; ctx.setLineDash([1.6, C * (r + 6) / 12 - 1.6]); ctx.lineDashOffset = rad(V.lon) * (r + 6);
  ctx.beginPath(); ctx.arc(CX, CY, r + 6, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.lineCap = "round";
  var a0 = REDUZ ? -0.6 : T * 0.22;
  ctx.strokeStyle = "rgba(130,232,255,.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(CX, CY, r + 15, a0, a0 + 0.55); ctx.stroke();
  ctx.strokeStyle = "rgba(130,232,255,.35)"; ctx.beginPath(); ctx.arc(CX, CY, r + 15, a0 + Math.PI, a0 + Math.PI + 0.9); ctx.stroke();
  ctx.strokeStyle = "rgba(130,232,255,.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(CX, CY, r + 21, -a0 * 0.6, -a0 * 0.6 + 1.6); ctx.stroke();
  ctx.restore();
}
function posSat(o, th){
  var x = o.rho * Math.cos(th), z = o.rho * Math.sin(th), y = -z * Math.sin(o.incl), z2 = z * Math.cos(o.incl), cr = Math.cos(o.roll), sr = Math.sin(o.roll);
  return {x: x * cr - y * sr, y: x * sr + y * cr, z: z2};
}
function desenharSatelites(R, alfa){
  if(alfa < 0.02) return;
  ctx.save();
  MUNDO.sistemas.forEach(function(s){
    if(!s.orb) return;
    var o = s.orb, i, p, ativo = sistemaSel === s.key || (hover && hover === s);
    // órbita: some atrás da esfera
    ctx.globalAlpha = alfa; ctx.lineWidth = 1;
    for(var lado = 0; lado < 2; lado++){
      ctx.beginPath(); var ok = false;
      for(i = 0; i <= 72; i++){
        p = posSat(o, i / 72 * Math.PI * 2);
        var oculto = p.z < 0 && p.x * p.x + p.y * p.y < 1, frente = p.z >= 0;
        if(oculto || frente !== !!lado){ ok = false; continue; }
        if(!ok){ ctx.moveTo(CX + R * p.x, CY - R * p.y); ok = true; } else ctx.lineTo(CX + R * p.x, CY - R * p.y);
      }
      ctx.strokeStyle = "rgba(120,215,255," + (lado ? (ativo ? 0.55 : 0.26) : 0.11) + ")"; ctx.stroke();
    }
    p = posSat(o, o.fase + (REDUZ ? 0 : T * o.vel));
    if(p.z < 0 && p.x * p.x + p.y * p.y < 1) return;
    var x = CX + R * p.x, y = CY - R * p.y, f = p.z < 0 ? 0.5 : 1;
    if(ativo){
      ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 1;
      s.cidades.forEach(function(ci){ if(!ci._q) return; var g = ctx.createLinearGradient(x, y, ci._q.x, ci._q.y); g.addColorStop(0, "rgba(160,235,255,.7)"); g.addColorStop(1, "rgba(160,235,255,.12)"); ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ci._q.x, ci._q.y); ctx.stroke(); });
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = alfa * f;
    ctx.globalCompositeOperation = "lighter"; luz(x, y, ativo ? 20 : 13, CIANO, alfa * f * 0.8); ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alfa * f;
    ctx.fillStyle = "#06101E"; ctx.strokeStyle = ativo ? "#FFFFFF" : rgba(CIANO, 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 5.5, y); ctx.lineTo(x, y + 5.5); ctx.lineTo(x - 5.5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 6.5, y); ctx.moveTo(x + 6.5, y); ctx.lineTo(x + 10, y); ctx.stroke();
    ctx.font = "500 10px 'IBM Plex Mono', monospace"; if("letterSpacing" in ctx) ctx.letterSpacing = "0.6px";
    alvos.push({no: s, x: x, y: y, r: 15});
    if(W < 560 && !ativo) return;   // em tela estreita, o nome do sistema só aparece quando escolhido
    var txt = corta(s.nome, 24).toUpperCase(), esq = x > CX;
    ctx.textAlign = esq ? "left" : "right"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(2,8,18,.85)"; ctx.strokeText(txt, x + (esq ? 15 : -15), y);
    ctx.fillStyle = ativo ? "#FFFFFF" : "rgba(170,225,250,.92)"; ctx.fillText(txt, x + (esq ? 15 : -15), y);
    if("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  });
  ctx.restore();
}
function desenharRotulos(){
  var k = V.k, A = altPlaca(), MONO = "'IBM Plex Mono', monospace";
  if(k > 40) MUNDO.cidades.forEach(function(ci){ if(ci._q && ci._r) ci.pops.forEach(function(p){ if(p._rot) rotulo(p._rot.txt, p._rot.x, p._rot.y, {tam: 10.5, peso: 500, cor: "#EAF6FF", fonte: MONO, esq: true, forca: true}); }); });
  if(k > 9) MUNDO.cidades.forEach(function(ci){ if(ci._q && ci._r && naTela(ci._q, 0)) rotulo(ci.nome, ci._q.x, ci._q.y + ci._r + 13, {tam: k > 30 ? 13 : 11.5, peso: 600}); });
  if(k > 7) MUNDO.conts.forEach(function(c){ if(c.vazio) return; c.filhos.forEach(function(s){ if(s.filhos.length < 2) return; s.filhos.forEach(function(a){ var g = paraGeo(c, a.x, a.y), q = proj(g[0], g[1], A); if(q.vis && naTela(q, 0)) rotulo(a.nome, q.x, q.y - (k > 20 ? 26 : 14), {tam: 11, peso: 500, cor: SUB}); }); }); });
  if(k > 2.4) MUNDO.conts.forEach(function(c){ if(c.vazio) return; c.filhos.forEach(function(s){ var g = paraGeo(c, s.x, s.y), q = proj(g[0], g[1], A); if(q.vis && naTela(q, 40)) rotulo(s.nome.toUpperCase(), q.x, q.y + (k > 7 ? -40 : 0), {tam: k > 7 ? 12.5 : 10.5, peso: 700, fonte: "Archivo, sans-serif", esp: 1, cor: rgba(c.neon.map(function(v){ return Math.round(v + (255 - v) * 0.55); }), 1)}); }); });
  MUNDO.conts.forEach(function(c){
    var perto = k > 2.4, q = proj(c.lon, c.lat - (perto ? c.sul + c.R * 0.06 : 0), A); if(!q.vis) return;
    var dy = perto ? 14 : -3;
    var ok = rotulo(perto ? c.sigla + " · " + c.nome.toUpperCase() : c.sigla, q.x, q.y + dy, {tam: perto ? 13 : 16, peso: 800, fonte: "Archivo, sans-serif", esp: perto ? 1.2 : 2, forca: !perto, cor: c.vazio ? "#8FA9C4" : TXT});
    if(ok) rotulo(c.vazio ? (perto ? "TERRA A MAPEAR" : c.nome.toUpperCase() + " · A MAPEAR") : (perto ? "" : c.nome.toUpperCase() + " · ") + plural(c.st.n, "POP") + (c.st.venc ? " · " + plural(c.st.venc, "VENCIDA") : ""), q.x, q.y + dy + 15, {tam: 9.5, peso: 500, fonte: MONO, esp: 0.6, cor: c.st.venc ? "#FF7D95" : c.vazio ? "#6F89A5" : SUB, forca: !perto && W >= 560});
  });
}
function reticulo(no, cor, alfa){
  var q, s, A = altPlaca();
  if(no.nivel === "dep"){ q = proj(no.lon, no.lat, A); s = clamp(RR * rad(no.ext) * 0.95, 26, Math.min(W, H) * 0.46); }
  else if(no.nivel === "ta"){ q = no._q; s = (no._r || 6) + 13; }
  else { var g = geoNo(no); q = proj(g[0], g[1], A); s = clamp(RR * rad(no.nivel === "set" ? 2.2 : 1) , 18, Math.min(W, H) * 0.3); }
  if(!q || !q.vis || !naTela(q, 60)) return;
  var p = REDUZ ? 0 : Math.sin(T * 3) * 2.5; s += p;
  var b = Math.min(12, s * 0.45);
  ctx.save(); ctx.globalAlpha = alfa; ctx.strokeStyle = rgba(cor, 0.95); ctx.lineWidth = 1.6; ctx.lineCap = "square";
  ctx.beginPath();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function(d){
    var x = q.x + d[0] * s, y = q.y + d[1] * s;
    ctx.moveTo(x - d[0] * b, y); ctx.lineTo(x, y); ctx.lineTo(x, y - d[1] * b);
  });
  ctx.stroke(); ctx.restore();
}
// mini globo: no mapa plano, mostra em que parte do planeta você está
var MINI = {lon: 36, lat: 8, r: 30};
function miniGlobo(alfa){
  var r = MINI.r, x0 = W - r - 22, y0 = H - r - 44, f0 = rad(MINI.lat);
  var pm = function(lon, lat){
    var l = rad(wrap(lon - MINI.lon)), f = rad(lat), z = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l);
    return {x: x0 + r * Math.cos(f) * Math.sin(l), y: y0 - r * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l)), z: z};
  };
  ctx.save(); ctx.globalAlpha = alfa;
  var g = ctx.createRadialGradient(x0 - 9, y0 - 11, 2, x0, y0, r); g.addColorStop(0, "#14426E"); g.addColorStop(1, "#040C1A");
  ctx.beginPath(); ctx.arc(x0, y0, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(120,220,255,.6)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(120,220,255,.25)"; ctx.setLineDash([1, 5]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x0, y0, r + 5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  MUNDO.conts.forEach(function(c){ var p = pm(c.lon, c.lat); if(p.z < 0.05) return; ctx.fillStyle = c.vazio ? "rgba(150,180,210,.45)" : rgba(c.neon, 0.95); var s = c.vazio ? 1.4 : clamp(c.R * 0.18, 1.8, 3.6); ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 7); ctx.fill(); });
  var m = pm(V.lon, V.lat);
  if(m.z < 0){ var d = Math.hypot(m.x - x0, m.y - y0) || 1; m.x = x0 + (m.x - x0) / d * r; m.y = y0 + (m.y - y0) / d * r; }
  ctx.globalCompositeOperation = "lighter"; luz(m.x, m.y, 10, [255, 255, 255], alfa * 0.8); ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(m.x, m.y, 4.2, 0, 7); ctx.stroke();
  ctx.restore();
  alvos.push({no: {nivel: "mini"}, x: x0, y: y0, r: r + 6});
}
function nivelDe(k){ var m = 0; PARADAS.forEach(function(s, i){ if(Math.abs(Math.log(s / k)) < Math.abs(Math.log(PARADAS[m] / k))) m = i; }); return m; }
function hudDom(){
  var n = nivelDe(V.k);
  if(n !== nivelAtual && elNiveis){ nivelAtual = n; var bs = elNiveis.querySelectorAll(".pl-nv"); for(var i = 0; i < bs.length; i++){ bs[i].classList.toggle("on", i === n); if(i === n) bs[i].setAttribute("aria-current", "true"); else bs[i].removeAttribute("aria-current"); } }
  var s = "LON " + (V.lon >= 0 ? "+" : "−") + Math.abs(V.lon).toFixed(1) + "°  LAT " + (V.lat >= 0 ? "+" : "−") + Math.abs(V.lat).toFixed(1) + "°  ZOOM " + (V.k < 10 ? V.k.toFixed(1) : Math.round(V.k)) + "×";
  if(s !== leituraAtual && elLeitura){ leituraAtual = s; elLeitura.textContent = s; }
}

/* ---------- laço de animação ---------- */
function visivel(){ return raiz && raiz.isConnected && raiz.getClientRects().length > 0 && !document.hidden; }
function quadro(now){
  laco = 0;
  if(!visivel()){ pararTour(); return; }
  var dt = Math.min(0.05, Math.max(0, (now - tAnterior) / 1000)); tAnterior = now; T += dt; quadroN++;
  var ocupado = fisica(dt, now);
  // parado há um tempo: metade dos quadros basta para o brilho e os pulsos
  if(ocupado || now - ultimoToque < 12000 || quadroN % 2 === 0) desenhar();
  laco = requestAnimationFrame(quadro);
}
function ligar(){ if(!laco && !REDUZ && visivel()){ tAnterior = performance.now(); laco = requestAnimationFrame(quadro); } }
function pedirDesenho(){
  if(!REDUZ){ ligar(); return; }
  if(!pend){ pend = true; requestAnimationFrame(function(){ pend = false; desenhar(); }); }
}
function toque(){ ultimoToque = performance.now(); if(intro){ intro = null; V.k = Math.max(V.k, 0.85); } ligar(); }
function pararMov(){ anima = null; Z = null; inercia = null; }
function fisica(dt, now){
  var ocupado = false;
  if(intro){
    var p = clamp((now - intro.t0) / 1900, 0, 1), e = 1 - Math.pow(1 - p, 3);
    V.k = 0.5 + 0.5 * e; V.lon = wrap(intro.lon - 95 * (1 - e)); V.lat = intro.lat + 14 * (1 - e);
    if(p >= 1){ intro = null; V.k = 1; }
    return true;
  }
  if(anima){
    var a = anima, t = clamp((now - a.t0) / a.ms, 0, 1), ee = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    V.lon = wrap(a.lon0 + a.dl * ee); V.lat = a.lat0 + (a.lat - a.lat0) * ee;
    V.k = Math.exp(Math.log(a.k0) + (Math.log(a.k) - Math.log(a.k0)) * ee - a.salto * Math.sin(Math.PI * ee));
    if(t >= 1) anima = null;
    ocupado = true;
  }
  if(Z){
    var d = Math.log(Z.k / V.k);
    if(Math.abs(d) < 0.004){ V.k = Z.k; prepara(); ancorar(Z.geo, Z.px, Z.py); Z = null; }
    else { V.k *= Math.exp(d * (1 - Math.exp(-dt * 13))); prepara(); ancorar(Z.geo, Z.px, Z.py); }
    ocupado = true;
  }
  if(inercia){
    var R = R0() * V.k;
    V.lon = wrap(V.lon - deg(inercia.vx * dt / R)); V.lat = clamp(V.lat + deg(inercia.vy * dt / R), -70, 70);
    var q = Math.exp(-dt * 4.2); inercia.vx *= q; inercia.vy *= q;
    if(Math.hypot(inercia.vx, inercia.vy) < 14) inercia = null;
    ocupado = true;
  }
  // em repouso, de longe, o planeta gira bem devagar (para quando o ponteiro está sobre ele)
  if(!ocupado && !arr && !pin && !tour && !ponteiroDentro && V.k < 1.25 && now - ultimoToque > 4500 && !sistemaSel){ V.lon = wrap(V.lon + dt * 2.6); }
  return ocupado;
}

/* ---------- navegação: voar até um lugar ---------- */
function voar(lon, lat, k, ms){
  Z = null; inercia = null; intro = null;
  if(dica) dica.hidden = true; hover = null;
  if(REDUZ || !ms){ anima = null; V.lon = wrap(lon); V.lat = lat; V.k = k; pedirDesenho(); return; }
  var dl = wrap(lon - V.lon), dist = rad(Math.hypot(dl * Math.cos(rad((lat + V.lat) / 2)), lat - V.lat));
  // viagem longa: sobe para ver o caminho e desce no destino
  var kmin = Math.min(V.k, k), kmeio = Math.max(1, 1.75 / Math.max(dist, 0.001)), salto = kmeio < kmin ? Math.log(kmin / kmeio) : 0;
  anima = {lon0: V.lon, lat0: V.lat, k0: V.k, dl: dl, lat: lat, k: k, salto: salto, t0: performance.now(), ms: ms * (1 + Math.min(salto, 4) * 0.22)};
  ligar();
}
function kPara(raioGraus){ return clamp(0.36 * Math.min(W, H) / (R0() * rad(Math.max(raioGraus, 0.05))), 1, 260); }
function focoDe(m){
  if(!MUNDO || !m.dep) return {lon: V.lon, lat: V.lat, k: 1, no: null};
  var c = MUNDO.conts.filter(function(x){ return x.nome === m.dep; })[0]; if(!c) return null;
  var s = m.set && c.filhos.filter(function(x){ return x.nome === m.set; })[0];
  var a = s && m.at && s.filhos.filter(function(x){ return x.nome === m.at; })[0];
  var ci = a && m.ta && a.filhos.filter(function(x){ return x.nome === m.ta; })[0];
  var no = ci || a || s || c, x = no === c ? 0 : no.x, y = no === c ? 0 : no.y, g = paraGeo(c, x, y);
  var raio = no === c ? c.ext * 1.12 : no === s ? Math.max(c.R / Math.max(Math.sqrt(c.filhos.length), 1) * 0.75, 1.2) : no === a ? Math.max(c.R / Math.max(Math.sqrt(c.filhos.length * s.filhos.length), 1) * 0.6, 0.5) : 0.22;
  if(no === ci) return {lon: wrap(g[0] + (W ? deg(W * 0.2 / (R0() * 200)) : 0)), lat: g[1], k: 200, no: no};
  return {lon: g[0], lat: g[1], k: kPara(raio), no: no};
}
function irPara(m, ms){ var f = focoDe(m); if(f) voar(f.lon, f.lat, f.k, ms == null ? 850 : ms); }
function escolher(no){
  if(no.nivel === "sis"){ escolherSistema(no); return; }
  if(no.nivel === "mini"){ casa(); return; }
  sistemaSel = ""; MUNDO.sisSel = null;
  var m = mDe(no);
  ultimoFoco = JSON.stringify(m);
  API.navegar(m);
  irPara(m);
  painelPara(m);
}
function escolherSistema(s){
  sistemaSel = sistemaSel === s.key ? "" : s.key; MUNDO.sisSel = sistemaSel ? s : null;
  painelPara(API.S().mapa); pedirDesenho();
}

/* ---------- acerto do clique ---------- */
function noEm(px, py){
  prepara();
  for(var i = alvos.length - 1; i >= 0; i--){
    var a = alvos[i];
    if(a.seg){ if(distSeg(px, py, a.seg) < 7 || Math.hypot(px - a.x, py - a.y) <= a.r) return a.no; continue; }
    if(a.x != null && Math.hypot(px - a.x, py - a.y) <= a.r) return a.no;
  }
  var g = inversa(px, py); if(!g) return null;
  for(var j = 0; j < MUNDO.conts.length; j++){
    var c = MUNDO.conts[j], x = wrap(g[0] - c.lon) * Math.cos(rad(c.lat)), y = g[1] - c.lat;
    if(!dentro([x, y], c.forma)) continue;
    if(V.k <= 2.4 || !c.filhos.length) return c;
    var s = maisPerto(c.filhos, x, y); if(!s) return c;
    if(V.k <= 7 || s.filhos.length < 1) return s;
    var a2 = maisPerto(s.filhos, x, y);
    return a2 || s;
  }
  return null;
}
function maisPerto(l, x, y){ var m = null, d = Infinity; l.forEach(function(n){ var e = Math.hypot(n.x - x, n.y - y); if(e < d){ d = e; m = n; } }); return m; }
function distSeg(px, py, s){ var dx = s[2] - s[0], dy = s[3] - s[1], l = dx * dx + dy * dy, t = l ? clamp(((px - s[0]) * dx + (py - s[1]) * dy) / l, 0, 1) : 0; return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy)); }

/* ---------- dica (hover) e painel lateral ---------- */
var ROT_ST = {aprovado: "Aprovado", revisao: "Em revisão", rascunho: "Rascunho"}, ROT_NV = {dep: "Departamento", set: "Setor", at: "Atividade", ta: "Tarefa"};
function resumoSt(st){
  var b = [plural(st.n, "POP")];
  if(st.apr) b.push(st.apr + " aprovado" + (st.apr > 1 ? "s" : ""));
  if(st.rev) b.push(st.rev + " em revisão");
  if(st.ras) b.push(plural(st.ras, "rascunho"));
  return b.join(" · ");
}
function alertas(st){
  var a = [];
  if(st.venc) a.push('<span class="pl-al ruim">' + plural(st.venc, "revisão vencida", "revisões vencidas") + '</span>');
  if(st.riscoAlto) a.push('<span class="pl-al ruim">' + plural(st.riscoAlto, "risco alto sem controle", "riscos altos sem controle") + '</span>');
  if(st.essNaoLido) a.push('<span class="pl-al info">' + plural(st.essNaoLido, "essencial para você ler", "essenciais para você ler") + '</span>');
  return a.length ? '<div class="pl-als">' + a.join("") + '</div>' : "";
}
function barra(st){ return '<span class="pl-barra" aria-hidden="true"><i class="a" style="flex:' + st.apr + '"></i><i class="r" style="flex:' + st.rev + '"></i><i class="s" style="flex:' + st.ras + '"></i></span>'; }
function saude(st){
  if(!st.n) return "";
  var pct = Math.round(st.apr / st.n * 100), C = 2 * Math.PI * 18;
  return '<div class="pl-saude"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="tr" cx="22" cy="22" r="18"/><circle class="vl" cx="22" cy="22" r="18" stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 22 22)"/></svg>' +
    '<div class="pl-saude-n"><b>' + pct + '%</b><small>aprovados</small></div><div class="pl-saude-d">' + barra(st) + '<span>' + resumoSt(st) + '</span></div></div>';
}
function mostrarDica(no, px, py){
  if(!no){ dica.hidden = true; cv.style.cursor = "grab"; return; }
  cv.style.cursor = "pointer";
  var h;
  if(no.nivel === "mini") h = '<small>Mini globo</small><b>Onde você está no planeta</b><small>clique para ver o planeta inteiro</small>';
  else if(no.nivel === "sis") h = '<small>Sistema em órbita</small><b>' + esc(no.nome) + '</b><span>usado em ' + plural(no.pops.length, "POP") + ' de ' + plural(no.cidades.length, "tarefa") + '</span><small>clique para ver onde é usado</small>';
  else if(no.nivel === "passo"){
    var pp = no.pop, ps = pp.passos[no.i];
    h = '<small>Passo ' + (no.i + 1) + ' de ' + pp.passos.length + (ps.tipo === "decisao" ? ' · decisão' : '') + '</small><b>' + esc(ps.texto) + '</b>' + (ps.resp ? '<span>Responsável: ' + esc(ps.resp) + '</span>' : '') + '<span>' + esc((pp.codigo ? pp.codigo + " · " : "") + pp.titulo) + '</span><small>clique para abrir o procedimento</small>';
  }
  else if(no.nivel === "pop"){
    var p = no.pop;
    h = '<small>Procedimento</small><b>' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '</b><span>' + esc(ROT_ST[p.status] || p.status) + ' · ' + plural(p.passos.length, "passo") + (p.variacao ? ' · método ' + esc(p.variacao) : '') + '</span>' +
      (p.passos.length ? '<ol>' + p.passos.slice(0, 4).map(function(s){ return '<li>' + esc(corta(s.texto, 70)) + '</li>'; }).join("") + (p.passos.length > 4 ? '<li class="mais">mais ' + (p.passos.length - 4) + '…</li>' : '') + '</ol>' : '') + '<small>clique para abrir o procedimento</small>';
  } else {
    var nome = no.nivel === "dep" ? no.sigla + " · " + no.nome : no.nome;
    h = '<small>' + ROT_NV[no.nivel] + '</small><b>' + esc(nome) + '</b>' + (no.vazio ? '<span>Ainda sem POP mapeado.</span>' : barra(no.st) + '<span>' + resumoSt(no.st) + '</span>' + alertas(no.st)) + '<small>clique para ' + (no.nivel === "ta" ? "ver os procedimentos" : "aproximar") + '</small>';
  }
  dica.innerHTML = h; dica.hidden = false;
  posDica(px, py);
}
function posDica(px, py){
  var x = px + 18, y = py + 18, w = 280, a = dica.offsetHeight || 150;
  if(x + w > W) x = px - w - 12; if(y + a > H) y = py - a - 12;
  dica.style.left = Math.max(6, x) + "px"; dica.style.top = Math.max(6, y) + "px";
}
function conexoes(no){
  var rec = [], ent = [], v = {};
  MUNDO.arcos.forEach(function(ar){
    var d = ehDentro(ar.de, no), p = ehDentro(ar.para, no);
    if(d === p) return;
    var outro = d ? ar.para : ar.de, k = (d ? ">" : "<") + chaveDe(outro); if(v[k]) return; v[k] = 1;
    (d ? ent : rec).push(outro);
  });
  if(!rec.length && !ent.length) return "";
  var lin = function(o, seta, txt){ return '<button type="button" class="pl-lin pl-cx" data-pl="' + esc(chaveDe(o)) + '"><span class="pl-seta">' + seta + '</span><span class="pl-lin-n">' + esc(o.nome) + '<small>' + txt + ' · ' + esc(contDe(o).nome) + '</small></span></button>'; };
  return '<div class="pl-sec"><h4>Conexões <span>(do SIPOC)</span></h4>' + rec.map(function(o){ return lin(o, "←", "recebe de"); }).join("") + ent.map(function(o){ return lin(o, "→", "entrega para"); }).join("") + '</div>';
}
function trilhaPara(m){
  if(!elTrilha) return;
  var f = focoDe(m), no = f && f.no, ps = [], n = no;
  while(n){ ps.unshift(n); n = pai(n); }
  elTrilha.innerHTML = '<button type="button" data-pl-casa>Planeta</button>' + ps.map(function(p, i){ return '<i>›</i>' + (i === ps.length - 1 ? '<b>' + esc(p.nome) + '</b>' : '<button type="button" data-pl="' + esc(chaveDe(p)) + '">' + esc(p.nome) + '</button>'); }).join("");
}
function painelSistema(s){
  painel.innerHTML = '<div class="pl-cab"><small>Sistema em órbita</small><b>' + esc(s.nome) + '</b><span>usado em ' + plural(s.pops.length, "POP") + ' de ' + plural(s.cidades.length, "tarefa") + '</span></div>' +
    '<div class="pl-bts"><button type="button" class="fbtn" data-pl-sis="' + esc(s.key) + '">Fechar</button></div>' +
    '<div class="pl-sec"><h4>Procedimentos que usam</h4>' + s.pops.slice().sort(function(a, b){ return a.titulo.localeCompare(b.titulo, "pt-BR"); }).map(function(p){
      return '<button type="button" class="pl-lin pl-cx" data-ir="' + esc(p.id) + '"><span class="pl-pt" style="background:' + rgba(p.status === "aprovado" ? ST.apr : p.status === "revisao" ? ST.rev : ST.ras, 1) + '"></span><span class="pl-lin-n">' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '<small>' + esc([p.departamento, p.tarefa].filter(Boolean).join(" › ")) + '</small></span></button>';
    }).join("") + '</div>';
}
function painelPara(m){
  var f = focoDe(m), no = f && f.no;
  selNo = no || null;
  trilhaPara(m);
  if(sistemaSel && MUNDO.sisSel){ painelSistema(MUNDO.sisSel); return; }
  if(!no){
    var tot = {n: 0, apr: 0, rev: 0, ras: 0, venc: 0, riscoAlto: 0, essNaoLido: 0}, vaz = [];
    MUNDO.conts.forEach(function(c){ ["n", "apr", "rev", "ras", "venc", "riscoAlto", "essNaoLido"].forEach(function(k){ tot[k] += c.st[k]; }); if(c.vazio && c.oficial) vaz.push(c.nome); });
    painel.innerHTML = '<div class="pl-cab"><small>Visão do escritório</small><b>Planeta ControlTax</b>' + saude(tot) + alertas(tot) + '</div>' +
      '<div class="pl-sec"><h4>Continentes <span>(departamentos)</span></h4>' + MUNDO.conts.filter(function(c){ return !c.vazio; }).sort(function(a, b){ return b.st.n - a.st.n; }).map(function(c){ return linhaNo(c, c.sigla + " · " + c.nome, c.st); }).join("") + '</div>' +
      (MUNDO.sistemas.length ? '<div class="pl-sec"><h4>Sistemas em órbita</h4><div class="pl-chips">' + MUNDO.sistemas.slice(0, 12).map(function(s){ return '<button type="button" class="pl-chip" data-pl-sis="' + esc(s.key) + '">' + esc(s.nome) + '<b>' + s.pops.length + '</b></button>'; }).join("") + '</div></div>' : '') +
      (vaz.length ? '<div class="pl-sec"><h4>Terra a mapear</h4><p class="pl-nota">Departamentos ainda sem nenhum POP: ' + esc(vaz.join(", ")) + '.</p>' + (API.podeEditar() ? '<div class="pl-bts">' + vaz.slice(0, 4).map(function(d){ return '<button type="button" class="fbtn" data-novo-dep="' + esc(d) + '">Mapear ' + esc(d) + '</button>'; }).join("") + '</div>' : '') + '</div>' : '');
    return;
  }
  var titulo = no.nivel === "dep" ? no.sigla + " · " + no.nome : no.nome;
  var h = '<div class="pl-cab" style="--cor:' + rgba(contDe(no).neon, 1) + '"><small>' + ROT_NV[no.nivel] + '</small><b>' + esc(titulo) + '</b>' + (no.vazio ? '<span>Ainda sem POP mapeado.</span>' : saude(no.st) + alertas(no.st)) + '</div>';
  if(no.vazio){ h += API.podeEditar() ? '<div class="pl-bts"><button type="button" class="btn" data-novo-dep="' + esc(no.nome) + '">Mapear o primeiro processo</button></div>' : '<p class="pl-nota">Este departamento ainda não tem procedimentos mapeados.</p>'; painel.innerHTML = h; return; }
  if(no.nivel === "ta"){
    h += Object.keys(no.cens).sort(function(a, b){ return a === "Padrão" ? -1 : b === "Padrão" ? 1 : a.localeCompare(b, "pt-BR"); }).map(function(ce){
      return '<div class="pl-sec"><h4>Cenário <span>' + esc(ce) + '</span></h4>' + no.cens[ce].map(function(p){
        var l = API.lidoInfo(p.id), lido = l && l.v === p.versao;
        return '<div class="pl-pop st-' + p.status + '"><div class="pl-pop-t"><span class="pl-st st-' + p.status + '">' + esc(ROT_ST[p.status] || p.status) + '</span>' + (API.vencida(p) ? '<span class="pl-al ruim">revisão vencida</span>' : '') + (p.essencial ? '<span class="pl-al info">' + (lido ? "essencial · lido" : "essencial") + '</span>' : '') + '</div>' +
          '<b>' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '</b><small>' + plural(p.passos.length, "passo") + (p.frequencia ? ' · ' + esc(p.frequencia) : '') + (p.tempoMedio ? ' · ' + esc(p.tempoMedio) : '') + (p.variacao ? ' · método ' + esc(p.variacao) : '') + '</small>' +
          '<div class="pl-bts"><button type="button" class="btn" data-ver="' + esc(p.id) + '">Ler</button><button type="button" class="fbtn" data-exec="' + esc(p.id) + '">Executar passo a passo</button></div></div>';
      }).join("") + '</div>';
    }).join("");
  } else {
    var filhos = no.filhos.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    h += '<div class="pl-sec"><h4>' + ({dep: "Setores", set: "Atividades", at: "Tarefas"})[no.nivel] + '</h4>' + filhos.map(function(x){ return linhaNo(x, x.nome, x.st); }).join("") + '</div>';
  }
  h += conexoes(no);
  painel.innerHTML = h;
}
function linhaNo(no, txt, st){
  return '<button type="button" class="pl-lin" data-pl="' + esc(chaveDe(no)) + '"><span class="pl-pt" style="background:' + rgba(corSt(st), 1) + ';color:' + rgba(corSt(st), 1) + '"></span><span class="pl-lin-n">' + esc(txt) + barra(st) + '</span><span class="pl-lin-c">' + st.n + '</span></button>';
}
function noPorChave(key){
  var p = key.split("|"), nv = p[0], c = MUNDO.conts.filter(function(x){ return x.nome === p[1]; })[0]; if(!c) return null;
  if(nv === "dep") return c;
  var s = c.filhos.filter(function(x){ return x.nome === p[2]; })[0]; if(nv === "set" || !s) return s;
  var a = s.filhos.filter(function(x){ return x.nome === p[3]; })[0]; if(nv === "at" || !a) return a;
  return a.filhos.filter(function(x){ return x.nome === p[4]; })[0];
}

/* ---------- busca que voa ---------- */
function renderBusca(q){
  var box = buscaBox.querySelector(".pl-res");
  if(!q.trim()){ box.hidden = true; box.innerHTML = ""; return; }
  var rs = API.buscar(q).slice(0, 8);
  box.hidden = false;
  box.innerHTML = rs.length ? rs.map(function(r, i){ var p = r.p; return '<button type="button" class="pl-r" data-ir="' + esc(p.id) + '"' + (i ? '' : ' data-primeiro') + '><b>' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '</b><small>' + esc([p.departamento, p.setor, p.atividade, p.tarefa].filter(Boolean).join(" › ")) + '</small></button>'; }).join("") : '<div class="pl-r vz">Nada encontrado.</div>';
}
function voarParaPop(id){
  var p = API.pop(id); if(!p) return;
  sistemaSel = ""; MUNDO.sisSel = null;
  var m = {dep: p.departamento, set: p.setor || "(sem setor)", at: p.atividade || "(sem atividade)", ta: p.tarefa || "(sem tarefa)"};
  ultimoFoco = JSON.stringify(m); API.navegar(m);
  var f = focoDe(m); if(f) voar(f.lon, f.lat, Math.max(f.k, 90), 1200);
  painelPara(m);
  buscaBox.querySelector("input").value = ""; renderBusca("");
}

/* ---------- tour: passeio automático pelos continentes ---------- */
function iniciarTour(){
  var conts = MUNDO.conts.filter(function(c){ return !c.vazio; }).sort(function(a, b){ return b.st.n - a.st.n; });
  if(!conts.length) return;
  var passos = [];
  conts.forEach(function(c){
    passos.push(c);
    var maior = null; MUNDO.cidades.forEach(function(ci){ if(contDe(ci) === c && (!maior || ci.st.n > maior.st.n)) maior = ci; });
    if(maior) passos.push(maior);
  });
  tour = {i: -1, passos: passos, id: 0}; passoTour();
}
function passoTour(){
  if(!tour) return;
  tour.i++;
  if(tour.i >= tour.passos.length){ pararTour(); casa(); return; }
  var no = tour.passos[tour.i];
  escolher(no); ultimoToque = performance.now();
  tour.id = setTimeout(passoTour, no.nivel === "dep" ? 4300 : 5400);
  botaoTour();
}
function pararTour(){ if(!tour) return; clearTimeout(tour.id); tour = null; botaoTour(); }
function botaoTour(){
  if(!elTour) return;
  elTour.classList.toggle("on", !!tour);
  elTour.innerHTML = tour ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>Parar ' + (tour.i + 1) + '/' + tour.passos.length : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Tour';
  elTour.title = tour ? "Parar o passeio" : "Passeio automático pelos departamentos";
}

/* ---------- montagem ---------- */
function montar(){
  raiz.innerHTML = '<div class="pl-palco"><canvas class="pl-cv" aria-label="Mapa-planeta dos processos. Use a roda do mouse para aproximar, arraste para girar, clique para entrar." role="img"></canvas><div class="pl-fx" aria-hidden="true"></div>' +
    '<div class="pl-topo"><div class="pl-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Voar até um procedimento…" aria-label="Buscar e voar até um procedimento" autocomplete="off"><div class="pl-res" hidden></div></div>' +
    '<div class="pl-ctl"><button type="button" class="pl-b pl-tour" data-pl-tour></button><button type="button" class="pl-b" data-pl-z="-1" title="Afastar (−)" aria-label="Afastar">−</button><button type="button" class="pl-b" data-pl-z="1" title="Aproximar (+)" aria-label="Aproximar">+</button>' +
    '<button type="button" class="pl-b" data-pl-casa title="Ver o planeta inteiro (Home)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/></svg>Planeta</button>' +
    '<button type="button" class="pl-b" data-pl-cheia title="Tela cheia" aria-label="Tela cheia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div></div>' +
    '<nav class="pl-trilha" aria-label="Onde você está"></nav>' +
    '<div class="pl-niveis" role="group" aria-label="Nível de zoom">' + NIVEIS.map(function(n, i){ return '<button type="button" class="pl-nv" data-pl-n="' + i + '" title="Ir para o nível ' + n + '"><span>' + n + '</span><i></i></button>'; }).join("") + '</div>' +
    '<div class="pl-leg" aria-hidden="true"><span><i style="background:' + rgba(ST.apr, 1) + '"></i>aprovado</span><span><i style="background:' + rgba(ST.rev, 1) + '"></i>em revisão</span><span><i style="background:' + rgba(ST.ras, 1) + '"></i>rascunho</span><span><i style="background:' + rgba(ST.venc, 1) + '"></i>revisão vencida</span><span><b class="pl-flag"></b>essencial a ler</span><span><b class="pl-tri">!</b>risco alto sem controle</span><span><b class="pl-arc"></b>fluxo entre áreas</span><span><b class="pl-sat"></b>sistema</span></div>' +
    '<div class="pl-leitura" aria-hidden="true"></div>' +
    '<div class="pl-dica" hidden></div><div class="pl-ajuda">Roda: zoom · arrastar: girar · clique: entrar · Esc: voltar</div></div>' +
    '<aside class="pl-painel" aria-live="polite"></aside>';
  cv = raiz.querySelector("canvas"); ctx = cv.getContext("2d"); painel = raiz.querySelector(".pl-painel"); dica = raiz.querySelector(".pl-dica"); buscaBox = raiz.querySelector(".pl-busca");
  elNiveis = raiz.querySelector(".pl-niveis"); elLeitura = raiz.querySelector(".pl-leitura"); elTrilha = raiz.querySelector(".pl-trilha"); elTour = raiz.querySelector(".pl-tour");
  nivelAtual = -1; leituraAtual = ""; pontilhado = null; botaoTour();
  var palco = raiz.querySelector(".pl-palco");
  var medir = function(){ var r = palco.getBoundingClientRect(); if(!r.width) return; DPR = Math.min(window.devicePixelRatio || 1, 2); W = Math.max(200, r.width); H = Math.max(260, r.height); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; if(REDUZ) desenhar(); else { ligar(); desenhar(); } };
  if(window.ResizeObserver) new ResizeObserver(medir).observe(palco); else window.addEventListener("resize", medir);
  medir();
  var pos = function(e){ var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // arrastar (com embalo ao soltar) e pinça em tela de toque
  cv.addEventListener("pointerdown", function(e){
    toque(); pararTour(); pararMov();
    pontos[e.pointerId] = {x: e.clientX, y: e.clientY}; try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    var ids = Object.keys(pontos);
    if(ids.length === 2){ var a = pontos[ids[0]], b = pontos[ids[1]]; pin = {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: V.k}; arr = null; return; }
    arr = {x: e.clientX, y: e.clientY, lon: V.lon, lat: V.lat, moveu: false, vx: 0, vy: 0, t: performance.now(), ux: e.clientX, uy: e.clientY};
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", function(e){
    var p = pos(e); ponteiroDentro = true;
    if(pontos[e.pointerId]) pontos[e.pointerId] = {x: e.clientX, y: e.clientY};
    if(pin){
      var ids = Object.keys(pontos); if(ids.length < 2) return;
      var a = pontos[ids[0]], b = pontos[ids[1]]; V.k = clamp(pin.k * Math.hypot(a.x - b.x, a.y - b.y) / pin.d, 0.85, 260); toque(); pedirDesenho(); return;
    }
    if(arr){
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y, agora = performance.now(), dtm = (agora - arr.t) / 1000;
      if(Math.abs(dx) + Math.abs(dy) > 3) arr.moveu = true;
      if(dtm > 0.001){ arr.vx = arr.vx * 0.55 + (e.clientX - arr.ux) / dtm * 0.45; arr.vy = arr.vy * 0.55 + (e.clientY - arr.uy) / dtm * 0.45; }
      arr.t = agora; arr.ux = e.clientX; arr.uy = e.clientY;
      var R = R0() * V.k; V.lon = wrap(arr.lon - deg(dx / R)); V.lat = clamp(arr.lat + deg(dy / R), -70, 70); dica.hidden = true; toque(); pedirDesenho(); return;
    }
    var antes = hover; hover = noEm(p[0], p[1]);
    var mesmo = antes === hover || (antes && hover && antes.nivel === hover.nivel && antes.pop && antes.pop === hover.pop && antes.i === hover.i);
    if(!mesmo || dica.hidden) mostrarDica(hover, p[0], p[1]); else posDica(p[0], p[1]);
    if(!mesmo) pedirDesenho();
  });
  var soltar = function(e, clique){
    delete pontos[e.pointerId];
    if(pin){ if(Object.keys(pontos).length < 2) pin = null; return; }
    var a = arr; arr = null; cv.style.cursor = "grab";
    if(!a) return;
    if(a.moveu){ if(performance.now() - a.t < 90 && Math.hypot(a.vx, a.vy) > 140 && !REDUZ) inercia = {vx: clamp(a.vx, -3000, 3000), vy: clamp(a.vy, -3000, 3000)}; return; }
    if(!clique) return;
    var p = pos(e), no = noEm(p[0], p[1]);
    if(!no) return;
    if(no.nivel === "pop" || no.nivel === "passo"){ API.abrir(no.pop.id); return; }
    escolher(no);
  };
  cv.addEventListener("pointerup", function(e){ soltar(e, true); });
  cv.addEventListener("pointercancel", function(e){ soltar(e, false); });
  cv.addEventListener("pointerleave", function(){ ponteiroDentro = false; dica.hidden = true; if(hover){ hover = null; pedirDesenho(); } ultimoToque = performance.now(); });
  // roda: zoom suave, ancorado no cursor, com parada magnética no nível mais próximo
  cv.addEventListener("wheel", function(e){
    e.preventDefault(); toque(); pararTour(); anima = null; inercia = null;
    var p = pos(e), base = Z ? Z.k : V.k, f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : e.ctrlKey ? 0.012 : 0.0018));
    prepara();
    var alvo = clamp(base * f, 0.85, 260), geo = inversa(p[0], p[1]);
    if(REDUZ){ V.k = alvo; prepara(); ancorar(geo, p[0], p[1]); pedirDesenho(); }
    else Z = {k: alvo, px: p[0], py: p[1], geo: geo};
    dica.hidden = true;
    clearTimeout(tRoda);
    tRoda = setTimeout(function(){
      var kk = Z ? Z.k : V.k, par = PARADAS.reduce(function(m, s){ return Math.abs(Math.log(s / kk)) < Math.abs(Math.log(m / kk)) ? s : m; }, PARADAS[0]);
      if(Math.abs(Math.log(par / kk)) < 0.35 && Math.abs(par - kk) > 0.01){
        prepara(); var g2 = inversa(p[0], p[1]);
        if(REDUZ){ V.k = par; prepara(); ancorar(g2, p[0], p[1]); pedirDesenho(); } else { Z = {k: par, px: p[0], py: p[1], geo: g2}; ligar(); }
      }
    }, 240);
  }, {passive: false});
  // botões, painel e teclado
  raiz.addEventListener("click", function(e){
    var b;
    if((b = e.target.closest("[data-pl-tour]"))){ toque(); if(tour) pararTour(); else iniciarTour(); return; }
    if(e.target.closest(".pl-cv")) return;
    toque(); pararTour();
    if((b = e.target.closest("[data-pl-z]"))){ var k = V.k * (b.getAttribute("data-pl-z") === "1" ? 2 : 0.5); voar(V.lon, V.lat, clamp(k, 0.85, 260), 380); return; }
    if((b = e.target.closest("[data-pl-n]"))){ voar(V.lon, V.lat, PARADAS[+b.getAttribute("data-pl-n")], 650); return; }
    if((b = e.target.closest("[data-pl-casa]"))){ casa(); return; }
    if((b = e.target.closest("[data-pl-cheia]"))){ telaCheia(!raiz.classList.contains("cheia")); return; }
    if((b = e.target.closest("[data-pl-sis]"))){ var s = MUNDO.sistemas.filter(function(x){ return x.key === b.getAttribute("data-pl-sis"); })[0]; if(s){ escolherSistema(s); if(sistemaSel && V.k > 1.4) voar(V.lon, V.lat, 1, 800); } return; }
    if((b = e.target.closest("[data-pl]"))){ var no = noPorChave(b.getAttribute("data-pl")); destaque = null; if(no) escolher(no); return; }
    if((b = e.target.closest("[data-ir]"))){ voarParaPop(b.getAttribute("data-ir")); return; }
  });
  // passar o mouse numa linha do painel mostra o lugar no mapa
  painel.addEventListener("mouseover", function(e){ var b = e.target.closest("[data-pl]"), no = b ? noPorChave(b.getAttribute("data-pl")) : null; if(no !== destaque){ destaque = no; pedirDesenho(); } });
  painel.addEventListener("mouseleave", function(){ if(destaque){ destaque = null; pedirDesenho(); } });
  var inp = buscaBox.querySelector("input");
  inp.addEventListener("input", function(){ renderBusca(this.value); });
  inp.addEventListener("keydown", function(e){ if(e.key === "Enter"){ var b = buscaBox.querySelector("[data-primeiro]"); if(b) b.click(); } if(e.key === "Escape"){ this.value = ""; renderBusca(""); } e.stopPropagation(); });
  raiz.tabIndex = 0;
  raiz.addEventListener("keydown", function(e){
    if(e.target.tagName === "INPUT") return;
    toque(); pararTour();
    if(e.key === "Home"){ e.preventDefault(); casa(); }
    else if(e.key === "Escape"){ e.preventDefault(); if(sistemaSel){ sistemaSel = ""; MUNDO.sisSel = null; painelPara(API.S().mapa); pedirDesenho(); } else if(!API.S().mapa.dep && raiz.classList.contains("cheia")) telaCheia(false); else subir(); }
    else if(e.key === "+" || e.key === "="){ voar(V.lon, V.lat, clamp(V.k * 2, 0.85, 260), 320); }
    else if(e.key === "-"){ voar(V.lon, V.lat, clamp(V.k / 2, 0.85, 260), 320); }
    else if(e.key === "f" || e.key === "F"){ telaCheia(!raiz.classList.contains("cheia")); }
    else if(/^Arrow/.test(e.key)){ e.preventDefault(); pararMov(); var d = 60 / (R0() * V.k); if(e.key === "ArrowLeft") V.lon = wrap(V.lon - deg(d)); if(e.key === "ArrowRight") V.lon = wrap(V.lon + deg(d)); if(e.key === "ArrowUp") V.lat = clamp(V.lat + deg(d), -70, 70); if(e.key === "ArrowDown") V.lat = clamp(V.lat - deg(d), -70, 70); pedirDesenho(); }
  });
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) ligar(); });
}
function telaCheia(sim){
  raiz.classList.toggle("cheia", sim);
  var b = raiz.querySelector("[data-pl-cheia]");
  if(b){ b.title = sim ? "Sair da tela cheia (Esc)" : "Tela cheia"; b.setAttribute("aria-label", b.title); b.classList.toggle("on", sim); }
  try{ raiz.focus({preventScroll: true}); }catch(_){}
}
function casa(){
  var m = {dep: "", set: "", at: "", ta: ""}; ultimoFoco = JSON.stringify(m); sistemaSel = ""; MUNDO.sisSel = null; API.navegar(m);
  var c = MUNDO.conts.filter(function(x){ return x.nome === API.meuDep(); })[0];
  voar(c ? c.lon : 0, c ? c.lat : 10, 1, 900); painelPara(m);
}
function subir(){
  var m = JSON.parse(JSON.stringify(API.S().mapa));
  if(m.ta) m.ta = ""; else if(m.at) m.at = ""; else if(m.set) m.set = ""; else if(m.dep) m.dep = ""; else return;
  // pula de volta os níveis de um filho só (como as colunas fazem ao descer)
  var c = m.dep && MUNDO.conts.filter(function(x){ return x.nome === m.dep; })[0];
  if(m.at && !m.ta){ var s1 = c && c.filhos.filter(function(x){ return x.nome === m.set; })[0], a1 = s1 && s1.filhos.filter(function(x){ return x.nome === m.at; })[0]; if(a1 && a1.filhos.length === 1) m.at = ""; }
  if(m.set && !m.at && !m.ta){ var s2 = c && c.filhos.filter(function(x){ return x.nome === m.set; })[0]; if(s2 && s2.filhos.length === 1) m.set = ""; }
  ultimoFoco = JSON.stringify(m); API.navegar(m);
  if(!m.dep){ casa(); return; }
  irPara(m); painelPara(m);
}

/* ---------- entrada chamada pelo pop.js ---------- */
window.PopPlaneta = {
  _medir: function(n){ var t0 = performance.now(); for(var i = 0; i < n; i++) desenhar(); return (performance.now() - t0) / n; },
  render: function(api, el){
    API = api;
    var novo = raiz !== el || !el.querySelector(".pl-palco");
    if(novo){ raiz = el; montar(); }
    var t = API.arvore(), sig = JSON.stringify(Object.keys(t).map(function(d){ return [d, popsDe(t[d]).map(function(p){ return p.id + p.status + p.versao + (p.proxRevisao || "") + p.setor + p.atividade + p.tarefa + p.cenario + p.passos.length + (p.sistemas || []).join("|") + (p.fornecedores || []).join("|") + (p.clientes || []).join("|"); }).join(",")]; }));
    if(sig !== assinatura){
      MUNDO = montarMundo(t); assinatura = sig; hover = null; destaque = null;
      if(sistemaSel){ MUNDO.sisSel = MUNDO.sistemas.filter(function(s){ return s.key === sistemaSel; })[0] || null; if(!MUNDO.sisSel) sistemaSel = ""; }
    }
    var m = API.S().mapa, fk = JSON.stringify(m);
    if(novo){
      var c0 = CASAS[API.meuDep()] || [0, 10];
      ultimoFoco = fk;
      if(m.dep) irPara(m, 0);
      else if(REDUZ){ V.lon = c0[0]; V.lat = c0[1]; V.k = 1; }
      else { intro = {t0: performance.now(), lon: c0[0], lat: c0[1]}; V.lon = c0[0] - 95; V.lat = c0[1] + 14; V.k = 0.5; }
    } else if(fk !== ultimoFoco){ ultimoFoco = fk; if(m.dep) irPara(m, 850); else if(V.k > 1.2) casa(); }
    painelPara(m);
    ultimoToque = performance.now();
    pedirDesenho();
  }
};
})();
