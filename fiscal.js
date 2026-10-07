(function(){
"use strict";
/* ============ utilidades ============ */
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function norm(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function ymd(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function parseYmd(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function hoje(){ var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function dataBR(s){ var d = parseYmd(s); return d ? pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() : ""; }
function diasEntre(a, b){ return Math.round((b - a) / 864e5); }
var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
var MES3 = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
var SEM3 = ["dom","seg","ter","qua","qui","sex","sáb"];
// Competência = "AAAA-MM"
function compDe(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
function compShift(c, n){ var y = +c.slice(0, 4), m = +c.slice(5, 7) - 1 + n; return compDe(new Date(y, m, 1)); }
function compIni(c){ return new Date(+c.slice(0, 4), +c.slice(5, 7) - 1, 1); }
function compFim(c){ return new Date(+c.slice(0, 4), +c.slice(5, 7), 0); }
function compRot(c){ var m = +c.slice(5, 7) - 1; return MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1) + "/" + c.slice(0, 4); }
function compCurta(c){ return MES3[+c.slice(5, 7) - 1] + "/" + c.slice(2, 4); }
function compAtual(){ return compDe(hoje()); }
function cnpjDig(v){ return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }
function cnpjFmt(v){ var d = cnpjDig(v); return d.length === 14 ? d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8,12)+"-"+d.slice(12) : String(v || "").trim(); }
function cnpjOk(v){
  var d = cnpjDig(v);
  if(!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1+$/.test(d)) return false;
  var dv = function(n){ var s = 0, w = 2; for(var i = n - 1; i >= 0; i--){ s += (d.charCodeAt(i) - 48) * w; w = w === 9 ? 2 : w + 1; } var r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
function uid(){ return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function titulo(s){ var P = {de:1, da:1, do:1, das:1, dos:1, e:1}; return String(s || "").toLowerCase().split(/\s+/).filter(Boolean).map(function(w, i){ return i && P[w] ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }

/* ============ feriados e dias úteis (nacionais + carnaval, sexta santa, corpus christi e feriados de Vitória/ES: N. Sra. da Penha e N. Sra. da Vitória) ============ */
var cacheFer = {};
function pascoa(y){ var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1; return new Date(y, mes-1, dia); }
function feriados(y){
  if(cacheFer[y]) return cacheFer[y];
  var s = {}, add = function(d){ s[ymd(d)] = true; };
  ["01-01","04-21","05-01","09-07","09-08","10-12","11-02","11-15","11-20","12-25"].forEach(function(md){ add(new Date(y, +md.slice(0,2)-1, +md.slice(3))); });
  var p = pascoa(y), mais = function(n){ var d = new Date(p); d.setDate(d.getDate() + n); return d; };
  [-48, -47, -2, 1, 60].forEach(function(n){ add(mais(n)); });
  return (cacheFer[y] = s);
}
function diaUtil(d){ var w = d.getDay(); return w !== 0 && w !== 6 && !feriados(d.getFullYear())[ymd(d)]; }
function ultimoUtil(y, m){ var d = new Date(y, m + 1, 0); while(!diaUtil(d)) d.setDate(d.getDate() - 1); return d; }
function ajustarUtil(d, regra){ d = new Date(d); var passo = regra === "antecipa" ? -1 : 1; while(!diaUtil(d)) d.setDate(d.getDate() + passo); return d; }
// Data do prazo num mês: "ultimo_util" ou dia fixo (ajustado por regra quando não é dia útil).
function dataPrazo(y, m, dia, regra){
  if(dia === "ultimo_util") return ultimoUtil(y, m);
  var n = Math.min(+dia || 1, new Date(y, m + 1, 0).getDate());
  return regra === "exato" ? new Date(y, m, n) : ajustarUtil(new Date(y, m, n), regra);
}

function nUtil(y, m, n){ var d = new Date(y, m, 1), c = 0; n = Math.max(1, Math.min(22, +n || 1)); while(true){ if(diaUtil(d) && ++c >= n) return d; d.setDate(d.getDate() + 1); } }
function mesesEntre(a, b){ return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }

/* ============ domínio ============ */
var REGS = [
  {k:"simples",   l:"Simples Nacional", c:"Simples"},
  {k:"presumido", l:"Lucro Presumido",  c:"Presumido"},
  {k:"real",      l:"Lucro Real",       c:"Real"}
];
var REG = {}; REGS.forEach(function(r){ REG[r.k] = r; });
function regDeTexto(s){ var n = norm(s); if(!n) return ""; if(/simples|mei\b/.test(n)) return "simples"; if(/presum/.test(n)) return "presumido"; if(/real/.test(n)) return "real"; return ""; }
var ATIVS = [{k:"comercio", l:"Comércio"}, {k:"servico", l:"Serviço"}, {k:"industria", l:"Indústria"}, {k:"misto", l:"Comércio e serviço"}];
var ATIV = {}; ATIVS.forEach(function(a){ ATIV[a.k] = a; });
function ativDeTexto(s){ var n = norm(s); if(!n) return ""; if(/misto|comercio e serv|servico e com/.test(n)) return "misto"; if(/indus/.test(n)) return "industria"; if(/serv/.test(n)) return "servico"; if(/comerc/.test(n)) return "comercio"; return ""; }
var ETAPAS = [
  {k:"docs", l:"Documentos recebidos",    c:"Documentos"},
  {k:"escr", l:"Escrituração",            c:"Escrituração"},
  {k:"apur", l:"Apuração",                c:"Apuração"},
  {k:"guia", l:"Guia enviada ao cliente", c:"Guia enviada"}
];
var ST_ROT = {"":"Pendente", a:"Em andamento", c:"Concluída", n:"Não se aplica"};
var OB_ROT = {"":"Pendente", c:"Entregue", r:"Retificada", n:"Não se aplica"};
var ST_SIM = {"":"", a:"…", c:"✓", n:"–", r:"R"};
var PER_ROT = {mensal:"Mensal", trimestral:"Trimestral", anual:"Anual"};
var REGRA_ROT = {prorroga:"próximo dia útil", antecipa:"dia útil anterior", exato:"mantém a data", util:"º dia útil"};

// Catálogo padrão. Os dias são o caso geral: ICMS, DeSTDA e ISS mudam por estado e município, por isso vêm "a conferir".
var CFG_PADRAO = {
  inicio: "", limite: 20,
  obrig: [
    {k:"pgdas",      l:"PGDAS-D",              d:"apuração do Simples e DAS",                regs:["simples"],          ativs:[], per:"mensal",     dia:20, regra:"prorroga", desloc:1},
    {k:"destda",     l:"DeSTDA",               d:"ICMS ST, DIFAL e antecipação no Simples",  regs:["simples"],          ativs:["comercio","industria","misto"], per:"mensal", dia:28, regra:"prorroga", desloc:1},
    {k:"defis",      l:"DEFIS",                d:"declaração anual do Simples",              regs:["simples"],          ativs:[], per:"anual",      dia:31, regra:"exato", mes:3},
    {k:"efdicms",    l:"EFD ICMS/IPI",         d:"SPED Fiscal",                              regs:["presumido","real"], ativs:["comercio","industria","misto"], per:"mensal", dia:20, regra:"prorroga", desloc:1},
    {k:"icms",       l:"ICMS",                 d:"guia do ICMS próprio",                     regs:["presumido","real"], ativs:["comercio","industria","misto"], per:"mensal", dia:20, regra:"prorroga", desloc:1},
    {k:"iss",        l:"ISS",                  d:"guia do ISS próprio (municipal)",          regs:["presumido","real"], ativs:["servico","misto"], per:"mensal", dia:10, regra:"prorroga", desloc:1},
    {k:"reinf",      l:"EFD-Reinf",            d:"retenções e informações fiscais",          regs:["presumido","real"], ativs:[], per:"mensal",     dia:15, regra:"antecipa", desloc:1},
    {k:"dctfweb",    l:"DCTFWeb",              d:"débitos federais e DARF",                  regs:["presumido","real"], ativs:[], per:"mensal",     dia:15, regra:"antecipa", desloc:1},
    {k:"piscofins",  l:"DARF PIS/COFINS",      d:"pagamento de PIS e COFINS",                regs:["presumido","real"], ativs:[], per:"mensal",     dia:25, regra:"antecipa", desloc:1},
    {k:"efdcontrib", l:"EFD-Contribuições",    d:"SPED PIS/COFINS",                          regs:["presumido","real"], ativs:[], per:"mensal",     dia:10, regra:"util", desloc:2},
    {k:"irpj",       l:"IRPJ/CSLL trimestral", d:"quota única ou 1ª quota",                  regs:["presumido","real"], ativs:[], per:"trimestral", dia:"ultimo_util", regra:"", desloc:1}
  ]
};
function normDef(x){
  var t = function(v, n){ return String(v == null ? "" : v).trim().slice(0, n); };
  var per = PER_ROT[x.per] ? x.per : "mensal";
  var dia = x.dia === "ultimo_util" ? "ultimo_util" : Math.min(31, Math.max(1, +x.dia || 1));
  return {
    k: t(x.k, 40) || uid(), l: t(x.l, 60) || "Obrigação", d: t(x.d, 120),
    regs: (Array.isArray(x.regs) ? x.regs : []).filter(function(r){ return REG[r]; }),
    ativs: (Array.isArray(x.ativs) ? x.ativs : []).filter(function(a){ return ATIV[a]; }),
    per: per, dia: dia, regra: dia === "ultimo_util" ? "" : (REGRA_ROT[x.regra] ? x.regra : "prorroga"),
    desloc: Math.min(3, Math.max(1, +x.desloc || 1)), mes: Math.min(12, Math.max(1, +x.mes || 3)), ok: !!x.ok
  };
}
function normCfg(x){
  x = x || {};
  var c = clone(CFG_PADRAO);
  if(typeof x.inicio === "string" && /^(\d{4}-\d{2})?$/.test(x.inicio)) c.inicio = x.inicio;
  if(+x.limite >= 1 && +x.limite <= 28) c.limite = +x.limite;
  c.obrig = (Array.isArray(x.obrig) ? x.obrig : c.obrig).map(normDef);
  return c;
}

// Vencimento de uma obrigação numa competência ("anual" = ano-calendário da competência de dezembro).
function prazoDe(def, comp){
  if(def.per === "anual"){
    var ya = +comp.slice(0, 4) + 1, ma = (+def.mes || 1) - 1;
    return def.regra === "util" && def.dia !== "ultimo_util" ? nUtil(ya, ma, def.dia) : dataPrazo(ya, ma, def.dia, def.regra || "exato");
  }
  var due = compShift(comp, +def.desloc || 1), y = +due.slice(0, 4), m = +due.slice(5, 7) - 1;
  if(def.regra === "util" && def.dia !== "ultimo_util") return nUtil(y, m, def.dia);
  return dataPrazo(y, m, def.dia, def.regra);
}
function existeNaComp(def, comp){
  var m = +comp.slice(5, 7);
  return def.per === "trimestral" ? m % 3 === 0 : def.per === "anual" ? m === 12 : true;
}
function rotPrazo(def){
  var dia = def.dia === "ultimo_util" ? "último dia útil" : def.regra === "util" ? def.dia + "º dia útil" : "dia " + def.dia;
  var quando = def.per === "anual" ? " de " + MESES[(+def.mes || 1) - 1] + " do ano seguinte" : def.desloc === 1 ? " do mês seguinte" : " de " + def.desloc + " meses depois";
  var ajuste = def.dia !== "ultimo_util" && def.regra !== "util" ? (def.regra === "exato" ? "" : " (" + REGRA_ROT[def.regra] + ")") : "";
  return dia + quando + ajuste;
}

/* ============ estado ============ */
var S = {
  empresas: {}, comps: {}, cfg: normCfg(null),
  R: {emp:{}, comp:{}, cfg:null},
  exemplo: false, forcarReal: false, demo: null,
  existe: {docs:{}},
  carregou: {empresas:false, fis_emp:false, fis_comp:false, fis_config:false},
  view: "painel", eu: "", coord: false, meId: "", userNs: null, nomes: {}, nomeConta: "",
  pn: {mapa:"tudo"},
  ag: {mes:"", dia:"", ana:"", reg:"", ob:""},
  em: {busca:"", ana:"", modo:"cartoes", faixa:"", limite:120},
  fx: {comp:"", busca:"", ana:"", reg:"", st:"", sel:new Set()}
};
var PREF = "fis-prefs-v1";
function lerPrefs(){ try{ return JSON.parse(localStorage.getItem(PREF) || "{}"); }catch(e){ return {}; } }
function salvarPrefs(p){ try{ localStorage.setItem(PREF, JSON.stringify(Object.assign(lerPrefs(), p))); }catch(e){} }

/* ============ banco ============ */
// Aberto dentro do Control Hub (quadro), usa a conexão da página principal. Ela só aceita objetos criados lá:
// tudo o que é gravado é recriado com o JSON da página principal.
function noPai(){ try{ return window.parent !== window && window.parent.claude && window.parent.claude.use ? window.parent : null; }catch(e){ return null; } }
function usarCap(n){
  var P = noPai();
  if(P) return P.claude.use(n);
  return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null);
}
function clonarPara(v){ var P = noPai(); return P ? P.JSON.parse(JSON.stringify(v)) : JSON.parse(JSON.stringify(v)); }
function bancoReal(db){
  return {
    doc: function(p){ var r = db.doc(p); return {
      onSnapshot: function(cb, err){ return r.onSnapshot(cb, err); },
      set: function(o){ return r.set(clonarPara(o)); },
      update: function(o){ return r.update(clonarPara(o)); }
    }; },
    collection: function(n){ var c = db.collection(n); return { onSnapshot: function(cb, err){ return c.onSnapshot(cb, err); } }; }
  };
}
// Sem banco (arquivo aberto fora do Hub): guarda neste navegador, com a mesma interface.
function bancoLocal(){
  var K = "fis-local-v1", dados = {}, ouv = [];
  try{ dados = JSON.parse(localStorage.getItem(K) || "{}"); }catch(e){ dados = {}; }
  var copia = function(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
  var sDoc = function(p){ return {exists: !!dados[p], id: p.split("/")[1], data: function(){ return copia(dados[p]); }}; };
  var sCol = function(n){ return {docs: Object.keys(dados).filter(function(k){ return k.indexOf(n + "/") === 0; }).map(function(k){ return {id: k.slice(n.length + 1), data: function(){ return copia(dados[k]); }}; })}; };
  var avisa = function(o){ setTimeout(function(){ o.cb(o.t === "d" ? sDoc(o.a) : sCol(o.a)); }, 0); };
  var grava = function(){ try{ localStorage.setItem(K, JSON.stringify(dados)); }catch(e){ toast("Não foi possível salvar neste navegador."); } ouv.forEach(avisa); };
  return {
    doc: function(p){ return {
      onSnapshot: function(cb){ var o = {t:"d", a:p, cb:cb}; ouv.push(o); avisa(o); },
      set: function(v){ dados[p] = copia(v); grava(); return Promise.resolve(); },
      update: function(v){ if(!dados[p]) return Promise.reject(new Error("documento inexistente")); Object.assign(dados[p], copia(v)); grava(); return Promise.resolve(); }
    }; },
    collection: function(n){ return { onSnapshot: function(cb){ var o = {t:"c", a:n, cb:cb}; ouv.push(o); avisa(o); } }; }
  };
}
var banco = null, semBanco = false;
var gravacoes = {pend:0, falhas:0};
function gravar(prom){
  gravacoes.pend++; pintarSalv();
  return Promise.resolve(prom).then(function(r){ gravacoes.pend--; pintarSalv(); return r; }, function(err){
    gravacoes.pend--; gravacoes.falhas++; pintarSalv(); console.error(err);
    toast(err && err.code === "quota_exceeded" ? "O banco de dados está cheio: a alteração não foi salva." : "Não foi possível salvar. Confira a conexão e tente de novo.");
    throw err;
  });
}
var tSalv = 0;
function pintarSalv(){
  var el = $("#salv"); clearTimeout(tSalv);
  if(gravacoes.falhas){ el.hidden = false; el.className = "save-state err"; el.textContent = "⚠ alteração não salva"; return; }
  if(gravacoes.pend){ tSalv = setTimeout(function(){ el.hidden = false; el.className = "save-state"; el.textContent = "Salvando…"; }, 500); return; }
  el.hidden = true;
}
// Cada coleção guarda mapas (empresa por chave) repartidos em alguns documentos, para nenhum passar de 256 KB.
// Cada gravação mexe só nas chaves alteradas. No modo exemplo nada vai para o banco.
function balde(id, n){ var h = 0; for(var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % n; }
function docEmp(id){ return "fis_emp/b" + balde(id, 8); }
function docComp(comp, id){ return "fis_comp/" + comp + "~" + balde(id, 4); }
function gravarMapas(itens){
  if(S.exemplo) return Promise.resolve();
  var col = itens.length ? itens[0][0].split("/")[0] : "";
  if(col && !S.carregou[col]){ toast("Aguarde: os dados ainda estão carregando."); var x = new Error("carregando"); x.fis = true; return Promise.reject(x); }
  var porDoc = {};
  itens.forEach(function(it){ (porDoc[it[0]] = porDoc[it[0]] || {})[it[1]] = it[2]; });
  return Promise.all(Object.keys(porDoc).map(function(path){
    var ref = banco.doc(path);
    return gravar(S.existe.docs[path] ? ref.update(porDoc[path]) : ref.set(porDoc[path])).then(function(){ S.existe.docs[path] = true; });
  }));
}
function salvarEmpresas(lista){
  lista.forEach(function(e){ e.atual = new Date().toISOString(); S.empresas[e.id] = e; });
  renderTudo();
  return gravarMapas(lista.map(function(e){ return [docEmp(e.id), e.id, e]; }));
}
function salvarCompEntrada(comp, eid, ent){ var m = {}; m[eid] = ent; return salvarCompVarias(comp, m); }
function salvarCompVarias(comp, mapa){
  var c = (S.comps[comp] = S.comps[comp] || {}); Object.keys(mapa).forEach(function(k){ c[k] = mapa[k]; });
  renderTudo();
  return gravarMapas(Object.keys(mapa).map(function(k){ return [docComp(comp, k), k, mapa[k]]; }));
}
function salvarCfg(cfg){
  S.cfg = cfg; renderTudo();
  if(S.exemplo){ S.demo.cfg = cfg; return Promise.resolve(); }
  return gravar(banco.doc("fis_config/cfg").set(cfg));
}
// Carteira real (banco) ou de exemplo (gerada aqui, só na memória).
function aplicarFonte(){
  var vazia = !Object.keys(S.R.emp).some(function(k){ return !S.R.emp[k].excluida; });
  S.exemplo = S.carregou.fis_emp && vazia && !S.forcarReal;
  if(S.exemplo){ if(!S.demo) S.demo = gerarExemplo(); S.empresas = S.demo.emp; S.comps = S.demo.comp; S.cfg = S.demo.cfg; }
  else { S.empresas = S.R.emp; S.comps = S.R.comp; S.cfg = S.R.cfg || normCfg(null); }
  if(S.carregou.fis_emp && S.eu && analistas().indexOf(S.eu) === -1){ S.eu = ""; ["ag", "em", "fx"].forEach(function(v){ S[v].ana = ""; }); }
}

/* ============ identidade e permissões ============ */
function analistas(){
  var s = {};
  Object.keys(S.empresas).forEach(function(k){ var e = S.empresas[k]; if(!e.excluida && e.analista) s[e.analista] = true; });
  return Object.keys(s).sort(function(a, b){ return a.localeCompare(b, "pt-BR"); });
}
function casarNome(nomeConta){
  var t = norm(nomeConta).split(" ").filter(Boolean); if(!t.length) return "";
  var melhor = "", pts = 0;
  analistas().forEach(function(a){
    var at = norm(a).split(" ").filter(Boolean);
    var p = at.filter(function(x){ return t.indexOf(x) !== -1; }).length;
    if(at[0] !== t[0]) p = 0;
    if(p > pts){ pts = p; melhor = a; }
  });
  return pts ? melhor : "";
}
function minha(e){ return !!S.eu && norm(e.analista) === norm(S.eu); }
function podeMarcar(e){ return S.exemplo || S.coord || minha(e); }
function quemSou(){ return S.exemplo ? "demo:" + (S.eu || "Você") : (S.meId || ""); }
function nomeDe(id){ if(String(id).indexOf("demo:") === 0) return id.slice(5).split(" ")[0]; return (S.nomes[id] || "").split(" ")[0] || ""; }
function buscarNomes(ids){
  if(!S.userNs) return;
  var falta = ids.filter(function(i){ return i && i.indexOf("demo:") !== 0 && !(i in S.nomes); });
  if(!falta.length) return;
  falta.forEach(function(i){ S.nomes[i] = ""; });
  S.userNs.profiles(falta).then(function(ps){ falta.forEach(function(i){ S.nomes[i] = (ps && ps[i] && ps[i].name) || ""; }); renderTudo(); }).catch(function(){});
}
function iniciais(n){ var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); }
var CORES_AV = ["#2a78d6", "#0F7A55", "#B5651D", "#6A4FA0", "#B03A48", "#2E8B8B", "#7A6A10", "#4A5DB0"];
function corDe(n){ return n ? CORES_AV[balde(norm(n), CORES_AV.length)] : "#8a96a3"; }

/* ============ empresas e competências ============ */
function normEmp(x, id){
  var t = function(v, n){ return String(v == null ? "" : v).trim().slice(0, n || 200); };
  var comp = function(v){ return /^\d{4}-\d{2}$/.test(String(v || "")) ? v : ""; };
  return {
    id: id || x.id, nome: t(x.nome, 160) || "Sem nome", cnpj: cnpjFmt(x.cnpj),
    regime: REG[x.regime] ? x.regime : "", ativ: ATIV[x.ativ] ? x.ativ : "",
    ie: t(x.ie, 30), im: t(x.im, 30), municipio: t(x.municipio, 60), uf: t(x.uf, 2).toUpperCase(),
    analista: t(x.analista, 60), sit: x.sit === "inativa" ? "inativa" : "ativa", desde: comp(x.desde), ate: comp(x.ate),
    naoAplica: Array.isArray(x.naoAplica) ? x.naoAplica.map(String).slice(0, 40) : [],
    obs: t(x.obs, 1500),
    hist: Array.isArray(x.hist) ? x.hist.slice(-40).filter(function(h){ return h && h.t; }).map(function(h){ return {d: t(h.d, 30), t: t(h.t, 200), u: t(h.u, 60)}; }) : [],
    atual: t(x.atual, 40), excluida: !!x.excluida
  };
}
function listaEmpresas(){ return Object.keys(S.empresas).map(function(k){ return S.empresas[k]; }).filter(function(e){ return !e.excluida; }); }
function ordNome(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }
function compEmFechamento(){ return compShift(compAtual(), -1); }
function inicioControle(){ return /^\d{4}-\d{2}$/.test(S.cfg.inicio || "") ? S.cfg.inicio : compEmFechamento(); }
function clienteNaComp(e, comp){
  if(e.excluida) return false;
  if(e.desde && comp < e.desde) return false;
  if(e.sit === "inativa") return !!e.ate && comp <= e.ate;
  return true;
}
function naComp(e, comp){ return comp >= inicioControle() && clienteNaComp(e, comp); }
function compsControle(){ var out = [], c = inicioControle(), fim = compAtual(); while(c <= fim && out.length < 240){ out.push(c); c = compShift(c, 1); } return out; }
function entrada(comp, eid){ return (S.comps[comp] && S.comps[comp][eid]) || {}; }
function stEtapa(ent, k){ var v = ent.e && ent.e[k]; return v && v[0] ? v[0] : ""; }
// Prazo interno para fechar a competência: dia X do mês seguinte (Cadastro).
function limiteFech(comp){ var p = compShift(comp, 1); return dataPrazo(+p.slice(0, 4), +p.slice(5, 7) - 1, +S.cfg.limite || 20, "prorroga"); }
function resumo(e, comp){
  var ent = entrada(comp, e.id), total = 0, feitas = 0, falta = [];
  ETAPAS.forEach(function(et){ var s = stEtapa(ent, et.k); if(s === "n") return; total++; if(s === "c") feitas++; else falta.push(et); });
  var fechada = feitas === total;
  return {ent:ent, total:total, feitas:feitas, falta:falta, fechada:fechada, atras: !fechada && hoje() > limiteFech(comp), cli: !fechada && !!ent.pend, pend: ent.pend || ""};
}
function diasParado(ent){ var u = (ent.cobr && ent.cobr.length ? ent.cobr[ent.cobr.length - 1] : "") || ent.pendEm; var d = parseYmd(u); return d ? diasEntre(d, hoje()) : 0; }
function stOb(comp, e, k){ var v = (entrada(comp, e.id).ob || {})[k]; return v && v[0] ? v[0] : ""; }
function feitoOb(s){ return s === "c" || s === "r" || s === "n"; }
function obrigAplica(e, def, comp){
  if(def.regs.indexOf(e.regime) === -1) return false;
  if(def.ativs.length && e.ativ && def.ativs.indexOf(e.ativ) === -1) return false;
  if(e.naoAplica.indexOf(def.k) !== -1) return false;
  return naComp(e, comp);
}

/* ---------- ocorrências: obrigação × competência, com as empresas a que se aplica (guardado até o próximo desenho) ---------- */
var cacheOc = null, cacheOcEmp = null, cacheSit = {};
function limparCaches(){ cacheOc = null; cacheOcEmp = null; cacheSit = {}; }
function ocorrencias(){
  if(cacheOc) return cacheOc;
  var out = [], lista = listaEmpresas(), c0 = compShift(compAtual(), -14), c1 = compShift(compAtual(), 2);
  (S.cfg.obrig || []).forEach(function(def){
    for(var c = c0; c <= c1; c = compShift(c, 1)){
      if(!existeNaComp(def, c)) continue;
      var emps = lista.filter(function(e){ return obrigAplica(e, def, c); });
      if(!emps.length) continue;
      var data = prazoDe(def, c);
      var pend = emps.filter(function(e){ return !feitoOb(stOb(c, e, def.k)); });
      out.push({def:def, comp:c, data:data, ds:ymd(data), emps:emps, pend:pend});
    }
  });
  out.sort(function(a, b){ return a.data - b.data || a.def.l.localeCompare(b.def.l, "pt-BR"); });
  return (cacheOc = out);
}
function ocDe(e){
  if(!cacheOcEmp){ cacheOcEmp = {}; ocorrencias().forEach(function(o){ o.emps.forEach(function(x){ (cacheOcEmp[x.id] = cacheOcEmp[x.id] || []).push(o); }); }); }
  return cacheOcEmp[e.id] || [];
}
// Recorte de uma ocorrência pelos filtros (analista, regime, obrigação).
function recortar(o, f){
  if(f.ob && o.def.k !== f.ob) return null;
  var passa = function(e){ return (!f.ana || norm(e.analista) === norm(f.ana)) && (!f.reg || e.regime === f.reg); };
  var emps = o.emps.filter(passa); if(!emps.length) return null;
  return {def:o.def, comp:o.comp, data:o.data, ds:o.ds, emps:emps, pend:o.pend.filter(passa)};
}
// Situação da empresa: fechamentos atrasados, pendência do cliente, obrigações vencidas e próximas, e a "saúde" (% em dia).
function situ(e){
  if(cacheSit[e.id]) return cacheSit[e.id];
  var h = hoje(), ate7 = new Date(h), de90 = new Date(h), cef = compEmFechamento();
  ate7.setDate(ate7.getDate() + 7); de90.setDate(de90.getDate() - 90);
  var r = {fechAtras:[], cli:"", cliComp:"", obVenc:[], obProx:[], tot:0, ok:0, fech:null};
  compsControle().forEach(function(c){
    if(c > cef || !naComp(e, c)) return;
    var rs = resumo(e, c);
    if(c === cef) r.fech = rs;
    if(rs.atras) r.fechAtras.push(c);
    if(rs.cli && !r.cli){ r.cli = rs.pend; r.cliComp = c; }
    if(mesesEntre(c, cef) < 3 && h > limiteFech(c)){ r.tot++; if(rs.fechada) r.ok++; }
  });
  ocDe(e).forEach(function(o){
    var feito = feitoOb(stOb(o.comp, e, o.def.k));
    if(o.data < h && o.data >= de90){ r.tot++; if(feito) r.ok++; }
    if(feito) return;
    if(o.data < h) r.obVenc.push(o); else if(o.data <= ate7) r.obProx.push(o);
  });
  r.saude = r.tot ? Math.round(r.ok / r.tot * 100) : 100;
  r.atraso = r.fechAtras.length > 0 || r.obVenc.length > 0;
  return (cacheSit[e.id] = r);
}
function corSaude(p){ return p >= 90 ? "var(--dp-ok)" : p >= 70 ? "var(--dp-today)" : "var(--dp-late)"; }
function contagem(data){
  var n = diasEntre(hoje(), data);
  if(n === 0) return {t:"vence hoje", c:"hoje"};
  if(n < 0) return {t:"venceu há " + (-n) + " dia" + (n === -1 ? "" : "s"), c:"venc"};
  return {t:"em " + n + " dia" + (n === 1 ? "" : "s"), c: n <= 5 ? "perto" : ""};
}
function diaBox(d){ var n = diasEntre(hoje(), d); return '<div class="dia' + (n === 0 ? " hoje" : n < 0 ? " venc" : "") + '"><b>' + pad2(d.getDate()) + '</b><small>' + MES3[d.getMonth()] + " · " + SEM3[d.getDay()] + '</small></div>'; }
function regPill(k){ return k ? '<span class="reg ' + k + '">' + esc(REG[k].c) + '</span>' : '<span class="reg">sem regime</span>'; }

/* ============ dados de exemplo ============ */
// Carteira fictícia, sempre a mesma (gerador com semente fixa). Só existe na memória desta página.
function gerarExemplo(){
  var seed = 20261007;
  var rnd = function(){ seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  var pick = function(a){ return a[Math.floor(rnd() * a.length)]; };
  var digitos = function(n){ var s = ""; for(var i = 0; i < n; i++) s += Math.floor(rnd() * 10); return s; };
  var comDv = function(b){ var calc = function(s){ var t = 0, w = 2; for(var k = s.length - 1; k >= 0; k--){ t += +s[k] * w; w = w === 9 ? 2 : w + 1; } var m = t % 11; return m < 2 ? 0 : 11 - m; }; var d1 = calc(b); return b + d1 + calc(b + d1); };
  var ANAS = ["Ana Exemplo", "Bruno Teste", "Carla Demo", "Diego Modelo"];
  var GREGOS = ["Alfa", "Beta", "Gama", "Delta", "Épsilon", "Zeta", "Sigma", "Ômega", "Kappa", "Lambda", "Teta", "Iota", "Rô", "Ípsilon"];
  var RAMOS = [["Mercado", "comercio"], ["Distribuidora", "comercio"], ["Auto Peças", "comercio"], ["Farmácia", "comercio"], ["Clínica", "servico"], ["Consultoria", "servico"], ["Tecnologia", "servico"], ["Transportes", "servico"], ["Engenharia", "servico"], ["Metalúrgica", "industria"], ["Confecções", "industria"], ["Alimentos", "industria"], ["Gráfica e Papelaria", "misto"], ["Oficina e Peças", "misto"]];
  var CIDS = [["São Paulo", "SP"], ["Campinas", "SP"], ["Santos", "SP"], ["Sorocaba", "SP"], ["Curitiba", "PR"], ["Belo Horizonte", "MG"], ["Rio de Janeiro", "RJ"], ["Goiânia", "GO"]];
  var PENDS = ["XML das notas de entrada", "extrato bancário do mês", "relatório de faturamento", "notas de serviço tomadas", "inventário de estoque", "guias de ICMS ST pagas"];
  var OBS = ["Cliente manda as notas sempre no fim do prazo.", "Tem filial em outro estado: conferir DIFAL.", "Contato preferido por WhatsApp.", "Parcelamento ativo na Receita.", ""];
  var cf = compEmFechamento(), h = hoje(), ini = compShift(compAtual(), -6);
  var emp = {}, comp = {}, usados = {}, prob = {};
  for(var i = 0; i < 40; i++){
    var ramo = pick(RAMOS), nome = "";
    for(var tent = 0; tent < 20 && (!nome || usados[nome]); tent++) nome = ramo[0] + " " + pick(GREGOS);
    if(usados[nome]) nome += " " + (i + 1);
    usados[nome] = true;
    var x = rnd(), regime = x < .5 ? "simples" : x < .8 ? "presumido" : "real";
    nome += regime === "real" && rnd() < .5 ? " S/A" : regime === "simples" && rnd() < .3 ? " ME" : " Ltda";
    var cid = pick(CIDS), ativ = ramo[1], ana = ANAS[Math.floor(rnd() * ANAS.length)];
    var id = "x" + pad2(i + 1);
    var e = normEmp({
      nome: nome, cnpj: comDv(digitos(8) + "0001"), regime: regime, ativ: ativ,
      ie: ativ === "servico" ? "ISENTO" : digitos(9 + Math.floor(rnd() * 3)), im: ativ === "servico" || ativ === "misto" ? digitos(7) : "",
      municipio: cid[0], uf: cid[1], analista: ana,
      desde: i % 13 === 5 ? compShift(compAtual(), -2) : "",
      sit: i === 17 ? "inativa" : "ativa", ate: i === 17 ? compShift(compAtual(), -3) : "",
      obs: i % 4 === 0 ? pick(OBS) : "",
      hist: [{d: ymd(new Date(h.getFullYear(), h.getMonth() - 6, 3)), t: "Empresa cadastrada (dados de exemplo)", u: "demo:" + ana}]
    }, id);
    emp[id] = e; prob[id] = rnd() < .12;
  }
  var dataMarca = function(c, k){
    var p = compShift(c, 1), d = new Date(+p.slice(0, 4), +p.slice(5, 7) - 1, 1 + k * 4 + Math.floor(rnd() * 5));
    return ymd(d > h ? h : d);
  };
  var cliente = function(e, c){ return (!e.desde || c >= e.desde) && (e.sit === "ativa" || (e.ate && c <= e.ate)); };
  Object.keys(emp).forEach(function(id){
    var e = emp[id], u = "demo:" + e.analista;
    for(var c = ini; c <= cf; c = compShift(c, 1)){
      if(!cliente(e, c)) continue;
      var idade = mesesEntre(c, cf), n, x = rnd();
      if(idade >= 2) n = prob[id] && idade <= 3 && x < .7 ? 1 + Math.floor(rnd() * 3) : 4;
      else if(idade === 1) n = prob[id] ? 1 + Math.floor(rnd() * 3) : x < .92 ? 4 : 3;
      else n = x < .3 ? 4 : x < .55 ? 3 : x < .75 ? 2 : x < .9 ? 1 : 0;
      var ent = {e:{}};
      ETAPAS.forEach(function(et, k){
        if(k < n) ent.e[et.k] = ["c", dataMarca(c, k), u];
        else if(k === n && rnd() < .35) ent.e[et.k] = ["a", dataMarca(c, k), u];
      });
      if(n === 4) ent.fechadaEm = ent.e.guia[1];
      else if((idade === 0 && n <= 1 && rnd() < .55) || (prob[id] && idade >= 1 && rnd() < .5)){
        ent.pend = pick(PENDS); ent.pendEm = dataMarca(c, 0); ent.cobr = rnd() < .5 ? [dataMarca(c, 1)] : [];
      }
      (comp[c] = comp[c] || {})[id] = ent;
    }
  });
  var cfg = normCfg(S.R.cfg || null); cfg.inicio = ini;
  // entregas das obrigações: quase tudo o que venceu foi entregue; as próximas, algumas adiantadas
  var antes = {emp:S.empresas, comp:S.comps, cfg:S.cfg};
  S.empresas = emp; S.comps = comp; S.cfg = cfg; limparCaches();
  ocorrencias().forEach(function(o){
    o.emps.forEach(function(e){
      var dif = diasEntre(o.data, h), feito = false;
      if(dif > 0) feito = rnd() < (dif > 30 ? .997 - (prob[e.id] ? .04 : 0) : .97 - (prob[e.id] ? .3 : 0));
      else if(dif > -8) feito = rnd() < .3;
      if(!feito) return;
      var d = new Date(Math.min(o.data, h)); d.setDate(d.getDate() - Math.floor(rnd() * (dif > 0 ? 6 : 3)));
      var ent = ((comp[o.comp] = comp[o.comp] || {})[e.id] = comp[o.comp][e.id] || {});
      (ent.ob = ent.ob || {})[o.def.k] = [rnd() < .03 ? "r" : "c", ymd(d), "demo:" + e.analista];
    });
  });
  S.empresas = antes.emp; S.comps = antes.comp; S.cfg = antes.cfg; limparCaches();
  return {emp:emp, comp:comp, cfg:cfg};
}

/* ============ avisos, confirmação e menus ============ */
function toast(msg, acao, fn){
  var t = document.createElement("div"); t.className = "toast";
  var s = document.createElement("span"); s.textContent = msg; t.appendChild(s);
  if(acao){ var b = document.createElement("button"); b.type = "button"; b.textContent = acao; b.onclick = function(){ t.remove(); fn(); }; t.appendChild(b); }
  $("#toasts").appendChild(t);
  setTimeout(function(){ t.remove(); }, acao ? 9000 : 4500);
}
function confirmar(msg, rotulo){
  return new Promise(function(ok){
    var d = $("#dlgConf"); $("#confTxt").textContent = msg; $("#confSim").textContent = rotulo || "Confirmar";
    var fim = function(v){ d.close(); ok(v); };
    $("#confSim").onclick = function(){ fim(true); }; $("#confNao").onclick = function(){ fim(false); };
    d.oncancel = function(e){ e.preventDefault(); fim(false); };
    d.showModal(); $("#confNao").focus();
  });
}
var pop = null;
function fecharPop(){ if(pop){ pop.remove(); pop = null; } }
function abrirPop(alvo, html, aoMontar){
  fecharPop();
  pop = document.createElement("div"); pop.className = "pop"; pop.innerHTML = html;
  (alvo.closest("dialog") || document.body).appendChild(pop);
  var r = alvo.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
  var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8), top = r.bottom + 4;
  if(top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 4);
  pop.style.left = left + "px"; pop.style.top = top + "px";
  if(aoMontar) aoMontar(pop);
  var f = pop.querySelector("textarea, button"); if(f) f.focus();
}
document.addEventListener("mousedown", function(e){ if(pop && !pop.contains(e.target)) fecharPop(); });
document.addEventListener("keydown", function(e){ if(e.key === "Escape") fecharPop(); });
window.addEventListener("resize", fecharPop);
document.addEventListener("scroll", function(e){ if(pop && !pop.contains(e.target)) fecharPop(); }, true);
function menuStatus(alvo, atual, ordem, rotulos, info, aoEscolher){
  abrirPop(alvo, ordem.map(function(s){
    return '<button type="button" data-s="' + s + '"><span class="st ' + (s || "p") + '">' + ST_SIM[s] + '</span>' + esc(rotulos[s]) + (s === atual ? " · atual" : "") + '</button>';
  }).join("") + (info ? '<div class="info">' + esc(info) + '</div>' : ""), function(p){
    $$("button[data-s]", p).forEach(function(b){ b.onclick = function(){ fecharPop(); aoEscolher(b.getAttribute("data-s")); }; });
  });
}
function stCell(s, attrs, pode, titulo){
  return '<button type="button" class="st ' + (s || "p") + '" ' + attrs + (pode ? "" : " disabled") + ' title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '">' + ST_SIM[s] + '</button>';
}
function infoMarca(v, rot){ if(!v || !v[1]) return ""; var n = nomeDe(v[2]); return (rot || ST_ROT)[v[0]] + " em " + dataBR(v[1]) + (n ? " por " + n : ""); }

/* ============ navegação (abas como as do DP) ============ */
var VIEWS = ["painel", "agenda", "empresas", "fechamento", "cadastro"];
var animarView = "";
var semMovimento = function(){ return matchMedia("(prefers-reduced-motion: reduce)").matches; };
function vaiAnimar(v){ if(animarView !== v) return 0; animarView = ""; return semMovimento() ? 0 : performance.now(); }
function marcarAnim(el, t0, cls){
  if(!el) return;
  if(t0){ el.classList.add(cls); clearTimeout(el.__tAnim); el.__tAnim = setTimeout(function(){ el.classList.remove(cls); }, 1700); }
}
function animarLinhas(el, t0, sel){
  if(!t0 || !el) return;
  $$(sel || "tbody > tr", el).slice(0, 24).forEach(function(r, k){ r.style.setProperty("--k", k); });
  marcarAnim(el, t0, "ls-anim");
}
function contar(els, t0){
  if(!t0) return;
  els.forEach(function(el, k){
    var alvo = parseInt(el.textContent, 10); if(!(alvo > 0) || String(alvo) !== el.textContent.trim()) return;
    var ini = t0 + k * 70, dur = 850;
    var passo = function(t){ var x = Math.min(1, Math.max(0, (t - ini) / dur)); el.textContent = Math.round(alvo * (1 - Math.pow(1 - x, 3))); if(x < 1 && el.isConnected) requestAnimationFrame(passo); };
    passo(performance.now());
  });
}
function indicador(animar){
  var tabs = $("#tabs"), on = $(".dp-tab.active", tabs); if(!on || !on.offsetWidth) return;
  var ind = $(".dp-tab-ind", tabs);
  if(!ind){ ind = document.createElement("span"); ind.className = "dp-tab-ind"; ind.setAttribute("aria-hidden", "true"); tabs.appendChild(ind); animar = false; }
  ind.classList.toggle("sem-trans", !animar || semMovimento());
  ind.style.width = on.offsetWidth + "px"; ind.style.transform = "translateX(" + on.offsetLeft + "px)";
}
window.addEventListener("resize", function(){ indicador(false); });
function irPara(v, opts){
  var antes = S.view, painelAntes = $("#v-" + antes), deslizar = antes !== v && painelAntes && !painelAntes.hidden;
  if(antes !== v || !painelAntes || painelAntes.hidden) animarView = v;
  S.view = v; salvarPrefs({view:v});
  if(opts){ Object.keys(opts).forEach(function(k){ var p = k.split("."); S[p[0]][p[1]] = opts[k]; }); }
  $$("#tabs .dp-tab").forEach(function(b){ var on = b.getAttribute("data-view") === v; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $$(".view").forEach(function(s){ s.hidden = s.id !== "v-" + v; });
  window.scrollTo(0, 0);
  renderTudo(true);
  requestAnimationFrame(function(){ indicador(deslizar); });
  if(deslizar && !semMovimento()){ var p = $("#v-" + v); p.style.setProperty("--dir", VIEWS.indexOf(v) >= VIEWS.indexOf(antes) ? 1 : -1); p.classList.remove("dp-entra"); void p.offsetWidth; p.classList.add("dp-entra"); }
}
$$("#tabs .dp-tab").forEach(function(b){ b.onclick = function(){ irPara(b.getAttribute("data-view")); }; });
$("#tabs").addEventListener("keydown", function(e){
  if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  var i = VIEWS.indexOf(S.view) + (e.key === "ArrowRight" ? 1 : -1); if(i < 0 || i >= VIEWS.length) return;
  irPara(VIEWS[i]); var b = $('#tabs [data-view="' + VIEWS[i] + '"]'); if(b) b.focus();
});
var rafRender = 0;
function renderTudo(agora){
  if(agora){ cancelAnimationFrame(rafRender); rafRender = 0; render(); return; }
  if(rafRender) return;
  rafRender = requestAnimationFrame(function(){ rafRender = 0; render(); });
}
function render(){
  fecharPop();
  limparCaches();
  renderEu();
  renderCabeca();
  $("#carregando").hidden = S.carregou.empresas;
  $("#exemplo").hidden = !S.exemplo;
  var v = S.view;
  if(v === "painel") renderPainel();
  else if(v === "agenda") renderAgenda();
  else if(v === "empresas") renderEmpresas();
  else if(v === "fechamento") renderFechamento();
  else if(v === "cadastro") renderCadastro();
  $$("[data-coord]").forEach(function(el){ el.hidden = !(S.coord || S.exemplo); });
  if(fichaId && $("#dlgFicha").open && fichaAba === "obrig") pintarFichaObrig();
}
// Cabeçalho: competência em fechamento e contadores nas abas (de quem está usando ou da equipe).
function renderCabeca(){
  var cef = compEmFechamento();
  $("#fsSync").textContent = "fechamento de " + compRot(cef).toLowerCase() + " · prazo " + dataBR(ymd(limiteFech(cef))).slice(0, 5);
  var lista = S.carregou.empresas ? listaEmpresas() : [], minhas = S.eu ? lista.filter(minha) : lista;
  var atras = minhas.filter(function(e){ return situ(e).fechAtras.length; }).length;
  var bf = $("#bdFech"); bf.hidden = !atras; bf.textContent = atras; bf.title = atras + " empresa" + (atras === 1 ? "" : "s") + (S.eu ? " suas" : "") + " com fechamento atrasado";
  var urg = 0; minhas.forEach(function(e){ var s = situ(e); urg += s.obVenc.length + s.obProx.filter(function(o){ return diasEntre(hoje(), o.data) <= 5; }).length; });
  var ba = $("#bdAg"); ba.hidden = !urg; ba.textContent = urg; ba.title = urg + " entrega" + (urg === 1 ? "" : "s") + " vencida" + (urg === 1 ? "" : "s") + " ou vencendo em até 5 dias";
}
function renderEu(){
  var sel = $("#euSel"), as = analistas(), atual = S.eu;
  var html = '<option value="">' + (as.length ? "Escolha…" : "—") + '</option>' + as.map(function(a){ return '<option' + (a === atual ? " selected" : "") + '>' + esc(a) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = atual;
  $("#coordTag").hidden = !S.coord || S.exemplo;
}
$("#euSel").onchange = function(){ S.eu = this.value; if(!S.exemplo) salvarPrefs({eu:S.eu}); S.fx.ana = S.ag.ana = S.em.ana = S.eu || ""; renderTudo(true); };
function opcoesAnalista(sel, valor){
  var html = '<option value="">Todos os analistas</option>' + analistas().map(function(a){ return '<option' + (a === valor ? " selected" : "") + '>' + esc(a) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = valor || "";
}
function opcoesReg(sel, valor){
  var html = '<option value="">Todos os regimes</option>' + REGS.map(function(r){ return '<option value="' + r.k + '">' + esc(r.l) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = valor || "";
}
document.addEventListener("click", function(e){
  var t = e.target;
  if(t.closest(".pop")) return;
  var ir = t.closest("[data-ir]"); if(ir){ irPara(ir.getAttribute("data-ir")); return; }
  var fs = t.closest("[data-ir-fech]"); if(fs){ irPara("fechamento", {"fx.st": fs.getAttribute("data-ir-fech"), "fx.comp": "", "fx.busca": "", "fx.reg": fs.getAttribute("data-reg") || ""}); return; }
  var ag = t.closest("[data-ir-dia]"); if(ag){ var d = ag.getAttribute("data-ir-dia"); irPara("agenda", {"ag.mes": d.slice(0, 7), "ag.dia": d, "ag.ob": ag.getAttribute("data-ob") || ""}); return; }
  var an = t.closest("[data-ana-emp]"); if(an){ irPara("empresas", {"em.ana": an.getAttribute("data-ana-emp"), "em.faixa": an.getAttribute("data-faixa") || "", "em.busca": ""}); return; }
  var fi = t.closest("[data-ficha]"); if(fi){ abrirFicha(fi.getAttribute("data-ficha"), fi.getAttribute("data-aba") || ""); return; }
});

/* ============ PAINEL ============ */
function renderPainel(){
  var anim = vaiAnimar("painel"), lista = listaEmpresas(), kp = $("#pnKpis"), grid = $("#pnGrid");
  if(S.carregou.empresas && !lista.length){
    kp.innerHTML = "";
    grid.innerHTML = '<section class="pn-card pn-wide"><div class="vazio"><b style="display:block; color:var(--ink); font:700 14px Archivo,sans-serif; margin-bottom:6px">Nenhuma empresa na carteira ainda</b>Importe a planilha da carteira ou cadastre a primeira empresa.<div style="margin-top:12px; display:flex; gap:8px; justify-content:center"><button type="button" class="btn" data-ir="cadastro">Ir para Cadastro</button><button type="button" class="fbtn" data-ir="empresas">Empresas</button></div></div></section>';
    return;
  }
  var h = hoje(), cef = compEmFechamento(), base = S.eu ? lista.filter(minha) : lista;
  var naCef = base.filter(function(e){ return naComp(e, cef); });
  var fechadas = 0, atras = 0, cli = 0, prox7 = 0, venc = 0;
  naCef.forEach(function(e){ var r = resumo(e, cef); if(r.fechada) fechadas++; else if(r.cli) cli++; });
  base.forEach(function(e){ var s = situ(e); if(s.fechAtras.length) atras++; prox7 += s.obProx.length; venc += s.obVenc.length; });
  var kpi = function(cls, n, rot, sub, attrs){ return '<button type="button" class="kpi-card ' + cls + '" ' + attrs + '><div class="kpi-value">' + n + '</div><div class="kpi-label">' + rot + '</div><span class="sub">' + sub + '</span></button>'; };
  var ate7 = new Date(h); ate7.setDate(ate7.getDate() + 7);
  var proxDia = (ocorrencias().filter(function(o){ return o.data >= h && o.pend.length; })[0] || {}).ds || ymd(h);
  var vencDia = (ocorrencias().filter(function(o){ return o.data < h && o.pend.length && o.comp >= inicioControle(); }).slice(-1)[0] || {}).ds || ymd(h);
  kp.innerHTML =
    kpi("f0", fechadas, "Fechadas", "de " + naCef.length + " em " + esc(compCurta(cef)), 'data-ir-fech="fechadas"') +
    kpi("f3" + (atras ? " pulsa" : ""), atras, "Fechamento atrasado", "empresas fora do prazo", 'data-ir-fech="atras"') +
    kpi("fcli", cli, "Aguardando cliente", "fechamento parado no cliente", 'data-ir-fech="cli"') +
    kpi("f1", prox7, "Vencem em 7 dias", "entregas pendentes", 'data-ir-dia="' + proxDia + '"') +
    kpi("f3", venc, "Vencidas", "entregas que passaram do prazo", 'data-ir-dia="' + vencDia + '"');
  contar($$(".kpi-value", kp), anim);
  var card = function(titulo, sub, corpo, extra, cls){ return '<section class="pn-card ' + (cls || "") + '"><div class="pn-card-head"><h3>' + titulo + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + (extra || "") + '</div><div class="pn-card-body">' + corpo + '</div></section>'; };
  var filtro = {ana: S.eu || ""};
  var mes = compAtual(), ocMes = ocorrencias().map(function(o){ return recortar(o, filtro); }).filter(function(o){ return o && o.ds.slice(0, 7) === mes; });
  var porDia = {}; ocMes.forEach(function(o){ var x = porDia[o.ds] = porDia[o.ds] || {tot:0, pend:0, obs:[]}; x.tot += o.emps.length; x.pend += o.pend.length; x.obs.push(o.def.l); });

  // obrigações por dia (barras = entregas que ainda faltam; total no rótulo)
  var fimMes = compFim(mes).getDate(), maxV = 1;
  for(var d = 1; d <= fimMes; d++){ var k = mes + "-" + pad2(d); if(porDia[k]) maxV = Math.max(maxV, porDia[k].tot); }
  var passo = maxV <= 5 ? 1 : maxV <= 20 ? 5 : maxV <= 60 ? 10 : 50, topo = Math.ceil(maxV / passo) * passo;
  var ys = ""; for(var y = 0; y <= topo; y += passo){ ys += '<span style="top:' + (100 - y / topo * 100) + '%">' + y + '</span>'; }
  var grids = ""; for(var y2 = passo; y2 <= topo; y2 += passo){ grids += '<i class="cols-grid" style="top:' + (100 - y2 / topo * 100) + '%"></i>'; }
  var cols = "", xs = "";
  for(var d2 = 1; d2 <= fimMes; d2++){
    var ds = mes + "-" + pad2(d2), x = porDia[ds], dt = parseYmd(ds), pass = dt < h;
    var tit = dataBR(ds) + (x ? ": " + x.obs.join(", ") + " · " + x.pend + " de " + x.tot + " pendentes" : ": nada vence");
    cols += '<button type="button" class="col' + (x ? "" : " zero") + (ds === ymd(h) ? " today" : "") + (!diaUtil(dt) ? " off" : "") + '" style="--k:' + d2 + '" ' + (x ? 'data-ir-dia="' + ds + '"' : 'tabindex="-1"') + ' title="' + esc(tit) + '">' +
      (x ? '<span class="v">' + x.tot + '</span><span class="bar' + (pass && x.pend ? " atr" : "") + '" style="height:' + Math.max(2, x.tot / topo * 100) + '%"></span>' : '') + '</button>';
    if(d2 === 1 || d2 % 5 === 0) xs += '<span style="left:' + ((d2 - .5) / fimMes * 100) + '%">' + d2 + '</span>';
  }
  var colsCard = card("Obrigações por dia", esc(compRot(mes)) + (S.eu ? " · suas empresas" : "") + " · barra vermelha = venceu com entrega pendente",
    '<div class="cols"><div class="cols-y">' + ys + '</div><div class="cols-plot">' + grids + cols + '</div><div class="cols-x">' + xs + '</div></div>', '<button type="button" class="pn-link" data-ir="agenda">Abrir agenda</button>', "pn-span2");

  // mapa de calor do mês
  var ini = compIni(mes), cal = SEM3.map(function(s){ return '<span class="cal-wd">' + s.charAt(0) + '</span>'; }).join("");
  for(var b = 0; b < ini.getDay(); b++) cal += '<span class="cal-day blank"></span>';
  var modo = S.pn.mapa;
  var maxH = 1; Object.keys(porDia).forEach(function(k){ maxH = Math.max(maxH, modo === "pend" ? porDia[k].pend : porDia[k].tot); });
  for(var d3 = 1; d3 <= fimMes; d3++){
    var ds3 = mes + "-" + pad2(d3), dt3 = parseYmd(ds3), x3 = porDia[ds3], v3 = x3 ? (modo === "pend" ? x3.pend : x3.tot) : 0;
    var nv = v3 ? Math.min(5, 1 + Math.floor(v3 / maxH * 4.999)) : 0, fer = feriados(dt3.getFullYear())[ds3];
    cal += '<button type="button" class="cal-day' + (nv ? " h" + nv : fer ? " hol" : !diaUtil(dt3) ? " off" : "") + (ds3 === ymd(h) ? " is-today" : "") + (dt3 < h ? " past" : "") + '" data-ir-dia="' + ds3 + '" title="' + esc(dataBR(ds3) + (fer ? " · feriado" : "") + ": " + (v3 || "nenhuma") + (modo === "pend" ? " entrega(s) pendente(s)" : " entrega(s)")) + '">' + d3 + '</button>';
  }
  var heatCard = card("Mapa do mês", "", '<div class="cal">' + cal + '</div><div class="cal-legend"><span class="heat-key">menos <i style="background:var(--heat-1)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-5)"></i> mais</span><span>riscado = feriado</span></div>',
    '<span class="chips"><button type="button" class="chip-b' + (modo === "tudo" ? " on" : "") + '" data-mapa="tudo">Todas</button><button type="button" class="chip-b' + (modo === "pend" ? " on" : "") + '" data-mapa="pend">Pendentes</button></span>');

  // atenção: entregas vencidas, fechamentos atrasados e clientes parados
  var al = [];
  base.forEach(function(e){
    var s = situ(e);
    s.obVenc.forEach(function(o){ al.push({p:0, d:o.data, e:e, t:o.def.l + " de " + compCurta(o.comp), s:"venceu em " + dataBR(o.ds), c:"late", aba:"obrig"}); });
    if(s.fechAtras.length) al.push({p:1, d:limiteFech(s.fechAtras[0]), e:e, t:"Fechamento de " + s.fechAtras.map(compCurta).join(", "), s:"prazo era " + dataBR(ymd(limiteFech(s.fechAtras[0]))), c:"late", aba:"hist"});
    if(s.cli){ var dp = diasParado(entrada(s.cliComp, e.id)); if(dp >= 5) al.push({p:2, d:h, e:e, t:"Aguardando: " + s.cli, s:"parado há " + dp + " dias", c:"today", aba:"obs"}); }
  });
  al.sort(function(a, b){ return a.p - b.p || a.d - b.d; });
  var alCard = card("Atenção", al.length ? al.length + " ponto" + (al.length === 1 ? "" : "s") + (S.eu ? " nas suas empresas" : "") : "", al.length ? al.slice(0, 8).map(function(a){
    return '<button type="button" class="al-item" data-ficha="' + esc(a.e.id) + '" data-aba="' + a.aba + '"><i class="al-dot ' + a.c + '"></i><span style="min-width:0"><span class="dp-cell-main" style="display:block">' + esc(a.e.nome) + '</span><span class="dp-cell-sub" style="display:block">' + esc(a.t) + '</span></span><span class="cd ' + (a.c === "late" ? "venc" : "perto") + '">' + esc(a.s) + '</span></button>';
  }).join("") : '<div class="empty-mini">Nada vencido nem atrasado. 👏</div>', al.length > 8 ? '<button type="button" class="pn-link" data-ana-emp="' + esc(S.eu || "") + '" data-faixa="atras">Ver todas</button>' : "", "pn-span2");

  // fechamento por regime
  var met = REGS.map(function(r){
    var es = naCef.filter(function(e){ return e.regime === r.k; }); if(!es.length) return "";
    var f = es.filter(function(e){ return resumo(e, cef).fechada; }).length, p = Math.round(f / es.length * 100);
    return '<button type="button" class="meter' + (p >= 90 ? " ok" : p < 50 && h > limiteFech(cef) ? " warn" : "") + '" data-ir-fech="" data-reg="' + r.k + '"><span class="meter-top"><span>' + esc(r.l) + '</span><b>' + f + ' de ' + es.length + '</b></span><span class="meter-track" style="display:block"><span class="meter-fill" style="display:block; width:' + p + '%"></span></span></button>';
  }).join("");
  var limTxt = diasEntre(h, limiteFech(cef));
  var metCard = card("Fechamento por regime", esc(compRot(cef)) + " · " + (limTxt >= 0 ? "prazo em " + limTxt + " dia" + (limTxt === 1 ? "" : "s") : "prazo passou"), met ? '<div class="meters">' + met + '</div>' : '<div class="empty-mini">Nenhuma empresa na competência.</div>');

  // carteiras por analista
  var porAna = {};
  lista.forEach(function(e){ var a = e.analista || "(sem analista)", s = situ(e); var x = porAna[a] = porAna[a] || {a:a, n:0, atr:0, sd:0}; x.n++; if(s.atraso) x.atr++; x.sd += s.saude; });
  var ans = Object.keys(porAna).map(function(k){ return porAna[k]; }).sort(function(a, b){ return b.n - a.n || a.a.localeCompare(b.a, "pt-BR"); });
  var maxN = Math.max.apply(null, ans.map(function(a){ return a.n; }).concat([1]));
  var anaCard = card("Carteiras", "empresas por analista · clique para ver", '<div class="hbars' + (S.eu ? " has-sel" : "") + '">' + ans.map(function(a){
    return '<button type="button" class="hbar' + (norm(a.a) === norm(S.eu) ? " on" : "") + '" data-ana-emp="' + esc(a.a === "(sem analista)" ? "" : a.a) + '"><span class="hbar-name">' + esc(a.a) + '<small>' + (a.atr ? a.atr + " com atraso · " : "") + "saúde média " + Math.round(a.sd / a.n) + '%</small></span><span class="hbar-track"><span class="hbar-fill" style="width:' + Math.max(3, a.n / maxN * 85) + '%"></span><span class="hbar-v">' + a.n + '</span></span></button>';
  }).join("") + '</div>');

  // próximos vencimentos
  var prox = ocorrencias().map(function(o){ return recortar(o, filtro); }).filter(function(o){ return o && o.data >= h && o.pend.length; }).slice(0, 6);
  var proxCard = card("Próximos vencimentos", S.eu ? "das suas empresas" : "com entrega pendente", prox.length ? prox.map(function(o, i){
    var c = contagem(o.data);
    return '<button type="button" class="vc-item vc-btn" style="--k:' + i + '" data-ir-dia="' + o.ds + '">' + diaBox(o.data) + '<span style="min-width:0"><span class="dp-cell-main" style="display:block">' + esc(o.def.l) + '</span><span class="dp-cell-sub" style="display:block">' + esc(compCurta(o.comp)) + ' · ' + (o.emps.length - o.pend.length) + ' de ' + o.emps.length + ' entregues</span></span><span class="cd ' + c.c + '">' + esc(c.t) + '</span></button>';
  }).join("") : '<div class="empty-mini">Nenhuma entrega pendente pela frente.</div>', '<button type="button" class="pn-link" data-ir="agenda">Abrir agenda</button>', "pn-span2");

  grid.innerHTML = colsCard + heatCard + alCard + metCard + proxCard + anaCard;
  $$(".col", grid).forEach(function(c, k){ c.style.setProperty("--k", k); });
  marcarAnim(grid, anim, "pn-anim");
}
$("#pnGrid").addEventListener("click", function(e){ var m = e.target.closest("[data-mapa]"); if(m){ S.pn.mapa = m.getAttribute("data-mapa"); renderTudo(true); } });

/* ============ AGENDA ============ */
function ocDoMes(){
  var A = S.ag;
  return ocorrencias().map(function(o){ return recortar(o, A); }).filter(function(o){ return o && o.ds.slice(0, 7) === A.mes; });
}
function renderAgenda(){
  var A = S.ag, anim = vaiAnimar("agenda"), h = hoje(), hs = ymd(h);
  if(!A.mes) A.mes = compAtual();
  opcoesAnalista($("#agAna"), A.ana); opcoesReg($("#agReg"), A.reg);
  var ob = $("#agOb"), htmlOb = '<option value="">Todas as obrigações</option>' + (S.cfg.obrig || []).map(function(d){ return '<option value="' + esc(d.k) + '">' + esc(d.l) + '</option>'; }).join("");
  if(ob.innerHTML !== htmlOb) ob.innerHTML = htmlOb; ob.value = A.ob;
  $("#agRot").textContent = compRot(A.mes);
  var oc = ocDoMes(), porDia = {};
  oc.forEach(function(o){ (porDia[o.ds] = porDia[o.ds] || []).push(o); });
  if(!A.dia || A.dia.slice(0, 7) !== A.mes){
    var dias = Object.keys(porDia).sort(), depois = dias.filter(function(x){ return x >= hs; });
    A.dia = A.mes === compAtual() ? (porDia[hs] ? hs : depois[0] || hs) : (dias[0] || A.mes + "-01");
  }
  var nPend = 0, nTot = 0; oc.forEach(function(o){ nPend += o.pend.length; nTot += o.emps.length; });
  $("#agCont").textContent = nTot ? (nTot - nPend) + " de " + nTot + " entregas feitas no mês" : "nada vence neste mês";
  var ini = compIni(A.mes), fim = compFim(A.mes).getDate(), cal = SEM3.map(function(s){ return '<span class="agm-wd">' + s + '</span>'; }).join("");
  for(var b = 0; b < ini.getDay(); b++) cal += '<span class="agm-day blank"></span>';
  for(var d = 1; d <= fim; d++){
    var ds = A.mes + "-" + pad2(d), dt = parseYmd(ds), lst = porDia[ds] || [], fer = feriados(dt.getFullYear())[ds];
    var pend = lst.reduce(function(s, o){ return s + o.pend.length; }, 0), pass = dt < h;
    var evs = lst.slice(0, 3).map(function(o){ var cls = !o.pend.length ? " ok" : pass ? " late" : ""; return '<span class="agm-ev' + cls + '" title="' + esc(o.def.l + " · " + compCurta(o.comp) + " · " + (o.emps.length - o.pend.length) + " de " + o.emps.length + " entregues") + '"><span class="t">' + esc(o.def.l) + '</span><span class="n">' + (o.pend.length || "✓") + '</span></span>'; }).join("");
    cal += '<div class="agm-day' + (fer ? " hol" : !diaUtil(dt) ? " off" : "") + (ds === hs ? " is-today" : "") + (pass ? " past" : "") + (ds === A.dia ? " sel" : "") + '" data-dia="' + ds + '" role="button" tabindex="0" aria-label="' + esc(dataBR(ds) + (fer ? ", feriado" : "") + ": " + lst.length + " obrigação(ões)") + '"><span class="agm-num">' + d + '</span>' +
      (lst.length ? '<div class="agm-evs">' + evs + (lst.length > 3 ? '<span class="agm-more">+' + (lst.length - 3) + ' mais</span>' : '') + '</div><span class="agm-n' + (pend && pass ? " late" : "") + '">' + (pend || "✓") + '</span>' : '') + '</div>';
  }
  var resto = (7 - (ini.getDay() + fim) % 7) % 7; for(var r = 0; r < resto; r++) cal += '<span class="agm-day blank"></span>';
  $("#agCal").innerHTML = cal;
  // lista do dia
  var dsel = parseYmd(A.dia), lstD = porDia[A.dia] || [];
  $("#agDiaTit").textContent = SEM3[dsel.getDay()].charAt(0).toUpperCase() + SEM3[dsel.getDay()].slice(1) + ", " + dsel.getDate() + " de " + MESES[dsel.getMonth()];
  var pD = lstD.reduce(function(s, o){ return s + o.pend.length; }, 0);
  $("#agDiaCont").textContent = lstD.length ? lstD.length + " obrigaç" + (lstD.length === 1 ? "ão" : "ões") + " · " + (pD ? pD + " pendente" + (pD === 1 ? "" : "s") : "tudo entregue") : "";
  var ids = [];
  var html = lstD.length ? lstD.map(function(o){
    var c = contagem(o.data);
    var emps = o.emps.slice().sort(function(a, b){ var fa = feitoOb(stOb(o.comp, a, o.def.k)), fb = feitoOb(stOb(o.comp, b, o.def.k)); return (fa ? 1 : 0) - (fb ? 1 : 0) || ordNome(a, b); });
    return '<div class="ob-bloco"><div class="ob-h"><b>' + esc(o.def.l) + '</b><span class="cd ' + (o.pend.length ? c.c : "ok") + '">' + (o.pend.length ? esc(c.t) : "tudo entregue") + '</span><span class="cont">' + (o.emps.length - o.pend.length) + ' de ' + o.emps.length + '</span></div>' +
      '<div class="ob-sub">competência ' + esc(compRot(o.comp).toLowerCase()) + (o.def.d ? ' · ' + esc(o.def.d) : '') + '</div>' +
      emps.map(function(e){
        var v = (entrada(o.comp, e.id).ob || {})[o.def.k], s = v && v[0] ? v[0] : "", feito = feitoOb(s), pode = podeMarcar(e);
        if(v && v[2]) ids.push(v[2]);
        return '<div class="ob-emp' + (feito ? " feito" : "") + '"><button type="button" class="qd' + (feito ? " on" : "") + '" data-ob="' + esc(o.def.k) + '" data-comp="' + o.comp + '" data-emp="' + esc(e.id) + '"' + (pode ? "" : " disabled") + ' aria-pressed="' + feito + '" title="' + esc(feito ? infoMarca(v, OB_ROT) + " · clique para desmarcar" : pode ? "Marcar como entregue" : "Só o analista da empresa ou a coordenação marca") + '">' + (s === "r" ? "R" : s === "n" ? "–" : feito ? "✓" : "") + '</button>' +
          '<button type="button" class="nm" data-ficha="' + esc(e.id) + '" data-aba="obrig">' + esc(e.nome) + '</button><small>' + esc(feito ? (s === "n" ? "não se aplica" : (s === "r" ? "retificada " : "entregue ") + dataBR(v[1]).slice(0, 5)) : (e.analista || "sem analista").split(" ")[0]) + '</small></div>';
      }).join("") + '</div>';
  }).join("") : '<div class="empty-mini" style="padding:14px 0">Nada vence neste dia' + (A.ana || A.reg || A.ob ? " com esses filtros" : "") + '.' + (function(){ var nx = Object.keys(porDia).sort().filter(function(x){ return x > A.dia; })[0]; return nx ? ' <button type="button" class="linkish" data-ag-dia="' + nx + '">Próximo: ' + esc(dataBR(nx).slice(0, 5)) + ' · ' + esc(porDia[nx].map(function(o){ return o.def.l; }).join(", ")) + '</button>' : ''; })() + '</div>';
  buscarNomes(ids);
  $("#agLista").innerHTML = html;
  marcarAnim($("#agCal"), anim, "ls-anim");
}
function marcarEntrega(comp, e, k, s){
  var ent = clone(entrada(comp, e.id)); ent.ob = ent.ob || {};
  if(s) ent.ob[k] = [s, ymd(hoje()), quemSou()]; else delete ent.ob[k];
  return salvarCompEntrada(comp, e.id, ent);
}
$("#agAnt").onclick = function(){ S.ag.mes = compShift(S.ag.mes, -1); S.ag.dia = ""; renderTudo(true); };
$("#agProx").onclick = function(){ S.ag.mes = compShift(S.ag.mes, 1); S.ag.dia = ""; renderTudo(true); };
$("#agHoje").onclick = function(){ S.ag.mes = compAtual(); S.ag.dia = ymd(hoje()); renderTudo(true); };
$("#agAna").onchange = function(){ S.ag.ana = this.value; renderTudo(true); };
$("#agReg").onchange = function(){ S.ag.reg = this.value; renderTudo(true); };
$("#agOb").onchange = function(){ S.ag.ob = this.value; renderTudo(true); };
$("#agCal").addEventListener("click", function(e){ var d = e.target.closest("[data-dia]"); if(d){ S.ag.dia = d.getAttribute("data-dia"); renderTudo(true); } });
$("#agCal").addEventListener("keydown", function(e){ if(e.key !== "Enter" && e.key !== " ") return; var d = e.target.closest("[data-dia]"); if(d){ e.preventDefault(); S.ag.dia = d.getAttribute("data-dia"); renderTudo(true); var n = $('#agCal [data-dia="' + S.ag.dia + '"]'); if(n) n.focus(); } });
$("#agLista").addEventListener("click", function(ev){
  var nx = ev.target.closest("[data-ag-dia]"); if(nx){ S.ag.dia = nx.getAttribute("data-ag-dia"); renderTudo(true); return; }
  var b = ev.target.closest("button.qd[data-ob]"); if(!b) return;
  var e = S.empresas[b.getAttribute("data-emp")], comp = b.getAttribute("data-comp"), k = b.getAttribute("data-ob");
  if(!e || !podeMarcar(e)) return;
  var antes = stOb(comp, e, k), def = (S.cfg.obrig || []).filter(function(d){ return d.k === k; })[0];
  marcarEntrega(comp, e, k, feitoOb(antes) ? "" : "c");
  if(!feitoOb(antes)) toast((def ? def.l : "Obrigação") + " de “" + e.nome + "” entregue.", "Desfazer", function(){ marcarEntrega(comp, e, k, antes); });
});

/* ============ EMPRESAS ============ */
var EMP_FAIXAS = [
  {k:"simples",   l:"Simples",            c:"ok",   f:function(e){ return e.regime === "simples"; }},
  {k:"presumido", l:"Presumido",          c:"info", f:function(e){ return e.regime === "presumido"; }},
  {k:"real",      l:"Real",               c:"fis",  f:function(e){ return e.regime === "real"; }},
  {k:"atras",     l:"Com atraso",         c:"late", f:function(e){ return situ(e).atraso; }},
  {k:"cli",       l:"Aguardando cliente", c:"warn", f:function(e){ return !!situ(e).cli; }}
];
function filtroTexto(e, q){ if(!q) return true; var h = norm([e.nome, e.cnpj, cnpjDig(e.cnpj), e.analista, e.municipio, e.uf, e.ie, e.im].join(" ")); return norm(q).split(" ").every(function(w){ return h.indexOf(w) !== -1; }); }
function linhaSit(e){
  var s = situ(e), out = [];
  if(s.obVenc.length) out.push(['var(--dp-late)', s.obVenc.length + " entrega" + (s.obVenc.length === 1 ? "" : "s") + " vencida" + (s.obVenc.length === 1 ? "" : "s") + ": " + s.obVenc.slice(0, 2).map(function(o){ return o.def.l; }).join(", ") + (s.obVenc.length > 2 ? "…" : "")]);
  if(s.fechAtras.length) out.push(['var(--dp-late)', "Fechamento atrasado: " + s.fechAtras.map(compCurta).join(", ")]);
  if(s.cli) out.push(['var(--dp-today)', "Aguardando cliente: " + s.cli]);
  if(!out.length && s.fech) out.push([s.fech.fechada ? 'var(--dp-ok)' : 'var(--blue-deep)', s.fech.fechada ? compRot(compEmFechamento()) + " fechada" : compRot(compEmFechamento()) + ": " + s.fech.feitas + " de " + s.fech.total + " etapas"]);
  if(s.obProx.length && out.length < 3) out.push(['var(--sector-fiscal)', s.obProx.length + " entrega" + (s.obProx.length === 1 ? "" : "s") + " nos próximos 7 dias"]);
  if(e.sit === "inativa") out.unshift(['var(--ink-3)', "Inativa" + (e.ate ? " desde " + compCurta(compShift(e.ate, 1)) : "")]);
  return out;
}
function renderEmpresas(){
  var M = S.em, anim = vaiAnimar("empresas");
  if($("#emBusca").value !== M.busca) $("#emBusca").value = M.busca;
  opcoesAnalista($("#emAna"), M.ana);
  $$("#emModo button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-m") === M.modo); });
  var base = listaEmpresas().filter(function(e){ return (!M.ana || norm(e.analista) === norm(M.ana)) && filtroTexto(e, M.busca); });
  $("#emFaixa").innerHTML = EMP_FAIXAS.map(function(f){ var n = base.filter(f.f).length; return '<button type="button" class="emp-fx ' + f.c + (M.faixa === f.k ? " on" : "") + (n ? "" : " zero") + '" data-fx="' + f.k + '" aria-pressed="' + (M.faixa === f.k) + '"><i></i><span>' + esc(f.l) + '</span><b>' + n + '</b></button>'; }).join("");
  var fx = EMP_FAIXAS.filter(function(f){ return f.k === M.faixa; })[0];
  var lista = base.filter(function(e){ return !fx || fx.f(e); }).sort(function(a, b){ return (a.sit === "inativa" ? 1 : 0) - (b.sit === "inativa" ? 1 : 0) || situ(a).saude - situ(b).saude || ordNome(a, b); });
  var tot = listaEmpresas().length;
  $("#emCont").textContent = lista.length + (lista.length !== tot ? " de " + tot : "") + " empresa" + (tot === 1 ? "" : "s");
  var cartoes = M.modo === "cartoes";
  $("#emGrid").hidden = !cartoes; $("#emLista").hidden = cartoes;
  var vazio = '<div class="vazio" style="grid-column:1/-1">' + (tot ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? "Nenhuma empresa na carteira ainda." : "Carregando…") + '</div>';
  var vis = lista.slice(0, M.limite), mais = lista.length > vis.length ? '<div class="mais" style="grid-column:1/-1; text-align:center"><button type="button" class="fbtn" id="emMais">Mostrar mais (' + (lista.length - vis.length) + ')</button></div>' : '';
  if(cartoes){
    $("#emGrid").innerHTML = (lista.length ? vis.map(function(e, k){
      var s = situ(e), cor = corSaude(s.saude);
      return '<button type="button" class="emp-card' + (e.sit === "inativa" ? " inativa" : "") + '" style="--k:' + k + '" data-ficha="' + esc(e.id) + '">' +
        '<div class="emp-top"><span class="emp-anel" style="--p:' + s.saude + '; --c:' + cor + '" title="Saúde ' + s.saude + '%: fechamentos e entregas em dia nos últimos 90 dias"><span class="avatar" style="--av:' + corDe(e.analista) + '">' + esc(iniciais(e.analista)) + '</span></span>' +
        '<span class="emp-name"><span class="dp-cell-main" style="display:block">' + esc(e.nome) + '</span><span class="dp-cell-sub" style="display:block">' + esc(e.cnpj || "sem CNPJ") + ' · ' + esc(e.analista || "sem analista") + '</span></span></div>' +
        '<div class="emp-tags">' + regPill(e.regime) + (e.ativ ? '<span class="chip-s">' + esc(ATIV[e.ativ].l) + '</span>' : '') + (e.municipio ? '<span class="chip-s">' + esc(e.municipio + (e.uf ? "/" + e.uf : "")) + '</span>' : '') + '</div>' +
        linhaSit(e).map(function(l){ return '<span class="emp-st" style="--c:' + l[0] + '"><i></i><span>' + esc(l[1]) + '</span></span>'; }).join("") +
        '<span class="emp-fio' + (s.saude < 70 ? " late" : "") + '" style="width:' + s.saude + '%"></span></button>';
    }).join("") : vazio) + mais;
    animarLinhas($("#emGrid"), anim, ".emp-card");
  } else {
    $("#emTab").innerHTML = '<thead><tr><th>Empresa</th><th>Regime</th><th>Atividade</th><th>Município</th><th>Analista</th><th>Saúde</th><th>' + esc(compCurta(compEmFechamento())) + '</th><th>Entregas</th></tr></thead><tbody>' +
      (lista.length ? vis.map(function(e){
        var s = situ(e), f = s.fech;
        return '<tr' + (e.sit === "inativa" ? ' class="fora"' : '') + '><td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="sub">' + esc(e.cnpj) + '</span></td><td>' + regPill(e.regime) + '</td><td>' + esc(e.ativ ? ATIV[e.ativ].l : "—") + '</td><td>' + esc(e.municipio ? e.municipio + (e.uf ? "/" + e.uf : "") : "—") + '</td><td>' + esc(e.analista || "—") + '</td>' +
          '<td><span class="prog"><i><b style="width:' + s.saude + '%; background:' + corSaude(s.saude) + '"></b></i>' + s.saude + '%</span></td>' +
          '<td>' + (!f ? '—' : f.fechada ? '<span class="pill pill-ok">fechada</span>' : f.cli ? '<span class="pill pill-today">cliente</span>' : f.atras ? '<span class="pill pill-late">atrasada</span>' : '<span class="pill">' + f.feitas + '/' + f.total + '</span>') + '</td>' +
          '<td>' + (s.obVenc.length ? '<span class="pill pill-late">' + s.obVenc.length + ' vencida' + (s.obVenc.length === 1 ? '' : 's') + '</span> ' : '') + (s.obProx.length ? '<span class="pill pill-soon">' + s.obProx.length + ' em 7 dias</span>' : (s.obVenc.length ? '' : '<span class="pill pill-ok">em dia</span>')) + '</td></tr>';
      }).join("") : '<tr><td colspan="8">' + vazio + '</td></tr>') + '</tbody>';
    $("#emLista .mais") && $("#emLista .mais").remove();
    if(mais) $("#emLista").insertAdjacentHTML("beforeend", mais);
    animarLinhas($("#emTab"), anim);
  }
}
$("#emBusca").oninput = function(){ S.em.busca = this.value; S.em.limite = 120; renderTudo(); };
$("#emAna").onchange = function(){ S.em.ana = this.value; renderTudo(true); };
$$("#emModo button").forEach(function(b){ b.onclick = function(){ S.em.modo = b.getAttribute("data-m"); salvarPrefs({emModo:S.em.modo}); animarView = "empresas"; renderTudo(true); }; });
$("#emFaixa").addEventListener("click", function(e){ var b = e.target.closest("[data-fx]"); if(!b) return; var k = b.getAttribute("data-fx"); S.em.faixa = S.em.faixa === k ? "" : k; animarView = "empresas"; renderTudo(true); });
$("#v-empresas").addEventListener("click", function(e){ if(e.target.id === "emMais"){ S.em.limite += 120; renderTudo(true); } });
$("#emNova").onclick = function(){ abrirFicha("", "dados"); };

/* ============ FECHAMENTO ============ */
function renderFechamento(){
  var F = S.fx, anim = vaiAnimar("fechamento");
  var comps = compsControle().filter(function(c){ return c <= compAtual(); });
  if(!F.comp || comps.indexOf(F.comp) === -1) F.comp = comps.indexOf(compEmFechamento()) !== -1 ? compEmFechamento() : comps[comps.length - 1];
  var comp = F.comp, lim = limiteFech(comp);
  $("#compRot").innerHTML = esc(compRot(comp)) + (comp === compAtual() ? ' <span class="pill">mês corrente</span>' : hoje() > lim ? '' : ' <span class="pill pill-soon">prazo ' + esc(dataBR(ymd(lim)).slice(0, 5)) + '</span>');
  $("#compAnt").disabled = comps.indexOf(comp) <= 0; $("#compProx").disabled = comps.indexOf(comp) >= comps.length - 1;
  if($("#fxBusca").value !== F.busca) $("#fxBusca").value = F.busca;
  opcoesAnalista($("#fxAna"), F.ana); opcoesReg($("#fxReg"), F.reg);
  $$("#fxSt button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-st") === F.st); });
  var base = listaEmpresas().filter(function(e){ return naComp(e, comp); });
  var lista = base.filter(function(e){
    if(F.ana && norm(e.analista) !== norm(F.ana)) return false;
    if(F.reg && e.regime !== F.reg) return false;
    if(!filtroTexto(e, F.busca)) return false;
    if(F.st){ var r = resumo(e, comp); if(F.st === "abertas" ? r.fechada : F.st === "fechadas" ? !r.fechada : F.st === "atras" ? !r.atras : F.st === "cli" ? !r.cli : false) return false; }
    return true;
  }).sort(function(a, b){ var ra = resumo(a, comp), rb = resumo(b, comp); return (ra.fechada ? 1 : 0) - (rb.fechada ? 1 : 0) || (rb.atras ? 1 : 0) - (ra.atras ? 1 : 0) || ordNome(a, b); });
  var fechadas = lista.filter(function(e){ return resumo(e, comp).fechada; }).length;
  $("#fxCont").textContent = lista.length + (lista.length !== base.length ? " de " + base.length : "") + " empresas · " + fechadas + " fechadas · prazo " + dataBR(ymd(lim));
  F.sel.forEach(function(id){ if(!lista.some(function(e){ return e.id === id; })) F.sel.delete(id); });
  var marcaveis = lista.filter(podeMarcar), ids = [];
  lista.forEach(function(e){ ETAPAS.forEach(function(et){ var v = entrada(comp, e.id).e; v = v && v[et.k]; if(v && v[2]) ids.push(v[2]); }); });
  buscarNomes(ids);
  var tudoSel = marcaveis.length && marcaveis.every(function(e){ return F.sel.has(e.id); });
  var html = '<thead><tr><th style="width:30px">' + (marcaveis.length ? '<input type="checkbox" id="fxTodos" aria-label="Selecionar todas que você pode marcar"' + (tudoSel ? " checked" : "") + '>' : '') + '</th><th>Empresa</th>' +
    ETAPAS.map(function(et){ return '<th class="et" title="' + esc(et.l) + '">' + esc(et.c) + '</th>'; }).join("") + '<th>Andamento</th><th>Pendência do cliente</th><th></th></tr></thead><tbody>';
  if(!lista.length) html += '<tr><td colspan="' + (ETAPAS.length + 5) + '"><div class="vazio">' + (base.length ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? "Nenhuma empresa da carteira nesta competência." : "Carregando…") + '</div></td></tr>';
  html += lista.map(function(e){
    var r = resumo(e, comp), pode = podeMarcar(e), pct = r.total ? Math.round(r.feitas / r.total * 100) : 100;
    return '<tr class="' + (r.fechada ? "fechada" : r.atras ? "atras" : "") + '" data-emp="' + esc(e.id) + '">' +
      '<td>' + (pode ? '<input type="checkbox" class="fxSel" data-id="' + esc(e.id) + '"' + (F.sel.has(e.id) ? " checked" : "") + ' aria-label="Selecionar ' + esc(e.nome) + '">' : '') + '</td>' +
      '<td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="sub">' + esc(e.analista || "sem analista") + ' · ' + regPill(e.regime) + '</span></td>' +
      ETAPAS.map(function(et){
        var s = stEtapa(r.ent, et.k), v = r.ent.e && r.ent.e[et.k];
        return '<td class="et">' + stCell(s, 'data-et="' + et.k + '"', pode, et.l + ": " + (infoMarca(v) || ST_ROT[s]) + (pode ? "" : " · só o analista da empresa ou a coordenação marca")) + '</td>';
      }).join("") +
      '<td><span class="prog"><i><b style="width:' + pct + '%"></b></i>' + (r.fechada ? "fechada" : r.atras ? '<span style="color:var(--dp-late); font-weight:600">atrasada</span>' : r.feitas + "/" + r.total) + '</span></td>' +
      '<td class="pend-td"><button type="button" class="pend-btn' + (r.pend ? " tem" : "") + '" data-pend' + (pode ? "" : " disabled") + ' title="' + esc(r.pend ? "Aguardando o cliente desde " + dataBR(r.ent.pendEm) + ": " + r.pend : "Registrar o que falta o cliente mandar") + '">' + (r.pend ? "⏳ " + esc(r.pend) : (pode && !r.fechada ? "+ pendência" : "")) + '</button></td>' +
      '<td>' + (pode && !r.fechada ? '<button type="button" class="fbtn" data-tudo title="Marcar todas as etapas como concluídas">✓ Tudo</button>' : '') + '</td></tr>';
  }).join("") + '</tbody>';
  $("#fxTab").innerHTML = html;
  animarLinhas($("#fxTab"), anim);
  $("#fxLeg").innerHTML = ["", "a", "c", "n"].map(function(s){ return '<span><span class="st ' + (s || "p") + '">' + ST_SIM[s] + '</span> ' + ST_ROT[s] + '</span>'; }).join("") + '<span>· Clique numa etapa para mudar. Faixa vermelha = passou do prazo do fechamento (dia ' + (+S.cfg.limite || 20) + ' do mês seguinte).</span>';
  var nSel = F.sel.size, lote = $("#fxLote");
  lote.hidden = !nSel;
  if(nSel) lote.innerHTML = '<b>' + nSel + ' selecionada' + (nSel === 1 ? '' : 's') + '</b> Marcar <select id="loteEt"><option value="*">todas as etapas</option>' + ETAPAS.map(function(et){ return '<option value="' + et.k + '">' + esc(et.l) + '</option>'; }).join("") + '</select> como <select id="loteSt"><option value="c">Concluída</option><option value="a">Em andamento</option><option value="">Pendente</option><option value="n">Não se aplica</option></select><button type="button" class="btn" id="loteOk">Aplicar</button><button type="button" class="linkish" id="loteLimpar">Limpar seleção</button>';
}
function marcarEtapas(comp, e, mudancas){
  var ent = clone(entrada(comp, e.id)), dia = ymd(hoje());
  ent.e = ent.e || {};
  var r0 = resumo(e, comp).fechada;
  Object.keys(mudancas).forEach(function(k){ var s = mudancas[k]; if(s) ent.e[k] = [s, dia, quemSou()]; else delete ent.e[k]; });
  var total = 0, feitas = 0; ETAPAS.forEach(function(et){ var s = stEtapa(ent, et.k); if(s !== "n"){ total++; if(s === "c") feitas++; } });
  var r1 = feitas === total;
  if(r1 && !r0){ ent.fechadaEm = dia; if(ent.pend){ ent.pend = ""; ent.pendEm = ""; ent.cobr = []; } }
  if(!r1) ent.fechadaEm = "";
  return {ent:ent, fechou: r1 && !r0};
}
$("#compAnt").onclick = function(){ S.fx.comp = compShift(S.fx.comp, -1); S.fx.sel.clear(); renderTudo(true); };
$("#compProx").onclick = function(){ S.fx.comp = compShift(S.fx.comp, 1); S.fx.sel.clear(); renderTudo(true); };
$("#fxBusca").oninput = function(){ S.fx.busca = this.value; renderTudo(); };
$("#fxAna").onchange = function(){ S.fx.ana = this.value; renderTudo(true); };
$("#fxReg").onchange = function(){ S.fx.reg = this.value; renderTudo(true); };
$$("#fxSt button").forEach(function(b){ b.onclick = function(){ S.fx.st = b.getAttribute("data-st"); renderTudo(true); }; });
$("#v-fechamento").addEventListener("change", function(e){
  var t = e.target;
  if(t.id === "fxTodos"){ $$(".fxSel").forEach(function(c){ if(t.checked) S.fx.sel.add(c.getAttribute("data-id")); else S.fx.sel.delete(c.getAttribute("data-id")); }); renderTudo(true); }
  else if(t.classList.contains("fxSel")){ if(t.checked) S.fx.sel.add(t.getAttribute("data-id")); else S.fx.sel.delete(t.getAttribute("data-id")); renderTudo(true); }
});
$("#v-fechamento").addEventListener("click", function(ev){
  var t = ev.target, comp = S.fx.comp;
  var tr = t.closest("tr[data-emp]"), e = tr && S.empresas[tr.getAttribute("data-emp")];
  var b = t.closest("button[data-et]");
  if(b && e){
    var k = b.getAttribute("data-et"), ent = entrada(comp, e.id), v = ent.e && ent.e[k];
    menuStatus(b, stEtapa(ent, k), ["", "a", "c", "n"], ST_ROT, infoMarca(v), function(s){
      var m = {}; m[k] = s; var res = marcarEtapas(comp, e, m);
      salvarCompEntrada(comp, e.id, res.ent);
      if(res.fechou) toast("“" + e.nome + "” fechou " + compCurta(comp) + ".");
    });
    return;
  }
  if(t.closest("[data-tudo]") && e){
    var m2 = {}; ETAPAS.forEach(function(et){ if(stEtapa(entrada(comp, e.id), et.k) !== "n") m2[et.k] = "c"; });
    var antes = clone(entrada(comp, e.id)), res2 = marcarEtapas(comp, e, m2);
    salvarCompEntrada(comp, e.id, res2.ent);
    toast("“" + e.nome + "” fechou " + compCurta(comp) + ".", "Desfazer", function(){ salvarCompEntrada(comp, e.id, antes); });
    return;
  }
  var pb = t.closest("[data-pend]");
  if(pb && e){ abrirPendencia(pb, comp, e); return; }
  if(t.id === "loteLimpar"){ S.fx.sel.clear(); renderTudo(true); return; }
  if(t.id === "loteOk"){
    var et = $("#loteEt").value, st = $("#loteSt").value, mapa = {}, n = 0;
    S.fx.sel.forEach(function(id){
      var em = S.empresas[id]; if(!em || !podeMarcar(em)) return;
      var m3 = {}; (et === "*" ? ETAPAS.map(function(x){ return x.k; }) : [et]).forEach(function(k2){ m3[k2] = st; });
      mapa[id] = marcarEtapas(comp, em, m3).ent; n++;
    });
    S.fx.sel.clear();
    if(n) salvarCompVarias(comp, mapa).then(function(){ toast(n + " empresa" + (n === 1 ? "" : "s") + " atualizada" + (n === 1 ? "" : "s") + " em " + compCurta(comp) + "."); });
    else renderTudo(true);
  }
});
/* ---------- pendência do cliente (com cobranças) ---------- */
function abrirPendencia(alvo, comp, e){
  var ent0 = entrada(comp, e.id), cobr = ent0.cobr || [], parado = ent0.pend ? diasParado(ent0) : 0;
  abrirPop(alvo, '<div class="info" style="border:0;margin:0;padding:2px 8px 6px">' + esc(e.nome) + ' · ' + esc(compRot(comp)) + '</div>' +
    '<label class="campo">O que falta o cliente mandar?<textarea id="pendTxt" maxlength="200" placeholder="Ex.: XML das notas de entrada">' + esc(ent0.pend || "") + '</textarea></label>' +
    (ent0.pend ? '<div class="info">Pedido em ' + esc(dataBR(ent0.pendEm) || "—") + (cobr.length ? ' · ' + cobr.length + ' cobrança' + (cobr.length === 1 ? '' : 's') + ': ' + esc(cobr.slice(-4).map(dataBR).join(", ")) : ' · nenhuma cobrança registrada') + ' · parado há ' + parado + ' dia' + (parado === 1 ? '' : 's') + '</div>' : '') +
    '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap">' + (ent0.pend ? '<button type="button" class="fbtn" id="pendCobr">Cobrado de novo hoje</button><button type="button" class="fbtn" id="pendLimpar">Recebido</button>' : '') + '<button type="button" class="btn" id="pendOk">Salvar</button></div>', function(p){
    var salvar = function(txt, cobrar){
      var ent = clone(entrada(comp, e.id));
      ent.pendEm = txt ? (ent.pend ? (ent.pendEm || ymd(hoje())) : ymd(hoje())) : "";
      ent.cobr = txt ? (ent.pend ? (ent.cobr || []) : []) : [];
      if(cobrar) ent.cobr = ent.cobr.concat([ymd(hoje())]).slice(-20);
      ent.pend = txt;
      fecharPop(); salvarCompEntrada(comp, e.id, ent);
      if(cobrar) toast("Cobrança registrada para “" + e.nome + "”.");
    };
    $("#pendOk", p).onclick = function(){ salvar($("#pendTxt", p).value.trim().slice(0, 200)); };
    if($("#pendLimpar", p)) $("#pendLimpar", p).onclick = function(){ salvar(""); };
    if($("#pendCobr", p)) $("#pendCobr", p).onclick = function(){ salvar($("#pendTxt", p).value.trim().slice(0, 200) || ent0.pend, true); };
    $("#pendTxt", p).addEventListener("keydown", function(k){ if(k.key === "Enter" && !k.shiftKey){ k.preventDefault(); $("#pendOk", p).click(); } });
  });
}

/* ============ FICHA DA EMPRESA ============ */
var fichaId = null, fichaAba = "dados";
var FICHA_ABAS = [["dados", "Dados"], ["obrig", "Obrigações"], ["hist", "Histórico"], ["obs", "Observações"]];
function abrirFicha(id, aba){
  var e = id ? S.empresas[id] : null;
  if(id && !e) return;
  if(!e && !(S.coord || S.exemplo)){ toast("Só a coordenação cadastra empresas."); return; }
  fichaId = e ? e.id : null; fichaAba = e && aba ? aba : "dados";
  var x = e || normEmp({}, "");
  var pode = S.exemplo || S.coord || (e && minha(e)), dis = pode ? "" : " disabled";
  var opt = function(lista, v, vazio){ return '<option value="">' + vazio + '</option>' + lista.map(function(o){ return '<option value="' + o.k + '"' + (o.k === v ? " selected" : "") + '>' + esc(o.l) + '</option>'; }).join(""); };
  var d = $("#dlgFicha");
  d.innerHTML = '<div class="dlg-head"><h2>' + esc(e ? e.nome : "Nova empresa") + '</h2>' + (e ? regPill(e.regime) : '') + '<button type="button" class="x" id="fFechar" aria-label="Fechar">✕</button></div>' +
    (e ? '<div class="ftabs" role="tablist">' + FICHA_ABAS.map(function(a){ return '<button type="button" class="ftab' + (a[0] === fichaAba ? " on" : "") + '" role="tab" data-faba="' + a[0] + '">' + a[1] + '</button>'; }).join("") + '</div>' : '') +
    '<form class="dlg-body" id="fForm" novalidate>' +
      '<div data-pane="dados"' + (fichaAba === "dados" ? "" : " hidden") + '>' +
        (pode ? '' : '<p class="note" style="margin-bottom:10px">Só o analista da empresa ou a coordenação altera esta ficha.</p>') +
        '<div class="campos">' +
          '<label class="campo largo">Empresa<input name="nome" required maxlength="160" value="' + esc(x.nome === "Sem nome" ? "" : x.nome) + '"' + dis + '></label>' +
          '<label class="campo">CNPJ<input name="cnpj" maxlength="20" value="' + esc(x.cnpj) + '" placeholder="00.000.000/0000-00"' + dis + '></label>' +
          '<label class="campo">Regime<select name="regime"' + dis + '>' + opt(REGS, x.regime, "—") + '</select></label>' +
          '<label class="campo">Atividade<select name="ativ"' + dis + '>' + opt(ATIVS, x.ativ, "—") + '</select></label>' +
          '<label class="campo">Inscrição estadual<input name="ie" maxlength="30" value="' + esc(x.ie) + '"' + dis + '></label>' +
          '<label class="campo">Inscrição municipal<input name="im" maxlength="30" value="' + esc(x.im) + '"' + dis + '></label>' +
          '<label class="campo">Município<input name="municipio" maxlength="60" value="' + esc(x.municipio) + '"' + dis + '></label>' +
          '<label class="campo">UF<input name="uf" maxlength="2" value="' + esc(x.uf) + '" style="text-transform:uppercase"' + dis + '></label>' +
          '<label class="campo">Analista<input name="analista" list="dlAna" maxlength="60" value="' + esc(x.analista) + '"' + (S.coord || S.exemplo ? dis : " disabled title=\"Só a coordenação transfere a empresa\"") + '><datalist id="dlAna">' + analistas().map(function(a){ return '<option value="' + esc(a) + '">'; }).join("") + '</datalist></label>' +
          '<label class="campo">Cliente desde (competência)<input type="month" name="desde" value="' + esc(x.desde) + '"' + dis + '></label>' +
          '<label class="campo">Situação<select name="sit"' + dis + '><option value="ativa"' + (x.sit === "ativa" ? " selected" : "") + '>Ativa</option><option value="inativa"' + (x.sit === "inativa" ? " selected" : "") + '>Inativa / saiu</option></select></label>' +
          '<label class="campo">Última competência (se saiu)<input type="month" name="ate" value="' + esc(x.ate) + '"' + dis + '></label>' +
        '</div>' +
      '</div>' +
      (e ? '<div data-pane="obrig"' + (fichaAba === "obrig" ? "" : " hidden") + ' id="fObrig"></div>' +
        '<div data-pane="hist"' + (fichaAba === "hist" ? "" : " hidden") + '>' + fichaHist(e) + '</div>' : '') +
      '<div data-pane="obs"' + (fichaAba === "obs" || (!e && false) ? "" : " hidden") + '>' +
        '<label class="campo">Observações<textarea name="obs" rows="6" maxlength="1500"' + dis + ' placeholder="Particularidades, combinados com o cliente, cuidados…">' + esc(x.obs) + '</textarea></label>' +
        (e ? fichaPend(e) : '') +
      '</div>' +
    '</form>' +
    '<div class="dlg-acoes">' + (e && (S.coord || S.exemplo) ? '<button type="button" class="linkish red esq" id="fExcluir">Excluir da carteira</button>' : '') + '<button type="button" class="fbtn" id="fCancelar">' + (pode ? "Cancelar" : "Fechar") + '</button>' + (pode ? '<button type="button" class="btn" id="fSalvar">Salvar</button>' : '') + '</div>';
  if(e && fichaAba === "obrig") pintarFichaObrig();
  $("#fForm").onsubmit = function(ev){ ev.preventDefault(); };
  var fechar = function(){ fecharPop(); d.close(); fichaId = null; };
  $("#fFechar").onclick = fechar; $("#fCancelar").onclick = fechar;
  d.oncancel = function(ev){ ev.preventDefault(); if(pop){ fecharPop(); return; } fechar(); };
  $$(".ftab", d).forEach(function(b){ b.onclick = function(){
    fichaAba = b.getAttribute("data-faba");
    $$(".ftab", d).forEach(function(o){ o.classList.toggle("on", o === b); });
    $$("[data-pane]", d).forEach(function(p){ p.hidden = p.getAttribute("data-pane") !== fichaAba; });
    if(fichaAba === "obrig") pintarFichaObrig();
  }; });
  if($("#fSalvar")) $("#fSalvar").onclick = function(){ salvarFicha(e); };
  if($("#fExcluir")) $("#fExcluir").onclick = function(){
    confirmar("Excluir “" + e.nome + "” da carteira? O histórico de fechamento e entregas fica guardado.", "Excluir").then(function(ok){
      if(!ok) return;
      var y = clone(e); y.excluida = true; fechar();
      salvarEmpresas([y]).then(function(){ toast("“" + e.nome + "” saiu da carteira.", "Desfazer", function(){ var z = clone(y); z.excluida = false; salvarEmpresas([z]); }); });
    });
  };
  if(!d.open) d.showModal();
  var f = $('[data-pane="' + fichaAba + '"] input:not(:disabled), [data-pane="' + fichaAba + '"] button', d); if(f && fichaAba === "dados") f.focus();
}
function fichaHist(e){
  var cs = compsControle().filter(function(c){ return c <= compEmFechamento() && naComp(e, c); }).slice(-6), out = "";
  if(cs.length){
    out += '<div class="ficha-sec" style="border-top:0; padding-top:0"><h3>Fechamento</h3><div class="tlq" style="grid-template-columns:110px repeat(' + cs.length + ', minmax(0,1fr))"><span></span>' + cs.map(function(c){ return '<span class="h">' + esc(compCurta(c)) + '</span>'; }).join("") +
      ETAPAS.map(function(et){
        return '<span class="r">' + esc(et.c) + '</span>' + cs.map(function(c){
          var ent = entrada(c, e.id), st = stEtapa(ent, et.k), v = ent.e && ent.e[et.k], atr = resumo(e, c).atras;
          var cl = st === "c" ? "ok" : st === "n" ? "na" : st === "a" ? "and" : atr ? "atr" : "ab";
          return '<span class="q ' + cl + '" title="' + esc(et.l + " · " + compRot(c) + ": " + (infoMarca(v) || {ok:"concluída", na:"não se aplica", and:"em andamento", atr:"atrasada", ab:"em aberto"}[cl])) + '"></span>';
        }).join("");
      }).join("") + '</div><div class="leg-f"><span><i class="q ok"></i>concluída</span><span><i class="q and"></i>em andamento</span><span><i class="q atr"></i>atrasada</span><span><i class="q ab"></i>em aberto</span><span><i class="q na"></i>não se aplica</span></div></div>';
  }
  var hs = (e.hist || []).slice().reverse();
  out += '<div class="ficha-sec"' + (cs.length ? '' : ' style="border-top:0; padding-top:0"') + '><h3>Alterações na ficha</h3>' + (hs.length ? '<ul class="hist-l">' + hs.map(function(h){ var n = nomeDe(h.u); return '<li><time>' + esc(dataBR(String(h.d).slice(0, 10))) + '</time><span>' + esc(h.t) + (n ? ' <span class="sub">· ' + esc(n) + '</span>' : '') + '</span></li>'; }).join("") + '</ul>' : '<p class="note">Nenhuma alteração registrada.</p>') + '</div>';
  return out;
}
function fichaPend(e){
  var ps = compsControle().filter(function(c){ return naComp(e, c) && entrada(c, e.id).pend && !resumo(e, c).fechada; });
  return '<div class="ficha-sec"><h3>Aguardando o cliente</h3>' + (ps.length ? ps.map(function(c){ var en = entrada(c, e.id); return '<p class="note">' + esc(compRot(c)) + ': <b>' + esc(en.pend) + '</b> · pedido em ' + esc(dataBR(en.pendEm) || "—") + ' · parado há ' + diasParado(en) + ' dias' + (en.cobr && en.cobr.length ? ' · ' + en.cobr.length + ' cobrança(s)' : '') + '</p>'; }).join("") : '<p class="note">Nada pendente com o cliente.</p>') + '<p class="note">Registre e cobre as pendências na aba Fechamento.</p></div>';
}
// Obrigações da empresa: competências dos últimos meses, com status clicável e o que não se aplica a ela.
function pintarFichaObrig(){
  var box = $("#fObrig"), e = fichaId && S.empresas[fichaId]; if(!box || !e) return;
  var pode = podeMarcar(e), cs = [], c = compShift(compAtual(), -6);
  for(; c <= compAtual(); c = compShift(c, 1)) cs.push(c);
  var defs = (S.cfg.obrig || []).filter(function(d){ return d.regs.indexOf(e.regime) !== -1 && !(d.ativs.length && e.ativ && d.ativs.indexOf(e.ativ) === -1); });
  if(!e.regime){ box.innerHTML = '<p class="note">Defina o regime da empresa em Dados para ver as obrigações.</p>'; return; }
  var ids = [];
  var linhas = defs.filter(function(d){ return cs.some(function(cc){ return existeNaComp(d, cc); }); }).map(function(d){
    var fora = e.naoAplica.indexOf(d.k) !== -1;
    return '<span class="r" title="' + esc(d.d + " · vence " + rotPrazo(d)) + '">' + esc(d.l) + '</span>' + cs.map(function(cc){
      if(fora || !existeNaComp(d, cc) || !naComp(e, cc)) return '<span class="h">·</span>';
      var v = (entrada(cc, e.id).ob || {})[d.k], s = v && v[0] ? v[0] : "", data = prazoDe(d, cc);
      if(v && v[2]) ids.push(v[2]);
      var tit = d.l + " · " + compRot(cc) + " · vence " + dataBR(ymd(data)) + ": " + (infoMarca(v, OB_ROT) || (data < hoje() ? "vencida e pendente" : "pendente"));
      return '<span style="text-align:center">' + stCell(s, 'data-fob="' + esc(d.k) + '" data-comp="' + cc + '"' + (!s && data < hoje() ? ' style="border-color:var(--dp-late)"' : ''), pode, tit) + '</span>';
    }).join("");
  }).join("");
  buscarNomes(ids);
  box.innerHTML = defs.length ? '<div class="tlq" style="grid-template-columns:minmax(120px,170px) repeat(' + cs.length + ', minmax(30px,1fr)); row-gap:6px"><span></span>' + cs.map(function(cc){ return '<span class="h">' + esc(compCurta(cc)) + '</span>'; }).join("") + linhas + '</div>' +
    '<div class="legenda" style="border:0; padding:10px 0 0">' + ["", "c", "r", "n"].map(function(s){ return '<span><span class="st ' + (s || "p") + '">' + ST_SIM[s] + '</span> ' + OB_ROT[s] + '</span>'; }).join("") + '<span>· coluna = competência; borda vermelha = vencida</span></div>' +
    '<div class="ficha-sec"><h3>Obrigações que se aplicam a esta empresa</h3><div style="display:flex; flex-wrap:wrap; gap:6px 16px">' + defs.map(function(d){ return '<label class="chk"><input type="checkbox" data-aplica="' + esc(d.k) + '"' + (e.naoAplica.indexOf(d.k) === -1 ? " checked" : "") + (pode ? "" : " disabled") + '> ' + esc(d.l) + '</label>'; }).join("") + '</div><p class="note">Desmarque o que a empresa não entrega (ex.: sem movimento de ICMS). Vale para todas as competências.</p></div>'
    : '<p class="note">Nenhuma obrigação do catálogo para este regime e atividade.</p>';
}
$("#dlgFicha").addEventListener("click", function(ev){
  var b = ev.target.closest("button[data-fob]"); if(!b) return;
  var e = S.empresas[fichaId]; if(!e) return;
  var k = b.getAttribute("data-fob"), comp = b.getAttribute("data-comp"), v = (entrada(comp, e.id).ob || {})[k];
  menuStatus(b, v && v[0] ? v[0] : "", ["", "c", "r", "n"], OB_ROT, infoMarca(v, OB_ROT), function(s){ marcarEntrega(comp, e, k, s); });
});
$("#dlgFicha").addEventListener("change", function(ev){
  var t = ev.target; if(!t.hasAttribute || !t.hasAttribute("data-aplica")) return;
  var e = S.empresas[fichaId]; if(!e) return;
  var k = t.getAttribute("data-aplica"), y = clone(e), def = (S.cfg.obrig || []).filter(function(d){ return d.k === k; })[0];
  y.naoAplica = y.naoAplica.filter(function(z){ return z !== k; }); if(!t.checked) y.naoAplica.push(k);
  y.hist = (y.hist || []).concat([{d: ymd(hoje()), t: (def ? def.l : k) + (t.checked ? " voltou a se aplicar" : " deixou de se aplicar"), u: quemSou()}]).slice(-40);
  salvarEmpresas([y]);
});
function salvarFicha(e){
  if(e) e = S.empresas[e.id] || e;
  var f = $("#fForm"), v = function(n){ var el = f.elements[n]; return el ? String(el.value || "").trim() : ""; };
  var nome = v("nome"); if(!nome){ toast("Informe o nome da empresa."); fichaAba = "dados"; $$("[data-pane]").forEach(function(p){ p.hidden = p.getAttribute("data-pane") !== "dados"; }); f.elements.nome.focus(); return; }
  var cnpj = v("cnpj");
  if(cnpj && !cnpjOk(cnpj)){ toast("CNPJ inválido. Confira os números."); return; }
  var dup = listaEmpresas().filter(function(o){ return (!e || o.id !== e.id) && ((cnpj && cnpjDig(o.cnpj) === cnpjDig(cnpj)) || norm(o.nome) === norm(nome)); })[0];
  if(dup){ toast("Já existe “" + dup.nome + "” com esse " + (cnpj && cnpjDig(dup.cnpj) === cnpjDig(cnpj) ? "CNPJ" : "nome") + "."); return; }
  var y = normEmp(Object.assign({}, e || {}, {nome:nome, cnpj:cnpj, regime:v("regime"), ativ:v("ativ"), ie:v("ie"), im:v("im"), municipio:titulo(v("municipio")), uf:v("uf"), analista:v("analista"), desde:v("desde"), sit:v("sit"), ate:v("ate"), obs:v("obs")}), e ? e.id : uid());
  if(y.sit === "inativa" && !y.ate) y.ate = compEmFechamento();
  var muda = [];
  if(!e) muda.push("Empresa cadastrada");
  else [["regime", "Regime", function(k){ return k ? REG[k].c : "—"; }], ["analista", "Analista"], ["sit", "Situação", function(k){ return k === "ativa" ? "ativa" : "inativa"; }], ["ativ", "Atividade", function(k){ return k ? ATIV[k].l : "—"; }], ["cnpj", "CNPJ"], ["nome", "Nome"]].forEach(function(c){
    if(String(e[c[0]] || "") !== String(y[c[0]] || "")){ var r = c[2] || function(z){ return z || "—"; }; muda.push(c[1] + ": " + r(e[c[0]]) + " → " + r(y[c[0]])); }
  });
  if(muda.length) y.hist = (y.hist || []).concat(muda.map(function(t){ return {d: ymd(hoje()), t:t, u: quemSou()}; })).slice(-40);
  fecharPop(); $("#dlgFicha").close(); fichaId = null;
  salvarEmpresas([y]).then(function(){ toast(e ? "Ficha salva." : "“" + y.nome + "” entrou na carteira."); });
}

/* ============ CADASTRO ============ */
var cfgDesenhado = "", cfgRasc = null;
function opcDia(v){ var h = '<option value="ultimo_util"' + (v === "ultimo_util" ? " selected" : "") + '>último dia útil</option>'; for(var i = 1; i <= 31; i++) h += '<option value="' + i + '"' + (+v === i ? " selected" : "") + '>' + i + '</option>'; return h; }
function renderCadastro(){
  var pode = S.coord || S.exemplo;
  $("#impArq").disabled = !pode;
  $("#impLer").disabled = !pode || !$("#impArq").files.length;
  $("#impExemplo").hidden = !S.exemplo; $("#impVazio").hidden = !S.exemplo;
  var chave = JSON.stringify([S.cfg, pode, S.exemplo]);
  if(chave === cfgDesenhado) return;
  cfgDesenhado = chave; cfgRasc = clone(S.cfg);
  pintarCfg();
}
function pintarCfg(){
  var pode = S.coord || S.exemplo, dis = pode ? "" : " disabled", c = cfgRasc;
  var regsCk = function(d, i){ return '<span class="regs">' + REGS.map(function(r){ return '<label><input type="checkbox" data-c="regs" data-i="' + i + '" value="' + r.k + '"' + (d.regs.indexOf(r.k) !== -1 ? " checked" : "") + dis + '>' + esc(r.c) + '</label>'; }).join("") + '</span>'; };
  $("#cfgBox").innerHTML =
    (pode ? '' : '<p class="note">Só a coordenação altera estas configurações.</p>') +
    (S.exemplo ? '<p class="note">No modo exemplo, as mudanças valem só nesta página.</p>' : '') +
    '<div style="display:flex; gap:14px; flex-wrap:wrap">' +
      '<label class="campo" style="width:220px">Início do controle (competência)<input type="month" id="cfgIni" value="' + esc(inicioControle()) + '"' + dis + '></label>' +
      '<label class="campo" style="width:260px">Prazo interno do fechamento<select id="cfgLim"' + dis + '>' + Array.apply(null, Array(28)).map(function(_, k){ return '<option value="' + (k + 1) + '"' + (+c.limite === k + 1 ? " selected" : "") + '>dia ' + (k + 1) + ' do mês seguinte</option>'; }).join("") + '</select></label>' +
    '</div>' +
    '<div class="cat-wrap"><table class="cat"><thead><tr><th>Obrigação</th><th>Regimes</th><th>Periodicidade</th><th>Dia</th><th>Se não for dia útil</th><th>Quando</th><th>Conferido</th><th></th></tr></thead><tbody>' +
    c.obrig.map(function(d, i){
      return '<tr><td style="min-width:170px"><input data-c="l" data-i="' + i + '" value="' + esc(d.l) + '" maxlength="60"' + dis + '><span class="sub" style="display:block; margin-top:3px">' + esc(d.d || "") + (d.ativs.length ? (d.d ? " · " : "") + d.ativs.map(function(a){ return ATIV[a].l.toLowerCase(); }).join(", ") : "") + '</span></td>' +
        '<td>' + regsCk(d, i) + '</td>' +
        '<td><select data-c="per" data-i="' + i + '"' + dis + '>' + Object.keys(PER_ROT).map(function(p){ return '<option value="' + p + '"' + (d.per === p ? " selected" : "") + '>' + PER_ROT[p] + '</option>'; }).join("") + '</select></td>' +
        '<td><select data-c="dia" data-i="' + i + '"' + dis + '>' + opcDia(d.dia) + '</select></td>' +
        '<td>' + (d.dia === "ultimo_util" ? '<span class="sub">—</span>' : '<select data-c="regra" data-i="' + i + '"' + dis + '><option value="prorroga"' + (d.regra === "prorroga" ? " selected" : "") + '>Próximo dia útil</option><option value="antecipa"' + (d.regra === "antecipa" ? " selected" : "") + '>Dia útil anterior</option><option value="exato"' + (d.regra === "exato" ? " selected" : "") + '>Mantém a data</option><option value="util"' + (d.regra === "util" ? " selected" : "") + '>Conta dias úteis (Nº dia útil)</option></select>') + '</td>' +
        '<td>' + (d.per === "anual" ? '<select data-c="mes" data-i="' + i + '"' + dis + '>' + MESES.map(function(m, k){ return '<option value="' + (k + 1) + '"' + (+d.mes === k + 1 ? " selected" : "") + '>' + m + ' do ano seguinte</option>'; }).join("") + '</select>' : '<select data-c="desloc" data-i="' + i + '"' + dis + '><option value="1"' + (d.desloc === 1 ? " selected" : "") + '>mês seguinte</option><option value="2"' + (d.desloc === 2 ? " selected" : "") + '>2 meses depois</option><option value="3"' + (d.desloc === 3 ? " selected" : "") + '>3 meses depois</option></select>') + '</td>' +
        '<td style="white-space:nowrap"><label class="chk"><input type="checkbox" data-c="ok" data-i="' + i + '"' + (d.ok ? " checked" : "") + dis + '>' + (d.ok ? "sim" : '<span class="conf">conferir</span>') + '</label></td>' +
        '<td>' + (pode ? '<button type="button" class="x" data-rem="' + i + '" title="Remover do catálogo" aria-label="Remover ' + esc(d.l) + '">✕</button>' : '') + '</td></tr>';
    }).join("") + '</tbody></table></div>' +
    '<p class="note">Exemplo do cálculo: ' + esc(c.obrig.slice(0, 3).map(function(d){ var cc = d.per === "anual" ? compShift(compAtual(), -(+compAtual().slice(5, 7))) : d.per === "trimestral" ? compShift(compAtual(), -((+compAtual().slice(5, 7)) % 3)) : compEmFechamento(); return d.l + " de " + compCurta(cc) + " vence em " + dataBR(ymd(prazoDe(d, cc))); }).join(" · ")) + '. Feriados nacionais, carnaval, sexta-feira santa e Corpus Christi já contam; feriados locais, não.</p>' +
    (pode ? '<div style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" class="fbtn" id="cfgNova">+ Obrigação</button><span style="flex:1"></span><button type="button" class="fbtn" id="cfgPadrao">Voltar ao padrão</button><button type="button" class="btn" id="cfgSalvar">Salvar</button></div>' : '');
}
$("#cfgBox").addEventListener("change", function(e){
  var t = e.target, i = t.getAttribute("data-i"), c = t.getAttribute("data-c");
  if(i == null || !c || !cfgRasc) return;
  var d = cfgRasc.obrig[+i];
  if(c === "regs"){ d.regs = $$('[data-c="regs"][data-i="' + i + '"]').filter(function(x){ return x.checked; }).map(function(x){ return x.value; }); return; }
  if(c === "ok"){ d.ok = t.checked; pintarCfg(); return; }
  if(c === "dia"){ d.dia = t.value === "ultimo_util" ? "ultimo_util" : +t.value; if(d.dia === "ultimo_util") d.regra = ""; else if(!d.regra) d.regra = "prorroga"; pintarCfg(); return; }
  if(c === "desloc" || c === "mes"){ d[c] = +t.value; return; }
  if(c === "per"){ d.per = t.value; pintarCfg(); return; }
  d[c] = t.value;
});
$("#cfgBox").addEventListener("input", function(e){ var t = e.target; if(t.getAttribute("data-c") === "l" && cfgRasc) cfgRasc.obrig[+t.getAttribute("data-i")].l = t.value; });
$("#cfgBox").addEventListener("click", function(e){
  var t = e.target;
  var rem = t.closest("[data-rem]"); if(rem){ var i = +rem.getAttribute("data-rem"), d = cfgRasc.obrig[i]; confirmar("Tirar “" + d.l + "” do catálogo? As entregas já marcadas ficam guardadas.", "Tirar").then(function(ok){ if(ok){ cfgRasc.obrig.splice(i, 1); pintarCfg(); } }); return; }
  if(t.id === "cfgNova"){ cfgRasc.obrig.push(normDef({l:"Nova obrigação", regs:["simples", "presumido", "real"], dia:20, regra:"prorroga"})); pintarCfg(); var ins = $$('#cfgBox [data-c="l"]'); if(ins.length){ ins[ins.length - 1].focus(); ins[ins.length - 1].select(); } return; }
  if(t.id === "cfgPadrao"){ confirmar("Voltar o catálogo de obrigações e os prazos ao padrão?", "Voltar ao padrão").then(function(ok){ if(ok){ var c = normCfg(null); c.inicio = S.cfg.inicio; cfgDesenhado = ""; salvarCfg(c).then(function(){ toast("Catálogo no padrão."); }); } }); return; }
  if(t.id !== "cfgSalvar") return;
  var c2 = normCfg(cfgRasc);
  var ini = $("#cfgIni").value;
  if(ini && !/^\d{4}-\d{2}$/.test(ini)){ toast("Escolha o mês de início."); return; }
  if(ini > compAtual()){ toast("O início do controle não pode ser depois do mês atual."); return; }
  if(c2.obrig.some(function(d){ return !d.regs.length; })){ toast("Cada obrigação precisa de pelo menos um regime."); return; }
  c2.inicio = ini; c2.limite = +$("#cfgLim").value;
  cfgDesenhado = "";
  salvarCfg(c2).then(function(){ toast("Configurações salvas."); });
});

/* ---------- importação da carteira ---------- */
var planoImp = null;
var COLS_IMP = {nome:/^(empresa|razao social|nome|cliente)/, cnpj:/^cnpj/, regime:/^(regime|tributacao|enquadramento)/, ativ:/^(atividade|ramo|tipo)/, analista:/^(analista|responsavel)/, ie:/^(ie|inscricao estadual|insc\.? estadual)/, im:/^(im|inscricao municipal|insc\.? municipal|ccm)/, municipio:/^(municipio|cidade)/, uf:/^(uf|estado)$/};
function lerLinhas(rows){
  var hi = -1, map = {};
  for(var r = 0; r < Math.min(rows.length, 15) && hi < 0; r++){
    var m = {};
    rows[r].forEach(function(cel, ci){ var n = norm(cel); Object.keys(COLS_IMP).forEach(function(k){ if(!(k in m) && n && COLS_IMP[k].test(n)) m[k] = ci; }); });
    if("nome" in m && ("cnpj" in m || "regime" in m)){ hi = r; map = m; }
  }
  if(hi < 0) return null;
  var out = [];
  rows.slice(hi + 1).forEach(function(row){
    var g = function(k){ return k in map ? String(row[map[k]] == null ? "" : row[map[k]]).trim() : ""; };
    var nome = g("nome"); if(!nome) return;
    out.push({nome:nome, cnpj:g("cnpj"), regime:regDeTexto(g("regime")), regTxt:g("regime"), ativ:ativDeTexto(g("ativ")), analista:titulo(g("analista")), ie:g("ie"), im:g("im"), municipio:titulo(g("municipio")), uf:g("uf").slice(0, 2).toUpperCase()});
  });
  return out;
}
$("#impArq").onchange = function(){ $("#impLer").disabled = !this.files.length || !(S.coord || S.exemplo); $("#impRes").hidden = true; planoImp = null; };
$("#impLer").onclick = function(){
  var f = $("#impArq").files[0], box = $("#impRes"); if(!f) return;
  if(typeof XLSX === "undefined"){ toast("O leitor de planilhas não carregou. Confira a internet e recarregue."); return; }
  f.arrayBuffer().then(function(buf){
    var wb = XLSX.read(new Uint8Array(buf), {type:"array"});
    var linhas = null;
    wb.SheetNames.some(function(n){ linhas = lerLinhas(XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:false, defval:""})); return linhas && linhas.length; });
    box.hidden = false;
    if(!linhas || !linhas.length){ box.innerHTML = '<p class="note" style="color:var(--dp-late)">Não encontrei a linha de títulos. A planilha precisa ter as colunas Empresa e CNPJ (ou Regime).</p>'; planoImp = null; return; }
    var reais = S.R.emp, porCnpj = {}, porNome = {};
    Object.keys(reais).forEach(function(k){ var e = reais[k]; if(e.excluida) return; if(cnpjDig(e.cnpj)) porCnpj[cnpjDig(e.cnpj)] = e; porNome[norm(e.nome)] = e; });
    var novas = [], atual = [], avisos = [], vistos = {};
    linhas.forEach(function(x, i){
      var dg = cnpjDig(x.cnpj), chave = dg || norm(x.nome);
      if(vistos[chave]){ avisos.push("Linha " + (i + 2) + ": “" + x.nome + "” repetida na planilha"); return; }
      vistos[chave] = true;
      if(x.cnpj && !cnpjOk(x.cnpj)) avisos.push("“" + x.nome + "”: CNPJ " + x.cnpj + " inválido (importado assim mesmo)");
      if(!x.regime) avisos.push("“" + x.nome + "”: regime " + (x.regTxt ? "“" + x.regTxt + "” não reconhecido" : "vazio"));
      var ja = (dg && porCnpj[dg]) || porNome[norm(x.nome)];
      if(ja) atual.push({e:ja, x:x}); else novas.push(x);
    });
    planoImp = {novas:novas, atual:atual};
    box.innerHTML = '<div><b>' + linhas.length + ' empresas lidas</b>: ' + novas.length + ' nova' + (novas.length === 1 ? '' : 's') + ' e ' + atual.length + ' já cadastrada' + (atual.length === 1 ? '' : 's') + ' (serão atualizadas).</div>' +
      (avisos.length ? '<details><summary>' + avisos.length + ' aviso' + (avisos.length === 1 ? '' : 's') + '</summary><ul>' + avisos.slice(0, 300).map(function(a){ return '<li>' + esc(a) + '</li>'; }).join("") + '</ul></details>' : '') +
      '<div style="display:flex; gap:8px"><button type="button" class="btn" id="impOk">Importar ' + linhas.length + ' empresas</button><button type="button" class="fbtn" id="impCancelar">Cancelar</button></div>';
  }).catch(function(err){ console.error(err); box.hidden = false; box.innerHTML = '<p class="note" style="color:var(--dp-late)">Não consegui ler o arquivo. Confira se é uma planilha .xlsx ou .xls.</p>'; });
};
function comecarReal(){ S.forcarReal = true; aplicarFonte(); S.fx.comp = ""; S.ag.dia = ""; cfgDesenhado = ""; }
$("#impRes").addEventListener("click", function(e){
  if(e.target.id === "impCancelar"){ $("#impRes").hidden = true; planoImp = null; return; }
  if(e.target.id !== "impOk" || !planoImp) return;
  var p = planoImp, eraExemplo = S.exemplo;
  if(eraExemplo) comecarReal();
  var lista = p.novas.map(function(x){ return normEmp(Object.assign({}, x, {hist:[{d: ymd(hoje()), t:"Empresa importada da planilha", u: quemSou()}]}), uid()); });
  p.atual.forEach(function(a){
    var y = clone(a.e), mud = [];
    ["cnpj", "regime", "ativ", "analista", "ie", "im", "municipio", "uf"].forEach(function(k){ if(a.x[k] && String(y[k]) !== String(k === "cnpj" ? cnpjFmt(a.x[k]) : a.x[k])){ mud.push(k); y[k] = a.x[k]; } });
    if(mud.length){ y.hist = (y.hist || []).concat([{d: ymd(hoje()), t:"Atualizada pela planilha (" + mud.join(", ") + ")", u: quemSou()}]).slice(-40); lista.push(normEmp(y, y.id)); }
  });
  planoImp = null; $("#impRes").hidden = true; $("#impArq").value = ""; $("#impLer").disabled = true;
  if(!lista.length){ toast("Nada a mudar: a carteira já está igual à planilha."); return; }
  salvarEmpresas(lista).then(function(){ toast(lista.length + " empresa" + (lista.length === 1 ? "" : "s") + " gravada" + (lista.length === 1 ? "" : "s") + (eraExemplo ? ". Os dados de exemplo saíram." : ".")); irPara("empresas"); });
});
$("#impComecar").onclick = function(){
  confirmar("Sair dos dados de exemplo e começar a carteira vazia? Cadastre as empresas em Empresas → + Empresa.", "Começar vazia").then(function(ok){ if(ok){ comecarReal(); renderTudo(true); toast("Carteira real: cadastre a primeira empresa."); } });
};
function baixarXlsx(wb, nome){
  var bytes = new Uint8Array(XLSX.write(wb, {bookType:"xlsx", type:"array"}));
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$("#impModelo").onclick = function(){
  if(typeof XLSX === "undefined"){ toast("O gerador de planilhas não carregou."); return; }
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Empresa", "CNPJ", "Regime", "Atividade", "Analista", "IE", "IM", "Município", "UF"], ["Nome da empresa Ltda", "00.000.000/0001-91", "Simples", "Comércio", "Nome do analista", "", "", "São Paulo", "SP"]]), "Carteira");
  baixarXlsx(wb, "modelo-carteira-fiscal.xlsx");
};
$("#bkBaixar").onclick = function(){
  if(typeof XLSX === "undefined"){ toast("O gerador de planilhas não carregou."); return; }
  var es = listaEmpresas().sort(ordNome), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Empresa", "CNPJ", "Regime", "Atividade", "Analista", "IE", "IM", "Município", "UF", "Situação", "Cliente desde", "Até", "Observações"]].concat(es.map(function(e){ return [e.nome, e.cnpj, e.regime ? REG[e.regime].c : "", e.ativ ? ATIV[e.ativ].l : "", e.analista, e.ie, e.im, e.municipio, e.uf, e.sit, e.desde, e.ate, e.obs]; }))), "Carteira");
  var fech = [["Competência", "Empresa", "CNPJ", "Analista"].concat(ETAPAS.map(function(et){ return et.l; })).concat(["Pendência do cliente"])];
  Object.keys(S.comps).sort().forEach(function(c){ es.forEach(function(e){ var ent = S.comps[c][e.id]; if(!ent || !ent.e) return; fech.push([c, e.nome, e.cnpj, e.analista].concat(ETAPAS.map(function(et){ var v = ent.e[et.k]; return v ? ST_ROT[v[0]] + (v[1] ? " " + dataBR(v[1]) : "") : ""; })).concat([ent.pend || ""])); }); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fech), "Fechamento");
  var obr = [["Competência", "Obrigação", "Vencimento", "Empresa", "CNPJ", "Analista", "Status", "Data"]];
  ocorrencias().forEach(function(o){ o.emps.forEach(function(e){ var v = (entrada(o.comp, e.id).ob || {})[o.def.k]; obr.push([o.comp, o.def.l, dataBR(o.ds), e.nome, e.cnpj, e.analista, OB_ROT[v && v[0] ? v[0] : ""], v && v[1] ? dataBR(v[1]) : ""]); }); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(obr), "Obrigações");
  baixarXlsx(wb, "fiscal-backup-" + ymd(hoje()) + ".xlsx");
};

/* ============ início ============ */
(function tema(){
  var raiz = document.documentElement;
  var pintar = function(){ var t = raiz.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); $("#temaBtn").textContent = t === "dark" ? "☀" : "☾"; };
  var trocar = function(){
    try{ var bt = window.parent !== window && window.parent.document.querySelector("[data-theme-toggle]"); if(bt){ bt.click(); pintar(); return; } }catch(e){}
    var atual = raiz.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var novo = atual === "dark" ? "light" : "dark";
    raiz.setAttribute("data-theme", novo);
    try{ localStorage.setItem("controlhub-theme", novo); }catch(e){}
    try{ var P = window.parent; if(P !== window && P.document) P.document.documentElement.setAttribute("data-theme", novo); }catch(e){}
    pintar();
  };
  $("#temaBtn").onclick = trocar;
  document.addEventListener("keydown", function(e){
    if((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")){ trocar(); }
  });
  pintar();
})();
(function(){ var solto = true; try{ solto = window.parent === window || !window.parent.__hubFecharModulo; }catch(e){} document.body.classList.toggle("solto", solto); })();
$("#hubBack").onclick = function(e){
  try{
    var P = window.parent;
    if(P !== window && (P.__hubFecharModulo || P.__hubClosePortal)){ e.preventDefault(); (P.__hubFecharModulo || P.__hubClosePortal)(); }
  }catch(x){}
};
window.addEventListener("unhandledrejection", function(e){ if(e.reason && e.reason.fis) e.preventDefault(); });

function ligarBanco(){
  banco.collection("fis_emp").onSnapshot(function(snap){
    var m = {};
    snap.docs.forEach(function(d){ S.existe.docs["fis_emp/" + d.id] = true; var x = d.data() || {}; Object.keys(x).forEach(function(k){ if(x[k] && typeof x[k] === "object") m[k] = normEmp(x[k], k); }); });
    S.R.emp = m; S.carregou.fis_emp = true; S.carregou.empresas = S.carregou.fis_comp;
    aplicarFonte();
    if(!S.eu && S.nomeConta && !S.exemplo){ S.eu = casarNome(S.nomeConta); if(S.eu){ S.fx.ana = S.ag.ana = S.em.ana = S.eu; } }
    renderTudo();
  }, erroBanco);
  banco.collection("fis_comp").onSnapshot(function(snap){
    var m = {};
    snap.docs.forEach(function(d){ S.existe.docs["fis_comp/" + d.id] = true; var c = d.id.split("~")[0], x = d.data() || {}; var alvo = (m[c] = m[c] || {}); Object.keys(x).forEach(function(k){ alvo[k] = x[k]; }); });
    S.R.comp = m; S.carregou.fis_comp = true; S.carregou.empresas = S.carregou.fis_emp;
    aplicarFonte(); renderTudo();
  }, erroBanco);
  banco.doc("fis_config/cfg").onSnapshot(function(s){
    S.R.cfg = normCfg(s.exists ? (s.data() || {}) : null); S.carregou.fis_config = true;
    aplicarFonte(); renderTudo();
  }, erroBanco);
}
function erroBanco(err){ console.error(err); toast("Falha ao ler os dados do Hub. Recarregue a página."); }

/* ============ ponte com o assistente do Hub ============ */
// Respostas simples para o assistente: linhas {t, sub, data, tom, abrir:{aba, opts | empresa}}.
window.__assistente = {
  modulo: "fiscal", nome: "Fiscal",
  abas: [["painel", "Painel"], ["agenda", "Agenda"], ["empresas", "Empresas"], ["fechamento", "Fechamento"], ["cadastro", "Cadastro"]],
  pronto: function(){ return !!S.carregou.empresas; },
  exemplo: function(){ return !!S.exemplo; },
  empresas: function(){ return listaEmpresas().map(function(e){ return {id:e.id, nome:e.nome, cnpj:cnpjDig(e.cnpj), analista:e.analista}; }); },
  analistas: function(){ return analistas(); },
  irPara: function(v, o){ if(VIEWS.indexOf(v) === -1) return false; irPara(v, o); return true; },
  abrirEmpresa: function(id, aba){ if(!S.empresas[id]) return false; irPara("empresas"); abrirFicha(id, aba || ""); return true; },
  consultar: function(tipo, p){
    p = p || {};
    var de = parseYmd(p.de) || hoje(), ate = parseYmd(p.ate) || de, ana = p.analista || "", h = hoje();
    var dele = function(e){ return !ana || norm(e.analista) === norm(ana); };
    var emps = listaEmpresas().filter(dele);
    if(tipo === "vencimentos"){
      var f = {ana: ana};
      var ls = ocorrencias().map(function(o){ return recortar(o, f); }).filter(function(o){ return o && o.data >= de && o.data <= ate; });
      return {titulo: "Entregas de " + dataBR(ymd(de)) + (ymd(ate) !== ymd(de) ? " a " + dataBR(ymd(ate)) : ""), total: ls.length, linhas: ls.map(function(o){
        return {t: o.def.l + " de " + compCurta(o.comp), sub: dataBR(o.ds).slice(0, 5) + " · " + (o.pend.length ? o.pend.length + " de " + o.emps.length + " empresas pendentes" : "tudo entregue (" + o.emps.length + ")"), data: o.ds, tom: o.pend.length ? (o.data < h ? "late" : "") : "ok", abrir: {aba: "agenda", opts: {"ag.mes": o.ds.slice(0, 7), "ag.dia": o.ds, "ag.ana": ana, "ag.ob": o.def.k}}};
      })};
    }
    if(tipo === "atrasos"){
      var at = emps.filter(function(e){ return situ(e).atraso; }).sort(function(a, b){ return situ(a).saude - situ(b).saude; });
      return {titulo: "Empresas com atraso no Fiscal", total: at.length, linhas: at.map(function(e){ return {t: e.nome, sub: linhaSit(e).slice(0, 2).map(function(l){ return l[1]; }).join(" · "), tom: "late", abrir: {empresa: e.id, aba: "obrig"}}; }), verTudo: {aba: "empresas", opts: {"em.ana": ana, "em.faixa": "atras", "em.busca": ""}}};
    }
    if(tipo === "pendencias"){
      var cl = emps.filter(function(e){ return !!situ(e).cli; }).map(function(e){ var s = situ(e), en = entrada(s.cliComp, e.id); return {e: e, s: s, dias: diasParado(en), cobr: (en.cobr || []).length}; }).sort(function(x, y){ return y.dias - x.dias || y.cobr - x.cobr; });
      return {titulo: "Aguardando o cliente (Fiscal)", total: cl.length, linhas: cl.map(function(x){ return {t: x.e.nome, sub: x.s.cli + " · " + compCurta(x.s.cliComp) + " · parado há " + x.dias + " dia(s)" + (x.cobr ? " · cobrado " + x.cobr + "x" : ""), tom: "warn", abrir: {empresa: x.e.id, aba: "obs"}, dados: {analista: x.e.analista || "", dias: x.dias, cobrancas: x.cobr}}; }), verTudo: {aba: "fechamento", opts: {"fx.st": "cli", "fx.ana": ana}}};
    }
    if(tipo === "empresa"){
      var e = S.empresas[p.id]; if(!e) return null;
      var s = situ(e), cef = compEmFechamento(), r = s.fech, ls2 = [];
      ls2.push({t: (e.regime ? REG[e.regime].l : "Sem regime") + (e.ativ ? " · " + ATIV[e.ativ].l : ""), sub: [e.analista || "sem analista", e.municipio ? e.municipio + (e.uf ? "/" + e.uf : "") : ""].filter(Boolean).join(" · ")});
      ls2.push({t: "Saúde fiscal: " + s.saude + "%", sub: "fechamentos e entregas em dia nos últimos 90 dias", tom: s.saude >= 90 ? "ok" : s.saude >= 70 ? "warn" : "late"});
      if(r) ls2.push({t: compRot(cef) + (r.fechada ? ": fechada" : ": " + r.feitas + " de " + r.total + " etapas"), sub: r.cli ? "Aguardando o cliente: " + r.pend : r.atras ? "fora do prazo" : "", tom: r.fechada ? "ok" : r.atras ? "late" : "", abrir: {aba: "fechamento", opts: {"fx.comp": cef, "fx.busca": e.nome, "fx.ana": "", "fx.st": ""}}});
      s.obVenc.slice(0, 5).forEach(function(o){ ls2.push({t: o.def.l + " de " + compCurta(o.comp) + " vencida", sub: "venceu em " + dataBR(o.ds), tom: "late", abrir: {empresa: e.id, aba: "obrig"}}); });
      s.obProx.slice(0, 3).forEach(function(o){ ls2.push({t: o.def.l + " de " + compCurta(o.comp), sub: "vence em " + dataBR(o.ds), tom: "warn", abrir: {empresa: e.id, aba: "obrig"}}); });
      return {titulo: e.nome, total: ls2.length, linhas: ls2, abrirFicha: {empresa: e.id, aba: "dados"}};
    }
    if(tipo === "carteira"){
      var por = {};
      listaEmpresas().forEach(function(x){ var a = x.analista || "(sem analista)"; var q = por[a] = por[a] || {n: 0, atr: 0, cli: 0}; var s3 = situ(x); q.n++; if(s3.atraso) q.atr++; if(s3.cli) q.cli++; });
      var ks = Object.keys(por).filter(function(a){ return !ana || norm(a) === norm(ana); }).sort(function(a, b){ return por[b].n - por[a].n; });
      return {titulo: "Carteira do Fiscal", total: ks.length, linhas: ks.map(function(a){ var q = por[a]; return {t: a + ": " + q.n + " empresa" + (q.n === 1 ? "" : "s"), sub: q.atr + " com atraso · " + q.cli + " aguardando cliente", dados: {analista: a, empresas: q.n, atrasadas: q.atr, aguardandoCliente: q.cli}, tom: q.atr ? "warn" : "ok", abrir: {aba: "empresas", opts: {"em.ana": a === "(sem analista)" ? "" : a, "em.faixa": "", "em.busca": ""}}}; })};
    }
    if(tipo === "competencia"){
      var comp = /^\d{4}-\d{2}$/.test(p.comp || "") ? p.comp : compEmFechamento(), lsC = [], porA = {};
      listaEmpresas().filter(function(x){ return naComp(x, comp); }).forEach(function(x){
        var r2 = resumo(x, comp), a2 = x.analista || "(sem analista)", q2 = porA[a2] = porA[a2] || {analista: a2, empresas: 0, fechadas: 0, atrasadas: 0, aguardandoCliente: 0};
        q2.empresas++; if(r2.fechada) q2.fechadas++; else { if(r2.atras) q2.atrasadas++; if(r2.cli) q2.aguardandoCliente++; }
        if(!r2.fechada && dele(x)) lsC.push({t: x.nome, sub: "falta: " + r2.falta.map(function(f){ return f.l; }).join(", ") + (r2.cli ? " · aguardando cliente: " + r2.pend : "") + (r2.atras ? " · fora do prazo" : ""), tom: r2.atras ? "late" : r2.cli ? "warn" : "", abrir: {aba: "fechamento", opts: {"fx.comp": comp, "fx.busca": x.nome, "fx.ana": "", "fx.st": ""}}, dados: {analista: x.analista || ""}});
      });
      return {titulo: "Fechamento do Fiscal em " + compRot(comp) + ": " + lsC.length + " em aberto", total: lsC.length, linhas: lsC, resumo: Object.keys(porA).map(function(k){ return porA[k]; }), verTudo: {aba: "fechamento", opts: {"fx.comp": comp, "fx.st": "abertas", "fx.ana": ana}}};
    }
    if(tipo === "historico"){
      var eH = S.empresas[p.id]; if(!eH) return null;
      var hs = (eH.hist || []).slice(-20).reverse();
      return {titulo: "Histórico de " + eH.nome + " (Fiscal)", total: hs.length, linhas: hs.map(function(h){ return {t: h.t, sub: dataBR(h.d), data: h.d, abrir: {empresa: eH.id, aba: "dados"}}; })};
    }
    if(tipo === "prazosConferir"){
      var nc = (S.cfg.obrig || []).filter(function(d){ return !d.ok; });
      return {titulo: "Prazos marcados “conferir” no Fiscal", total: nc.length, linhas: nc.map(function(d){ return {t: d.l, sub: "dia " + d.dia + (d.regra ? " · " + d.regra : "") + " · confira com a legislação", tom: "warn", abrir: {aba: "cadastro"}}; })};
    }
    if(tipo === "feriados"){
      var lsF = [];
      for(var yy = de.getFullYear(); yy <= ate.getFullYear(); yy++) Object.keys(feriados(yy)).forEach(function(k){ var d = parseYmd(k); if(d >= de && d <= ate) lsF.push({t: dataBR(k) + " (" + ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][d.getDay()] + ")", sub: "feriado considerado nos prazos (nacionais e de Vitória/ES)", data: k}); });
      lsF.sort(function(x, y){ return x.data < y.data ? -1 : 1; });
      return {titulo: "Feriados no período", total: lsF.length, linhas: lsF};
    }
    return null;
  },
  listar: function(){ return listaEmpresas().map(function(e){ var s = situ(e); return {id:e.id, nome:e.nome, cnpj:cnpjDig(e.cnpj), analista:e.analista || "", regime: e.regime && REG[e.regime] ? REG[e.regime].l : "", atividade: e.ativ && ATIV[e.ativ] ? ATIV[e.ativ].l : "", municipio: e.municipio || "", uf: e.uf || "", ie: e.ie || "", im: e.im || "", situacao: e.sit || "ativa", atraso: !!s.atraso, aguardandoCliente: !!s.cli, saude: s.saude}; }); },
  coord: function(){ return !!S.coord; },
  vocab: function(){ return {etapas: ETAPAS.map(function(x){ return {k:x.k, l:x.l, c:x.c}; }), obrigacoes: (S.cfg.obrig || []).map(function(d){ return {k:d.k, l:d.l}; })}; },
  // Prepara uma ação (nada grava até executar()). Devolve {erro} ou {titulo, linhas, aviso, executar, desfazer}.
  acao: function(tipo, p){
    p = p || {};
    var e = S.empresas[p.id];
    if(!e) return {erro: "Não achei essa empresa no Fiscal."};
    if(!podeMarcar(e)) return {erro: "Você não pode alterar “" + e.nome + "”: ela é da carteira de " + (e.analista || "outra pessoa") + "."};
    var aviso = S.exemplo ? "Dados de exemplo: a alteração fica só na memória e não grava no banco." : "";
    var comp = p.comp || "", cef = compEmFechamento();
    if(!comp){ comp = cef; compsControle().some(function(c){ if(c <= cef && naComp(e, c) && !resumo(e, c).fechada){ comp = c; return true; } return false; }); }
    var quando = "Competência " + compRot(comp) + (p.comp ? "" : " (a mais antiga em aberto)");
    var guarda = function(fn){ return function(){ return Promise.resolve().then(fn); }; };
    if(tipo === "etapa" || tipo === "fechar"){
      var antes = clone(entrada(comp, e.id)), m = {}, ls = [];
      if(tipo === "fechar"){
        ETAPAS.forEach(function(et){ var a = stEtapa(antes, et.k); if(a !== "n" && a !== "c"){ m[et.k] = "c"; ls.push(et.l + ": " + ST_ROT[a] + " → " + ST_ROT.c); } });
        if(!ls.length) return {erro: "“" + e.nome + "” já está fechada em " + compRot(comp) + "."};
      } else {
        var et = ETAPAS.filter(function(x){ return x.k === p.etapa; })[0], st = p.status || "";
        if(!et) return {erro: "Não conheci essa etapa."};
        var at = stEtapa(antes, et.k);
        if(at === st) return {erro: et.l + " já está “" + ST_ROT[st].toLowerCase() + "” para essa empresa em " + compRot(comp) + "."};
        m[et.k] = st; ls.push(et.l + ": " + ST_ROT[at] + " → " + ST_ROT[st]);
      }
      return {titulo: tipo === "fechar" ? "Concluir o fechamento" : "Marcar etapa do fechamento", empresa: e.nome, linhas: ls.concat([quando]), aviso: aviso,
        executar: guarda(function(){ var res = marcarEtapas(comp, e, m); return salvarCompEntrada(comp, e.id, res.ent).then(function(){ return res.fechou ? "Pronto: “" + e.nome + "” fechou " + compRot(comp) + "." : "Pronto, marcado."; }); }),
        desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, antes); })};
    }
    if(tipo === "pendencia"){
      var ent0 = clone(entrada(comp, e.id)), modo = p.modo || "registrar", ent = clone(ent0), hj = ymd(hoje());
      if(modo === "registrar"){
        var txt = String(p.texto || "").trim().slice(0, 200);
        if(!txt) return {erro: "Diga o que falta o cliente mandar (ex.: “registra pendência na Alfa: XML das notas”)."};
        ent.pendEm = ent0.pend ? (ent0.pendEm || hj) : hj; ent.cobr = ent0.pend ? (ent0.cobr || []) : []; ent.pend = txt;
        var ls2 = ["Aguardando o cliente: “" + txt + "”"]; if(ent0.pend) ls2.push("Substitui: “" + ent0.pend + "”"); ls2.push(quando);
        return {titulo: "Registrar pendência do cliente", empresa: e.nome, linhas: ls2, aviso: aviso,
          executar: guarda(function(){ return salvarCompEntrada(comp, e.id, ent).then(function(){ return "Pendência registrada."; }); }), desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, ent0); })};
      }
      if(!ent0.pend) return {erro: "“" + e.nome + "” não tem pendência do cliente aberta em " + compRot(comp) + "."};
      if(modo === "recebida"){ ent.pend = ""; ent.pendEm = ""; ent.cobr = []; }
      else { ent.cobr = (ent0.cobr || []).concat([hj]).slice(-20); }
      return {titulo: modo === "recebida" ? "Dar a pendência por recebida" : "Registrar cobrança de hoje", empresa: e.nome, linhas: ["Pendência: “" + ent0.pend + "”", quando], aviso: aviso,
        executar: guarda(function(){ return salvarCompEntrada(comp, e.id, ent).then(function(){ return modo === "recebida" ? "Pendência encerrada." : "Cobrança registrada."; }); }), desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, ent0); })};
    }
    if(tipo === "entrega"){
      var def = (S.cfg.obrig || []).filter(function(d){ return d.k === p.ob; })[0];
      if(!def) return {erro: "Não conheci essa obrigação."};
      var s2 = p.status === undefined ? "c" : p.status;
      var ocs = ocDe(e).filter(function(o){ return o.def.k === def.k && (!p.comp || o.comp === p.comp); });
      var alvo = s2 ? ocs.filter(function(o){ return !feitoOb(stOb(o.comp, e, def.k)); })[0] : ocs.filter(function(o){ return feitoOb(stOb(o.comp, e, def.k)); }).pop();
      if(!alvo) return {erro: s2 ? def.l + " de “" + e.nome + "” não tem entrega pendente" + (p.comp ? " em " + compRot(p.comp) : "") + "." : "Não achei entrega de " + def.l + " marcada para desfazer."};
      var a0 = stOb(alvo.comp, e, def.k);
      return {titulo: s2 ? "Marcar entrega" : "Desmarcar entrega", empresa: e.nome, linhas: [def.l + " de " + compRot(alvo.comp) + ": " + OB_ROT[a0] + " → " + OB_ROT[s2], "Vencimento " + dataBR(alvo.ds)], aviso: aviso,
        executar: guarda(function(){ return marcarEntrega(alvo.comp, e, def.k, s2).then(function(){ return "Pronto: " + def.l + " de " + compCurta(alvo.comp) + " " + (s2 ? OB_ROT[s2].toLowerCase() : "desmarcada") + "."; }); }),
        desfazer: guarda(function(){ return marcarEntrega(alvo.comp, e, def.k, a0); })};
    }
    if(tipo === "transferir"){
      if(!S.coord) return {erro: "Só a coordenação transfere empresas entre analistas."};
      var nomes = analistas(), para = String(p.para || "").trim();
      var alvoA = nomes.filter(function(n){ return norm(n) === norm(para); })[0] || nomes.filter(function(n){ return norm(n).split(" ")[0] === norm(para).split(" ")[0]; })[0];
      if(!alvoA) return {erro: "Não conheço o analista “" + para + "” no Fiscal."};
      if(norm(alvoA) === norm(e.analista)) return {erro: "“" + e.nome + "” já é de " + alvoA + "."};
      var eT = clone(e), yT = normEmp(Object.assign({}, e, {analista: alvoA, hist: (e.hist || []).concat([{d: ymd(hoje()), t: "Analista: " + (e.analista || "—") + " → " + alvoA, u: quemSou()}]).slice(-40)}), e.id);
      return {titulo: "Transferir empresa", empresa: e.nome, linhas: ["Analista no Fiscal: " + (e.analista || "—") + " → " + alvoA], aviso: aviso,
        executar: guarda(function(){ return salvarEmpresas([yT]).then(function(){ return "Pronto: agora é de " + alvoA + "."; }); }), desfazer: guarda(function(){ return salvarEmpresas([eT]); })};
    }
    if(tipo === "observacao"){
      var txO = String(p.texto || "").trim().slice(0, 300);
      if(!txO) return {erro: "Qual observação devo anotar?"};
      var eO = clone(e), yO = normEmp(Object.assign({}, e, {obs: ((e.obs ? e.obs + "\n" : "") + dataBR(ymd(hoje())).slice(0, 5) + ": " + txO).slice(-1500)}), e.id);
      return {titulo: "Anotar observação na ficha", empresa: e.nome, linhas: ["“" + txO + "”", "Fica na aba Observações da ficha do Fiscal"], aviso: aviso,
        executar: guarda(function(){ return salvarEmpresas([yO]).then(function(){ return "Observação anotada."; }); }), desfazer: guarda(function(){ return salvarEmpresas([eO]); })};
    }
    return {erro: "Ainda não sei fazer isso no Fiscal."};
  }
};

(function iniciar(){
  var p = lerPrefs();
  if(p.eu) S.eu = p.eu;
  if(p.emModo === "lista" || p.emModo === "cartoes") S.em.modo = p.emModo;
  S.fx.ana = S.ag.ana = S.em.ana = S.eu || "";
  usarCap("db").catch(function(){ return null; }).then(function(db){
    if(db){ banco = bancoReal(db); }
    else { banco = bancoLocal(); semBanco = true; $("#semBanco").hidden = false; S.coord = true; }
    ligarBanco();
    return usarCap("user").catch(function(){ return null; });
  }).then(function(u){
    if(!u){ if(!semBanco) S.coord = false; renderTudo(); return; }
    S.userNs = u;
    Promise.resolve(u.id ? u.id() : "").catch(function(){ return ""; }).then(function(i){ S.meId = i || ""; });
    Promise.resolve(u.canEdit ? u.canEdit() : false).catch(function(){ return false; }).then(function(ok){ S.coord = !!ok || semBanco; renderTudo(); });
    Promise.resolve(u.name ? u.name() : "").catch(function(){ return ""; }).then(function(n){
      S.nomeConta = n || "";
      if(!S.eu && S.carregou.empresas && !S.exemplo){ S.eu = casarNome(S.nomeConta); if(S.eu){ S.fx.ana = S.ag.ana = S.em.ana = S.eu; } renderTudo(); }
    });
  });
  var v = VIEWS.indexOf(p.view) !== -1 ? p.view : "painel";
  irPara(v);
})();
})();
