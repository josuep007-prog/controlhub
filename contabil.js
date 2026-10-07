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

/* ============ domínio ============ */
var TRIBS = [
  {k:"simples",         l:"Simples Nacional",        c:"Simples",      peso:1},
  {k:"presumido",       l:"Lucro Presumido",         c:"Presumido",    peso:1.5},
  {k:"presumido_caixa", l:"Lucro Presumido (caixa)", c:"Presumido cx", peso:1.5},
  {k:"real_trim",       l:"Lucro Real Trimestral",   c:"Real trim.",   peso:2},
  {k:"real_mensal",     l:"Lucro Real Mensal",       c:"Real mensal",  peso:2.5},
  {k:"isenta",          l:"Isenta / Imune",          c:"Isenta",       peso:1}
];
var TRIB = {}; TRIBS.forEach(function(t){ TRIB[t.k] = t; });
function tribDeTexto(s){
  var n = norm(s);
  if(!n) return "";
  if(/simples/.test(n)) return "simples";
  if(/presumido/.test(n)) return /caixa/.test(n) ? "presumido_caixa" : "presumido";
  if(/real/.test(n)) return /mensal|estimativa|anual/.test(n) ? "real_mensal" : "real_trim";
  if(/isent|imune/.test(n)) return "isenta";
  return "";
}
var SITS = [
  {k:"ativa", l:"Ativa"}, {k:"saindo", l:"Saindo"}, {k:"saiu", l:"Saiu"},
  {k:"suspensa", l:"Suspensa"}, {k:"baixada", l:"Baixada"}, {k:"falencia", l:"Em falência"}
];
var SIT = {}; SITS.forEach(function(s){ SIT[s.k] = s; });
function sitDeTexto(s){
  var n = norm(s);
  if(!n || /ativ/.test(n)) return "ativa";
  if(/saindo/.test(n)) return "saindo";
  if(/saiu|saida/.test(n)) return "saiu";
  if(/suspen/.test(n)) return "suspensa";
  if(/baixad/.test(n)) return "baixada";
  if(/falen/.test(n)) return "falencia";
  return "ativa";
}
var ETAPAS = [
  {k:"fin",   l:"Financeiro",                              c:"Financeiro"},
  {k:"folha", l:"Lançamento de folha",                     c:"Folha"},
  {k:"depr",  l:"Depreciação",                             c:"Depreciação"},
  {k:"fisc",  l:"Conferência fiscal",                      c:"Conf. fiscal"},
  {k:"imp",   l:"Lançamento dos impostos",                 c:"Impostos"},
  {k:"conc",  l:"Conciliação de fornecedores e clientes",  c:"Conciliação"}
];
var ST_ROT = {"":"Pendente", a:"Em andamento", c:"Concluída", n:"Não se aplica"};
var ST_SIM = {"":"", a:"…", c:"✓", n:"–"};

// Prazos padrão (editáveis pela coordenação em Cadastro → Configurações).
var PRAZOS_PADRAO = {
  inicio: "",
  impostos: [
    {k:"das",   l:"DAS (Simples Nacional)",                     tribs:["simples"], per:"mensal", dia:20, regra:"prorroga"},
    {k:"irpjt", l:"IRPJ/CSLL trimestral (quota única/1ª quota)",tribs:["presumido","presumido_caixa","real_trim"], per:"trimestral", dia:"ultimo_util", regra:""},
    {k:"irpje", l:"IRPJ/CSLL estimativa mensal",                tribs:["real_mensal"], per:"mensal", dia:"ultimo_util", regra:""}
  ],
  anuais: [
    {k:"ecd",   l:"ECD",   tribs:["presumido","presumido_caixa","real_trim","real_mensal"], mes:6, dia:"ultimo_util"},
    {k:"ecf",   l:"ECF",   tribs:["presumido","presumido_caixa","real_trim","real_mensal","isenta"], mes:7, dia:"ultimo_util"},
    {k:"defis", l:"DEFIS", tribs:["simples"], mes:3, dia:31}
  ]
};

