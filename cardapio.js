var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
var WD = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
var now = new Date();
function mondayOf(dt){ var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); var w = d.getDay(); d.setDate(d.getDate() - (w===0 ? 6 : w-1)); return d; }
var weekStart = mondayOf(now);
var data = {}, selected = null, editing = false, confirmDel = false;
var db = null, canWrite = false, loaded = false, saving = false;
var gridEl = document.getElementById("grid"), detailEl = document.getElementById("detail"), statusEl = document.getElementById("status");

function pad(n){ return n<10 ? "0"+n : ""+n; }
function keyOf(dt){ return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate()); }
function esc(t){ return String(t==null?"":t).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function setStatus(t, err){ statusEl.textContent = t; statusEl.className = "status"+(err?" err":""); statusEl.hidden = !t; }
function weekDays(){
  var out = [];
  for (var i=0;i<7;i++){
    var d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+i);
    if (i<5 || data[keyOf(d)]) out.push(d);
  }
  return out;
}

function renderHead(){
  var a = weekStart, b = new Date(a.getFullYear(), a.getMonth(), a.getDate()+4);
  var t = a.getMonth()===b.getMonth()
    ? a.getDate()+" a "+b.getDate()+" de "+MESES[b.getMonth()]
    : a.getDate()+" de "+MESES[a.getMonth()]+" a "+b.getDate()+" de "+MESES[b.getMonth()];
  document.getElementById("title").textContent = "Semana de " + t;
  document.getElementById("today").hidden = keyOf(weekStart) === keyOf(mondayOf(now));
  var n = weekDays().filter(function(d){ var x = data[keyOf(d)]; return x && x.tipo!=="feriado"; }).length;
  document.getElementById("sub").textContent = !loaded ? "" : n ? n+(n===1?" dia":" dias")+" com cardápio · "+b.getFullYear() : "Nenhum cardápio cadastrado nesta semana";
}

function dayCard(d){
  var k = keyOf(d), doc = data[k], w = d.getDay();
  var isToday = keyOf(now)===k, cls = isToday ? " today" : "";
  var head = '<div class="wk-h"><div><div class="wdn">'+WD[w]+'</div></div><div class="dn">'+d.getDate()+'<span class="wdn" style="margin-left:6px">'+MESES[d.getMonth()].slice(0,3)+'</span></div></div>';
  var editBtn = canWrite ? '<button type="button" class="btn btn-sm" data-edit="'+k+'">Editar</button>' : '';
  if (doc && doc.tipo==="feriado")
    return '<article class="wk hol'+cls+'">'+head+'<div class="wk-b"><b>Feriado</b><span>'+esc(doc.nome)+'</span><span class="eyebrow"><i></i>Sem serviço</span><div class="wk-f"><span></span>'+editBtn+'</div></div></article>';
  if (doc)
    return '<article class="wk'+cls+'">'+head+'<div class="wk-b"><dl>'
      + '<div class="main"><dt>Prato principal</dt><dd>'+esc(doc.principal)+'</dd></div>'
      + '<div><dt>Guarnição</dt><dd>'+esc(doc.guarnicao)+'</dd></div>'
      + '<div><dt>Salada</dt><dd>'+esc(doc.salada)+'</dd></div>'
      + '<div><dt>Sobremesa</dt><dd>'+esc(doc.sobremesa)+'</dd></div></dl>'
      + '<div class="wk-f"><span></span>'+editBtn+'</div></div></article>';
  if (canWrite)
    return '<article class="wk empty-day'+cls+'">'+head+'<div class="wk-b"><span>Sem cardápio cadastrado.</span><button type="button" class="btn btn-primary btn-sm" data-edit="'+k+'">Cadastrar</button></div></article>';
  return '<article class="wk empty-day free'+cls+'">'+head+'<div class="wk-b"><span>Cardápio ainda não publicado.</span></div></article>';
}
function renderGrid(){
  gridEl.className = "week";
  gridEl.innerHTML = weekDays().map(dayCard).join("");
}

function fmtDate(k){
  var p = k.split("-"), dt = new Date(+p[0], +p[1]-1, +p[2]);
  return {d:+p[2], wd:WD[dt.getDay()]+(dt.getDay()>0&&dt.getDay()<6?"-feira":""), m:MESES[dt.getMonth()]};
}
function renderDetail(){
  if (!editing || !selected){ detailEl.hidden = true; detailEl.innerHTML = ""; return; }
  detailEl.hidden = false;
  var f = fmtDate(selected), doc = data[selected];
  detailEl.innerHTML = '<div><div class="eyebrow">Editando</div><div class="date">'+f.d+'</div><div class="wd">'+f.wd+', '+f.m+'</div></div>' + formHtml(doc);
  bindForm();
}

