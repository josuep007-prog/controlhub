(function(){
  "use strict";
  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* ---------- tema claro/escuro ---------- */
  (function(){
    var SUN = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="3.6" stroke="currentColor" stroke-width="1.4"/><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M10 1.6v2.1M10 16.3v2.1M18.4 10h-2.1M3.7 10H1.6M15.7 4.3l-1.5 1.5M5.8 14.2l-1.5 1.5M15.7 15.7l-1.5-1.5M5.8 5.8 4.3 4.3"/></g></svg>';
    var MOON = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11.2A7.2 7.2 0 0 1 8.8 3 7.2 7.2 0 1 0 17 11.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    var btn = $("#themeToggle");
    if(!btn) return;
    var sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    function saved(){ try{ return localStorage.getItem("controlhub-theme"); }catch(e){ return null; } }
    function save(v){ try{ if(v) localStorage.setItem("controlhub-theme", v); else localStorage.removeItem("controlhub-theme"); }catch(e){} }
    function effectiveDark(){
      var s = saved();
      if(s === "light") return false;
      if(s === "dark") return true;
      return !!(sysDark && sysDark.matches);
    }
    function paint(){
      var dark = effectiveDark();
      btn.innerHTML = dark ? SUN : MOON;
      btn.title = dark ? "Mudar para tema claro" : "Mudar para tema escuro";
    }
    btn.addEventListener("click", function(){
      var next = effectiveDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      save(next);
      paint();
    });
    paint();
  })();

  var SETORES = [
    {key:"pessoal",  label:"Pessoal",  tag:"PES"},
    {key:"contabil", label:"Contábil", tag:"CON"},
    {key:"fiscal",   label:"Fiscal",   tag:"FIS"}
  ];
  var SETOR_LABEL = {pessoal:"Pessoal", contabil:"Contábil", fiscal:"Fiscal"};
  var SETOR_TAG = {pessoal:"PES", contabil:"CON", fiscal:"FIS"};

  var ETAPAS = [
    {key:"habilitacaoDominio",   label:"Habilitação no Domínio",        curto:"Habilitação", porEmpresa:true},
    {key:"treinamentoAnalista",  label:"Treinamento do analista",       curto:"Trein. analista"},
    {key:"cadastroUsuario",      label:"Cadastro do usuário do cliente", curto:"Cadastro usuário", calculada:true},
    {key:"treinamentoCliente",   label:"Treinamento dos clientes",      curto:"Trein. cliente"}
  ];
  var ALINHAMENTO_SETORES = ["pessoal","contabil","fiscal"];
  var STATUS_ORDER = ["pendente","andamento","concluido"];
  // Treinamento com o cliente tem um passo a mais: agendado (com data).
  var STATUS_CLIENTE = ["pendente","agendado","andamento","concluido"];
  var STATUS_LABEL = {pendente:"Pendente", agendado:"Agendado", andamento:"Em andamento", concluido:"Concluído"};
  var ST_COLOR = {pendente:"var(--st-pend)", agendado:"var(--blue-deep)", andamento:"var(--st-and)", concluido:"var(--status-green)"};
  // Treinamento do analista também pode ser agendado (com data), igual treinamento dos clientes.
  function ordemStatus(etapaKey){ return (etapaKey === "treinamentoCliente" || etapaKey === "treinamentoAnalista") ? STATUS_CLIENTE : STATUS_ORDER; }
  function etapaAgendamentoAtrasado(agendadoPara){ return !!agendadoPara && agendadoPara < hojeISO(); }
  function dataCurta(d){ return d ? d.split("-").reverse().slice(0, 2).join("/") : ""; }
  function rotuloStatus(st, agendadoPara, hora){ return STATUS_LABEL[st] + (st === "agendado" && agendadoPara ? " · " + dataCurta(agendadoPara) + (hora ? " " + hora : "") : ""); }
  // Horário do agendamento: "HH:MM" ou vazio (é opcional).
  function horaValida(v){ return !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
  function normalizarHora(v){
    if(v === null || v === undefined || v === "") return "";
    if(typeof v === "number" && v >= 0 && v < 1){ var m = Math.round(v * 1440); return pad2(Math.floor(m / 60) % 24) + ":" + pad2(m % 60); }
    var r = String(v).trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?/);
    if(!r) return "";
    var h = +r[1], mi = +(r[2] || 0);
    return h < 24 && mi < 60 ? pad2(h) + ":" + pad2(mi) : "";
  }
  // Chave para ordenar por data e, no mesmo dia, por horário (sem horário vai para o fim do dia).
  function chaveAgenda(x){ return (x.agendadoPara || "9999") + " " + (x.agendadoHora || "99:99"); }
  var CARGOS = ["Estagiário(a)","Analista","Gestor(a)","Coordenador(a)","Supervisor(a)","Diretor(a)"];
  var CARGO_COR = {
    "Estagiário(a)":"--cargo-1", "Estagiário":"--cargo-1",
    "Analista":"--cargo-2",
    "Gestor(a)":"--cargo-3", "Gestor":"--cargo-3",
    "Coordenador(a)":"--cargo-4", "Coordenador":"--cargo-4",
    "Supervisor(a)":"--cargo-5", "Supervisor":"--cargo-5",
    "Diretor(a)":"--cargo-6", "Diretor":"--cargo-6"
  };

  function etapasAplicaveis(empresa, setor){
    return ETAPAS.filter(function(e){ return !e.onlyIf || e.onlyIf(empresa, setor); });
  }
  function defaultEtapas(){
    var o = {}; ETAPAS.forEach(function(e){ o[e.key] = {status:"pendente", data:"", obs:""}; }); return o;
  }
  var idxContatos = {ref:null, mapa:{}};
  function contatosDoSetor(empresaId, setorKey){
    if(idxContatos.ref !== state.contatos){
      var mapa = {};
      state.contatos.forEach(function(c){ (c.setores || []).forEach(function(sk){ (mapa[c.empresaId + "|" + sk] = mapa[c.empresaId + "|" + sk] || []).push(c); }); });
      idxContatos = {ref:state.contatos, mapa:mapa};
    }
    return idxContatos.mapa[empresaId + "|" + setorKey] || [];
  }
  function statusClienteComputado(empresaId, setorKey){
    var lista = contatosDoSetor(empresaId, setorKey);
    if(!lista.length) return {status:"pendente", agendadoPara:"", total:0, feitos:0};
    var feitos = lista.filter(function(c){ return c.statusTreinamento === "concluido"; }).length;
    var st;
    if(feitos === lista.length) st = "concluido";
    else if(feitos > 0 || lista.some(function(c){ return c.statusTreinamento === "andamento"; })) st = "andamento";
    else if(lista.some(function(c){ return c.statusTreinamento === "agendado"; })) st = "agendado";
    else st = "pendente";
    var prox = lista.filter(function(c){ return c.statusTreinamento === "agendado" && c.agendadoPara; }).sort(function(a, b){ return chaveAgenda(a).localeCompare(chaveAgenda(b)); })[0];
    var fim = st === "concluido" ? lista.map(function(c){ return String(c.concluidoEm||"").slice(0,10); }).sort().pop() : "";
    return {status:st, agendadoPara: st === "agendado" && prox ? prox.agendadoPara : "", agendadoHora: st === "agendado" && prox ? (prox.agendadoHora || "") : "", data:fim||"", total:lista.length, feitos:feitos};
  }
  // Cadastro do usuário do cliente no Onvio: calculado pelos contatos, como o treinamento. Cada contato guarda
  // cadastroOnvio {status:"ativo", em, deptos}; sem "deptos" vale para todos os setores do contato.
  // Contato já treinado: pressupõe-se que o usuário dele está ativo no Onvio e que a empresa foi habilitada no Domínio.
  function contatoTreinado(c){ return !!c && c.statusTreinamento === "concluido"; }
  function cadastroExplicitoNoSetor(c, setorKey){
    var co = c && c.cadastroOnvio;
    if(!co || co.status !== "ativo") return false;
    return !co.deptos || !co.deptos.length || co.deptos.indexOf(setorKey) !== -1;
  }
  function cadastroAtivoNoSetor(c, setorKey){ return contatoTreinado(c) || cadastroExplicitoNoSetor(c, setorKey); }
  function cadastroInferido(c, setorKey){ return contatoTreinado(c) && !cadastroExplicitoNoSetor(c, setorKey); }
  function statusCadastroComputado(empresaId, setorKey){
    var lista = contatosDoSetor(empresaId, setorKey);
    if(!lista.length) return {status:"pendente", data:"", total:0, feitos:0};
    var feitos = lista.filter(function(c){ return cadastroAtivoNoSetor(c, setorKey); }).length;
    var st = feitos === lista.length ? "concluido" : feitos > 0 ? "andamento" : "pendente";
    var fim = st === "concluido" ? lista.map(function(c){ return String((c.cadastroOnvio && c.cadastroOnvio.em) || (contatoTreinado(c) && c.concluidoEm) || "").slice(0,10); }).sort().pop() : "";
    return {status:st, data:fim || "", total:lista.length, feitos:feitos};
  }
  // Habilitação no Domínio é uma só para a empresa (gravada em empresas.habilitacao), não por setor.
  var idxEmpresas = {ref:null, n:-1, porId:{}}, idxSetoresEmp = {ref:null, n:-1, mapa:{}};
  function empresaPorId(id){
    if(idxEmpresas.ref !== state.empresas || idxEmpresas.n !== state.empresas.length){
      var m = {}; state.empresas.forEach(function(e){ m[e.id] = e; });
      idxEmpresas = {ref:state.empresas, n:state.empresas.length, porId:m};
    }
    return idxEmpresas.porId[id] || null;
  }
  function setoresDocsDe(empresaId){
    if(idxSetoresEmp.ref !== state.setores || idxSetoresEmp.n !== state.setores.length){
      var m = {}; state.setores.forEach(function(s){ (m[s.empresaId] = m[s.empresaId] || []).push(s); });
      idxSetoresEmp = {ref:state.setores, n:state.setores.length, mapa:m};
    }
    return idxSetoresEmp.mapa[empresaId] || [];
  }
  var RANK_HAB = {pendente:0, andamento:1, concluido:2};
  // Empresa com algum contato treinado: a habilitação no Domínio é dada como concluída (data = o primeiro treinamento).
  var idxTreinados = {ref:null, mapa:{}};
  function primeiroTreinoDaEmpresa(empresaId){
    if(idxTreinados.ref !== state.contatos){
      var mapa = {};
      state.contatos.forEach(function(c){
        if(!contatoTreinado(c)) return;
        var d = String(c.concluidoEm || "").slice(0,10), at = mapa[c.empresaId];
        if(at === undefined || (d && (!at || d < at))) mapa[c.empresaId] = d;
      });
      idxTreinados = {ref:state.contatos, mapa:mapa};
    }
    return idxTreinados.mapa[empresaId];
  }
  function habilitacaoEmpresa(empresaId){
    var h = habilitacaoDeclarada(empresaId);
    if(h.status === "concluido") return h;
    var d = primeiroTreinoDaEmpresa(empresaId);
    return d === undefined ? h : {status:"concluido", data:d, obs:h.obs, herdada:false, inferida:true};
  }
  function habilitacaoDeclarada(empresaId){
    var e = empresaPorId(empresaId);
    if(e && e.habilitacao && RANK_HAB[e.habilitacao.status] !== undefined)
      return {status:e.habilitacao.status, data:e.habilitacao.status === "concluido" ? (e.habilitacao.data || "") : "", obs:e.habilitacao.obs || "", herdada:false};
    // Antes a habilitação era marcada em cada setor: até ser gravada na empresa, vale a mais adiantada delas.
    var r = {status:"pendente", data:"", obs:"", herdada:true}, obs = [];
    setoresDocsDe(empresaId).forEach(function(sd){
      var h = sd.etapas && sd.etapas.habilitacaoDominio;
      if(!h) return;
      var st = RANK_HAB[h.status] !== undefined ? h.status : "pendente";
      if(RANK_HAB[st] > RANK_HAB[r.status]){ r.status = st; r.data = st === "concluido" ? (h.data || "") : ""; }
      else if(st === "concluido" && r.status === "concluido" && h.data && (!r.data || h.data < r.data)) r.data = h.data;
      if(h.obs && obs.indexOf(h.obs) === -1) obs.push(h.obs);
    });
    r.obs = obs.join(" · ");
    return r;
  }
  // O registro completo (status, data e observações) vai sempre inteiro, para não depender do que foi herdado dos setores.
  function habilitacaoCompleta(empresaId, patch){
    var h = habilitacaoDeclarada(empresaId);
    return Object.assign({status:h.status, data:h.data, obs:h.obs}, patch);
  }
  function salvarHabilitacao(empresaId, patch){
    var e = empresaPorId(empresaId);
    if(!e) return Promise.reject(new Error("empresa"));
    var novo = habilitacaoCompleta(empresaId, patch);
    e.habilitacao = novo;
    return dbRef ? dbRef.collection("empresas").doc(empresaId).update({habilitacao:novo}) : Promise.resolve();
  }
  function statusDe(setorDoc, key, empresaId, setorKey){
    if(key === "habilitacaoDominio") return habilitacaoEmpresa(empresaId || (setorDoc && setorDoc.empresaId)).status;
    if(key === "treinamentoCliente"){
      return statusClienteComputado(empresaId || (setorDoc && setorDoc.empresaId), setorKey || (setorDoc && setorDoc.setor)).status;
    }
    if(key === "cadastroUsuario") return statusCadastroComputado(empresaId || (setorDoc && setorDoc.empresaId), setorKey || (setorDoc && setorDoc.setor)).status;
    if(key === "treinamentoAnalista") return etapaAnalistaEfetiva(setorDoc).status;
    return (setorDoc && setorDoc.etapas && setorDoc.etapas[key] && setorDoc.etapas[key].status) || "pendente";
  }
  // O treinamento do analista é da pessoa (cadastro em Equipe). Cada frente mostra o status da pessoa,
  // a não ser que a própria frente tenha um registro mais adiantado (histórico por empresa).
  var RANK_TREINO = {pendente:0, agendado:1, andamento:2, concluido:3};
  var idxFuncAnalista = {};
  function funcAnalistaDoDoc(doc){
    if(!doc || (!doc.analistaId && !doc.analistaNome)) return null;
    if(idxFuncAnalista.ref !== state.funcionarios || idxFuncAnalista.n !== state.funcionarios.length){
      var porId = {};
      state.funcionarios.forEach(function(f){ porId[f.id] = f; });
      idxFuncAnalista = {ref:state.funcionarios, n:state.funcionarios.length, porId:porId};
    }
    if(doc.analistaId && idxFuncAnalista.porId[doc.analistaId]) return idxFuncAnalista.porId[doc.analistaId];
    var r = resolverAnalista(doc);
    return r.id ? idxFuncAnalista.porId[r.id] || null : null;
  }
  function etapaAnalistaEfetiva(doc){
    var own = (doc && doc.etapas && doc.etapas.treinamentoAnalista) || {};
    var st = RANK_TREINO[own.status] !== undefined ? own.status : "pendente";
    var f = funcAnalistaDoDoc(doc);
    var r = {status:st, data:own.data || "", agendadoPara:own.agendadoPara || "", agendadoHora:own.agendadoHora || "", func:f, herdado:false};
    if(!f) return r;
    var fst = RANK_TREINO[f.statusTreinamento] !== undefined ? f.statusTreinamento : "pendente";
    if(RANK_TREINO[fst] <= RANK_TREINO[st]) return r;
    return {status:fst, data:fst === "concluido" ? String(f.concluidoEm || "").slice(0, 10) : "", agendadoPara:fst === "agendado" ? (f.agendadoPara || "") : "", agendadoHora:fst === "agendado" ? (f.agendadoHora || "") : "", func:f, herdado:true};
  }
  // Status, data e agendamento de uma etapa manual (todas menos Treinamento dos clientes).
  function etapaInfo(doc, key, empresaId){
    if(key === "treinamentoAnalista") return etapaAnalistaEfetiva(doc);
    if(key === "cadastroUsuario"){
      var cu = statusCadastroComputado(empresaId || (doc && doc.empresaId), doc && doc.setor);
      return {status:cu.status, data:cu.data, agendadoPara:"", agendadoHora:"", func:null, herdado:false, total:cu.total, feitos:cu.feitos};
    }
    if(key === "habilitacaoDominio"){
      var h = habilitacaoEmpresa(empresaId || (doc && doc.empresaId));
      return {status:h.status, data:h.data, agendadoPara:"", agendadoHora:"", obs:h.obs, func:null, herdado:false};
    }
    var ed = (doc && doc.etapas && doc.etapas[key]) || {};
    return {status:ed.status || "pendente", data:ed.data || "", agendadoPara:ed.agendadoPara || "", agendadoHora:ed.agendadoHora || "", func:null, herdado:false};
  }
  function progressoSetor(empresa, setorDoc){
    var ap = etapasAplicaveis(empresa, setorDoc.setor);
    if(!ap.length) return 0;
    var done = ap.filter(function(e){ return statusDe(setorDoc, e.key, empresa.id, setorDoc.setor) === "concluido"; }).length;
    return done / ap.length;
  }
  // Uma frente por setor com demanda, mesmo que o registro do setor ainda não exista no banco.
  function frentesDaEmpresa(empresa, docs){
    return SETORES.filter(function(s){ return empresa.setoresDemanda && empresa.setoresDemanda[s.key]; }).map(function(s){
      return docs.find(function(x){ return x.setor === s.key; }) || {id:sid(empresa.id, s.key), empresaId:empresa.id, empresaNome:empresa.nome, setor:s.key, etapas:{}, analistaNome:"", impedimento:{}, semRegistro:true};
    });
  }
  function progressoEmpresa(empresa, docs){
    var fs = frentesDaEmpresa(empresa, docs);
    return fs.length ? fs.reduce(function(a, s){ return a + progressoSetor(empresa, s); }, 0) / fs.length : 0;
  }
  var cacheValidos = {c:null, e:null, lista:[]};
  function contatosValidos(){
    if(cacheValidos.c !== state.contatos || cacheValidos.e !== state.empresas){
      var ids = {};
      state.empresas.forEach(function(e){ ids[e.id] = true; });
      cacheValidos = {c:state.contatos, e:state.empresas, lista:state.contatos.filter(function(c){ return ids[c.empresaId]; })};
    }
    return cacheValidos.lista;
  }
  function hojeISO(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function agendamentoAtrasado(c){ return c.statusTreinamento === "agendado" && !!c.agendadoPara && c.agendadoPara < hojeISO(); }
  function normBusca(t){ return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function empresaBloqueada(empresa, docs){
    return !!(empresa.impedimento && empresa.impedimento.ativo) || docs.some(function(s){ return s.impedimento && s.impedimento.ativo; });
  }
  function empresaSemAnalista(empresa, docs){
    return frentesDaEmpresa(empresa, docs).some(function(s){ return !String(s.analistaNome || "").trim(); });
  }
  function empresaComPendencia(empresa, docs){
    return frentesDaEmpresa(empresa, docs).some(function(s){
      return etapasAplicaveis(empresa, s.setor).some(function(et){ return statusDe(s, et.key, empresa.id, s.setor) === "pendente"; });
    });
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  var faltaCarregar = {empresas:1, empresaSetores:1, contatos:1}, semBanco = false;
  function carregando(){ return !semBanco && Object.keys(faltaCarregar).length > 0; }
  var state = { empresas:[], setores:[], funcionarios:[], contatos:[], alinhamentoSetor:[], auditoriaDominio:[], historico:[] };

  /* ---------- matrizes e filiais ---------- */
  // A filial (empresas.matrizId) não tem frentes, contatos nem etapas próprias: tudo fica na matriz e o
  // grupo conta como uma empresa. O banco chega inteiro em "bruto"; as telas usam state.* já sem as filiais.
  var bruto = {empresas:null, setores:null, contatos:null};
  var grupos = {filiaisDe:{}, matrizDe:{}, porId:{}};
  function definirDados(key, lista){
    if(!(key in bruto)){ state[key] = lista; return; }
    bruto[key] = lista;
    aplicarGrupos();
  }
  function aplicarGrupos(){
    var emps = bruto.empresas || state.empresas, porId = {}, filiaisDe = {}, matrizDe = {};
    emps.forEach(function(e){ porId[e.id] = e; });
    emps.forEach(function(e){
      var m = e.matrizId && porId[e.matrizId];
      if(m && m.id !== e.id && !m.matrizId){ (filiaisDe[m.id] = filiaisDe[m.id] || []).push(e); matrizDe[e.id] = m.id; }
    });
    Object.keys(filiaisDe).forEach(function(k){ filiaisDe[k].sort(function(a, b){ return String(a.cnpj || a.nome).localeCompare(String(b.cnpj || b.nome)); }); });
    grupos = {filiaisDe:filiaisDe, matrizDe:matrizDe, porId:porId};
    state.empresas = emps.filter(function(e){ return !matrizDe[e.id]; });
    if(bruto.setores) state.setores = bruto.setores.filter(function(s){ return !matrizDe[s.empresaId]; });
    if(bruto.contatos) state.contatos = bruto.contatos.filter(function(c){ return !matrizDe[c.empresaId]; });
  }
  function filiaisDe(matrizId){ return grupos.filiaisDe[matrizId] || []; }
  function matrizDaFilial(empresaId){ var m = grupos.matrizDe[empresaId]; return m ? grupos.porId[m] : null; }
  function todasEmpresas(){ return bruto.empresas || state.empresas; }
  // Raiz do CNPJ (8 primeiros caracteres) e ordem do estabelecimento (0001 = matriz).
  function cnpjLimpo(v){ return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }
  function raizCnpj(v){ var d = cnpjLimpo(v); return d.length === 14 ? d.slice(0, 8) : ""; }
  function ehCnpjMatriz(v){ var d = cnpjLimpo(v); return d.length === 14 && d.slice(8, 12) === "0001"; }
  // Ordem dos status de cada etapa (o mais adiantado ganha ao juntar matriz e filial).
  function rankStatus(etapaKey, st){ var i = ordemStatus(etapaKey).indexOf(st); return i < 0 ? 0 : i; }
  function rankContato(st){ var i = STATUS_CLIENTE.indexOf(st); return i < 0 ? 0 : i; }
  // Habilitação de qualquer empresa (inclusive filial), lida do banco inteiro.
  function habilitacaoBruta(e){
    if(e && e.habilitacao && RANK_HAB[e.habilitacao.status] !== undefined) return {status:e.habilitacao.status, data:e.habilitacao.data || "", obs:e.habilitacao.obs || ""};
    var r = {status:"pendente", data:"", obs:""};
    (bruto.setores || state.setores).forEach(function(sd){
      var h = e && sd.empresaId === e.id && sd.etapas && sd.etapas.habilitacaoDominio;
      if(h && RANK_HAB[h.status] > RANK_HAB[r.status]) r = {status:h.status, data:h.status === "concluido" ? (h.data || "") : "", obs:h.obs || ""};
    });
    return r;
  }
  // Filiais que ainda têm contatos ou frentes próprias (vínculo feito por importação, por exemplo).
  function filiaisComDados(){
    var out = [];
    Object.keys(grupos.matrizDe).forEach(function(fid){
      var nC = (bruto.contatos || []).filter(function(c){ return c.empresaId === fid; }).length;
      var nS = (bruto.setores || []).filter(function(s){ return s.empresaId === fid; }).length;
      if(nC || nS) out.push({f:grupos.porId[fid], m:grupos.porId[grupos.matrizDe[fid]], contatos:nC, frentes:nS});
    });
    return out;
  }
  // Junta filiais na matriz: contatos passam para a matriz (sem repetir a mesma pessoa), frentes se juntam com
  // o status mais adiantado de cada etapa, a habilitação fica com a mais adiantada e cada filial recebe matrizId.
  // O grupo inteiro é calculado de uma vez (em memória) e só então gravado. Pode rodar de novo sem estragar nada
  // (serve para juntar o que sobrou de uma importação).
  function vincularGrupo(matrizId, filialIds, silencioso){
    if(!dbRef) return Promise.resolve(0);
    var porId = grupos.porId, m = porId[matrizId];
    if(m && m.matrizId && porId[m.matrizId]) m = porId[m.matrizId];
    var fs = [];
    (filialIds || []).forEach(function(id){ var f = porId[id]; if(f && m && f.id !== m.id && fs.indexOf(f) === -1) fs.push(f); });
    if(!m || !fs.length) return Promise.resolve(0);
    var setoresB = bruto.setores || state.setores, contatosB = bruto.contatos || state.contatos;
    var col = function(c, id){ return dbRef.collection(c).doc(id); };
    var escritas = [], apagar = [];
    // contatos
    var chave = function(c){ var em = normBusca(c.email || "").trim(); return em ? "e:" + em : "n:" + normBusca(c.nome || "").trim(); };
    var naMatriz = {}, patchContato = {};
    contatosB.forEach(function(c){ if(c.empresaId === m.id) naMatriz[chave(c)] = {c:c, setores:(c.setores || []).slice(), st:c}; });
    fs.forEach(function(f){
      contatosB.forEach(function(c){
        if(c.empresaId !== f.id) return;
        var k = chave(c), igual = naMatriz[k];
        if(!igual){ naMatriz[k] = {c:c, setores:(c.setores || []).slice(), st:c, movido:true}; return; }
        (c.setores || []).forEach(function(s){ if(igual.setores.indexOf(s) === -1) igual.setores.push(s); });
        if(rankContato(c.statusTreinamento) > rankContato(igual.st.statusTreinamento)) igual.st = c;
        igual.mudou = true;
        apagar.push(function(){ return col("contatos", c.id).delete(); });
      });
    });
    Object.keys(naMatriz).forEach(function(k){
      var x = naMatriz[k];
      if(!x.movido && !x.mudou) return;
      var pc = {};
      if(x.movido){ pc.empresaId = m.id; pc.empresaNome = m.nome; }
      if(x.mudou){
        pc.setores = x.setores;
        if(x.st !== x.c){ pc.statusTreinamento = x.st.statusTreinamento || "pendente"; pc.agendadoPara = x.st.agendadoPara || ""; pc.agendadoHora = x.st.agendadoHora || ""; if(x.st.concluidoEm) pc.concluidoEm = x.st.concluidoEm; }
      }
      escritas.push(function(){ return col("contatos", x.c.id).update(pc); });
    });
    // frentes (setor × etapas)
    var demM = Object.assign({pessoal:false, contabil:false, fiscal:false}, m.setoresDemanda);
    SETORES.forEach(function(s){
      var md = setoresB.find(function(x){ return x.empresaId === m.id && x.setor === s.key; });
      var novo = null, ps = null;
      fs.forEach(function(f){
        if(f.setoresDemanda && f.setoresDemanda[s.key]) demM[s.key] = true;
        var fd = setoresB.find(function(x){ return x.empresaId === f.id && x.setor === s.key; });
        if(!fd) return;
        apagar.push(function(){ return col("empresaSetores", fd.id).delete(); });
        if(!md && !novo){
          novo = JSON.parse(JSON.stringify(fd)); delete novo.id;
          novo.empresaId = m.id; novo.empresaNome = m.nome;
          return;
        }
        var alvo = novo || (ps = ps || {etapas:Object.assign({}, md.etapas), analistaId:md.analistaId || "", analistaNome:md.analistaNome || "", impedimento:md.impedimento});
        alvo.etapas = alvo.etapas || {};
        Object.keys(fd.etapas || {}).forEach(function(k){
          var a = alvo.etapas[k], b = fd.etapas[k];
          if(b && (!a || rankStatus(k, b.status) > rankStatus(k, a.status))) alvo.etapas[k] = b;
        });
        if(!String(alvo.analistaNome || "").trim() && String(fd.analistaNome || "").trim()){ alvo.analistaId = fd.analistaId || ""; alvo.analistaNome = fd.analistaNome; }
        if(!(alvo.impedimento && alvo.impedimento.ativo) && fd.impedimento && fd.impedimento.ativo) alvo.impedimento = fd.impedimento;
      });
      if(novo) escritas.push(function(){ return col("empresaSetores", sid(m.id, s.key)).set(novo); });
      if(ps){ if(!ps.impedimento) delete ps.impedimento; escritas.push(function(){ return col("empresaSetores", md.id).update(ps); }); }
    });
    // matriz
    var pm = {setoresDemanda:demM}, hab = habilitacaoBruta(m);
    fs.forEach(function(f){
      var hf = habilitacaoBruta(f);
      if(RANK_HAB[hf.status] > RANK_HAB[hab.status]) hab = hf;
      if(f.impedimento && f.impedimento.ativo && !(m.impedimento && m.impedimento.ativo) && !pm.impedimento) pm.impedimento = f.impedimento;
      if(f.emFoco && !m.emFoco && !pm.emFoco){ pm.emFoco = true; pm.emFocoEm = f.emFocoEm || new Date().toISOString(); }
      if(f.folhaAtiva && !m.folhaAtiva) pm.folhaAtiva = true;
    });
    pm.habilitacao = hab;
    escritas.push(function(){ return col("empresas", m.id).update(pm); });
    // filiais: só o vínculo (as filiais de uma filial passam para a mesma matriz)
    var novas = fs.filter(function(f){ return f.matrizId !== m.id; });
    fs.forEach(function(f){
      escritas.push(function(){ return col("empresas", f.id).update({matrizId:m.id, emFoco:false, vinculadaEm:f.vinculadaEm || new Date().toISOString()}); });
      filiaisDe(f.id).forEach(function(x){ escritas.push(function(){ return col("empresas", x.id).update({matrizId:m.id}); }); });
    });
    // Primeiro grava tudo na matriz; só depois apaga o que era das filiais.
    return Promise.all(escritas.map(function(w){ return w(); })).then(function(){
      return Promise.all(apagar.map(function(w){ return w(); }));
    }).then(function(){
      if(novas.length) registrarAtividade({tipo:"lote", texto:(novas.length === 1 ? "Filial “" + novas[0].nome + "” vinculada" : novas.length + " filiais vinculadas") + " à matriz “" + m.nome + "”"});
      if(!silencioso) mostrarToast(fs.length === 1 ? "“" + fs[0].nome + "” agora é filial de “" + m.nome + "”." : fs.length + " filiais vinculadas a “" + m.nome + "”.");
      return fs.length;
    }).catch(function(err){
      console.error(err);
      mostrarToast("Não foi possível vincular a “" + m.nome + "”. Tente de novo.");
      return 0;
    });
  }
  function vincularFilial(filialId, matrizId, silencioso){ return vincularGrupo(matrizId, [filialId], silencioso); }
  function desvincularFilial(filialId){
    var f = grupos.porId[filialId], m = f && grupos.porId[f.matrizId];
    if(!f || !dbRef) return;
    confirmar("Desvincular “" + f.nome + "” de “" + (m ? m.nome : "sua matriz") + "”? Ela volta a ser uma empresa separada, sem frentes nem contatos próprios (o que foi juntado continua na matriz).", function(){
      dbRef.collection("empresas").doc(f.id).update({matrizId:""}).then(function(){
        registrarAtividade({tipo:"lote", texto:"Filial “" + f.nome + "” desvinculada de “" + (m ? m.nome : "") + "”"});
        mostrarToast("“" + f.nome + "” voltou a ser uma empresa separada.");
      });
    }, "Desvincular");
  }
  // Vários grupos: um de cada vez (cada grupo é juntado inteiro de uma vez em vincularGrupo).
  function vincularVarios(lista, aoFim){
    var ok = 0;
    return lista.reduce(function(p, g){ return p.then(function(){ return vincularGrupo(g.m.id, g.fs.map(function(f){ return f.id; }), true).then(function(n){ ok += n; }); }); }, Promise.resolve())
      .then(function(){ if(aoFim) aoFim(ok); });
  }
  // Grupos que parecem matriz + filiais pela raiz do CNPJ (só sugestão: o vínculo é sempre confirmado).
  function gruposSugeridos(){
    var porRaiz = {};
    state.empresas.forEach(function(e){ var r = raizCnpj(e.cnpj); if(r) (porRaiz[r] = porRaiz[r] || []).push(e); });
    var out = [];
    Object.keys(porRaiz).forEach(function(r){
      var es = porRaiz[r];
      var m = es.filter(function(e){ return ehCnpjMatriz(e.cnpj); })[0];
      if(!m || es.length < 2) return;
      var fs = es.filter(function(e){ return e !== m; });
      if(fs.some(function(e){ return filiaisDe(e.id).length; })) fs = fs.filter(function(e){ return !filiaisDe(e.id).length; });
      if(fs.length) out.push({m:m, fs:fs});
    });
    return out.sort(function(a, b){ return COLLATOR(String(a.m.nome || ""), String(b.m.nome || "")); });
  }
  function seloFiliais(e){
    var fs = filiaisDe(e.id);
    if(!fs.length) return "";
    var tit = "Filiais: " + fs.map(function(x){ return x.nome + (x.cnpj ? " (" + x.cnpj + ")" : ""); }).join(" · ");
    return '<span class="efil" title="' + esc(tit) + '">+' + fs.length + ' filia' + (fs.length === 1 ? 'l' : 'is') + '</span>';
  }
  // A busca acha a matriz pelo nome ou CNPJ de uma filial.
  function matrizesPorBuscaFilial(qn, qd){
    var achou = {};
    if(!qn && !(qd && qd.length >= 3)) return achou;
    Object.keys(grupos.matrizDe).forEach(function(fid){
      var f = grupos.porId[fid];
      if((qn && normBusca(f.nome).indexOf(qn) !== -1) || (qd && qd.length >= 3 && String(f.cnpj || "").replace(/\D/g, "").indexOf(qd) !== -1)) achou[grupos.matrizDe[fid]] = true;
    });
    return achou;
  }
  var ui = {
    view:"dashboard",
    agendaDia:null, agendar:{aberto:false, sel:[], data:"", hora:"", mes:"", opcoes:[], ativo:0}, expanded:new Set(), editEmpresa:new Set(), expandedFunc:new Set(), expandedGroups:new Set(["secao:empresas", "secao:contatos"]), collapsedOverride:new Set(), expandedEtapas:new Set(), focoAbertas:new Set(), focoAcaoAberta:new Set(), focoRecemAdicionada:null,
    selecionadas:new Set(), ultimaLista:[],
    selFunc:new Set(), ultimaListaFunc:[], selPessoas:new Set(), ultimaListaPessoas:[],
    busca:"", filtroSetor:"todos", filtroAnalista:null, soPendentes:false, soImpedimento:false, soSemAnalista:false, soSemContato:false, soConcluidas:false,
    treinoBusca:"", treinoStatus:"todos", treinoSoImpedimento:false,
    impBusca:"", impTipo:"empresa", impResolvendo:null, confTudo:false, confAbertas:{}, tagMenuAberto:null, focoContatoForm:null, carteiraAddAberto:null,
    pessoasBusca:"", pessoasFiltroSetor:"todos", pessoasFiltroEmpresa:"", expandedPessoas:new Set(), pessoaVincularForm:null,
    focoModo:"empresa", focoOrdem:"recentes", focoBusca:"", focoEtapaFiltrosAbertos:false, focoEtapaSel:"habilitacaoDominio", focoEtapaStatus:"todos",
    focoEtapaSetor:"todos", focoEtapaAnalista:"", focoEtapaOrdem:"empresa", focoEtapaAtrasados:false,
    focoEtapaSelecionadas:new Set(), focoEtapaMantidas:new Set(), focoEtapaRecolhidas:new Set(),
    consModo:"empresa", consEtapaSel:"habilitacaoDominio", consEtapaStatus:"todos", consEtapaAnalista:"", consEtapaOrdem:"empresa",
    consEtapaAtrasados:false, consEtapaFiltrosAbertos:false, consEtapaLimite:40,
    consSecao:"secEmpresas", consOrdem:"nome", consLimite:50, consSig:"", impFormEmp:null, impAlvoSel:"",
    consEtapaSelecionadas:new Set(), consEtapaMantidas:new Set(), consEtapaRecolhidas:new Set(),
    rel:{periodo:"30", de:"", ate:"", setor:"todos", soFoco:false, tipoAtv:"todos", atvPer:"", atvDe:"", atvAte:""}, relGerando:null
  };
  var dbRef = null;

  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 4.6 6.2 12l7.4 7.4 2.1-2.1L10.4 12l5.3-5.3z"/><path d="M19.4 6.5 17.3 4.4 9.7 12l7.6 7.6 2.1-2.1L13.9 12z" opacity=".55"/></svg>';

  /* ---------- grupos recolhíveis (ghead) ---------- */
  function grupoAberto(key, autoAberto){
    if(ui.collapsedOverride.has(key)) return false;
    return autoAberto || ui.expandedGroups.has(key);
  }
  function toggleGrupo(key, autoAberto){
    var estaAberto = grupoAberto(key, autoAberto);
    if(estaAberto){
      ui.expandedGroups.delete(key);
      if(autoAberto) ui.collapsedOverride.add(key);
      if(key.indexOf("equipe:") === 0){
        var setorKey = key.slice("equipe:".length);
        state.funcionarios.forEach(function(f){ if(f.setor === setorKey) ui.expandedFunc.delete(f.id); });
      }
      ui.tagMenuAberto = null;
    } else {
      ui.expandedGroups.add(key);
      ui.collapsedOverride.delete(key);
    }
  }
  function posicionarTagMenu(key){
    var btn = document.querySelector('.tagbtn[data-tagkey="'+CSS.escape(key)+'"]');
    var menu = document.querySelector('.tagmenu[data-tagkey="'+CSS.escape(key)+'"]');
    if(!btn || !menu) return;
    var r = btn.getBoundingClientRect();
    var menuW = menu.offsetWidth || 140;
    var left = Math.min(r.left, window.innerWidth - menuW - 8);
    menu.style.top = (r.bottom + 4) + "px";
    menu.style.left = Math.max(8, left) + "px";
  }

  /* ---------- confirm ---------- */
  function confirmar(msg, fn, rotuloOk){
    var bg = $("#cfm-bg"); $("#cfm-msg").textContent = msg; bg.hidden = false;
    var ok = $("#cfm-ok"), no = $("#cfm-cancel");
    ok.textContent = rotuloOk || "Confirmar";
    function close(){ bg.hidden = true; ok.onclick = null; no.onclick = null; }
    ok.onclick = function(){ close(); fn(); };
    no.onclick = close;
  }

  /* ---------- tooltip ---------- */
  function tipOn(el, html){
    if(!html) return;
    el.addEventListener("mouseenter", move); el.addEventListener("mousemove", move); el.addEventListener("mouseleave", off);
    function move(ev){
      var t = $("#tip"); t.innerHTML = html; t.hidden = false;
      t.style.left = Math.min(ev.clientX + 14, window.innerWidth - 246) + "px";
      t.style.top  = Math.min(ev.clientY + 14, window.innerHeight - 70) + "px";
    }
    function off(){ $("#tip").hidden = true; }
  }

  function keepFocus(fn){
    var a = document.activeElement, id = a && a.id, s0, s1;
    if(a && "selectionStart" in a){ try{ s0 = a.selectionStart; s1 = a.selectionEnd; }catch(e){} }
    fn();
    if(id){ var el = document.getElementById(id); if(el){ el.focus(); if(s0!=null && "setSelectionRange" in el){ try{ el.setSelectionRange(s0,s1); }catch(e){} } } }
  }

  /* ---------- nav ---------- */
  // Ao sair de Consulta, tudo que foi aberto lá volta ao estado inicial (só a lista de empresas aberta).
  function recolherConsulta(){
    ui.expanded.clear(); ui.editEmpresa.clear(); ui.expandedFunc.clear(); ui.expandedPessoas.clear();
    ui.pessoaVincularForm = null; ui.carteiraAddAberto = null; ui.focoContatoForm = null; ui.tagMenuAberto = null;
    var daConsulta = function(k){ return /^(secao|equipe):/.test(k); };
    Array.from(ui.expandedGroups).filter(daConsulta).forEach(function(k){ ui.expandedGroups.delete(k); });
    Array.from(ui.collapsedOverride).filter(daConsulta).forEach(function(k){ ui.collapsedOverride.delete(k); });
    ui.expandedGroups.add("secao:empresas"); ui.expandedGroups.add("secao:contatos");
    ui.consSecao = "secEmpresas"; ui.consLimite = 50; ui.impFormEmp = null;
    // Sem isso, um filtro deixado ligado força a barra a reabrir sozinha ao voltar — a
    // seção só fica de fato recolhida se sair da aba também limpar os filtros das 3 listas.
    ui.busca = ""; ui.filtroSetor = "todos"; ui.filtroAnalista = null;
    ui.soPendentes = false; ui.soImpedimento = false; ui.soSemAnalista = false; ui.soSemContato = false; ui.soConcluidas = false;
    ui.treinoBusca = ""; ui.treinoStatus = "todos"; ui.treinoSoImpedimento = false;
    ui.pessoasBusca = ""; ui.pessoasFiltroSetor = "todos"; ui.pessoasFiltroEmpresa = "";
    ui.consEtapaStatus = "todos"; ui.consEtapaAnalista = ""; ui.consEtapaAtrasados = false; ui.consEtapaLimite = 40;
    ui.consEtapaSelecionadas.clear(); ui.consEtapaMantidas.clear(); ui.consEtapaRecolhidas.clear();
    ["empresaSearch","treinoSearch","pessoasSearch"].forEach(function(id){ var el = document.getElementById(id); if(el) el.value = ""; });
    var selEmp = document.getElementById("pessoasEmpresaFiltro");
    if(selEmp) selEmp.value = "";
    viewsSujas.progresso = true;
  }
  function setView(v){
    if(v !== "foco"){ ui.focoEtapaMantidas.clear(); ui.focoEtapaSelecionadas.clear(); }
    if(ui.view === "progresso" && v !== "progresso") recolherConsulta();
    ui.view = v;
    document.body.setAttribute("data-view", v);
    if(v === "progresso") mostrarSecaoConsulta(ui.consSecao);
    $$("#navtabs button").forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-view")===v);
      if(b.getAttribute("data-view") === v && b.scrollIntoView && window.innerWidth <= 700) b.scrollIntoView({block:"nearest", inline:"nearest"});
    });
    ["dashboard","progresso","foco","impedimentos","relatorios","cadastro"].forEach(function(name){
      $("#view-"+name).hidden = name !== v;
    });
    if(viewsSujas[v] !== false || v === "relatorios") renderView(v);
    salvarUI();
  }
  $$("#navtabs button").forEach(function(b){ b.addEventListener("click", function(){ setView(b.getAttribute("data-view")); }); });

  // Consulta em sub-abas: cada parte (Empresas, Equipe, Contatos, Alinhamento) ocupa a tela sozinha.
  var SECOES_CONSULTA = ["secEmpresas", "secEquipe", "secContatos", "secAlinhamento"];
  function mostrarSecaoConsulta(id){
    if(SECOES_CONSULTA.indexOf(id) === -1) id = "secEmpresas";
    ui.consSecao = id;
    SECOES_CONSULTA.forEach(function(s){ var el = document.getElementById(s); if(el) el.hidden = s !== id; });
    $$(".subnav [data-jump]").forEach(function(b){
      var on = b.getAttribute("data-jump") === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  document.addEventListener("click", function(ev){
    var b = ev.target.closest && ev.target.closest(".subnav [data-jump]");
    if(!b) return;
    mostrarSecaoConsulta(b.getAttribute("data-jump"));
    window.scrollTo({top:0});
  });
  function flash(el){ if(!el) return; el.classList.add("flash"); setTimeout(function(){ el.classList.remove("flash"); }, 1500); }

  function abrirSecaoEmpresas(){
    ui.expandedGroups.add("secao:empresas");
    ui.collapsedOverride.delete("secao:empresas");
  }
  function abrirSecaoContatos(){
    ui.expandedGroups.add("secao:contatos");
    ui.collapsedOverride.delete("secao:contatos");
  }
  function irParaEmpresa(id){
    setView("progresso"); mostrarSecaoConsulta("secEmpresas"); abrirSecaoEmpresas(); ui.expanded.add(id); renderEmpresas();
    requestAnimationFrame(function(){
      var el = document.querySelector('.erow[data-id="'+CSS.escape(id)+'"]');
      if(el){ el.scrollIntoView({behavior:"smooth", block:"center"}); flash(el); }
    });
  }
  // Clicar no nome de um contato, em qualquer lugar do app, leva sempre ao MESMO destino:
  // o cadastro dela (a pessoa, em Contatos de clientes) — não a empresa que originou o clique.
  function irParaContato(id){
    var c = state.contatos.find(function(x){ return x.id === id; });
    if(!c) return;
    var chave = chaveEmail(c) || ("id:"+c.id);
    setView("progresso"); mostrarSecaoConsulta("secContatos"); abrirSecaoContatos(); ui.expandedPessoas.add(chave); renderContatosCadastro();
    requestAnimationFrame(function(){
      var el = document.querySelector('.pessoa-row[data-chave="'+CSS.escape(chave)+'"]');
      if(el){ el.scrollIntoView({behavior:"smooth", block:"center"}); flash(el); }
    });
  }
  function irParaEmpresaComSetor(setor){
    ui.filtroSetor = setor || "todos";
    setView("progresso"); mostrarSecaoConsulta("secEmpresas"); abrirSecaoEmpresas(); renderEmpresas();
    requestAnimationFrame(function(){ var el = $("#empresasList"); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); });
  }
  function irParaFuncionario(nome){
    setView("progresso"); mostrarSecaoConsulta("secEquipe");
    var f = state.funcionarios.find(function(x){ return x.nome === nome; });
    if(f){
      ui.expandedFunc.add(f.id);
      var gkey = "equipe:"+f.setor;
      ui.expandedGroups.add(gkey);
      ui.collapsedOverride.delete(gkey);
    }
    renderTreinamento();
    if(!f) return;
    requestAnimationFrame(function(){
      var el = document.querySelector('.prow[data-id="'+CSS.escape(f.id)+'"]');
      if(el){ el.scrollIntoView({behavior:"smooth", block:"center"}); flash(el); }
    });
  }
  function irParaImpedimentos(){ setView("impedimentos"); }

  /* ---------- db helpers ---------- */
  function sid(empresaId, setor){ return empresaId + "_" + setor; }
  function ensureSetorDoc(empresa, setor){
    var id = sid(empresa.id, setor);
    if(state.setores.some(function(s){ return s.id === id; }) || !dbRef) return Promise.resolve();
    return dbRef.collection("empresaSetores").doc(id).set({
      empresaId:empresa.id, empresaNome:empresa.nome, setor:setor,
      analistaId:"", analistaNome:"", etapas:defaultEtapas(),
      impedimento:{ativo:false, descricao:""}, exemplo:false, criadoEm:new Date().toISOString()
    });
  }
  // Guardado fora do DOM: a confirmação do banco redesenha a tela logo depois de salvar.
  var indicadores = {};
  function pintarIndicador(inputId){
    var s = document.getElementById("fs-"+inputId), estado = indicadores[inputId];
    if(!s) return;
    s.className = "fsave" + (estado === "ok" ? " ok" : estado === "err" ? " err" : "");
    s.textContent = estado === "ok" ? "salvo ✓" : estado === "err" ? "erro ao salvar" : estado === "pend" ? "salvando…" : "";
  }
  function marcarSalvo(inputId, estado){
    indicadores[inputId] = estado;
    pintarIndicador(inputId);
    if(estado === "ok") setTimeout(function(){ if(indicadores[inputId] === "ok"){ delete indicadores[inputId]; pintarIndicador(inputId); } }, 1800);
  }
  function salvarComAviso(inputId, promessa){
    marcarSalvo(inputId, "pend");
    return promessa.then(function(){ marcarSalvo(inputId, "ok"); }, function(){ marcarSalvo(inputId, "err"); });
  }
  // O analista de cada frente é guardado como texto: ao renomear alguém, as frentes com o nome antigo acompanham.
  function renomearFuncionario(fid, novoNome, inputId){
    var f = state.funcionarios.find(function(x){ return x.id === fid; });
    if(!f || !novoNome || !dbRef || f.nome === novoNome) return;
    var antigo = f.nome;
    f.nome = novoNome;
    var frentes = state.setores.filter(function(sd){ return sd.analistaId === fid || (!sd.analistaId && (sd.analistaNome || "").trim() === antigo); });
    frentes.forEach(function(sd){ sd.analistaId = fid; sd.analistaNome = novoNome; });
    if(ui.filtroAnalista === antigo) ui.filtroAnalista = novoNome;
    var pr = Promise.all([dbRef.collection("funcionarios").doc(fid).update({nome:novoNome})].concat(frentes.map(function(sd){
      return dbRef.collection("empresaSetores").doc(sd.id).update({analistaId:fid, analistaNome:novoNome});
    })));
    salvarComAviso(inputId, pr);
    renderAll();
    if(frentes.length) mostrarToast('Nome atualizado também como analista em '+frentes.length+' frente'+(frentes.length === 1 ? '' : 's')+'.');
  }
  function definirAnalistaFrente(empresaId, setorKey, funcionarioId, semDesfazer){
    if(!dbRef) return;
    var docId = sid(empresaId, setorKey);
    var doc = state.setores.find(function(s){ return s.id === docId; });
    var antesId = (doc && doc.analistaId) || "", antesNome = (doc && doc.analistaNome) || "";
    var func = funcionarioId ? state.funcionarios.find(function(f){ return f.id === funcionarioId; }) : null;
    var novoId = func ? func.id : "", novoNome = func ? func.nome : "";
    if(doc){ doc.analistaId = novoId; doc.analistaNome = novoNome; }
    var pr = garantirSetorDoc(empresaId, setorKey).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({analistaId:novoId, analistaNome:novoNome}); });
    renderAll();
    if(!semDesfazer){
      var empNome = (state.empresas.find(function(e){ return e.id === empresaId; }) || {}).nome || "";
      mostrarToast(empNome+" · "+SETOR_LABEL[setorKey]+": "+(novoNome || "analista removido"), "Desfazer", function(){
        var d2 = state.setores.find(function(s){ return s.id === docId; });
        if(d2){ d2.analistaId = antesId; d2.analistaNome = antesNome; }
        garantirSetorDoc(empresaId, setorKey).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({analistaId:antesId, analistaNome:antesNome}); });
        renderAll();
      });
    }
    return pr;
  }
  function focarDataAgendada(id){
    requestAnimationFrame(function(){ var el = document.getElementById(id); if(el && !el.value) el.focus(); });
  }
  function seletorStatus(id, st, ordem, attrs, rotulo){
    return '<select id="'+id+'" class="psel stsel st-'+st+'" '+attrs+' aria-label="'+esc(rotulo)+'">' +
      ordem.map(function(o){ return '<option value="'+o+'"'+(o===st?" selected":"")+'>'+STATUS_LABEL[o]+'</option>'; }).join("") + '</select>';
  }
  function seletorEtapa(id, st, empresaId, setorKey, etapaKey, rotulo){
    return seletorStatus(id, st, ordemStatus(etapaKey), 'data-action="etapa-status" data-empresa="'+empresaId+'" data-setor="'+setorKey+'" data-etapa="'+etapaKey+'"', rotulo);
  }
  function seletorAlinhamento(id, st, setorKey){
    return seletorStatus(id, st, STATUS_ORDER, 'data-action="alinh-status" data-setor="'+setorKey+'"', "Alinhamento com o gestor");
  }
  var idxFuncs = {ref:null, n:-1, porId:{}, porNome:{}};
  function indiceFuncionarios(){
    if(idxFuncs.ref !== state.funcionarios || idxFuncs.n !== state.funcionarios.length){
      var pid = {}, pn = {};
      state.funcionarios.forEach(function(f){ pid[f.id] = f; var k = stripAccents(f.nome).toLowerCase().trim(); if(!pn[k]) pn[k] = f; });
      idxFuncs = {ref:state.funcionarios, n:state.funcionarios.length, porId:pid, porNome:pn};
    }
    return idxFuncs;
  }
  function resolverAnalista(doc){
    var nome = (doc && doc.analistaNome) || "", id = (doc && doc.analistaId) || "";
    var ix = indiceFuncionarios();
    if(id && ix.porId[id]) return {id:id, nome:nome};
    if(nome){
      var m = ix.porNome[stripAccents(nome).toLowerCase().trim()];
      if(m) return {id:m.id, nome:m.nome};
    }
    return {id:"", nome:nome};
  }
  function selectAnalistaHTML(doc, docId, empresaId, setorKey, id){
    var r = resolverAnalista(doc);
    var lista = state.funcionarios.slice().sort(function(a,b){
      var pa = a.setor === setorKey ? 0 : 1, pb = b.setor === setorKey ? 0 : 1;
      return pa - pb || a.nome.localeCompare(b.nome, "pt-BR");
    });
    var opts = '<option value="">Sem analista</option>';
    if(!r.id && r.nome) opts += '<option value="__legado__" selected>(atual) '+esc(r.nome)+'</option>';
    var grupoAtual = null;
    lista.forEach(function(f){
      var doGrupo = f.setor === setorKey;
      if(grupoAtual !== doGrupo){
        if(grupoAtual !== null) opts += '</optgroup>';
        opts += '<optgroup label="'+(doGrupo ? "Equipe do setor" : "Outros colaboradores")+'">';
        grupoAtual = doGrupo;
      }
      opts += '<option value="'+f.id+'"'+(r.id===f.id?' selected':'')+'>'+esc(f.nome)+'</option>';
    });
    if(grupoAtual !== null) opts += '</optgroup>';
    return '<select class="analista-sel" id="'+id+'" data-docid="'+docId+'" data-empresa="'+empresaId+'" data-setor="'+setorKey+'" aria-label="Analista responsável">'+opts+'</select>';
  }
  function campoDataContato(c, prefixo){
    return campoDataAgendada(prefixo + c.id, "cont-ag-data", 'data-id="'+c.id+'"', c.agendadoPara, c.agendadoHora) +
      (agendamentoAtrasado(c) ? '<span class="atrasado" title="A data do treinamento já passou e o contato continua como Agendado">Atrasado</span>' : '');
  }
  function campoDataFuncionario(f, prefixo){
    return campoDataAgendada(prefixo + f.id, "func-ag-data", 'data-id="'+f.id+'"', f.agendadoPara, f.agendadoHora) +
      (agendamentoAtrasado(f) ? '<span class="atrasado" title="A data do treinamento já passou e o funcionário continua como Agendado">Atrasado</span>' : '');
  }
  function campoConclusao(id, attrs, valor){
    if(!valor) return '<span class="ag-lbl conc-lbl conc-vazia"><span class="conc-txt">concluído · </span><button type="button" class="linkish conc-informar" data-action="conc-informar" data-for="'+id+'">informar data</button>' +
      '<input type="date" id="'+id+'" class="ag-input conc-data vazio" '+attrs+' value="" hidden aria-label="Data de conclusão"></span>';
    return '<label class="ag-lbl conc-lbl" for="'+id+'" title="Data de conclusão: clique para corrigir"><span class="conc-txt">concluído em</span> <input type="date" id="'+id+'" class="ag-input conc-data" '+attrs+' value="'+esc(valor || "")+'" aria-label="Data de conclusão"></label>';
  }
  function campoDataAgendada(id, classe, attrs, valor, hora){
    return '<label class="ag-lbl" for="' + id + '">para <input type="date" id="' + id + '" class="ag-input ' + classe + (valor ? '' : ' vazio') + '" ' + attrs + ' value="' + esc(valor || "") + '" title="Data do treinamento"></label>' +
      campoHoraAgendada(id + "-h", classe, attrs, hora);
  }
  function campoHoraAgendada(id, classe, attrs, hora){
    return '<label class="ag-lbl ag-lbl-hora" for="' + id + '" title="Horário do treinamento (opcional)">às <input type="time" id="' + id + '" class="ag-input ag-hora ' + classe + (hora ? '' : ' vazio') + '" ' + attrs + ' value="' + esc(hora || "") + '" step="300"></label>';
  }

  function alinhamentoDoc(setor){
    return state.alinhamentoSetor.find(function(a){ return a.id === setor; }) || {id:setor, setor:setor, status:"pendente", data:"", gestorNome:""};
  }
  function ensureAlinhamentoDocs(){
    if(!dbRef) return;
    ALINHAMENTO_SETORES.forEach(function(setor){
      if(state.alinhamentoSetor.some(function(a){ return a.id === setor; })) return;
      dbRef.collection("setorAlinhamento").doc(setor).set({setor:setor, status:"pendente", data:"", gestorNome:"", criadoEm:new Date().toISOString()});
    });
  }
  /* ---------- model ---------- */
  function model(){
    var ativas = state.empresas.filter(function(e){ return e.ativo !== false; });
    var porEmpresa = {};
    state.setores.forEach(function(s){ (porEmpresa[s.empresaId] = porEmpresa[s.empresaId] || []).push(s); });

    var bloqueios = [];
    ativas.forEach(function(e){
      if(e.impedimento && e.impedimento.ativo) bloqueios.push({escopo:"Empresa", nome:e.nome, desc:e.impedimento.descricao, desde:e.impedimento.desde || "", aguardando:e.impedimento.aguardando || "", col:"empresas", docId:e.id, empresaId:e.id});
    });
    state.setores.forEach(function(s){
      if(s.impedimento && s.impedimento.ativo){
        var e = state.empresas.find(function(x){ return x.id === s.empresaId; });
        bloqueios.push({escopo:SETOR_LABEL[s.setor], nome:(e?e.nome:s.empresaNome) + " · " + SETOR_LABEL[s.setor], desc:s.impedimento.descricao, desde:s.impedimento.desde || "", aguardando:s.impedimento.aguardando || "", col:"empresaSetores", docId:s.id, empresaId:s.empresaId});
      }
    });
    state.funcionarios.forEach(function(f){
      if(f.impedimento && f.impedimento.ativo) bloqueios.push({escopo:"Equipe", nome:f.nome, desc:f.impedimento.descricao, desde:f.impedimento.desde || "", aguardando:f.impedimento.aguardando || "", col:"funcionarios", docId:f.id, funcNome:f.nome});
    });
    return {ativas:ativas, porEmpresa:porEmpresa, bloqueios:bloqueios};
  }

  /* ---------- medidor (faixa de Relatórios) ---------- */
  function gaugeSVG(frac, w, h, stroke, color, trackColor){
    var r = Math.min(w/2 - stroke/2, h - stroke/2);
    var cx = w/2, cy = h - stroke/2;
    var len = Math.PI * r;
    var off = len * (1 - Math.max(0, Math.min(1, frac)));
    var d = "M "+(cx-r)+" "+cy+" A "+r+" "+r+" 0 0 1 "+(cx+r)+" "+cy;
    return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" overflow="visible">' +
      '<path d="'+d+'" fill="none" stroke="'+trackColor+'" stroke-width="'+stroke+'" stroke-linecap="round"></path>' +
      '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-linecap="round" stroke-dasharray="'+len+' '+len+'" stroke-dashoffset="'+off+'"></path>' +
    '</svg>';
  }

  var WARN_ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 22 20.5H2L12 3.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1" fill="currentColor"/></svg>';

  /* ---------- matriz setor × etapa (Relatórios) ---------- */
  function renderMatrix(m){
    var head = '<tr><th class="rowhead">Setor</th>' + m.etapas.map(function(o){ return '<th>'+o.label.replace(" ","<br>")+'</th>'; }).join("") + '</tr>';
    var rows = m.setoresSel.map(function(s){
      var res = m.setoresRes.find(function(x){ return x.setor.key === s.key; });
      var tds = m.etapas.map(function(o){
        var ps = o.porSetor[s.key];
        if(!ps || !ps.aplic) return '<td><div class="mx-cell na" title="Não se aplica">—</div></td>';
        var pct = ps.concluido / ps.aplic;
        var bg = 'color-mix(in oklab, var(--status-green) '+Math.round(Math.max(pct, 0.001)*100)+'%, var(--surface-3))';
        var fg = pct > 0.55 ? 'var(--surface)' : 'var(--ink-2)';
        return '<td><div class="mx-cell" style="background:'+bg+'; color:'+fg+'" data-setor="'+s.key+'" data-tip="<b>'+esc(s.label+' · '+o.label)+'</b>'+ps.concluido+' de '+ps.aplic+' concluídas">'+Math.round(pct*100)+'</div></td>';
      }).join("");
      return '<tr><td class="rowhead" data-setor="'+s.key+'">'+s.label+' <span class="mono" style="color:var(--ink-3); font-size:11px;">'+(res ? res.frentes : 0)+'</span></td>'+tds+'</tr>';
    }).join("");
    var box = $("#relMatrix");
    box.innerHTML = '<table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>';
    $$(".mx-cell:not(.na)", box).forEach(function(c){
      tipOn(c, c.getAttribute("data-tip"));
      c.addEventListener("click", function(){ irParaEmpresaComSetor(c.getAttribute("data-setor")); });
    });
    $$("td.rowhead", box).forEach(function(td){
      td.addEventListener("click", function(){ irParaEmpresaComSetor(td.getAttribute("data-setor")); });
    });
  }

  /* ---------- agenda de treinamentos ---------- */
  var DIAS_SEMANA = ["dom","seg","ter","qua","qui","sex","sáb"];
  // Mesma pessoa + mesma data agendada = UM treinamento, não vários: uma ação (✓ Treinado / remarcar)
  // num deles já resolve os outros (definirStatusContato/edicaoDataDe já sincronizam por e-mail).
  function agruparAgenda(lista){
    var porChave = {}, ordem = [];
    lista.forEach(function(c){
      var k = (chaveEmail(c) || ((c.tipo||"") + "id:" + c.id)) + "|" + (c.agendadoPara || "") + "|" + (c.agendadoHora || "");
      if(!porChave[k]){ porChave[k] = {rep:c, membros:[]}; ordem.push(porChave[k]); }
      porChave[k].membros.push(c);
    });
    return ordem;
  }
  function itemAgendaHTML(g, hoje){
    var c = g.rep;
    if(c.tipo === "etapa") return itemAgendaEtapaHTML(c, hoje);
    var ehFunc = c.tipo === "funcionario";
    var onde = ehFunc
      ? g.membros.map(function(m){ return [SETOR_LABEL[m.setor] || m.setor, m.cargo].filter(Boolean).join(" · "); }).join(" + ")
      : g.membros.map(function(m){
          var setores = (m.setores || []).map(function(sk){ return SETOR_LABEL[sk] || sk; }).join(", ");
          return [m.empresaNome, setores].filter(Boolean).join(" · ");
        }).join(" + ");
    var multi = g.membros.length > 1 ? '<span class="multi-emp" title="Mesma pessoa, agendada nessa mesma data em '+g.membros.length+' empresas. Uma ação resolve todas.">+'+(g.membros.length - 1)+'</span>' : '';
    var irAction = ehFunc ? 'data-action="ir-funcionario" data-nome="'+esc(c.nome)+'"' : 'data-action="ir-contato" data-id="'+c.id+'"';
    return '<div class="ag-item" draggable="true" title="Arraste até um dia da faixa da semana para remarcar" data-tipo="'+(ehFunc?"funcionario":"contato")+'" data-id="'+c.id+'" data-nome="'+esc(c.nome)+'" data-antes="'+esc(c.agendadoPara || "")+'">' +
      '<span class="ag-dia'+(c.agendadoPara === hoje ? ' ag-hoje' : '')+'" title="'+(c.agendadoPara ? diaBR(c.agendadoPara) : 'Sem data')+'">'+diaAgendaHTML(c.agendadoPara, hoje)+'</span>' +
      '<button type="button" class="ag-nome" '+irAction+' title="Abrir o cadastro">'+(c.agendadoHora ? '<span class="ag-horario">'+esc(c.agendadoHora)+'</span>' : '')+esc(c.nome)+multi+'</button>' +
      '<span class="ag-onde">'+esc(onde)+'</span>' +
      '<span class="ag-acoes">' +
        '<button type="button" class="ag-ok" data-action="agenda-concluir" data-id="'+c.id+'" data-tipo="'+(ehFunc?"funcionario":"contato")+'" title="Marcar o treinamento como concluído">✓ Treinado</button>' +
        '<button type="button" class="linkish ag-remarcar-btn" data-action="ag-remarcar">Remarcar</button>' +
        '<span class="ag-remarcar-campos" hidden>' +
        '<label class="ag-remarcar" title="Nova data">Nova data <input type="date" id="agd-'+(ehFunc?"func-":"")+c.id+'" class="ag-input '+(ehFunc?"func-ag-data":"cont-ag-data")+'" data-id="'+c.id+'" value="'+esc(c.agendadoPara || "")+'"></label>' +
        '<label class="ag-remarcar" title="Horário (opcional)"><input type="time" step="300" id="agd-'+(ehFunc?"func-":"")+c.id+'-h" class="ag-input ag-hora '+(ehFunc?"func-ag-data":"cont-ag-data")+(c.agendadoHora ? '' : ' vazio')+'" data-id="'+c.id+'" value="'+esc(c.agendadoHora || "")+'"></label>' +
        '</span>' +
      '</span>' +
    '</div>';
  }
  function diaAgendaHTML(iso, hoje){
    var d = parseDia(iso);
    if(!d) return '<b>—</b><small>sem data</small>';
    return '<small>' + (iso === hoje ? "hoje" : DIAS_SEMANA[d.getDay()]) + '</small><b>' + pad2(d.getDate()) + '</b><small>' + MESES_CURTOS[d.getMonth()] + '</small>';
  }
  function itemAgendaEtapaHTML(c, hoje){
    return '<div class="ag-item" draggable="true" title="Arraste até um dia da faixa da semana para remarcar" data-tipo="etapa" data-empresa="'+c.empresaId+'" data-setor="'+c.setor+'" data-nome="'+esc(c.nome)+'" data-antes="'+esc(c.agendadoPara || "")+'">' +
      '<span class="ag-dia'+(c.agendadoPara === hoje ? ' ag-hoje' : '')+'" title="'+(c.agendadoPara ? diaBR(c.agendadoPara) : 'Sem data')+'">'+diaAgendaHTML(c.agendadoPara, hoje)+'</span>' +
      '<button type="button" class="ag-nome" data-action="ir-empresa" data-id="'+c.empresaId+'" title="Abrir a empresa">'+(c.agendadoHora ? '<span class="ag-horario">'+esc(c.agendadoHora)+'</span>' : '')+esc(c.nome)+'</button>' +
      '<span class="ag-onde">Treinamento do analista · '+esc(c.empresaNome)+' · '+esc(SETOR_LABEL[c.setor] || c.setor)+'</span>' +
      '<span class="ag-acoes">' +
        '<button type="button" class="ag-ok" data-action="agenda-concluir" data-tipo="etapa" data-empresa="'+c.empresaId+'" data-setor="'+c.setor+'" title="Marcar o treinamento do analista como concluído">✓ Treinado</button>' +
        '<button type="button" class="linkish ag-remarcar-btn" data-action="ag-remarcar">Remarcar</button>' +
        '<span class="ag-remarcar-campos" hidden>' +
        '<label class="ag-remarcar" title="Nova data">Nova data <input type="date" id="agd-et-'+c.id+'" class="ag-input" data-empresa="'+c.empresaId+'" data-setor="'+c.setor+'" data-etapa="treinamentoAnalista" value="'+esc(c.agendadoPara || "")+'"></label>' +
        '<label class="ag-remarcar" title="Horário (opcional)"><input type="time" step="300" id="agd-et-'+c.id+'-h" class="ag-input ag-hora'+(c.agendadoHora ? '' : ' vazio')+'" data-empresa="'+c.empresaId+'" data-setor="'+c.setor+'" data-etapa="treinamentoAnalista" value="'+esc(c.agendadoHora || "")+'"></label>' +
        '</span>' +
      '</span>' +
    '</div>';
  }
  // Treinamento do analista agendado (etapa por empresa × setor), só nas frentes com demanda de empresas ativas.
  function agendaEtapasAnalista(){
    var out = [];
    state.empresas.forEach(function(e){
      if(e.ativo === false) return;
      frentesDaEmpresa(e, docsDaEmpresa(e.id)).forEach(function(s){
        var ed = (s.etapas || {}).treinamentoAnalista || {};
        if(ed.status !== "agendado") return;
        var fAg = funcAnalistaDoDoc(s);
        if(fAg && fAg.statusTreinamento === "agendado") return; // a própria pessoa já está na agenda
        // A pessoa já está treinada no cadastro dela em Equipe: o agendamento antigo da frente não vale mais.
        if(etapaAnalistaEfetiva(s).status === "concluido") return;
        out.push({tipo:"etapa", id:s.id, nome:String(s.analistaNome || "").trim() || "Analista não definido", agendadoPara:ed.agendadoPara || "", agendadoHora:ed.agendadoHora || "", empresaId:e.id, empresaNome:e.nome, setor:s.setor});
      });
    });
    return out;
  }
  var MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function coletarAgenda(){
    var hoje = hojeISO();
    var d7 = new Date(); d7.setDate(d7.getDate() + 7);
    var lim7 = diaLocal(d7);
    var agContatos = contatosValidos().filter(function(c){ return c.statusTreinamento === "agendado"; }).map(function(c){ return Object.assign({tipo:"contato"}, c); });
    var agFuncs = state.funcionarios.filter(function(f){ return f.statusTreinamento === "agendado"; }).map(function(f){ return Object.assign({tipo:"funcionario"}, f); });
    var ag = agContatos.concat(agFuncs, agendaEtapasAnalista())
      .sort(function(a, b){ return chaveAgenda(a).localeCompare(chaveAgenda(b)) || a.nome.localeCompare(b.nome, "pt-BR"); });
    return {
      hoje:hoje, lim7:lim7, todos:ag,
      atr:agruparAgenda(ag.filter(function(c){ return c.agendadoPara && c.agendadoPara < hoje; })),
      sem:agruparAgenda(ag.filter(function(c){ return c.agendadoPara && c.agendadoPara >= hoje && c.agendadoPara <= lim7; })),
      adiante:agruparAgenda(ag.filter(function(c){ return c.agendadoPara && c.agendadoPara > lim7; })),
      semData:agruparAgenda(ag.filter(function(c){ return !c.agendadoPara; })),
      doDia:function(iso){ return agruparAgenda(ag.filter(function(c){ return c.agendadoPara === iso; })); }
    };
  }

  /* ---------- hoje: cabeçalho do dia ---------- */
  var nomeEu = "";
  function renderHojeTopo(A){
    var agora = new Date(), h = agora.getHours();
    var saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    var primeiro = String(nomeEu || "").trim().split(/\s+/)[0];
    var data = agora.toLocaleDateString("pt-BR", {weekday:"long", day:"numeric", month:"long"});
    data = data.charAt(0).toUpperCase() + data.slice(1);
    var nHoje = A.doDia(A.hoje).length, nAtr = A.atr.length, nSem = A.sem.length;
    var m = model(), nImp = m.bloqueios.length, nFoco = listaFoco().length;
    var nImpVelho = m.bloqueios.filter(function(b){ var d = b.desde ? diasDesde(b.desde) : null; return d !== null && d >= 30; }).length;
    var partes = [];
    if(nAtr) partes.push(nAtr + " treinamento" + (nAtr === 1 ? "" : "s") + " atrasado" + (nAtr === 1 ? "" : "s"));
    var comp = function(n){ return n + " compromisso" + (n === 1 ? "" : "s"); };
    if(nHoje) partes.push(comp(nHoje) + " para hoje");
    if(nSem - nHoje > 0) partes.push(comp(nSem - nHoje) + " nos próximos 7 dias");
    var resumo = partes.length ? "Você tem " + (partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0]) + "." : "Nenhum treinamento atrasado ou agendado para esta semana.";
    var bloco = function(n, rotulo, cor, attrs, tit){
      return '<button type="button" class="ht-num' + (n ? " " + cor : "") + '" ' + attrs + ' title="' + tit + '"><b>' + n + '</b><span>' + rotulo + '</span></button>';
    };
    pintarSeMudou($("#hojeTopo"),
      '<div class="ht-dia">' +
        '<span class="ht-saud">' + saud + (primeiro ? ", " + esc(primeiro) : "") + '</span>' +
        '<h1 class="ht-data">' + esc(data) + '</h1>' +
        '<p class="ht-resumo">' + esc(resumo) + '</p>' +
      '</div>' +
      '<div class="ht-cont">' +
        bloco(nAtr, "Atrasados", "vermelho", 'data-action="hoje-dia" data-dia="atrasados"', "Ver os treinamentos atrasados") +
        bloco(nHoje, "Para hoje", "azul", 'data-action="hoje-dia" data-dia="' + A.hoje + '"', "Ver os treinamentos de hoje") +
        bloco(nFoco, "Em foco", "escuro", 'data-action="ir-foco"', "Abrir a aba Foco") +
        bloco(nImp, "Impedimentos" + (nImpVelho ? " · " + nImpVelho + " há +30 dias" : ""), "alerta", 'data-action="ir-impedimentos"', "Abrir a aba Impedimentos") +
      '</div>');
  }

  /* ---------- hoje: fita do que falta fazer e dos próximos agendamentos ---------- */
  function renderFitaHoje(A){
    var hoje = A.hoje, itens = [];
    var quandoDe = function(iso){
      var d = parseDia(iso);
      if(!d) return "sem data";
      if(iso === hoje) return "hoje";
      return DIAS_SEMANA[d.getDay()] + " " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1);
    };
    var treino = function(g, tipo, rotulo){
      var c = g.rep;
      var txt = c.tipo === "etapa" ? "Treinamento do analista · " + c.nome : "Treinamento de " + c.nome;
      var onde = c.tipo === "etapa" ? c.empresaNome + " · " + (SETOR_LABEL[c.setor] || c.setor)
        : c.tipo === "funcionario" ? "Equipe · " + (SETOR_LABEL[c.setor] || c.setor)
        : (c.empresaNome || "") + (g.membros.length > 1 ? " +" + (g.membros.length - 1) : "");
      var acao = c.tipo === "etapa" ? 'data-action="ir-empresa" data-id="' + esc(c.empresaId) + '"'
        : c.tipo === "funcionario" ? 'data-action="ir-funcionario" data-nome="' + esc(c.nome) + '"'
        : 'data-action="ir-contato" data-id="' + esc(c.id) + '"';
      itens.push({dir:tipo, quando:quandoDe(c.agendadoPara) + (c.agendadoPara && c.agendadoHora ? " " + c.agendadoHora : ""), txt:txt, st:rotulo, onde:onde, acao:acao});
    };
    A.atr.forEach(function(g){ treino(g, "desce", "Atrasado"); });
    A.sem.concat(A.adiante).forEach(function(g){ treino(g, "neutro", g.rep.agendadoPara === hoje ? "Hoje" : "Agendado"); });
    A.semData.forEach(function(g){ treino(g, "pend", "Sem data"); });
    listaFoco().forEach(function(e){
      if(e.focoProxAcao || e.focoPrazo){
        var venc = prazoFocoVencido(e);
        itens.push({dir:venc ? "desce" : "pend", quando:e.focoPrazo ? quandoDe(e.focoPrazo) : "foco", txt:e.focoProxAcao || "Prazo da empresa em foco", st:venc ? "Vencida" : "Próxima ação",
          onde:e.nome + (textoAguardando(e) ? " · aguardando " + textoAguardando(e) : ""), acao:'data-action="abrir-foco-empresa" data-id="' + esc(e.id) + '"'});
        return;
      }
      var r = resumoEmpresaFoco(e, docsDaEmpresa(e.id));
      if(r.completa || !r.prox) return;
      itens.push({dir:"pend", quando:"foco", txt:r.prox.item.label, st:"Próximo passo", onde:e.nome + (r.prox.setor ? " · " + r.prox.setor.label : ""), acao:'data-action="abrir-foco-empresa" data-id="' + esc(e.id) + '"'});
    });
    model().bloqueios.forEach(function(b){
      itens.push({dir:"desce", quando:"", txt:b.nome, st:"Impedimento", onde:b.desc || "", acao:'data-action="ir-impedimentos"'});
    });
    itens = itens.slice(0, 40);
    var lbl = '<div class="tk-lbl" title="O que ainda falta fazer"><i class="tk-pulso"></i></div>';
    if(!itens.length){ pintarSeMudou($("#hojeFita"), lbl + '<div class="tk-vazio">Nada pendente. Tudo em dia.</div>'); return; }
    var html = itens.map(function(it){
      return '<button type="button" class="tk-item tk-' + it.dir + '" ' + it.acao + '>' +
        '<span class="tk-ico">' + ICO_TK[it.dir === "pend" ? "neutro" : it.dir] + '</span>' +
        (it.quando ? '<span class="tk-hora">' + esc(it.quando) + '</span>' : '') +
        '<span class="tk-txt">' + esc(cortar(it.txt, 60)) + '</span>' +
        '<span class="tk-st">' + esc(it.st) + '</span>' +
        (it.onde ? '<span class="tk-onde">' + esc(cortar(it.onde, 60)) + '</span>' : '') +
      '</button>';
    }).join("");
    pintarSeMudou($("#hojeFita"), lbl + '<div class="tk-janela"><div class="tk-fita" style="--dur:' + Math.max(30, itens.length * 6) + 's">' + html + '<span class="tk-copia" aria-hidden="true">' + html + '</span></div></div>');
  }

  /* ---------- hoje: faixa da semana ---------- */
  function renderSemana(A){
    var sel = ui.agendaDia || "";
    var celula = function(chave, cls, topo, meio, n){
      return '<button type="button" class="sm-dia ' + cls + (sel === chave ? " on" : "") + (n ? "" : " vazio") + '" data-action="hoje-dia" data-dia="' + chave + '" aria-pressed="' + (sel === chave) + '">' +
        '<span class="sm-sem">' + topo + '</span>' + meio +
        '<span class="sm-qtd">' + (n ? '<b>' + n + '</b> treino' + (n === 1 ? '' : 's') : 'livre') + '</span>' +
      '</button>';
    };
    var html = celula("atrasados", "sm-atr", "Atrasados", '<span class="sm-num sm-ico">' + ICO_TK.desce + '</span>', A.atr.length);
    var base = new Date(); base.setHours(0, 0, 0, 0);
    for(var k = 0; k < 7; k++){
      var d = somarDias(base, k), iso = diaLocal(d), n = A.doDia(iso).length;
      var fds = d.getDay() === 0 || d.getDay() === 6;
      html += celula(iso, (k === 0 ? "sm-hoje" : "") + (fds ? " sm-fds" : ""), k === 0 ? "Hoje" : DIAS_SEMANA[d.getDay()], '<span class="sm-num">' + pad2(d.getDate()) + '<small>' + MESES_CURTOS[d.getMonth()] + '</small></span>', n);
    }
    html += '<button type="button" class="sm-dia sm-add'+(ui.agendar.aberto ? ' on' : '')+'" data-action="agendar-abrir" aria-expanded="'+ui.agendar.aberto+'" title="Agendar um treinamento"><span class="sm-mais">+</span><span>Agendar</span><span class="sm-qtd">treinamento</span></button>';
    pintarSeMudou($("#hojeSemana"), html);
    $$("#hojeSemana .sm-dia[data-dia]").forEach(function(b){ var dd = b.getAttribute("data-dia"); if(dd && dd !== "atrasados") b.setAttribute("data-soltar", dd); });
    renderAgendar();
  }

  /* ---------- hoje: agendar treinamento (pessoa, data e horário) ---------- */
  function opcoesAgendar(q){
    q = normBusca(q).trim();
    var out = [];
    pessoasUnicas().forEach(function(pp){
      var hay = normBusca(pp.nome + " " + pp.email + " " + pp.registros.map(function(c){ return c.empresaNome; }).join(" "));
      if(q && hay.indexOf(q) === -1) return;
      var rep = pp.registros.slice().sort(function(a, b){ return (RANK_TREINO[b.statusTreinamento] || 0) - (RANK_TREINO[a.statusTreinamento] || 0); })[0];
      var emps = {}; pp.registros.forEach(function(c){ emps[c.empresaNome || ""] = true; });
      out.push({tipo:"contato", id:pp.registros[0].id, nome:pp.nome, sub:"Cliente · " + Object.keys(emps).filter(Boolean).join(", "), st:rep.statusTreinamento || "pendente", ag:rep.agendadoPara, hora:rep.agendadoHora});
    });
    state.funcionarios.forEach(function(f){
      if(q && normBusca(f.nome + " " + (f.cargo || "")).indexOf(q) === -1) return;
      out.push({tipo:"funcionario", id:f.id, nome:f.nome, sub:"Equipe · " + (SETOR_LABEL[f.setor] || f.setor || "") + (f.cargo ? " · " + f.cargo : ""), st:f.statusTreinamento || "pendente", ag:f.agendadoPara, hora:f.agendadoHora});
    });
    out.sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    return out;
  }
  // Calendário sobreposto: dia, horário e uma ou mais pessoas. Fecha ao clicar fora ou com Esc.
  var HORAS_RAPIDAS = ["08:00","09:00","10:00","11:00","14:00","15:00","16:00","17:00"];
  function chaveAgd(o){ return o.tipo + ":" + o.id; }
  function agdMarcado(o){ return ui.agendar.sel.some(function(x){ return chaveAgd(x) === chaveAgd(o); }); }
  function abrirAgendar(){
    var A = ui.agendar;
    A.aberto = true; A.sel = []; A.hora = ""; A.ativo = 0;
    A.data = ui.agendaDia && ui.agendaDia !== "atrasados" ? ui.agendaDia : hojeISO();
    A.mes = A.data.slice(0, 7);
    var box = document.querySelector("#agdModal .agd"); if(box) box.innerHTML = "";
    renderAgendar();
    var q = $("#agdQuem"); if(q) q.focus();
  }
  function fecharAgendar(){
    if(!ui.agendar.aberto) return;
    ui.agendar.aberto = false; ui.agendar.sel = [];
    renderAgendar();
    var b = document.querySelector('#hojeSemana [data-action="agendar-abrir"]');
    if(b){ b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); b.focus(); }
  }
  function renderAgendar(){
    var bg = $("#agdModal");
    if(!bg) return;
    var A = ui.agendar, box = bg.firstElementChild;
    if(!A.aberto){
      if(!bg.hidden){ bg.hidden = true; box.innerHTML = ""; }
      document.body.classList.remove("agd-aberto");
      return;
    }
    bg.hidden = false; document.body.classList.add("agd-aberto");
    if(!box.querySelector("#agdQuem")){
      box.innerHTML =
        '<div class="agd-head"><h3 id="agdTit">Agendar treinamento</h3><small>Clique fora ou tecle Esc para sair</small></div>' +
        '<div class="agd-corpo">' +
          '<div class="agd-cal">' +
            '<div id="agdCal"></div>' +
            '<div><span class="agd-rot">Horário (opcional)</span><div class="agd-horas" id="agdHoras"></div></div>' +
            '<div id="agdNoDia"></div>' +
          '</div>' +
          '<div class="agd-pessoas">' +
            '<label class="agd-rot" for="agdQuem" style="margin:0">Quem vai ser treinado</label>' +
            '<input type="text" id="agdQuem" placeholder="Buscar contato, funcionário, e-mail ou empresa…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="agdRes">' +
            '<div class="agd-sel" id="agdSel"></div>' +
            '<div class="agd-lista-rot" id="agdListaRot"></div>' +
            '<div class="agd-lista" id="agdRes" role="listbox" aria-multiselectable="true"></div>' +
          '</div>' +
        '</div>' +
        '<div class="agd-pe"><span class="agd-resumo" id="agdResumo"></span><span class="agd-pe-btns">' +
          '<button type="button" class="fbtn" data-action="agendar-fechar">Cancelar</button>' +
          '<button type="button" class="fbtn fbtn-pri" data-action="agendar-confirmar">Agendar</button>' +
        '</span></div>';
    }
    pintarCalendarioAgd(); pintarHorasAgd(); pintarSelAgd(); atualizarOpcoesAgendar(); pintarResumoAgd();
  }
  function pintarCalendarioAgd(){
    var A = ui.agendar, el = $("#agdCal");
    if(!el) return;
    var p = A.mes.split("-"), ano = +p[0], mes = +p[1] - 1;
    var ini = new Date(ano, mes, 1), hoje = hojeISO();
    var ag = coletarAgenda(), cont = {};
    ag.todos.forEach(function(c){ if(c.agendadoPara) cont[c.agendadoPara] = (cont[c.agendadoPara] || 0) + 1; });
    var html = '<div class="agd-mes"><button type="button" class="agd-nav" data-action="agd-mes" data-d="-1" aria-label="Mês anterior">‹</button>' +
      '<b>' + MESES_LONGOS[mes].charAt(0).toUpperCase() + MESES_LONGOS[mes].slice(1) + ' de ' + ano + '</b>' +
      '<button type="button" class="agd-nav" data-action="agd-mes" data-d="1" aria-label="Próximo mês">›</button></div><div class="agd-grade">';
    ["dom","seg","ter","qua","qui","sex","sáb"].forEach(function(d){ html += '<span class="agd-sem">' + d + '</span>'; });
    var d0 = somarDias(ini, -ini.getDay());
    for(var k = 0; k < 42; k++){
      var d = somarDias(d0, k), iso = diaLocal(d), n = cont[iso] || 0;
      if(k === 35 && d.getMonth() !== mes) break;
      var cls = "agd-dia" + (d.getMonth() !== mes ? " fora" : "") + (iso < hoje ? " passado" : "") + (iso === hoje ? " hoje" : "") + (iso === A.data ? " sel" : "");
      var pts = ""; for(var t = 0; t < Math.min(n, 3); t++) pts += "<i></i>";
      html += '<button type="button" class="' + cls + '" data-action="agd-dia" data-dia="' + iso + '" aria-pressed="' + (iso === A.data) + '" title="' + DIAS_SEMANA[d.getDay()] + ' ' + diaBR(iso) + (n ? ' · ' + n + ' treinamento' + (n === 1 ? '' : 's') + ' já agendado' + (n === 1 ? '' : 's') : '') + '">' +
        d.getDate() + '<span class="agd-pts">' + pts + '</span></button>';
    }
    el.innerHTML = html + '</div>';
    var nd = $("#agdNoDia");
    if(nd){
      var doDia = ag.doDia(A.data);
      nd.innerHTML = doDia.length
        ? '<span class="agd-rot">Já agendado neste dia</span><ul class="agd-nodia">' + doDia.slice(0, 6).map(function(g){
            var c = g.rep;
            return '<li><time>' + esc(c.agendadoHora || "—") + '</time><span>' + esc(c.nome) + (c.empresaNome ? ' · ' + esc(c.empresaNome) : c.tipo === "funcionario" ? ' · Equipe' : '') + '</span></li>';
          }).join("") + (doDia.length > 6 ? '<li><span>+' + (doDia.length - 6) + ' outros</span></li>' : '') + '</ul>'
        : '<span class="agd-rot" style="margin:0">Nenhum treinamento agendado neste dia.</span>';
    }
  }
  function pintarHorasAgd(){
    var el = $("#agdHoras"), A = ui.agendar;
    if(!el) return;
    var inp = el.querySelector("#agdHora");
    var chips = HORAS_RAPIDAS.map(function(h){ return '<button type="button" class="agd-hchip' + (A.hora === h ? ' on' : '') + '" data-action="agd-hora" data-h="' + h + '" aria-pressed="' + (A.hora === h) + '">' + h + '</button>'; }).join("");
    if(!inp){ el.innerHTML = chips + '<input type="time" id="agdHora" step="300" aria-label="Outro horário" value="' + esc(A.hora) + '">'; return; }
    $$("#agdHoras .agd-hchip").forEach(function(b){ var on = b.getAttribute("data-h") === A.hora; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    if(document.activeElement !== inp && inp.value !== A.hora) inp.value = A.hora;
  }
  function pintarSelAgd(){
    var el = $("#agdSel");
    if(!el) return;
    el.innerHTML = ui.agendar.sel.map(function(o){
      return '<button type="button" class="agd-chip" data-action="agd-remover" data-k="' + esc(chaveAgd(o)) + '" title="Tirar ' + esc(o.nome) + '"><span>' + esc(o.nome) + '</span><i aria-hidden="true">×</i></button>';
    }).join("");
  }
  function pintarResumoAgd(){
    var A = ui.agendar, el = $("#agdResumo"), btn = document.querySelector('#agdModal [data-action="agendar-confirmar"]');
    if(!el) return;
    var d = parseDia(A.data), n = A.sel.length;
    var quando = d ? DIAS_SEMANA[d.getDay()] + " " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + (A.hora ? " às " + A.hora : "") : "escolha o dia";
    el.innerHTML = n ? '<b>' + n + ' pessoa' + (n === 1 ? '' : 's') + '</b> · ' + esc(quando) : 'Escolha quem vai ser treinado · ' + esc(quando);
    if(btn){ btn.disabled = !n || !A.data; btn.textContent = n > 1 ? "Agendar " + n + " treinamentos" : "Agendar"; }
  }
  function sugestoesAgendar(){
    var foco = {}, emFoco = {};
    listaFoco().forEach(function(e){ foco[e.id] = true; });
    pessoasUnicas().forEach(function(pp){ if(pp.registros.some(function(c){ return foco[c.empresaId]; })) emFoco[pp.registros[0].id] = true; });
    return opcoesAgendar("").filter(function(o){
      return o.st === "pendente" && (o.tipo === "funcionario" || emFoco[o.id]);
    }).slice(0, 40);
  }
  function atualizarOpcoesAgendar(){
    var inp = $("#agdQuem"), res = $("#agdRes"), rot = $("#agdListaRot");
    if(!inp || !res) return;
    var q = inp.value.trim();
    var ops = q ? opcoesAgendar(q).slice(0, 50) : sugestoesAgendar();
    ui.agendar.opcoes = ops;
    if(ui.agendar.ativo >= ops.length) ui.agendar.ativo = 0;
    if(rot) rot.textContent = q ? ops.length + (ops.length === 50 ? "+" : "") + " encontrado" + (ops.length === 1 ? "" : "s") + " · clique para marcar ou desmarcar" : "Sugestões: pendentes da equipe e das empresas em foco. Busque para achar qualquer pessoa.";
    var topo = res.scrollTop;
    res.innerHTML = ops.length ? ops.map(function(o, i){
      var st = STATUS_LABEL[o.st] ? o.st : "pendente", m = agdMarcado(o);
      return '<button type="button" class="agd-op' + (m ? ' marcado' : '') + (i === ui.agendar.ativo ? ' ativo' : '') + '" data-action="agendar-escolher" data-i="' + i + '" role="option" aria-selected="' + m + '">' +
        '<span class="agd-ck" aria-hidden="true">✓</span><b>' + esc(o.nome) + '</b><small>' + esc(o.sub) + '</small>' +
        '<span class="fchip st-' + st + '">' + esc(rotuloStatus(st, o.ag, o.hora)) + '</span></button>';
    }).join("") : '<div class="agd-vazio">' + (q ? 'Ninguém encontrado. Cadastre o contato em Consulta ou no Foco.' : 'Nenhuma sugestão agora. Busque pelo nome.') + '</div>';
    res.scrollTop = topo;
  }
  function escolherAgendar(i){
    var o = (ui.agendar.opcoes || [])[i];
    if(!o) return;
    ui.agendar.ativo = i;
    if(agdMarcado(o)) ui.agendar.sel = ui.agendar.sel.filter(function(x){ return chaveAgd(x) !== chaveAgd(o); });
    else ui.agendar.sel.push(o);
    pintarSelAgd(); atualizarOpcoesAgendar(); pintarResumoAgd();
  }
  function confirmarAgendar(){
    var A = ui.agendar, data = A.data, hora = ($("#agdHora") || {}).value || A.hora || "";
    if(!A.sel.length) return;
    if(!data || !dataValida(data)){ mostrarToast("Escolha o dia do treinamento."); return; }
    if(!horaValida(hora)){ mostrarToast("Horário inválido."); return; }
    var antesC = [], antesF = [];
    A.sel.forEach(function(o){
      if(o.tipo === "contato"){
        var c0 = state.contatos.find(function(x){ return x.id === o.id; });
        (c0 ? [c0].concat(mesmaPessoa(c0)) : []).forEach(function(c){ antesC.push({id:c.id, statusTreinamento:c.statusTreinamento || "pendente", concluidoEm:c.concluidoEm || "", agendadoPara:c.agendadoPara || "", agendadoHora:c.agendadoHora || ""}); });
      } else {
        var f0 = state.funcionarios.find(function(x){ return x.id === o.id; });
        if(f0) antesF.push({id:f0.id, statusTreinamento:f0.statusTreinamento || "pendente", concluidoEm:f0.concluidoEm || "", agendadoPara:f0.agendadoPara || "", agendadoHora:f0.agendadoHora || ""});
      }
    });
    var n = A.sel.length, nomes = A.sel.map(function(o){ return o.nome; });
    emLote(function(){
      A.sel.forEach(function(o){
        if(o.tipo === "contato"){
          definirStatusContato(o.id, "agendado", data, true);
          var c0 = state.contatos.find(function(x){ return x.id === o.id; });
          (c0 ? [c0].concat(mesmaPessoa(c0)) : []).forEach(function(c){ c.agendadoHora = hora; if(dbRef) dbRef.collection("contatos").doc(c.id).update({agendadoHora:hora}); });
        } else {
          definirStatusFuncionario(o.id, "agendado", data, true);
          var f0 = state.funcionarios.find(function(x){ return x.id === o.id; });
          if(f0){ f0.agendadoHora = hora; if(dbRef) dbRef.collection("funcionarios").doc(o.id).update({agendadoHora:hora}); }
        }
      });
      A.aberto = false; A.sel = [];
    });
    renderAgendar();
    var d = parseDia(data);
    var quando = (d ? DIAS_SEMANA[d.getDay()] + " " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) : data) + (hora ? " às " + hora : "");
    mostrarToast((n === 1 ? nomes[0] + ": treinamento agendado" : n + " treinamentos agendados") + " para " + quando, "Desfazer", function(){
      emLote(function(){
        antesC.forEach(function(a){
          var c = state.contatos.find(function(x){ return x.id === a.id; }), p0 = Object.assign({}, a); delete p0.id;
          if(c) Object.assign(c, p0);
          if(dbRef) dbRef.collection("contatos").doc(a.id).update(p0);
        });
        antesF.forEach(function(a){
          var f = state.funcionarios.find(function(x){ return x.id === a.id; }), p0 = Object.assign({}, a); delete p0.id;
          if(f) Object.assign(f, p0);
          if(dbRef) dbRef.collection("funcionarios").doc(a.id).update(p0);
        });
      });
    });
  }
  // Arrastar um item da agenda para um dia da faixa remarca a data (o horário é mantido).
  function remarcarPara(info, iso){
    var el = document.createElement("input");
    if(info.tipo === "contato"){ el.className = "cont-ag-data"; el.setAttribute("data-id", info.id); }
    else if(info.tipo === "funcionario"){ el.className = "func-ag-data"; el.setAttribute("data-id", info.id); }
    else { el.setAttribute("data-empresa", info.empresa); el.setAttribute("data-setor", info.setor); el.setAttribute("data-etapa", "treinamentoAnalista"); }
    var antes = info.antes || "";
    el.value = iso;
    var ed = edicaoDataDe(el);
    ed.aplicar(); if(dbRef) ed.salvar();
    renderAll();
    var d = parseDia(iso);
    mostrarToast((info.nome || "Treinamento") + " remarcado para " + (d ? DIAS_SEMANA[d.getDay()] + " " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) : iso), "Desfazer", function(){
      el.value = antes; var ed2 = edicaoDataDe(el); ed2.aplicar(); if(dbRef) ed2.salvar(); renderAll();
    });
  }
  (function(){
    var origem = null, arrastando = null;
    document.addEventListener("mousedown", function(ev){ origem = ev.target; }, true);
    document.addEventListener("dragstart", function(ev){
      var it = ev.target.closest && ev.target.closest('.ag-item[draggable="true"]');
      if(!it) return;
      if(origem && origem.closest && origem.closest("input, select, button, label, a")){ ev.preventDefault(); return; }
      arrastando = {tipo:it.getAttribute("data-tipo"), id:it.getAttribute("data-id"), empresa:it.getAttribute("data-empresa"), setor:it.getAttribute("data-setor"), nome:it.getAttribute("data-nome"), antes:it.getAttribute("data-antes")};
      try{ ev.dataTransfer.setData("text/plain", arrastando.nome || "treinamento"); ev.dataTransfer.effectAllowed = "move"; }catch(e){}
      it.classList.add("arrastado"); document.body.classList.add("arrastando");
    });
    document.addEventListener("dragend", function(){
      arrastando = null; document.body.classList.remove("arrastando");
      $$(".ag-item.arrastado").forEach(function(x){ x.classList.remove("arrastado"); });
      $$(".sm-dia.drop-alvo").forEach(function(x){ x.classList.remove("drop-alvo"); });
    });
    document.addEventListener("dragover", function(ev){
      var alvo = ev.target.closest && ev.target.closest(".sm-dia[data-soltar]");
      $$(".sm-dia.drop-alvo").forEach(function(x){ if(x !== alvo) x.classList.remove("drop-alvo"); });
      if(!alvo || !arrastando) return;
      ev.preventDefault(); alvo.classList.add("drop-alvo");
    });
    document.addEventListener("drop", function(ev){
      var alvo = ev.target.closest && ev.target.closest(".sm-dia[data-soltar]");
      if(!alvo || !arrastando) return;
      ev.preventDefault();
      var info = arrastando; arrastando = null;
      document.body.classList.remove("arrastando");
      if(info.antes === alvo.getAttribute("data-soltar")) return;
      remarcarPara(info, alvo.getAttribute("data-soltar"));
    });
    document.addEventListener("input", function(ev){
      if(ev.target.id === "agdQuem"){ ui.agendar.ativo = 0; atualizarOpcoesAgendar(); var r = $("#agdRes"); if(r) r.scrollTop = 0; }
      else if(ev.target.id === "agdHora"){ ui.agendar.hora = ev.target.value; pintarHorasAgd(); pintarResumoAgd(); }
    });
    document.addEventListener("keydown", function(ev){
      if(!ui.agendar.aberto) return;
      if(ev.key === "Escape"){
        ev.preventDefault();
        if(ev.target.id === "agdQuem" && ev.target.value){ ev.target.value = ""; atualizarOpcoesAgendar(); }
        else fecharAgendar();
        return;
      }
      if(ev.target.id !== "agdQuem") return;
      var n = (ui.agendar.opcoes || []).length;
      if(ev.key === "ArrowDown" || ev.key === "ArrowUp"){
        ev.preventDefault(); if(!n) return;
        ui.agendar.ativo = ((ui.agendar.ativo || 0) + (ev.key === "ArrowDown" ? 1 : n - 1)) % n; atualizarOpcoesAgendar();
        var at = document.querySelector("#agdRes .agd-op.ativo"); if(at) at.scrollIntoView({block:"nearest"});
      } else if(ev.key === "Enter"){ ev.preventDefault(); if(n) escolherAgendar(ui.agendar.ativo || 0); }
    });
    // Fecha ao clicar fora da janela (só se o clique começou e terminou no fundo escuro).
    var bgAgd = $("#agdModal"), desceuNoFundo = false;
    if(bgAgd){
      bgAgd.addEventListener("mousedown", function(ev){ desceuNoFundo = ev.target === bgAgd; });
      bgAgd.addEventListener("click", function(ev){ if(ev.target === bgAgd && desceuNoFundo) fecharAgendar(); desceuNoFundo = false; });
    }
  })();

  /* ---------- hoje: o que já foi feito ---------- */
  function renderFeitoHoje(){
    var hoje = hojeISO();
    var evs = eventosUnificados().filter(function(e){ return e.dia === hoje; });
    $("#feitoCount").textContent = evs.length ? evs.length + " atividade" + (evs.length === 1 ? "" : "s") : "";
    var box = $("#feitoHoje");
    if(!evs.length){
      box.innerHTML = '<div class="feito-vazio">Nada registrado hoje ainda. Mudanças de etapa, treinamentos e cadastros aparecem aqui assim que acontecem.</div>';
      return;
    }
    var LIM = 8;
    box.innerHTML = evs.slice(0, LIM).map(function(e){
      var d = descEvento(e), dir = direcaoEvento(e), onde = ondeEvento(e);
      return '<div class="fh-item"><time>' + (e.em ? horaDeISO(e.em) : "—") + '</time>' +
        '<span class="rel-dir tk-' + dir + '">' + ICO_TK[dir] + '</span>' +
        '<span class="fh-txt">' + esc(d.txt) + eventoChips(d) + (onde ? '<span class="fh-onde">' + esc(onde) + '</span>' : '') + '</span></div>';
    }).join("") +
    '<div class="feito-rodape">' + (evs.length > LIM ? '<span>e mais ' + (evs.length - LIM) + '.</span>' : '<span></span>') +
      '<button type="button" class="linkish" data-action="ver-registro-hoje">Ver o registro de hoje</button></div>';
    preencherNomes(box);
  }

  function renderAgenda(){
    var A = coletarAgenda(), hoje = A.hoje;
    var atr = A.atr, sem = A.sem, adiante = A.adiante, semData = A.semData;
    if(carregando()){ $("#agendaCount").textContent = ""; $("#agendaPanel").innerHTML = '<div class="agenda-vazio">Carregando…</div>'; $("#agendaRodape").hidden = true; $("#hojeSemana").innerHTML = ""; $("#hojeFita").hidden = true; return; }
    renderHojeTopo(A);
    $("#hojeFita").hidden = false;
    renderFitaHoje(A);
    renderSemana(A);
    var focos = listaFoco().map(function(e){ return {e:e, r:resumoEmpresaFoco(e, docsDaEmpresa(e.id)), parada:diasParada(e)}; })
      .filter(function(x){ return !x.r.completa && (prazoFocoVencido(x.e) || (x.parada !== null && x.parada >= 7)); })
      .sort(function(a, b){ return (prazoFocoVencido(b.e) ? 1 : 0) - (prazoFocoVencido(a.e) ? 1 : 0) || (b.parada || 0) - (a.parada || 0); });
    var cnt = [];
    if(atr.length) cnt.push(atr.length + " atrasado" + (atr.length === 1 ? "" : "s"));
    if(sem.length) cnt.push(sem.length + " nesta semana");
    $("#agendaCount").textContent = cnt.join(" · ");
    // Cada coluna mostra tudo numa área de altura fixa que rola com a roda do mouse.
    var coluna = function(cls, titulo, itens, html, vazio){
      var diaDe = function(g){ return g && g.rep ? g.rep.agendadoPara || "" : ""; };
      var linhas = itens.map(function(g, i){
        var h = html(g), d = diaDe(g);
        return d && i && diaDe(itens[i - 1]) === d ? h.replace('class="ag-item"', 'class="ag-item ag-mesmo-dia"') : h;
      }).join("");
      return '<div class="agenda-col '+cls+'"><h3><span>'+titulo+'</span><span class="mono">'+itens.length+'</span></h3>' +
        (linhas ? '<div class="agenda-scroll" tabindex="0" data-col="'+esc(titulo)+'" aria-label="'+esc(titulo)+'">'+linhas+'</div>' : '<div class="att-empty">'+vazio+'</div>') + '</div>';
    };
    var itemFoco = function(x){
      var pct = Math.round(x.r.pct * 100);
      var motivo = prazoFocoVencido(x.e) ? '<span class="ag-onde atr">Prazo venceu em '+dataCurta(x.e.focoPrazo)+'</span>' : (x.parada !== null ? '<span class="ag-onde atr">Parada há '+x.parada+' dias</span>' : '');
      var passo = x.e.focoProxAcao ? '<span class="ag-onde'+(prazoFocoVencido(x.e) ? ' atr' : '')+'">Próxima ação: <b>'+esc(x.e.focoProxAcao)+'</b>'+(x.e.focoPrazo ? ' · até '+dataCurta(x.e.focoPrazo) : '')+'</span>'
        : x.r.completa ? '<span class="ag-onde ok">Todas as etapas concluídas</span>'
        : x.r.prox ? '<span class="ag-onde">Próximo: <b>'+esc(x.r.prox.item.label)+'</b>'+(x.r.prox.setor ? ' · '+x.r.prox.setor.label : '')+'</span>' : '<span class="ag-onde">Nenhum setor com demanda</span>';
      return '<div class="ag-item"><span class="ag-dia ag-pct"><b>'+pct+'</b><small>%</small></span>' +
        '<button type="button" class="ag-nome" data-action="abrir-foco-empresa" data-id="'+x.e.id+'" title="Abrir no Foco">'+esc(x.e.nome)+'</button>' + motivo + passo +
        '<span class="ag-barra"><i style="width:'+pct+'%"></i></span></div>';
    };
    var item = function(g){ return itemAgendaHTML(g, hoje); };
    var colFoco = coluna("foco", "Em foco: paradas ou com prazo vencido", focos, itemFoco, listaFoco().length ? 'Nenhuma empresa em foco parada há 7 dias ou mais, nem com prazo vencido.' : 'Nenhuma empresa em foco. <button type="button" class="linkish" data-action="ir-foco">Escolher empresas no Foco</button>');
    var cols;
    var diaSel = ui.agendaDia;
    if(diaSel && diaSel !== "atrasados" && (diaSel < hoje || diaSel > A.lim7)) diaSel = ui.agendaDia = null;
    if(diaSel){
      var dsel = parseDia(diaSel);
      var tit = diaSel === "atrasados" ? "Treinamentos atrasados"
        : "Treinamentos de " + (diaSel === hoje ? "hoje" : dsel.toLocaleDateString("pt-BR", {weekday:"long", day:"numeric", month:"long"}));
      var lista = diaSel === "atrasados" ? atr : A.doDia(diaSel);
      cols = [coluna(diaSel === "atrasados" ? "atrasados dia-sel" : "dia-sel", tit, lista, item, diaSel === "atrasados" ? "Nenhum atrasado." : "Nada agendado para este dia."), colFoco];
    } else {
      cols = [
        coluna("atrasados", "Treinamentos atrasados", atr, item, "Nenhum atrasado."),
        coluna("", "Treinamentos: hoje e próximos 7 dias", sem, item, "Nada agendado para esta semana."),
        colFoco
      ];
      if(ui.agendaCompleta){
        cols.push(coluna("", "Treinamentos mais adiante", adiante, item, "Nada mais adiante."));
        cols.push(coluna("", "Agendados sem data", semData, item, "Todos têm data."));
      }
    }
    var painelAg = $("#agendaPanel"), rolagem = {};
    $$(".agenda-scroll", painelAg).forEach(function(el){ rolagem[el.getAttribute("data-col")] = el.scrollTop; });
    painelAg.innerHTML = cols.join("");
    $$(".agenda-scroll", painelAg).forEach(function(el){
      var y = rolagem[el.getAttribute("data-col")];
      if(y) el.scrollTop = y;
      marcarRolagemAgenda(el);
      el.addEventListener("scroll", function(){ marcarRolagemAgenda(el); }, {passive:true});
    });
    var extra = adiante.length + semData.length;
    $("#agendaRodape").innerHTML = diaSel
      ? '<button type="button" class="linkish" data-action="hoje-dia" data-dia="">Ver a semana inteira</button>'
      : ui.agendaCompleta
        ? '<button type="button" class="linkish" data-action="agenda-toggle">Mostrar menos</button>'
        : (extra ? '<span>'+(adiante.length ? adiante.length+' agendado'+(adiante.length === 1 ? '' : 's')+' mais adiante' : '')+(adiante.length && semData.length ? ' · ' : '')+(semData.length ? semData.length+' sem data' : '')+'</span><button type="button" class="linkish" data-action="agenda-toggle">Ver agenda completa</button>' : '');
    $("#agendaRodape").hidden = !$("#agendaRodape").innerHTML;
  }

  // Esmaece a borda de cima/baixo só quando há mais itens naquela direção.
  function marcarRolagemAgenda(el){
    var max = el.scrollHeight - el.clientHeight;
    el.classList.toggle("desce", max > 2 && el.scrollTop < max - 2);
    el.classList.toggle("sobe", el.scrollTop > 2);
  }

  /* ---------- hoje: precisa de atenção ---------- */
  function renderAtencao(m){
    var LIM = 6;
    var lista = function(box, itens, html, vazio, maisHTML){
      box.innerHTML = itens.length
        ? itens.slice(0, LIM).map(html).join("") + (itens.length > LIM ? maisHTML(itens.length - LIM) : "")
        : '<div class="att-empty">' + vazio + '</div>';
    };
    var tags = function(fs){ return fs.map(function(s){ return SETOR_TAG[s.setor]; }).join(" · "); };

    $("#atnImpN").textContent = m.bloqueios.length;
    lista($("#listImpHoje"), m.bloqueios, function(b){
      return '<button type="button" class="att-item" data-action="ir-impedimentos"><span class="att-name">'+esc(b.nome)+(b.desc ? '<span class="att-desc">'+esc(b.desc)+'</span>' : '')+'</span><span class="att-meta">'+esc(b.escopo)+'</span></button>';
    }, "Nenhum impedimento em aberto.", function(n){
      return '<button type="button" class="linkish att-mais" data-action="ir-impedimentos">Ver todos ('+(n + LIM)+')</button>';
    });

    var semAna = listaSemAnalista(m);
    $("#atnAnaN").textContent = semAna.length;
    $('[data-lista="semAnalista"]').disabled = !semAna.length;
    lista($("#listSemAnalista"), semAna, function(x){
      return '<button type="button" class="att-item" data-action="ir-empresa" data-id="'+x.e.id+'"><span class="att-name">'+esc(x.e.nome)+'</span><span class="att-meta">'+tags(x.falta)+'</span></button>';
    }, "Todas as frentes têm analista.", function(n){
      return '<button type="button" class="linkish att-mais" data-action="ver-sem-analista">Ver todas em Consulta ('+(n + LIM)+')</button>';
    });

    var semCont = listaSemContato(m);
    $("#atnContN").textContent = semCont.length;
    $('[data-lista="semContato"]').disabled = !semCont.length;
    lista($("#listSemContato"), semCont, function(x){
      return '<button type="button" class="att-item" data-action="ir-empresa" data-id="'+x.e.id+'"><span class="att-name">'+esc(x.e.nome)+'</span><span class="att-meta">'+tags(x.frentes)+'</span></button>';
    }, "Todas as empresas têm ao menos um contato cadastrado.", function(n){
      return '<button type="button" class="linkish att-mais" data-action="ver-sem-contato">Ver todas em Consulta ('+(n + LIM)+')</button>';
    });
  }
  // Empresas ativas com alguma frente (setor com demanda) sem analista definido.
  function listaSemAnalista(m){
    return m.ativas.map(function(e){
      return {e:e, falta:frentesDaEmpresa(e, m.porEmpresa[e.id] || []).filter(function(s){ return !String(s.analistaNome || "").trim(); })};
    }).filter(function(x){ return x.falta.length; });
  }
  // Empresas com ao menos um contato de cliente vinculado a algum setor.
  var memoComCont = {ref:null, mapa:{}};
  function comContatoIdx(){
    if(memoComCont.ref !== state.contatos){
      var m = {};
      contatosValidos().forEach(function(c){ if((c.setores || []).length) m[c.empresaId] = true; });
      memoComCont = {ref:state.contatos, mapa:m};
    }
    return memoComCont.mapa;
  }
  // Empresas ativas com demanda que não têm nenhum contato de cliente vinculado a algum setor.
  function listaSemContato(m){
    var comContato = comContatoIdx();
    return m.ativas.map(function(e){ return {e:e, frentes:frentesDaEmpresa(e, m.porEmpresa[e.id] || [])}; })
      .filter(function(x){ return x.frentes.length && !comContato[x.e.id]; });
  }
  function baixarListaAtencao(qual){
    if(typeof XLSX === "undefined"){ mostrarToast("A biblioteca de planilhas ainda não carregou. Tente de novo em instantes."); return; }
    if(!downloadsRef){ mostrarToast("O download de arquivos não está disponível nesta janela."); return; }
    var m = model(), linhas, aba, nome;
    var analistasDe = function(e){ var ns = {}; frentesDaEmpresa(e, m.porEmpresa[e.id] || []).forEach(function(s){ var n = String(s.analistaNome || "").trim(); if(n) ns[n] = true; }); return Object.keys(ns).join(", "); };
    if(qual === "semAnalista"){
      aba = "Frentes sem analista"; nome = "frentes-sem-analista";
      linhas = [["Empresa","CNPJ","Setor sem analista","Outros setores com demanda","Analistas já definidos","Em foco"]];
      listaSemAnalista(m).forEach(function(x){
        var todos = frentesDaEmpresa(x.e, m.porEmpresa[x.e.id] || []).map(function(s){ return s.setor; });
        x.falta.forEach(function(s){
          linhas.push([x.e.nome, x.e.cnpj || "", SETOR_LABEL[s.setor] || s.setor,
            todos.filter(function(k){ return k !== s.setor; }).map(function(k){ return SETOR_LABEL[k]; }).join(", "), analistasDe(x.e), x.e.emFoco ? "SIM" : "NAO"]);
        });
      });
    } else {
      aba = "Empresas sem contato"; nome = "empresas-sem-contato";
      linhas = [["Empresa","CNPJ","Setores com demanda","Analistas","Contatos sem setor","Em foco"]];
      listaSemContato(m).forEach(function(x){
        var semSetor = contatosValidos().filter(function(c){ return c.empresaId === x.e.id; }).map(function(c){ return c.nome; }).join(", ");
        linhas.push([x.e.nome, x.e.cnpj || "", x.frentes.map(function(s){ return SETOR_LABEL[s.setor]; }).join(", "), analistasDe(x.e), semSetor, x.e.emFoco ? "SIM" : "NAO"]);
      });
    }
    var ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = linhas[0].map(function(h, i){ return {wch: i === 0 ? 48 : i === 1 ? 20 : 26}; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, aba);
    var blob = new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    var n = linhas.length - 1;
    downloadsRef.save({filename: nome + "-" + hojeISO() + ".xlsx", data: blob}).then(function(){
      mostrarToast("Planilha baixada: " + n + " linha" + (n === 1 ? "" : "s") + ".");
    }).catch(function(err){ if(!(err && err.code === "declined")) mostrarToast("Não foi possível baixar a planilha agora."); });
  }

  /* ---------- alinhamento de parâmetros por setor ---------- */
  function renderAlinhamentoSetor(){
    var box = $("#alinhamentoSetorBox");
    box.innerHTML = SETORES.map(function(s){
      var a = alinhamentoDoc(s.key);
      var cls = a.status === "concluido" ? "done" : (a.status === "andamento" ? "progress" : "pendente");
      return '<div class="align-card '+cls+'">' +
        '<div class="align-head"><h4><span class="trk-tag">'+s.tag+'</span>'+s.label+'</h4>' +
          seletorAlinhamento("ast-"+s.key, a.status, s.key) +
        '</div>' +
        '<div class="align-field"><label>Gestor do departamento</label><input type="text" class="align-gestor" id="agest-'+s.key+'" data-setor="'+s.key+'" value="'+esc(a.gestorNome||"")+'" placeholder="Nome do gestor"><span class="fsave" id="fs-agest-'+s.key+'"></span></div>' +
        (a.status === "concluido" ? campoConclusao("acd-"+s.key, 'data-alinh="'+s.key+'"', a.data) : '') +
      '</div>';
    }).join("");
  }

  /* ---------- progresso: empresas console ---------- */
  function trilha(empresa, doc, setorKey){
    return ETAPAS.filter(function(et){ return !et.porEmpresa && (!et.onlyIf || et.onlyIf(empresa, setorKey)); }).map(function(et){
      var st = statusDe(doc, et.key, empresa.id, setorKey);
      return '<span class="cell c-'+st+'" role="img" aria-label="'+esc(et.label)+': '+STATUS_LABEL[st]+'" data-tip="<b>'+esc(et.label)+'</b>'+STATUS_LABEL[st]+'"></span>';
    }).join("");
  }

  function renderEmpresas(){
    var cont = $("#empresasList");

    var fbox = $("#filters");
    fbox.innerHTML = '<button data-setor="todos" class="'+(ui.filtroSetor==="todos"?"on":"")+'">Todos</button>' +
      SETORES.map(function(s){ return '<button data-setor="'+s.key+'" class="'+(ui.filtroSetor===s.key?"on":"")+'">'+s.label+'</button>'; }).join("");
    $$("button", fbox).forEach(function(b){
      b.addEventListener("click", function(){ ui.filtroSetor = b.getAttribute("data-setor"); renderEmpresas(); });
    });

    var btnPend = $("#btnSoPendentes"), btnImp = $("#btnSoImpedimentoProgresso"), btnClear = $("#btnLimparProgresso");
    btnPend.classList.toggle("on", ui.soPendentes);
    btnImp.classList.toggle("on", ui.soImpedimento);
    btnPend.onclick = function(){ ui.soPendentes = !ui.soPendentes; renderEmpresas(); };
    btnImp.onclick = function(){ ui.soImpedimento = !ui.soImpedimento; renderEmpresas(); };
    var btnSemAna = $("#btnSemAnalista");
    btnSemAna.classList.toggle("on", ui.soSemAnalista);
    btnSemAna.onclick = function(){ ui.soSemAnalista = !ui.soSemAnalista; renderEmpresas(); };
    var btnSemCont = $("#btnSemContato");
    btnSemCont.classList.toggle("on", ui.soSemContato);
    btnSemCont.onclick = function(){ ui.soSemContato = !ui.soSemContato; renderEmpresas(); };
    var btnConc = $("#btnSoConcluidas");
    btnConc.classList.toggle("on", ui.soConcluidas);
    btnConc.onclick = function(){ ui.soConcluidas = !ui.soConcluidas; renderEmpresas(); };

    var chipAnalista = $("#filtroAnalistaChip");
    if(ui.filtroAnalista){
      chipAnalista.hidden = false;
      chipAnalista.innerHTML = 'Analista: '+esc(ui.filtroAnalista)+' <button type="button" title="Remover filtro">✕</button>';
      chipAnalista.querySelector("button").onclick = function(){ ui.filtroAnalista = null; renderEmpresas(); };
    } else {
      chipAnalista.hidden = true;
    }

    var filtrosAtivosProgresso = ui.busca || ui.filtroSetor !== "todos" || !!ui.filtroAnalista || ui.soPendentes || ui.soImpedimento || ui.soSemAnalista || ui.soSemContato || ui.soConcluidas;
    btnClear.hidden = !filtrosAtivosProgresso;
    btnClear.onclick = function(){
      ui.busca = ""; ui.filtroSetor = "todos"; ui.filtroAnalista = null; ui.soPendentes = false; ui.soImpedimento = false; ui.soSemAnalista = false; ui.soSemContato = false; ui.soConcluidas = false;
      $("#empresaSearch").value = "";
      renderEmpresas();
    };

    renderFiltrosSalvos(filtrosAtivosProgresso);
    var porEmpresa = {};
    state.setores.forEach(function(s){ (porEmpresa[s.empresaId] = porEmpresa[s.empresaId] || []).push(s); });
    var selOrdem = $("#consOrdem");
    if(selOrdem){ selOrdem.value = ui.consOrdem; selOrdem.onchange = function(){ ui.consOrdem = selOrdem.value; salvarUI(); renderEmpresas(); }; }

    var qn = normBusca(ui.busca.trim()), qd = ui.busca.replace(/\D/g, "");
    // A busca também acha a empresa pelo nome/e-mail de um contato dela ou pelo analista de uma frente.
    var achadasPorPessoa = {};
    if(qn){
      state.contatos.forEach(function(c){ if(normBusca(c.nome).indexOf(qn) !== -1 || normBusca(c.email).indexOf(qn) !== -1) achadasPorPessoa[c.empresaId] = true; });
      state.setores.forEach(function(sd){ if(normBusca(sd.analistaNome).indexOf(qn) !== -1) achadasPorPessoa[sd.empresaId] = true; });
    }
    Object.assign(achadasPorPessoa, matrizesPorBuscaFilial(qn, qd));
    var lista = state.empresas.filter(function(e){
      if(qn && normBusca(e.nome).indexOf(qn) === -1 && !(qd.length >= 3 && String(e.cnpj || "").replace(/\D/g, "").indexOf(qd) !== -1) && !achadasPorPessoa[e.id]) return false;
      if(ui.filtroSetor !== "todos" && !(e.setoresDemanda && e.setoresDemanda[ui.filtroSetor])) return false;
      var docs = porEmpresa[e.id] || [];
      if(ui.filtroAnalista && !docs.some(function(s){ return s.analistaNome === ui.filtroAnalista; })) return false;
      if(ui.soPendentes && !empresaComPendencia(e, docs)) return false;
      if(ui.soImpedimento && !empresaBloqueada(e, docs)) return false;
      if(ui.soSemAnalista && !empresaSemAnalista(e, docs)) return false;
      if(ui.soSemContato && comContatoIdx()[e.id]) return false;
      if(ui.soConcluidas && !(frentesDaEmpresa(e, docs).length && progressoEmpresa(e, docs) > 0.9999)) return false;
      return true;
    });

    // Ordem escolhida; empate sempre pelo nome.
    var chaveOrd = {};
    if(ui.consOrdem === "progresso") lista.forEach(function(e){ chaveOrd[e.id] = progressoEmpresa(e, porEmpresa[e.id] || []); });
    else if(ui.consOrdem === "impedimento") lista.forEach(function(e){ chaveOrd[e.id] = empresaBloqueada(e, porEmpresa[e.id] || []) ? 0 : 1; });
    else if(ui.consOrdem === "semAnalista") lista.forEach(function(e){ chaveOrd[e.id] = empresaSemAnalista(e, porEmpresa[e.id] || []) ? 0 : 1; });
    lista.sort(function(a, b){ return ((chaveOrd[a.id] || 0) - (chaveOrd[b.id] || 0)) || COLLATOR(String(a.nome || ""), String(b.nome || "")); });
    // Trocou filtro, busca ou ordem: volta a mostrar só as primeiras 50.
    var sig = [ui.busca, ui.filtroSetor, ui.filtroAnalista, ui.soPendentes, ui.soImpedimento, ui.soSemAnalista, ui.soSemContato, ui.soConcluidas, ui.consOrdem].join("|");
    if(sig !== ui.consSig){ ui.consSig = sig; ui.consLimite = 50; }

    $("#progressoCount").textContent = lista.length+" de "+state.empresas.length;
    ui.ultimaLista = lista.map(function(e){ return e.id; });
    salvarUI();
    renderBulkBar();

    var secAberta = grupoAberto("secao:empresas", filtrosAtivosProgresso);
    // Aberta por uma busca/filtro, continua aberta ao limpar a busca (só recolhe ao sair da aba ou clicando na barra).
    if(secAberta && filtrosAtivosProgresso) ui.expandedGroups.add("secao:empresas");
    var secBtn = $("#btnEmpresasToggle");
    secBtn.setAttribute("data-auto", filtrosAtivosProgresso ? "1" : "0");
    secBtn.classList.toggle("open", secAberta);
    secBtn.setAttribute("aria-expanded", secAberta);
    $("#empresasGwrap").classList.toggle("open", secAberta);

    // "Por etapa": a mesma lista (já filtrada acima) vista pela etapa escolhida, uma linha por frente.
    var porEtapa = ui.consModo === "etapa";
    $$("#consModoFiltros button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-modo") === ui.consModo); });
    cont.hidden = porEtapa;
    $("#empresasGwrap .thead").hidden = porEtapa;
    $("#consEtapaBar").hidden = !porEtapa;
    $("#consEtapaList").hidden = !porEtapa;
    if(porEtapa){
      $("#bulkBar").hidden = true;
      if(!state.empresas.length && carregando()){ $("#consEtapaList").innerHTML = '<div class="empty">Carregando empresas…</div>'; return; }
      CTX_ETAPA.cons.lista = lista;
      renderPorEtapa(CTX_ETAPA.cons);
      return;
    }
    ui.consEtapaMantidas.clear(); ui.consEtapaSelecionadas.clear();

    if(!state.empresas.length && carregando()){ cont.innerHTML = '<div class="empty">Carregando empresas…</div>'; return; }
    if(!state.empresas.length){ cont.innerHTML = '<div class="empty">Nenhuma empresa cadastrada. Use o botão <strong>+ Cadastrar</strong>.</div>'; return; }
    if(!lista.length){ cont.innerHTML = '<div class="empty">Nenhuma empresa com esse filtro.</div>'; return; }

    // Mostra 50 por vez; uma empresa aberta por um atalho (busca, Foco, Hoje) sempre entra na página.
    var limite = ui.consLimite || 50;
    lista.forEach(function(e, i){ if(ui.expanded.has(e.id) && i >= limite) limite = i + 1; });
    var resta = lista.length - limite;
    cont.innerHTML = lista.slice(0, limite).map(function(e){
      var docs = porEmpresa[e.id] || [];
      return renderEmpresaRow(e, docs);
    }).join("") + (resta > 0
      ? '<div class="cons-mais"><span>Mostrando '+limite+' de '+lista.length+'</span><button type="button" class="fbtn" data-action="cons-mais">Mostrar mais '+Math.min(resta, 50)+'</button></div>'
      : '');

    $$(".cell[data-tip]", cont).forEach(function(c){ tipOn(c, c.getAttribute("data-tip")); });
  }

  var CHAVE_FILTROS = "ct-filtros-consulta";
  function lerFiltrosSalvos(){ try{ var l = JSON.parse(localStorage.getItem(CHAVE_FILTROS) || "[]"); return Array.isArray(l) ? l : []; }catch(e){ return []; } }
  function gravarFiltrosSalvos(l){ try{ localStorage.setItem(CHAVE_FILTROS, JSON.stringify(l)); }catch(e){} }
  var CAMPOS_FILTRO = ["busca","filtroSetor","filtroAnalista","soPendentes","soImpedimento","soSemAnalista","soSemContato","soConcluidas","consOrdem"];
  function descricaoFiltro(){
    var p = [];
    if(ui.filtroSetor !== "todos") p.push(SETOR_LABEL[ui.filtroSetor]);
    if(ui.filtroAnalista) p.push(ui.filtroAnalista);
    if(ui.soPendentes) p.push("com pendências");
    if(ui.soImpedimento) p.push("com impedimento");
    if(ui.soSemAnalista) p.push("sem analista");
    if(ui.soSemContato) p.push("sem contato");
    if(ui.soConcluidas) p.push("100% concluídas");
    if(ui.busca) p.push("“" + ui.busca + "”");
    return p.join(" · ") || "Filtro";
  }
  function renderFiltrosSalvos(ativos){
    var box = $("#filtrosSalvos"), btn = $("#btnSalvarFiltro");
    if(!box || !btn) return;
    var l = lerFiltrosSalvos();
    btn.hidden = !ativos || ui.salvandoFiltro;
    btn.onclick = function(){ ui.salvandoFiltro = true; renderEmpresas(); requestAnimationFrame(function(){ var i = $("#filtroNomeNovo"); if(i){ i.focus(); i.select(); } }); };
    var html = l.map(function(x, i){
      return '<span class="fs-chip"><button type="button" class="fs-aplicar" data-action="filtro-aplicar" data-i="'+i+'">'+esc(x.nome)+'</button><button type="button" class="fs-x" data-action="filtro-apagar" data-i="'+i+'" aria-label="Apagar o filtro '+esc(x.nome)+'">✕</button></span>';
    }).join("");
    if(ui.salvandoFiltro) html += '<form class="fs-form" id="formSalvarFiltro"><input type="text" id="filtroNomeNovo" maxlength="40" value="'+esc(descricaoFiltro())+'" aria-label="Nome do filtro"><button type="submit" class="fbtn">Salvar</button><button type="button" class="linkish" data-action="filtro-cancelar">Cancelar</button></form>';
    box.hidden = !html;
    box.innerHTML = html ? '<span class="fs-lbl">Filtros salvos</span>' + html : '';
    var form = $("#formSalvarFiltro");
    if(form) form.onsubmit = function(ev){
      ev.preventDefault();
      var nome = $("#filtroNomeNovo").value.trim() || descricaoFiltro();
      var f = {}; CAMPOS_FILTRO.forEach(function(k){ f[k] = ui[k]; });
      var lista = lerFiltrosSalvos(); lista.push({nome:nome, f:f}); gravarFiltrosSalvos(lista);
      ui.salvandoFiltro = false; renderEmpresas();
      mostrarToast("Filtro “"+nome+"” salvo neste navegador.");
    };
  }
  function renderBulkBar(){
    var ids = {};
    state.empresas.forEach(function(e){ ids[e.id] = true; });
    ui.selecionadas.forEach(function(id){ if(!ids[id]) ui.selecionadas.delete(id); });
    var n = ui.selecionadas.size;
    $("#bulkBar").hidden = !n;
    $("#empresasList").classList.toggle("selecionando", n > 0);
    if(!n) return;
    $("#bulkCount").textContent = n + " empresa" + (n === 1 ? "" : "s") + " selecionada" + (n === 1 ? "" : "s");
    var visiveis = ui.ultimaLista.length;
    $("#bulkTodas").textContent = "Selecionar as " + visiveis + " da lista";
    $("#bulkTodas").hidden = ui.ultimaLista.every(function(id){ return ui.selecionadas.has(id); });
    var optsFunc = '<option value="">Escolha…</option>' + state.funcionarios.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).map(function(f){ return '<option value="'+f.id+'">'+esc(f.nome)+'</option>'; }).join("");
    var selFunc = $("#bulkAnalista");
    if(selFunc.innerHTML !== optsFunc){ var curSel = selFunc.value; selFunc.innerHTML = optsFunc; if(Array.prototype.some.call(selFunc.options, function(o){ return o.value === curSel; })) selFunc.value = curSel; }
  }
  function aplicarAnalistaEmLote(){
    var selId = $("#bulkAnalista").value;
    if(!selId){ $("#bulkAnalista").focus(); mostrarToast("Escolha o analista."); return; }
    var func = state.funcionarios.find(function(f){ return f.id === selId; });
    if(!func) return;
    var setorSel = $("#bulkSetor").value, soVazio = $("#bulkSoVazio").checked;
    var porEmp = {};
    state.setores.forEach(function(sd){ (porEmp[sd.empresaId] = porEmp[sd.empresaId] || []).push(sd); });
    var alvos = [], empresas = 0;
    state.empresas.filter(function(e){ return ui.selecionadas.has(e.id); }).forEach(function(e){
      var fs = frentesDaEmpresa(e, porEmp[e.id] || []).filter(function(f){
        var r = resolverAnalista(f);
        return (setorSel === "todos" || f.setor === setorSel) && (!soVazio || !r.id) && r.id !== selId;
      });
      if(fs.length) empresas++;
      fs.forEach(function(f){ alvos.push({empresa:e, frente:f}); });
    });
    if(!alvos.length){ mostrarToast("Nenhuma frente para alterar com essas opções."); return; }
    confirmar('Definir “'+func.nome+'” como analista em '+alvos.length+' frente'+(alvos.length === 1 ? '' : 's')+' de '+empresas+' empresa'+(empresas === 1 ? '' : 's')+'?', function(){
      alvos.forEach(function(a){
        if(!a.frente.semRegistro){ a.frente.analistaId = selId; a.frente.analistaNome = func.nome; }
        garantirSetorDoc(a.empresa.id, a.frente.setor).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({analistaId:selId, analistaNome:func.nome}); })
          .catch(function(){ mostrarToast("Não foi possível salvar em uma das frentes."); });
      });
      registrarAtividade({tipo:"lote", texto:'Analista “'+func.nome+'” definido em '+alvos.length+' frente(s) de '+empresas+' empresa(s)'});
      renderAll();
      mostrarToast("Analista definido em "+alvos.length+" frente"+(alvos.length === 1 ? "" : "s")+".");
    }, "Definir analista");
  }
  function adicionarAoFocoEmLote(){
    var novas = state.empresas.filter(function(e){ return ui.selecionadas.has(e.id) && !e.emFoco; });
    if(!novas.length){ mostrarToast("As empresas selecionadas já estão em foco."); return; }
    var agora = Date.now();
    novas.forEach(function(e, i){ adicionarAoFoco(e.id, new Date(agora - i).toISOString()); });
    renderAll();
    mostrarToast(novas.length+" empresa"+(novas.length === 1 ? " entrou" : "s entraram")+" no foco.", "Ver", function(){ setView("foco"); });
  }
  function trilhasEmpresaHTML(e, docs){
    var t = SETORES.filter(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key]; }).map(function(s){
      var doc = docs.find(function(x){ return x.setor === s.key; });
      return '<span class="trk"><span class="trk-tag">'+s.tag+'</span><span class="cells">'+trilha(e, doc, s.key)+'</span></span>';
    }).join("");
    var hab = habilitacaoEmpresa(e.id);
    return t ? '<span class="trk trk-hab"><span class="trk-tag">DOM</span><span class="cells"><span class="cell c-'+hab.status+'" role="img" aria-label="Habilitação no Domínio: '+STATUS_LABEL[hab.status]+'" data-tip="<b>Habilitação no Domínio</b>'+STATUS_LABEL[hab.status]+' · vale para a empresa toda"></span></span></span>' + t : '';
  }
  function renderEmpresaRow(e, docs){
    var pct = progressoEmpresa(e, docs);
    var aberto = ui.expanded.has(e.id);
    var bloqueada = empresaBloqueada(e, docs);

    var trilhas = trilhasEmpresaHTML(e, docs);

    var blocos = aberto ? SETORES.filter(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key]; }).map(function(s){
      return blocoSetor(e, s, sid(e.id, s.key), docs.find(function(x){ return x.setor === s.key; }));
    }).join("") : "";
    blocos = blocos ? habilitacaoLinhaHTML(e, "p") + '<div class="sblocks">' + blocos + '</div>' : blocos;
    if(aberto && !blocos) blocos = '<p class="note">Marque acima os setores com demanda para iniciar o acompanhamento.</p>';

    var motivoImp = bloqueada ? impedimentoDaEmpresa(e, docs) : "";
    var empBloqueio = motivoImp ? '<button class="flagbadge" data-action="ir-impedimentos" title="'+esc(motivoImp)+'"><i></i>'+esc(cortar(motivoImp, 70))+'</button>' : '';
    var analistas = [];
    frentesDaEmpresa(e, docs).forEach(function(f){ var n = String(resolverAnalista(f).nome || "").trim(); if(n && analistas.indexOf(n) === -1) analistas.push(n); });
    var sub = [];
    if(e.cnpj) sub.push('<span class="esub-cnpj">CNPJ '+esc(e.cnpj)+'</span>');
    if(analistas.length) sub.push('<span class="eana sepa" title="Analistas: '+esc(analistas.join(", "))+'">'+esc(analistas.map(function(n){ return n.split(" ")[0]; }).join(", "))+'</span>');

    var semDemanda = !SETORES.some(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key]; });
    var editando = ui.editEmpresa.has(e.id) || semDemanda;
    var selec = ui.selecionadas.has(e.id);
    return '<div class="erow'+(aberto?" open":"")+(selec?" sel":"")+'" data-id="'+e.id+'">' +
      '<div class="erow-main" data-action="toggle">' +
        CHEV +
        '<span class="ecol-name"><input type="checkbox" class="sel-emp" data-action="sel-empresa" data-id="'+e.id+'"'+(selec?" checked":"")+' aria-label="Selecionar '+esc(e.nome)+'" title="Selecionar para ações em lote"><button class="focostar'+(e.emFoco?" on":"")+'" data-action="toggle-foco" data-id="'+e.id+'" title="'+(e.emFoco?"Remover do foco":"Adicionar ao foco")+'">★</button><span class="ecol-txt"><span class="ename">'+esc(e.nome)+seloFiliais(e)+'</span>'+(sub.length?'<span class="esub">'+sub.join('')+'</span>':'')+(motivoImp?'<span class="eimp" title="'+esc(motivoImp)+'">'+esc(cortar(motivoImp, 80))+'</span>':'')+'</span></span>' +
        '<span class="erow-tracks">'+trilhas+'</span>' +
        '<span class="epct"><span class="epct-bar"><i style="width:'+Math.round(pct*100)+'%"></i></span><b>'+Math.round(pct*100)+'%</b></span>' +
      '</div>' +
      '<div class="edetail-wrap"><div class="edetail">' + (aberto ? '<div class="edetail-in">' +
        '<div class="eacoes">' + empBloqueio +
          '<span class="eacoes-dir">' +
          (e.emFoco
            ? '<button type="button" class="linkish" data-action="abrir-foco-empresa" data-id="'+e.id+'">Abrir no Foco</button>'
            : '<button type="button" class="linkish" data-action="toggle-foco" data-id="'+e.id+'">★ Levar ao Foco</button>') +
          '<button type="button" class="linkish" data-action="imp-form-abrir" data-id="'+e.id+'">Registrar impedimento</button>' +
          '<button type="button" class="linkish" data-action="editar-empresa" data-id="'+e.id+'" aria-expanded="'+(editando?"true":"false")+'">'+(editando ? "Fechar cadastro" : "Editar cadastro")+'</button>' +
          '</span>' +
        '</div>' +
        (ui.impFormEmp === e.id ? formImpedimentoEmpresaHTML(e) : '') +
        (editando ? '<div class="eedit">' +
          '<div class="metaline">' +
            '<label>Nome <input type="text" class="ee-nome" id="een-'+e.id+'" value="'+esc(e.nome)+'"><span class="fsave" id="fs-een-'+e.id+'"></span></label>' +
            '<label>CNPJ <input type="text" class="ee-cnpj" id="eec-'+e.id+'" value="'+esc(e.cnpj||"")+'"><span class="fsave" id="fs-eec-'+e.id+'"></span></label>' +
          '</div>' +
          '<div class="metaline">' +
            '<label><input type="checkbox" class="ee-folha" '+(e.folhaAtiva?"checked":"")+'> Tem folha ativa</label>' +
            '<label><input type="checkbox" class="ee-ativo" '+(e.ativo!==false?"checked":"")+'> Empresa ativa</label>' +
          '</div>' +
          '<div class="metaline">' +
            '<span class="eedit-lbl">Setores com demanda</span>' +
            SETORES.map(function(s){
              return '<label><input type="checkbox" class="ee-setor" data-setor="'+s.key+'" '+((e.setoresDemanda&&e.setoresDemanda[s.key])?"checked":"")+'> '+s.label+'</label>';
            }).join("") +
          '</div>' +
          filiaisEditHTML(e) +
          '<div><button class="linkish red" data-action="excluir-empresa">Excluir esta empresa e todo o progresso</button></div>' +
        '</div>' : '') +
        blocos +
      '</div>' : '') + '</div></div>' +
    '</div>';
  }

  // Filiais da empresa (no cadastro): lista, vincular outra empresa como filial e sugestão pelo CNPJ.
  function filiaisEditHTML(e){
    var fs = filiaisDe(e.id), r = raizCnpj(e.cnpj);
    var mesmaRaiz = function(x){ return !!r && raizCnpj(x.cnpj) === r; };
    var lista = fs.map(function(f){
      return '<li><span class="fil-nome">'+esc(f.nome)+'</span>'+(f.cnpj ? '<span class="fil-cnpj">'+esc(f.cnpj)+'</span>' : '')+'<button type="button" class="linkish" data-action="desvincular-filial" data-id="'+f.id+'">desvincular</button></li>';
    }).join("");
    var cand = state.empresas.filter(function(x){ return x.id !== e.id && !filiaisDe(x.id).length; })
      .sort(function(a, b){ return (mesmaRaiz(b) ? 1 : 0) - (mesmaRaiz(a) ? 1 : 0) || COLLATOR(String(a.nome || ""), String(b.nome || "")); });
    var opts = cand.map(function(x){ return '<option value="'+x.id+'">'+esc(x.nome)+(x.cnpj ? ' · '+esc(x.cnpj) : '')+(mesmaRaiz(x) ? ' (mesma raiz de CNPJ)' : '')+'</option>'; }).join("");
    var sug = "";
    if(!fs.length && r && !ehCnpjMatriz(e.cnpj)){
      var mz = state.empresas.find(function(x){ return x.id !== e.id && mesmaRaiz(x) && ehCnpjMatriz(x.cnpj); });
      if(mz) sug = '<p class="fil-sug">Pelo CNPJ, esta empresa parece filial de <b>'+esc(mz.nome)+'</b>. <button type="button" class="linkish" data-action="vincular-como-filial" data-filial="'+e.id+'" data-matriz="'+mz.id+'">Vincular como filial</button></p>';
    }
    return '<div class="efiliais"><span class="eedit-lbl">Filiais'+(fs.length ? ' ('+fs.length+')' : '')+'</span>' +
      (lista ? '<ul class="fil-lista">'+lista+'</ul>' : '<span class="note">Nenhuma filial vinculada.</span>') +
      '<div class="fil-add"><select class="fil-sel" aria-label="Empresa que é filial desta"><option value="">Escolha a empresa que é filial…</option>'+opts+'</select><button type="button" class="fbtn" data-action="vincular-filial" data-matriz="'+e.id+'">Vincular filial</button></div>' + sug +
      '<p class="note">Ao vincular, os contatos, as frentes e as etapas da filial passam para esta empresa (fica o status mais adiantado de cada etapa) e o grupo conta como uma empresa só.</p></div>';
  }
  function confirmarVinculo(f, m){
    confirmar('Vincular “'+f.nome+'” como filial de “'+m.nome+'”? Os contatos, as frentes e as etapas dela passam para a matriz (fica o status mais adiantado de cada etapa) e ela sai das listas e contagens. Desvincular depois não traz esses dados de volta; se tiver dúvida, baixe o backup antes.', function(){ vincularFilial(f.id, m.id); }, "Vincular");
  }

  // Habilitação no Domínio: uma linha só, acima dos setores (vale para a empresa toda).
  function habilitacaoLinhaHTML(e, pre){
    var h = habilitacaoEmpresa(e.id);
    var attrs = 'data-empresa="'+e.id+'" data-setor="" data-etapa="habilitacaoDominio"';
    return '<div class="ehab">' +
      '<span class="ehab-nome">Habilitação no Domínio<span class="note">vale para a empresa toda</span></span>' +
      seletorEtapa(pre+"hab-"+e.id, h.status, e.id, "", "habilitacaoDominio", "Habilitação no Domínio") +
      (h.status === "concluido" ? campoConclusao(pre+"habcd-"+e.id, attrs, h.data) : '') +
    '</div>';
  }

  /* ---------- foco: cartões de trabalho ---------- */
  var focoCache = {};
  var rascunhos = {};

  function htmlParaEl(html){ var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function docsDaEmpresa(id){ return setoresDocsDe(id).slice(); }
  function valorRascunho(k, fallback){ return rascunhos[k] !== undefined ? rascunhos[k] : fallback; }
  function dataBR(d){ return d ? d.split("-").reverse().join("/") : ""; }

  var AGUARDANDO = {cliente:"cliente", analista:"analista", escritorio:"escritório", outro:"outro"};
  // Texto do "aguardando": as opções fixas ou o que foi digitado em "Outro".
  function textoAguardando(e){
    if(!e || !AGUARDANDO[e.focoAguardando]) return "";
    if(e.focoAguardando === "outro") return String(e.focoAguardandoOutro || "").trim() || "outro";
    return AGUARDANDO[e.focoAguardando];
  }
  function seloAguardando(e){
    var t = textoAguardando(e);
    return t ? '<span class="fa-agu agu-'+e.focoAguardando+'" title="Aguardando '+esc(t)+'">aguardando '+esc(t)+'</span>' : '';
  }
  function diasEmFoco(e){
    var d = e && e.emFocoEm ? new Date(e.emFocoEm) : null;
    if(!d || isNaN(d.getTime())) return null;
    var h = new Date(); h.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((h - d) / 864e5));
  }
  function prazoFocoVencido(e){ return !!(e && e.focoPrazo) && e.focoPrazo < hojeISO(); }
  function textoDiasFoco(n){ return n === 0 ? "em foco desde hoje" : "em foco há " + n + " dia" + (n === 1 ? "" : "s"); }

  // Último movimento registrado da empresa (qualquer alteração no painel) ou a entrada no foco.
  var COLLATOR = (typeof Intl !== "undefined" && Intl.Collator) ? new Intl.Collator("pt-BR").compare : function(a, b){ return a < b ? -1 : a > b ? 1 : 0; };
  var memoMov = {ref:null, n:-1, mapa:{}};
  function ultimoMovimento(e){
    if(memoMov.ref !== state.historico || memoMov.n !== state.historico.length){
      var m = {};
      state.historico.forEach(function(d){ (d.eventos || []).forEach(function(ev){ if(ev.empresaId && ev.em && (!m[ev.empresaId] || ev.em > m[ev.empresaId])) m[ev.empresaId] = ev.em; }); });
      memoMov = {ref:state.historico, n:state.historico.length, mapa:m};
    }
    var a = memoMov.mapa[e.id] || "", b = e.emFocoEm || "";
    return a > b ? a : b;
  }
  function diasParada(e){
    var u = ultimoMovimento(e);
    var d = u ? new Date(u) : null;
    if(!d || isNaN(d.getTime())) return null;
    var h = new Date(); h.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((h - d) / 864e5));
  }
  function listaFoco(){
    var l = state.empresas.filter(function(e){ return e.emFoco; });
    var recentes = function(a, b){
      var ta = a.emFocoEm || "", tb = b.emFocoEm || "";
      if(ta !== tb) return ta < tb ? 1 : -1;
      return a.nome.localeCompare(b.nome);
    };
    var ord = ui.focoOrdem;
    if(ord === "parada") return l.sort(function(a, b){ return ((diasParada(b) || 0) - (diasParada(a) || 0)) || recentes(a, b); });
    if(ord === "prazo") return l.sort(function(a, b){ var pa = a.focoPrazo || "9999", pb = b.focoPrazo || "9999"; return pa < pb ? -1 : pa > pb ? 1 : recentes(a, b); });
    if(ord === "progresso" || ord === "impedimento"){
      var chave = {};
      l.forEach(function(e){ var docs = docsDaEmpresa(e.id); chave[e.id] = ord === "progresso" ? progressoEmpresa(e, docs) : (empresaBloqueada(e, docs) ? 0 : 1); });
      return l.sort(function(a, b){ return (chave[a.id] - chave[b.id]) || recentes(a, b); });
    }
    return l.sort(recentes);
  }

  // Pesquisa dentro da aba Foco: nome/CNPJ da empresa, próxima ação, analista e contatos de cliente.
  // Não altera listaFoco(), que Hoje e o resumo usam com todas as empresas em foco.
  function termoBuscaFoco(){ return normBusca(ui.focoBusca || "").trim(); }
  var memoBuscaFoco = {};
  function buscaFocoEmpresa(e){
    var q = termoBuscaFoco();
    if(!q) return null;
    var m = memoBuscaFoco;
    if(m.q !== q || m.c !== state.contatos || m.e !== state.empresas || m.s !== state.setores || m.f !== state.funcionarios)
      m = memoBuscaFoco = {q:q, c:state.contatos, e:state.empresas, s:state.setores, f:state.funcionarios, res:{}};
    if(m.res[e.id]) return m.res[e.id];
    var qd = q.replace(/\D/g, "");
    var achouEmpresa = normBusca(e.nome).indexOf(q) !== -1 || normBusca(e.focoProxAcao).indexOf(q) !== -1 ||
      (qd.length >= 3 && String(e.cnpj || "").replace(/\D/g, "").indexOf(qd) !== -1);
    var achouAnalista = docsDaEmpresa(e.id).some(function(s){ return normBusca(resolverAnalista(s).nome).indexOf(q) !== -1; });
    var contatos = {}, nContatos = 0;
    state.contatos.forEach(function(c){
      if(c.empresaId === e.id && (normBusca(c.nome).indexOf(q) !== -1 || normBusca(c.email).indexOf(q) !== -1)){ contatos[c.id] = true; nContatos++; }
    });
    return m.res[e.id] = {ok:achouEmpresa || achouAnalista || nContatos > 0, contatos:contatos, nContatos:nContatos};
  }
  function listaFocoVisivel(){
    var l = listaFoco();
    return termoBuscaFoco() ? l.filter(function(e){ return buscaFocoEmpresa(e).ok; }) : l;
  }
  // Quem foi encontrado pelo nome de um contato abre o cartão e a lista de contatos daquele setor.
  function abrirResultadosBuscaFoco(){
    if(!termoBuscaFoco()) return;
    listaFocoVisivel().forEach(function(e){
      var r = buscaFocoEmpresa(e);
      if(!r.nContatos) return;
      ui.focoAbertas.add(e.id);
      SETORES.forEach(function(s){
        if(contatosDoSetor(e.id, s.key).some(function(c){ return r.contatos[c.id]; })) ui.expandedEtapas.add(sid(e.id, s.key)+"::treinamentoCliente");
      });
    });
  }

  // O alinhamento com o gestor vale para o setor todo, não para a empresa: fica fora das etapas
  // do cartão (aparece como selo no cabeçalho do setor e é editado em Consulta).
  function itensFocoSetor(e, setorKey, doc){
    var itens = [];
    ETAPAS.forEach(function(et){
      if(et.porEmpresa) return;
      if(et.onlyIf && !et.onlyIf(e, setorKey)) return;
      if(et.key === "treinamentoCliente"){
        var comp = statusClienteComputado(e.id, setorKey);
        var edc = (doc && doc.etapas && doc.etapas[et.key]) || {};
        itens.push({tipo:"etapa", key:et.key, label:et.label, status:comp.status, data:"", obs:edc.obs||"", agendadoPara:comp.agendadoPara, agendadoHora:comp.agendadoHora, total:comp.total, feitos:comp.feitos});
      } else if(et.key === "cadastroUsuario"){
        var cad = statusCadastroComputado(e.id, setorKey);
        var edu = (doc && doc.etapas && doc.etapas[et.key]) || {};
        itens.push({tipo:"etapa", key:et.key, label:et.label, status:cad.status, data:cad.data, obs:edu.obs||"", agendadoPara:"", agendadoHora:"", total:cad.total, feitos:cad.feitos});
      } else {
        var ed = (doc && doc.etapas && doc.etapas[et.key]) || {};
        var inf = etapaInfo(doc, et.key);
        itens.push({tipo:"etapa", key:et.key, label:et.label, status:inf.status, data:inf.data, obs:ed.obs||"", agendadoPara:inf.agendadoPara, agendadoHora:inf.agendadoHora, func:inf.func});
      }
    });
    return itens;
  }

  function resumoEmpresaFoco(e, docs){
    var setores = SETORES.filter(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key]; }).map(function(s){
      var doc = docs.find(function(x){ return x.setor === s.key; });
      var itens = itensFocoSetor(e, s.key, doc);
      var etapasIt = itens.filter(function(i){ return i.tipo === "etapa"; });
      var done = etapasIt.filter(function(i){ return i.status === "concluido"; }).length;
      var prox = itens.find(function(i){ return i.status !== "concluido"; }) || null;
      return {setor:s, doc:doc, docId:sid(e.id, s.key), itens:itens, done:done, total:etapasIt.length, prox:prox};
    });
    var total = 0, done = 0, prox = null, hab = null;
    if(setores.length){
      var h = habilitacaoEmpresa(e.id);
      hab = {tipo:"etapa", key:"habilitacaoDominio", label:"Habilitação no Domínio", status:h.status, data:h.data, obs:h.obs, agendadoPara:"", agendadoHora:""};
      total = 1; done = h.status === "concluido" ? 1 : 0;
      if(!done) prox = {item:hab, setor:null};
    }
    setores.forEach(function(x){
      total += x.total; done += x.done;
      if(!prox && x.prox) prox = {item:x.prox, setor:x.setor};
    });
    return {setores:setores, hab:hab, total:total, done:done, prox:prox, pct:progressoEmpresa(e, docs), completa: total > 0 && done === total};
  }

  function contatoFocoHTML(c, prefixo, hit, semEmail){
    var cst = STATUS_LABEL[c.statusTreinamento] ? c.statusTreinamento : "pendente";
    return '<div class="ftc-item'+(hit ? ' hit' : '')+'" data-contato-id="'+c.id+'">' +
      '<div class="ftc-who"><button type="button" class="contact-name-link" data-action="ir-contato" data-id="'+c.id+'" title="Ver cadastro deste contato">'+esc(c.nome)+'</button>'+seloMesmaPessoa(c)+(semEmail ? '' : '<span>'+esc(c.email||"e-mail não informado")+'</span>')+'</div>' +
      '<div class="ftc-ctl">' +
        '<select id="csel-'+prefixo+c.id+'" class="psel st-'+cst+'" data-action="cont-status" data-id="'+c.id+'" aria-label="Treinamento de '+esc(c.nome)+'">' + STATUS_CLIENTE.map(function(st){ return '<option value="'+st+'"'+(cst===st?" selected":"")+'>'+STATUS_LABEL[st]+'</option>'; }).join("") + '</select>' +
        (cst === "agendado" ? campoDataContato(c, prefixo) : '') +
      '</div>' +
    '</div>';
  }
  function cadastroSelectHTML(c, setorKey, prefixo){
    var ativo = cadastroAtivoNoSetor(c, setorKey), auto = cadastroInferido(c, setorKey);
    return '<select id="ccad-'+prefixo+c.id+'" class="psel st-'+(ativo ? "concluido" : "pendente")+'" data-action="cont-cadastro" data-id="'+c.id+'" data-setor="'+setorKey+'"'+(auto ? ' disabled' : '')+' title="'+(auto ? "Ativo porque o contato já foi treinado" : "Cadastro de usuário no Onvio")+'" aria-label="Cadastro no Onvio de '+esc(c.nome)+'">' +
      '<option value="pendente"'+(ativo ? '' : ' selected')+'>Sem cadastro</option><option value="ativo"'+(ativo ? ' selected' : '')+'>Cadastro ativo</option></select>';
  }
  function contatoCadastroFocoHTML(c, setorKey, prefixo, hit, semEmail){
    return '<div class="ftc-item'+(hit ? ' hit' : '')+'" data-contato-id="'+c.id+'">' +
      '<div class="ftc-who"><button type="button" class="contact-name-link" data-action="ir-contato" data-id="'+c.id+'" title="Ver cadastro deste contato">'+esc(c.nome)+'</button>'+seloMesmaPessoa(c)+(semEmail ? '' : '<span>'+esc(c.email||"e-mail não informado")+'</span>')+'</div>' +
      '<div class="ftc-ctl">'+cadastroSelectHTML(c, setorKey, prefixo)+'</div>' +
    '</div>';
  }
  var ICO_NOTA = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h6l3 3v8h-9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.8 8.2h4.4M5.8 10.8h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  // Uma linha por etapa, com o status já clicável. Observações (e, no treinamento dos clientes,
  // a lista de contatos) ficam atrás de um botão, para o cartão não crescer à toa.
  function renderFocoItem(e, x, it, proxima){
    var key = x.docId+"::"+it.key;
    var open = ui.expandedEtapas.has(key);
    var isCli = it.key === "treinamentoCliente", isCad = it.key === "cadastroUsuario", isCalc = isCli || isCad;
    var attrs = 'data-empresa="'+e.id+'" data-setor="'+x.setor.key+'" data-etapa="'+it.key+'"';
    var ctl = isCalc
      ? '<span class="fchip st-'+it.status+'">'+(isCad ? STATUS_LABEL[it.status] : rotuloStatus(it.status, it.agendadoPara, it.agendadoHora))+'</span>'
      : seletorEtapa("fst-"+x.docId+"-"+it.key, it.status, e.id, x.setor.key, it.key, it.label) +
        (it.status === "concluido" ? campoConclusao("fcd-"+x.docId+"-"+it.key, attrs, it.data) : '') +
        (it.status === "agendado" ? campoDataAgendada("fag-"+x.docId+"-"+it.key, "ag-data", attrs, it.agendadoPara, it.agendadoHora) +
          (etapaAgendamentoAtrasado(it.agendadoPara) ? '<span class="atrasado" title="A data do treinamento já passou e a etapa continua como Agendada">Atrasado</span>' : '') : '');
    var obs = valorRascunho("obs:"+x.docId+":"+it.key, it.obs);
    var toggleAttrs = 'data-action="foco-etapa" data-key="'+esc(key)+'" data-empresa="'+e.id+'" aria-expanded="'+open+'"';
    var btn = isCalc
      ? (it.total
        ? '<button type="button" class="fitem-btn" '+toggleAttrs+' title="Ver e editar os contatos deste setor">'+(isCad ? 'Usuários' : 'Contatos')+' · '+it.feitos+'/'+it.total+CHEV+'</button>'
        : '<button type="button" class="linkish fitem-novo ftc-add" data-action="foco-contato-novo" data-key="'+esc(key)+'" data-docid="'+x.docId+'" data-empresa="'+e.id+'">+ Cadastrar contato</button>')
      : '<button type="button" class="fitem-nota'+(obs ? ' tem' : '')+'" '+toggleAttrs+' title="'+(obs ? esc(obs) : 'Anotar algo sobre esta etapa')+'" aria-label="Observações de '+esc(it.label)+'">'+ICO_NOTA+'</button>';
    var oid = "fobs-"+x.docId+"-"+it.key;
    var extra = '<label class="ffield"><span class="ffield-top">Observações<span class="fsave" id="fs-'+oid+'"></span></span>' +
      '<input type="text" id="'+oid+'" class="fobs" data-docid="'+x.docId+'" '+attrs+' value="'+esc(obs)+'" placeholder="Anote algo sobre esta etapa…"></label>';
    if(isCalc){
      var contatosSetor = contatosDoSetor(e.id, x.setor.key);
      var achados = (buscaFocoEmpresa(e) || {contatos:{}}).contatos;
      var listaContatos = contatosSetor.length
        ? '<div class="ftc-list">'+contatosSetor.map(function(c){ return isCad ? contatoCadastroFocoHTML(c, x.setor.key, "fcad-", !!achados[c.id]) : contatoFocoHTML(c, "fcag-", !!achados[c.id]); }).join("")+'</div>'
        : '<span class="fnote">Nenhum contato de cliente cadastrado para este setor.</span>';
      var formContato = ui.focoContatoForm === x.docId
        ? '<form class="ftc-form" data-action="foco-contato-submit" data-docid="'+x.docId+'" data-empresa="'+e.id+'" data-setor="'+x.setor.key+'">' +
            '<input type="text" class="ftc-nome" list="pessoasDatalist" autocomplete="off" placeholder="Nome do contato" required>' +
            '<input type="text" class="ftc-email" placeholder="E-mail (opcional)">' +
            '<div class="ftc-form-btns"><button type="submit" class="fbtn">Salvar contato</button><button type="button" class="fbtn" data-action="foco-contato-cancelar">Cancelar</button></div>' +
          '</form>'
        : '<button type="button" class="linkish ftc-add" data-action="foco-contato-abrir" data-docid="'+x.docId+'">+ Cadastrar contato</button>';
      extra = '<div class="ftc-wrap">'+listaContatos+formContato+'</div>' + extra;
    }
    // No item de "Treinamento dos clientes" a linha inteira abre/fecha (não só o botão Contatos),
    // já que o controle ali é só um selo, sem nada para clicar sem querer.
    return '<div class="fitem'+(open?" open":"")+(proxima?" proxima":"")+'" data-key="'+esc(key)+'">' +
      '<div class="fitem-row'+(isCalc ? ' fitem-row-toggle' : '')+'"'+(isCalc ? ' '+toggleAttrs : '')+'>' +
        '<span class="fitem-nome"><span class="fitem-rot"'+(it.func ? ' title="Treinamento de '+esc(it.func.nome)+' (cadastro em Equipe): mudar aqui vale para todas as empresas dele(a)"' : '')+'>'+esc(it.label)+'</span>'+(proxima ? '<span class="fprox">Próxima</span>' : '')+'</span>' +
        '<span class="fitem-ctl">'+ctl+'</span>' + btn +
      '</div>' +
      '<div class="fitem-extra">'+extra+'</div>' +
    '</div>';
  }

  function renderFocoSetor(e, x, proxItem){
    var d = x.doc || {};
    var bloq = d.impedimento && d.impedimento.ativo;
    var anaId = "fana-"+x.docId;
    return '<div class="fsetor" style="--sc:var(--sector-'+x.setor.key+')">' +
      '<div class="fsetor-head">' +
        '<span class="fsetor-tag">'+x.setor.label+'</span><span class="fsetor-count">'+x.done+'/'+x.total+'</span>' +
        (bloq ? '<button class="flagbadge" data-action="ir-impedimentos" title="'+esc(d.impedimento.descricao || "")+'"><i></i>Impedimento</button>' : '') +
      '</div>' +
      '<div class="fsetor-people">' +
        '<label class="fsetor-ana"><span class="ffield-top">Analista<span class="fsave" id="fs-'+anaId+'"></span></span>' +
          selectAnalistaHTML(d, x.docId, e.id, x.setor.key, anaId) + '</label>' +
      '</div>' +
      '<div class="fitens">'+x.itens.map(function(it){ return renderFocoItem(e, x, it, it === proxItem); }).join("")+'</div>' +
    '</div>';
  }

  function impedimentoDaEmpresa(e, docs){
    if(e.impedimento && e.impedimento.ativo) return e.impedimento.descricao || "Impedimento na empresa";
    var s = docs.find(function(x){ return x.impedimento && x.impedimento.ativo; });
    return s ? (SETOR_LABEL[s.setor] || s.setor) + ": " + (s.impedimento.descricao || "impedimento") : "";
  }

  // O que falta no cadastro da empresa em foco: analista ou contato de cliente em algum setor com demanda.
  function faltasCadastroFoco(e, docs){
    var semAna = [], semCont = [];
    frentesDaEmpresa(e, docs).forEach(function(f){
      var rot = SETOR_LABEL[f.setor] || f.setor;
      if(!String(f.analistaNome || "").trim()) semAna.push(rot);
      if(!contatosDoSetor(e.id, f.setor).length) semCont.push(rot);
    });
    var linhas = [];
    if(semAna.length) linhas.push("Sem analista: " + semAna.join(", "));
    if(semCont.length) linhas.push("Sem contato de cliente: " + semCont.join(", "));
    var rotulo = semAna.length && semCont.length ? "Falta analista e contato" : semAna.length ? "Falta analista" : semCont.length ? "Falta contato de cliente" : "";
    return {tem:!!linhas.length, rotulo:rotulo, detalhe:linhas.join(" · ")};
  }
  function renderFocoCard(e, docs){
    var r = resumoEmpresaFoco(e, docs);
    var falta = faltasCadastroFoco(e, docs);
    var recolhida = !ui.focoAbertas.has(e.id);
    var pct = Math.round(r.pct * 100);
    var dias = diasEmFoco(e);
    var sub = [];
    if(e.cnpj) sub.push('<span class="mono">'+esc(e.cnpj)+'</span>');
    if(dias !== null) sub.push('<span>'+textoDiasFoco(dias)+'</span>');
    var parada = diasParada(e);
    if(parada !== null && parada >= 7 && !r.completa) sub.push('<span class="fparada'+(parada >= 14 ? ' forte' : '')+'" title="Nenhuma alteração registrada nesta empresa desde então">parada há '+parada+' dias</span>');
    if(r.completa) sub.push('<span class="fok">Todas as etapas concluídas</span>');
    else if(r.prox) sub.push('<span class="prox">Próxima etapa: <b>'+esc(r.prox.item.label)+'</b>'+(r.prox.setor ? ' · '+r.prox.setor.label : '')+'</span>');
    var acao = "";
    if(e.focoProxAcao || e.focoPrazo || e.focoAguardando){
      var venc = prazoFocoVencido(e);
      acao = '<div class="fcard-acao'+(venc ? ' vencido' : '')+'">' +
        '<span><b>Próxima ação:</b> '+esc(e.focoProxAcao || "sem descrição")+'</span>' +
        (e.focoPrazo ? '<span class="fa-prazo">'+(venc ? 'venceu ' : 'até ')+dataCurta(e.focoPrazo)+'</span>' : '') +
        seloAguardando(e) +
      '</div>';
    }
    var imp = impedimentoDaEmpresa(e, docs);
    var agOpts = '<option value="">Ninguém</option>' + Object.keys(AGUARDANDO).map(function(k){ var rot = k === "outro" ? "Outro (digitar)…" : AGUARDANDO[k].charAt(0).toUpperCase()+AGUARDANDO[k].slice(1); return '<option value="'+k+'"'+(e.focoAguardando === k ? ' selected' : '')+'>'+rot+'</option>'; }).join("");
    var aguCls = AGUARDANDO[e.focoAguardando] ? ' agu-'+e.focoAguardando : '';
    var temAcao = !!(e.focoProxAcao || e.focoPrazo || e.focoAguardando) || ui.focoAcaoAberta.has(e.id);
    var editor = !temAcao ? '<div class="fpa-vazia"><button type="button" class="linkish" data-action="foco-acao-abrir" data-id="'+e.id+'">+ Próxima ação</button></div>' : '<div class="fpa">' +
      '<label class="fpa-campo fpa-texto-l"><span class="ffield-top">Próxima ação<span class="fsave" id="fs-fpa-'+e.id+'"></span></span>' +
        '<input type="text" id="fpa-'+e.id+'" class="fpa-texto" data-id="'+e.id+'" value="'+esc(valorRascunho("pa:"+e.id, e.focoProxAcao || ""))+'" placeholder="Ex.: cobrar o certificado digital do cliente"></label>' +
      '<label class="fpa-campo"><span class="ffield-top">Até</span><input type="date" id="fpz-'+e.id+'" class="ag-input foco-prazo'+(e.focoPrazo ? '' : ' vazio')+'" data-id="'+e.id+'" value="'+esc(e.focoPrazo || "")+'"></label>' +
      '<label class="fpa-campo"><span class="ffield-top">Aguardando</span><select id="fag-emp-'+e.id+'" class="foco-aguardando'+aguCls+'" data-id="'+e.id+'">'+agOpts+'</select></label>' +
      (e.focoAguardando === "outro" ? '<label class="fpa-campo fpa-agu-outro"><span class="ffield-top">Aguardando o quê/quem?<span class="fsave" id="fs-fago-'+e.id+'"></span></span><input type="text" id="fago-'+e.id+'" class="fpa-agu-texto" data-id="'+e.id+'" maxlength="60" value="'+esc(valorRascunho("pao:"+e.id, e.focoAguardandoOutro || ""))+'" placeholder="Ex.: contador anterior"></label>' : '') +
      ((e.focoProxAcao || e.focoPrazo || e.focoAguardando) ? '<button type="button" class="fbtn" data-action="foco-acao-feita" data-id="'+e.id+'" title="Limpa a próxima ação, o prazo e o aguardando">✓ Ação feita</button>' : '') +
    '</div>';
    var xHab = {docId:"emp-"+e.id, setor:{key:"", label:""}};
    // Recolhido, o corpo do cartão nem é montado: só o cabeçalho (bem mais leve com muitas empresas).
    var corpo = recolhida ? '' : editor + (ui.impFormEmp === e.id ? formImpedimentoEmpresaHTML(e) : '') + (r.hab ? '<div class="fhab">'+renderFocoItem(e, xHab, r.hab, r.prox && r.prox.item === r.hab)+'</div>' : '') + (r.setores.length
      ? '<div class="fsetores">'+r.setores.map(function(x){ return renderFocoSetor(e, x, r.prox && r.prox.item); }).join("")+'</div>'
      : '<p class="fnote" style="padding-top:12px;">Nenhum setor com demanda marcado ainda.</p>');
    var setoresFaltando = SETORES.filter(function(s){ return !(e.setoresDemanda && e.setoresDemanda[s.key]); });
    if(setoresFaltando.length && !recolhida){
      corpo += '<div class="fadd-setor">' +
        '<span class="fas-lbl">Adicionar setor</span>' +
        setoresFaltando.map(function(s){
          return '<button type="button" class="fas-btn" data-action="foco-add-setor" data-id="'+e.id+'" data-setor="'+s.key+'" style="--sc:var(--sector-'+s.key+')">+ '+s.label+'</button>';
        }).join("") +
      '</div>';
    }

    return '<div class="fcard'+(recolhida?" recolhida":"")+(r.completa?" completa":"")+(falta.tem?" falta":"")+'" data-id="'+e.id+'"'+(falta.tem ? ' title="'+esc(falta.detalhe)+'"' : '')+'>' +
      '<div class="fcard-head">' +
        '<button type="button" class="fcard-toggle" data-action="foco-recolher" data-id="'+e.id+'" title="Recolher ou expandir">'+CHEV+'</button>' +
        '<div class="fcard-title" data-action="foco-recolher" data-id="'+e.id+'">' +
          '<div class="fcard-name">'+esc(e.nome)+(falta.tem ? '<span class="ffalta" title="'+esc(falta.detalhe)+'">'+falta.rotulo+'</span>' : '')+(imp ? '<button type="button" class="flagbadge" data-action="ir-impedimentos" title="'+esc(imp)+'"><i></i>'+esc(cortar(imp, 48))+'</button>' : '')+'</div>' +
          '<div class="fcard-sub">'+sub.join('<span class="sep">·</span>')+'</div>' +
          acao +
          (recolhida ? '<div class="fcard-trilha erow-tracks">'+trilhasEmpresaHTML(e, docs).replace(/ data-tip="<b>([^<]*)<\/b>([^"]*)"/g, ' title="$1: $2"')+'</div>' : '') +
        '</div>' +
        '<div class="fcard-prog" title="'+r.done+' de '+r.total+' etapas concluídas">' +
          '<div class="fprog-track"><div class="fprog-fill" style="width:'+pct+'%"></div></div>' +
          '<span class="fprog-num">'+pct+'%</span>' +
        '</div>' +
        '<div class="fcard-actions">' +
          '<button type="button" class="linkish" data-action="ir-empresa" data-id="'+e.id+'">Cadastro</button>' +
          '<button type="button" class="linkish" data-action="imp-form-abrir" data-id="'+e.id+'">Impedimento</button>' +
          '<button type="button" class="fbtn fcard-x" data-action="foco-remover" data-id="'+e.id+'">'+(r.completa?"✓ Tirar do foco":"Tirar do foco")+'</button>' +
        '</div>' +
      '</div>' +
      '<div class="fcard-bodywrap"><div class="fcard-body"><div class="fcard-in">'+corpo+'</div></div></div>' +
    '</div>';
  }

  function atualizarCacheFoco(id){
    var e = state.empresas.find(function(x){ return x.id === id; });
    if(e) focoCache[id] = renderFocoCard(e, docsDaEmpresa(id));
  }

  function renderResumoFoco(lista, porEmpresa){
    var total = 0, done = 0, completas = 0, idsFoco = {};
    lista.forEach(function(e){
      var r = resumoEmpresaFoco(e, porEmpresa[e.id] || []);
      total += r.total; done += r.done; if(r.completa) completas++;
      idsFoco[e.id] = true;
    });
    var atrasadosFoco = state.contatos.filter(function(c){ return idsFoco[c.empresaId] && agendamentoAtrasado(c); }).length;
    var vencidas = lista.filter(prazoFocoVencido).length;
    $("#focoCount").textContent = lista.length ? lista.length+" em foco" : "";
    var box = $("#focoResumo");
    if(!lista.length){ box.innerHTML = ""; return; }
    box.innerHTML =
      '<span><b>'+lista.length+'</b> empresa'+(lista.length===1?'':'s')+' em foco</span>' +
      '<span><b>'+done+'/'+total+'</b> etapas concluídas</span>' +
      (atrasadosFoco ? '<span class="alerta" title="Contatos marcados como Agendado com data que já passou"><b>'+atrasadosFoco+'</b> treinamento'+(atrasadosFoco===1?'':'s')+' atrasado'+(atrasadosFoco===1?'':'s')+'</span>' : '') +
      (completas ? '<span class="ok"><b>'+completas+'</b> pronta'+(completas===1?'':'s')+' para sair · <button type="button" class="linkish" data-action="foco-limpar-concluidas">tirar concluídas</button></span>' : '') +
      (lista.length >= 15 ? '<span class="alerta" title="Com muitas empresas em foco fica difícil ver qual está parada">Foco grande ('+lista.length+'): <button type="button" class="linkish" data-action="foco-ver-paradas">ver as paradas primeiro</button></span>' : '') +
      (vencidas ? '<span class="alerta" title="Empresas em foco com a próxima ação vencida"><b>'+vencidas+'</b> ação'+(vencidas===1?'':'ões')+' vencida'+(vencidas===1?'':'s')+'</span>' : '') +
      '<span class="foco-resumo-acoes">' +
        '<label class="fet-campo" id="focoOrdemWrap"'+(ui.focoModo === "etapa" ? ' hidden' : '')+'>Ordenar <select id="focoOrdem">' +
          [["recentes","Adicionadas por último"],["parada","Paradas há mais tempo"],["prazo","Prazo mais próximo"],["progresso","Menos progresso"],["impedimento","Com impedimento primeiro"]].map(function(o){ return '<option value="'+o[0]+'"'+(ui.focoOrdem === o[0] ? ' selected' : '')+'>'+o[1]+'</option>'; }).join("") +
        '</select></label>' +
        (ui.focoModo === "etapa"
          ? '<button type="button" class="fbtn" data-action="foco-expandir-todas">Expandir tudo</button><button type="button" class="fbtn" data-action="foco-recolher-todas">Recolher tudo</button>'
          : !lista.some(function(e){ return ui.focoAbertas.has(e.id); })
          ? '<button type="button" class="fbtn" data-action="foco-expandir-todas">Expandir tudo</button>'
          : '<button type="button" class="fbtn" data-action="foco-recolher-todas">Recolher tudo</button>') +
      '</span>';
  }

  function renderFoco(){
    var cont = $("#focoList");
    var porEmpresa = {};
    state.setores.forEach(function(s){ (porEmpresa[s.empresaId] = porEmpresa[s.empresaId] || []).push(s); });
    var todasFoco = listaFoco();
    renderResumoFoco(todasFoco, porEmpresa);
    var lista = listaFocoVisivel();
    renderContagemBuscaFoco(lista.length, todasFoco.length);

    if(todasFoco.length && !lista.length){
      cont.innerHTML = '<div class="foco-empty"><strong>Nada encontrado para “'+esc(ui.focoBusca.trim())+'”</strong>' +
        '<p>A pesquisa olha só as empresas em foco: nome, CNPJ, próxima ação, analista e contatos. Para trazer outra empresa ao foco, use o campo de adicionar acima.</p>' +
        '<p><button type="button" class="linkish" data-action="foco-busca-limpar">Limpar pesquisa</button></p></div>';
      focoCache = {};
      return;
    }
    if(!lista.length && carregando()){ cont.innerHTML = '<div class="foco-empty"><strong>Carregando…</strong></div>'; focoCache = {}; return; }
    if(!lista.length && !cont.querySelector(".fcard.saindo")){
      cont.innerHTML = '<div class="foco-empty"><div class="fe-ico">★</div><strong>Nenhuma empresa em foco</strong>' +
        '<p>Busque pelo nome ou CNPJ no campo acima (atalho <kbd>/</kbd>) ou clique na estrela de uma empresa em Consulta.</p></div>';
      focoCache = {};
      return;
    }
    var vazio = cont.querySelector(".foco-empty"); if(vazio) vazio.remove();

    var ids = {};
    lista.forEach(function(e){ ids[e.id] = true; });
    $$(".fcard", cont).forEach(function(el){
      var id = el.getAttribute("data-id");
      if(!ids[id] && !el.classList.contains("saindo")){ el.remove(); delete focoCache[id]; }
    });

    var anterior = null;
    lista.forEach(function(e){
      var el = cont.querySelector('.fcard[data-id="'+CSS.escape(e.id)+'"]');
      if(el && el.classList.contains("saindo")){ anterior = el; return; }
      var html = renderFocoCard(e, porEmpresa[e.id] || []);
      if(!el){
        el = htmlParaEl(html);
        if(ui.focoRecemAdicionada === e.id){ el.classList.add("chegando"); ui.focoRecemAdicionada = null; }
        focoCache[e.id] = html;
      } else if(focoCache[e.id] !== html){
        var novo = htmlParaEl(html);
        el.replaceWith(novo);
        el = novo;
        focoCache[e.id] = html;
      }
      var alvo = anterior ? anterior.nextElementSibling : cont.firstElementChild;
      if(alvo !== el) cont.insertBefore(el, alvo);
      anterior = el;
    });
  }

  /* ---------- foco: ver e marcar a mesma etapa em várias empresas ---------- */
  $$("#focoModoFiltros button").forEach(function(b){
    b.addEventListener("click", function(){
      ui.focoModo = b.getAttribute("data-modo");
      atualizarModoFoco();
    });
  });

  function atualizarModoFoco(){
    salvarUI();
    $$("#focoModoFiltros button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-modo") === ui.focoModo); });
    var etapa = ui.focoModo === "etapa";
    $("#focoList").hidden = etapa;
    $("#focoEtapaList").hidden = !etapa;
    $("#focoEtapaFiltros").hidden = !etapa;
    $("#focoEtapaStatusFiltros").hidden = !etapa;
    $("#focoEtapaToolbar").hidden = !etapa;
    var ordWrap = $("#focoOrdemWrap"); if(ordWrap) ordWrap.hidden = etapa;
    if(!etapa){ ui.focoEtapaMantidas.clear(); ui.focoEtapaSelecionadas.clear(); return; }
    renderFocoPorEtapa();
  }

  function renderContagemBuscaFoco(n, total){
    var el = $("#focoBuscaN");
    if(el) el.textContent = termoBuscaFoco() ? n + " de " + total : "";
  }
  // A busca do topo do Foco também filtra os cartões (empresa, próxima ação, analista, contato).
  var tBuscaFoco = null;
  function aplicarBuscaFoco(valor){
    clearTimeout(tBuscaFoco);
    tBuscaFoco = setTimeout(function(){
      if(valor === ui.focoBusca) return;
      ui.focoBusca = valor;
      ui.focoEtapaMantidas.clear(); ui.focoEtapaSelecionadas.clear();
      abrirResultadosBuscaFoco();
      renderFocoAtivo();
    }, 120);
  }
  function limparBuscaFoco(){
    clearTimeout(tBuscaFoco);
    ui.focoBusca = "";
    var input = $("#focoAddSearch"); if(input) input.value = "";
    ui.focoEtapaMantidas.clear(); ui.focoEtapaSelecionadas.clear();
    renderFocoAtivo();
  }

  function renderFocoAtivo(){
    renderFoco();
    if(ui.focoModo === "etapa") renderFocoPorEtapa();
  }
  function irParaFocoEmpresa(id){
    ui.focoModo = "empresa";
    ui.focoAbertas.forEach(function(o){ if(o !== id) marcarRecolhida(o, true); });
    ui.focoAbertas.add(id);
    atualizarModoFoco();
    requestAnimationFrame(function(){
      var el = document.querySelector('#focoList .fcard[data-id="'+CSS.escape(id)+'"]');
      if(el){ el.scrollIntoView({behavior:"smooth", block:"center"}); flash(el); }
    });
  }

  var ORDEM_ST_FOCO = {pendente:0, agendado:1, andamento:2, concluido:3};
  // "Por etapa" existe em dois lugares: Foco (só as empresas em foco) e Consulta (a carteira inteira,
  // já passada pelos filtros de Consulta). O estado de cada um fica em ui[p + "Sel"], ui[p + "Status"], etc.
  var CONS_ETAPA_PAGINA = 40;
  var CTX_ETAPA = {
    foco:{
      nome:"foco", p:"focoEtapa", pre:"fe",
      ids:{etapas:"focoEtapaFiltros", status:"focoEtapaStatusFiltros", toolbar:"focoEtapaToolbar", lista:"focoEtapaList", todas:"ferSelTodas", bulk:"ferBulkStatus", analista:"focoEtapaAnalista", ordem:"focoEtapaOrdem", setores:"focoEtapaSetorFiltros"},
      empresas:function(){ return listaFocoVisivel(); },
      setor:function(){ return ui.focoEtapaSetor; }, setorNaToolbar:true,
      busca:function(){ return ui.focoBusca.trim(); }, limparBusca:"foco-busca-limpar",
      semEmpresas:function(){ return !listaFoco().length; },
      vazioSemEmpresas:'<div class="foco-empty"><div class="fe-ico">★</div><strong>Nenhuma empresa em foco</strong><p>Busque pelo nome ou CNPJ no campo acima (atalho <kbd>/</kbd>) ou clique na estrela de uma empresa em Consulta.</p></div>',
      tituloAbrir:"Abrir no Foco",
      render:function(){ renderFocoPorEtapa(); },
      aposFiltro:function(){ atualizarModoFoco(); },
      abrir:function(id){ irParaFocoEmpresa(id); },
      bulkStatus:"concluido", grupos:{}, visiveis:[]
    },
    cons:{
      nome:"cons", p:"consEtapa", pre:"ce",
      ids:{etapas:"consEtapaFiltros", status:"consEtapaStatusFiltros", toolbar:"consEtapaToolbar", lista:"consEtapaList", todas:"consSelTodas", bulk:"consBulkStatus", analista:"consEtapaAnalista", ordem:"consEtapaOrdem", setores:""},
      empresas:function(){ return CTX_ETAPA.cons.lista || []; },
      setor:function(){ return ui.filtroSetor; }, setorNaToolbar:false,
      busca:function(){ return ui.busca.trim(); }, limparBusca:"",
      semEmpresas:function(){ return !(CTX_ETAPA.cons.lista || []).length; },
      vazioSemEmpresas:'<div class="empty">Nenhuma empresa com esses filtros.</div>',
      tituloAbrir:"Abrir a empresa em Consulta",
      render:function(){ renderEmpresas(); },
      aposFiltro:function(){ ui.consEtapaLimite = CONS_ETAPA_PAGINA; renderEmpresas(); },
      abrir:function(id){ ui.consModo = "empresa"; salvarUI(); irParaEmpresa(id); },
      paginar:true, bulkStatus:"concluido", grupos:{}, visiveis:[], lista:[]
    }
  };
  function ctxEtapaDe(el){ return CTX_ETAPA[(el && el.getAttribute("data-ctx")) || "foco"] || CTX_ETAPA.foco; }
  function ev_(cx, k){ return ui[cx.p + k]; }
  // Ao trocar qualquer filtro, a seleção e as linhas "alterado agora" se referiam ao recorte anterior.
  function mudarFiltroEtapa(cx, fn){
    fn();
    ev_(cx, "Mantidas").clear();
    ev_(cx, "Selecionadas").clear();
    cx.aposFiltro();
  }
  function mudarFiltroFocoEtapa(fn){ mudarFiltroEtapa(CTX_ETAPA.foco, fn); }

  // Uma entrada por frente (empresa × setor) onde a etapa se aplica, já no recorte de setor.
  function itensEtapa(cx, etapaKey){
    var et = ETAPAS.find(function(x){ return x.key === etapaKey; });
    var isCli = etapaKey === "treinamentoCliente", isCad = etapaKey === "cadastroUsuario";
    var setorSel = cx.setor();
    var porEmpresa = {};
    state.setores.forEach(function(s){ (porEmpresa[s.empresaId] = porEmpresa[s.empresaId] || []).push(s); });
    var out = [];
    cx.empresas().forEach(function(e){
      var docs = porEmpresa[e.id] || [];
      if(et.porEmpresa){
        // Uma linha por empresa (sem setor); o filtro de setor só limita às empresas com demanda nele.
        var comDemanda = SETORES.filter(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key] && (setorSel === "todos" || s.key === setorSel); });
        if(!comDemanda.length) return;
        var anas = comDemanda.map(function(s){ return resolverAnalista(docs.find(function(x){ return x.setor === s.key; })); });
        var h = habilitacaoEmpresa(e.id);
        out.push({e:e, s:null, doc:null, docId:"emp-"+e.id, ana:anas[0], anas:anas, comp:null, contatos:[], atrasados:[],
          st:h.status, data:h.data, func:null, agendadoPara:"", agendadoHora:""});
        return;
      }
      SETORES.forEach(function(s){
        if(!(e.setoresDemanda && e.setoresDemanda[s.key])) return;
        if(et.onlyIf && !et.onlyIf(e, s.key)) return;
        if(setorSel !== "todos" && s.key !== setorSel) return;
        var doc = docs.find(function(x){ return x.setor === s.key; });
        var comp = isCli ? statusClienteComputado(e.id, s.key) : isCad ? statusCadastroComputado(e.id, s.key) : null;
        var contatos = isCli || isCad ? contatosDoSetor(e.id, s.key) : [];
        var ed2 = isCli || isCad ? {} : etapaInfo(doc, etapaKey);
        out.push({
          e:e, s:s, doc:doc, docId:sid(e.id, s.key), ana:resolverAnalista(doc), comp:comp,
          contatos:contatos, atrasados:isCli ? contatos.filter(agendamentoAtrasado) : [],
          st: isCli || isCad ? comp.status : statusDe(doc, etapaKey, e.id, s.key),
          data: isCli || isCad ? "" : (ed2.data || ""), func: isCli || isCad ? null : ed2.func,
          agendadoPara: isCli || isCad ? "" : (ed2.agendadoPara || ""), agendadoHora: isCli || isCad ? "" : (ed2.agendadoHora || "")
        });
      });
    });
    return out;
  }
  function itensFocoEtapa(etapaKey){ return itensEtapa(CTX_ETAPA.foco, etapaKey); }
  function passaAnalistaEtapa(cx, it){
    var f = ev_(cx, "Analista");
    if(!f) return true;
    return (it.anas || [it.ana]).some(function(a){
      return f === "__sem__" ? !a.id && !String(a.nome || "").trim() : a.id === f;
    });
  }
  function passaAnalistaFoco(it){ return passaAnalistaEtapa(CTX_ETAPA.foco, it); }
  function pintarSeMudou(el, html){
    if(el._ultimoHtml === html) return;
    el.innerHTML = html; el._ultimoHtml = html;
  }

  function renderFocoPorEtapa(){ renderPorEtapa(CTX_ETAPA.foco); }
  function renderPorEtapa(cx){
    var P = cx.p, dc = ' data-ctx="' + cx.nome + '"';
    var cont = $("#" + cx.ids.lista);
    if(ui[P+"Analista"] && ui[P+"Analista"] !== "__sem__" && !state.funcionarios.some(function(f){ return f.id === ui[P+"Analista"]; })) ui[P+"Analista"] = "";
    var etapaSel = ETAPAS.find(function(et){ return et.key === ui[P+"Sel"]; }) || ETAPAS[0];
    ui[P+"Sel"] = etapaSel.key;
    var isCli = etapaSel.key === "treinamentoCliente", isAna = etapaSel.key === "treinamentoAnalista", isCad = etapaSel.key === "cadastroUsuario", isCalc = isCli || isCad;
    var soAtrasados = isCli && ui[P+"Atrasados"];
    var ordem = ordemStatus(etapaSel.key);
    if(ui[P+"Status"] !== "todos" && ordem.indexOf(ui[P+"Status"]) === -1) ui[P+"Status"] = "todos";
    var setorSel = cx.setor();

    var todos = itensEtapa(cx, etapaSel.key);
    var passaAna = function(it){ return passaAnalistaEtapa(cx, it); };
    var noEscopo = function(it){ return passaAna(it) && (!soAtrasados || it.atrasados.length > 0); };
    var passaStatus = function(it){ return ui[P+"Status"] === "todos" || it.st === ui[P+"Status"]; };
    var escopo = todos.filter(noEscopo);
    var nSt = function(st){ return escopo.filter(function(it){ return it.st === st; }).length; };

    pintarSeMudou($("#" + cx.ids.etapas), ETAPAS.map(function(et){
      var abertas = (et.key === etapaSel.key ? todos : itensEtapa(cx, et.key)).filter(function(it){ return passaAna(it) && it.st !== "concluido"; }).length;
      return '<button type="button" data-action="foco-etapa-sel"'+dc+' data-etapa="'+et.key+'" class="'+(etapaSel.key === et.key ? "on" : "")+'" title="'+abertas+' frente'+(abertas === 1 ? '' : 's')+' ainda não concluída'+(abertas === 1 ? '' : 's')+'">'+et.label+'<span class="chip-n">'+abertas+'</span></button>';
    }).join(""));
    pintarSeMudou($("#" + cx.ids.status),
      '<button type="button" data-action="foco-etapa-status"'+dc+' data-st="todos" class="'+(ui[P+"Status"] === "todos" ? "on" : "")+'">Todos<span class="chip-n">'+escopo.length+'</span></button>' +
      ordem.map(function(st){ return '<button type="button" data-action="foco-etapa-status"'+dc+' data-st="'+st+'" class="'+(ui[P+"Status"] === st ? "on" : "")+'">'+STATUS_LABEL[st]+'<span class="chip-n">'+nSt(st)+'</span></button>'; }).join(""));

    var feitas = nSt("concluido"), pct = escopo.length ? Math.round(feitas / escopo.length * 100) : 0;
    var nAtr = todos.filter(function(it){ return passaAna(it) && it.atrasados.length > 0; }).length;
    var funcs = state.funcionarios.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    var opt = function(v, rot, atual){ return '<option value="'+esc(v)+'"'+(v === atual ? " selected" : "")+'>'+esc(rot)+'</option>'; };
    var nFiltros = (cx.setorNaToolbar && setorSel !== "todos" ? 1 : 0) + (ui[P+"Analista"] ? 1 : 0) + (ui[P+"Ordem"] !== "empresa" ? 1 : 0) + (soAtrasados ? 1 : 0);
    var filtrosAbertos = !!ui[P+"FiltrosAbertos"];
    pintarSeMudou($("#" + cx.ids.toolbar),
      '<div class="fet-top">' +
        '<button type="button" class="fbtn fet-filtros-btn'+(nFiltros ? ' ativo' : '')+'" data-action="foco-etapa-filtros"'+dc+' aria-expanded="'+filtrosAbertos+'">'+(filtrosAbertos ? 'Esconder filtros' : 'Filtros')+(nFiltros ? '<span class="chip-n">'+nFiltros+'</span>' : '')+'</button>' +
        '<div class="fet-prog">' +
          '<span class="fet-prog-lbl"><b>'+esc(etapaSel.label)+'</b>: '+feitas+' de '+escopo.length+(etapaSel.porEmpresa ? ' empresa' : ' frente')+(escopo.length === 1 ? '' : 's')+' concluída'+(escopo.length === 1 ? '' : 's')+'</span>' +
          '<div class="fprog-track"><div class="fprog-fill" style="width:'+pct+'%"></div></div>' +
          '<span class="fprog-num">'+pct+'%</span>' +
        '</div>' +
      '</div>' +
      (filtrosAbertos ? '<div class="fet-row">' +
        (cx.setorNaToolbar ? '<div class="filters" id="'+cx.ids.setores+'">' + [{key:"todos", label:"Todos os setores"}].concat(SETORES).map(function(s){
          return '<button type="button" data-action="foco-etapa-setor"'+dc+' data-setor="'+s.key+'" class="'+(setorSel === s.key ? "on" : "")+'">'+s.label+'</button>';
        }).join("") + '</div>' : '') +
        '<label class="fet-campo">Analista <select id="'+cx.ids.analista+'" class="fet-analista"'+dc+'>' + opt("", "Todos", ui[P+"Analista"]) + opt("__sem__", "Sem analista", ui[P+"Analista"]) +
          funcs.map(function(f){ return opt(f.id, f.nome, ui[P+"Analista"]); }).join("") + '</select></label>' +
        '<label class="fet-campo">Ordenar <select id="'+cx.ids.ordem+'" class="fet-ordem"'+dc+'>' + opt("empresa", "Por empresa", ui[P+"Ordem"]) + opt("pendentes", "Pendentes primeiro", ui[P+"Ordem"]) + opt("analista", "Agrupar por analista", ui[P+"Ordem"]) + '</select></label>' +
        (isCli ? '<button type="button" class="toggle-chip'+(ui[P+"Atrasados"] ? " on" : "")+'" data-action="foco-etapa-atrasados"'+dc+' title="Frentes com algum contato agendado para uma data que já passou">Só agendamentos atrasados<span class="chip-n">'+nAtr+'</span></button>' : '') +
      '</div>' : ''));

    if(cx.semEmpresas()){ cont.innerHTML = cx.vazioSemEmpresas; return; }

    // Uma linha alterada aqui continua visível (esmaecida) mesmo que deixe de bater com os filtros,
    // até a pessoa trocar o filtro ou sair da tela — senão ela sumiria no clique.
    var visiveis = todos.filter(function(it){ return ui[P+"Mantidas"].has(it.docId) || (noEscopo(it) && passaStatus(it)); });
    var idsVis = {};
    visiveis.forEach(function(it){ idsVis[it.docId] = true; });
    ui[P+"Selecionadas"].forEach(function(id){ if(!idsVis[id]) ui[P+"Selecionadas"].delete(id); });

    if(!visiveis.length){
      var filtrando = ui[P+"Status"] !== "todos" || (cx.setorNaToolbar && setorSel !== "todos") || !!ui[P+"Analista"] || soAtrasados;
      var buscando = !!cx.busca();
      cont.innerHTML = '<div class="empty">Nenhuma frente '+(buscando ? 'para a pesquisa “'+esc(cx.busca())+'”'+(filtrando ? ' com esses filtros' : '') : 'com esses filtros')+' em “'+esc(etapaSel.label)+'”.' +
        (buscando && cx.limparBusca ? ' <button type="button" class="linkish" data-action="'+cx.limparBusca+'">Limpar pesquisa</button>' : '') +
        (filtrando ? ' <button type="button" class="linkish" data-action="foco-etapa-limpar"'+dc+'>Limpar filtros</button>' : '') + '</div>';
      return;
    }

    var grupos, plana = !!etapaSel.porEmpresa && ui[P+"Ordem"] !== "analista";
    if(plana){
      grupos = [];
      if(ui[P+"Ordem"] === "pendentes") visiveis.sort(function(a, b){ return ORDEM_ST_FOCO[a.st] - ORDEM_ST_FOCO[b.st]; });
    } else if(ui[P+"Ordem"] === "analista"){
      var porAna = {};
      visiveis.forEach(function(it){
        var nome = String(it.ana.nome || "").trim();
        var k = it.ana.id || (nome ? "nome:"+nome : "__sem__");
        if(!porAna[k]) porAna[k] = {chave:k, titulo:nome || "Sem analista", itens:[]};
        porAna[k].itens.push(it);
      });
      grupos = Object.keys(porAna).map(function(k){ return porAna[k]; }).sort(function(a, b){
        if(a.chave === "__sem__") return 1;
        if(b.chave === "__sem__") return -1;
        return a.titulo.localeCompare(b.titulo, "pt-BR");
      });
      grupos.forEach(function(g){ g.itens.sort(function(a, b){ return a.e.nome.localeCompare(b.e.nome, "pt-BR"); }); });
    } else {
      var porEmp = {};
      grupos = [];
      visiveis.forEach(function(it){
        if(!porEmp[it.e.id]){ porEmp[it.e.id] = {chave:it.e.id, empresa:it.e, itens:[]}; grupos.push(porEmp[it.e.id]); }
        porEmp[it.e.id].itens.push(it);
      });
      if(ui[P+"Ordem"] === "pendentes"){
        var abertas = function(g){ return g.itens.filter(function(it){ return it.st !== "concluido"; }).length; };
        grupos = grupos.map(function(g, i){ return {g:g, i:i}; }).sort(function(a, b){ return abertas(b.g) - abertas(a.g) || a.i - b.i; }).map(function(x){ return x.g; });
        grupos.forEach(function(g){ g.itens.sort(function(a, b){ return ORDEM_ST_FOCO[a.st] - ORDEM_ST_FOCO[b.st]; }); });
      }
    }

    // Só o que importa para a etapa escolhida: o analista aparece só no treinamento do analista,
    // e os contatos (sem e-mail) só no treinamento dos clientes.
    var pre = cx.pre;
    var linha = function(it, mostrarEmpresa){
      var mantida = ui[P+"Mantidas"].has(it.docId) && !(noEscopo(it) && passaStatus(it));
      var sk = it.s ? it.s.key : "";
      var attrs = 'data-empresa="'+it.e.id+'" data-setor="'+sk+'" data-etapa="'+etapaSel.key+'"';
      var controle = isCad
        ? '<span class="fchip st-'+it.st+'">'+STATUS_LABEL[it.st]+'</span><span class="note">'+it.comp.feitos+'/'+it.comp.total+' cadastrados</span>'
        : isCli
        ? '<span class="fchip st-'+it.st+'">'+rotuloStatus(it.st, it.comp.agendadoPara, it.comp.agendadoHora)+'</span><span class="note">'+it.comp.feitos+'/'+it.comp.total+' treinados</span>'
        : seletorEtapa(pre+"st-"+it.docId, it.st, it.e.id, sk, etapaSel.key, etapaSel.label) +
          (it.st === "concluido" ? campoConclusao(pre+"cd-"+it.docId+"-"+etapaSel.key, attrs, it.data) : '') +
          (it.st === "agendado" ? campoDataAgendada(pre+"ad-"+it.docId+"-"+etapaSel.key, "ag-data", attrs, it.agendadoPara, it.agendadoHora) +
            (etapaAgendamentoAtrasado(it.agendadoPara) ? '<span class="atrasado" title="A data do treinamento já passou e a etapa continua como Agendada">Atrasado</span>' : '') : '');
      var analista = isAna
        ? selectAnalistaHTML(it.doc, it.docId, it.e.id, it.s.key, pre+"ana-"+it.docId) + '<span class="fsave" id="fs-'+pre+'ana-'+it.docId+'"></span>'
        : '';
      var contatosVer = soAtrasados ? it.atrasados : it.contatos;
      var contatosLinha = isCalc
        ? '<div class="fer-contatos">' + (contatosVer.map(function(c){ return isCad ? contatoCadastroFocoHTML(c, sk, pre+"cad-", false, true) : contatoFocoHTML(c, pre+"cag-", false, true); }).join("") || '<span class="fnote">Nenhum contato de cliente cadastrado para este setor.</span>') + '</div>'
        : '';
      return '<div class="fer-row'+(mantida ? " fer-mantida" : "")+'"'+dc+' data-docid="'+it.docId+'"'+(it.s ? ' style="--sc:var(--sector-'+sk+')"' : '')+'>' +
        (isCalc ? '' : '<input type="checkbox" class="fer-sel"'+dc+' data-docid="'+it.docId+'" aria-label="Selecionar '+esc(it.e.nome)+(it.s ? ' · '+it.s.label : '')+'"'+(ui[P+"Selecionadas"].has(it.docId) ? " checked" : "")+'>') +
        (it.s ? '<span class="fsetor-tag">'+it.s.tag+'</span>' : '') +
        (mostrarEmpresa ? '<button type="button" class="fer-emp-nome fer-emp-link" data-action="foco-etapa-abrir"'+dc+' data-id="'+it.e.id+'" title="'+esc(cx.tituloAbrir)+'">'+esc(it.e.nome)+'</button>' : '') +
        analista + controle +
        (mantida ? '<span class="fer-agora" title="Fica aqui até você trocar o filtro">alterado agora</span>' : '') +
        contatosLinha +
      '</div>';
    };
    // Grupos (empresa ou analista) recolhíveis; a seleção em lote funciona mesmo com o grupo fechado.
    cx.grupos = {};
    cx.visiveis = isCalc ? [] : visiveis.map(function(it){ return it.docId; });
    grupos.forEach(function(g){ if(!isCalc) cx.grupos[(g.empresa ? "emp:" : "ana:") + g.chave] = g.itens.map(function(it){ return it.docId; }); });
    var totalGrupos = plana ? visiveis.length : grupos.length, limite = cx.paginar ? (ui[P+"Limite"] || CONS_ETAPA_PAGINA) : totalGrupos;
    var html = plana ? '<div class="fer-empresa fer-tabela">' + visiveis.slice(0, limite).map(function(it){ return linha(it, true); }).join("") + '</div>' : grupos.slice(0, limite).map(function(g){
      var gk = (g.empresa ? "emp:" : "ana:") + g.chave;
      var ids = cx.grupos[gk] || [];
      var recolhido = ui[P+"Recolhidas"].has(gk);
      var nome = g.empresa ? g.empresa.nome : g.titulo;
      var nSelG = ids.filter(function(id){ return ui[P+"Selecionadas"].has(id); }).length;
      var feitasG = g.itens.filter(function(it){ return it.st === "concluido"; }).length;
      var head = g.empresa
        ? '<button type="button" class="fer-emp-nome" data-action="foco-etapa-abrir"'+dc+' data-id="'+g.empresa.id+'" title="'+esc(cx.tituloAbrir)+'">'+esc(g.empresa.nome)+'</button>'
        : '<strong>'+esc(g.titulo)+'</strong>';
      var resumo = '<span class="fer-resumo">'+(g.itens.length > 1 ? feitasG+' de '+g.itens.length+' concluídas' : (recolhido ? STATUS_LABEL[g.itens[0].st] : '')) +
        (nSelG ? (g.itens.length > 1 || recolhido ? ' · ' : '') + '<b>'+nSelG+' selecionada'+(nSelG === 1 ? '' : 's')+'</b>' : '') + '</span>';
      return '<div class="fer-empresa'+(g.empresa ? '' : ' fer-grupo-ana')+(recolhido ? ' recolhido' : '')+'" data-grupo="'+esc(gk)+'"><div class="fer-empresa-head">' +
          '<button type="button" class="fer-toggle" data-action="fer-grupo-toggle"'+dc+' data-grupo="'+esc(gk)+'" aria-expanded="'+(recolhido ? "false" : "true")+'" aria-label="'+(recolhido ? "Expandir " : "Recolher ")+esc(nome)+'">'+CHEV+'</button>' +
          (isCalc ? '' : '<input type="checkbox" class="fer-sel-grupo"'+dc+' data-grupo="'+esc(gk)+'" aria-label="Selecionar todas as frentes de '+esc(nome)+'"'+(nSelG && nSelG === ids.length ? " checked" : "")+(nSelG && nSelG < ids.length ? ' data-parcial="1"' : '')+'>') +
          head + resumo +
        '</div>' +
        (recolhido ? '' : '<div class="fer-rows">'+g.itens.map(function(it){ return linha(it, !g.empresa); }).join("")+'</div>') +
      '</div>';
    }).join("");
    if(totalGrupos > limite){
      var resta = totalGrupos - limite;
      html += '<div class="fer-mais"><span class="note">Mostrando '+limite+' de '+totalGrupos+' '+(plana || g0ehEmpresa(grupos) ? 'empresas' : 'grupos')+'.</span><button type="button" class="linkish" data-action="cons-etapa-mais"'+dc+'>Mostrar mais '+Math.min(resta, CONS_ETAPA_PAGINA)+'</button></div>';
    }

    var nSel = ui[P+"Selecionadas"].size;
    var todasSel = visiveis.every(function(it){ return ui[P+"Selecionadas"].has(it.docId); });
    if(ordem.indexOf(cx.bulkStatus) === -1) cx.bulkStatus = "concluido";
    var unidade = etapaSel.porEmpresa ? "empresas" : "frentes";
    var bulk = isCalc ? '' :
      '<div class="fer-bulk'+(nSel ? " ativo" : "")+'">' +
        '<label class="fer-bulk-todas"><input type="checkbox" id="'+cx.ids.todas+'" class="fer-sel-todas"'+dc+(todasSel ? " checked" : "")+'> Selecionar todas ('+visiveis.length+')</label>' +
        (nSel
          ? '<span class="fer-bulk-n">'+nSel+' selecionada'+(nSel === 1 ? '' : 's')+'</span>' +
            '<label class="fet-campo">Marcar como <select id="'+cx.ids.bulk+'" class="fer-bulk-status"'+dc+'>'+ordem.map(function(st){ return opt(st, STATUS_LABEL[st], cx.bulkStatus); }).join("")+'</select></label>' +
            '<button type="button" class="fbtn" data-action="fer-bulk-aplicar"'+dc+'>Aplicar</button>' +
            '<button type="button" class="linkish" data-action="fer-bulk-limpar"'+dc+'>Limpar seleção</button>'
          : '<span class="note">'+(etapaSel.porEmpresa ? 'Marque as empresas para mudar o status de várias de uma vez.' : 'Marque as frentes (ou a empresa inteira) para mudar o status de várias de uma vez.')+'</span>') +
      '</div>';
    cont.innerHTML = bulk + html;
    $$(".fer-sel-grupo[data-parcial]", cont).forEach(function(c){ c.indeterminate = true; });
  }
  function g0ehEmpresa(grupos){ return !grupos.length || !!grupos[0].empresa; }

  function aplicarStatusEmLoteEtapa(cx, novo){
    var P = cx.p, etapaKey = ui[P+"Sel"];
    var alvos = itensEtapa(cx, etapaKey).filter(function(it){ return ui[P+"Selecionadas"].has(it.docId) && it.st !== novo; });
    if(!alvos.length){ mostrarToast("As frentes selecionadas já estão como "+STATUS_LABEL[novo]+"."); return; }
    var rot = (ETAPAS.find(function(x){ return x.key === etapaKey; }) || {}).label || etapaKey;
    var aplicar = function(){
      var antes = alvos.map(function(it){
        var ed = (it.doc && it.doc.etapas && it.doc.etapas[etapaKey]) || {};
        return {empresaId:it.e.id, setor:it.s ? it.s.key : "", docId:it.docId, st:it.st, data:it.s ? (ed.data || "") : it.data};
      });
      emLote(function(){
        alvos.forEach(function(it){
          focoSetStatus(it.e.id, it.s ? it.s.key : "", etapaKey, novo, undefined, "lote");
          ui[P+"Mantidas"].add(it.docId);
        });
      });
      ui[P+"Selecionadas"].clear();
      cx.render();
      var un = etapaKey === "habilitacaoDominio" ? " empresa" : " frente";
      mostrarToast(rot+": "+alvos.length+un+(alvos.length === 1 ? "" : "s")+" marcada"+(alvos.length === 1 ? "" : "s")+" como "+STATUS_LABEL[novo], "Desfazer", function(){
        emLote(function(){ antes.forEach(function(a){ focoSetStatus(a.empresaId, a.setor, etapaKey, a.st, a.data, "lote"); }); });
      });
    };
    if(alvos.length > 20) confirmar(rot+": marcar "+alvos.length+" frentes como "+STATUS_LABEL[novo]+"?", aplicar, "Marcar "+alvos.length);
    else aplicar();
  }
  function aplicarStatusEmLoteFoco(novo){ aplicarStatusEmLoteEtapa(CTX_ETAPA.foco, novo); }

  /* ---------- foco: ações otimistas ---------- */
  var criandoSetor = {};
  function garantirSetorDoc(empresaId, setorKey){
    var docId = sid(empresaId, setorKey);
    if(state.setores.some(function(s){ return s.id === docId; })) return Promise.resolve(docId);
    if(criandoSetor[docId]) return criandoSetor[docId];
    var emp = state.empresas.find(function(x){ return x.id === empresaId; });
    if(!emp || !dbRef) return Promise.reject(new Error("sem banco"));
    criandoSetor[docId] = ensureSetorDoc(emp, setorKey).then(function(){ return docId; });
    criandoSetor[docId].then(function(){ setTimeout(function(){ delete criandoSetor[docId]; }, 5000); }, function(){ delete criandoSetor[docId]; });
    return criandoSetor[docId];
  }

  function focoSetStatus(empresaId, setorKey, etapaKey, novo, dataRestaurada, semDesfazer){
    var e = state.empresas.find(function(x){ return x.id === empresaId; });
    if(!e) return;
    if(etapaKey === "habilitacaoDominio"){ setHabilitacaoStatus(e, novo, dataRestaurada, semDesfazer); return; }
    var docId = sid(empresaId, setorKey);
    var doc = state.setores.find(function(s){ return s.id === docId; });
    var statusAntes = statusDe(doc, etapaKey, empresaId, setorKey);
    var dataAntes = (doc && doc.etapas && doc.etapas[etapaKey] && doc.etapas[etapaKey].data) || "";
    var funcT = etapaKey === "treinamentoAnalista" ? funcAnalistaDoDoc(doc) : null;
    // Treinamento do analista herdado da pessoa: a frente pode ter um registro antigo (ex.: "agendado")
    // mesmo com a pessoa já treinada. Nesse caso grava na frente para ela ficar igual, em vez de ignorar o clique.
    var ownSt = (doc && doc.etapas && doc.etapas.treinamentoAnalista && doc.etapas.treinamentoAnalista.status) || "pendente";
    if(statusAntes === novo && !(funcT && ownSt !== novo)) return;
    if(funcT){
      // O treinamento é da pessoa: grava no cadastro dela e na frente, com um só "Desfazer" para os dois.
      var ownAntes = Object.assign({status:"pendente", data:"", agendadoPara:""}, doc.etapas && doc.etapas.treinamentoAnalista);
      var fAntes = {statusTreinamento:funcT.statusTreinamento || "pendente", concluidoEm:funcT.concluidoEm || "", agendadoPara:funcT.agendadoPara || "", agendadoHora:funcT.agendadoHora || ""};
      var ownNovo = {status:novo, data:novo === "concluido" ? new Date().toISOString().slice(0,10) : "", agendadoPara:novo === "agendado" ? (fAntes.agendadoPara || ownAntes.agendadoPara || "") : "", agendadoHora:novo === "agendado" ? (fAntes.agendadoHora || ownAntes.agendadoHora || "") : ""};
      registrarAtividade({tipo:"etapa", empresaId:empresaId, empresaNome:e.nome, setor:setorKey, item:etapaKey, de:statusAntes, para:novo});
      doc.etapas = Object.assign({}, doc.etapas, {treinamentoAnalista:Object.assign({}, doc.etapas && doc.etapas.treinamentoAnalista, ownNovo)});
      dbRef.collection("empresaSetores").doc(docId).update({etapas:{treinamentoAnalista:ownNovo}});
      if((funcT.statusTreinamento || "pendente") !== novo) definirStatusFuncionario(funcT.id, novo, ownNovo.agendadoPara, true);
      else renderAll();
      if(!semDesfazer) mostrarToast("Treinamento de "+funcT.nome+": "+STATUS_LABEL[novo], "Desfazer", function(){
        Object.assign(funcT, fAntes);
        doc.etapas = Object.assign({}, doc.etapas, {treinamentoAnalista:Object.assign({}, doc.etapas.treinamentoAnalista, ownAntes)});
        dbRef.collection("funcionarios").doc(funcT.id).update(fAntes);
        dbRef.collection("empresaSetores").doc(docId).update({etapas:{treinamentoAnalista:{status:ownAntes.status, data:ownAntes.data || "", agendadoPara:ownAntes.agendadoPara || "", agendadoHora:ownAntes.agendadoHora || ""}}});
        renderAll();
      });
      return;
    }
    registrarAtividade({tipo:"etapa", empresaId:empresaId, empresaNome:e.nome, setor:setorKey, item:etapaKey, de:statusAntes, para:novo});
    var antes = resumoEmpresaFoco(e, docsDaEmpresa(empresaId)).completa;
    var dataNova = dataRestaurada !== undefined ? dataRestaurada : (novo === "concluido" ? new Date().toISOString().slice(0,10) : "");
    var patch = {}; patch[etapaKey] = {status:novo, data:dataNova};
    if(doc){
      doc.etapas = Object.assign({}, doc.etapas);
      doc.etapas[etapaKey] = Object.assign({}, doc.etapas[etapaKey], patch[etapaKey]);
      renderAll();
    }
    garantirSetorDoc(empresaId, setorKey).then(function(id){
      return dbRef.collection("empresaSetores").doc(id).update({etapas:patch});
    }).catch(function(){ mostrarToast("Não foi possível salvar essa alteração."); });
    if(semDesfazer !== "lote" && !antes && resumoEmpresaFoco(e, docsDaEmpresa(empresaId)).completa){
      mostrarToast('“'+e.nome+'” concluiu todas as etapas', "Tirar do foco", function(){ confirmarTirarDoFoco(empresaId); });
    } else if(!semDesfazer){
      var rot = (ETAPAS.find(function(x){ return x.key === etapaKey; }) || {}).label || etapaKey;
      mostrarToast(rot+" · "+SETOR_LABEL[setorKey]+": "+STATUS_LABEL[novo], "Desfazer", function(){ focoSetStatus(empresaId, setorKey, etapaKey, statusAntes, dataAntes, true); });
    }
  }

  function setHabilitacaoStatus(e, novo, dataRestaurada, semDesfazer){
    var hAntes = habilitacaoEmpresa(e.id);
    if(hAntes.status === novo) return;
    if(hAntes.inferida){ renderAll(); mostrarToast("Habilitação no Domínio já vale como concluída: a empresa tem contato treinado."); return; }
    registrarAtividade({tipo:"etapa", empresaId:e.id, empresaNome:e.nome, setor:"", item:"habilitacaoDominio", de:hAntes.status, para:novo});
    var antes = resumoEmpresaFoco(e, docsDaEmpresa(e.id)).completa;
    var dataNova = dataRestaurada !== undefined ? dataRestaurada : (novo === "concluido" ? new Date().toISOString().slice(0,10) : "");
    salvarHabilitacao(e.id, {status:novo, data:dataNova}).catch(function(){ mostrarToast("Não foi possível salvar essa alteração."); });
    renderAll();
    if(semDesfazer !== "lote" && !antes && resumoEmpresaFoco(e, docsDaEmpresa(e.id)).completa){
      mostrarToast('“'+e.nome+'” concluiu todas as etapas', "Tirar do foco", function(){ confirmarTirarDoFoco(e.id); });
    } else if(!semDesfazer){
      mostrarToast("Habilitação no Domínio: "+STATUS_LABEL[novo], "Desfazer", function(){ setHabilitacaoStatus(e, hAntes.status, hAntes.data, true); });
    }
  }

  function focoSetAlinhamento(setor, novo, dataRestaurada, semDesfazer){
    var a = state.alinhamentoSetor.find(function(x){ return x.id === setor; });
    var antes = (a && a.status) || "pendente", dataAntes = (a && a.data) || "";
    if(antes === novo) return;
    registrarAtividade({tipo:"alinhamento", setor:setor, item:"alinhamento", de:antes, para:novo});
    var patch = {status:novo, data: dataRestaurada !== undefined ? dataRestaurada : (novo === "concluido" ? new Date().toISOString().slice(0,10) : "")};
    if(a){ Object.assign(a, patch); renderAll(); }
    if(!semDesfazer) mostrarToast("Alinhamento · "+SETOR_LABEL[setor]+": "+STATUS_LABEL[novo], "Desfazer", function(){ focoSetAlinhamento(setor, antes, dataAntes, true); });
    if(!dbRef) return;
    if(a) dbRef.collection("setorAlinhamento").doc(setor).update(patch);
    else dbRef.collection("setorAlinhamento").doc(setor).set(Object.assign({setor:setor, gestorNome:"", criadoEm:new Date().toISOString()}, patch));
  }



  function adicionarAoFoco(id, ts){
    var e = state.empresas.find(function(x){ return x.id === id; });
    if(!e || e.emFoco) return;
    e.emFoco = true;
    e.emFocoEm = ts || new Date().toISOString();
    ui.focoRecemAdicionada = id;
    ui.focoAbertas.add(id); // quem acabou de entrar no foco já abre, pronto para trabalhar
    keepFocus(renderFoco);
    if(dbRef) dbRef.collection("empresas").doc(id).update({emFoco:true, emFocoEm:e.emFocoEm});
  }

  function confirmarTirarDoFoco(id, depois){
    var e = state.empresas.find(function(x){ return x.id === id; });
    if(!e || !e.emFoco) return;
    confirmar('Tirar “'+e.nome+'” do foco? A empresa continua em Consulta, com todo o progresso salvo.', function(){
      if(depois) depois();
      tirarDoFoco(id);
    }, "Tirar do foco");
  }

  function tirarDoFoco(id, semToast){
    var e = state.empresas.find(function(x){ return x.id === id; });
    if(!e || !e.emFoco) return;
    var ts = e.emFocoEm;
    var card = document.querySelector('#focoList .fcard[data-id="'+CSS.escape(id)+'"]');
    function concluir(){
      e.emFoco = false;
      if(card && card.parentNode) card.remove();
      delete focoCache[id];
      keepFocus(renderFoco);
      if(dbRef) dbRef.collection("empresas").doc(id).update({emFoco:false});
    }
    if(!semToast) mostrarToast('“'+e.nome+'” saiu do foco', "Desfazer", function(){
      if(card && card.classList.contains("saindo") && card.parentNode){
        clearTimeout(saida);
        card.classList.remove("saindo");
        card.style.height = "";
        return;
      }
      adicionarAoFoco(id, ts);
    });
    var saida = null;
    if(card && card.offsetHeight){
      card.style.height = card.offsetHeight + "px";
      void card.offsetHeight;
      card.classList.add("saindo");
      card.style.height = "0px";
      saida = setTimeout(concluir, 260);
    } else concluir();
  }

  function marcarRecolhida(id, recolher){
    if(recolher) ui.focoAbertas.delete(id); else ui.focoAbertas.add(id);
    var card = document.querySelector('#focoList .fcard[data-id="'+CSS.escape(id)+'"]');
    atualizarCacheFoco(id);
    if(card && focoCache[id]){ var novo = htmlParaEl(focoCache[id]); card.replaceWith(novo); }
  }

  /* ---------- toast ---------- */
  // Avisos empilhados: um aviso novo não apaga o anterior (nem o "Desfazer" dele).
  var MAX_TOASTS = 2;
  function mostrarToast(msg, acaoLabel, acaoFn){
    var box = $("#toasts");
    var t = document.createElement("div");
    t.className = "toast";
    var m = document.createElement("span"); m.className = "toast-msg"; m.textContent = msg; t.appendChild(m);
    if(acaoLabel){
      var b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = acaoLabel;
      b.onclick = function(){ esconderToast(t); acaoFn(); };
      t.appendChild(b);
    }
    var x = document.createElement("button"); x.type = "button"; x.className = "toast-x"; x.setAttribute("aria-label", "Fechar aviso"); x.textContent = "✕";
    x.onclick = function(){ esconderToast(t); };
    t.appendChild(x);
    box.appendChild(t);
    while(box.children.length > MAX_TOASTS) box.removeChild(box.firstElementChild);
    requestAnimationFrame(function(){ t.classList.add("show"); });
    var restante = acaoLabel ? 7000 : 4500, inicio = Date.now(), timer = setTimeout(function(){ esconderToast(t); }, restante);
    t.addEventListener("mouseenter", function(){ clearTimeout(timer); restante -= Date.now() - inicio; });
    t.addEventListener("mouseleave", function(){ inicio = Date.now(); timer = setTimeout(function(){ esconderToast(t); }, Math.max(1500, restante)); });
  }
  function esconderToast(t){
    if(!t || !t.parentNode) return;
    t.classList.remove("show");
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 220);
  }

  // Etiquetas de setor/sócio de um contato, escopadas por "onde na tela" isso está sendo
  // desenhado (scope) — evita que o mesmo contato, aparecendo em dois lugares da página ao
  // mesmo tempo (o bloco da empresa E o cadastro dela em Contatos de clientes), tenha os dois
  // menus "+etiqueta" colidindo no mesmo id.
  function contatoTagsEtiquetaHTML(c, scope){
    var tagsHtml = (c.setores||[]).map(function(s){
      return '<span class="tag-badge tag-setor" style="--sc:var(--sector-'+s+')" data-action="toggle-setor-contato" data-id="'+c.id+'" data-setor="'+s+'" title="Clique para remover">'+SETOR_LABEL[s]+'</span>';
    }).join("") + (c.socio ? '<span class="tag-badge tag-socio" data-action="toggle-socio" data-id="'+c.id+'" title="Clique para remover">Sócio</span>' : '');
    var chaveMenu = scope+"::"+c.id;
    var menuAberto = ui.tagMenuAberto === chaveMenu;
    var tagMenu = '<div class="tagmenu" data-tagkey="'+esc(chaveMenu)+'"'+(menuAberto?'':' hidden')+'>' +
      '<div class="tagmenu-title">Setor</div>' +
      SETORES.map(function(s){
        var ativo = (c.setores||[]).indexOf(s.key) !== -1;
        return '<button type="button" class="tagmenu-item'+(ativo?" on":"")+'" data-action="toggle-setor-contato" data-id="'+c.id+'" data-setor="'+s.key+'"><i style="--tc:var(--sector-'+s.key+')"></i>'+s.label+'</button>';
      }).join("") +
      '<div class="tagmenu-sep"></div>' +
      '<button type="button" class="tagmenu-item'+(c.socio?" on":"")+'" data-action="toggle-socio" data-id="'+c.id+'"><i style="--tc:var(--blue-deep)"></i>Sócio</button>' +
    '</div>';
    return tagsHtml + '<span class="tagwrap"><button type="button" class="tagbtn" data-action="toggle-tagmenu" data-tagkey="'+esc(chaveMenu)+'">+ Etiqueta</button>' + tagMenu + '</span>';
  }
  function contatosSetorHTML(empresa, setorKey, docId){
    var lista = contatosDoSetor(empresa.id, setorKey);
    var rows = lista.map(function(c){
      var cst = c.statusTreinamento || "pendente";
      return '<div class="prow" data-id="'+c.id+'" data-contato-id="'+c.id+'">' +
        '<div class="pmain">' +
          '<button type="button" class="contact-name-link" data-action="ir-contato" data-id="'+c.id+'" title="Ver cadastro deste contato">'+esc(c.nome)+'</button>' + seloMesmaPessoa(c) + contatoTagsEtiquetaHTML(c, docId) +
          '<span class="pmain-sub">'+esc(c.email||"e-mail não informado")+'</span>' +
        '</div>' +
        '<div class="prow-ctl">' +
          cadastroSelectHTML(c, setorKey, "cag-") +
          '<select id="csel-cag-'+c.id+'" class="psel st-'+cst+'" data-action="cont-status" data-id="'+c.id+'" aria-label="Treinamento de '+esc(c.nome)+'">' + STATUS_CLIENTE.map(function(st){ return '<option value="'+st+'"'+(cst===st?" selected":"")+'>'+STATUS_LABEL[st]+'</option>'; }).join("") + '</select>' +
          (cst === "agendado" ? campoDataContato(c, "cag-") : '') +
          '<button class="xbtn" data-action="excluir-cont" data-id="'+c.id+'" title="Excluir">✕</button>' +
        '</div>' +
      '</div>';
    }).join("");

    var listaHtml = rows;
    var formAberto = ui.focoContatoForm === docId;
    var formContato = formAberto
      ? '<form class="ftc-form" data-action="prog-contato-submit" data-docid="'+docId+'" data-empresa="'+empresa.id+'" data-setor="'+setorKey+'">' +
          '<input type="text" class="ftc-nome" list="pessoasDatalist" autocomplete="off" placeholder="Nome do contato" required>' +
          '<input type="text" class="ftc-email" placeholder="E-mail (opcional)">' +
          '<div class="ftc-form-btns"><button type="submit" class="fbtn">Salvar contato</button><button type="button" class="fbtn" data-action="foco-contato-cancelar">Cancelar</button></div>' +
        '</form>'
      : '<div class="sblock-contatos-add"><button type="button" class="linkish" data-action="foco-contato-abrir" data-docid="'+docId+'">+ Cadastrar contato</button></div>';

    return '<div class="sblock-contatos">' +
      '<div class="sblock-contatos-title">Contatos de clientes' + (rows ? '' : ' <span class="note">· nenhum cadastrado</span>') + '</div>' +
      listaHtml + formContato +
    '</div>';
  }

  function blocoSetor(empresa, setorDef, docId, doc){
    var d = doc || {analistaNome:"", etapas:{}, impedimento:{}};
    var bloq = d.impedimento && d.impedimento.ativo;

    var steps = '<div class="steps">' + ETAPAS.filter(function(et){ return !et.porEmpresa && (!et.onlyIf || et.onlyIf(empresa, setorDef.key)); }).map(function(et){
      if(et.key === "treinamentoCliente"){
        var comp = statusClienteComputado(empresa.id, setorDef.key);
        return '<div class="step">' +
          '<span class="fchip st-'+comp.status+'">'+rotuloStatus(comp.status, comp.agendadoPara, comp.agendadoHora)+'</span>' +
          '<span class="step-name">'+et.label+'</span>' +
          (comp.total ? '<span class="note">'+comp.feitos+'/'+comp.total+' treinados</span>' : '') +
        '</div>';
      }
      if(et.key === "cadastroUsuario"){
        var cc = statusCadastroComputado(empresa.id, setorDef.key);
        return '<div class="step">' +
          '<span class="fchip st-'+cc.status+'">'+STATUS_LABEL[cc.status]+'</span>' +
          '<span class="step-name">'+et.label+'</span>' +
          (cc.total ? '<span class="note">'+cc.feitos+'/'+cc.total+' cadastrados</span>' : '') +
        '</div>';
      }
      var ed = etapaInfo(d, et.key);
      var st = ed.status;
      var dt = ed.data || "";
      return '<div class="step">' +
        seletorEtapa("pst-"+docId+"-"+et.key, st, empresa.id, setorDef.key, et.key, et.label) +
        '<span class="step-name"'+(ed.func ? ' title="Treinamento de '+esc(ed.func.nome)+' (cadastro em Equipe)"' : '')+'>'+et.label+'</span>' +
        (st === "concluido" ? campoConclusao("pcd-"+docId+"-"+et.key, 'data-empresa="'+empresa.id+'" data-setor="'+setorDef.key+'" data-etapa="'+et.key+'"', dt) : '') +
        (st === "agendado" ? campoDataAgendada("pag-"+docId+"-"+et.key, "ag-data", 'data-empresa="'+empresa.id+'" data-setor="'+setorDef.key+'" data-etapa="'+et.key+'"', ed.agendadoPara||"", ed.agendadoHora||"") +
          (etapaAgendamentoAtrasado(ed.agendadoPara) ? '<span class="atrasado" title="A data do treinamento já passou e a etapa continua como Agendada">Atrasado</span>' : '') : '') +
      '</div>';
    }).join("") + '</div>';

    return '<div class="sblock'+(bloq?" blocked":"")+'">' +
      '<div class="sblock-head">' +
        '<h4><span class="trk-tag">'+setorDef.tag+'</span>'+setorDef.label+(bloq?'<button class="flagbadge" data-action="ir-impedimentos" style="margin-left:6px;"><i></i>Impedimento</button>':'')+'</h4>' +
      '</div>' +
      '<div class="metaline">' +
        '<label>Analista '+selectAnalistaHTML(d, docId, empresa.id, setorDef.key, "pana-"+docId)+'<span class="fsave" id="fs-pana-'+docId+'"></span></label>' +
        (function(){ var r = resolverAnalista(d); return r.id ? '<button class="linkish" data-action="ver-analista-id" data-id="'+r.id+'">Ver carteira</button>' : (r.nome ? '<button class="linkish" data-action="ver-analista" data-nome="'+esc(r.nome)+'">Ver carteira</button>' : ''); })() +
      '</div>' +
      steps +
      contatosSetorHTML(empresa, setorDef.key, docId) +
    '</div>';
  }

  /* ---------- treinamento ---------- */
  function renderTreinoToolbar(totalVisivel, totalGeral){
    var statusBox = $("#treinoStatusFilters");
    statusBox.innerHTML = '<button data-st="todos" class="'+(ui.treinoStatus==="todos"?"on":"")+'">Todos</button>' +
      STATUS_CLIENTE.map(function(st){ return '<button data-st="'+st+'" class="'+(ui.treinoStatus===st?"on":"")+'">'+STATUS_LABEL[st]+'</button>'; }).join("");
    $$("button", statusBox).forEach(function(b){
      b.onclick = function(){ ui.treinoStatus = b.getAttribute("data-st"); renderTreinamento(); };
    });

    var extra = $("#btnTreinoExtra");
    extra.hidden = false;
    extra.textContent = "Só com impedimento";
    extra.classList.toggle("on", ui.treinoSoImpedimento);
    extra.onclick = function(){ ui.treinoSoImpedimento = !ui.treinoSoImpedimento; renderTreinamento(); };

    var ativo = ui.treinoBusca || ui.treinoStatus !== "todos" || ui.treinoSoImpedimento;
    var clear = $("#btnLimparTreino");
    clear.hidden = !ativo;
    clear.onclick = function(){
      ui.treinoBusca = ""; ui.treinoStatus = "todos"; ui.treinoSoImpedimento = false;
      $("#treinoSearch").value = "";
      renderTreinamento();
    };

    $("#treinoCount").textContent = totalVisivel+" de "+totalGeral;
  }

  function renderTreinamento(){
    var box = $("#treinoList");
    var q = ui.treinoBusca.trim().toLowerCase();
    if(!state.funcionarios.length){
      renderTreinoToolbar(0, 0);
      box.innerHTML = '<div class="empty">Nenhum funcionário cadastrado.</div>'; return;
    }
    var visiveis = state.funcionarios.filter(function(f){
      if(q && f.nome.toLowerCase().indexOf(q) === -1 && (f.cargo||"").toLowerCase().indexOf(q) === -1) return false;
      if(ui.treinoStatus !== "todos" && f.statusTreinamento !== ui.treinoStatus) return false;
      if(ui.treinoSoImpedimento && !(f.impedimento && f.impedimento.ativo)) return false;
      return true;
    });
    renderTreinoToolbar(visiveis.length, state.funcionarios.length);
    ui.ultimaListaFunc = visiveis.map(function(f){ return f.id; });
    salvarUI();
    renderBulkBarFunc();
    if(!visiveis.length){ box.innerHTML = '<div class="empty">Nenhum funcionário encontrado com esses filtros.</div>'; return; }
    var filtroAtivoEq = !!q || ui.treinoStatus !== "todos" || ui.treinoSoImpedimento;
    var porSetor = {};
    visiveis.forEach(function(f){ (porSetor[f.setor] = porSetor[f.setor] || []).push(f); });
    box.innerHTML = SETORES.map(function(s){
      var l = porSetor[s.key] || []; if(!l.length) return "";
      var ok = l.filter(function(f){ return f.statusTreinamento === "concluido"; }).length;
      var gkey = "equipe:"+s.key;
      var gAberto = grupoAberto(gkey, filtroAtivoEq);
      var rows = l.map(function(f){
          var carteira = state.setores.filter(function(sd){ return sd.analistaId === f.id || (!sd.analistaId && (sd.analistaNome||"").trim() === f.nome); });
          var aberto = ui.expandedFunc.has(f.id);
          var chips = (carteira.length ? carteira.map(function(sd){
            var e = state.empresas.find(function(x){ return x.id === sd.empresaId; });
            return '<span class="cchip-wrap"><button class="cchip" data-action="ir-empresa" data-id="'+sd.empresaId+'">'+esc(e?e.nome:sd.empresaNome)+' · '+(SETOR_TAG[sd.setor]||sd.setor)+'</button><button type="button" class="cchip-x" data-action="carteira-remover" data-empresa="'+sd.empresaId+'" data-setor="'+sd.setor+'" title="Remover desta carteira">✕</button></span>';
          }).join("") : '<span class="note">Nenhuma empresa atribuída a este colaborador ainda.</span>') +
            (aberto ? (ui.carteiraAddAberto === f.id
              ? (function(){
                  var empresasFora = state.empresas.filter(function(e){ return !carteira.some(function(sd){ return sd.empresaId === e.id; }); });
                  var dlId = "cadd-lista-"+f.id;
                  return '<form class="carteira-form" data-action="carteira-add-submit" data-fid="'+f.id+'">' +
                    '<input type="text" class="cadd-empresa" list="'+dlId+'" placeholder="Nome da empresa" autocomplete="off" required>' +
                    '<datalist id="'+dlId+'">'+empresasFora.map(function(e){ return '<option value="'+esc(e.nome)+'">'; }).join("")+'</datalist>' +
                    '<select class="cadd-setor" required><option value="">Setor…</option></select>' +
                    '<button type="submit" class="fbtn">Adicionar</button><button type="button" class="fbtn" data-action="carteira-add-cancelar">Cancelar</button>' +
                  '</form>';
                })()
              : '<button type="button" class="linkish carteira-add-btn" data-action="carteira-add-abrir" data-fid="'+f.id+'">+ Adicionar empresa</button>') : '');
          var chipsBox = '<div class="carteira">' + chips + '</div>';
          var obsField = '<div class="obs-field"><label>Observações <span class="fsave" id="fs-ffo-'+f.id+'"></span><input type="text" class="func-obs" id="ffo-'+f.id+'" data-id="'+f.id+'" value="'+esc(f.observacoes||"")+'" placeholder="Ex.: aguardando data disponível…"></label></div>';
          var cargoOptions = '<option value="">Selecione…</option>' + CARGOS.map(function(c){ return '<option value="'+c+'"'+(f.cargo===c?" selected":"")+'>'+c+'</option>'; }).join("");
          if(f.cargo && CARGOS.indexOf(f.cargo) === -1) cargoOptions = '<option value="'+esc(f.cargo)+'" selected>(atual) '+esc(f.cargo)+'</option>' + cargoOptions;
          var setorOptions = SETORES.map(function(s){ return '<option value="'+s.key+'"'+(f.setor===s.key?" selected":"")+'>'+s.label+'</option>'; }).join("");
          var editFields = '<div class="edit-fields">' +
            '<div class="edit-fields-title">Editar cadastro</div>' +
            '<label>Nome <span class="fsave" id="fs-ffn-'+f.id+'"></span><input type="text" class="func-nome" id="ffn-'+f.id+'" data-id="'+f.id+'" value="'+esc(f.nome)+'"></label>' +
            '<label>Setor<select class="func-setor" data-id="'+f.id+'">'+setorOptions+'</select></label>' +
            '<label>Cargo<select class="func-cargo" data-id="'+f.id+'">'+cargoOptions+'</select></label>' +
          '</div>';
          var flag = (f.impedimento && f.impedimento.ativo) ? '<button class="flagbadge" data-action="ir-impedimentos"><i></i>Impedimento</button>' : '';
          var cargoEfetivo = f.cargo || "Analista";
          var cargoLt = (cargoEfetivo === "Estagiário(a)" || cargoEfetivo === "Estagiário" || cargoEfetivo === "Analista" || cargoEfetivo === "Supervisor(a)" || cargoEfetivo === "Supervisor") ? " cargo-lt" : "";
          var cargoTag = '<span class="cargo-tag'+cargoLt+'" style="--cc:var('+(CARGO_COR[cargoEfetivo]||"--ink-3")+')">'+esc(cargoEfetivo)+'</span>';
          var fst = f.statusTreinamento || "pendente";
          var selF = ui.selFunc.has(f.id);
          return '<div class="prow'+(selF?" sel":"")+'" data-id="'+f.id+'">' +
            '<div class="pmain" data-action="toggle-func" data-id="'+f.id+'"><input type="checkbox" class="sel-emp" data-action="sel-func" data-id="'+f.id+'"'+(selF?" checked":"")+' aria-label="Selecionar '+esc(f.nome)+'" title="Selecionar para agendar em lote"><strong>'+esc(f.nome)+'</strong>'+cargoTag+'<span class="pmain-sub">'+carteira.length+' empresa'+(carteira.length===1?'':'s')+(f.observacoes?' · '+esc(f.observacoes):'')+'</span></div>' +
            '<select class="psel st-'+fst+'" data-action="func-status" data-id="'+f.id+'">' + STATUS_CLIENTE.map(function(st){ return '<option value="'+st+'"'+(fst===st?" selected":"")+'>'+STATUS_LABEL[st]+'</option>'; }).join("") + '</select>' +
            (fst === "agendado" ? campoDataFuncionario(f, "ffag-") : '') +
            flag +
            '<button class="xbtn" data-action="excluir-func" data-id="'+f.id+'" title="Excluir">✕</button>' +
            (aberto ? (chipsBox + obsField + editFields) : '') +
          '</div>';
        }).join("");
      return '<div class="grp'+(gAberto?" open":"")+'">' +
        '<div class="ghead" data-action="toggle-group" data-group="'+gkey+'" data-auto="'+(filtroAtivoEq?1:0)+'">'+CHEV+'<span class="trk-tag">'+s.tag+'</span><span class="ghead-name">'+s.label+'</span><span class="cnt">'+ok+'/'+l.length+' treinados</span></div>' +
        '<div class="gwrap"><div class="gbody">'+rows+'</div></div>' +
      '</div>';
    }).join("");
  }

  function renderBulkBarFunc(){
    var ids = {}; state.funcionarios.forEach(function(f){ ids[f.id] = true; });
    ui.selFunc.forEach(function(id){ if(!ids[id]) ui.selFunc.delete(id); });
    var n = ui.selFunc.size;
    $("#bulkBarFunc").hidden = !n;
    if(!n) return;
    $("#bulkFuncCount").textContent = n + " funcionário" + (n === 1 ? "" : "s") + " selecionado" + (n === 1 ? "" : "s");
    var visiveis = ui.ultimaListaFunc.length;
    $("#bulkFuncTodas").textContent = "Selecionar os " + visiveis + " visíveis";
    $("#bulkFuncTodas").hidden = !visiveis || ui.ultimaListaFunc.every(function(id){ return ui.selFunc.has(id); });
  }
  // Agenda o treinamento (ou outro status) de vários funcionários de uma vez, com uma única
  // gravação por pessoa e um único Desfazer para o lote inteiro.
  function aplicarTreinoEmLoteFuncionarios(){
    var novo = $("#bulkFuncStatus").value, data = $("#bulkFuncData").value;
    if(novo === "agendado" && !data){ mostrarToast("Escolha a data do treinamento."); $("#bulkFuncData").focus(); return; }
    var alvos = state.funcionarios.filter(function(f){ return ui.selFunc.has(f.id); });
    if(!alvos.length) return;
    var antes = alvos.map(function(f){ return {id:f.id, statusTreinamento:f.statusTreinamento || "pendente", concluidoEm:f.concluidoEm || "", agendadoPara:f.agendadoPara || ""}; });
    emLote(function(){
      alvos.forEach(function(f){ definirStatusFuncionario(f.id, novo, novo === "agendado" ? data : undefined, true); });
    });
    ui.selFunc.clear();
    var rot = STATUS_LABEL[novo] + (novo === "agendado" ? " · " + dataCurta(data) : "");
    mostrarToast(alvos.length + " funcionário" + (alvos.length === 1 ? "" : "s") + " marcado" + (alvos.length === 1 ? "" : "s") + " como " + rot, "Desfazer", function(){
      emLote(function(){
        antes.forEach(function(a){
          var f = state.funcionarios.find(function(x){ return x.id === a.id; });
          var p0 = {statusTreinamento:a.statusTreinamento, concluidoEm:a.concluidoEm, agendadoPara:a.agendadoPara};
          if(f) Object.assign(f, p0);
          if(dbRef) dbRef.collection("funcionarios").doc(a.id).update(p0);
        });
      });
    });
  }

  /* ---------- impedimentos ---------- */
  var impAlvoMapa = {};
  function populateImpAlvo(){
    var tipo = $("#imp-tipo").value, opcoes = [];
    impAlvoMapa = {};
    var add = function(rotulo, alvo){
      var r = rotulo, n = 2;
      while(impAlvoMapa[r]) r = rotulo + " (" + (n++) + ")";
      impAlvoMapa[r] = alvo; opcoes.push(r);
    };
    if(tipo === "empresa"){
      state.empresas.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).forEach(function(e){ add(e.nome + (e.cnpj ? " · " + e.cnpj : ""), {col:"empresas", id:e.id}); });
    } else if(tipo === "setor"){
      var porEmp = {};
      state.setores.forEach(function(sd){ (porEmp[sd.empresaId] = porEmp[sd.empresaId] || []).push(sd); });
      state.empresas.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).forEach(function(e){
        frentesDaEmpresa(e, porEmp[e.id] || []).forEach(function(f){ add(e.nome + " · " + SETOR_LABEL[f.setor], {col:"empresaSetores", id:f.id, empresaId:e.id, setor:f.setor}); });
      });
    } else {
      state.funcionarios.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).forEach(function(f){ add(f.nome + " (" + (SETOR_LABEL[f.setor] || f.setor) + ")", {col:"funcionarios", id:f.id}); });
    }
    $("#imp-alvo-lista").innerHTML = opcoes.map(function(o){ return '<option value="'+esc(o)+'"></option>'; }).join("");
  }
  $("#imp-alvo").addEventListener("input", function(){ this.setCustomValidity(""); });
  $("#imp-tipo").addEventListener("change", function(){ $("#imp-alvo").value = ""; populateImpAlvo(); });


  function renderImpedimentos(m){
    renderImpResolvidos();
    $("#impCount").textContent = m.bloqueios.length ? (m.bloqueios.length+" ativo"+(m.bloqueios.length===1?"":"s")) : "nenhum ativo";
    populateImpAlvo();
    var box = $("#impList");
    var q = ui.impBusca.trim().toLowerCase();
    var visiveis = m.bloqueios.filter(function(b){
      if(!q) return true;
      return b.nome.toLowerCase().indexOf(q) !== -1 || (b.desc||"").toLowerCase().indexOf(q) !== -1;
    });
    $("#impFilteredCount").textContent = visiveis.length+" de "+m.bloqueios.length;

    if(!m.bloqueios.length){
      box.innerHTML = '<div class="empty">Nenhum impedimento em aberto. Use “+ Registrar impedimento” para cadastrar um.</div>';
      return;
    }
    if(!visiveis.length){
      box.innerHTML = '<div class="empty">Nenhum impedimento encontrado com essa busca.</div>';
      return;
    }
    // Mais antigos primeiro; os registrados antes da data de início existir vão para o fim.
    visiveis.sort(function(a, b){
      if(!a.desde !== !b.desde) return a.desde ? -1 : 1;
      return String(a.desde).localeCompare(String(b.desde)) || a.nome.localeCompare(b.nome, "pt-BR");
    });
    box.innerHTML = visiveis.map(function(b){
      var goto = b.col === "funcionarios" ? ' data-goto-func="'+esc(b.funcNome||"")+'"' : ' data-goto-empresa="'+b.empresaId+'"';
      var dias = b.desde ? diasDesde(b.desde) : null;
      var idade = dias === null ? '<span class="imp-idade sem">sem data de início</span>'
        : '<span class="imp-idade'+(dias >= 30 ? ' velho' : '')+'" title="Registrado em '+dataBR(b.desde)+'">'+(dias === 0 ? 'desde hoje' : 'há '+dias+' dia'+(dias === 1 ? '' : 's'))+'</span>';
      var chave = b.col+":"+b.docId;
      var resolvendo = ui.impResolvendo === chave;
      return '<div class="imp-row'+(resolvendo ? ' resolvendo' : '')+'">' +
        '<span class="imp-escopo">'+esc(b.escopo)+'</span>' +
        '<div class="imp-body"><button type="button" class="imp-nome"'+goto+' data-action="imp-goto">'+esc(b.nome)+'</button>' + (b.desc ? '<p>'+esc(b.desc)+'</p>' : '<p class="note">Sem descrição registrada.</p>') +
          (resolvendo ? '<form class="imp-resolver-form" data-col="'+b.col+'" data-docid="'+b.docId+'">' +
            '<input type="text" class="imp-resolver-nota" maxlength="200" placeholder="Como foi resolvido? (opcional)">' +
            '<button type="submit" class="fbtn">Confirmar</button><button type="button" class="linkish" data-action="imp-resolver-cancelar">Cancelar</button>' +
          '</form>' : '') +
        '</div>' +
        '<select class="imp-agu'+(b.aguardando ? ' tem' : '')+'" data-col="'+b.col+'" data-docid="'+b.docId+'" aria-label="Aguardando quem"><option value="cliente">Aguardando cliente</option><option value="analista">Aguardando analista</option><option value="escritorio">Aguardando escritório</option></select>'.replace('<option value="'+b.aguardando+'">', '<option value="'+b.aguardando+'" selected>').replace('<select', '<select').replace('aria-label="Aguardando quem">', 'aria-label="Aguardando quem"><option value="">Aguardando…</option>') +
        idade +
        (resolvendo ? '' : '<button type="button" class="fbtn imp-resolver" data-action="imp-resolver-abrir" data-chave="'+esc(chave)+'">Resolver</button>') +
      '</div>';
    }).join("");
  }
  function diasDesde(iso){
    var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    if(isNaN(d.getTime())) return null;
    var h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((h - d) / 864e5));
  }
  // Resolvidos nos últimos 30 dias, a partir do registro de atividades.
  function renderImpResolvidos(){
    var box = $("#impResolvidos");
    if(!box) return;
    var lim = new Date(); lim.setDate(lim.getDate() - 30);
    var limS = lim.toISOString();
    var itens = [];
    state.historico.forEach(function(d){ (d.eventos || []).forEach(function(e){ if(e.tipo === "impedimento" && e.para === "removido" && e.em && e.em >= limS) itens.push(e); }); });
    itens.sort(function(a, b){ return a.em < b.em ? 1 : -1; });
    if(!itens.length){ box.innerHTML = ""; return; }
    box.innerHTML = '<div class="sec-label">Resolvidos nos últimos 30 dias <span class="cnt">'+itens.length+'</span></div>' +
      '<div class="panel imp-list">' + itens.slice(0, 10).map(function(e){
        var onde = [e.empresaNome || e.nome, e.setor ? SETOR_LABEL[e.setor] : ""].filter(Boolean).join(" · ");
        return '<div class="imp-row imp-ok"><span class="imp-escopo ok">Resolvido</span><div class="imp-body"><strong>'+esc(onde || "—")+'</strong>' +
          (e.texto ? '<p>'+esc(e.texto)+'</p>' : '') + (e.resolucao ? '<p class="imp-resolucao">'+esc(e.resolucao)+'</p>' : '') + '</div>' +
          '<span class="imp-idade">'+dataBR(String(e.em).slice(0, 10))+'</span></div>';
      }).join("") + '</div>';
  }

  function renderAuditoriaDominio(){
    $("#audCount").textContent = state.auditoriaDominio.length ? (state.auditoriaDominio.length+" caso"+(state.auditoriaDominio.length===1?"":"s")) : "nenhum";
    $("#audVazio").hidden = !!state.auditoriaDominio.length;
    $("#audSec").hidden = !state.auditoriaDominio.length;
    var box = $("#audList");
    if(!state.auditoriaDominio.length){
      box.innerHTML = '<div class="empty">Nenhum caso encontrado ainda. Peça uma sincronização com o Gestta para verificar.</div>';
      return;
    }
    var porEmpresa = {};
    state.auditoriaDominio.forEach(function(a){ (porEmpresa[a.empresaNome||"Sem empresa"] = porEmpresa[a.empresaNome||"Sem empresa"] || []).push(a); });
    box.innerHTML = Object.keys(porEmpresa).map(function(nome){
      var l = porEmpresa[nome];
      var gkey = "aud:"+nome;
      var gAberto = grupoAberto(gkey, false);
      var rows = l.map(function(a){
        var deps = (a.departamentosVinculados||[]).join(", ");
        return '<div class="imp-row">' +
          '<div class="imp-body"><strong>'+esc(a.userNome||"")+'</strong>' +
            '<p>Vinculado a: '+esc(deps)+(a.departamentoEsperado?' · esperado apenas '+esc(a.departamentoEsperado):'')+'</p>' +
          '</div>' +
          '<button class="linkish red" data-action="excluir-auditoria-dominio" data-docid="'+a.id+'">Marcar como resolvido</button>' +
        '</div>';
      }).join("");
      return '<div class="grp'+(gAberto?" open":"")+'">' +
        '<div class="ghead" data-action="toggle-group" data-group="'+gkey+'">'+CHEV+'<span class="ghead-name">'+esc(nome)+'</span><span class="cnt">'+l.length+'</span></div>' +
        '<div class="gwrap"><div class="gbody">'+rows+'</div></div>' +
      '</div>';
    }).join("");
  }

  // Empresas para o campo com busca do cadastro de contato: o rótulo leva o CNPJ para desempatar nomes parecidos.
  var empresaPorRotulo = {};
  function rotuloEmpresa(e){ return e.nome + (e.cnpj ? " · " + e.cnpj : ""); }
  function renderSelectEmpresas(){
    var dl = $("#fc-empresa-lista"); if(!dl) return;
    empresaPorRotulo = {};
    var l = state.empresas.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    l.forEach(function(e){ empresaPorRotulo[rotuloEmpresa(e)] = e.id; });
    dl.innerHTML = l.map(function(e){ return '<option value="'+esc(rotuloEmpresa(e))+'"></option>'; }).join("");
  }
  function empresaDoCampo(v){
    v = String(v || "").trim();
    if(empresaPorRotulo[v]) return empresaPorRotulo[v];
    var n = normBusca(v), d = v.replace(/\D/g, "");
    var achadas = state.empresas.filter(function(e){ return normBusca(e.nome) === n || (d.length >= 8 && String(e.cnpj || "").replace(/\D/g, "") === d); });
    return achadas.length === 1 ? achadas[0].id : "";
  }

  /* ---------- contatos: mesma pessoa em várias empresas (mesmo e-mail) ---------- */
  var idxEmail = {ref:null, mapa:{}};
  var pessoasPorRotulo = {};
  function renderPessoasDatalist(){
    var dl = $("#pessoasDatalist"); if(!dl) return;
    pessoasPorRotulo = {};
    var html = pessoasUnicas().filter(function(p){ return p.email; }).map(function(p){
      var label = p.nome+" · "+p.email;
      pessoasPorRotulo[label] = p;
      return '<option value="'+esc(label)+'">';
    }).join("");
    if(dl.innerHTML !== html) dl.innerHTML = html;
  }
  // Identifica a mesma pessoa em várias empresas pelo e-mail. Um texto no lugar do e-mail
  // (ex.: "pendente informação de e-mail") só junta registros que também tenham o mesmo nome.
  function chaveEmail(c){
    var e = String((c && c.email) || "").trim().toLowerCase();
    if(!e || e.indexOf("@") > 0) return e;
    return "sem-email:" + normBusca(c && c.nome).trim().replace(/\s+/g, " ") + "|" + e;
  }
  function mesmaPessoa(c){
    var k = chaveEmail(c);
    if(!k) return [];
    if(idxEmail.ref !== state.contatos){
      var mapa = {};
      state.contatos.forEach(function(x){ var kk = chaveEmail(x); if(kk) (mapa[kk] = mapa[kk] || []).push(x); });
      idxEmail = {ref:state.contatos, mapa:mapa};
    }
    return (idxEmail.mapa[k] || []).filter(function(x){ return x.id !== c.id; });
  }
  function seloMesmaPessoa(c){
    var outrasEmp = {};
    mesmaPessoa(c).forEach(function(x){ if(x.empresaId !== c.empresaId) outrasEmp[x.empresaId] = x.empresaNome || "outra empresa"; });
    var nomes = Object.keys(outrasEmp).map(function(k){ return outrasEmp[k]; });
    if(!nomes.length) return "";
    return '<span class="multi-emp" title="Mesma pessoa em: '+esc(nomes.join(", "))+'. O treinamento é da pessoa: ao mudar aqui, muda nas outras empresas também.">+'+nomes.length+' empresa'+(nomes.length === 1 ? '' : 's')+'</span>';
  }

  /* ---------- cadastro de contatos: pessoas únicas, editáveis, vinculáveis a mais empresas ---------- */
  function pessoasUnicas(){
    var porChave = {}, ordem = [];
    contatosValidos().forEach(function(c){
      var k = chaveEmail(c) || ("id:"+c.id);
      if(!porChave[k]){ porChave[k] = {chave:k, nome:c.nome, email:c.email||"", registros:[]}; ordem.push(porChave[k]); }
      porChave[k].registros.push(c);
    });
    return ordem;
  }
  function vincularPessoaAEmpresa(pessoa, empresaId, setorKey){
    if(!dbRef) return Promise.reject(new Error("sem banco"));
    var emp = state.empresas.find(function(e){ return e.id === empresaId; });
    return dbRef.collection("contatos").add({
      nome:pessoa.nome, email:pessoa.email||"", empresaId:empresaId, empresaNome:emp?emp.nome:"",
      setores:[setorKey], statusTreinamento:"pendente", exemplo:false, criadoEm:new Date().toISOString()
    }).then(function(ref){
      registrarAtividade({tipo:"contato", empresaId:empresaId, empresaNome:emp?emp.nome:"", setor:setorKey, nome:pessoa.nome});
      return ref;
    });
  }
  function editarPessoa(chave, campo, novoValor, inputId){
    if(!dbRef) return;
    var pessoa = pessoasUnicas().find(function(p){ return p.chave === chave; });
    if(!pessoa) return;
    var atual = campo === "nome" ? pessoa.nome : pessoa.email;
    if((atual || "") === novoValor) return;
    var patch = {}; patch[campo] = novoValor;
    pessoa.registros.forEach(function(c){ c[campo] = novoValor; });
    var novaChave = chaveEmail(pessoa.registros[0]) || chave;
    if(novaChave !== chave){
      if(ui.expandedPessoas.has(chave)){ ui.expandedPessoas.delete(chave); ui.expandedPessoas.add(novaChave); }
      if(ui.pessoaVincularForm === chave) ui.pessoaVincularForm = novaChave;
    }
    salvarComAviso(inputId, Promise.all(pessoa.registros.map(function(c){ return dbRef.collection("contatos").doc(c.id).update(patch); })));
    renderAll();
  }
  function contatoJaVinculado(nome, email, empresaId, setorKey){
    var chave = chaveEmail({email:email});
    return state.contatos.some(function(c){
      if(c.empresaId !== empresaId) return false;
      if(setorKey && (c.setores||[]).indexOf(setorKey) === -1) return false;
      return chave ? chaveEmail(c) === chave : normBusca(c.nome) === normBusca(nome);
    });
  }
  function pessoaEmpresaChipsHTML(p){
    var vistos = {}, chips = [];
    p.registros.forEach(function(c){
      if(!c.empresaId || vistos[c.empresaId]) return;
      vistos[c.empresaId] = true;
      var setoresTxt = (c.setores||[]).map(function(s){
        return '<span class="trk-tag" style="color:var(--sector-'+s+')">'+(SETOR_TAG[s]||s)+'</span>';
      }).join("");
      chips.push('<span class="pessoa-emp-chip"><button type="button" class="cchip" data-action="ir-empresa" data-id="'+c.empresaId+'">'+esc(c.empresaNome||"")+'</button>'+setoresTxt+'</span>');
    });
    return chips.length ? '<span class="pessoa-emp-chips">'+chips.join("")+'</span>' : "";
  }
  function renderContatosCadastro(){
    var box = $("#pessoasList");
    if(!box) return;
    var q = normBusca(ui.pessoasBusca.trim());

    var fbox = $("#pessoasSetorFiltros");
    fbox.innerHTML = '<button type="button" data-setor="todos" class="'+(ui.pessoasFiltroSetor==="todos"?"on":"")+'">Todos</button>' +
      SETORES.map(function(s){ return '<button type="button" data-setor="'+s.key+'" class="'+(ui.pessoasFiltroSetor===s.key?"on":"")+'">'+s.label+'</button>'; }).join("");
    $$("button", fbox).forEach(function(b){
      b.addEventListener("click", function(){ ui.pessoasFiltroSetor = b.getAttribute("data-setor"); renderContatosCadastro(); });
    });

    var empresasComContato = {};
    contatosValidos().forEach(function(c){ if(c.empresaId && !empresasComContato[c.empresaId]) empresasComContato[c.empresaId] = c.empresaNome || ""; });
    var listaEmpresasFiltro = Object.keys(empresasComContato).map(function(id){ return {id:id, nome:empresasComContato[id]}; }).sort(function(a,b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    var selEmp = $("#pessoasEmpresaFiltro");
    var optsEmp = '<option value="">Todas as empresas</option>' + listaEmpresasFiltro.map(function(e){ return '<option value="'+e.id+'"'+(ui.pessoasFiltroEmpresa===e.id?" selected":"")+'>'+esc(e.nome)+'</option>'; }).join("");
    if(selEmp.innerHTML !== optsEmp){ selEmp.innerHTML = optsEmp; selEmp.value = ui.pessoasFiltroEmpresa; }

    var filtrosAtivosContatos = !!q || ui.pessoasFiltroSetor !== "todos" || !!ui.pessoasFiltroEmpresa;
    var secAberta = grupoAberto("secao:contatos", filtrosAtivosContatos);
    if(secAberta && filtrosAtivosContatos) ui.expandedGroups.add("secao:contatos");
    var secBtn = $("#btnContatosToggle");
    secBtn.setAttribute("data-auto", filtrosAtivosContatos ? "1" : "0");
    secBtn.classList.toggle("open", secAberta);
    secBtn.setAttribute("aria-expanded", secAberta);
    $("#pessoasGwrap").classList.toggle("open", secAberta);

    var btnLimparPessoas = $("#btnLimparPessoas");
    btnLimparPessoas.hidden = !filtrosAtivosContatos;
    btnLimparPessoas.onclick = function(){
      ui.pessoasBusca = ""; ui.pessoasFiltroSetor = "todos"; ui.pessoasFiltroEmpresa = "";
      $("#pessoasSearch").value = "";
      renderContatosCadastro();
    };

    var todas = pessoasUnicas();
    var visiveis = todas.filter(function(p){
      if(ui.pessoasFiltroEmpresa && !p.registros.some(function(c){ return c.empresaId === ui.pessoasFiltroEmpresa; })) return false;
      if(ui.pessoasFiltroSetor !== "todos" && !p.registros.some(function(c){ return (c.setores||[]).indexOf(ui.pessoasFiltroSetor) !== -1; })) return false;
      if(!q) return true;
      if(normBusca(p.nome).indexOf(q) !== -1 || normBusca(p.email).indexOf(q) !== -1) return true;
      return p.registros.some(function(c){ return normBusca(c.empresaNome||"").indexOf(q) !== -1; });
    }).sort(function(a,b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    $("#pessoasCount").textContent = visiveis.length+" de "+todas.length;
    ui.ultimaListaPessoas = visiveis.map(function(p){ return p.chave; });
    renderBulkBarPessoas();
    if(!todas.length){ box.innerHTML = carregando() ? '<div class="empty">Carregando…</div>' : '<div class="empty">Nenhum contato de cliente cadastrado ainda.</div>'; return; }
    if(!visiveis.length){ box.innerHTML = '<div class="empty">Nenhum contato encontrado com esses filtros.</div>'; return; }
    box.innerHTML = visiveis.map(function(p){
      var aberto = ui.expandedPessoas.has(p.chave);
      var sub = p.email || "e-mail não informado";
      var repP = p.registros.slice().sort(function(a, b){ return (RANK_TREINO[b.statusTreinamento] || 0) - (RANK_TREINO[a.statusTreinamento] || 0); })[0];
      var stP = STATUS_LABEL[repP.statusTreinamento] ? repP.statusTreinamento : "pendente";
      var chipP = '<span class="fchip st-'+stP+' pessoa-st">'+esc(rotuloStatus(stP, repP.agendadoPara, repP.agendadoHora))+'</span>';
      var corpo = "";
      if(aberto){
        var idn = "pn-"+encodeURIComponent(p.chave), ide = "pe-"+encodeURIComponent(p.chave);
        var editFields = '<div class="edit-fields">' +
          '<div class="edit-fields-title">Editar cadastro</div>' +
          '<label>Nome <span class="fsave" id="fs-'+idn+'"></span><input type="text" class="pessoa-nome" id="'+idn+'" data-chave="'+esc(p.chave)+'" value="'+esc(p.nome)+'"></label>' +
          '<label>E-mail <span class="fsave" id="fs-'+ide+'"></span><input type="text" class="pessoa-email" id="'+ide+'" data-chave="'+esc(p.chave)+'" value="'+esc(p.email)+'"></label>' +
        '</div>';
        var registrosHtml = '<div class="pessoa-registros">' + p.registros.slice().sort(function(a,b){ return (a.empresaNome||"").localeCompare(b.empresaNome||"", "pt-BR"); }).map(function(c){
          var cst = STATUS_LABEL[c.statusTreinamento] ? c.statusTreinamento : "pendente";
          return '<div class="pessoa-reg-row">' +
            '<button type="button" class="linkish" data-action="ir-empresa" data-id="'+c.empresaId+'">'+esc(c.empresaNome||"(empresa removida)")+'</button>' +
            '<span class="pessoa-reg-tags">'+contatoTagsEtiquetaHTML(c, "pessoas")+'</span>' +
            '<span class="note">'+STATUS_LABEL[cst]+'</span>' +
            '<button type="button" class="xbtn" data-action="excluir-cont" data-id="'+c.id+'" title="Remover este vínculo">✕</button>' +
          '</div>';
        }).join("") + '</div>';
        var vincularForm = ui.pessoaVincularForm === p.chave
          ? (function(){
              var empresasFora = state.empresas.filter(function(e){ return !p.registros.some(function(c){ return c.empresaId === e.id; }); });
              var dlId = "pv-lista-"+encodeURIComponent(p.chave).replace(/[^a-zA-Z0-9]/g,"");
              return '<form class="pessoa-vincular-form" data-action="pessoa-vincular-submit" data-chave="'+esc(p.chave)+'">' +
                '<input type="text" class="pv-empresa" list="'+dlId+'" placeholder="Nome da empresa" autocomplete="off" required>' +
                '<datalist id="'+dlId+'">'+empresasFora.map(function(e){ return '<option value="'+esc(e.nome)+'">'; }).join("")+'</datalist>' +
                '<select class="pv-setor" required><option value="">Setor…</option></select>' +
                '<button type="submit" class="fbtn">Vincular</button><button type="button" class="fbtn" data-action="pessoa-vincular-cancelar">Cancelar</button>' +
              '</form>';
            })()
          : '<button type="button" class="linkish" data-action="pessoa-vincular-abrir" data-chave="'+esc(p.chave)+'">+ Vincular a outra empresa</button>';
        corpo = editFields + registrosHtml + '<div class="pessoa-vincular-wrap">'+vincularForm+'</div>' +
          '<div class="pessoa-excluir-wrap"><button type="button" class="linkish red" data-action="excluir-pessoa" data-chave="'+esc(p.chave)+'">Excluir esta pessoa e todos os vínculos</button></div>';
      }
      var selP = ui.selPessoas.has(p.chave);
      return '<div class="prow pessoa-row'+(selP?" sel":"")+'" data-chave="'+esc(p.chave)+'">' +
        '<div class="pmain" data-action="toggle-pessoa" data-chave="'+esc(p.chave)+'"><input type="checkbox" class="sel-emp" data-action="sel-pessoa" data-chave="'+esc(p.chave)+'"'+(selP?" checked":"")+' aria-label="Selecionar '+esc(p.nome)+'" title="Selecionar para agendar em lote"><strong>'+esc(p.nome)+'</strong>'+chipP+pessoaEmpresaChipsHTML(p)+'<span class="pmain-sub">'+esc(sub)+'</span></div>' +
        corpo +
      '</div>';
    }).join("");
  }
  function renderBulkBarPessoas(){
    var chaves = {}; pessoasUnicas().forEach(function(p){ chaves[p.chave] = true; });
    ui.selPessoas.forEach(function(k){ if(!chaves[k]) ui.selPessoas.delete(k); });
    var n = ui.selPessoas.size;
    $("#bulkBarPessoas").hidden = !n;
    if(!n) return;
    $("#bulkPessoaCount").textContent = n + " pessoa" + (n === 1 ? "" : "s") + " selecionada" + (n === 1 ? "" : "s");
    var visiveis = ui.ultimaListaPessoas.length;
    $("#bulkPessoaTodas").textContent = "Selecionar as " + visiveis + " visíveis";
    $("#bulkPessoaTodas").hidden = !visiveis || ui.ultimaListaPessoas.every(function(k){ return ui.selPessoas.has(k); });
  }
  // O cadastro no Onvio é por empresa (cada contato), diferente do treinamento, que é da pessoa.
  function definirCadastroContato(id, setorKey, novo){
    var c = state.contatos.find(function(x){ return x.id === id; });
    if(!c || !dbRef) return;
    var antes = c.cadastroOnvio || null, deptos = ((antes && antes.deptos) || []).slice(), patch;
    if(novo !== "ativo" && cadastroInferido(c, setorKey)){ renderAll(); mostrarToast(c.nome + ": cadastro ativo porque o treinamento está concluído."); return; }
    if(novo === "ativo"){
      if(deptos.length && deptos.indexOf(setorKey) === -1) deptos.push(setorKey);
      patch = {status:"ativo", em:(antes && antes.status === "ativo" && antes.em) || hojeISO(), deptos:deptos};
    } else {
      var resto = deptos.filter(function(d){ return d !== setorKey; });
      patch = deptos.length > 1 && deptos.indexOf(setorKey) !== -1 ? {status:"ativo", em:(antes && antes.em) || hojeISO(), deptos:resto} : {status:"pendente", em:"", deptos:[]};
    }
    c.cadastroOnvio = patch;
    dbRef.collection("contatos").doc(id).update({cadastroOnvio:patch});
    registrarAtividade({tipo:"cadastro-contato", empresaId:c.empresaId, empresaNome:c.empresaNome, setor:setorKey, nome:c.nome, de:antes && antes.status === "ativo" ? "concluido" : "pendente", para:novo === "ativo" ? "concluido" : "pendente"});
    renderAll();
    mostrarToast(c.nome + ": cadastro " + (novo === "ativo" ? "ativo" : "removido"), "Desfazer", function(){
      c.cadastroOnvio = antes || {status:"pendente", em:"", deptos:[]};
      dbRef.collection("contatos").doc(id).update({cadastroOnvio:c.cadastroOnvio});
      renderAll();
    });
  }
  // O treinamento é da pessoa: contatos com o mesmo e-mail em outras empresas acompanham.
  function definirStatusContato(csId, novo, agendadoPara, semDesfazer){
    var csObj = state.contatos.find(function(x){ return x.id === csId; });
    if(!csObj || !dbRef) return;
    var alvos = [csObj].concat(mesmaPessoa(csObj));
    var antes = alvos.map(function(c){ return {id:c.id, statusTreinamento:c.statusTreinamento || "pendente", concluidoEm:c.concluidoEm || "", agendadoPara:c.agendadoPara || "", agendadoHora:c.agendadoHora || ""}; });
    var patch = {statusTreinamento:novo, concluidoEm: novo === "concluido" ? new Date().toISOString() : ""};
    patch.agendadoPara = novo === "agendado" ? (agendadoPara !== undefined ? agendadoPara : (csObj.agendadoPara || "")) : "";
    patch.agendadoHora = novo === "agendado" ? (csObj.agendadoHora || "") : "";
    alvos.forEach(function(c){
      registrarAtividade({tipo:"treino-contato", empresaId:c.empresaId, empresaNome:c.empresaNome, nome:c.nome, de:c.statusTreinamento || "pendente", para:novo});
      Object.assign(c, patch);
      dbRef.collection("contatos").doc(c.id).update(patch);
    });
    renderAll();
    if(semDesfazer) return;
    var extra = alvos.length > 1 ? " (também em " + (alvos.length - 1) + " outra" + (alvos.length > 2 ? "s" : "") + " empresa" + (alvos.length > 2 ? "s" : "") + ")" : "";
    mostrarToast(csObj.nome + ": " + STATUS_LABEL[novo] + extra, "Desfazer", function(){
      antes.forEach(function(a){
        var c = state.contatos.find(function(x){ return x.id === a.id; });
        var p0 = {statusTreinamento:a.statusTreinamento, concluidoEm:a.concluidoEm, agendadoPara:a.agendadoPara, agendadoHora:a.agendadoHora || ""};
        if(c) Object.assign(c, p0);
        dbRef.collection("contatos").doc(a.id).update(p0);
      });
      renderAll();
    });
  }
  // Uma chamada por pessoa (não por vínculo): definirStatusContato já propaga pro mesmo e-mail
  // em outras empresas, então selecionar 3 empresas da mesma pessoa não grava 3 vezes à toa.
  function aplicarTreinoEmLotePessoas(){
    var novo = $("#bulkPessoaStatus").value, data = $("#bulkPessoaData").value;
    if(novo === "agendado" && !data){ mostrarToast("Escolha a data do treinamento."); $("#bulkPessoaData").focus(); return; }
    var pessoas = pessoasUnicas().filter(function(p){ return ui.selPessoas.has(p.chave); });
    if(!pessoas.length) return;
    var antes = [];
    pessoas.forEach(function(p){ p.registros.forEach(function(c){ antes.push({id:c.id, statusTreinamento:c.statusTreinamento || "pendente", concluidoEm:c.concluidoEm || "", agendadoPara:c.agendadoPara || ""}); }); });
    emLote(function(){
      pessoas.forEach(function(p){ definirStatusContato(p.registros[0].id, novo, novo === "agendado" ? data : undefined, true); });
    });
    ui.selPessoas.clear();
    var rot = STATUS_LABEL[novo] + (novo === "agendado" ? " · " + dataCurta(data) : "");
    mostrarToast(pessoas.length + " pessoa" + (pessoas.length === 1 ? "" : "s") + " marcada" + (pessoas.length === 1 ? "" : "s") + " como " + rot, "Desfazer", function(){
      emLote(function(){
        antes.forEach(function(a){
          var c = state.contatos.find(function(x){ return x.id === a.id; });
          var p0 = {statusTreinamento:a.statusTreinamento, concluidoEm:a.concluidoEm, agendadoPara:a.agendadoPara};
          if(c) Object.assign(c, p0);
          if(dbRef) dbRef.collection("contatos").doc(a.id).update(p0);
        });
      });
    });
  }
  function definirStatusFuncionario(fid, novo, agendadoPara, semDesfazer){
    var f = state.funcionarios.find(function(x){ return x.id === fid; });
    if(!f || !dbRef) return;
    var antes = {statusTreinamento:f.statusTreinamento || "pendente", concluidoEm:f.concluidoEm || "", agendadoPara:f.agendadoPara || "", agendadoHora:f.agendadoHora || ""};
    var patch = {statusTreinamento:novo, concluidoEm: novo === "concluido" ? new Date().toISOString() : ""};
    patch.agendadoPara = novo === "agendado" ? (agendadoPara !== undefined ? agendadoPara : (f.agendadoPara || "")) : "";
    patch.agendadoHora = novo === "agendado" ? (f.agendadoHora || "") : "";
    registrarAtividade({tipo:"treino-func", setor:f.setor, nome:f.nome, de:f.statusTreinamento || "pendente", para:novo});
    Object.assign(f, patch);
    dbRef.collection("funcionarios").doc(fid).update(patch);
    renderAll();
    if(semDesfazer) return;
    mostrarToast(f.nome + ": " + STATUS_LABEL[novo], "Desfazer", function(){
      Object.assign(f, antes);
      dbRef.collection("funcionarios").doc(fid).update(antes);
      renderAll();
    });
  }

  /* ---------- campos de data do agendamento ----------
     O navegador dispara "change" a cada dígito assim que a data fica válida (ano 0002, 0020...).
     Por isso nada é salvo nem redesenhado enquanto o campo está em foco: só ao sair dele. */
  var datasPendentes = {}, renderAdiado = false;
  function editandoData(){ var a = document.activeElement; return !!(a && a.classList && a.classList.contains("ag-input")); }
  function dataValida(v){ return !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && +v.slice(0, 4) >= 2000 && +v.slice(0, 4) <= 2100); }
  function edicaoDataDe(el){
    var v = el.value;
    var ehHora = el.classList.contains("ag-hora"), campoAg = ehHora ? "agendadoHora" : "agendadoPara";
    var patchAg = function(){ var o = {}; o[campoAg] = v; return o; };
    if(el.classList.contains("cont-ag-data")){
      var id = el.getAttribute("data-id");
      var alvosC = function(){ var c = state.contatos.find(function(x){ return x.id === id; }); return c ? [c].concat(mesmaPessoa(c).filter(function(o){ return o.statusTreinamento === "agendado"; })) : []; };
      return {
        aplicar:function(){ alvosC().forEach(function(c){ c[campoAg] = v; }); },
        salvar:function(){ var ids = alvosC().map(function(c){ return c.id; }); if(!ids.length) ids = [id]; return Promise.all(ids.map(function(i){ return dbRef.collection("contatos").doc(i).update(patchAg()); })); },
        valor:v, hora:ehHora
      };
    }
    if(el.classList.contains("foco-prazo")){
      var idPz = el.getAttribute("data-id");
      return {
        aplicar:function(){ var em = state.empresas.find(function(x){ return x.id === idPz; }); if(em) em.focoPrazo = v; },
        salvar:function(){ return dbRef.collection("empresas").doc(idPz).update({focoPrazo:v}); },
        valor:v
      };
    }
    if(el.classList.contains("func-ag-data")){
      var idF = el.getAttribute("data-id");
      return {
        aplicar:function(){ var f = state.funcionarios.find(function(x){ return x.id === idF; }); if(f) f[campoAg] = v; },
        salvar:function(){ return dbRef.collection("funcionarios").doc(idF).update(patchAg()); },
        valor:v, hora:ehHora
      };
    }
    if(el.classList.contains("conc-data") && el.hasAttribute("data-alinh")){
      var setorA = el.getAttribute("data-alinh");
      return {
        aplicar:function(){ var a = state.alinhamentoSetor.find(function(x){ return x.id === setorA; }); if(a) a.data = v; },
        salvar:function(){ return dbRef.collection("setorAlinhamento").doc(setorA).update({data:v}); },
        valor:v, obrigatoria:true
      };
    }
    if(el.classList.contains("conc-data") && el.getAttribute("data-etapa") === "habilitacaoDominio"){
      var empH = el.getAttribute("data-empresa");
      return {
        aplicar:function(){ var eH = empresaPorId(empH); if(eH) eH.habilitacao = habilitacaoCompleta(empH, {data:v}); },
        salvar:function(){ return salvarHabilitacao(empH, {data:v}); },
        valor:v, obrigatoria:true
      };
    }
    if(el.classList.contains("conc-data")){
      var empC = el.getAttribute("data-empresa"), setorC = el.getAttribute("data-setor"), etapaC = el.getAttribute("data-etapa"), docC = sid(empC, setorC);
      var fC = etapaC === "treinamentoAnalista" ? etapaAnalistaEfetiva(state.setores.find(function(x){ return x.id === docC; })) : null;
      if(fC && fC.herdado) return {
        aplicar:function(){ fC.func.concluidoEm = v; },
        salvar:function(){ return dbRef.collection("funcionarios").doc(fC.func.id).update({concluidoEm:v}); },
        valor:v, obrigatoria:true
      };
      return {
        aplicar:function(){
          var d = state.setores.find(function(x){ return x.id === docC; });
          if(d){ d.etapas = Object.assign({}, d.etapas); d.etapas[etapaC] = Object.assign({}, d.etapas[etapaC], {data:v}); }
        },
        salvar:function(){ var p = {}; p[etapaC] = {data:v}; return garantirSetorDoc(empC, setorC).then(function(i){ return dbRef.collection("empresaSetores").doc(i).update({etapas:p}); }); },
        valor:v, obrigatoria:true
      };
    }
    var emp = el.getAttribute("data-empresa"), setor = el.getAttribute("data-setor"), etapa = el.getAttribute("data-etapa"), docId = sid(emp, setor);
    var fA = etapa === "treinamentoAnalista" ? funcAnalistaDoDoc(state.setores.find(function(s){ return s.id === docId; })) : null;
    if(fA && fA.statusTreinamento !== "agendado") fA = null;
    return {
      aplicar:function(){
        var d = state.setores.find(function(s){ return s.id === docId; });
        if(d){ d.etapas = Object.assign({}, d.etapas); d.etapas[etapa] = Object.assign({}, d.etapas[etapa], patchAg()); }
        if(fA) fA[campoAg] = v;
      },
      salvar:function(){
        var p = {}; p[etapa] = patchAg();
        var w = garantirSetorDoc(emp, setor).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({etapas:p}); });
        return fA ? Promise.all([w, dbRef.collection("funcionarios").doc(fA.id).update(patchAg())]) : w;
      },
      valor:v, hora:ehHora
    };
  }
  function registrarEdicaoData(el){
    var ed = edicaoDataDe(el);
    datasPendentes[el.id || ("sem-id-" + Math.random())] = ed;
    el.classList.toggle("vazio", !el.value);
    if(document.activeElement !== el) setTimeout(concluirEdicaoData, 0);
  }
  function concluirEdicaoData(){
    var ativo = document.activeElement, invalida = false, salvou = false;
    Object.keys(datasPendentes).forEach(function(k){
      if(ativo && ativo.id === k) return;
      var ed = datasPendentes[k]; delete datasPendentes[k];
      if(!(ed.hora ? horaValida(ed.valor) : dataValida(ed.valor)) || (ed.obrigatoria && !ed.valor)){ invalida = true; return; }
      ed.aplicar(); salvou = true;
      if(dbRef) ed.salvar().catch(function(){ mostrarToast("Não foi possível salvar a data."); });
    });
    if(invalida) mostrarToast("Data ou horário incompleto: confira o dia, o mês, o ano (4 dígitos) e a hora.");
    if(salvou || invalida) renderAdiado = true;
    if(renderAdiado && !editandoData()){ renderAdiado = false; renderAll(); }
  }
  document.addEventListener("focusout", function(ev){
    if(!(ev.target.classList && ev.target.classList.contains("ag-input"))) return;
    setTimeout(concluirEdicaoData, 0);
  });
  document.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("ag-input")){ ev.preventDefault(); ev.target.blur(); }
  });
  window.addEventListener("pagehide", function(){ if(Object.keys(datasPendentes).length) concluirEdicaoData(); });

  var LIMITE_BANCO = 5000;
  function renderUsoBanco(){
    var partes = [["empresas", state.empresas.length, "empresa"], ["frentes", state.setores.length, "frente"], ["contatos", state.contatos.length, "contato"], ["funcionários", state.funcionarios.length, "funcionário"], ["dias de registro", state.historico.length, "dia de registro"], ["outros registros", state.alinhamentoSetor.length + state.auditoriaDominio.length, "outro registro"]];
    var total = partes.reduce(function(a, p){ return a + p[1]; }, 0), frac = total / LIMITE_BANCO, alerta = frac >= 0.8;
    var box = $("#dbUso");
    box.classList.toggle("alerta", alerta);
    box.innerHTML = '<div class="db-uso-top"><span>Uso do banco de dados: <b>'+fmtNum(total)+'</b> de <b>'+fmtNum(LIMITE_BANCO)+'</b> registros ('+Math.round(frac * 100)+'%)</span></div>' +
      '<div class="hbar-track"><div class="hbar-fill" style="width:'+Math.min(100, Math.round(frac * 100))+'%"></div></div>' +
      '<span class="note">'+partes.filter(function(p){ return p[1]; }).map(function(p){ return fmtNum(p[1])+' '+(p[1] === 1 ? p[2] : p[0]); }).join(' · ')+
      (alerta ? '. Está perto do limite: baixe um backup e remova empresas inativas ou contatos que não são mais necessários.' : '.')+'</span>';
    var banner = $("#dbCheio");
    banner.hidden = frac < 0.9;
    if(frac >= 0.9) banner.innerHTML = WARN_ICON + '<div><strong>O banco de dados está quase cheio</strong>'+fmtNum(total)+' de '+fmtNum(LIMITE_BANCO)+' registros usados. Quando encher, novas alterações deixam de ser salvas. Veja os detalhes na aba Cadastro.</div>';
  }

  /* ---------- lembrar aba e filtros (só neste navegador) ---------- */
  var CHAVE_UI = "ct-painel-ui";
  function salvarUI(){
    try{
      localStorage.setItem(CHAVE_UI, JSON.stringify({
        view:ui.view, filtroSetor:ui.filtroSetor, soPendentes:ui.soPendentes, soImpedimento:ui.soImpedimento, soSemAnalista:ui.soSemAnalista, soSemContato:ui.soSemContato, soConcluidas:ui.soConcluidas,
        focoModo:ui.focoModo, focoEtapaSel:ui.focoEtapaSel, focoEtapaStatus:ui.focoEtapaStatus, treinoStatus:ui.treinoStatus, agendaCompleta:!!ui.agendaCompleta,
        focoEtapaSetor:ui.focoEtapaSetor, focoEtapaAnalista:ui.focoEtapaAnalista, focoEtapaOrdem:ui.focoEtapaOrdem,
        pessoasFiltroSetor:ui.pessoasFiltroSetor, focoOrdem:ui.focoOrdem, focoEtapaFiltrosAbertos:!!ui.focoEtapaFiltrosAbertos,
        consModo:ui.consModo, consEtapaSel:ui.consEtapaSel, consEtapaOrdem:ui.consEtapaOrdem, consEtapaFiltrosAbertos:!!ui.consEtapaFiltrosAbertos,
        rel:{periodo:ui.rel.periodo, setor:ui.rel.setor, soFoco:ui.rel.soFoco, tipoAtv:ui.rel.tipoAtv, de:ui.rel.de, ate:ui.rel.ate}
      }));
    }catch(e){}
  }
  function restaurarUI(){
    var d = null;
    try{ d = JSON.parse(localStorage.getItem(CHAVE_UI) || "null"); }catch(e){ d = null; }
    if(!d || typeof d !== "object") return;
    // A aba inicial é sempre "Hoje": a aba salva da última visita não é restaurada.
    ui.view = "dashboard";
    if(["todos","pessoal","contabil","fiscal"].indexOf(d.filtroSetor) !== -1) ui.filtroSetor = d.filtroSetor;
    ["soPendentes","soImpedimento","soSemAnalista","soSemContato","soConcluidas","agendaCompleta"].forEach(function(k){ if(typeof d[k] === "boolean") ui[k] = d[k]; });
    if(d.focoModo === "empresa" || d.focoModo === "etapa") ui.focoModo = d.focoModo;
    if(["recentes","parada","prazo","progresso","impedimento"].indexOf(d.focoOrdem) !== -1) ui.focoOrdem = d.focoOrdem;
    if(typeof d.focoEtapaFiltrosAbertos === "boolean") ui.focoEtapaFiltrosAbertos = d.focoEtapaFiltrosAbertos;
    if(d.consModo === "empresa" || d.consModo === "etapa") ui.consModo = d.consModo;
    if(ETAPAS.some(function(et){ return et.key === d.consEtapaSel; })) ui.consEtapaSel = d.consEtapaSel;
    if(["empresa","pendentes","analista"].indexOf(d.consEtapaOrdem) !== -1) ui.consEtapaOrdem = d.consEtapaOrdem;
    if(typeof d.consEtapaFiltrosAbertos === "boolean") ui.consEtapaFiltrosAbertos = d.consEtapaFiltrosAbertos;
    if(ETAPAS.some(function(et){ return et.key === d.focoEtapaSel; })) ui.focoEtapaSel = d.focoEtapaSel;
    if(["todos","pessoal","contabil","fiscal"].indexOf(d.focoEtapaSetor) !== -1) ui.focoEtapaSetor = d.focoEtapaSetor;
    if(typeof d.focoEtapaAnalista === "string") ui.focoEtapaAnalista = d.focoEtapaAnalista;
    if(["empresa","pendentes","analista"].indexOf(d.focoEtapaOrdem) !== -1) ui.focoEtapaOrdem = d.focoEtapaOrdem;
    if(d.focoEtapaStatus === "todos" || STATUS_CLIENTE.indexOf(d.focoEtapaStatus) !== -1) ui.focoEtapaStatus = d.focoEtapaStatus;
    if(d.treinoStatus === "todos" || STATUS_CLIENTE.indexOf(d.treinoStatus) !== -1) ui.treinoStatus = d.treinoStatus;
    if(["todos","pessoal","contabil","fiscal"].indexOf(d.pessoasFiltroSetor) !== -1) ui.pessoasFiltroSetor = d.pessoasFiltroSetor;
    if(d.rel && typeof d.rel === "object"){
      if(["7","30","90","tudo","custom"].indexOf(d.rel.periodo) !== -1) ui.rel.periodo = d.rel.periodo;
      if(["todos","pessoal","contabil","fiscal"].indexOf(d.rel.setor) !== -1) ui.rel.setor = d.rel.setor;
      if(typeof d.rel.soFoco === "boolean") ui.rel.soFoco = d.rel.soFoco;
      if(typeof d.rel.tipoAtv === "string") ui.rel.tipoAtv = d.rel.tipoAtv;
      if(/^\d{4}-\d{2}-\d{2}$/.test(d.rel.de || "")) ui.rel.de = d.rel.de;
      if(/^\d{4}-\d{2}-\d{2}$/.test(d.rel.ate || "")) ui.rel.ate = d.rel.ate;
    }
  }

  // Só a aba visível é redesenhada; as outras ficam marcadas e são redesenhadas ao serem abertas.
  var VIEWS = ["dashboard","progresso","foco","impedimentos","relatorios","cadastro"];
  var viewsSujas = {};
  /* ---------- gravações: "salvando…" e o que não foi salvo ---------- */
  // Toda escrita no banco passa por aqui; o que falhar (sem conexão, banco cheio…) fica guardado para tentar de novo.
  var gravacoes = {pendentes:0, falhas:[]}, tSalv = null;
  var FALHA_ESPERADA = {invalid_argument:1, not_found:1, declined:1, sem_permissao:1};
  /* ---------- níveis de acesso (login do Hub, auth.js) ---------- */
  // O módulo só funciona aberto pelo Hub; sem o login ele volta para a tela inicial.
  function authP(){ try{ var P = window.parent; return (P && P !== window && P.__auth) || window.__auth || null; }catch(e){ return null; } }
  if(!authP()){ try{ location.replace("index.html"); }catch(e){} }
  // Faixa de aviso para quem não é coordenação.
  function avisoAcesso(){
    var A = authP(); if(!A) return; var n = A.nivel("portal"); if(n === "coord") return;
    var d = document.createElement("div"); d.setAttribute("role", "status");
    d.style.cssText = "position:sticky;top:0;z-index:50;background:#FBEBDD;color:#101820;border-bottom:1px solid #B5530C;padding:6px 16px;font:600 12.5px 'IBM Plex Sans',system-ui,sans-serif";
    d.textContent = n === "analista" ? "Você altera só as empresas e frentes em que é o analista. O resto é só consulta." : "Modo consulta: você pode ver tudo, mas não alterar o Portal do Cliente.";
    (document.body || document.documentElement).insertBefore(d, (document.body || document.documentElement).firstChild);
  }
  document.addEventListener("DOMContentLoaded", avisoAcesso);
  // Devolve o motivo de recusar a gravação (vazio = pode). A tela do Portal não esconde botões, então esta barreira é a que vale.
  function motivoNegadoPortal(col, id, op, data){
    var A = authP(); if(!A) return "";
    var n = A.nivel("portal"); if(n === "coord") return "";
    if(n !== "analista") return "Seu acesso ao Portal do Cliente é só de consulta.";
    if(col === "historico") return "";
    var eu = normBusca(A.analista("portal")); if(!eu) return "Seu usuário ainda não está ligado a um nome de analista no Portal. Peça ao administrador.";
    var meu = function(empresaId, setores){ return state.setores.some(function(s){ return s.empresaId === empresaId && (!setores || !setores.length || setores.indexOf(s.setor) !== -1) && normBusca(s.analistaNome) === eu; }); };
    if(col === "empresaSetores"){ var d = state.setores.filter(function(x){ return x.id === id; })[0]; return d && normBusca(d.analistaNome) === eu ? "" : "Você só altera as frentes em que é o analista."; }
    if(col === "contatos"){ var c = state.contatos.filter(function(x){ return x.id === id; })[0] || data || {}; return meu(c.empresaId, c.setores) ? "" : "Você só altera contatos das empresas em que é o analista."; }
    if(col === "empresas") return meu(id) ? "" : "Você só altera empresas em que é o analista.";
    if(col === "funcionarios"){ var f = state.funcionarios.filter(function(x){ return x.id === id; })[0]; return f && normBusca(f.nome) === eu ? "" : "Só a coordenação altera a equipe."; }
    return "Só a coordenação altera isto.";
  }
  var tInicioP = Date.now(), tAvisoP = 0;
  function recusarPortal(msg){
    // Gravações automáticas do começo (criar documentos que faltam) não merecem aviso; as da pessoa, sim.
    if(Date.now() - tInicioP > 6000 && Date.now() - tAvisoP > 4000){ tAvisoP = Date.now(); try{ mostrarToast(msg + " Nada foi salvo; recarregue a página para ver o que está salvo."); }catch(e){} }
    var err = new Error(msg); err.code = "sem_permissao"; var pr = Promise.reject(err); pr.catch(function(){}); return pr;
  }
  function acompanharGravacao(fn){
    gravacoes.pendentes++; atualizarSalvamento();
    var p; try{ p = Promise.resolve(fn()); }catch(e){ p = Promise.reject(e); }
    return p.then(function(r){ gravacoes.pendentes--; atualizarSalvamento(); return r; }, function(err){
      gravacoes.pendentes--;
      if(!(err && FALHA_ESPERADA[err.code])) gravacoes.falhas.push(fn);
      atualizarSalvamento();
      throw err;
    });
  }
  function monitorarGravacoes(db){
    // O Proxy envolve um objeto vazio (e não o objeto do banco): se o objeto do banco for congelado,
    // um Proxy direto sobre ele é recusado pelo navegador e nada carrega.
    var envolve = function(t, troca){
      return new Proxy({}, {
        get:function(_, p){
          if(troca && troca[p]) return troca[p];
          var v = t[p]; return typeof v === "function" ? v.bind(t) : v;
        },
        has:function(_, p){ return p in t; }
      });
    };
    var gravar = function(t, p, nome, id){ return function(){ var a = arguments, neg = motivoNegadoPortal(nome, id, p, a[0]); if(neg) return recusarPortal(neg); return acompanharGravacao(function(){ return t[p].apply(t, a); }); }; };
    var doc = function(ref, nome, id){ return envolve(ref, {update:gravar(ref, "update", nome, id), set:gravar(ref, "set", nome, id), "delete":gravar(ref, "delete", nome, id)}); };
    var col = function(c, nome){ return envolve(c, {doc:function(id){ return doc(c.doc(id), nome, id); }, add:gravar(c, "add", nome, "")}); };
    return envolve(db, {collection:function(n){ return col(db.collection(n), n); }});
  }
  function atualizarSalvamento(){
    var el = document.getElementById("salvamento"); if(!el) return;
    clearTimeout(tSalv);
    if(gravacoes.falhas.length){
      el.hidden = false; el.className = "salv erro";
      el.innerHTML = '⚠ ' + gravacoes.falhas.length + ' alteraç' + (gravacoes.falhas.length === 1 ? 'ão' : 'ões') + ' não salva' + (gravacoes.falhas.length === 1 ? '' : 's') + ' <button type="button" data-action="salv-tentar">Tentar de novo</button>';
    } else if(gravacoes.pendentes){
      tSalv = setTimeout(function(){ el.hidden = false; el.className = "salv"; el.textContent = "Salvando…"; }, 600);
    } else { el.hidden = true; el.textContent = ""; }
  }
  window.addEventListener("beforeunload", function(ev){ if(gravacoes.pendentes || gravacoes.falhas.length){ ev.preventDefault(); ev.returnValue = ""; } });

  /* ---------- atalhos de teclado ---------- */
  // "/" busca na aba atual · "g" + letra troca de aba · "?" mostra a lista.
  (function(){
    var gEm = 0;
    var ABAS = {h:"dashboard", c:"progresso", f:"foco", i:"impedimentos", r:"relatorios", k:"cadastro"};
    document.addEventListener("keydown", function(ev){
      if(ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var t = ev.target;
      if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if(document.querySelector(".agd-bg:not([hidden]), #cfm-bg:not([hidden])")) return;
      if(gEm && Date.now() - gEm < 1200 && ABAS[ev.key]){ ev.preventDefault(); gEm = 0; setView(ABAS[ev.key]); window.scrollTo({top:0}); return; }
      gEm = 0;
      if(ev.key === "g"){ gEm = Date.now(); return; }
      if(ev.key === "?"){ ev.preventDefault(); mostrarToast("Atalhos: / busca na aba · g h Hoje · g c Consulta · g f Foco · g i Impedimentos · g r Relatórios · g k Cadastro · Esc fecha"); return; }
      if(ev.key === "/" && ui.view !== "foco"){
        var alvo = ui.view === "progresso" ? (mostrarSecaoConsulta("secEmpresas"), $("#empresaSearch")) : ui.view === "impedimentos" ? $("#impSearch") : $("#globalSearch");
        if(alvo && alvo === $("#globalSearch") && window.innerWidth <= 700){ var lupa = $("#btnBuscaMobile"); if(lupa && lupa.getAttribute("aria-expanded") !== "true") lupa.click(); }
        if(alvo){ ev.preventDefault(); alvo.focus(); }
      }
    });
  })();

  /* ---------- conferir dados ---------- */
  // Inconsistências que fazem informação sumir das telas e dos números, com a correção à mão.
  var memoProb = {};
  function problemasDados(){
    var refs = [state.setores, state.contatos, state.empresas, state.funcionarios];
    var tam = refs.map(function(r){ return r.length; }).join(",");
    if(memoProb.p && memoProb.refs.every(function(r, i){ return r === refs[i]; }) && memoProb.tam === tam && !memoProb.sujo) return memoProb.p;
    var p = calcularProblemasDados();
    memoProb = {refs:refs, tam:tam, p:p};
    return p;
  }
  function calcularProblemasDados(){
    var p = {analistas:[], contatosSemSetor:[], contatosForaDemanda:[], semData:[], semCargo:[]};
    var porNome = {};
    state.setores.forEach(function(sd){
      var nome = String(sd.analistaNome || "").trim();
      if(!nome || resolverAnalista(sd).id) return;
      var emp = empresaPorId(sd.empresaId);
      if(!emp || !(emp.setoresDemanda && emp.setoresDemanda[sd.setor])) return;
      var k = normBusca(nome);
      if(!porNome[k]){ porNome[k] = {nome:nome, frentes:[], setores:{}}; p.analistas.push(porNome[k]); }
      porNome[k].frentes.push(sd); porNome[k].setores[sd.setor] = (porNome[k].setores[sd.setor] || 0) + 1;
    });
    p.analistas.sort(function(a, b){ return b.frentes.length - a.frentes.length || a.nome.localeCompare(b.nome, "pt-BR"); });
    var grupos = {};
    state.contatos.forEach(function(c){
      var emp = empresaPorId(c.empresaId);
      if(!emp) return;
      if(!(c.setores || []).length){ p.contatosSemSetor.push({c:c, e:emp}); return; }
      (c.setores || []).forEach(function(sk){
        if(emp.setoresDemanda && emp.setoresDemanda[sk]) return;
        var k = emp.id + "|" + sk;
        if(!grupos[k]){ grupos[k] = {e:emp, setor:sk, contatos:[]}; p.contatosForaDemanda.push(grupos[k]); }
        grupos[k].contatos.push(c);
      });
    });
    p.contatosForaDemanda.sort(function(a, b){ return a.e.nome.localeCompare(b.e.nome, "pt-BR"); });
    state.empresas.forEach(function(e){
      var fs = frentesDaEmpresa(e, setoresDocsDe(e.id));
      if(!fs.length) return;
      var h = habilitacaoEmpresa(e.id);
      if(h.status === "concluido" && !h.data) p.semData.push({tipo:"hab", e:e});
      fs.forEach(function(sd){
        if(sd.semRegistro) return;
        ETAPAS.forEach(function(et){
          if(et.porEmpresa || et.calculada || et.key === "treinamentoCliente") return;
          if(et.onlyIf && !et.onlyIf(e, sd.setor)) return;
          var own = sd.etapas && sd.etapas[et.key];
          if(own && own.status === "concluido" && !own.data) p.semData.push({tipo:"etapa", e:e, doc:sd, key:et.key});
        });
      });
    });
    p.semCargo = state.funcionarios.filter(function(f){ return !String(f.cargo || "").trim(); }).sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
    p.grupos = gruposSugeridos();
    p.filiaisComDados = filiaisComDados();
    p.total = p.grupos.length + p.filiaisComDados.length + p.analistas.length + p.contatosSemSetor.length + p.contatosForaDemanda.length + (p.semData.length ? 1 : 0) + p.semCargo.length;
    return p;
  }
  function renderConferir(){
    var box = $("#conferirBox");
    if(!box) return;
    var p = problemasDados();
    $("#confCount").textContent = p.total ? p.total + " ponto" + (p.total === 1 ? "" : "s") : "tudo certo";
    if(!p.total){ box.innerHTML = '<div class="conf-ok">Nenhuma inconsistência encontrada nos dados.</div>'; return; }
    var LIM = ui.confTudo ? 1e9 : 8;
    var mais = function(n){ return n > LIM ? '<button type="button" class="linkish conf-mais" data-action="conf-tudo">Ver todos ('+n+')</button>' : ''; };
    var funcOpts = state.funcionarios.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).map(function(f){ return '<option value="'+f.id+'">'+esc(f.nome)+'</option>'; }).join("");
    var secao = function(tit, ajuda, n, corpo){
      if(!n) return "";
      return '<details class="conf-sec"'+(ui.confAbertas[tit] ? ' open' : '')+' data-tit="'+esc(tit)+'"><summary><span class="conf-tit">'+tit+'</span><span class="conf-n">'+n+'</span></summary><p class="conf-ajuda">'+ajuda+'</p>'+corpo+'</details>';
    };
    var h = "";
    var nFil = p.grupos.reduce(function(n, g){ return n + g.fs.length; }, 0);
    h += secao("Empresas que parecem matriz e filiais", "Mesma raiz de CNPJ (8 primeiros dígitos), com a matriz terminando em 0001. Ao vincular, os contatos, as frentes e as etapas das filiais passam para a matriz (fica o status mais adiantado de cada etapa) e o grupo conta como uma empresa só. Baixe o backup completo antes de vincular muitos de uma vez.", p.grupos.length,
      (p.grupos.length > 1 ? '<div class="conf-item conf-todos"><span class="conf-main"><b>'+p.grupos.length+' grupos · '+nFil+' filiais</b></span><span class="conf-acoes"><button type="button" class="fbtn" data-action="conf-vincular-todos">Vincular todos</button></span></div>' : '') +
      p.grupos.slice(0, LIM).map(function(g){
        return '<div class="conf-item"><span class="conf-main"><b>'+esc(g.m.nome)+'</b><span class="conf-sub">Matriz '+esc(g.m.cnpj || "")+' · filia'+(g.fs.length === 1 ? 'l' : 'is')+': '+g.fs.map(function(f){ return esc(f.nome)+(f.cnpj ? ' ('+esc(f.cnpj)+')' : ''); }).join(", ")+'</span></span>' +
          '<span class="conf-acoes"><button type="button" class="fbtn" data-action="conf-vincular-grupo" data-matriz="'+g.m.id+'">Vincular '+(g.fs.length === 1 ? 'a filial' : 'as '+g.fs.length+' filiais')+'</button></span></div>';
      }).join("") + mais(p.grupos.length));
    h += secao("Filiais com dados ainda separados", "A filial já está ligada à matriz, mas ainda tem contatos ou frentes próprios (por exemplo, vindos de uma importação). Juntar passa tudo para a matriz.", p.filiaisComDados.length,
      p.filiaisComDados.slice(0, LIM).map(function(x){
        return '<div class="conf-item"><span class="conf-main"><b>'+esc(x.f.nome)+'</b><span class="conf-sub">filial de '+esc(x.m.nome)+' · '+x.contatos+' contato(s) · '+x.frentes+' frente(s)</span></span>' +
          '<span class="conf-acoes"><button type="button" class="fbtn" data-action="conf-juntar-filial" data-filial="'+x.f.id+'">Juntar na matriz</button></span></div>';
      }).join("") + mais(p.filiaisComDados.length));
    h += secao("Analistas que não estão cadastrados na Equipe", "Frentes com um nome digitado que não corresponde a ninguém da Equipe: ficam fora da carteira, do filtro por analista e do treinamento herdado.", p.analistas.length,
      p.analistas.slice(0, LIM).map(function(a){
        var setores = Object.keys(a.setores).map(function(k){ return SETOR_TAG[k] + " " + a.setores[k]; }).join(" · ");
        return '<div class="conf-item" data-nome="'+esc(a.nome)+'"><span class="conf-main"><b>'+esc(a.nome)+'</b><span class="conf-sub">'+a.frentes.length+' frente'+(a.frentes.length === 1 ? '' : 's')+' · '+setores+'</span></span>' +
          '<span class="conf-acoes"><button type="button" class="fbtn" data-action="conf-cadastrar-analista" data-nome="'+esc(a.nome)+'">Cadastrar na Equipe</button>' +
          '<span class="conf-ou">ou é</span><select class="conf-mesma" aria-label="É a mesma pessoa que"><option value="">a mesma pessoa que…</option>'+funcOpts+'</select>' +
          '<button type="button" class="fbtn" data-action="conf-juntar-analista" data-nome="'+esc(a.nome)+'">Juntar</button></span></div>';
      }).join("") + mais(p.analistas.length));
    h += secao("Contatos em setor sem demanda", "O contato está marcado num setor em que a empresa não tem demanda, então não aparece no bloco da empresa nem conta no treinamento dos clientes.", p.contatosForaDemanda.length,
      p.contatosForaDemanda.slice(0, LIM).map(function(g){
        return '<div class="conf-item"><span class="conf-main"><b>'+esc(g.e.nome)+' · '+SETOR_LABEL[g.setor]+'</b><span class="conf-sub">'+g.contatos.map(function(c){ return esc(c.nome); }).join(", ")+'</span></span>' +
          '<span class="conf-acoes"><button type="button" class="fbtn" data-action="conf-marcar-demanda" data-empresa="'+g.e.id+'" data-setor="'+g.setor+'">Marcar demanda no '+SETOR_LABEL[g.setor]+'</button>' +
          '<button type="button" class="linkish" data-action="conf-tirar-setor" data-empresa="'+g.e.id+'" data-setor="'+g.setor+'">Tirar o '+SETOR_LABEL[g.setor]+' '+(g.contatos.length === 1 ? 'do contato' : 'dos contatos')+'</button></span></div>';
      }).join("") + mais(p.contatosForaDemanda.length));
    h += secao("Contatos sem nenhum setor", "Sem setor, o contato não aparece em nenhum bloco de empresa.", p.contatosSemSetor.length,
      p.contatosSemSetor.slice(0, LIM).map(function(x){
        var opts = SETORES.map(function(s){ return '<option value="'+s.key+'"'+(x.e.setoresDemanda && x.e.setoresDemanda[s.key] ? '' : ' disabled')+'>'+s.label+'</option>'; }).join("");
        return '<div class="conf-item"><span class="conf-main"><b>'+esc(x.c.nome)+'</b><span class="conf-sub">'+esc(x.e.nome)+'</span></span>' +
          '<span class="conf-acoes"><select class="conf-setor-contato" data-id="'+x.c.id+'" aria-label="Setor do contato"><option value="">Escolha o setor…</option>'+opts+'</select></span></div>';
      }).join("") + mais(p.contatosSemSetor.length));
    h += secao("Etapas concluídas sem data", "Sem data de conclusão a etapa não entra em nenhum período dos Relatórios. Se não souber a data exata, use uma aproximada (por exemplo, o início da implantação).", p.semData.length,
      '<div class="conf-item"><span class="conf-main"><b>'+p.semData.length+' etapa'+(p.semData.length === 1 ? '' : 's')+' concluída'+(p.semData.length === 1 ? '' : 's')+' sem data</b><span class="conf-sub">'+p.semData.slice(0, 6).map(function(x){ return esc(x.e.nome) + (x.tipo === "hab" ? " · Habilitação" : " · " + SETOR_TAG[x.doc.setor]); }).join(", ")+(p.semData.length > 6 ? "…" : "")+'</span></span>' +
        '<span class="conf-acoes"><label class="conf-data">Concluídas em <input type="date" id="confDataLote" class="ag-input" value="'+esc(hojeISO())+'"></label><button type="button" class="fbtn" data-action="conf-preencher-datas">Preencher todas</button></span></div>');
    h += secao("Funcionários sem cargo", "Escolha o cargo aqui mesmo.", p.semCargo.length,
      p.semCargo.slice(0, LIM).map(function(fu){
        return '<div class="conf-item"><span class="conf-main"><b>'+esc(fu.nome)+'</b><span class="conf-sub">'+esc(SETOR_LABEL[fu.setor] || "")+'</span></span>' +
          '<span class="conf-acoes"><select class="func-cargo" data-id="'+fu.id+'" aria-label="Cargo de '+esc(fu.nome)+'"><option value="">Escolha o cargo…</option>'+CARGOS.map(function(c){ return '<option>'+c+'</option>'; }).join("")+'</select></span></div>';
      }).join("") + mais(p.semCargo.length));
    box.innerHTML = h;
    $$(".conf-sec", box).forEach(function(d){ d.addEventListener("toggle", function(){ ui.confAbertas[d.getAttribute("data-tit")] = d.open; }); });
  }
  function ultimoBackup(){
    var u = "";
    state.historico.forEach(function(d){ (d.eventos || []).forEach(function(e){ if(e.tipo === "backup" && e.em > u) u = e.em; }); });
    return u;
  }
  function renderUltimoBackup(){
    var el = $("#backupUltimo"); if(!el) return;
    var u = ultimoBackup(), dias = u ? diasDesde(u.slice(0, 10)) : null;
    el.className = "backup-ultimo" + (dias === null || dias > 7 ? " bk-atrasado" : "");
    el.textContent = u ? "Último backup baixado " + (dias === 0 ? "hoje" : "há " + dias + " dia" + (dias === 1 ? "" : "s")) + " (" + dataBR(u.slice(0, 10)) + ")." : "Nenhum backup baixado ainda pelo painel.";
  }
  function renderView(v){
    if(v === "dashboard"){
      renderAgenda(); renderAtencao(model()); renderFeitoHoje();
    } else if(v === "progresso"){ renderAlinhamentoSetor(); renderEmpresas(); renderTreinamento(); renderContatosCadastro(); }
    else if(v === "foco"){ renderFoco(); atualizarModoFoco(); }
    else if(v === "impedimentos"){ renderImpedimentos(model()); renderAuditoriaDominio(); }
    else if(v === "relatorios"){ renderRelatorios(); }
    else if(v === "cadastro"){
      renderSelectEmpresas(); renderConferir(); renderUltimoBackup();
      var temExemplo = state.empresas.some(function(x){ return x.exemplo; }) || state.setores.some(function(x){ return x.exemplo; }) || state.contatos.some(function(x){ return x.exemplo; }) || state.funcionarios.some(function(x){ return x.exemplo; });
      $("#btnRemoverExemplos").hidden = !temExemplo;
    }
    viewsSujas[v] = false;
    salvarUI();
  }
  // Alterações em lote redesenham a tela uma vez só, no fim, em vez de uma vez por item.
  var loteRender = 0;
  function emLote(fn){
    loteRender++;
    try{ fn(); } finally { loteRender--; if(!loteRender) renderAll(); }
  }
  function renderAll(){
    if(loteRender) return;
    if(editandoData()){ renderAdiado = true; return; }
    keepFocus(function(){
      VIEWS.forEach(function(v){ viewsSujas[v] = true; });
      renderView(ui.view);
      renderUsoBanco();
      renderPessoasDatalist();
      Object.keys(indicadores).forEach(pintarIndicador);
    });
  }

  /* ---------- events ---------- */
  // ui.tagMenuAberto é "scope::contatoId" (o docId de um bloco de setor, ou "pessoas" para o
  // cadastro em Contatos de clientes) — sempre redesenha as duas telas ao fechar, pelo mesmo
  // motivo do toggle-tagmenu acima.
  var tagMenuAbertoEm = 0;
  function fecharTagMenuAberto(){
    if(ui.tagMenuAberto == null) return;
    ui.tagMenuAberto = null;
    renderEmpresas(); renderContatosCadastro();
  }
  document.addEventListener("click", function(ev){
    if(ui.tagMenuAberto != null && !ev.target.closest(".tagwrap")) fecharTagMenuAberto();
  }, true);
  // Um "scroll" pode chegar um instante depois do clique que ACABOU de abrir o menu (o próprio
  // navegador/Playwright rola a página até o botão antes de clicar nele) — ignora esse eco nos
  // primeiros instantes pra não fechar o menu que a pessoa mal terminou de abrir.
  document.addEventListener("scroll", function(ev){
    if(ui.tagMenuAberto != null && Date.now() - tagMenuAbertoEm > 400 && !(ev.target.closest && ev.target.closest(".tagwrap"))) fecharTagMenuAberto();
  }, true);
  window.addEventListener("resize", function(){
    fecharTagMenuAberto();
  });

  document.addEventListener("click", function(ev){
    var el = ev.target.closest("[data-action]"); if(!el) return;
    var a = el.getAttribute("data-action");

    if(a === "toggle"){
      var row = el.closest(".erow"), id = row.getAttribute("data-id");
      if(ui.expanded.has(id)) ui.expanded.delete(id); else ui.expanded.add(id);
      renderEmpresas(); return;
    }
    if(a === "conc-informar"){
      var ciInp = document.getElementById(el.getAttribute("data-for"));
      if(ciInp){ ciInp.hidden = false; el.hidden = true; ciInp.focus(); try{ ciInp.showPicker(); }catch(e){} }
      return;
    }
    if(a === "foco-acao-abrir"){
      var faAb = el.getAttribute("data-id");
      ui.focoAcaoAberta.add(faAb);
      renderFoco();
      requestAnimationFrame(function(){ var inp = document.getElementById("fpa-"+faAb); if(inp) inp.focus(); });
      return;
    }
    if(a === "foco-contato-novo"){
      ui.expandedEtapas.add(el.getAttribute("data-key"));
      ui.focoContatoForm = el.getAttribute("data-docid");
      renderFoco();
      var fcnDoc = el.getAttribute("data-docid");
      requestAnimationFrame(function(){ var inp = document.querySelector('.ftc-form[data-docid="'+CSS.escape(fcnDoc)+'"] .ftc-nome'); if(inp) inp.focus(); });
      return;
    }
    if(a === "salv-tentar"){
      var fs = gravacoes.falhas.splice(0);
      atualizarSalvamento();
      fs.forEach(function(fn){ acompanharGravacao(fn).catch(function(){}); });
      return;
    }
    if(a === "filtro-aplicar"){
      var fa = lerFiltrosSalvos()[+el.getAttribute("data-i")];
      if(fa){ CAMPOS_FILTRO.forEach(function(k){ if(k in fa.f) ui[k] = fa.f[k]; }); var es = $("#empresaSearch"); if(es) es.value = ui.busca || ""; abrirSecaoEmpresas(); salvarUI(); renderEmpresas(); }
      return;
    }
    if(a === "filtro-apagar"){ var fl = lerFiltrosSalvos(); fl.splice(+el.getAttribute("data-i"), 1); gravarFiltrosSalvos(fl); renderEmpresas(); return; }
    if(a === "filtro-cancelar"){ ui.salvandoFiltro = false; renderEmpresas(); return; }
    if(a === "foco-ver-paradas"){ ui.focoOrdem = "parada"; ui.focoModo = "empresa"; salvarUI(); renderFoco(); atualizarModoFoco(); window.scrollTo({top:0}); return; }
    if(a === "ir-cadastro"){ setView("cadastro"); window.scrollTo({top:0}); return; }
    if(a === "rel-ana-ordem"){
      var raCol = el.getAttribute("data-col");
      if(ui.relAnaOrdem === raCol) ui.relAnaDir = -(ui.relAnaDir || 1); else { ui.relAnaOrdem = raCol; ui.relAnaDir = raCol === "nome" ? 1 : -1; }
      renderRelatorios();
      return;
    }
    if(a === "rel-ana-todos"){ ui.relAnaTodos = true; renderRelatorios(); return; }
    if(a === "rel-ana-abrir"){ ui.filtroAnalista = el.getAttribute("data-nome"); irParaEmpresaComSetor("todos"); return; }
    if(a === "ag-remarcar"){
      var arCampos = el.parentNode.querySelector(".ag-remarcar-campos");
      if(arCampos){ arCampos.hidden = false; el.hidden = true; var arIn = arCampos.querySelector('input[type="date"]'); if(arIn){ arIn.focus(); try{ arIn.showPicker(); }catch(e){} } }
      return;
    }
    if(a === "ver-sem-contato"){ ui.soSemContato = true; irParaEmpresaComSetor("todos"); return; }
    if(/^conf-/.test(a)) memoProb.sujo = true;
    if(a === "conf-tudo"){ ui.confTudo = true; renderConferir(); return; }
    if(a === "conf-vincular-grupo"){
      var cg = gruposSugeridos().find(function(g){ return g.m.id === el.getAttribute("data-matriz"); });
      if(!cg) return;
      confirmar('Vincular '+(cg.fs.length === 1 ? '“'+cg.fs[0].nome+'”' : 'as '+cg.fs.length+' filiais')+' a “'+cg.m.nome+'”? Os contatos, as frentes e as etapas das filiais passam para a matriz (fica o status mais adiantado de cada etapa).', function(){
        el.disabled = true;
        vincularGrupo(cg.m.id, cg.fs.map(function(f){ return f.id; }));
      }, "Vincular");
      return;
    }
    if(a === "conf-vincular-todos"){
      var tg = gruposSugeridos(), tn = tg.reduce(function(n, g){ return n + g.fs.length; }, 0);
      if(!tg.length) return;
      confirmar('Vincular '+tn+' filiais em '+tg.length+' grupos? Em cada grupo, os contatos, as frentes e as etapas das filiais passam para a matriz (fica o status mais adiantado de cada etapa). Recomendo baixar o backup completo antes.', function(){
        el.disabled = true;
        mostrarToast("Vinculando "+tn+" filiais…");
        vincularVarios(tg, function(n){ mostrarToast(n+" filiais vinculadas em "+tg.length+" grupos."); });
      }, "Vincular todos");
      return;
    }
    if(a === "conf-juntar-filial"){ var jfId = el.getAttribute("data-filial"); el.disabled = true; vincularFilial(jfId, grupos.matrizDe[jfId]); return; }
    if(a === "conf-cadastrar-analista"){
      if(!dbRef) return;
      var caNome = el.getAttribute("data-nome");
      var caItem = problemasDados().analistas.find(function(x){ return x.nome === caNome; });
      var caSetor = caItem ? Object.keys(caItem.setores).sort(function(x, y){ return caItem.setores[y] - caItem.setores[x]; })[0] : "pessoal";
      dbRef.collection("funcionarios").add({nome:caNome, setor:caSetor, cargo:"Analista", statusTreinamento:"pendente", impedimento:{ativo:false, descricao:""}, observacoes:"", exemplo:false, criadoEm:new Date().toISOString()})
        .then(function(){ mostrarToast("“"+caNome+"” cadastrado(a) na Equipe; as "+(caItem ? caItem.frentes.length : 0)+" frentes passam a contar para essa pessoa."); });
      return;
    }
    if(a === "conf-juntar-analista"){
      if(!dbRef) return;
      var jNome = el.getAttribute("data-nome"), jSel = el.closest(".conf-item").querySelector(".conf-mesma");
      var jFunc = jSel && state.funcionarios.find(function(f){ return f.id === jSel.value; });
      if(!jFunc){ if(jSel) jSel.focus(); mostrarToast("Escolha a pessoa da Equipe."); return; }
      var jItem = problemasDados().analistas.find(function(x){ return x.nome === jNome; });
      if(!jItem) return;
      confirmar('Trocar “'+jNome+'” por “'+jFunc.nome+'” em '+jItem.frentes.length+' frente'+(jItem.frentes.length === 1 ? '' : 's')+'?', function(){
        emLote(function(){
          jItem.frentes.forEach(function(sd){
            sd.analistaId = jFunc.id; sd.analistaNome = jFunc.nome;
            dbRef.collection("empresaSetores").doc(sd.id).update({analistaId:jFunc.id, analistaNome:jFunc.nome});
          });
        });
        registrarAtividade({tipo:"lote", texto:'Analista “'+jNome+'” unificado com “'+jFunc.nome+'” em '+jItem.frentes.length+' frente(s)'});
      }, "Trocar");
      return;
    }
    if(a === "conf-marcar-demanda"){
      if(!dbRef) return;
      var mdEmp = empresaPorId(el.getAttribute("data-empresa")), mdSet = el.getAttribute("data-setor");
      if(!mdEmp) return;
      var mdDem = Object.assign({pessoal:false, contabil:false, fiscal:false}, mdEmp.setoresDemanda); mdDem[mdSet] = true;
      mdEmp.setoresDemanda = mdDem;
      dbRef.collection("empresas").doc(mdEmp.id).update({setoresDemanda:mdDem}).then(function(){ ensureSetorDoc(mdEmp, mdSet); });
      registrarAtividade({tipo:"setor", empresaId:mdEmp.id, empresaNome:mdEmp.nome, setor:mdSet, para:"adicionado"});
      renderAll();
      return;
    }
    if(a === "conf-tirar-setor"){
      if(!dbRef) return;
      var tsEmp = el.getAttribute("data-empresa"), tsSet = el.getAttribute("data-setor");
      emLote(function(){
        state.contatos.filter(function(c){ return c.empresaId === tsEmp && (c.setores || []).indexOf(tsSet) !== -1; }).forEach(function(c){
          var novos = (c.setores || []).filter(function(x){ return x !== tsSet; });
          c.setores = novos;
          dbRef.collection("contatos").doc(c.id).update({setores:novos});
        });
      });
      return;
    }
    if(a === "conf-preencher-datas"){
      if(!dbRef) return;
      var pdData = ($("#confDataLote") || {}).value;
      if(!pdData){ mostrarToast("Escolha a data."); return; }
      var pdItens = problemasDados().semData;
      confirmar("Preencher "+pdItens.length+" etapa"+(pdItens.length === 1 ? "" : "s")+" concluída"+(pdItens.length === 1 ? "" : "s")+" com a data "+dataBR(pdData)+"?", function(){
        emLote(function(){
          pdItens.forEach(function(x){
            if(x.tipo === "hab"){ salvarHabilitacao(x.e.id, {data:pdData}); return; }
            x.doc.etapas = Object.assign({}, x.doc.etapas);
            x.doc.etapas[x.key] = Object.assign({}, x.doc.etapas[x.key], {data:pdData});
            var pp = {}; pp[x.key] = {data:pdData};
            dbRef.collection("empresaSetores").doc(x.doc.id).update({etapas:pp});
          });
        });
        mostrarToast(pdItens.length+" data"+(pdItens.length === 1 ? "" : "s")+" de conclusão preenchida"+(pdItens.length === 1 ? "" : "s")+".");
      }, "Preencher");
      return;
    }
    if(a === "cons-mais"){ ui.consLimite = (ui.consLimite || 50) + 50; renderEmpresas(); return; }
    if(a === "imp-form-abrir" || a === "imp-form-cancelar"){
      var impId = a === "imp-form-abrir" ? el.getAttribute("data-id") : null;
      ui.impFormEmp = impId;
      if(ui.view === "foco"){ if(impId) ui.focoAbertas.add(impId); renderFoco(); } else renderEmpresas();
      if(impId) requestAnimationFrame(function(){ var inp = document.querySelector('.imp-emp-form[data-id="'+CSS.escape(impId)+'"] .imp-emp-desc'); if(inp) inp.focus(); });
      return;
    }
    if(a === "toggle-foco"){
      var focoId = el.getAttribute("data-id");
      var focoEmp = state.empresas.find(function(x){ return x.id === focoId; });
      if(!focoEmp) return;
      if(focoEmp.emFoco){
        confirmarTirarDoFoco(focoId, function(){ el.classList.remove("on"); el.title = "Adicionar ao foco"; });
      } else {
        el.classList.add("on"); el.title = "Remover do foco";
        adicionarAoFoco(focoId);
        mostrarToast('“'+focoEmp.nome+'” entrou no foco', "Ver", function(){ setView("foco"); });
      }
      return;
    }
    if(a === "foco-etapa"){
      var etKey = el.getAttribute("data-key");
      var abrir = !ui.expandedEtapas.has(etKey);
      if(abrir) ui.expandedEtapas.add(etKey); else ui.expandedEtapas.delete(etKey);
      var acc = el.closest(".fitem");
      if(acc) acc.classList.toggle("open", abrir);
      el.setAttribute("aria-expanded", abrir);
      atualizarCacheFoco(el.getAttribute("data-empresa"));
      if(abrir && acc && el.classList.contains("fitem-nota")){ var obsIn = acc.querySelector(".fobs"); if(obsIn) obsIn.focus(); }
      return;
    }
    if(a === "ir-alinhamento"){
      setView("progresso"); mostrarSecaoConsulta("secAlinhamento");
      requestAnimationFrame(function(){
        window.scrollTo({top:0});
        var alSel = document.getElementById("ast-"+el.getAttribute("data-setor"));
        flash(alSel && alSel.closest(".align-card"));
      });
      return;
    }
    if(a === "foco-acao-feita"){
      var afId = el.getAttribute("data-id");
      var afEmp = state.empresas.find(function(x){ return x.id === afId; });
      if(!afEmp) return;
      var afAntes = {focoProxAcao:afEmp.focoProxAcao || "", focoPrazo:afEmp.focoPrazo || "", focoAguardando:afEmp.focoAguardando || "", focoAguardandoOutro:afEmp.focoAguardandoOutro || ""};
      var afVazio = {focoProxAcao:"", focoPrazo:"", focoAguardando:"", focoAguardandoOutro:""};
      delete rascunhos["pao:"+afId];
      delete rascunhos["pa:"+afId];
      Object.assign(afEmp, afVazio);
      if(dbRef) dbRef.collection("empresas").doc(afId).update(afVazio);
      renderAll();
      mostrarToast("Próxima ação de “"+afEmp.nome+"” marcada como feita", "Desfazer", function(){
        Object.assign(afEmp, afAntes);
        if(dbRef) dbRef.collection("empresas").doc(afId).update(afAntes);
        renderAll();
      });
      return;
    }
    if(a === "foco-recolher"){
      var rid = el.getAttribute("data-id"), abrindo = !ui.focoAbertas.has(rid);
      if(abrindo) Array.from(ui.focoAbertas).forEach(function(o){ if(o !== rid) marcarRecolhida(o, true); });
      marcarRecolhida(rid, !abrindo);
      return;
    }
    if(a === "foco-expandir-todas" || a === "foco-recolher-todas"){
      if(ui.focoModo === "etapa"){
        if(a === "foco-recolher-todas") $$("#focoEtapaList .fer-empresa").forEach(function(g){ ui.focoEtapaRecolhidas.add(g.getAttribute("data-grupo")); });
        else ui.focoEtapaRecolhidas.clear();
        renderFocoPorEtapa();
        renderFoco();
        return;
      }
      listaFoco().forEach(function(e){ marcarRecolhida(e.id, a === "foco-recolher-todas"); });
      renderResumoFoco(listaFoco(), (function(){ var p = {}; state.setores.forEach(function(x){ (p[x.empresaId] = p[x.empresaId] || []).push(x); }); return p; })());
      return;
    }
    if(a === "fer-grupo-toggle" || a === "fer-grupo-barra"){
      var fgx = ctxEtapaDe(el), fgk = el.getAttribute("data-grupo"), fgRec = ui[fgx.p + "Recolhidas"];
      if(fgRec.has(fgk)) fgRec.delete(fgk); else fgRec.add(fgk);
      fgx.render();
      return;
    }
    if(a === "foco-add-setor"){
      var addId = el.getAttribute("data-id"), addSetorKey = el.getAttribute("data-setor");
      var addEmp = state.empresas.find(function(x){ return x.id === addId; });
      if(!addEmp || !dbRef) return;
      var novoDem = Object.assign({pessoal:false, contabil:false, fiscal:false}, addEmp.setoresDemanda);
      novoDem[addSetorKey] = true;
      addEmp.setoresDemanda = novoDem;
      registrarAtividade({tipo:"setor", empresaId:addId, empresaNome:addEmp.nome, setor:addSetorKey, para:"adicionado"});
      keepFocus(renderFoco);
      dbRef.collection("empresas").doc(addId).update({setoresDemanda:novoDem}).then(function(){
        ensureSetorDoc(addEmp, addSetorKey);
      }).catch(function(){ mostrarToast("Não foi possível adicionar o setor."); });
      return;
    }
    if(a === "foco-contato-abrir"){
      var abrirDocId = el.getAttribute("data-docid");
      ui.focoContatoForm = abrirDocId;
      if(ui.view === "progresso") renderEmpresas(); else renderFoco();
      requestAnimationFrame(function(){
        var input = document.querySelector('.ftc-form[data-docid="'+CSS.escape(abrirDocId)+'"] .ftc-nome');
        if(input) input.focus();
      });
      return;
    }
    if(a === "foco-contato-cancelar"){
      ui.focoContatoForm = null;
      if(ui.view === "progresso") renderEmpresas(); else renderFoco();
      return;
    }
    if(a === "foco-remover"){ confirmarTirarDoFoco(el.getAttribute("data-id")); return; }
    if(a === "foco-etapa-abrir"){ ctxEtapaDe(el).abrir(el.getAttribute("data-id")); return; }
    if(a === "foco-etapa-sel" || a === "foco-etapa-status" || a === "foco-etapa-setor" || a === "foco-etapa-atrasados" || a === "foco-etapa-limpar"){
      var fx = ctxEtapaDe(el), fp = fx.p;
      mudarFiltroEtapa(fx, function(){
        if(a === "foco-etapa-sel"){ ui[fp + "Sel"] = el.getAttribute("data-etapa"); if(fx.nome === "cons") salvarUI(); }
        else if(a === "foco-etapa-status") ui[fp + "Status"] = el.getAttribute("data-st");
        else if(a === "foco-etapa-setor") ui[fp + "Setor"] = el.getAttribute("data-setor");
        else if(a === "foco-etapa-atrasados") ui[fp + "Atrasados"] = !ui[fp + "Atrasados"];
        else {
          ui[fp + "Status"] = "todos"; ui[fp + "Analista"] = ""; ui[fp + "Atrasados"] = false;
          if(fx.setorNaToolbar) ui[fp + "Setor"] = "todos";
        }
      });
      return;
    }
    if(a === "fer-bulk-aplicar"){ var bx = ctxEtapaDe(el), bs = $("#" + bx.ids.bulk); aplicarStatusEmLoteEtapa(bx, bs ? bs.value : bx.bulkStatus); return; }
    if(a === "cons-etapa-mais"){ ui.consEtapaLimite = (ui.consEtapaLimite || CONS_ETAPA_PAGINA) + CONS_ETAPA_PAGINA; renderEmpresas(); return; }
    if(a === "cons-modo"){
      var novoModo = el.getAttribute("data-modo");
      if(novoModo === ui.consModo) return;
      ui.consModo = novoModo;
      ui.consEtapaSelecionadas.clear(); ui.consEtapaMantidas.clear(); ui.consEtapaLimite = CONS_ETAPA_PAGINA;
      salvarUI();
      renderEmpresas();
      return;
    }
    if(a === "foco-busca-limpar"){ limparBuscaFoco(); var fb = $("#focoAddSearch"); if(fb) fb.focus(); return; }
    if(a === "foco-etapa-filtros"){ var ffx = ctxEtapaDe(el); ui[ffx.p + "FiltrosAbertos"] = !ui[ffx.p + "FiltrosAbertos"]; salvarUI(); ffx.render(); return; }
    if(a === "fer-bulk-limpar"){ var flx = ctxEtapaDe(el); ui[flx.p + "Selecionadas"].clear(); flx.render(); return; }
    if(a === "foco-limpar-concluidas"){
      var concluidas = listaFoco().filter(function(e){ return resumoEmpresaFoco(e, docsDaEmpresa(e.id)).completa; });
      if(!concluidas.length) return;
      var msgLimpar = concluidas.length === 1
        ? 'Tirar “'+concluidas[0].nome+'” do foco? A empresa continua em Consulta, com todo o progresso salvo.'
        : 'Tirar do foco as '+concluidas.length+' empresas que concluíram todas as etapas? Elas continuam em Consulta, com todo o progresso salvo.';
      confirmar(msgLimpar, function(){
        var restaurar = concluidas.map(function(e){ return {id:e.id, ts:e.emFocoEm}; });
        concluidas.forEach(function(e){ tirarDoFoco(e.id, true); });
        mostrarToast(restaurar.length+(restaurar.length===1?" empresa saiu":" empresas saíram")+" do foco", "Desfazer", function(){
          restaurar.forEach(function(r){ adicionarAoFoco(r.id, r.ts); });
        });
      }, "Tirar do foco");
      return;
    }
    if(a === "vincular-filial"){
      var vfBox = el.closest(".efiliais"), vfSel = vfBox && vfBox.querySelector(".fil-sel");
      var vfF = vfSel && grupos.porId[vfSel.value], vfM = grupos.porId[el.getAttribute("data-matriz")];
      if(!vfF){ if(vfSel) vfSel.focus(); mostrarToast("Escolha a empresa que é filial."); return; }
      if(vfM) confirmarVinculo(vfF, vfM);
      return;
    }
    if(a === "vincular-como-filial"){
      var vcF = grupos.porId[el.getAttribute("data-filial")], vcM = grupos.porId[el.getAttribute("data-matriz")];
      if(vcF && vcM) confirmarVinculo(vcF, vcM);
      return;
    }
    if(a === "desvincular-filial"){ desvincularFilial(el.getAttribute("data-id")); return; }
    if(a === "editar-empresa"){
      var eeId = el.getAttribute("data-id");
      if(ui.editEmpresa.has(eeId)) ui.editEmpresa.delete(eeId); else ui.editEmpresa.add(eeId);
      renderEmpresas();
      return;
    }
    if(a === "excluir-empresa"){
      var row2 = el.closest(".erow"), eid = row2.getAttribute("data-id");
      var emp = state.empresas.find(function(x){ return x.id === eid; });
      var contatosEmp = state.contatos.filter(function(c){ return c.empresaId === eid; });
      var filsEmp = filiaisDe(eid);
      confirmar('Excluir “'+(emp?emp.nome:"esta empresa")+'” e todo o progresso registrado?'+(contatosEmp.length ? ' Os '+contatosEmp.length+' contato(s) de cliente dessa empresa também serão excluídos.' : '')+(filsEmp.length ? ' As '+filsEmp.length+' filial(is) dela voltam a ser empresas separadas.' : ''), function(){
        if(!dbRef) return;
        dbRef.collection("empresas").doc(eid).delete();
        filsEmp.forEach(function(f){ dbRef.collection("empresas").doc(f.id).update({matrizId:""}); });
        state.setores.filter(function(s){ return s.empresaId === eid; }).forEach(function(s){ dbRef.collection("empresaSetores").doc(s.id).delete(); });
        contatosEmp.forEach(function(c){ dbRef.collection("contatos").doc(c.id).delete(); });
      });
      return;
    }
    if(a === "sel-empresa"){
      var selId = el.getAttribute("data-id");
      if(el.checked) ui.selecionadas.add(selId); else ui.selecionadas.delete(selId);
      var selRow = el.closest(".erow"); if(selRow) selRow.classList.toggle("sel", el.checked);
      renderBulkBar();
      return;
    }
    if(a === "bulk-todas"){ ui.ultimaLista.forEach(function(id){ ui.selecionadas.add(id); }); renderEmpresas(); return; }
    if(a === "bulk-limpar"){ ui.selecionadas.clear(); renderEmpresas(); return; }
    if(a === "bulk-analista"){ aplicarAnalistaEmLote(); return; }
    if(a === "bulk-foco"){ adicionarAoFocoEmLote(); return; }
    if(a === "sel-func"){
      var sfId = el.getAttribute("data-id");
      if(el.checked) ui.selFunc.add(sfId); else ui.selFunc.delete(sfId);
      var sfRow = el.closest(".prow"); if(sfRow) sfRow.classList.toggle("sel", el.checked);
      renderBulkBarFunc();
      return;
    }
    if(a === "bulk-func-todas"){ ui.ultimaListaFunc.forEach(function(id){ ui.selFunc.add(id); }); renderTreinamento(); return; }
    if(a === "bulk-func-limpar"){ ui.selFunc.clear(); renderTreinamento(); return; }
    if(a === "bulk-func-aplicar"){ aplicarTreinoEmLoteFuncionarios(); return; }
    if(a === "sel-pessoa"){
      var spChave = el.getAttribute("data-chave");
      if(el.checked) ui.selPessoas.add(spChave); else ui.selPessoas.delete(spChave);
      var spRow = el.closest(".prow"); if(spRow) spRow.classList.toggle("sel", el.checked);
      renderBulkBarPessoas();
      return;
    }
    if(a === "bulk-pessoa-todas"){ ui.ultimaListaPessoas.forEach(function(k){ ui.selPessoas.add(k); }); renderContatosCadastro(); return; }
    if(a === "bulk-pessoa-limpar"){ ui.selPessoas.clear(); renderContatosCadastro(); return; }
    if(a === "bulk-pessoa-aplicar"){ aplicarTreinoEmLotePessoas(); return; }
    if(a === "ir-contato"){ irParaContato(el.getAttribute("data-id")); return; }
    if(a === "ir-funcionario"){ irParaFuncionario(el.getAttribute("data-nome")); return; }
    if(a === "agenda-toggle"){ ui.agendaCompleta = !ui.agendaCompleta; renderAgenda(); return; }
    if(a === "ir-foco"){ setView("foco"); return; }
    if(a === "baixar-lista"){ baixarListaAtencao(el.getAttribute("data-lista")); return; }
    if(a === "agendar-abrir"){ if(ui.agendar.aberto) fecharAgendar(); else abrirAgendar(); return; }
    if(a === "agendar-fechar"){ fecharAgendar(); return; }
    if(a === "agendar-escolher"){ escolherAgendar(+el.getAttribute("data-i")); var qi = $("#agdQuem"); if(qi && matchMedia("(pointer:fine)").matches) qi.focus(); return; }
    if(a === "agendar-confirmar"){ confirmarAgendar(); return; }
    if(a === "agd-dia"){ ui.agendar.data = el.getAttribute("data-dia"); ui.agendar.mes = ui.agendar.data.slice(0, 7); pintarCalendarioAgd(); pintarResumoAgd(); return; }
    if(a === "agd-mes"){
      var pm = ui.agendar.mes.split("-"), dm = new Date(+pm[0], +pm[1] - 1 + (+el.getAttribute("data-d")), 1);
      ui.agendar.mes = dm.getFullYear() + "-" + pad2(dm.getMonth() + 1); pintarCalendarioAgd(); return;
    }
    if(a === "agd-hora"){ var hh = el.getAttribute("data-h"); ui.agendar.hora = ui.agendar.hora === hh ? "" : hh; var hi = $("#agdHora"); if(hi) hi.value = ui.agendar.hora; pintarHorasAgd(); pintarResumoAgd(); return; }
    if(a === "agd-remover"){ var kk = el.getAttribute("data-k"); ui.agendar.sel = ui.agendar.sel.filter(function(x){ return chaveAgd(x) !== kk; }); pintarSelAgd(); atualizarOpcoesAgendar(); pintarResumoAgd(); return; }
    if(a === "hoje-dia"){
      var hd = el.getAttribute("data-dia") || null;
      ui.agendaDia = ui.agendaDia === hd ? null : hd;
      renderAgenda();
      var ap = $("#agendaPanel");
      if(ui.agendaDia && ap && !el.closest("#agendaRodape")) ap.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center"});
      return;
    }
    if(a === "ver-registro-hoje"){
      ui.rel.atvPer = "hoje";
      setView("relatorios");
      requestAnimationFrame(function(){ var ra = $("#relTicker"); if(ra) ra.scrollIntoView({block:"start"}); });
      return;
    }
    if(a === "atv-fechar"){ ui.rel.atvPer = ""; renderRelAtividades(); return; }
    if(a === "ver-sem-analista"){ ui.soSemAnalista = true; irParaEmpresaComSetor("todos"); return; }
    if(a === "abrir-foco-empresa"){ setView("foco"); irParaFocoEmpresa(el.getAttribute("data-id")); return; }
    if(a === "agenda-concluir"){
      if(el.getAttribute("data-tipo") === "etapa") focoSetStatus(el.getAttribute("data-empresa"), el.getAttribute("data-setor"), "treinamentoAnalista", "concluido");
      else if(el.getAttribute("data-tipo") === "funcionario") definirStatusFuncionario(el.getAttribute("data-id"), "concluido");
      else definirStatusContato(el.getAttribute("data-id"), "concluido");
      return;
    }
    if(a === "ver-analista"){ irParaFuncionario(el.getAttribute("data-nome")); return; }
    if(a === "ver-analista-id"){
      var vaFunc = state.funcionarios.find(function(f){ return f.id === el.getAttribute("data-id"); });
      if(vaFunc) irParaFuncionario(vaFunc.nome); else mostrarToast("Funcionário não encontrado.");
      return;
    }
    if(a === "ir-empresa"){ irParaEmpresa(el.getAttribute("data-id")); return; }
    if(a === "ir-impedimentos"){ irParaImpedimentos(); return; }
    if(a === "toggle-func"){
      var fid = el.getAttribute("data-id");
      if(ui.expandedFunc.has(fid)) ui.expandedFunc.delete(fid); else ui.expandedFunc.add(fid);
      renderTreinamento(); return;
    }
    if(a === "toggle-group"){
      var gkeyToggle = el.getAttribute("data-group");
      toggleGrupo(gkeyToggle, el.getAttribute("data-auto") === "1");
      if(ui.view === "impedimentos"){ renderImpedimentos(model()); renderAuditoriaDominio(); }
      else if(gkeyToggle === "secao:empresas") renderEmpresas();
      else if(gkeyToggle === "secao:contatos") renderContatosCadastro();
      else renderTreinamento();
      return;
    }
    if(a === "carteira-remover"){ definirAnalistaFrente(el.getAttribute("data-empresa"), el.getAttribute("data-setor"), null); return; }
    if(a === "carteira-add-abrir"){
      var caFid = el.getAttribute("data-fid");
      ui.carteiraAddAberto = caFid;
      renderTreinamento();
      requestAnimationFrame(function(){
        var i = document.querySelector('.carteira-form[data-fid="'+CSS.escape(caFid)+'"] .cadd-empresa');
        if(i) i.focus();
      });
      return;
    }
    if(a === "carteira-add-cancelar"){ ui.carteiraAddAberto = null; renderTreinamento(); return; }
    if(a === "toggle-pessoa"){
      var pChave = el.getAttribute("data-chave");
      if(ui.expandedPessoas.has(pChave)) ui.expandedPessoas.delete(pChave); else ui.expandedPessoas.add(pChave);
      renderContatosCadastro();
      return;
    }
    if(a === "pessoa-vincular-abrir"){
      var pvChave = el.getAttribute("data-chave");
      ui.pessoaVincularForm = pvChave;
      renderContatosCadastro();
      requestAnimationFrame(function(){
        var i = document.querySelector('.pessoa-vincular-form[data-chave="'+CSS.escape(pvChave)+'"] .pv-empresa');
        if(i) i.focus();
      });
      return;
    }
    if(a === "pessoa-vincular-cancelar"){ ui.pessoaVincularForm = null; renderContatosCadastro(); return; }
    if(a === "excluir-pessoa"){
      var epChave = el.getAttribute("data-chave");
      var pessoa = pessoasUnicas().find(function(p){ return p.chave === epChave; });
      if(!pessoa) return;
      var n = pessoa.registros.length;
      confirmar('Excluir “'+pessoa.nome+'” e '+(n === 1 ? "o vínculo com 1 empresa" : "os vínculos com "+n+" empresas")+'? Isso remove o histórico de treinamento dela.', function(){
        if(!dbRef) return;
        pessoa.registros.forEach(function(c){ dbRef.collection("contatos").doc(c.id).delete(); });
        ui.expandedPessoas.delete(epChave);
      });
      return;
    }
    if(a === "excluir-func"){
      var fid2 = el.getAttribute("data-id");
      confirmar("Excluir este funcionário do painel?", function(){ if(dbRef) dbRef.collection("funcionarios").doc(fid2).delete(); });
      return;
    }
    if(a === "excluir-cont"){
      var cid = el.getAttribute("data-id");
      confirmar("Excluir este contato do painel?", function(){ if(dbRef) dbRef.collection("contatos").doc(cid).delete(); });
      return;
    }
    if(a === "toggle-tagmenu"){
      var tmkey = el.getAttribute("data-tagkey");
      ui.tagMenuAberto = (ui.tagMenuAberto === tmkey) ? null : tmkey;
      if(ui.tagMenuAberto) tagMenuAbertoEm = Date.now();
      // Sempre redesenha as duas telas: o mesmo contato pode ter um "+etiqueta" aberto em
      // cada uma ao mesmo tempo (o bloco da empresa E o cadastro dela), e trocar de escopo
      // sem redesenhar a outra deixaria o menu antigo visivelmente "grudado" ali.
      renderEmpresas(); renderContatosCadastro();
      if(ui.tagMenuAberto) posicionarTagMenu(ui.tagMenuAberto);
      return;
    }
    if(a === "toggle-setor-contato"){
      if(!dbRef) return;
      var tscid = el.getAttribute("data-id"), setorAlvo = el.getAttribute("data-setor");
      var contatoAlvo = state.contatos.find(function(x){ return x.id === tscid; });
      var atuais = (contatoAlvo && contatoAlvo.setores) || [];
      var novos = atuais.indexOf(setorAlvo) !== -1 ? atuais.filter(function(s){ return s !== setorAlvo; }) : atuais.concat([setorAlvo]);
      dbRef.collection("contatos").doc(tscid).update({setores: novos});
      return;
    }
    if(a === "toggle-socio"){
      if(!dbRef) return;
      var tsoid = el.getAttribute("data-id");
      var contatoSocio = state.contatos.find(function(x){ return x.id === tsoid; });
      dbRef.collection("contatos").doc(tsoid).update({socio: !(contatoSocio && contatoSocio.socio)});
      return;
    }
    if(a === "imp-goto"){
      if(el.hasAttribute("data-goto-empresa")) irParaEmpresa(el.getAttribute("data-goto-empresa"));
      else irParaFuncionario(el.getAttribute("data-goto-func"));
      return;
    }
    if(a === "imp-resolver-abrir" || a === "imp-resolver-cancelar"){
      ui.impResolvendo = a === "imp-resolver-abrir" ? el.getAttribute("data-chave") : null;
      renderImpedimentos(model());
      if(ui.impResolvendo) requestAnimationFrame(function(){ var inp = $(".imp-resolver-nota"); if(inp) inp.focus(); });
      return;
    }
    if(a === "imp-novo-abrir" || a === "imp-novo-fechar"){
      var fImp = $("#formImpedimento"); fImp.hidden = a === "imp-novo-fechar";
      $$('[data-action="imp-novo-abrir"]').forEach(function(b){ b.hidden = !fImp.hidden; });
      if(!fImp.hidden){ var alvoIn = $("#imp-alvo"); if(alvoIn) alvoIn.focus(); }
      return;
    }
    if(a === "excluir-auditoria-dominio"){
      var adid = el.getAttribute("data-docid");
      confirmar("Marcar este caso como resolvido e remover da lista?", function(){
        if(dbRef) dbRef.collection("auditoriaDominio").doc(adid).delete();
      });
      return;
    }
  });

  // Barras "Empresas em implantação" e "Pessoas" (Contatos): clicar em qualquer parte
  // vazia da barra recolhe/expande, não só na setinha — mas busca, filtros e o botão
  // continuam funcionando normalmente (o clique neles não chega a esse listener).
  document.addEventListener("click", function(ev){
    var bar = ev.target.closest(".console-top.toggle-bar");
    if(!bar) return;
    if(ev.target.closest("input, select, textarea, button, a")) return;
    var btn = bar.querySelector(".panel-toggle");
    if(btn) btn.click();
  });
  // Mesma ideia nos grupos do Foco "Por etapa": a barra inteira da empresa/analista recolhe e expande.
  document.addEventListener("click", function(ev){
    var head = ev.target.closest(".fer-empresa-head");
    if(!head) return;
    if(ev.target.closest("input, select, textarea, button, a, label")) return;
    var btn = head.querySelector(".fer-toggle");
    if(btn) btn.click();
  });

  // Altura real do cabeçalho fixo: a barra de ações em lote do Foco gruda logo abaixo dele.
  (function(){
    var mh = document.querySelector(".masthead");
    if(!mh) return;
    var medir = function(){ document.documentElement.style.setProperty("--mh-h", mh.offsetHeight + "px"); };
    medir();
    window.addEventListener("resize", medir);
  })();

  document.addEventListener("change", function(ev){
    var el = ev.target;
    if(el.classList.contains("fet-analista")){ var ax = ctxEtapaDe(el); mudarFiltroEtapa(ax, function(){ ui[ax.p + "Analista"] = el.value; }); return; }
    if(el.id === "focoOrdem"){ ui.focoOrdem = el.value; salvarUI(); renderFoco(); return; }
    if(el.classList.contains("fet-ordem")){ var ox = ctxEtapaDe(el); ui[ox.p + "Ordem"] = el.value; salvarUI(); ox.render(); return; }
    if(el.classList.contains("fer-bulk-status")){ ctxEtapaDe(el).bulkStatus = el.value; return; }
    if(el.classList.contains("fer-sel-todas")){
      var tx = ctxEtapaDe(el), tSel = ui[tx.p + "Selecionadas"];
      if(el.checked) tx.visiveis.forEach(function(id){ tSel.add(id); });
      else tSel.clear();
      tx.render();
      return;
    }
    if(el.classList.contains("fer-sel-grupo")){
      var gx = ctxEtapaDe(el), gSel = ui[gx.p + "Selecionadas"];
      (gx.grupos[el.getAttribute("data-grupo")] || []).forEach(function(id){
        if(el.checked) gSel.add(id); else gSel.delete(id);
      });
      gx.render();
      return;
    }
    if(el.classList.contains("fer-sel")){
      var sx = ctxEtapaDe(el), selId = el.getAttribute("data-docid");
      if(el.checked) ui[sx.p + "Selecionadas"].add(selId); else ui[sx.p + "Selecionadas"].delete(selId);
      sx.render();
      return;
    }
    var ferRow = el.closest && el.closest(".fer-row[data-ctx]");
    if(ferRow) ui[ctxEtapaDe(ferRow).p + "Mantidas"].add(ferRow.getAttribute("data-docid"));
    if(!dbRef) return;

    if(el.classList.contains("ee-nome") || el.classList.contains("ee-cnpj") || el.classList.contains("ee-folha") || el.classList.contains("ee-rubricas") || el.classList.contains("ee-ativo")){
      var eid = el.closest(".erow").getAttribute("data-id"), p = {};
      if(el.classList.contains("ee-nome")) p.nome = el.value.trim() || "(sem nome)";
      if(el.classList.contains("ee-cnpj")) p.cnpj = el.value.trim();
      if(el.classList.contains("ee-folha")) p.folhaAtiva = el.checked;
      if(el.classList.contains("ee-rubricas")) p.precisaRubricas = el.checked;
      if(el.classList.contains("ee-ativo")) p.ativo = el.checked;
      var eeObj = state.empresas.find(function(x){ return x.id === eid; });
      if(eeObj) Object.assign(eeObj, p);
      var pr = dbRef.collection("empresas").doc(eid).update(p);
      if(el.id) salvarComAviso(el.id, pr);
      return;
    }
    if(el.classList.contains("ee-setor")){
      var eid2 = el.closest(".erow").getAttribute("data-id");
      var emp = state.empresas.find(function(x){ return x.id === eid2; });
      var setor = el.getAttribute("data-setor"), p2 = {setoresDemanda:{}};
      p2.setoresDemanda[setor] = el.checked;
      dbRef.collection("empresas").doc(eid2).update(p2).then(function(){ if(el.checked && emp) ensureSetorDoc(emp, setor); });
      registrarAtividade({tipo:"setor", empresaId:eid2, empresaNome:emp ? emp.nome : "", setor:setor, para:el.checked ? "adicionado" : "removido"});
      return;
    }
    if(el.getAttribute("data-action") === "etapa-status"){
      var esEmp = el.getAttribute("data-empresa"), esSet = el.getAttribute("data-setor"), esEt = el.getAttribute("data-etapa");
      // Calcula o contexto ANTES de chamar focoSetStatus: ela redesenha a tela na hora, e depois
      // disso "el" já não está mais no documento (closest() num nó desligado sempre daria null).
      var esPrefixo = el.closest("#focoEtapaList") ? "fead-" : el.closest("#consEtapaList") ? "cead-" : el.closest(".fcard") ? "fag-" : "pag-";
      focoSetStatus(esEmp, esSet, esEt, el.value);
      if(el.value === "agendado") focarDataAgendada(esPrefixo + sid(esEmp, esSet) + "-" + esEt);
      return;
    }
    if(el.getAttribute("data-action") === "alinh-status"){ focoSetAlinhamento(el.getAttribute("data-setor"), el.value); return; }
    if(el.classList.contains("analista-sel")){
      if(el.value === "__legado__") return;
      var anaDocId = el.getAttribute("data-docid"), anaEmp = el.getAttribute("data-empresa"), anaSet = el.getAttribute("data-setor");
      var anaNovoId = el.value, anaFunc = anaNovoId ? state.funcionarios.find(function(f){ return f.id === anaNovoId; }) : null;
      var anaNovoNome = anaFunc ? anaFunc.nome : "";
      var anaDoc = state.setores.find(function(s){ return s.id === anaDocId; });
      if(anaDoc){ anaDoc.analistaId = anaNovoId; anaDoc.analistaNome = anaNovoNome; }
      salvarComAviso(el.id, garantirSetorDoc(anaEmp, anaSet).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({analistaId:anaNovoId, analistaNome:anaNovoNome}); }));
      renderAll();
      return;
    }
    if(el.getAttribute("data-action") === "func-status"){
      var fsId = el.getAttribute("data-id");
      definirStatusFuncionario(fsId, el.value);
      if(el.value === "agendado") focarDataAgendada("ffag-" + fsId);
      return;
    }
    if(el.getAttribute("data-action") === "cont-cadastro"){
      definirCadastroContato(el.getAttribute("data-id"), el.getAttribute("data-setor"), el.value);
      return;
    }
    if(el.getAttribute("data-action") === "cont-status"){
      var csPrefixo = el.closest("#focoEtapaList") ? "fecag-" : el.closest("#consEtapaList") ? "cecag-" : el.closest(".fcard") ? "fcag-" : "cag-";
      definirStatusContato(el.getAttribute("data-id"), el.value);
      if(el.value === "agendado") focarDataAgendada(csPrefixo + el.getAttribute("data-id"));
      return;
    }
    if(el.classList.contains("ag-input")){ registrarEdicaoData(el); return; }
    if(el.classList.contains("foco-aguardando")){
      var faId = el.getAttribute("data-id"), faEmp = state.empresas.find(function(x){ return x.id === faId; });
      if(faEmp) faEmp.focoAguardando = el.value;
      dbRef.collection("empresas").doc(faId).update({focoAguardando:el.value});
      renderFocoAtivo();
      if(el.value === "outro") requestAnimationFrame(function(){ var t = document.getElementById("fago-" + faId); if(t) t.focus(); });
      return;
    }
    if(el.classList.contains("imp-agu")){
      var iaCol = el.getAttribute("data-col"), iaId = el.getAttribute("data-docid");
      var iaLocal = iaCol === "empresas" ? state.empresas.find(function(x){ return x.id === iaId; }) : iaCol === "funcionarios" ? state.funcionarios.find(function(x){ return x.id === iaId; }) : state.setores.find(function(x){ return x.id === iaId; });
      if(iaLocal && iaLocal.impedimento) iaLocal.impedimento = Object.assign({}, iaLocal.impedimento, {aguardando:el.value});
      dbRef.collection(iaCol).doc(iaId).update({impedimento:{aguardando:el.value}});
      el.classList.toggle("tem", !!el.value);
      return;
    }
    if(el.classList.contains("conf-setor-contato") || el.classList.contains("func-cargo")) memoProb.sujo = true;
    if(el.classList.contains("conf-setor-contato")){
      if(!el.value) return;
      var cscObj = state.contatos.find(function(x){ return x.id === el.getAttribute("data-id"); });
      if(cscObj) cscObj.setores = [el.value];
      dbRef.collection("contatos").doc(el.getAttribute("data-id")).update({setores:[el.value]});
      renderAll();
      return;
    }
    if(el.classList.contains("func-cargo")){
      dbRef.collection("funcionarios").doc(el.getAttribute("data-id")).update({cargo: el.value}); return;
    }
    if(el.classList.contains("func-setor")){
      dbRef.collection("funcionarios").doc(el.getAttribute("data-id")).update({setor: el.value}); return;
    }
  });

  document.addEventListener("submit", function(ev){
    var resForm = ev.target.closest(".imp-resolver-form");
    if(resForm){
      ev.preventDefault();
      if(!dbRef) return;
      var rCol = resForm.getAttribute("data-col"), rId = resForm.getAttribute("data-docid"), rNota = resForm.querySelector(".imp-resolver-nota").value.trim();
      var rLocal = rCol === "empresas" ? state.empresas.find(function(x){ return x.id === rId; })
        : rCol === "funcionarios" ? state.funcionarios.find(function(x){ return x.id === rId; })
        : state.setores.find(function(x){ return x.id === rId; });
      var rDesc = rLocal && rLocal.impedimento ? rLocal.impedimento.descricao || "" : "";
      var rImp = {ativo:false, descricao:"", desde:"", resolvidoEm:hojeISO(), resolucao:rNota, descricaoAnterior:rDesc};
      if(rLocal) rLocal.impedimento = rImp;
      ui.impResolvendo = null;
      dbRef.collection(rCol).doc(rId).update({impedimento:rImp}).then(function(){ mostrarToast("Impedimento resolvido."); }, function(){ mostrarToast("Não foi possível salvar."); });
      registrarAtividade(alvoImpedimento(rCol, rId, {tipo:"impedimento", para:"removido", texto:rDesc, resolucao:rNota}));
      renderAll();
      return;
    }
    var impForm = ev.target.closest(".imp-emp-form");
    if(impForm){
      ev.preventDefault();
      if(!dbRef) return;
      var impDesc = impForm.querySelector(".imp-emp-desc").value.trim(), impSetor = impForm.querySelector(".imp-emp-alvo").value, impEmp = impForm.getAttribute("data-id");
      if(!impDesc) return;
      ui.impFormEmp = null;
      gravarImpedimento(impSetor ? {col:"empresaSetores", empresaId:impEmp, setor:impSetor} : {col:"empresas", id:impEmp}, impDesc, impForm.querySelector(".imp-emp-agu").value);
      return;
    }
    var pvForm = ev.target.closest(".pessoa-vincular-form");
    if(pvForm){
      ev.preventDefault();
      if(!dbRef) return;
      var pvChave2 = pvForm.getAttribute("data-chave");
      var pessoaAlvo = pessoasUnicas().find(function(p){ return p.chave === pvChave2; });
      if(!pessoaAlvo) return;
      var pvNome = pvForm.querySelector(".pv-empresa").value.trim();
      var pvSetor = pvForm.querySelector(".pv-setor").value;
      var pvEmp = state.empresas.find(function(e){ return normBusca(e.nome) === normBusca(pvNome); });
      if(!pvEmp){ mostrarToast("Empresa não encontrada. Escolha uma da lista de sugestões."); return; }
      if(!pvSetor){ mostrarToast("Escolha o setor."); return; }
      if(pessoaAlvo.registros.some(function(c){ return c.empresaId === pvEmp.id; })){ mostrarToast("Essa pessoa já está vinculada a essa empresa."); return; }
      ui.pessoaVincularForm = null;
      vincularPessoaAEmpresa(pessoaAlvo, pvEmp.id, pvSetor).then(function(){ renderAll(); mostrarToast('“'+pessoaAlvo.nome+'” vinculada a “'+pvEmp.nome+'”.'); });
      return;
    }
    var form = ev.target.closest(".carteira-form");
    if(form){
      ev.preventDefault();
      if(!dbRef) return;
      var fid = form.getAttribute("data-fid");
      var nomeDigitado = form.querySelector(".cadd-empresa").value.trim();
      var setorEsc = form.querySelector(".cadd-setor").value;
      var emp = state.empresas.find(function(e){ return normBusca(e.nome) === normBusca(nomeDigitado); });
      if(!emp){ mostrarToast("Empresa não encontrada. Escolha uma da lista de sugestões."); return; }
      if(!setorEsc){ mostrarToast("Escolha o setor."); return; }
      if(!(emp.setoresDemanda && emp.setoresDemanda[setorEsc])){ mostrarToast("Essa empresa não tem demanda nesse setor."); return; }
      ui.carteiraAddAberto = null;
      definirAnalistaFrente(emp.id, setorEsc, fid);
      return;
    }
  });
  document.addEventListener("input", function(ev){
    var el = ev.target; if(!el.classList) return;
    var isCadd = el.classList.contains("cadd-empresa"), isPv = el.classList.contains("pv-empresa");
    if(!isCadd && !isPv) return;
    var form = el.closest(isCadd ? ".carteira-form" : ".pessoa-vincular-form"); if(!form) return;
    var selSetor = form.querySelector(isCadd ? ".cadd-setor" : ".pv-setor");
    var emp = state.empresas.find(function(e){ return normBusca(e.nome) === normBusca(el.value.trim()); });
    var opts = '<option value="">Setor…</option>';
    if(emp) opts += SETORES.filter(function(s){ return emp.setoresDemanda && emp.setoresDemanda[s.key]; }).map(function(s){ return '<option value="'+s.key+'">'+s.label+'</option>'; }).join("");
    if(selSetor.innerHTML !== opts) selSetor.innerHTML = opts;
  });
  document.addEventListener("input", function(ev){
    var el = ev.target; if(!el.classList && el.id !== "fc-nome") return;
    var isMiniNome = el.classList && el.classList.contains("ftc-nome"), isBigNome = el.id === "fc-nome";
    if(!isMiniNome && !isBigNome) return;
    var pessoaEsc = pessoasPorRotulo[el.value];
    if(pessoaEsc){
      el.value = pessoaEsc.nome;
      var emailAlvo = isBigNome ? $("#fc-email") : (el.closest("form") && el.closest("form").querySelector(".ftc-email"));
      if(emailAlvo) emailAlvo.value = pessoaEsc.email;
    }
  });
  document.addEventListener("submit", function(ev){
    var form = ev.target.closest(".ftc-form"); if(!form) return;
    ev.preventDefault();
    if(!dbRef) return;
    var empresaId = form.getAttribute("data-empresa"), setorKey = form.getAttribute("data-setor");
    var nome = form.querySelector(".ftc-nome").value.trim();
    if(!nome) return;
    var email = form.querySelector(".ftc-email").value.trim();
    if(contatoJaVinculado(nome, email, empresaId, setorKey)){
      mostrarToast(nome+" já está vinculado(a) a este setor.");
      return;
    }
    var emp = state.empresas.find(function(x){ return x.id === empresaId; });
    dbRef.collection("contatos").add({
      nome:nome, email:email, empresaId:empresaId, empresaNome:emp?emp.nome:"",
      setores:[setorKey], statusTreinamento:"pendente",
      exemplo:false, criadoEm:new Date().toISOString()
    });
    registrarAtividade({tipo:"contato", empresaId:empresaId, empresaNome:emp ? emp.nome : "", setor:setorKey, nome:nome});
    ui.focoContatoForm = null;
    mostrarToast('Contato “'+nome+'” cadastrado.');
  });

  document.addEventListener("blur", function(ev){
    var el = ev.target; if(!el.classList || !dbRef) return;
    if(el.classList.contains("align-gestor")){
      var setor = el.getAttribute("data-setor"), alAtual = state.alinhamentoSetor.find(function(x){ return x.id === setor; });
      if(alAtual && (alAtual.gestorNome || "") === el.value) return;
      if(alAtual) alAtual.gestorNome = el.value;
      salvarComAviso(el.id, alAtual
        ? dbRef.collection("setorAlinhamento").doc(setor).update({gestorNome: el.value})
        : dbRef.collection("setorAlinhamento").doc(setor).set({setor:setor, status:"pendente", data:"", gestorNome:el.value, criadoEm:new Date().toISOString()}));
      return;
    }
    if(el.classList.contains("func-obs")){
      var foObj = state.funcionarios.find(function(x){ return x.id === el.getAttribute("data-id"); });
      if(foObj && (foObj.observacoes || "") === el.value.trim()) return;
      if(foObj) foObj.observacoes = el.value.trim();
      salvarComAviso(el.id, dbRef.collection("funcionarios").doc(el.getAttribute("data-id")).update({observacoes: el.value.trim()}));
      return;
    }
    if(el.classList.contains("pessoa-nome")){
      var pnNovo = el.value.trim();
      if(pnNovo) editarPessoa(el.getAttribute("data-chave"), "nome", pnNovo, el.id);
      return;
    }
    if(el.classList.contains("pessoa-email")){
      editarPessoa(el.getAttribute("data-chave"), "email", el.value.trim(), el.id);
      return;
    }
    if(el.classList.contains("func-nome")){
      renomearFuncionario(el.getAttribute("data-id"), el.value.trim(), el.id);
      return;
    }
  }, true);

  /* ---------- progresso: busca unificada (empresa / analista / contato / funcionário) ---------- */
  function montarBusca(input, results, aoDigitar){
    var wrap = input.closest(".prog-search-wrap");
    var matches = [], activeIdx = -1;

    function norm(s){ return stripAccents(s).toLowerCase(); }

    function analistasUnicos(q){
      var vistos = {}, out = [];
      state.setores.forEach(function(s){
        var nome = (s.analistaNome || "").trim();
        if(!nome || vistos[nome]) return;
        if(norm(nome).indexOf(q) === -1) return;
        vistos[nome] = true;
        out.push(nome);
      });
      return out.sort(function(a,b){ return a.localeCompare(b, "pt-BR"); });
    }

    function abrir(v){ results.hidden = !v; input.setAttribute("aria-expanded", v ? "true" : "false"); }

    function renderResults(){
      var raw = input.value.trim();
      var q = norm(raw);
      if(!q){ abrir(false); matches = []; return; }
      var qd = raw.replace(/\D/g, "");

      var porFilial = matrizesPorBuscaFilial(normBusca(raw), qd);
      var itensEmp = state.empresas.filter(function(e){
        return norm(e.nome).indexOf(q) !== -1 || (qd.length >= 3 && String(e.cnpj||"").replace(/\D/g,"").indexOf(qd) !== -1) || porFilial[e.id];
      }).slice(0, 5).map(function(e){ return {tipo:"Empresa", id:e.id, titulo:e.nome, sub:(e.cnpj || "") + (porFilial[e.id] && norm(e.nome).indexOf(q) === -1 ? " · achada pela filial" : "")}; });

      var itensAna = analistasUnicos(q).slice(0, 5).map(function(nome){
        var n = state.setores.filter(function(s){ return s.analistaNome === nome; }).length;
        return {tipo:"Analista", id:nome, titulo:nome, sub:n+" frente"+(n===1?"":"s")};
      });

      var itensCont = state.contatos.filter(function(c){
        return norm(c.nome).indexOf(q) !== -1 || norm(c.email||"").indexOf(q) !== -1;
      }).slice(0, 5).map(function(c){ return {tipo:"Contato", id:c.id, titulo:c.nome, sub:c.empresaNome || c.email || ""}; });

      var itensFunc = state.funcionarios.filter(function(f){
        return norm(f.nome).indexOf(q) !== -1 || norm(f.cargo||"").indexOf(q) !== -1;
      }).slice(0, 5).map(function(f){ return {tipo:"Funcionário", id:f.nome, titulo:f.nome, sub:(f.cargo || SETOR_LABEL[f.setor] || "")}; });

      var list = itensEmp.concat(itensAna, itensCont, itensFunc);
      matches = list; activeIdx = list.length ? 0 : -1;

      results.innerHTML = list.length
        ? list.map(function(it, i){
            return '<button type="button" role="option" class="prog-search-item'+(i===activeIdx?" active":"")+'">' +
              '<span class="pa-tipo">'+it.tipo+'</span>' +
              '<span class="pa-main"><span class="pa-nome">'+esc(it.titulo)+'</span>'+(it.sub?'<span class="pa-sub">'+esc(it.sub)+'</span>':'')+'</span>' +
            '</button>';
          }).join("")
        : '<div class="prog-search-empty">Nada encontrado para “'+esc(raw)+'”.</div>';
      abrir(true);
    }

    function marcarAtivo(){
      $$(".prog-search-item", results).forEach(function(b,i){
        b.classList.toggle("active", i === activeIdx);
        if(i === activeIdx) b.scrollIntoView({block:"nearest"});
      });
    }

    function escolher(it){
      if(!it) return;
      input.value = "";
      if(aoDigitar){ ui.busca = ""; }
      abrir(false);
      if(it.tipo === "Empresa") irParaEmpresa(it.id);
      else if(it.tipo === "Contato") irParaContato(it.id);
      else if(it.tipo === "Funcionário") irParaFuncionario(it.id);
      else { ui.filtroAnalista = it.id; setView("progresso"); abrirSecaoEmpresas(); renderEmpresas(); }
    }

    input.addEventListener("input", function(){
      if(aoDigitar) aoDigitar(input.value);
      renderResults();
    });
    input.addEventListener("focus", renderResults);
    input.addEventListener("keydown", function(ev){
      if(ev.key === "Escape"){ abrir(false); return; }
      if(results.hidden) return;
      if(ev.key === "ArrowDown"){ ev.preventDefault(); if(activeIdx < matches.length-1){ activeIdx++; marcarAtivo(); } }
      else if(ev.key === "ArrowUp"){ ev.preventDefault(); if(activeIdx > 0){ activeIdx--; marcarAtivo(); } }
      else if(ev.key === "Enter" && matches[activeIdx]){ ev.preventDefault(); escolher(matches[activeIdx]); }
    });
    results.addEventListener("mousedown", function(ev){
      var b = ev.target.closest(".prog-search-item"); if(!b) return;
      ev.preventDefault();
      escolher(matches[$$(".prog-search-item", results).indexOf(b)]);
    });
    results.addEventListener("mousemove", function(ev){
      var b = ev.target.closest(".prog-search-item"); if(!b) return;
      var i = $$(".prog-search-item", results).indexOf(b);
      if(i !== activeIdx){ activeIdx = i; marcarAtivo(); }
    });
    document.addEventListener("click", function(ev){
      if(!wrap.contains(ev.target)) abrir(false);
    });
  }
  var buscaTimer = null;
  montarBusca($("#empresaSearch"), $("#empresaSearchResults"), function(v){
    ui.busca = v;
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(function(){ keepFocus(renderEmpresas); }, 150);
  });
  montarBusca($("#globalSearch"), $("#globalSearchResults"), null);
  (function(){
    var box = $("#mhSearch"), btn = $("#btnBuscaMobile"), input = $("#globalSearch");
    function abrirBusca(v){ box.classList.toggle("aberta", v); btn.setAttribute("aria-expanded", v ? "true" : "false"); if(v) input.focus(); }
    btn.addEventListener("click", function(){ abrirBusca(!box.classList.contains("aberta")); });
    input.addEventListener("keydown", function(ev){ if(ev.key === "Escape" && !input.value) abrirBusca(false); });
    $("#globalSearchResults").addEventListener("mousedown", function(){ setTimeout(function(){ abrirBusca(false); }, 0); });
    document.addEventListener("click", function(ev){ if(box.classList.contains("aberta") && !box.contains(ev.target)) abrirBusca(false); });
  })();

  /* ---------- foco: busca para adicionar ---------- */
  (function(){
    var input = $("#focoAddSearch"), results = $("#focoAddResults");
    var matches = [], activeIdx = -1, navegou = false;

    function norm(s){ return stripAccents(s).toLowerCase(); }
    function pctEmpresa(e){
      return Math.round(progressoEmpresa(e, docsDaEmpresa(e.id)) * 100);
    }
    function abrir(v){ results.hidden = !v; input.setAttribute("aria-expanded", v ? "true" : "false"); }
    function renderResults(){
      var q = norm(input.value.trim());
      var qd = input.value.replace(/\D/g, "");
      var list = state.empresas.filter(function(e){ return !e.emFoco; });
      if(q){
        list = list.filter(function(e){
          return norm(e.nome).indexOf(q) !== -1 || (qd.length >= 3 && String(e.cnpj||"").replace(/\D/g,"").indexOf(qd) !== -1);
        });
        list.sort(function(a,b){
          var ia = norm(a.nome).indexOf(q), ib = norm(b.nome).indexOf(q);
          if((ia === 0) !== (ib === 0)) return ia === 0 ? -1 : 1;
          return a.nome.localeCompare(b.nome);
        });
      } else {
        list.sort(function(a,b){ return a.nome.localeCompare(b.nome); });
      }
      list = list.slice(0, 6);
      matches = list; activeIdx = list.length ? 0 : -1;
      if(!q){ abrir(false); return; }
      if(!state.empresas.length){
        results.innerHTML = '<div class="foco-add-empty">Nenhuma empresa cadastrada ainda.</div>';
      } else if(!list.length){
        results.innerHTML = '<div class="foco-add-empty">Nenhuma empresa fora do foco com “'+esc(input.value.trim())+'”.</div>';
      } else {
        results.innerHTML = '<div class="foco-add-titulo">Adicionar ao foco</div>' + list.map(function(e,i){
          return '<button type="button" role="option" class="foco-add-item'+(i===0?" active":"")+'" data-id="'+e.id+'">' +
            '<span class="fa-main"><span class="fa-nome">'+esc(e.nome)+'</span>'+(e.cnpj?'<span class="esub">'+esc(e.cnpj)+'</span>':'')+'</span>' +
            '<span class="fa-pct">'+pctEmpresa(e)+'%</span>' +
            '<span class="fa-hint">Enter ↵</span>' +
          '</button>';
        }).join("");
      }
      abrir(true);
    }
    function marcarAtivo(){
      $$(".foco-add-item", results).forEach(function(b,i){
        b.classList.toggle("active", i === activeIdx);
        if(i === activeIdx) b.scrollIntoView({block:"nearest"});
      });
    }
    function escolher(id){
      if(!id) return;
      adicionarAoFoco(id);
      limparBuscaFoco();
      input.value = "";
      abrir(false);
      input.focus();
    }
    input.addEventListener("focus", renderResults);
    input.addEventListener("input", function(){ navegou = false; renderResults(); aplicarBuscaFoco(input.value); });
    input.addEventListener("keydown", function(ev){
      if(ev.key === "Escape"){
        if(!results.hidden) abrir(false);
        else if(input.value){ ev.stopPropagation(); limparBuscaFoco(); }
        else input.blur();
        ev.preventDefault();
        return;
      }
      if(results.hidden){ if(ev.key === "ArrowDown"){ ev.preventDefault(); renderResults(); } return; }
      if(ev.key === "ArrowDown"){ ev.preventDefault(); navegou = true; if(activeIdx < matches.length-1){ activeIdx++; marcarAtivo(); } }
      else if(ev.key === "ArrowUp"){ ev.preventDefault(); navegou = true; if(activeIdx > 0){ activeIdx--; marcarAtivo(); } }
      else if(ev.key === "Enter"){
        ev.preventDefault();
        // Enter só adiciona quando o texto não é uma pesquisa entre as que já estão em foco (ou se escolheu com as setas).
        clearTimeout(tBuscaFoco); ui.focoBusca = input.value;
        var temNoFoco = listaFoco().some(function(e){ return buscaFocoEmpresa(e).ok; });
        if(temNoFoco && !navegou){ abrir(false); abrirResultadosBuscaFoco(); renderFocoAtivo(); return; }
        if(matches[activeIdx]) escolher(matches[activeIdx].id);
      }
    });
    results.addEventListener("mousedown", function(ev){
      var b = ev.target.closest(".foco-add-item"); if(!b) return;
      ev.preventDefault();
      escolher(b.getAttribute("data-id"));
    });
    results.addEventListener("mousemove", function(ev){
      var b = ev.target.closest(".foco-add-item"); if(!b) return;
      var i = $$(".foco-add-item", results).indexOf(b);
      if(i !== activeIdx){ activeIdx = i; marcarAtivo(); }
    });
    document.addEventListener("click", function(ev){
      if(!ev.target.closest(".foco-add-wrap")) abrir(false);
    });
    document.addEventListener("keydown", function(ev){
      if(ev.key !== "/" || ui.view !== "foco" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var t = ev.target;
      if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      ev.preventDefault();
      input.focus();
    });
  })();

  /* ---------- foco: salvamento automático dos campos ---------- */
  (function(){
    var timers = {};
    function acharSetor(id){ return state.setores.find(function(s){ return s.id === id; }); }
    function campo(el){
      if(!el || !el.classList) return null;
      var emp = el.getAttribute("data-empresa"), setor = el.getAttribute("data-setor"), docId = el.getAttribute("data-docid"), etapa = el.getAttribute("data-etapa");
      if(el.classList.contains("fobs") && etapa === "habilitacaoDominio") return {
        k:"obs:"+docId+":"+etapa,
        local:function(v){ var eH = empresaPorId(emp); if(eH) eH.habilitacao = habilitacaoCompleta(emp, {obs:v}); },
        salvar:function(v){ return salvarHabilitacao(emp, {obs:v}); }
      };
      if(el.classList.contains("fobs")) return {
        k:"obs:"+docId+":"+etapa,
        local:function(v){ var d = acharSetor(docId); if(d){ d.etapas = Object.assign({}, d.etapas); d.etapas[etapa] = Object.assign({}, d.etapas[etapa], {obs:v}); } },
        salvar:function(v){ return garantirSetorDoc(emp, setor).then(function(id){ var p = {}; p[etapa] = {obs:v}; return dbRef.collection("empresaSetores").doc(id).update({etapas:p}); }); }
      };
      if(el.classList.contains("fpa-texto")){
        var paId = el.getAttribute("data-id");
        return {
          k:"pa:"+paId,
          local:function(v){ var em = state.empresas.find(function(x){ return x.id === paId; }); if(em) em.focoProxAcao = v; },
          salvar:function(v){ return dbRef.collection("empresas").doc(paId).update({focoProxAcao:v}); }
        };
      }
      if(el.classList.contains("fpa-agu-texto")){
        var aoId = el.getAttribute("data-id");
        return {
          k:"pao:"+aoId,
          local:function(v){ var em = state.empresas.find(function(x){ return x.id === aoId; }); if(em) em.focoAguardandoOutro = v; },
          salvar:function(v){ return dbRef.collection("empresas").doc(aoId).update({focoAguardandoOutro:v}); }
        };
      }
      if(el.classList.contains("fgest")) return {
        k:"gest:"+setor,
        local:function(v){ var a = state.alinhamentoSetor.find(function(x){ return x.id === setor; }); if(a) a.gestorNome = v; },
        salvar:function(v){
          if(state.alinhamentoSetor.some(function(x){ return x.id === setor; })) return dbRef.collection("setorAlinhamento").doc(setor).update({gestorNome:v});
          return dbRef.collection("setorAlinhamento").doc(setor).set({setor:setor, status:"pendente", data:"", gestorNome:v, criadoEm:new Date().toISOString()});
        }
      };
      return null;
    }
    var indicar = marcarSalvo;
    function gravar(c, inputId){
      clearTimeout(timers[c.k]); delete timers[c.k];
      var v = rascunhos[c.k];
      if(v === undefined || !dbRef) return;
      Promise.resolve().then(function(){ return c.salvar(v); }).then(function(){
        if(rascunhos[c.k] === v) delete rascunhos[c.k];
        indicar(inputId, "ok");
      }).catch(function(){ indicar(inputId, "err"); });
    }
    document.addEventListener("input", function(ev){
      var el = ev.target, c = campo(el); if(!c) return;
      rascunhos[c.k] = el.value;
      c.local(el.value);
      indicar(el.id, "pend");
      clearTimeout(timers[c.k]);
      var inputId = el.id;
      timers[c.k] = setTimeout(function(){ gravar(c, inputId); }, 650);
    });
    document.addEventListener("focusout", function(ev){
      var c = campo(ev.target);
      if(c && rascunhos[c.k] !== undefined && timers[c.k]) gravar(c, ev.target.id);
    });
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" && campo(ev.target)){ ev.preventDefault(); ev.target.blur(); }
    });
  })();
  $("#treinoSearch").addEventListener("input", function(){ ui.treinoBusca = this.value; renderTreinamento(); });
  $("#pessoasSearch").addEventListener("input", function(){ ui.pessoasBusca = this.value; renderContatosCadastro(); });
  $("#pessoasEmpresaFiltro").addEventListener("change", function(){ ui.pessoasFiltroEmpresa = this.value; renderContatosCadastro(); });
  $("#impSearch").addEventListener("input", function(){ ui.impBusca = this.value; renderImpedimentos(model()); });


  /* ---------- forms ---------- */
  $("#formEmpresa").addEventListener("submit", function(ev){
    ev.preventDefault(); if(!dbRef) return;
    var nome = $("#fe-nome").value.trim(); if(!nome) return;
    var form = this, cnpjD = $("#fe-cnpj").value.replace(/\D/g, "");
    var mesmoCnpj = cnpjD.length >= 8 && state.empresas.find(function(e){ return String(e.cnpj || "").replace(/\D/g, "") === cnpjD; });
    if(mesmoCnpj){
      confirmar("Já existe uma empresa com esse CNPJ: “"+mesmoCnpj.nome+"”. Abrir a empresa existente?", function(){ irParaEmpresa(mesmoCnpj.id); }, "Abrir a existente");
      return;
    }
    var mesmoNome = !form.dataset.confirmado && state.empresas.find(function(e){ return normBusca(e.nome).trim() === normBusca(nome).trim(); });
    if(mesmoNome){
      confirmar("Já existe uma empresa chamada “"+mesmoNome.nome+"”"+(mesmoNome.cnpj ? " (CNPJ "+mesmoNome.cnpj+")" : "")+". Cadastrar outra com o mesmo nome mesmo assim?", function(){ form.dataset.confirmado = "1"; form.requestSubmit(); }, "Cadastrar mesmo assim");
      return;
    }
    delete form.dataset.confirmado;
    var dem = {pessoal:$("#fe-pessoal").checked, contabil:$("#fe-contabil").checked, fiscal:$("#fe-fiscal").checked};
    var folha = $("#fe-folha").checked, rubricas = $("#fe-rubricas").checked;
    var cnpjNovo = $("#fe-cnpj").value.trim();
    dbRef.collection("empresas").add({
      nome:nome, cnpj:cnpjNovo, ativo:true, folhaAtiva:folha, precisaRubricas:rubricas,
      setoresDemanda:dem, impedimento:{ativo:false, descricao:""}, exemplo:false, criadoEm:new Date().toISOString()
    }).then(function(ref){
      var stub = {id:ref.id, nome:nome};
      SETORES.forEach(function(s){ if(dem[s.key]) ensureSetorDoc(stub, s.key); });
      registrarAtividade({tipo:"empresa", empresaId:ref.id, empresaNome:nome});
      // Mesma raiz de CNPJ de uma matriz já cadastrada: oferece cadastrar como filial dela.
      var rz = raizCnpj(cnpjNovo), mz = rz && !ehCnpjMatriz(cnpjNovo) && state.empresas.find(function(x){ return x.id !== ref.id && raizCnpj(x.cnpj) === rz && ehCnpjMatriz(x.cnpj); });
      if(mz) setTimeout(function(){
        mostrarToast("“"+nome+"” parece filial de “"+mz.nome+"” (mesma raiz de CNPJ).", "Vincular como filial", function(){ vincularFilial(ref.id, mz.id); });
      }, 600);
    });
    this.reset();
    avisar('Empresa “'+nome+'” cadastrada.', "ok");
  });

  $("#formFuncionario").addEventListener("submit", function(ev){
    ev.preventDefault(); if(!dbRef) return;
    var nome = $("#ff-nome").value.trim(); if(!nome) return;
    dbRef.collection("funcionarios").add({
      nome:nome, setor:$("#ff-setor").value, cargo:$("#ff-cargo").value.trim(),
      statusTreinamento:$("#ff-status").value, impedimento:{ativo:false, descricao:""},
      observacoes:"", exemplo:false, criadoEm:new Date().toISOString()
    });
    this.reset();
    avisar('Funcionário “'+nome+'” cadastrado.', "ok");
  });

  $("#formContato").addEventListener("submit", function(ev){
    ev.preventDefault(); if(!dbRef) return;
    var nome = $("#fc-nome").value.trim(), eid = empresaDoCampo($("#fc-empresa").value);
    if(!eid){ var fce = $("#fc-empresa"); fce.setCustomValidity("Escolha uma empresa da lista."); fce.reportValidity(); fce.oninput = function(){ fce.setCustomValidity(""); }; return; }
    if(!nome || !eid) return;
    var email = $("#fc-email").value.trim();
    if(contatoJaVinculado(nome, email, eid, null)){
      avisar(nome+" já está vinculado(a) a esta empresa.", "warn");
      return;
    }
    var emp = state.empresas.find(function(x){ return x.id === eid; });
    var setores = SETORES.filter(function(s){ return $("#fc-"+s.key).checked; }).map(function(s){ return s.key; });
    dbRef.collection("contatos").add({
      nome:nome, email:$("#fc-email").value.trim(), empresaId:eid, empresaNome:emp?emp.nome:"",
      setores:setores, statusTreinamento:$("#fc-status").value,
      agendadoPara:$("#fc-status").value === "agendado" ? $("#fc-ag").value : "",
      exemplo:false, criadoEm:new Date().toISOString()
    });
    registrarAtividade({tipo:"contato", empresaId:eid, empresaNome:emp ? emp.nome : "", setor:setores.length === 1 ? setores[0] : "", nome:nome});
    this.reset();
    $("#fc-ag-wrap").hidden = true;
    avisar('Contato “'+nome+'” cadastrado.', "ok");
  });

  $("#fc-status").addEventListener("change", function(){ $("#fc-ag-wrap").hidden = this.value !== "agendado"; });
  $("#bulkFuncStatus").addEventListener("change", function(){ $("#bulkFuncDataWrap").hidden = this.value !== "agendado"; });
  $("#bulkPessoaStatus").addEventListener("change", function(){ $("#bulkPessoaDataWrap").hidden = this.value !== "agendado"; });

  $("#formImpedimento").addEventListener("submit", function(ev){
    ev.preventDefault(); if(!dbRef) return;
    var campo = $("#imp-alvo"), alvo = impAlvoMapa[campo.value.trim()], desc = $("#imp-desc").value.trim();
    if(!alvo){ campo.setCustomValidity("Escolha um item da lista de sugestões."); campo.reportValidity(); return; }
    if(!desc) return;
    gravarImpedimento(alvo, desc, $("#imp-aguardando").value);
    this.reset();
    this.hidden = true;
    $$('[data-action="imp-novo-abrir"]').forEach(function(b){ b.hidden = false; });
  });

  $("#btnRemoverExemplos").addEventListener("click", function(){
    confirmar("Remover todos os registros marcados como exemplo?", function(){
      if(!dbRef) return;
      state.empresas.filter(function(x){ return x.exemplo; }).forEach(function(x){ dbRef.collection("empresas").doc(x.id).delete(); });
      state.setores.filter(function(x){ return x.exemplo; }).forEach(function(x){ dbRef.collection("empresaSetores").doc(x.id).delete(); });
      state.funcionarios.filter(function(x){ return x.exemplo; }).forEach(function(x){ dbRef.collection("funcionarios").doc(x.id).delete(); });
      state.contatos.filter(function(x){ return x.exemplo; }).forEach(function(x){ dbRef.collection("contatos").doc(x.id).delete(); });
    });
  });

  /* ---------- planilha: modelo e importação ---------- */
  var downloadsRef = null;

  function avisar(msg, tone){
    var el = $("#importStatus");
    el.textContent = msg;
    el.className = "import-status" + (tone === "warn" ? " warn" : tone === "ok" ? " ok" : "");
    el.hidden = false;
  }
  function stripAccents(s){ return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,""); }
  function slugify(s){
    var t = stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    return t || "item";
  }
  function uniqueId(base, usedSet){
    var id = base, n = 1;
    while(usedSet.has(id)){ id = base + "-" + (++n); }
    usedSet.add(id);
    return id;
  }
  function simNao(v, def){
    if(v === undefined || v === null || String(v).trim() === "") return def;
    var t = stripAccents(String(v)).trim().toLowerCase();
    return t === "sim" || t === "s" || t === "true" || t === "1" || t === "x";
  }
  function getCell(row, name){
    var target = stripAccents(name).toLowerCase();
    var keys = Object.keys(row);
    for(var i=0;i<keys.length;i++){ if(stripAccents(keys[i]).toLowerCase().trim() === target) return row[keys[i]]; }
    return undefined;
  }
  function normalizarStatus(v, agendadoParaRaw){
    var raw = stripAccents(String(v||"")).toLowerCase().trim();
    if(!raw) return String(agendadoParaRaw||"").trim() ? "agendado" : "pendente";
    var chaves = Object.keys(STATUS_LABEL);
    if(chaves.indexOf(raw) !== -1) return raw;
    for(var i=0;i<chaves.length;i++){
      if(stripAccents(STATUS_LABEL[chaves[i]]).toLowerCase().trim() === raw) return chaves[i];
    }
    return "pendente";
  }
  function normalizarSetor(v){
    var raw = stripAccents(String(v||"")).toLowerCase().trim();
    return ["pessoal","contabil","fiscal"].indexOf(raw) !== -1 ? raw : null;
  }
  function normalizarCargo(v){
    var raw = stripAccents(String(v||"")).toLowerCase().trim();
    if(!raw) return "";
    for(var i=0;i<CARGOS.length;i++){
      var c = CARGOS[i];
      if(stripAccents(c).toLowerCase().trim() === raw) return c;
      if(stripAccents(c.replace("(a)","")).toLowerCase().trim() === raw) return c;
    }
    return null;
  }

  function avisarBackup(msg, tone){
    var el = $("#backupStatus");
    el.textContent = msg;
    el.className = "import-status" + (tone === "warn" ? " warn" : tone === "ok" ? " ok" : "");
    el.hidden = false;
  }

  // Datas gravadas como ISO completo viram "AAAA-MM-DD HH:MM" no horário local (mais legível na planilha).
  function isoParaPlanilha(v){
    if(!v) return "";
    var t = String(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var d = new Date(t);
    return isNaN(d.getTime()) ? t : diaLocal(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  $("#btnBaixarBackup").addEventListener("click", function(){
    if(typeof XLSX === "undefined"){ avisarBackup("A biblioteca de planilhas ainda não carregou. Aguarde um instante e tente de novo.", "warn"); return; }
    if(!downloadsRef){ avisarBackup("O download de arquivos não está disponível nesta janela.", "warn"); return; }
    avisarBackup("Montando o backup…");
    var evs = eventosUnificados();
    var idsPor = evs.map(function(e){ return e.por; }).filter(Boolean);
    nomesDe(idsPor).then(function(nomes){ montarBackup(evs, nomes || {}); }, function(){ montarBackup(evs, {}); });
  });
  function montarBackup(evs, nomes){
    var wb = XLSX.utils.book_new();
    var empPorId = {};
    todasEmpresas().forEach(function(e){ empPorId[e.id] = e; });
    var cnpjDe = function(id){ return (empPorId[id] && empPorId[id].cnpj) || ""; };

    var empresasRows = [["Nome","CNPJ","Ativo","Folha Ativa","Precisa Rubricas","Setor Pessoal","Setor Contabil","Setor Fiscal","Impedimento Ativo","Impedimento Descricao","Em Foco","Em Foco Desde","Proxima Acao","Prazo","Aguardando","Aguardando (outro)","Cadastrado Em","Matriz CNPJ","Matriz ID","ID"]];
    todasEmpresas().forEach(function(e){
      var mzB = matrizDaFilial(e.id);
      empresasRows.push([
        e.nome||"", e.cnpj||"", e.ativo!==false?"SIM":"NAO", e.folhaAtiva?"SIM":"NAO", e.precisaRubricas?"SIM":"NAO",
        (e.setoresDemanda&&e.setoresDemanda.pessoal)?"SIM":"NAO", (e.setoresDemanda&&e.setoresDemanda.contabil)?"SIM":"NAO", (e.setoresDemanda&&e.setoresDemanda.fiscal)?"SIM":"NAO",
        (e.impedimento&&e.impedimento.ativo)?"SIM":"NAO", (e.impedimento&&e.impedimento.descricao)||"", e.emFoco?"SIM":"NAO", e.emFoco ? isoParaPlanilha(e.emFocoEm) : "",
        e.focoProxAcao||"", e.focoPrazo||"", AGUARDANDO[e.focoAguardando] ? (e.focoAguardando === "outro" ? "Outro" : AGUARDANDO[e.focoAguardando]) : "", e.focoAguardando === "outro" ? (e.focoAguardandoOutro||"") : "",
        isoParaPlanilha(e.criadoEm), mzB ? (mzB.cnpj || "") : "", mzB ? mzB.id : "", e.id
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empresasRows), "Empresas");

    var setoresHead = ["Empresa","CNPJ","Setor","Com Demanda","Analista"];
    ETAPAS.forEach(function(et){ setoresHead.push(et.label+" Status", et.label+" Data", et.label+" Agendado Para", et.label+" Horario", et.label+" Obs"); });
    setoresHead.push("Contatos Treinados","Impedimento Ativo","Impedimento Descricao");
    var setoresRows = [setoresHead];
    (bruto.setores || state.setores).forEach(function(s){
      var emp = empPorId[s.empresaId];
      var row = [s.empresaNome||"", cnpjDe(s.empresaId), SETOR_LABEL[s.setor]||s.setor, (emp && emp.setoresDemanda && emp.setoresDemanda[s.setor]) ? "SIM" : "NAO",
        s.analistaNome||""];
      var comp = statusClienteComputado(s.empresaId, s.setor);
      ETAPAS.forEach(function(et){
        var obsEt = et.porEmpresa ? habilitacaoEmpresa(s.empresaId).obs : ((s.etapas && s.etapas[et.key] && s.etapas[et.key].obs) || "");
        if(et.onlyIf && emp && !et.onlyIf(emp, s.setor)){ row.push("Não se aplica", "", "", "", obsEt); return; }
        // Mesma situação que aparece na tela (clientes: calculado pelos contatos; analista: considera Equipe).
        var et2 = et.key === "treinamentoCliente" ? comp : etapaInfo(s, et.key);
        row.push(STATUS_LABEL[et2.status]||"Pendente", et2.data||"", et2.status === "agendado" ? (et2.agendadoPara||"") : "", et2.status === "agendado" ? (et2.agendadoHora||"") : "", obsEt);
      });
      row.push(comp.feitos + "/" + comp.total, (s.impedimento&&s.impedimento.ativo)?"SIM":"NAO", (s.impedimento&&s.impedimento.descricao)||"");
      setoresRows.push(row);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(setoresRows), "Progresso por Setor");

    var funcRows = [["Nome","Setor","Cargo","Status Treinamento","Agendado Para","Horario","Concluido Em","Empresas na Carteira","Observacoes","Impedimento Ativo","Impedimento Descricao","Cadastrado Em","ID"]];
    state.funcionarios.forEach(function(f){
      var carteira = state.setores.filter(function(sd){ return resolverAnalista(sd).id === f.id; }).length;
      funcRows.push([f.nome||"", SETOR_LABEL[f.setor]||f.setor||"", f.cargo||"", STATUS_LABEL[f.statusTreinamento]||"Pendente", f.statusTreinamento === "agendado" ? (f.agendadoPara||"") : "", f.statusTreinamento === "agendado" ? (f.agendadoHora||"") : "",
        f.statusTreinamento === "concluido" ? isoParaPlanilha(f.concluidoEm) : "", carteira, f.observacoes||"", (f.impedimento&&f.impedimento.ativo)?"SIM":"NAO", (f.impedimento&&f.impedimento.descricao)||"", isoParaPlanilha(f.criadoEm), f.id]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(funcRows), "Funcionarios");

    var contRows = [["Nome","Email","Empresa","CNPJ Empresa","Setores que Acessa","Status Treinamento","Agendado Para","Horario","Concluido Em","Sócio","Cadastrado Em","ID"]];
    (bruto.contatos || state.contatos).forEach(function(c){
      contRows.push([c.nome||"", c.email||"", c.empresaNome||"", cnpjDe(c.empresaId), (c.setores||[]).map(function(s){ return SETOR_LABEL[s]||s; }).join(", "), STATUS_LABEL[c.statusTreinamento]||"Pendente",
        c.statusTreinamento === "agendado" ? (c.agendadoPara||"") : "", c.statusTreinamento === "agendado" ? (c.agendadoHora||"") : "", c.statusTreinamento === "concluido" ? isoParaPlanilha(c.concluidoEm) : "",
        c.socio?"SIM":"NAO", isoParaPlanilha(c.criadoEm), c.id]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(contRows), "Contatos");

    var alinhRows = [["Setor","Status","Data","Gestor"]];
    SETORES.forEach(function(s){
      var a = alinhamentoDoc(s.key);
      alinhRows.push([s.label, STATUS_LABEL[a.status]||"Pendente", a.data||"", a.gestorNome||""]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(alinhRows), "Alinhamento por Setor");

    var regRows = [["Data","Hora","Tipo","Atividade","Onde","Por","Origem"]];
    evs.forEach(function(e){
      var d = descEvento(e);
      regRows.push([e.dia||"", e.em ? horaDeISO(e.em) : "", TIPOS_ATV[e.tipo]||e.tipo||"", d.txt||"", ondeEvento(e)||"", (e.por && (nomes[e.por] || nomesPessoas[e.por])) || "", e.origem === "derivado" ? "data da etapa" : "registro"]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(regRows), "Registro de Atividades");

    if(state.auditoriaDominio.length){
      var chavesAud = {};
      state.auditoriaDominio.forEach(function(a){ Object.keys(a).forEach(function(k){ if(k !== "id") chavesAud[k] = true; }); });
      var colsAud = Object.keys(chavesAud);
      var audRows = [colsAud].concat(state.auditoriaDominio.map(function(a){ return colsAud.map(function(k){ var v = a[k]; return v && typeof v === "object" ? JSON.stringify(v) : (v === undefined ? "" : v); }); }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audRows), "Auditoria Dominio");
    }

    var resumoRows = [["BACKUP · PORTAL DO CLIENTE CONTROLTAX"], ["Gerado em", isoParaPlanilha(new Date().toISOString())], [""],
      ["Aba","Linhas"], ["Empresas", todasEmpresas().length], ["Progresso por Setor", (bruto.setores || state.setores).length], ["Funcionarios", state.funcionarios.length], ["Contatos", (bruto.contatos || state.contatos).length],
      ["Alinhamento por Setor", SETORES.length], ["Registro de Atividades", evs.length]].concat(state.auditoriaDominio.length ? [["Auditoria Dominio", state.auditoriaDominio.length]] : []).concat([
      [""], ["Para restaurar, importe este mesmo arquivo na aba Cadastro. O Registro de Atividades é só para consulta: não é reimportado."],
      ["A coluna ID identifica cada registro na restauração: não altere. Em linhas novas, deixe o ID em branco."],
      ["Treinamento dos clientes é calculado pelos contatos; Treinamento do analista mostra a situação considerando o cadastro da pessoa em Equipe."]]);
    var wsRes = XLSX.utils.aoa_to_sheet(resumoRows);
    XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");
    wb.SheetNames = ["Resumo"].concat(wb.SheetNames.filter(function(n){ return n !== "Resumo"; }));

    var arr = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    var blob = new Blob([arr], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    var hoje = new Date().toISOString().slice(0,10);
    downloadsRef.save({filename:"backup-portal-cliente-controltax-"+hoje+".xlsx", data:blob}).then(function(){
      registrarAtividade({tipo:"backup", texto:"Backup completo baixado"});
      avisarBackup("Backup baixado com sucesso: " + state.empresas.length + " empresas" + (todasEmpresas().length > state.empresas.length ? " (+" + (todasEmpresas().length - state.empresas.length) + " filiais)" : "") + ", " + state.setores.length + " frentes, " + state.contatos.length + " contatos, " + state.funcionarios.length + " funcionários e " + evs.length + " atividades.", "ok");
    }).catch(function(err){
      if(err && err.code === "declined"){ $("#backupStatus").hidden = true; return; }
      avisarBackup("Não foi possível baixar o backup agora. Tente novamente.", "warn");
    });
  }

  $("#btnBaixarModelo").addEventListener("click", function(){
    if(typeof XLSX === "undefined"){ avisar("A biblioteca de planilhas ainda não carregou. Aguarde um instante e tente de novo.", "warn"); return; }
    if(!downloadsRef){ avisar("O download de arquivos não está disponível nesta janela.", "warn"); return; }
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["MODELO DE IMPORTAÇÃO · PORTAL DO CLIENTE CONTROLTAX"],
      [""],
      ["Preencha as abas Empresas, Funcionarios e Contatos e importe este mesmo arquivo de volta na aba Cadastro."],
      ["Empresas e funcionários com o mesmo nome de um já cadastrado são atualizados, não duplicados."],
      ["Contatos são casados por nome + empresa."],
      [""],
      ["Colunas SIM/NAO: preencha SIM ou NAO (em branco = NAO, exceto Ativo, que é SIM por padrão)."],
      ["Status de treinamento (Funcionarios) aceitos: pendente, agendado, andamento ou concluido. Se agendado, preencha Agendado Para com a data (AAAA-MM-DD) e, se quiser, Horario (HH:MM)."],
      ["Status de treinamento (Contatos) aceitos: pendente, agendado, andamento ou concluido. Se agendado, preencha Agendado Para com a data (AAAA-MM-DD) e, se quiser, Horario (HH:MM)."],
      ["Setor (aba Funcionarios) aceito: pessoal, contabil ou fiscal."],
      ["Cargo (aba Funcionarios) aceito: Estagiário(a), Analista, Gestor(a), Coordenador(a), Supervisor(a) ou Diretor(a) (ou em branco)."],
      ["Setores que Acessa (aba Contatos): liste os setores separados por vírgula, ex.: \"pessoal, fiscal\"."],
      ["Matriz CNPJ (aba Empresas): só para filiais. Informe o CNPJ da matriz; a filial passa a contar junto com ela, e contatos e progresso dela vão para a matriz."]
    ]), "Leia-me");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nome","CNPJ","Ativo","Folha Ativa","Setor Pessoal","Setor Contabil","Setor Fiscal","Matriz CNPJ"],
      ["Empresa Exemplo Ltda","12.345.678/0001-90","SIM","SIM","SIM","SIM","NAO",""],
      ["Empresa Exemplo Ltda - Filial","12.345.678/0002-71","SIM","SIM","SIM","SIM","NAO","12.345.678/0001-90"]
    ]), "Empresas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nome","Setor","Cargo","Status Treinamento","Agendado Para","Horario","Observacoes"],
      ["Fulano de Tal","pessoal","Analista","agendado","2026-10-15","14:00",""]
    ]), "Funcionarios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nome","Email","Empresa","Setores que Acessa","Status Treinamento","Agendado Para","Horario","Sócio"],
      ["Fulano Cliente","fulano@empresa.com.br","Empresa Exemplo Ltda","pessoal, fiscal","agendado","2026-10-15","09:30","NAO"]
    ]), "Contatos");
    var arr = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    var blob = new Blob([arr], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    downloadsRef.save({filename:"modelo-portal-cliente-controltax.xlsx", data:blob}).then(function(){
      avisar("Modelo baixado. Preencha e volte aqui para importar.", "ok");
    }).catch(function(err){
      if(err && err.code === "declined") return;
      avisar("Não foi possível baixar o modelo agora. Tente novamente.", "warn");
    });
  });

  $("#fileImport").addEventListener("change", function(){
    var f = this.files[0];
    $("#fileImportName").textContent = f ? f.name : "Nenhum arquivo selecionado";
    $("#btnImportar").disabled = !f;
  });

  $("#btnImportar").addEventListener("click", function(){
    var file = $("#fileImport").files[0];
    if(!file) return;
    if(typeof XLSX === "undefined"){ avisar("A biblioteca de planilhas ainda não carregou. Aguarde um instante e tente de novo.", "warn"); return; }
    if(!dbRef){ avisar("Banco de dados indisponível no momento.", "warn"); return; }
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var wb = XLSX.read(new Uint8Array(ev.target.result), {type:"array"});
        processarImportacao(wb);
      }catch(err){
        avisar("Não foi possível ler essa planilha: " + (err&&err.message?err.message:"formato inválido."), "warn");
      }
    };
    reader.onerror = function(){ avisar("Não foi possível ler o arquivo selecionado.", "warn"); };
    reader.readAsArrayBuffer(file);
  });

  function processarImportacao(wb){
    var resumo = {empresasNovas:0, empresasAtt:0, funcNovos:0, funcAtt:0, contNovos:0, contAtt:0, setoresAtt:0, alinhamentoAtt:0, avisos:[]};
    var idsEmpresa = new Set(todasEmpresas().map(function(e){ return e.id; }));
    var idsFunc = new Set(state.funcionarios.map(function(f){ return f.id; }));
    var idsSetor = new Set(state.setores.map(function(s){ return s.id; }));
    var idsCont = new Set(state.contatos.map(function(c){ return c.id; }));

    var empresaPorNome = {}, empresaPorCnpj = {};
    var digitosCnpj = function(v){ var d = String(v || "").replace(/\D/g, ""); return d.length >= 11 ? d : ""; };
    todasEmpresas().forEach(function(e){ empresaPorNome[stripAccents(e.nome).toLowerCase().trim()] = e; var dc = digitosCnpj(e.cnpj); if(dc) empresaPorCnpj[dc] = e; });
    // Filial → matriz (as já vinculadas e as que esta planilha vincular): contatos e progresso vão para a matriz.
    var matrizImport = {}, vinculosImport = [];
    Object.keys(grupos.matrizDe).forEach(function(fid){ matrizImport[fid] = grupos.matrizDe[fid]; });
    var nomeEmpresaImport = {};
    todasEmpresas().forEach(function(e){ nomeEmpresaImport[e.id] = e.nome; });
    // Acha a empresa da linha pelo CNPJ (quando a coluna existe) e, se não der, pelo nome.
    var acharEmpresaLinha = function(row, colNome, colCnpj){
      var dc = digitosCnpj(getCell(row, colCnpj));
      var emp = (dc && empresaPorCnpj[dc]) || empresaPorNome[stripAccents(String(getCell(row, colNome) || "")).toLowerCase().trim()];
      var mz = emp && matrizImport[emp.id];
      return mz ? {id:mz, nome:nomeEmpresaImport[mz] || emp.nome} : emp;
    };
    var funcPorNome = {};
    state.funcionarios.forEach(function(f){ funcPorNome[stripAccents(f.nome).toLowerCase().trim()] = f; });
    var setorPorId = {};
    state.setores.forEach(function(s){ setorPorId[s.id] = s; });
    var alinhPorSetor = {};
    state.alinhamentoSetor.forEach(function(a){ alinhPorSetor[a.id] = a; });

    var writes = []; // {run:function()->Promise, onOk:function()}
    function agendar(runFn, onOk){ writes.push({run:runFn, onOk:onOk}); }
    var dadosEmpresaNova = {};

    var wsEmpresas = wb.Sheets["Empresas"];
    if(wsEmpresas){
      XLSX.utils.sheet_to_json(wsEmpresas, {defval:""}).forEach(function(row, idx){
        var nome = String(getCell(row,"Nome")||"").trim();
        if(!nome) return;
        var key = stripAccents(nome).toLowerCase();
        var idEmpLinha = String(getCell(row,"ID")||"").trim();
        var existing = (idEmpLinha && idsEmpresa.has(idEmpLinha) && todasEmpresas().find(function(x){ return x.id === idEmpLinha; })) || empresaPorNome[key];
        var matrizCel = String(getCell(row,"Matriz ID")||"").trim(), matrizCnpjCel = String(getCell(row,"Matriz CNPJ")||"").trim();
        var setoresDemanda = {
          pessoal: simNao(getCell(row,"Setor Pessoal"), false),
          contabil: simNao(getCell(row,"Setor Contabil"), false),
          fiscal: simNao(getCell(row,"Setor Fiscal"), false)
        };
        var data = {
          nome:nome, cnpj:String(getCell(row,"CNPJ")||"").trim(),
          ativo:simNao(getCell(row,"Ativo"), true),
          folhaAtiva:simNao(getCell(row,"Folha Ativa"), false),
          precisaRubricas:simNao(getCell(row,"Precisa Rubricas"), false),
          setoresDemanda:setoresDemanda
        };
        var emFocoCel = getCell(row,"Em Foco");
        if(emFocoCel !== undefined && String(emFocoCel).trim() !== ""){
          data.emFoco = simNao(emFocoCel, false);
          if(data.emFoco && !(existing && existing.emFoco)) data.emFocoEm = new Date().toISOString();
        }
        if(getCell(row,"Proxima Acao") !== undefined) data.focoProxAcao = String(getCell(row,"Proxima Acao")||"").trim();
        if(getCell(row,"Prazo") !== undefined){ var prz = String(getCell(row,"Prazo")||"").trim(); data.focoPrazo = /^\d{4}-\d{2}-\d{2}$/.test(prz) ? prz : ""; }
        if(getCell(row,"Aguardando") !== undefined){
          var agRaw = normBusca(getCell(row,"Aguardando")).trim();
          data.focoAguardando = Object.keys(AGUARDANDO).find(function(k){ return normBusca(AGUARDANDO[k]) === agRaw; }) || "";
          data.focoAguardandoOutro = data.focoAguardando === "outro" ? String(getCell(row,"Aguardando (outro)")||"").trim() : "";
        }
        var id;
        if(existing){
          id = existing.id;
          agendar(function(){ return dbRef.collection("empresas").doc(id).update(data); }, function(){ resumo.empresasAtt++; });
        } else {
          id = uniqueId(slugify(nome), idsEmpresa);
          data.impedimento = {ativo:false, descricao:""}; data.exemplo = false; data.criadoEm = new Date().toISOString();
          dadosEmpresaNova[id] = data;
          agendar(function(){ return dbRef.collection("empresas").doc(id).set(data); }, function(){ resumo.empresasNovas++; });
        }
        empresaPorNome[key] = {id:id, nome:nome};
        nomeEmpresaImport[id] = nome;
        if(digitosCnpj(data.cnpj)) empresaPorCnpj[digitosCnpj(data.cnpj)] = {id:id, nome:nome};
        // Filial: o vínculo é resolvido depois de ler a aba inteira (a matriz pode vir mais abaixo).
        var ehFilialLinha = !!(matrizCel || digitosCnpj(matrizCnpjCel));
        if(ehFilialLinha) vinculosImport.push({id:id, nome:nome, matrizId:matrizCel, matrizCnpj:digitosCnpj(matrizCnpjCel), linha:idx+2});
        SETORES.forEach(function(s){
          if(ehFilialLinha || !setoresDemanda[s.key]) return;
          var sdid = sid(id, s.key);
          if(idsSetor.has(sdid)) return;
          idsSetor.add(sdid);
          var setorData = {
            empresaId:id, empresaNome:nome, setor:s.key, analistaNome:"",
            etapas:defaultEtapas(), impedimento:{ativo:false, descricao:""}, exemplo:false, criadoEm:new Date().toISOString()
          };
          setorPorId[sdid] = Object.assign({id:sdid}, setorData);
          agendar(function(){ return dbRef.collection("empresaSetores").doc(sdid).set(setorData); }, null);
        });
      });
    }

    // Vínculos de filial lidos na aba Empresas (coluna "Matriz CNPJ" ou "Matriz ID").
    vinculosImport.forEach(function(v){
      var mz = (v.matrizId && idsEmpresa.has(v.matrizId) && v.matrizId) || (v.matrizCnpj && empresaPorCnpj[v.matrizCnpj] && empresaPorCnpj[v.matrizCnpj].id) || "";
      if(mz && matrizImport[mz]) mz = matrizImport[mz];
      if(!mz || mz === v.id){ resumo.avisos.push("Empresas linha "+v.linha+": matriz de \""+v.nome+"\" não encontrada; ficou como empresa separada."); return; }
      matrizImport[v.id] = mz;
      resumo.filiais = (resumo.filiais || 0) + 1;
      if(dadosEmpresaNova[v.id]) dadosEmpresaNova[v.id].matrizId = mz;
      else if(grupos.matrizDe[v.id] !== mz) agendar(function(){ return dbRef.collection("empresas").doc(v.id).update({matrizId:mz}); }, null);
    });
    var wsFunc = wb.Sheets["Funcionarios"];
    if(wsFunc){
      XLSX.utils.sheet_to_json(wsFunc, {defval:""}).forEach(function(row, idx){
        var nome = String(getCell(row,"Nome")||"").trim();
        if(!nome) return;
        var setor = normalizarSetor(getCell(row,"Setor"));
        if(!setor){ resumo.avisos.push("Funcionarios linha "+(idx+2)+": setor inválido para \""+nome+"\"."); return; }
        var status = normalizarStatus(getCell(row,"Status Treinamento"), getCell(row,"Agendado Para"));
        var cargo = normalizarCargo(getCell(row,"Cargo"));
        if(cargo === null) cargo = String(getCell(row,"Cargo")||"").trim(); // cargo fora da lista: mantém o texto como está
        var key = stripAccents(nome).toLowerCase();
        var idFuncLinha = String(getCell(row,"ID")||"").trim();
        var existing = (idFuncLinha && idsFunc.has(idFuncLinha) && state.funcionarios.find(function(x){ return x.id === idFuncLinha; })) || funcPorNome[key];
        var data = {
          nome:nome, setor:setor, cargo:cargo, statusTreinamento:status, observacoes:String(getCell(row,"Observacoes")||"").trim(),
          agendadoPara: status === "agendado" ? String(getCell(row,"Agendado Para")||"").trim() : "",
          agendadoHora: status === "agendado" ? normalizarHora(getCell(row,"Horario")) : ""
        };
        if(getCell(row,"Horario") === undefined) delete data.agendadoHora; // planilha antiga, sem a coluna: não apaga o horário salvo
        if(getCell(row,"Concluido Em") !== undefined){ var ceRaw = String(getCell(row,"Concluido Em")||"").trim(); var ceD = ceRaw ? new Date(ceRaw.replace(" ", "T")) : null; data.concluidoEm = status === "concluido" && ceD && !isNaN(ceD.getTime()) ? ceD.toISOString() : (status === "concluido" ? new Date().toISOString() : ""); }
        if(existing){
          agendar(function(){ return dbRef.collection("funcionarios").doc(existing.id).update(data); }, function(){ resumo.funcAtt++; });
        } else {
          var fid = uniqueId(slugify(nome), idsFunc);
          data.impedimento = {ativo:false, descricao:""}; data.exemplo = false; data.criadoEm = new Date().toISOString();
          funcPorNome[key] = {id:fid, nome:nome};
          agendar(function(){ return dbRef.collection("funcionarios").doc(fid).set(data); }, function(){ resumo.funcNovos++; });
        }
      });
    }

    var wsCont = wb.Sheets["Contatos"];
    if(wsCont){
      XLSX.utils.sheet_to_json(wsCont, {defval:""}).forEach(function(row, idx){
        var nome = String(getCell(row,"Nome")||"").trim();
        if(!nome) return;
        var empresaNome = String(getCell(row,"Empresa")||"").trim();
        var emp = acharEmpresaLinha(row, "Empresa", "CNPJ Empresa");
        if(!emp){ resumo.avisos.push("Contatos linha "+(idx+2)+": empresa \""+empresaNome+"\" não encontrada para \""+nome+"\"."); return; }
        var status = normalizarStatus(getCell(row,"Status Treinamento"), getCell(row,"Agendado Para"));
        var setoresLista = String(getCell(row,"Setores que Acessa")||"").split(/[,·]/).map(function(s){ return normalizarSetor(s); }).filter(function(s){ return !!s; });
        var idContLinha = String(getCell(row,"ID")||"").trim();
        var existing = (idContLinha && idsCont.has(idContLinha) && state.contatos.find(function(c){ return c.id === idContLinha; })) ||
          (idContLinha ? null : state.contatos.find(function(c){ return c.empresaId === emp.id && stripAccents(c.nome).toLowerCase().trim() === stripAccents(nome).toLowerCase().trim(); }));
        var data = {
          nome:nome, email:String(getCell(row,"Email")||"").trim(), empresaId:emp.id, empresaNome:emp.nome,
          statusTreinamento:status,
          setores:setoresLista, socio:simNao(getCell(row,"Socio"), false),
          agendadoPara: status === "agendado" ? String(getCell(row,"Agendado Para")||"").trim() : "",
          agendadoHora: status === "agendado" ? normalizarHora(getCell(row,"Horario")) : ""
        };
        if(getCell(row,"Horario") === undefined) delete data.agendadoHora; // planilha antiga, sem a coluna: não apaga o horário salvo
        if(getCell(row,"Concluido Em") !== undefined){ var ceRaw = String(getCell(row,"Concluido Em")||"").trim(); var ceD = ceRaw ? new Date(ceRaw.replace(" ", "T")) : null; data.concluidoEm = status === "concluido" && ceD && !isNaN(ceD.getTime()) ? ceD.toISOString() : (status === "concluido" ? new Date().toISOString() : ""); }
        if(existing){
          agendar(function(){ return dbRef.collection("contatos").doc(existing.id).update(data); }, function(){ resumo.contAtt++; });
        } else {
          var cid = uniqueId(slugify(nome) + "-" + emp.id, idsCont);
          data.exemplo = false; data.criadoEm = new Date().toISOString();
          agendar(function(){ return dbRef.collection("contatos").doc(cid).set(data); }, function(){ resumo.contNovos++; });
        }
      });
    }

    var wsSetores = wb.Sheets["Progresso por Setor"];
    var habImport = {};
    if(wsSetores){
      XLSX.utils.sheet_to_json(wsSetores, {defval:""}).forEach(function(row, idx){
        var empresaNome = String(getCell(row,"Empresa")||"").trim();
        var emp = acharEmpresaLinha(row, "Empresa", "CNPJ");
        if(!emp){ resumo.avisos.push("Progresso por Setor linha "+(idx+2)+": empresa \""+empresaNome+"\" não encontrada."); return; }
        var setor = normalizarSetor(getCell(row,"Setor"));
        if(!setor){ resumo.avisos.push("Progresso por Setor linha "+(idx+2)+": setor inválido para \""+empresaNome+"\"."); return; }
        var sdid = sid(emp.id, setor);
        var existente = setorPorId[sdid];
        var etapas = Object.assign({}, defaultEtapas(), existente && existente.etapas);
        ETAPAS.forEach(function(et){
          var obsCel = getCell(row, et.label+" Obs");
          var obsNova = obsCel !== undefined ? String(obsCel).trim() : undefined;
          if(et.key === "treinamentoCliente" || et.calculada){
            if(obsNova !== undefined) etapas[et.key] = Object.assign({}, etapas[et.key], {obs:obsNova});
            return;
          }
          if(et.porEmpresa){
            // Uma habilitação por empresa: entre as linhas dos setores, vale a mais adiantada.
            if(getCell(row, et.label+" Status") === undefined) return;
            var hSt = normalizarStatus(getCell(row, et.label+" Status"));
            if(RANK_HAB[hSt] === undefined) hSt = "pendente";
            var hData = hSt === "concluido" ? String(getCell(row, et.label+" Data")||"").trim() : "";
            var hAtual = habImport[emp.id];
            if(!hAtual || RANK_HAB[hSt] > RANK_HAB[hAtual.status] || (hSt === hAtual.status && hData && (!hAtual.data || hData < hAtual.data)))
              habImport[emp.id] = {status:hSt, data:hData, obs:hAtual ? hAtual.obs : ""};
            if(obsNova) habImport[emp.id].obs = habImport[emp.id].obs && habImport[emp.id].obs !== obsNova && habImport[emp.id].obs.indexOf(obsNova) === -1 ? habImport[emp.id].obs + " · " + obsNova : (habImport[emp.id].obs || obsNova);
            return;
          }
          var atual = etapas[et.key] || {status:"pendente", data:"", obs:""};
          var etStatus = normalizarStatus(getCell(row, et.label+" Status"), getCell(row, et.label+" Agendado Para"));
          if(ordemStatus(et.key).indexOf(etStatus) === -1) etStatus = "pendente";
          // Treinamento do analista igual ao do cadastro da pessoa em Equipe: é herdado, não precisa gravar na frente.
          if(et.key === "treinamentoAnalista" && existente){
            var fImp = funcAnalistaDoDoc(existente);
            if(fImp && (fImp.statusTreinamento || "pendente") === etStatus && (RANK_TREINO[atual.status || "pendente"] || 0) <= (RANK_TREINO[etStatus] || 0)){
              if(obsNova !== undefined) etapas[et.key] = Object.assign({}, atual, {obs:obsNova});
              return;
            }
          }
          etapas[et.key] = {
            status: etStatus,
            data: etStatus === "concluido" ? String(getCell(row, et.label+" Data")||"").trim() : "",
            agendadoPara: etStatus === "agendado" ? String(getCell(row, et.label+" Agendado Para")||"").trim() : "",
            agendadoHora: etStatus === "agendado" ? normalizarHora(getCell(row, et.label+" Horario")) : "",
            obs: obsNova !== undefined ? obsNova : (atual.obs || "")
          };
        });
        var importAnaNome = String(getCell(row,"Analista")||"").trim();
        var importAnaMatch = importAnaNome ? state.funcionarios.find(function(f){ return stripAccents(f.nome).toLowerCase().trim() === stripAccents(importAnaNome).toLowerCase().trim(); }) : null;
        var setorData = {
          empresaId:emp.id, empresaNome:emp.nome, setor:setor,
          analistaId: importAnaMatch ? importAnaMatch.id : "", analistaNome: importAnaMatch ? importAnaMatch.nome : importAnaNome,
          etapas:etapas,
          impedimento:{ ativo: simNao(getCell(row,"Impedimento Ativo"), false), descricao: String(getCell(row,"Impedimento Descricao")||"").trim() }
        };
        if(existente){
          setorPorId[sdid] = Object.assign({}, existente, setorData);
          agendar(function(){ return dbRef.collection("empresaSetores").doc(sdid).update(setorData); }, function(){ resumo.setoresAtt++; });
        } else {
          setorData.exemplo = false; setorData.criadoEm = new Date().toISOString();
          setorPorId[sdid] = Object.assign({id:sdid}, setorData);
          idsSetor.add(sdid);
          agendar(function(){ return dbRef.collection("empresaSetores").doc(sdid).set(setorData); }, function(){ resumo.setoresAtt++; });
        }
      });
      Object.keys(habImport).forEach(function(eid){
        var hN = habImport[eid];
        if(dadosEmpresaNova[eid]){ dadosEmpresaNova[eid].habilitacao = hN; return; }
        var hA = habilitacaoEmpresa(eid);
        if(!hA.herdada && hA.status === hN.status && hA.data === hN.data && hA.obs === hN.obs) return;
        agendar(function(){ return dbRef.collection("empresas").doc(eid).update({habilitacao:hN}); }, null);
      });
    }

    var wsAlinh = wb.Sheets["Alinhamento por Setor"];
    if(wsAlinh){
      XLSX.utils.sheet_to_json(wsAlinh, {defval:""}).forEach(function(row, idx){
        var setor = normalizarSetor(getCell(row,"Setor"));
        if(!setor){ resumo.avisos.push("Alinhamento por Setor linha "+(idx+2)+": setor inválido."); return; }
        var data = {
          setor:setor,
          status: normalizarStatus(getCell(row,"Status")),
          data: String(getCell(row,"Data")||"").trim(),
          gestorNome: String(getCell(row,"Gestor")||"").trim()
        };
        if(alinhPorSetor[setor]){
          agendar(function(){ return dbRef.collection("setorAlinhamento").doc(setor).update(data); }, function(){ resumo.alinhamentoAtt++; });
        } else {
          data.criadoEm = new Date().toISOString();
          alinhPorSetor[setor] = data;
          agendar(function(){ return dbRef.collection("setorAlinhamento").doc(setor).set(data); }, function(){ resumo.alinhamentoAtt++; });
        }
      });
    }

    if(!wsEmpresas && !wsFunc && !wsCont && !wsSetores && !wsAlinh){
      avisar("Essa planilha não tem nenhuma aba reconhecida (Empresas, Funcionarios, Contatos, Progresso por Setor ou Alinhamento por Setor).", "warn");
      return;
    }
    if(!writes.length){
      avisar("Nenhuma linha com dados válidos encontrada para importar.", resumo.avisos.length ? "warn" : "ok");
      return;
    }

    var TAMANHO_LOTE = 25;
    var i = 0;
    function proximoLote(){
      if(i >= writes.length){
        var msg = resumo.empresasNovas+" empresa(s) nova(s), "+resumo.empresasAtt+" atualizada(s) · "+
                  resumo.funcNovos+" funcionário(s) novo(s), "+resumo.funcAtt+" atualizado(s) · "+
                  resumo.contNovos+" contato(s) novo(s), "+resumo.contAtt+" atualizado(s) · "+
                  resumo.setoresAtt+" progresso(s) por setor atualizado(s) · "+
                  resumo.alinhamentoAtt+" alinhamento(s) de setor atualizado(s).";
        if(resumo.filiais) msg += " " + resumo.filiais + " filial(is) ligada(s) à matriz.";
        registrarAtividade({tipo:"importacao", texto:msg});
        if(resumo.avisos.length) msg += " Avisos: " + resumo.avisos.join(" ");
        // Filiais com contatos ou frentes próprios: junta na matriz quando os dados novos chegarem do banco.
        setTimeout(function(){
          var porM = {};
          filiaisComDados().forEach(function(x){ (porM[x.m.id] = porM[x.m.id] || {m:x.m, fs:[]}).fs.push(x.f); });
          var lista = Object.keys(porM).map(function(k){ return porM[k]; });
          if(lista.length) vincularVarios(lista, function(n){ if(n) mostrarToast("Dados de "+n+" filial(is) juntados nas matrizes."); });
        }, 2500);
        avisar(msg, resumo.avisos.length ? "warn" : "ok");
        $("#fileImport").value = "";
        $("#fileImportName").textContent = "Nenhum arquivo selecionado";
        $("#btnImportar").disabled = true;
        return;
      }
      var lote = writes.slice(i, i+TAMANHO_LOTE);
      avisar("Importando… "+i+" de "+writes.length, "ok");
      Promise.all(lote.map(function(w){
        return w.run().then(function(){ if(w.onOk) w.onOk(); }).catch(function(err){
          resumo.avisos.push("Falha ao salvar: " + (err && err.message ? err.message : String(err)));
        });
      })).then(function(){
        i += TAMANHO_LOTE;
        proximoLote();
      });
    }
    proximoLote();
  }

  /* ---------- registro unificado de atividades ---------- */
  // Um documento por dia (o banco tem teto de 5.000 documentos), com as atividades em lista.
  var filaRegistro = Promise.resolve();
  var LIMITE_EVENTOS_DOC = 500;

  function registrarAtividade(ev){
    if(!dbRef || !ev) return;
    var evento = {};
    Object.keys(ev).forEach(function(k){ var v = ev[k]; if(v !== undefined && v !== null && v !== "") evento[k] = v; });
    if(evento.empresaId && !evento.empresaNome){
      var emp = state.empresas.find(function(x){ return x.id === evento.empresaId; });
      if(emp) evento.empresaNome = emp.nome;
    }
    evento.em = new Date().toISOString();
    if(meuId) evento.por = meuId;
    filaRegistro = filaRegistro.then(function(){
      var dia = diaLocal(new Date());
      return dbRef.collection("historico").where("dia", "==", dia).get().then(function(snap){
        var partes = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); })
          .sort(function(a, b){ return a.id.localeCompare(b.id, undefined, {numeric:true}); });
        var alvo = partes[partes.length - 1], id, eventos;
        if(alvo && (alvo.eventos || []).length < LIMITE_EVENTOS_DOC){ id = alvo.id; eventos = (alvo.eventos || []).concat([evento]); }
        else { id = partes.length ? dia + "-" + (partes.length + 1) : dia; eventos = [evento]; }
        return dbRef.collection("historico").doc(id).set({dia:dia, eventos:eventos});
      });
    }).catch(function(err){
      if(err && err.code === "quota_exceeded") mostrarToast("O banco de dados está cheio: esta atividade não entrou no registro.");
    });
  }

  // Registra um impedimento (empresa, frente ou pessoa) já com a data de início.
  function gravarImpedimento(alvo, desc, aguardando){
    var imp = {ativo:true, descricao:desc, desde:hojeISO(), aguardando:aguardando || ""};
    var local = alvo.col === "empresas" ? state.empresas.find(function(x){ return x.id === alvo.id; })
      : alvo.col === "funcionarios" ? state.funcionarios.find(function(x){ return x.id === alvo.id; })
      : state.setores.find(function(x){ return x.id === sid(alvo.empresaId, alvo.setor); });
    if(local){ local.impedimento = imp; renderAll(); }
    var gravar = alvo.col === "empresaSetores"
      ? garantirSetorDoc(alvo.empresaId, alvo.setor).then(function(id){ return dbRef.collection("empresaSetores").doc(id).update({impedimento:imp}); })
      : dbRef.collection(alvo.col).doc(alvo.id).update({impedimento:imp});
    gravar.then(function(){ mostrarToast("Impedimento registrado."); }, function(){ mostrarToast("Não foi possível registrar o impedimento."); });
    var ev0 = alvoImpedimento(alvo.col, alvo.col === "empresaSetores" ? sid(alvo.empresaId, alvo.setor) : alvo.id, {tipo:"impedimento", para:"registrado", texto:desc});
    if(alvo.col === "empresaSetores"){ ev0.empresaId = alvo.empresaId; ev0.setor = alvo.setor; }
    registrarAtividade(ev0);
  }
  // Formulário curto para registrar impedimento direto na empresa (Consulta e Foco).
  function formImpedimentoEmpresaHTML(e){
    var setores = SETORES.filter(function(s){ return e.setoresDemanda && e.setoresDemanda[s.key]; });
    return '<form class="imp-emp-form" data-id="'+e.id+'">' +
      '<label class="imp-emp-onde">Onde <select class="imp-emp-alvo"><option value="">Empresa toda</option>' +
        setores.map(function(s){ return '<option value="'+s.key+'">Só no '+s.label+'</option>'; }).join("") + '</select></label>' +
      '<input type="text" class="imp-emp-desc" maxlength="200" placeholder="O que está travando? Ex.: cliente não enviou o certificado" required>' +
      '<select class="imp-emp-agu" aria-label="Aguardando quem"><option value="">Aguardando…</option><option value="cliente">Aguardando cliente</option><option value="analista">Aguardando analista</option><option value="escritorio">Aguardando escritório</option></select>' +
      '<button type="submit" class="fbtn">Registrar</button>' +
      '<button type="button" class="linkish" data-action="imp-form-cancelar">Cancelar</button>' +
    '</form>';
  }
  function alvoImpedimento(col, docId, base){
    var ev = Object.assign({}, base);
    if(col === "empresas"){
      var e = state.empresas.find(function(x){ return x.id === docId; });
      if(e){ ev.empresaId = e.id; ev.empresaNome = e.nome; }
    } else if(col === "empresaSetores"){
      var s = state.setores.find(function(x){ return x.id === docId; });
      if(s){ ev.empresaId = s.empresaId; ev.empresaNome = s.empresaNome; ev.setor = s.setor; }
    } else {
      var f = state.funcionarios.find(function(x){ return x.id === docId; });
      if(f){ ev.nome = f.nome; ev.setor = f.setor; }
    }
    return ev;
  }

  /* ---------- relatórios: datas e textos ---------- */
  var MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var MESES_LONGOS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  function pad2(n){ return String(n).padStart(2, "0"); }
  function diaLocal(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseDia(s){
    var p = String(s || "").split("-");
    if(p.length < 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function somarDias(d, n){ var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function diaDeISO(iso){ if(!iso) return ""; var d = new Date(iso); return isNaN(d.getTime()) ? "" : diaLocal(d); }
  function horaDeISO(iso){ if(!iso) return ""; var d = new Date(iso); return isNaN(d.getTime()) ? "" : pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function diaBR(s){ var d = parseDia(s); return d ? pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() : ""; }
  function dataHoraBR(d){ return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() + " às " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function fmtNum(n){ return Number(n || 0).toLocaleString("pt-BR"); }
  function fmtPct(x){ return Math.round((x || 0) * 100) + "%"; }
  function razao(a, b){ return b ? a / b : 0; }
  function cortar(txt, n){ txt = String(txt || ""); return txt.length > n ? txt.slice(0, n - 1) + "…" : txt; }

  var TIPOS_ATV = {backup:"Backup", lote:"Ação em lote", etapa:"Etapa", alinhamento:"Alinhamento", setor:"Setor", empresa:"Empresa", contato:"Contato", "treino-contato":"Treino cliente", "cadastro-contato":"Cadastro Onvio", "acesso-contato":"Acesso contato", "treino-func":"Treino equipe", impedimento:"Impedimento", importacao:"Importação"};
  var GRUPO_ATV = {backup:"cadastro", lote:"cadastro", etapa:"etapas", alinhamento:"etapas", setor:"cadastro", empresa:"cadastro", importacao:"cadastro", contato:"clientes", "treino-contato":"clientes", "cadastro-contato":"clientes", "acesso-contato":"clientes", "treino-func":"equipe", impedimento:"impedimentos"};

  function rotuloItem(key){
    if(key === "alinhamento") return "Alinhamento com o gestor do setor";
    var et = ETAPAS.find(function(x){ return x.key === key; });
    return et ? et.label : key;
  }
  function descEvento(e){
    var setorTxt = e.setor ? (SETOR_LABEL[e.setor] || e.setor) : "";
    switch(e.tipo){
      case "etapa": return {txt:rotuloItem(e.item), de:e.de, para:e.para};
      case "alinhamento": return {txt:"Alinhamento com o gestor" + (setorTxt ? " · " + setorTxt : ""), de:e.de, para:e.para};
      case "setor": return {txt:"Setor " + setorTxt + (e.para === "removido" ? " removido da empresa" : " adicionado à empresa")};
      case "empresa": return {txt:"Empresa cadastrada"};
      case "contato": return {txt:"Contato cadastrado: " + (e.nome || "")};
      case "treino-contato": return {txt:"Treinamento de " + (e.nome || "contato"), de:e.de, para:e.para};
      case "cadastro-contato": return {txt:"Cadastro no Onvio de " + (e.nome || "contato"), de:e.de, para:e.para};
      case "treino-func": return {txt:"Treinamento de " + (e.nome || "funcionário") + " (equipe)", de:e.de, para:e.para};
      case "impedimento": return {txt:(e.para === "removido" ? "Impedimento resolvido" : "Impedimento registrado") + (e.texto ? ": " + e.texto : "") + (e.resolucao ? " · como: " + e.resolucao : "")};
      case "importacao": return {txt:"Importação de planilha: " + (e.texto || "")};
      default: return {txt:e.texto || e.tipo || ""};
    }
  }
  function ondeEvento(e){
    var p = [];
    if(e.empresaNome) p.push(e.empresaNome);
    if(e.setor && e.tipo !== "alinhamento" && e.tipo !== "setor") p.push(SETOR_LABEL[e.setor] || e.setor);
    return p.join(" · ");
  }
  function eventoChips(d){
    if(!d.para || !STATUS_LABEL[d.para]) return "";
    var s = "";
    if(d.de && STATUS_LABEL[d.de] && d.de !== d.para) s += '<span class="fchip st-' + d.de + '">' + STATUS_LABEL[d.de] + '</span><span class="seta">' + ICO_SETA + '</span>';
    return s + '<span class="fchip st-' + d.para + '">' + STATUS_LABEL[d.para] + '</span>';
  }

  // Registro gravado + conclusões anteriores ao registro, deduzidas da data gravada em cada etapa.
  function eventosUnificados(){
    var evs = [], vistos = {};
    state.historico.forEach(function(d){
      (d.eventos || []).forEach(function(e){
        if(e.tipo === "acesso" || e.tipo === "acesso-contato") return; // levantamento de acesso ao portal foi retirado
        evs.push(Object.assign({origem:"registro", dia:diaDeISO(e.em)}, e));
        if(e.para === "concluido" && e.tipo === "etapa") vistos[e.empresaId + "|" + e.setor + "|" + e.item + "|" + String(e.em).slice(0, 10)] = true;
        if(e.para === "concluido" && e.tipo === "alinhamento") vistos["alin|" + e.setor + "|" + String(e.em).slice(0, 10)] = true;
      });
    });
    var empPorId = {};
    state.empresas.forEach(function(e){ empPorId[e.id] = e; });
    state.setores.forEach(function(s){
      var emp = empPorId[s.empresaId];
      ETAPAS.forEach(function(et){
        if(et.porEmpresa) return;
        var ed = et.key === "treinamentoCliente" ? statusClienteComputado(s.empresaId, s.setor) : et.key === "cadastroUsuario" ? statusCadastroComputado(s.empresaId, s.setor) : (s.etapas && s.etapas[et.key]);
        if(!ed || ed.status !== "concluido" || !ed.data) return;
        if(et.onlyIf && emp && !et.onlyIf(emp, s.setor)) return;
        if(vistos[s.empresaId + "|" + s.setor + "|" + et.key + "|" + ed.data]) return;
        evs.push({tipo:"etapa", origem:"derivado", dia:ed.data, em:"", empresaId:s.empresaId, empresaNome:emp ? emp.nome : s.empresaNome, setor:s.setor, item:et.key, para:"concluido"});
      });
    });
    state.empresas.forEach(function(e){
      var h = habilitacaoEmpresa(e.id);
      if(h.status !== "concluido" || !h.data) return;
      if(vistos[e.id + "||habilitacaoDominio|" + h.data] || SETORES.some(function(s){ return vistos[e.id + "|" + s.key + "|habilitacaoDominio|" + h.data]; })) return;
      evs.push({tipo:"etapa", origem:"derivado", dia:h.data, em:"", empresaId:e.id, empresaNome:e.nome, setor:"", item:"habilitacaoDominio", para:"concluido"});
    });
    state.alinhamentoSetor.forEach(function(a){
      if(a.status === "concluido" && a.data && !vistos["alin|" + a.id + "|" + a.data]) evs.push({tipo:"alinhamento", origem:"derivado", dia:a.data, em:"", setor:a.id, item:"alinhamento", para:"concluido"});
    });
    evs.sort(function(a, b){ return (b.dia + (b.em || "")).localeCompare(a.dia + (a.em || "")); });
    return evs;
  }

  /* ---------- relatórios: modelo ---------- */
  var NOME_MODO = {dia:"dia", semana:"semana", mes:"mês"};

  function relModel(){
    var r = ui.rel;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var ini = null, fim = hoje;
    if(r.periodo === "custom"){
      ini = parseDia(r.de) || somarDias(hoje, -29);
      fim = parseDia(r.ate) || hoje;
      if(fim < ini){ var troca = ini; ini = fim; fim = troca; }
    } else if(r.periodo !== "tudo"){
      ini = somarDias(hoje, -((parseInt(r.periodo, 10) || 30) - 1));
    }
    var setoresSel = r.setor === "todos" ? SETORES : SETORES.filter(function(s){ return s.key === r.setor; });
    var empresas = state.empresas.filter(function(e){ return e.ativo !== false && (!r.soFoco || e.emFoco); });
    var empPorId = {};
    empresas.forEach(function(e){ empPorId[e.id] = e; });
    var docsPor = {};
    state.setores.forEach(function(s){ (docsPor[s.empresaId] = docsPor[s.empresaId] || []).push(s); });

    var eventos = eventosUnificados().filter(function(e){
      if(e.empresaId && !empPorId[e.empresaId]) return false;
      if(r.setor !== "todos" && e.setor && e.setor !== r.setor) return false;
      return true;
    });
    var contatos = state.contatos.filter(function(c){ return empPorId[c.empresaId] && (r.setor === "todos" || (c.setores || []).indexOf(r.setor) !== -1); });
    var funcs = state.funcionarios.filter(function(f){ return r.setor === "todos" || f.setor === r.setor; });

    var frentes = [];
    empresas.forEach(function(e){
      setoresSel.forEach(function(s){
        if(!(e.setoresDemanda && e.setoresDemanda[s.key])) return;
        var doc = (docsPor[e.id] || []).find(function(x){ return x.setor === s.key; });
        frentes.push({empresa:e, setor:s, doc:doc, prog:progressoSetor(e, doc || {setor:s.key})});
      });
    });

    if(!ini){
      var menor = null;
      var ver = function(ds){ var d = parseDia(ds); if(d && (!menor || d < menor)) menor = d; };
      eventos.forEach(function(e){ ver(e.dia); });
      contatos.forEach(function(c){ ver(diaDeISO(c.criadoEm)); });
      ini = menor && menor < fim ? menor : somarDias(fim, -29);
    }
    var iniS = diaLocal(ini), fimS = diaLocal(fim);
    var noPeriodo = function(ds){ return !!ds && ds >= iniS && ds <= fimS; };

    var span = Math.round((fim - ini) / 864e5) + 1;
    var modo = span <= 31 ? "dia" : span <= 182 ? "semana" : "mes";
    var buckets = [];
    var novoBucket = function(a, b, rotulo, titulo){
      buckets.push({ini:a, fim:b, iniS:diaLocal(a), fimS:diaLocal(b), rotulo:rotulo, titulo:titulo, etapas:{pessoal:0, contabil:0, fiscal:0}, contatos:0, atividades:0});
    };
    if(modo === "dia"){
      for(var d = new Date(ini.getTime()); d <= fim; d = somarDias(d, 1)) novoBucket(d, d, pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1), diaBR(diaLocal(d)));
    } else if(modo === "semana"){
      for(var w = somarDias(ini, -((ini.getDay() + 6) % 7)); w <= fim; w = somarDias(w, 7)){
        var wa = w < ini ? ini : w, wb2 = somarDias(w, 6);
        if(wb2 > fim) wb2 = fim;
        novoBucket(wa, wb2, pad2(w.getDate()) + "/" + pad2(w.getMonth() + 1), "Semana de " + diaBR(diaLocal(wa)).slice(0, 5) + " a " + diaBR(diaLocal(wb2)).slice(0, 5));
      }
    } else {
      for(var mm = new Date(ini.getFullYear(), ini.getMonth(), 1); mm <= fim; mm = new Date(mm.getFullYear(), mm.getMonth() + 1, 1)){
        var ma = mm < ini ? ini : mm, mb = new Date(mm.getFullYear(), mm.getMonth() + 1, 0);
        if(mb > fim) mb = fim;
        novoBucket(ma, mb, MESES[mm.getMonth()] + "/" + String(mm.getFullYear()).slice(2), MESES_LONGOS[mm.getMonth()] + " de " + mm.getFullYear());
      }
    }
    var bucketDe = function(ds){
      if(!noPeriodo(ds)) return null;
      for(var i = 0; i < buckets.length; i++){ if(ds >= buckets[i].iniS && ds <= buckets[i].fimS) return buckets[i]; }
      return null;
    };

    var etapas = ETAPAS.map(function(et){
      return {key:et.key, label:et.label, curto:et.curto, aplic:0, pendente:0, agendado:0, andamento:0, concluido:0, periodo:0, periodoSetor:{pessoal:0, contabil:0, fiscal:0}, porSetor:{}};
    });
    var anal = {};
    var semDataConc = 0, habContada = {};
    frentes.forEach(function(f){
      // Agrupa pela pessoa cadastrada em Equipe (o mesmo analista digitado com outra grafia é uma linha só).
      var rA = resolverAnalista(f.doc), nomeA = String(rA.nome || "").trim();
      var chaveA = rA.id ? "id:" + rA.id : (nomeA ? "nome:" + normBusca(nomeA) : "—");
      var A = anal[chaveA] = anal[chaveA] || {nome:nomeA || "Sem analista definido", semNome:!nomeA, setores:{}, frentes:0, aplic:0, conc:0, periodo:0, progSoma:0};
      A.frentes++; A.setores[f.setor.key] = true; A.progSoma += f.prog;
      f.aplic = 0; f.conc = 0; f.periodo = 0;
      ETAPAS.forEach(function(et, i){
        if(et.onlyIf && !et.onlyIf(f.empresa, f.setor.key)) return;
        var st = statusDe(f.doc, et.key, f.empresa.id, f.setor.key);
        if(!STATUS_LABEL[st]) st = "pendente";
        var o = etapas[i];
        var ps = o.porSetor[f.setor.key] = o.porSetor[f.setor.key] || {aplic:0, pendente:0, agendado:0, andamento:0, concluido:0, periodo:0};
        // Habilitação é da empresa: nos totais conta uma vez; na matriz por setor, aparece em cada setor dela.
        var primeira = !et.porEmpresa || !habContada[f.empresa.id];
        if(et.porEmpresa) habContada[f.empresa.id] = true;
        if(primeira){ o.aplic++; o[st]++; }
        ps.aplic++; ps[st]++; f.aplic++; A.aplic++;
        if(st === "concluido"){
          f.conc++; A.conc++;
          var ds = et.key === "treinamentoCliente" ? statusClienteComputado(f.empresa.id, f.setor.key).data : et.key === "cadastroUsuario" ? statusCadastroComputado(f.empresa.id, f.setor.key).data : etapaInfo(f.doc, et.key, f.empresa.id).data;
          if(!ds && primeira) semDataConc++;
          if(noPeriodo(ds)){
            ps.periodo++; o.periodoSetor[f.setor.key]++; f.periodo++; A.periodo++;
            if(primeira){
              o.periodo++;
              var bk = bucketDe(ds);
              if(bk) bk.etapas[f.setor.key]++;
            }
          }
        }
      });
    });

    var contNovos = 0, treinPer = {};
    contatos.forEach(function(c){
      if(c.statusTreinamento === "concluido" && noPeriodo(diaDeISO(c.concluidoEm))) treinPer[chaveEmail(c) || ("id:" + c.id)] = true;
      var ds = diaDeISO(c.criadoEm);
      if(noPeriodo(ds)){ contNovos++; var bk = bucketDe(ds); if(bk) bk.contatos++; }
    });
    var evsPer = eventos.filter(function(e){ return noPeriodo(e.dia); });
    evsPer.forEach(function(e){ var bk = bucketDe(e.dia); if(bk) bk.atividades++; });

    var porEmp = {}, listaEmp = [];
    frentes.forEach(function(f){
      var o = porEmp[f.empresa.id];
      if(!o){ o = porEmp[f.empresa.id] = {empresa:f.empresa, frentes:[], progSoma:0, periodo:0, completa:true, analistas:[]}; listaEmp.push(o); }
      o.frentes.push(f); o.progSoma += f.prog; o.periodo += f.periodo;
      if(f.prog < 0.999) o.completa = false;
      var n = ((f.doc && f.doc.analistaNome) || "").trim();
      if(n && o.analistas.indexOf(n) === -1) o.analistas.push(n);
    });
    listaEmp.forEach(function(o){ o.prog = o.progSoma / o.frentes.length; });
    listaEmp.sort(function(a, b){ return a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"); });

    var setoresRes = setoresSel.map(function(s){
      var fs = frentes.filter(function(f){ return f.setor.key === s.key; });
      var aplic = 0, conc = 0, per = 0;
      etapas.forEach(function(o){ var ps = o.porSetor[s.key]; if(ps){ aplic += ps.aplic; conc += ps.concluido; per += ps.periodo; } });
      var cts = contatos.filter(function(c){ return (c.setores || []).indexOf(s.key) !== -1; });
      return {
        setor:s, frentes:fs.length,
        prog:fs.length ? fs.reduce(function(a, f){ return a + f.prog; }, 0) / fs.length : 0,
        completas:fs.filter(function(f){ return f.prog >= 0.999; }).length,
        aplic:aplic, conc:conc, periodo:per,
        contatos:cts.length, contTreinados:cts.filter(function(c){ return c.statusTreinamento === "concluido"; }).length,
        alinhamento:alinhamentoDoc(s.key).status || "pendente",
        impedimentos:fs.filter(function(f){ return f.doc && f.doc.impedimento && f.doc.impedimento.ativo; }).length
      };
    });

    var analistas = Object.keys(anal).map(function(k){
      var A = anal[k];
      A.prog = A.progSoma / A.frentes;
      A.setoresLista = SETORES.filter(function(s){ return A.setores[s.key]; });
      return A;
    }).sort(function(a, b){ return (a.semNome - b.semNome) || (b.periodo - a.periodo) || (b.conc - a.conc) || a.nome.localeCompare(b.nome, "pt-BR"); });

    var contar = function(lista){
      var c = {pendente:0, agendado:0, andamento:0, concluido:0};
      lista.forEach(function(x){ var st = x.statusTreinamento; c[STATUS_LABEL[st] ? st : "pendente"]++; });
      return c;
    };
    // Uma pessoa vinculada a várias empresas é UM treinamento: conta por e-mail (sem e-mail, cada registro é uma pessoa).
    // Se a mesma pessoa tem registros com status diferentes (ex.: um duplicado pendente), vale o mais adiantado.
    var porPessoa = {}, pessoasCont = [];
    contatos.forEach(function(c){
      var k = chaveEmail(c);
      if(!k){ pessoasCont.push(c); return; }
      var atual = porPessoa[k];
      if(!atual){ porPessoa[k] = c; pessoasCont.push(c); return; }
      if((RANK_TREINO[c.statusTreinamento] || 0) > (RANK_TREINO[atual.statusTreinamento] || 0)){
        pessoasCont[pessoasCont.indexOf(atual)] = c; porPessoa[k] = c;
      }
    });
    var treinoCont = contar(pessoasCont), treinoFunc = contar(funcs);

    var impedimentos = [];
    empresas.forEach(function(e){ if(e.impedimento && e.impedimento.ativo) impedimentos.push({escopo:"Empresa", alvo:e.nome, setor:"", desc:e.impedimento.descricao || ""}); });
    frentes.forEach(function(f){ if(f.doc && f.doc.impedimento && f.doc.impedimento.ativo) impedimentos.push({escopo:"Setor", alvo:f.empresa.nome, setor:f.setor.label, desc:f.doc.impedimento.descricao || ""}); });
    funcs.forEach(function(fn){ if(fn.impedimento && fn.impedimento.ativo) impedimentos.push({escopo:"Equipe", alvo:fn.nome, setor:SETOR_LABEL[fn.setor] || "", desc:fn.impedimento.descricao || ""}); });

    var frentesBreak = {pendente:0, andamento:0, concluido:0};
    frentes.forEach(function(f){ frentesBreak[f.prog >= 0.999 ? "concluido" : f.prog > 0 ? "andamento" : "pendente"]++; });
    var etapasAplic = 0, etapasConc = 0, etapasPeriodo = 0;
    etapas.forEach(function(o){ etapasAplic += o.aplic; etapasConc += o.concluido; etapasPeriodo += o.periodo; });

    return {
      iniS:iniS, fimS:fimS, modo:modo, buckets:buckets, setoresSel:setoresSel,
      frentes:frentes, frentesBreak:frentesBreak, etapas:etapas, listaEmp:listaEmp, setoresRes:setoresRes, analistas:analistas,
      contatos:contatos, funcs:funcs, treinoCont:treinoCont, treinoFunc:treinoFunc, impedimentos:impedimentos, evsPer:evsPer,
      kpis:{
        progGeral:frentes.length ? frentes.reduce(function(a, f){ return a + f.prog; }, 0) / frentes.length : 0,
        frentes:frentes.length, empresas:listaEmp.length,
        frentesCompletas:frentesBreak.concluido, empresasCompletas:listaEmp.filter(function(o){ return o.completa; }).length,
        etapasAplic:etapasAplic, etapasConc:etapasConc, etapasPeriodo:etapasPeriodo,
        frentesSemContato:frentes.filter(function(f){ return !contatosDoSetor(f.empresa.id, f.setor.key).length; }).length,
        semDataConc:semDataConc,
        contatos:pessoasCont.length, contTreinados:treinoCont.concluido, contNovos:contNovos, contTreinadosPeriodo:Object.keys(treinPer).length,
        funcs:funcs.length, funcTreinados:treinoFunc.concluido,
        impedimentos:impedimentos.length, atividadesPeriodo:evsPer.length
      },
      filtros:{
        periodo:diaBR(iniS) + " a " + diaBR(fimS),
        setor:r.setor === "todos" ? "Todos os setores" : SETOR_LABEL[r.setor],
        escopo:r.soFoco ? "Só empresas em foco" : "Todas as empresas ativas",
        modo:NOME_MODO[modo]
      }
    };
  }

  /* ---------- relatórios: gráficos (canvas, servem à tela, ao PDF e ao Excel) ---------- */
  var FONTE_TXT = '"IBM Plex Sans", system-ui, sans-serif';
  var FONTE_NUM = '"IBM Plex Mono", ui-monospace, monospace';
  var PALETA_CLARA = {surface:"#FFFFFF", ink:"#101820", ink2:"#47545F", ink3:"#78868F", rule:"#DCE3E9", ruleStrong:"#C2CCD5", track:"#E1E8EE", pessoal:"#9A6B00", contabil:"#0F7A55", fiscal:"#6A4FA0", pendente:"#C9D3DB", agendado:"#3C659B", andamento:"#5B6873", concluido:"#167A45"};

  function paletaTela(){
    var cs = getComputedStyle(document.documentElement);
    var v = function(n, pad){ return (cs.getPropertyValue(n) || "").trim() || pad; };
    return {
      surface:v("--surface", PALETA_CLARA.surface), ink:v("--ink", PALETA_CLARA.ink), ink2:v("--ink-2", PALETA_CLARA.ink2), ink3:v("--ink-3", PALETA_CLARA.ink3),
      rule:v("--rule", PALETA_CLARA.rule), ruleStrong:v("--rule-strong", PALETA_CLARA.ruleStrong), track:v("--track", PALETA_CLARA.track),
      pessoal:v("--sector-pessoal", PALETA_CLARA.pessoal), contabil:v("--sector-contabil", PALETA_CLARA.contabil), fiscal:v("--sector-fiscal", PALETA_CLARA.fiscal),
      pendente:v("--st-pend", PALETA_CLARA.pendente), agendado:v("--blue-deep", PALETA_CLARA.agendado), andamento:v("--st-and", PALETA_CLARA.andamento), concluido:v("--status-green", PALETA_CLARA.concluido)
    };
  }
  function prepararCanvas(canvas, w, h, escala){
    canvas.width = Math.round(w * escala); canvas.height = Math.round(h * escala);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    return ctx;
  }
  function retArred(ctx, x, y, w, h, r, lado){
    if(w <= 0 || h <= 0) return;
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    ctx.beginPath();
    if(r && lado === "topo"){
      ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h);
    } else if(r && lado === "dir"){
      ctx.moveTo(x, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x, y + h);
    } else if(r){
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    } else ctx.rect(x, y, w, h);
    ctx.closePath(); ctx.fill();
  }
  function escalaBonita(max, partes){
    if(!(max > 0)) return {max:4, passo:1};
    var bruto = max / partes, mag = Math.pow(10, Math.floor(Math.log10(bruto))), n = bruto / mag;
    var passo = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag);
    return {max:Math.ceil(max / passo) * passo, passo:passo};
  }
  function ajustarTexto(ctx, txt, max){
    txt = String(txt || "");
    if(ctx.measureText(txt).width <= max) return txt;
    while(txt.length > 1 && ctx.measureText(txt + "…").width > max) txt = txt.slice(0, -1);
    return txt + "…";
  }
  function desenharLegenda(ctx, series, x, y, pal){
    ctx.font = "600 11px " + FONTE_TXT; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    var cx = x;
    series.forEach(function(s){
      ctx.fillStyle = s.cor; retArred(ctx, cx, y - 5, 10, 10, 2);
      ctx.fillStyle = pal.ink2; ctx.fillText(s.label, cx + 15, y + 0.5);
      cx += 15 + ctx.measureText(s.label).width + 18;
    });
  }

  // Colunas empilhadas no tempo (uma coluna por dia/semana/mês).
  function graficoColunas(canvas, o){
    var pal = o.pal, W = o.w, H = o.h;
    var ctx = prepararCanvas(canvas, W, H, o.escala);
    ctx.fillStyle = pal.surface; ctx.fillRect(0, 0, W, H);
    var comLegenda = o.series.length > 1;
    if(comLegenda) desenharLegenda(ctx, o.series, 0, 9, pal);
    var topo = comLegenda ? 40 : 20, base = H - 24, esq = 34, dir = W - 2, alt = base - topo;
    var totais = o.grupos.map(function(g){ return o.series.reduce(function(a, s){ return a + (g.valores[s.key] || 0); }, 0); });
    var maxT = Math.max.apply(null, [0].concat(totais));
    var esc2 = escalaBonita(maxT, 4);
    var y = function(v){ return base - v / esc2.max * alt; };
    ctx.textBaseline = "middle"; ctx.textAlign = "right"; ctx.font = "500 10px " + FONTE_NUM; ctx.lineWidth = 1;
    for(var v = 0; v <= esc2.max + 1e-9; v += esc2.passo){
      var yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? pal.ruleStrong : pal.rule;
      ctx.beginPath(); ctx.moveTo(esq, yy); ctx.lineTo(dir, yy); ctx.stroke();
      ctx.fillStyle = pal.ink3; ctx.fillText(fmtNum(v), esq - 6, yy);
    }
    var n = Math.max(o.grupos.length, 1), banda = (dir - esq) / n, larg = Math.max(2, Math.min(24, banda * 0.62));
    ctx.font = "500 10px " + FONTE_TXT;
    var maxRot = 1;
    o.grupos.forEach(function(g){ maxRot = Math.max(maxRot, ctx.measureText(g.rotulo).width); });
    var passoRot = Math.max(1, Math.ceil((maxRot + 10) / banda));
    var iMax = maxT > 0 ? totais.indexOf(maxT) : -1;
    var regioes = [];
    o.grupos.forEach(function(g, i){
      var cx = esq + banda * i + banda / 2, x0 = cx - larg / 2, acum = 0;
      var segs = o.series.filter(function(s){ return (g.valores[s.key] || 0) > 0; });
      segs.forEach(function(s, j){
        var val = g.valores[s.key], yTop = y(acum + val), yBot = y(acum) - (j > 0 ? 2 : 0), ultimo = j === segs.length - 1;
        ctx.fillStyle = s.cor;
        retArred(ctx, x0, yTop, larg, Math.max(1, yBot - yTop), ultimo ? 4 : 0, ultimo ? "topo" : "");
        acum += val;
      });
      if(i % passoRot === 0){
        ctx.fillStyle = pal.ink3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "500 10px " + FONTE_TXT;
        ctx.fillText(g.rotulo, cx, base + 7);
      }
      if(i === iMax){
        ctx.fillStyle = pal.ink2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = "600 10.5px " + FONTE_NUM;
        ctx.fillText(fmtNum(maxT), cx, y(maxT) - 4);
      }
      regioes.push({x:esq + banda * i, y:topo - 10, w:banda, h:alt + 34, dica:g.dica});
    });
    if(maxT === 0 && o.vazio){
      ctx.fillStyle = pal.ink3; ctx.font = "500 12px " + FONTE_TXT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.vazio, (esq + dir) / 2, topo + alt / 2);
    }
    return {regioes:regioes, w:W, h:H};
  }

  // Barras horizontais empilhadas (uma linha por etapa).
  function graficoBarras(canvas, o){
    var pal = o.pal, W = o.w, altLinha = o.alturaLinha || 38;
    var comLegenda = o.series.length > 1;
    var topo = comLegenda ? 30 : 4;
    var H = o.linhas.length ? topo + o.linhas.length * altLinha + 4 : 60;
    var ctx = prepararCanvas(canvas, W, H, o.escala);
    ctx.fillStyle = pal.surface; ctx.fillRect(0, 0, W, H);
    if(!o.linhas.length){
      ctx.fillStyle = pal.ink3; ctx.font = "500 12px " + FONTE_TXT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.vazio || "Sem dados", W / 2, H / 2);
      return {regioes:[], w:W, h:H};
    }
    if(comLegenda) desenharLegenda(ctx, o.series, 0, 9, pal);
    var esq = Math.round(o.largRotulo || Math.min(220, W * 0.36)), dir = W - (o.largFim || 96);
    var totais = o.linhas.map(function(l){ return o.series.reduce(function(a, s){ return a + (l.valores[s.key] || 0); }, 0); });
    var maxV = o.max || Math.max.apply(null, [1].concat(totais));
    var esp = 14, regioes = [];
    ctx.strokeStyle = pal.ruleStrong; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(esq + 0.5, topo); ctx.lineTo(esq + 0.5, H - 4); ctx.stroke();
    o.linhas.forEach(function(l, i){
      var y0 = topo + i * altLinha, yc = y0 + altLinha / 2;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = pal.ink; ctx.font = "600 11.5px " + FONTE_TXT;
      if(l.sub){
        ctx.fillText(ajustarTexto(ctx, l.rotulo, esq - 14), 0, yc - 7);
        ctx.fillStyle = pal.ink3; ctx.font = "500 10px " + FONTE_TXT;
        ctx.fillText(ajustarTexto(ctx, l.sub, esq - 14), 0, yc + 8);
      } else ctx.fillText(ajustarTexto(ctx, l.rotulo, esq - 14), 0, yc);
      var x = esq + 1;
      var segs = o.series.filter(function(s){ return (l.valores[s.key] || 0) > 0; });
      segs.forEach(function(s, j){
        var larg = l.valores[s.key] / maxV * (dir - esq - 1);
        var x0 = x + (j > 0 ? 2 : 0), ultimo = j === segs.length - 1;
        ctx.fillStyle = s.cor;
        retArred(ctx, x0, yc - esp / 2, Math.max(1, larg - (j > 0 ? 2 : 0)), esp, ultimo ? 4 : 0, ultimo ? "dir" : "");
        x += larg;
      });
      if(l.rotuloFim){
        ctx.fillStyle = pal.ink2; ctx.font = "600 10.5px " + FONTE_NUM; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(l.rotuloFim, x + 8, yc);
      }
      regioes.push({x:0, y:y0, w:W, h:altLinha, dica:l.dica});
    });
    return {regioes:regioes, w:W, h:H};
  }

  function gaugeImagem(frac){
    var c = document.createElement("canvas"), W = 148, H = 84, sw = 14;
    var ctx = prepararCanvas(c, W, H, 3);
    var r = Math.min(W / 2 - sw / 2, H - sw / 2), cx = W / 2, cy = H - sw / 2;
    ctx.lineCap = "round"; ctx.lineWidth = sw;
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
    var f = Math.max(0, Math.min(1, frac || 0));
    if(f > 0){ ctx.strokeStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * f); ctx.stroke(); }
    return c.toDataURL("image/png");
  }

  function seriesSetoresRel(m, pal){ return m.setoresSel.map(function(s){ return {key:s.key, label:s.label, cor:pal[s.key]}; }); }
  function seriesStatusRel(pal, comAgendado){
    var s = [{key:"concluido", label:"Concluído", cor:pal.concluido}, {key:"andamento", label:"Em andamento", cor:pal.andamento}];
    if(comAgendado) s.push({key:"agendado", label:"Agendado", cor:pal.agendado});
    s.push({key:"pendente", label:"Pendente", cor:pal.pendente});
    return s;
  }
  function dadosVolume(m, pal){
    return {series:seriesSetoresRel(m, pal), vazio:"Nenhuma etapa concluída no período", grupos:m.buckets.map(function(b){
      var tot = 0;
      var partes = m.setoresSel.map(function(s){ tot += b.etapas[s.key]; return esc(s.label) + ": " + b.etapas[s.key]; });
      return {rotulo:b.rotulo, valores:b.etapas, dica:"<b>" + esc(b.titulo) + "</b>" + partes.join(" · ") + "<br>Total: " + tot + " etapa" + (tot === 1 ? "" : "s")};
    })};
  }
  function dadosEtapasPeriodo(m, pal){
    return {series:seriesSetoresRel(m, pal), vazio:"Nenhuma frente no escopo", linhas:m.etapas.filter(function(o){ return o.aplic > 0; }).map(function(o){
      return {rotulo:o.label, sub:fmtNum(o.aplic) + " frentes aplicáveis", valores:o.periodoSetor, rotuloFim:fmtNum(o.periodo),
        dica:"<b>" + esc(o.label) + "</b>" + m.setoresSel.map(function(s){ return esc(s.label) + ": " + o.periodoSetor[s.key]; }).join(" · ")};
    })};
  }
  function dadosSituacao(m, pal){
    var comAgendado = m.etapas.some(function(o){ return o.agendado > 0; });
    return {series:seriesStatusRel(pal, comAgendado), vazio:"Nenhuma frente no escopo", linhas:m.etapas.filter(function(o){ return o.aplic > 0; }).map(function(o){
      var dica = "<b>" + esc(o.label) + "</b>Concluído: " + o.concluido + " · Em andamento: " + o.andamento + (comAgendado ? " · Agendado: " + o.agendado : "") + " · Pendente: " + o.pendente;
      return {rotulo:o.label, sub:fmtNum(o.aplic) + " frentes", valores:{concluido:o.concluido, andamento:o.andamento, agendado:o.agendado, pendente:o.pendente},
        rotuloFim:fmtNum(o.concluido) + " de " + fmtNum(o.aplic) + " · " + fmtPct(razao(o.concluido, o.aplic)),
        dica:dica};
    })};
  }

  function ligarDicas(canvas, regioes){
    var tip = $("#tip");
    canvas.onmousemove = function(ev){
      var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, hit = null;
      for(var i = 0; i < regioes.length; i++){
        var g = regioes[i];
        if(x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h){ hit = g; break; }
      }
      if(!hit || !hit.dica){ tip.hidden = true; return; }
      tip.innerHTML = hit.dica; tip.hidden = false;
      tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 246) + "px";
      tip.style.top = Math.min(ev.clientY + 14, window.innerHeight - 70) + "px";
    };
    canvas.onmouseleave = function(){ tip.hidden = true; };
  }

  /* ---------- relatórios: blocos HTML (tela e PDF) ---------- */
  function relHeroHTML(m, paraPdf){
    var k = m.kpis, b = m.frentesBreak;
    var gauge = paraPdf ? '<img src="' + gaugeImagem(k.progGeral) + '" width="148" height="84" alt="">' : gaugeSVG(k.progGeral, 148, 84, 14, "#fff", "rgba(255,255,255,.16)");
    var stat = function(lbl, val, alerta){ return '<div class="hero-stat' + (alerta ? ' alert' : '') + '"><span class="lbl">' + lbl + '</span><span class="val">' + val + '</span></div>'; };
    return '<div class="hero-main">' +
        '<div class="hero-gauge">' + gauge + '<div class="hero-gauge-num"><span class="n">' + Math.round(k.progGeral * 100) + '</span><span class="u">%</span></div></div>' +
        '<div class="hero-copy">' +
          '<h2>Progresso da implantação</h2>' +
          '<p>' + fmtNum(k.frentes) + ' frente' + (k.frentes === 1 ? '' : 's') + ' (empresa × setor) em ' + fmtNum(k.empresas) + ' empresa' + (k.empresas === 1 ? '' : 's') + '</p>' +
          '<div class="hero-chips">' +
            '<span class="hero-chip"><i style="background:var(--st-pend)"></i>' + b.pendente + ' pendente' + (b.pendente === 1 ? '' : 's') + '</span>' +
            '<span class="hero-chip"><i style="background:var(--st-and)"></i>' + b.andamento + ' em andamento</span>' +
            '<span class="hero-chip"><i style="background:var(--status-green)"></i>' + b.concluido + ' concluída' + (b.concluido === 1 ? '' : 's') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hero-stats">' +
        stat("Etapas no período", fmtNum(k.etapasPeriodo)) +
        stat("Atividades no período", fmtNum(k.atividadesPeriodo)) +
        stat("Contatos treinados", fmtNum(k.contTreinadosPeriodo)) +
        stat("Impedimentos", fmtNum(k.impedimentos), k.impedimentos > 0) +
      '</div>';
  }
  function relKpisHTML(m){
    var k = m.kpis;
    var kpi = function(lbl, val, total, sub){
      return '<div class="kpi"><span class="kpi-lbl">' + lbl + '</span><span class="kpi-val">' + fmtNum(val) + '<small> / ' + fmtNum(total) + '</small></span><span class="kpi-sub">' + sub + '</span></div>';
    };
    return kpi("Etapas concluídas", k.etapasConc, k.etapasAplic, fmtPct(razao(k.etapasConc, k.etapasAplic)) + " das etapas aplicáveis" + (k.semDataConc ? " · " + fmtNum(k.semDataConc) + " sem data de conclusão (não entram no período)" : "")) +
      kpi("Frentes 100% concluídas", k.frentesCompletas, k.frentes, "frente = empresa × setor com demanda" + (k.frentesSemContato ? " · " + fmtNum(k.frentesSemContato) + " ainda sem contato de cliente cadastrado" : "")) +
      kpi("Empresas 100% implantadas", k.empresasCompletas, k.empresas, "todas as frentes concluídas") +
      kpi("Contatos treinados", k.contTreinados, k.contatos, fmtPct(razao(k.contTreinados, k.contatos)) + " dos contatos de clientes") +
      kpi("Equipe treinada", k.funcTreinados, k.funcs, fmtPct(razao(k.funcTreinados, k.funcs)) + " da equipe do escritório");
  }
  function relSetoresHTML(m){
    if(!m.setoresRes.length) return '<p class="rel-mais" style="padding-inline:0;">Nenhum setor no escopo.</p>';
    return m.setoresRes.map(function(s){
      return '<div class="rel-setor" style="--sc:var(--sector-' + s.setor.key + ')">' +
        '<span class="sector-tag2"><i></i>' + s.setor.label + '</span>' +
        '<div class="hbar-track"><div class="hbar-fill" style="width:' + Math.round(s.prog * 100) + '%"></div></div>' +
        '<span class="pct">' + fmtPct(s.prog) + '</span>' +
        '<div class="det"><span><b>' + fmtNum(s.frentes) + '</b> frentes</span><span><b>' + fmtNum(s.conc) + '/' + fmtNum(s.aplic) + '</b> etapas</span><span><b>+' + fmtNum(s.periodo) + '</b> no período</span><span>Alinhamento: <b>' + STATUS_LABEL[s.alinhamento] + '</b></span></div>' +
      '</div>';
    }).join("");
  }
  function stackbar(c, total){
    if(!total) return '<div class="stackbar vazio"></div>';
    return '<div class="stackbar">' + [["concluido", "var(--status-green)"], ["andamento", "var(--st-and)"], ["agendado", "var(--blue-deep)"], ["pendente", "var(--st-pend)"]].filter(function(p){ return c[p[0]] > 0; }).map(function(p){
      return '<i style="flex:' + c[p[0]] + ' 1 0; background:' + p[1] + '" title="' + STATUS_LABEL[p[0]] + ': ' + c[p[0]] + '"></i>';
    }).join("") + '</div>';
  }
  function legendaStatusHTML(comAgendado){
    return '<div class="legend"><span class="lg"><i style="background:var(--status-green)"></i>Concluído</span><span class="lg"><i style="background:var(--st-and)"></i>Em andamento</span>' +
      (comAgendado ? '<span class="lg"><i style="background:var(--blue-deep)"></i>Agendado</span>' : '') +
      '<span class="lg"><i style="background:var(--st-pend)"></i>Pendente</span></div>';
  }
  function relTreinoHTML(m){
    var comAgendado = m.treinoCont.agendado > 0 || m.treinoFunc.agendado > 0;
    var linha = function(lbl, c){
      var total = c.pendente + (c.agendado || 0) + c.andamento + c.concluido;
      var det = "Em andamento: " + fmtNum(c.andamento) + (comAgendado ? " · Agendado: " + fmtNum(c.agendado || 0) : "") + " · Pendente: " + fmtNum(c.pendente);
      return '<div class="rel-tr"><div class="rel-tr-top"><strong>' + lbl + '</strong><span class="mono">' + fmtNum(c.concluido) + ' de ' + fmtNum(total) + ' treinados · ' + fmtPct(razao(c.concluido, total)) + '</span></div>' +
        stackbar(c, total) + '<div class="rel-tr-det">' + det + '</div></div>';
    };
    return linha("Contatos de clientes", m.treinoCont) + linha("Equipe do escritório", m.treinoFunc) + legendaStatusHTML(comAgendado);
  }
  function relAnalistasHTML(m, limite, tela){
    if(!m.analistas.length) return '<p class="rel-mais" style="padding-inline:0;">Nenhuma frente no escopo.</p>';
    var lista = m.analistas;
    if(tela){
      var col = ui.relAnaOrdem || "", dir = ui.relAnaDir || 1;
      var val = {nome:function(a){ return a.nome; }, frentes:function(a){ return a.frentes; }, conc:function(a){ return a.conc; }, periodo:function(a){ return a.periodo; }, prog:function(a){ return a.prog; }}[col];
      if(val) lista = lista.slice().sort(function(a, b){ var x = val(a), y = val(b); return (typeof x === "string" ? x.localeCompare(y, "pt-BR") : x - y) * dir; });
      if(ui.relAnaTodos) limite = lista.length;
    }
    var th = function(rot, key, cls){
      if(!tela) return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + rot + '</th>';
      var on = ui.relAnaOrdem === key;
      return '<th' + (cls ? ' class="' + cls + '"' : '') + '><button type="button" class="rel-th" data-action="rel-ana-ordem" data-col="' + key + '">' + rot + (on ? (ui.relAnaDir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
    };
    var linhas = lista.slice(0, limite).map(function(a){
      var nomeHtml = a.semNome ? '<span class="muted">' + esc(a.nome) + '</span>'
        : tela ? '<button type="button" class="rel-link" data-action="rel-ana-abrir" data-nome="' + esc(a.nome) + '" title="Ver as empresas deste analista em Consulta">' + esc(a.nome) + '</button>' : '<strong>' + esc(a.nome) + '</strong>';
      return '<tr><td>' + nomeHtml + '</td>' +
        '<td>' + a.setoresLista.map(function(s){ return '<span class="trk-tag">' + s.tag + '</span>'; }).join("") + '</td>' +
        '<td class="num">' + fmtNum(a.frentes) + '</td>' +
        '<td class="num">' + fmtNum(a.conc) + ' / ' + fmtNum(a.aplic) + '</td>' +
        '<td class="num">' + (a.periodo ? '+' + fmtNum(a.periodo) : '0') + '</td>' +
        '<td><div class="rel-prog"><span class="minibar"><i style="width:' + Math.round(a.prog * 100) + '%"></i></span><span class="num">' + fmtPct(a.prog) + '</span></div></td></tr>';
    }).join("");
    return '<div class="rel-tablewrap"><table class="rel-table"><thead><tr>' + th("Analista", "nome") + '<th>Setores</th>' + th("Frentes", "frentes", "num") + th("Etapas concluídas", "conc", "num") + th("No período", "periodo", "num") + th("Progresso médio", "prog") + '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      (m.analistas.length > limite ? (tela ? '<p class="rel-mais" style="padding-inline:0;"><button type="button" class="linkish" data-action="rel-ana-todos">Ver todos os ' + m.analistas.length + ' analistas</button></p>' : '<p class="rel-mais" style="padding-inline:0;">E mais ' + (m.analistas.length - limite) + ' analista(s). A lista completa está no Excel.</p>') : '');
  }
  function tabelaEtapasHTML(m){
    var comAgendado = m.etapas.some(function(o){ return o.agendado > 0; });
    var colsp = comAgendado ? 9 : 8;
    var corpo = m.setoresSel.map(function(s){
      var linhas = m.etapas.map(function(o){
        var ps = o.porSetor[s.key];
        if(!ps || !ps.aplic) return "";
        return '<tr><td>' + o.label + '</td><td class="num">' + fmtNum(ps.aplic) + '</td><td class="num">' + fmtNum(ps.concluido) + '</td><td class="num">' + fmtNum(ps.andamento) + '</td>' +
          (comAgendado ? '<td class="num">' + fmtNum(ps.agendado || 0) + '</td>' : '') +
          '<td class="num">' + fmtNum(ps.pendente) + '</td><td>' + stackbar(ps, ps.aplic) + '</td><td class="num">' + fmtPct(razao(ps.concluido, ps.aplic)) + '</td><td class="num">' + fmtNum(ps.periodo) + '</td></tr>';
      }).join("");
      return '<tr class="grp-row" style="--sc:var(--sector-' + s.key + ')"><td colspan="' + colsp + '"><span class="sector-tag2"><i></i>' + s.label + '</span></td></tr>' +
        (linhas || '<tr><td colspan="' + colsp + '" class="muted">Nenhuma frente com demanda neste setor.</td></tr>');
    }).join("");
    return '<table class="rel-table"><thead><tr><th>Etapa</th><th class="num">Frentes</th><th class="num">Concl.</th><th class="num">Andam.</th>' +
      (comAgendado ? '<th class="num">Agend.</th>' : '') +
      '<th class="num">Pend.</th><th>Distribuição</th><th class="num">%</th><th class="num">No período</th></tr></thead><tbody>' + corpo + '</tbody></table>';
  }
  function tabelaEmpresasHTML(m, bloco){
    return '<table class="rel-table rp-linhas rp-emp"><colgroup><col style="width:236px"><col style="width:300px"><col style="width:112px"><col style="width:58px"></colgroup><thead><tr><th>Empresa</th><th>Etapas por setor</th><th>Progresso</th><th class="num">No período</th></tr></thead><tbody>' + bloco.map(function(o){
      var trilhas = m.setoresSel.map(function(s){
        var f = o.frentes.find(function(x){ return x.setor.key === s.key; });
        return '<span class="trk"><span class="trk-tag">' + s.tag + '</span>' + (f ? '<span class="cells">' + trilha(o.empresa, f.doc, s.key) + '</span>' : '<span class="rp-na">—</span>') + '</span>';
      }).join("");
      var linha2 = [o.empresa.cnpj || "", o.analistas.join(", ")].filter(Boolean).join(" · ");
      return '<tr><td><strong>' + esc(cortar(o.empresa.nome, 32)) + '</strong><span class="rp-cnpj">' + esc(cortar(linha2, 42) || "—") + '</span></td>' +
        '<td><span class="erow-tracks">' + trilhas + '</span></td>' +
        '<td><div class="rel-prog"><span class="minibar"><i style="width:' + Math.round(o.prog * 100) + '%"></i></span><span class="num">' + fmtPct(o.prog) + '</span></div></td>' +
        '<td class="num">' + (o.periodo ? '+' + o.periodo : '0') + '</td></tr>';
    }).join("") + '</tbody></table>';
  }
  /* ---------- quem fez cada alteração (ids do capability user; nomes resolvidos só na exibição) ---------- */
  var userRef = null, meuId = null, nomesPessoas = {};
  function nomesDe(ids){
    ids = ids.filter(function(x, i){ return x && ids.indexOf(x) === i; });
    var A = authP();
    if((!userRef && !A) || !ids.length) return Promise.resolve({});
    return (A ? A.perfis(ids, function(l){ return userRef ? userRef.profiles(l) : Promise.resolve({}); }) : userRef.profiles(ids)).then(function(ps){
      var out = {};
      ids.forEach(function(id){ out[id] = (ps[id] && ps[id].name) || "Alguém"; });
      return out;
    }, function(){ return {}; });
  }
  function preencherNomes(box){
    var els = $$("[data-uid]", box);
    if(!els.length) return;
    nomesDe(els.map(function(el){ return el.getAttribute("data-uid"); })).then(function(n){
      els.forEach(function(el){ var nome = n[el.getAttribute("data-uid")]; if(nome) el.textContent = "por " + nome; });
    });
  }
  function tabelaAtividadesHTML(evs){
    return '<table class="rel-table rp-linhas"><thead><tr><th>Data</th><th>Tipo</th><th>Atividade</th></tr></thead><tbody>' + evs.map(function(e){
      var d = descEvento(e), onde = ondeEvento(e);
      return '<tr><td class="num">' + diaBR(e.dia) + '<span class="rp-cnpj">' + (e.em ? horaDeISO(e.em) : "—") + '</span></td>' +
        '<td><span class="rel-tipo">' + esc(TIPOS_ATV[e.tipo] || e.tipo) + '</span></td>' +
        '<td class="rel-txt">' + esc(cortar(d.txt, 66)) + eventoChips(d) + '<span class="rel-onde">' + esc(cortar([onde, e.por && nomesPessoas[e.por] ? "por " + nomesPessoas[e.por] : ""].filter(Boolean).join(" · "), 84) || "—") + '</span></td></tr>';
    }).join("") + '</tbody></table>';
  }

  /* ---------- relatórios: tela ---------- */
  function renderRelatorios(){
    if(ui.view !== "relatorios") return;
    var r = ui.rel;
    $("#relPeriodo").innerHTML = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["tudo", "Tudo"], ["custom", "Personalizado"]].map(function(p){
      return '<button type="button" data-per="' + p[0] + '" class="' + (r.periodo === p[0] ? "on" : "") + '">' + p[1] + '</button>';
    }).join("");
    $("#relSetor").innerHTML = '<button type="button" data-setor="todos" class="' + (r.setor === "todos" ? "on" : "") + '">Todos</button>' + SETORES.map(function(s){
      return '<button type="button" data-setor="' + s.key + '" class="' + (r.setor === s.key ? "on" : "") + '">' + s.label + '</button>';
    }).join("");
    $("#relDatas").hidden = r.periodo !== "custom";
    if(document.activeElement !== $("#relDe")) $("#relDe").value = r.de;
    if(document.activeElement !== $("#relAte")) $("#relAte").value = r.ate;
    $("#relSoFoco").classList.toggle("on", r.soFoco);
    $("#relTipoAtv").value = r.tipoAtv;

    salvarUI();
    var m = relModel();
    $("#relPeriodoTxt").textContent = m.filtros.periodo;
    $("#relHero").innerHTML = relHeroHTML(m, false);
    $("#relKpis").innerHTML = relKpisHTML(m);
    $("#relVolSub").textContent = "Por " + m.filtros.modo + ", pela data de conclusão de cada etapa";
    var pal = paletaTela(), dpr = window.devicePixelRatio || 1;
    var desenhar = function(cv, fn){
      if(!cv) return;
      var w = Math.max(240, Math.floor(cv.parentNode.clientWidth));
      ligarDicas(cv, fn(cv, w).regioes);
    };
    desenhar($("#relChartVolume"), function(cv, w){ return graficoColunas(cv, Object.assign({w:w, h:250, escala:dpr, pal:pal}, dadosVolume(m, pal))); });
    desenhar($("#relChartEtapasPeriodo"), function(cv, w){ return graficoBarras(cv, Object.assign({w:w, escala:dpr, pal:pal, largFim:48, largRotulo:Math.min(200, w * 0.42)}, dadosEtapasPeriodo(m, pal))); });
    desenhar($("#relChartSituacao"), function(cv, w){ return graficoBarras(cv, Object.assign({w:w, escala:dpr, pal:pal, largFim:132, largRotulo:Math.min(220, w * 0.36)}, dadosSituacao(m, pal))); });
    renderMatrix(m);
    $("#relSetores").innerHTML = relSetoresHTML(m);
    $("#relTreino").innerHTML = relTreinoHTML(m);
    $("#relAnalistas").innerHTML = relAnalistasHTML(m, 15, true);
    renderRelAtividades();
    atualizarBotoesRel();
  }

  var ICO_SETA = '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h11.5M9.5 1.5 13 5l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICO_TK = {
    sobe:'<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8.5H1z" fill="currentColor"/></svg>',
    desce:'<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 1.5h8z" fill="currentColor"/></svg>',
    neutro:'<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/></svg>'
  };
  var ORDEM_ST_ATV = {pendente:0, agendado:1, andamento:2, concluido:3};
  // Avanço (▲ verde), recuo (▼ vermelho) ou neutro, como num painel de cotações.
  function direcaoEvento(e){
    if(e.tipo === "impedimento") return e.para === "removido" ? "sobe" : "desce";
    if(ORDEM_ST_ATV[e.para] === undefined) return "neutro";
    if(ORDEM_ST_ATV[e.de] === undefined) return e.para === "concluido" ? "sobe" : "neutro";
    var d = ORDEM_ST_ATV[e.para] - ORDEM_ST_ATV[e.de];
    return d > 0 ? "sobe" : d < 0 ? "desce" : "neutro";
  }
  function eventosEscopoRel(){
    var r = ui.rel, ok = {};
    state.empresas.forEach(function(e){ if(e.ativo !== false && (!r.soFoco || e.emFoco)) ok[e.id] = true; });
    return eventosUnificados().filter(function(e){
      if(e.empresaId && !ok[e.empresaId]) return false;
      if(r.setor !== "todos" && e.setor && e.setor !== r.setor) return false;
      return true;
    });
  }
  function renderTicker(evs){
    var hoje = hojeISO();
    var nHoje = evs.filter(function(e){ return e.dia === hoje; }).length;
    $("#relAtvHoje").textContent = nHoje ? fmtNum(nHoje) + " hoje" : "nenhuma hoje";
    var ultimas = evs.slice(0, 30);
    if(!ultimas.length){ pintarSeMudou($("#relTicker"), '<div class="tk-lbl"><i class="tk-pulso"></i>Ao vivo</div><div class="tk-vazio">Nenhuma atividade registrada ainda.</div>'); return; }
    var itens = ultimas.map(function(e){
      var d = descEvento(e), dir = direcaoEvento(e), onde = ondeEvento(e);
      var dd = parseDia(e.dia);
      var quando = (e.dia === hoje ? "" : (dd ? pad2(dd.getDate()) + "/" + pad2(dd.getMonth() + 1) + " " : "")) + (e.em ? horaDeISO(e.em) : (e.dia === hoje ? "hoje" : ""));
      var st = d.para && STATUS_LABEL[d.para] ? '<span class="tk-st">' + STATUS_LABEL[d.para] + '</span>' : '';
      var dentro = '<span class="tk-ico">' + ICO_TK[dir] + '</span><span class="tk-hora">' + esc(quando.trim()) + '</span><span class="tk-txt">' + esc(cortar(d.txt, 60)) + '</span>' + st + (onde ? '<span class="tk-onde">' + esc(onde) + '</span>' : '');
      return e.empresaId
        ? '<button type="button" class="tk-item tk-' + dir + '" data-action="ir-empresa" data-id="' + esc(e.empresaId) + '" title="Abrir a empresa em Consulta">' + dentro + '</button>'
        : '<span class="tk-item tk-' + dir + '">' + dentro + '</span>';
    }).join("");
    var dur = Math.max(30, ultimas.length * 6);
    pintarSeMudou($("#relTicker"),
      '<div class="tk-lbl"><i class="tk-pulso"></i>Ao vivo</div>' +
      '<div class="tk-janela"><div class="tk-fita" style="--dur:' + dur + 's">' + itens + '<span class="tk-copia" aria-hidden="true">' + itens + '</span></div></div>');
  }
  var PERIODOS_ATV = [["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["tudo", "Tudo"], ["custom", "Personalizado"]];
  function renderRelAtividades(){
    var r = ui.rel;
    var todos = eventosEscopoRel();
    renderTicker(todos);
    pintarSeMudou($("#atvPeriodo"), PERIODOS_ATV.map(function(p){
      return '<button type="button" data-atvper="' + p[0] + '" class="' + (r.atvPer === p[0] ? "on" : "") + '">' + p[1] + '</button>';
    }).join(""));
    $("#atvDatas").hidden = r.atvPer !== "custom";
    if(document.activeElement !== $("#atvDe")) $("#atvDe").value = r.atvDe;
    if(document.activeElement !== $("#atvAte")) $("#atvAte").value = r.atvAte;
    $("#atvFechar").hidden = !r.atvPer;
    var box = $("#relAtividades");
    if(!r.atvPer){
      $("#relAtvCount").textContent = "";
      box.innerHTML = '<div class="atv-escolha">Escolha um período em <b>Ver lista</b> para listar as atividades.</div>';
      return;
    }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var ini = "", fim = diaLocal(hoje);
    if(r.atvPer === "hoje") ini = fim;
    else if(r.atvPer === "7" || r.atvPer === "30") ini = diaLocal(somarDias(hoje, -(parseInt(r.atvPer, 10) - 1)));
    else if(r.atvPer === "custom"){
      ini = r.atvDe || ""; fim = r.atvAte || fim;
      if(ini && fim < ini){ var t = ini; ini = fim; fim = t; }
    }
    var grupo = r.tipoAtv;
    var evs = todos.filter(function(e){
      return (!ini || e.dia >= ini) && e.dia <= fim && (grupo === "todos" || GRUPO_ATV[e.tipo] === grupo);
    });
    $("#relAtvCount").textContent = fmtNum(evs.length) + " no período";
    if(!evs.length){
      box.innerHTML = '<div class="empty">Nenhuma atividade nesse período.</div>';
      return;
    }
    var limite = 150, html = "", diaAtual = null, porDia = {};
    evs.forEach(function(e){ porDia[e.dia] = (porDia[e.dia] || 0) + 1; });
    evs.slice(0, limite).forEach(function(e){
      if(e.dia !== diaAtual){
        diaAtual = e.dia;
        var dd = parseDia(e.dia);
        html += '<div class="rel-dia"><span>' + (dd ? dd.toLocaleDateString("pt-BR", {weekday:"long", day:"numeric", month:"long", year:"numeric"}) : esc(e.dia)) + '</span><span>' + porDia[e.dia] + ' atividade' + (porDia[e.dia] === 1 ? '' : 's') + '</span></div>';
      }
      var d = descEvento(e), onde = ondeEvento(e), dir = direcaoEvento(e);
      var nota = e.origem === "derivado" ? "pela data de conclusão da etapa" : "";
      html += '<div class="rel-ev"><time>' + (e.em ? horaDeISO(e.em) : '—') + '</time><span class="rel-tipo">' + esc(TIPOS_ATV[e.tipo] || e.tipo) + '</span>' +
        '<div class="rel-txt"><span class="rel-dir tk-' + dir + '">' + ICO_TK[dir] + '</span>' + (e.empresaId && empresaPorId(e.empresaId) ? '<button type="button" class="rel-link" data-action="ir-empresa" data-id="' + esc(e.empresaId) + '" title="Abrir a empresa em Consulta">' + esc(d.txt) + '</button>' : esc(d.txt)) + eventoChips(d) + ((onde || nota || e.por) ? '<span class="rel-onde">' + esc([onde, nota].filter(Boolean).join(" · ")) + (e.por ? '<span class="rel-quem" data-uid="' + esc(e.por) + '"></span>' : '') + '</span>' : '') + '</div></div>';
    });
    if(evs.length > limite) html += '<p class="rel-mais">Mostrando as ' + limite + ' atividades mais recentes de ' + fmtNum(evs.length) + '. O registro completo vai no Excel.</p>';
    box.innerHTML = html;
    preencherNomes(box);
  }
  $("#atvPeriodo").addEventListener("click", function(ev){
    var b = ev.target.closest("button[data-atvper]"); if(!b) return;
    ui.rel.atvPer = b.getAttribute("data-atvper");
    if(ui.rel.atvPer === "custom" && !ui.rel.atvDe){ var hj = new Date(); ui.rel.atvAte = diaLocal(hj); ui.rel.atvDe = diaLocal(somarDias(hj, -6)); }
    renderRelAtividades();
  });
  $("#atvDe").addEventListener("change", function(){ ui.rel.atvDe = this.value; renderRelAtividades(); });
  $("#atvAte").addEventListener("change", function(){ ui.rel.atvAte = this.value; renderRelAtividades(); });

  $("#relPeriodo").addEventListener("click", function(ev){
    var b = ev.target.closest("button[data-per]"); if(!b) return;
    ui.rel.periodo = b.getAttribute("data-per");
    if(ui.rel.periodo === "custom" && !ui.rel.de){ var hj = new Date(); ui.rel.ate = diaLocal(hj); ui.rel.de = diaLocal(somarDias(hj, -29)); }
    renderRelatorios();
  });
  $("#relSetor").addEventListener("click", function(ev){
    var b = ev.target.closest("button[data-setor]"); if(!b) return;
    ui.rel.setor = b.getAttribute("data-setor");
    renderRelatorios();
  });
  $("#relSoFoco").addEventListener("click", function(){ ui.rel.soFoco = !ui.rel.soFoco; renderRelatorios(); });
  $("#relDe").addEventListener("change", function(){ ui.rel.de = this.value; renderRelatorios(); });
  $("#relAte").addEventListener("change", function(){ ui.rel.ate = this.value; renderRelatorios(); });
  $("#relTipoAtv").addEventListener("change", function(){ ui.rel.tipoAtv = this.value; renderRelAtividades(); });
  $("#btnRelPdf").addEventListener("click", function(){ gerarRelatorio("pdf"); });
  $("#btnRelXlsx").addEventListener("click", function(){ gerarRelatorio("xlsx"); });
  $("#themeToggle").addEventListener("click", function(){ setTimeout(renderRelatorios, 0); });
  if(window.matchMedia){
    var mqTema = window.matchMedia("(prefers-color-scheme: dark)");
    if(mqTema.addEventListener) mqTema.addEventListener("change", function(){ renderRelatorios(); });
  }
  var relResize = null;
  window.addEventListener("resize", function(){
    if(ui.view !== "relatorios") return;
    clearTimeout(relResize); relResize = setTimeout(renderRelatorios, 150);
  });


  /* ---------- usuários do Onvio: relatório "Usuários do cliente" (PDF) ---------- */
  var URL_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var URL_PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  function chaveEmpresaOnvio(nome){
    return normBusca(nome).replace(/[^a-z0-9 ]/g, " ").replace(/\b(ltda|sa|s a|me|epp|eireli|e)\b/g, " ").replace(/\s+/g, " ").trim();
  }
  // Texto do relatório (páginas já em texto corrido, sem o cabeçalho) -> [{empresa, usuarios:[{email, ativo, deptos}]}]
  function onvioParsear(paginas){
    var txt = paginas.join(" ").replace(/\s+/g, " ");
    // E-mails quebrados em duas linhas pelo PDF ("agridrones.com .br", "technort.com. br", "ativa.co m.br"): cola de volta.
    var tk = txt.split(" "), colado = [];
    for(var ti = 0; ti < tk.length; ti++){
      var cur = tk[ti];
      if(cur.indexOf("@") > 0){
        while(ti + 1 < tk.length){
          var f = tk[ti + 1];
          var ok = (/\.$/.test(cur) && /^[a-z]{2,3}(\.[a-z]{2,3})?$/i.test(f)) ||
            (/^\.[a-z]{2,3}(\.[a-z]{2,3})?$/i.test(f)) ||
            (/\.co$/i.test(cur) && /^m(\.br)?$/i.test(f));
          if(!ok) break;
          cur += f; ti++;
        }
      }
      colado.push(cur);
    }
    txt = colado.join(" ");
    var blocos = txt.split(/Cliente:\s*\|?/).slice(1), out = [], porChave = {};
    blocos.forEach(function(b){
      var rx = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, m, marcas = [];
      while((m = rx.exec(b))) marcas.push({email:m[0].toLowerCase(), ini:m.index, fim:m.index + m[0].length});
      var empresa = (marcas.length ? b.slice(0, marcas[0].ini) : b).replace(/[|\s]+$/g, "").replace(/^[|\s]+/g, "").trim();
      if(!empresa) return;
      var k = chaveEmpresaOnvio(empresa), item = porChave[k];
      if(!item){ item = porChave[k] = {empresa:empresa, usuarios:[], vistos:{}}; out.push(item); }
      marcas.forEach(function(mk, i){
        var seg = b.slice(mk.fim, i + 1 < marcas.length ? marcas[i + 1].ini : b.length);
        var depKey = [["contabil", /Cont[áa]bil/], ["fiscal", /Fiscal/], ["pessoal", /Pessoal/]].filter(function(d){ return d[1].test(seg); }).map(function(d){ return d[0]; });
        var u = item.vistos[mk.email];
        if(!u){ u = item.vistos[mk.email] = {email:mk.email, ativo:false, deptos:[], suspeito:/Inativo\s+n[ãa]o\s+excluir/i.test(seg)}; item.usuarios.push(u); }
        if(/(^|[\s|])Ativo(\s|\||$)/.test(seg)) u.ativo = true;
        depKey.forEach(function(d){ if(u.deptos.indexOf(d) === -1) u.deptos.push(d); });
      });
    });
    return out.map(function(x){ return {empresa:x.empresa, usuarios:x.usuarios}; });
  }
  // Compara o relatório com as empresas e os contatos do Portal, sem gravar nada.
  function onvioConferir(grupos){
    var porNome = {};
    state.empresas.forEach(function(e){ (porNome[chaveEmpresaOnvio(e.nome)] = porNome[chaveEmpresaOnvio(e.nome)] || []).push(e); });
    var r = {aplicar:[], jaAtivos:0, semContato:[], semEmpresa:[], inativos:0, usuarios:0, empresasCasadas:0, ausentes:[]};
    var tocados = {};
    grupos.forEach(function(g){
      var emps = porNome[chaveEmpresaOnvio(g.empresa)];
      if(!emps){ r.semEmpresa.push(g.empresa); return; }
      r.empresasCasadas++;
      g.usuarios.forEach(function(u){
        r.usuarios++;
        if(!u.ativo){ r.inativos++; return; }
        var achou = false;
        emps.forEach(function(e){
          state.contatos.filter(function(c){ return c.empresaId === e.id && String(c.email || "").trim().toLowerCase() === u.email; }).forEach(function(c){
            achou = true; tocados[c.id] = true;
            var co = c.cadastroOnvio, igual = co && co.status === "ativo" && (co.deptos || []).slice().sort().join() === u.deptos.slice().sort().join();
            if(igual) r.jaAtivos++; else r.aplicar.push({c:c, empresa:e.nome, deptos:u.deptos.slice(), suspeito:u.suspeito});
          });
        });
        if(!achou) r.semContato.push({empresa:g.empresa, email:u.email});
      });
      emps.forEach(function(e){
        state.contatos.filter(function(c){ return c.empresaId === e.id && !tocados[c.id] && !(c.cadastroOnvio && c.cadastroOnvio.status === "ativo"); })
          .forEach(function(c){ r.ausentes.push({empresa:e.nome, nome:c.nome, email:c.email || ""}); });
      });
    });
    return r;
  }
  var onvioPendente = null;
  function onvioLista(tit, ajuda, itens, linha){
    if(!itens.length) return "";
    var LIM = 200;
    return '<details class="conf-sec"><summary><span class="conf-tit">'+tit+'</span><span class="conf-n">'+itens.length+'</span></summary><p class="conf-ajuda">'+ajuda+'</p><div style="padding:0 20px 14px;font-size:12px;line-height:1.7;color:var(--ink-2)">' +
      itens.slice(0, LIM).map(function(i){ return '<div>'+linha(i)+'</div>'; }).join("") + (itens.length > LIM ? '<div class="note">… e mais '+(itens.length - LIM)+' (todos entram na gravação; a lista mostra só os primeiros).</div>' : '') + '</div></details>';
  }
  function onvioRender(){
    var box = $("#onvioConf"), r = onvioPendente;
    if(!r){ box.innerHTML = ""; return; }
    box.innerHTML = '<div class="import-status" style="margin-top:14px">' +
      '<b>'+r.usuarios+' usuários</b> em '+r.empresasCasadas+' empresas casadas com o Portal. ' +
      '<b>'+r.aplicar.length+'</b> contato(s) passam a ter cadastro ativo' + (r.jaAtivos ? ' · '+r.jaAtivos+' já estavam assim' : '') + (r.inativos ? ' · '+r.inativos+' usuário(s) inativos ignorados' : '') + '.</div>' +
      '<div class="conf-box" style="margin-top:10px;border:1px solid var(--rule)">' +
      onvioLista("Serão marcados com cadastro ativo", "Contatos do Portal encontrados pelo e-mail dentro da empresa.", r.aplicar, function(i){ return esc(i.empresa)+' · '+esc(i.c.nome)+' <span class="note">'+esc(i.c.email||"")+(i.deptos.length ? ' · '+i.deptos.map(function(d){ return SETOR_LABEL[d]; }).join(", ") : '')+(i.suspeito ? ' · nome “Inativo não excluir” no Onvio' : '')+'</span>'; }) +
      onvioLista("Usuários do relatório sem contato no Portal", "Nada é criado: cadastre o contato na empresa e importe de novo.", r.semContato, function(i){ return esc(i.empresa)+' · <span class="note">'+esc(i.email)+'</span>'; }) +
      onvioLista("Empresas do relatório sem correspondência no Portal", "O nome precisa ser igual ao cadastrado (acentos e “Ltda” não contam).", r.semEmpresa.map(function(n){ return {n:n}; }), function(i){ return esc(i.n); }) +
      onvioLista("Contatos do Portal que não aparecem no relatório", "Continuam sem cadastro ativo.", r.ausentes, function(i){ return esc(i.empresa)+' · '+esc(i.nome)+' <span class="note">'+esc(i.email)+'</span>'; }) +
      '</div>' +
      '<div class="import-actions" style="margin-top:12px"><button type="button" class="btn" id="btnOnvioAplicar"'+(r.aplicar.length ? '' : ' disabled')+'>Gravar cadastro ativo em '+r.aplicar.length+' contato(s)</button><button type="button" class="btn-ghost" id="btnOnvioCancelar">Descartar</button></div>';
  }
  function onvioLerPdf(file){
    var box = $("#onvioConf");
    box.innerHTML = '<div class="import-status" style="margin-top:14px">Lendo o PDF…</div>';
    return Promise.all([carregarScript(URL_PDFJS), carregarScript(URL_PDFJS_WORKER)]).then(function(){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL_PDFJS_WORKER;
      return file.arrayBuffer();
    }).then(function(buf){
      return window.pdfjsLib.getDocument({data:buf}).promise;
    }).then(function(doc){
      var paginas = [], seq = Promise.resolve();
      for(var i = 1; i <= doc.numPages; i++){ (function(n){ seq = seq.then(function(){ return doc.getPage(n).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
        var itens = tc.items.map(function(t){ return t.str; }), ix = itens.indexOf("Nome Completo");
        paginas.push(itens.slice(ix + 1).join(" "));
      }); }); })(i); }
      return seq.then(function(){ return paginas; });
    }).then(function(paginas){
      var grupos = onvioParsear(paginas);
      if(!grupos.length) throw new Error("Não encontrei usuários neste PDF. Ele é o relatório “Usuários do cliente” do Onvio?");
      onvioPendente = onvioConferir(grupos);
      onvioRender();
    }).catch(function(e){
      onvioPendente = null;
      box.innerHTML = '<div class="import-status warn" style="margin-top:14px">'+esc(e && e.message || "Não foi possível ler o PDF.")+'</div>';
    });
  }
  $("#fileOnvio").addEventListener("change", function(){
    var f = this.files && this.files[0];
    $("#fileOnvioName").textContent = f ? f.name : "Nenhum arquivo selecionado";
    if(f) onvioLerPdf(f);
  });
  $("#onvioConf").addEventListener("click", function(ev){
    if(ev.target.closest("#btnOnvioCancelar")){ onvioPendente = null; $("#fileOnvio").value = ""; $("#fileOnvioName").textContent = "Nenhum arquivo selecionado"; onvioRender(); return; }
    if(!ev.target.closest("#btnOnvioAplicar") || !onvioPendente || !dbRef) return;
    var alvos = onvioPendente.aplicar, em = hojeISO(), btn = ev.target.closest("#btnOnvioAplicar");
    btn.disabled = true;
    var feitos = 0, falhas = 0;
    var gravar = function(i){
      if(i >= alvos.length) return Promise.resolve();
      var a = alvos[i], patch = {status:"ativo", em:em, deptos:a.deptos};
      return dbRef.collection("contatos").doc(a.c.id).update({cadastroOnvio:patch}).then(function(){ a.c.cadastroOnvio = patch; feitos++; }, function(){ falhas++; }).then(function(){ return gravar(i + 1); });
    };
    gravar(0).then(function(){
      registrarAtividade({tipo:"importacao", texto:"Usuários do Onvio: cadastro ativo em " + feitos + " contato(s)"});
      onvioPendente = null; $("#fileOnvio").value = ""; $("#fileOnvioName").textContent = "Nenhum arquivo selecionado";
      $("#onvioConf").innerHTML = '<div class="import-status '+(falhas ? "warn" : "ok")+'" style="margin-top:14px">Cadastro ativo gravado em '+feitos+' contato(s)'+(falhas ? ' · '+falhas+' falharam, importe de novo para tentar outra vez' : '')+'.</div>';
      renderAll();
    });
  });

  /* ---------- relatórios: geração de arquivos ---------- */
  var URL_H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  var URL_JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var URL_EXCELJS = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  var scriptsCarregando = {};
  function carregarScript(src){
    if(scriptsCarregando[src]) return scriptsCarregando[src];
    scriptsCarregando[src] = new Promise(function(ok, falha){
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function(){ ok(); };
      s.onerror = function(){ delete scriptsCarregando[src]; falha(new Error("um componente do gerador não carregou. Verifique a conexão e tente de novo.")); };
      document.head.appendChild(s);
    });
    return scriptsCarregando[src];
  }
  var FONTES_REL = ['500 12px "Archivo"', '600 12px "Archivo"', '700 12px "Archivo"', '400 12px "IBM Plex Sans"', '500 12px "IBM Plex Sans"', '600 12px "IBM Plex Sans"', '500 12px "IBM Plex Mono"', '600 12px "IBM Plex Mono"'];
  // Também usada no documento clonado pelo html2canvas: sem as fontes carregadas ali, o texto é medido
  // com a fonte substituta e desenhado com a verdadeira, e os espaços entre palavras somem.
  function fontesProntas(doc){
    doc = doc || document;
    if(!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var carregar = Promise.all(FONTES_REL.map(function(f){ return doc.fonts.load(f).catch(function(){}); })).then(function(){ return doc.fonts.ready; });
    return Promise.race([carregar, new Promise(function(ok){ setTimeout(ok, 4000); })]);
  }
  function relStatus(msg, tom){
    var el = $("#relStatus");
    if(!msg){ el.hidden = true; return; }
    el.textContent = msg;
    el.className = "import-status rel-status" + (tom === "warn" ? " warn" : tom === "ok" ? " ok" : "");
    el.hidden = false;
  }
  function atualizarBotoesRel(){
    var bp = $("#btnRelPdf"), bx = $("#btnRelXlsx");
    bp.disabled = bx.disabled = !!ui.relGerando;
    bp.textContent = ui.relGerando === "pdf" ? "Gerando PDF…" : "Gerar PDF";
    bx.textContent = ui.relGerando === "xlsx" ? "Gerando Excel…" : "Gerar Excel";
  }
  function salvarArquivo(nome, blob){
    relStatus("Arquivo pronto. Confirme o download na janela que apareceu.", "ok");
    return downloadsRef.save({filename:nome, data:blob}).then(function(){
      relStatus('“' + nome + '” foi salvo.', "ok");
    }).catch(function(err){
      var code = err && err.code;
      if(code === "declined"){ relStatus("Download cancelado. Gere de novo quando quiser.", ""); return; }
      if(code === "rate_limited"){ relStatus("Já há uma confirmação de download aberta. Conclua-a e gere de novo.", "warn"); return; }
      relStatus("Não foi possível salvar o arquivo (" + (code || "erro desconhecido") + ").", "warn");
    });
  }
  function gerarRelatorio(tipo){
    if(ui.relGerando) return;
    if(!downloadsRef){ relStatus("O download de arquivos não está disponível nesta janela.", "warn"); return; }
    ui.relGerando = tipo; atualizarBotoesRel();
    (tipo === "pdf" ? gerarPdf() : gerarExcel()).catch(function(err){
      console.error(err);
      var msg = (err && err.message) || "erro inesperado";
      relStatus("Não foi possível gerar o relatório: " + msg + (/[.!?]$/.test(msg) ? "" : "."), "warn");
    }).then(function(){
      ui.relGerando = null; atualizarBotoesRel();
      $("#rpStage").innerHTML = "";
    });
  }
  function esperarImagens(el){
    return Promise.all($$("img", el).map(function(im){
      return im.complete ? Promise.resolve() : new Promise(function(ok){ im.onload = im.onerror = function(){ ok(); }; });
    }));
  }
  function pngDe(fn){ var c = document.createElement("canvas"); var res = fn(c); res.url = c.toDataURL("image/png"); return res; }

  function montarPaginasPdf(m){
    var pal = PALETA_CLARA, W = 706, ESC = 2, f = m.filtros, k = m.kpis;
    var img = function(res){ return '<img class="rp-img" src="' + res.url + '" alt="">'; };
    var sec = function(t, cnt){ return '<div class="rp-sec">' + t + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</div>'; };
    var gVol = pngDe(function(c){ return graficoColunas(c, Object.assign({w:W, h:230, escala:ESC, pal:pal}, dadosVolume(m, pal))); });
    var gPer = pngDe(function(c){ return graficoBarras(c, Object.assign({w:W, escala:ESC, pal:pal, largFim:48, largRotulo:230}, dadosEtapasPeriodo(m, pal))); });
    var gSit = pngDe(function(c){ return graficoBarras(c, Object.assign({w:W, escala:ESC, pal:pal, largFim:140, largRotulo:230}, dadosSituacao(m, pal))); });
    var mast = '<div class="rp-mast"><div><div class="wordmark"><span class="wm-control">Control</span><span class="wm-tax">Tax</span></div><div class="brand-tag"><span><i></i>Portal do Cliente · Onvio</span></div></div>' +
      '<div class="rp-mast-r"><div class="t1">Relatório de implantação</div><div class="t2">Emitido em ' + dataHoraBR(new Date()) + '</div></div></div>';
    var paginas = [];
    var pagina = function(corpo){
      paginas.push('<div class="rp-page">' + mast + '<div class="rp-body">' + corpo + '</div><div class="rp-foot"><span>ControlTax · Relatório de implantação do Portal do Cliente</span><span class="pg">Página {{PAG}}</span></div></div>');
    };
    var meta = '<div class="rp-meta"><span><b>Período</b>' + f.periodo + '</span><span><b>Setor</b>' + esc(f.setor) + '</span><span><b>Escopo</b>' + esc(f.escopo) + '</span><span><b>Agrupamento</b>por ' + f.modo + '</span></div>';

    pagina('<div class="rp-title">Progresso da implantação do Portal do Cliente</div>' + meta +
      '<div class="hero-band rel-hero">' + relHeroHTML(m, true) + '</div>' +
      '<div class="rel-kpis">' + relKpisHTML(m) + '</div>' +
      sec("Volume de etapas concluídas", "por " + f.modo) + img(gVol) +
      sec("Concluídas no período, por etapa") + img(gPer));

    pagina(sec("Situação de cada etapa", fmtNum(k.frentes) + " frentes") + img(gSit) +
      sec("Volume por etapa e setor") + tabelaEtapasHTML(m) +
      sec("Resumo por setor") + '<div>' + relSetoresHTML(m) + '</div>' +
      '<p class="rp-nota">Frente é uma empresa em um setor com demanda. “No período” conta as etapas cuja data de conclusão cai dentro do período do relatório. O progresso de uma frente é a fração das suas etapas aplicáveis já concluídas.</p>');

    var imp = m.impedimentos.slice(0, 6);
    pagina(sec("Analistas", fmtNum(m.analistas.length)) + relAnalistasHTML(m, 16) +
      sec("Treinamento") + '<div>' + relTreinoHTML(m) + '</div>' +
      sec("Impedimentos ativos", fmtNum(m.impedimentos.length)) +
      (imp.length
        ? '<table class="rel-table"><thead><tr><th>Escopo</th><th>Empresa ou pessoa</th><th>Descrição</th></tr></thead><tbody>' + imp.map(function(i){
            return '<tr><td>' + esc(i.escopo) + (i.setor ? ' · ' + esc(i.setor) : '') + '</td><td><strong>' + esc(cortar(i.alvo, 44)) + '</strong></td><td>' + esc(cortar(i.desc || "Sem descrição", 110)) + '</td></tr>';
          }).join("") + '</tbody></table>' + (m.impedimentos.length > imp.length ? '<p class="rp-nota">E mais ' + (m.impedimentos.length - imp.length) + '. A lista completa está no Excel.</p>' : '')
        : '<p class="rp-nota">Nenhum impedimento ativo no escopo.</p>'));

    var POR_PAG_EMP = 22;
    var sw = function(cor){ return '<i style="display:inline-block; width:9px; height:8px; border-radius:1px; background:' + cor + '; margin:0 4px 0 8px;"></i>'; };
    var legendaTrilha = '<p class="rp-nota">Cada quadrado é uma etapa, nesta ordem: ' + ETAPAS.map(function(e){ return e.label; }).join(" · ") + '.' +
      sw("var(--status-green)") + 'concluída' + sw("var(--st-and)") + 'em andamento' + sw("var(--st-pend)") + 'pendente</p>';
    for(var i = 0; i < m.listaEmp.length; i += POR_PAG_EMP){
      var bloco = m.listaEmp.slice(i, i + POR_PAG_EMP);
      pagina(sec("Empresas" + (i ? " (continuação)" : ""), (i + 1) + "–" + (i + bloco.length) + " de " + fmtNum(m.listaEmp.length)) + (i === 0 ? legendaTrilha : '') + tabelaEmpresasHTML(m, bloco));
    }

    var POR_PAG_ATV = 22, LIMITE_ATV = 220;
    var evs = m.evsPer.slice(0, LIMITE_ATV);
    if(!evs.length) pagina(sec("Registro de atividades", "0") + '<p class="rp-nota">Nenhuma atividade registrada no período.</p>');
    for(var j = 0; j < evs.length; j += POR_PAG_ATV){
      var blocoA = evs.slice(j, j + POR_PAG_ATV);
      var ultima = j + POR_PAG_ATV >= evs.length;
      pagina(sec("Registro de atividades" + (j ? " (continuação)" : ""), (j + 1) + "–" + (j + blocoA.length) + " de " + fmtNum(m.evsPer.length)) + tabelaAtividadesHTML(blocoA) +
        (ultima && m.evsPer.length > LIMITE_ATV ? '<p class="rp-nota">O PDF traz as ' + LIMITE_ATV + ' atividades mais recentes. O registro completo está no Excel.</p>' : ''));
    }
    return paginas;
  }

  async function gerarPdf(){
    relStatus("Carregando o gerador de PDF…", "ok");
    await Promise.all([carregarScript(URL_H2C), carregarScript(URL_JSPDF)]);
    await fontesProntas();
    var m = relModel();
    nomesPessoas = await nomesDe(m.evsPer.map(function(e){ return e.por; }));
    var paginas = montarPaginasPdf(m);
    var stage = $("#rpStage");
    var pdf = new window.jspdf.jsPDF({unit:"pt", format:"a4", orientation:"portrait", compress:true});
    // Várias páginas por captura (cada captura clona o documento inteiro); depois o canvas é fatiado.
    var LOTE = 6, total = paginas.length;
    for(var i = 0; i < total; i += LOTE){
      var lote = paginas.slice(i, i + LOTE);
      relStatus("Montando o PDF: páginas " + (i + 1) + " a " + (i + lote.length) + " de " + total + "…", "ok");
      stage.innerHTML = lote.map(function(p, j){ return p.replace("{{PAG}}", (i + j + 1) + " de " + total); }).join("");
      await esperarImagens(stage);
      var cv = await window.html2canvas(stage, {
        scale:1.6, backgroundColor:"#FFFFFF", logging:false, windowWidth:1280,
        ignoreElements:function(el){ return !!(el.classList && el.classList.contains("view")); },
        onclone:function(doc){ return fontesProntas(doc); }
      });
      var altPag = cv.height / lote.length;
      for(var j = 0; j < lote.length; j++){
        var fatia = document.createElement("canvas");
        fatia.width = cv.width; fatia.height = Math.round(altPag);
        fatia.getContext("2d").drawImage(cv, 0, Math.round(j * altPag), cv.width, Math.round(altPag), 0, 0, cv.width, Math.round(altPag));
        if(i + j > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(fatia.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 595.28, 841.89, undefined, "FAST");
      }
    }
    stage.innerHTML = "";
    pdf.setProperties({title:"Relatório de implantação · Portal do Cliente ControlTax", subject:"Período " + m.filtros.periodo, creator:"Painel de implantação ControlTax"});
    await salvarArquivo("relatorio-implantacao-" + diaLocal(new Date()) + ".pdf", pdf.output("blob"));
  }

  async function gerarExcel(){
    relStatus("Carregando o gerador de Excel…", "ok");
    await carregarScript(URL_EXCELJS);
    await fontesProntas();
    relStatus("Montando a planilha…", "ok");
    var m = relModel(), k = m.kpis;
    var wb = new window.ExcelJS.Workbook();
    wb.creator = "Painel de implantação ControlTax";
    wb.created = new Date();
    var C = {dark:"FF0E151B", red:"FFC2000C", control:"FFE11520", tax:"FF7FC2DE", mast2:"FF8FA0AD", ink:"FF101820", ink2:"FF47545F", ink3:"FF78868F", rule:"FFDCE3E9", ruleStrong:"FFC2CCD5", s2:"FFF5F8FA", s3:"FFEAEFF3", green:"FF167A45", gray:"FF78868F", blue:"FF3C659B", white:"FFFFFFFF", pessoal:"FF9A6B00", contabil:"FF0F7A55", fiscal:"FF6A4FA0"};
    var FONTE = "Arial";
    var preench = function(c){ return {type:"pattern", pattern:"solid", fgColor:{argb:c}}; };
    var fonte = function(o){ return Object.assign({name:FONTE, size:10, color:{argb:C.ink}}, o || {}); };
    var marca = function(tam, sub){
      return {richText:[
        {text:"Control", font:fonte({size:tam, bold:true, color:{argb:C.control}})},
        {text:"Tax", font:fonte({size:tam, bold:true, color:{argb:C.tax}})},
        {text:"    " + sub, font:fonte({size:Math.max(9, tam - 8), color:{argb:C.mast2}})}
      ]};
    };
    var misturar = function(a, b, t){
      var out = "";
      for(var i = 0; i < 3; i++){
        var x = parseInt(a.substr(2 + i * 2, 2), 16), y = parseInt(b.substr(2 + i * 2, 2), 16);
        out += ("0" + Math.round(x + (y - x) * t).toString(16)).slice(-2);
      }
      return "FF" + out.toUpperCase();
    };
    var bordaBranca = {style:"thin", color:{argb:C.white}};
    var pintarStatus = function(cell, st){
      cell.border = {top:bordaBranca, bottom:bordaBranca, left:bordaBranca, right:bordaBranca};
      cell.alignment = {horizontal:"center", vertical:"middle"};
      if(!st || !STATUS_LABEL[st]){ cell.value = "n/a"; cell.fill = preench(C.s2); cell.font = fonte({size:9, color:{argb:C.ink3}}); return; }
      cell.value = STATUS_LABEL[st];
      cell.fill = preench(st === "concluido" ? C.green : st === "andamento" ? "FF5B6873" : st === "agendado" ? C.blue : "FFE9EEF2");
      cell.font = fonte({size:9, bold:true, color:{argb:st === "pendente" ? "FF3F4B55" : C.white}});
    };
    var pintarPct = function(cell, p){
      p = Math.max(0, Math.min(1, p || 0));
      cell.value = p; cell.numFmt = "0%";
      cell.fill = preench(misturar(C.s3, C.green, p));
      cell.font = fonte({bold:true, color:{argb:p > 0.55 ? C.white : C.ink2}});
      cell.alignment = {horizontal:"center", vertical:"middle"};
    };
    var dataX = function(ds){ var d = parseDia(ds); return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null; };
    var corSetor = function(label){ var s = SETORES.find(function(x){ return x.label === label; }); return s ? C[s.key] : C.ink; };

    var planilha = function(nome, titulo, cols, linhas, estilizar){
      var ws = wb.addWorksheet(nome, {views:[{state:"frozen", ySplit:3, showGridLines:false}]});
      ws.columns = cols.map(function(c){ return {width:c.w}; });
      ws.mergeCells(1, 1, 1, cols.length);
      var t = ws.getCell(1, 1);
      t.value = marca(14, titulo + "  ·  " + m.filtros.periodo);
      t.fill = preench(C.dark); t.alignment = {vertical:"middle", indent:1};
      ws.getRow(1).height = 30;
      ws.mergeCells(2, 1, 2, cols.length);
      ws.getCell(2, 1).fill = preench(C.red);
      ws.getRow(2).height = 4;
      var cab = ws.getRow(3);
      cab.height = 30;
      cols.forEach(function(c, i){
        var cell = cab.getCell(i + 1);
        cell.value = c.h;
        cell.font = fonte({size:9, bold:true, color:{argb:C.ink2}});
        cell.fill = preench(C.s2);
        cell.border = {bottom:{style:"medium", color:{argb:C.ruleStrong}}};
        cell.alignment = {vertical:"middle", horizontal:c.num ? "right" : "left", wrapText:true};
      });
      var temQuebra = cols.some(function(c){ return c.wrap; });
      linhas.forEach(function(vals, li){
        var row = ws.getRow(4 + li);
        if(!temQuebra) row.height = 19;
        vals.forEach(function(v, i){
          var c = cols[i], cell = row.getCell(i + 1);
          cell.value = v === undefined || v === null ? "" : v;
          cell.font = fonte();
          cell.border = {bottom:{style:"thin", color:{argb:C.rule}}};
          cell.alignment = {vertical:"middle", horizontal:c.num ? "right" : "left", wrapText:!!c.wrap};
          if(c.fmt) cell.numFmt = c.fmt;
        });
        if(estilizar) estilizar(row, vals, li);
      });
      if(linhas.length) ws.autoFilter = {from:{row:3, column:1}, to:{row:3 + linhas.length, column:cols.length}};
      return ws;
    };

    // Resumo: painel com números e gráficos
    var wr = wb.addWorksheet("Resumo", {views:[{showGridLines:false}], properties:{tabColor:{argb:C.red}},
      pageSetup:{paperSize:9, orientation:"portrait", fitToPage:true, fitToWidth:1, fitToHeight:0}});
    var colsR = [{width:2}];
    for(var ci = 0; ci < 12; ci++) colsR.push({width:14});
    colsR.push({width:2});
    wr.columns = colsR;
    wr.mergeCells("B1:M3");
    var tt = wr.getCell("B1");
    tt.value = marca(22, "Relatório de implantação · Portal do Cliente");
    tt.fill = preench(C.dark); tt.alignment = {vertical:"middle", indent:1};
    [1, 2, 3].forEach(function(r){ wr.getRow(r).height = 18; });
    wr.mergeCells("B4:M4");
    wr.getCell("B4").fill = preench(C.red);
    wr.getRow(4).height = 4;
    [["Período", m.filtros.periodo, 2], ["Setor", m.filtros.setor, 5], ["Escopo", m.filtros.escopo, 8], ["Emitido em", dataHoraBR(new Date()), 11]].forEach(function(x){
      wr.mergeCells(6, x[2], 6, x[2] + 2); wr.mergeCells(7, x[2], 7, x[2] + 2);
      var a = wr.getCell(6, x[2]); a.value = x[0].toUpperCase(); a.font = fonte({size:8, bold:true, color:{argb:C.ink3}});
      var b = wr.getCell(7, x[2]); b.value = x[1]; b.font = fonte({size:11, bold:true});
    });
    var frac = function(a, b){ return fmtNum(a) + " / " + fmtNum(b); };
    var tiles = [
      ["Progresso geral", fmtPct(k.progGeral), "média das frentes", C.green],
      ["Etapas concluídas no período", fmtNum(k.etapasPeriodo), "pela data de conclusão", C.green],
      ["Atividades no período", fmtNum(k.atividadesPeriodo), "registro unificado", C.blue],
      ["Contatos treinados no período", fmtNum(k.contTreinadosPeriodo), "pessoas que concluíram o treinamento", C.blue],
      ["Impedimentos ativos", fmtNum(k.impedimentos), "no escopo do relatório", k.impedimentos ? C.red : C.ruleStrong, k.impedimentos ? C.red : null],
      ["Frentes", fmtNum(k.frentes), fmtNum(k.empresas) + " empresas", C.ruleStrong],
      ["Etapas concluídas", frac(k.etapasConc, k.etapasAplic), fmtPct(razao(k.etapasConc, k.etapasAplic)) + " das aplicáveis", C.green],
      ["Frentes 100% concluídas", frac(k.frentesCompletas, k.frentes), fmtPct(razao(k.frentesCompletas, k.frentes)) + " das frentes", C.green],
      ["Empresas 100% implantadas", frac(k.empresasCompletas, k.empresas), fmtPct(razao(k.empresasCompletas, k.empresas)) + " das empresas", C.green],
      ["Contatos treinados", frac(k.contTreinados, k.contatos), fmtPct(razao(k.contTreinados, k.contatos)) + " dos contatos", C.blue],
      ["Equipe treinada", frac(k.funcTreinados, k.funcs), fmtPct(razao(k.funcTreinados, k.funcs)) + " da equipe", C.blue]
    ];
    tiles.forEach(function(t, i){
      var col = 2 + (i % 6) * 2, row = 9 + Math.floor(i / 6) * 5;
      wr.mergeCells(row, col, row, col + 1);
      wr.mergeCells(row + 1, col, row + 2, col + 1);
      wr.mergeCells(row + 3, col, row + 3, col + 1);
      for(var rr = row; rr <= row + 3; rr++){
        for(var cc = col; cc <= col + 1; cc++){
          var cel = wr.getCell(rr, cc), borda = {};
          cel.fill = preench(C.s2);
          if(rr === row) borda.top = {style:"thick", color:{argb:t[3]}};
          if(cc === col + 1) borda.right = {style:"thick", color:{argb:C.white}};
          cel.border = borda;
        }
      }
      var a = wr.getCell(row, col); a.value = t[0].toUpperCase(); a.font = fonte({size:8, bold:true, color:{argb:C.ink3}}); a.alignment = {vertical:"bottom", indent:1};
      var b = wr.getCell(row + 1, col); b.value = t[1]; b.font = fonte({size:18, bold:true, color:{argb:t[4] || C.ink}}); b.alignment = {vertical:"middle", indent:1};
      var s = wr.getCell(row + 3, col); s.value = t[2]; s.font = fonte({size:8, color:{argb:C.ink3}}); s.alignment = {vertical:"top", indent:1};
      wr.getRow(row).height = 22;
    });
    var linhaR = 20, LARG = 1180, palX = PALETA_CLARA;
    var secao = function(titulo, sub){
      wr.mergeCells(linhaR, 2, linhaR, 13);
      var c = wr.getCell(linhaR, 2);
      c.value = {richText:[{text:titulo.toUpperCase(), font:fonte({size:10, bold:true})}, {text:sub ? "    " + sub : "", font:fonte({size:9, color:{argb:C.ink3}})}]};
      c.border = {bottom:{style:"thin", color:{argb:C.ruleStrong}}};
      c.alignment = {vertical:"bottom"};
      wr.getRow(linhaR).height = 24;
      linhaR += 2;
    };
    var imagem = function(res){
      var id = wb.addImage({base64:res.url, extension:"png"});
      var alt = Math.round(res.h * LARG / res.w);
      wr.addImage(id, {tl:{col:1, row:linhaR - 1}, ext:{width:LARG, height:alt}});
      linhaR += Math.ceil(alt / 20) + 1;
    };
    secao("Volume de etapas concluídas", "por " + m.filtros.modo + ", pela data de conclusão");
    imagem(pngDe(function(c){ return graficoColunas(c, Object.assign({w:LARG, h:300, escala:2, pal:palX}, dadosVolume(m, palX))); }));
    secao("Concluídas no período, por etapa");
    imagem(pngDe(function(c){ return graficoBarras(c, Object.assign({w:LARG, escala:2, pal:palX, largFim:60, largRotulo:260}, dadosEtapasPeriodo(m, palX))); }));
    secao("Situação de cada etapa", fmtNum(k.frentes) + " frentes");
    imagem(pngDe(function(c){ return graficoBarras(c, Object.assign({w:LARG, escala:2, pal:palX, largFim:160, largRotulo:260}, dadosSituacao(m, palX))); }));

    // Etapas por setor
    var linhasEt = [];
    m.setoresSel.forEach(function(s){
      m.etapas.forEach(function(o){
        var ps = o.porSetor[s.key];
        if(ps && ps.aplic) linhasEt.push([s.label, o.label, ps.aplic, ps.concluido, ps.andamento, ps.agendado || 0, ps.pendente, razao(ps.concluido, ps.aplic), ps.periodo]);
      });
    });
    if(m.setoresSel.length > 1) m.etapas.forEach(function(o){
      if(o.aplic) linhasEt.push(["Todos os setores", o.label, o.aplic, o.concluido, o.andamento, o.agendado || 0, o.pendente, razao(o.concluido, o.aplic), o.periodo]);
    });
    planilha("Etapas", "Volume por etapa e setor", [
      {h:"Setor", w:18}, {h:"Etapa", w:34}, {h:"Frentes aplicáveis", w:14, num:true}, {h:"Concluído", w:12, num:true},
      {h:"Em andamento", w:14, num:true}, {h:"Agendado", w:12, num:true}, {h:"Pendente", w:12, num:true}, {h:"% concluído", w:13, num:true}, {h:"Concluídas no período", w:16, num:true}
    ], linhasEt, function(row, vals){
      row.getCell(1).font = fonte({bold:true, color:{argb:corSetor(vals[0])}});
      pintarPct(row.getCell(8), vals[7]);
    });

    // Volume no tempo
    var colsV = [{h:"Período", w:26}, {h:"Início", w:12, fmt:"dd/mm/yyyy"}, {h:"Fim", w:12, fmt:"dd/mm/yyyy"}]
      .concat(m.setoresSel.map(function(s){ return {h:"Etapas · " + s.label, w:15, num:true}; }))
      .concat([{h:"Total de etapas", w:14, num:true}, {h:"Contatos cadastrados", w:16, num:true}, {h:"Atividades registradas", w:17, num:true}]);
    var somaV = m.setoresSel.map(function(){ return 0; }), somaTot = 0, somaCont = 0, somaAtv = 0;
    var linhasV = m.buckets.map(function(b){
      var tot = 0;
      var vs = m.setoresSel.map(function(s, i){ tot += b.etapas[s.key]; somaV[i] += b.etapas[s.key]; return b.etapas[s.key]; });
      somaTot += tot; somaCont += b.contatos; somaAtv += b.atividades;
      return [b.titulo, dataX(b.iniS), dataX(b.fimS)].concat(vs).concat([tot, b.contatos, b.atividades]);
    });
    linhasV.push(["Total do período", dataX(m.iniS), dataX(m.fimS)].concat(somaV).concat([somaTot, somaCont, somaAtv]));
    planilha("Volume no tempo", "Volume por " + m.filtros.modo, colsV, linhasV, function(row, vals, li){
      if(li === linhasV.length - 1) row.eachCell(function(c){ c.font = fonte({bold:true}); c.fill = preench(C.s2); });
    });

    // Setores
    planilha("Setores", "Resumo por setor", [
      {h:"Setor", w:14}, {h:"Frentes", w:10, num:true}, {h:"Progresso médio", w:13, num:true}, {h:"Frentes 100%", w:12, num:true},
      {h:"Etapas concluídas", w:13, num:true}, {h:"Etapas aplicáveis", w:13, num:true}, {h:"Concluídas no período", w:15, num:true},
      {h:"Contatos", w:10, num:true}, {h:"Contatos treinados", w:14, num:true},
      {h:"Alinhamento com o gestor", w:18}, {h:"Frentes com impedimento", w:16, num:true}
    ], m.setoresRes.map(function(s){
      return [s.setor.label, s.frentes, s.prog, s.completas, s.conc, s.aplic, s.periodo, s.contatos, s.contTreinados, s.alinhamento, s.impedimentos];
    }), function(row, vals){
      row.getCell(1).font = fonte({bold:true, color:{argb:corSetor(vals[0])}});
      pintarPct(row.getCell(3), vals[2]);
      pintarStatus(row.getCell(10), vals[9]);
    });

    // Analistas
    planilha("Analistas", "Etapas por analista responsável", [
      {h:"Analista", w:30}, {h:"Setores", w:22}, {h:"Frentes", w:10, num:true}, {h:"Progresso médio", w:13, num:true},
      {h:"Etapas concluídas", w:13, num:true}, {h:"Etapas aplicáveis", w:13, num:true}, {h:"Concluídas no período", w:15, num:true}
    ], m.analistas.map(function(a){
      return [a.nome, a.setoresLista.map(function(s){ return s.label; }).join(", "), a.frentes, a.prog, a.conc, a.aplic, a.periodo];
    }), function(row, vals, li){
      pintarPct(row.getCell(4), vals[3]);
      if(m.analistas[li].semNome) row.getCell(1).font = fonte({italic:true, color:{argb:C.ink3}});
    });

    // Empresas × setor
    var nEt = ETAPAS.length;
    var colsE = [{h:"Empresa", w:42}, {h:"CNPJ", w:20}, {h:"Setor", w:11}, {h:"Analista", w:24}]
      .concat(ETAPAS.map(function(et){ return {h:et.label, w:17}; }))
      .concat([{h:"Progresso", w:11, num:true}, {h:"Concluídas no período", w:14, num:true}, {h:"Impedimento", w:32}, {h:"Em foco", w:9}, {h:"Filiais (CNPJs)", w:36}]);
    var linhasE = [];
    m.listaEmp.forEach(function(o){
      o.frentes.forEach(function(fr){
        var d = fr.doc || {};
        linhasE.push([o.empresa.nome, o.empresa.cnpj || "", fr.setor.label, d.analistaNome || ""]
          .concat(ETAPAS.map(function(et){ return (et.onlyIf && !et.onlyIf(fr.empresa, fr.setor.key)) ? "n/a" : statusDe(fr.doc, et.key, fr.empresa.id, fr.setor.key); }))
          .concat([fr.prog, fr.periodo, (d.impedimento && d.impedimento.ativo) ? (d.impedimento.descricao || "Sim") : "", o.empresa.emFoco ? "Sim" : "", filiaisDe(o.empresa.id).map(function(f){ return f.cnpj || f.nome; }).join(", ")]));
      });
    });
    planilha("Empresas", "Situação por empresa e setor", colsE, linhasE, function(row, vals){
      row.getCell(3).font = fonte({bold:true, color:{argb:corSetor(vals[2])}});
      for(var i = 0; i < nEt; i++) pintarStatus(row.getCell(5 + i), vals[4 + i] === "n/a" ? null : vals[4 + i]);
      pintarPct(row.getCell(5 + nEt), vals[4 + nEt]);
    });

    // Registro de atividades
    var quemX = await nomesDe(m.evsPer.map(function(e){ return e.por; }));
    planilha("Atividades", "Registro unificado de atividades", [
      {h:"Data", w:12, fmt:"dd/mm/yyyy"}, {h:"Hora", w:8}, {h:"Tipo", w:16}, {h:"Empresa", w:38}, {h:"Setor", w:11},
      {h:"Atividade", w:50}, {h:"Situação anterior", w:15}, {h:"Nova situação", w:15}, {h:"Quem", w:24}, {h:"Origem", w:26}
    ], m.evsPer.map(function(e){
      var d = descEvento(e);
      return [dataX(e.dia), e.em ? horaDeISO(e.em) : "", TIPOS_ATV[e.tipo] || e.tipo, e.empresaNome || "", e.setor ? (SETOR_LABEL[e.setor] || e.setor) : "",
        d.txt, d.de && STATUS_LABEL[d.de] ? d.de : "", d.para && STATUS_LABEL[d.para] ? d.para : "",
        e.por ? (quemX[e.por] || "Alguém") : "",
        e.origem === "derivado" ? "Data de conclusão da etapa" : "Registro do painel"];
    }), function(row, vals){
      if(vals[6]) pintarStatus(row.getCell(7), vals[6]);
      if(vals[7]) pintarStatus(row.getCell(8), vals[7]);
    });

    // Contatos
    planilha("Contatos", "Contatos de clientes", [
      {h:"Empresa", w:38}, {h:"Nome", w:28}, {h:"E-mail", w:34}, {h:"Setores", w:22}, {h:"Treinamento", w:15},
      {h:"Agendado para", w:13, fmt:"dd/mm/yyyy"}, {h:"Sócio", w:8}, {h:"Cadastrado em", w:14, fmt:"dd/mm/yyyy"}
    ], m.contatos.slice().sort(function(a, b){ return (a.empresaNome || "").localeCompare(b.empresaNome || "", "pt-BR") || (a.nome || "").localeCompare(b.nome || "", "pt-BR"); }).map(function(c){
      return [c.empresaNome || "", c.nome || "", c.email || "", (c.setores || []).map(function(s){ return SETOR_LABEL[s] || s; }).join(", "),
        c.statusTreinamento || "pendente", c.statusTreinamento === "agendado" ? dataX(c.agendadoPara) : null, c.socio ? "Sim" : "", dataX(diaDeISO(c.criadoEm))];
    }), function(row, vals){ pintarStatus(row.getCell(5), vals[4]); });

    // Equipe
    planilha("Equipe", "Equipe do escritório", [
      {h:"Nome", w:30}, {h:"Setor", w:12}, {h:"Cargo", w:18}, {h:"Treinamento", w:15}, {h:"Impedimento", w:44}
    ], m.funcs.slice().sort(function(a, b){ return (a.nome || "").localeCompare(b.nome || "", "pt-BR"); }).map(function(f){
      return [f.nome || "", SETOR_LABEL[f.setor] || f.setor || "", f.cargo || "", f.statusTreinamento || "pendente", (f.impedimento && f.impedimento.ativo) ? (f.impedimento.descricao || "Sim") : ""];
    }), function(row, vals){ pintarStatus(row.getCell(4), vals[3]); });

    // Impedimentos
    planilha("Impedimentos", "Impedimentos ativos", [
      {h:"Escopo", w:12}, {h:"Empresa ou pessoa", w:40}, {h:"Setor", w:12}, {h:"Descrição", w:70, wrap:true}
    ], m.impedimentos.map(function(i){ return [i.escopo, i.alvo, i.setor, i.desc || "Sem descrição"]; }));

    relStatus("Gerando o arquivo…", "ok");
    var buf = await wb.xlsx.writeBuffer();
    await salvarArquivo("relatorio-implantacao-" + diaLocal(new Date()) + ".xlsx", new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  }

  /* ---------- boot ---------- */
  restaurarUI();
  setView(ui.view);
  renderAll();

  // Cada coleção chega do banco separada; em vez de redesenhar a tela a cada uma, junta tudo o que
  // chegar em ~80 ms num redesenho só, e só desenha quando empresas, frentes e contatos já chegaram.
  var tSnap = null, doCache = false, chegouDoBanco = {};
  function agendarRenderSnapshot(){
    if(tSnap) return;
    tSnap = setTimeout(function(){
      tSnap = null;
      if(carregando() && !doCache) return;
      renderAll();
      salvarCacheLocal();
    }, 80);
  }
  function sub(name, key, after){
    try{
      dbRef.collection(name).onSnapshot(function(snap){
        definirDados(key, snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
        chegouDoBanco[key] = true;
        if(faltaCarregar[name]){ delete faltaCarregar[name]; if(!carregando()){ $("#carregandoAviso").hidden = true; doCache = false; } }
        else if(chegouDoBanco.empresas && chegouDoBanco.setores && chegouDoBanco.contatos) $("#carregandoAviso").hidden = true;
        if(after){ try{ after(); }catch(e){ console.error(e); } }
        agendarRenderSnapshot();
      }, function(err){ console.error("db "+name, err); falhaAoCarregar(); });
    }catch(e){ console.error("db "+name, e); falhaAoCarregar(); }
  }
  // Nunca deixa o "Carregando…" girando para sempre: se algo falhar ou demorar demais, avisa.
  function falhaAoCarregar(){
    if(!carregando()) return;
    var av = $("#carregandoAviso");
    if(av){ av.hidden = false; av.lastChild.textContent = "Não foi possível carregar tudo do banco. Recarregue a página; se continuar, me avise."; }
    faltaCarregar = {}; doCache = false; renderAll();
  }
  setTimeout(function(){ if(carregando()) falhaAoCarregar(); }, 30000);

  /* ---------- cópia local dos dados (só neste navegador) ---------- */
  // Ao abrir, mostra na hora a última cópia salva aqui e troca pelos dados do banco assim que chegam.
  var CHAVES_CACHE = ["empresas", "setores", "funcionarios", "contatos", "alinhamentoSetor", "auditoriaDominio", "historico"];
  function abrirCacheLocal(){
    return new Promise(function(ok, falha){
      try{
        var r = indexedDB.open("ct-painel-cache", 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore("dados"); };
        r.onsuccess = function(){ ok(r.result); };
        r.onerror = function(){ falha(r.error); };
      }catch(e){ falha(e); }
    });
  }
  var tCache = null;
  function salvarCacheLocal(){
    if(carregando()) return;
    clearTimeout(tCache);
    tCache = setTimeout(function(){
      var copia = {em:Date.now()};
      CHAVES_CACHE.forEach(function(k){ copia[k] = (k in bruto && bruto[k]) || state[k]; });
      abrirCacheLocal().then(function(db){
        try{ db.transaction("dados", "readwrite").objectStore("dados").put(copia, "ultimo"); }catch(e){}
      }).catch(function(){});
    }, 2000);
  }
  function lerCacheLocal(){
    return abrirCacheLocal().then(function(db){
      return new Promise(function(ok){
        try{
          var r = db.transaction("dados", "readonly").objectStore("dados").get("ultimo");
          r.onsuccess = function(){ ok(r.result || null); };
          r.onerror = function(){ ok(null); };
        }catch(e){ ok(null); }
      });
    }).catch(function(){ return null; });
  }
  lerCacheLocal().then(function(c){
    // Só usa a cópia se o banco ainda não respondeu e se ela tem até 14 dias.
    if(!c || !carregando() || Date.now() - c.em > 14 * 864e5) return;
    CHAVES_CACHE.forEach(function(k){ if(Array.isArray(c[k]) && !chegouDoBanco[k]) definirDados(k, c[k]); });
    doCache = true;
    var av = $("#carregandoAviso");
    if(av){ av.hidden = false; av.lastChild.textContent = "Mostrando a última cópia salva neste navegador; atualizando com o banco…"; }
    renderAll();
  });

  // Aberto dentro do Control Hub (iframe), usa a conexão da página principal: é ela que tem o banco liberado.
  // O banco da página principal só aceita objetos criados lá: cada objeto enviado (set, update, add,
  // filtros) é recriado com o JSON da página principal antes de seguir.
  function bancoDoPai(db){
    var P = window.parent;
    var clonar = function(v){ return v && typeof v === "object" ? P.JSON.parse(JSON.stringify(v)) : v; };
    var ehRef = function(r){ return r && typeof r === "object" && typeof r.then !== "function" && (typeof r.onSnapshot === "function" || typeof r.doc === "function"); };
    var envolve = function(t){
      return new Proxy({}, {
        get:function(_, k){
          var v = t[k];
          if(typeof v !== "function") return v;
          return function(){
            var a = Array.prototype.map.call(arguments, function(x){ return typeof x === "function" ? x : clonar(x); });
            var r = v.apply(t, a);
            return ehRef(r) ? envolve(r) : r;
          };
        },
        has:function(_, k){ return k in t; }
      });
    };
    return envolve(db);
  }
  // Downloads pela página principal: ela também só reconhece dados criados lá. Um Blob ou ArrayBuffer
  // criado aqui no quadro chegava como "dados inválidos" (bad_request); os bytes são copiados para um
  // Blob da página principal antes de salvar.
  function downloadsDoPai(d){
    var P = window.parent;
    var bytes = function(x){
      if(x && typeof x.arrayBuffer === "function") return x.arrayBuffer();
      if(x && x.buffer && typeof x.byteLength === "number") return Promise.resolve(x.buffer.slice(x.byteOffset || 0, (x.byteOffset || 0) + x.byteLength));
      return Promise.resolve(x);
    };
    return { save:function(req){
      req = req || {};
      var pedido = P.JSON.parse(JSON.stringify({filename: String(req.filename || "")}));
      if(typeof req.data === "string"){ pedido.data = req.data; return d.save(pedido); }
      return bytes(req.data).then(function(buf){
        var u = new P.Uint8Array(buf.byteLength);
        u.set(new Uint8Array(buf));
        pedido.data = new P.Blob([u]);
        return d.save(pedido);
      });
    }};
  }
  function usarCap(n){
    try{
      if(window.parent !== window && window.parent.claude && window.parent.claude.use){
        var p = window.parent.claude.use(n);
        if(n === "downloads") return p.then(function(d){ return d ? downloadsDoPai(d) : d; });
        return n === "db" ? p.then(function(db){ return db ? bancoDoPai(db) : db; }) : p;
      }
    }catch(e){}
    return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null);
  }
  /* ---------- ponte com o assistente do Hub ---------- */
  window.__assistente = {
    modulo: "portal", nome: "Portal do Cliente",
    abas: [["dashboard", "Hoje"], ["progresso", "Consulta"], ["foco", "Foco"], ["impedimentos", "Impedimentos"], ["relatorios", "Relatórios"], ["cadastro", "Cadastro"]],
    pronto: function(){ return !carregando(); },
    exemplo: function(){ return false; },
    empresas: function(){ return state.empresas.filter(function(e){ return e.ativo !== false; }).map(function(e){
      var d = state.setores.filter(function(s){ return s.empresaId === e.id && s.analistaNome; })[0];
      return {id:e.id, nome:e.nome, cnpj:String(e.cnpj || "").replace(/\D/g, ""), analista:d ? d.analistaNome : ""};
    }); },
    analistas: function(){ var m = {}; state.setores.forEach(function(s){ if(s.analistaNome) m[s.analistaNome] = true; }); return Object.keys(m).sort(); },
    irPara: function(v){ if(["dashboard","progresso","foco","impedimentos","relatorios","cadastro"].indexOf(v) === -1) return false; setView(v); return true; },
    abrirEmpresa: function(){ setView("progresso"); return true; },
    consultar: function(tipo, p){
      p = p || {};
      var de = p.de || hojeISO(), ate = p.ate || de, ana = p.analista || "", hoje_ = hojeISO();
      var docsDe = function(id){ return state.setores.filter(function(s){ return s.empresaId === id; }); };
      var daAna = function(empresaId, setores){ return !ana || docsDe(empresaId).some(function(s){ return (!setores || setores.indexOf(s.setor) !== -1) && normBusca(s.analistaNome) === normBusca(ana); }); };
      var dataBR_ = function(k){ return k ? k.slice(8) + "/" + k.slice(5, 7) : ""; };
      if(tipo === "vencimentos"){
        var ls = [];
        state.contatos.forEach(function(c){
          if(c.statusTreinamento === "agendado" && c.agendadoPara && c.agendadoPara >= de && c.agendadoPara <= ate && daAna(c.empresaId, c.setores)) ls.push({t: "Treinamento: " + (c.nome || "contato"), sub: dataBR_(c.agendadoPara) + (c.agendadoHora ? " às " + c.agendadoHora : "") + " · " + (c.empresaNome || ""), data: c.agendadoPara, tom: "", abrir: {aba: "dashboard"}});
        });
        state.setores.forEach(function(sd){
          var inf = etapaInfo(sd, "treinamentoAnalista", sd.empresaId);
          if(inf.status === "agendado" && inf.agendadoPara && inf.agendadoPara >= de && inf.agendadoPara <= ate && (!ana || normBusca(sd.analistaNome) === normBusca(ana))) ls.push({t: "Treinamento do analista (" + SETOR_LABEL[sd.setor] + ")", sub: dataBR_(inf.agendadoPara) + (inf.agendadoHora ? " às " + inf.agendadoHora : "") + " · " + (sd.empresaNome || ""), data: inf.agendadoPara, tom: "", abrir: {aba: "dashboard"}});
        });
        ls.sort(function(a, b){ return a.data < b.data ? -1 : 1; });
        return {titulo: "Agenda do Portal do Cliente", total: ls.length, linhas: ls};
      }
      if(tipo === "atrasos" || tipo === "pendencias"){
        var m = model(), out = [];
        state.contatos.forEach(function(c){ if(agendamentoAtrasado(c) && daAna(c.empresaId, c.setores)) out.push({t: "Treinamento atrasado: " + (c.nome || "contato"), sub: (c.empresaNome || "") + " · era para " + dataBR_(c.agendadoPara), tom: "late", abrir: {aba: "dashboard"}}); });
        m.bloqueios.forEach(function(b){ out.push({t: "Impedimento: " + b.nome, sub: (b.desc || "") + (b.aguardando ? " · aguardando " + b.aguardando : "") + (b.desde ? " · desde " + dataBR_(b.desde) : ""), tom: "warn", abrir: {aba: "impedimentos"}}); });
        return {titulo: "Atrasos e impedimentos no Portal do Cliente", total: out.length, linhas: out};
      }
      if(tipo === "empresa"){
        var e = state.empresas.filter(function(x){ return x.id === p.id; })[0]; if(!e) return null;
        var docs = docsDe(e.id), fr = frentesDaEmpresa(e, docs), l2 = [];
        l2.push({t: "Progresso geral: " + Math.round(progressoEmpresa(e, docs) * 100) + "%", sub: fr.length + " frente(s) em implantação", tom: ""});
        fr.forEach(function(f){ l2.push({t: SETOR_LABEL[f.setor] + ": " + Math.round(progressoSetor(e, f) * 100) + "%", sub: (f.analistaNome || "sem analista") + (f.impedimento && f.impedimento.ativo ? " · impedimento: " + (f.impedimento.descricao || "") : ""), tom: f.impedimento && f.impedimento.ativo ? "warn" : ""}); });
        var cs = state.contatos.filter(function(c){ return c.empresaId === e.id; });
        if(cs.length) l2.push({t: cs.length + " contato(s)", sub: cs.filter(function(c){ return c.statusTreinamento === "concluido"; }).length + " treinado(s)", tom: ""});
        return {titulo: e.nome + " no Portal do Cliente", total: l2.length, linhas: l2, abrirFicha: {empresa: e.id}};
      }
      if(tipo === "carteira"){
        var por = {};
        state.setores.forEach(function(s){ if(!s.analistaNome) return; (por[s.analistaNome] = por[s.analistaNome] || []).push(s); });
        var ks = Object.keys(por).filter(function(a){ return !ana || normBusca(a) === normBusca(ana); });
        return {titulo: "Frentes por analista no Portal do Cliente", total: ks.length, linhas: ks.map(function(a){ return {t: a + ": " + por[a].length + " frente(s)", sub: "", tom: "", dados: {analista: a, frentes: por[a].length}}; })};
      }
      if(tipo === "funil"){
        var cont = {}, nEmp = 0, lsF = [];
        ETAPAS.forEach(function(et){ cont[et.key] = {etapa: et.label, concluido: 0, andamento: 0, agendado: 0, pendente: 0}; });
        state.empresas.filter(function(x){ return x.ativo !== false; }).forEach(function(e2){
          var docs2 = docsDe(e2.id), fr2 = frentesDaEmpresa(e2, docs2); if(!fr2.length) return;
          nEmp++;
          fr2.forEach(function(f){ ETAPAS.forEach(function(et){ var st = "pendente"; try{ st = etapaInfo(f, et.key, e2.id).status || "pendente"; }catch(err){} if(cont[et.key][st] != null) cont[et.key][st]++; }); });
          if(!daAna(e2.id)) return;
          var pr = Math.round(progressoEmpresa(e2, docs2) * 100);
          if(pr < 100) lsF.push({t: e2.nome, sub: pr + "% concluído · " + fr2.map(function(f){ return SETOR_LABEL[f.setor] + (f.analistaNome ? " (" + f.analistaNome + ")" : ""); }).join(", "), tom: pr < 30 ? "late" : "", abrir: {aba: "progresso"}, dados: {progresso: pr}});
        });
        lsF.sort(function(x, y){ return x.dados.progresso - y.dados.progresso; });
        var cts = state.contatos.filter(function(c){ return !c.exemplo; });
        return {titulo: "Implantação do Portal: empresas ainda não concluídas", total: lsF.length, linhas: lsF, resumo: {empresasEmImplantacao: nEmp, etapasPorFrente: ETAPAS.map(function(et){ return cont[et.key]; }), contatos: cts.length, contatosTreinados: cts.filter(function(c){ return c.statusTreinamento === "concluido"; }).length, contatosComUsuarioOnvio: cts.filter(function(c){ return c.cadastroOnvio && c.cadastroOnvio.status === "ativo"; }).length}};
      }
      if(tipo === "semTreinamento"){
        var semT = state.contatos.filter(function(c){ return !c.exemplo && c.statusTreinamento !== "concluido" && daAna(c.empresaId, c.setores); });
        return {titulo: "Contatos de clientes ainda sem treinamento", total: semT.length, linhas: semT.map(function(c){ return {t: c.nome || c.email || "contato", sub: (c.empresaNome || "") + " · " + (STATUS_LABEL[c.statusTreinamento] || "Pendente") + (c.agendadoPara ? " para " + dataBR_(c.agendadoPara) : ""), tom: agendamentoAtrasado(c) ? "late" : "", abrir: {aba: "dashboard"}}; })};
      }
      if(tipo === "onvio"){
        if(!onvioPendente) return {titulo: "Conferência de usuários do Onvio", total: 0, linhas: [], resumo: "Nenhum relatório de usuários do Onvio lido nesta sessão (importe o PDF em Cadastro)."};
        var ov = onvioPendente, lsO = [];
        (ov.aplicar || []).forEach(function(x){ lsO.push({t: "Vai ativar: " + ((x.c && (x.c.nome || x.c.email)) || ""), sub: x.empresa || "", tom: "", abrir: {aba: "cadastro"}}); });
        (ov.semContato || []).forEach(function(x){ lsO.push({t: "Usuário sem contato: " + x.email, sub: x.empresa || "", tom: "warn", abrir: {aba: "cadastro"}}); });
        (ov.ausentes || []).forEach(function(x){ lsO.push({t: "Contato sem usuário no Onvio: " + (x.nome || x.email || ""), sub: x.empresa || "", tom: "warn", abrir: {aba: "cadastro"}}); });
        return {titulo: "Usuários do Onvio para conferir", total: lsO.length, linhas: lsO};
      }
      return null;
    },
    vocab: function(){ return {etapas: ETAPAS.filter(function(et){ return !et.calculada && et.key !== "treinamentoCliente"; }).map(function(et){ return {k: et.key, l: et.label, c: et.curto}; }), obrigacoes: [], setores: Object.keys(SETOR_LABEL)}; },
    // Marca etapa de implantação (habilitação no Domínio ou treinamento do analista). Nada grava até executar().
    acao: function(tipo, p){
      p = p || {};
      if(tipo !== "etapa") return {erro: "No Portal eu só marco etapas de implantação."};
      var e = state.empresas.filter(function(x){ return x.id === p.id; })[0];
      if(!e) return {erro: "Não achei essa empresa no Portal do Cliente."};
      var q = normBusca(p.etapa || "");
      var et = ETAPAS.filter(function(x){ return x.key === p.etapa || normBusca(x.label) === q || normBusca(x.curto) === q || (q && normBusca(x.label).indexOf(q) !== -1); })[0];
      if(!et) return {erro: "Qual etapa? Habilitação no Domínio ou treinamento do analista."};
      if(et.calculada || et.key === "treinamentoCliente") return {erro: et.label + " é calculada pelos contatos: marque o treinamento ou o cadastro de cada contato no Portal."};
      var st = {concluida: "concluido", concluido: "concluido", c: "concluido", em_andamento: "andamento", andamento: "andamento", a: "andamento", pendente: "pendente", "": "pendente"}[p.status == null ? "concluido" : p.status] || "concluido";
      var setor = "";
      if(!et.porEmpresa){
        var sn = normBusca(p.setor || "");
        setor = /pessoal|dp|folha/.test(sn) ? "pessoal" : /contab/.test(sn) ? "contabil" : /fisc/.test(sn) ? "fiscal" : "";
        if(!setor){ var frs = frentesDaEmpresa(e, docsDe(e.id)); if(frs.length === 1) setor = frs[0].setor; }
        if(!setor) return {erro: "De qual setor (Pessoal, Contábil ou Fiscal)?"};
      }
      var doc = setor ? state.setores.filter(function(s){ return s.id === sid(e.id, setor); })[0] : null;
      var antes = et.porEmpresa ? habilitacaoEmpresa(e.id).status : statusDe(doc, et.key, e.id, setor);
      var dataAntes = et.porEmpresa ? (habilitacaoEmpresa(e.id).data || "") : ((doc && doc.etapas && doc.etapas[et.key] && doc.etapas[et.key].data) || "");
      if(antes === st) return {erro: et.label + " já está “" + STATUS_LABEL[st].toLowerCase() + "”."};
      if(et.porEmpresa && habilitacaoEmpresa(e.id).inferida) return {erro: "A habilitação já conta como concluída: a empresa tem contato treinado."};
      return {titulo: "Marcar etapa do Portal", empresa: e.nome, linhas: [et.label + (setor ? " · " + SETOR_LABEL[setor] : "") + ": " + (STATUS_LABEL[antes] || "Pendente") + " → " + STATUS_LABEL[st]], aviso: "",
        executar: function(){ return Promise.resolve().then(function(){ focoSetStatus(e.id, setor, et.key, st, undefined, true); return "Pronto, marcado no Portal."; }); },
        desfazer: function(){ return Promise.resolve().then(function(){ focoSetStatus(e.id, setor, et.key, antes, dataAntes, true); }); }};
    }
  };

  usarCap("db").then(function(db){
    if(!db){ semBanco = true; $("#carregandoAviso").hidden = true; $("#dbWarning").hidden = false; renderAll(); return; }
    try{ dbRef = monitorarGravacoes(db); dbRef.collection("empresas"); }catch(e){ console.error(e); dbRef = db; }
    sub("empresas","empresas"); sub("empresaSetores","setores");
    sub("funcionarios","funcionarios"); sub("contatos","contatos");
    sub("setorAlinhamento","alinhamentoSetor", ensureAlinhamentoDocs);
    sub("auditoriaDominio","auditoriaDominio");
    sub("historico","historico");
  });
  usarCap("user").then(function(u){
    userRef = u;
    if(u) u.id().then(function(id){
      meuId = authP() ? ((authP().usuario() || {}).id || id) : id;
      nomesDe([meuId]).then(function(n){ nomeEu = n[meuId] && n[meuId] !== "Alguém" ? n[meuId] : ""; if(nomeEu && ui.view === "dashboard") renderAgenda(); });
    });
  });
  usarCap("downloads").then(function(d){
    downloadsRef = d;
  });
})();
