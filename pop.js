(function(){
"use strict";
/* POP Master Controltax: catálogo de Procedimentos Operacionais Padrão com a metodologia baseada no Guia BPM CBOK (ABPMP).
   Hierarquia: Departamento → Setor → Atividade → Tarefa → Cenário → POP → Passo.
   Um cenário pode ter mais de um POP (métodos diferentes). Passos são de Ação ou de Decisão (gateway com ramos).
   Dados na coleção "pop_docs" do banco do Hub (um documento por POP; "_meta" guarda a versão dos exemplos). */

/* ============ utilidades ============ */
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function norm(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function limpa(s, n){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n || 300); }
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function ymd(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function parseYmd(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function hoje(){ var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function hojeS(){ return ymd(hoje()); }
function dataBR(s){ var d = parseYmd(s); return d ? pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() : ""; }
function diasAte(s){ var d = parseYmd(s); return d ? Math.round((d - hoje()) / 864e5) : null; }
function somaMeses(s, n){ var d = parseYmd(s) || hoje(); return ymd(new Date(d.getFullYear(), d.getMonth() + n, d.getDate())); }
var MES3 = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function uid(p){ return (p || "p") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function linhas(s){ return String(s || "").split(/\r?\n/).map(function(x){ return limpa(x, 200); }).filter(Boolean); }
function plural(n, s, p){ return n + " " + (n === 1 ? s : (p || s + "s")); }
var MINUSC = {de:1, da:1, do:1, das:1, dos:1, e:1, a:1, o:1, as:1, os:1, em:1, no:1, na:1, nos:1, nas:1, para:1, por:1, com:1, ao:1, aos:1, ou:1};
function tituloCase(s){ return String(s || "").trim().split(/\s+/).map(function(w, i){ var l = w.toLowerCase(); if(i && MINUSC[l]) return l; if(/^[A-Z0-9-]{2,}$/.test(w)) return w; return w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }
// "no" ou "na" antes do cenário, pela terminação da primeira palavra.
function prepNo(cen){ var w = norm(String(cen || "").split(/\s+/)[0]); return /(a|cao|sao|gem|dade|ice|ise)$/.test(w) ? "na" : "no"; }
function modeloTitulo(tarefa, cen){ var t = tituloCase(tarefa); return "Procedimento para " + t + (!cen || cen === "Padrão" ? "" : " " + prepNo(cen) + " " + tituloCase(cen)); }
// Verbo no infinitivo (heurística: primeira palavra terminando em -ar, -er, -ir ou -or, inclusive pronominal "cadastrar-se").
function infinitivo(s){ var w = norm(String(s || "").replace(/^[\d.)\-\s]+/, "").split(/\s+/)[0] || "").split("-")[0]; return /^[a-z]{2,}(ar|er|ir|or)$/.test(w) && ["setor","valor","fornecedor","lugar","mar","bar","par","melhor","maior","menor","anterior","posterior","exterior","interior","superior","inferior","senhor","diretor","gestor","contador","auditor","consultor","mentor","vendedor","prestador","tomador","credor","devedor","colaborador","favor","tutor","calor","cor","flor","amor","interior","pilar","exemplar","familiar","militar","titular","regular","popular","particular","similar","escolar","solar","dolar","celular"].indexOf(w) === -1; }

/* ============ domínio ============ */
var DEPS = [
  {n:"Comercial", s:"COM", f:"função comercial"},
  {n:"Contábil", s:"CON", f:"função contábil"},
  {n:"Financeiro", s:"FIN", f:"função financeira"},
  {n:"Fiscal", s:"FIS", f:"função fiscal"},
  {n:"Fiscal Simples Nacional", s:"FSN", f:"função fiscal das empresas do Simples Nacional"},
  {n:"Inovação", s:"INO", f:"função de inovação"},
  {n:"Pessoal", s:"DP", f:"função de departamento pessoal (folha e obrigações trabalhistas)"},
  {n:"Projetos", s:"PRJ", f:"função de projetos"},
  {n:"Gestão de Pessoas", s:"GP", f:"função de gestão de pessoas"},
  {n:"Societário", s:"SOC", f:"função societária"},
  {n:"TI", s:"TI", f:"função de tecnologia da informação"}
];
var DEP = {}; DEPS.forEach(function(d){ DEP[d.n] = d; });
var DEP_ALIAS = {"departamento pessoal":"Pessoal", "dp":"Pessoal", "pessoal":"Pessoal", "simples nacional":"Fiscal Simples Nacional", "fiscal simples":"Fiscal Simples Nacional", "fiscal - simples nacional":"Fiscal Simples Nacional", "rh":"Gestão de Pessoas", "recursos humanos":"Gestão de Pessoas", "tecnologia da informacao":"TI", "tecnologia":"TI", "contabilidade":"Contábil", "legalizacao":"Societário"};
function depCanon(s){
  var n = norm(s).replace(/^departamento (de |do |da )?/, "");
  for(var i = 0; i < DEPS.length; i++) if(norm(DEPS[i].n) === n) return DEPS[i].n;
  if(DEP_ALIAS[n]) return DEP_ALIAS[n];
  if(DEP_ALIAS[norm(s)]) return DEP_ALIAS[norm(s)];
  return "";
}
var STATUS = [{k:"rascunho", l:"Rascunho"}, {k:"revisao", l:"Em revisão"}, {k:"aprovado", l:"Aprovado"}, {k:"obsoleto", l:"Obsoleto"}];
var ST = {}; STATUS.forEach(function(s){ ST[s.k] = s; });
var FASES = [
  {k:"planejamento",  l:"Planejamento",  d:"Escopo, dono e objetivo definidos"},
  {k:"analise",       l:"Análise",       d:"Processo atual (as-is) entendido"},
  {k:"desenho",       l:"Desenho",       d:"Procedimento futuro (to-be) escrito"},
  {k:"implementacao", l:"Implementação", d:"Treinado e em uso pela equipe"},
  {k:"monitoramento", l:"Monitoramento", d:"Indicadores medidos e controlados"},
  {k:"refinamento",   l:"Refinamento",   d:"Melhorias em andamento"}
];
var FASE = {}; FASES.forEach(function(f, i){ f.i = i + 1; FASE[f.k] = f; });
var AREAS = [
  ["Gerenciamento de Processos de Negócio", "Cada POP tem dono, objetivo e lugar definido na arquitetura de processos."],
  ["Modelagem de Processos", "Passos de ação e de decisão (gateways), com fluxograma de todos os caminhos."],
  ["Análise de Processos", "Entradas, saídas, fornecedores e clientes (SIPOC) e sistemas usados."],
  ["Desenho de Processos", "Rascunho → revisão → aprovado, com histórico de cada versão."],
  ["Gerenciamento de Desempenho", "Indicadores com meta e tempo médio de execução em cada POP."],
  ["Transformação de Processos", "Fase de refinamento e revisões periódicas com nova versão."],
  ["Organização do Gerenciamento", "Papéis definidos: dono, analista de processos, executor e aprovador (RACI)."],
  ["Gerenciamento Corporativo", "Painel único com situação, conformidade e revisões dos 11 departamentos."],
  ["Tecnologias de BPM", "Catálogo no Control Hub, importação da planilha de mapeamento e Robô POP."]
];
// Níveis da hierarquia (metodologia CBOK adotada pela Controltax).
var NIVEIS = [
  {k:"departamento", n:"Departamento", r:"Área de Responsabilidade Funcional",
   d:"Representa uma função da empresa (ex.: a função financeira, contábil, fiscal) e responde por todos os objetivos e resultados dessa função.",
   nm:"Nome da função organizacional pela qual o departamento é responsável.", c:"Um Departamento possui vários Setores.",
   ex:["Departamento Financeiro (responsável pela função financeira)","Departamento Contábil (responsável pela função contábil)","Departamento Fiscal (responsável pela função fiscal)","Departamento Pessoal (responsável pela função de gestão de pessoas)"]},
  {k:"setor", n:"Setor", r:"Centro de Execução e Excelência",
   d:"Centro de Execução e Excelência das atividades relacionadas à função do departamento. É onde a função do departamento é efetivamente executada, com especialização e padrão de qualidade.",
   nm:"Começam por substantivos de ação que descrevem o conjunto de atividades executadas pelo centro.", c:"Um Setor pertence a um único Departamento e possui várias Atividades.",
   pai:"Departamento Contábil", ex:["Recepção e Gestão de Documentos","Integração Contábil","Conciliação Contábil","Fechamento Contábil","Atendimento ao Cliente"]},
  {k:"atividade", n:"Atividade", r:"Bloco de trabalho",
   d:"Bloco de trabalho executado por um setor para produzir um resultado específico. Cada setor possui uma ou mais atividades.",
   nm:"Começam por substantivos de ação.", c:"Uma Atividade pertence a um único Setor e possui várias Tarefas.",
   pai:"Setor: Recepção e Gestão de Documentos", ex:["Recebimento de Documentos","Organização de Arquivos","Validação de Informações","Apuração de Tributos","Emissão de Relatórios"]},
  {k:"tarefa", n:"Tarefa", r:"Execução composta",
   d:"Conjunto organizado de ações necessárias para concluir uma atividade. Cada atividade possui uma ou mais tarefas.",
   nm:"Começam por verbos no infinitivo.", c:"Uma Tarefa pertence a uma única Atividade e pode possuir vários Cenários.",
   pai:"Atividade: Recebimento de Documentos", ex:["Receber documentos do cliente","Conferir documentação","Classificar arquivos","Validar informações","Registrar pendências"]},
  {k:"cenario", n:"Cenário", r:"Contexto de execução",
   d:"Conjunto de condições ou contextos que alteram a forma como uma tarefa deve ser executada. Uma mesma tarefa pode possuir diversos cenários.",
   nm:"Começam por substantivos que representem o contexto de execução.", c:"Um Cenário pertence a uma única Tarefa e possui um ou mais POPs (permitindo variações quando necessário).",
   pai:"Tarefa: Receber documentos do cliente", ex:["Rotina Mensal","Admissão de Funcionário","Cliente Novo","Cliente com Pendências","Encerramento do Exercício","Auditoria Externa","Reprocessamento","Urgência Operacional"]},
  {k:"pop", n:"POP", r:"Procedimento padronizado",
   d:"Procedimento Operacional Padrão. Documento que descreve, de forma padronizada, como executar uma tarefa em um cenário específico. Cada cenário normalmente possui um único POP. Caso existam métodos diferentes para executar o mesmo cenário (por exemplo, sistema A e sistema B), podem existir múltiplos POPs.",
   nm:"Sempre iniciam com a palavra “Procedimento”. Modelo recomendado: Procedimento para + [Tarefa] + no(a) + [Cenário].", c:"Um POP pertence a um único Cenário e possui vários Passos.",
   ex:["Procedimento para Receber Documentos na Rotina Mensal","Procedimento para Validar Arquivos no Primeiro Atendimento","Procedimento para Registrar Pendências de Cliente","Procedimento para Importar Arquivos Contábeis"]},
  {k:"passo", n:"Passo", r:"Ação indivisível",
   d:"Menor unidade de execução do procedimento. Representa uma ação única, objetiva, sequencial e indivisível.",
   nm:"Sempre começam com verbo no infinitivo.", c:"Um Passo pertence a um único POP e possui uma ordem sequencial obrigatória.",
   pai:"POP: Procedimento para Recebimento de Documentos na Rotina Mensal", ex:["Acessar o sistema.","Localizar o cliente.","Conferir a documentação.","Validar os dados.","Registrar a ocorrência.","Salvar as alterações.","Encerrar a atividade."]}
];
var CARD = ["Um Departamento possui vários Setores.","Um Setor pertence a um único Departamento.","Um Setor possui várias Atividades.","Uma Atividade pertence a um único Setor.","Uma Atividade possui várias Tarefas.","Uma Tarefa pertence a uma única Atividade.","Uma Tarefa pode possuir vários Cenários.","Um Cenário pertence a uma única Tarefa.","Um Cenário possui um ou mais POPs (permitindo variações quando necessário).","Um POP pertence a um único Cenário.","Um POP possui vários Passos.","Um Passo pertence a um único POP e possui uma ordem sequencial obrigatória."];
var REV_PADRAO = 12;

function normPasso(x, i){
  x = x || {};
  var tipo = x.tipo === "decisao" ? "decisao" : "acao";
  var ramos = [];
  if(tipo === "decisao"){
    if(Array.isArray(x.ramos)) ramos = x.ramos.map(function(r){ return {rotulo: limpa(r && r.rotulo, 40), nota: limpa(r && r.nota, 200), destino: limpa(r && r.destino, 40)}; }).filter(function(r){ return r.rotulo; });
    else ramos = [{rotulo:"Sim", nota: limpa(x.sim, 200), destino:""}, {rotulo:"Não", nota: limpa(x.nao, 200), destino: x.nao ? "fim" : ""}];
  }
  return {id: limpa(x.id, 40) || "s" + (i + 1), tipo: tipo, texto: limpa(x.texto, 400), resp: limpa(x.resp, 80), ramos: ramos};
}
function normPop(x, id){
  x = x || {};
  var arr = function(v){ return Array.isArray(v) ? v.map(function(s){ return limpa(s, 200); }).filter(Boolean) : []; };
  var dep = depCanon(x.departamento) || limpa(x.departamento, 80) || "Sem departamento";
  var passos = Array.isArray(x.passos) ? x.passos.map(normPasso).filter(function(p){ return p.texto; }) : [];
  var ids = {}; passos.forEach(function(p, i){ if(ids[p.id]) p.id = "s" + (i + 1) + "x" + i; ids[p.id] = 1; });
  return {
    id: id,
    codigo: limpa(x.codigo, 30), titulo: limpa(x.titulo, 160) || "Procedimento sem título", variacao: limpa(x.variacao, 80),
    essencial: !!x.essencial, palavras: limpa(x.palavras, 240),
    departamento: dep, setor: limpa(x.setor, 120), atividade: limpa(x.atividade, 120), tarefa: limpa(x.tarefa, 160), cenario: limpa(x.cenario, 120) || "Padrão",
    versao: limpa(x.versao, 10) || "1.0", status: ST[x.status] ? x.status : "rascunho", fase: FASE[x.fase] ? x.fase : "desenho",
    dono: limpa(x.dono, 80), executor: limpa(x.executor, 120), aprovador: limpa(x.aprovador, 80),
    objetivo: String(x.objetivo || "").slice(0, 1500), escopo: String(x.escopo || "").slice(0, 1500), gatilho: limpa(x.gatilho, 200),
    frequencia: limpa(x.frequencia, 60), tempoMedio: limpa(x.tempoMedio, 40),
    fornecedores: arr(x.fornecedores), entradas: arr(x.entradas), saidas: arr(x.saidas), clientes: arr(x.clientes), sistemas: arr(x.sistemas),
    passos: passos,
    indicadores: Array.isArray(x.indicadores) ? x.indicadores.map(function(k){ return {nome: limpa(k && k.nome, 160), meta: limpa(k && k.meta, 80)}; }).filter(function(k){ return k.nome; }) : [],
    riscos: Array.isArray(x.riscos) ? x.riscos.map(function(r){ return {risco: limpa(r && r.risco, 200), controle: limpa(r && r.controle, 200), nivel: ["Baixo","Médio","Alto"].indexOf(r && r.nivel) !== -1 ? r.nivel : "Médio"}; }).filter(function(r){ return r.risco; }) : [],
    revisaoMeses: [3,6,12,24].indexOf(+x.revisaoMeses) !== -1 ? +x.revisaoMeses : REV_PADRAO,
    aprovadoEm: parseYmd(x.aprovadoEm) ? x.aprovadoEm : "", aprovadoPor: limpa(x.aprovadoPor, 80), proxRevisao: parseYmd(x.proxRevisao) ? x.proxRevisao : "",
    historico: Array.isArray(x.historico) ? x.historico.slice(-40).map(function(h){ return {v: limpa(h && h.v, 10), data: limpa(h && h.data, 10), por: limpa(h && h.por, 80), nota: limpa(h && h.nota, 200)}; }) : [],
    criadoEm: limpa(x.criadoEm, 10), atualizadoEm: limpa(x.atualizadoEm, 25), atualizadoPor: limpa(x.atualizadoPor, 80)
  };
}
function caminho(p){ return [p.departamento, p.setor, p.atividade, p.tarefa].filter(Boolean).join(" › "); }
function vencida(p){ return p.status === "aprovado" && p.proxRevisao && diasAte(p.proxRevisao) < 0; }
function lista(){ return Object.keys(S.pops).map(function(k){ return S.pops[k]; }).sort(function(a, b){ return (a.codigo || "~").localeCompare(b.codigo || "~", "pt-BR", {numeric:true}) || a.titulo.localeCompare(b.titulo, "pt-BR"); }); }
function ativos(){ return lista().filter(function(p){ return p.status !== "obsoleto"; }); }

// Regras de nomenclatura da metodologia: devolve a lista de problemas encontrados.
function problemasNome(p){
  var r = [];
  if(!DEP[p.departamento]) r.push("Departamento fora da lista oficial");
  if(p.setor && infinitivo(p.setor)) r.push("Setor deve começar com substantivo de ação");
  if(p.atividade && infinitivo(p.atividade)) r.push("Atividade deve começar com substantivo de ação");
  if(p.tarefa && !infinitivo(p.tarefa)) r.push("Tarefa deve começar com verbo no infinitivo");
  if(p.cenario && p.cenario !== "Padrão" && infinitivo(p.cenario)) r.push("Cenário deve começar com substantivo de contexto");
  if(!/^procedimento\b/i.test(p.titulo)) r.push("Título do POP deve começar com “Procedimento”");
  var ruins = []; p.passos.forEach(function(x, i){ if(x.tipo === "acao" && !infinitivo(x.texto)) ruins.push(i + 1); });
  if(ruins.length) r.push("Passo" + (ruins.length > 1 ? "s " : " ") + ruins.join(", ") + (ruins.length > 1 ? " não começam" : " não começa") + " com verbo no infinitivo");
  return r;
}
function problemasGateway(p){
  var r = [], ids = {}; p.passos.forEach(function(x){ ids[x.id] = 1; });
  p.passos.forEach(function(x, i){
    if(x.tipo !== "decisao") return;
    if(x.ramos.length < 2) r.push("Decisão do passo " + (i + 1) + " tem menos de 2 ramos");
    if(x.ramos.some(function(rm){ return rm.destino && rm.destino !== "fim" && !ids[rm.destino]; })) r.push("Decisão do passo " + (i + 1) + " aponta para um passo que não existe");
    if(!/\?\s*$/.test(x.texto)) r.push("Decisão do passo " + (i + 1) + " deve ser uma pergunta");
  });
  return r;
}
var REQS = [
  ["Dono do processo", function(p){ return !!p.dono; }],
  ["Objetivo", function(p){ return p.objetivo.trim().length >= 15; }],
  ["Escopo", function(p){ return !!p.escopo.trim(); }],
  ["Entradas e saídas", function(p){ return p.entradas.length > 0 && p.saidas.length > 0; }],
  ["Ao menos 3 passos", function(p){ return p.passos.length >= 3; }],
  ["Responsável nos passos", function(p){ return p.passos.length > 0 && p.passos.every(function(x){ return x.resp; }); }],
  ["Nomenclatura da metodologia", function(p){ return !problemasNome(p).length; }],
  ["Decisões com ramos e destinos", function(p){ return !problemasGateway(p).length; }],
  ["Indicador com meta", function(p){ return p.indicadores.some(function(k){ return k.meta; }); }],
  ["Risco e controle", function(p){ return p.riscos.some(function(r){ return r.controle; }); }],
  ["Tempo médio", function(p){ return !!p.tempoMedio; }],
  ["Revisão em dia", function(p){ return !vencida(p); }]
];
function conformidade(p){
  var faltas = REQS.filter(function(r){ return !r[1](p); });
  return {pct: Math.round((REQS.length - faltas.length) / REQS.length * 100), faltas: faltas.map(function(r){ return r[0]; })};
}
function scoreCls(n){ return n >= 90 ? "b" : n >= 60 ? "m" : "r"; }
function sigla(dep){ return DEP[dep] ? DEP[dep].s : (norm(dep).replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "GER"); }
function proxCodigo(dep, extra){
  var s = sigla(dep), max = 0, re = new RegExp("^POP-" + s + "-(\\d+)$");
  lista().concat(extra || []).forEach(function(p){ var m = re.exec(p.codigo); if(m) max = Math.max(max, +m[1]); });
  return "POP-" + s + "-" + ("00" + (max + 1)).slice(-3);
}
function subirVersao(v){ var m = /^(\d+)\.(\d+)$/.exec(v || ""); return m ? m[1] + "." + (+m[2] + 1) : "1.1"; }
function destinoRot(p, d){ if(!d) return "próximo passo"; if(d === "fim") return "encerrar o POP"; var i = p.passos.map(function(x){ return x.id; }).indexOf(d); return i === -1 ? "próximo passo" : "passo " + (i + 1); }

/* ============ fluxograma (SVG) ============ */
var fxN = 0;
function quebra(t, max){ var ws = String(t || "").split(/\s+/), ls = [], l = ""; ws.forEach(function(w){ if((l + " " + w).trim().length > max && l){ ls.push(l); l = w; } else l = (l + " " + w).trim(); }); if(l) ls.push(l); if(ls.length > 4){ ls = ls.slice(0, 4); ls[3] = ls[3].replace(/.{0,2}$/, "…"); } return ls.length ? ls : [""]; }
function fluxoSvg(passos){
  fxN++;
  var NW = 300, X0 = 16, CX = X0 + NW / 2, GAP = 30, LH = 15, mk = "fxa" + fxN;
  var nos = [], y = 10;
  var ini = {y: y, h: 30}; y += 30;
  passos.forEach(function(p, i){
    var dec = p.tipo === "decisao", ls = quebra((i + 1) + ". " + p.texto, dec ? 30 : 42);
    var h = dec ? Math.max(70, ls.length * LH + 46) : ls.length * LH + 20;
    y += GAP; nos.push({p: p, i: i, y: y, h: h, ls: ls, dec: dec}); y += h;
  });
  y += GAP; var fim = {y: y, h: 30}; y += 30;
  var idx = {}; nos.forEach(function(n, i){ idx[n.p.id] = i; });
  var topo = function(k){ return k >= nos.length ? fim.y : nos[k].y; };
  var meio = function(k){ return k >= nos.length ? fim.y + 15 : nos[k].y + nos[k].h / 2; };
  var dir = function(k){ return k >= nos.length ? CX + 60 : X0 + NW; };
  var ed = [], lb = [], lane = 0, alvosLane = {};
  var seta = function(x1, y1, x2, y2){ ed.push('<path d="M' + x1 + ' ' + y1 + ' V' + y2 + '" class="fx-e" marker-end="url(#' + mk + ')"/>'); };
  seta(CX, ini.y + 30, CX, topo(0));
  nos.forEach(function(n, k){
    var base = n.y + n.h;
    if(!n.dec){ seta(CX, base, CX, topo(k + 1)); return; }
    var reto = false, j = 0;
    n.p.ramos.forEach(function(r){
      var alvo = !r.destino ? k + 1 : r.destino === "fim" ? nos.length : (idx[r.destino] != null ? idx[r.destino] : k + 1);
      var rot = esc(r.rotulo) + (r.nota ? " · " + esc(r.nota.length > 34 ? r.nota.slice(0, 33) + "…" : r.nota) : "");
      if(alvo === k + 1 && !reto){
        reto = true; seta(CX, base, CX, topo(k + 1));
        lb.push('<text x="' + (CX + 8) + '" y="' + (base + 18) + '" class="fx-l">' + rot + '</text>');
        return;
      }
      var lx = X0 + NW + 34 + lane * 24; lane++;
      var sy = n.y + n.h / 2 + j * 7, ty = meio(alvo) + (alvosLane[alvo] || 0) * 6; alvosLane[alvo] = (alvosLane[alvo] || 0) + 1; j++;
      ed.push('<path d="M' + (X0 + NW) + ' ' + sy + ' H' + lx + ' V' + ty + ' H' + dir(alvo) + '" class="fx-e" fill="none" marker-end="url(#' + mk + ')"/>');
      lb.push('<text x="' + (X0 + NW + 6) + '" y="' + (sy - 5) + '" class="fx-l">' + rot + '</text>');
    });
  });
  var W = X0 + NW + 34 + Math.max(lane, 1) * 24 + 150;
  var no = nos.map(function(n){
    var ty = n.y + n.h / 2 - (n.ls.length - 1) * LH / 2 + 4;
    var tx = n.ls.map(function(l, i){ return '<tspan x="' + CX + '" y="' + (ty + i * LH) + '">' + esc(l) + '</tspan>'; }).join("");
    var forma = n.dec
      ? '<polygon points="' + CX + ',' + n.y + ' ' + (X0 + NW) + ',' + (n.y + n.h / 2) + ' ' + CX + ',' + (n.y + n.h) + ' ' + X0 + ',' + (n.y + n.h / 2) + '" class="fx-d"/>'
      : '<rect x="' + X0 + '" y="' + n.y + '" width="' + NW + '" height="' + n.h + '" rx="6" class="fx-a"/>';
    return '<g>' + forma + '<text class="fx-t' + (n.dec ? " dec" : "") + '" text-anchor="middle">' + tx + '</text>' + (n.p.resp && !n.dec ? '' : '') + '</g>';
  }).join("");
  var pill = function(o, t){ return '<rect x="' + (CX - 60) + '" y="' + o.y + '" width="120" height="30" rx="15" class="fx-p"/><text x="' + CX + '" y="' + (o.y + 19) + '" text-anchor="middle" class="fx-t pt">' + t + '</text>'; };
  return '<svg class="fluxo" viewBox="0 0 ' + W + ' ' + (y + 10) + '" width="' + W + '" height="' + (y + 10) + '" role="img" aria-label="Fluxograma do procedimento"><defs><marker id="' + mk + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="fx-m"/></marker></defs>' +
    ed.join("") + pill(ini, "Início") + no + pill(fim, "Fim") + lb.join("") + '</svg>';
}

/* ============ banco (mesma ponte dos outros módulos) ============ */
function noPai(){ try{ return window.parent !== window && window.parent.claude && window.parent.claude.use ? window.parent : null; }catch(e){ return null; } }
function usarCap(n){ var P = noPai(); if(P) return P.claude.use(n); return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null); }
function clonarPara(v){ var P = noPai(); return P ? P.JSON.parse(JSON.stringify(v)) : JSON.parse(JSON.stringify(v)); }
function bancoReal(raw){
  return {
    set: function(id, o){ return raw.doc("pop_docs/" + id).set(clonarPara(o)); },
    del: function(id){ return raw.doc("pop_docs/" + id).delete(); },
    ouvir: function(cb, err){ return raw.collection("pop_docs").onSnapshot(function(snap){ var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data(); }); cb(m); }, err); },
    setUser: function(id, o){ return raw.doc("pop_usuarios/" + id).set(clonarPara(o)); },
    ouvirUsers: function(cb, err){ return raw.collection("pop_usuarios").onSnapshot(function(snap){ var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data(); }); cb(m); }, err); }
  };
}
function bancoLocal(){
  var K = "pop-local-v1", dados = {}, ouv = null, ouvU = null;
  try{ dados = JSON.parse(localStorage.getItem(K) || "{}"); }catch(e){ dados = {}; }
  var grava = function(){ try{ localStorage.setItem(K, JSON.stringify(dados)); }catch(e){} if(ouv) ouv(JSON.parse(JSON.stringify(dados))); };
  return {
    set: function(id, o){ dados[id] = JSON.parse(JSON.stringify(o)); grava(); return Promise.resolve(); },
    del: function(id){ delete dados[id]; grava(); return Promise.resolve(); },
    ouvir: function(cb){ ouv = cb; setTimeout(function(){ cb(JSON.parse(JSON.stringify(dados))); }, 0); },
    setUser: function(id, o){ var u = {}; try{ u = JSON.parse(localStorage.getItem("pop-local-users") || "{}"); }catch(e){} u[id] = JSON.parse(JSON.stringify(o)); try{ localStorage.setItem("pop-local-users", JSON.stringify(u)); }catch(e){} if(ouvU) ouvU(u); return Promise.resolve(); },
    ouvirUsers: function(cb){ ouvU = cb; var u = {}; try{ u = JSON.parse(localStorage.getItem("pop-local-users") || "{}"); }catch(e){} setTimeout(function(){ cb(u); }, 0); }
  };
}
var banco = null, semBanco = false;

/* ============ acesso ============ */
function AUTH(){ try{ var P = window.parent; return (P && P !== window && P.__auth) || window.__auth || null; }catch(e){ return null; } }
// Como os outros módulos: só funciona aberto pelo Hub (login).
if(!AUTH()){ try{ location.replace("index.html"); }catch(e){} }
// gestor: administrador ou coordenação de qualquer setor (aprova, publica, exclui) · editor: analista · leitor: só consulta
function papelAuth(){
  var A = AUTH(); if(!A) return "gestor";
  if(A.ehAdmin()) return "gestor";
  var nv = ["dp","contabil","fiscal","portal"].map(function(m){ return A.nivel(m); });
  if(nv.indexOf("coord") !== -1) return "gestor";
  if(nv.indexOf("analista") !== -1) return "editor";
  return "leitor";
}
function eu(){ var A = AUTH(); var u = A && A.usuario ? A.usuario() : null; return (u && u.nome) || S.nomeConta || "Equipe"; }
var podeEditar = function(){ return S.papel === "gestor" || S.papel === "editor"; };
var ehGestor = function(){ return S.papel === "gestor"; };

/* ============ estado ============ */
var S = { pops: {}, carregou: false, papel: "leitor", podeGravar: true, nomeConta: "", view: "inicio", users: {}, q: "", mapa: {dep: "", set: "", at: "", ta: ""}, mpModo: "colunas", mpFiltro: "", trDep: "", ct: {q: "", dep: "", fase: "", st: "ativos"}, ar: {q: ""}, imp: null, meta: null };
function lerPrefs(){ try{ return JSON.parse(localStorage.getItem("pop-prefs3") || "{}"); }catch(e){ return {}; } }
function salvarPrefs(o){ try{ var p = lerPrefs(); Object.keys(o).forEach(function(k){ p[k] = o[k]; }); localStorage.setItem("pop-prefs3", JSON.stringify(p)); }catch(e){} }

/* ============ avisos e confirmação ============ */
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
var tSalv = 0;
function estadoSalvar(txt, erro){ var el = $("#salv"); clearTimeout(tSalv); el.hidden = !txt; el.textContent = txt || ""; el.classList.toggle("err", !!erro); if(txt && !erro) tSalv = setTimeout(function(){ el.hidden = true; }, 2200); }
function gravar(p){
  if(!podeEditar() || !S.podeGravar){ toast("Você não tem permissão para alterar POPs."); return Promise.reject(new Error("sem_permissao")); }
  var id = p.id, o = JSON.parse(JSON.stringify(p)); delete o.id;
  o.atualizadoEm = new Date().toISOString().slice(0, 16); o.atualizadoPor = eu();
  estadoSalvar("Salvando…");
  return banco.set(id, o).then(function(){ estadoSalvar("Salvo"); }, function(err){
    estadoSalvar("Não salvou", true);
    toast(err && err.code === "quota_exceeded" ? "O banco de dados está cheio: a alteração não foi salva." : "Não foi possível salvar. Confira a conexão e tente de novo.");
    throw err;
  });
}
function hist(p, nota){ p.historico = (p.historico || []).concat([{v: p.versao, data: hojeS(), por: eu(), nota: nota}]).slice(-40); }

/* ============ abas ============ */
var VIEWS = ["inicio","mapa","trilha","catalogo","painel","governanca","metodologia","importar"];
function irPara(v, filtros){
  if(v === "arquitetura") v = "mapa";
  if(VIEWS.indexOf(v) === -1) v = "inicio";
  S.view = v; salvarPrefs({view: v});
  if(filtros) Object.keys(filtros).forEach(function(k){ S.ct[k] = filtros[k]; });
  $$("#tabs .dp-tab").forEach(function(b){ var on = b.getAttribute("data-view") === v; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $$(".view").forEach(function(s){ s.hidden = s.id !== "v-" + v; });
  var p = $("#v-" + v); p.classList.remove("dp-entra"); void p.offsetWidth; p.classList.add("dp-entra");
  window.scrollTo(0, 0);
  render();
}
$$("#tabs .dp-tab").forEach(function(b){ b.onclick = function(){ irPara(b.getAttribute("data-view")); }; });
$("#tabs").addEventListener("keydown", function(e){
  if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  var i = VIEWS.indexOf(S.view) + (e.key === "ArrowRight" ? 1 : -1); if(i < 0 || i >= VIEWS.length) return;
  irPara(VIEWS[i]); var b = $('#tabs [data-view="' + VIEWS[i] + '"]'); if(b) b.focus();
});

function render(){
  var ps = ativos();
  var nv = ps.filter(vencida).length, nr = ps.filter(function(p){ return p.status === "revisao"; }).length;
  var bd = $("#bdRev"); bd.hidden = !(nv + nr); bd.textContent = nv + nr; bd.title = plural(nr, "POP em revisão", "POPs em revisão") + " · " + plural(nv, "revisão vencida", "revisões vencidas");
  var nc = ps.filter(function(p){ return conformidade(p).pct < 60; }).length;
  var bc = $("#bdConf"); bc.hidden = !nc; bc.textContent = nc; bc.title = plural(nc, "POP abaixo de 60% de conformidade", "POPs abaixo de 60% de conformidade");
  $("#btnNovo").hidden = !podeEditar();
  var tg = $("#papelTag"); tg.hidden = false; tg.textContent = S.papel === "gestor" ? "gestor de processos" : S.papel === "editor" ? "editor" : "consulta";
  $("#popSync").textContent = S.carregou ? plural(ps.length, "POP ativo", "POPs ativos") : "";
  $("#tabImportar").hidden = !podeEditar();
  var tr = progressoTrilha(meuDep()); var bt = $("#bdTrilha"); bt.hidden = !tr.total; bt.textContent = tr.lidos + "/" + tr.total; bt.title = "POPs essenciais do seu departamento que você já leu"; bt.classList.toggle("tab-ok", tr.total && tr.lidos >= tr.total);
  if(S.view === "inicio") renderInicio();
  else if(S.view === "mapa") renderMapa();
  else if(S.view === "trilha") renderTrilha();
  else if(S.view === "painel") renderPainel();
  else if(S.view === "catalogo") renderCatalogo();
  else if(S.view === "metodologia") renderMetodologia();
  else if(S.view === "governanca") renderGovernanca();
  else if(S.view === "importar") renderImportar();
}

/* ============ PAINEL ============ */
function kpi(v, rot, sub, cls, acao, extra){ return '<button type="button" class="kpi-card ' + (cls || "") + '" data-ir="' + esc(acao) + '"' + (extra || "") + '><span class="kpi-label">' + esc(rot) + '</span><span class="kpi-value">' + v + '</span><span class="sub">' + esc(sub) + '</span></button>'; }
function renderPainel(){
  var ps = ativos(), todos = lista();
  var ap = ps.filter(function(p){ return p.status === "aprovado"; }), rv = ps.filter(function(p){ return p.status === "revisao"; }), rs = ps.filter(function(p){ return p.status === "rascunho"; });
  var venc = ps.filter(vencida);
  var media = ps.length ? Math.round(ps.reduce(function(s, p){ return s + conformidade(p).pct; }, 0) / ps.length) : 0;
  var comPop = {}; ps.forEach(function(p){ comPop[p.departamento] = 1; });
  $("#pnKpis").innerHTML =
    kpi(ps.length, "POPs ativos", Object.keys(comPop).length + " de " + DEPS.length + " departamentos", "", "st:ativos", ' style="--c:var(--blue-deep)"') +
    kpi(ap.length, "Aprovados", ps.length ? Math.round(ap.length / ps.length * 100) + "% do catálogo" : "—", "f0", "st:aprovado", ' style="--c:var(--dp-ok)"') +
    kpi(rv.length, "Em revisão", "aguardando aprovação", "", "st:revisao", ' style="--c:var(--dp-today)"') +
    kpi(rs.length, "Rascunhos", "em elaboração", "", "st:rascunho", ' style="--c:var(--st-pend)"') +
    kpi(venc.length, "Revisões vencidas", venc.length ? "revisar o quanto antes" : "tudo em dia", venc.length ? "f3 pulsa" : "f0", "st:vencidas", ' style="--c:' + (venc.length ? "var(--dp-late)" : "var(--dp-ok)") + '"') +
    kpi(media + "%", "Conformidade média", "com a metodologia e a governança", media >= 90 ? "f0" : media < 60 ? "f3" : "", "gov", ' style="--c:var(--brand-red)"');

  var porFase = {}; ps.forEach(function(p){ porFase[p.fase] = (porFase[p.fase] || 0) + 1; });
  var ciclo = '<div class="ciclo">' + FASES.map(function(f){ return '<button type="button" class="fase fz' + f.i + '" data-fase="' + f.k + '"><b>' + (porFase[f.k] || 0) + '</b><span>' + esc(f.l) + '</span><small>' + esc(f.d) + '</small></button>'; }).join("") + '</div>';

  var porDep = {}; DEPS.forEach(function(d){ porDep[d.n] = {ap:0, rv:0, rs:0, t:0}; });
  ps.forEach(function(p){ var d = porDep[p.departamento] = porDep[p.departamento] || {ap:0, rv:0, rs:0, t:0}; d.t++; d[p.status === "aprovado" ? "ap" : p.status === "revisao" ? "rv" : "rs"]++; });
  var maxD = Math.max.apply(null, [1].concat(Object.keys(porDep).map(function(k){ return porDep[k].t; })));
  var depHtml = Object.keys(porDep).map(function(k){
    var d = porDep[k], w = function(n){ return (n / maxD * 100).toFixed(1) + "%"; };
    return '<div class="hb' + (d.t ? "" : " zero") + '"><button type="button" class="pn-link hb-n" data-dep="' + esc(k) + '"><span class="cod">' + esc(sigla(k)) + '</span>' + esc(k) + '</button><div class="bar"><i class="ap" style="width:' + w(d.ap) + '"></i><i class="rv" style="width:' + w(d.rv) + '"></i><i class="rs" style="width:' + w(d.rs) + '"></i></div><em>' + d.t + '</em></div>';
  }).join("");
  depHtml += '<div class="leg"><span><i style="background:var(--dp-ok)"></i>Aprovado</span><span><i style="background:var(--dp-today)"></i>Em revisão</span><span><i style="background:var(--st-pend)"></i>Rascunho</span></div>';

  var prox = ps.filter(function(p){ return p.status === "aprovado" && p.proxRevisao && diasAte(p.proxRevisao) <= 90; }).sort(function(a, b){ return a.proxRevisao.localeCompare(b.proxRevisao); }).slice(0, 7);
  var revHtml = prox.map(function(p, i){
    var d = parseYmd(p.proxRevisao), n = diasAte(p.proxRevisao);
    var cd = n < 0 ? '<span class="cd venc">vencida há ' + plural(-n, "dia") + '</span>' : n === 0 ? '<span class="cd hoje">hoje</span>' : '<span class="cd' + (n <= 30 ? " perto" : "") + '">em ' + plural(n, "dia") + '</span>';
    return '<div class="vc-item" style="--k:' + i + '"><div class="dia' + (n < 0 ? " venc" : "") + '"><b>' + d.getDate() + '</b><small>' + MES3[d.getMonth()] + '/' + String(d.getFullYear()).slice(2) + '</small></div><button type="button" class="pn-link" style="text-align:left;color:var(--ink);min-width:0" data-ver="' + p.id + '"><span class="dp-cell-main">' + esc(p.titulo) + '</span><span class="dp-cell-sub">' + esc(p.codigo) + ' · ' + esc(p.dono || "sem dono") + '</span></button>' + cd + '</div>';
  }).join("") || '<p class="empty-mini">Nenhuma revisão nos próximos 90 dias.</p>';

  var piores = ps.map(function(p){ return {p: p, c: conformidade(p)}; }).filter(function(x){ return x.c.pct < 100; }).sort(function(a, b){ return a.c.pct - b.c.pct; }).slice(0, 6);
  var confHtml = piores.map(function(x, i){ return '<button type="button" class="mv-item" style="--k:' + i + '" data-ver="' + x.p.id + '"><span style="min-width:0"><span class="dp-cell-main">' + esc(x.p.titulo) + '</span><span class="dp-cell-sub">Falta: ' + esc(x.c.faltas.slice(0, 3).join(", ")) + (x.c.faltas.length > 3 ? "…" : "") + '</span></span><span class="score ' + scoreCls(x.c.pct) + '">' + x.c.pct + '%</span></button>'; }).join("") || '<p class="empty-mini">Todos os POPs atendem à metodologia.</p>';

  var ult = todos.filter(function(p){ return p.atualizadoEm; }).sort(function(a, b){ return b.atualizadoEm.localeCompare(a.atualizadoEm); }).slice(0, 6);
  var ultHtml = ult.map(function(p, i){ var h = p.historico[p.historico.length - 1]; return '<button type="button" class="mv-item" style="--k:' + i + '" data-ver="' + p.id + '"><span style="min-width:0"><span class="dp-cell-main">' + esc(p.titulo) + '</span><span class="dp-cell-sub">' + esc(h ? h.nota : "Atualizado") + ' · ' + esc(p.atualizadoPor || "") + '</span></span><span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span></button>'; }).join("") || '<p class="empty-mini">Sem alterações registradas.</p>';

  $("#pnGrid").className = "pn-grid pn-anim";
  $("#pnGrid").innerHTML =
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Ciclo de vida dos processos</h3><span class="sub">BPM CBOK · clique numa fase para ver os POPs</span></div><div class="pn-card-body">' + ciclo + '</div></section>' +
    '<section class="pn-card pn-span2"><div class="pn-card-head"><h3>POPs por departamento</h3><span class="sub">os 11 departamentos da Controltax</span></div><div class="pn-card-body">' + depHtml + '</div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Revisões periódicas</h3><span class="sub">próximos 90 dias</span></div><div class="pn-card-body">' + revHtml + '</div></section>' +
    '<section class="pn-card pn-span2"><div class="pn-card-head"><h3>Pendências de conformidade</h3><button type="button" class="pn-link" data-ir="gov">Ver governança</button></div><div class="pn-card-body">' + confHtml + '</div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Últimas alterações</h3></div><div class="pn-card-body">' + ultHtml + '</div></section>' +
    (ehGestor() ? cartaoEquipe() : '');
}
document.addEventListener("click", function(e){
  var b = e.target.closest("[data-ir]");
  if(b){ var a = b.getAttribute("data-ir"); if(a === "gov") irPara("governanca"); else if(a === "met") irPara("metodologia"); else if(a.indexOf("st:") === 0) irPara("catalogo", {st: a.slice(3), q: "", dep: "", fase: ""}); return; }
  var f = e.target.closest("[data-fase]"); if(f){ irPara("catalogo", {fase: f.getAttribute("data-fase"), st: "ativos", q: "", dep: ""}); return; }
  var d = e.target.closest("[data-dep]"); if(d){ irPara("catalogo", {dep: d.getAttribute("data-dep"), st: "ativos", q: "", fase: ""}); return; }
  var v = e.target.closest("[data-ver]"); if(v){ abrirPop(v.getAttribute("data-ver")); }
});

/* ============ CATÁLOGO ============ */
var ST_FILTROS = [["ativos","Ativos"],["aprovado","Aprovados"],["revisao","Em revisão"],["rascunho","Rascunhos"],["vencidas","Vencidas"],["obsoleto","Obsoletos"]];
function filtroCatalogo(){
  var c = S.ct, q = norm(c.q);
  return lista().filter(function(p){
    if(c.st === "ativos" && p.status === "obsoleto") return false;
    if(c.st === "vencidas" && !vencida(p)) return false;
    if(["aprovado","revisao","rascunho","obsoleto"].indexOf(c.st) !== -1 && p.status !== c.st) return false;
    if(c.dep && p.departamento !== c.dep) return false;
    if(c.fase && p.fase !== c.fase) return false;
    if(q){ var hay = norm([p.codigo, p.titulo, caminho(p), p.cenario, p.variacao, p.palavras, p.dono, p.executor, p.objetivo].concat(p.passos.map(function(x){ return x.texto; })).join(" ")); if(!q.split(" ").every(function(w){ return hay.indexOf(w) !== -1; })) return false; }
    return true;
  });
}
function renderCatalogo(){
  var extras = {}; lista().forEach(function(p){ if(!DEP[p.departamento]) extras[p.departamento] = 1; });
  $("#ctDep").innerHTML = '<option value="">Todos os departamentos</option>' + DEPS.map(function(d){ return d.n; }).concat(Object.keys(extras)).map(function(d){ return '<option' + (d === S.ct.dep ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("");
  $("#ctFase").innerHTML = '<option value="">Todas as fases</option>' + FASES.map(function(f){ return '<option value="' + f.k + '"' + (f.k === S.ct.fase ? " selected" : "") + '>' + esc(f.l) + '</option>'; }).join("");
  $("#ctSt").innerHTML = ST_FILTROS.map(function(s){ return '<button type="button" data-st="' + s[0] + '" class="' + (S.ct.st === s[0] ? "on" : "") + '">' + s[1] + '</button>'; }).join("");
  if($("#ctBusca").value !== S.ct.q) $("#ctBusca").value = S.ct.q;
  var ls = filtroCatalogo();
  $("#ctCont").textContent = plural(ls.length, "POP");
  var tab = $("#ctTab"); tab.className = "tbl ls-anim";
  if(!S.carregou){ tab.innerHTML = '<tbody><tr><td class="vazio">Carregando…</td></tr></tbody>'; return; }
  if(!ls.length){ tab.innerHTML = '<tbody><tr><td class="vazio">Nenhum POP com esses filtros.' + (podeEditar() ? ' <button type="button" class="linkish" data-novo>Criar um POP</button>' : '') + '</td></tr></tbody>'; return; }
  tab.innerHTML = '<thead><tr><th>Código</th><th>POP</th><th>Dono do processo</th><th>Fase</th><th class="num">Versão</th><th>Situação</th><th>Próxima revisão</th><th class="num">Conformidade</th></tr></thead><tbody>' +
    ls.map(function(p, i){
      var c = conformidade(p), venc = vencida(p), n = diasAte(p.proxRevisao);
      var rev = p.status === "aprovado" && p.proxRevisao ? '<span class="' + (venc ? "pill vencida" : n <= 30 ? "pill pill-today" : "mono") + '">' + dataBR(p.proxRevisao) + '</span>' : '<span class="dp-cell-sub">—</span>';
      return '<tr style="--k:' + i + '" class="' + (p.status === "obsoleto" ? "obs" : "") + '"><td class="cod">' + esc(p.codigo || "—") + '</td><td class="emp"><button type="button" data-ver="' + p.id + '">' + esc(p.titulo) + '</button><span class="sub">' + esc(caminho(p)) + ' · cenário: ' + esc(p.cenario) + (p.variacao ? ' · método: ' + esc(p.variacao) : '') + '</span></td><td>' + esc(p.dono || "—") + '</td><td><span class="chip">' + esc(FASE[p.fase].l) + '</span></td><td class="num mono">' + esc(p.versao) + '</td><td><span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span></td><td>' + rev + '</td><td class="num"><span class="score ' + scoreCls(c.pct) + '" title="' + esc(c.faltas.length ? "Falta: " + c.faltas.join(", ") : "Completo") + '">' + c.pct + '%</span></td></tr>';
    }).join("") + '</tbody>';
}
$("#ctBusca").addEventListener("input", function(){ S.ct.q = this.value; renderCatalogo(); });
$("#ctDep").onchange = function(){ S.ct.dep = this.value; renderCatalogo(); };
$("#ctFase").onchange = function(){ S.ct.fase = this.value; renderCatalogo(); };
$("#ctSt").addEventListener("click", function(e){ var b = e.target.closest("button[data-st]"); if(b){ S.ct.st = b.getAttribute("data-st"); renderCatalogo(); } });

/* ============ ARQUITETURA ============ */
function renderArquitetura(){
  var q = norm(S.mpFiltro), arv = {}, n = 0;
  if(!q) DEPS.forEach(function(d){ arv[d.n] = {}; });
  ativos().forEach(function(p){
    if(q && norm([caminho(p), p.cenario, p.titulo, p.codigo].join(" ")).indexOf(q) === -1) return;
    n++;
    var g = function(o, k){ return (o[k] = o[k] || {}); };
    var c = g(g(g(g(arv, p.departamento), p.setor || "(sem setor)"), p.atividade || "(sem atividade)"), p.tarefa || "(sem tarefa)");
    (c[p.cenario] = c[p.cenario] || []).push(p);
  });
  $("#mpCont").textContent = plural(n, "POP");
  var conta = function(o){ return Array.isArray(o) ? o.length : Object.keys(o).reduce(function(s, k){ return s + conta(o[k]); }, 0); };
  var ord = function(o){ return Object.keys(o).sort(function(x, y){ return x.localeCompare(y, "pt-BR"); }); };
  var ordDep = function(o){ var base = DEPS.map(function(d){ return d.n; }); return Object.keys(o).sort(function(x, y){ var a = base.indexOf(x), b = base.indexOf(y); return (a === -1 ? 99 : a) - (b === -1 ? 99 : b) || x.localeCompare(y, "pt-BR"); }); };
  var ab = q ? " open" : "";
  var html = ordDep(arv).map(function(dep){
    var nd = conta(arv[dep]);
    return '<details class="n1"' + (nd ? " open" : "") + '><summary><span class="nv">Depto.</span><span class="nm">' + esc(dep) + ' <span class="cod">' + esc(sigla(dep)) + '</span></span><span class="chip">' + (nd ? plural(nd, "POP") : "nenhum POP") + '</span></summary>' +
      (nd ? '' : '<p class="arv-vz">Nenhum POP cadastrado neste departamento.' + (podeEditar() ? ' <button type="button" class="linkish" data-novo-dep="' + esc(dep) + '">Criar o primeiro</button>' : '') + '</p>') +
      ord(arv[dep]).map(function(se){
        return '<details class="n2"' + ab + '><summary><span class="nv">Setor</span><span class="nm">' + esc(se) + '</span><span class="chip">' + conta(arv[dep][se]) + '</span></summary>' +
          ord(arv[dep][se]).map(function(at){
            return '<details class="n3"' + ab + '><summary><span class="nv">Atividade</span><span class="nm">' + esc(at) + '</span><span class="chip">' + conta(arv[dep][se][at]) + '</span></summary>' +
              ord(arv[dep][se][at]).map(function(ta){
                var cs = arv[dep][se][at][ta];
                return '<details class="n4"' + ab + '><summary><span class="nv">Tarefa</span><span class="nm">' + esc(ta) + '</span><span class="chip">' + plural(Object.keys(cs).length, "cenário") + '</span></summary>' +
                  ord(cs).map(function(ce){
                    var ps = cs[ce];
                    return '<details class="n5" open><summary><span class="nv">Cenário</span><span class="nm">' + esc(ce) + '</span><span class="chip">' + plural(ps.length, "POP") + '</span></summary>' +
                      ps.map(function(p){ return '<button type="button" class="folha" data-ver="' + p.id + '"><span class="nv">POP</span><span class="cod">' + esc(p.codigo) + '</span><span class="nm">' + esc(p.titulo) + (p.variacao ? ' <span class="chip">' + esc(p.variacao) + '</span>' : '') + ' <span class="dp-cell-sub" style="display:inline">· ' + plural(p.passos.length, "passo") + '</span></span><span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span></button>'; }).join("") +
                    '</details>';
                  }).join("") + '</details>';
              }).join("") + '</details>';
          }).join("") + '</details>';
      }).join("") + '</details>';
  }).join("");
  $("#arTree").innerHTML = html || '<p class="vazio">' + (S.carregou ? "Nada encontrado." : "Carregando…") + '</p>';
}
document.addEventListener("click", function(e){ var b = e.target.closest("[data-novo-dep]"); if(b){ var x = vazio(); x.departamento = b.getAttribute("data-novo-dep"); abrirEditor(x); } });

/* ============ METODOLOGIA ============ */
function renderMetodologia(){
  if($("#mtGrid").dataset.ok) return;
  $("#mtGrid").dataset.ok = "1";
  var exemplo = [
    {id:"a", tipo:"acao", texto:"Acessar o sistema"},
    {id:"b", tipo:"decisao", texto:"Cliente entregou a documentação?", ramos:[{rotulo:"Sim", nota:"", destino:""}, {rotulo:"Não", nota:"criar pendência", destino:"e"}]},
    {id:"c", tipo:"acao", texto:"Conferir a documentação"},
    {id:"d", tipo:"acao", texto:"Salvar as alterações"},
    {id:"e", tipo:"acao", texto:"Notificar o responsável"}
  ].map(normPasso);
  $("#mtGrid").className = "pn-grid pn-anim";
  $("#mtGrid").innerHTML =
    '<section class="pn-card pn-wide mt-intro"><div class="pn-card-head"><h3>Metodologia baseada no CBOK</h3><span class="sub">ABPMP · Common Body of Knowledge</span></div><div class="pn-card-body" style="gap:10px">' +
      '<p>Toda esta metodologia foi criada a partir do <b>Guia CBOK — Common Body of Knowledge</b> (Corpo Comum de Conhecimento), o guia oficial de melhores práticas em Gestão de Processos de Negócio, publicado pela <b>Association of Business Process Management Professionals (ABPMP)</b>. Ele estabelece o padrão global da disciplina, cobrindo todo o ciclo de vida dos processos corporativos.</p>' +
      '<p>A hierarquia adotada aqui reflete a decomposição recomendada pelo CBOK para modelar, padronizar e treinar processos de forma auditável e replicável.</p>' +
      '<div class="hier">' + NIVEIS.map(function(n, i){ return (i ? '<span class="seta">→</span>' : '') + '<span class="hier-n"><b>' + esc(n.n) + '</b><small>' + esc(n.r) + '</small></span>'; }).join("") + '</div>' +
    '</div></section>' +
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Relação entre os níveis</h3><span class="sub">o que cada nível representa e como deve ser nomeado</span></div><div class="pn-card-body flush"><div class="tbl-wrap"><table class="tbl mt-tab"><thead><tr><th>Nível</th><th>Representa</th><th>Regra de nomenclatura</th><th>Cardinalidade</th></tr></thead><tbody>' +
      NIVEIS.map(function(n){ return '<tr><td><b>' + esc(n.n) + '</b></td><td>' + esc(n.r) + '</td><td>' + esc(n.nm) + '</td><td>' + esc(n.c) + '</td></tr>'; }).join("") + '</tbody></table></div></div></section>' +
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Definições e regras por nível</h3><span class="sub">clique para abrir</span></div><div class="pn-card-body">' +
      NIVEIS.map(function(n, i){ return '<details class="nivel"' + (i ? "" : " open") + '><summary><span class="nivel-i">' + (i + 1) + '</span><b>' + esc(n.n) + '</b><span class="sub">' + esc(n.r) + '</span></summary><div class="nivel-b">' +
        '<dl><dt>Definição</dt><dd>' + esc(n.d) + '</dd><dt>Regra de nomenclatura</dt><dd>' + esc(n.nm) + '</dd><dt>Cardinalidade</dt><dd>' + esc(n.c) + '</dd></dl>' +
        '<div class="nivel-ex"><span class="kpi-label">Exemplos' + (n.pai ? ' · ' + esc(n.pai) : '') + '</span><ul>' + n.ex.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div></div></details>'; }).join("") +
    '</div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Regra de cardinalidade</h3></div><div class="pn-card-body"><ul class="regras">' + CARD.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join("") + '</ul></div></section>' +
    '<section class="pn-card pn-span2"><div class="pn-card-head"><h3>Passos decisórios (gateway)</h3><span class="sub">um tipo de Passo, não um nível novo</span></div><div class="pn-card-body" style="gap:12px">' +
      '<p class="note" style="font-size:13px;color:var(--ink-2)">No CBOK, decisões dentro de um procedimento são representadas como <b>gateways</b>: pontos onde o fluxo se divide conforme uma resposta.</p>' +
      '<div class="gw"><div><span class="gw-ic acao"></span><b>Passo de Ação</b><p>Uma instrução que é executada. O próximo passo é sempre o seguinte da lista. Ex.: “Acessar o sistema.”</p></div><div><span class="gw-ic dec"></span><b>Passo de Decisão</b><p>Uma pergunta com dois ou mais ramos. Cada ramo aponta para outro passo (ou encerra o POP). Ex.: “Cliente entregou a documentação?”</p></div></div>' +
      '<ul class="regras"><li>Se o próximo passo é sempre o mesmo, use uma <b>Ação</b>.</li><li>Se o próximo passo depende de uma resposta, condição, evento ou estado, use uma <b>Decisão</b>.</li><li>Cada ramo pode incluir uma nota de ação (ex.: “criar pendência”, “notificar responsável”) e deve apontar para um destino claro.</li><li>A visualização em <b>Fluxograma</b> no editor mostra todos os caminhos possíveis.</li></ul>' +
      '<div class="fluxo-box">' + fluxoSvg(exemplo) + '</div>' +
    '</div></section>' +
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Os 11 departamentos</h3><span class="sub">áreas de responsabilidade funcional · sigla usada no código do POP</span></div><div class="pn-card-body"><div class="ka">' + DEPS.map(function(d){ return '<div><em>' + esc(d.s) + '</em><b>' + esc(d.n) + '</b><small>Responsável pela ' + esc(d.f) + '. Código: POP-' + esc(d.s) + '-000.</small></div>'; }).join("") + '</div></div></section>';
}

/* ============ GOVERNANÇA ============ */
function renderGovernanca(){
  var ps = ativos().map(function(p){ return {p: p, c: conformidade(p)}; }).sort(function(a, b){ return a.c.pct - b.c.pct || a.p.titulo.localeCompare(b.p.titulo, "pt-BR"); });
  var raci = [["Mapear e escrever o POP","A","R","C","I"],["Revisar conteúdo técnico","R","C","C","I"],["Aprovar e publicar","A","I","I","R"],["Executar o procedimento","A","I","R","I"],["Medir indicadores","A","R","C","I"],["Revisão periódica e melhoria","A","R","C","C"]];
  var cab = ["Dono do processo", "Analista de processos", "Executor", "Escritório de processos"];
  var fluxo = '<div class="fluxo-st"><span class="pill rascunho">Rascunho</span><span class="seta">→</span><span class="pill revisao">Em revisão</span><span class="seta">→</span><span class="pill aprovado">Aprovado</span><span class="seta">→</span><span class="chip">revisão periódica (nova versão)</span><span class="seta">·</span><span class="pill obsoleto">Obsoleto</span></div>';
  $("#gvGrid").className = "pn-grid pn-anim";
  $("#gvGrid").innerHTML =
    '<section class="pn-card pn-span2"><div class="pn-card-head"><h3>Política de governança dos POPs</h3><span class="sub">vale para os 11 departamentos</span></div><div class="pn-card-body" style="gap:12px">' + fluxo +
      '<ul class="regras">' +
        '<li><b>Metodologia:</b> todo POP segue a hierarquia e as regras de nomenclatura da <button type="button" class="linkish" data-ir="met">Metodologia CBOK</button>.</li>' +
        '<li><b>Codificação:</b> POP-SIGLA-000 pelo departamento (ex.: POP-DP-001, POP-FSN-001), gerada automaticamente e nunca reaproveitada.</li>' +
        '<li><b>Variações:</b> um cenário pode ter mais de um POP quando há métodos diferentes (ex.: sistema A e sistema B); cada um indica o método.</li>' +
        '<li><b>Dono do processo obrigatório:</b> é quem responde pelo resultado e aprova as mudanças de conteúdo.</li>' +
        '<li><b>Aprovação:</b> só a coordenação (escritório de processos) publica. Analistas escrevem e enviam para revisão.</li>' +
        '<li><b>Controle de versão:</b> cada revisão de um POP aprovado abre a versão seguinte (1.0 → 1.1) e fica no histórico.</li>' +
        '<li><b>Revisão periódica:</b> a cada ' + REV_PADRAO + ' meses por padrão (3, 6 ou 24 meses quando o risco pedir).</li>' +
        '<li><b>Desempenho:</b> todo POP aprovado deve ter ao menos um indicador com meta e os principais riscos com controle.</li>' +
      '</ul></div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Requisitos de conformidade</h3><span class="sub">' + REQS.length + ' itens · base do percentual</span></div><div class="pn-card-body"><ul class="regras">' + REQS.map(function(r){ return '<li>' + esc(r[0]) + '</li>'; }).join("") + '</ul></div></section>' +
    '<section class="pn-card pn-span2"><div class="pn-card-head"><h3>Papéis e responsabilidades</h3><span class="sub">matriz RACI · R executa · A responde · C é consultado · I é informado</span></div><div class="pn-card-body flush"><div class="tbl-wrap"><table class="raci"><thead><tr><th>Atividade</th>' + cab.map(function(c){ return '<th>' + c + '</th>'; }).join("") + '</tr></thead><tbody>' + raci.map(function(r){ return '<tr><td>' + esc(r[0]) + '</td>' + r.slice(1).map(function(x){ return '<td><b class="' + x + '">' + x + '</b></td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table></div></div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Ciclo de vida BPM</h3><span class="sub">as 6 fases do CBOK</span></div><div class="pn-card-body"><ol class="regras">' + FASES.map(function(f){ return '<li><b>' + esc(f.l) + ':</b> ' + esc(f.d.toLowerCase()) + '.</li>'; }).join("") + '</ol></div></section>' +
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Áreas de conhecimento do BPM CBOK</h3><span class="sub">como cada uma aparece no POP Master</span></div><div class="pn-card-body"><div class="ka">' + AREAS.map(function(a, i){ return '<div><em>' + pad2(i + 1) + '</em><b>' + esc(a[0]) + '</b><small>' + esc(a[1]) + '</small></div>'; }).join("") + '</div></div></section>' +
    '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Conformidade por POP</h3><span class="sub">do menos ao mais completo · clique para abrir</span></div><div class="pn-card-body">' +
      (ps.map(function(x, i){ var det = problemasNome(x.p).concat(problemasGateway(x.p)); return '<button type="button" class="cf-item" style="--k:' + i + '" data-ver="' + x.p.id + '"><span style="min-width:0"><span class="dp-cell-main">' + esc(x.p.codigo) + ' · ' + esc(x.p.titulo) + '</span><span class="dp-cell-sub">' + esc(x.p.departamento) + ' · ' + esc(ST[x.p.status].l) + ' · dono: ' + esc(x.p.dono || "—") + '</span></span><span class="score ' + scoreCls(x.c.pct) + '">' + x.c.pct + '%</span>' + (x.c.faltas.length ? '<span class="faltas">' + x.c.faltas.map(function(f){ return '<span class="pill pill-late">' + esc(f) + '</span>'; }).join("") + det.map(function(f){ return '<span class="pill pill-today">' + esc(f) + '</span>'; }).join("") + '</span>' : '') + '</button>'; }).join("") || '<p class="empty-mini">Nenhum POP ativo.</p>') +
    '</div></section>';
}

/* ============ FICHA DO POP (leitura) ============ */
function lst(a){ return a.length ? '<ul>' + a.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '<span class="vz">—</span>'; }
function passosLista(p){
  return '<ol class="passos">' + p.passos.map(function(x){
    return '<li class="' + (x.tipo === "decisao" ? "dec" : "") + '"><div>' + esc(x.texto) + (x.tipo === "decisao" ? '<div class="ram">' + x.ramos.map(function(r){ return '<span><b>' + esc(r.rotulo) + ':</b> ' + (r.nota ? esc(r.nota) + ' → ' : '') + '<i>' + esc(destinoRot(p, r.destino)) + '</i></span>'; }).join("") + '</div>' : '') + '</div><span class="resp">' + esc(x.resp) + '</span></li>';
  }).join("") + '</ol>';
}
function docHtml(p, imprimir){
  var c = conformidade(p), venc = vencida(p), nomes = problemasNome(p).concat(problemasGateway(p));
  var dl = function(t, v){ return '<dl><dt>' + t + '</dt><dd>' + (v ? esc(v) : '<span class="dp-cell-sub">—</span>') + '</dd></dl>'; };
  var temDec = p.passos.some(function(x){ return x.tipo === "decisao"; });
  return '<div class="doc">' +
    '<div class="doc-topo"><div><div class="trilha">' + esc(caminho(p)) + ' › <b>' + esc(p.cenario) + '</b>' + (p.variacao ? ' · método: ' + esc(p.variacao) : '') + '</div><h3>' + esc(p.titulo) + '</h3></div>' +
      '<div class="meta"><span class="cod">' + esc(p.codigo) + ' · v' + esc(p.versao) + '</span><span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span>' + (venc ? '<span class="pill vencida">Revisão vencida</span>' : '') + '<span class="chip">' + esc(FASE[p.fase].l) + '</span></div></div>' +
    '<div class="doc-sec"><h4>Objetivo</h4><p>' + (esc(p.objetivo) || '<span class="dp-cell-sub">—</span>') + '</p></div>' +
    '<div class="doc-sec"><h4>Procedimento · ' + plural(p.passos.length, "passo") + '</h4>' +
      (p.passos.length ? (imprimir ? passosLista(p) + (temDec ? '<div class="fluxo-box">' + fluxoSvg(p.passos) + '</div>' : '') :
        '<div class="seg" role="group" aria-label="Como ver o procedimento" style="margin-bottom:8px"><button type="button" class="on" data-pv="lista">Lista</button><button type="button" data-pv="fluxo">Fluxograma</button></div><div data-pvb="lista">' + passosLista(p) + '</div><div data-pvb="fluxo" hidden><div class="fluxo-box">' + fluxoSvg(p.passos) + '</div></div>')
      : '<p class="dp-cell-sub">Nenhum passo cadastrado.</p>') + '</div>' +
    '<div class="doc-sec"><h4>Arquitetura</h4><div class="ident">' + dl("Departamento", p.departamento) + dl("Setor", p.setor) + dl("Atividade", p.atividade) + dl("Tarefa", p.tarefa) + dl("Cenário", p.cenario) + '</div></div>' +
    '<div class="doc-sec"><h4>Quem faz, quando e quanto tempo</h4><div class="ident">' + dl("Dono do processo", p.dono) + dl("Executor (papel)", p.executor) + dl("Aprovador", p.aprovadoPor || p.aprovador) + dl("Aprovado em", dataBR(p.aprovadoEm)) + dl("Próxima revisão", p.proxRevisao ? dataBR(p.proxRevisao) + " (a cada " + p.revisaoMeses + " meses)" : "") + dl("Frequência", p.frequencia) + dl("Tempo médio", p.tempoMedio) + dl("Evento que inicia", p.gatilho) + '</div></div>' +
    '<div class="doc-sec"><h4>Escopo e aplicação</h4><p>' + (esc(p.escopo) || '<span class="dp-cell-sub">—</span>') + '</p></div>' +
    '<div class="doc-sec"><h4>SIPOC</h4><div class="sipoc"><div><b>S <span>Fornecedores</span></b>' + lst(p.fornecedores) + '</div><div><b>I <span>Entradas</span></b>' + lst(p.entradas) + '</div><div><b>P <span>Sistemas e materiais</span></b>' + lst(p.sistemas) + '</div><div><b>O <span>Saídas</span></b>' + lst(p.saidas) + '</div><div><b>C <span>Clientes</span></b>' + lst(p.clientes) + '</div></div></div>' +
    '<div class="doc-sec"><h4>Indicadores de desempenho</h4>' + (p.indicadores.length ? '<table class="tbl-mini"><thead><tr><th>Indicador</th><th>Meta</th></tr></thead><tbody>' + p.indicadores.map(function(k){ return '<tr><td>' + esc(k.nome) + '</td><td>' + esc(k.meta || "—") + '</td></tr>'; }).join("") + '</tbody></table>' : '<p class="dp-cell-sub">Nenhum indicador.</p>') + '</div>' +
    '<div class="doc-sec"><h4>Riscos e controles</h4>' + (p.riscos.length ? '<table class="tbl-mini"><thead><tr><th>Risco</th><th>Nível</th><th>Controle</th></tr></thead><tbody>' + p.riscos.map(function(r){ return '<tr><td>' + esc(r.risco) + '</td><td><span class="pill ' + (r.nivel === "Alto" ? "pill-late" : r.nivel === "Médio" ? "pill-today" : "pill-ok") + '">' + esc(r.nivel) + '</span></td><td>' + esc(r.controle || "—") + '</td></tr>'; }).join("") + '</tbody></table>' : '<p class="dp-cell-sub">Nenhum risco mapeado.</p>') + '</div>' +
    (imprimir ? '' : '<div class="doc-sec"><h4>Conformidade · ' + c.pct + '%</h4>' + (c.faltas.length ? '<div class="faltas">' + c.faltas.map(function(f){ return '<span class="pill pill-late">Falta: ' + esc(f) + '</span>'; }).join("") + nomes.map(function(f){ return '<span class="pill pill-today">' + esc(f) + '</span>'; }).join("") + '</div>' : '<p class="note">Atende a todos os requisitos da metodologia e da governança.</p>') + '</div>') +
    '<div class="doc-sec"><h4>Histórico de versões</h4>' + (p.historico.length ? '<ul class="hist">' + p.historico.slice().reverse().map(function(h){ return '<li><span class="mono">v' + esc(h.v) + '</span><span>' + esc(dataBR(h.data)) + '</span><span>' + esc(h.nota) + (h.por ? ' — ' + esc(h.por) : '') + '</span></li>'; }).join("") + '</ul>' : '<p class="dp-cell-sub">Sem registros.</p>') + '</div>' +
  '</div>';
}
document.addEventListener("click", function(e){
  var b = e.target.closest("[data-pv]"); if(!b) return;
  var box = b.closest(".doc-sec"), v = b.getAttribute("data-pv");
  $$("[data-pv]", box).forEach(function(x){ x.classList.toggle("on", x === b); });
  $$("[data-pvb]", box).forEach(function(x){ x.hidden = x.getAttribute("data-pvb") !== v; });
});
var verId = null;
function abrirPop(id){
  var p = S.pops[id]; if(!p) return;
  verId = id;
  var d = $("#dlgVer"), ed = podeEditar(), gs = ehGestor(), bts = [];
  if(gs) bts.push('<button type="button" class="linkish red esq" data-ac="excluir">Excluir</button>'); else bts.push('<span class="esq"></span>');
  bts.push('<button type="button" class="fbtn" data-ac="imprimir">Imprimir / PDF</button>');
  if(ed) bts.push('<button type="button" class="fbtn" data-ac="variacao" title="Novo POP no mesmo cenário, para outro método de execução">Nova variação</button>');
  if(ed) bts.push('<button type="button" class="fbtn" data-ac="duplicar">Duplicar</button>');
  if(p.status === "rascunho" && ed) bts.push('<button type="button" class="fbtn" data-ac="enviar">Enviar para revisão</button>');
  if(p.status === "revisao" && gs) bts.push('<button type="button" class="fbtn" data-ac="devolver">Devolver para rascunho</button>');
  if(p.status === "aprovado" && ed) bts.push('<button type="button" class="fbtn" data-ac="revisar">Iniciar revisão (v' + esc(subirVersao(p.versao)) + ')</button>');
  if(p.status === "aprovado" && gs) bts.push('<button type="button" class="fbtn" data-ac="obsoleto">Tornar obsoleto</button>');
  if(p.status === "obsoleto" && gs) bts.push('<button type="button" class="fbtn" data-ac="reativar">Reativar como rascunho</button>');
  if(p.status !== "obsoleto" && ed) bts.push('<button type="button" class="' + (p.status === "revisao" && gs ? "fbtn" : "btn") + '" data-ac="editar">Editar</button>');
  if(p.status === "revisao" && gs) bts.push('<button type="button" class="btn" data-ac="aprovar">Aprovar e publicar</button>');
  marcarRecente(id);
  var li = lidoInfo(id), liOk = li && li.v === p.versao;
  var barra = '<div class="ficha-bar"><button type="button" class="btn btn-exec" data-exec="' + p.id + '"' + (p.passos.length ? '' : ' disabled') + '>▶ Executar passo a passo</button>' +
    '<button type="button" class="fbtn' + (ehFav(p.id) ? ' on' : '') + '" data-ac="fav" aria-pressed="' + ehFav(p.id) + '">' + (ehFav(p.id) ? '★ Favorito' : '☆ Favoritar') + '</button>' +
    (p.status === "aprovado" ? '<button type="button" class="fbtn' + (liOk ? ' on' : '') + '" data-ac="lido" aria-pressed="' + !!liOk + '">' + (liOk ? '✓ Li e entendi' : li ? 'Reler: nova versão' : 'Marcar como lido') + '</button>' : '<span class="pill ' + p.status + '">Ainda não aprovado: use com cuidado</span>') +
    '<span class="ficha-quem">' + (p.dono ? 'Dúvidas: <b>' + esc(p.dono) + '</b>' : '') + '</span></div>';
  d.innerHTML = '<div class="dlg-head"><h2>' + esc(p.codigo) + '</h2><button type="button" class="x" data-ac="fechar" aria-label="Fechar">✕</button></div><div class="dlg-body">' + barra + docHtml(p) + '</div><div class="dlg-acoes">' + bts.join("") + '</div>';
  if(!d.open) d.showModal();
  d.querySelector(".dlg-body").scrollTop = 0;
}
function mudar(p, fn, nota, msg){
  var x = JSON.parse(JSON.stringify(p)); fn(x); hist(x, nota);
  return gravar(x).then(function(){ if(msg) toast(msg); if($("#dlgVer").open && verId === x.id) setTimeout(function(){ if(S.pops[x.id]) abrirPop(x.id); }, 60); });
}
function copiaNova(p){ var c = JSON.parse(JSON.stringify(p)); c.id = ""; c.codigo = ""; c.status = "rascunho"; c.versao = "1.0"; c.historico = []; c.aprovadoEm = ""; c.aprovadoPor = ""; c.proxRevisao = ""; c.fase = "desenho"; return c; }
$("#dlgVer").addEventListener("click", function(e){
  var b = e.target.closest("[data-ac]"); if(!b) return;
  var p = S.pops[verId], ac = b.getAttribute("data-ac"), d = $("#dlgVer");
  if(ac === "fechar"){ d.close(); return; }
  if(!p) return;
  if(ac === "fav"){ var on = alternarFav(p.id); toast(on ? "Adicionado aos favoritos." : "Removido dos favoritos."); abrirPop(p.id); render(); return; }
  if(ac === "lido"){ var l = lidoInfo(p.id), ja = l && l.v === p.versao; marcarLido(p, !ja).then(function(){ if($("#dlgVer").open) abrirPop(p.id); }); return; }
  if(ac === "imprimir"){ $("#printArea").innerHTML = docHtml(p, true); window.print(); return; }
  if(ac === "editar"){
    if(p.status === "aprovado"){ confirmar("Este POP está aprovado. Editar abre a revisão v" + subirVersao(p.versao) + " e ele volta para aprovação.", "Abrir revisão").then(function(ok){ if(ok){ d.close(); abrirEditor(p, true); } }); return; }
    d.close(); abrirEditor(p); return;
  }
  if(ac === "duplicar"){ var c = copiaNova(p); c.cenario = ""; c.titulo = ""; d.close(); abrirEditor(c); toast("Escolha o novo cenário: o restante veio do POP original."); return; }
  if(ac === "variacao"){ var v = copiaNova(p); v.variacao = ""; v.titulo = p.titulo; d.close(); abrirEditor(v); toast("Informe o método desta variação (ex.: sistema B)."); return; }
  if(ac === "enviar") mudar(p, function(x){ x.status = "revisao"; if(x.fase === "planejamento" || x.fase === "analise") x.fase = "desenho"; }, "Enviado para revisão", "POP enviado para revisão.");
  if(ac === "devolver") mudar(p, function(x){ x.status = "rascunho"; }, "Devolvido para rascunho", "POP devolvido para rascunho.");
  if(ac === "revisar") mudar(p, function(x){ x.status = "revisao"; x.versao = subirVersao(x.versao); x.fase = "refinamento"; }, "Revisão aberta", "Revisão aberta: agora é a versão " + subirVersao(p.versao) + ".");
  if(ac === "aprovar"){
    var cf = conformidade(p), pre = cf.faltas.length ? "Ainda falta: " + cf.faltas.join(", ") + ".\n\n" : "";
    confirmar(pre + "Aprovar a versão " + p.versao + " e publicar? A próxima revisão fica para " + dataBR(somaMeses(hojeS(), p.revisaoMeses)) + ".", "Aprovar e publicar").then(function(ok){
      if(ok) mudar(p, function(x){ x.status = "aprovado"; x.aprovadoEm = hojeS(); x.aprovadoPor = eu(); x.proxRevisao = somaMeses(hojeS(), x.revisaoMeses); x.fase = x.fase === "refinamento" || x.fase === "monitoramento" ? "monitoramento" : "implementacao"; }, "Aprovado e publicado", "POP aprovado e publicado.");
    });
  }
  if(ac === "obsoleto") confirmar("Tornar “" + p.titulo + "” obsoleto? Ele sai do catálogo ativo, mas o histórico fica guardado.", "Tornar obsoleto").then(function(ok){ if(ok) mudar(p, function(x){ x.status = "obsoleto"; }, "Tornado obsoleto", "POP marcado como obsoleto."); });
  if(ac === "reativar") mudar(p, function(x){ x.status = "rascunho"; x.versao = subirVersao(x.versao); x.fase = "desenho"; }, "Reativado como rascunho", "POP reativado como rascunho.");
  if(ac === "excluir") confirmar("Excluir “" + p.titulo + "” de vez? Prefira “Tornar obsoleto” para manter o histórico.", "Excluir").then(function(ok){
    if(!ok) return;
    var copia = JSON.parse(JSON.stringify(p)); delete copia.id;
    banco.del(p.id).then(function(){ d.close(); toast("POP excluído.", "Desfazer", function(){ banco.set(p.id, copia); }); }, function(){ toast("Não foi possível excluir."); });
  });
});

/* ============ EDITOR ============ */
function vazio(){ return normPop({status: "rascunho", fase: "planejamento", departamento: S.ct.dep || "", passos: [], historico: []}, ""); }
var ED = {pop: null, passos: [], revisao: false, tituloManual: false, vis: "lista"};
function optsDestino(i, atual){
  var o = '<option value=""' + (!atual ? " selected" : "") + '>Próximo passo</option>';
  ED.passos.forEach(function(p, j){ if(j !== i) o += '<option value="' + esc(p.id) + '"' + (atual === p.id ? " selected" : "") + '>Ir para o passo ' + (j + 1) + (p.texto ? ' — ' + esc(p.texto.slice(0, 40)) : '') + '</option>'; });
  return o + '<option value="fim"' + (atual === "fim" ? " selected" : "") + '>Encerrar o POP</option>';
}
function htmlPassos(){
  if(!ED.passos.length) return '<p class="empty-mini">Nenhum passo ainda. Comece pelo primeiro verbo: “Acessar…”, “Conferir…”.</p>';
  return ED.passos.map(function(x, i){
    var dec = x.tipo === "decisao";
    return '<div class="lin ps' + (dec ? " dec" : "") + '" data-id="' + esc(x.id) + '"><span class="num">' + (i + 1) + '</span><select data-k="tipo" aria-label="Tipo do passo ' + (i + 1) + '"><option value="acao"' + (dec ? "" : " selected") + '>Ação</option><option value="decisao"' + (dec ? " selected" : "") + '>Decisão</option></select>' +
      '<input class="tx" data-k="texto" maxlength="400" placeholder="' + (dec ? "Pergunta (ex.: Cliente entregou a documentação?)" : "Ação com verbo no infinitivo (ex.: Acessar o sistema)") + '" value="' + esc(x.texto) + '"><input class="rp" data-k="resp" maxlength="80" placeholder="Responsável" value="' + esc(x.resp) + '">' +
      '<span class="acs"><button type="button" data-mv="-1" aria-label="Subir passo ' + (i + 1) + '" title="Subir">↑</button><button type="button" data-mv="1" aria-label="Descer passo ' + (i + 1) + '" title="Descer">↓</button><button type="button" data-rm aria-label="Remover passo ' + (i + 1) + '" title="Remover">✕</button></span>' +
      (dec ? '<div class="ramos">' + x.ramos.map(function(r, k){ return '<div class="ramo" data-r="' + k + '"><input data-rk="rotulo" maxlength="40" placeholder="Resposta (ex.: Sim)" value="' + esc(r.rotulo) + '"><input data-rk="nota" maxlength="200" placeholder="Nota de ação (ex.: criar pendência)" value="' + esc(r.nota) + '"><select data-rk="destino" aria-label="Destino do ramo">' + optsDestino(i, r.destino) + '</select><button type="button" class="ramo-x" data-rmr="' + k + '" aria-label="Remover ramo" title="Remover ramo">✕</button></div>'; }).join("") + '<button type="button" class="linkish" data-addr>+ ramo</button></div>' : '') +
    '</div>';
  }).join("");
}
function lerPassosDom(){
  var m = {}; ED.passos.forEach(function(p){ m[p.id] = p; });
  ED.passos = $$("#edPassos .lin.ps").map(function(l){
    var p = m[l.getAttribute("data-id")] || {id: l.getAttribute("data-id"), ramos: []};
    p.tipo = l.querySelector('[data-k="tipo"]').value; p.texto = l.querySelector('[data-k="texto"]').value; p.resp = l.querySelector('[data-k="resp"]').value;
    if(p.tipo === "decisao"){ var rs = $$(".ramo", l); if(rs.length) p.ramos = rs.map(function(r){ return {rotulo: r.querySelector('[data-rk="rotulo"]').value, nota: r.querySelector('[data-rk="nota"]').value, destino: r.querySelector('[data-rk="destino"]').value}; }); }
    return p;
  });
}
function desenharPassos(){
  $("#edPassos").innerHTML = htmlPassos();
  var vis = ED.vis === "fluxo";
  $("#edPassos").hidden = vis; $("#edFluxo").hidden = !vis;
  $$("[data-edv]").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-edv") === ED.vis); });
  if(vis){ var ps = ED.passos.map(normPasso).filter(function(x){ return x.texto; }); $("#edFluxo").innerHTML = ps.length ? '<div class="fluxo-box">' + fluxoSvg(ps) + '</div>' : '<p class="empty-mini">Escreva os passos para ver o fluxograma.</p>'; }
  avisosNome();
}
function linhaKpi(k){ return '<div class="lin kp"><input data-k="nome" maxlength="160" placeholder="Indicador (ex.: % de folhas fechadas no prazo)" value="' + esc(k.nome) + '"><input data-k="meta" maxlength="80" placeholder="Meta (ex.: ≥ 98%)" value="' + esc(k.meta) + '"><span class="acs"><button type="button" data-rmk aria-label="Remover indicador">✕</button></span></div>'; }
function linhaRisco(r){ return '<div class="lin rk"><input data-k="risco" maxlength="200" placeholder="Risco" value="' + esc(r.risco) + '"><input data-k="controle" maxlength="200" placeholder="Controle" value="' + esc(r.controle) + '"><select data-k="nivel" aria-label="Nível do risco">' + ["Baixo","Médio","Alto"].map(function(n){ return '<option' + (n === r.nivel ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select><span class="acs"><button type="button" data-rmk aria-label="Remover risco">✕</button></span></div>'; }
function lerLinhas(sel){ return $$(sel + " .lin").map(function(l){ var o = {}; $$("[data-k]", l).forEach(function(i){ o[i.getAttribute("data-k")] = i.value; }); return o; }); }
function rascunhoEditor(){
  var f = $("#fEd"); if(!f) return null;
  lerPassosDom();
  var v = function(k){ return f[k].value.trim(); };
  return normPop({departamento: f.departamento.value, setor: v("setor"), atividade: v("atividade"), tarefa: v("tarefa"), cenario: v("cenario"), titulo: v("titulo") || modeloTitulo(v("tarefa"), v("cenario") || "Padrão"), passos: ED.passos}, "x");
}
function avisosNome(){
  var box = $("#edAvisos"), p = rascunhoEditor(); if(!box || !p) return;
  var r = problemasNome(p).filter(function(x){ return x !== "Departamento fora da lista oficial" || $("#fEd").departamento.value; }).concat(problemasGateway(p));
  box.innerHTML = r.length ? '<div class="aviso"><div><b>Pela metodologia:</b><ul>' + r.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div></div>' : (p.tarefa ? '<div class="aviso ok"><div>Nomenclatura de acordo com a metodologia.</div></div>' : '');
  var ft = $("#fEd").titulo; if(!ED.tituloManual) ft.placeholder = p.tarefa ? modeloTitulo(p.tarefa, p.cenario) : "Procedimento para [Tarefa] no(a) [Cenário]";
}
function abrirEditor(p, abrirRevisao){
  if(!podeEditar()){ toast("Você não tem permissão para editar POPs."); return; }
  p = p ? JSON.parse(JSON.stringify(p)) : vazio();
  ED.pop = p; ED.revisao = !!abrirRevisao; ED.passos = JSON.parse(JSON.stringify(p.passos || [])); ED.vis = "lista";
  ED.tituloManual = !!p.titulo && p.id && p.titulo !== modeloTitulo(p.tarefa, p.cenario);
  var d = $("#dlgEd"), novo = !p.id;
  var sets = {}, ats = {}, tas = {}, cens = {}, donos = {};
  lista().forEach(function(x){ if(x.setor) sets[x.setor] = 1; if(x.atividade) ats[x.atividade] = 1; if(x.tarefa) tas[x.tarefa] = 1; if(x.cenario && x.cenario !== "Padrão") cens[x.cenario] = 1; if(x.dono) donos[x.dono] = 1; });
  NIVEIS[4].ex.forEach(function(c){ cens[c] = 1; });
  var dlist = function(id, o){ return '<datalist id="' + id + '">' + Object.keys(o).sort().map(function(k){ return '<option value="' + esc(k) + '">'; }).join("") + '</datalist>'; };
  var ta = function(k, rot, v, larg, ph){ return '<label class="campo' + (larg ? " largo" : "") + '">' + rot + '<textarea name="' + k + '" rows="3" placeholder="' + esc(ph || "") + '">' + esc(v) + '</textarea></label>'; };
  var inp = function(k, rot, v, extra, dica){ return '<label class="campo">' + rot + '<input name="' + k + '" value="' + esc(v) + '"' + (extra || "") + '>' + (dica ? '<span class="dica">' + dica + '</span>' : '') + '</label>'; };
  var depAtual = DEP[p.departamento] ? p.departamento : "";
  d.innerHTML = '<div class="dlg-head"><h2>' + (novo ? "Novo POP" : "Editar " + esc(p.codigo)) + (abrirRevisao ? ' · revisão v' + esc(subirVersao(p.versao)) : '') + '</h2><span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span><button type="button" class="x" data-ed="fechar" aria-label="Fechar">✕</button></div>' +
    '<form class="dlg-body" id="fEd" autocomplete="off" novalidate>' +
      '<section class="ed-sec"><h3>Arquitetura <small>Departamento → Setor → Atividade → Tarefa → Cenário</small></h3><div class="campos">' +
        '<label class="campo">Departamento *<select name="departamento"><option value="">Escolha…</option>' + DEPS.map(function(x){ return '<option' + (x.n === depAtual ? " selected" : "") + '>' + esc(x.n) + '</option>'; }).join("") + '</select><span class="dica">área de responsabilidade funcional</span></label>' +
        inp("setor", "Setor *", p.setor, ' list="dlSet" maxlength="120" placeholder="Ex.: Recepção e Gestão de Documentos"', "substantivo de ação") +
        inp("atividade", "Atividade *", p.atividade, ' list="dlAt" maxlength="120" placeholder="Ex.: Recebimento de Documentos"', "substantivo de ação") +
        inp("tarefa", "Tarefa *", p.tarefa, ' list="dlTa" maxlength="160" placeholder="Ex.: Receber documentos do cliente"', "verbo no infinitivo") +
        inp("cenario", "Cenário *", p.cenario === "Padrão" && novo ? "" : p.cenario, ' list="dlCen" maxlength="120" placeholder="Ex.: Rotina Mensal"', "substantivo de contexto") +
        inp("variacao", "Método (variação)", p.variacao, ' maxlength="80" placeholder="Ex.: Sistema Domínio"', "só quando o cenário tem mais de um POP") +
      '</div>' + dlist("dlSet", sets) + dlist("dlAt", ats) + dlist("dlTa", tas) + dlist("dlCen", cens) + dlist("dlDono", donos) + '</section>' +
      '<section class="ed-sec"><h3>POP <small>Procedimento para + [Tarefa] + no(a) + [Cenário]</small></h3><div class="campos">' +
        '<label class="campo largo">Título do POP<input name="titulo" maxlength="160" value="' + esc(ED.tituloManual ? p.titulo : "") + '"><span class="dica">em branco: segue o modelo da metodologia automaticamente</span></label>' +
        inp("codigo", "Código", p.codigo, ' maxlength="30" placeholder="gerado ao salvar"') + inp("dono", "Dono do processo *", p.dono, ' list="dlDono" maxlength="80"') + inp("executor", "Executor (papel)", p.executor, ' maxlength="120" placeholder="Ex.: Analista Contábil"') + inp("aprovador", "Aprovador previsto", p.aprovador, ' list="dlDono" maxlength="80"') +
        '<label class="campo">Fase do ciclo de vida<select name="fase">' + FASES.map(function(f){ return '<option value="' + f.k + '"' + (f.k === p.fase ? " selected" : "") + '>' + f.i + '. ' + esc(f.l) + '</option>'; }).join("") + '</select></label>' +
        inp("frequencia", "Frequência", p.frequencia, ' maxlength="60" placeholder="Ex.: Mensal"') + inp("tempoMedio", "Tempo médio", p.tempoMedio, ' maxlength="40" placeholder="Ex.: 40 min por empresa"') +
        '<label class="campo">Revisão periódica<select name="revisaoMeses">' + [3,6,12,24].map(function(m){ return '<option value="' + m + '"' + (m === p.revisaoMeses ? " selected" : "") + '>A cada ' + m + ' meses</option>'; }).join("") + '</select></label>' +
        '<label class="campo largo">Evento que inicia<input name="gatilho" maxlength="200" placeholder="Ex.: Recebimento dos documentos do mês" value="' + esc(p.gatilho) + '"></label>' +
        '<label class="campo largo">Palavras-chave para a busca<input name="palavras" maxlength="240" placeholder="Ex.: holerite, contracheque, salário, folha mensal" value="' + esc(p.palavras) + '"><span class="dica">sinônimos e termos que a equipe usa no dia a dia: ajudam quem é novo a achar este POP</span></label>' +
        '<label class="chk campo largo"><input type="checkbox" name="essencial"' + (p.essencial ? " checked" : "") + '> Essencial para novos colaboradores (entra na trilha de integração do departamento)</label>' +
      '</div><div id="edAvisos"></div></section>' +
      '<section class="ed-sec"><h3>Objetivo e escopo</h3><div class="campos">' + ta("objetivo", "Objetivo *", p.objetivo, true, "Para que serve este procedimento e qual resultado ele garante.") + ta("escopo", "Escopo e aplicação", p.escopo, true, "Onde se aplica, o que fica de fora, exceções.") + '</div></section>' +
      '<section class="ed-sec"><h3>SIPOC <small>um item por linha</small></h3><div class="campos">' + ta("fornecedores", "Fornecedores", p.fornecedores.join("\n")) + ta("entradas", "Entradas", p.entradas.join("\n")) + ta("sistemas", "Sistemas e materiais", p.sistemas.join("\n")) + ta("saidas", "Saídas", p.saidas.join("\n")) + ta("clientes", "Clientes", p.clientes.join("\n")) + '</div></section>' +
      '<section class="ed-sec"><h3>Passos <small>ação indivisível, verbo no infinitivo · decisão = pergunta com ramos</small></h3>' +
        '<div class="seg" role="group" aria-label="Como ver os passos" style="align-self:flex-start"><button type="button" class="on" data-edv="lista">Lista</button><button type="button" data-edv="fluxo">Fluxograma</button></div>' +
        '<div class="linhas" id="edPassos"></div><div id="edFluxo" hidden></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="fbtn" data-add="acao">+ Passo de ação</button><button type="button" class="fbtn" data-add="decisao">+ Passo de decisão</button><button type="button" class="linkish" data-colar>Colar vários passos</button></div></section>' +
      '<section class="ed-sec"><h3>Indicadores de desempenho</h3><div class="linhas" id="edKpis">' + p.indicadores.map(linhaKpi).join("") + '</div><div><button type="button" class="fbtn" data-addk="kpi">+ Indicador</button></div></section>' +
      '<section class="ed-sec"><h3>Riscos e controles</h3><div class="linhas" id="edRiscos">' + p.riscos.map(linhaRisco).join("") + '</div><div><button type="button" class="fbtn" data-addk="risco">+ Risco</button></div></section>' +
      '<label class="campo">Nota desta alteração (vai para o histórico)<input name="nota" maxlength="200" placeholder="' + (novo ? "Criação do POP" : "Ex.: inclusão do passo de conferência") + '"></label>' +
    '</form>' +
    '<div class="dlg-acoes"><button type="button" class="fbtn" data-ed="fechar">Cancelar</button>' + (p.status === "rascunho" ? '<button type="button" class="fbtn" data-ed="salvarEnviar">Salvar e enviar para revisão</button>' : '') + '<button type="button" class="btn" data-ed="salvar">Salvar</button></div>';
  if(!d.open) d.showModal();
  desenharPassos();
  var f = $("#fEd"); (novo && !p.departamento ? f.departamento : novo && !p.cenario ? f.cenario : f.setor).focus();
}
$("#dlgEd").addEventListener("input", function(e){ if(e.target.name === "titulo") ED.tituloManual = !!e.target.value.trim(); if(e.target.closest("#edPassos") || ["setor","atividade","tarefa","cenario","titulo"].indexOf(e.target.name) !== -1){ clearTimeout(ED.t); ED.t = setTimeout(avisosNome, 250); } });
$("#dlgEd").addEventListener("change", function(e){
  if(e.target.matches('#edPassos select[data-k="tipo"]')){ lerPassosDom(); var p = ED.passos.filter(function(x){ return x.id === e.target.closest(".lin").getAttribute("data-id"); })[0]; if(p && p.tipo === "decisao" && (!p.ramos || p.ramos.length < 2)) p.ramos = [{rotulo:"Sim", nota:"", destino:""}, {rotulo:"Não", nota:"", destino:"fim"}]; desenharPassos(); }
  else if(e.target.name === "departamento") avisosNome();
});
$("#dlgEd").addEventListener("click", function(e){
  var d = $("#dlgEd"), b;
  if((b = e.target.closest("[data-edv]"))){ lerPassosDom(); ED.vis = b.getAttribute("data-edv"); desenharPassos(); return; }
  if((b = e.target.closest("[data-add]"))){
    lerPassosDom(); var dec = b.getAttribute("data-add") === "decisao";
    ED.passos.push({id: uid("s"), tipo: dec ? "decisao" : "acao", texto: "", resp: ED.passos.length ? ED.passos[ED.passos.length - 1].resp : "", ramos: dec ? [{rotulo:"Sim", nota:"", destino:""}, {rotulo:"Não", nota:"", destino:"fim"}] : []});
    ED.vis = "lista"; desenharPassos(); var ls = $$("#edPassos .lin"); ls[ls.length - 1].querySelector(".tx").focus(); return;
  }
  if(e.target.closest("[data-colar]")){
    var txt = prompt("Cole os passos, um por linha:"); if(!txt) return;
    lerPassosDom(); linhas(txt).forEach(function(l){ var t = l.replace(/^\d+[.)-]\s*/, ""); var q = /\?\s*$/.test(t); ED.passos.push({id: uid("s"), tipo: q ? "decisao" : "acao", texto: t, resp: "", ramos: q ? [{rotulo:"Sim", nota:"", destino:""}, {rotulo:"Não", nota:"", destino:"fim"}] : []}); });
    ED.vis = "lista"; desenharPassos(); return;
  }
  if((b = e.target.closest("#edPassos [data-rm]"))){ lerPassosDom(); var id = b.closest(".lin").getAttribute("data-id"); ED.passos = ED.passos.filter(function(x){ return x.id !== id; }); ED.passos.forEach(function(x){ (x.ramos || []).forEach(function(r){ if(r.destino === id) r.destino = ""; }); }); desenharPassos(); return; }
  if((b = e.target.closest("#edPassos [data-mv]"))){
    lerPassosDom(); var id2 = b.closest(".lin").getAttribute("data-id"), i = ED.passos.map(function(x){ return x.id; }).indexOf(id2), j = i + +b.getAttribute("data-mv");
    if(j >= 0 && j < ED.passos.length){ var t2 = ED.passos[i]; ED.passos[i] = ED.passos[j]; ED.passos[j] = t2; }
    desenharPassos(); var nb = $('#edPassos .lin[data-id="' + id2 + '"] [data-mv="' + b.getAttribute("data-mv") + '"]'); if(nb) nb.focus(); return;
  }
  if((b = e.target.closest("[data-addr]"))){ lerPassosDom(); var pid = b.closest(".lin").getAttribute("data-id"); ED.passos.forEach(function(x){ if(x.id === pid) x.ramos.push({rotulo:"", nota:"", destino:""}); }); desenharPassos(); var l2 = $('#edPassos .lin[data-id="' + pid + '"] .ramo:last-of-type input'); if(l2) l2.focus(); return; }
  if((b = e.target.closest("[data-rmr]"))){ lerPassosDom(); var pid2 = b.closest(".lin").getAttribute("data-id"), k = +b.getAttribute("data-rmr"); ED.passos.forEach(function(x){ if(x.id === pid2){ if(x.ramos.length <= 2){ toast("Uma decisão precisa de pelo menos 2 ramos."); return; } x.ramos.splice(k, 1); } }); desenharPassos(); return; }
  if((b = e.target.closest("[data-addk]"))){ var ehK = b.getAttribute("data-addk") === "kpi", box = ehK ? $("#edKpis") : $("#edRiscos"); box.insertAdjacentHTML("beforeend", ehK ? linhaKpi({nome:"", meta:""}) : linhaRisco({risco:"", controle:"", nivel:"Médio"})); box.lastElementChild.querySelector("input").focus(); return; }
  if((b = e.target.closest("[data-rmk]"))){ b.closest(".lin").remove(); return; }
  if((b = e.target.closest("[data-ed]"))){ var ac = b.getAttribute("data-ed"); if(ac === "fechar"){ d.close(); return; } salvarEditor(ac === "salvarEnviar"); }
});
$("#dlgEd").addEventListener("cancel", function(e){ e.preventDefault(); confirmar("Fechar sem salvar?", "Fechar").then(function(ok){ if(ok) $("#dlgEd").close(); }); });
function salvarEditor(enviar){
  var d = $("#dlgEd"), f = $("#fEd"), base = ED.pop, novo = !base.id;
  lerPassosDom();
  var v = function(k){ return f[k].value.trim(); };
  var obrig = [["departamento","Escolha o departamento."],["setor","Informe o setor."],["atividade","Informe a atividade."],["tarefa","Informe a tarefa."],["cenario","Informe o cenário (ex.: Rotina Mensal)."]];
  for(var i = 0; i < obrig.length; i++){ if(!v(obrig[i][0])){ f[obrig[i][0]].focus(); toast(obrig[i][1]); return; } }
  var cen = v("cenario"), titulo = v("titulo") || modeloTitulo(v("tarefa"), cen), cod = v("codigo");
  var mesmo = lista().filter(function(x){ return x.id !== base.id && x.status !== "obsoleto" && norm([x.departamento, x.setor, x.atividade, x.tarefa, x.cenario].join("|")) === norm([v("departamento"), v("setor"), v("atividade"), v("tarefa"), cen].join("|")); });
  if(mesmo.length && !v("variacao")){ toast("Esse cenário já tem o " + mesmo[0].codigo + ". Para outro método, preencha “Método (variação)”."); f.variacao.focus(); return; }
  if(mesmo.some(function(x){ return norm(x.variacao) === norm(v("variacao")); })){ toast("Já existe um POP com esse método neste cenário."); f.variacao.focus(); return; }
  if(cod && lista().some(function(x){ return x.id !== base.id && norm(x.codigo) === norm(cod); })){ toast("Esse código já está em uso."); f.codigo.focus(); return; }
  if(!v("titulo") && v("variacao")) titulo += " (" + v("variacao") + ")";
  var semTexto = ED.passos.filter(function(x){ return !x.texto.trim(); }).length;
  var p = normPop(Object.assign({}, base, {
    departamento: v("departamento"), setor: v("setor"), atividade: v("atividade"), tarefa: v("tarefa"), cenario: cen, variacao: v("variacao"),
    palavras: v("palavras"), essencial: f.essencial.checked,
    titulo: titulo, codigo: cod || (base.codigo && base.departamento === v("departamento") ? base.codigo : proxCodigo(v("departamento"))), dono: v("dono"), executor: v("executor"), aprovador: v("aprovador"),
    fase: f.fase.value, frequencia: v("frequencia"), tempoMedio: v("tempoMedio"), revisaoMeses: +f.revisaoMeses.value, gatilho: v("gatilho"),
    objetivo: f.objetivo.value.trim(), escopo: f.escopo.value.trim(),
    fornecedores: linhas(f.fornecedores.value), entradas: linhas(f.entradas.value), sistemas: linhas(f.sistemas.value), saidas: linhas(f.saidas.value), clientes: linhas(f.clientes.value),
    passos: ED.passos, indicadores: lerLinhas("#edKpis"), riscos: lerLinhas("#edRiscos"), criadoEm: base.criadoEm || hojeS()
  }), base.id || uid());
  var ids = {}; p.passos.forEach(function(x){ ids[x.id] = 1; }); p.passos.forEach(function(x){ x.ramos.forEach(function(r){ if(r.destino && r.destino !== "fim" && !ids[r.destino]) r.destino = ""; }); });
  var nota = v("nota") || (novo ? "Criação do POP" : "Conteúdo atualizado");
  if(ED.revisao && p.status === "aprovado"){ p.versao = subirVersao(p.versao); p.status = "revisao"; p.fase = "refinamento"; nota = "Revisão aberta: " + nota; }
  if(enviar){ p.status = "revisao"; nota += " · enviado para revisão"; }
  hist(p, nota);
  gravar(p).then(function(){
    d.close();
    var aviso = problemasNome(p).length ? " Confira a nomenclatura na aba Governança." : "";
    toast((novo ? "POP " + p.codigo + " criado." : "POP " + p.codigo + " salvo.") + (semTexto ? " Passos em branco foram descartados." : "") + aviso);
    if(novo && S.view !== "catalogo" && S.view !== "arquitetura") irPara("catalogo", {st: "ativos", q: "", dep: "", fase: ""});
  }, function(){});
}
$("#btnNovo").onclick = function(){ abrirEditor(null); };
document.addEventListener("click", function(e){ if(e.target.closest("[data-novo]")) abrirEditor(null); });

/* ============ IMPORTAR ============ */
function lerPlanilha(txt){
  var rows = String(txt || "").replace(/\r/g, "").split("\n").filter(function(l){ return l.trim(); }).map(function(l){ return l.split("\t").map(function(c){ return limpa(c, 400); }); });
  if(rows.length && /setor/i.test(rows[0][1] || "") && /passo/i.test(rows[0][5] || "")) rows.shift();
  var ant = ["", "", "", "", "", ""], grupos = {}, ordem = [], avisos = [], foraLista = {};
  rows.forEach(function(r, i){
    if(r.length < 6){ avisos.push("Linha " + (i + 1) + ": menos de 6 colunas"); return; }
    for(var k = 0; k <= 3; k++) if(!r[k]) r[k] = ant[k];
    if(!r[4]) r[4] = r[3] === ant[3] && ant[4] ? ant[4] : "Padrão";
    ant = r.slice();
    if(!r[5]) return;
    if(!r[0] || !r[1] || !r[2] || !r[3]){ avisos.push("Linha " + (i + 1) + ": departamento, setor, atividade ou tarefa vazio"); return; }
    var dep = depCanon(r[0]); if(!dep){ foraLista[r[0]] = 1; return; }
    var ch = norm([dep, r[1], r[2], r[3], r[4]].join("|"));
    if(!grupos[ch]){ grupos[ch] = {dep: dep, set: r[1], at: r[2], ta: r[3], cen: r[4], passos: []}; ordem.push(ch); }
    grupos[ch].passos.push(r[5]);
  });
  Object.keys(foraLista).forEach(function(d){ avisos.push("Departamento “" + d + "” não é um dos 11 do catálogo: linhas ignoradas"); });
  var existentes = {}; lista().forEach(function(p){ if(p.status !== "obsoleto") existentes[norm([p.departamento, p.setor, p.atividade, p.tarefa, p.cenario].join("|"))] = p; });
  var novos = [], pulados = [];
  ordem.forEach(function(ch){ (existentes[ch] ? pulados : novos).push(grupos[ch]); });
  return {novos: novos, pulados: pulados, avisos: avisos, passos: novos.reduce(function(s, g){ return s + g.passos.length; }, 0)};
}
function renderImportar(){ var b = $("#impOk"); b.disabled = !S.imp || !S.imp.novos.length || !podeEditar(); $("#impTxt").disabled = !podeEditar(); }
$("#impTxt").addEventListener("input", function(){
  var r = $("#impRes");
  if(!this.value.trim()){ S.imp = null; r.innerHTML = ""; renderImportar(); return; }
  S.imp = lerPlanilha(this.value);
  var x = S.imp, deps = {}; x.novos.forEach(function(g){ deps[g.dep] = 1; });
  r.innerHTML = (x.novos.length || x.pulados.length
    ? '<div class="aviso"><div><b>' + plural(x.novos.length, "POP novo", "POPs novos") + '</b> com ' + plural(x.passos, "passo") + ' em ' + plural(Object.keys(deps).length, "departamento") + (x.pulados.length ? ' · ' + plural(x.pulados.length, "cenário já existe", "cenários já existem") + ' e será pulado' + (x.pulados.length === 1 ? "" : "s") : '') + '.</div></div>' +
      (x.novos.length ? '<details><summary>Ver os POPs</summary><ul>' + x.novos.slice(0, 80).map(function(g){ return '<li>' + esc(g.dep + " › " + g.set + " › " + g.ta + " › " + g.cen) + ' (' + g.passos.length + ')</li>'; }).join("") + '</ul></details>' : '')
    : '<div class="aviso erro"><div>Nenhum passo encontrado. Copie as 6 colunas (A a F) do Excel.</div></div>') +
    (x.avisos.length ? '<details open><summary>' + plural(x.avisos.length, "aviso") + '</summary><ul>' + x.avisos.slice(0, 30).map(function(a){ return '<li>' + esc(a) + '</li>'; }).join("") + '</ul></details>' : '');
  renderImportar();
});
$("#impLimpar").onclick = function(){ $("#impTxt").value = ""; S.imp = null; $("#impRes").innerHTML = ""; renderImportar(); };
$("#impOk").onclick = function(){
  var x = S.imp; if(!x || !x.novos.length) return;
  var modelo = $("#impTit").value || "Procedimento para {tarefa} {no/na} {cenario}", dono = limpa($("#impDono").value, 80), criados = [];
  x.novos.forEach(function(g){
    var tit = g.cen === "Padrão" ? modelo.replace(/\s*\{no\/na\}\s*\{cenario\}/i, "").replace(/\s*[–-]?\s*\{cenario\}/i, "") : modelo.replace(/\{no\/na\}/i, prepNo(g.cen)).replace(/\{cenario\}/i, tituloCase(g.cen));
    tit = tit.replace(/\{tarefa\}/i, tituloCase(g.ta)).replace(/\s+/g, " ").trim();
    var p = normPop({departamento: g.dep, setor: g.set, atividade: g.at, tarefa: g.ta, cenario: g.cen, titulo: tit, dono: dono, status: "rascunho", fase: "desenho", passos: g.passos.map(function(t, i){ var q = /\?\s*$/.test(t); return {id: "s" + (i + 1), tipo: q ? "decisao" : "acao", texto: t, ramos: q ? [{rotulo:"Sim", destino:""}, {rotulo:"Não", destino:"fim"}] : []}; }), criadoEm: hojeS()}, uid());
    p.codigo = proxCodigo(p.departamento, criados);
    hist(p, "Importado da planilha de mapeamento");
    criados.push(p);
  });
  var b = this; b.disabled = true;
  var fila = Promise.resolve(), ok = 0;
  criados.forEach(function(p){ fila = fila.then(function(){ return gravar(p).then(function(){ ok++; }); }); });
  fila.then(function(){ toast(plural(ok, "POP criado", "POPs criados") + " em rascunho."); $("#impLimpar").onclick(); irPara("catalogo", {st: "rascunho", q: "", dep: "", fase: ""}); }, function(){ toast(ok + " de " + criados.length + " POPs foram criados. Rode de novo: os existentes são pulados."); b.disabled = false; });
};
function salvarArquivo(nome, texto, tipo){
  var bytes = new TextEncoder().encode(texto);
  return usarCap("downloads").then(function(dl){
    if(!dl) throw {code: "unavailable"};
    var P = noPai();
    if(P){ var pedido = P.JSON.parse(JSON.stringify({filename: nome})), u = new P.Uint8Array(bytes.length); u.set(bytes); pedido.data = new P.Blob([u], {type: tipo}); return dl.save(pedido); }
    return dl.save({filename: nome, data: new Blob([bytes], {type: tipo})});
  }).catch(function(){
    try{ var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], {type: tipo})); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }catch(e){ toast("Não foi possível baixar o arquivo."); }
  });
}
$("#expCsv").onclick = function(){
  var q = function(s){ s = String(s == null ? "" : s); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var out = [["Departamento","Setor","Atividade","Tarefa","Cenário","Passo","Tipo do passo","Código","POP","Situação","Versão"].join(";")];
  ativos().forEach(function(p){ (p.passos.length ? p.passos : [{texto: "", tipo: ""}]).forEach(function(x){ out.push([p.departamento, p.setor, p.atividade, p.tarefa, p.cenario, x.texto, x.tipo === "decisao" ? "Decisão" : x.tipo ? "Ação" : "", p.codigo, p.titulo, ST[p.status].l, p.versao].map(q).join(";")); }); });
  salvarArquivo("pop-master-mapeamento-" + hojeS() + ".csv", "﻿" + out.join("\r\n"), "text/csv");
};
$("#expJson").onclick = function(){ salvarArquivo("pop-master-backup-" + hojeS() + ".json", JSON.stringify(lista(), null, 2), "application/json"); };

/* ============ PESSOA: departamento, favoritos, recentes e leituras ============ */
function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
var FAV = lsGet("pop-fav", []), REC = lsGet("pop-rec", []);
function ehFav(id){ return FAV.indexOf(id) !== -1; }
function alternarFav(id){ var i = FAV.indexOf(id); if(i === -1) FAV.unshift(id); else FAV.splice(i, 1); FAV = FAV.slice(0, 40); lsSet("pop-fav", FAV); return i === -1; }
function marcarRecente(id){ REC = [id].concat(REC.filter(function(x){ return x !== id; })).slice(0, 8); lsSet("pop-rec", REC); }
var EU_ID = "";
function meuId(){
  if(EU_ID) return EU_ID;
  var A = AUTH(), u = A && A.usuario ? A.usuario() : null, id = u && u.id ? String(u.id) : "";
  if(!/^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(id)){ id = lsGet("pop-eu-id", ""); if(!id){ id = uid("u"); lsSet("pop-eu-id", id); } }
  return (EU_ID = id);
}
function meuDoc(){ return S.users[meuId()] || {}; }
function meuDep(){ var d = meuDoc().dep || lsGet("pop-meu-dep", ""); return DEP[d] ? d : ""; }
function lidoInfo(id){ var l = (meuDoc().lidos || {})[id]; return l || null; }
function salvarMeuDoc(fn){
  var d = JSON.parse(JSON.stringify(meuDoc())); d.lidos = d.lidos || {}; fn(d); d.nome = eu(); d.em = new Date().toISOString().slice(0, 16);
  S.users[meuId()] = d; render();
  if(!banco) return Promise.resolve();
  return banco.setUser(meuId(), d).catch(function(){ toast("Não foi possível salvar sua trilha agora."); });
}
function definirMeuDep(dep){ lsSet("pop-meu-dep", dep); salvarMeuDoc(function(d){ d.dep = dep; }); }
function marcarLido(p, lido){
  return salvarMeuDoc(function(d){ if(lido) d.lidos[p.id] = {em: hojeS(), v: p.versao}; else delete d.lidos[p.id]; }).then(function(){ toast(lido ? "Registrado: você leu “" + p.titulo + "”." : "Leitura desmarcada."); });
}
function ligarUsuario(){ /* o banco liga depois: ver iniciar() */ }
function progressoTrilha(dep, docU){
  var u = docU || meuDoc(), ess = aprovadosDep(dep).filter(function(p){ return p.essencial; });
  var lidos = ess.filter(function(p){ var l = (u.lidos || {})[p.id]; return l && l.v === p.versao; }).length;
  return {total: ess.length, lidos: lidos};
}
function aprovadosDep(dep){ return dep ? ativos().filter(function(p){ return p.departamento === dep && p.status === "aprovado"; }) : []; }
function primeiroNome(){ var n = String(eu() || "").trim().split(/\s+/)[0]; return n && n !== "Equipe" ? n : ""; }

/* ============ BUSCA ============ */
function palavrasBusca(q){ return norm(q).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(function(w){ return w.length > 1 && ["de","da","do","das","dos","no","na","em","um","uma","o","a","os","as","e","para","por","com","como","que","eu","fazer","faço","faco"].indexOf(w) === -1; }); }
function raiz(w){ return w.length > 4 ? w.replace(/(oes|aes|ais|eis|es|s)$/, "") : w; }
function buscar(q, wsIn){
  var ws = wsIn || palavrasBusca(q); if(!ws.length) return [];
  var pesos = [["titulo",10],["tarefa",8],["palavras",8],["cenario",5],["atividade",4],["setor",3],["departamento",2],["variacao",3],["objetivo",1]];
  return ativos().map(function(p){
    var campos = {}; pesos.forEach(function(c){ campos[c[0]] = norm(p[c[0]]); });
    var passos = p.passos.map(function(x){ return norm(x.texto); }), cod = norm(p.codigo);
    var score = 0, passo = -1, ok = ws.every(function(w){
      var r = raiz(w), achou = false;
      if(cod === w || cod.replace(/-/g, "") === w.replace(/-/g, "")){ score += 30; achou = true; }
      pesos.forEach(function(c){ if(campos[c[0]].indexOf(r) !== -1){ score += c[1]; achou = true; } });
      passos.forEach(function(t, i){ if(t.indexOf(r) !== -1){ score += 2; achou = true; if(passo === -1) passo = i; } });
      return achou;
    });
    if(!ok) return null;
    if(p.status === "aprovado") score += 4; if(p.essencial) score += 2; if(meuDep() && p.departamento === meuDep()) score += 3;
    return {p: p, score: score, passo: passo};
  }).filter(Boolean).sort(function(a, b){ return b.score - a.score || a.p.titulo.localeCompare(b.p.titulo, "pt-BR"); });
}
function marca(txt, ws){
  var t = esc(txt); if(!ws.length) return t;
  var base = norm(txt), marcas = [];
  ws.forEach(function(w){ var r = raiz(w), i = base.indexOf(r); while(i !== -1 && r.length > 1){ var f = i + r.length; while(f < base.length && /[a-z0-9]/.test(base[f])) f++; marcas.push([i, f]); i = base.indexOf(r, f); } });
  if(!marcas.length || base.length !== String(txt).length) return t;
  marcas.sort(function(a, b){ return a[0] - b[0]; });
  var out = "", pos = 0, s = String(txt);
  marcas.forEach(function(m){ if(m[0] < pos) return; out += esc(s.slice(pos, m[0])) + "<mark>" + esc(s.slice(m[0], m[1])) + "</mark>"; pos = m[1]; });
  return out + esc(s.slice(pos));
}
function cartaoPop(p, ws, extra){
  ws = ws || [];
  var lido = lidoInfo(p.id), atual = lido && lido.v === p.versao;
  return '<article class="pc' + (p.status !== "aprovado" ? " nao-ap" : "") + '">' +
    '<div class="pc-top"><span class="dep-tag" style="--dc:' + depCor(p.departamento) + '">' + esc(sigla(p.departamento)) + '</span><span class="pc-trilha">' + marca([p.setor, p.atividade, p.tarefa].join(" › "), ws) + '</span>' + (ehFav(p.id) ? '<span class="pc-fav" title="Favorito">★</span>' : '') + '</div>' +
    '<button type="button" class="pc-tit" data-ver="' + p.id + '">' + marca(p.titulo, ws) + '</button>' +
    '<div class="pc-meta"><span>Cenário: <b>' + marca(p.cenario, ws) + '</b></span>' + (p.variacao ? '<span>Método: <b>' + esc(p.variacao) + '</b></span>' : '') + '<span>' + plural(p.passos.length, "passo") + '</span>' + (p.tempoMedio ? '<span>⏱ ' + esc(p.tempoMedio) + '</span>' : '') +
      (p.status !== "aprovado" ? '<span class="pill ' + p.status + '">' + esc(ST[p.status].l) + '</span>' : '') + (p.essencial ? '<span class="pill pill-soon">Essencial</span>' : '') + (atual ? '<span class="pill pill-ok">✓ Lido</span>' : lido ? '<span class="pill pill-today">Atualizado: reler</span>' : '') + '</div>' +
    (extra || '') +
    '<div class="pc-acoes"><button type="button" class="btn btn-exec" data-exec="' + p.id + '"' + (p.passos.length ? '' : ' disabled') + '>▶ Executar passo a passo</button><button type="button" class="fbtn" data-ver="' + p.id + '">Ler o POP</button></div>' +
  '</article>';
}
var CORES = ["#C2000C","#3C659B","#167A45","#B5530C","#7A5BB5","#0E7C86","#9A6B00","#A3346B","#4F6D7A","#5B6B2F","#2F5FA8"];
function depCor(dep){ var i = DEPS.map(function(d){ return d.n; }).indexOf(dep); return CORES[i < 0 ? 4 : i]; }

/* ============ INÍCIO ============ */
var GUIA_OK = lsGet("pop-guia-ok", false);
function renderInicio(){
  var nome = primeiroNome(); $("#heroOla").textContent = nome ? "Olá, " + nome + "!" : "Olá!";
  var dep = meuDep(), base = dep ? aprovadosDep(dep) : ativos().filter(function(p){ return p.status === "aprovado"; });
  var sug = {}; base.forEach(function(p){ var t = p.tarefa.split(/\s+/).slice(0, 3).join(" "); sug[t] = (sug[t] || 0) + 1; });
  $("#qSug").innerHTML = '<span>Exemplos:</span>' + Object.keys(sug).slice(0, 6).map(function(t){ return '<button type="button" class="sug" data-sug="' + esc(t) + '">' + esc(t.toLowerCase()) + '</button>'; }).join("");
  if($("#qBusca").value !== S.q) $("#qBusca").value = S.q;
  renderResultados();
  var corpo = $("#inicioCorpo"); corpo.hidden = !!S.q.trim();
  if(S.q.trim()) return;
  var guia = GUIA_OK ? '' : '<section class="guia"><div class="guia-h"><h3>Primeira vez aqui? É assim que funciona</h3><button type="button" class="x" data-guia-ok aria-label="Fechar o guia">✕</button></div><ol>' +
    '<li><b>Encontre</b><span>Busque acima com suas palavras ou navegue pelo <a href="#" data-ir-v="mapa">mapa de processos</a> do seu departamento.</span></li>' +
    '<li><b>Leia</b><span>Cada POP diz o objetivo, quem faz, o que entra e o que sai, e os passos na ordem.</span></li>' +
    '<li><b>Execute</b><span>Use <b>▶ Executar passo a passo</b>: o POP vai mostrando um passo de cada vez e, nas decisões, o caminho certo.</span></li>' +
    '<li><b>Registre</b><span>Na <a href="#" data-ir-v="trilha">Minha trilha</a> você marca o que já leu. A coordenação acompanha a sua integração.</span></li></ol></section>';
  var depSel = '<div class="meu-dep"><label>Meu departamento<select id="meuDepSel"><option value="">Escolha para ver os seus processos…</option>' + DEPS.map(function(d){ return '<option' + (d.n === dep ? " selected" : "") + '>' + esc(d.n) + '</option>'; }).join("") + '</select></label></div>';
  var meu = '';
  if(dep){
    var ps = aprovadosDep(dep), setores = {};
    ps.forEach(function(p){ setores[p.setor] = (setores[p.setor] || 0) + 1; });
    var tr = progressoTrilha(dep), ess = ps.filter(function(p){ return p.essencial; });
    meu = '<section class="pn-card bloco-dep" style="--dc:' + depCor(dep) + '"><div class="pn-card-head"><h3><span class="dep-tag" style="--dc:' + depCor(dep) + '">' + esc(sigla(dep)) + '</span> ' + esc(dep) + '</h3><button type="button" class="pn-link" data-mapa-dep="' + esc(dep) + '">Abrir o mapa do departamento ›</button></div><div class="pn-card-body" style="gap:14px">' +
      (Object.keys(setores).length ? '<div class="setor-grid">' + Object.keys(setores).sort().map(function(se){ return '<button type="button" class="setor-btn" data-mapa-dep="' + esc(dep) + '" data-mapa-set="' + esc(se) + '"><b>' + esc(se) + '</b><span>' + plural(setores[se], "procedimento") + '</span></button>'; }).join("") + '</div>' : '<p class="empty-mini">Ainda não há POPs aprovados neste departamento.</p>') +
      (tr.total ? '<div class="tr-mini"><div class="tr-mini-tx"><b>Trilha de integração</b><span>' + tr.lidos + ' de ' + tr.total + ' procedimentos essenciais lidos</span></div><div class="barra-p"><i style="width:' + Math.round(tr.lidos / tr.total * 100) + '%"></i></div><button type="button" class="fbtn" data-ir-v="trilha">' + (tr.lidos >= tr.total ? "Ver trilha" : "Continuar a trilha") + '</button></div>' : '') +
      (ess.length ? '<div><span class="kpi-label">Comece por estes</span><div class="pc-lista mini">' + ess.slice(0, 4).map(function(p){ return cartaoPop(p); }).join("") + '</div></div>' : '') +
    '</div></section>';
  }
  var fav = FAV.map(function(id){ return S.pops[id]; }).filter(function(p){ return p && p.status !== "obsoleto"; });
  var rec = REC.map(function(id){ return S.pops[id]; }).filter(function(p){ return p && p.status !== "obsoleto"; });
  var linhaMini = function(p){ return '<li><button type="button" data-ver="' + p.id + '"><span class="dep-tag" style="--dc:' + depCor(p.departamento) + '">' + esc(sigla(p.departamento)) + '</span><span class="lm-t">' + esc(p.titulo) + '</span></button><button type="button" class="lm-exec" data-exec="' + p.id + '" title="Executar passo a passo" aria-label="Executar ' + esc(p.titulo) + '">▶</button></li>'; };
  var atalhos = '<div class="atalhos"><section class="pn-card"><div class="pn-card-head"><h3>★ Favoritos</h3></div><div class="pn-card-body">' + (fav.length ? '<ul class="lm">' + fav.slice(0, 6).map(linhaMini).join("") + '</ul>' : '<p class="empty-mini">Marque ☆ nos POPs que você usa sempre para tê-los aqui.</p>') + '</div></section>' +
    '<section class="pn-card"><div class="pn-card-head"><h3>Vistos recentemente</h3></div><div class="pn-card-body">' + (rec.length ? '<ul class="lm">' + rec.slice(0, 6).map(linhaMini).join("") + '</ul>' : '<p class="empty-mini">Os POPs que você abrir aparecem aqui.</p>') + '</div></section></div>';
  var porDep = {}; ativos().forEach(function(p){ var d = porDep[p.departamento] = porDep[p.departamento] || {n: 0, s: {}}; d.n++; d.s[p.setor] = 1; });
  var deps = '<section class="sec-dep"><div class="sec-head" style="padding:0 0 10px"><h3>Explorar por departamento</h3><span class="sub">clique para abrir o mapa de processos</span></div><div class="dep-grid">' + DEPS.map(function(d){ var x = porDep[d.n] || {n: 0, s: {}}; return '<button type="button" class="dep-card' + (x.n ? "" : " vazio") + (d.n === dep ? " meu" : "") + '" data-mapa-dep="' + esc(d.n) + '" style="--dc:' + depCor(d.n) + '"><span class="dep-sig">' + esc(d.s) + '</span><span class="dep-nm">' + esc(d.n) + '</span><span class="dep-ct">' + (x.n ? plural(Object.keys(x.s).length, "setor", "setores") + ' · ' + plural(x.n, "POP") : "sem POPs ainda") + '</span></button>'; }).join("") + '</div></section>';
  corpo.innerHTML = '<div class="ini">' + guia + depSel + meu + atalhos + deps + '</div>';
}
function renderResultados(){
  var box = $("#qRes"), q = S.q.trim();
  box.hidden = !q; $("#inicioCorpo").hidden = !!q;
  if(!q){ box.innerHTML = ""; return; }
  var ws = palavrasBusca(q), rs = buscar(q);
  if(!rs.length){ box.innerHTML = '<div class="res-vazio"><b>Nada encontrado para “' + esc(q) + '”.</b><p>Tente outra palavra (ex.: o nome do sistema ou do documento), ou navegue pelo <a href="#" data-ir-v="mapa">mapa de processos</a>. Se o procedimento não existir, avise a coordenação do seu setor.</p></div>'; return; }
  box.innerHTML = '<div class="res-h">' + plural(rs.length, "procedimento encontrado", "procedimentos encontrados") + '</div><div class="pc-lista">' + rs.slice(0, 30).map(function(r){
    var extra = r.passo !== -1 ? '<div class="pc-passo">Passo ' + (r.passo + 1) + ': ' + marca(r.p.passos[r.passo].texto, ws) + '</div>' : (r.p.objetivo ? '<div class="pc-obj">' + esc(r.p.objetivo.length > 170 ? r.p.objetivo.slice(0, 168) + "…" : r.p.objetivo) + '</div>' : '');
    return cartaoPop(r.p, ws, extra);
  }).join("") + '</div>';
}
var tBusca = 0;
$("#qBusca").addEventListener("input", function(){ S.q = this.value; clearTimeout(tBusca); tBusca = setTimeout(function(){ renderResultados(); }, 120); });
$("#qBusca").addEventListener("keydown", function(e){ if(e.key === "Escape"){ this.value = ""; S.q = ""; renderInicio(); } if(e.key === "Enter"){ var b = $("#qRes [data-ver]"); if(b) b.click(); } });
document.addEventListener("click", function(e){
  var b;
  if((b = e.target.closest("[data-sug]"))){ S.q = b.getAttribute("data-sug"); $("#qBusca").value = S.q; renderInicio(); $("#qBusca").focus(); return; }
  if((b = e.target.closest("[data-guia-ok]"))){ GUIA_OK = true; lsSet("pop-guia-ok", true); renderInicio(); return; }
  if((b = e.target.closest("[data-ir-v]"))){ e.preventDefault(); irPara(b.getAttribute("data-ir-v")); return; }
  if((b = e.target.closest("[data-mapa-dep]"))){ S.mapa = {dep: b.getAttribute("data-mapa-dep"), set: b.getAttribute("data-mapa-set") || "", at: "", ta: ""}; S.mpModo = "colunas"; S.mpFiltro = ""; autoDescer(); irPara("mapa"); return; }
  if((b = e.target.closest("[data-exec]"))){ if($("#dlgVer").open) $("#dlgVer").close(); abrirExec(b.getAttribute("data-exec")); return; }
});
document.addEventListener("change", function(e){ if(e.target.id === "meuDepSel"){ definirMeuDep(e.target.value); } });

/* ============ MAPA DE PROCESSOS (colunas) ============ */
function arvoreMapa(){
  var q = norm(S.mpFiltro), t = {};
  DEPS.forEach(function(d){ t[d.n] = {}; });
  ativos().forEach(function(p){
    if(q && norm([caminho(p), p.cenario, p.titulo, p.codigo, p.palavras].join(" ")).indexOf(q) === -1) return;
    var g = function(o, k){ return (o[k] = o[k] || {}); };
    var c = g(g(g(g(t, p.departamento), p.setor || "(sem setor)"), p.atividade || "(sem atividade)"), p.tarefa || "(sem tarefa)");
    (c[p.cenario] = c[p.cenario] || []).push(p);
  });
  if(q) Object.keys(t).forEach(function(k){ if(!Object.keys(t[k]).length) delete t[k]; });
  return t;
}
function contaPops(o){ return Array.isArray(o) ? o.length : Object.keys(o).reduce(function(s, k){ return s + contaPops(o[k]); }, 0); }
function renderMapa(){
  $$("#mpModo button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-mp") === S.mpModo); });
  if($("#mpFiltro").value !== S.mpFiltro) $("#mpFiltro").value = S.mpFiltro;
  var arv = S.mpModo === "arvore", pla = S.mpModo === "planeta";
  $("#mpColunas").hidden = arv || pla; $("#mpTrilho").hidden = arv; $("#mpArvore").hidden = !arv; $("#mpPlaneta").hidden = !pla;
  if(arv){ renderArquitetura(); return; }
  var t = arvoreMapa(), m = S.mapa, ord = function(o){ return Object.keys(o).sort(function(x, y){ return x.localeCompare(y, "pt-BR"); }); };
  var depsOrd = DEPS.map(function(d){ return d.n; }).filter(function(d){ return t[d]; }).concat(Object.keys(t).filter(function(d){ return !DEP[d]; }));
  // seleção válida e auto-seleção quando só há um caminho
  if(m.dep && !t[m.dep]) m.dep = "";
  var nSet = m.dep ? t[m.dep] : null; if(nSet){ if(m.set && !nSet[m.set]) m.set = ""; } else m.set = "";
  var nAt = m.set ? nSet[m.set] : null; if(nAt){ if(m.at && !nAt[m.at]) m.at = ""; } else m.at = "";
  var nTa = m.at ? nAt[m.at] : null; if(nTa){ if(m.ta && !nTa[m.ta]) m.ta = ""; } else m.ta = "";
  var nCe = m.ta ? nTa[m.ta] : null;
  $("#mpCont").textContent = plural(contaPops(t), "POP");
  var item = function(nivel, nome, n, on, extra){ return '<button type="button" class="mi' + (on ? " on" : "") + (n ? "" : " zero") + '" data-mi="' + nivel + '" data-v="' + esc(nome) + '"' + (extra || '') + '><span class="mi-n">' + esc(nome) + '</span><span class="mi-c">' + (n || "–") + '</span><span class="mi-ch" aria-hidden="true">›</span></button>'; };
  var col = function(nivel, titulo, dica, html, ativa){ return '<section class="mcol' + (ativa ? " ativa" : "") + '" data-col="' + nivel + '"><header><b>' + titulo + '</b><small>' + dica + '</small></header><div class="mcol-b">' + html + '</div></section>'; };
  var cols = [];
  cols.push(col("dep", "Departamento", "área de responsabilidade", depsOrd.map(function(d){ return item("dep", d, contaPops(t[d]), d === m.dep, ' style="--dc:' + depCor(d) + '"'); }).join(""), !m.dep));
  if(nSet) cols.push(col("set", "Setor", "centro de execução", ord(nSet).map(function(k){ return item("set", k, contaPops(nSet[k]), k === m.set); }).join("") || '<p class="mcol-vz">Nenhum setor com POP neste departamento.' + (podeEditar() ? ' <button type="button" class="linkish" data-novo-dep="' + esc(m.dep) + '">Criar o primeiro POP</button>' : '') + '</p>', m.dep && !m.set));
  if(nAt) cols.push(col("at", "Atividade", "bloco de trabalho", ord(nAt).map(function(k){ return item("at", k, contaPops(nAt[k]), k === m.at); }).join(""), m.set && !m.at));
  if(nTa) cols.push(col("ta", "Tarefa", "o que precisa ser feito", ord(nTa).map(function(k){ return item("ta", k, contaPops(nTa[k]), k === m.ta); }).join(""), m.at && !m.ta));
  if(nCe) cols.push('<section class="mcol mcol-pops ativa" data-col="pop"><header><b>Cenários e POPs</b><small>escolha o contexto em que você está</small></header><div class="mcol-b">' + ord(nCe).map(function(ce){ return '<div class="cen"><div class="cen-h"><span class="nv">Cenário</span><b>' + esc(ce) + '</b></div>' + nCe[ce].map(function(p){ return cartaoPop(p); }).join("") + '</div>'; }).join("") + '</div></section>');
  var nivelAtual = nCe ? "pop" : m.at ? "ta" : m.set ? "at" : m.dep ? "set" : "dep";
  var c = $("#mpColunas"); c.setAttribute("data-nivel", nivelAtual); c.innerHTML = cols.join("");
  // trilho (breadcrumb)
  var partes = [['Todos os departamentos', {dep: "", set: "", at: "", ta: ""}]];
  if(m.dep) partes.push([m.dep, {dep: m.dep, set: "", at: "", ta: ""}]);
  if(m.set) partes.push([m.set, {dep: m.dep, set: m.set, at: "", ta: ""}]);
  if(m.at) partes.push([m.at, {dep: m.dep, set: m.set, at: m.at, ta: ""}]);
  if(m.ta) partes.push([m.ta, {dep: m.dep, set: m.set, at: m.at, ta: m.ta}]);
  $("#mpTrilho").innerHTML = (partes.length > 1 ? '<button type="button" class="tr-volta" data-tr="' + (partes.length - 2) + '" aria-label="Voltar um nível">‹</button>' : '') + partes.map(function(pt, i){ return (i ? '<span class="tr-sep">›</span>' : '') + (i === partes.length - 1 ? '<b>' + esc(pt[0]) + '</b>' : '<button type="button" data-tr="' + i + '">' + esc(pt[0]) + '</button>'); }).join("");
  $("#mpTrilho")._partes = partes;
  var on = c.querySelector(".mcol.ativa"); c.scrollLeft = on ? Math.max(0, on.offsetLeft + on.offsetWidth - c.clientWidth) : 0;
  if(pla) renderPlaneta();
}
/* ============ MAPA DE PROCESSOS (planeta: pop-planeta.js, carregado só quando usado) ============ */
var planetaCarregando = false;
var PLANETA_API = {
  arvore: function(){ return arvoreMapa(); }, DEPS: DEPS, DEP: DEP, depCor: depCor, vencida: vencida, lidoInfo: lidoInfo, meuDep: meuDep,
  podeEditar: function(){ return podeEditar(); }, buscar: function(q){ return buscar(q); }, esc: esc, S: function(){ return S; },
  pop: function(id){ return S.pops[id] || null; }, abrir: function(id){ abrirPop(id); },
  // o planeta muda o lugar: trilho e colunas acompanham, sem o planeta voar de novo
  navegar: function(m){ S.mapa = {dep: m.dep || "", set: m.set || "", at: m.at || "", ta: m.ta || ""}; renderMapa(); }
};
function renderPlaneta(){
  var el = $("#mpPlaneta");
  if(window.PopPlaneta){ try{ window.PopPlaneta.render(PLANETA_API, el); }catch(e){ console.error(e); } return; }
  if(planetaCarregando) return;
  planetaCarregando = true; el.innerHTML = '<div class="pl-carregando">Preparando o planeta…</div>';
  var sc = document.createElement("script"); sc.src = "pop-planeta.js?v=1";
  sc.onload = function(){ planetaCarregando = false; if(S.mpModo === "planeta") renderPlaneta(); };
  sc.onerror = function(){ planetaCarregando = false; el.innerHTML = '<div class="pl-carregando">Não foi possível abrir o planeta agora. Use o modo Navegar.</div>'; };
  document.head.appendChild(sc);
}
$("#mpColunas").addEventListener("click", function(e){
  var b = e.target.closest("[data-mi]"); if(!b) return;
  var n = b.getAttribute("data-mi"), v = b.getAttribute("data-v"), m = S.mapa;
  if(n === "dep") S.mapa = {dep: v, set: "", at: "", ta: ""};
  else if(n === "set") S.mapa = {dep: m.dep, set: v, at: "", ta: ""};
  else if(n === "at") S.mapa = {dep: m.dep, set: m.set, at: v, ta: ""};
  else S.mapa = {dep: m.dep, set: m.set, at: m.at, ta: v};
  autoDescer(); renderMapa();
  var alvo = $("#mpColunas .mcol.ativa"); if(alvo && window.innerWidth < 900) window.scrollTo(0, $("#mpTrilho").getBoundingClientRect().top + window.scrollY - 8);
});
$("#mpTrilho").addEventListener("click", function(e){ var b = e.target.closest("[data-tr]"); if(!b) return; var pt = $("#mpTrilho")._partes[+b.getAttribute("data-tr")]; if(pt){ S.mapa = JSON.parse(JSON.stringify(pt[1])); renderMapa(); } });
// Ao avançar, se o próximo nível só tem um caminho, já entra nele (menos cliques para quem está procurando).
function autoDescer(){
  var t = arvoreMapa(), m = S.mapa, um = function(o){ var k = Object.keys(o || {}); return k.length === 1 ? k[0] : ""; };
  if(m.dep && !m.set) m.set = um(t[m.dep]);
  if(m.set && !m.at) m.at = um((t[m.dep] || {})[m.set]);
  if(m.at && !m.ta) m.ta = um(((t[m.dep] || {})[m.set] || {})[m.at]);
}
$("#mpModo").addEventListener("click", function(e){ var b = e.target.closest("[data-mp]"); if(b){ S.mpModo = b.getAttribute("data-mp"); renderMapa(); } });
$("#mpFiltro").addEventListener("input", function(){ S.mpFiltro = this.value; renderMapa(); });

/* ============ EXECUTAR PASSO A PASSO ============ */
var EX = null;
function abrirExec(id){
  var p = S.pops[id]; if(!p || !p.passos.length) return;
  marcarRecente(id);
  EX = {p: p, i: 0, caminho: [], fim: false, ini: new Date()};
  desenharExec();
  var d = $("#dlgExec"); if(!d.open) d.showModal();
}
function idxDe(p, dest, i){ if(!dest) return i + 1; if(dest === "fim") return p.passos.length; var k = p.passos.map(function(x){ return x.id; }).indexOf(dest); return k === -1 ? i + 1 : k; }
function desenharExec(){
  var d = $("#dlgExec"), p = EX.p, n = p.passos.length, feitos = {}; EX.caminho.forEach(function(c){ feitos[c.i] = c; });
  var fim = EX.i >= n || EX.fim;
  var pct = fim ? 100 : Math.round(EX.caminho.length / Math.max(n, EX.caminho.length + 1) * 100);
  var lista = '<ol class="ex-lista">' + p.passos.map(function(x, i){ var st = i === EX.i && !fim ? "atual" : feitos[i] ? "feito" : ""; return '<li class="' + st + (x.tipo === "decisao" ? " dec" : "") + '"><span class="ex-n">' + (feitos[i] ? "✓" : i + 1) + '</span><span>' + esc(x.texto) + (feitos[i] && feitos[i].r ? ' <em>→ ' + esc(feitos[i].r) + '</em>' : '') + '</span></li>'; }).join("") + '</ol>';
  var palco;
  if(fim){
    var min = Math.max(1, Math.round((new Date() - EX.ini) / 60000));
    palco = '<div class="ex-fim"><div class="ex-ok">✓</div><h3>Procedimento concluído</h3><p>' + plural(EX.caminho.length, "passo executado", "passos executados") + ' em cerca de ' + plural(min, "minuto") + '.</p>' +
      (EX.caminho.some(function(c){ return c.nota; }) ? '<div class="ex-notas"><b>Ações combinadas pelo caminho:</b><ul>' + EX.caminho.filter(function(c){ return c.nota; }).map(function(c){ return '<li>' + esc(c.nota) + '</li>'; }).join("") + '</ul></div>' : '') +
      '<div class="ex-bts"><button type="button" class="fbtn" data-ex="copiar">Copiar resumo</button><button type="button" class="fbtn" data-ex="reiniciar">Executar de novo</button>' + (lidoInfo(p.id) && lidoInfo(p.id).v === p.versao ? '' : '<button type="button" class="fbtn" data-ex="lido">Marcar como lido na trilha</button>') + '<button type="button" class="btn" data-ex="fechar">Fechar</button></div></div>';
  } else {
    var x = p.passos[EX.i], dec = x.tipo === "decisao";
    palco = '<div class="ex-passo' + (dec ? " dec" : "") + '"><span class="ex-k">Passo ' + (EX.i + 1) + ' de ' + n + (dec ? ' · decisão' : '') + '</span><h3>' + esc(x.texto) + '</h3>' + (x.resp ? '<span class="ex-resp">Quem faz: <b>' + esc(x.resp) + '</b></span>' : '') +
      (dec ? '<div class="ex-ramos">' + x.ramos.map(function(r, k){ var di = idxDe(p, r.destino, EX.i); return '<button type="button" class="ex-ramo" data-ramo="' + k + '"><b>' + esc(r.rotulo) + '</b>' + (r.nota ? '<span>' + esc(r.nota) + '</span>' : '') + '<small>' + (di >= n ? "encerra o procedimento" : "vai para o passo " + (di + 1)) + '</small></button>'; }).join("") + '</div>'
        : '<div class="ex-bts"><button type="button" class="btn btn-exec" data-ex="feito" autofocus>Feito, próximo passo ›</button></div><p class="ex-dica">Atalho: Enter</p>') +
      '</div>';
  }
  d.innerHTML = '<div class="dlg-head"><div class="ex-h"><span class="cod">' + esc(p.codigo) + ' · v' + esc(p.versao) + '</span><h2>' + esc(p.titulo) + '</h2></div><button type="button" class="x" data-ex="fechar" aria-label="Fechar">✕</button></div>' +
    '<div class="barra-p ex-barra"><i style="width:' + pct + '%"></i></div>' +
    '<div class="ex-corpo"><aside class="ex-lado"><span class="kpi-label">Roteiro</span>' + lista + '</aside><div class="ex-palco">' + palco +
    (EX.caminho.length && !fim ? '<button type="button" class="linkish ex-voltar" data-ex="voltar">‹ Voltar ao passo anterior</button>' : '') + '</div></div>';
  var f = d.querySelector("[data-ex=feito], .ex-ramo, [data-ex=fechar].btn"); if(f) f.focus();
}
$("#dlgExec").addEventListener("click", function(e){
  var b = e.target.closest("[data-ex], [data-ramo]"); if(!b || !EX) return;
  var p = EX.p, x = p.passos[EX.i];
  if(b.hasAttribute("data-ramo")){ var r = x.ramos[+b.getAttribute("data-ramo")]; EX.caminho.push({i: EX.i, r: r.rotulo, nota: r.nota}); EX.i = idxDe(p, r.destino, EX.i); if(EX.caminho.length > 300) EX.fim = true; desenharExec(); return; }
  var a = b.getAttribute("data-ex");
  if(a === "fechar"){ $("#dlgExec").close(); EX = null; return; }
  if(a === "feito"){ EX.caminho.push({i: EX.i}); EX.i++; desenharExec(); return; }
  if(a === "voltar"){ var u = EX.caminho.pop(); if(u){ EX.i = u.i; EX.fim = false; } desenharExec(); return; }
  if(a === "reiniciar"){ abrirExec(p.id); return; }
  if(a === "lido"){ marcarLido(p, true).then(desenharExec); return; }
  if(a === "copiar"){
    var tx = p.codigo + " · " + p.titulo + " (v" + p.versao + ")\nExecutado em " + dataBR(hojeS()) + " por " + eu() + "\n\n" + EX.caminho.map(function(c, k){ return (k + 1) + ". " + p.passos[c.i].texto + (c.r ? " → " + c.r : "") + (c.nota ? " (" + c.nota + ")" : ""); }).join("\n");
    try{ navigator.clipboard.writeText(tx).then(function(){ toast("Resumo copiado."); }, function(){ toast("Não foi possível copiar."); }); }catch(err){ toast("Não foi possível copiar."); }
  }
});
$("#dlgExec").addEventListener("keydown", function(e){ if(e.key === "Enter" && EX && !EX.fim && EX.i < EX.p.passos.length && EX.p.passos[EX.i].tipo === "acao" && !e.target.closest(".linkish,.fbtn,.x")){ e.preventDefault(); EX.caminho.push({i: EX.i}); EX.i++; desenharExec(); } });
$("#dlgExec").addEventListener("close", function(){ EX = null; });

/* ============ MINHA TRILHA ============ */
function renderTrilha(){
  var dep = S.trDep || meuDep(), box = $("#trCorpo");
  var sel = '<div class="tr-top"><div><h2 class="tr-tit">Trilha de integração</h2><p class="note" style="font-size:13px">Os procedimentos que todo colaborador do departamento precisa conhecer. Leia cada um, execute quando for a vez e marque <b>Li e entendi</b>. Se o POP mudar de versão, ele volta para a lista para você reler.</p></div><label class="campo" style="min-width:240px">Departamento<select id="trDepSel"><option value="">Escolha…</option>' + DEPS.map(function(d){ return '<option' + (d.n === dep ? " selected" : "") + '>' + esc(d.n) + '</option>'; }).join("") + '</select></label></div>';
  if(!dep){ box.innerHTML = sel + '<div class="vazio">Escolha o seu departamento para ver a trilha.</div>'; return; }
  var ps = aprovadosDep(dep), ess = ps.filter(function(p){ return p.essencial; }), outros = ps.filter(function(p){ return !p.essencial; });
  var tr = progressoTrilha(dep), pct = tr.total ? Math.round(tr.lidos / tr.total * 100) : 0;
  var linha = function(p){
    var l = lidoInfo(p.id), ok = l && l.v === p.versao;
    return '<li class="tr-item' + (ok ? " ok" : "") + '"><label class="tr-ck"><input type="checkbox" data-lido="' + p.id + '"' + (ok ? " checked" : "") + '><span>' + (ok ? "Li e entendi" : l ? "Reler (nova versão)" : "Li e entendi") + '</span></label>' +
      '<div class="tr-tx"><button type="button" class="pc-tit" data-ver="' + p.id + '">' + esc(p.titulo) + '</button><span class="dp-cell-sub">' + esc(p.setor + " › " + p.tarefa) + ' · ' + plural(p.passos.length, "passo") + (p.tempoMedio ? ' · ⏱ ' + esc(p.tempoMedio) : '') + (ok ? ' · lido em ' + dataBR(l.em) : '') + '</span></div>' +
      '<button type="button" class="fbtn" data-exec="' + p.id + '">▶ Executar</button></li>';
  };
  box.innerHTML = sel +
    '<section class="pn-card tr-prog" style="--dc:' + depCor(dep) + '"><div class="pn-card-body" style="padding:16px"><div class="tr-num"><b>' + pct + '%</b><span>' + tr.lidos + ' de ' + tr.total + ' procedimentos essenciais lidos</span></div><div class="barra-p grande"><i style="width:' + pct + '%"></i></div>' + (tr.total && tr.lidos >= tr.total ? '<p class="tr-parabens">Trilha concluída. Continue consultando os POPs sempre que for executar uma tarefa.</p>' : '') + '</div></section>' +
    (ess.length ? '<section class="pn-card"><div class="pn-card-head"><h3>Essenciais</h3><span class="sub">comece por aqui</span></div><ul class="tr-lista">' + ess.map(linha).join("") + '</ul></section>' : '<div class="vazio">A coordenação ainda não marcou procedimentos essenciais para ' + esc(dep) + '.' + (ehGestor() ? ' Marque “Essencial para novos colaboradores” ao editar um POP.' : '') + '</div>') +
    (outros.length ? '<details class="pn-card tr-outros"><summary><b>Outros procedimentos do departamento</b><span class="sub">' + plural(outros.length, "POP") + '</span></summary><ul class="tr-lista">' + outros.map(linha).join("") + '</ul></details>' : '');
}
document.addEventListener("change", function(e){
  if(e.target.id === "trDepSel"){ S.trDep = e.target.value; if(!meuDep() && e.target.value) definirMeuDep(e.target.value); renderTrilha(); return; }
  var c = e.target.closest("[data-lido]"); if(c){ var p = S.pops[c.getAttribute("data-lido")]; if(p) marcarLido(p, c.checked); }
});

/* ============ GESTÃO: trilha da equipe ============ */
function cartaoEquipe(){
  var us = Object.keys(S.users).map(function(id){ var u = S.users[id]; return {id: id, u: u, tr: u.dep ? progressoTrilha(u.dep, u) : {total: 0, lidos: 0}}; }).filter(function(x){ return x.u && x.u.nome; });
  us.sort(function(a, b){ return (a.u.dep || "~").localeCompare(b.u.dep || "~", "pt-BR") || (a.u.nome || "").localeCompare(b.u.nome || "", "pt-BR"); });
  var corpo = us.length ? '<div class="eq">' + us.map(function(x){ var pct = x.tr.total ? Math.round(x.tr.lidos / x.tr.total * 100) : 0; return '<div class="eq-l"><span class="eq-n"><b>' + esc(x.u.nome) + '</b><span class="dp-cell-sub">' + esc(x.u.dep || "sem departamento") + ' · ' + plural(Object.keys(x.u.lidos || {}).length, "POP lido", "POPs lidos") + '</span></span><div class="barra-p"><i style="width:' + pct + '%"></i></div><em>' + (x.tr.total ? x.tr.lidos + "/" + x.tr.total : "—") + '</em></div>'; }).join("") + '</div>' : '<p class="empty-mini">Ninguém registrou leituras ainda. Cada pessoa marca “Li e entendi” na aba Minha trilha.</p>';
  return '<section class="pn-card pn-wide"><div class="pn-card-head"><h3>Trilha de integração da equipe</h3><span class="sub">POPs essenciais lidos por pessoa, na versão atual</span></div><div class="pn-card-body">' + corpo + '</div></section>';
}

/* ============ POPs de exemplo ============ */
var SEED_VERSAO = 3;
var IDS_V1 = ["exdp001","exdp002","exdp003","exfis001","exfis002","excon001","exino001","exino002"];
function A(t, r){ return {tipo:"acao", texto:t, resp:r || ""}; }
function D(t, r, ramos){ return {tipo:"decisao", texto:t, resp:r || "", ramos:ramos}; }
function R(rot, nota, dest){ return {rotulo:rot, nota:nota || "", destino:dest || ""}; }
function comIds(ps){ return ps.map(function(p, i){ p.id = "s" + (i + 1); return p; }); }
function exemplos(){
  var h = function(v, d, n){ return {v: v, data: d, por: "Coordenação", nota: n}; };
  var L = [
    {id:"excon002", codigo:"POP-CON-002", titulo:"Procedimento para Receber Documentos do Cliente na Rotina Mensal", departamento:"Contábil", setor:"Recepção e Gestão de Documentos", atividade:"Recebimento de Documentos", tarefa:"Receber documentos do cliente", cenario:"Rotina Mensal",
     versao:"1.0", status:"aprovado", fase:"monitoramento", dono:"Coordenação Contábil", executor:"Assistente Contábil", aprovador:"Coordenação Contábil", aprovadoEm:"2026-06-02", aprovadoPor:"Coordenação Contábil", proxRevisao:"2027-06-02", revisaoMeses:12,
     objetivo:"Garantir que todos os documentos contábeis do mês de cada cliente sejam recebidos, conferidos e registrados até o dia 10, com as pendências comunicadas no mesmo dia.",
     escopo:"Clientes da carteira contábil com rotina mensal. Clientes novos e encerramento do exercício têm POPs próprios.",
     gatilho:"Início do mês (dia 1º) ou chegada de documentos no Onvio", frequencia:"Mensal", tempoMedio:"15 min por cliente",
     fornecedores:["Cliente","Bancos"], entradas:["Extratos bancários","Notas fiscais e recibos","Relatórios do sistema do cliente"], sistemas:["Onvio","Domínio Contabilidade","Planilha Contábil do Hub"],
     saidas:["Documentos registrados na pasta do cliente","Pendências registradas e comunicadas"], clientes:["Integração Contábil","Cliente"],
     passos: comIds([A("Acessar o Onvio","Assistente Contábil"), A("Localizar o cliente","Assistente Contábil"),
       D("Cliente entregou a documentação?","Assistente Contábil",[R("Sim","",""), R("Não","criar pendência","s7")]),
       A("Conferir a documentação recebida com a lista do cliente","Assistente Contábil"), A("Salvar os arquivos na pasta do cliente","Assistente Contábil"),
       D("Ficou alguma pendência?","Assistente Contábil",[R("Sim","",""), R("Não","","s8")]),
       A("Registrar a pendência e notificar o cliente","Assistente Contábil"), A("Encerrar a atividade na Planilha Contábil","Assistente Contábil")]),
     indicadores:[{nome:"Clientes com documentação completa até o dia 10", meta:"≥ 90%"}],
     riscos:[{risco:"Documento perdido ou salvo fora da pasta do cliente", controle:"Conferência pela lista padrão e pasta única por competência", nivel:"Médio"}],
     historico:[h("1.0","2026-05-26","Criação do POP"),h("1.0","2026-06-02","Aprovado e publicado")]},
    {id:"excon001", codigo:"POP-CON-001", titulo:"Procedimento para Conciliar Contas Bancárias na Rotina Mensal", departamento:"Contábil", setor:"Conciliação Contábil", atividade:"Conciliação Bancária", tarefa:"Conciliar contas bancárias", cenario:"Rotina Mensal",
     versao:"1.0", status:"aprovado", fase:"monitoramento", dono:"Coordenação Contábil", executor:"Analista Contábil", aprovador:"Coordenação Contábil", aprovadoEm:"2026-01-20", aprovadoPor:"Coordenação Contábil", proxRevisao:"2027-01-20", revisaoMeses:12,
     objetivo:"Garantir que o saldo contábil de cada conta bancária bata com o extrato no último dia do mês, com as diferenças explicadas.",
     escopo:"Todas as contas correntes, aplicações e contas de pagamento das empresas da carteira contábil.",
     gatilho:"Recebimento dos extratos do mês", frequencia:"Mensal", tempoMedio:"20 min por conta",
     fornecedores:["Cliente","Bancos"], entradas:["Extratos bancários (OFX ou PDF)","Lançamentos do mês"], sistemas:["Domínio Contabilidade","Planilha Contábil do Hub"],
     saidas:["Relatório de conciliação","Lançamentos de ajuste"], clientes:["Fechamento Contábil","Cliente"],
     passos: comIds([A("Importar o extrato (OFX) no Domínio","Analista Contábil"), A("Conciliar automaticamente os lançamentos","Analista Contábil"), A("Revisar os itens não conciliados","Analista Contábil"),
       D("Ficou diferença entre extrato e razão?","Analista Contábil",[R("Sim","pedir o documento ao cliente","s5"), R("Não","","s6")]),
       A("Lançar o ajuste com o documento recebido","Analista Contábil"), A("Arquivar o relatório de conciliação","Analista Contábil")]),
     indicadores:[{nome:"Contas conciliadas até o dia 10", meta:"≥ 90%"}],
     riscos:[{risco:"Saldo divergente levado ao balanço", controle:"Conciliação obrigatória antes de fechar a competência", nivel:"Alto"}],
     historico:[h("1.0","2026-01-12","Criação do POP"),h("1.0","2026-01-20","Aprovado e publicado")]},
    {id:"excon003", codigo:"POP-CON-003", titulo:"Procedimento para Importar Arquivos Contábeis na Rotina Mensal (Domínio)", variacao:"Domínio", departamento:"Contábil", setor:"Integração Contábil", atividade:"Importação de Lançamentos", tarefa:"Importar arquivos contábeis", cenario:"Rotina Mensal",
     versao:"1.0", status:"aprovado", fase:"implementacao", dono:"Coordenação Contábil", executor:"Analista Contábil", aprovador:"Coordenação Contábil", aprovadoEm:"2026-07-14", aprovadoPor:"Coordenação Contábil", proxRevisao:"2027-07-14", revisaoMeses:12,
     objetivo:"Importar no Domínio os lançamentos gerados pelo sistema do cliente sem digitação manual e sem duplicidade.",
     escopo:"Clientes que enviam arquivo no layout do Domínio. Clientes que mandam planilha seguem a variação “Planilha”.",
     gatilho:"Arquivo de lançamentos recebido", frequencia:"Mensal", tempoMedio:"10 min por cliente",
     fornecedores:["Cliente"], entradas:["Arquivo de lançamentos no layout Domínio"], sistemas:["Domínio Contabilidade"], saidas:["Lançamentos importados","Log de importação"], clientes:["Conciliação Contábil"],
     passos: comIds([A("Acessar o Domínio na empresa do cliente","Analista Contábil"), A("Abrir o importador de lançamentos","Analista Contábil"), A("Selecionar o arquivo recebido","Analista Contábil"),
       D("O importador apontou erro?","Analista Contábil",[R("Sim","corrigir o de-para de contas","s2"), R("Não","","")]), A("Conferir o total importado com o arquivo","Analista Contábil"), A("Salvar o log na pasta do cliente","Analista Contábil")]),
     indicadores:[{nome:"Importações sem retrabalho", meta:"≥ 95%"}], riscos:[{risco:"Lançamentos importados em duplicidade", controle:"Conferência do total antes de salvar", nivel:"Médio"}],
     historico:[h("1.0","2026-07-08","Criação do POP"),h("1.0","2026-07-14","Aprovado e publicado")]},
    {id:"excon004", codigo:"POP-CON-004", titulo:"Procedimento para Importar Arquivos Contábeis na Rotina Mensal (Planilha)", variacao:"Planilha", departamento:"Contábil", setor:"Integração Contábil", atividade:"Importação de Lançamentos", tarefa:"Importar arquivos contábeis", cenario:"Rotina Mensal",
     versao:"1.0", status:"rascunho", fase:"desenho", dono:"Coordenação Contábil", executor:"Analista Contábil", revisaoMeses:12,
     objetivo:"Converter a planilha de lançamentos do cliente para o layout do Domínio e importar sem digitação manual.",
     escopo:"Clientes que enviam lançamentos em planilha Excel.", frequencia:"Mensal",
     entradas:["Planilha de lançamentos do cliente"], saidas:["Lançamentos importados"], sistemas:["Excel","Domínio Contabilidade"],
     passos: comIds([A("Abrir a planilha do cliente","Analista Contábil"), A("Copiar os dados para o modelo de conversão","Analista Contábil"), A("Gerar o arquivo no layout Domínio","Analista Contábil"), A("Importar o arquivo no Domínio","Analista Contábil")]),
     historico:[h("1.0","2026-10-26","Criação do POP")]},
    {id:"exdp001", codigo:"POP-DP-001", titulo:"Procedimento para Fechar a Folha de Pagamento na Rotina Mensal", departamento:"Pessoal", setor:"Processamento da Folha", atividade:"Fechamento da Folha", tarefa:"Fechar a folha de pagamento", cenario:"Rotina Mensal",
     versao:"1.1", status:"aprovado", fase:"monitoramento", dono:"Coordenação do Pessoal", executor:"Analista de DP", aprovador:"Coordenação do Pessoal", aprovadoEm:"2026-03-10", aprovadoPor:"Coordenação do Pessoal", proxRevisao:"2027-03-10", revisaoMeses:12,
     objetivo:"Garantir que a folha de cada empresa da carteira seja calculada, conferida e enviada ao cliente dentro do prazo, com os eventos do eSocial transmitidos sem pendências.",
     escopo:"Todas as empresas ativas com funcionários. Rescisões e férias têm POPs próprios.",
     gatilho:"Recebimento das variáveis do mês pelo cliente", frequencia:"Mensal", tempoMedio:"40 min por empresa",
     fornecedores:["Cliente (RH ou sócio)","Sindicato (convenção coletiva)"], entradas:["Variáveis do mês","Admissões e afastamentos do mês","Convenção coletiva vigente"],
     sistemas:["Domínio Folha","eSocial / DCTFWeb","FGTS Digital","Onvio"], saidas:["Holerites e resumo da folha","Guias de FGTS e DCTFWeb","Eventos S-1200 e S-1299 transmitidos"], clientes:["Cliente","Funcionários do cliente","Contábil (provisões)"],
     passos: comIds([A("Acessar o Onvio","Analista de DP"),
       D("Cliente enviou as variáveis do mês?","Analista de DP",[R("Sim","",""), R("Não","cobrar o cliente e registrar na Cartela","fim")]),
       A("Lançar as variáveis no Domínio Folha","Analista de DP"), A("Calcular a folha","Analista de DP"), A("Conferir o resumo com o mês anterior","Analista de DP"),
       A("Conferir pisos e reajustes da convenção coletiva","Analista de DP"), A("Transmitir o S-1200 e fechar o período com o S-1299","Analista de DP"),
       A("Gerar as guias de FGTS e DCTFWeb","Analista de DP"), A("Enviar holerites, resumo e guias ao cliente","Analista de DP")]),
     indicadores:[{nome:"Folhas enviadas ao cliente até o 3º dia útil", meta:"≥ 95%"},{nome:"Retrabalho por erro de cálculo", meta:"≤ 2% das folhas"}],
     riscos:[{risco:"Cálculo com piso ou reajuste desatualizado", controle:"Conferência da convenção na aba Convenções do Hub antes de calcular", nivel:"Alto"},{risco:"Atraso do cliente no envio das variáveis", controle:"Cobrança e registro na Cartela de clientes", nivel:"Médio"}],
     historico:[h("1.0","2025-03-05","Criação do POP"),h("1.0","2025-03-12","Aprovado e publicado"),h("1.1","2026-03-02","Revisão aberta: inclusão do FGTS Digital"),h("1.1","2026-03-10","Aprovado e publicado")]},
    {id:"exdp002", codigo:"POP-DP-002", titulo:"Procedimento para Registrar Admissão na Solicitação pelo Portal", departamento:"Pessoal", setor:"Admissão e Desligamento", atividade:"Admissão de Funcionários", tarefa:"Registrar admissão", cenario:"Solicitação pelo Portal",
     versao:"1.0", status:"aprovado", fase:"implementacao", dono:"Coordenação do Pessoal", executor:"Analista de DP", aprovador:"Coordenação do Pessoal", aprovadoEm:"2025-09-15", aprovadoPor:"Coordenação do Pessoal", proxRevisao:"2026-09-15", revisaoMeses:12,
     objetivo:"Registrar o novo funcionário no Domínio e no eSocial antes do início das atividades, a partir da ficha enviada pelo cliente no Portal.",
     escopo:"Admissões CLT solicitadas pelo Portal do Cliente.",
     gatilho:"Ficha de admissão recebida no Portal do Cliente", frequencia:"Sob demanda", tempoMedio:"30 min",
     fornecedores:["Cliente","Candidato admitido"], entradas:["Ficha de admissão","Documentos pessoais","Exame admissional (ASO)"], sistemas:["Portal do Cliente","Domínio Folha","eSocial"],
     saidas:["Contrato de trabalho","Evento S-2200 transmitido"], clientes:["Cliente","Funcionário"],
     passos: comIds([A("Conferir a ficha e os documentos recebidos","Analista de DP"),
       D("A documentação está completa e o ASO é apto?","Analista de DP",[R("Sim","",""), R("Não","devolver ao cliente com a lista do que falta","fim")]),
       A("Cadastrar o funcionário no Domínio","Analista de DP"), A("Transmitir o S-2200 antes do início das atividades","Analista de DP"), A("Enviar o contrato para assinatura","Analista de DP")]),
     indicadores:[{nome:"S-2200 transmitido antes do início das atividades", meta:"100%"}],
     riscos:[{risco:"Admissão informada depois do início do trabalho", controle:"Orientação ao cliente e prazo mínimo de 2 dias no Portal", nivel:"Alto"}],
     historico:[h("1.0","2025-09-08","Criação do POP"),h("1.0","2025-09-15","Aprovado e publicado")]},
    {id:"exdp003", codigo:"POP-DP-003", titulo:"Procedimento para Calcular Rescisão na Dispensa sem Justa Causa", departamento:"Pessoal", setor:"Admissão e Desligamento", atividade:"Desligamento de Funcionários", tarefa:"Calcular rescisão", cenario:"Dispensa sem Justa Causa",
     versao:"1.0", status:"revisao", fase:"desenho", dono:"Coordenação do Pessoal", executor:"Analista de DP", aprovador:"Coordenação do Pessoal", revisaoMeses:12,
     objetivo:"Calcular as verbas rescisórias corretamente e permitir o pagamento em até 10 dias após o término do contrato.",
     escopo:"Dispensas sem justa causa de funcionários CLT.", gatilho:"Comunicação do desligamento pelo cliente", frequencia:"Sob demanda", tempoMedio:"50 min",
     fornecedores:["Cliente"], entradas:["Comunicado de desligamento","Aviso prévio","Exame demissional (ASO)"], sistemas:["Domínio Folha","eSocial","FGTS Digital"],
     saidas:["Termo de rescisão (TRCT)","Guia do FGTS rescisório","Evento S-2299"], clientes:["Cliente","Ex-funcionário"],
     passos: comIds([A("Confirmar a data de saída e o tipo de aviso prévio","Analista de DP"), A("Conferir férias, 13º e banco de horas pendentes","Analista de DP"), A("Calcular a rescisão no Domínio","Analista de DP"),
       D("A convenção prevê indenização adicional?","Analista de DP",[R("Sim","incluir a verba e anexar a cláusula",""), R("Não","","s5")]),
       A("Transmitir o S-2299 e gerar a guia do FGTS rescisório","Analista de DP"), A("Enviar o TRCT e as guias ao cliente","Analista de DP")]),
     indicadores:[{nome:"Rescisões enviadas a tempo do pagamento em 10 dias", meta:"100%"}],
     riscos:[{risco:"Multa do art. 477 da CLT por pagamento fora do prazo", controle:"Lembrete na Agenda do DP com a data-limite", nivel:"Alto"}],
     historico:[h("1.0","2026-10-14","Criação do POP"),h("1.0","2026-10-20","Enviado para revisão")]},
    {id:"exfis001", codigo:"POP-FSN-001", titulo:"Procedimento para Apurar o DAS na Rotina Mensal", departamento:"Fiscal Simples Nacional", setor:"Apuração do Simples Nacional", atividade:"Apuração do DAS", tarefa:"Apurar o DAS", cenario:"Rotina Mensal",
     versao:"2.0", status:"aprovado", fase:"monitoramento", dono:"Coordenação Fiscal", executor:"Analista Fiscal", aprovador:"Coordenação Fiscal", aprovadoEm:"2026-05-04", aprovadoPor:"Coordenação Fiscal", proxRevisao:"2027-05-04", revisaoMeses:12,
     objetivo:"Apurar o Simples Nacional de cada empresa optante com a receita correta por anexo e enviar o DAS ao cliente antes do vencimento.",
     escopo:"Empresas optantes pelo Simples Nacional, inclusive com receitas de mais de um anexo.", gatilho:"Escrituração das notas do mês concluída", frequencia:"Mensal", tempoMedio:"25 min por empresa",
     fornecedores:["Cliente","Prefeitura e SEFAZ"], entradas:["Notas fiscais de saída do mês","Receita bruta dos últimos 12 meses","Folha dos últimos 12 meses"], sistemas:["Domínio Escrita Fiscal","Portal do Simples Nacional (PGDAS-D)"],
     saidas:["PGDAS-D transmitido","Guia DAS","Memória de cálculo"], clientes:["Cliente","Contábil"],
     passos: comIds([A("Conferir se todas as notas do mês foram importadas","Analista Fiscal"), A("Separar as receitas por anexo e por retenção","Analista Fiscal"),
       D("A empresa tem atividade sujeita ao Fator R?","Analista Fiscal",[R("Sim","calcular o Fator R com a folha dos 12 meses",""), R("Não","seguir com o anexo do CNAE","")]),
       A("Transmitir o PGDAS-D","Analista Fiscal"), A("Gerar o DAS e enviar ao cliente com a memória de cálculo","Analista Fiscal")]),
     indicadores:[{nome:"DAS enviado ao cliente até o dia 15", meta:"≥ 95%"},{nome:"Retificações de PGDAS-D no mês", meta:"≤ 1%"}],
     riscos:[{risco:"Receita em anexo errado", controle:"Conferência do CNAE de cada nota com a tabela de anexos", nivel:"Alto"},{risco:"Ultrapassar o sublimite sem perceber", controle:"Alerta de receita acumulada no Fiscal", nivel:"Médio"}],
     historico:[h("1.0","2025-04-10","Criação do POP"),h("1.0","2025-04-15","Aprovado e publicado"),h("2.0","2026-04-28","Revisão: separação por anexo e Fator R"),h("2.0","2026-05-04","Aprovado e publicado")]},
    {id:"exfis002", codigo:"POP-FIS-002", titulo:"Procedimento para Transmitir a EFD-Reinf na Rotina Mensal", departamento:"Fiscal", setor:"Entrega de Obrigações Acessórias", atividade:"Transmissão de Declarações Federais", tarefa:"Transmitir a EFD-Reinf", cenario:"Rotina Mensal",
     versao:"1.0", status:"rascunho", fase:"analise", dono:"Coordenação Fiscal", executor:"Analista Fiscal", revisaoMeses:12,
     objetivo:"Transmitir a EFD-Reinf no prazo com as retenções e os serviços tomados do período.", escopo:"", gatilho:"Fechamento das notas de serviços tomados", frequencia:"Mensal",
     fornecedores:["Cliente"], entradas:["Notas de serviços tomados com retenção"], sistemas:["Domínio Escrita Fiscal","EFD-Reinf"], saidas:["Recibo de transmissão"], clientes:["Cliente"],
     passos: comIds([A("Levantar as notas de serviços tomados com retenção","Analista Fiscal"), A("Gerar os eventos no Domínio","Analista Fiscal"), A("Transmitir e fechar o período","")]),
     historico:[h("1.0","2026-10-22","Criação do POP")]},
    {id:"exino001", codigo:"POP-INO-001", titulo:"Procedimento para Receber Solicitações na Demanda por E-mail", departamento:"Inovação", setor:"Atendimento de Demandas Solicitadas", atividade:"Tratamento de Demandas", tarefa:"Receber solicitações", cenario:"Demanda por E-mail",
     versao:"1.0", status:"aprovado", fase:"implementacao", dono:"Coordenação de Inovação", executor:"Analista de Inovação", aprovador:"Diretoria", aprovadoEm:"2026-08-18", aprovadoPor:"Diretoria", proxRevisao:"2027-02-18", revisaoMeses:6,
     objetivo:"Registrar toda demanda recebida por e-mail em até 1 dia útil, com solicitante, prazo e prioridade definidos.", escopo:"Demandas internas dos departamentos enviadas para a caixa da Inovação no Zimbra.",
     gatilho:"Novo e-mail na caixa da Inovação", frequencia:"Diária", tempoMedio:"10 min por demanda",
     fornecedores:["Departamentos internos"], entradas:["E-mail com a solicitação"], sistemas:["Zimbra","Gestta"], saidas:["Demanda registrada com prioridade"], clientes:["Solicitante"],
     passos: comIds([A("Acessar o Zimbra","Analista de Inovação"), A("Conferir o novo e-mail","Analista de Inovação"),
       D("A solicitação tem informação suficiente?","Analista de Inovação",[R("Sim","",""), R("Não","responder pedindo os detalhes","fim")]),
       A("Registrar a demanda no Gestta com prioridade e prazo","Analista de Inovação"), A("Responder ao solicitante confirmando o recebimento","Analista de Inovação")]),
     indicadores:[{nome:"Demandas registradas em até 1 dia útil", meta:"100%"}], riscos:[{risco:"E-mail esquecido na caixa", controle:"Conferência da caixa duas vezes ao dia", nivel:"Baixo"}],
     historico:[h("1.0","2026-08-11","Importado da planilha de mapeamento"),h("1.0","2026-08-18","Aprovado e publicado")]},
    {id:"exino002", codigo:"POP-INO-002", titulo:"Procedimento para Definir a Solução na Demanda Nova", departamento:"Inovação", setor:"Atendimento de Demandas Solicitadas", atividade:"Desenvolvimento de Instrumentos de Uso", tarefa:"Definir a solução", cenario:"Demanda Nova",
     versao:"1.0", status:"rascunho", fase:"planejamento", dono:"", executor:"Analista de Inovação", revisaoMeses:12, frequencia:"Sob demanda",
     passos: comIds([A("Identificar o solicitante"), A("Entender o problema e o resultado esperado")]),
     historico:[h("1.0","2026-10-27","Importado da planilha de mapeamento")]},
    {id:"excom001", codigo:"POP-COM-001", titulo:"Procedimento para Elaborar Proposta Comercial no Cliente Novo", departamento:"Comercial", setor:"Prospecção e Vendas", atividade:"Elaboração de Propostas", tarefa:"Elaborar proposta comercial", cenario:"Cliente Novo",
     versao:"1.0", status:"aprovado", fase:"implementacao", dono:"Coordenação Comercial", executor:"Consultor Comercial", aprovador:"Diretoria", aprovadoEm:"2026-04-22", aprovadoPor:"Diretoria", proxRevisao:"2027-04-22", revisaoMeses:12,
     objetivo:"Enviar ao potencial cliente, em até 2 dias úteis, uma proposta com escopo, honorários e prazos coerentes com o porte e a tributação da empresa.",
     escopo:"Empresas que ainda não são clientes. Ampliação de escopo de clientes ativos segue outro cenário.", gatilho:"Reunião de diagnóstico realizada", frequencia:"Sob demanda", tempoMedio:"1 h",
     fornecedores:["Potencial cliente","Departamentos técnicos"], entradas:["Diagnóstico da empresa","Tabela de honorários"], sistemas:["Modelo de proposta","CRM"], saidas:["Proposta enviada","Oportunidade registrada"], clientes:["Potencial cliente","Diretoria"],
     passos: comIds([A("Registrar a oportunidade no CRM","Consultor Comercial"), A("Calcular os honorários pela tabela","Consultor Comercial"),
       D("Os honorários ficaram fora da tabela?","Consultor Comercial",[R("Sim","pedir aprovação da diretoria",""), R("Não","","s5")]),
       A("Registrar a aprovação da diretoria","Consultor Comercial"), A("Preencher o modelo de proposta","Consultor Comercial"), A("Enviar a proposta ao cliente","Consultor Comercial")]),
     indicadores:[{nome:"Propostas enviadas em até 2 dias úteis", meta:"≥ 90%"},{nome:"Taxa de conversão de propostas", meta:"≥ 35%"}],
     riscos:[{risco:"Honorário abaixo do custo de atendimento", controle:"Aprovação da diretoria fora da tabela", nivel:"Alto"}],
     historico:[h("1.0","2026-04-15","Criação do POP"),h("1.0","2026-04-22","Aprovado e publicado")]},
    {id:"exfin001", codigo:"POP-FIN-001", titulo:"Procedimento para Cobrar Honorários em Atraso no Cliente Inadimplente", departamento:"Financeiro", setor:"Faturamento e Cobrança", atividade:"Cobrança de Honorários", tarefa:"Cobrar honorários em atraso", cenario:"Cliente Inadimplente",
     versao:"1.1", status:"revisao", fase:"refinamento", dono:"Coordenação Financeira", executor:"Analista Financeiro", aprovador:"Diretoria", revisaoMeses:6,
     objetivo:"Recuperar os honorários vencidos com contato escalonado e registro de cada tentativa, sem prejudicar o relacionamento com o cliente.",
     escopo:"Boletos de honorários vencidos há mais de 5 dias.", gatilho:"Relatório de títulos vencidos", frequencia:"Semanal", tempoMedio:"10 min por cliente",
     fornecedores:["Banco"], entradas:["Relatório de títulos vencidos"], sistemas:["Sistema financeiro","Zappy"], saidas:["Cobrança registrada","Acordo ou boleto reemitido"], clientes:["Diretoria","Cliente"],
     passos: comIds([A("Emitir o relatório de títulos vencidos","Analista Financeiro"), A("Enviar o lembrete de pagamento pelo Zappy","Analista Financeiro"),
       D("O cliente pagou em até 5 dias?","Analista Financeiro",[R("Sim","dar baixa no título","fim"), R("Não","","")]),
       A("Ligar para o responsável financeiro do cliente","Analista Financeiro"),
       D("O cliente propôs acordo?","Analista Financeiro",[R("Sim","reemitir o boleto com a nova data","fim"), R("Não","","")]),
       A("Encaminhar o caso para a diretoria","Analista Financeiro")]),
     indicadores:[{nome:"Inadimplência acima de 30 dias", meta:"≤ 3% do faturamento"}],
     riscos:[{risco:"Cobrança indevida de título já pago", controle:"Conferência da baixa bancária antes do contato", nivel:"Médio"}],
     historico:[h("1.0","2026-02-03","Criação do POP"),h("1.0","2026-02-10","Aprovado e publicado"),h("1.1","2026-10-19","Revisão aberta: inclusão do acordo")]},
    {id:"exprj001", codigo:"POP-PRJ-001", titulo:"Procedimento para Abrir Projeto no Projeto Interno", departamento:"Projetos", setor:"Gestão de Projetos", atividade:"Abertura de Projetos", tarefa:"Abrir projeto", cenario:"Projeto Interno",
     versao:"1.0", status:"rascunho", fase:"planejamento", dono:"Coordenação de Projetos", executor:"Gerente de Projeto", revisaoMeses:12,
     objetivo:"Formalizar o início de cada projeto interno com objetivo, patrocinador, escopo e cronograma aprovados.", frequencia:"Sob demanda",
     entradas:["Demanda aprovada pela diretoria"], saidas:["Termo de abertura","Cronograma inicial"], sistemas:["Gestta"],
     passos: comIds([A("Preencher o termo de abertura","Gerente de Projeto"), A("Definir o patrocinador e a equipe","Gerente de Projeto"), A("Montar o cronograma inicial","Gerente de Projeto"), A("Apresentar o projeto para aprovação","Gerente de Projeto")]),
     historico:[h("1.0","2026-10-23","Criação do POP")]},
    {id:"exgp001", codigo:"POP-GP-001", titulo:"Procedimento para Integrar Novo Colaborador na Admissão de Funcionário", departamento:"Gestão de Pessoas", setor:"Recrutamento e Desenvolvimento", atividade:"Integração de Colaboradores", tarefa:"Integrar novo colaborador", cenario:"Admissão de Funcionário",
     versao:"1.0", status:"aprovado", fase:"monitoramento", dono:"Gestão de Pessoas", executor:"Analista de Gestão de Pessoas", aprovador:"Diretoria", aprovadoEm:"2026-02-16", aprovadoPor:"Diretoria", proxRevisao:"2027-02-16", revisaoMeses:12,
     objetivo:"Garantir que todo colaborador novo tenha acesso, equipamento, apresentação da cultura e treinamento nos POPs do seu setor na primeira semana.",
     escopo:"Colaboradores CLT e estagiários da Controltax.", gatilho:"Contratação aprovada", frequencia:"Sob demanda", tempoMedio:"3 h ao longo da primeira semana",
     fornecedores:["TI","Coordenação do setor"], entradas:["Dados do colaborador","Data de início"], sistemas:["Control Hub","POP Master"], saidas:["Checklist de integração concluído"], clientes:["Novo colaborador","Coordenação do setor"],
     passos: comIds([A("Solicitar os acessos à TI","Analista de Gestão de Pessoas"), A("Preparar a estação de trabalho","TI"), A("Apresentar a empresa e a cultura","Analista de Gestão de Pessoas"),
       A("Apresentar os POPs do setor no POP Master","Coordenação do setor"),
       D("O colaborador concluiu os treinamentos da primeira semana?","Coordenação do setor",[R("Sim","",""), R("Não","reagendar os treinamentos pendentes","s4")]),
       A("Registrar a integração como concluída","Analista de Gestão de Pessoas")]),
     indicadores:[{nome:"Integrações concluídas na primeira semana", meta:"100%"}], riscos:[{risco:"Colaborador começa sem acesso aos sistemas", controle:"Pedido à TI com 3 dias de antecedência", nivel:"Médio"}],
     historico:[h("1.0","2026-02-09","Criação do POP"),h("1.0","2026-02-16","Aprovado e publicado")]},
    {id:"exsoc001", codigo:"POP-SOC-001", titulo:"Procedimento para Abrir Empresa no Cliente Novo", departamento:"Societário", setor:"Legalização de Empresas", atividade:"Abertura de Empresas", tarefa:"Abrir empresa", cenario:"Cliente Novo",
     versao:"1.0", status:"aprovado", fase:"implementacao", dono:"Coordenação Societária", executor:"Analista Societário", aprovador:"Coordenação Societária", aprovadoEm:"2026-06-30", aprovadoPor:"Coordenação Societária", proxRevisao:"2027-06-30", revisaoMeses:12,
     objetivo:"Registrar a nova empresa do cliente com CNPJ, inscrições e licenças necessárias para começar a operar.",
     escopo:"Abertura de sociedades limitadas e empresários individuais no Espírito Santo.", gatilho:"Contrato de serviço assinado", frequencia:"Sob demanda", tempoMedio:"10 dias úteis",
     fornecedores:["Cliente","Junta Comercial","Prefeitura"], entradas:["Documentos dos sócios","Endereço e atividades"], sistemas:["REDESIM","Junta Comercial","Prefeitura"], saidas:["CNPJ","Inscrições estadual e municipal","Alvará"], clientes:["Cliente","Contábil","Fiscal"],
     passos: comIds([A("Fazer a consulta de viabilidade","Analista Societário"),
       D("A viabilidade foi deferida?","Analista Societário",[R("Sim","",""), R("Não","ajustar endereço ou atividade com o cliente","s1")]),
       A("Elaborar o contrato social","Analista Societário"), A("Registrar o contrato na Junta Comercial","Analista Societário"), A("Solicitar as inscrições e o alvará","Analista Societário"), A("Entregar a documentação ao cliente","Analista Societário")]),
     indicadores:[{nome:"Empresas abertas em até 10 dias úteis", meta:"≥ 80%"}], riscos:[{risco:"Atividade incompatível com o endereço", controle:"Consulta de viabilidade antes do contrato social", nivel:"Alto"}],
     historico:[h("1.0","2026-06-23","Criação do POP"),h("1.0","2026-06-30","Aprovado e publicado")]},
    {id:"exti001", codigo:"POP-TI-001", titulo:"Procedimento para Criar Acesso de Colaborador na Admissão de Funcionário", departamento:"TI", setor:"Suporte e Infraestrutura", atividade:"Gestão de Acessos", tarefa:"Criar acesso de colaborador", cenario:"Admissão de Funcionário",
     versao:"1.0", status:"aprovado", fase:"monitoramento", dono:"Coordenação de TI", executor:"Analista de TI", aprovador:"Coordenação de TI", aprovadoEm:"2026-03-25", aprovadoPor:"Coordenação de TI", proxRevisao:"2027-03-25", revisaoMeses:12,
     objetivo:"Liberar só os acessos necessários ao cargo do novo colaborador antes do primeiro dia de trabalho.",
     escopo:"E-mail, rede, Domínio, Onvio e Control Hub.", gatilho:"Pedido de Gestão de Pessoas", frequencia:"Sob demanda", tempoMedio:"45 min",
     fornecedores:["Gestão de Pessoas"], entradas:["Pedido com cargo e setor"], sistemas:["Zimbra","Active Directory","Domínio","Onvio","Control Hub"], saidas:["Usuário criado","Termo de responsabilidade assinado"], clientes:["Novo colaborador"],
     passos: comIds([A("Conferir o cargo e o setor no pedido","Analista de TI"), A("Criar o usuário de rede e o e-mail","Analista de TI"), A("Liberar os sistemas do perfil do cargo","Analista de TI"),
       D("O cargo precisa de acesso administrativo?","Analista de TI",[R("Sim","pedir aprovação da coordenação",""), R("Não","","s6")]),
       A("Registrar a aprovação do acesso administrativo","Analista de TI"), A("Colher a assinatura do termo de responsabilidade","Analista de TI")]),
     indicadores:[{nome:"Acessos prontos antes do primeiro dia", meta:"100%"}], riscos:[{risco:"Acesso além do necessário ao cargo", controle:"Perfis de acesso por cargo e aprovação para acesso administrativo", nivel:"Alto"}],
     historico:[h("1.0","2026-03-18","Criação do POP"),h("1.0","2026-03-25","Aprovado e publicado")]}
  ];
  var EXTRA = {
    excon002:["documentos do mês, extratos, notas, pendência de documentos, onvio",1], excon001:["extrato, banco, ofx, saldo bancário, diferença",1], excon003:["importação, lançamentos, layout domínio",0], excon004:["importação, planilha excel, conversão",0],
    exdp001:["holerite, contracheque, salário, folha mensal, esocial, fgts, dctfweb",1], exdp002:["contratação, novo funcionário, ficha de registro, s-2200, aso",1], exdp003:["demissão, desligamento, trct, verbas rescisórias, s-2299",0],
    exfis001:["simples, pgdas, das, guia do simples, fator r, anexo",1], exfis002:["reinf, retenções, serviços tomados, r-2010, r-4020",1],
    exino001:["pedido, chamado, e-mail, solicitação interna, zimbra, gestta",1], exino002:["solução, demanda nova, análise",0],
    excom001:["orçamento, proposta, honorários, cliente novo, venda",1], exfin001:["inadimplência, atraso, boleto vencido, cobrança",1], exprj001:["projeto, termo de abertura, cronograma",1],
    exgp001:["integração, onboarding, primeiro dia, novo colaborador, treinamento",1], exsoc001:["abertura de empresa, cnpj, contrato social, junta comercial, viabilidade",1], exti001:["acesso, login, senha, e-mail novo, usuário de rede",1]
  };
  L.forEach(function(x){ var e = EXTRA[x.id]; if(e){ x.palavras = e[0]; x.essencial = !!e[1]; } });
  return L;
}
var semeando = false;
// Grava os exemplos: catálogo vazio recebe todos; na atualização, só os exemplos novos e os antigos que ninguém alterou.
function semear(m, meta){
  if(semeando || !podeEditar() || !S.podeGravar) return;
  semeando = true;
  var fila = Promise.resolve(), n = 0;
  exemplos().forEach(function(x){
    var id = x.id, atual = m[id];
    if(meta){
      if(atual && atual.atualizadoPor !== "Coordenação") return;
      if(!atual && (IDS_V1.indexOf(id) !== -1 || (+meta.seed || 0) >= 2)) return; // exemplo que a equipe excluiu não volta
    }
    delete x.id; x.criadoEm = x.historico[0].data; x.atualizadoEm = x.historico[x.historico.length - 1].data + "T09:00"; x.atualizadoPor = "Coordenação";
    var o = normPop(x, id); delete o.id; n++;
    fila = fila.then(function(){ return banco.set(id, o); });
  });
  fila = fila.then(function(){ return banco.set("_meta", {seed: SEED_VERSAO, em: new Date().toISOString().slice(0, 16)}); });
  fila.then(function(){ if(n) toast(meta ? "Exemplos atualizados." : "POPs de exemplo carregados."); }, function(){ semeando = false; });
}

/* ============ ponte com o assistente do Hub ============ */
/* ============ ponte com o Tax (assistente do Hub) ============ */
// O Tax pergunta "como faço X?" e recebe os POPs que respondem, com os passos prontos para explicar.
var PERG_STOP = {como:1, faco:1, faz:1, fazer:1, fazemos:1, faria:1, procedimento:1, procedimentos:1, passo:1, passos:1, pop:1, pops:1, qual:1, quais:1, onde:1, preciso:1, devo:1, executar:1, realizar:1, tem:1, existe:1, sobre:1, modulo:1, setor:1, departamento:1, depto:1, me:1, explica:1, explique:1, ensina:1, mostra:1, mostre:1, quero:1, saber:1, gente:1, nos:1, aqui:1, isso:1, esse:1, essa:1, la:1, ai:1};
function depDoTexto(q){
  var n = " " + norm(q).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ", achou = "";
  DEPS.slice().sort(function(a, b){ return b.n.length - a.n.length; }).some(function(d){ if(n.indexOf(" " + norm(d.n) + " ") !== -1){ achou = d.n; return true; } });
  if(!achou) Object.keys(DEP_ALIAS).some(function(k){ if(k.length > 2 && n.indexOf(" " + k + " ") !== -1){ achou = DEP_ALIAS[k]; return true; } });
  if(!achou && /\b(dp|folha)\b/.test(n)) achou = "Pessoal";
  return achou;
}
function buscarPerg(q, dep){
  dep = depCanon(dep) || depDoTexto(q);
  var siglas = (String(q).match(/\b[A-Z][A-Z0-9-]{1,}\b/g) || []).map(norm);
  var semDep = norm(q).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " "); if(dep) [dep].concat(Object.keys(DEP_ALIAS).filter(function(k){ return DEP_ALIAS[k] === dep; })).forEach(function(x){ semDep = (" " + semDep + " ").replace(" " + norm(x) + " ", " ").trim(); });
  var ws = palavrasBusca(semDep).filter(function(w){ return !PERG_STOP[w]; });
  siglas.forEach(function(sg){ if(ws.indexOf(sg) === -1 && semDep.split(" ").indexOf(sg) !== -1) ws.push(sg); });
  if(!ws.length) return {dep: dep, ws: ws, r: []};
  var base = ativos().filter(function(p){ return !dep || p.departamento === dep; });
  var r = buscar("", ws).filter(function(x){ return !dep || x.p.departamento === dep; });
  var sgUsadas = siglas.filter(function(sg){ return ws.indexOf(sg) !== -1 && sg.length <= 6; });
  if(sgUsadas.length){ var inteira = r.filter(function(x){ var h = " " + norm([x.p.titulo, x.p.tarefa, x.p.palavras, x.p.codigo].concat(x.p.passos.map(function(y){ return y.texto; })).join(" ")).replace(/[^a-z0-9]/g, " ") + " "; return sgUsadas.every(function(sg){ return h.indexOf(" " + sg + " ") !== -1; }); }); if(inteira.length) r = inteira; }
  if(!r.length){
    // Sem todas as palavras: procura por prefixo de cada palavra e aceita quem bate na maioria.
    var pre = ws.map(function(w){ return w.length > 4 ? w.slice(0, Math.max(4, w.length - 3)) : w; });
    r = base.map(function(p){
      var hay = norm([p.titulo, p.tarefa, p.palavras, p.cenario, p.atividade, p.setor, p.objetivo].concat(p.passos.map(function(x){ return x.texto; })).join(" "));
      var n = pre.filter(function(w){ return hay.indexOf(w) !== -1; }).length;
      return n >= Math.max(1, Math.ceil(pre.length * 0.6)) ? {p: p, score: n * 5 + (p.status === "aprovado" ? 4 : 0), passo: -1} : null;
    }).filter(Boolean).sort(function(a, b){ return b.score - a.score; });
  }
  return {dep: dep, ws: ws, r: r};
}
function passosTexto(p){
  return p.passos.map(function(x, i){
    if(x.tipo !== "decisao") return (i + 1) + ". " + x.texto + (x.resp ? " (" + x.resp + ")" : "");
    return (i + 1) + ". Decisão: " + x.texto + " " + x.ramos.map(function(r){ return r.rotulo + (r.nota ? " (" + r.nota + ")" : "") + " → " + destinoRot(p, r.destino); }).join("; ");
  });
}
function resumoPop(p, completo){
  var o = {id: p.id, codigo: p.codigo, titulo: p.titulo, departamento: p.departamento, caminho: [p.setor, p.atividade, p.tarefa].join(" › "), cenario: p.cenario, situacao: ST[p.status].l, versao: p.versao};
  if(p.variacao) o.metodo = p.variacao;
  if(p.status !== "aprovado") o.aviso = "Ainda não aprovado: pode mudar.";
  if(vencida(p)) o.aviso = "Revisão periódica vencida: confirme com o dono do processo.";
  if(!completo) return o;
  ["objetivo","dono","executor","tempoMedio","frequencia","gatilho"].forEach(function(k){ if(p[k]) o[k] = p[k]; });
  if(p.sistemas.length) o.sistemas = p.sistemas; if(p.entradas.length) o.entradas = p.entradas; if(p.saidas.length) o.saidas = p.saidas;
  o.passos = passosTexto(p);
  return o;
}
window.__assistente = {
  modulo: "pop", nome: "POP Master", abas: VIEWS,
  pronto: function(){ return S.carregou; }, exemplo: function(){ return false; },
  empresas: function(){ return []; }, analistas: function(){ return []; },
  irPara: function(v){ irPara(VIEWS.indexOf(v) !== -1 ? v : "inicio"); return true; },
  abrirEmpresa: function(){ return false; },
  // Abre a ficha do POP (ou já o modo "Executar passo a passo").
  abrirPop: function(id, executar){ if(!S.pops[id]) return false; irPara("inicio"); if(executar) abrirExec(id); else abrirPop(id); return true; },
  // Busca para perguntas como "como faço a conciliação bancária no contábil?".
  buscarPops: function(texto, dep, max){
    var b = buscarPerg(texto || "", dep || "");
    var r = b.r.slice(0, max || 5);
    return {departamento: b.dep, palavras: b.ws, total: b.r.length, pops: r.map(function(x, i){ var o = resumoPop(x.p, i < 2); if(x.passo !== -1) o.passoEncontrado = x.passo + 1; return o; }),
      semResultado: b.r.length ? "" : "Nenhum POP cadastrado responde a isso" + (b.dep ? " no " + b.dep : "") + ". Sugira procurar no POP Master por outras palavras ou falar com a coordenação do setor."};
  },
  consultar: function(tipo, p){
    if(tipo !== "pops" && tipo !== "procedimentos") return null;
    var b = buscarPerg((p && (p.q || p.texto)) || "", ""), ls = (p && (p.q || p.texto)) ? b.r.map(function(x){ return x.p; }) : ativos();
    return {titulo: "POPs", total: ls.length, linhas: ls.slice(0, 30).map(function(x){ return {t: x.codigo + " · " + x.titulo, sub: ST[x.status].l + " · " + caminho(x), data: x.proxRevisao || "", tom: vencida(x) ? "late" : "", abrir: {pop: x.id}}; })};
  },
  // Modo professor do Tax: o POP inteiro, com cada passo e as decisões, para ensinar um passo de cada vez.
  aulaPop: function(id){
    var p = S.pops[id]; if(!p) return null;
    var o = resumoPop(p, true);
    if(p.escopo) o.escopo = p.escopo;
    if(p.riscos.length) o.riscos = p.riscos.map(function(r){ return r.risco + (r.controle ? " (controle: " + r.controle + ")" : ""); });
    o.passosDet = p.passos.map(function(x, i){ return {n: i + 1, tipo: x.tipo, texto: x.texto, resp: x.resp, ramos: x.ramos.map(function(r){ return {rotulo: r.rotulo, nota: r.nota, destino: destinoRot(p, r.destino)}; })}; });
    return o;
  },
  podeEditar: function(){ return podeEditar(); },
  acao: function(){ return {erro: "No POP Master as alterações são feitas pela própria tela."}; }
};

/* ============ voltar ao Hub e início ============ */
(function(){ var solto = true; try{ solto = window.parent === window || !window.parent.__hubFecharModulo; }catch(e){} document.body.classList.toggle("solto", solto); })();
$("#hubBack").onclick = function(e){ try{ var P = window.parent; if(P !== window && (P.__hubFecharModulo || P.__hubClosePortal)){ e.preventDefault(); (P.__hubFecharModulo || P.__hubClosePortal)(); } }catch(x){} };
document.addEventListener("keydown", function(e){
  if(e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") && !document.querySelector("dialog[open]")){ e.preventDefault(); irPara("inicio"); $("#qBusca").focus(); }
});

(function iniciar(){
  S.papel = papelAuth();
  var p = lerPrefs();
  irPara(VIEWS.indexOf(p.view) !== -1 ? p.view : "inicio");
  ligarUsuario();
  usarCap("db").catch(function(){ return null; }).then(function(raw){
    if(raw) banco = bancoReal(raw); else { banco = bancoLocal(); semBanco = true; $("#semBanco").hidden = false; }
    banco.ouvir(function(m){
      var meta = m._meta || null;
      var pops = {}; Object.keys(m).forEach(function(id){ if(id.charAt(0) !== "_") pops[id] = normPop(m[id], id); });
      S.pops = pops; S.meta = meta; S.carregou = true; $("#carregando").hidden = true;
      if(!Object.keys(pops).length && !meta) semear(m, null);
      else if(meta && (+meta.seed || 0) < SEED_VERSAO) semear(m, meta);
      render();
      if(verId && $("#dlgVer").open && !S.pops[verId]) $("#dlgVer").close();
    }, function(){ $("#carregando").innerHTML = "<span>Não foi possível carregar os POPs agora. Recarregue a página.</span>"; });
    banco.ouvirUsers(function(m){ S.users = m || {}; render(); }, function(){});
    return usarCap("user").catch(function(){ return null; });
  }).then(function(u){
    if(!u) return;
    try{ if(u.can && u.can("data.write") === false) S.podeGravar = false; }catch(e){}
    Promise.resolve(u.name ? u.name() : "").catch(function(){ return ""; }).then(function(n){ S.nomeConta = n || ""; });
    render();
  });
})();
})();