/* ============ estado ============ */
var S = {
  empresas: {}, comps: {}, anos: {}, cfg: JSON.parse(JSON.stringify(PRAZOS_PADRAO)),
  existe: {docs:{}},
  carregou: {empresas:false, ctb_emp:false, ctb_comp:false, ctb_ano:false},
  dpPorCnpj: {},
  view: "painel", eu: "", coord: false, meId: "", userNs: null, nomes: {},
  fx: {comp:"", busca:"", ana:"", trib:"", st:"", sel:new Set(), modo:"ate", faixa:""},
  ct: {busca:"", ana:"", trib:"", sis:"", sit:"clientes", modo:"lista", ord:"nome", dir:1, limite:100, sel:new Set()},
  ob: {ano:"", busca:"", ana:null, st:"", limite:100},
  pz: {abertos:{}}
};
var PREF = "ctb-prefs-v1";
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
  var K = "ctb-local-v1", dados = {}, ouv = [];
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
// Cada gravação mexe só nas chaves alteradas.
function balde(id, n){ var h = 0; for(var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % n; }
function docEmp(id){ return "ctb_emp/b" + balde(id, 8); }
function docComp(comp, id){ return "ctb_comp/" + comp + "~" + balde(id, 4); }
function docAno(ano, id){ return "ctb_ano/" + ano + "~" + balde(id, 2); }
function gravarMapas(itens){
  var col = itens.length ? itens[0][0].split("/")[0] : "";
  if(col && !S.carregou[col]){ toast("Aguarde: os dados ainda estão carregando."); var x = new Error("carregando"); x.ctb = true; return Promise.reject(x); }
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
function salvarCompEntrada(comp, eid, entrada){ var m = {}; m[eid] = entrada; return salvarCompVarias(comp, m); }
function salvarCompVarias(comp, mapa){
  var c = (S.comps[comp] = S.comps[comp] || {}); Object.keys(mapa).forEach(function(k){ c[k] = mapa[k]; });
  renderTudo();
  return gravarMapas(Object.keys(mapa).map(function(k){ return [docComp(comp, k), k, mapa[k]]; }));
}
function salvarAno(ano, mapa){
  var a = (S.anos[ano] = S.anos[ano] || {}); Object.keys(mapa).forEach(function(k){ a[k] = mapa[k]; });
  renderTudo();
  return gravarMapas(Object.keys(mapa).map(function(k){ return [docAno(ano, k), k, mapa[k]]; }));
}
function salvarCfg(cfg){
  S.cfg = cfg; renderTudo();
  return gravar(banco.doc("ctb_config/cfg").set(cfg));
}

/* ============ identidade e permissões ============ */
// "Você": o analista da carteira que está usando. Descoberto pelo nome da conta; dá para escolher à mão.
function analistas(){
  var s = {};
  Object.keys(S.empresas).forEach(function(k){ var e = S.empresas[k]; if(e.excluida) return; if(e.analista) s[e.analista] = true; if(e.apoio) s[e.apoio] = true; });
  return Object.keys(s).sort(function(a, b){ return a.localeCompare(b, "pt-BR"); });
}
function casarNome(nomeConta){
  var t = norm(nomeConta).split(" ").filter(Boolean); if(!t.length) return "";
  var melhor = "", pts = 0;
  analistas().forEach(function(a){
    var at = norm(a).split(" ").filter(Boolean);
    var p = at.filter(function(x){ return t.indexOf(x) !== -1; }).length;
    if(at[0] !== t[0]) p = 0;
    if(p > pts || (p === pts && p && at.length < norm(melhor).split(" ").length)){ pts = p; melhor = a; }
  });
  return pts ? melhor : "";
}
function minha(e){ return !!S.eu && (norm(e.analista) === norm(S.eu) || norm(e.apoio) === norm(S.eu)); }
function podeMarcar(e){ return S.coord || minha(e); }
function nomeDe(id){ return (S.nomes[id] || "").split(" ")[0] || ""; }
function buscarNomes(ids){
  if(!S.userNs) return;
  var falta = ids.filter(function(i){ return i && !(i in S.nomes); });
  if(!falta.length) return;
  falta.forEach(function(i){ S.nomes[i] = ""; });
  S.userNs.profiles(falta).then(function(ps){ falta.forEach(function(i){ S.nomes[i] = (ps && ps[i] && ps[i].name) || ""; }); }).catch(function(){});
}

/* ============ empresas ============ */
function normEmp(x, id){
  var t = function(v, n){ return String(v == null ? "" : v).trim().slice(0, n || 200); };
  var mmaaaa = function(v){ var m = /^(\d{1,2})\/(\d{4})$/.exec(t(v)); return m ? pad2(+m[1]) + "/" + m[2] : ""; };
  return {
    id: id || x.id, nome: t(x.nome, 160) || "Sem nome", anterior: t(x.anterior, 160), cnpj: cnpjFmt(x.cnpj), grupo: t(x.grupo, 60).toUpperCase(),
    desde: parseYmd(x.desde) ? x.desde : "", sistema: t(x.sistema, 40), migrado: mmaaaa(x.migrado),
    trib: TRIB[x.trib] ? x.trib : "", tribAnt: TRIB[x.tribAnt] ? x.tribAnt : "", tribMud: mmaaaa(x.tribMud),
    analista: t(x.analista, 60), apoio: t(x.apoio, 60),
    sit: SIT[x.sit] ? x.sit : "ativa", sitData: parseYmd(x.sitData) ? x.sitData : "",
    semFolha: !!x.semFolha, semImob: !!x.semImob,
    semInfo: Array.isArray(x.semInfo) ? x.semInfo.filter(function(k){ return ETAPAS.some(function(et){ return et.k === k; }); }) : [],
    contatos: t(x.contatos, 600), obs: t(x.obs, 1200),
    criado: t(x.criado, 40), atual: t(x.atual, 40), excluida: !!x.excluida
  };
}
function listaEmpresas(){ return Object.keys(S.empresas).map(function(k){ return S.empresas[k]; }).filter(function(e){ return !e.excluida; }); }
function ordNome(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }
var CLIENTE = {ativa:1, saindo:1, suspensa:1};
// Tributação que valia numa competência (antes da mudança, vale a anterior).
function tribNaComp(e, comp){
  if(e.tribAnt && e.tribMud){ var m = e.tribMud.slice(3) + "-" + e.tribMud.slice(0, 2); if(comp < m) return e.tribAnt; }
  return e.trib;
}
function inicioControle(){ return /^\d{4}-\d{2}$/.test(S.cfg.inicio || "") ? S.cfg.inicio : compShift(compAtual(), -1); }
// A empresa era cliente nessa competência?
function clienteNaComp(e, comp){
  if(e.excluida) return false;
  var ini = compIni(comp), fim = compFim(comp);
  var d = parseYmd(e.desde); if(d && d > fim) return false;
  var sd = parseYmd(e.sitData);
  if(e.sit === "ativa") return true;
  if(e.sit === "saindo") return !sd || sd > ini;
  return !!sd && sd > ini;
}
function naComp(e, comp){ return comp >= inicioControle() && clienteNaComp(e, comp); }
function etapaAplica(e, k){ return !(k === "folha" && e.semFolha) && !(k === "depr" && e.semImob); }
function entrada(comp, eid){ return (S.comps[comp] && S.comps[comp][eid]) || {}; }
function stEtapa(ent, e, k){ if(!etapaAplica(e, k)) return "n"; var v = ent.e && ent.e[k]; return v && v[0] ? v[0] : ""; }
function resumo(e, comp){
  var ent = entrada(comp, e.id), total = 0, feitas = 0, and = 0, falta = [];
  ETAPAS.forEach(function(et){
    var s = stEtapa(ent, e, et.k);
    if(s === "n") return;
    total++;
    if(s === "c") feitas++; else { falta.push(et); if(s === "a") and++; }
  });
  return {ent:ent, total:total, feitas:feitas, and:and, falta:falta, fechada: feitas === total, pend: ent.pend || ""};
}
function compEmFechamento(){ return compShift(compAtual(), -1); }
function compAtrasada(comp){ return comp < compEmFechamento(); }
function compsControle(){ var out = [], c = inicioControle(), fim = compAtual(); while(c <= fim && out.length < 240){ out.push(c); c = compShift(c, 1); } return out; }
// Competências em aberto da empresa (até a que está em fechamento).
function abertasDe(e){ return compsControle().filter(function(c){ return c <= compEmFechamento() && naComp(e, c) && !resumo(e, c).fechada; }); }

/* ============ vencimentos ============ */
function vencimentosImpostos(de, ate){
  var out = [], lista = listaEmpresas();
  (S.cfg.impostos || []).forEach(function(def){
    for(var i = -4; i <= 3; i++){
      var comp = compShift(compAtual(), i), m = +comp.slice(5, 7);
      if(def.per === "trimestral" && m % 3 !== 0) continue;
      var due = compShift(comp, 1), data = dataPrazo(+due.slice(0, 4), +due.slice(5, 7) - 1, def.dia, def.regra);
      if(data < de || data > ate) continue;
      var emps = lista.filter(function(e){ return clienteNaComp(e, comp) && def.tribs.indexOf(tribNaComp(e, comp)) !== -1; });
      // marcado no próprio vencimento: apurado e guia enviada ao cliente (independente do fechamento contábil)
      var lanc = emps.filter(function(e){ var s = stImp(comp, e, def.k); return s === "e" || s === "n"; });
      var apur = emps.filter(function(e){ return stImp(comp, e, def.k) === "a"; }).length;
      out.push({tipo:"imp", def:def, comp:comp, data:data, emps:emps, feitas:lanc.length, apuradas:apur, pendentes:emps.filter(function(e){ return lanc.indexOf(e) === -1; })});
    }
  });
  return out;
}
function prazoAnual(def, ano){ return dataPrazo(+ano + 1, (+def.mes || 1) - 1, def.dia, def.dia === "ultimo_util" ? "" : "exato"); }
function clienteNoAno(e, ano){ for(var m = 1; m <= 12; m++){ if(clienteNaComp(e, ano + "-" + pad2(m))) return true; } return false; }
function obrigAplica(e, def, ano){ return clienteNoAno(e, ano) && def.tribs.indexOf(tribNaComp(e, ano + "-12")) !== -1; }
function stObrig(ano, e, k){ var a = S.anos[ano] && S.anos[ano][e.id]; var v = a && a[k]; return v && v[0] ? v[0] : ""; }
function vencimentosAnuais(de, ate){
  var out = [], lista = listaEmpresas();
  (S.cfg.anuais || []).forEach(function(def){
    [hoje().getFullYear() - 2, hoje().getFullYear() - 1, hoje().getFullYear()].forEach(function(y){
      var ano = String(y), data = prazoAnual(def, ano);
      if(data < de || data > ate) return;
      var emps = lista.filter(function(e){ return obrigAplica(e, def, ano) && stObrig(ano, e, def.k) !== "n"; });
      var feitas = emps.filter(function(e){ return stObrig(ano, e, def.k) === "c"; });
      out.push({tipo:"anual", def:def, ano:ano, data:data, emps:emps, feitas:feitas.length, pendentes:emps.filter(function(e){ return feitas.indexOf(e) === -1; })});
    });
  });
  return out;
}
function contagem(data){
  var n = diasEntre(hoje(), data);
  if(n === 0) return {t:"vence hoje", c:"hoje"};
  if(n < 0) return {t:"venceu há " + (-n) + " dia" + (n === -1 ? "" : "s"), c:"venc"};
  return {t:"em " + n + " dia" + (n === 1 ? "" : "s"), c: n <= 5 ? "perto" : ""};
}
function diaBox(d){ var n = diasEntre(hoje(), d); return '<div class="dia' + (n === 0 ? " hoje" : n < 0 ? " venc" : "") + '"><b>' + pad2(d.getDate()) + '</b><small>' + MES3[d.getMonth()] + " · " + SEM3[d.getDay()] + '</small></div>'; }

/* ============ "fechado até" ============ */
// Até quando cada etapa está concluída sem buracos, desde o início do controle (como na planilha de controle).
// "" = nada concluído; "NA" = a etapa não se aplica à empresa. Cálculo guardado até o próximo desenho da tela.
var cacheAte = {};
function limparCacheAte(){ cacheAte = {}; }
function fimEmp(e){
  var k = "f" + e.id; if(k in cacheAte) return cacheAte[k];
  var cs = compsControle(), cef = compEmFechamento(), ult = "";
  for(var i = 0; i < cs.length && cs[i] <= cef; i++){ if(naComp(e, cs[i])) ult = cs[i]; }
  return (cacheAte[k] = ult);
}
function ateEtapa(e, k){
  var ck = e.id + "|" + k; if(ck in cacheAte) return cacheAte[ck];
  if(!etapaAplica(e, k)) return (cacheAte[ck] = "NA");
  var ult = "", cs = compsControle();
  for(var i = 0; i < cs.length; i++){
    var c = cs[i]; if(!naComp(e, c)) continue;
    var s = stEtapa(entrada(c, e.id), e, k);
    if(s === "c" || s === "n") ult = c; else break;
  }
  return (cacheAte[ck] = ult);
}
function mesesEntre(a, b){ return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
// Atraso em meses: da última competência concluída até a última que a empresa precisa fechar
// (a competência em fechamento ou o mês de saída). "" conta desde o início do controle.
function atrasoDe(e, ate){
  if(ate === "NA") return 0;
  var fim = fimEmp(e); if(!fim) return 0;
  return Math.max(0, mesesEntre(ate || compShift(inicioControle(), -1), fim));
}
function semInfo(e, k){ return (e.semInfo || []).indexOf(k) !== -1; }
// Faixas: 0 em dia (até 1 mês), 1 = 2–3 meses, 2 = 4–6, 3 = 7 ou mais, "ni" = falta informar, "na" = não se aplica
function faixaMeses(m){ return m <= 1 ? 0 : m <= 3 ? 1 : m <= 6 ? 2 : 3; }
function faixaEtapa(e, k){ var a = ateEtapa(e, k); if(a === "NA") return "na"; if(a === "" && semInfo(e, k)) return "ni"; return faixaMeses(atrasoDe(e, a)); }
// Situação da empresa: o atraso real pesa mais que "falta informar".
function resumoAte(e){
  var ck = "r" + e.id; if(ck in cacheAte) return cacheAte[ck];
  var real = null, ni = [], falta = [], ates = {};
  ETAPAS.forEach(function(et){
    var a = ateEtapa(e, et.k); if(a === "NA") return;
    if(a === "" && semInfo(e, et.k)){ ni.push(et); return; }
    if(real === null || a < real) real = a;
    ates[et.k] = a;
    if(atrasoDe(e, a) > 0) falta.push(et);
  });
  var m = real === null ? 0 : atrasoDe(e, real);
  var fx = real === null ? (ni.length ? "ni" : "na") : (m <= 1 && ni.length ? "ni" : faixaMeses(m));
  var piores = real === null ? [] : ETAPAS.filter(function(et){ return et.k in ates && ates[et.k] === real; });
  return (cacheAte[ck] = {ate: real === null ? "" : real, meses: m, faixa: fx, ni: ni, falta: falta, piores: piores});
}
var FAIXAS = [
  {k:0, l:"Em dia", c:"f0", d:"no máximo 1 mês"}, {k:1, l:"2–3 meses", c:"f1", d:"de atraso"}, {k:2, l:"4–6 meses", c:"f2", d:"de atraso"},
  {k:3, l:"7 meses ou mais", c:"f3", d:"de atraso"}, {k:"ni", l:"Falta informar", c:"fni", d:"etapa sem registro na planilha"}
];
var FAIXA_CLS = {0:"f0", 1:"f1", 2:"f2", 3:"f3", ni:"fni", na:"fna"};
function rotAte(a){ return a === "NA" ? "não se aplica" : a ? compCurta(a) : "antes de " + compCurta(inicioControle()); }
function rotAtraso(m){ return m <= 0 ? "em dia" : m === 1 ? "1 mês" : m + " meses"; }
// Empresas que entram no controle: clientes hoje ou que ainda têm competência a fechar.
function empresasControle(){ return listaEmpresas().filter(function(e){ return !!fimEmp(e); }); }
// Competência onde fica a pendência do cliente: a primeira ainda aberta (ou a em fechamento).
function compPendencia(e){ return abertasDe(e)[0] || compEmFechamento(); }
function diasParado(ent){ var u = (ent.cobr && ent.cobr.length ? ent.cobr[ent.cobr.length - 1] : "") || ent.pendEm; var d = parseYmd(u); return d ? diasEntre(d, hoje()) : 0; }
function stImp(comp, e, k){ var v = (entrada(comp, e.id).v || {})[k]; return v && v[0] ? v[0] : ""; }

/* ============ avisos, confirmação e menu de status ============ */
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
  pop = document.createElement("div"); pop.className = "pop"; pop.innerHTML = html; document.body.appendChild(pop);
  var r = alvo.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8), top = r.bottom + 4;
  if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  pop.style.left = left + "px"; pop.style.top = top + "px";
  if(aoMontar) aoMontar(pop);
  var f = pop.querySelector("textarea, button"); if(f) f.focus();
}
document.addEventListener("mousedown", function(e){ if(pop && !pop.contains(e.target)) fecharPop(); });
document.addEventListener("keydown", function(e){ if(e.key === "Escape") fecharPop(); });
window.addEventListener("resize", fecharPop);
document.addEventListener("scroll", fecharPop, true);
function menuStatus(alvo, atual, rotulos, info, aoEscolher){
  var ordem = ["", "a", "c", "n"];
  abrirPop(alvo, ordem.map(function(s){
    return '<button type="button" data-s="' + s + '"><span class="st ' + (s || "p") + '">' + ST_SIM[s] + '</span>' + esc(rotulos[s]) + (s === atual ? " ·  atual" : "") + '</button>';
  }).join("") + (info ? '<div class="info">' + esc(info) + '</div>' : ""), function(p){
    $$("button[data-s]", p).forEach(function(b){ b.onclick = function(){ fecharPop(); aoEscolher(b.getAttribute("data-s")); }; });
  });
}
function stCell(s, attrs, pode, titulo){
  return '<button type="button" class="st ' + (s || "p") + '" ' + attrs + (pode ? "" : " disabled") + ' title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '">' + ST_SIM[s] + '</button>';
}
function infoMarca(v){ if(!v || !v[1]) return ""; var n = nomeDe(v[2]); return ST_ROT[v[0]] + " em " + dataBR(v[1]) + (n ? " por " + n : ""); }

/* ============ navegação (abas como as do DP) ============ */
var VIEWS = ["painel","fechamento","carteira","prazos","cadastro"];
var animarView = "";
var semMovimento = function(){ return matchMedia("(prefers-reduced-motion: reduce)").matches; };
// A animação de entrada roda uma vez ao abrir a aba, não a cada atualização do banco.
function vaiAnimar(v){ if(animarView !== v) return 0; animarView = ""; return semMovimento() ? 0 : performance.now(); }
// Liga a animação num contêiner; se a tela for redesenhada no meio, ela continua (como no DP).
function marcarAnim(el, t0, cls){
  if(!el) return;
  if(t0){ el.classList.add(cls); clearTimeout(el.__tAnim); el.__tAnim = setTimeout(function(){ el.classList.remove(cls); }, 1700); }
}
// linhas das listas surgindo em sequência ao abrir a aba
function animarLinhas(el, t0){
  if(!t0 || !el) return;
  $$("tbody > tr, .cartao", el).slice(0, 24).forEach(function(r, k){ r.style.setProperty("--k", k); });
  marcarAnim(el, t0, "ls-anim");
}
// números contando de 0 até o valor
function contar(els, t0){
  if(!t0) return;
  els.forEach(function(el, k){
    var alvo = parseInt(el.textContent, 10); if(!(alvo > 0) || String(alvo) !== el.textContent.trim()) return;
    var ini = t0 + k * 70, dur = 850;
    var passo = function(t){ var x = Math.min(1, Math.max(0, (t - ini) / dur)); el.textContent = Math.round(alvo * (1 - Math.pow(1 - x, 3))); if(x < 1 && el.isConnected) requestAnimationFrame(passo); };
    passo(performance.now());
  });
}
// traço da aba ativa: desliza até a aba clicada
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
  limparCacheAte();
  renderEu();
  renderCabeca();
  $("#carregando").hidden = S.carregou.empresas;
  var v = S.view;
  if(v === "painel") renderPainel();
  else if(v === "fechamento") renderFechamento();
  else if(v === "carteira") renderCarteira();
  else if(v === "prazos") renderPrazos();
  else if(v === "cadastro") renderCadastro();
  $$("[data-coord]").forEach(function(el){ el.hidden = !S.coord; });
}
// Cabeçalho: competência em fechamento e contadores nas abas (atrasadas de quem está usando ou da equipe; impostos vencendo).
function renderCabeca(){
  $("#ctSync").textContent = "fechamento de " + compRot(compEmFechamento()).toLowerCase() + " · controle desde " + compCurta(inicioControle());
  var ctrl = S.carregou.empresas ? empresasControle() : [], minhas = S.eu ? ctrl.filter(minha) : ctrl;
  var atras = minhas.filter(function(e){ var f = resumoAte(e).faixa; return f === 1 || f === 2 || f === 3; }).length;
  var bf = $("#bdFech"); bf.hidden = !atras; bf.textContent = atras; bf.title = atras + " empresa" + (atras === 1 ? "" : "s") + (S.eu ? " suas" : "") + " com fechamento atrasado";
  var ate5 = new Date(hoje()); ate5.setDate(ate5.getDate() + 5);
  var de = new Date(hoje()); de.setDate(de.getDate() - 10);
  var urg = S.carregou.empresas ? vencimentosImpostos(de, ate5).filter(function(v){ return v.pendentes.length; }).length : 0;
  var bp = $("#bdPrz"); bp.hidden = !urg; bp.textContent = urg; bp.title = urg + " vencimento" + (urg === 1 ? "" : "s") + " de imposto com guia pendente até " + dataBR(ymd(ate5));
}
function renderEu(){
  var sel = $("#euSel"), as = analistas(), atual = S.eu;
  var html = '<option value="">' + (as.length ? "Escolha…" : "—") + '</option>' + as.map(function(a){ return '<option' + (a === atual ? " selected" : "") + '>' + esc(a) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = atual;
  $("#coordTag").hidden = !S.coord;
}
$("#euSel").onchange = function(){ S.eu = this.value; salvarPrefs({eu:S.eu}); S.fx.ana = S.eu || ""; renderTudo(true); };
function opcoesAnalista(sel, valor, rotuloTodos){
  var html = '<option value="">' + (rotuloTodos || "Todos os analistas") + '</option>' + analistas().map(function(a){ return '<option' + (a === valor ? " selected" : "") + '>' + esc(a) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = valor || "";
}
function opcoesTrib(sel, valor){
  var html = '<option value="">Todas as tributações</option>' + TRIBS.map(function(t){ return '<option value="' + t.k + '">' + esc(t.l) + '</option>'; }).join("");
  if(sel.innerHTML !== html) sel.innerHTML = html;
  sel.value = valor || "";
}

/* ============ PAINEL ============ */
// Barra reta em segmentos, um por faixa de atraso.
function barraFaixas(cont, total, titulo){
  return '<span class="fbar" role="img" aria-label="' + esc(titulo) + '">' + FAIXAS.concat([{k:"na", l:"Não se aplica", c:"fna"}]).filter(function(f){ return cont[f.k]; }).map(function(f){
    return '<i class="' + f.c + '" style="flex:' + cont[f.k] + '" title="' + esc(titulo + ": " + cont[f.k] + " · " + f.l.toLowerCase()) + '"></i>';
  }).join("") + (total ? '' : '<i class="fna" style="flex:1"></i>') + '</span>';
}
function renderPainel(){
  var lista = listaEmpresas(), ctrl = empresasControle(), anim = vaiAnimar("painel");
  var kp = $("#pnKpis"), grid = $("#pnGrid");
  var cont = {0:0, 1:0, 2:0, 3:0, ni:0, na:0}, aguard = 0;
  ctrl.forEach(function(e){ cont[resumoAte(e).faixa]++; if(entrada(compPendencia(e), e.id).pend) aguard++; });
  // cartões de número (os do DP): um por faixa de atraso + aguardando cliente; clique filtra o Fechamento
  var kpi = function(cls, n, rot, sub, filtro){ return '<button type="button" class="kpi-card ' + cls + '" data-ir-faixa="' + filtro + '"><div class="kpi-value">' + n + '</div><div class="kpi-label">' + rot + '</div><span class="sub">' + sub + '</span></button>'; };
  if(S.carregou.empresas && !lista.length){
    kp.innerHTML = "";
    grid.innerHTML = '<section class="pn-card pn-wide"><div class="vazio"><b style="display:block; color:var(--ink); font:700 14px Archivo,sans-serif; margin-bottom:6px">Nenhuma empresa na carteira ainda</b>Importe a planilha da carteira em Cadastro.<div style="margin-top:12px"><button type="button" class="btn" data-ir="cadastro">Ir para Cadastro</button></div></div></section>';
    return;
  }
  kp.innerHTML = FAIXAS.map(function(f){ return kpi(f.c + (f.k === 3 && cont[3] ? " pulsa" : ""), cont[f.k], esc(f.l), esc(f.d), String(f.k)); }).join("") + kpi("fcli", aguard, "Aguardando cliente", "com pendência registrada", "cli");
  contar($$(".kpi-value", kp), anim);

  var card = function(titulo, sub, corpo, extra, cls){ return '<section class="pn-card ' + (cls || "") + '"><div class="pn-card-head"><h3>' + titulo + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + (extra || "") + '</div><div class="pn-card-body">' + corpo + '</div></section>'; };

  // minha fila: uma linha por empresa, da mais atrasada para a mais em dia
  var minhas = S.eu ? ctrl.filter(minha) : [];
  var fila = minhas.map(function(e){ return {e:e, r:resumoAte(e)}; }).filter(function(x){ return x.r.faixa !== 0 || x.r.falta.length; })
    .sort(function(a, b){ return b.r.meses - a.r.meses || ordNome(a.e, b.e); });
  var filaCorpo = !S.eu ? '<div class="empty-mini">Escolha quem você é no alto da página (“Você”) para ver a sua fila.</div>'
    : !fila.length ? '<div class="empty-mini">Nada atrasado nas suas empresas.</div>'
    : fila.slice(0, 10).map(function(x, i){
      var pend = entrada(compPendencia(x.e), x.e.id).pend, ni = x.r.faixa === "ni" && !x.r.ate;
      return '<button type="button" class="q-item ' + FAIXA_CLS[x.r.faixa] + '" style="--k:' + i + '" data-fila-emp="' + esc(x.e.id) + '"><span class="pill fx">' + (ni ? "falta informar" : rotAtraso(x.r.meses)) + '</span><span style="min-width:0"><span class="dp-cell-main" style="display:block">' + esc(x.e.nome) + '</span><span class="dp-cell-sub" style="display:block">' +
        (ni ? 'Falta informar: ' + esc(x.r.ni.map(function(f){ return f.c; }).join(", ")) : 'Fechado até ' + esc(rotAte(x.r.ate)) + (x.r.piores.length && x.r.piores.length < ETAPAS.length ? ' · mais atrasada' + (x.r.piores.length === 1 ? '' : 's') + ': ' + esc(x.r.piores.map(function(f){ return f.c; }).join(", ")) : '')) +
        (pend ? ' · aguardando: ' + esc(pend) : '') + '</span></span></button>';
    }).join("");
  var filaCard = card("Minha fila", S.eu ? (fila.length ? fila.length + " de " + minhas.length + " empresas com algo a fechar" : minhas.length + " empresas") : "", filaCorpo,
    fila.length > 10 ? '<button type="button" class="pn-link" data-ir-faixa="atras">Ver todas (' + fila.length + ')</button>' : '', "pn-span2");

  // próximos vencimentos
  var ate45 = new Date(hoje()); ate45.setDate(ate45.getDate() + 45);
  var vs = vencimentosImpostos(hoje(), ate45).concat(vencimentosAnuais(hoje(), ate45)).sort(function(a, b){ return a.data - b.data; }).slice(0, 6);
  var vencCard = card("Próximos vencimentos", "impostos e obrigações", vs.length ? vs.map(function(v, i){
    var c = contagem(v.data);
    return '<div class="vc-item" style="--k:' + i + '">' + diaBox(v.data) + '<span style="min-width:0"><span class="dp-cell-main" style="display:block" title="' + esc(v.def.l) + '">' + esc(v.def.l) + '</span><span class="dp-cell-sub" style="display:block">' + (v.tipo === "imp" ? esc(compCurta(v.comp)) + ' · ' + v.feitas + ' de ' + v.emps.length + ' com guia' : "ano " + v.ano + ' · ' + v.feitas + ' de ' + v.emps.length + ' entregues') + '</span></span><span class="cd ' + (v.pendentes.length ? c.c : "ok") + '">' + (v.pendentes.length ? c.t : "tudo feito") + '</span></div>';
  }).join("") : '<div class="empty-mini">Nenhum vencimento nos próximos 45 dias.</div>', '<button type="button" class="pn-link" data-ir="prazos">Abrir prazos</button>');

  // até onde cada etapa está fechada
  var travaCard = card("Até onde cada etapa está fechada", ctrl.length + " empresas no controle · número à direita = em dia", '<div class="dist">' + ETAPAS.map(function(et, i){
    var c = {0:0, 1:0, 2:0, 3:0, ni:0, na:0}; ctrl.forEach(function(e){ c[faixaEtapa(e, et.k)]++; });
    return '<span>' + esc(et.l) + '</span><span style="--k:' + i + '">' + barraFaixas(c, ctrl.length, et.l) + '</span><em>' + (c[0] || 0) + '</em>';
  }).join("") + '</div><div class="leg-f">' + FAIXAS.map(function(f){ return '<span><i class="' + f.c + '"></i>' + esc(f.l) + '</span>'; }).join("") + '<span><i class="fna"></i>Não se aplica</span></div>', "", "pn-span2");

  // entradas e saídas
  var h = hoje(), lim = new Date(h); lim.setDate(lim.getDate() - 90);
  var mov = [];
  lista.forEach(function(e){
    var d = parseYmd(e.desde); if(d && d >= lim && d <= h) mov.push({d:d, e:e, t:"Entrou", c:"ativa"});
    var s = parseYmd(e.sitData);
    if(s && !CLIENTE[e.sit] && s >= lim && s <= h) mov.push({d:s, e:e, t:SIT[e.sit].l, c:e.sit});
    if(e.sit === "saindo") mov.push({d:s || h, e:e, t:"Sai" + (s ? " em " + dataBR(e.sitData) : ""), c:"saindo", fut:true});
  });
  mov.sort(function(a, b){ return (b.fut ? 1 : 0) - (a.fut ? 1 : 0) || b.d - a.d; });
  var movCard = card("Entradas e saídas", "últimos 90 dias e próximas saídas", mov.length ? mov.slice(0, 7).map(function(m, i){
    return '<button type="button" class="mv-item" style="--k:' + i + '" data-ficha="' + esc(m.e.id) + '"><span style="min-width:0"><span class="dp-cell-main" style="display:block">' + esc(m.e.nome) + '</span><span class="dp-cell-sub" style="display:block">' + (m.fut ? "" : dataBR(ymd(m.d)) + " · ") + esc(m.e.analista || "sem analista") + '</span></span><span class="pill ' + m.c + '">' + esc(m.t) + '</span></button>';
  }).join("") : '<div class="empty-mini">Nenhuma entrada ou saída nos últimos 90 dias.</div>');

  // carteira por analista: carga em barra horizontal e situação do fechamento em barra de faixas
  var porAna = {};
  ctrl.forEach(function(e){
    var a = e.analista || "(sem analista)", r = resumoAte(e);
    var x = porAna[a] = porAna[a] || {a:a, n:0, carga:0, c:{0:0, 1:0, 2:0, 3:0, ni:0, na:0}, meses:[], cli:0};
    x.n++; x.carga += (TRIB[e.trib] || {peso:1}).peso; x.c[r.faixa]++; if(r.faixa !== "ni" && r.faixa !== "na") x.meses.push(r.meses);
    if(entrada(compPendencia(e), e.id).pend) x.cli++;
  });
  var linhas = Object.keys(porAna).map(function(k){ return porAna[k]; }).sort(function(a, b){ return b.carga - a.carga; });
  var maxC = Math.max.apply(null, linhas.map(function(l){ return l.carga; }).concat([1]));
  var mediana = function(v){ if(!v.length) return null; v = v.slice().sort(function(a, b){ return a - b; }); return v[Math.floor(v.length / 2)]; };
  var anaCorpo = linhas.length ? '<div class="an-row h"><span>Analista</span><span class="num">Empresas</span><span>Carga</span><span>Situação do fechamento</span><span class="num">Atraso típico</span><span class="num">Falta informar</span><span class="num">Aguardando</span></div>' + linhas.map(function(l, i){
    var md = mediana(l.meses);
    return '<div class="an-row" style="--k:' + i + '"><span class="an-nome"><button type="button" class="linkish" style="font-size:12.5px" data-ana="' + esc(l.a) + '">' + esc(l.a) + '</button>' + (norm(l.a) === norm(S.eu) ? '<span class="chip">você</span>' : '') + '</span><span class="num">' + l.n + '</span>' +
      '<span class="an-carga"><i style="width:' + Math.max(3, Math.round(l.carga / maxC * 70)) + '%"></i><span>' + l.carga.toLocaleString("pt-BR") + '</span></span>' +
      '<span>' + barraFaixas(l.c, l.n, l.a) + '</span>' +
      '<span class="num">' + (md == null ? '—' : '<span class="mes ' + FAIXA_CLS[faixaMeses(md)] + '">' + rotAtraso(md) + '</span>') + '</span>' +
      '<span class="num">' + (l.c.ni || "—") + '</span><span class="num">' + (l.cli || "—") + '</span></div>';
  }).join("") : '<div class="empty-mini" style="padding:12px 14px">Nenhuma empresa no controle.</div>';
  var anaCard = '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Carteira por analista</h3><span class="sub">atraso do fechamento e carga ponderada pela tributação · clique no nome para ver as empresas</span></div><div class="pn-card-body flush">' + anaCorpo + '</div></section>';

  grid.innerHTML = filaCard + vencCard + travaCard + movCard + anaCard;
  marcarAnim(grid, anim, "pn-anim");
}
document.addEventListener("click", function(e){
  var t = e.target;
  var ir = t.closest("[data-ir]"); if(ir){ irPara(ir.getAttribute("data-ir")); return; }
  var fxa = t.closest("[data-ir-faixa]"); if(fxa){ irPara("fechamento", {"fx.modo":"ate", "fx.faixa": fxa.getAttribute("data-ir-faixa"), "fx.busca":"", "fx.ana": S.fx.ana && t.closest("#pnFila") ? S.fx.ana : ""}); return; }
  var fl = t.closest("[data-fila-emp]"); if(fl){ var emp = S.empresas[fl.getAttribute("data-fila-emp")]; irPara("fechamento", {"fx.modo":"ate", "fx.busca": emp ? emp.nome : "", "fx.faixa":"", "fx.ana":""}); return; }
  var an = t.closest("[data-ana]"); if(an){ irPara("fechamento", {"fx.modo":"ate", "fx.ana": an.getAttribute("data-ana"), "fx.busca":"", "fx.faixa":""}); return; }
  var fi = t.closest("[data-ficha]"); if(fi){ abrirFicha(fi.getAttribute("data-ficha")); return; }
});

/* ============ FECHAMENTO ============ */
function filtroTexto(e, q){ if(!q) return true; var h = norm([e.nome, e.anterior, e.grupo, e.cnpj, cnpjDig(e.cnpj), e.analista, e.apoio].join(" ")); return norm(q).split(" ").every(function(w){ return h.indexOf(w) !== -1; }); }
function renderFechamento(){
  var F = S.fx, anim = vaiAnimar("fechamento");
  $$("#fxModo button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-m") === F.modo); });
  var ate = F.modo === "ate";
  $("#fxCompNav").hidden = ate; $("#fxSt").hidden = ate; $("#fxFaixa").hidden = !ate;
  if(ate){ $("#fxLote").hidden = true; $("#fxLeg").innerHTML = legendaAte(); renderAte(anim); return; }
  $("#fxTab").hidden = false; $("#fxCards").hidden = true;
  var comps = compsControle();
  if(!F.comp || comps.indexOf(F.comp) === -1) F.comp = comps.indexOf(compEmFechamento()) !== -1 ? compEmFechamento() : comps[comps.length - 1];
  var comp = F.comp;
  $("#compRot").innerHTML = esc(compRot(comp)) + (compAtrasada(comp) ? ' <span class="pill atras">atrasada</span>' : comp === compAtual() ? ' <span class="pill">mês corrente</span>' : '');
  $("#compAnt").disabled = comps.indexOf(comp) <= 0; $("#compProx").disabled = comps.indexOf(comp) >= comps.length - 1;
  if($("#fxBusca").value !== F.busca) $("#fxBusca").value = F.busca;
  opcoesAnalista($("#fxAna"), F.ana); opcoesTrib($("#fxTrib"), F.trib);
  $$("#fxSt button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-st") === F.st); });
  var base = listaEmpresas().filter(function(e){ return naComp(e, comp); });
  var lista = base.filter(function(e){
    if(F.ana && norm(e.analista) !== norm(F.ana) && norm(e.apoio) !== norm(F.ana)) return false;
    if(F.trib && tribNaComp(e, comp) !== F.trib) return false;
    if(!filtroTexto(e, F.busca)) return false;
    if(F.st){ var f = resumo(e, comp).fechada; if(F.st === "abertas" ? f : !f) return false; }
    return true;
  }).sort(ordNome);
  var fechadas = lista.filter(function(e){ return resumo(e, comp).fechada; }).length;
  $("#fxCont").textContent = lista.length + (lista.length !== base.length ? " de " + base.length : "") + " empresas · " + fechadas + " fechadas";
  F.sel.forEach(function(id){ if(!lista.some(function(e){ return e.id === id; })) F.sel.delete(id); });
  var marcaveis = lista.filter(podeMarcar);
  var ids = [];
  lista.forEach(function(e){ ETAPAS.forEach(function(et){ var v = entrada(comp, e.id).e; v = v && v[et.k]; if(v && v[2]) ids.push(v[2]); }); });
  buscarNomes(ids);
  var tudoSel = marcaveis.length && marcaveis.every(function(e){ return F.sel.has(e.id); });
  var html = '<thead><tr><th style="width:30px">' + (marcaveis.length ? '<input type="checkbox" id="fxTodos" aria-label="Selecionar todas que você pode marcar"' + (tudoSel ? " checked" : "") + '>' : '') + '</th><th>Empresa</th>' +
    ETAPAS.map(function(et){ return '<th class="et" title="' + esc(et.l) + '">' + esc(et.c) + '</th>'; }).join("") + '<th>Andamento</th><th>Pendência do cliente</th><th></th></tr></thead><tbody>';
  if(!lista.length) html += '<tr><td colspan="' + (ETAPAS.length + 5) + '"><div class="vazio">' + (base.length ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? "Nenhuma empresa da carteira nesta competência." : "Carregando…") + '</div></td></tr>';
  html += lista.map(function(e){
    var r = resumo(e, comp), pode = podeMarcar(e), tb = TRIB[tribNaComp(e, comp)];
    var pct = r.total ? Math.round(r.feitas / r.total * 100) : 100;
    return '<tr class="' + (r.fechada ? "fechada" : compAtrasada(comp) ? "atras" : "") + '" data-emp="' + esc(e.id) + '">' +
      '<td>' + (pode ? '<input type="checkbox" class="fxSel" data-id="' + esc(e.id) + '"' + (F.sel.has(e.id) ? " checked" : "") + ' aria-label="Selecionar ' + esc(e.nome) + '">' : '') + '</td>' +
      '<td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="sub">' + esc(e.analista || "sem analista") + (e.apoio ? " / " + esc(e.apoio) : "") + (tb ? ' · <span class="chip">' + esc(tb.c) + '</span>' : '') + '</span></td>' +
      ETAPAS.map(function(et){
        var s = stEtapa(r.ent, e, et.k), fixo = !etapaAplica(e, et.k), v = r.ent.e && r.ent.e[et.k];
        var tit = et.l + ": " + (fixo ? "não se aplica (" + (et.k === "folha" ? "empresa sem folha" : "sem imobilizado") + ", na ficha)" : (infoMarca(v) || ST_ROT[s])) + (pode ? "" : " · só o analista da empresa ou a coordenação marca");
        return '<td class="et">' + stCell(s, 'data-et="' + et.k + '"', pode && !fixo, tit) + '</td>';
      }).join("") +
      '<td><span class="prog"><i><b style="width:' + pct + '%"></b></i>' + (r.fechada ? "fechada" : r.feitas + "/" + r.total) + '</span></td>' +
      '<td><button type="button" class="pend-btn' + (r.pend ? " tem" : "") + '" data-pend' + (pode ? "" : " disabled") + ' title="' + esc(r.pend ? "Aguardando o cliente desde " + dataBR(r.ent.pendEm) + ": " + r.pend : "Registrar o que falta o cliente mandar") + '">' + (r.pend ? "⏳ " + esc(r.pend) : (pode ? "+ pendência" : "")) + '</button></td>' +
      '<td>' + (pode && !r.fechada ? '<button type="button" class="fbtn" data-tudo title="Marcar todas as etapas que se aplicam como concluídas">✓ Tudo</button>' : '') + '</td></tr>';
  }).join("") + '</tbody>';
  $("#fxTab").innerHTML = html;
  animarLinhas($("#fxTab"), anim);
  $("#fxLeg").innerHTML = ["", "a", "c", "n"].map(function(s){ return '<span><span class="st ' + (s || "p") + '">' + ST_SIM[s] + '</span> ' + ST_ROT[s] + '</span>'; }).join("") + '<span>· Clique numa etapa para mudar. Linha com faixa vermelha = competência atrasada.</span>';
  var nSel = F.sel.size, lote = $("#fxLote");
  lote.hidden = !nSel;
  if(nSel) lote.innerHTML = '<b>' + nSel + ' selecionada' + (nSel === 1 ? '' : 's') + '</b> Marcar <select id="loteEt"><option value="*">todas as etapas</option>' + ETAPAS.map(function(et){ return '<option value="' + et.k + '">' + esc(et.l) + '</option>'; }).join("") + '</select> como <select id="loteSt"><option value="c">Concluída</option><option value="a">Em andamento</option><option value="">Pendente</option><option value="n">Não se aplica</option></select><button type="button" class="btn" id="loteOk">Aplicar</button><button type="button" class="linkish" id="loteLimpar">Limpar seleção</button>';
}
function marcarEtapas(comp, e, mudancas){
  var ent = JSON.parse(JSON.stringify(entrada(comp, e.id)));
  ent.e = ent.e || {};
  var dia = ymd(hoje());
  Object.keys(mudancas).forEach(function(k){ var s = mudancas[k]; if(s) ent.e[k] = [s, dia, S.meId || ""]; else delete ent.e[k]; });
  var r0 = resumo(e, comp).fechada;
  (S.comps[comp] = S.comps[comp] || {})[e.id] = ent;
  var r1 = resumo(e, comp);
  if(r1.fechada && !r0){ ent.fechadaEm = dia; if(ent.pend){ ent.pend = ""; ent.pendEm = ""; } }
  if(!r1.fechada) ent.fechadaEm = "";
  return {ent:ent, fechou: r1.fechada && !r0};
}
$("#compAnt").onclick = function(){ S.fx.comp = compShift(S.fx.comp, -1); S.fx.sel.clear(); renderTudo(true); };
$("#compProx").onclick = function(){ S.fx.comp = compShift(S.fx.comp, 1); S.fx.sel.clear(); renderTudo(true); };
$("#fxBusca").oninput = function(){ S.fx.busca = this.value; renderTudo(); };
$("#fxAna").onchange = function(){ S.fx.ana = this.value; renderTudo(true); };
$("#fxTrib").onchange = function(){ S.fx.trib = this.value; renderTudo(true); };
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
    menuStatus(b, stEtapa(ent, e, k), ST_ROT, infoMarca(v), function(s){
      var m = {}; m[k] = s; var res = marcarEtapas(comp, e, m);
      salvarCompEntrada(comp, e.id, res.ent);
      if(res.fechou) toast("“" + e.nome + "” fechou " + compCurta(comp) + ".");
    });
    return;
  }
  if(t.closest("[data-tudo]") && e){
    var m2 = {}; ETAPAS.forEach(function(et){ if(etapaAplica(e, et.k) && stEtapa(entrada(comp, e.id), e, et.k) !== "n") m2[et.k] = "c"; });
    var antes = JSON.parse(JSON.stringify(entrada(comp, e.id)));
    var res2 = marcarEtapas(comp, e, m2);
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
      var m3 = {};
      (et === "*" ? ETAPAS.map(function(x){ return x.k; }) : [et]).forEach(function(k){ if(etapaAplica(em, k)) m3[k] = st; });
      mapa[id] = marcarEtapas(comp, em, m3).ent; n++;
    });
    if(n) salvarCompVarias(comp, mapa).then(function(){ toast(n + " empresa" + (n === 1 ? "" : "s") + " atualizada" + (n === 1 ? "" : "s") + " em " + compCurta(comp) + "."); });
    S.fx.sel.clear(); renderTudo(true);
  }
});