var formTipo = "cardapio";
function formHtml(doc){
  doc = doc || {};
  formTipo = doc.tipo==="feriado" ? "feriado" : "cardapio";
  function inp(id,label,val,wide,type){ return '<label class="'+(wide?'wide':'')+'" for="'+id+'">'+label+'<input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val)+'"></label>'; }
  return '<form class="form" id="form" autocomplete="off">'
    + '<div class="wide"><div class="seg" role="group" aria-label="Tipo do dia"><button type="button" class="chip" id="t-card" aria-pressed="'+(formTipo==="cardapio")+'">Cardápio</button><button type="button" class="chip" id="t-hol" aria-pressed="'+(formTipo==="feriado")+'">Feriado / sem serviço</button></div></div>'
    + '<div class="wide" id="box-card" '+(formTipo==="cardapio"?'':'hidden')+'><div class="form">'
    + inp("f-principal","Prato principal",doc.principal,true)
    + inp("f-guarnicao","Guarnição",doc.guarnicao) + inp("f-salada","Salada",doc.salada) + inp("f-sobremesa","Sobremesa",doc.sobremesa)
    + '</div></div>'
    + '<div class="wide" id="box-hol" '+(formTipo==="feriado"?'':'hidden')+'>'+inp("f-nome","Nome do feriado ou motivo",doc.nome,true)+'</div>'
    + '<div class="actions"><button class="btn btn-primary" id="save" type="submit">Salvar</button><button class="btn" id="cancel" type="button">Cancelar</button>'
    + (data[selected] ? '<button class="btn btn-danger" id="del" type="button">'+(confirmDel?'Confirmar remoção do dia':'Remover dia')+'</button>' : '')
    + '<span class="status" id="formmsg"></span></div></form>';
}
function bindForm(){
  function tipo(t){ formTipo=t; document.getElementById("t-card").setAttribute("aria-pressed",t==="cardapio"); document.getElementById("t-hol").setAttribute("aria-pressed",t==="feriado"); document.getElementById("box-card").hidden=t!=="cardapio"; document.getElementById("box-hol").hidden=t!=="feriado"; }
  document.getElementById("t-card").onclick = function(){ tipo("cardapio"); };
  document.getElementById("t-hol").onclick = function(){ tipo("feriado"); };
  document.getElementById("cancel").onclick = function(){ editing=false; confirmDel=false; renderDetail(); };
  var del = document.getElementById("del");
  if (del) del.onclick = function(){
    if (!confirmDel){ confirmDel = true; del.textContent = "Confirmar remoção do dia"; return; }
    run(function(){ return db.doc("cardapio_dias/"+selected).delete(); }, function(){ editing=false; confirmDel=false; });
  };
  document.getElementById("form").onsubmit = function(e){
    e.preventDefault();
    var v = function(id){ return document.getElementById(id).value.trim(); }, body;
    if (formTipo==="feriado"){ if(!v("f-nome")) return msg("Informe o nome do feriado."); body = {tipo:"feriado", nome:v("f-nome")}; }
    else {
      if(!v("f-principal")) return msg("Informe o prato principal.");
      body = {tipo:"cardapio", principal:v("f-principal"), guarnicao:v("f-guarnicao"), salada:v("f-salada"), sobremesa:v("f-sobremesa")};
    }
    run(function(){ return db.doc("cardapio_dias/"+selected).set(body); }, function(){ editing=false; confirmDel=false; });
  };
}
function msg(t){ var m=document.getElementById("formmsg"); if(m){ m.textContent=t; m.className="status err"; } }
function run(op, done){
  if (saving) return; saving = true;
  msg("Salvando…"); var m=document.getElementById("formmsg"); if(m) m.className="status";
  op().then(function(){ saving=false; done(); renderHead(); renderGrid(); renderDetail(); }, function(err){
    saving=false;
    if (err && err.code==="invalid_argument"){ canWrite=false; editing=false; renderGrid(); renderDetail(); setStatus("Você não tem permissão para editar o cardápio.", true); }
    else msg("Não foi possível salvar. Tente novamente.");
  });
}

function goWeek(delta){
  weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+7*delta);
  editing=false; confirmDel=false; renderHead(); renderGrid(); renderDetail();
}
gridEl.addEventListener("click", function(e){
  var b = e.target.closest("button[data-edit]");
  if (b){ selected = b.dataset.edit; editing = true; confirmDel = false; renderDetail(); detailEl.scrollIntoView({block:"nearest"}); }
});
document.getElementById("prev").onclick = function(){ goWeek(-1); };
document.getElementById("next").onclick = function(){ goWeek(1); };
document.getElementById("today").onclick = function(){ weekStart = mondayOf(now); goWeek(0); };

