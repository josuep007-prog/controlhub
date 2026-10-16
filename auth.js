/* auth.js: login próprio do Control Hub (separado da conta claude.ai), com níveis de acesso por módulo.

   CONTRATO (o que o resto do Hub usa; um servidor de verdade deve oferecer o mesmo):
     __auth.aguardar()        Promise que resolve com o usuário ativo (mostra o login enquanto não houver)
     __auth.usuario()         {id, nome, login, email, admin, niveis:{dp,contabil,fiscal,portal,cardapio}, analista:{dp,contabil,fiscal,portal}}
     __auth.nivel(mod)        "coord" | "analista" | "consulta" | null  (administrador vale "coord" em tudo)
     __auth.podeVer(mod)      nivel(mod) !== null
     __auth.analista(mod)     nome de analista ligado à pessoa naquele módulo ("" se não houver)
     __auth.ehAdmin()         true para administrador
     __auth.sair()  __auth.trocarSenha()  __auth.onMudar(cb)
     __auth.perfis(ids)       Promise {id: {name}} (nomes para autoria)
     __auth.montarUsuarios(el)  desenha a tela de administração de usuários (só administrador)

   BACKEND (único ponto que fala com o armazenamento): ler, gravar, atualizar, apagar, listar, ouvirDoc, ouvirColecao.
   Hoje usa o banco do artefato (claude.use("db")); sem banco, usa o localStorage. Para virar site, troque só este objeto
   por chamadas HTTP: telas e módulos não mudam.

   Dados: auth_usuarios/{id}, auth_logins/{chave do login ou e-mail} -> {id}, auth_log/{AAAA-MM-DD}.
   Senha: PBKDF2-SHA256 (WebCrypto), sal de 16 bytes, 210 mil iterações. Atenção: sem servidor, a conferência acontece no navegador. */