/* ---------- pendência do cliente (com cobranças) ---------- */
function abrirPendencia(alvo, comp, e){
  var ent0 = entrada(comp, e.id), cobr = ent0.cobr || [], parado = ent0.pend ? diasParado(ent0) : 0;
  abrirPop(alvo, '<div class="info" style="border:0;margin:0;padding:2px 8px 6px">' + esc(e.nome) + ' · ' + esc(compRot(comp)) + '</div>' +
    '<label class="campo">O que falta o cliente mandar?<textarea id="pendTxt" maxlength="200" placeholder="Ex.: extrato do Itaú de setembro">' + esc(ent0.pend || "") + '</textarea></label>' +
    (ent0.pend ? '<div class="info">Pedido em ' + esc(dataBR(ent0.pendEm) || "—") + (cobr.length ? ' · ' + cobr.length + ' cobrança' + (cobr.length === 1 ? '' : 's') + ': ' + esc(cobr.slice(-4).map(dataBR).join(", ")) : ' · nenhuma cobrança registrada') + ' · parado há ' + parado + ' dia' + (parado === 1 ? '' : 's') + '</div>' : '') +
    '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap">' + (ent0.pend ? '<button type="button" class="fbtn" id="pendCobr">Registrar cobrança hoje</button><button type="button" class="fbtn" id="pendLimpar">Recebido</button>' : '') + '<button type="button" class="btn" id="pendOk">Salvar</button></div>', function(p){
    var salvar = function(txt, cobrar){
      var ent = JSON.parse(JSON.stringify(entrada(comp, e.id)));
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

/* ---------- FECHAMENTO: "Fechado até" ---------- */
function legendaAte(){
  return FAIXAS.map(function(f){ return '<span><i class="lq ' + f.c + '"></i>' + esc(f.l) + '</span>'; }).join("") + '<span><i class="lq fna"></i>Não se aplica</span><span>· Cada célula diz até que mês a etapa está concluída. Clique para avançar: os meses que faltavam são marcados de uma vez.</span>';
}
function passaFaixa(e, f){
  if(!f) return true;
  var r = resumoAte(e);
  if(f === "atras") return r.faixa !== 0 && r.faixa !== "ni" && r.faixa !== "na";
  if(f === "cli") return !!entrada(compPendencia(e), e.id).pend;
  return String(r.faixa) === f;
}
function listaAte(){
  var F = S.fx;
  return empresasControle().filter(function(e){
    if(F.ana && norm(e.analista) !== norm(F.ana) && norm(e.apoio) !== norm(F.ana)) return false;
    if(F.trib && e.trib !== F.trib) return false;
    return filtroTexto(e, F.busca) && passaFaixa(e, F.faixa);
  }).sort(function(a, b){ return resumoAte(b).meses - resumoAte(a).meses || ordNome(a, b); });
}
function celAte(e, k, pode, curta){
  var a = ateEtapa(e, k), fx = faixaEtapa(e, k), m = atrasoDe(e, a), et = ETAPAS.filter(function(x){ return x.k === k; })[0];
  var txt = fx === "na" ? "—" : fx === "ni" && !a ? (curta ? "falta informar" : "sem info") : a ? compCurta(a) : "antes " + compCurta(inicioControle());
  var sub = fx === "na" ? "não se aplica" : fx === "ni" && !a ? "sem registro" : rotAtraso(m);
  var tit = et.l + ": " + (fx === "na" ? "não se aplica" : (a ? "concluída até " + compRot(a) : fx === "ni" ? "a planilha não informava" : "nada concluído desde " + compRot(inicioControle())) + (m ? " · " + rotAtraso(m) + " de atraso" : "")) + (pode && fx !== "na" ? " · clique para avançar" : "");
  return '<button type="button" class="ate ' + FAIXA_CLS[fx] + '" data-ate="' + k + '"' + (pode && fx !== "na" ? "" : " disabled") + ' title="' + esc(tit) + '">' + (curta ? '<small class="et">' + esc(et.c) + '</small>' : '') + '<b>' + esc(txt) + '</b>' + (curta ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
}
function renderAte(anim){
  var F = S.fx;
  if($("#fxBusca").value !== F.busca) $("#fxBusca").value = F.busca;
  opcoesAnalista($("#fxAna"), F.ana); opcoesTrib($("#fxTrib"), F.trib);
  $$("#fxFaixa button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-f") === F.faixa); });
  var base = empresasControle(), lista = listaAte();
  var emDia = lista.filter(function(e){ return resumoAte(e).faixa === 0; }).length;
  $("#fxCont").textContent = lista.length + (lista.length !== base.length ? " de " + base.length : "") + " empresas · " + emDia + " em dia · fechamento de " + compCurta(compEmFechamento());
  var vazio = !lista.length ? '<div class="vazio">' + (base.length ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? "Nenhuma empresa no controle." : "Carregando…") + '</div>' : '';
  var ids = []; lista.forEach(function(e){ var ent = entrada(compPendencia(e), e.id); if(ent.e) Object.keys(ent.e).forEach(function(k){ if(ent.e[k][2]) ids.push(ent.e[k][2]); }); }); buscarNomes(ids);
  var cartoes = matchMedia("(max-width:700px)").matches;
  $("#fxTab").hidden = cartoes; $("#fxCards").hidden = !cartoes;
  var pendTxt = function(e){
    var c = compPendencia(e), ent = entrada(c, e.id), pode = podeMarcar(e);
    if(!ent.pend) return pode ? '<button type="button" class="pend-btn" data-pend-ate data-comp="' + c + '">+ pendência</button>' : '';
    var d = diasParado(ent);
    return '<button type="button" class="pend-btn tem" data-pend-ate data-comp="' + c + '"' + (pode ? '' : ' disabled') + ' title="' + esc(ent.pend + " · " + compRot(c)) + '">' + esc(ent.pend) + '</button><span class="parado' + (d > 30 ? ' velho' : '') + '">' + (d ? d + (d === 1 ? ' dia' : ' dias') : 'hoje') + (ent.cobr && ent.cobr.length ? ' · ' + ent.cobr.length + ' cobr.' : '') + '</span>';
  };
  if(cartoes){
    $("#fxCards").innerHTML = vazio + lista.slice(0, 200).map(function(e){
      var r = resumoAte(e), pode = podeMarcar(e);
      return '<div class="cartao ' + FAIXA_CLS[r.faixa] + '" data-emp="' + esc(e.id) + '"><div class="cartao-top"><button type="button" class="nome" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="atr">' + (r.faixa === "ni" && !r.ate ? "falta informar" : rotAtraso(r.meses)) + '</span></div>' +
        '<span class="sub">' + esc(e.analista || "sem analista") + ' · fechado até ' + esc(r.ate ? compCurta(r.ate) : "—") + '</span>' +
        '<div class="ate-grade">' + ETAPAS.map(function(et){ return celAte(e, et.k, pode, true); }).join("") + '</div>' +
        '<div class="cartao-pend">' + pendTxt(e) + '</div></div>';
    }).join("") + (lista.length > 200 ? '<p class="note" style="padding:10px">Mostrando 200 de ' + lista.length + '. Use a busca ou os filtros.</p>' : '');
    animarLinhas($("#fxCards"), anim);
    return;
  }
  var html = '<thead><tr><th>Empresa</th>' + ETAPAS.map(function(et){ return '<th class="et" title="' + esc(et.l) + ' concluída até">' + esc(et.c) + '</th>'; }).join("") + '<th>Fechado até</th><th>Aguardando cliente</th><th></th></tr></thead><tbody>';
  if(vazio) html += '<tr><td colspan="' + (ETAPAS.length + 4) + '">' + vazio + '</td></tr>';
  html += lista.map(function(e){
    var r = resumoAte(e), pode = podeMarcar(e), tb = TRIB[e.trib];
    return '<tr data-emp="' + esc(e.id) + '"><td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="sub">' + esc(e.analista || "sem analista") + (e.apoio ? " / " + esc(e.apoio) : "") + (tb ? ' · <span class="chip">' + esc(tb.c) + '</span>' : '') + '</span></td>' +
      ETAPAS.map(function(et){ return '<td class="et ate-td">' + celAte(e, et.k, pode) + '</td>'; }).join("") +
      '<td class="fech-ate ' + FAIXA_CLS[r.faixa] + '"><i></i><b>' + esc(r.ate ? compCurta(r.ate) : r.faixa === "ni" ? "falta informar" : rotAte("")) + '</b><span class="sub">' + (r.faixa === "ni" && !r.ate ? "sem registro" : rotAtraso(r.meses)) + '</span></td>' +
      '<td class="pend-td">' + pendTxt(e) + '</td>' +
      '<td>' + (pode && r.falta.concat(r.ni).length ? '<button type="button" class="fbtn" data-tudo-ate title="Concluir todas as etapas até um mês">Tudo até…</button>' : '') + '</td></tr>';
  }).join("") + '</tbody>';
  $("#fxTab").innerHTML = html;
  animarLinhas($("#fxTab"), anim);
}
// Concluir uma etapa (ou todas) até um mês: marca de uma vez as competências que faltavam, com "Desfazer".
function avancarAte(e, keys, alvo){
  var antes = {}, novos = {}, n = 0;
  compsControle().forEach(function(c){
    if(c > alvo || !naComp(e, c)) return;
    var mud = {};
    keys.forEach(function(k){ if(!etapaAplica(e, k)) return; var s0 = stEtapa(entrada(c, e.id), e, k); if(s0 !== "c" && s0 !== "n") mud[k] = "c"; });
    if(!Object.keys(mud).length) return;
    antes[c] = JSON.parse(JSON.stringify(entrada(c, e.id)));
    novos[c] = marcarEtapas(c, e, mud).ent; n += Object.keys(mud).length;
  });
  var cs = Object.keys(novos).sort();
  if(!cs.length){ toast("Nada a marcar até " + compCurta(alvo) + "."); return; }
  renderTudo(true);
  cs.reduce(function(p, c){ return p.then(function(){ return salvarCompEntrada(c, e.id, novos[c]); }); }, Promise.resolve()).then(function(){
    toast("“" + e.nome + "”: " + (keys.length > 1 ? "todas as etapas" : ETAPAS.filter(function(x){ return x.k === keys[0]; })[0].l) + " concluída" + (keys.length > 1 ? "s" : "") + " até " + compCurta(alvo) + ".", "Desfazer", function(){
      cs.reduce(function(p, c){ return p.then(function(){ return salvarCompEntrada(c, e.id, antes[c]); }); }, Promise.resolve());
    });
  }, function(){});
}
function menuAte(alvo, e, keys){
  var fim = fimEmp(e); if(!fim) return;
  var desde = keys.map(function(k){ return ateEtapa(e, k); }).filter(function(a){ return a !== "NA"; });
  var menor = desde.length ? desde.reduce(function(a, b){ return a < b ? a : b; }) : fim;
  var de = menor ? compShift(menor, 1) : inicioControle(), ops = [];
  for(var c = fim; c >= de && ops.length < 24; c = compShift(c, -1)) ops.push(c);
  var nome = keys.length > 1 ? "Todas as etapas" : ETAPAS.filter(function(x){ return x.k === keys[0]; })[0].l;
  abrirPop(alvo, '<div class="info" style="border:0;margin:0;padding:2px 8px 6px">' + esc(e.nome) + ' · ' + esc(nome) + '</div>' +
    (ops.length ? ops.map(function(c){ return '<button type="button" data-ate-ok="' + c + '">Concluída até ' + esc(compRot(c)) + '</button>'; }).join("") : '<div class="info">Já está em dia.</div>') +
    '<div class="info"><button type="button" class="linkish" data-ate-mes>Abrir mês a mês</button> para desmarcar ou marcar “em andamento”.</div>', function(p){
    $$("[data-ate-ok]", p).forEach(function(b){ b.onclick = function(){ fecharPop(); avancarAte(e, keys, b.getAttribute("data-ate-ok")); }; });
    $("[data-ate-mes]", p).onclick = function(){ fecharPop(); irPara("fechamento", {"fx.modo":"mes", "fx.comp": abertasDe(e)[0] || compEmFechamento(), "fx.busca": e.nome, "fx.st":"", "fx.ana":""}); };
  });
}
$$("#fxModo button").forEach(function(b){ b.onclick = function(){ S.fx.modo = b.getAttribute("data-m"); salvarPrefs({fxModo:S.fx.modo}); S.fx.sel.clear(); renderTudo(true); }; });
$$("#fxFaixa button").forEach(function(b){ b.onclick = function(){ S.fx.faixa = b.getAttribute("data-f"); renderTudo(true); }; });
window.addEventListener("resize", function(){ if(S.view === "fechamento" && S.fx.modo === "ate") renderTudo(); });
["#fxTab", "#fxCards"].forEach(function(sel){
  $(sel).addEventListener("click", function(ev){
    if(S.fx.modo !== "ate") return;
    var t = ev.target, box = t.closest("[data-emp]"), e = box && S.empresas[box.getAttribute("data-emp")];
    if(!e) return;
    var c = t.closest("button[data-ate]"); if(c){ ev.stopPropagation(); menuAte(c, e, [c.getAttribute("data-ate")]); return; }
    var tu = t.closest("[data-tudo-ate]"); if(tu){ ev.stopPropagation(); menuAte(tu, e, ETAPAS.map(function(x){ return x.k; })); return; }
    var pd = t.closest("[data-pend-ate]"); if(pd){ ev.stopPropagation(); abrirPendencia(pd, pd.getAttribute("data-comp"), e); }
  }, true);
});

/* ============ CARTEIRA ============ */
var SIT_FILTRO = [["clientes","Clientes (ativas, saindo, suspensas)"],["ativa","Ativas"],["saindo","Saindo"],["suspensa","Suspensas"],["encerradas","Saíram, baixadas e falência"],["todas","Todas as situações"]];
function passaSit(e, f){ return f === "todas" || (f === "clientes" ? !!CLIENTE[e.sit] : f === "encerradas" ? !CLIENTE[e.sit] : e.sit === f); }
function sistemas(){ var s = {}; listaEmpresas().forEach(function(e){ if(e.sistema) s[e.sistema] = true; }); return Object.keys(s).sort(); }
function renderCarteira(){
  var C = S.ct, anim = vaiAnimar("carteira");
  if($("#ctBusca").value !== C.busca) $("#ctBusca").value = C.busca;
  opcoesAnalista($("#ctAna"), C.ana); opcoesTrib($("#ctTrib"), C.trib);
  var sis = '<option value="">Todos os sistemas</option>' + sistemas().map(function(s){ return '<option>' + esc(s) + '</option>'; }).join("");
  if($("#ctSis").innerHTML !== sis) $("#ctSis").innerHTML = sis; $("#ctSis").value = C.sis;
  var sit = SIT_FILTRO.map(function(x){ return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join("");
  if($("#ctSit").innerHTML !== sit) $("#ctSit").innerHTML = sit; $("#ctSit").value = C.sit;
  $$("#ctModo button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-m") === C.modo); });
  var todas = listaEmpresas();
  var lista = todas.filter(function(e){
    if(C.ana && norm(e.analista) !== norm(C.ana) && norm(e.apoio) !== norm(C.ana)) return false;
    if(C.trib && e.trib !== C.trib) return false;
    if(C.sis && e.sistema !== C.sis) return false;
    if(!passaSit(e, C.sit)) return false;
    return filtroTexto(e, C.busca);
  });
  $("#ctCont").textContent = lista.length + (lista.length !== todas.length ? " de " + todas.length : "") + " empresas";
  if(C.modo === "grupos"){ renderGrupos(lista); return; }
  var abertas = {}; lista.forEach(function(e){ abertas[e.id] = fimEmp(e) ? resumoAte(e) : null; });
  var chave = {
    nome: function(e){ return norm(e.nome); }, cnpj: function(e){ return cnpjDig(e.cnpj); }, trib: function(e){ return e.trib; }, sistema: function(e){ return norm(e.sistema); },
    analista: function(e){ return norm(e.analista); }, desde: function(e){ return e.desde || "0"; }, sit: function(e){ return e.sit + (e.sitData || ""); }, abertas: function(e){ var r = abertas[e.id]; return r ? (r.faixa === "ni" ? "1" : "2") + pad2(r.meses) : "0"; }
  }[C.ord] || function(e){ return norm(e.nome); };
  lista.sort(function(a, b){ var x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : ordNome(a, b)) * C.dir; });
  C.sel.forEach(function(id){ if(!lista.some(function(e){ return e.id === id; })) C.sel.delete(id); });
  var vis = lista.slice(0, C.limite);
  var th = function(k, l, cls){ return '<th class="ord ' + (cls || "") + '" data-ord="' + k + '">' + l + (C.ord === k ? (C.dir > 0 ? " ▲" : " ▼") : "") + '</th>'; };
  var html = '<thead><tr>' + (S.coord ? '<th style="width:30px"><input type="checkbox" id="ctTodos" aria-label="Selecionar todas as listadas"' + (lista.length && lista.every(function(e){ return C.sel.has(e.id); }) ? " checked" : "") + '></th>' : '') +
    th("nome", "Empresa") + th("cnpj", "CNPJ") + th("trib", "Tributação") + th("sistema", "Sistema") + th("analista", "Analista") + th("desde", "Cliente desde") + th("sit", "Situação") + th("abertas", "Fechado até") + '</tr></thead><tbody>';
  if(!vis.length) html += '<tr><td colspan="9"><div class="vazio">' + (todas.length ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? 'A carteira está vazia. Importe a planilha em <button type="button" class="linkish" data-ir="cadastro">Cadastro</button>.' : "Carregando…") + '</div></td></tr>';
  html += vis.map(function(e){
    var r = abertas[e.id], ok = !e.cnpj || cnpjOk(e.cnpj);
    return '<tr class="' + (CLIENTE[e.sit] ? "" : "fora") + '">' + (S.coord ? '<td><input type="checkbox" class="ctSel" data-id="' + esc(e.id) + '"' + (C.sel.has(e.id) ? " checked" : "") + ' aria-label="Selecionar ' + esc(e.nome) + '"></td>' : '') +
      '<td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button>' + (e.grupo ? ' <span class="chip" title="Grupo econômico">' + esc(e.grupo) + '</span>' : '') + (e.anterior ? '<span class="sub">antiga ' + esc(e.anterior) + '</span>' : '') + '</td>' +
      '<td class="mono" style="font-size:12px; white-space:nowrap' + (ok ? '' : ';color:var(--brand-red)') + '" title="' + (ok ? '' : 'CNPJ não confere (dígito verificador)') + '">' + esc(e.cnpj || "—") + '</td>' +
      '<td>' + esc(TRIB[e.trib] ? TRIB[e.trib].l : "—") + (e.tribAnt ? '<span class="sub">até ' + esc(e.tribMud) + ': ' + esc(TRIB[e.tribAnt].c) + '</span>' : '') + '</td>' +
      '<td>' + esc(e.sistema || "—") + (e.migrado ? '<span class="sub">desde ' + esc(e.migrado) + '</span>' : '') + '</td>' +
      '<td>' + esc(e.analista || "—") + (e.apoio ? '<span class="sub">apoio ' + esc(e.apoio) + '</span>' : '') + '</td>' +
      '<td>' + (e.desde ? dataBR(e.desde) : '<span class="sub">—</span>') + '</td>' +
      '<td>' + (e.sit === "ativa" ? '<span class="sub" style="display:inline">Ativa</span>' : '<span class="pill ' + e.sit + '">' + esc(SIT[e.sit].l) + '</span>') + (e.sitData ? '<span class="sub">' + dataBR(e.sitData) + '</span>' : '') + '</td>' +
      '<td>' + (r ? '<span class="mes ' + FAIXA_CLS[r.faixa] + '" title="' + esc(r.faixa === "ni" && !r.ate ? "Falta informar: " + r.ni.map(function(f){ return f.l; }).join(", ") : "Fechado até " + rotAte(r.ate) + " · " + rotAtraso(r.meses) + (r.falta.length ? " · falta " + r.falta.map(function(f){ return f.c; }).join(", ") : "")) + '">' + esc(r.faixa === "ni" && !r.ate ? "falta informar" : rotAte(r.ate)) + '</span><span class="sub">' + (r.faixa === "ni" && !r.ate ? "" : rotAtraso(r.meses)) + '</span>' : '<span class="sub">—</span>') + '</td></tr>';
  }).join("") + '</tbody>';
  $("#ctTab").innerHTML = html;
  animarLinhas($("#ctTab"), anim);
  $("#ctMais").hidden = lista.length <= C.limite;
  $("#ctMaisBtn").textContent = "Mostrar mais (" + (lista.length - C.limite) + " restantes)";
  var lote = $("#ctLote"), n = C.sel.size;
  lote.hidden = !n || !S.coord;
  if(n && S.coord) lote.innerHTML = '<b>' + n + ' selecionada' + (n === 1 ? '' : 's') + '</b> Transferir para <input list="dlAnalistas" id="ctPara" placeholder="Analista" style="width:200px"><datalist id="dlAnalistas">' + analistas().map(function(a){ return '<option value="' + esc(a) + '">'; }).join("") + '</datalist><button type="button" class="btn" id="ctTransf">Transferir</button><button type="button" class="linkish" id="ctLimpar">Limpar seleção</button>';
}
function renderGrupos(lista){
  var g = {};
  lista.forEach(function(e){ var k = e.grupo || ""; (g[k] = g[k] || []).push(e); });
  var ks = Object.keys(g).filter(Boolean).sort(function(a, b){ return g[b].length - g[a].length || a.localeCompare(b); });
  var html = '<thead><tr><th>Grupo econômico</th><th class="num">Empresas</th><th>Analistas</th><th>Tributações</th></tr></thead><tbody>' + ks.map(function(k){
    var an = {}, tr = {}; g[k].forEach(function(e){ if(e.analista) an[e.analista] = 1; if(e.trib) tr[TRIB[e.trib].c] = (tr[TRIB[e.trib].c] || 0) + 1; });
    return '<tr><td class="emp"><button type="button" data-grupo="' + esc(k) + '">' + esc(k) + '</button><span class="sub">' + esc(g[k].map(function(e){ return e.nome; }).slice(0, 4).join(" · ") + (g[k].length > 4 ? " …" : "")) + '</span></td><td class="num">' + g[k].length + '</td><td>' + esc(Object.keys(an).join(", ")) + '</td><td>' + esc(Object.keys(tr).map(function(t){ return t + " " + tr[t]; }).join(" · ")) + '</td></tr>';
  }).join("") + (g[""] ? '<tr><td colspan="4"><span class="note">' + g[""].length + ' empresa(s) sem grupo econômico.</span></td></tr>' : '') + '</tbody>';
  $("#ctTab").innerHTML = html; $("#ctMais").hidden = true; $("#ctLote").hidden = true;
}
$("#ctBusca").oninput = function(){ S.ct.busca = this.value; S.ct.limite = 100; renderTudo(); };
$("#ctAna").onchange = function(){ S.ct.ana = this.value; renderTudo(true); };
$("#ctTrib").onchange = function(){ S.ct.trib = this.value; renderTudo(true); };
$("#ctSis").onchange = function(){ S.ct.sis = this.value; renderTudo(true); };
$("#ctSit").onchange = function(){ S.ct.sit = this.value; renderTudo(true); };
$$("#ctModo button").forEach(function(b){ b.onclick = function(){ S.ct.modo = b.getAttribute("data-m"); renderTudo(true); }; });
$("#ctMaisBtn").onclick = function(){ S.ct.limite += 100; renderTudo(true); };
$("#ctNova").onclick = function(){ abrirFicha(null); };
$("#v-carteira").addEventListener("click", function(ev){
  var t = ev.target;
  var o = t.closest("th[data-ord]"); if(o){ var k = o.getAttribute("data-ord"); if(S.ct.ord === k) S.ct.dir *= -1; else { S.ct.ord = k; S.ct.dir = 1; } renderTudo(true); return; }
  var g = t.closest("[data-grupo]"); if(g){ S.ct.busca = g.getAttribute("data-grupo"); S.ct.modo = "lista"; renderTudo(true); return; }
  if(t.id === "ctLimpar"){ S.ct.sel.clear(); renderTudo(true); return; }
  if(t.id === "ctTransf"){
    var para = titulo($("#ctPara").value.trim());
    if(!para){ $("#ctPara").focus(); toast("Escreva o nome do analista."); return; }
    var lista = Array.from(S.ct.sel).map(function(id){ return S.empresas[id]; }).filter(Boolean);
    confirmar("Transferir " + lista.length + " empresa" + (lista.length === 1 ? "" : "s") + " para " + para + "?", "Transferir").then(function(ok){
      if(!ok) return;
      salvarEmpresas(lista.map(function(e){ var x = Object.assign({}, e, {analista:para}); if(norm(x.apoio) === norm(para)) x.apoio = ""; return x; })).then(function(){ toast(lista.length + " empresa(s) transferida(s) para " + para + "."); });
      S.ct.sel.clear();
    });
  }
});
$("#v-carteira").addEventListener("change", function(e){
  var t = e.target;
  if(t.id === "ctTodos"){ $$(".ctSel").forEach(function(c){ if(t.checked) S.ct.sel.add(c.getAttribute("data-id")); else S.ct.sel.delete(c.getAttribute("data-id")); }); renderTudo(true); }
  else if(t.classList.contains("ctSel")){ if(t.checked) S.ct.sel.add(t.getAttribute("data-id")); else S.ct.sel.delete(t.getAttribute("data-id")); renderTudo(true); }
});