renderHead(); renderGrid(); renderDetail();

// Virada de dia: com a tela aberta, quem estava vendo a semana atual passa para a nova semana sozinho (e o "hoje" acompanha).
// Se alguém estiver editando um dia, a troca espera terminar para não perder o que está sendo digitado.
function checkDay(){
  var n = new Date();
  if (keyOf(n) === keyOf(now)) return;
  var estavaNaAtual = keyOf(weekStart) === keyOf(mondayOf(now));
  if (estavaNaAtual && editing) return;
  now = n;
  if (estavaNaAtual) weekStart = mondayOf(now);
  renderHead(); renderGrid();
}
setInterval(checkDay, 30000);
document.addEventListener("visibilitychange", function(){ if (!document.hidden) checkDay(); });
window.addEventListener("focus", checkDay);

// Ponte com o assistente do Hub.
window.__assistente = {
  modulo: "cardapio", nome: "Cardápio",
  abas: [],
  pronto: function(){ return loaded; },
  exemplo: function(){ return false; },
  empresas: function(){ return []; }, analistas: function(){ return []; },
  irPara: function(v, o){ var d = o && o.dia ? new Date(o.dia + "T12:00:00") : now; weekStart = mondayOf(d); renderHead(); renderGrid(); return true; },
  abrirEmpresa: function(){ return false; },
  consultar: function(tipo, p){
    if(tipo !== "cardapio" && tipo !== "vencimentos") return null;
    p = p || {};
    var de = new Date((p.de || keyOf(now)) + "T12:00:00"), ate = new Date((p.ate || p.de || keyOf(now)) + "T12:00:00"), ls = [];
    for(var d = new Date(de); d <= ate && ls.length < 31; d.setDate(d.getDate() + 1)){
      var k = keyOf(d), doc = data[k], w = d.getDay();
      if(w === 0 || w === 6){ if(!doc) continue; }
      var rot = WD[w] + ", " + d.getDate() + " de " + MESES[d.getMonth()];
      if(doc && doc.tipo === "feriado") ls.push({t: rot, sub: "Feriado: " + doc.nome + " (sem serviço)", data: k, tom: "", abrir: {aba: "", opts: {dia: k}}});
      else if(doc) ls.push({t: rot, sub: [doc.principal, doc.guarnicao, doc.salada, doc.sobremesa].filter(Boolean).join(" · "), data: k, tom: "", abrir: {aba: "", opts: {dia: k}}});
      else ls.push({t: rot, sub: "Cardápio ainda não cadastrado", data: k, tom: "", abrir: {aba: "", opts: {dia: k}}});
    }
    return {titulo: "Cardápio", total: ls.length, linhas: ls};
  }
};

// Aberto dentro do Control Hub, usa a conexão da página principal (ela só aceita objetos criados lá).
function noPai(){ try{ return window.parent !== window && window.parent.claude && window.parent.claude.use ? window.parent : null; }catch(e){ return null; } }
function usarCap(n){
  var P = noPai();
  if (P) return P.claude.use(n);
  return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null);
}
function clonarPara(v){ var P = noPai(); return P ? P.JSON.parse(JSON.stringify(v)) : JSON.parse(JSON.stringify(v)); }
function bancoReal(raw){
  return {
    doc: function(p){ var r = raw.doc(p); return {
      set: function(o){ return r.set(clonarPara(o)); },
      delete: function(){ return r.delete(); }
    }; },
    collection: function(n){ var c = raw.collection(n); return { onSnapshot: function(cb, err){ return c.onSnapshot(cb, err); } }; }
  };
}
(async function start(){
  var raw = await usarCap("db");
  db = raw ? bancoReal(raw) : null;
  if (!db){ setStatus("Entre na sua conta do Claude para ver o cardápio.", true); return; }
  var user = await usarCap("user");
  canWrite = !user || user.can("data.write") !== false;
  db.collection("cardapio_dias").onSnapshot(function(snap){
    var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data(); });
    data = m; loaded = true; setStatus("");
    renderHead(); renderGrid(); if (!editing) renderDetail();
  }, function(){ setStatus("Não foi possível carregar o cardápio agora.", true); });
})();