(function () {
  "use strict";
  if (window.__auth) return;
  var doc = document;
  var MODS = ["dp", "contabil", "fiscal", "portal", "cardapio"];
  var MODN = {dp: "Departamento Pessoal", contabil: "Contábil", fiscal: "Fiscal", portal: "Portal do Cliente", cardapio: "Cardápio"};
  var COM_ANALISTA = ["dp", "contabil", "fiscal", "portal"];
  var ROTN = {coord: "Coordenador", analista: "Analista", consulta: "Consulta", "": "Sem acesso"};
  var ITER = 210000, MAX_FALHAS = 5, ESPERA_MS = 5 * 60000, SESSAO_KEY = "ch-sessao", LOCAL_KEY = "ch-auth-local";

  /* ============ utilidades ============ */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function agora() { return Date.now(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function hojeKey() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function rid() { return agora().toString(36) + Math.random().toString(36).slice(2, 8); }
  function novoId() { return (crypto.randomUUID ? crypto.randomUUID() : rid() + rid()); }
  function lerLS(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function apagarLS(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function erro(msg, cod) { var e = new Error(msg); e.amigavel = true; e.cod = cod || ""; return e; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtData(ms) { if (!ms) return "nunca"; var d = new Date(ms); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

  /* ============ criptografia ============ */
  function b64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function temCripto() { return !!(window.crypto && crypto.subtle && crypto.getRandomValues); }
  function hashSenha(senha, salt, iter) {
    if (!temCripto()) return Promise.reject(erro("Este navegador não permite proteger senhas nesta conexão. Abra o Hub por uma conexão segura (https)."));
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: iter}, k, 256);
    }).then(b64);
  }
  function novoSal() { return b64(crypto.getRandomValues(new Uint8Array(16))); }
  function sha256hex(txt) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("").slice(0, 40); });
  }
  function chaveLogin(ident) { return sha256hex("login:" + norm(ident)); }
  function igualConst(a, b) { if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
  function senhaProvisoria() {
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", s;
    do { // garante letra e número, para a senha passar na mesma regra das senhas escolhidas
      var r = crypto.getRandomValues(new Uint8Array(10)); s = "";
      for (var i = 0; i < r.length; i++) s += abc.charAt(r[i] % abc.length);
    } while (validarSenha(s));
    return s;
  }
  function validarSenha(s) {
    if (String(s || "").length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
    if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return "Use letras e números na senha.";
    return "";
  }

  /* ============ BACKEND (trocável) ============ */
  var BACKEND = (function () {
    var dbP = null;
    function db() {
      if (!dbP) dbP = (window.claude && window.claude.use ? window.claude.use("db") : Promise.resolve(null)).then(function (d) { return d || null; }, function () { return null; });
      return dbP;
    }
    // modo local (sem banco do artefato): tudo no localStorage deste navegador
    var ouvintes = [];
    function locAll() { return lerLS(LOCAL_KEY, {}); }
    function avisa() { ouvintes.slice().forEach(function (f) { try { f(); } catch (e) {} }); }
    function snapColecao(col, todo) { return Object.keys(todo).filter(function (p) { return p.indexOf(col + "/") === 0 && p.split("/").length === 2; }).map(function (p) { return {id: p.slice(col.length + 1), data: function () { return clone(todo[p]); }}; }); }
    return {
      modo: function () { return db().then(function (d) { return d ? "banco" : "local"; }); },
      ler: function (path) {
        return db().then(function (d) {
          if (!d) { var v = locAll()[path]; return v ? clone(v) : null; }
          return d.doc(path).get().then(function (s) { return s && s.exists ? clone(s.data()) : null; });
        });
      },
      gravar: function (path, data) {
        return db().then(function (d) {
          if (!d) { var t = locAll(); t[path] = clone(data); gravarLS(LOCAL_KEY, t); avisa(); return; }
          return d.doc(path).set(clone(data));
        });
      },
      atualizar: function (path, parcial) {
        return db().then(function (d) {
          if (!d) { var t = locAll(); t[path] = Object.assign(t[path] || {}, clone(parcial)); gravarLS(LOCAL_KEY, t); avisa(); return; }
          return d.doc(path).update(clone(parcial));
        });
      },
      apagar: function (path) {
        return db().then(function (d) {
          if (!d) { var t = locAll(); delete t[path]; gravarLS(LOCAL_KEY, t); avisa(); return; }
          return d.doc(path).delete();
        });
      },
      listar: function (col) {
        return db().then(function (d) {
          if (!d) return snapColecao(col, locAll()).map(function (x) { return Object.assign({id: x.id}, x.data()); });
          return d.collection(col).get().then(function (s) { return s.docs.map(function (x) { return Object.assign({id: x.id}, clone(x.data())); }); });
        });
      },
      ouvirDoc: function (path, cb) {
        var off = function () {}, morto = false;
        db().then(function (d) {
          if (morto) return;
          if (!d) { var f = function () { var v = locAll()[path]; cb(v ? clone(v) : null); }; ouvintes.push(f); f(); off = function () { ouvintes = ouvintes.filter(function (x) { return x !== f; }); }; return; }
          off = d.doc(path).onSnapshot(function (s) { cb(s && s.exists ? clone(s.data()) : null); }, function () {});
        });
        return function () { morto = true; try { off(); } catch (e) {} };
      },
      ouvirColecao: function (col, cb) {
        var off = function () {}, morto = false;
        db().then(function (d) {
          if (morto) return;
          if (!d) { var f = function () { cb(snapColecao(col, locAll()).map(function (x) { return Object.assign({id: x.id}, x.data()); })); }; ouvintes.push(f); f(); off = function () { ouvintes = ouvintes.filter(function (x) { return x !== f; }); }; return; }
          off = d.collection(col).onSnapshot(function (s) { cb(s.docs.map(function (x) { return Object.assign({id: x.id}, clone(x.data())); })); }, function () {});
        });
        return function () { morto = true; try { off(); } catch (e) {} };
      },
      registrar: function (tipo, uid, por, extra) {
        var item = Object.assign({tipo: tipo, uid: uid || "", por: por || "", em: new Date().toISOString()}, extra || {}), path = "auth_log/" + hojeKey(), o = {};
        o[rid()] = item;
        return BACKEND.atualizar(path, {itens: o}).catch(function () { return BACKEND.gravar(path, {itens: o}); }).catch(function () {});
      }
    };
  })();

  /* ============ estado ============ */
  var atual = null;              // documento do usuário logado (com id)
  var snapAcesso = "";          // assinatura do acesso quando entrou
  var ouvintesMudar = [];
  var resolverAguardar = null;
  var aguardarP = new Promise(function (r) { resolverAguardar = r; });
  var offMeuDoc = null;

  function assinatura(u) { return JSON.stringify([u.status, !!u.admin, u.niveis || {}, u.analista || {}]); }
  function nivelDe(u, mod) {
    if (!u) return null;
    if (u.admin) return "coord";
    var n = u.niveis && u.niveis[mod];
    return n === "coord" || n === "analista" || n === "consulta" ? n : null;
  }
  function publico(u) {
    return {id: u.id, nome: u.nome, login: u.login, email: u.email || "", telefone: u.telefone || "", foto: u.foto || "", avatarCor: u.avatarCor || "", prefs: clone(u.prefs || {}), admin: !!u.admin, niveis: clone(u.niveis || {}), analista: clone(u.analista || {})};
  }

  /* ============ regras de conta ============ */
  function nivelVazio() { return {dp: "", contabil: "", fiscal: "", portal: "", cardapio: ""}; }
  function validarCadastro(f) {
    if (norm(f.nome).length < 3) return "Informe o seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Informe um e-mail válido.";
    if (!/^[a-z0-9._-]{3,32}$/.test(norm(f.login))) return "O usuário deve ter de 3 a 32 letras minúsculas, números, ponto, hífen ou sublinhado.";
    var s = validarSenha(f.senha); if (s) return s;
    if (f.senha !== f.confirma) return "As senhas não são iguais.";
    return "";
  }
  // extra: conta criada por um administrador ({admin, niveis, analista, trocarSenha, por}); sem ele é o cadastro da própria pessoa
  function criarConta(f, extra) {
    var msg = validarCadastro(f); if (msg) return Promise.reject(erro(msg));
    var login = norm(f.login), email = norm(f.email), id = novoId();
    return Promise.all([chaveLogin(login), chaveLogin(email)]).then(function (ks) {
      return Promise.all([BACKEND.ler("auth_logins/" + ks[0]), BACKEND.ler("auth_logins/" + ks[1]), BACKEND.listar("auth_usuarios")]).then(function (r) {
        if (r[0]) throw erro("Esse usuário já está em uso. Escolha outro.");
        if (r[1]) throw erro("Já existe uma conta com esse e-mail.");
        var primeiro = !extra && r[2].length === 0, sal = novoSal();
        return hashSenha(f.senha, sal, ITER).then(function (h) {
          var u = {login: login, email: email, nome: String(f.nome).trim().slice(0, 80), hash: h, salt: sal, iter: ITER, status: primeiro || extra ? "ativo" : "pendente", admin: extra ? !!extra.admin : primeiro,
            niveis: extra ? Object.assign(nivelVazio(), extra.niveis) : primeiro ? {dp: "coord", contabil: "coord", fiscal: "coord", portal: "coord", cardapio: "coord"} : nivelVazio(), analista: extra ? clone(extra.analista || {}) : {}, trocarSenha: extra ? !!extra.trocarSenha : false, falhas: 0, bloqueadoAte: 0, sv: 1,
            criadoEm: agora(), ultimoAcesso: 0, chaves: [ks[0], ks[1]]};
          if (extra) { u.aprovadoPor = extra.por; u.aprovadoEm = agora(); }
          return BACKEND.gravar("auth_usuarios/" + id, u).then(function () {
            return Promise.all([BACKEND.gravar("auth_logins/" + ks[0], {id: id}), BACKEND.gravar("auth_logins/" + ks[1], {id: id})]);
          }).then(function () { BACKEND.registrar(extra ? "criado_admin" : primeiro ? "primeiro_admin" : "cadastro", id, extra ? extra.por : id); return {id: id, primeiro: primeiro}; });
        });
      });
    });
  }
  function entrarConta(ident, senha, manter) {
    var generico = "Usuário ou senha incorretos.";
    if (!String(ident || "").trim() || !senha) return Promise.reject(erro("Informe o usuário (ou e-mail) e a senha."));
    return chaveLogin(ident).then(function (k) { return BACKEND.ler("auth_logins/" + k); }).then(function (lk) {
      if (!lk) throw erro(generico);
      return BACKEND.ler("auth_usuarios/" + lk.id).then(function (u) {
        if (!u) throw erro(generico);
        u.id = lk.id;
        if ((u.bloqueadoAte || 0) > agora()) throw erro("Muitas tentativas erradas. Tente de novo em " + Math.ceil((u.bloqueadoAte - agora()) / 60000) + " min.");
        return hashSenha(senha, u.salt, u.iter || ITER).then(function (h) {
          if (!igualConst(h, u.hash)) {
            var falhas = (u.falhas || 0) + 1, up = {falhas: falhas};
            if (falhas >= MAX_FALHAS) { up.falhas = 0; up.bloqueadoAte = agora() + ESPERA_MS; }
            BACKEND.atualizar("auth_usuarios/" + u.id, up).catch(function () {});
            BACKEND.registrar("senha_errada", u.id, u.id);
            throw erro(falhas >= MAX_FALHAS ? "Muitas tentativas erradas. Aguarde 5 minutos e tente de novo." : generico);
          }
          if (u.status === "bloqueado") throw erro("Esta conta está bloqueada. Fale com o administrador.");
          BACKEND.atualizar("auth_usuarios/" + u.id, {falhas: 0, bloqueadoAte: 0, ultimoAcesso: agora()}).catch(function () {});
          BACKEND.registrar("login", u.id, u.id);
          gravarLS(SESSAO_KEY, {uid: u.id, sv: u.sv || 1, exp: agora() + (manter ? 30 * 864e5 : 12 * 36e5)});
          return u;
        });
      });
    });
  }
  function sessaoSalva() {
    var s = lerLS(SESSAO_KEY, null);
    if (!s || !s.uid || (s.exp || 0) < agora()) { apagarLS(SESSAO_KEY); return Promise.resolve(null); }
    return BACKEND.ler("auth_usuarios/" + s.uid).then(function (u) {
      if (!u || u.status === "bloqueado" || (u.sv || 1) !== (s.sv || 1)) { apagarLS(SESSAO_KEY); return null; }
      u.id = s.uid; return u;
    }, function () { return null; });
  }
  function mudarSenha(uid, nova, exigeAtual, atualTxt) {
    var m = validarSenha(nova); if (m) return Promise.reject(erro(m));
    return BACKEND.ler("auth_usuarios/" + uid).then(function (u) {
      if (!u) throw erro("Conta não encontrada.");
      var confere = exigeAtual ? hashSenha(atualTxt || "", u.salt, u.iter || ITER).then(function (h) { if (!igualConst(h, u.hash)) throw erro("A senha atual não confere."); }) : Promise.resolve();
      return confere.then(function () {
        var sal = novoSal();
        return hashSenha(nova, sal, ITER).then(function (h) {
          var sv = (u.sv || 1) + 1;
          return BACKEND.atualizar("auth_usuarios/" + uid, {hash: h, salt: sal, iter: ITER, trocarSenha: false, sv: sv, falhas: 0, bloqueadoAte: 0}).then(function () {
            var s = lerLS(SESSAO_KEY, null); if (s && s.uid === uid) { s.sv = sv; gravarLS(SESSAO_KEY, s); }
            BACKEND.registrar("troca_senha", uid, uid);
          });
        });
      });
    });
  }

  /* ============ recuperação de senha (senha reserva ou informações pessoais) ============ */
  // Guardamos só hashes (PBKDF2) das respostas, nunca o texto. Recuperar exige a senha reserva OU pelo menos 2 informações corretas.
  var REC_ITENS = [["cidade", "Nome de uma cidade", "text", ""], ["cpf3", "3 primeiros dígitos do seu CPF", "text", ' inputmode="numeric" maxlength="3" pattern="[0-9]*"'], ["escola", "Escola onde estudou", "text", ""]];
  var REC_MAX = 5, REC_ESPERA = 15 * 60000;
  function normInfo(k, v) { v = String(v || ""); if (k === "cpf3") return v.replace(/\D/g, "").slice(0, 3); return norm(v).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
  function infoOk(k, v) { var n = normInfo(k, v); return k === "cpf3" ? n.length === 3 : n.length >= 3; }
  function hashItem(txt) { var sal = novoSal(); return hashSenha(txt, sal, ITER).then(function (h) { return {salt: sal, hash: h}; }); }
  // f: {reserva, cidade, cpf3, escola}; u: documento da conta (para não aceitar uma reserva igual à senha de entrada)
  function montarRec(f, u) {
    var reserva = String(f.reserva || "").trim(), preench = REC_ITENS.filter(function (i) { return String(f[i[0]] || "").trim(); });
    if (reserva && reserva.length < 6) return Promise.reject(erro("A senha reserva precisa ter pelo menos 6 caracteres."));
    if (reserva && (norm(reserva) === norm(u.login) || norm(reserva) === norm(u.email))) return Promise.reject(erro("A senha reserva não pode ser igual ao seu usuário ou e-mail."));
    for (var j = 0; j < preench.length; j++) if (!infoOk(preench[j][0], f[preench[j][0]])) return Promise.reject(erro(preench[j][0] === "cpf3" ? "Digite exatamente os 3 primeiros números do CPF." : "Confira: " + preench[j][1].toLowerCase() + " precisa ter pelo menos 3 letras."));
    if (!reserva && preench.length < 2) return Promise.reject(erro("Cadastre a senha reserva ou pelo menos 2 das informações."));
    var rec = {v: 1, em: agora(), reserva: null, itens: {}}, tarefas = [];
    if (reserva) tarefas.push(hashSenha(reserva, u.salt, u.iter || ITER).then(function (h) { if (igualConst(h, u.hash)) throw erro("A senha reserva precisa ser diferente da senha que você usa para entrar."); return hashItem(reserva).then(function (r) { rec.reserva = r; }); }));
    preench.forEach(function (i) { tarefas.push(hashItem(normInfo(i[0], f[i[0]])).then(function (r) { rec.itens[i[0]] = r; })); });
    return Promise.all(tarefas).then(function () { return rec; });
  }
  // atualTxt: quando a pessoa já está logada e muda a recuperação, pede a senha atual
  function salvarRec(uid, f, exigeAtual, atualTxt) {
    return BACKEND.ler("auth_usuarios/" + uid).then(function (u) {
      if (!u) throw erro("Conta não encontrada.");
      var confere = exigeAtual ? hashSenha(atualTxt || "", u.salt, u.iter || ITER).then(function (h) { if (!igualConst(h, u.hash)) throw erro("A senha atual não confere."); }) : Promise.resolve();
      return confere.then(function () { return montarRec(f, u); }).then(function (rec) {
        return BACKEND.atualizar("auth_usuarios/" + uid, {rec: rec, recFalhas: 0, recBloqueadoAte: 0}).then(function () { BACKEND.registrar("recuperacao_cadastrada", uid, uid); return rec; });
      });
    });
  }
  function verificarRec(ident, prova) {
    var gen = erro("Os dados não conferem. Confira e tente de novo. Se você nunca cadastrou a recuperação, peça ao administrador para redefinir a senha.");
    if (!String(ident || "").trim()) return Promise.reject(erro("Informe o usuário ou e-mail."));
    var falso = function () { return hashSenha("x", novoSal(), ITER).then(function () { throw gen; }); };
    return chaveLogin(ident).then(function (k) { return BACKEND.ler("auth_logins/" + k); }).then(function (lk) {
      if (!lk) return falso();
      return BACKEND.ler("auth_usuarios/" + lk.id).then(function (u) {
        if (!u || u.status === "bloqueado" || !u.rec) return falso();
        if ((u.recBloqueadoAte || 0) > agora()) throw erro("Muitas tentativas. Tente de novo em " + Math.ceil((u.recBloqueadoAte - agora()) / 60000) + " min.");
        var reserva = String(prova.reserva || "").trim(), tarefas = [];
        tarefas.push(reserva && u.rec.reserva ? hashSenha(reserva, u.rec.reserva.salt, ITER).then(function (h) { return igualConst(h, u.rec.reserva.hash); }) : Promise.resolve(false));
        REC_ITENS.forEach(function (i) { var k = i[0], it = u.rec.itens && u.rec.itens[k]; if (it && infoOk(k, prova[k])) tarefas.push(hashSenha(normInfo(k, prova[k]), it.salt, ITER).then(function (h) { return igualConst(h, it.hash); })); });
        return Promise.all(tarefas).then(function (r) {
          var acertos = r.slice(1).filter(Boolean).length;
          if (r[0] || acertos >= 2) { if (u.recFalhas || u.recBloqueadoAte) BACKEND.atualizar("auth_usuarios/" + lk.id, {recFalhas: 0, recBloqueadoAte: 0}).catch(function () {}); return {uid: lk.id, nome: u.nome}; }
          var f = (u.recFalhas || 0) + 1, up = {recFalhas: f};
          if (f >= REC_MAX) { up.recFalhas = 0; up.recBloqueadoAte = agora() + REC_ESPERA; }
          BACKEND.atualizar("auth_usuarios/" + lk.id, up).catch(function () {}); BACKEND.registrar("recuperacao_errada", lk.id, lk.id);
          throw f >= REC_MAX ? erro("Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.") : gen;
        });
      });
    });
  }
  function recuperarSenha(ident, prova, nova) {
    var m = validarSenha(nova); if (m) return Promise.reject(erro(m));
    return verificarRec(ident, prova).then(function (r) { return mudarSenha(r.uid, nova, false).then(function () { BACKEND.registrar("senha_recuperada", r.uid, r.uid); }); });
  }

  /* ============ interface: tela de login ============ */
  var CSS = ".ax-tela{position:fixed;inset:0;z-index:100000;background:var(--page,#EDF0F3);color:var(--ink,#101820);font:14px/1.5 'IBM Plex Sans',system-ui,sans-serif;display:flex;flex-direction:column;overflow:auto}" +
    ".ax-tela *{box-sizing:border-box}.ax-mast{background:#0E151B;border-bottom:3px solid var(--brand-red,#C2000C);padding:16px 20px;color:#E9EEF2}.ax-mast b{font:700 19px Archivo,system-ui,sans-serif;letter-spacing:-.02em}.ax-mast b i{font-style:normal;color:var(--brand-red,#C2000C)}.ax-mast b u{text-decoration:none;color:#7FC2DE}.ax-mast small{display:block;color:#8FA0AD;font-size:11.5px;margin-top:2px}" +
    ".ax-miolo{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 16px}.ax-cartao{width:min(420px,100%);background:var(--surface,#fff);border:1px solid var(--rule,#DCE3E9);border-radius:8px;box-shadow:0 10px 30px rgba(16,24,32,.12);padding:22px 22px 20px;position:relative}.ax-cartao::before{content:'';position:absolute;left:-1px;top:0;bottom:0;width:3px;background:var(--brand-red,#C2000C)}" +
    ".ax-cartao h1{margin:0 0 4px;font:700 20px Archivo,system-ui,sans-serif;letter-spacing:-.01em}.ax-sub{margin:0 0 14px;color:var(--ink-3,#5F6D77);font-size:13px}" +
    ".ax-abas{display:flex;gap:0;margin:0 0 16px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;overflow:hidden}.ax-abas button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font:600 13px 'IBM Plex Sans',sans-serif;color:var(--ink-2,#47545F);cursor:pointer}.ax-abas button+button{border-left:1px solid var(--rule-strong,#C2CCD5)}.ax-abas button[aria-pressed=true]{background:var(--blue-deep,#3C659B);color:#fff}" +
    ".ax-campo{display:flex;flex-direction:column;gap:3px;margin-bottom:11px}.ax-campo label{font:700 11px Archivo,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}.ax-campo input,.ax-campo select{font:inherit;font-size:14px;padding:9px 10px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820);width:100%}.ax-campo input:focus,.ax-campo select:focus{outline:2px solid var(--blue-deep,#3C659B);outline-offset:1px}.ax-dica{font-size:11.5px;color:var(--ink-3,#5F6D77)}" +
    ".ax-chk{display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0 14px}.ax-btn{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:6px;padding:9px 14px;font:600 13px 'IBM Plex Sans',sans-serif;cursor:pointer}.ax-btn:hover{border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}.ax-btn.prim{background:var(--brand-red,#C2000C);border-color:var(--brand-red,#C2000C);color:#fff;width:100%}.ax-btn.prim:hover{filter:brightness(1.08);color:#fff}.ax-btn:disabled{opacity:.55;cursor:default}" +
    ".ax-erro{color:var(--brand-red,#C2000C);font-size:13px;min-height:20px;margin:-2px 0 8px}.ax-ok{color:var(--dp-ok,#167A45)}.ax-aviso{background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));border:1px solid var(--status-warn,#B5530C);color:var(--ink,#101820);padding:8px 10px;border-radius:6px;font-size:12.5px;margin-bottom:12px}" +
    ".ax-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ax-acoes .ax-btn{flex:1}.ax-pe{padding:12px 20px;font-size:11.5px;color:var(--ink-3,#5F6D77);text-align:center}" +
    ".ax-chip-home{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:16px;z-index:60}.ax-chip{display:flex;justify-content:center;padding:6px 0}.ax-av{width:38px;height:38px;border-radius:50%;border:2px solid var(--rule-strong,#35434E);background:var(--blue-deep,#3C659B);color:#fff;font:700 13px Archivo,sans-serif;cursor:pointer;letter-spacing:.02em}.ax-av:hover,.ax-av[aria-expanded=true]{border-color:var(--brand-red,#C2000C)}.ax-av:focus-visible{outline:2px solid var(--blue-mid,#6BAAC9);outline-offset:2px}" +
    ".ax-pop{position:fixed;z-index:100003;width:230px;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:8px;box-shadow:0 12px 32px rgba(16,24,32,.28);padding:10px;display:flex;flex-direction:column;gap:8px;font:13px 'IBM Plex Sans',sans-serif}.ax-pop b{display:block;font-size:14px;line-height:1.25}.ax-pop span{display:block;color:var(--ink-3,#5F6D77);font-size:12px}.ax-pop button{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:6px;padding:7px 10px;font:600 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer;text-align:left}.ax-pop button:hover{border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}" +
    "@property --ax-ang{syntax:'<angle>';inherits:false;initial-value:0deg}" +
    /* brilho ao passar o mouse no botão do usuário */
    ".ax-av{transition:box-shadow .25s,border-color .25s,transform .2s}.ax-av:hover{transform:translateY(-1px);border-color:var(--blue-mid,#6BAAC9);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-mid,#6BAAC9) 35%,transparent),0 0 14px 3px color-mix(in srgb,var(--blue-mid,#6BAAC9) 55%,transparent);animation:ax-pulso 1.8s ease-in-out infinite}" +
    "@keyframes ax-pulso{0%,100%{box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-mid,#6BAAC9) 30%,transparent),0 0 10px 2px color-mix(in srgb,var(--blue-mid,#6BAAC9) 45%,transparent)}50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--blue-mid,#6BAAC9) 45%,transparent),0 0 20px 5px color-mix(in srgb,var(--blue-mid,#6BAAC9) 70%,transparent)}}" +
    /* luz percorrendo a borda do campo em foco */
    ".ax-cartao .ax-campo input,.ax-cartao .ax-campo select{border:1.5px solid var(--rule-strong,#C2CCD5);transition:box-shadow .25s}" +
    ".ax-cartao .ax-campo input:focus,.ax-cartao .ax-campo select:focus{outline:none;border-color:transparent;background:linear-gradient(var(--surface,#fff),var(--surface,#fff)) padding-box,conic-gradient(from var(--ax-ang),color-mix(in srgb,var(--blue-deep,#3C659B) 55%,transparent) 0 50%,var(--blue-mid,#6BAAC9) 74%,#fff 86%,var(--blue-mid,#6BAAC9) 94%,color-mix(in srgb,var(--blue-deep,#3C659B) 55%,transparent) 100%) border-box;animation:ax-gira 2.4s linear infinite;box-shadow:0 0 10px 1px color-mix(in srgb,var(--blue-mid,#6BAAC9) 45%,transparent)}" +
    /* listas de seleção (Tema, Abrir o Hub em…) acompanham o tema do Hub, também a lista que se abre */
    ".ax-cartao select,.ax-cartao select option,.ax-cartao select optgroup{background-color:var(--surface,#fff);color:var(--ink,#101820)}.ax-cartao select{color-scheme:light}:root[data-theme=dark] .ax-cartao select,:root[data-theme=dark] .ax-cartao input{color-scheme:dark}" +
    "@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .ax-cartao select,:root:not([data-theme=light]) .ax-cartao input{color-scheme:dark}}" +
    ".ax-cartao select option:checked{background-color:var(--blue-deep,#3C659B);color:#fff}" +
    "@keyframes ax-gira{to{--ax-ang:360deg}}" +
    "@media (prefers-reduced-motion:reduce){.ax-av:hover{animation:none}.ax-cartao .ax-campo input:focus,.ax-cartao .ax-campo select:focus{animation:none;border-color:var(--blue-mid,#6BAAC9)}}" +
    ".ax-pf{width:min(560px,100%)!important;padding:18px 20px}.ax-pf section{border-top:1px solid var(--rule,#DCE3E9);padding:12px 0 4px;margin-top:8px}.ax-pf h2{margin:0 0 8px;font:700 12px Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}" +
    ".ax-pf-topo{display:flex;align-items:center;gap:14px;margin-bottom:4px}.ax-pf-av{width:64px;height:64px;font-size:22px;cursor:default;flex:none;display:flex;align-items:center;justify-content:center}.ax-pf-id{min-width:0;flex:1}.ax-pf-id h1{margin:0;font:700 19px Archivo,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ax-pf-id span{color:var(--ink-3,#5F6D77);font-size:12.5px}.ax-pf-x{border:0;background:none;font-size:16px;cursor:pointer;color:var(--ink-3,#5F6D77);padding:6px 8px;border-radius:6px;align-self:flex-start}.ax-pf-x:hover{background:var(--surface-2,#F5F8FA)}" +
    ".ax-pf-foto,.ax-pf-lin{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 8px}.ax-pf-foto .ax-btn,.ax-pf-lin .ax-btn{flex:none}.ax-pf-cores{display:flex;gap:8px;flex-wrap:wrap}.ax-pf-cor{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}.ax-pf-cor[aria-pressed=true]{border-color:var(--ink,#101820);box-shadow:0 0 0 2px var(--surface,#fff) inset}" +
    ".ax-pf select{width:100%;font:inherit;padding:9px 10px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:inherit}.ax-pf-ac{list-style:none;margin:0 0 6px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}.ax-pf-ac li{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border:1px solid var(--rule,#DCE3E9);border-radius:6px;font-size:12.5px}.ax-pf-ac b{font-weight:600}" +
    ".ax-av.tem-foto{color:transparent}" +
    ".ax-dlg{position:fixed;inset:0;z-index:100001;background:rgba(10,16,22,.55);display:flex;align-items:center;justify-content:center;padding:16px}.ax-dlg .ax-cartao{max-height:92vh;overflow:auto}" +
    /* administração de usuários */
    ".au{display:flex;flex-direction:column;gap:14px;padding:4px 0 90px;font-size:13.5px;position:relative}.au-intro{margin:0;color:var(--ink-3,#5F6D77)}.au kbd{font:11px 'IBM Plex Mono',monospace;border:1px solid var(--rule-strong,#C2CCD5);border-bottom-width:2px;border-radius:4px;padding:0 5px;background:var(--surface,#fff)}" +
    ".au-resumo-topo{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.au-total{font-size:13px;color:var(--ink-2,#47545F);margin-right:4px}.au-chipr{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:14px;padding:4px 11px;font:500 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer}.au-chipr b{font-weight:700}.au-chipr.on{background:var(--blue-pale,#DCE8F1);border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}.au-chipr.aviso{border-color:var(--status-warn,#B5530C);background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));color:var(--status-warn,#B5530C)}" +
    ".au-alerta{background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));border:1px solid var(--status-warn,#B5530C);border-radius:6px;padding:8px 10px;font-size:12.5px;color:var(--ink,#101820)}.au-linha{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.au-novobtn{width:auto!important;padding:8px 14px}" +
    ".au-abas{display:flex;gap:6px;flex-wrap:wrap}.au-abas button{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:16px;padding:6px 13px;font:600 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer}.au-abas button[aria-pressed=true]{background:var(--blue-deep,#3C659B);border-color:var(--blue-deep,#3C659B);color:#fff}" +
    ".au-barra{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.au-barra[hidden]{display:none}.au-barra input[type=search]{flex:1 1 240px;min-width:180px;font:inherit;padding:8px 10px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.au-barra select{font:inherit;font-size:13px;padding:7px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.au-barra .ax-btn{padding:7px 12px;font-size:12.5px}" +
    ".au-selbar{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--blue-pale,#DCE8F1);border:1px solid var(--blue-deep,#3C659B);border-radius:8px;padding:8px 10px;color:var(--ink,#101820)}.au-selbar[hidden]{display:none}.au-selbar .ax-btn{padding:5px 10px;font-size:12.5px}.au-selbar .ax-btn.perigo,.au-bot .ax-btn.perigo{border-color:var(--brand-red,#C2000C);color:var(--brand-red,#C2000C)}.au-selbar select{font:inherit;font-size:12.5px;padding:5px 6px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.au-lote{display:flex;gap:6px;align-items:center;flex-wrap:wrap}" +
    ".au-listahead{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.au-listahead .ax-btn{padding:4px 10px;font-size:12px}.au-dica{font-size:12px;color:var(--ink-3,#5F6D77)}.au-dica.ok{color:var(--dp-ok,#167A45)}.au-dica.ruim{color:var(--brand-red,#C2000C)}.au-nota{margin:0;font-size:12px;color:var(--ink-3,#5F6D77)}" +
    ".au-lista{display:flex;flex-direction:column;gap:8px}.au-item{border:1px solid var(--rule,#DCE3E9);border-radius:8px;background:var(--surface,#fff);overflow:hidden}.au-item.pend{border-color:var(--status-warn,#B5530C)}.au-item.destaque{box-shadow:0 0 0 3px var(--blue-mid,#6BAAC9);animation:au-pisca 1.2s ease 2}@keyframes au-pisca{50%{box-shadow:0 0 0 7px rgba(107,170,201,.35)}}" +
    ".au-lin{display:flex;align-items:center;gap:8px;padding:0 10px 0 12px}.au-ck{flex:none;width:16px;height:16px}.au-head{flex:1;min-width:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:10px 4px;cursor:pointer}.au-head:hover .au-id b{color:var(--blue-deep,#3C659B)}.au-head:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:-2px}" +
    ".au-av{width:34px;height:34px;border-radius:50%;background:var(--blue-deep,#3C659B);color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px Archivo,sans-serif;flex:none}.au-id{display:flex;flex-direction:column;min-width:150px;flex:1 1 180px}.au-id b{font:700 14px Archivo,sans-serif}.au-id small{color:var(--ink-3,#5F6D77);font-size:12px;overflow:hidden;text-overflow:ellipsis}.au-tags{display:flex;gap:4px;flex-wrap:wrap}.au-resumo{display:flex;gap:4px;flex-wrap:wrap;flex:2 1 220px}.au-ult{color:var(--ink-3,#5F6D77);font-size:12px;white-space:nowrap}.au-seta{color:var(--ink-3,#5F6D77);margin-left:auto}" +
    ".au-nv{font-size:11px;padding:2px 7px;border-radius:4px;background:var(--surface-3,#EAEFF3);color:var(--ink-2,#47545F);white-space:nowrap}.au-nv.nv-coord{background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}.au-nv.nv-analista{background:color-mix(in srgb,var(--dp-ok,#167A45) 14%,var(--surface,#fff));color:var(--dp-ok,#167A45)}.au-nv.nv-sem{background:transparent;border:1px dashed var(--rule-strong,#C2CCD5);color:var(--ink-3,#5F6D77)}" +
    ".au-u{border-top:1px solid var(--rule,#DCE3E9);padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px}.au-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--surface-3,#EAEFF3);color:var(--ink-2,#47545F)}.au-tag.pend{background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));color:var(--status-warn,#B5530C)}.au-tag.adm{background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}.au-tag.blq{background:var(--brand-red-soft,#FBEAEA);color:var(--brand-red,#C2000C)}" +
    ".au-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 14px}.au-mod{display:flex;flex-direction:column;gap:3px}.au-mod label{font:700 11px Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}.au-mod select,.au-mod input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820);width:100%}.au-mod.mudou input,.au-mod.mudou select{border-color:var(--status-warn,#B5530C);background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));color:var(--ink,#101820)}" +
    ".au-nivhead{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between}.au-modelo{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820);max-width:100%}.au-diff{font-size:12.5px;color:var(--status-warn,#B5530C);background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));border-radius:6px;padding:6px 9px}.au-diff[hidden]{display:none}" +
    ".au-bot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.au-bot .ax-btn{padding:6px 12px;font-size:12.5px}.au-bot .ax-btn.prim{width:auto}.au-msg{font-size:12.5px;color:var(--brand-red,#C2000C)}.au-msg.ok{color:var(--dp-ok,#167A45)}.au-msg .ax-btn{margin-left:6px;padding:2px 9px}.au-hist{border-top:1px dashed var(--rule,#DCE3E9);padding-top:8px}" +
    ".au-prov{background:color-mix(in srgb,var(--dp-ok,#167A45) 14%,var(--surface,#fff));border:1px solid var(--dp-ok,#167A45);border-radius:6px;padding:8px 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--ink,#101820)}.au-prov code{font:600 15px 'IBM Plex Mono',monospace;letter-spacing:.04em}" +
    ".au-vazio{color:var(--ink-3,#5F6D77);padding:24px 6px}.au-outras{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12.5px}.au-log{display:flex;flex-direction:column}.au-log div{display:flex;gap:12px;flex-wrap:wrap;padding:6px 2px;border-bottom:1px solid var(--rule,#DCE3E9);font-size:12.5px}.au-log time{font:12px 'IBM Plex Mono',monospace;color:var(--ink-3,#5F6D77)}.au-log .au-mais,.au-log .au-vazio{border:0}.au-filtros-log{display:flex;gap:10px;flex-wrap:wrap}.au-filtros-log label{display:flex;flex-direction:column;gap:3px;font:700 11px Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}.au-filtros-log select{font:inherit;font-size:13px;text-transform:none;letter-spacing:0;padding:6px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}" +
    ".au-mx{overflow-x:auto;border:1px solid var(--rule,#DCE3E9);border-radius:8px;background:var(--surface,#fff)}.au-mx table{border-collapse:collapse;width:100%;min-width:800px}.au-mx th,.au-mx td{padding:6px 8px;border-bottom:1px solid var(--rule,#DCE3E9);text-align:left;vertical-align:top}.au-mx thead th{font:700 11px Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#5F6D77);background:var(--surface-3,#EAEFF3);position:sticky;top:0}.au-mx tbody th{font-weight:400;min-width:170px}.au-mx tbody th b{display:block;font:700 13px Archivo,sans-serif}.au-mx tbody th small{color:var(--ink-3,#5F6D77)}.au-mx tr.blq{opacity:.65}.au-mx select,.au-mx input[data-mxa]{width:100%;font:inherit;font-size:12.5px;padding:4px 6px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820)}.au-mx input[data-mxa]{margin-top:4px}.au-mx td.nv-coord select{border-color:var(--blue-deep,#3C659B)}.au-mx td.nv-analista select{border-color:var(--dp-ok,#167A45)}.au-mx td.nv-sem select{color:var(--ink-3,#5F6D77)}.au-mx td.mudou select,.au-mx td.mudou input{border-color:var(--status-warn,#B5530C);background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff))}.au-mx td.mx-a,.au-mx td.mx-adm{text-align:center}" +
    ".au-gaveta-wrap[hidden]{display:none}.au-fundo{position:fixed;inset:0;z-index:100004;background:rgba(10,16,22,.45)}.au-gaveta{position:fixed;top:0;right:0;bottom:0;z-index:100005;width:min(480px,100vw);background:var(--surface,#fff);color:var(--ink,#101820);box-shadow:-10px 0 30px rgba(16,24,32,.25);overflow:auto;border-left:3px solid var(--brand-red,#C2000C)}.au-novo{display:flex;flex-direction:column;gap:12px;padding:16px 18px 24px}.au-gcab{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.au-gcab b{font:700 18px Archivo,sans-serif;display:block}.au-gcab small{color:var(--ink-3,#5F6D77)}.au-gcampos{display:flex;flex-direction:column;gap:10px}.au-gmods{grid-template-columns:1fr}.au-gbot{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;bottom:0;background:var(--surface,#fff);padding:8px 0 2px}.au-gbot .au-msg{flex:1 1 100%;order:-1}.au-gbot .ax-btn.prim{width:auto}" +
    ".au-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100006;background:#101820;color:#fff;border-radius:8px;padding:9px 14px;display:none;gap:10px;align-items:center;font:600 13px 'IBM Plex Sans',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;border-left:4px solid #E5484D}.au-toast.on{display:flex}.au-toast.ok{border-left-color:#3DB878}.au-toast button{background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:5px;padding:2px 9px;cursor:pointer;font:inherit}" +
    ".au-forca{display:flex;align-items:center;gap:8px;min-height:14px;margin-top:3px}.au-forca i{display:block;height:5px;border-radius:3px;width:34%;background:var(--brand-red,#C2000C)}.au-forca[data-n=\"2\"] i{width:67%;background:#E0A100}.au-forca[data-n=\"3\"] i{width:100%;background:var(--dp-ok,#167A45)}.au-forca span{font-size:11.5px;color:var(--ink-3,#5F6D77)}" +
    ".ax-sen{position:relative}.ax-sen input{padding-right:72px!important}.ax-olho{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--blue-deep,#3C659B);font:600 12px 'IBM Plex Sans',sans-serif;cursor:pointer;padding:4px 6px}" +
    ".au-badge{position:absolute;top:-5px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--brand-red,#C2000C);color:#fff;font:700 11px/18px 'IBM Plex Sans',sans-serif;text-align:center;box-shadow:0 0 0 2px var(--surface,#0E151B);pointer-events:none;z-index:3}.card-icon:has(>.au-badge){position:relative}" +
    "@media (max-width:640px){.au-head{gap:8px}.au-resumo{flex-basis:100%}.au-ult{margin-left:auto}.au-seta{margin-left:0}.au-gaveta{width:100vw}.au-linha .au-novobtn{width:100%!important}.au-barra select{flex:1 1 45%}.au-listahead .au-dica{display:none}}";

  CSS += ".ax-tela{background:var(--page,#EDF0F3)}.ax-fundo{position:absolute;inset:0;overflow:hidden;pointer-events:none}.ax-fundo i{position:absolute;width:74vmax;height:74vmax;border-radius:50%;opacity:.9;animation:ax-respira 26s ease-in-out infinite}" +
    ".ax-fundo i:nth-child(1){background:radial-gradient(closest-side,var(--blue-pale,#DCE8F1),transparent);left:-18vmax;top:-20vmax}.ax-fundo i:nth-child(2){background:radial-gradient(closest-side,var(--brand-red-soft,#FBEAEA),transparent);right:-22vmax;bottom:-24vmax;animation-delay:-9s;animation-duration:31s}.ax-fundo i:nth-child(3){background:radial-gradient(closest-side,color-mix(in srgb,var(--blue-mid,#6BAAC9) 22%,transparent),transparent);left:25%;top:30%;width:58vmax;height:58vmax;animation-delay:-17s;animation-duration:36s}" +
    "@keyframes ax-respira{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(7vmax,5vmax) scale(1.14)}66%{transform:translate(-5vmax,8vmax) scale(.92)}}" +
    ".ax-tela .ax-miolo{position:relative;z-index:1;perspective:1100px}.ax-tela .ax-pe{position:relative;z-index:1}" +
    ".ax-tela .ax-cx{border-radius:28px;padding:30px 28px 24px;overflow:hidden;box-shadow:0 2px 4px rgba(16,24,32,.08),0 24px 48px rgba(16,24,32,.16)}.ax-tela .ax-cx::before{display:none}" +
    ".ax-tela .ax-cx::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(420px circle at var(--lx,50%) var(--ly,0%),color-mix(in srgb,var(--blue-mid,#6BAAC9) 24%,transparent),transparent 60%);opacity:var(--lo,0);transition:opacity .3s}" +
    ".ax-marca{display:flex;align-items:center;gap:12px;margin-bottom:20px}.ax-marca .sig{height:46px;width:auto}.ax-marca .nom{height:25px;width:auto}" +
    ".ax-tela .ax-cx h1{font-size:26px;line-height:1.15;margin:0 0 4px;text-wrap:balance}.ax-tela .ax-cx .ax-sub{margin:0 0 22px;font-size:14px}" +
    ".ax-in{opacity:0;transform:translateY(14px);animation:ax-sobe .6s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--i,0)*var(--passo,90ms) + 80ms)}@keyframes ax-sobe{to{opacity:1;transform:none}}" +
    ".ax-fl{position:relative;margin-bottom:16px}.ax-fl input{height:50px;padding:20px 14px 6px;border-radius:16px;background:transparent;font:500 15px 'IBM Plex Sans',system-ui,sans-serif}.ax-fl label{position:absolute;left:14px;top:15px;margin:0;font:400 15px 'IBM Plex Sans',system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--ink-3,#5F6D77);pointer-events:none;transform-origin:left top;transition:transform .2s cubic-bezier(.2,.7,.2,1),color .2s}" +
    ".ax-fl input:focus+label,.ax-fl input:not(:placeholder-shown)+label{transform:translateY(-10px) scale(.74)}.ax-fl input:focus+label{color:var(--blue-deep,#3C659B)}" +
    ".ax-tela .ax-fl input:focus{animation:none;background:transparent;border-color:var(--blue-deep,#3C659B);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-deep,#3C659B) 22%,transparent)}" +
    ".ax-ln{position:absolute;left:18px;right:18px;bottom:0;height:2px;border-radius:2px;background:var(--blue-deep,#3C659B);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,.2,1);pointer-events:none}.ax-fl input:focus~.ax-ln{transform:scaleX(1)}.ax-fl input:-webkit-autofill+label{transform:translateY(-10px) scale(.74)}" +
    ".ax-tela .ax-olho{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;padding:0;border:0;border-radius:12px;background:transparent;color:var(--ink-3,#5F6D77);cursor:pointer;display:grid;place-items:center;transition:color .2s,background .2s}.ax-tela .ax-olho:hover{color:var(--blue-deep,#3C659B);background:color-mix(in srgb,var(--blue-deep,#3C659B) 10%,transparent)}.ax-tela .ax-olho:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:1px}" +
    ".ax-sen input,.ax-fl.ax-fsen input{padding-right:48px!important}.ax-olho svg{width:22px;height:22px;overflow:visible}.ax-olho svg *{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ax-olho .globo{transform-origin:12px 12px}.ax-olho .pupila{fill:currentColor;stroke:none;transform-origin:12px 12px;transition:transform .22s}.ax-olho .corte{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .3s .08s}.ax-olho.fechado .corte{stroke-dashoffset:0}.ax-olho.fechado .pupila{transform:scale(0)}.ax-olho.pisca .globo{animation:ax-pisca .26s ease}@keyframes ax-pisca{50%{transform:scaleY(.1)}}" +
    ".ax-btn.ax-fx{position:relative;height:50px;padding:0;grid-template-columns:minmax(0,1fr);white-space:nowrap;border-radius:16px;display:grid;place-items:center;overflow:hidden;margin:6px auto 0;transition:width .35s cubic-bezier(.2,.7,.2,1),border-radius .35s,background .3s,transform .15s;font:600 15px 'IBM Plex Sans',system-ui,sans-serif}.ax-btn.ax-fx:hover{transform:translateY(-1px)}.ax-btn.ax-fx:disabled{opacity:1}" +
    ".ax-fx .t,.ax-fx .anel,.ax-fx .okk{grid-area:1/1;transition:opacity .2s,transform .3s}.ax-fx .anel,.ax-fx .okk{opacity:0;transform:scale(.5)}.ax-fx .anel{width:26px;height:26px;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,255,255,.4) 0,#fff 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));animation:ax-roda .75s linear infinite;will-change:transform}.ax-fx.carrega{animation:ax-halo 1.4s ease-out infinite}@keyframes ax-halo{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand-red,#C2000C) 45%,transparent)}100%{box-shadow:0 0 0 14px transparent}}@keyframes ax-roda{to{rotate:360deg}}" +
    ".ax-fx.carrega,.ax-fx.sucesso{width:50px;border-radius:50%;pointer-events:none}.ax-fx.carrega .t,.ax-fx.sucesso .t{opacity:0;transform:scale(.6)}.ax-fx.carrega .anel{opacity:1;transform:scale(1)}.ax-fx.sucesso{background:var(--dp-ok,#167A45);border-color:var(--dp-ok,#167A45)}.ax-fx.sucesso .anel{opacity:0}.ax-fx.sucesso .okk{opacity:1;transform:scale(1)}" +
    ".okk{width:24px;height:24px}.okk path{stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:26;stroke-dashoffset:26}.ax-fx.sucesso .okk path{animation:ax-traco .45s .12s ease forwards}@keyframes ax-traco{to{stroke-dashoffset:0}}" +
    ".ax-troca{margin:16px 0 0;text-align:center;font-size:13.5px;color:var(--ink-2,#47545F)}.ax-troca button{all:unset;cursor:pointer;color:var(--blue-deep,#3C659B);font-weight:600;margin-left:4px;border-bottom:1px solid transparent;transition:border-color .2s}.ax-troca button:hover{border-color:currentColor}.ax-troca button:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:3px}" +
    ".ax-cx.sai{animation:ax-dissolve .6s cubic-bezier(.5,0,.8,.4) forwards}@keyframes ax-dissolve{to{opacity:0;transform:scale(.94) translateY(-18px);filter:blur(6px)}}" +
    "@media (prefers-reduced-motion:reduce){.ax-fundo i,.ax-fx .anel,.ax-fx.carrega{animation:none}.ax-in{animation:none;opacity:1;transform:none}.ax-tela .ax-cx{transition:none}.ax-cx.sai{animation:none;opacity:0}}";
  CSS += ".ax-tela{--page:#EDF0F3;--surface:#FFFFFF;--surface-2:#F5F8FA;--ink:#101820;--ink-2:#47545F;--ink-3:#5F6D77;--rule:#DCE3E9;--rule-strong:#C2CCD5;--blue-deep:#3C659B;--blue-mid:#6BAAC9;--blue-pale:#DCE8F1;--brand-red:#C2000C;--brand-red-soft:#FBEAEA;--surface-3:#EAEFF3;--warn-soft:#FBF0D6;--warn:#9A6B00;--status-warn:#9A6B00;--green-soft:#E1F2E8;--status-green:#167A45;color-scheme:light;background:#EDF0F3}" +
    ".ax-tela .ax-fundo i:nth-child(1){background:radial-gradient(closest-side,#B9D8F3,transparent)}.ax-tela .ax-fundo i:nth-child(2){background:radial-gradient(closest-side,#F4B9BF,transparent)}.ax-tela .ax-fundo i:nth-child(3){background:radial-gradient(closest-side,rgba(107,178,225,.40),transparent)}";
  CSS += ".ax-tela .ax-campo input,.ax-tela .ax-campo select{color:#101820!important;-webkit-text-fill-color:#101820!important;caret-color:#101820}" +
    ".ax-tela .ax-campo input:-webkit-autofill,.ax-tela .ax-campo input:-webkit-autofill:hover,.ax-tela .ax-campo input:-webkit-autofill:focus{-webkit-text-fill-color:#101820!important;caret-color:#101820;box-shadow:0 0 0 1000px #FFFFFF inset!important;transition:background-color 9999s ease-out}";
  CSS += ".ax-tema2{display:flex;gap:10px}.ax-tema2 button{all:unset;box-sizing:border-box;flex:1;display:flex;align-items:center;justify-content:center;gap:9px;padding:11px 12px;border:1.5px solid var(--rule-strong,#C2CCD5);border-radius:16px;background:var(--surface,#fff);color:var(--ink,#101820);font:600 13.5px 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer;transition:border-color .2s,box-shadow .2s,background .2s}" +
    ".ax-tema2 button:hover{border-color:var(--blue-mid,#6BAAC9)}.ax-tema2 button[aria-checked=true]{border-color:var(--blue-deep,#3C659B);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-deep,#3C659B) 20%,transparent)}.ax-tema2 button:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:2px}" +
    ".ax-tema2 .sw{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--rule-strong,#C2CCD5);flex:none}.ax-tema2 .sw.claro{background:#FFFFFF}.ax-tema2 .sw.escuro{background:#131A21;border-color:#35434E}";
  CSS += ".ax-link{all:unset;cursor:pointer;font:600 12.5px 'IBM Plex Sans',system-ui,sans-serif;color:var(--blue-deep,#3C659B)}.ax-link:hover{text-decoration:underline}.ax-link:focus-visible{outline:2px solid var(--blue-deep,#3C659B);outline-offset:3px;border-radius:4px}" +
    ".ax-sep{display:flex;align-items:center;gap:10px;margin:2px 0 14px;color:var(--ink-3,#5F6D77);font-size:12px}.ax-sep::before,.ax-sep::after{content:'';flex:1;height:1px;background:var(--rule,#DCE3E9)}";
  CSS += ".ax-dlg{backdrop-filter:blur(6px)}.ax-dlg .ax-fundo i{opacity:.4}.ax-dlg .ax-cartao{position:relative;z-index:1;border-radius:28px;box-shadow:0 2px 4px rgba(16,24,32,.08),0 24px 48px rgba(16,24,32,.25)}.ax-dlg .ax-cartao::before{display:none}.ax-dlg .ax-campo select{border-radius:14px}" +
    ".ax-dlg .ax-fl{margin-bottom:12px}.ax-dlg .ax-acoes .ax-fx{height:44px;margin:0}.ax-dlg .ax-acoes .ax-fx.carrega,.ax-dlg .ax-acoes .ax-fx.sucesso{flex:0 0 44px;width:44px;margin-left:auto}.ax-dlg .ax-acoes .ax-btn{border-radius:14px}.ax-dlg .ax-pf-x{border-radius:50%}" +
    /* barra de rolagem discreta, fina e arredondada, recuada para ficar dentro do cartão */
    "@supports not selector(::-webkit-scrollbar){.ax-dlg .ax-cartao,.ax-tela{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ink-3,#5F6D77) 38%,transparent) transparent}}" +
    ".ax-dlg .ax-cartao::-webkit-scrollbar,.ax-tela::-webkit-scrollbar{width:10px}.ax-dlg .ax-cartao::-webkit-scrollbar-track,.ax-tela::-webkit-scrollbar-track{background:transparent;margin:22px 0}" +
    ".ax-dlg .ax-cartao::-webkit-scrollbar-thumb,.ax-tela::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ink-3,#5F6D77) 34%,transparent);border-radius:10px;border:3px solid transparent;background-clip:content-box;min-height:40px}" +
    ".ax-dlg .ax-cartao::-webkit-scrollbar-thumb:hover,.ax-tela::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--blue-deep,#3C659B) 60%,transparent);border:3px solid transparent;background-clip:content-box}";
  CSS += ".ax-bv{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;background:var(--page,#fff);color:var(--ink,#101820);overflow:hidden;transition:opacity .7s ease,visibility 0s linear .7s}.ax-bv.sai{opacity:0;visibility:hidden;pointer-events:none}.ax-bv .ax-fundo i{opacity:1}" +
    ".ax-bv-meio{position:relative;text-align:center;padding:24px}.ax-bv img{height:64px;width:auto;display:block;margin:0 auto 22px;opacity:0;animation:ax-ap .7s .15s ease forwards}" +
    ".ax-bv small{display:block;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3,#5F6D77);opacity:0;animation:ax-ap .7s .45s ease forwards}" +
    ".ax-bv h2{margin:8px 0 0;font:700 clamp(30px,6vw,52px)/1.1 Archivo,system-ui,sans-serif;letter-spacing:-.02em;text-wrap:balance;opacity:0;animation:ax-ap .8s .65s cubic-bezier(.2,.75,.25,1) forwards}" +
    ".ax-bv h2 span{background:linear-gradient(90deg,var(--brand-red,#C2000C),var(--blue-deep,#3C659B));-webkit-background-clip:text;background-clip:text;color:transparent}" +
    "@keyframes ax-ap{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}" +
    "@media (prefers-reduced-motion:reduce){.ax-bv img,.ax-bv small,.ax-bv h2{animation:none;opacity:1}.ax-bv .ax-fundo i{animation:none}}";
  var BV_LOGO = "data:image/webp;base64,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";
  // Tela de boas-vindas ao entrar no Hub; ao sair, a tela inicial sobe de leve.
  function boasVindas(u) {
    if (window.__bvFeito || !doc.body) return; window.__bvFeito = true;
    var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var nome = String((u && u.nome) || "").trim().split(/\s+/)[0] || "colega";
    var el = doc.createElement("div"); el.className = "ax-bv"; el.setAttribute("role", "status");
    el.innerHTML = '<div class="ax-fundo" aria-hidden="true"><i></i><i></i><i></i></div><div class="ax-bv-meio"><img alt="ControlTax" src="' + BV_LOGO + '"><small>Control Hub</small><h2>Bem-vindo, <span></span></h2></div>';
    el.querySelector("h2 span").textContent = nome;
    doc.body.appendChild(el);
    var feito = false, t = null;
    function sair() {
      if (feito) return; feito = true; clearTimeout(t);
      // Anima só o conteúdo da tela inicial (nunca o contêiner inteiro): um ancestral com transform prenderia o botão do usuário, que é fixo, e ele pularia de lugar.
      var home = doc.getElementById("view-home");
      if (home && !home.hidden && !reduz) {
        var alvos = home.querySelectorAll("#home-root > section"); if (!alvos.length) alvos = home.querySelectorAll("#home-root");
        [].forEach.call(alvos, function (x, i) { try { x.animate([{ opacity: 0, transform: "translate3d(0,26px,0)" }, { opacity: 1, transform: "translate3d(0,0,0)" }], { duration: 900, delay: i * 90, easing: "cubic-bezier(.2,.75,.25,1)", fill: "backwards" }); } catch (e) {} });
      }
      el.classList.add("sai"); setTimeout(function () { el.remove(); }, 900);
    }
    t = setTimeout(sair, reduz ? 1200 : 2600);
    el.addEventListener("click", sair); doc.addEventListener("keydown", function k(e) { if (!feito) sair(); doc.removeEventListener("keydown", k); });
  }
  function injetarCss() { if (doc.getElementById("ax-css")) return; var st = doc.createElement("style"); st.id = "ax-css"; st.textContent = CSS; doc.head.appendChild(st); }
  var tela = null;
  function fecharTela() { if (tela) { tela.remove(); tela = null; } doc.documentElement.classList.remove("ax-bloqueado"); }
  function abrirTela() {
    injetarCss();
    if (tela) return tela;
    tela = doc.createElement("div"); tela.className = "ax-tela"; tela.setAttribute("role", "dialog"); tela.setAttribute("aria-modal", "true"); tela.setAttribute("aria-label", "Entrar no Control Hub");
    tela.innerHTML = '<div class="ax-fundo" aria-hidden="true"><i></i><i></i><i></i></div><div class="ax-miolo"><div class="ax-cartao ax-cx" id="ax-cx"><div class="ax-marca"><img class="sig" alt="" src="data:image/webp;base64,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"><img class="nom" alt="ControlTax" src="data:image/webp;base64,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"></div><div id="ax-cartao"></div></div></div><div class="ax-pe" id="ax-pe"></div>';
    inclinar(tela.querySelector("#ax-cx"));
    doc.body.appendChild(tela);
    BACKEND.modo().then(function (m) { var pe = doc.getElementById("ax-pe"); if (pe) pe.textContent = m === "local" ? "Modo de teste: contas guardadas só neste navegador." : "Acesso restrito à equipe. Em caso de dúvida, fale com o administrador."; });
    return tela;
  }
  function campoFl(id, rot, tipo, extra) { return '<div class="ax-campo ax-fl' + (tipo === "password" ? " ax-fsen" : "") + '"><input id="' + id + '" type="' + (tipo || "text") + '" placeholder=" " ' + (extra || "") + '><label for="' + id + '">' + rot + '</label><span class="ax-ln"></span></div>'; }
  function inclinar(el) {
    if (!el || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    el.addEventListener("mousemove", function (e) { var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.style.setProperty("--lx", (x * 100) + "%"); el.style.setProperty("--ly", (y * 100) + "%"); el.style.setProperty("--lo", 1); });
    el.addEventListener("mouseleave", function () { el.style.setProperty("--lo", 0); });
  }
  function cascata(c, passo) { var n = 0, p = passo || 90; [].forEach.call(doc.querySelectorAll("#ax-cx .ax-marca"), function (x) { x.classList.add("ax-in"); x.style.setProperty("--i", n++); }); [].forEach.call(c.querySelectorAll("h1,.ax-sub,.ax-aviso:not([hidden]),.ax-campo,.ax-chk,.ax-erro,.ax-fx,.ax-troca,.ax-acoes"), function (x) { x.classList.add("ax-in"); x.style.setProperty("--i", n++); }); c.style.setProperty("--passo", p + "ms"); }
  function okBtn(bt, rot) { if (!bt) return; bt.classList.remove("carrega"); bt.classList.add("sucesso"); setTimeout(function () { bt.classList.remove("sucesso"); ocupado(bt, false, rot); }, 1000); }
  var BTN_FX = '<span class="t">@</span><span class="anel" aria-hidden="true"></span><svg class="okk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // Dá tempo de a tela desenhar o anel antes do trabalho pesado (cálculo da senha trava a página) e o mantém visível por pelo menos ~0,9 s.
  function esperar(fn) {
    var t0 = Date.now(), resto = function () { return new Promise(function (r) { setTimeout(r, Math.max(0, 900 - (Date.now() - t0))); }); };
    return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 60); }); }).then(fn).then(function (v) { return resto().then(function () { return v; }); }, function (e) { return resto().then(function () { throw e; }); });
  }
  function sucessoTela(fn) {
    var bt = doc.getElementById("ax-ok"), cx = doc.getElementById("ax-cx");
    if (!tela || !bt || !cx || !bt.classList.contains("ax-fx") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { fn(); return; }
    bt.classList.remove("carrega"); bt.classList.add("sucesso");
    setTimeout(function () { cx.classList.add("sai"); setTimeout(fn, 520); }, 600);
  }
  function campo(id, rot, tipo, extra) { return '<div class="ax-campo"><label for="' + id + '">' + rot + '</label><input id="' + id + '" type="' + (tipo || "text") + '" ' + (extra || "") + '></div>'; }
  function cartao() { return doc.getElementById("ax-cartao"); }
  function mostrarErro(msg, ok) { var e = doc.getElementById("ax-erro"); if (e) { e.textContent = msg || ""; e.className = "ax-erro" + (ok ? " ax-ok" : ""); } }
  function ocupado(btn, on, rot) { if (!btn) return; btn.disabled = !!on; var t = btn.querySelector(".t"); if (rot) { if (t) t.textContent = rot; else btn.textContent = rot; } btn.classList.toggle("carrega", !!on && btn.classList.contains("ax-fx")); }
  function pegar(id) { var e = doc.getElementById(id); return e ? e.value : ""; }

  // botão Mostrar/Ocultar nos campos de senha e indicador de força nas senhas novas
  function melhorarSenhas(cont) {
    [].forEach.call(cont.querySelectorAll('input[type="password"]'), function (i) {
      if (i.parentNode.classList.contains("ax-sen") || i.parentNode.querySelector(".ax-olho")) return;
      var fl = i.parentNode.classList.contains("ax-fl"), w;
      if (fl) w = i.parentNode; else { w = doc.createElement("div"); w.className = "ax-sen"; i.parentNode.insertBefore(w, i); w.appendChild(i); }
      var b = doc.createElement("button"); b.type = "button"; b.className = "ax-olho fechado"; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="globo" d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle class="pupila" cx="12" cy="12" r="2.9"/><path class="corte" d="M4 4l16 16"/></svg>'; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", "Mostrar a senha");
      b.onclick = function () { var vis = i.type === "password"; i.type = vis ? "text" : "password"; b.classList.toggle("fechado", !vis); b.setAttribute("aria-pressed", String(vis)); b.setAttribute("aria-label", vis ? "Ocultar a senha" : "Mostrar a senha"); b.classList.remove("pisca"); void b.offsetWidth; b.classList.add("pisca"); i.focus(); };
      w.appendChild(b);
      if (i.getAttribute("autocomplete") === "new-password" && (i.id === "ax-senha" || i.id === "ax-n1" || i.id === "ax-s1")) {
        var f = doc.createElement("div"); f.className = "au-forca"; f.setAttribute("data-forca", ""); w.parentNode.insertBefore(f, w.nextSibling);
        i.addEventListener("input", function () { pintarForca(w.parentNode, i.value); });
      }
    });
  }
  function telaEntrar(aba, aviso) {
    abrirTela(); var c = cartao(), criar = aba === "criar";
    BACKEND.listar("auth_usuarios").then(function (l) { var av = doc.getElementById("ax-primeiro"); if (av && !l.length) av.hidden = false; }, function () {});
    c.innerHTML = '<h1>' + (criar ? "Criar conta" : "Control Hub") + '</h1><p class="ax-sub">' + (criar ? "O cadastro só vale depois de aprovado pelo administrador." : "Entre para continuar de onde parou.") + '</p>' +
      '<div class="ax-aviso" id="ax-primeiro" hidden>Ainda não há nenhuma conta. A primeira que for criada vira <b>Administrador</b> e já entra liberada.</div>' +
      (aviso ? '<div class="ax-aviso">' + esc(aviso) + '</div>' : '') +
      '<form id="ax-form" autocomplete="on" novalidate>' +
      (criar ? campoFl("ax-nome", "Nome completo", "text", 'autocomplete="name" maxlength="80" required') + campoFl("ax-email", "E-mail", "email", 'autocomplete="email" maxlength="120" required') + campoFl("ax-login", "Usuário", "text", 'autocomplete="username" maxlength="32" autocapitalize="none" spellcheck="false" required') +
        campoFl("ax-senha", "Senha", "password", 'autocomplete="new-password" maxlength="100" required') + '<p class="ax-dica" style="margin:-6px 0 10px">Pelo menos 8 caracteres, com letras e números.</p>' + campoFl("ax-conf", "Repita a senha", "password", 'autocomplete="new-password" maxlength="100" required')
       : campoFl("ax-ident", "Usuário ou e-mail", "text", 'autocomplete="username" autocapitalize="none" spellcheck="false" required') + campoFl("ax-senha", "Senha", "password", 'autocomplete="current-password" required') +
        '<label class="ax-chk"><input type="checkbox" id="ax-manter"> Manter conectado neste computador</label><div style="text-align:right;margin:-2px 0 8px"><button type="button" class="ax-link" id="ax-esq">Esqueci a senha</button></div>') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim ax-fx" id="ax-ok" aria-label="' + (criar ? "Criar conta" : "Entrar") + '">' + BTN_FX.replace("@", criar ? "Criar conta" : "Entrar") + '</button></form>' +
      '<p class="ax-troca">' + (criar ? "Já tem conta?" : "Ainda não tem conta?") + '<button type="button" data-aba="' + (criar ? "entrar" : "criar") + '">' + (criar ? "Entrar" : "Criar conta") + '</button></p>';
    [].forEach.call(c.querySelectorAll("[data-aba]"), function (b) { b.onclick = function () { telaEntrar(b.getAttribute("data-aba")); }; });
    melhorarSenhas(c); cascata(c);
    var esq = doc.getElementById("ax-esq"); if (esq) esq.onclick = function () { telaEsqueci(pegar("ax-ident")); };
    var f = doc.getElementById("ax-form"), foco = doc.getElementById(criar ? "ax-nome" : "ax-ident"); if (foco) setTimeout(function () { foco.focus(); }, 30);
    f.onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok");
      if (criar) {
        ocupado(bt, true, "Criando…");
        esperar(function () { return criarConta({nome: pegar("ax-nome"), email: pegar("ax-email"), login: pegar("ax-login"), senha: pegar("ax-senha"), confirma: pegar("ax-conf")})
          .then(function (r) { return entrarConta(pegar("ax-login"), pegar("ax-senha"), false); }); }).then(depoisDeEntrar).catch(function (e) { ocupado(bt, false, "Criar conta"); mostrarErro(e.amigavel ? e.message : "Não consegui criar a conta agora. Tente de novo."); if (!e.amigavel) console.error(e); });
      } else {
        ocupado(bt, true, "Entrando…");
        esperar(function () { return entrarConta(pegar("ax-ident"), pegar("ax-senha"), doc.getElementById("ax-manter").checked); }).then(depoisDeEntrar).catch(function (e) { ocupado(bt, false, "Entrar"); mostrarErro(e.amigavel ? e.message : "Não consegui entrar agora. Tente de novo. (" + String((e && e.message) || e).slice(0, 80) + ")"); if (!e.amigavel) console.error(e); });
      }
    };
  }
  function telaEspera(u) {
    abrirTela(); var c = cartao();
    c.innerHTML = '<h1>Cadastro enviado</h1><p class="ax-sub">Olá, ' + esc(u.nome.split(" ")[0]) + '. Sua conta está aguardando a liberação do administrador. Quando ela for aprovada, é só entrar de novo.</p><div class="ax-erro" id="ax-erro" role="status"></div>' +
      '<div class="ax-acoes"><button type="button" class="ax-btn" id="ax-ver">Verificar de novo</button><button type="button" class="ax-btn" id="ax-sai">Sair</button></div>';
    doc.getElementById("ax-ver").onclick = function () {
      BACKEND.ler("auth_usuarios/" + u.id).then(function (n) { if (n && n.status === "ativo") { n.id = u.id; depoisDeEntrar(n); } else mostrarErro(n && n.status === "bloqueado" ? "Esta conta foi bloqueada." : "Ainda aguardando a liberação.", false); });
    };
    doc.getElementById("ax-sai").onclick = function () { apagarLS(SESSAO_KEY); telaEntrar("entrar"); };
  }
  function telaTrocaObrigatoria(u) {
    abrirTela(); var c = cartao();
    c.innerHTML = '<h1>Defina uma nova senha</h1><p class="ax-sub">Você entrou com uma senha provisória. Crie a sua para continuar.</p><form id="ax-form" novalidate>' +
      campoFl("ax-n1", "Nova senha", "password", 'autocomplete="new-password" required') + '<p class="ax-dica" style="margin:-6px 0 10px">Pelo menos 8 caracteres, com letras e números.</p>' + campoFl("ax-n2", "Repita a nova senha", "password", 'autocomplete="new-password" required') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim ax-fx" id="ax-ok" aria-label="Salvar e entrar">' + BTN_FX.replace("@", "Salvar e entrar") + '</button></form>';
    melhorarSenhas(c); cascata(c);
    setTimeout(function () { var i = doc.getElementById("ax-n1"); if (i) i.focus(); }, 30);
    doc.getElementById("ax-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok");
      if (pegar("ax-n1") !== pegar("ax-n2")) { mostrarErro("As senhas não são iguais."); return; }
      ocupado(bt, true, "Salvando…");
      esperar(function () { return mudarSenha(u.id, pegar("ax-n1"), false); }).then(function () { return BACKEND.ler("auth_usuarios/" + u.id); }).then(function (n) { n.id = u.id; depoisDeEntrar(n); })
        .catch(function (e) { ocupado(bt, false, "Salvar e entrar"); mostrarErro(e.amigavel ? e.message : "Não consegui salvar. Tente de novo."); });
    };
  }
  /* ---- recuperação de senha: telas ---- */
  function htmlRec(modo) {
    var cad = modo === "cad";
    return campoFl("rc-reserva", "Senha reserva ou palavra-chave", "password", 'autocomplete="off" maxlength="100"') +
      '<p class="ax-dica" style="margin:-6px 0 10px">' + (cad ? "Uma segunda senha só sua (mínimo 6 caracteres), diferente da senha de entrada. Sozinha já basta." : "Se você cadastrou uma, ela sozinha já basta.") + '</p>' +
      '<div class="ax-sep"><span>' + (cad ? "ou informe pelo menos 2 destas" : "ou pelo menos 2 destas informações") + '</span></div>' +
      REC_ITENS.map(function (i) { return campoFl("rc-" + i[0], i[1], i[2], 'autocomplete="off" spellcheck="false"' + (i[3] || ' maxlength="80"')); }).join("");
  }
  function lerRec() { var o = {reserva: pegar("rc-reserva")}; REC_ITENS.forEach(function (i) { o[i[0]] = pegar("rc-" + i[0]); }); return o; }
  function telaRecObrigatoria(u) {
    abrirTela(); var c = cartao();
    c.innerHTML = '<h1>Proteja o seu acesso</h1><p class="ax-sub">Cadastre como recuperar a sua senha caso um dia você a esqueça. É só uma vez e dá para mudar depois, no seu perfil.</p><form id="ax-form" novalidate>' + htmlRec("cad") +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim ax-fx" id="ax-ok" aria-label="Salvar e entrar">' + BTN_FX.replace("@", "Salvar e entrar") + '</button></form>' +
      '<p class="ax-troca"><button type="button" id="ax-sai">Sair</button></p>';
    melhorarSenhas(c); cascata(c);
    setTimeout(function () { var i = doc.getElementById("rc-reserva"); if (i) i.focus(); }, 30);
    doc.getElementById("ax-sai").onclick = function () { apagarLS(SESSAO_KEY); telaEntrar("entrar"); };
    doc.getElementById("ax-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok"), f = lerRec();
      ocupado(bt, true, "Salvando…");
      esperar(function () { return salvarRec(u.id, f, false); }).then(function () { return BACKEND.ler("auth_usuarios/" + u.id); }).then(function (n) { n.id = u.id; depoisDeEntrar(n); })
        .catch(function (e) { ocupado(bt, false, "Salvar e entrar"); mostrarErro(e.amigavel ? e.message : "Não consegui salvar. Tente de novo."); if (!e.amigavel) console.error(e); });
    };
  }
  function telaEsqueci(identIni) {
    abrirTela(); var c = cartao();
    c.innerHTML = '<h1>Esqueci a senha</h1><p class="ax-sub">Prove que é você com a senha reserva ou com pelo menos 2 das informações que você cadastrou.</p><form id="ax-form" novalidate>' +
      campoFl("ax-ident", "Usuário ou e-mail", "text", 'autocomplete="username" autocapitalize="none" spellcheck="false" required') + htmlRec("esq") +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim ax-fx" id="ax-ok" aria-label="Continuar">' + BTN_FX.replace("@", "Continuar") + '</button></form>' +
      '<p class="ax-troca">Lembrou?<button type="button" id="ax-volta">Voltar ao login</button></p>';
    melhorarSenhas(c); cascata(c);
    var ii = doc.getElementById("ax-ident"); if (identIni) ii.value = identIni; setTimeout(function () { ii.focus(); }, 30);
    doc.getElementById("ax-volta").onclick = function () { telaEntrar("entrar"); };
    doc.getElementById("ax-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok"), ident = pegar("ax-ident"), prova = lerRec();
      ocupado(bt, true, "Conferindo…");
      esperar(function () { return verificarRec(ident, prova); }).then(function (r) { telaNovaSenhaRec(ident, prova, r.nome); })
        .catch(function (e) { ocupado(bt, false, "Continuar"); mostrarErro(e.amigavel ? e.message : "Não consegui conferir agora. Tente de novo."); if (!e.amigavel) console.error(e); });
    };
  }
  function telaNovaSenhaRec(ident, prova, nome) {
    abrirTela(); var c = cartao();
    c.innerHTML = '<h1>Crie a nova senha</h1><p class="ax-sub">Tudo certo, ' + esc(String(nome || "").split(" ")[0]) + '. Escolha uma nova senha para entrar. Você será desconectado dos outros aparelhos.</p><form id="ax-form" novalidate>' +
      campoFl("ax-n1", "Nova senha", "password", 'autocomplete="new-password" required') + '<p class="ax-dica" style="margin:-6px 0 10px">Pelo menos 8 caracteres, com letras e números.</p>' + campoFl("ax-n2", "Repita a nova senha", "password", 'autocomplete="new-password" required') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim ax-fx" id="ax-ok" aria-label="Salvar nova senha">' + BTN_FX.replace("@", "Salvar nova senha") + '</button></form>';
    melhorarSenhas(c); cascata(c);
    setTimeout(function () { var i = doc.getElementById("ax-n1"); if (i) i.focus(); }, 30);
    doc.getElementById("ax-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok");
      if (pegar("ax-n1") !== pegar("ax-n2")) { mostrarErro("As senhas não são iguais."); return; }
      ocupado(bt, true, "Salvando…");
      esperar(function () { return recuperarSenha(ident, prova, pegar("ax-n1")); }).then(function () { telaEntrar("entrar", "Senha alterada. Entre com a nova senha."); })
        .catch(function (e) { ocupado(bt, false, "Salvar nova senha"); mostrarErro(e.amigavel ? e.message : "Não consegui salvar. Tente de novo."); if (!e.amigavel) console.error(e); });
    };
  }
  function dialogoRec() {
    injetarCss();
    var r = atual && atual.rec, itens = r ? REC_ITENS.filter(function (i) { return r.itens && r.itens[i[0]]; }).map(function (i) { return i[1].toLowerCase(); }) : [];
    var estado = r ? "Cadastrada em " + fmtData(r.em) + (r.reserva ? " · com senha reserva" : "") + (itens.length ? " · " + itens.join(", ") : "") + ". Preencher de novo substitui o que está cadastrado." : "Ainda não há recuperação cadastrada.";
    var d = doc.createElement("div"); d.className = "ax-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Recuperação de senha");
    d.innerHTML = '<div class="ax-fundo" aria-hidden="true"><i></i><i></i><i></i></div><div class="ax-cartao"><h1>Recuperação de senha</h1><p class="ax-sub">' + esc(estado) + '</p><form id="ax-fs" novalidate>' + campoFl("ax-r0", "Senha atual", "password", 'autocomplete="current-password" required') + htmlRec("cad") +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><div class="ax-acoes"><button type="button" class="ax-btn" id="ax-cancel">Cancelar</button><button type="submit" class="ax-btn prim ax-fx" id="ax-oks" style="flex:1" aria-label="Salvar">' + BTN_FX.replace("@", "Salvar") + '</button></div></form></div>';
    doc.body.appendChild(d); melhorarSenhas(d); cascata(d.querySelector(".ax-cartao"), 60);
    var fecha = function () { d.remove(); };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") fecha(); });
    d.querySelector("#ax-cancel").onclick = fecha;
    setTimeout(function () { d.querySelector("#ax-r0").focus(); }, 30);
    d.querySelector("#ax-fs").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = d.querySelector("#ax-oks"), f = lerRec(), atualTxt = d.querySelector("#ax-r0").value;
      ocupado(bt, true, "Salvando…");
      esperar(function () { return salvarRec(atual.id, f, true, atualTxt); }).then(function (rec) { atual.rec = rec; mostrarErro("Recuperação salva.", true); bt.classList.remove("carrega"); bt.classList.add("sucesso"); setTimeout(fecha, 1100); })
        .catch(function (e) { ocupado(bt, false, "Salvar"); mostrarErro(e.amigavel ? e.message : "Não consegui salvar. Tente de novo."); if (!e.amigavel) console.error(e); });
    };
  }
  function depoisDeEntrar(u) {
    if (u.status === "bloqueado") { apagarLS(SESSAO_KEY); telaEntrar("entrar", "Esta conta está bloqueada. Fale com o administrador."); return; }
    if (u.status !== "ativo") { telaEspera(u); return; }
    if (u.trocarSenha) { telaTrocaObrigatoria(u); return; }
    if (!u.rec) { telaRecObrigatoria(u); return; }
    sucessoTela(function () { liberar(u); });
  }
  function liberar(u) {
    atual = u; snapAcesso = assinatura(u); injetarCss(); fecharTela(); desenharChip(); boasVindas(u);
    if (offMeuDoc) offMeuDoc();
    offMeuDoc = BACKEND.ouvirDoc("auth_usuarios/" + u.id, function (n) {
      if (!n || !atual) return;
      var sessao = lerLS(SESSAO_KEY, null);
      if (n.status !== "ativo" || (sessao && (n.sv || 1) !== (sessao.sv || 1)) || assinatura(n) !== snapAcesso) {
        if (n.status !== "ativo" || (sessao && (n.sv || 1) !== (sessao.sv || 1))) apagarLS(SESSAO_KEY);
        ouvintesMudar.forEach(function (f) { try { f(); } catch (e) {} });
        mensagemTopo(n.status !== "ativo" ? "Seu acesso foi encerrado." : "Seu acesso foi alterado pelo administrador. A página vai recarregar.");
        setTimeout(function () { location.reload(); }, 1800);
      }
    });
    if (u.admin) iniciarOuvinteAdmin();
    resolverAguardar(publico(u));
  }
  function mensagemTopo(txt) {
    var m = doc.createElement("div"); m.setAttribute("role", "status"); m.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:100002;background:#101820;color:#fff;padding:10px 16px;border-radius:8px;font:600 13px 'IBM Plex Sans',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)";
    m.textContent = txt; doc.body.appendChild(m);
  }

  /* ============ chip do usuário (barra lateral) e troca de senha ============ */
  function papel(u) { if (u.admin) return "Administrador"; var n = MODS.map(function (m) { return nivelDe(u, m); }).filter(Boolean); if (!n.length) return "Sem acesso a módulos"; return n.indexOf("coord") !== -1 ? "Coordenação" : n.indexOf("analista") !== -1 ? "Analista" : "Consulta"; }
  function iniciais(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); }
  var botaoPop = null;
  function fecharPop() { var p = doc.getElementById("ax-pop"); if (p) p.remove(); [].forEach.call(doc.querySelectorAll(".ax-av"), function (b) { b.setAttribute("aria-expanded", "false"); }); botaoPop = null; }
  function abrirPop(b) {
    if (!b || !atual) return;
    if (doc.getElementById("ax-pop")) { var mesmo = botaoPop === b; fecharPop(); if (mesmo) return; }
    var pop = doc.createElement("div"); pop.id = "ax-pop"; pop.className = "ax-pop"; pop.setAttribute("role", "menu");
    pop.innerHTML = '<div><b>' + esc(atual.nome) + '</b><span>' + esc(papel(atual)) + ' · ' + esc(atual.login) + '</span></div><button type="button" role="menuitem" id="ax-bsenha">Trocar senha</button><button type="button" role="menuitem" id="ax-bsair">Sair</button>';
    doc.body.appendChild(pop); botaoPop = b;
    var r = b.getBoundingClientRect(), h = pop.offsetHeight, w = pop.offsetWidth, x = r.right + 10;
    if (x + w > innerWidth - 8) x = r.left - w - 10;
    pop.style.left = Math.max(8, x) + "px"; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.bottom - h)) + "px";
    b.setAttribute("aria-expanded", "true");
    doc.getElementById("ax-bsenha").onclick = function () { fecharPop(); dialogoSenha(); };
    doc.getElementById("ax-bsair").onclick = function () { fecharPop(); sair(); };
    setTimeout(function () { var f = doc.getElementById("ax-bsenha"); if (f) f.focus(); }, 0);
  }
  doc.addEventListener("click", function (e) { if (!e.target.closest || (!e.target.closest("#ax-pop") && !e.target.closest(".ax-av"))) fecharPop(); });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape") { var p = doc.getElementById("ax-pop"); if (p) { var b = botaoPop; fecharPop(); if (b) b.focus(); } } });
  function botaoConta(cls) {
    var b = doc.createElement("button"); b.type = "button"; b.className = "ax-av " + cls; b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Meu perfil: " + atual.nome); b.title = atual.nome + " · configurações do perfil"; aplicarAvatar(b); b.onclick = function () { abrirPerfil(b); }; return b;
  }
  // Dois lugares: na barra lateral (quando um módulo está aberto) e no canto da tela inicial.
  function desenharChip() {
    injetarCss(); [].forEach.call(doc.querySelectorAll("#ax-chip,#ax-chip-home"), function (n) { n.remove(); });
    if (!atual) return;
    var alvo = doc.querySelector(".rail-bottom");
    if (alvo) { var c = doc.createElement("div"); c.className = "ax-chip"; c.id = "ax-chip"; c.appendChild(botaoConta("ax-av-rail")); alvo.parentNode.insertBefore(c, alvo); }
    var home = doc.getElementById("view-home");
    if (home) { var h = doc.createElement("div"); h.id = "ax-chip-home"; h.className = "ax-chip-home"; h.appendChild(botaoConta("ax-av-home")); home.insertBefore(h, home.firstChild); }
  }

  /* ============ configurações do perfil (botão do usuário) ============ */
  var CORES_AV = ["#3C659B", "#C2000C", "#167A45", "#B5530C", "#6B4EA0", "#0F7B8A", "#8A5A00", "#47545F"];
  function aplicarAvatar(b, u, grande) {
    u = u || atual; if (!b || !u) return;
    b.textContent = ""; b.style.backgroundImage = ""; b.classList.remove("tem-foto");
    if (u.avatarCor) b.style.background = u.avatarCor; else b.style.background = "";
    if (u.foto) { b.classList.add("tem-foto"); b.style.backgroundImage = "url(" + u.foto + ")"; b.style.backgroundSize = "cover"; b.style.backgroundPosition = "center"; }
    else b.textContent = iniciais(u.nome);
  }
  // Foto: recorta o centro, reduz para 160 px e guarda como JPEG pequeno (cerca de 8 KB) no próprio cadastro.
  function fotoReduzida(file) {
    return createImageBitmap(file).then(function (bmp) {
      var lado = Math.min(bmp.width, bmp.height), cv = doc.createElement("canvas"); cv.width = cv.height = 160;
      cv.getContext("2d").drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 160, 160);
      return cv.toDataURL("image/jpeg", 0.85);
    });
  }
  function abrirPerfil(botao) {
    if (!atual || doc.getElementById("ax-perfil")) return;
    injetarCss(); fecharPop();
    var hub = window.__hubApi || {}, cfgH = hub.cfg || {};
    var rascunho = {foto: atual.foto || "", cor: atual.avatarCor || ""}, orig = JSON.stringify([atual.nome, atual.email || "", atual.telefone || "", atual.foto || "", atual.avatarCor || "", (atual.prefs || {}).inicio || ""]);
    var mods = MODS.filter(function (m) { return nivelDe(atual, m); });
    var inicios = [["", "Início (padrão)"]].concat(mods.map(function (m) { return [m, MODC[m] || m]; }));
    var tema = cfgH.tema ? cfgH.tema() : "";
    var d = doc.createElement("div"); d.className = "ax-dlg"; d.id = "ax-perfil"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Configurações do perfil");
    d.innerHTML = '<div class="ax-fundo" aria-hidden="true"><i></i><i></i><i></i></div><div class="ax-cartao ax-pf"><div class="ax-pf-topo"><span class="ax-av ax-pf-av" id="pf-av" aria-hidden="true"></span><div class="ax-pf-id"><h1 id="pf-tit"></h1><span id="pf-papel"></span></div><button type="button" class="ax-pf-x" id="pf-x" aria-label="Fechar">✕</button></div>' +
      '<form id="pf-form" novalidate>' +
      '<section><h2>Perfil</h2>' + campoFl("pf-nome", "Nome de exibição", "text", 'maxlength="60" autocomplete="name" required') + campoFl("pf-email", "E-mail", "email", 'maxlength="120" autocomplete="email"') + campoFl("pf-tel", "Telefone ou ramal", "text", 'maxlength="30" autocomplete="tel"') +
      '<div class="ax-campo"><label>Foto e cor do avatar</label><div class="ax-pf-foto"><button type="button" class="ax-btn" id="pf-foto-b">Escolher foto</button><button type="button" class="ax-btn" id="pf-foto-x">Remover foto</button><input type="file" id="pf-foto" accept="image/*" hidden></div><div class="ax-pf-cores" role="group" aria-label="Cor do avatar">' + CORES_AV.map(function (c) { return '<button type="button" class="ax-pf-cor" data-cor="' + c + '" style="background:' + c + '" aria-label="Cor ' + c + '" aria-pressed="false"></button>'; }).join("") + '</div></div></section>' +
      '<section><h2>Preferências</h2><div class="ax-campo" id="pf-tema-c"><label id="pf-tema-l">Tema</label><div class="ax-tema2" id="pf-tema" role="radiogroup" aria-labelledby="pf-tema-l"><button type="button" role="radio" aria-checked="false" data-v="light"><i class="sw claro"></i>Claro</button><button type="button" role="radio" aria-checked="false" data-v="dark"><i class="sw escuro"></i>Escuro</button></div></div>' +
      '<div class="ax-campo"><label for="pf-inicio">Abrir o Hub direto em</label><select id="pf-inicio">' + inicios.map(function (i) { return '<option value="' + esc(i[0]) + '">' + esc(i[1]) + '</option>'; }).join("") + '</select></div>' +
      (hub.abrirConfig ? '<div class="ax-pf-lin"><button type="button" class="ax-btn" id="pf-cfg-ass">Configurações do assistente</button><button type="button" class="ax-btn" id="pf-cfg-hub">Configurações do Hub</button></div>' : '') + '</section>' +
      '<section><h2>Meu acesso</h2><ul class="ax-pf-ac">' + MODS.map(function (m) { return '<li><span>' + esc(MODC[m] || m) + '</span><b>' + esc(NIVN[nivelDe(atual, m) || ""] || "Sem acesso") + '</b></li>'; }).join("") + '</ul>' +
      (atual.analista && Object.keys(atual.analista).some(function (k) { return atual.analista[k]; }) ? '<p class="ax-sub">Vinculado como analista: ' + esc(Object.keys(atual.analista).map(function (k) { return atual.analista[k] ? (MODC[k] || k) + ": " + atual.analista[k] : ""; }).filter(Boolean).join(" · ")) + '. Quem altera o acesso é o administrador.</p>' : '<p class="ax-sub">O acesso aos módulos é definido pelo administrador.</p>') + '</section>' +
      '<section><h2>Segurança</h2><div class="ax-pf-lin"><button type="button" class="ax-btn" id="pf-senha">Trocar senha</button><button type="button" class="ax-btn" id="pf-rec">Recuperação de senha</button><button type="button" class="ax-btn" id="pf-sair">Sair deste aparelho</button></div></section>' +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><div class="ax-acoes"><button type="button" class="ax-btn" id="pf-cancel">Fechar</button><button type="submit" class="ax-btn prim ax-fx" id="pf-ok" style="flex:1" aria-label="Salvar perfil">' + BTN_FX.replace("@", "Salvar perfil") + '</button></div></form></div>';
    doc.body.appendChild(d); cascata(d.querySelector(".ax-cartao"), 40);
    var $ = function (id) { return d.querySelector("#" + id); };
    $("pf-nome").value = atual.nome || ""; $("pf-email").value = atual.email || ""; $("pf-tel").value = atual.telefone || "";
    var marcaTema = function (v) { [].forEach.call($("pf-tema").querySelectorAll("button"), function (b) { var on = b.getAttribute("data-v") === v; b.setAttribute("aria-checked", on ? "true" : "false"); b.tabIndex = on || (!v && b.getAttribute("data-v") === "light") ? 0 : -1; }); };
    if (tema) marcaTema(tema); else $("pf-tema-c").hidden = true;
    $("pf-inicio").value = (atual.prefs || {}).inicio || "";
    var pintar = function () {
      var nome = $("pf-nome").value.trim() || atual.nome, av = $("pf-av"); aplicarAvatar(av, {nome: nome, foto: rascunho.foto, avatarCor: rascunho.cor});
      $("pf-tit").textContent = nome; $("pf-papel").textContent = papel(atual) + " · " + atual.login;
      [].forEach.call(d.querySelectorAll(".ax-pf-cor"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cor") === rascunho.cor)); });
      $("pf-foto-x").hidden = !rascunho.foto;
    };
    pintar();
    var fecha = function () { d.remove(); if (botao && botao.isConnected) botao.focus(); };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") fecha(); });
    d.addEventListener("mousedown", function (e) { if (e.target === d) fecha(); });
    $("pf-x").onclick = fecha; $("pf-cancel").onclick = fecha;
    $("pf-nome").addEventListener("input", pintar);
    [].forEach.call(d.querySelectorAll(".ax-pf-cor"), function (b) { b.onclick = function () { rascunho.cor = rascunho.cor === b.getAttribute("data-cor") ? "" : b.getAttribute("data-cor"); pintar(); }; });
    $("pf-foto-b").onclick = function () { $("pf-foto").click(); };
    $("pf-foto-x").onclick = function () { rascunho.foto = ""; pintar(); };
    $("pf-foto").onchange = function () {
      var f = this.files && this.files[0]; this.value = ""; if (!f) return;
      if (!/^image\//.test(f.type)) { mostrarErro("Escolha um arquivo de imagem."); return; }
      fotoReduzida(f).then(function (u) { rascunho.foto = u; mostrarErro(""); pintar(); }).catch(function () { mostrarErro("Não consegui ler essa imagem. Tente outra."); });
    };
    $("pf-tema").onclick = function (e) { var b = e.target.closest("button[data-v]"); if (!b) return; marcaTema(b.getAttribute("data-v")); if (cfgH.setTema) cfgH.setTema(b.getAttribute("data-v")); };
    var abre = function (aba) { return function () { fecha(); try { aba === "hub" ? hub.abrirConfig("geral") : hub.abrirConfig("assistente"); } catch (e) {} }; };
    if ($("pf-cfg-ass")) { $("pf-cfg-ass").onclick = abre("ass"); $("pf-cfg-hub").onclick = abre("hub"); }
    $("pf-senha").onclick = function () { fecha(); dialogoSenha(); };
    $("pf-rec").onclick = function () { fecha(); dialogoRec(); };
    $("pf-sair").onclick = function () { fecha(); sair(); };
    setTimeout(function () { $("pf-nome").focus(); }, 30);
    d.querySelector("#pf-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro("");
      var nome = $("pf-nome").value.trim().replace(/\s+/g, " "), email = $("pf-email").value.trim(), tel = $("pf-tel").value.trim(), inicio = $("pf-inicio").value;
      if (nome.length < 2) { mostrarErro("Digite o seu nome."); $("pf-nome").focus(); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mostrarErro("Esse e-mail não parece certo."); $("pf-email").focus(); return; }
      var novo = JSON.stringify([nome, email, tel, rascunho.foto, rascunho.cor, inicio]);
      if (novo === orig) { mostrarErro("Nada mudou no perfil.", true); return; }
      var bt = $("pf-ok"); ocupado(bt, true, "Salvando…");
      var prefs = Object.assign({}, atual.prefs || {}, {inicio: inicio});
      esperar(function () { return BACKEND.atualizar("auth_usuarios/" + atual.id, {nome: nome, email: email, telefone: tel, foto: rascunho.foto, avatarCor: rascunho.cor, prefs: prefs}); }).then(function () {
        atual.nome = nome; atual.email = email; atual.telefone = tel; atual.foto = rascunho.foto; atual.avatarCor = rascunho.cor; atual.prefs = prefs;
        orig = novo; desenharChip(); okBtn(bt, "Salvar perfil"); mostrarErro("Perfil salvo.", true);
        BACKEND.registrar("perfil", atual.id, atual.id);
      }).catch(function () { ocupado(bt, false, "Salvar perfil"); mostrarErro("Não consegui salvar o perfil. Tente de novo."); });
    };
  }
  function dialogoSenha() {
    injetarCss();
    var d = doc.createElement("div"); d.className = "ax-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Trocar senha");
    d.innerHTML = '<div class="ax-fundo" aria-hidden="true"><i></i><i></i><i></i></div><div class="ax-cartao"><h1>Trocar senha</h1><p class="ax-sub">Ao trocar, você sai dos outros aparelhos.</p><form id="ax-fs" novalidate>' + campoFl("ax-s0", "Senha atual", "password", 'autocomplete="current-password" required') + campoFl("ax-s1", "Nova senha", "password", 'autocomplete="new-password" required') + campoFl("ax-s2", "Repita a nova senha", "password", 'autocomplete="new-password" required') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><div class="ax-acoes"><button type="button" class="ax-btn" id="ax-cancel">Cancelar</button><button type="submit" class="ax-btn prim ax-fx" id="ax-oks" style="flex:1" aria-label="Trocar senha">' + BTN_FX.replace("@", "Trocar senha") + '</button></div></form></div>';
    doc.body.appendChild(d); melhorarSenhas(d); cascata(d.querySelector(".ax-cartao"), 60);
    var fecha = function () { d.remove(); };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") fecha(); });
    d.querySelector("#ax-cancel").onclick = fecha;
    setTimeout(function () { d.querySelector("#ax-s0").focus(); }, 30);
    d.querySelector("#ax-fs").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro("");
      if (d.querySelector("#ax-s1").value !== d.querySelector("#ax-s2").value) { mostrarErro("As senhas não são iguais."); return; }
      var bt = d.querySelector("#ax-oks"); ocupado(bt, true, "Salvando…");
      esperar(function () { return mudarSenha(atual.id, d.querySelector("#ax-s1").value, true, d.querySelector("#ax-s0").value); }).then(function () { mostrarErro("Senha trocada.", true); bt.classList.remove("carrega"); bt.classList.add("sucesso"); setTimeout(fecha, 1100); })
        .catch(function (e) { ocupado(bt, false, "Trocar senha"); mostrarErro(e.amigavel ? e.message : "Não consegui trocar a senha. Tente de novo."); });
    };
  }
  function sair() {
    var uid = atual && atual.id; apagarLS(SESSAO_KEY);
    if (uid) BACKEND.registrar("sair", uid, uid);
    setTimeout(function () { location.reload(); }, 60);
  }

  /* ============ tela de administração de usuários ============ */
  var NIVN = {"": "Sem acesso", consulta: "Consulta", analista: "Analista", coord: "Coordenador"};
  var MODC = {dp: "DP", contabil: "Contábil", fiscal: "Fiscal", portal: "Portal", cardapio: "Cardápio"};
  var DIA = 86400000, PARADO_DIAS = 60;
  function todosNivel(v) { var o = {}; MODS.forEach(function (m) { o[m] = v; }); return o; }
  var MODELOS = [
    {id: "coord_todos", nome: "Coordenador de todos os módulos", niveis: todosNivel("coord")},
    {id: "consulta_todos", nome: "Somente consulta (todos os módulos)", niveis: todosNivel("consulta")},
    {id: "coord_dp", nome: "Coordenador do DP", niveis: {dp: "coord", cardapio: "consulta"}},
    {id: "coord_contabil", nome: "Coordenador do Contábil", niveis: {contabil: "coord", cardapio: "consulta"}},
    {id: "coord_fiscal", nome: "Coordenador do Fiscal", niveis: {fiscal: "coord", cardapio: "consulta"}},
    {id: "coord_portal", nome: "Coordenador do Portal do Cliente", niveis: {portal: "coord", cardapio: "consulta"}},
    {id: "an_dp", nome: "Analista do DP", niveis: {dp: "analista", cardapio: "consulta"}},
    {id: "an_contabil", nome: "Analista do Contábil", niveis: {contabil: "analista", cardapio: "consulta"}},
    {id: "an_fiscal", nome: "Analista do Fiscal", niveis: {fiscal: "analista", cardapio: "consulta"}},
    {id: "an_portal", nome: "Analista do Portal do Cliente", niveis: {portal: "analista", cardapio: "consulta"}}
  ];
  var ROTULO = {login: "entrou", sair: "saiu", senha_errada: "errou a senha", cadastro: "criou a conta", primeiro_admin: "criou a conta (primeiro administrador)", troca_senha: "trocou a senha", aprovado: "teve a conta aprovada", bloqueado: "foi bloqueado(a)", desbloqueado: "foi desbloqueado(a)", senha_redefinida: "teve a senha redefinida", acesso_alterado: "teve o acesso alterado", recusado: "teve o cadastro recusado", excluido: "foi excluído(a)", criado_admin: "teve a conta criada pelo administrador", dados_alterados: "teve nome, e-mail ou usuário corrigido", sessoes_encerradas: "teve as sessões encerradas", recuperacao_cadastrada: "cadastrou a recuperação de senha", senha_recuperada: "recuperou a senha (esqueci a senha)", recuperacao_errada: "errou os dados de recuperação"};
  var GRUPOS = {entradas: ["login", "sair"], erros: ["senha_errada", "recuperacao_errada"], acessos: ["acesso_alterado", "aprovado", "bloqueado", "desbloqueado", "senha_redefinida", "dados_alterados", "sessoes_encerradas", "troca_senha", "recuperacao_cadastrada", "senha_recuperada"], contas: ["cadastro", "primeiro_admin", "criado_admin", "recusado", "excluido"]};
  var admin = {aba: null, lista: [], carregado: false, rasc: {}, prov: {}, msgs: {}, undo: {}, aberto: {}, sel: {}, hist: {}, destaque: "", busca: "", fMod: "", fNivel: "", fEsp: "", ordem: "nome", lote: {mod: "", nivel: "consulta"},
    off: null, raiz: null, analistas: {}, novo: null, criado: null, lg: {pessoa: "", tipo: "", dias: 7, mais: 120}, logCache: {}, pendCount: 0, avisouPend: false, toastT: null};
  var pendOuvintes = [];
  function rascunhoNovo() { return {nome: "", email: "", login: "", loginManual: false, senha: senhaProvisoria(), trocar: true, admin: false, niveis: nivelVazio(), analista: {}, erro: "", ocupado: false}; }
  function opcoesNivel(mod) {
    return mod === "cardapio" ? [["", "Sem acesso"], ["consulta", "Consulta"], ["coord", "Coordenador"]] : [["", "Sem acesso"], ["consulta", "Consulta"], ["analista", "Analista"], ["coord", "Coordenador"]];
  }
  function porNome(a, b) { var x = norm(a.nome), y = norm(b.nome); return x < y ? -1 : x > y ? 1 : 0; }
  function achar(id) { return admin.lista.filter(function (x) { return x.id === id; })[0]; }
  function nomesPorId() { var n = {}; admin.lista.forEach(function (u) { n[u.id] = u.nome; }); return n; }
  function dadosEdit(u) {
    var r = admin.rasc[u.id]; if (r) return r;
    r = admin.rasc[u.id] = {nome: u.nome || "", email: u.email || "", login: u.login || "", admin: !!u.admin, niveis: Object.assign(nivelVazio(), u.niveis || {}), analista: Object.assign({}, u.analista || {})};
    return r;
  }
  function mudAcesso(u, e) {
    var r = [];
    if (!!u.admin !== !!e.admin) r.push("Administrador: " + (u.admin ? "sim" : "não") + " → " + (e.admin ? "sim" : "não"));
    if (!e.admin) MODS.forEach(function (m) {
      var a = (u.niveis || {})[m] || "", b = e.niveis[m] || "", na = (u.analista || {})[m] || "", nb = String(e.analista[m] || "").trim();
      if (a !== b || (b === "analista" && na !== nb)) r.push(MODC[m] + ": " + NIVN[a] + " → " + NIVN[b] + (b === "analista" && nb ? " (" + nb + ")" : ""));
    });
    return r;
  }
  function mudIdent(u, e) {
    var r = [];
    if (String(e.nome).trim() !== (u.nome || "")) r.push("Nome");
    if (norm(e.email) !== norm(u.email || "")) r.push("E-mail");
    if (norm(e.login) !== (u.login || "")) r.push("Usuário");
    return r;
  }
  function podarRascunhos() {
    Object.keys(admin.rasc).forEach(function (id) { var u = achar(id); if (!u) { delete admin.rasc[id]; return; } var e = admin.rasc[id]; if (!mudAcesso(u, e).length && !mudIdent(u, e).length) delete admin.rasc[id]; });
    Object.keys(admin.sel).forEach(function (id) { if (!achar(id)) delete admin.sel[id]; });
  }
  function nAdminsAtivos(excecao) { return admin.lista.filter(function (u) { return u.admin && u.status === "ativo" && u.id !== excecao; }).length; }
  function nivEf(u, m) { return u.admin ? "coord" : ((u.niveis || {})[m] || ""); }
  function parado(u) { return u.status === "ativo" && u.ultimoAcesso > 0 && agora() - u.ultimoAcesso > PARADO_DIAS * DIA; }
  function nuncaEntrou(u) { return u.status !== "pendente" && !u.ultimoAcesso; }
  function fmtRel(ms) {
    if (!ms) return "nunca entrou";
    var d = Math.floor((agora() - ms) / DIA);
    return d < 1 ? "hoje" : d === 1 ? "ontem" : "há " + d + " dias";
  }
  function emUso(campo, valor, ignorar) { return admin.lista.some(function (u) { return u.id !== ignorar && norm(campo === "login" ? u.login : u.email) === valor; }); }
  function sugerirLogin(nome) {
    var p = norm(nome).replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    return (p.length > 1 ? p[0] + "." + p[p.length - 1] : p[0] || "").slice(0, 32);
  }
  function forcaSenha(s) {
    s = String(s || ""); if (!s) return {n: 0, t: ""};
    if (validarSenha(s)) return {n: 1, t: "Fraca"};
    var p = (s.length >= 12 ? 1 : 0) + (/[a-z]/.test(s) && /[A-Z]/.test(s) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(s) ? 1 : 0);
    return p >= 2 ? {n: 3, t: "Forte"} : {n: 2, t: "Média"};
  }
  function pintarForca(base, senha) {
    var el = base && base.querySelector("[data-forca]"); if (!el) return;
    var f = forcaSenha(senha); el.setAttribute("data-n", f.n); el.innerHTML = f.n ? '<i></i><span>' + f.t + '</span>' : "";
  }
  function pintarDica(el, r) { if (!el) return; el.textContent = r ? r[0] : ""; el.className = "au-dica" + (r ? (r[1] ? " ok" : " ruim") : ""); }

  /* ----- diálogo de confirmação (sem confirm() nativo) ----- */
  function confirmar(o) {
    return new Promise(function (res) {
      injetarCss();
      var d = doc.createElement("div"); d.className = "ax-dlg"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", o.titulo);
      d.innerHTML = '<div class="ax-cartao"><h1>' + esc(o.titulo) + '</h1><p class="ax-sub">' + esc(o.texto) + '</p><div class="ax-acoes"><button type="button" class="ax-btn" data-r="0">Cancelar</button><button type="button" class="ax-btn prim" data-r="1" style="flex:1">' + esc(o.ok || "Confirmar") + '</button></div></div>';
      doc.body.appendChild(d);
      var fim = function (v) { d.remove(); doc.removeEventListener("keydown", tecla, true); res(v); };
      var tecla = function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); fim(false); } };
      doc.addEventListener("keydown", tecla, true);
      d.addEventListener("click", function (ev) { if (ev.target === d) fim(false); var b = ev.target.closest("[data-r]"); if (b) fim(b.getAttribute("data-r") === "1"); });
      setTimeout(function () { var b = d.querySelector('[data-r="0"]'); if (b) b.focus(); }, 20);
    });
  }

  /* ----- mensagens ----- */
  function cardEl(id) { return admin.raiz && admin.raiz.querySelector('.au-u[data-id="' + id + '"]'); }
  function htmlMsg(id) { var m = admin.msgs[id]; return m ? esc(m.txt) + (m.undo && admin.undo[id] ? ' <button type="button" class="ax-btn" data-ac="desfazer">Desfazer</button>' : "") : ""; }
  function pintarMsg(id) { var c = cardEl(id), n = c && c.querySelector("[data-msg]"); if (n) { n.className = "au-msg" + (admin.msgs[id] && admin.msgs[id].ok ? " ok" : ""); n.innerHTML = htmlMsg(id); } }
  function toastAdmin(txt, ok, undoId) {
    var t = admin.raiz && admin.raiz.querySelector(".au-toast"); if (!t) return;
    clearTimeout(admin.toastT);
    t.className = "au-toast" + (txt ? " on" : "") + (ok ? " ok" : ""); t.innerHTML = txt ? '<span>' + esc(txt) + '</span>' + (undoId ? '<button type="button" data-undo="' + esc(undoId) + '">Desfazer</button>' : "") + '<button type="button" data-toast="x" aria-label="Fechar aviso">×</button>' : "";
    if (txt) admin.toastT = setTimeout(function () { t.className = "au-toast"; t.innerHTML = ""; }, undoId ? 12000 : 7000);
  }
  function msgCard(id, txt, ok, undo) {
    var m = admin.msgs[id]; if (m && m.t) clearTimeout(m.t);
    if (!txt) delete admin.msgs[id];
    else { admin.msgs[id] = {txt: txt, ok: !!ok, undo: !!undo, t: setTimeout(function () { delete admin.msgs[id]; pintarMsg(id); }, undo ? 12000 : 8000)}; var u = achar(id); toastAdmin((u ? u.nome + ": " : "") + txt, ok, undo ? id : ""); }
    pintarMsg(id);
  }
  function copiarTexto(t) {
    var velho = function () { try { var a = doc.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0;top:0"; doc.body.appendChild(a); a.select(); var ok = doc.execCommand("copy"); a.remove(); return ok; } catch (e) { return false; } };
    try { return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return velho(); }); } catch (e) { return Promise.resolve(velho()); }
  }
  function textoAcesso(u, senha) {
    return "Control Hub\nUsuário: " + u.login + (senha ? "\nSenha: " + senha + (u.trocarSenha !== false ? "\n(você vai criar uma senha nova no primeiro acesso)" : "") : "");
  }

  /* ----- filtros e ordenação ----- */
  function passaFiltro(u) {
    if (admin.busca) { var b = norm(admin.busca); if (norm(u.nome + " " + u.login + " " + (u.email || "")).indexOf(b) === -1) return false; }
    var fm = admin.fMod, fn = admin.fNivel;
    if (fm && fn) { if (fn === "sem" ? nivEf(u, fm) !== "" : nivEf(u, fm) !== fn) return false; }
    else if (fm) { if (nivEf(u, fm) === "") return false; }
    else if (fn) { if (fn === "sem" ? MODS.some(function (m) { return nivEf(u, m) !== ""; }) : !MODS.some(function (m) { return nivEf(u, m) === fn; })) return false; }
    if (admin.fEsp === "nunca" && !nuncaEntrou(u)) return false;
    if (admin.fEsp === "parado" && !parado(u)) return false;
    if (admin.fEsp === "admin" && !u.admin) return false;
    return true;
  }
  function temFiltro() { return !!(admin.busca || admin.fMod || admin.fNivel || admin.fEsp); }
  function ordenar(l) {
    var o = admin.ordem, c = l.slice();
    if (o === "cadastro") c.sort(function (a, b) { return (b.criadoEm || 0) - (a.criadoEm || 0); });
    else if (o === "acesso") c.sort(function (a, b) { return (b.ultimoAcesso || 0) - (a.ultimoAcesso || 0); });
    else if (o === "parado") c.sort(function (a, b) { return (a.ultimoAcesso || 0) - (b.ultimoAcesso || 0) || porNome(a, b); });
    else c.sort(porNome);
    return c;
  }
  function estaAberto(u) { return admin.aberto[u.id] !== undefined ? admin.aberto[u.id] : u.status === "pendente"; }

  /* ----- peças de HTML ----- */
  function blocoModulos(e, u) {
    return MODS.map(function (m) {
      var mudou = u && !e.admin && (((u.niveis || {})[m] || "") !== (e.niveis[m] || "") || (e.niveis[m] === "analista" && String((u.analista || {})[m] || "") !== String(e.analista[m] || "").trim()));
      var sel = '<select data-n="' + m + '" aria-label="Nível em ' + esc(MODN[m]) + '"' + (e.admin ? " disabled" : "") + '>' + opcoesNivel(m).map(function (o) { return '<option value="' + o[0] + '"' + ((e.admin ? "coord" : e.niveis[m]) === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select>';
      var an = COM_ANALISTA.indexOf(m) !== -1 && !e.admin && e.niveis[m] === "analista" ? '<input data-a="' + m + '" list="au-dl-' + m + '" value="' + esc(e.analista[m] || "") + '" placeholder="Nome do analista em ' + esc(MODN[m]) + '" aria-label="Nome do analista em ' + esc(MODN[m]) + '">' : "";
      return '<div class="au-mod' + (mudou ? " mudou" : "") + '"><label>' + esc(MODN[m]) + '</label>' + sel + an + '</div>';
    }).join("");
  }
  function htmlModelo(excluir, attr) {
    var pessoas = admin.lista.filter(function (x) { return x.status !== "pendente" && x.id !== excluir; }).sort(porNome);
    return '<select class="au-modelo" ' + attr + ' aria-label="Preencher os níveis a partir de um modelo ou de outra pessoa"><option value="">Preencher níveis a partir de…</option><optgroup label="Modelos">' +
      MODELOS.map(function (m) { return '<option value="m:' + m.id + '">' + esc(m.nome) + '</option>'; }).join("") + '</optgroup>' +
      (pessoas.length ? '<optgroup label="Copiar os acessos de">' + pessoas.map(function (x) { return '<option value="p:' + esc(x.id) + '">' + esc(x.nome) + '</option>'; }).join("") + '</optgroup>' : "") + '</select>';
  }
  function aplicarModelo(e, v) {
    var nv = nivelVazio(), tipo = v.slice(0, 2), id = v.slice(2);
    if (tipo === "m:") { var m = MODELOS.filter(function (x) { return x.id === id; })[0]; if (!m) return false; Object.assign(nv, m.niveis); }
    else { var u = achar(id); if (!u) return false; MODS.forEach(function (k) { nv[k] = nivEf(u, k); }); }
    var an = {}; COM_ANALISTA.forEach(function (k) { if (nv[k] === "analista" && e.analista[k]) an[k] = e.analista[k]; });
    e.niveis = nv; e.analista = an; return true;
  }
  function tagsDe(u) {
    var eu = atual && atual.id === u.id, t = '<span class="au-tag ' + (u.status === "pendente" ? "pend" : u.status === "bloqueado" ? "blq" : "") + '">' + (u.status === "pendente" ? "Aguardando liberação" : u.status === "bloqueado" ? "Bloqueado" : "Ativo") + '</span>';
    if (u.admin) t += '<span class="au-tag adm">Administrador</span>';
    if (eu) t += '<span class="au-tag">você</span>';
    if (nuncaEntrou(u)) t += '<span class="au-tag pend">Nunca entrou</span>'; else if (parado(u)) t += '<span class="au-tag pend" title="Sem acesso há mais de ' + PARADO_DIAS + ' dias">Parado</span>';
    return t;
  }
  function chipsNivel(u) {
    if (u.admin) return '<span class="au-nv nv-coord">Todos os módulos · Admin</span>';
    var c = MODS.filter(function (m) { return nivEf(u, m); }).map(function (m) { return '<span class="au-nv nv-' + nivEf(u, m) + '" title="' + esc(MODN[m] + ": " + NIVN[nivEf(u, m)]) + '">' + MODC[m] + ' · ' + NIVN[nivEf(u, m)] + '</span>'; });
    return c.length ? c.join("") : '<span class="au-nv nv-sem">Sem módulos</span>';
  }
  function cardUsuario(u) {
    var e = dadosEdit(u), eu = atual && atual.id === u.id, pend = u.status === "pendente";
    var mAc = mudAcesso(u, e), mId = mudIdent(u, e), diff = pend ? mAc.concat(mId) : mId.concat(mAc);
    var idf = function (k, rot, tipo, extra) { return '<div class="au-mod' + (mId.indexOf(k === "nome" ? "Nome" : k === "email" ? "E-mail" : "Usuário") !== -1 ? " mudou" : "") + '"><label>' + rot + '</label><input data-f="' + k + '" type="' + tipo + '" value="' + esc(e[k]) + '" aria-label="' + rot + '" autocomplete="off" ' + (extra || "") + '></div>'; };
    var ident = '<div class="au-mods">' + idf("nome", "Nome", "text", 'maxlength="80"') + idf("email", "E-mail", "email") + idf("login", "Usuário (para entrar)", "text", 'autocapitalize="none" spellcheck="false"') + '</div><div class="au-dica" data-dica></div>';
    var prov = admin.prov[u.id] ? '<div class="au-prov"><span>Senha provisória (mostrada só agora):</span><code>' + esc(admin.prov[u.id]) + '</code><button type="button" class="ax-btn" data-copia="' + esc(u.id) + '">Copiar</button></div>' : "";
    var bot = pend ? '<button type="button" class="ax-btn prim" data-ac="aprovar">Aprovar e salvar</button><button type="button" class="ax-btn perigo" data-ac="recusar">Recusar cadastro</button>'
      : '<button type="button" class="ax-btn prim" data-ac="salvar"' + (mId.length ? "" : " disabled") + '>Salvar dados</button>' +
        '<button type="button" class="ax-btn" data-ac="copiar" title="Copia o usuário e a senha para mandar à pessoa">Copiar acesso</button><button type="button" class="ax-btn" data-ac="senha">Redefinir senha</button>' +
        (eu ? "" : '<button type="button" class="ax-btn" data-ac="sessoes" title="Desconecta a pessoa de todos os aparelhos, sem bloquear a conta">Encerrar sessões</button>') +
        (u.status === "bloqueado" ? '<button type="button" class="ax-btn" data-ac="desbloquear">Desbloquear</button>' : (eu ? "" : '<button type="button" class="ax-btn perigo" data-ac="bloquear">Bloquear</button>')) +
        (eu ? "" : '<button type="button" class="ax-btn perigo" data-ac="excluir">Excluir</button>') + '<button type="button" class="ax-btn" data-ac="hist" aria-expanded="' + !!admin.hist[u.id] + '">Histórico</button>';
    return '<div class="au-u' + (pend ? " pend" : "") + '" data-id="' + esc(u.id) + '">' + ident +
      '<div class="au-nivhead"><label class="ax-chk" style="margin:0"><input type="checkbox" data-adm' + (e.admin ? " checked" : "") + (eu && nAdminsAtivos(u.id) === 0 ? " disabled" : "") + '> Administrador (acesso total e gerencia usuários)</label>' + htmlModelo(u.id, 'data-modelo-card') + '</div>' +
      '<div class="au-mods">' + blocoModulos(e, u) + '</div>' +
      '<div class="au-nota">' + (pend ? "Escolha os módulos e clique em Aprovar e salvar." : "Os níveis são salvos assim que você escolhe, e dá para desfazer logo depois.") + '</div>' +
      '<div class="au-diff" data-diff' + (diff.length ? "" : " hidden") + '>' + (diff.length ? (pend ? "Ao aprovar: " : "Ainda não salvo: ") + esc(diff.join(" · ")) : "") + '</div>' + prov +
      '<div class="au-bot">' + bot + '<span class="au-msg' + (admin.msgs[u.id] && admin.msgs[u.id].ok ? " ok" : "") + '" data-msg role="status">' + htmlMsg(u.id) + '</span></div>' +
      (admin.hist[u.id] ? '<div class="au-hist" data-hist><div class="au-vazio">Carregando…</div></div>' : "") + '</div>';
  }
  function linhaUsuario(u) {
    var aberto = estaAberto(u);
    return '<div class="au-item' + (admin.destaque === u.id ? " destaque" : "") + (u.status === "pendente" ? " pend" : "") + '" data-id="' + esc(u.id) + '"><div class="au-lin"><input type="checkbox" class="au-ck" data-sel aria-label="Selecionar ' + esc(u.nome) + '"' + (admin.sel[u.id] ? " checked" : "") + '>' +
      '<button type="button" class="au-head" data-abre aria-expanded="' + aberto + '"><span class="au-av">' + esc(iniciais(u.nome)) + '</span><span class="au-id"><b>' + esc(u.nome) + '</b><small>' + esc(u.login) + ' · ' + esc(u.email || "") + '</small></span><span class="au-tags">' + tagsDe(u) + '</span><span class="au-resumo">' + chipsNivel(u) + '</span><span class="au-ult" title="' + esc(fmtData(u.ultimoAcesso)) + '">' + esc(fmtRel(u.ultimoAcesso)) + '</span><span class="au-seta" aria-hidden="true">' + (aberto ? "▴" : "▾") + '</span></button></div>' + (aberto ? cardUsuario(u) : "") + '</div>';
  }
  function htmlLista() {
    var st = admin.aba === "pendentes" ? "pendente" : admin.aba === "bloqueados" ? "bloqueado" : "ativo", todos = admin.lista.filter(passaFiltro), l = ordenar(todos.filter(function (u) { return u.status === st; }));
    var marcadas = l.length && l.every(function (u) { return admin.sel[u.id]; }), abertas = l.length && l.every(estaAberto);
    var cab = l.length ? '<div class="au-listahead"><label class="ax-chk" style="margin:0"><input type="checkbox" data-todos' + (marcadas ? " checked" : "") + '> Selecionar todas (' + l.length + ')</label><button type="button" class="ax-btn" data-expandir="' + (abertas ? "0" : "1") + '">' + (abertas ? "Recolher todas" : "Expandir todas") + '</button><span class="au-dica">Atalhos: <kbd>/</kbd> buscar · <kbd>N</kbd> novo usuário · <kbd>Esc</kbd> fechar</span></div>' : "";
    if (l.length) return cab + '<div class="au-lista">' + l.map(linhaUsuario).join("") + '</div>';
    var nomeAba = {pendente: "Pendentes", ativo: "Ativos", bloqueado: "Bloqueados"}, outras = ["pendente", "ativo", "bloqueado"].filter(function (s) { return s !== st; }).map(function (s) { return {s: s, n: todos.filter(function (u) { return u.status === s; }).length}; }).filter(function (x) { return x.n; });
    var msg = temFiltro() ? "Nenhuma pessoa em " + nomeAba[st] + " corresponde à busca e aos filtros." : st === "pendente" ? "Nenhum cadastro aguardando liberação." : st === "ativo" ? "Nenhum usuário ativo." : "Nenhum usuário bloqueado.";
    return '<div class="au-vazio">' + msg + (outras.length ? '<div class="au-outras">Há resultados em: ' + outras.map(function (x) { return '<button type="button" class="ax-btn" data-aba="' + (x.s === "pendente" ? "pendentes" : x.s === "ativo" ? "ativos" : "bloqueados") + '">' + nomeAba[x.s] + ' (' + x.n + ')</button>'; }).join(" ") + '</div>' : "") + (temFiltro() ? '<div class="au-outras"><button type="button" class="ax-btn" data-limpar>Limpar filtros</button></div>' : "") + '</div>';
  }
  function htmlMatriz() {
    var l = ordenar(admin.lista.filter(passaFiltro).filter(function (u) { return u.status !== "pendente"; })), npend = admin.lista.filter(function (u) { return u.status === "pendente"; }).length;
    if (!l.length) return '<div class="au-vazio">' + (temFiltro() ? "Nenhuma pessoa corresponde à busca e aos filtros." : "Nenhum usuário para mostrar.") + '</div>';
    var rows = l.map(function (u) {
      var e = dadosEdit(u), eu = atual && atual.id === u.id;
      var cel = MODS.map(function (m) {
        if (e.admin) return '<td class="mx-adm" title="Administrador tem acesso total"><span class="au-nv nv-coord">Admin</span></td>';
        var v = e.niveis[m] || "", mudou = (((u.niveis || {})[m] || "") !== v) || (v === "analista" && String((u.analista || {})[m] || "") !== String(e.analista[m] || "").trim());
        return '<td class="nv-cel nv-' + (v || "sem") + (mudou ? " mudou" : "") + '"><select data-mx="' + m + '" aria-label="' + esc(u.nome + " — " + MODN[m]) + '">' + opcoesNivel(m).map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select>' +
          (v === "analista" && COM_ANALISTA.indexOf(m) !== -1 ? '<input data-mxa="' + m + '" list="au-dl-' + m + '" value="' + esc(e.analista[m] || "") + '" placeholder="Nome do analista" aria-label="Nome do analista de ' + esc(u.nome + " em " + MODN[m]) + '">' : "") + '</td>';
      }).join("");
      return '<tr data-id="' + esc(u.id) + '"' + (u.status === "bloqueado" ? ' class="blq"' : "") + '><th scope="row"><b>' + esc(u.nome) + '</b><small>' + esc(u.login) + (u.status === "bloqueado" ? " · bloqueado" : "") + '</small></th><td class="mx-a"><input type="checkbox" data-mxadm aria-label="' + esc(u.nome) + ' é administrador"' + (e.admin ? " checked" : "") + (eu && nAdminsAtivos(u.id) === 0 ? " disabled" : "") + '></td>' + cel + '</tr>';
    }).join("");
    return '<p class="au-nota">Ajuste os níveis de todo mundo de uma vez. Cada mudança é salva ao escolher (e dá para desfazer).' + (npend ? " Cadastros pendentes (" + npend + ") são aprovados na aba Pendentes." : "") + '</p><div class="au-mx"><table><thead><tr><th>Pessoa</th><th>Admin</th>' + MODS.map(function (m) { return '<th>' + esc(MODC[m]) + '</th>'; }).join("") + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function htmlAcessos() {
    var lg = admin.lg;
    return '<div class="au-filtros-log"><label>Pessoa<select data-lg="pessoa"><option value="">Todas</option>' + admin.lista.slice().sort(porNome).map(function (u) { return '<option value="' + esc(u.id) + '"' + (lg.pessoa === u.id ? " selected" : "") + '>' + esc(u.nome) + '</option>'; }).join("") + '</select></label>' +
      '<label>Tipo<select data-lg="tipo">' + [["", "Todos os eventos"], ["entradas", "Entradas e saídas"], ["erros", "Senhas erradas"], ["acessos", "Mudanças de acesso e senha"], ["contas", "Contas criadas e removidas"]].map(function (o) { return '<option value="' + o[0] + '"' + (lg.tipo === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>' +
      '<label>Período<select data-lg="dias">' + [[7, "Últimos 7 dias"], [30, "Últimos 30 dias"], [90, "Últimos 90 dias"]].map(function (o) { return '<option value="' + o[0] + '"' + (lg.dias === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="au-log" id="au-log"><div class="au-vazio">Carregando os acessos…</div></div>';
  }
  function linhaLog(x, nome, comNome) {
    var por = x.por && x.por !== x.uid ? " · por " + esc(nome[x.por] || "(conta removida)") : "";
    return '<div><time>' + fmtData(Date.parse(x.em)) + '</time><span>' + (comNome ? '<b>' + esc(nome[x.uid] || x.nomeAntigo || "(conta removida)") + '</b> ' : "") + esc(ROTULO[x.tipo] || x.tipo) + (x.det ? ' — ' + esc(x.det) : "") + por + '</span></div>';
  }
  function lerLog(dias) {
    var ks = [], d = new Date(); for (var i = 0; i < dias; i++) { ks.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())); d.setDate(d.getDate() - 1); }
    return Promise.all(ks.map(function (k) {
      var c = admin.logCache[k]; if (c && (k !== ks[0] || agora() - c.em < 15000)) return Promise.resolve(c.itens);
      return BACKEND.ler("auth_log/" + k).then(function (x) { var it = Object.keys((x && x.itens) || {}).map(function (id) { return x.itens[id]; }); admin.logCache[k] = {em: agora(), itens: it}; return it; }, function () { return []; });
    })).then(function (r) { return [].concat.apply([], r).sort(function (a, b) { return a.em < b.em ? 1 : -1; }); });
  }
  function carregarLog() {
    var lg = admin.lg;
    lerLog(lg.dias).then(function (todos) {
      var el = doc.getElementById("au-log"); if (!el) return;
      var tipos = lg.tipo ? GRUPOS[lg.tipo] : null, nome = nomesPorId();
      var l = todos.filter(function (x) { return (!lg.pessoa || x.uid === lg.pessoa) && (!tipos || tipos.indexOf(x.tipo) !== -1); });
      var mostra = l.slice(0, lg.mais);
      el.innerHTML = l.length ? mostra.map(function (x) { return linhaLog(x, nome, true); }).join("") + (l.length > mostra.length ? '<div class="au-mais"><button type="button" class="ax-btn" data-logmais>Mostrar mais (' + (l.length - mostra.length) + ')</button></div>' : "") : '<div class="au-vazio">Sem registros para esse filtro.</div>';
    });
  }
  function pintarHist(id) {
    lerLog(30).then(function (todos) {
      var c = cardEl(id), el = c && c.querySelector("[data-hist]"); if (!el) return;
      var nome = nomesPorId(), meus = todos.filter(function (x) { return x.uid === id; }).slice(0, 15);
      el.innerHTML = '<div class="au-log">' + (meus.length ? meus.map(function (x) { return linhaLog(x, nome, false); }).join("") : '<div class="au-vazio">Sem registros nos últimos 30 dias.</div>') + '</div>';
    });
  }

  /* ----- partes da tela ----- */
  function parte(sel) { return admin.raiz && admin.raiz.querySelector(sel); }
  function contagens() {
    var l = admin.lista;
    return {pend: l.filter(function (u) { return u.status === "pendente"; }).length, ativos: l.filter(function (u) { return u.status === "ativo"; }).length, blq: l.filter(function (u) { return u.status === "bloqueado"; }).length,
      nunca: l.filter(nuncaEntrou).length, parados: l.filter(parado).length, admins: l.filter(function (u) { return u.admin && u.status === "ativo"; }).length};
  }
  function desenharTopo() {
    var c = contagens(), todos = admin.lista.filter(passaFiltro), n = function (s) { return todos.filter(function (u) { return u.status === s; }).length; };
    var chip = function (k, txt, ativo, aviso) { return '<button type="button" class="au-chipr' + (ativo ? " on" : "") + (aviso ? " aviso" : "") + '" data-esp="' + k + '" aria-pressed="' + !!ativo + '">' + txt + '</button>'; };
    var abas = [["pendentes", "Pendentes (" + n("pendente") + ")"], ["ativos", "Ativos (" + n("ativo") + ")"], ["bloqueados", "Bloqueados (" + n("bloqueado") + ")"], ["matriz", "Matriz de acessos"], ["acessos", "Acessos"]];
    parte(".au-topo").innerHTML = '<div class="au-resumo-topo"><span class="au-total"><b>' + admin.lista.length + '</b> ' + (admin.lista.length === 1 ? "pessoa" : "pessoas") + '</span>' +
      chip("pend", '<b>' + c.pend + '</b> aguardando liberação', admin.aba === "pendentes", c.pend > 0) + chip("nunca", '<b>' + c.nunca + '</b> nunca entraram', admin.fEsp === "nunca") +
      chip("parado", '<b>' + c.parados + '</b> paradas há ' + PARADO_DIAS + '+ dias', admin.fEsp === "parado") + chip("admin", '<b>' + c.admins + '</b> ' + (c.admins === 1 ? "administrador" : "administradores"), admin.fEsp === "admin") + '</div>' +
      (c.admins > 3 ? '<div class="au-alerta" role="status">Há ' + c.admins + ' administradores ativos. Quanto menos pessoas com acesso total, menor o risco: considere deixar só quem realmente precisa.</div>' : "") +
      avisoCriado() +
      '<div class="au-linha"><div class="au-abas" role="group" aria-label="Seções">' + abas.map(function (a) { return '<button type="button" data-aba="' + a[0] + '" aria-pressed="' + (admin.aba === a[0]) + '">' + a[1] + '</button>'; }).join("") + '</div><button type="button" class="ax-btn prim au-novobtn" data-novo="abrir">＋ Novo usuário</button></div>';
  }
  function avisoCriado() {
    var c = admin.criado; if (!c) return "";
    return '<div class="au-prov"><span><b>' + esc(c.nome) + '</b> foi criado(a). Passe estes dados (a senha só aparece agora' + (c.trocar ? "; será pedida a troca no primeiro acesso" : "") + '):</span><code>' + esc(c.login) + ' / ' + esc(c.senha) + '</code><button type="button" class="ax-btn" data-novo="copiar">Copiar</button><button type="button" class="ax-btn" data-novo="fechar">Fechar</button></div>';
  }
  function valoresBarra() {
    var r = admin.raiz; if (!r) return;
    var b = r.querySelector("#au-busca"); if (b && b.value !== admin.busca) b.value = admin.busca;
    [].forEach.call(r.querySelectorAll("[data-filtro]"), function (s) { var k = s.getAttribute("data-filtro"), v = k === "mod" ? admin.fMod : k === "nivel" ? admin.fNivel : admin.ordem; if (s.value !== v) s.value = v; });
    var barra = parte(".au-barra"); if (barra) barra.hidden = admin.aba === "acessos";
    var lc = parte("[data-limpar]"); if (lc) lc.disabled = !temFiltro();
  }
  function desenharSelBar() {
    var el = parte(".au-selbar"); if (!el) return;
    var ids = Object.keys(admin.sel).filter(function (id) { return admin.sel[id]; }), lista = admin.aba === "pendentes" || admin.aba === "ativos" || admin.aba === "bloqueados";
    if (!ids.length || !lista) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    var L = admin.lote, nivOps = [["", "Sem acesso"], ["consulta", "Consulta"], ["coord", "Coordenador"]];
    el.innerHTML = '<b>' + ids.length + ' selecionada' + (ids.length > 1 ? "s" : "") + '</b>' +
      '<span class="au-lote"><select data-lote="mod" aria-label="Módulo"><option value="">Módulo…</option>' + MODS.map(function (m) { return '<option value="' + m + '"' + (L.mod === m ? " selected" : "") + '>' + esc(MODN[m]) + '</option>'; }).join("") + '</select>' +
      '<select data-lote="nivel" aria-label="Nível">' + nivOps.map(function (o) { return '<option value="' + o[0] + '"' + (L.nivel === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select><button type="button" class="ax-btn" data-lote-ac="nivel">Aplicar nível</button></span>' +
      '<button type="button" class="ax-btn" data-lote-ac="aprovar">Aprovar</button><button type="button" class="ax-btn" data-lote-ac="desbloquear">Desbloquear</button><button type="button" class="ax-btn perigo" data-lote-ac="bloquear">Bloquear</button><button type="button" class="ax-btn" data-lote-ac="sessoes">Encerrar sessões</button><button type="button" class="ax-btn" data-lote-ac="limpar">Limpar seleção</button>' +
      '<span class="au-dica">Analista não entra em lote, porque exige o nome de cada pessoa; administradores também ficam de fora.</span>';
  }
  function desenharDls() {
    var el = parte(".au-dls"); if (!el) return;
    el.innerHTML = COM_ANALISTA.map(function (m) { return '<datalist id="au-dl-' + m + '">' + (admin.analistas[m] || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist>'; }).join("");
  }
  function chaveFoco(el) {
    if (!el || !el.closest) return null;
    var it = el.closest("[data-id]"), id = it && it.getAttribute("data-id"); if (!id) return null;
    var as = ["data-n", "data-a", "data-f", "data-mx", "data-mxa", "data-mxadm", "data-adm"];
    for (var i = 0; i < as.length; i++) if (el.hasAttribute(as[i])) return {id: id, a: as[i], v: el.getAttribute(as[i]), s: el.selectionStart};
    return null;
  }
  function restaurarFoco(k, base) {
    if (!k) return;
    var f = base.querySelector('[data-id="' + k.id + '"] [' + k.a + (k.v !== "" ? '="' + k.v + '"' : "") + ']');
    if (f) { f.focus(); try { if (k.s != null) f.setSelectionRange(k.s, k.s); } catch (e) {} }
  }
  function desenharCorpo() {
    var c = parte(".au-corpo"); if (!c) return;
    var k = chaveFoco(doc.activeElement && c.contains(doc.activeElement) ? doc.activeElement : null);
    c.innerHTML = admin.aba === "acessos" ? htmlAcessos() : admin.aba === "matriz" ? htmlMatriz() : htmlLista();
    restaurarFoco(k, c);
    if (admin.aba === "acessos") carregarLog();
    Object.keys(admin.hist).forEach(function (id) { if (admin.hist[id]) pintarHist(id); });
    if (admin.destaque) {
      var alvo = c.querySelector('.au-item[data-id="' + admin.destaque + '"]'), id = admin.destaque;
      if (alvo) { try { alvo.scrollIntoView({block: "center", behavior: "smooth"}); } catch (e) {} }
      setTimeout(function () { if (admin.destaque === id) { admin.destaque = ""; var a = parte('.au-item[data-id="' + id + '"]'); if (a) a.classList.remove("destaque"); } }, 3500);
    }
  }
  function desenharAdmin() {
    var raiz = admin.raiz; if (!raiz || !raiz.isConnected || !parte(".au-corpo")) return;
    if (!admin.carregado) { parte(".au-corpo").innerHTML = '<div class="au-vazio">Carregando usuários…</div>'; return; }
    podarRascunhos();
    if (!admin.aba) admin.aba = contagens().pend ? "pendentes" : "ativos";
    desenharTopo(); valoresBarra(); desenharSelBar(); desenharCorpo(); desenharDls();
  }

  /* ----- criar usuário (gaveta lateral) ----- */
  function desenharGaveta() {
    var w = parte(".au-gaveta-wrap"); if (!w) return;
    var n = admin.novo;
    if (!n) { w.innerHTML = ""; w.hidden = true; return; }
    w.hidden = false;
    var ae = doc.activeElement, foco = ae && w.contains(ae) ? (ae.getAttribute("data-n") || ae.getAttribute("data-a")) : null;
    var f = function (k, rot, tipo, extra) { return '<div class="au-mod"><label for="au-nv-' + k + '">' + rot + '</label><input id="au-nv-' + k + '" data-nv="' + k + '" type="' + tipo + '" value="' + esc(n[k]) + '" ' + (extra || "") + '>' + (k === "login" || k === "email" ? '<span class="au-dica" id="au-dica-' + k + '" role="status"></span>' : "") + '</div>'; };
    w.innerHTML = '<div class="au-fundo" data-novo="fundo"></div><aside class="au-gaveta" role="dialog" aria-modal="true" aria-label="Novo usuário"><form class="au-novo" novalidate autocomplete="off">' +
      '<div class="au-gcab"><div><b>Novo usuário</b><small>A conta já nasce ativa, sem precisar de aprovação.</small></div><button type="button" class="ax-btn" data-novo="cancelar" aria-label="Fechar">×</button></div>' +
      '<div class="au-gcampos">' + f("nome", "Nome", "text", 'autocomplete="off" maxlength="80"') + f("email", "E-mail", "email", 'autocomplete="off"') + f("login", "Usuário (para entrar)", "text", 'autocomplete="off" autocapitalize="none" spellcheck="false"') +
      '<div class="au-mod"><label for="au-nv-senha">Senha inicial</label><div style="display:flex;gap:6px"><input id="au-nv-senha" data-nv="senha" type="text" value="' + esc(n.senha) + '" autocomplete="off" spellcheck="false" style="font-family:\'IBM Plex Mono\',monospace"><button type="button" class="ax-btn" data-novo="gerar" style="white-space:nowrap;padding:6px 10px">Gerar</button></div><div class="au-forca" data-forca></div></div></div>' +
      '<label class="ax-chk" style="margin:0"><input type="checkbox" data-nvc="trocar"' + (n.trocar ? " checked" : "") + '> Exigir que a pessoa troque a senha no primeiro acesso</label>' +
      '<label class="ax-chk" style="margin:0"><input type="checkbox" data-nvc="admin"' + (n.admin ? " checked" : "") + '> Administrador (acesso total e gerencia usuários)</label>' +
      (n.admin ? "" : htmlModelo("", 'data-modelo') + '<div class="au-mods au-gmods">' + blocoModulos(n) + '</div>') +
      '<div class="au-gbot"><span class="au-msg" role="alert">' + esc(n.erro) + '</span><button type="submit" class="ax-btn prim" data-novo="criar"' + (n.ocupado ? " disabled" : "") + '>' + (n.ocupado ? "Criando…" : "Criar usuário") + '</button><button type="button" class="ax-btn" data-novo="cancelar">Cancelar</button></div></form></aside>';
    pintarForca(w, n.senha); dicaNovo();
    if (foco) { var el = w.querySelector('[data-n="' + foco + '"],[data-a="' + foco + '"]'); if (el) el.focus(); }
  }
  function dicaNovo() {
    var n = admin.novo; if (!n) return;
    var lg = norm(n.login), em = norm(n.email);
    pintarDica(doc.getElementById("au-dica-login"), !lg ? null : !/^[a-z0-9._-]{3,32}$/.test(lg) ? ["Use de 3 a 32 letras minúsculas, números, ponto, hífen ou sublinhado.", 0] : emUso("login", lg) ? ["Esse usuário já está em uso.", 0] : ["Disponível.", 1]);
    pintarDica(doc.getElementById("au-dica-email"), !em ? null : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? ["E-mail incompleto.", 0] : emUso("email", em) ? ["Já existe uma conta com esse e-mail.", 0] : ["Disponível.", 1]);
  }
  function abrirGaveta() { admin.novo = rascunhoNovo(); admin.criado = null; desenharGaveta(); desenharTopo(); setTimeout(function () { var i = doc.getElementById("au-nv-nome"); if (i) i.focus(); }, 30); }
  function fecharGaveta() { admin.novo = null; desenharGaveta(); var b = parte(".au-novobtn"); if (b) b.focus(); }
  function criarNovo() {
    var n = admin.novo; if (!n || n.ocupado) return;
    var f = {nome: n.nome, email: String(n.email).trim(), login: n.login, senha: n.senha, confirma: n.senha};
    var msg = validarCadastro(f);
    if (!msg && !n.admin && !MODS.some(function (m) { return n.niveis[m]; })) msg = "Escolha pelo menos um módulo (ou marque Administrador).";
    if (!msg && !n.admin && COM_ANALISTA.some(function (m) { return n.niveis[m] === "analista" && !String(n.analista[m] || "").trim(); })) msg = "Para o nível Analista, informe o nome do analista naquele módulo.";
    if (msg) { n.erro = msg; desenharGaveta(); return; }
    var niveis = {}, an = {};
    MODS.forEach(function (m) { niveis[m] = n.admin ? "coord" : (n.niveis[m] || ""); });
    COM_ANALISTA.forEach(function (m) { if (!n.admin && niveis[m] === "analista") an[m] = String(n.analista[m]).trim(); });
    n.ocupado = true; n.erro = ""; desenharGaveta();
    criarConta(f, {admin: !!n.admin, niveis: niveis, analista: an, trocarSenha: !!n.trocar, por: atual.id}).then(function (r) {
      admin.prov[r.id] = n.senha;
      admin.criado = {nome: String(n.nome).trim(), login: norm(n.login), senha: n.senha, trocar: !!n.trocar};
      admin.novo = null; admin.aba = "ativos"; admin.busca = ""; admin.fMod = ""; admin.fNivel = ""; admin.fEsp = ""; admin.aberto[r.id] = true; admin.destaque = r.id;
      desenharGaveta(); desenharAdmin();
    }).catch(function (e) { n.ocupado = false; n.erro = e && e.amigavel ? e.message : "Não consegui criar o usuário agora. Tente de novo."; if (!(e && e.amigavel)) console.error(e); desenharGaveta(); });
  }

  /* ----- gravações ----- */
  function carregarAnalistas() {
    var H = window.__hubApi; if (!H || !H.carregar) return;
    COM_ANALISTA.forEach(function (m) {
      if (admin.analistas[m]) return; admin.analistas[m] = [];
      H.carregar(m).then(function (a) { admin.analistas[m] = (a && a.analistas ? a.analistas() : []).filter(Boolean); desenharDls(); }).catch(function () {});
    });
  }
  function salvarAcesso(u, extra) {
    var e = dadosEdit(u), niveis = {}, an = {};
    MODS.forEach(function (m) { niveis[m] = e.admin ? "coord" : (e.niveis[m] || ""); });
    COM_ANALISTA.forEach(function (m) { if (!e.admin && niveis[m] === "analista" && String(e.analista[m] || "").trim()) an[m] = String(e.analista[m]).trim(); });
    return BACKEND.atualizar("auth_usuarios/" + u.id, Object.assign({admin: !!e.admin, niveis: niveis, analista: an}, extra || {}));
  }
  function faltaAnalista(e) { return e.admin ? null : COM_ANALISTA.filter(function (m) { return e.niveis[m] === "analista" && !String(e.analista[m] || "").trim(); })[0] || null; }
  // níveis e administrador são salvos assim que a pessoa escolhe (quem está pendente só é salvo ao aprovar)
  function autoSalvar(u, semUndo) {
    if (u.status === "pendente") { desenharCorpo(); return Promise.resolve(); }
    var e = dadosEdit(u), mud = mudAcesso(u, e);
    if (!mud.length) { desenharCorpo(); return Promise.resolve(); }
    var falta = faltaAnalista(e);
    if (falta) { msgCard(u.id, "Informe o nome do analista em " + MODC[falta] + " para salvar.", false); desenharCorpo(); return Promise.resolve(); }
    if (u.admin && !e.admin && nAdminsAtivos(u.id) === 0) { e.admin = true; msgCard(u.id, "Precisa existir pelo menos um administrador ativo.", false); desenharCorpo(); return Promise.resolve(); }
    var prev = {admin: !!u.admin, niveis: clone(u.niveis || {}), analista: clone(u.analista || {})}, eu = atual && atual.id === u.id;
    var seguir = u.admin && !e.admin && eu ? confirmar({titulo: "Deixar de ser administrador?", texto: "Você vai perder o acesso total e esta tela. A página recarrega em seguida.", ok: "Deixar de ser administrador", perigo: true}) : Promise.resolve(true);
    return seguir.then(function (ok) {
      if (!ok) { e.admin = !!u.admin; desenharCorpo(); return; }
      return salvarAcesso(u).then(function () {
        BACKEND.registrar("acesso_alterado", u.id, atual.id, {det: mud.join("; ")});
        if (!semUndo) admin.undo[u.id] = prev; else delete admin.undo[u.id];
        msgCard(u.id, (semUndo ? "Desfeito: " : "Salvo: ") + mud.join(" · "), true, !semUndo);
      }).catch(function (err) { console.error(err); msgCard(u.id, "Não consegui salvar agora. Tente de novo.", false); });
    });
  }
  // corrige nome, e-mail e usuário de uma conta; mexe nas chaves de login para o acesso continuar único
  function salvarIdentidade(u, e) {
    var nome = String(e.nome).trim().slice(0, 80), email = norm(e.email), login = norm(e.login);
    if (nome === u.nome && email === norm(u.email || "") && login === u.login) return Promise.resolve(false);
    var msg = validarCadastro({nome: nome, email: email, login: login, senha: "x1x1x1x1", confirma: "x1x1x1x1"}); if (msg) return Promise.reject(erro(msg));
    return Promise.all([chaveLogin(login), chaveLogin(email)]).then(function (ks) {
      var antigas = u.chaves || [];
      return Promise.all(ks.map(function (k) { return antigas.indexOf(k) !== -1 ? null : BACKEND.ler("auth_logins/" + k); })).then(function (rs) {
        if (rs[0] && rs[0].id !== u.id) throw erro("Esse usuário já está em uso. Escolha outro.");
        if (rs[1] && rs[1].id !== u.id) throw erro("Já existe uma conta com esse e-mail.");
        return Promise.all(ks.filter(function (k) { return antigas.indexOf(k) === -1; }).map(function (k) { return BACKEND.gravar("auth_logins/" + k, {id: u.id}); }));
      }).then(function () { return BACKEND.atualizar("auth_usuarios/" + u.id, {nome: nome, email: email, login: login, chaves: ks}); })
        .then(function () { return Promise.all(antigas.filter(function (k) { return ks.indexOf(k) === -1; }).map(function (k) { return BACKEND.apagar("auth_logins/" + k); })); })
        .then(function () { return true; });
    });
  }
  function acaoAdmin(ac, id) {
    var u = achar(id); if (!u) return;
    var por = atual.id, e = dadosEdit(u);
    function erroGenerico(err) { if (err && err.amigavel) { msgCard(id, err.message, false); return; } console.error(err); msgCard(id, "Não consegui salvar agora. Tente de novo.", false); }
    if (ac === "copiar") {
      var sen = admin.prov[id];
      copiarTexto(textoAcesso(u, sen)).then(function (ok) { msgCard(id, !ok ? "Não consegui copiar. Selecione e copie à mão." : sen ? "Copiado: usuário e senha." : "Copiado o usuário. A senha não fica guardada: para mandar uma, use Redefinir senha.", ok); });
    } else if (ac === "desfazer") {
      var prev = admin.undo[id]; if (!prev) return;
      e.admin = prev.admin; e.niveis = Object.assign(nivelVazio(), prev.niveis); e.analista = Object.assign({}, prev.analista);
      autoSalvar(u, true);
    } else if (ac === "hist") {
      admin.hist[id] = !admin.hist[id]; desenharCorpo();
    } else if (ac === "aprovar" || ac === "salvar") {
      if (ac === "aprovar") {
        var temModulo = e.admin || MODS.some(function (m) { return e.niveis[m]; });
        if (!temModulo) { msgCard(id, "Escolha pelo menos um módulo antes de aprovar.", false); return; }
        if (faltaAnalista(e)) { msgCard(id, "Para o nível Analista, informe o nome do analista naquele módulo.", false); return; }
      }
      if (u.admin && !e.admin && nAdminsAtivos(u.id) === 0) { msgCard(id, "Precisa existir pelo menos um administrador ativo.", false); return; }
      var mud = mudAcesso(u, e);
      salvarIdentidade(u, e).then(function (mudou) {
        if (mudou) BACKEND.registrar("dados_alterados", id, por, {det: "usuário antes: " + u.login});
        if (ac === "aprovar") return salvarAcesso(u, {status: "ativo", aprovadoPor: por, aprovadoEm: agora()}).then(function () { BACKEND.registrar("aprovado", id, por, {det: mud.join("; ")}); admin.aberto[id] = false; msgCard(id, "Aprovado.", true); });
        msgCard(id, mudou ? "Dados salvos." : "Nada para salvar.", true);
        if (!faltaAnalista(e)) return autoSalvar(u); return null;
      }).catch(erroGenerico);
    } else if (ac === "bloquear" || ac === "desbloquear") {
      if (ac === "bloquear" && u.admin && nAdminsAtivos(u.id) === 0) { msgCard(id, "Não dá para bloquear o único administrador.", false); return; }
      var fazer = function () { return BACKEND.atualizar("auth_usuarios/" + id, ac === "bloquear" ? {status: "bloqueado", sv: (u.sv || 1) + 1} : {status: "ativo", falhas: 0, bloqueadoAte: 0}).then(function () { BACKEND.registrar(ac === "bloquear" ? "bloqueado" : "desbloqueado", id, por); msgCard(id, ac === "bloquear" ? "Bloqueado." : "Desbloqueado.", true); }).catch(erroGenerico); };
      if (ac === "bloquear") confirmar({titulo: "Bloquear " + u.nome + "?", texto: "A pessoa é desconectada e não consegue entrar até você desbloquear. Os dados e níveis ficam guardados.", ok: "Bloquear", perigo: true}).then(function (ok) { if (ok) fazer(); }); else fazer();
    } else if (ac === "senha") {
      confirmar({titulo: "Redefinir a senha de " + u.nome + "?", texto: "A senha atual deixa de funcionar e a pessoa é desconectada. Você recebe uma senha provisória para passar a ela; no próximo acesso ela cria uma nova.", ok: "Redefinir senha"}).then(function (ok) {
        if (!ok) return;
        var nova = senhaProvisoria(), sal = novoSal();
        return hashSenha(nova, sal, ITER).then(function (h) { return BACKEND.atualizar("auth_usuarios/" + id, {hash: h, salt: sal, iter: ITER, trocarSenha: true, sv: (u.sv || 1) + 1, falhas: 0, bloqueadoAte: 0}); })
          .then(function () { admin.prov[id] = nova; BACKEND.registrar("senha_redefinida", id, por); desenharCorpo(); msgCard(id, "Senha redefinida. Copie o acesso e passe à pessoa.", true); }).catch(erroGenerico);
      });
    } else if (ac === "sessoes") {
      confirmar({titulo: "Encerrar as sessões de " + u.nome + "?", texto: "A pessoa é desconectada de todos os aparelhos e precisa entrar de novo. A conta e a senha continuam como estão.", ok: "Encerrar sessões"}).then(function (ok) {
        if (!ok) return;
        BACKEND.atualizar("auth_usuarios/" + id, {sv: (u.sv || 1) + 1}).then(function () { BACKEND.registrar("sessoes_encerradas", id, por); msgCard(id, "Sessões encerradas.", true); }).catch(erroGenerico);
      });
    } else if (ac === "recusar" || ac === "excluir") {
      if (u.admin && nAdminsAtivos(u.id) === 0) { msgCard(id, "Não dá para excluir o único administrador.", false); return; }
      confirmar({titulo: (ac === "recusar" ? "Recusar o cadastro de " : "Excluir ") + u.nome + "?", texto: "A conta é apagada de vez e não dá para desfazer. Os registros antigos feitos por ela continuam, sem o nome.", ok: ac === "recusar" ? "Recusar cadastro" : "Excluir conta", perigo: true}).then(function (ok) {
        if (!ok) return;
        Promise.all((u.chaves || []).map(function (k) { return BACKEND.apagar("auth_logins/" + k); })).then(function () { return BACKEND.apagar("auth_usuarios/" + id); }).then(function () { delete admin.sel[id]; BACKEND.registrar(ac === "recusar" ? "recusado" : "excluido", id, por, {nomeAntigo: u.nome}); toastAdmin(u.nome + ": conta " + (ac === "recusar" ? "recusada" : "excluída") + ".", true); }).catch(erroGenerico);
      });
    }
  }
  function acaoLote(ac) {
    if (ac === "limpar") { admin.sel = {}; desenharSelBar(); desenharCorpo(); return; }
    var us = Object.keys(admin.sel).filter(function (id) { return admin.sel[id]; }).map(achar).filter(Boolean), por = atual.id, eu = atual.id;
    if (!us.length) return;
    var fim = function (txt) { admin.sel = {}; desenharAdmin(); toastAdmin(txt, true); };
    if (ac === "nivel") {
      var m = admin.lote.mod, v = admin.lote.nivel;
      if (!m) { toastAdmin("Escolha o módulo para aplicar o nível.", false); return; }
      var alvo = us.filter(function (u) { return !u.admin && nivEf(u, m) !== v; });
      if (!alvo.length) { toastAdmin("Ninguém muda: os selecionados já estão assim ou são administradores.", false); return; }
      confirmar({titulo: "Aplicar " + NIVN[v] + " em " + MODN[m] + "?", texto: (alvo.length > 1 ? alvo.length + " pessoas vão ficar" : "1 pessoa vai ficar") + " com “" + NIVN[v] + "” em " + MODN[m] + "." + (us.length > alvo.length ? " Não mudam " + (us.length - alvo.length) + ": já estão assim ou são administradores." : ""), ok: "Aplicar"}).then(function (ok) {
        if (!ok) return;
        alvo.reduce(function (p, u) {
          return p.then(function () {
            var niveis = Object.assign(nivelVazio(), u.niveis || {}), an = clone(u.analista || {}), antes = niveis[m]; niveis[m] = v; delete an[m];
            return BACKEND.atualizar("auth_usuarios/" + u.id, {niveis: niveis, analista: an}).then(function () { BACKEND.registrar("acesso_alterado", u.id, por, {det: MODC[m] + ": " + NIVN[antes || ""] + " → " + NIVN[v] + " (em lote)"}); delete admin.rasc[u.id]; });
          });
        }, Promise.resolve()).then(function () { fim("Nível aplicado em " + alvo.length + " pessoa" + (alvo.length > 1 ? "s" : "") + "."); }).catch(function (e) { console.error(e); toastAdmin("Não consegui aplicar em todas. Confira a lista.", false); });
      });
    } else if (ac === "aprovar") {
      var pend = us.filter(function (u) { return u.status === "pendente"; }), aptos = pend.filter(function (u) { var e = dadosEdit(u); return (e.admin || MODS.some(function (k) { return e.niveis[k]; })) && !faltaAnalista(e); });
      if (!pend.length) { toastAdmin("Nenhum cadastro pendente na seleção.", false); return; }
      if (!aptos.length) { toastAdmin("Escolha os módulos de cada pessoa pendente antes de aprovar.", false); return; }
      confirmar({titulo: "Aprovar " + aptos.length + " cadastro" + (aptos.length > 1 ? "s" : "") + "?", texto: "Cada pessoa entra com os módulos que estão escolhidos no cartão dela." + (pend.length > aptos.length ? " Ficam de fora " + (pend.length - aptos.length) + " sem módulo escolhido (ou sem o nome do analista)." : ""), ok: "Aprovar"}).then(function (ok) {
        if (!ok) return;
        aptos.reduce(function (p, u) { return p.then(function () { var mud = mudAcesso(u, dadosEdit(u)); return salvarAcesso(u, {status: "ativo", aprovadoPor: por, aprovadoEm: agora()}).then(function () { BACKEND.registrar("aprovado", u.id, por, {det: mud.join("; ")}); }); }); }, Promise.resolve())
          .then(function () { fim(aptos.length + " cadastro" + (aptos.length > 1 ? "s aprovados" : " aprovado") + "."); }).catch(function (e) { console.error(e); toastAdmin("Não consegui aprovar todos. Confira a lista.", false); });
      });
    } else if (ac === "bloquear" || ac === "desbloquear") {
      var aptosB = us.filter(function (u) { return ac === "bloquear" ? u.status === "ativo" && !u.admin && u.id !== eu : u.status === "bloqueado"; });
      if (!aptosB.length) { toastAdmin(ac === "bloquear" ? "Ninguém para bloquear: só contas ativas de quem não é administrador (nem você)." : "Nenhuma conta bloqueada na seleção.", false); return; }
      confirmar({titulo: (ac === "bloquear" ? "Bloquear " : "Desbloquear ") + aptosB.length + " pessoa" + (aptosB.length > 1 ? "s" : "") + "?", texto: ac === "bloquear" ? "Elas são desconectadas e não conseguem entrar até você desbloquear. Administradores precisam ser bloqueados um a um." : "Elas voltam a poder entrar com a senha de sempre.", ok: ac === "bloquear" ? "Bloquear" : "Desbloquear", perigo: ac === "bloquear"}).then(function (ok) {
        if (!ok) return;
        aptosB.reduce(function (p, u) { return p.then(function () { return BACKEND.atualizar("auth_usuarios/" + u.id, ac === "bloquear" ? {status: "bloqueado", sv: (u.sv || 1) + 1} : {status: "ativo", falhas: 0, bloqueadoAte: 0}).then(function () { BACKEND.registrar(ac === "bloquear" ? "bloqueado" : "desbloqueado", u.id, por); }); }); }, Promise.resolve())
          .then(function () { fim(aptosB.length + (ac === "bloquear" ? " bloqueada" : " desbloqueada") + (aptosB.length > 1 ? "s." : ".")); }).catch(function (e) { console.error(e); toastAdmin("Não consegui concluir para todas. Confira a lista.", false); });
      });
    } else if (ac === "sessoes") {
      var aptosS = us.filter(function (u) { return u.id !== eu && u.status !== "pendente"; });
      if (!aptosS.length) { toastAdmin("Nada para encerrar na seleção.", false); return; }
      confirmar({titulo: "Encerrar as sessões de " + aptosS.length + " pessoa" + (aptosS.length > 1 ? "s" : "") + "?", texto: "Elas são desconectadas de todos os aparelhos e precisam entrar de novo. Contas e senhas continuam como estão.", ok: "Encerrar sessões"}).then(function (ok) {
        if (!ok) return;
        aptosS.reduce(function (p, u) { return p.then(function () { return BACKEND.atualizar("auth_usuarios/" + u.id, {sv: (u.sv || 1) + 1}).then(function () { BACKEND.registrar("sessoes_encerradas", u.id, por); }); }); }, Promise.resolve())
          .then(function () { fim("Sessões encerradas (" + aptosS.length + ")."); }).catch(function (e) { console.error(e); toastAdmin("Não consegui concluir para todas.", false); });
      });
    }
  }

  /* ----- exportar a lista ----- */
  function csvCel(v) { v = String(v == null ? "" : v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportarCsv() {
    var l = ordenar(admin.lista.filter(passaFiltro));
    if (!l.length) { toastAdmin("Nada para exportar com esses filtros.", false); return; }
    var cab = ["Nome", "Usuário", "E-mail", "Situação", "Administrador"].concat(MODS.map(function (m) { return MODN[m]; })).concat(["Analista (nome ligado)", "Cadastro", "Último acesso"]);
    var linhas = l.map(function (u) {
      var an = COM_ANALISTA.filter(function (m) { return (u.analista || {})[m]; }).map(function (m) { return MODC[m] + "=" + u.analista[m]; }).join("; ");
      return [u.nome, u.login, u.email || "", u.status === "pendente" ? "Pendente" : u.status === "bloqueado" ? "Bloqueado" : "Ativo", u.admin ? "Sim" : "Não"].concat(MODS.map(function (m) { return NIVN[nivEf(u, m)]; })).concat([an, u.criadoEm ? fmtData(u.criadoEm) : "", u.ultimoAcesso ? fmtData(u.ultimoAcesso) : "nunca"]);
    });
    var txt = "﻿" + [cab].concat(linhas).map(function (r) { return r.map(csvCel).join(";"); }).join("\r\n"), nome = "usuarios-control-hub-" + hojeKey() + ".csv";
    var fallback = function () { try { var a = doc.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type: "text/csv;charset=utf-8"})); a.download = nome; doc.body.appendChild(a); a.click(); a.remove(); toastAdmin("Lista exportada (" + l.length + " pessoas).", true); } catch (e) { toastAdmin("Não consegui gerar o arquivo aqui.", false); } };
    (window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null)).then(function (d) {
      if (!d) return fallback();
      return d.save({filename: nome, data: txt}).then(function () { toastAdmin("Lista exportada (" + l.length + " pessoas).", true); }, function (e) { if (!e || e.code !== "declined") toastAdmin("Não consegui gerar o arquivo aqui.", false); });
    }, fallback);
  }

  /* ----- ouvinte global do administrador e aviso de pendentes ----- */
  function digitandoNoCorpo() {
    var ae = doc.activeElement, c = parte(".au-corpo");
    return !!(ae && c && c.contains(ae) && ae.tagName === "INPUT" && ae.type !== "checkbox");
  }
  function iniciarOuvinteAdmin() {
    if (admin.off || !atual || !atual.admin) return;
    admin.off = BACKEND.ouvirColecao("auth_usuarios", function (l) {
      admin.lista = l; admin.carregado = true;
      var n = l.filter(function (u) { return u.status === "pendente"; }).length, mudou = n !== admin.pendCount; admin.pendCount = n;
      if (mudou) pendOuvintes.forEach(function (f) { try { f(n); } catch (e) {} });
      if (n > 0 && !admin.avisouPend) { admin.avisouPend = true; avisoPendentes(n); }
      if (digitandoNoCorpo()) return;
      desenharAdmin(); dicaNovo();
    });
  }
  function avisoPendentes(n) {
    var b = doc.createElement("button"); b.type = "button"; b.setAttribute("role", "status");
    b.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:100002;background:#101820;color:#fff;border:2px solid #C2000C;padding:10px 16px;border-radius:8px;font:600 13px 'IBM Plex Sans',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:pointer";
    b.textContent = n + (n > 1 ? " cadastros aguardam" : " cadastro aguarda") + " a sua liberação. Clique para abrir.";
    b.onclick = function () { b.remove(); try { window.__hubApi.abrirModulo("usuarios"); } catch (e) {} };
    doc.body.appendChild(b); setTimeout(function () { b.remove(); }, 9000);
  }
  function montarUsuarios(raiz) {
    if (!atual || !atual.admin) { raiz.innerHTML = '<div class="au-vazio">Só o administrador acessa esta tela.</div>'; return; }
    injetarCss(); admin.raiz = raiz;
    raiz.innerHTML = '<div class="au"><p class="au-intro">Cada pessoa tem um nível por módulo. <b>Coordenador</b> edita tudo no módulo, <b>Analista</b> edita só a própria carteira (use o nome que aparece nas listas de analistas), <b>Consulta</b> só vê. Sem nível, o módulo fica escondido.</p>' +
      '<div class="au-topo"></div>' +
      '<div class="au-barra" role="search"><input id="au-busca" type="search" placeholder="Buscar por nome, usuário ou e-mail  ( / )" aria-label="Buscar usuários" autocomplete="off">' +
      '<select data-filtro="mod" aria-label="Filtrar por módulo" title="Sozinho: quem tem acesso ao módulo"><option value="">Módulo: todos</option>' + MODS.map(function (m) { return '<option value="' + m + '">' + esc(MODN[m]) + '</option>'; }).join("") + '</select>' +
      '<select data-filtro="nivel" aria-label="Filtrar por nível" title="Sozinho: quem tem esse nível em algum módulo. Com o módulo escolhido: nível exato naquele módulo"><option value="">Nível: qualquer</option><option value="sem">Sem acesso</option><option value="consulta">Consulta</option><option value="analista">Analista</option><option value="coord">Coordenador</option></select>' +
      '<select data-filtro="ordem" aria-label="Ordenar"><option value="nome">Ordem: nome</option><option value="cadastro">Cadastro mais recente</option><option value="acesso">Acessou há menos tempo</option><option value="parado">Sem acessar há mais tempo</option></select>' +
      '<button type="button" class="ax-btn" data-limpar>Limpar filtros</button><button type="button" class="ax-btn" data-exportar title="Baixa a lista (com os filtros atuais) em CSV">Exportar CSV</button></div>' +
      '<div class="au-selbar" hidden></div><div class="au-corpo" aria-live="polite"></div><div class="au-dls"></div><div class="au-gaveta-wrap" hidden></div><div class="au-toast" role="status" aria-live="polite"></div></div>';
    iniciarOuvinteAdmin(); carregarAnalistas(); desenharAdmin();
    if (!raiz.__ax) {
      raiz.__ax = true;
      var tBusca = null;
      raiz.addEventListener("click", function (ev) {
        var T = ev.target, ab = T.closest("[data-aba]"); if (ab) { admin.aba = ab.getAttribute("data-aba"); desenharAdmin(); return; }
        var esp = T.closest("[data-esp]");
        if (esp) { var k = esp.getAttribute("data-esp"); if (k === "pend") { admin.aba = "pendentes"; admin.fEsp = ""; } else { admin.fEsp = admin.fEsp === k ? "" : k; if (admin.aba === "acessos" || admin.aba === "pendentes") admin.aba = "ativos"; } desenharAdmin(); return; }
        if (T.closest("[data-limpar]")) { admin.busca = ""; admin.fMod = ""; admin.fNivel = ""; admin.fEsp = ""; desenharAdmin(); return; }
        if (T.closest("[data-exportar]")) { exportarCsv(); return; }
        var tg = T.closest("[data-toast]"); if (tg) { toastAdmin(""); return; }
        var ud = T.closest("[data-undo]"); if (ud) { toastAdmin(""); acaoAdmin("desfazer", ud.getAttribute("data-undo")); return; }
        var ex = T.closest("[data-expandir]"); if (ex) { var abre = ex.getAttribute("data-expandir") === "1"; admin.lista.filter(passaFiltro).forEach(function (u) { admin.aberto[u.id] = abre; }); desenharCorpo(); return; }
        var ha = T.closest("[data-abre]"); if (ha) { var it = ha.closest(".au-item"), uu = it && achar(it.getAttribute("data-id")); if (uu) { admin.aberto[uu.id] = !estaAberto(uu); desenharCorpo(); } return; }
        var lm = T.closest("[data-logmais]"); if (lm) { admin.lg.mais += 120; carregarLog(); return; }
        var la = T.closest("[data-lote-ac]"); if (la) { acaoLote(la.getAttribute("data-lote-ac")); return; }
        var cp = T.closest("[data-copia]"); if (cp) { var cid = cp.getAttribute("data-copia"), cu = achar(cid); copiarTexto(textoAcesso(cu || {login: ""}, admin.prov[cid])).then(function (ok) { cp.textContent = ok ? "Copiado" : "Selecione e copie"; }); return; }
        var nv = T.closest("[data-novo]");
        if (nv) {
          var a = nv.getAttribute("data-novo");
          if (a === "abrir") abrirGaveta();
          else if (a === "cancelar" || a === "fundo") fecharGaveta();
          else if (a === "gerar" && admin.novo) { admin.novo.senha = senhaProvisoria(); var sn = doc.getElementById("au-nv-senha"); if (sn) sn.value = admin.novo.senha; pintarForca(parte(".au-gaveta-wrap"), admin.novo.senha); }
          else if (a === "fechar") { admin.criado = null; desenharTopo(); }
          else if (a === "copiar" && admin.criado) { var c = admin.criado; copiarTexto(textoAcesso({login: c.login, trocarSenha: c.trocar}, c.senha)).then(function (ok2) { nv.textContent = ok2 ? "Copiado" : "Selecione e copie"; }); }
          return;
        }
        var b = T.closest("[data-ac]"), card = T.closest(".au-u"); if (b && card) acaoAdmin(b.getAttribute("data-ac"), card.getAttribute("data-id"));
      });
      raiz.addEventListener("submit", function (ev) { if (ev.target.closest(".au-novo")) { ev.preventDefault(); criarNovo(); } });
      raiz.addEventListener("input", function (ev) {
        var t = ev.target, n = admin.novo;
        if (t.id === "au-busca") { clearTimeout(tBusca); tBusca = setTimeout(function () { admin.busca = t.value; desenharAdmin(); }, 120); return; }
        var cd = t.closest(".au-item .au-u");
        if (cd && t.hasAttribute("data-f")) {
          var uu = achar(cd.getAttribute("data-id")); if (!uu) return;
          var ee = dadosEdit(uu); ee[t.getAttribute("data-f")] = t.value;
          var mi = mudIdent(uu, ee), sv = cd.querySelector("[data-ac=salvar]"); if (sv) sv.disabled = !mi.length;
          var df = cd.querySelector("[data-diff]"), tudo = uu.status === "pendente" ? mudAcesso(uu, ee).concat(mi) : mi.concat(mudAcesso(uu, ee));
          if (df) { df.hidden = !tudo.length; df.textContent = tudo.length ? (uu.status === "pendente" ? "Ao aprovar: " : "Ainda não salvo: ") + tudo.join(" · ") : ""; }
          var k2 = t.getAttribute("data-f"), dc = cd.querySelector("[data-dica]");
          if (dc) { var vv = norm(t.value); pintarDica(dc, k2 === "login" && vv && emUso("login", vv, uu.id) ? ["Esse usuário já está em uso.", 0] : k2 === "email" && vv && emUso("email", vv, uu.id) ? ["Já existe uma conta com esse e-mail.", 0] : null); }
          t.closest(".au-mod").classList.toggle("mudou", mi.indexOf(k2 === "nome" ? "Nome" : k2 === "email" ? "E-mail" : "Usuário") !== -1);
          return;
        }
        if (!n || !t.closest(".au-novo")) return;
        if (t.hasAttribute("data-nv")) {
          var chave = t.getAttribute("data-nv"); n[chave] = t.value;
          if (chave === "nome" && !n.loginManual) { n.login = sugerirLogin(t.value); var li = doc.getElementById("au-nv-login"); if (li) li.value = n.login; }
          if (chave === "login") n.loginManual = true;
          if (chave === "senha") pintarForca(parte(".au-gaveta-wrap"), n.senha);
          dicaNovo();
        } else if (t.hasAttribute("data-a")) n.analista[t.getAttribute("data-a")] = t.value;
      });
      raiz.addEventListener("change", function (ev) {
        var t = ev.target, n = admin.novo;
        if (n && t.closest(".au-novo")) {
          if (t.hasAttribute("data-nvc")) { n[t.getAttribute("data-nvc")] = t.checked; setTimeout(desenharGaveta, 0); }
          else if (t.hasAttribute("data-modelo")) { if (t.value) { aplicarModelo(n, t.value); n.admin = false; } setTimeout(desenharGaveta, 0); }
          else if (t.hasAttribute("data-n")) { n.niveis[t.getAttribute("data-n")] = t.value; setTimeout(desenharGaveta, 0); }
          else if (t.hasAttribute("data-nv")) { n[t.getAttribute("data-nv")] = t.value; dicaNovo(); }
          else if (t.hasAttribute("data-a")) n.analista[t.getAttribute("data-a")] = t.value;
          return;
        }
        if (t.hasAttribute("data-filtro")) { var fk = t.getAttribute("data-filtro"); if (fk === "mod") admin.fMod = t.value; else if (fk === "nivel") admin.fNivel = t.value; else admin.ordem = t.value; desenharAdmin(); return; }
        if (t.hasAttribute("data-lg")) { var lk = t.getAttribute("data-lg"); admin.lg[lk] = lk === "dias" ? parseInt(t.value, 10) : t.value; admin.lg.mais = 120; desenharCorpo(); return; }
        if (t.hasAttribute("data-lote")) { admin.lote[t.getAttribute("data-lote")] = t.value; return; }
        if (t.hasAttribute("data-todos")) { admin.lista.filter(passaFiltro).filter(function (u) { return u.status === (admin.aba === "pendentes" ? "pendente" : admin.aba === "bloqueados" ? "bloqueado" : "ativo"); }).forEach(function (u) { if (t.checked) admin.sel[u.id] = true; else delete admin.sel[u.id]; }); desenharSelBar(); desenharCorpo(); return; }
        if (t.hasAttribute("data-sel")) { var si = t.closest(".au-item"), sid = si && si.getAttribute("data-id"); if (sid) { if (t.checked) admin.sel[sid] = true; else delete admin.sel[sid]; desenharSelBar(); } return; }
        // matriz de acessos
        var tr = t.closest("tr[data-id]");
        if (tr) {
          var um = achar(tr.getAttribute("data-id")); if (!um) return; var em = dadosEdit(um);
          if (t.hasAttribute("data-mx")) { var mk = t.getAttribute("data-mx"); em.niveis[mk] = t.value; if (t.value !== "analista") delete em.analista[mk]; }
          else if (t.hasAttribute("data-mxa")) em.analista[t.getAttribute("data-mxa")] = t.value;
          else if (t.hasAttribute("data-mxadm")) em.admin = t.checked;
          else return;
          autoSalvar(um); return;
        }
        var card = t.closest(".au-item .au-u"); if (!card || t.hasAttribute("data-f")) return;
        var u = achar(card.getAttribute("data-id")); if (!u) return; var e = dadosEdit(u);
        if (t.hasAttribute("data-modelo-card")) { if (t.value) { if (e.admin) msgCard(u.id, "Desmarque Administrador para usar níveis por módulo.", false); else aplicarModelo(e, t.value); } autoSalvar(u); return; }
        if (t.hasAttribute("data-adm")) e.admin = t.checked;
        else if (t.hasAttribute("data-n")) { var nk = t.getAttribute("data-n"); e.niveis[nk] = t.value; if (t.value !== "analista") delete e.analista[nk]; }
        else if (t.hasAttribute("data-a")) e.analista[t.getAttribute("data-a")] = t.value;
        setTimeout(function () { autoSalvar(u); }, 0);
      });
    }
    if (!doc.__auTeclas) {
      doc.__auTeclas = true;
      doc.addEventListener("keydown", function (ev) {
        var r = admin.raiz; if (!r || !r.isConnected || r.offsetParent === null || doc.querySelector(".ax-dlg")) return;
        var al = ev.target, digitando = al && (al.tagName === "INPUT" || al.tagName === "TEXTAREA" || al.tagName === "SELECT" || al.isContentEditable);
        if (ev.key === "Escape") {
          if (admin.novo) { ev.preventDefault(); fecharGaveta(); }
          else if (al && al.id === "au-busca" && al.value) { al.value = ""; admin.busca = ""; desenharAdmin(); }
          return;
        }
        if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (ev.key === "/") { ev.preventDefault(); ev.stopPropagation(); var b = doc.getElementById("au-busca"); if (b) b.focus(); }
        else if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); ev.stopPropagation(); if (!admin.novo) abrirGaveta(); }
      }, true);
    }
  }

  /* ============ API pública ============ */
  window.__auth = {
    aguardar: function () { return aguardarP; },
    usuario: function () { return atual ? publico(atual) : null; },
    nivel: function (mod) { return nivelDe(atual, mod); },
    podeVer: function (mod) { return nivelDe(atual, mod) !== null; },
    analista: function (mod) { return atual && atual.analista && atual.analista[mod] ? atual.analista[mod] : ""; },
    ehAdmin: function () { return !!(atual && atual.admin); },
    sair: sair,
    trocarSenha: dialogoSenha,
    onMudar: function (cb) { if (typeof cb === "function") ouvintesMudar.push(cb); },
    perfis: function (ids, fallback) {
      var r = {}, lista = (ids || []).filter(Boolean);
      return Promise.all(lista.map(function (id) { return BACKEND.ler("auth_usuarios/" + id).then(function (u) { r[id] = {name: u ? u.nome : ""}; }, function () { r[id] = {name: ""}; }); })).then(function () {
        var falta = lista.filter(function (id) { return !r[id].name; });
        if (!falta.length || typeof fallback !== "function") return r;
        // registros antigos guardam o id da conta claude.ai: resolve por lá
        return Promise.resolve(fallback(falta)).then(function (ps) { falta.forEach(function (id) { if (ps && ps[id] && ps[id].name) r[id] = {name: ps[id].name}; }); return r; }, function () { return r; });
      });
    },
    pendentes: function () { return atual && atual.admin ? admin.pendCount : 0; },
    onPendentes: function (cb) { if (typeof cb === "function") pendOuvintes.push(cb); },
    montarUsuarios: montarUsuarios,
    _backend: BACKEND
  };

  /* ============ início ============ */
  function iniciar() {
    abrirTela(); doc.documentElement.classList.add("ax-bloqueado");
    cartao().innerHTML = '<h1>Control Hub</h1><p class="ax-sub">Verificando o seu acesso…</p>';
    if (!temCripto()) { cartao().innerHTML = '<h1>Conexão não segura</h1><p class="ax-sub">Este navegador não permite proteger senhas nesta conexão. Abra o Control Hub por uma conexão segura (https).</p>'; return; }
    sessaoSalva().then(function (u) { if (u) depoisDeEntrar(u); else telaEntrar("entrar"); }, function () { telaEntrar("entrar"); });
  }
  if (doc.body) iniciar(); else doc.addEventListener("DOMContentLoaded", iniciar);
})();