/* ============ FICHA DA EMPRESA ============ */
var fichaId = null;
function abrirFicha(id){
  var e = id ? S.empresas[id] : null;
  if(id && !e) return;
  if(!e && !S.coord){ toast("Só a coordenação cadastra empresas."); return; }
  fichaId = e ? e.id : null;
  var x = e || normEmp({sit:"ativa"}, "");
  var pode = S.coord || (e && minha(e));
  var dis = pode ? "" : " disabled";
  var optTrib = function(v, vazio){ return '<option value="">' + vazio + '</option>' + TRIBS.map(function(t){ return '<option value="' + t.k + '"' + (t.k === v ? " selected" : "") + '>' + esc(t.l) + '</option>'; }).join(""); };
  var dp = S.dpPorCnpj[cnpjDig(x.cnpj)];
  var hist = "";
  if(e){
    var cs = compsControle().filter(function(c){ return c <= compAtual() && naComp(e, c); }).slice(-12);
    var ra = resumoAte(e);
    hist = cs.length ? '<p class="note" style="margin-bottom:8px">Fechado até <b>' + esc(ra.faixa === "ni" && !ra.ate ? "falta informar" : ra.ate ? compRot(ra.ate) : rotAte("")) + '</b>' + (fimEmp(e) ? ' · ' + esc(ra.faixa === "ni" && !ra.ate ? "falta informar" : rotAtraso(ra.meses) + " de atraso") : '') + '</p>' +
      '<div class="tlq" style="grid-template-columns:110px repeat(' + cs.length + ', minmax(0,1fr))"><span></span>' + cs.map(function(c){ return '<span class="h">' + esc(compCurta(c)) + '</span>'; }).join("") +
      ETAPAS.map(function(et){
        return '<span class="r">' + esc(et.c) + '</span>' + cs.map(function(c){
          var ent = entrada(c, e.id), st = stEtapa(ent, e, et.k), v = ent.e && ent.e[et.k];
          var cl = st === "c" ? "ok" : st === "n" ? "na" : st === "a" ? "and" : (compAtrasada(c) ? "atr" : "ab");
          var t = { ok:"concluída", na:"não se aplica", and:"em andamento", atr:"atrasada", ab:"em aberto" }[cl];
          return '<span class="q ' + cl + '" title="' + esc(et.l + " · " + compRot(c) + ": " + t + (infoMarca(v) ? " · " + infoMarca(v) : "")) + '"></span>';
        }).join("");
      }).join("") + '</div>' +
      cs.filter(function(c){ return entrada(c, e.id).pend; }).map(function(c){ var en = entrada(c, e.id); return '<p class="note" style="margin-top:6px">Aguardando o cliente (' + esc(compCurta(c)) + '): <b>' + esc(en.pend) + '</b> · parado há ' + diasParado(en) + ' dias' + (en.cobr && en.cobr.length ? ' · ' + en.cobr.length + ' cobrança(s)' : '') + '</p>'; }).join("")
      : '<p class="note">Nenhuma competência controlada para esta empresa ainda.</p>';
    var anos = [String(hoje().getFullYear() - 1), String(hoje().getFullYear())];
    var obs = [];
    anos.forEach(function(a){ (S.cfg.anuais || []).forEach(function(d){ if(obrigAplica(e, d, a)){ var s = stObrig(a, e, d.k); obs.push(esc(d.l) + " " + a + ": <b>" + esc(s === "c" ? "entregue" : s === "a" ? "em andamento" : s === "n" ? "não se aplica" : "pendente") + "</b> (até " + dataBR(ymd(prazoAnual(d, a))) + ")"); } }); });
    hist += '<div class="leg-f" style="margin-top:8px"><span><i class="q ok"></i>concluída</span><span><i class="q and"></i>em andamento</span><span><i class="q atr"></i>atrasada</span><span><i class="q ab"></i>em aberto</span><span><i class="q na"></i>não se aplica</span></div>' +
      '<p class="note" style="margin-top:8px">' + (obs.length ? obs.join(" · ") : "Sem obrigações anuais aplicáveis.") + '</p>';
  }
  var dpTxt = dp ? '<p class="note">No DP: <b>' + dp.ativos + ' funcionário' + (dp.ativos === 1 ? '' : 's') + ' ativo' + (dp.ativos === 1 ? '' : 's') + '</b>' + (dp.resp ? ' · responsável ' + esc(dp.resp) : '') + (pode && dp.ativos === 0 && !x.semFolha ? ' · <button type="button" class="linkish" id="fSugFolha">marcar “sem folha”</button>' : '') + '</p>' : (x.cnpj ? '<p class="note">Empresa não encontrada no módulo do DP pelo CNPJ.</p>' : '');
  $("#dlgFicha").innerHTML = '<div class="dlg-head"><h2>' + esc(e ? e.nome : "Nova empresa") + '</h2>' + (e ? '<span class="pill ' + e.sit + '">' + esc(SIT[e.sit].l) + '</span>' : '') + '<button type="button" class="x" id="fFechar" aria-label="Fechar">✕</button></div>' +
    '<form class="dlg-body" id="fForm" novalidate>' +
      (pode ? '' : '<p class="note">Só o analista da empresa ou a coordenação altera esta ficha.</p>') +
      '<div class="campos">' +
        '<label class="campo largo">Empresa<input name="nome" required maxlength="160" value="' + esc(x.nome === "Sem nome" ? "" : x.nome) + '"' + dis + '></label>' +
        '<label class="campo">CNPJ<input name="cnpj" maxlength="20" value="' + esc(x.cnpj) + '" placeholder="00.000.000/0000-00"' + dis + '></label>' +
        '<label class="campo">Nome anterior<input name="anterior" maxlength="160" value="' + esc(x.anterior) + '"' + dis + '></label>' +
        '<label class="campo">Grupo econômico<input name="grupo" maxlength="60" value="' + esc(x.grupo) + '"' + dis + '></label>' +
        '<label class="campo">Cliente desde<input type="date" name="desde" value="' + esc(x.desde) + '"' + dis + '></label>' +
        '<label class="campo">Tributação<select name="trib"' + dis + '>' + optTrib(x.trib, "—") + '</select></label>' +
        '<label class="campo">Tributação anterior<select name="tribAnt"' + dis + '>' + optTrib(x.tribAnt, "nenhuma") + '</select></label>' +
        '<label class="campo">Mudou em (mês/ano)<input name="tribMud" maxlength="7" placeholder="05/2026" value="' + esc(x.tribMud) + '"' + dis + '></label>' +
        '<label class="campo">Sistema<input name="sistema" list="dlSis" maxlength="40" value="' + esc(x.sistema) + '"' + dis + '><datalist id="dlSis">' + sistemas().map(function(s){ return '<option value="' + esc(s) + '">'; }).join("") + '</datalist></label>' +
        '<label class="campo">Migrado em (mês/ano)<input name="migrado" maxlength="7" placeholder="07/2023" value="' + esc(x.migrado) + '"' + dis + '></label>' +
        '<label class="campo">Analista<input name="analista" list="dlAna" maxlength="60" value="' + esc(x.analista) + '"' + (S.coord ? "" : " disabled title=\"Só a coordenação transfere a empresa\"") + '><datalist id="dlAna">' + analistas().map(function(a){ return '<option value="' + esc(a) + '">'; }).join("") + '</datalist></label>' +
        '<label class="campo">Apoio<input name="apoio" list="dlAna" maxlength="60" value="' + esc(x.apoio) + '"' + dis + '></label>' +
        '<label class="campo">Situação<select name="sit"' + dis + '>' + SITS.map(function(s){ return '<option value="' + s.k + '"' + (s.k === x.sit ? " selected" : "") + '>' + esc(s.l) + '</option>'; }).join("") + '</select></label>' +
        '<label class="campo">Data da situação<input type="date" name="sitData" value="' + esc(x.sitData) + '"' + dis + '></label>' +
        '<label class="chk"><input type="checkbox" name="semFolha"' + (x.semFolha ? " checked" : "") + dis + '> Sem folha (Lançamento de folha não se aplica)</label>' +
        '<label class="chk"><input type="checkbox" name="semImob"' + (x.semImob ? " checked" : "") + dis + '> Sem imobilizado (Depreciação não se aplica)</label>' +
        '<label class="campo largo">Contatos<textarea name="contatos" rows="2" maxlength="600"' + dis + '>' + esc(x.contatos) + '</textarea></label>' +
        '<label class="campo largo">Observações<textarea name="obs" rows="2" maxlength="1200"' + dis + '>' + esc(x.obs) + '</textarea></label>' +
      '</div>' + dpTxt +
      (e ? '<div class="ficha-sec"><h3>Fechamento (últimas competências)</h3>' + hist + '</div>' : '') +
    '</form>' +
    '<div class="dlg-acoes">' + (e && S.coord ? '<button type="button" class="linkish red esq" id="fExcluir">Excluir da carteira</button>' : '') + '<button type="button" class="fbtn" id="fCancelar">' + (pode ? "Cancelar" : "Fechar") + '</button>' + (pode ? '<button type="button" class="btn" id="fSalvar">Salvar</button>' : '') + '</div>';
  var d = $("#dlgFicha");
  if(!d.open) d.showModal();
  $("#fFechar").onclick = $("#fCancelar").onclick = function(){ d.close(); };
  if($("#fSugFolha")) $("#fSugFolha").onclick = function(){ $('[name="semFolha"]', d).checked = true; };
  if($("#fSalvar")) $("#fSalvar").onclick = salvarFicha;
  if($("#fExcluir")) $("#fExcluir").onclick = function(){
    confirmar("Excluir “" + e.nome + "” da carteira? O histórico de fechamento fica guardado, mas a empresa some das listas. Para uma empresa que deixou de ser cliente, prefira mudar a Situação.", "Excluir").then(function(ok){
      if(!ok) return; d.close();
      salvarEmpresas([Object.assign({}, e, {excluida:true})]).then(function(){ toast("“" + e.nome + "” excluída da carteira.", "Desfazer", function(){ salvarEmpresas([Object.assign({}, e, {excluida:false})]); }); });
    });
  };
  $("#fForm").onsubmit = function(ev){ ev.preventDefault(); salvarFicha(); };
}
function salvarFicha(){
  var f = $("#fForm").elements, antigo = fichaId ? S.empresas[fichaId] : null;
  var v = function(k){ return f[k].type === "checkbox" ? f[k].checked : f[k].value; };
  var nome = v("nome").trim();
  if(!nome){ f.nome.focus(); toast("Informe o nome da empresa."); return; }
  var mm = function(k){ var s = v(k).trim(); if(s && !/^\d{1,2}\/\d{4}$/.test(s)){ f[k].focus(); toast("Use mês/ano, por exemplo 05/2026."); throw 0; } return s; };
  try{ var tribMud = mm("tribMud"), migrado = mm("migrado"); }catch(x){ return; }
  var dados = normEmp(Object.assign({}, antigo || {criado:new Date().toISOString()}, {
    nome:nome, cnpj:v("cnpj"), anterior:v("anterior"), grupo:v("grupo"), desde:v("desde"), trib:v("trib"), tribAnt:v("tribAnt"), tribMud:tribMud,
    sistema:v("sistema"), migrado:migrado, analista: S.coord ? titulo(v("analista")) : (antigo ? antigo.analista : ""), apoio:titulo(v("apoio")),
    sit:v("sit"), sitData:v("sitData"), semFolha:v("semFolha"), semImob:v("semImob"), contatos:v("contatos"), obs:v("obs")
  }), antigo ? antigo.id : idPara(nome, v("cnpj")));
  var dig = cnpjDig(dados.cnpj);
  var dup = dig && listaEmpresas().find(function(x){ return x.id !== dados.id && cnpjDig(x.cnpj) === dig; });
  if(dup){ toast("Esse CNPJ já é de “" + dup.nome + "”."); f.cnpj.focus(); return; }
  if(!CLIENTE[dados.sit] && !dados.sitData){ toast("Informe a data da situação (" + SIT[dados.sit].l.toLowerCase() + ")."); f.sitData.focus(); return; }
  var seguir = dig && !cnpjOk(dados.cnpj) ? confirmar("O CNPJ " + dados.cnpj + " não confere (dígito verificador). Salvar mesmo assim?", "Salvar") : Promise.resolve(true);
  seguir.then(function(ok){
    if(!ok) return;
    $("#dlgFicha").close();
    salvarEmpresas([dados]).then(function(){ toast(antigo ? "Ficha salva." : "“" + dados.nome + "” cadastrada."); });
  });
}
function idPara(nome, cnpj){
  var d = cnpjDig(cnpj);
  var base = d.length === 14 ? "c" + d : "n" + norm(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  var id = base, i = 2; while(S.empresas[id] && !S.empresas[id].excluida) id = base + "-" + (i++);
  return id || uid();
}

/* ============ PRAZOS ============ */
var OB_ROT = {"":"Pendente", a:"Em andamento", c:"Entregue", n:"Não se aplica"};
function infoOb(v){ if(!v || !v[1]) return ""; var n = nomeDe(v[2]); return OB_ROT[v[0]] + " em " + dataBR(v[1]) + (n ? " por " + n : ""); }
function renderPrazos(){
  var anim = vaiAnimar("prazos");
  var h = hoje(), de = new Date(h), ate = new Date(h); de.setDate(de.getDate() - 10); ate.setDate(ate.getDate() + 75);
  var vs = vencimentosImpostos(de, ate).sort(function(a, b){ return a.data - b.data || a.def.l.localeCompare(b.def.l); });
  $("#przImp").innerHTML = vs.length ? vs.map(function(v){
    var c = contagem(v.data), chave = v.def.k + "|" + v.comp, aberto = !!S.pz.abertos[chave];
    var mine = S.eu ? v.pendentes.filter(minha).length : 0;
    var seg = '<span class="fseg" title="' + v.feitas + ' com guia enviada · ' + v.apuradas + ' só apuradas · ' + (v.emps.length - v.feitas - v.apuradas) + ' pendentes">' +
      (v.feitas ? '<i class="ok" style="flex:' + v.feitas + '"></i>' : '') + (v.apuradas ? '<i class="ap" style="flex:' + v.apuradas + '"></i>' : '') + (v.emps.length - v.feitas - v.apuradas > 0 ? '<i style="flex:' + (v.emps.length - v.feitas - v.apuradas) + '"></i>' : '') + '</span>';
    var linha = '<div class="imp-item' + (aberto ? ' aberto' : '') + '">' + diaBox(v.data) + '<span style="min-width:0"><span class="dp-cell-main" style="display:block">' + esc(v.def.l) + '</span><span class="dp-cell-sub" style="display:block; white-space:normal">competência ' + esc(compCurta(v.comp)) + ' · ' + v.emps.length + ' empresa' + (v.emps.length === 1 ? '' : 's') + ' · ' + v.feitas + ' com guia enviada' + (v.apuradas ? ' · ' + v.apuradas + ' só apurada' + (v.apuradas === 1 ? '' : 's') : '') + (mine ? ' · <b style="color:var(--ink)">' + mine + ' sua' + (mine === 1 ? '' : 's') + ' pendente' + (mine === 1 ? '' : 's') + '</b>' : '') + '</span></span>' +
      (v.emps.length ? seg : '') +
      '<span class="cd ' + (v.pendentes.length ? c.c : "ok") + '">' + (v.pendentes.length ? c.t : "tudo enviado") + '</span>' +
      (v.emps.length ? '<button type="button" class="fbtn' + (aberto ? ' on' : '') + '" data-pz="' + esc(chave) + '" aria-expanded="' + aberto + '">' + (aberto ? "Fechar" : "Marcar") + '</button>' : '<span></span>') + '</div>';
    if(aberto){
      var es = v.emps.slice().sort(function(a, b){ return (minha(b) ? 1 : 0) - (minha(a) ? 1 : 0) || (v.pendentes.indexOf(b) !== -1) - (v.pendentes.indexOf(a) !== -1) || ordNome(a, b); });
      linha += '<div class="imp-ck"><table class="tbl pz-ck"><thead><tr><th>Empresa</th><th>Analista</th><th class="cx">Apurado</th><th class="cx">Guia enviada</th><th class="cx">Não se aplica</th></tr></thead><tbody>' + es.map(function(e){
        var s0 = stImp(v.comp, e, v.def.k), pode = podeMarcar(e), d = pode ? "" : " disabled";
        var bt = function(val, on){ return '<button type="button" class="qd' + (on ? ' on' : '') + '" data-imp="' + val + '" data-emp="' + esc(e.id) + '" data-comp="' + v.comp + '" data-def="' + esc(v.def.k) + '"' + d + ' aria-pressed="' + on + '">' + (on ? "✓" : "") + '</button>'; };
        return '<tr' + (s0 === "e" || s0 === "n" ? ' class="feito"' : '') + '><td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button></td><td>' + esc(e.analista || "—") + '</td><td class="cx">' + bt("a", s0 === "a" || s0 === "e") + '</td><td class="cx">' + bt("e", s0 === "e") + '</td><td class="cx">' + bt("n", s0 === "n") + '</td></tr>';
      }).join("") + '</tbody></table></div>';
    }
    return linha;
  }).join("") : '<div class="empty-mini" style="padding:12px 14px">Nenhum vencimento de imposto entre ' + dataBR(ymd(de)) + ' e ' + dataBR(ymd(ate)) + '.</div>';

  // obrigações anuais
  var O = S.ob, anoAtual = h.getFullYear();
  if(!O.ano) O.ano = String(anoAtual - 1);
  if(O.ana === null && S.eu) O.ana = S.eu;
  var ano = O.ano, defs = S.cfg.anuais || [];
  $("#anoRot").textContent = "Ano-calendário " + ano;
  $("#anoAnt").disabled = +ano <= anoAtual - 6; $("#anoProx").disabled = +ano >= anoAtual;
  $("#przAnoSub").textContent = "entregas em " + (+ano + 1) + " · cada analista marca as suas";
  if($("#obBusca").value !== O.busca) $("#obBusca").value = O.busca;
  opcoesAnalista($("#obAna"), O.ana || "");
  $$("#obSt button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-st") === O.st); });
  var base = listaEmpresas().filter(function(e){ return defs.some(function(d){ return obrigAplica(e, d, ano); }); });
  var lista = base.filter(function(e){
    if(O.ana && norm(e.analista) !== norm(O.ana) && norm(e.apoio) !== norm(O.ana)) return false;
    if(!filtroTexto(e, O.busca)) return false;
    if(O.st === "abertas" && !defs.some(function(d){ if(!obrigAplica(e, d, ano)) return false; var s = stObrig(ano, e, d.k); return s !== "c" && s !== "n"; })) return false;
    return true;
  }).sort(ordNome);
  $("#obCont").textContent = lista.length + (lista.length !== base.length ? " de " + base.length : "") + " empresas";
  var ids = []; lista.forEach(function(e){ var a = S.anos[ano] && S.anos[ano][e.id]; if(a) Object.keys(a).forEach(function(k){ if(a[k] && a[k][2]) ids.push(a[k][2]); }); });
  buscarNomes(ids);
  var html = '<thead><tr><th>Empresa</th>' + defs.map(function(d){
    var ap = base.filter(function(e){ return obrigAplica(e, d, ano) && stObrig(ano, e, d.k) !== "n"; });
    var ok = ap.filter(function(e){ return stObrig(ano, e, d.k) === "c"; }).length;
    var c = contagem(prazoAnual(d, ano));
    return '<th class="et" style="width:120px" title="' + esc(d.l + " do ano-calendário " + ano + ": prazo " + dataBR(ymd(prazoAnual(d, ano))) + " (" + c.t + ")") + '">' + esc(d.l) + '<span class="sub" style="font-weight:500">até ' + esc(dataBR(ymd(prazoAnual(d, ano))).slice(0, 5)) + ' · ' + ok + '/' + ap.length + '</span></th>';
  }).join("") + '</tr></thead><tbody>';
  if(!lista.length) html += '<tr><td colspan="' + (defs.length + 1) + '"><div class="vazio">' + (base.length ? "Nenhuma empresa com esses filtros." : S.carregou.empresas ? "Nenhuma empresa com obrigação anual em " + ano + "." : "Carregando…") + '</div></td></tr>';
  html += lista.slice(0, O.limite).map(function(e){
    var pode = podeMarcar(e), tb = TRIB[tribNaComp(e, ano + "-12")], a = (S.anos[ano] && S.anos[ano][e.id]) || {};
    return '<tr data-emp="' + esc(e.id) + '"><td class="emp"><button type="button" data-ficha="' + esc(e.id) + '">' + esc(e.nome) + '</button><span class="sub">' + esc(e.analista || "sem analista") + (tb ? ' · <span class="chip">' + esc(tb.c) + '</span>' : '') + '</span></td>' +
      defs.map(function(d){
        if(!obrigAplica(e, d, ano)) return '<td class="et"><span class="sub" title="Não se aplica a esta tributação">—</span></td>';
        var s = stObrig(ano, e, d.k);
        return '<td class="et">' + stCell(s, 'data-ob="' + esc(d.k) + '"', pode, d.l + " " + ano + ": " + (infoOb(a[d.k]) || OB_ROT[s]) + (pode ? "" : " · só o analista da empresa ou a coordenação marca")) + '</td>';
      }).join("") + '</tr>';
  }).join("") + (lista.length > O.limite ? '<tr><td colspan="' + (defs.length + 1) + '"><div class="mais" style="border:0"><button type="button" class="fbtn" data-ob-mais>Mostrar mais (' + (lista.length - O.limite) + ' restantes)</button></div></td></tr>' : '') + '</tbody>';
  $("#obTab").innerHTML = html;
  animarLinhas($("#obTab"), anim);
}
$("#anoAnt").onclick = function(){ S.ob.ano = String(+S.ob.ano - 1); renderTudo(true); };
$("#anoProx").onclick = function(){ S.ob.ano = String(+S.ob.ano + 1); renderTudo(true); };
$("#obBusca").oninput = function(){ S.ob.busca = this.value; S.ob.limite = 100; renderTudo(); };
$("#obAna").onchange = function(){ S.ob.ana = this.value; S.ob.limite = 100; renderTudo(true); };
$$("#obSt button").forEach(function(b){ b.onclick = function(){ S.ob.st = b.getAttribute("data-st"); renderTudo(true); }; });
$("#v-prazos").addEventListener("click", function(ev){
  var t = ev.target;
  if(t.closest("[data-ob-mais]")){ S.ob.limite += 100; renderTudo(true); return; }
  var pz = t.closest("[data-pz]"); if(pz){ var k = pz.getAttribute("data-pz"); S.pz.abertos[k] = !S.pz.abertos[k]; renderTudo(true); return; }
  var bi = t.closest("[data-imp]");
  if(bi){
    var em = S.empresas[bi.getAttribute("data-emp")], comp = bi.getAttribute("data-comp"), dk = bi.getAttribute("data-def"), val = bi.getAttribute("data-imp");
    if(!em || !podeMarcar(em)) return;
    var atual = stImp(comp, em, dk), novo;
    // Guia enviada implica apurado; desmarcar "apurado" volta a pendente.
    if(val === "a") novo = atual === "a" || atual === "e" ? "" : "a";
    else if(val === "e") novo = atual === "e" ? "a" : "e";
    else novo = atual === "n" ? "" : "n";
    var ent = JSON.parse(JSON.stringify(entrada(comp, em.id))); ent.v = ent.v || {};
    if(novo) ent.v[dk] = [novo, ymd(hoje()), S.meId || ""]; else delete ent.v[dk];
    salvarCompEntrada(comp, em.id, ent);
    return;
  }
  var b = t.closest("button[data-ob]"), tr = t.closest("tr[data-emp]"), e = tr && S.empresas[tr.getAttribute("data-emp")];
  if(b && e){
    var k2 = b.getAttribute("data-ob"), ano = S.ob.ano, atual = (S.anos[ano] && S.anos[ano][e.id]) || {};
    menuStatus(b, stObrig(ano, e, k2), OB_ROT, infoOb(atual[k2]), function(s){
      var novo = JSON.parse(JSON.stringify(atual));
      if(s) novo[k2] = [s, ymd(hoje()), S.meId || ""]; else delete novo[k2];
      var m = {}; m[e.id] = novo; salvarAno(ano, m);
    });
  }
});

