(function(){
"use strict";
/* POP Master · modo Planeta do Mapa de processos.
   Globo que vira mapa: de longe é um planeta (projeção ortográfica com luz); com a roda do mouse ele se desenrola
   num mapa plano (equirretangular) e o zoom segue até cada processo.
   Departamento = continente · Setor = país · Atividade = região · Tarefa = cidade · Cenário/POP = linhas que saem da cidade.
   A geografia é calculada dos dados de forma determinística (mesmos dados, mesmo mapa).
   Carregado sob demanda por pop.js, que passa a API em window.__popApi. */

var API = null, raiz = null, cv = null, ctx = null, painel = null, dica = null, buscaBox = null;
var W = 0, H = 0, DPR = 1;
var V = {lon: 0, lat: 10, k: 1};            // centro da vista e zoom (1 = globo inteiro)
var MUNDO = null, assinatura = "", ultimoFoco = "", hover = null, anima = null, tRoda = 0, desenhoPendente = false;
var REDUZ = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var PARADAS = [1, 3.4, 10, 28, 80, 200];

/* ---------- utilidades ---------- */
function hash(s){ var h = 2166136261; s = String(s); for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function rad(d){ return d * Math.PI / 180; }
function deg(r){ return r * 180 / Math.PI; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function suave(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function wrap(l){ while(l > 180) l -= 360; while(l < -180) l += 360; return l; }
function esc(s){ return API.esc(s); }
function plural(n, s, p){ return n + " " + (n === 1 ? s : (p || s + "s")); }
function cssVar(n, d){ var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }
function escuro(){ var t = document.documentElement.getAttribute("data-theme"); if(t === "dark") return true; if(t === "light") return false; return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
function mistura(hex, alvo, f){
  var a = parseInt(hex.slice(1), 16), b = parseInt(alvo.slice(1), 16);
  var r = Math.round(((a >> 16) & 255) * f + ((b >> 16) & 255) * (1 - f)), g = Math.round(((a >> 8) & 255) * f + ((b >> 8) & 255) * (1 - f)), bl = Math.round((a & 255) * f + (b & 255) * (1 - f));
  return "rgb(" + r + "," + g + "," + bl + ")";
}

/* ---------- posições fixas dos continentes (vizinhança por afinidade) ---------- */
var CASAS = {
  "Contábil": [0, 6], "Fiscal": [-34, 20], "Fiscal Simples Nacional": [-44, -12], "Pessoal": [34, 18], "Gestão de Pessoas": [52, -10],
  "Societário": [6, -30], "Financeiro": [-12, 44], "Comercial": [26, 46], "TI": [96, 12], "Inovação": [118, -22], "Projetos": [92, 42]
};
var VAGAS = [[-100, 18], [-120, -20], [160, 8], [-160, 30], [140, -30], [-80, -40]];

/* ---------- geometria no plano local de cada continente (graus "achatados") ---------- */
function paraGeo(c, x, y){ return [wrap(c.lon + x / Math.cos(rad(c.lat))), c.lat + y]; }
function blob(R, sem, n){
  var h1 = hash(sem + "a") * 6.28, h2 = hash(sem + "b") * 6.28, h3 = hash(sem + "c") * 6.28, pts = [];
  for(var i = 0; i < n; i++){
    var a = i / n * Math.PI * 2, r = R * (1 + 0.16 * Math.sin(3 * a + h1) + 0.09 * Math.sin(5 * a + h2) + 0.05 * Math.sin(9 * a + h3));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
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
function distMin(seeds, i, padrao){ var m = padrao; seeds.forEach(function(o, j){ if(j !== i){ var d = Math.hypot(o[0] - seeds[i][0], o[1] - seeds[i][1]); if(d < m) m = d; } }); return m; }

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

/* ---------- monta o mundo a partir da árvore do POP Master ---------- */
function montarMundo(t){
  var deps = API.DEPS.map(function(d){ return d.n; }).concat(Object.keys(t).filter(function(d){ return !API.DEP[d]; }));
  var vaga = 0, mundo = {conts: []};
  deps.forEach(function(dn){
    var sub = t[dn] || {}, pops = popsDe(sub), st = stats(pops);
    var casa = CASAS[dn] || VAGAS[vaga++ % VAGAS.length];
    var R = pops.length ? clamp(7 + 3.2 * Math.sqrt(pops.length), 8, 19) : 5.5;
    var c = {nivel: "dep", nome: dn, sigla: (API.DEP[dn] && API.DEP[dn].s) || dn.slice(0, 3).toUpperCase(), lon: casa[0], lat: casa[1], R: R, cor: API.depCor(dn), st: st, vazio: !pops.length, oficial: !!API.DEP[dn], filhos: []};
    c.forma = blob(R, dn, 72);
    var setores = ordemNasc(sub), sSeeds = girassol(setores.length, R * 0.62, hash(dn) * 6.28);
    setores.forEach(function(so, i){
      var sNo = sub[so.k], raio = setores.length === 1 ? R * 0.7 : distMin(sSeeds, i, R) * 0.5;
      var s = {nivel: "set", nome: so.k, dep: c, x: sSeeds[i][0], y: sSeeds[i][1], st: so.st, filhos: [], cel: celula(sSeeds, i, R * 1.4)};
      var ats = ordemNasc(sNo), aSeeds = girassol(ats.length, raio, hash(dn + so.k) * 6.28).map(function(p){ return [p[0] + s.x, p[1] + s.y]; });
      ats.forEach(function(ao, j){
        var aNo = sNo[ao.k], raioA = ats.length === 1 ? raio * 0.7 : distMin(aSeeds, j, raio) * 0.45;
        var a = {nivel: "at", nome: ao.k, set: s, x: aSeeds[j][0], y: aSeeds[j][1], st: ao.st, filhos: [], cel: celula(aSeeds, j, R * 1.4)};
        var tas = ordemNasc(aNo), tSeeds = girassol(tas.length, raioA, hash(dn + so.k + ao.k) * 6.28).map(function(p){ return [p[0] + a.x, p[1] + a.y]; });
        tas.forEach(function(to, m){
          var cens = aNo[to.k], ps = popsDe(cens);
          a.filhos.push({nivel: "ta", nome: to.k, at: a, x: tSeeds[m][0], y: tSeeds[m][1], st: to.st, cens: cens, pops: ps});
        });
        s.filhos.push(a);
      });
      c.filhos.push(s);
    });
    mundo.conts.push(c);
  });
  return mundo;
}
function geoDe(c, x, y){ return paraGeo(c, x, y); }

/* ---------- projeção: ortográfica (globo) que se desenrola em equirretangular (mapa) ---------- */
function R0(){ return Math.min(W, H) * 0.4; }
function tDesenrolar(){ return suave(1.5, 3.4, V.k); }
function proj(lon, lat){
  var R = R0() * V.k, t = tDesenrolar(), cx = W / 2, cy = H / 2;
  var l = rad(wrap(lon - V.lon)), f = rad(lat), f0 = rad(V.lat);
  var cosc = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l);
  var ox = R * Math.cos(f) * Math.sin(l), oy = -R * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l));
  var ex = R * l, ey = -R * (f - f0);
  return {x: cx + ox * (1 - t) + ex * t, y: cy + oy * (1 - t) + ey * t, vis: t > 0.55 || cosc > 0.02};
}
function inversa(px, py){
  var R = R0() * V.k, t = tDesenrolar(), x = px - W / 2, y = py - H / 2;
  if(t >= 0.5) return [wrap(V.lon + deg(x / R)), clamp(V.lat - deg(y / R), -89, 89)];
  var rho = Math.hypot(x, y); if(rho > R) return null;
  var c = Math.asin(rho / R), f0 = rad(V.lat), ny = -y;
  var lat = rho ? Math.asin(Math.cos(c) * Math.sin(f0) + ny * Math.sin(c) * Math.cos(f0) / rho) : f0;
  var lon = rad(V.lon) + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(f0) - ny * Math.sin(c) * Math.sin(f0));
  return [wrap(deg(lon)), deg(lat)];
}

/* ---------- cores ---------- */
function paleta(){
  var dk = escuro();
  return dk ? {mar: "#0D1822", mar2: "#132634", terraBase: "#1B252E", tinta: 0.42, borda: "rgba(232,237,242,.55)", texto: "#E8EDF2", halo: "rgba(11,16,21,.85)", sub: "#9AA8B4", atm: "rgba(107,178,225,.30)", grade: "rgba(140,198,236,.10)", incog: "rgba(232,237,242,.35)", fundo: "#0B1015"}
            : {mar: "#DCE9F4", mar2: "#C9DCEC", terraBase: "#F6F1E4", tinta: 0.30, borda: "rgba(16,24,32,.45)", texto: "#101820", halo: "rgba(255,255,255,.9)", sub: "#5F6D77", atm: "rgba(60,101,155,.22)", grade: "rgba(60,101,155,.10)", incog: "rgba(16,24,32,.35)", fundo: "transparent"};
}

/* ---------- desenho ---------- */
function caminhoGeo(c, pts, fechar){
  ctx.beginPath();
  var ok = false;
  pts.forEach(function(p, i){
    var g = geoDe(c, p[0], p[1]), q = proj(g[0], g[1]);
    if(!q.vis){ ok = false; return; }
    if(!ok){ ctx.moveTo(q.x, q.y); ok = true; } else ctx.lineTo(q.x, q.y);
  });
  if(fechar) ctx.closePath();
}
function visivelCont(c){ var q = proj(c.lon, c.lat); return q.vis; }
function rotulo(txt, x, y, o){
  o = o || {};
  ctx.font = (o.peso || 600) + " " + (o.tam || 12) + "px " + (o.fonte || "'IBM Plex Sans', system-ui, sans-serif");
  var w = ctx.measureText(txt).width, h = (o.tam || 12) + 4, r = {x: x - w / 2 - 3, y: y - h / 2, w: w + 6, h: h};
  if(!o.forca && rotulos.some(function(b){ return r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y; })) return false;
  rotulos.push(r);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 3.5; ctx.strokeStyle = P.halo; ctx.lineJoin = "round"; ctx.strokeText(txt, x, y);
  ctx.fillStyle = o.cor || P.texto; ctx.fillText(txt, x, y);
  return true;
}
var rotulos = [], P = null, alvos = [];

function desenhar(){
  desenhoPendente = false;
  if(!ctx || !MUNDO) return;
  P = paleta(); rotulos = []; alvos = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  var t = tDesenrolar(), R = R0() * V.k, cx = W / 2, cy = H / 2;
  // fundo: estrelas no escuro
  if(escuro() && t < 1){
    ctx.globalAlpha = 1 - t;
    for(var i = 0; i < 90; i++){ var sx = hash("x" + i) * W, sy = hash("y" + i) * H, sr = hash("r" + i) * 1.3 + 0.2; ctx.fillStyle = "rgba(232,237,242," + (0.25 + hash("a" + i) * 0.5) + ")"; ctx.fillRect(sx, sy, sr, sr); }
    ctx.globalAlpha = 1;
  }
  // oceano
  ctx.save();
  if(t < 0.98){
    var g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.12);
    g.addColorStop(0, P.atm); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 1 - t; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // o mar do mapa plano vai aparecendo enquanto o globo se desenrola
    if(t > 0.02){ ctx.globalAlpha = t; ctx.fillStyle = P.mar; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = P.mar; ctx.fill();
    if(t < 0.02) ctx.clip();
  } else { ctx.fillStyle = P.mar; ctx.fillRect(0, 0, W, H); }
  // grade de meridianos e paralelos
  ctx.strokeStyle = P.grade; ctx.lineWidth = 1;
  for(var lo = -180; lo < 180; lo += 30){ linhaGeo(function(s){ return [lo, -80 + 160 * s]; }); }
  for(var la = -60; la <= 60; la += 30){ linhaGeo(function(s){ return [-180 + 360 * s, la]; }); }
  // continentes
  MUNDO.conts.forEach(function(c){ desenharCont(c); });
  // luz do globo
  if(t < 0.98){
    var lz = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    lz.addColorStop(0, "rgba(255,255,255," + (escuro() ? 0.06 : 0.22) + ")"); lz.addColorStop(0.6, "rgba(255,255,255,0)"); lz.addColorStop(1, "rgba(0,0,0," + (escuro() ? 0.45 : 0.18) + ")");
    ctx.globalAlpha = 1 - t; ctx.fillStyle = lz; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  ctx.restore();
  // rótulos por cima (ordem de importância)
  desenharRotulos();
}
function linhaGeo(f){
  ctx.beginPath(); var ok = false;
  for(var i = 0; i <= 48; i++){ var g = f(i / 48), q = proj(g[0], g[1]); if(!q.vis){ ok = false; continue; } if(!ok){ ctx.moveTo(q.x, q.y); ok = true; } else ctx.lineTo(q.x, q.y); }
  ctx.stroke();
}
function desenharCont(c){
  if(!visivelCont(c) && tDesenrolar() < 0.55) return;
  var terra = c.vazio ? P.terraBase : mistura(c.cor, escuro() ? P.terraBase : "#F6F1E4", P.tinta);
  ctx.save();
  caminhoGeo(c, c.forma, true);
  ctx.fillStyle = terra; ctx.fill();
  ctx.lineWidth = c.vazio ? 1.2 : 1.6; ctx.strokeStyle = c.vazio ? P.incog : mistura(c.cor, "#000000", 0.75);
  if(c.vazio) ctx.setLineDash([5, 4]);
  ctx.stroke(); ctx.setLineDash([]);
  if(!c.vazio && V.k > 2.2){
    ctx.clip();
    var tons = [0.10, 0.20, 0.04, 0.16, 0.26, 0.08];
    c.filhos.forEach(function(s, i){
      caminhoGeo(c, s.cel, true);
      ctx.fillStyle = mistura(c.cor, escuro() ? P.terraBase : "#F6F1E4", P.tinta + tons[i % tons.length]); ctx.fill();
      ctx.lineWidth = 1.1; ctx.strokeStyle = P.borda; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      if(V.k > 7){
        ctx.save(); caminhoGeo(c, s.cel, true); ctx.clip();
        s.filhos.forEach(function(a){
          if(s.filhos.length > 1){ caminhoGeo(c, a.cel, true); ctx.lineWidth = 0.8; ctx.strokeStyle = P.borda; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]); }
        });
        ctx.restore();
      }
    });
  }
  ctx.restore();
  // cidades
  if(!c.vazio && V.k > 5) c.filhos.forEach(function(s){ s.filhos.forEach(function(a){ a.filhos.forEach(function(ci){ desenharCidade(c, ci); }); }); });
  // alvo do continente para clique e dica
  alvos.push({no: c});
}
function corStatus(st){ return st.venc ? "#C2000C" : st.rev ? "#B5530C" : st.ras && !st.apr ? "#8A97A3" : "#167A45"; }
function desenharCidade(c, ci){
  var g = geoDe(c, ci.x, ci.y), q = proj(g[0], g[1]); if(!q.vis) return;
  if(q.x < -40 || q.y < -40 || q.x > W + 40 || q.y > H + 40) return;
  ci._q = q;
  var r = clamp(2.5 + Math.sqrt(ci.st.n) * 1.6 + (V.k - 5) * 0.08, 3, 11);
  // linhas dos POPs (metrô) quando bem perto
  if(V.k > 40){
    var n = ci.pops.length, compr = clamp((V.k - 40) * 0.9, 18, 120);
    ci.pops.forEach(function(p, i){
      var ang = -Math.PI / 2 + (i - (n - 1) / 2) * (n > 1 ? Math.min(0.9, 2.6 / n) : 0) + (i % 2 ? 0.0 : 0), passos = p.passos.length || 1;
      var L = compr * (0.6 + Math.min(passos, 14) / 20), ex = q.x + Math.cos(ang) * L, ey = q.y + Math.sin(ang) * L;
      ctx.strokeStyle = p.status === "aprovado" ? mistura(c.cor, "#000000", 0.85) : p.status === "revisao" ? "#B5530C" : "#8A97A3";
      ctx.lineWidth = 3; ctx.setLineDash(p.status === "rascunho" ? [4, 4] : p.status === "revisao" ? [10, 4] : []);
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      for(var k = 1; k <= Math.min(passos, 14); k++){
        var fx = q.x + (ex - q.x) * k / Math.min(passos, 14), fy = q.y + (ey - q.y) * k / Math.min(passos, 14), dec = p.passos[k - 1] && p.passos[k - 1].tipo === "decisao";
        ctx.fillStyle = escuro() ? "#131A21" : "#FFFFFF"; ctx.strokeStyle = ctx.strokeStyle; ctx.lineWidth = 1.6;
        ctx.beginPath(); if(dec){ ctx.moveTo(fx, fy - 4.5); ctx.lineTo(fx + 4.5, fy); ctx.lineTo(fx, fy + 4.5); ctx.lineTo(fx - 4.5, fy); ctx.closePath(); } else ctx.arc(fx, fy, 3, 0, 7);
        ctx.fill(); ctx.stroke();
      }
      if(API.vencida(p)){ ctx.fillStyle = "#C2000C"; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, 7); ctx.fill(); }
      alvos.push({no: {nivel: "pop", pop: p, cidade: ci}, x: ex, y: ey, r: 12, seg: [q.x, q.y, ex, ey]});
      p._rot = {x: ex + Math.cos(ang) * 10, y: ey + Math.sin(ang) * 10, txt: (p.codigo ? p.codigo + " · " : "") + (p.variacao || p.cenario)};
    });
  }
  ctx.beginPath(); ctx.arc(q.x, q.y, r + 2.5, 0, 7); ctx.fillStyle = corStatus(ci.st); ctx.fill();
  ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fillStyle = escuro() ? "#131A21" : "#FFFFFF"; ctx.fill();
  ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.45, 0, 7); ctx.fillStyle = mistura(c.cor, "#000000", 0.85); ctx.fill();
  if(ci.st.essNaoLido){ ctx.fillStyle = "#3C659B"; ctx.beginPath(); ctx.moveTo(q.x + r * 0.6, q.y - r - 9); ctx.lineTo(q.x + r * 0.6 + 8, q.y - r - 6); ctx.lineTo(q.x + r * 0.6, q.y - r - 3); ctx.fill(); ctx.strokeStyle = "#3C659B"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x + r * 0.6, q.y - r - 9); ctx.lineTo(q.x + r * 0.6, q.y - r + 1); ctx.stroke(); }
  if(ci.st.riscoAlto){ ctx.fillStyle = "#C2000C"; ctx.beginPath(); ctx.moveTo(q.x - r - 6, q.y - r - 1); ctx.lineTo(q.x - r - 1, q.y - r - 10); ctx.lineTo(q.x - r + 4, q.y - r - 1); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 7px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", q.x - r - 1, q.y - r - 3); }
  alvos.push({no: ci, x: q.x, y: q.y, r: r + 6});
}
function desenharRotulos(){
  var k = V.k;
  // cidades e POPs primeiro quando perto (prioridade de quem está em foco)
  if(k > 40) MUNDO.conts.forEach(function(c){ c.filhos.forEach(function(s){ s.filhos.forEach(function(a){ a.filhos.forEach(function(ci){ if(ci._q && ci._q.vis) ci.pops.forEach(function(p){ if(p._rot) rotulo(p._rot.txt, p._rot.x, p._rot.y, {tam: 10.5, peso: 500, cor: P.sub, fonte: "'IBM Plex Mono', monospace"}); }); }); }); }); });
  if(k > 9) MUNDO.conts.forEach(function(c){ c.filhos.forEach(function(s){ s.filhos.forEach(function(a){ a.filhos.forEach(function(ci){ if(ci._q && ci._q.vis && ci._q.x > 0 && ci._q.x < W && ci._q.y > 0 && ci._q.y < H) rotulo(ci.nome, ci._q.x, ci._q.y + clamp(2.5 + Math.sqrt(ci.st.n) * 1.6, 3, 11) + 12, {tam: k > 30 ? 13 : 11.5, peso: 600}); }); }); }); });
  if(k > 7) MUNDO.conts.forEach(function(c){ if(c.vazio) return; c.filhos.forEach(function(s){ if(s.filhos.length < 2) return; s.filhos.forEach(function(a){ var g = geoDe(c, a.x, a.y), q = proj(g[0], g[1]); if(q.vis && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rotulo(a.nome, q.x, q.y - (k > 20 ? 26 : 14), {tam: 11, peso: 500, cor: P.sub, fonte: "'IBM Plex Sans', sans-serif"}); }); }); });
  if(k > 2.4) MUNDO.conts.forEach(function(c){ if(c.vazio) return; c.filhos.forEach(function(s){ var g = geoDe(c, s.x, s.y), q = proj(g[0], g[1]); if(q.vis && q.x > -50 && q.x < W + 50 && q.y > -20 && q.y < H + 20) rotulo(s.nome.toUpperCase(), q.x, q.y + (k > 7 ? -40 : 0), {tam: k > 7 ? 13 : 11, peso: 700, fonte: "Archivo, sans-serif"}); }); });
  MUNDO.conts.forEach(function(c){
    var q = proj(c.lon, c.lat - (V.k > 2.4 ? c.R * 1.05 : 0)); if(!q.vis) return;
    var dy = V.k > 2.4 ? 14 : 0;
    var ok = rotulo(c.sigla + " · " + c.nome, q.x, q.y + dy, {tam: V.k > 2.4 ? 14 : 12.5, peso: 700, fonte: "Archivo, sans-serif", forca: V.k <= 2.4, cor: c.vazio ? P.sub : P.texto});
    if(ok) rotulo(c.vazio ? "terra incógnita · sem POP" : plural(c.st.n, "POP") + (c.st.venc ? " · " + plural(c.st.venc, "vencida") : ""), q.x, q.y + dy + 15, {tam: 10.5, peso: 500, cor: c.st.venc ? "#C2000C" : P.sub, forca: V.k <= 2.4});
  });
}
function pedirDesenho(){ if(!desenhoPendente){ desenhoPendente = true; requestAnimationFrame(desenhar); } }

/* ---------- navegação: voar até um lugar ---------- */
function voar(lon, lat, k, ms){
  if(anima) cancelAnimationFrame(anima.id);
  if(REDUZ || !ms){ V.lon = wrap(lon); V.lat = lat; V.k = k; pedirDesenho(); return; }
  var a = {lon: V.lon, lat: V.lat, k: V.k}, dl = wrap(lon - a.lon), t0 = performance.now();
  var passo = function(now){
    var t = clamp((now - t0) / ms, 0, 1), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    V.lon = wrap(a.lon + dl * e); V.lat = a.lat + (lat - a.lat) * e; V.k = Math.exp(Math.log(a.k) + (Math.log(k) - Math.log(a.k)) * e);
    desenhar();
    if(t < 1) anima = {id: requestAnimationFrame(passo)}; else anima = null;
  };
  anima = {id: requestAnimationFrame(passo)};
}
function kPara(raioGraus){ return clamp(0.36 * Math.min(W, H) / (R0() * rad(Math.max(raioGraus, 0.05))), 1, 260); }
function focoDe(m){
  if(!MUNDO || !m.dep) return {lon: V.lon, lat: V.lat, k: 1, no: null};
  var c = MUNDO.conts.filter(function(x){ return x.nome === m.dep; })[0]; if(!c) return null;
  var s = m.set && c.filhos.filter(function(x){ return x.nome === m.set; })[0];
  var a = s && m.at && s.filhos.filter(function(x){ return x.nome === m.at; })[0];
  var ci = a && m.ta && a.filhos.filter(function(x){ return x.nome === m.ta; })[0];
  var no = ci || a || s || c, x = no === c ? 0 : no.x, y = no === c ? 0 : no.y, g = geoDe(c, x, y);
  var raio = no === c ? c.R * 1.25 : no === s ? Math.max(c.R / Math.max(Math.sqrt(c.filhos.length), 1) * 0.75, 1.2) : no === a ? Math.max(c.R / Math.max(Math.sqrt(c.filhos.length * s.filhos.length), 1) * 0.6, 0.5) : 0.22;
  return {lon: g[0], lat: g[1], k: kPara(raio), no: no};
}
function irPara(m, ms){ var f = focoDe(m); if(f) voar(f.lon, f.lat, f.k, ms == null ? 750 : ms); }
function escolher(no){
  var m = {dep: "", set: "", at: "", ta: ""};
  if(no.nivel === "dep") m.dep = no.nome;
  else if(no.nivel === "set") m = {dep: no.dep.nome, set: no.nome, at: "", ta: ""};
  else if(no.nivel === "at") m = {dep: no.set.dep.nome, set: no.set.nome, at: no.nome, ta: ""};
  else if(no.nivel === "ta") m = {dep: no.at.set.dep.nome, set: no.at.set.nome, at: no.at.nome, ta: no.nome};
  ultimoFoco = JSON.stringify(m);
  API.navegar(m);
  irPara(m);
  painelPara(m);
}

/* ---------- acerto do clique ---------- */
function noEm(px, py){
  // cidades e linhas de POP primeiro
  for(var i = alvos.length - 1; i >= 0; i--){
    var a = alvos[i];
    if(a.seg){ var d = distSeg(px, py, a.seg); if(d < 7) return a.no; continue; }
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
  return a.join("");
}
function mostrarDica(no, px, py){
  if(!no){ dica.hidden = true; cv.style.cursor = "grab"; return; }
  cv.style.cursor = "pointer";
  var h;
  if(no.nivel === "pop"){ var p = no.pop; h = '<b>' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '</b><span>' + esc(({aprovado: "Aprovado", revisao: "Em revisão", rascunho: "Rascunho"})[p.status] || p.status) + ' · ' + plural(p.passos.length, "passo") + (p.variacao ? ' · método ' + esc(p.variacao) : '') + '</span><small>clique para abrir o procedimento</small>'; }
  else {
    var nome = no.nivel === "dep" ? no.sigla + " · " + no.nome : no.nome, tipo = {dep: "Departamento", set: "Setor", at: "Atividade", ta: "Tarefa"}[no.nivel];
    h = '<small>' + tipo + '</small><b>' + esc(nome) + '</b>' + (no.vazio ? '<span>Ainda sem POP mapeado.</span>' : '<span>' + resumoSt(no.st) + '</span>' + alertas(no.st)) + '<small>clique para ' + (no.nivel === "ta" ? "ver os procedimentos" : "aproximar") + '</small>';
  }
  dica.innerHTML = h; dica.hidden = false;
  var r = raiz.getBoundingClientRect(), x = px + 16, y = py + 16;
  if(x + 280 > r.width) x = px - 290; if(y + 140 > r.height) y = py - 150;
  dica.style.left = Math.max(6, x) + "px"; dica.style.top = Math.max(6, y) + "px";
}
function painelPara(m){
  var f = focoDe(m), no = f && f.no;
  if(!no){
    var tot = {n: 0, apr: 0, rev: 0, ras: 0, venc: 0, riscoAlto: 0, essNaoLido: 0}, vaz = [];
    MUNDO.conts.forEach(function(c){ ["n", "apr", "rev", "ras", "venc", "riscoAlto", "essNaoLido"].forEach(function(k){ tot[k] += c.st[k]; }); if(c.vazio && c.oficial) vaz.push(c.nome); });
    painel.innerHTML = '<div class="pl-cab"><small>Visão do escritório</small><b>Planeta ControlTax</b><span>' + resumoSt(tot) + '</span>' + alertas(tot) + '</div>' +
      '<div class="pl-sec"><h4>Continentes</h4>' + MUNDO.conts.filter(function(c){ return !c.vazio; }).sort(function(a, b){ return b.st.n - a.st.n; }).map(function(c){ return linhaNo(c, c.sigla + " · " + c.nome, c.st); }).join("") + '</div>' +
      (vaz.length ? '<div class="pl-sec"><h4>Terra incógnita</h4><p class="pl-nota">Departamentos ainda sem nenhum POP: ' + esc(vaz.join(", ")) + '.</p>' + (API.podeEditar() ? '<div class="pl-bts">' + vaz.slice(0, 4).map(function(d){ return '<button type="button" class="fbtn" data-novo-dep="' + esc(d) + '">Mapear ' + esc(d) + '</button>'; }).join("") + '</div>' : '') + '</div>' : '');
    return;
  }
  var tipo = {dep: "Departamento", set: "Setor", at: "Atividade", ta: "Tarefa"}[no.nivel], titulo = no.nivel === "dep" ? no.sigla + " · " + no.nome : no.nome;
  var h = '<div class="pl-cab"><small>' + tipo + '</small><b>' + esc(titulo) + '</b>' + (no.vazio ? '<span>Ainda sem POP mapeado.</span>' : '<span>' + resumoSt(no.st) + '</span>' + alertas(no.st)) + '</div>';
  if(no.vazio){ h += API.podeEditar() ? '<div class="pl-bts"><button type="button" class="btn" data-novo-dep="' + esc(no.nome) + '">Mapear o primeiro processo</button></div>' : '<p class="pl-nota">Este departamento ainda não tem procedimentos mapeados.</p>'; painel.innerHTML = h; return; }
  if(no.nivel === "ta"){
    h += Object.keys(no.cens).sort(function(a, b){ return a === "Padrão" ? -1 : b === "Padrão" ? 1 : a.localeCompare(b, "pt-BR"); }).map(function(ce){
      return '<div class="pl-sec"><h4><span>Cenário</span> ' + esc(ce) + '</h4>' + no.cens[ce].map(function(p){
        var l = API.lidoInfo(p.id), lido = l && l.v === p.versao;
        return '<div class="pl-pop"><div class="pl-pop-t"><span class="pl-st st-' + p.status + '">' + esc(({aprovado: "Aprovado", revisao: "Em revisão", rascunho: "Rascunho"})[p.status] || p.status) + '</span>' + (API.vencida(p) ? '<span class="pl-al ruim">revisão vencida</span>' : '') + (p.essencial ? '<span class="pl-al info">' + (lido ? "essencial · lido" : "essencial") + '</span>' : '') + '</div>' +
          '<b>' + esc((p.codigo ? p.codigo + " · " : "") + p.titulo) + '</b><small>' + plural(p.passos.length, "passo") + (p.frequencia ? ' · ' + esc(p.frequencia) : '') + (p.tempoMedio ? ' · ' + esc(p.tempoMedio) : '') + (p.variacao ? ' · método ' + esc(p.variacao) : '') + '</small>' +
          '<div class="pl-bts"><button type="button" class="btn" data-ver="' + esc(p.id) + '">Ler</button><button type="button" class="fbtn" data-exec="' + esc(p.id) + '">Executar passo a passo</button></div></div>';
      }).join("") + '</div>';
    }).join("");
  } else {
    var filhos = no.filhos.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    h += '<div class="pl-sec"><h4>' + ({dep: "Setores", set: "Atividades", at: "Tarefas"})[no.nivel] + '</h4>' + filhos.map(function(f){ return linhaNo(f, f.nome, f.st); }).join("") + '</div>';
  }
  painel.innerHTML = h;
}
function linhaNo(no, txt, st){
  var key = no.nivel + "|" + (no.nivel === "dep" ? no.nome : no.nivel === "set" ? no.dep.nome + "|" + no.nome : no.nivel === "at" ? no.set.dep.nome + "|" + no.set.nome + "|" + no.nome : no.at.set.dep.nome + "|" + no.at.set.nome + "|" + no.at.nome + "|" + no.nome);
  return '<button type="button" class="pl-lin" data-pl="' + esc(key) + '"><span class="pl-pt" style="background:' + corStatus(st) + '"></span><span class="pl-lin-n">' + esc(txt) + '</span><span class="pl-lin-c">' + st.n + '</span></button>';
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
  var m = {dep: p.departamento, set: p.setor || "(sem setor)", at: p.atividade || "(sem atividade)", ta: p.tarefa || "(sem tarefa)"};
  ultimoFoco = JSON.stringify(m); API.navegar(m);
  var f = focoDe(m); if(f) voar(f.lon, f.lat, Math.max(f.k, 90), 1100);
  painelPara(m);
  buscaBox.querySelector("input").value = ""; renderBusca("");
}

/* ---------- montagem ---------- */
function montar(){
  raiz.innerHTML = '<div class="pl-palco"><canvas class="pl-cv" aria-label="Mapa-planeta dos processos. Use a roda do mouse para aproximar, arraste para mover, clique para entrar." role="img"></canvas>' +
    '<div class="pl-topo"><div class="pl-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Voar até um procedimento…" aria-label="Buscar e voar até um procedimento" autocomplete="off"><div class="pl-res" hidden></div></div>' +
    '<div class="pl-ctl"><button type="button" class="fbtn" data-pl-z="1" title="Aproximar (+)">+</button><button type="button" class="fbtn" data-pl-z="-1" title="Afastar (−)">−</button><button type="button" class="fbtn" data-pl-casa title="Ver o planeta inteiro (Home)">Planeta</button></div></div>' +
    '<div class="pl-leg" aria-hidden="true"><span><i style="background:#167A45"></i>aprovado</span><span><i style="background:#B5530C"></i>em revisão</span><span><i style="background:#8A97A3"></i>rascunho</span><span><i style="background:#C2000C"></i>revisão vencida</span><span><b class="pl-flag"></b>essencial a ler</span><span><b class="pl-tri">!</b>risco alto sem controle</span></div>' +
    '<div class="pl-dica" hidden></div><div class="pl-ajuda">Roda do mouse: aproximar · arrastar: mover · clique: entrar · Esc: voltar um nível</div></div>' +
    '<aside class="pl-painel" aria-live="polite"></aside>';
  cv = raiz.querySelector("canvas"); ctx = cv.getContext("2d"); painel = raiz.querySelector(".pl-painel"); dica = raiz.querySelector(".pl-dica"); buscaBox = raiz.querySelector(".pl-busca");
  var palco = raiz.querySelector(".pl-palco");
  var medir = function(){ var r = palco.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = Math.max(200, r.width); H = Math.max(260, r.height); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; pedirDesenho(); };
  if(window.ResizeObserver) new ResizeObserver(medir).observe(palco); else window.addEventListener("resize", medir);
  medir();
  // arrastar
  var arr = null;
  cv.addEventListener("pointerdown", function(e){ cv.setPointerCapture(e.pointerId); arr = {x: e.clientX, y: e.clientY, lon: V.lon, lat: V.lat, moveu: false}; cv.style.cursor = "grabbing"; if(anima){ cancelAnimationFrame(anima.id); anima = null; } });
  cv.addEventListener("pointermove", function(e){
    var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if(arr){
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y; if(Math.abs(dx) + Math.abs(dy) > 3) arr.moveu = true;
      var R = R0() * V.k; V.lon = wrap(arr.lon - deg(dx / R)); V.lat = clamp(arr.lat + deg(dy / R), -70, 70); dica.hidden = true; pedirDesenho(); return;
    }
    hover = noEm(px, py); mostrarDica(hover, px, py);
  });
  cv.addEventListener("pointerup", function(e){
    var foi = arr && arr.moveu; arr = null; cv.style.cursor = "grab";
    if(foi) return;
    var r = cv.getBoundingClientRect(), no = noEm(e.clientX - r.left, e.clientY - r.top);
    if(!no) return;
    if(no.nivel === "pop"){ API.abrir(no.pop.id); return; }
    escolher(no);
  });
  cv.addEventListener("pointerleave", function(){ dica.hidden = true; });
  // roda: zoom ancorado no cursor, com parada magnética no nível mais próximo
  cv.addEventListener("wheel", function(e){
    e.preventDefault();
    if(anima){ cancelAnimationFrame(anima.id); anima = null; }
    var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    var antes = inversa(px, py), f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016));
    V.k = clamp(V.k * f, 0.85, 260);
    if(antes){ for(var it = 0; it < 3; it++){ var q = proj(antes[0], antes[1]), R = R0() * V.k; V.lon = wrap(V.lon + deg((q.x - px) / R)); V.lat = clamp(V.lat - deg((q.y - py) / R), -70, 70); } }
    pedirDesenho(); dica.hidden = true;
    clearTimeout(tRoda);
    tRoda = setTimeout(function(){
      var alvo = PARADAS.reduce(function(m, s){ return Math.abs(Math.log(s / V.k)) < Math.abs(Math.log(m / V.k)) ? s : m; }, PARADAS[0]);
      if(Math.abs(Math.log(alvo / V.k)) < 0.35 && Math.abs(alvo - V.k) > 0.01) voar(V.lon, V.lat, alvo, 260);
    }, 220);
  }, {passive: false});
  // botões e teclado
  raiz.addEventListener("click", function(e){
    var b;
    if((b = e.target.closest("[data-pl-z]"))){ var k = V.k * (b.getAttribute("data-pl-z") === "1" ? 2 : 0.5); voar(V.lon, V.lat, clamp(k, 0.85, 260), 300); return; }
    if((b = e.target.closest("[data-pl-casa]"))){ casa(); return; }
    if((b = e.target.closest("[data-pl]"))){ var no = noPorChave(b.getAttribute("data-pl")); if(no) escolher(no); return; }
    if((b = e.target.closest("[data-ir]"))){ voarParaPop(b.getAttribute("data-ir")); return; }
  });
  var inp = buscaBox.querySelector("input");
  inp.addEventListener("input", function(){ renderBusca(this.value); });
  inp.addEventListener("keydown", function(e){ if(e.key === "Enter"){ var b = buscaBox.querySelector("[data-primeiro]"); if(b) b.click(); } if(e.key === "Escape"){ this.value = ""; renderBusca(""); } e.stopPropagation(); });
  raiz.tabIndex = 0;
  raiz.addEventListener("keydown", function(e){
    if(e.target.tagName === "INPUT") return;
    if(e.key === "Home"){ e.preventDefault(); casa(); }
    else if(e.key === "Escape"){ e.preventDefault(); subir(); }
    else if(e.key === "+" || e.key === "="){ voar(V.lon, V.lat, clamp(V.k * 2, 0.85, 260), 250); }
    else if(e.key === "-"){ voar(V.lon, V.lat, clamp(V.k / 2, 0.85, 260), 250); }
    else if(/^Arrow/.test(e.key)){ e.preventDefault(); var d = 60 / (R0() * V.k); if(e.key === "ArrowLeft") V.lon = wrap(V.lon - deg(d)); if(e.key === "ArrowRight") V.lon = wrap(V.lon + deg(d)); if(e.key === "ArrowUp") V.lat = clamp(V.lat + deg(d), -70, 70); if(e.key === "ArrowDown") V.lat = clamp(V.lat - deg(d), -70, 70); pedirDesenho(); }
  });
  // tema
  try{ new MutationObserver(pedirDesenho).observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]}); }catch(e){}
}
function casa(){ var m = {dep: "", set: "", at: "", ta: ""}; ultimoFoco = JSON.stringify(m); API.navegar(m); var c = MUNDO.conts.filter(function(x){ return x.nome === API.meuDep(); })[0]; voar(c ? c.lon : 0, c ? c.lat : 10, 1, 700); painelPara(m); }
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
  render: function(api, el){
    API = api;
    if(raiz !== el || !el.querySelector(".pl-palco")){ raiz = el; montar(); var md = API.meuDep(); var c0 = CASAS[md]; if(c0){ V.lon = c0[0]; V.lat = c0[1]; } }
    var t = API.arvore(), sig = JSON.stringify(Object.keys(t).map(function(d){ return [d, popsDe(t[d]).map(function(p){ return p.id + p.status + p.versao + (p.proxRevisao || "") + p.setor + p.atividade + p.tarefa + p.cenario + p.passos.length; }).join(",")]; }));
    if(sig !== assinatura){ MUNDO = montarMundo(t); assinatura = sig; }
    var m = API.S().mapa, fk = JSON.stringify(m);
    if(fk !== ultimoFoco){ ultimoFoco = fk; if(m.dep) irPara(m, MUNDO && V.k ? 750 : 0); else if(V.k > 1.2) casa(); }
    painelPara(m);
    pedirDesenho();
  }
};
})();