/* ============ CADASTRO: importar ============ */
var CAB = ["Empresa","Nome anterior","CNPJ","Grupo","Cliente desde","Sistema","Migrado em","Tributação","Tributação anterior","Mudou em","Analista","Apoio","Situação","Data da situação","Observações","Contatos","Sem folha","Sem imobilizado","ID"];
var CAMPO_CAB = {"empresa":"nome","empresas":"nome","nome anterior":"anterior","cnpj":"cnpj","grupo":"grupo","grupo economico":"grupo","cliente desde":"desde","inicio":"desde","sistema":"sistema","migrado em":"migrado","tributacao":"trib","tributacao anterior":"tribAnt","mudou em":"tribMud","analista":"analista","apoio":"apoio","situacao":"sit","data da situacao":"sitData","observacoes":"obs","contatos":"contatos","sem folha":"semFolha","sem imobilizado":"semImob","id":"id",
  "financeiro ate":"pFin","fiscal ate":"pFis","folha ate":"pFol","balancete ate":"pBal","pendencia do cliente":"pendCli",
  "1. financeiro":"pFin","2 fiscal":"pFis","3 folha":"pFol","4 balancete":"pBal"};
// Célula de data: número de série do Excel, dd/mm/aaaa, aaaa-mm-dd ou o erro comum dd/mmaaaa.
function dataCel(v){
  if(typeof v === "number" && v > 0){ var p = XLSX.SSF.parse_date_code(v); return p ? p.y + "-" + pad2(p.m) + "-" + pad2(p.d) : ""; }
  var s = String(v || "").trim(), m;
  if((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + "-" + m[2] + "-" + m[3];
  if((m = /^(\d{1,2})[\/.](\d{1,2})[\/.]?(\d{4})$/.exec(s))) return m[3] + "-" + pad2(+m[2]) + "-" + pad2(+m[1]);
  return "";
}
function mesCel(v){
  if(typeof v === "number" && v > 0){ var d = dataCel(v); return d ? d.slice(5, 7) + "/" + d.slice(0, 4) : ""; }
  var m = /^(\d{1,2})[\/.](\d{4})$/.exec(String(v || "").trim()); return m ? pad2(+m[1]) + "/" + m[2] : "";
}
function simCel(v){ return /^(s|sim|x|1|true|verdadeiro)$/i.test(String(v == null ? "" : v).trim()); }
var SIS_ANTIGO = {"DOMINIO":"Domínio","DOMÍNIO":"Domínio","DOMINO":"Domínio","CONEXOS":"Conexos","ATHENAS CLIENTE":"Athenas (do cliente)","SANKYA":"Sankhya","ALTERDATA":"Alterdata","PROTHEUS":"Protheus"};
// Planilha antiga: situação, nome anterior e mudança de tributação vêm escritos no nome; amarelo = saiu.
function linhaAntiga(nomeBruto, amarela){
  var nome = String(nomeBruto || "").replace(/\s+/g, " ").trim(), r = {sit:"ativa", sitData:"", anterior:"", tribAnt:"", tribMud:"", obs:[], rev:[]}, m;
  var dataTxt = function(s){ var a = /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(s); if(a) return {d: a[3] + "-" + pad2(+a[2]) + "-" + pad2(+a[1]), exata:true}; a = /(\d{1,2})[.\/](\d{4})/.exec(s); return a ? {d: a[2] + "-" + pad2(+a[1]) + "-01", exata:false} : {d:"", exata:false}; };
  if((m = /\(\s*ANTIGA\s+([^)]*?)\s*\)/i.exec(nome) || /-\s*ANTIGA\s+(.+)$/i.exec(nome))){ r.anterior = m[1].trim(); nome = (nome.slice(0, m.index) + nome.slice(m.index + m[0].length)).trim(); }
  if((m = /SAIU\s+(?:DO\s+)?SIMPLES\s*([\d.\/]*)/i.exec(nome))){ var dt = dataTxt(m[1]); r.tribAnt = "simples"; r.tribMud = dt.d ? dt.d.slice(5, 7) + "/" + dt.d.slice(0, 4) : ""; r.obs.push("Saiu do Simples" + (m[1] ? " em " + m[1] : "")); nome = nome.slice(0, m.index).trim(); }
  if((m = /-?\s*SAIU EM ([\d.\/]+) E VOLTOU M[ÊE]S ([\d.\/]+)/i.exec(nome))){ r.obs.push("Saiu em " + m[1] + " e voltou em " + m[2]); nome = nome.slice(0, m.index).trim(); }
  var pads = [[/BAIXADA/, "baixada"], [/SUSPEN[SÇ][ÃA]O\s+TEMPOR[ÁA]RIA(?:\s+(?:EM|DIA))?/, "suspensa"], [/ABRIU\s+FAL[ÊE]NCIA(?:\s+EM)?/, "falencia"], [/SAIU(?:\s+EM)?/, "saiu"]];
  for(var i = 0; i < pads.length; i++){
    var re = new RegExp("[-\\s]*" + pads[i][0].source + "\\s*([\\d./]*)", "i");
    if((m = re.exec(nome))){
      var d2 = dataTxt(m[1]); r.sit = pads[i][1]; r.sitData = d2.d;
      if(r.sit === "saiu" && d2.d && parseYmd(d2.d) > hoje()) r.sit = "saindo";
      if(d2.d && !d2.exata) r.rev.push("data da situação só com mês/ano");
      nome = nome.slice(0, m.index).trim(); break;
    }
  }
  if(/\bINAPTA\b/i.test(nome)){ r.obs.push("CNPJ inapto"); nome = nome.replace(/\s*\bINAPTA\b/i, "").trim(); }
  nome = nome.replace(/\s*-\s*$/, "").trim();
  if(r.sit === "ativa" && amarela){ r.sit = "saiu"; r.rev.push("linha amarela sem data de saída"); }
  r.nome = nome;
  return r;
}
function lerCarteira(wb){
  var nomes = wb.SheetNames.slice().sort(function(a, b){ return (norm(b) === "carteira") - (norm(a) === "carteira"); });
  for(var s = 0; s < nomes.length; s++){
    var ws = wb.Sheets[nomes[s]]; if(!ws || !ws["!ref"]) continue;
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:""});
    for(var hr = 0; hr < Math.min(rows.length, 6); hr++){
      var cab = rows[hr].map(function(c){ return norm(c); });
      var iNome = cab.indexOf("empresa") !== -1 ? cab.indexOf("empresa") : cab.indexOf("empresas");
      if(iNome === -1) continue;
      var antiga = cab.indexOf("empresas") !== -1 && cab.indexOf("situacao") === -1;
      var col = {}; cab.forEach(function(c, i){ if(CAMPO_CAB[c] && !(CAMPO_CAB[c] in col)) col[CAMPO_CAB[c]] = i; });
      var out = [];
      for(var r = hr + 1; r < rows.length; r++){
        var lin = rows[r], g = function(k){ return k in col ? lin[col[k]] : ""; };
        var nomeBruto = String(g("nome") || "").trim(); if(!nomeBruto) continue;
        var cel0 = ws[XLSX.utils.encode_cell({r:r, c:iNome})] || {};
        var x = {linha: r + 1, rev: [], obs: []};
        if(antiga){
          var am = !!(cel0.s && cel0.s.fgColor && /FFFF00$/i.test(cel0.s.fgColor.rgb || ""));
          var a = linhaAntiga(nomeBruto, am);
          x.nome = a.nome; x.anterior = a.anterior; x.sit = a.sit; x.sitData = a.sitData; x.tribAnt = a.tribAnt; x.tribMud = a.tribMud; x.obs = a.obs; x.rev = a.rev;
          var sis = String(g("sistema") || "").replace(/\s+/g, " ").trim().toUpperCase(), mm = /^(.+?)\s*\((\d{2})\/(\d{4})\)$/.exec(sis);
          if(mm){ sis = mm[1]; x.migrado = mm[2] + "/" + mm[3]; }
          x.sistema = SIS_ANTIGO[sis] || titulo(sis);
          var an = String(g("analista") || "").replace(/\s+/g, " ").trim().split("/").map(function(p){ return p.trim(); }).filter(Boolean);
          x.analista = titulo(an[0] || ""); x.apoio = titulo(an[1] || "");
          if(cel0.c && cel0.c.length) x.contatos = String(cel0.c[0].t || "").split("\n").map(function(t){ return t.trim(); }).filter(function(t){ return t && !/:$/.test(t); }).join(" ");
        } else {
          x.nome = nomeBruto; x.anterior = String(g("anterior") || "").trim();
          x.sit = "sit" in col ? sitDeTexto(g("sit")) : "ativa"; x.sitData = dataCel(g("sitData"));
          x.tribAnt = tribDeTexto(g("tribAnt")); x.tribMud = mesCel(g("tribMud")); x.migrado = mesCel(g("migrado"));
          x.sistema = String(g("sistema") || "").trim(); x.analista = titulo(String(g("analista") || "").trim()); x.apoio = titulo(String(g("apoio") || "").trim());
          x.contatos = String(g("contatos") || "").trim(); var ob = String(g("obs") || "").trim(); if(ob) x.obs.push(ob);
          if("semFolha" in col) x.semFolha = simCel(g("semFolha"));
          if("semImob" in col) x.semImob = simCel(g("semImob"));
          x.id = String(g("id") || "").trim();
        }
        x.grupo = String(g("grupo") || "").replace(/\s+/g, " ").trim();
        x.desde = dataCel(g("desde"));
        var tv = g("trib"); x.trib = tribDeTexto(tv); if(String(tv).trim() && !x.trib) x.rev.push("tributação “" + String(tv).trim() + "” não reconhecida");
        var cv = String(g("cnpj") || "").trim(); x.cnpj = cv;
        if(!cnpjDig(cv)) x.rev.push("sem CNPJ"); else if(!cnpjOk(cv)) x.rev.push("CNPJ não confere");
        x.temSit = antiga ? x.sit !== "ativa" : "sit" in col;
        // andamento do fechamento (planilha de controle): mês até onde cada grupo está concluído; SM = sem movimento
        var pg = function(k){ if(!(k in col)) return ""; var v = g(k); return String(v).trim().toUpperCase() === "SM" ? "SM" : mesCel(v); };
        x.prog = {fin:pg("pFin"), fis:pg("pFis"), fol:pg("pFol"), bal:pg("pBal")};
        if(x.prog.fol === "SM") x.semFolha = true;
        x.pendCli = String(g("pendCli") || "").replace(/\s+/g, " ").trim();
        x.temProg = ["pFin", "pFis", "pFol", "pBal"].some(function(k){ return k in col; });
        out.push(x);
      }
      return {aba: nomes[s], antiga: antiga, linhas: out};
    }
  }
  return null;
}
// Junta a planilha à carteira: mesmo ID, mesmo CNPJ ou mesmo nome (atual ou anterior) = mesma empresa.
function planejarImport(res){
  var todas = Object.keys(S.empresas).map(function(k){ return S.empresas[k]; });
  // o nome atual tem preferência sobre o nome anterior de outra empresa
  var porCnpj = {}, porNome = {}, porAnt = {};
  todas.forEach(function(e){ var d = cnpjDig(e.cnpj), k = norm(e.nome), a = norm(e.anterior); if(d.length === 14 && !porCnpj[d]) porCnpj[d] = e; if(k && !porNome[k]) porNome[k] = e; if(a && !porAnt[a]) porAnt[a] = e; });
  var acharNome = function(n){ var k = norm(n); return k ? porNome[k] || porAnt[k] || null : null; };
  var novas = [], muda = [], iguais = 0, avisos = [], vistos = {}, novosIds = {};
  res.linhas.forEach(function(x){
    var d = cnpjDig(x.cnpj);
    var chaveDup = d.length === 14 ? d : "n" + norm(x.nome);
    if(vistos[chaveDup]){ avisos.push("Linha " + x.linha + ": “" + x.nome + "” repete a linha " + vistos[chaveDup] + " (ignorada)."); return; }
    vistos[chaveDup] = x.linha;
    var e = (x.id && S.empresas[x.id]) || (d.length === 14 && porCnpj[d]) || acharNome(x.nome) || acharNome(x.anterior) || null;
    var base = e ? Object.assign({}, e) : {criado: new Date().toISOString()};
    ["nome","anterior","cnpj","grupo","desde","sistema","migrado","trib","tribAnt","tribMud","analista","apoio","contatos"].forEach(function(k){ if(x[k]) base[k] = x[k]; });
    if(x.obs.length){ var o = x.obs.join("; "); if(!e || norm(e.obs).indexOf(norm(o)) === -1) base.obs = e && e.obs ? e.obs + "\n" + o : o; }
    // situação: só muda quando a planilha diz qual é (a planilha antiga não mostra as baixadas em vermelho)
    if(x.temSit || !e){ base.sit = x.sit; base.sitData = x.sitData || (e && x.sit === e.sit ? e.sitData : ""); }
    if("semFolha" in x) base.semFolha = x.semFolha;
    // etapas que a planilha deixou em branco: "falta informar" (diferente de atrasada)
    if(x.temProg) base.semInfo = ETAPAS.filter(function(et){ return !x.prog[ETAPA_PROG[et.k]]; }).map(function(et){ return et.k; });
    if("semImob" in x) base.semImob = x.semImob;
    if(e && e.excluida) base.excluida = false;
    var id = e ? e.id : idPara(x.nome, x.cnpj);
    while(!e && novosIds[id]) id = id + "-" + x.linha;
    novosIds[id] = true;
    var n = normEmp(base, id);
    x.eid = id; x.emp = n;
    if(!CLIENTE[n.sit] && !n.sitData) x.rev.push("situação “" + SIT[n.sit].l + "” sem data");
    if(x.rev.length) avisos.push("Linha " + x.linha + " · " + x.nome + ": " + x.rev.join(", ") + ".");
    if(!e){ novas.push(n); return; }
    var dif = ["nome","anterior","cnpj","grupo","desde","sistema","migrado","trib","tribAnt","tribMud","analista","apoio","sit","sitData","semFolha","semImob","contatos","obs","excluida","semInfo"].filter(function(k){ return JSON.stringify(e[k]) !== JSON.stringify(n[k]); });
    if(dif.length) muda.push({antes:e, depois:n, dif:dif}); else iguais++;
  });
  return {novas:novas, muda:muda, iguais:iguais, avisos:avisos};
}
// Andamento do fechamento vindo da planilha: Financeiro → Financeiro; Fiscal → Conferência fiscal e Impostos;
// Folha → Lançamento de folha; Balancete → Depreciação e Conciliação. Só preenche o que ainda não está marcado.
var ETAPA_PROG = {fin:"fin", fisc:"fis", imp:"fis", folha:"fol", depr:"bal", conc:"bal"};
function mmComp(m){ return m && m !== "SM" ? m.slice(3) + "-" + m.slice(0, 2) : ""; }
function inicioSugerido(linhas){
  var min = "";
  linhas.forEach(function(x){ if(!x.prog) return; ["fin","fis","fol","bal"].forEach(function(k){ var c = mmComp(x.prog[k]); if(c && (!min || c < min)) min = c; }); });
  if(!min) return "";
  // começa no mês seguinte ao fechamento mais antigo, mas nunca antes de janeiro do ano corrente
  var sug = compShift(min, 1), lim = compAtual().slice(0, 4) + "-01";
  return sug < lim ? lim : sug;
}
function planejarAndamento(linhas, inicio){
  var comps = {}, nEmp = 0, nMarcas = 0, nPend = 0, ate = "", fim = compAtual(), fech = compEmFechamento();
  linhas.forEach(function(x){
    if(!x.eid || !x.emp || !x.prog) return;
    var e = x.emp, tem = false, pendPosta = false;
    for(var c = inicio; c <= fim; c = compShift(c, 1)){
      if(!clienteNaComp(e, c)) continue;
      var ent = JSON.parse(JSON.stringify((comps[c] && comps[c][x.eid]) || entrada(c, x.eid))); ent.e = ent.e || {};
      var mudou = false;
      ETAPAS.forEach(function(et){
        var pv = x.prog[ETAPA_PROG[et.k]], sm = pv === "SM" && et.k !== "folha" && c <= fech;
        var wm = mmComp(pv);
        if(!sm && (!wm || wm < c)) return;
        if(!etapaAplica(e, et.k)) return;
        var s0 = ent.e[et.k] && ent.e[et.k][0];
        if(s0 === "c" || s0 === "n") return;
        ent.e[et.k] = [sm ? "n" : "c", "", "planilha"]; mudou = true; nMarcas++; if(c > ate) ate = c;
      });
      var aberta = ETAPAS.some(function(et){ if(!etapaAplica(e, et.k)) return false; var s1 = ent.e[et.k] && ent.e[et.k][0]; return s1 !== "c" && s1 !== "n"; });
      // a pendência do cliente vai para a primeira competência ainda aberta
      if(aberta && !pendPosta && c <= fech){ pendPosta = true; if(x.pendCli && !ent.pend){ ent.pend = x.pendCli.slice(0, 200); ent.pendEm = ymd(hoje()); mudou = true; nPend++; } }
      if(mudou){ (comps[c] = comps[c] || {})[x.eid] = ent; tem = true; }
    }
    if(tem) nEmp++;
  });
  return {comps:comps, nEmp:nEmp, nMarcas:nMarcas, nPend:nPend, ate:ate};
}
var planoImp = null;
$("#impArq").onchange = function(){ $("#impLer").disabled = !this.files.length || !S.coord; $("#impRes").hidden = true; planoImp = null; };
$("#impLer").onclick = function(){
  var f = $("#impArq").files[0], box = $("#impRes"); if(!f) return;
  if(typeof XLSX === "undefined"){ toast("O leitor de planilhas não carregou. Confira a conexão e recarregue a página."); return; }
  if(!S.carregou.empresas){ toast("Aguarde a carteira carregar."); return; }
  box.hidden = false; box.innerHTML = '<span class="note">Lendo…</span>';
  f.arrayBuffer().then(function(buf){
    var wb = XLSX.read(new Uint8Array(buf), {type:"array", cellStyles:true});
    var res = lerCarteira(wb);
    if(!res || !res.linhas.length){ box.innerHTML = '<div class="aviso erro"><div>Não encontrei a lista de empresas. A planilha precisa de uma coluna <b>Empresa</b> (ou <b>EMPRESAS</b>, na planilha antiga) na primeira linha.</div></div>'; return; }
    planoImp = planejarImport(res);
    var p = planoImp, sitN = {};
    p.novas.concat(p.muda.map(function(m){ return m.depois; })).forEach(function(e){ sitN[e.sit] = (sitN[e.sit] || 0) + 1; });
    var temProg = res.linhas.some(function(x){ return x.prog && (x.prog.fin || x.prog.fis || x.prog.fol || x.prog.bal); });
    var sug = temProg ? inicioSugerido(res.linhas) : "";
    var oferece = sug && sug < inicioControle();
    var and = temProg ? planejarAndamento(res.linhas, oferece ? sug : inicioControle()) : null;
    var nSM = res.linhas.filter(function(x){ return x.prog && x.prog.fol === "SM"; }).length;
    var ROT = {nome:"nome",anterior:"nome anterior",cnpj:"CNPJ",grupo:"grupo",desde:"cliente desde",sistema:"sistema",migrado:"migração",trib:"tributação",tribAnt:"tributação anterior",tribMud:"mudança de tributação",analista:"analista",apoio:"apoio",sit:"situação",sitData:"data da situação",semFolha:"sem folha",semImob:"sem imobilizado",contatos:"contatos",obs:"observações",excluida:"volta à carteira",semInfo:"etapas sem informação"};
    var andHtml = function(a, ini){ return a ? '<li>Fechamento: <b>' + a.nMarcas + '</b> etapa' + (a.nMarcas === 1 ? '' : 's') + ' concluída' + (a.nMarcas === 1 ? '' : 's') + ' em ' + a.nEmp + ' empresa' + (a.nEmp === 1 ? '' : 's') + (a.ate ? ', de ' + esc(compCurta(ini)) + ' a ' + esc(compCurta(a.ate)) : '') + (a.nPend ? ' · ' + a.nPend + ' pendência' + (a.nPend === 1 ? '' : 's') + ' do cliente' : '') + (nSM ? ' · ' + nSM + ' sem folha (SM)' : '') + '</li>' : ''; };
    var podeImportar = p.novas.length || p.muda.length || (and && and.nMarcas);
    box.innerHTML = '<div><b>' + esc(f.name) + '</b> · aba “' + esc(res.aba) + '” · ' + res.linhas.length + ' linhas' + (res.antiga ? ' · formato antigo' : '') + '</div>' +
      '<ul><li><b>' + p.novas.length + '</b> empresa' + (p.novas.length === 1 ? '' : 's') + ' nova' + (p.novas.length === 1 ? '' : 's') + '</li><li><b>' + p.muda.length + '</b> já cadastrada' + (p.muda.length === 1 ? '' : 's') + ' com alteração</li><li>' + p.iguais + ' sem mudança</li>' +
      (Object.keys(sitN).length ? '<li>Situações: ' + SITS.filter(function(s){ return sitN[s.k]; }).map(function(s){ return s.l + " " + sitN[s.k]; }).join(" · ") + '</li>' : '') + '<span id="impAnd">' + andHtml(and, oferece ? sug : inicioControle()) + '</span></ul>' +
      (oferece ? '<label class="chk"><input type="checkbox" id="impInicio" checked> Começar o controle em ' + esc(compRot(sug)) + ' (hoje começa em ' + esc(compRot(inicioControle())) + '). Assim os meses de ' + esc(sug.slice(0, 4)) + ' que ainda não fecharam aparecem como atrasados.</label>' : '') +
      (res.antiga ? '<div class="aviso"><div>Na planilha antiga as empresas baixadas estão só com o nome em vermelho, e essa cor não é lida aqui. Prefira importar a planilha limpa (Contabil-real.xlsx); se usar esta, as empresas já cadastradas mantêm a situação que têm.</div></div>' : '') +
      (p.muda.length ? '<details><summary>Ver alterações (' + p.muda.length + ')</summary><ul>' + p.muda.slice(0, 200).map(function(m){ return '<li>' + esc(m.depois.nome) + ': ' + esc(m.dif.map(function(k){ return ROT[k] || k; }).join(", ")) + '</li>'; }).join("") + '</ul></details>' : '') +
      (p.avisos.length ? '<details><summary>Conferir depois (' + p.avisos.length + ')</summary><ul>' + p.avisos.slice(0, 300).map(function(a){ return '<li>' + esc(a) + '</li>'; }).join("") + '</ul></details>' : '') +
      (podeImportar ? '<div style="display:flex; gap:8px"><button type="button" class="btn" id="impOk">Importar</button><button type="button" class="fbtn" id="impCancelar">Cancelar</button></div>' : '<span class="note">Nada a importar: a carteira já está igual à planilha.</span>');
    if($("#impInicio")) $("#impInicio").onchange = function(){ var ini = this.checked ? sug : inicioControle(); and = planejarAndamento(res.linhas, ini); $("#impAnd").innerHTML = andHtml(and, ini); };
    if($("#impOk")) $("#impOk").onclick = function(){
      var lista = planoImp.novas.concat(planoImp.muda.map(function(m){ return m.depois; })), n = planoImp.novas.length, a = planoImp.muda.length;
      var usarSug = !!($("#impInicio") && $("#impInicio").checked);
      planoImp = null; box.innerHTML = '<span class="note">Gravando a carteira…</span>';
      var feito = null;
      Promise.resolve(lista.length ? salvarEmpresas(lista) : null).then(function(){
        if(usarSug){ var c = JSON.parse(JSON.stringify(S.cfg)); c.inicio = sug; return salvarCfg(c); }
      }).then(function(){
        if(!temProg) return;
        var ini = inicioControle(), a2 = planejarAndamento(res.linhas, ini), cs = Object.keys(a2.comps).sort();
        feito = {a:a2, ini:ini};
        return cs.reduce(function(pr, c, i){ return pr.then(function(){ box.innerHTML = '<span class="note">Gravando o fechamento… ' + compRot(c) + ' (' + (i + 1) + ' de ' + cs.length + ')</span>'; return salvarCompVarias(c, a2.comps[c]); }); }, Promise.resolve());
      }).then(function(){
        box.innerHTML = '<div class="aviso"><div><b>Importação concluída.</b> ' + n + ' empresa' + (n === 1 ? '' : 's') + ' nova' + (n === 1 ? '' : 's') + ' e ' + a + ' atualizada' + (a === 1 ? '' : 's') + (feito ? '; ' + feito.a.nMarcas + ' etapas de fechamento marcadas como concluídas' : '') + '. <button type="button" class="linkish" data-ir="fechamento">Ver o fechamento</button> · <button type="button" class="linkish" data-ir="carteira">Ver a carteira</button></div></div>';
        $("#impArq").value = ""; $("#impLer").disabled = true;
        if(!S.eu && S.nomeConta){ S.eu = casarNome(S.nomeConta); if(S.eu){ S.fx.ana = S.eu; renderTudo(); } }
      }, function(){ box.innerHTML = '<div class="aviso erro"><div>A importação não foi salva por inteiro. Tente de novo: o que já foi gravado não é duplicado.</div></div>'; });
    };
    if($("#impCancelar")) $("#impCancelar").onclick = function(){ planoImp = null; box.hidden = true; };
  }).catch(function(err){ console.error(err); box.innerHTML = '<div class="aviso erro"><div>Não consegui ler esse arquivo. Confira se é uma planilha .xlsx ou .xls.</div></div>'; });
};

/* ============ CADASTRO: backup ============ */
function salvarArquivo(nome, bytes){
  return usarCap("downloads").then(function(dl){
    if(!dl){ throw {code:"unavailable"}; }
    var P = noPai();
    // dentro do Hub, o pedido e os bytes precisam ser objetos da página principal
    if(P){ var pedido = P.JSON.parse(JSON.stringify({filename:nome})), u = new P.Uint8Array(bytes.length); u.set(bytes); pedido.data = new P.Blob([u]); return dl.save(pedido); }
    return dl.save({filename:nome, data:new Blob([bytes])});
  });
}
$("#bkBaixar").onclick = function(){
  var msg = $("#bkRes");
  if(typeof XLSX === "undefined"){ msg.textContent = "O gerador de planilhas não carregou. Recarregue a página."; return; }
  var todas = Object.keys(S.empresas).map(function(k){ return S.empresas[k]; }).filter(function(e){ return !e.excluida; }).sort(ordNome);
  var dt = function(s){ return s ? dataBR(s) : ""; };
  var cart = [CAB].concat(todas.map(function(e){ return [e.nome, e.anterior, e.cnpj, e.grupo, dt(e.desde), e.sistema, e.migrado, TRIB[e.trib] ? TRIB[e.trib].l : "", TRIB[e.tribAnt] ? TRIB[e.tribAnt].l : "", e.tribMud, e.analista, e.apoio, SIT[e.sit].l, dt(e.sitData), e.obs, e.contatos, e.semFolha ? "Sim" : "", e.semImob ? "Sim" : "", e.id]; }));
  var fech = [["Competência","Empresa","CNPJ","Analista"].concat(ETAPAS.map(function(et){ return et.l; })).concat(["Fechada em","Pendência do cliente","Pendência desde"])];
  Object.keys(S.comps).sort().forEach(function(c){
    Object.keys(S.comps[c]).forEach(function(id){
      var e = S.empresas[id], ent = S.comps[c][id]; if(!e) return;
      fech.push([c.slice(5) + "/" + c.slice(0, 4), e.nome, e.cnpj, e.analista].concat(ETAPAS.map(function(et){ var v = ent.e && ent.e[et.k]; return v && v[0] ? ST_ROT[v[0]] + (v[1] ? " " + dataBR(v[1]) : "") : (etapaAplica(e, et.k) ? "" : "Não se aplica"); })).concat([dt(ent.fechadaEm), ent.pend || "", dt(ent.pendEm)]));
    });
  });
  var defs = S.cfg.anuais || [];
  var obr = [["Ano-calendário","Empresa","CNPJ","Analista"].concat(defs.map(function(d){ return d.l; }))];
  Object.keys(S.anos).sort().forEach(function(a){
    Object.keys(S.anos[a]).forEach(function(id){
      var e = S.empresas[id], x = S.anos[a][id]; if(!e) return;
      obr.push([a, e.nome, e.cnpj, e.analista].concat(defs.map(function(d){ var v = x[d.k]; return v && v[0] ? OB_ROT[v[0]] + (v[1] ? " " + dataBR(v[1]) : "") : ""; })));
    });
  });
  var wb = XLSX.utils.book_new();
  var larg = function(ws, ws2){ ws["!cols"] = ws2.map(function(w){ return {wch:w}; }); return ws; };
  XLSX.utils.book_append_sheet(wb, larg(XLSX.utils.aoa_to_sheet(cart), [40,24,20,14,12,16,10,22,18,9,18,14,12,14,30,30,9,9,18]), "Carteira");
  XLSX.utils.book_append_sheet(wb, larg(XLSX.utils.aoa_to_sheet(fech), [11,40,20,18].concat(ETAPAS.map(function(){ return 20; })).concat([12,30,13])), "Fechamento");
  XLSX.utils.book_append_sheet(wb, larg(XLSX.utils.aoa_to_sheet(obr), [13,40,20,18].concat(defs.map(function(){ return 20; }))), "Obrigações");
  // "Fechado até": uma linha por empresa, no formato da planilha de controle
  limparCacheAte();
  var fa = [["Empresa","CNPJ","Analista"].concat(ETAPAS.map(function(et){ return et.l + " até"; })).concat(["Fechado até","Atraso (meses)","Aguardando cliente","Cobranças"])];
  empresasControle().sort(ordNome).forEach(function(e){
    var r = resumoAte(e), en = entrada(compPendencia(e), e.id);
    var mm = function(a){ return a === "NA" ? "não se aplica" : a ? a.slice(5) + "/" + a.slice(0, 4) : ""; };
    fa.push([e.nome, e.cnpj, e.analista].concat(ETAPAS.map(function(et){ var a = ateEtapa(e, et.k); return a === "" && semInfo(e, et.k) ? "falta informar" : mm(a); })).concat([r.ate ? mm(r.ate) : "", r.faixa === "ni" && !r.ate ? "" : r.meses, en.pend || "", (en.cobr || []).map(dataBR).join(", ")]));
  });
  XLSX.utils.book_append_sheet(wb, larg(XLSX.utils.aoa_to_sheet(fa), [40,20,18].concat(ETAPAS.map(function(){ return 16; })).concat([13,10,40,24])), "Fechado até");
  // impostos: apurado / guia enviada por competência
  var imp = [["Competência","Imposto","Empresa","CNPJ","Analista","Situação","Marcado em"]], ROT_IMP = {a:"Apurado", e:"Guia enviada", n:"Não se aplica"};
  Object.keys(S.comps).sort().forEach(function(c){ Object.keys(S.comps[c]).forEach(function(id){ var e = S.empresas[id], v = S.comps[c][id].v; if(!e || !v) return; Object.keys(v).forEach(function(k){ var d = (S.cfg.impostos || []).filter(function(x){ return x.k === k; })[0]; imp.push([c.slice(5) + "/" + c.slice(0, 4), d ? d.l : k, e.nome, e.cnpj, e.analista, ROT_IMP[v[k][0]] || v[k][0], dt(v[k][1])]); }); }); });
  XLSX.utils.book_append_sheet(wb, larg(XLSX.utils.aoa_to_sheet(imp), [11,34,40,20,18,14,12]), "Impostos");
  var bytes = new Uint8Array(XLSX.write(wb, {bookType:"xlsx", type:"array"}));
  msg.textContent = "Preparando…";
  salvarArquivo("contabil-backup-" + ymd(hoje()) + ".xlsx", bytes).then(function(){
    msg.textContent = "Backup salvo: " + todas.length + " empresas, " + (fech.length - 1) + " linhas de fechamento.";
  }, function(err){
    var c = err && err.code;
    msg.textContent = c === "declined" ? "Download cancelado." : c === "rate_limited" ? "Já há um download esperando confirmação." : c === "unavailable" || c === "not_granted" ? "Este modo de visualização não permite baixar arquivos." : "Não foi possível gerar o arquivo (" + (c || "erro") + ").";
  });
};

/* ============ CADASTRO: configurações ============ */
var cfgDesenhado = "";
function opcDia(v, comUltimo){ return (comUltimo ? '<option value="ultimo_util"' + (v === "ultimo_util" ? " selected" : "") + '>Último dia útil</option>' : '') + Array.from({length:31}, function(_, i){ return '<option value="' + (i + 1) + '"' + (+v === i + 1 ? " selected" : "") + '>Dia ' + (i + 1) + '</option>'; }).join(""); }
function renderCadastro(){
  $("#impArq").disabled = !S.coord;
  $("#impLer").disabled = !S.coord || !$("#impArq").files.length;
  var chave = JSON.stringify([S.cfg, S.coord]);
  if(chave === cfgDesenhado) return;
  cfgDesenhado = chave;
  var dis = S.coord ? "" : " disabled", c = S.cfg;
  $("#cfgBox").innerHTML =
    (S.coord ? '' : '<p class="note">Só a coordenação altera estas configurações.</p>') +
    '<label class="campo" style="max-width:260px">Início do controle (competência)<input type="month" id="cfgIni" value="' + esc(inicioControle()) + '"' + dis + '></label>' +
    '<p class="note" style="margin-top:-8px">Competências anteriores não aparecem no Fechamento nem contam como atrasadas.</p>' +
    '<div class="cfg-sec"><h3>Vencimento dos impostos <small>mês seguinte à competência</small></h3><div class="cfg-grid"><span class="h">Imposto</span><span class="h">Dia</span><span class="h">Se não for dia útil</span>' +
      (c.impostos || []).map(function(d, i){ return '<span>' + esc(d.l) + '<span class="sub">' + esc(d.tribs.map(function(t){ return TRIB[t] ? TRIB[t].c : t; }).join(", ")) + (d.per === "trimestral" ? " · trimestral" : "") + '</span></span><select data-imp-dia="' + i + '"' + dis + '>' + opcDia(d.dia, true) + '</select><select data-imp-regra="' + i + '"' + dis + (d.dia === "ultimo_util" ? " hidden" : "") + '><option value="prorroga"' + (d.regra === "prorroga" ? " selected" : "") + '>Próximo dia útil</option><option value="antecipa"' + (d.regra === "antecipa" ? " selected" : "") + '>Dia útil anterior</option><option value="exato"' + (d.regra === "exato" ? " selected" : "") + '>Mantém a data</option></select>'; }).join("") +
    '</div></div>' +
    '<div class="cfg-sec"><h3>Obrigações anuais <small>entregues no ano seguinte ao ano-calendário</small></h3><div class="cfg-grid"><span class="h">Obrigação</span><span class="h">Mês</span><span class="h">Dia</span>' +
      (c.anuais || []).map(function(d, i){ return '<span>' + esc(d.l) + '<span class="sub">' + esc(d.tribs.map(function(t){ return TRIB[t] ? TRIB[t].c : t; }).join(", ")) + '</span></span><select data-an-mes="' + i + '"' + dis + '>' + MESES.map(function(m, k){ return '<option value="' + (k + 1) + '"' + (+d.mes === k + 1 ? " selected" : "") + '>' + m + '</option>'; }).join("") + '</select><select data-an-dia="' + i + '"' + dis + '>' + opcDia(d.dia, true) + '</select>'; }).join("") +
    '</div></div>' +
    (S.coord ? '<div style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" class="btn" id="cfgSalvar">Salvar configurações</button><button type="button" class="fbtn" id="cfgPadrao">Voltar ao padrão</button></div>' : '');
}
$("#cfgBox").addEventListener("change", function(e){
  var t = e.target, i = t.getAttribute("data-imp-dia");
  if(i != null){ var r = $('[data-imp-regra="' + i + '"]'); if(r) r.hidden = t.value === "ultimo_util"; }
});
$("#cfgBox").addEventListener("click", function(e){
  if(e.target.id === "cfgPadrao"){
    confirmar("Voltar os vencimentos e o início do controle ao padrão?", "Voltar ao padrão").then(function(ok){ if(ok){ cfgDesenhado = ""; salvarCfg(JSON.parse(JSON.stringify(PRAZOS_PADRAO))).then(function(){ toast("Configurações no padrão."); }); } });
    return;
  }
  if(e.target.id !== "cfgSalvar") return;
  var c = JSON.parse(JSON.stringify(S.cfg));
  var ini = $("#cfgIni").value;
  if(ini && !/^\d{4}-\d{2}$/.test(ini)){ toast("Escolha o mês de início."); return; }
  if(ini > compAtual()){ toast("O início do controle não pode ser depois do mês atual."); return; }
  c.inicio = ini;
  var dia = function(v){ return v === "ultimo_util" ? v : +v; };
  (c.impostos || []).forEach(function(d, k){ d.dia = dia($('[data-imp-dia="' + k + '"]').value); d.regra = d.dia === "ultimo_util" ? "" : $('[data-imp-regra="' + k + '"]').value; });
  (c.anuais || []).forEach(function(d, k){ d.mes = +$('[data-an-mes="' + k + '"]').value; d.dia = dia($('[data-an-dia="' + k + '"]').value); });
  cfgDesenhado = "";
  salvarCfg(c).then(function(){ toast("Configurações salvas."); });
});

/* ============ início ============ */
(function tema(){
  var raiz = document.documentElement;
  var pintar = function(){ var t = raiz.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); $("#temaBtn").textContent = t === "dark" ? "☀" : "☾"; $("#temaBtn").title = t === "dark" ? "Tema claro (T)" : "Tema escuro (T)"; };
  var trocar = function(){
    // Dentro do Hub, quem troca é o Hub (a barra lateral e esta página acompanham).
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
// Aberto fora do Hub: mostra o botão de voltar sempre (dentro dele, a barra lateral faz esse papel).
(function(){ var solto = true; try{ solto = window.parent === window || !window.parent.__hubFecharModulo; }catch(e){} document.body.classList.toggle("solto", solto); })();
$("#hubBack").onclick = function(e){
  try{
    var P = window.parent;
    if(P !== window && (P.__hubFecharModulo || P.__hubClosePortal)){ e.preventDefault(); (P.__hubFecharModulo || P.__hubClosePortal)(); }
  }catch(x){}
};
window.addEventListener("unhandledrejection", function(e){ if(e.reason && e.reason.ctb) e.preventDefault(); });

function ligarBanco(){
  banco.collection("ctb_emp").onSnapshot(function(snap){
    var m = {};
    snap.docs.forEach(function(d){ S.existe.docs["ctb_emp/" + d.id] = true; var x = d.data() || {}; Object.keys(x).forEach(function(k){ if(x[k] && typeof x[k] === "object") m[k] = normEmp(x[k], k); }); });
    S.empresas = m; S.carregou.empresas = S.carregou.ctb_emp = true;
    if(!S.eu && S.nomeConta){ S.eu = casarNome(S.nomeConta); if(S.eu && !S.fx.ana) S.fx.ana = S.eu; }
    renderTudo();
  }, erroBanco);
  banco.collection("ctb_comp").onSnapshot(function(snap){
    var m = {};
    snap.docs.forEach(function(d){ S.existe.docs["ctb_comp/" + d.id] = true; var c = d.id.split("~")[0], x = d.data() || {}; var alvo = (m[c] = m[c] || {}); Object.keys(x).forEach(function(k){ alvo[k] = x[k]; }); });
    S.comps = m; S.carregou.ctb_comp = true; renderTudo();
  }, erroBanco);
  banco.collection("ctb_ano").onSnapshot(function(snap){
    var m = {};
    snap.docs.forEach(function(d){ S.existe.docs["ctb_ano/" + d.id] = true; var a = d.id.split("~")[0], x = d.data() || {}; var alvo = (m[a] = m[a] || {}); Object.keys(x).forEach(function(k){ alvo[k] = x[k]; }); });
    S.anos = m; S.carregou.ctb_ano = true; renderTudo();
  }, erroBanco);
  banco.doc("ctb_config/cfg").onSnapshot(function(s){
    var x = s.exists ? (s.data() || {}) : {};
    var c = JSON.parse(JSON.stringify(PRAZOS_PADRAO));
    if(typeof x.inicio === "string") c.inicio = x.inicio;
    ["impostos", "anuais"].forEach(function(k){ if(Array.isArray(x[k])) c[k] = c[k].map(function(d){ var y = x[k].find(function(z){ return z && z.k === d.k; }); return y ? Object.assign({}, d, {dia: y.dia, regra: y.regra != null ? y.regra : d.regra, mes: y.mes != null ? y.mes : d.mes}) : d; }); });
    S.cfg = c; renderTudo();
  }, erroBanco);
  banco.collection("dp_empresas").onSnapshot(function(snap){
    var m = {}, h = hoje();
    snap.docs.forEach(function(d){
      var x = d.data() || {}, dg = cnpjDig(x.cnpj); if(dg.length !== 14) return;
      var fs = Array.isArray(x.funcionarios) ? x.funcionarios : [];
      var ativos = fs.filter(function(f){ var r = parseYmd(f && f.rescisao); return f && (f.nome || f.admissao) && (!r || r >= h); }).length;
      m[dg] = {ativos: ativos, resp: String(x.responsavel || "")};
    });
    S.dpPorCnpj = m;
  }, function(){});
}
function erroBanco(err){ console.error(err); toast("Falha ao ler os dados do Hub. Recarregue a página."); }

/* ============ ponte com o assistente do Hub ============ */
window.__assistente = {
  modulo: "contabil", nome: "Contábil",
  abas: [["painel", "Painel"], ["fechamento", "Fechamento"], ["carteira", "Carteira"], ["prazos", "Prazos"], ["cadastro", "Cadastro"]],
  pronto: function(){ return !!S.carregou.empresas; },
  exemplo: function(){ return false; },
  empresas: function(){ return listaEmpresas().map(function(e){ return {id:e.id, nome:e.nome, cnpj:cnpjDig(e.cnpj), analista:e.analista}; }); },
  analistas: function(){ return analistas(); },
  irPara: function(v, o){ if(VIEWS.indexOf(v) === -1) return false; irPara(v, o); return true; },
  abrirEmpresa: function(id){ if(!S.empresas[id]) return false; abrirFicha(id); return true; },
  consultar: function(tipo, p){
    p = p || {};
    var de = parseYmd(p.de) || hoje(), ate = parseYmd(p.ate) || de, ana = p.analista || "";
    var dele = function(e){ return !ana || norm(e.analista) === norm(ana) || norm(e.apoio) === norm(ana); };
    if(tipo === "vencimentos"){
      var vs = vencimentosImpostos(de, ate).concat(vencimentosAnuais(de, ate)).map(function(v){
        var emps = v.emps.filter(dele), pend = v.pendentes.filter(dele);
        return {v: v, n: emps.length, pend: pend.length};
      }).filter(function(x){ return x.n; }).sort(function(a, b){ return a.v.data - b.v.data; });
      return {titulo: "Vencimentos do Contábil, " + dataBR(ymd(de)) + (ymd(ate) !== ymd(de) ? " a " + dataBR(ymd(ate)) : ""), total: vs.length, linhas: vs.map(function(x){
        var v = x.v;
        return {t: v.def.l + (v.tipo === "imp" ? " de " + compCurta(v.comp) : " " + v.ano), sub: dataBR(ymd(v.data)).slice(0, 5) + " · " + (x.pend ? x.pend + " de " + x.n + " empresas pendentes" : "tudo feito (" + x.n + ")"), data: ymd(v.data), tom: x.pend ? (v.data < hoje() ? "late" : "") : "ok", abrir: {aba: "prazos"}};
      })};
    }
    if(tipo === "atrasos"){
      var at = empresasControle().filter(dele).map(function(e){ return {e: e, r: resumoAte(e)}; }).filter(function(x){ return x.r.faixa === 1 || x.r.faixa === 2 || x.r.faixa === 3; }).sort(function(a, b){ return b.r.meses - a.r.meses; });
      return {titulo: "Fechamento atrasado no Contábil", total: at.length, linhas: at.map(function(x){ return {t: x.e.nome, sub: "fechado até " + rotAte(x.r.ate) + " · " + rotAtraso(x.r.meses) + " de atraso" + (x.r.piores.length && x.r.piores.length < ETAPAS.length ? " · mais atrasada: " + x.r.piores.map(function(f){ return f.c; }).join(", ") : ""), tom: x.r.faixa >= 2 ? "late" : "warn", abrir: {empresa: x.e.id}}; }), verTudo: {aba: "fechamento", opts: {"fx.modo": "ate", "fx.faixa": "atras", "fx.ana": ana, "fx.busca": ""}}};
    }
    if(tipo === "pendencias"){
      var cl = empresasControle().filter(dele).filter(function(e){ return !!entrada(compPendencia(e), e.id).pend; });
      return {titulo: "Aguardando o cliente (Contábil)", total: cl.length, linhas: cl.map(function(e){ var c = compPendencia(e), en = entrada(c, e.id); return {t: e.nome, sub: en.pend + " · " + compCurta(c) + " · parado há " + diasParado(en) + " dia(s)", tom: "warn", abrir: {empresa: e.id}}; }), verTudo: {aba: "fechamento", opts: {"fx.modo": "ate", "fx.faixa": "cli", "fx.ana": ana, "fx.busca": ""}}};
    }
    if(tipo === "empresa"){
      var e = S.empresas[p.id]; if(!e) return null;
      var r = resumoAte(e), pend = entrada(compPendencia(e), e.id).pend, ls = [];
      ls.push({t: (TRIB[e.trib] ? TRIB[e.trib].l : "Sem tributação") + (e.grupo ? " · grupo " + e.grupo : ""), sub: [e.analista || "sem analista", e.apoio ? "apoio " + e.apoio : "", SIT[e.sit].l].filter(Boolean).join(" · ")});
      ls.push({t: r.faixa === "ni" && !r.ate ? "Falta informar o andamento" : "Fechado até " + rotAte(r.ate), sub: fimEmp(e) ? rotAtraso(r.meses) + (r.meses ? " de atraso" : "") : "", tom: r.faixa === 0 ? "ok" : r.faixa === "ni" ? "" : r.faixa === 1 ? "warn" : "late", abrir: {empresa: e.id}});
      if(pend) ls.push({t: "Aguardando o cliente: " + pend, sub: "", tom: "warn"});
      return {titulo: e.nome, total: ls.length, linhas: ls, abrirFicha: {empresa: e.id}};
    }
    if(tipo === "carteira"){
      var por = {};
      empresasControle().forEach(function(x){ var a = x.analista || "(sem analista)"; var q = por[a] = por[a] || {n: 0, atr: 0}; q.n++; var f = resumoAte(x).faixa; if(f === 1 || f === 2 || f === 3) q.atr++; });
      var ks = Object.keys(por).filter(function(a){ return !ana || norm(a) === norm(ana); }).sort(function(a, b){ return por[b].n - por[a].n; });
      return {titulo: "Carteira do Contábil", total: ks.length, linhas: ks.map(function(a){ var q = por[a]; return {t: a + ": " + q.n + " empresa" + (q.n === 1 ? "" : "s"), sub: q.atr + " com fechamento atrasado", dados: {analista: a, empresas: q.n, atrasadas: q.atr}, tom: q.atr ? "warn" : "ok", abrir: {aba: "fechamento", opts: {"fx.modo": "ate", "fx.ana": a === "(sem analista)" ? "" : a, "fx.faixa": "", "fx.busca": ""}}}; })};
    }
    if(tipo === "competencia"){
      var comp = /^\d{4}-\d{2}$/.test(p.comp || "") ? p.comp : compEmFechamento(), lsC = [], porA = {};
      empresasControle().filter(function(x){ return naComp(x, comp); }).forEach(function(x){
        var r2 = resumo(x, comp), a2 = x.analista || "(sem analista)", q2 = porA[a2] = porA[a2] || {analista: a2, empresas: 0, fechadas: 0, aguardandoCliente: 0};
        q2.empresas++; if(r2.fechada) q2.fechadas++; else if(r2.pend) q2.aguardandoCliente++;
        if(!r2.fechada && dele(x)) lsC.push({t: x.nome, sub: "falta: " + r2.falta.map(function(f){ return f.l; }).join(", ") + (r2.pend ? " · aguardando cliente: " + r2.pend : ""), tom: r2.pend ? "warn" : compAtrasada(comp) ? "late" : "", abrir: {empresa: x.id}, dados: {analista: x.analista || ""}});
      });
      return {titulo: "Fechamento do Contábil em " + compRot(comp) + ": " + lsC.length + " em aberto", total: lsC.length, linhas: lsC, resumo: Object.keys(porA).map(function(k){ return porA[k]; }), verTudo: {aba: "fechamento", opts: {"fx.modo": "mes", "fx.ana": ana, "fx.busca": ""}}};
    }
    if(tipo === "fechado"){
      var fz = empresasControle().filter(dele).map(function(x){ return {e: x, r: resumoAte(x)}; }).sort(function(a3, b3){ return (b3.r.meses || 0) - (a3.r.meses || 0); });
      return {titulo: "Fechado até, do mais atrasado para o mais em dia", total: fz.length, linhas: fz.map(function(x){ return {t: x.e.nome, sub: "fechado até " + rotAte(x.r.ate) + (x.r.meses ? " · " + rotAtraso(x.r.meses) + " de atraso" : " · em dia"), tom: x.r.faixa === 0 ? "ok" : x.r.faixa === "ni" ? "" : x.r.faixa === 1 ? "warn" : "late", abrir: {empresa: x.e.id}, dados: {analista: x.e.analista || "", meses: x.r.meses || 0}}; }), verTudo: {aba: "fechamento", opts: {"fx.modo": "ate", "fx.ana": ana, "fx.faixa": "", "fx.busca": ""}}};
    }
    if(tipo === "impostos"){
      var vi = vencimentosImpostos(de, ate).sort(function(a3, b3){ return a3.data - b3.data; }), lsI = [];
      vi.forEach(function(v){ var pend = v.pendentes.filter(dele); if(!v.emps.filter(dele).length) return; lsI.push({t: v.def.l + " de " + compCurta(v.comp), sub: dataBR(ymd(v.data)).slice(0, 5) + " · " + (pend.length ? pend.length + " sem guia: " + pend.slice(0, 6).map(function(x){ return x.nome; }).join(", ") + (pend.length > 6 ? "…" : "") : "todas com guia") + " · " + v.apuradas + " apurada(s)", data: ymd(v.data), tom: pend.length ? (v.data < hoje() ? "late" : "") : "ok", abrir: {aba: "prazos"}}); });
      return {titulo: "Impostos do Contábil (apurado / guia enviada)", total: lsI.length, linhas: lsI};
    }
    return null;
  },
  listar: function(){ return listaEmpresas().map(function(e){ var r = fimEmp(e) ? resumoAte(e) : null; return {id:e.id, nome:e.nome, cnpj:cnpjDig(e.cnpj), analista:e.analista || "", apoio: e.apoio || "", tributacao: TRIB[e.trib] ? TRIB[e.trib].l : "", situacao: SIT[e.sit] ? SIT[e.sit].l : "", grupo: e.grupo || "", atraso: !!(r && (r.faixa === 1 || r.faixa === 2 || r.faixa === 3)), mesesAtraso: r ? r.meses || 0 : 0, aguardandoCliente: !!entrada(compPendencia(e), e.id).pend}; }); },
  coord: function(){ return !!S.coord; },
  vocab: function(){ return {etapas: ETAPAS.map(function(x){ return {k:x.k, l:x.l, c:x.c}; }), obrigacoes: [], impostos: (S.cfg.impostos || []).map(function(d){ return {k:d.k, l:d.l}; })}; },
  acao: function(tipo, p){
    p = p || {};
    var e = S.empresas[p.id];
    if(!e) return {erro: "Não achei essa empresa no Contábil."};
    if(!podeMarcar(e)) return {erro: "Você não pode alterar “" + e.nome + "”: ela é da carteira de " + (e.analista || "outra pessoa") + "."};
    var cef = compEmFechamento(), comp = p.comp || (abertasDe(e)[0] || cef);
    var quando = "Competência " + compRot(comp) + (p.comp ? "" : " (a mais antiga em aberto)");
    var guarda = function(fn){ return function(){ return Promise.resolve().then(fn); }; };
    var copia = function(v){ return JSON.parse(JSON.stringify(v)); };
    if(tipo === "etapa" || tipo === "fechar"){
      var antes = copia(entrada(comp, e.id)), m = {}, ls = [];
      if(tipo === "fechar"){
        ETAPAS.forEach(function(et){ var a = stEtapa(antes, e, et.k); if(a !== "n" && a !== "c"){ m[et.k] = "c"; ls.push(et.l + ": " + (ST_ROT[a] || "Pendente") + " → " + ST_ROT.c); } });
        if(!ls.length) return {erro: "“" + e.nome + "” já está fechada em " + compRot(comp) + "."};
      } else {
        var et = ETAPAS.filter(function(x){ return x.k === p.etapa; })[0], st = p.status || "";
        if(!et) return {erro: "Não conheci essa etapa."};
        var at = stEtapa(antes, e, et.k);
        if(at === "n") return {erro: et.l + " não se aplica a “" + e.nome + "”."};
        if(at === st) return {erro: et.l + " já está “" + (ST_ROT[st] || "pendente").toLowerCase() + "” para essa empresa em " + compRot(comp) + "."};
        m[et.k] = st; ls.push(et.l + ": " + (ST_ROT[at] || "Pendente") + " → " + (ST_ROT[st] || "Pendente"));
      }
      return {titulo: tipo === "fechar" ? "Concluir o fechamento" : "Marcar etapa do fechamento", empresa: e.nome, linhas: ls.concat([quando]),
        executar: guarda(function(){ var res = marcarEtapas(comp, e, m); return salvarCompEntrada(comp, e.id, res.ent).then(function(){ return res.fechou ? "Pronto: “" + e.nome + "” fechou " + compRot(comp) + "." : "Pronto, marcado."; }); }),
        desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, antes); })};
    }
    if(tipo === "pendencia"){
      comp = p.comp || compPendencia(e);
      quando = "Competência " + compRot(comp) + (p.comp ? "" : " (a mais antiga em aberto)");
      var ent0 = copia(entrada(comp, e.id)), modo = p.modo || "registrar", ent = copia(ent0), hj = ymd(hoje());
      if(modo === "registrar"){
        var txt = String(p.texto || "").trim().slice(0, 200);
        if(!txt) return {erro: "Diga o que falta o cliente mandar (ex.: “registra pendência na Alfa: extrato do Itaú”)."};
        ent.pendEm = ent0.pend ? (ent0.pendEm || hj) : hj; ent.cobr = ent0.pend ? (ent0.cobr || []) : []; ent.pend = txt;
        var ls2 = ["Aguardando o cliente: “" + txt + "”"]; if(ent0.pend) ls2.push("Substitui: “" + ent0.pend + "”"); ls2.push(quando);
        return {titulo: "Registrar pendência do cliente", empresa: e.nome, linhas: ls2,
          executar: guarda(function(){ return salvarCompEntrada(comp, e.id, ent).then(function(){ return "Pendência registrada."; }); }), desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, ent0); })};
      }
      if(!ent0.pend) return {erro: "“" + e.nome + "” não tem pendência do cliente aberta em " + compRot(comp) + "."};
      if(modo === "recebida"){ ent.pend = ""; ent.pendEm = ""; ent.cobr = []; }
      else { ent.cobr = (ent0.cobr || []).concat([hj]).slice(-20); }
      return {titulo: modo === "recebida" ? "Dar a pendência por recebida" : "Registrar cobrança de hoje", empresa: e.nome, linhas: ["Pendência: “" + ent0.pend + "”", quando],
        executar: guarda(function(){ return salvarCompEntrada(comp, e.id, ent).then(function(){ return modo === "recebida" ? "Pendência encerrada." : "Cobrança registrada."; }); }), desfazer: guarda(function(){ return salvarCompEntrada(comp, e.id, ent0); })};
    }
    if(tipo === "imposto"){
      var def = (S.cfg.impostos || []).filter(function(d){ return d.k === p.imposto; })[0];
      if(!def) return {erro: "Não conheci esse imposto."};
      var ROT = {a: "Apurado", e: "Guia enviada", n: "Não se aplica", "": "Pendente"};
      var val = {apurado: "a", guia: "e", enviada: "e", guia_enviada: "e", na: "n", nao_se_aplica: "n", pendente: ""}[p.valor || "guia"];
      if(val === undefined) val = "e";
      var ini = new Date(hoje()); ini.setDate(ini.getDate() - 150); var fim = new Date(hoje()); fim.setDate(fim.getDate() + 60);
      var vs = vencimentosImpostos(ini, fim).filter(function(v){ return v.def.k === def.k && v.emps.indexOf(e) !== -1 && (!p.comp || v.comp === p.comp); }).sort(function(a3, b3){ return a3.data - b3.data; });
      var alvo = val ? vs.filter(function(v){ var c0 = stImp(v.comp, e, def.k); return c0 !== val && !(val === "a" && c0 === "e"); })[0] : vs.filter(function(v){ return !!stImp(v.comp, e, def.k); }).pop();
      if(!alvo) return {erro: val ? def.l + " de “" + e.nome + "” não tem vencimento pendente" + (p.comp ? " em " + compRot(p.comp) : "") + "." : "Não achei " + def.l + " marcado para desfazer."};
      var cur = stImp(alvo.comp, e, def.k), entI0 = copia(entrada(alvo.comp, e.id)), entI = copia(entI0); entI.v = entI.v || {};
      if(val) entI.v[def.k] = [val, ymd(hoje()), S.meId || ""]; else delete entI.v[def.k];
      return {titulo: "Marcar imposto", empresa: e.nome, linhas: [def.l + " de " + compRot(alvo.comp) + ": " + ROT[cur] + " → " + ROT[val], "Vencimento " + dataBR(ymd(alvo.data))],
        executar: guarda(function(){ return salvarCompEntrada(alvo.comp, e.id, entI).then(function(){ return "Pronto: " + def.l + " de " + compCurta(alvo.comp) + " " + ROT[val].toLowerCase() + "."; }); }),
        desfazer: guarda(function(){ return salvarCompEntrada(alvo.comp, e.id, entI0); })};
    }
    if(tipo === "transferir"){
      if(!S.coord) return {erro: "Só a coordenação transfere empresas entre analistas."};
      var nomes = analistas(), para = String(p.para || "").trim();
      var alvoA = nomes.filter(function(n){ return norm(n) === norm(para); })[0] || nomes.filter(function(n){ return norm(n).split(" ")[0] === norm(para).split(" ")[0]; })[0];
      if(!alvoA) return {erro: "Não conheço o analista “" + para + "” no Contábil."};
      if(norm(alvoA) === norm(e.analista)) return {erro: "“" + e.nome + "” já é de " + alvoA + "."};
      var eT = copia(e), yT = Object.assign({}, e, {analista: alvoA}); if(norm(yT.apoio) === norm(alvoA)) yT.apoio = "";
      return {titulo: "Transferir empresa", empresa: e.nome, linhas: ["Analista no Contábil: " + (e.analista || "—") + " → " + alvoA],
        executar: guarda(function(){ return salvarEmpresas([yT]).then(function(){ return "Pronto: agora é de " + alvoA + "."; }); }), desfazer: guarda(function(){ return salvarEmpresas([eT]); })};
    }
    if(tipo === "observacao"){
      var txO = String(p.texto || "").trim().slice(0, 300);
      if(!txO) return {erro: "Qual observação devo anotar?"};
      var eO = copia(e), yO = Object.assign({}, e, {obs: ((e.obs ? e.obs + "\n" : "") + dataBR(ymd(hoje())).slice(0, 5) + ": " + txO).slice(-1200)});
      return {titulo: "Anotar observação na ficha", empresa: e.nome, linhas: ["“" + txO + "”", "Fica nas observações da ficha do Contábil"],
        executar: guarda(function(){ return salvarEmpresas([yO]).then(function(){ return "Observação anotada."; }); }), desfazer: guarda(function(){ return salvarEmpresas([eO]); })};
    }
    return {erro: "Ainda não sei fazer isso no Contábil."};
  }
};

(function iniciar(){
  var p = lerPrefs();
  if(p.eu) S.eu = p.eu;
  if(p.fxModo === "mes" || p.fxModo === "ate") S.fx.modo = p.fxModo;
  S.fx.ana = S.eu || "";
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
      if(!S.eu && S.carregou.empresas){ S.eu = casarNome(S.nomeConta); if(S.eu && !S.fx.ana) S.fx.ana = S.eu; renderTudo(); }
    });
  });
  var v = ["painel","fechamento","carteira","prazos","cadastro"].indexOf(p.view) !== -1 ? p.view : "painel";
  irPara(v);
})();
})();
