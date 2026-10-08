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
    return {id: u.id, nome: u.nome, login: u.login, email: u.email || "", admin: !!u.admin, niveis: clone(u.niveis || {}), analista: clone(u.analista || {})};
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

  /* ============ interface: tela de login ============ */
  var CSS = ".ax-tela{position:fixed;inset:0;z-index:100000;background:var(--page,#EDF0F3);color:var(--ink,#101820);font:14px/1.5 'IBM Plex Sans',system-ui,sans-serif;display:flex;flex-direction:column;overflow:auto}" +
    ".ax-tela *{box-sizing:border-box}.ax-mast{background:#0E151B;border-bottom:3px solid var(--brand-red,#C2000C);padding:16px 20px;color:#E9EEF2}.ax-mast b{font:700 19px Archivo,system-ui,sans-serif;letter-spacing:-.02em}.ax-mast b i{font-style:normal;color:var(--brand-red,#C2000C)}.ax-mast b u{text-decoration:none;color:#7FC2DE}.ax-mast small{display:block;color:#8FA0AD;font-size:11.5px;margin-top:2px}" +
    ".ax-miolo{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 16px}.ax-cartao{width:min(420px,100%);background:var(--surface,#fff);border:1px solid var(--rule,#DCE3E9);border-radius:8px;box-shadow:0 10px 30px rgba(16,24,32,.12);padding:22px 22px 20px;position:relative}.ax-cartao::before{content:'';position:absolute;left:-1px;top:0;bottom:0;width:3px;background:var(--brand-red,#C2000C)}" +
    ".ax-cartao h1{margin:0 0 4px;font:700 20px Archivo,system-ui,sans-serif;letter-spacing:-.01em}.ax-sub{margin:0 0 14px;color:var(--ink-3,#5F6D77);font-size:13px}" +
    ".ax-abas{display:flex;gap:0;margin:0 0 16px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;overflow:hidden}.ax-abas button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font:600 13px 'IBM Plex Sans',sans-serif;color:var(--ink-2,#47545F);cursor:pointer}.ax-abas button+button{border-left:1px solid var(--rule-strong,#C2CCD5)}.ax-abas button[aria-pressed=true]{background:var(--blue-deep,#3C659B);color:#fff}" +
    ".ax-campo{display:flex;flex-direction:column;gap:3px;margin-bottom:11px}.ax-campo label{font:700 11px Archivo,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}.ax-campo input,.ax-campo select{font:inherit;font-size:14px;padding:9px 10px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820);width:100%}.ax-campo input:focus,.ax-campo select:focus{outline:2px solid var(--blue-deep,#3C659B);outline-offset:1px}.ax-dica{font-size:11.5px;color:var(--ink-3,#5F6D77)}" +
    ".ax-chk{display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0 14px}.ax-btn{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:6px;padding:9px 14px;font:600 13px 'IBM Plex Sans',sans-serif;cursor:pointer}.ax-btn:hover{border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}.ax-btn.prim{background:var(--brand-red,#C2000C);border-color:var(--brand-red,#C2000C);color:#fff;width:100%}.ax-btn.prim:hover{filter:brightness(1.08);color:#fff}.ax-btn:disabled{opacity:.55;cursor:default}" +
    ".ax-erro{color:var(--brand-red,#C2000C);font-size:13px;min-height:20px;margin:-2px 0 8px}.ax-ok{color:var(--dp-ok,#167A45)}.ax-aviso{background:var(--warn-soft,#FBEBDD);border:1px solid var(--warn,#B5530C);color:var(--ink,#101820);padding:8px 10px;border-radius:6px;font-size:12.5px;margin-bottom:12px}" +
    ".ax-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ax-acoes .ax-btn{flex:1}.ax-pe{padding:12px 20px;font-size:11.5px;color:var(--ink-3,#5F6D77);text-align:center}" +
    ".ax-chip-home{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:16px;z-index:60}.ax-chip{display:flex;justify-content:center;padding:6px 0}.ax-av{width:38px;height:38px;border-radius:50%;border:2px solid var(--rule-strong,#35434E);background:var(--blue-deep,#3C659B);color:#fff;font:700 13px Archivo,sans-serif;cursor:pointer;letter-spacing:.02em}.ax-av:hover,.ax-av[aria-expanded=true]{border-color:var(--brand-red,#C2000C)}.ax-av:focus-visible{outline:2px solid var(--blue-mid,#6BAAC9);outline-offset:2px}" +
    ".ax-pop{position:fixed;z-index:100003;width:230px;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:8px;box-shadow:0 12px 32px rgba(16,24,32,.28);padding:10px;display:flex;flex-direction:column;gap:8px;font:13px 'IBM Plex Sans',sans-serif}.ax-pop b{display:block;font-size:14px;line-height:1.25}.ax-pop span{display:block;color:var(--ink-3,#5F6D77);font-size:12px}.ax-pop button{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:6px;padding:7px 10px;font:600 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer;text-align:left}.ax-pop button:hover{border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}" +
    ".ax-dlg{position:fixed;inset:0;z-index:100001;background:rgba(10,16,22,.55);display:flex;align-items:center;justify-content:center;padding:16px}.ax-dlg .ax-cartao{max-height:92vh;overflow:auto}" +
    /* administração de usuários */
    ".au{display:flex;flex-direction:column;gap:14px;padding:4px 0 40px;font-size:13.5px}.au-abas{display:flex;gap:6px;flex-wrap:wrap}.au-abas button{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:16px;padding:6px 13px;font:600 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer}.au-abas button[aria-pressed=true]{background:var(--blue-deep,#3C659B);border-color:var(--blue-deep,#3C659B);color:#fff}" +
    ".au-lista{display:flex;flex-direction:column;gap:10px}.au-u{border:1px solid var(--rule,#DCE3E9);border-radius:8px;background:var(--surface,#fff);padding:12px 14px;display:flex;flex-direction:column;gap:10px}.au-u.pend{border-color:var(--warn,#B5530C)}.au-cab{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.au-cab b{font:700 15px Archivo,sans-serif}.au-cab span{color:var(--ink-3,#5F6D77);font-size:12px}.au-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--surface-3,#EAEFF3);color:var(--ink-2,#47545F)}.au-tag.pend{background:var(--warn-soft,#FBEBDD);color:var(--warn,#B5530C)}.au-tag.adm{background:var(--blue-pale,#DCE8F1);color:var(--blue-deep,#3C659B)}.au-tag.blq{background:var(--brand-red-soft,#FBEAEA);color:var(--brand-red,#C2000C)}" +
    ".au-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 14px}.au-mod{display:flex;flex-direction:column;gap:3px}.au-mod label{font:700 11px Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#5F6D77)}.au-mod select,.au-mod input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--rule-strong,#C2CCD5);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#101820);width:100%}" +
    ".au-bot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.au-bot .ax-btn{padding:6px 12px;font-size:12.5px}.au-bot .ax-btn.prim{width:auto}.au-bot .ax-btn.perigo{border-color:var(--brand-red,#C2000C);color:var(--brand-red,#C2000C)}.au-prov{background:var(--ok-soft,#E1F2E8);border:1px solid var(--dp-ok,#167A45);border-radius:6px;padding:8px 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.au-prov code{font:600 15px 'IBM Plex Mono',monospace;letter-spacing:.04em}" +
    ".au-vazio{color:var(--ink-3,#5F6D77);padding:24px 6px}.au-log{display:flex;flex-direction:column}.au-log div{display:flex;gap:12px;flex-wrap:wrap;padding:6px 2px;border-bottom:1px solid var(--rule,#DCE3E9);font-size:12.5px}.au-log time{font:12px 'IBM Plex Mono',monospace;color:var(--ink-3,#5F6D77)}";
  function injetarCss() { if (doc.getElementById("ax-css")) return; var st = doc.createElement("style"); st.id = "ax-css"; st.textContent = CSS; doc.head.appendChild(st); }
  var tela = null;
  function fecharTela() { if (tela) { tela.remove(); tela = null; } doc.documentElement.classList.remove("ax-bloqueado"); }
  function abrirTela() {
    injetarCss();
    if (tela) return tela;
    tela = doc.createElement("div"); tela.className = "ax-tela"; tela.setAttribute("role", "dialog"); tela.setAttribute("aria-modal", "true"); tela.setAttribute("aria-label", "Entrar no Control Hub");
    tela.innerHTML = '<div class="ax-mast"><b><i>Control</i> <u>Hub</u></b><small>Painel interno · ControlTax</small></div><div class="ax-miolo"><div class="ax-cartao" id="ax-cartao"></div></div><div class="ax-pe" id="ax-pe"></div>';
    doc.body.appendChild(tela);
    BACKEND.modo().then(function (m) { var pe = doc.getElementById("ax-pe"); if (pe) pe.textContent = m === "local" ? "Modo de teste: contas guardadas só neste navegador." : "Acesso restrito à equipe. Em caso de dúvida, fale com o administrador."; });
    return tela;
  }
  function campo(id, rot, tipo, extra) { return '<div class="ax-campo"><label for="' + id + '">' + rot + '</label><input id="' + id + '" type="' + (tipo || "text") + '" ' + (extra || "") + '></div>'; }
  function cartao() { return doc.getElementById("ax-cartao"); }
  function mostrarErro(msg, ok) { var e = doc.getElementById("ax-erro"); if (e) { e.textContent = msg || ""; e.className = "ax-erro" + (ok ? " ax-ok" : ""); } }
  function ocupado(btn, on, rot) { if (!btn) return; btn.disabled = !!on; if (rot) btn.textContent = rot; }
  function pegar(id) { var e = doc.getElementById(id); return e ? e.value : ""; }

  function telaEntrar(aba, aviso) {
    abrirTela(); var c = cartao(), criar = aba === "criar";
    BACKEND.listar("auth_usuarios").then(function (l) { var av = doc.getElementById("ax-primeiro"); if (av && !l.length) av.hidden = false; }, function () {});
    c.innerHTML = '<h1>' + (criar ? "Criar conta" : "Entrar") + '</h1><p class="ax-sub">' + (criar ? "O cadastro só vale depois de aprovado pelo administrador." : "Use o usuário e a senha do Control Hub.") + '</p>' +
      '<div class="ax-abas" role="group" aria-label="Entrar ou criar conta"><button type="button" data-aba="entrar" aria-pressed="' + !criar + '">Entrar</button><button type="button" data-aba="criar" aria-pressed="' + criar + '">Criar conta</button></div>' +
      '<div class="ax-aviso" id="ax-primeiro" hidden>Ainda não há nenhuma conta. A primeira que for criada vira <b>Administrador</b> e já entra liberada.</div>' +
      (aviso ? '<div class="ax-aviso">' + esc(aviso) + '</div>' : '') +
      '<form id="ax-form" autocomplete="on" novalidate>' +
      (criar ? campo("ax-nome", "Nome completo", "text", 'autocomplete="name" maxlength="80" required') + campo("ax-email", "E-mail", "email", 'autocomplete="email" maxlength="120" required') + campo("ax-login", "Usuário", "text", 'autocomplete="username" maxlength="32" autocapitalize="none" spellcheck="false" required') +
        campo("ax-senha", "Senha", "password", 'autocomplete="new-password" maxlength="100" required') + '<p class="ax-dica" style="margin:-6px 0 10px">Pelo menos 8 caracteres, com letras e números.</p>' + campo("ax-conf", "Repita a senha", "password", 'autocomplete="new-password" maxlength="100" required')
       : campo("ax-ident", "Usuário ou e-mail", "text", 'autocomplete="username" autocapitalize="none" spellcheck="false" required') + campo("ax-senha", "Senha", "password", 'autocomplete="current-password" required') +
        '<label class="ax-chk"><input type="checkbox" id="ax-manter"> Manter conectado neste computador</label>') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim" id="ax-ok">' + (criar ? "Criar conta" : "Entrar") + '</button></form>';
    [].forEach.call(c.querySelectorAll("[data-aba]"), function (b) { b.onclick = function () { telaEntrar(b.getAttribute("data-aba")); }; });
    var f = doc.getElementById("ax-form"), foco = doc.getElementById(criar ? "ax-nome" : "ax-ident"); if (foco) setTimeout(function () { foco.focus(); }, 30);
    f.onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok");
      if (criar) {
        ocupado(bt, true, "Criando…");
        criarConta({nome: pegar("ax-nome"), email: pegar("ax-email"), login: pegar("ax-login"), senha: pegar("ax-senha"), confirma: pegar("ax-conf")})
          .then(function (r) { return entrarConta(pegar("ax-login"), pegar("ax-senha"), false); }).then(depoisDeEntrar).catch(function (e) { ocupado(bt, false, "Criar conta"); mostrarErro(e.amigavel ? e.message : "Não consegui criar a conta agora. Tente de novo."); if (!e.amigavel) console.error(e); });
      } else {
        ocupado(bt, true, "Entrando…");
        entrarConta(pegar("ax-ident"), pegar("ax-senha"), doc.getElementById("ax-manter").checked).then(depoisDeEntrar).catch(function (e) { ocupado(bt, false, "Entrar"); mostrarErro(e.amigavel ? e.message : "Não consegui entrar agora. Tente de novo. (" + String((e && e.message) || e).slice(0, 80) + ")"); if (!e.amigavel) console.error(e); });
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
      campo("ax-n1", "Nova senha", "password", 'autocomplete="new-password" required') + '<p class="ax-dica" style="margin:-6px 0 10px">Pelo menos 8 caracteres, com letras e números.</p>' + campo("ax-n2", "Repita a nova senha", "password", 'autocomplete="new-password" required') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><button type="submit" class="ax-btn prim" id="ax-ok">Salvar e entrar</button></form>';
    setTimeout(function () { var i = doc.getElementById("ax-n1"); if (i) i.focus(); }, 30);
    doc.getElementById("ax-form").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro(""); var bt = doc.getElementById("ax-ok");
      if (pegar("ax-n1") !== pegar("ax-n2")) { mostrarErro("As senhas não são iguais."); return; }
      ocupado(bt, true, "Salvando…");
      mudarSenha(u.id, pegar("ax-n1"), false).then(function () { return BACKEND.ler("auth_usuarios/" + u.id); }).then(function (n) { n.id = u.id; depoisDeEntrar(n); })
        .catch(function (e) { ocupado(bt, false, "Salvar e entrar"); mostrarErro(e.amigavel ? e.message : "Não consegui salvar. Tente de novo."); });
    };
  }
  function depoisDeEntrar(u) {
    if (u.status === "bloqueado") { apagarLS(SESSAO_KEY); telaEntrar("entrar", "Esta conta está bloqueada. Fale com o administrador."); return; }
    if (u.status !== "ativo") { telaEspera(u); return; }
    if (u.trocarSenha) { telaTrocaObrigatoria(u); return; }
    liberar(u);
  }
  function liberar(u) {
    atual = u; snapAcesso = assinatura(u); fecharTela(); desenharChip();
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
    var b = doc.createElement("button"); b.type = "button"; b.className = "ax-av " + cls; b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Conta de " + atual.nome); b.title = atual.nome; b.textContent = iniciais(atual.nome); b.onclick = function () { abrirPop(b); }; return b;
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
  function dialogoSenha() {
    injetarCss();
    var d = doc.createElement("div"); d.className = "ax-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Trocar senha");
    d.innerHTML = '<div class="ax-cartao"><h1>Trocar senha</h1><p class="ax-sub">Ao trocar, você sai dos outros aparelhos.</p><form id="ax-fs" novalidate>' + campo("ax-s0", "Senha atual", "password", 'autocomplete="current-password" required') + campo("ax-s1", "Nova senha", "password", 'autocomplete="new-password" required') + campo("ax-s2", "Repita a nova senha", "password", 'autocomplete="new-password" required') +
      '<div class="ax-erro" id="ax-erro" role="alert"></div><div class="ax-acoes"><button type="button" class="ax-btn" id="ax-cancel">Cancelar</button><button type="submit" class="ax-btn prim" id="ax-oks" style="flex:1">Trocar senha</button></div></form></div>';
    doc.body.appendChild(d);
    var fecha = function () { d.remove(); };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") fecha(); });
    d.querySelector("#ax-cancel").onclick = fecha;
    setTimeout(function () { d.querySelector("#ax-s0").focus(); }, 30);
    d.querySelector("#ax-fs").onsubmit = function (ev) {
      ev.preventDefault(); mostrarErro("");
      if (d.querySelector("#ax-s1").value !== d.querySelector("#ax-s2").value) { mostrarErro("As senhas não são iguais."); return; }
      var bt = d.querySelector("#ax-oks"); ocupado(bt, true, "Salvando…");
      mudarSenha(atual.id, d.querySelector("#ax-s1").value, true, d.querySelector("#ax-s0").value).then(function () { mostrarErro("Senha trocada.", true); setTimeout(fecha, 900); })
        .catch(function (e) { ocupado(bt, false, "Trocar senha"); mostrarErro(e.amigavel ? e.message : "Não consegui trocar a senha. Tente de novo."); });
    };
  }
  function sair() {
    var uid = atual && atual.id; apagarLS(SESSAO_KEY);
    if (uid) BACKEND.registrar("sair", uid, uid);
    setTimeout(function () { location.reload(); }, 60);
  }

  /* ============ tela de administração de usuários ============ */
  var admin = {aba: "pendentes", lista: [], rasc: {}, prov: {}, off: null, raiz: null, analistas: {}, logDias: null, novo: null, criado: null};
  function rascunhoNovo() { return {nome: "", email: "", login: "", senha: senhaProvisoria(), trocar: true, admin: false, niveis: nivelVazio(), analista: {}, erro: "", ocupado: false}; }
  function opcoesNivel(mod) {
    var ops = mod === "cardapio" ? [["", "Sem acesso"], ["consulta", "Consulta"], ["coord", "Coordenador"]] : [["", "Sem acesso"], ["consulta", "Consulta"], ["analista", "Analista"], ["coord", "Coordenador"]];
    return ops;
  }
  function dadosEdit(u) {
    var r = admin.rasc[u.id]; if (r) return r;
    r = admin.rasc[u.id] = {nome: u.nome || "", email: u.email || "", login: u.login || "", admin: !!u.admin, niveis: Object.assign(nivelVazio(), u.niveis || {}), analista: Object.assign({}, u.analista || {}), sujo: false};
    return r;
  }
  function carregarAnalistas() {
    var H = window.__hubApi; if (!H || !H.carregar) return;
    COM_ANALISTA.forEach(function (m) {
      if (admin.analistas[m]) return; admin.analistas[m] = [];
      H.carregar(m).then(function (a) { admin.analistas[m] = (a && a.analistas ? a.analistas() : []).filter(Boolean); desenharAdmin(); }).catch(function () {});
    });
  }
  function nAdminsAtivos(excecao) { return admin.lista.filter(function (u) { return u.admin && u.status === "ativo" && u.id !== excecao; }).length; }
  function blocoModulos(e) {
    return MODS.map(function (m) {
      var sel = '<select data-n="' + m + '" aria-label="Nível em ' + esc(MODN[m]) + '"' + (e.admin ? " disabled" : "") + '>' + opcoesNivel(m).map(function (o) { return '<option value="' + o[0] + '"' + ((e.admin ? "coord" : e.niveis[m]) === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select>';
      var an = COM_ANALISTA.indexOf(m) !== -1 && !e.admin && e.niveis[m] === "analista" ? '<input data-a="' + m + '" list="au-dl-' + m + '" value="' + esc(e.analista[m] || "") + '" placeholder="Nome do analista em ' + esc(MODN[m]) + '" aria-label="Nome do analista em ' + esc(MODN[m]) + '">' : "";
      return '<div class="au-mod"><label>' + esc(MODN[m]) + '</label>' + sel + an + '</div>';
    }).join("");
  }
  function formNovo() {
    var n = admin.novo;
    if (!n) return '<div><button type="button" class="ax-btn prim" data-novo="abrir" style="width:auto">＋ Novo usuário</button></div>';
    var f = function (k, rot, tipo, extra) { return '<div class="au-mod"><label for="au-nv-' + k + '">' + rot + '</label><input id="au-nv-' + k + '" data-nv="' + k + '" type="' + tipo + '" value="' + esc(n[k]) + '" ' + (extra || "") + '></div>'; };
    return '<form class="au-u au-novo" novalidate autocomplete="off"><div class="au-cab"><b>Novo usuário</b><span>A conta já nasce ativa, sem precisar de aprovação.</span></div>' +
      '<div class="au-mods">' + f("nome", "Nome", "text", 'autocomplete="off" maxlength="80"') + f("email", "E-mail", "email", 'autocomplete="off"') + f("login", "Usuário (para entrar)", "text", 'autocomplete="off" autocapitalize="none" spellcheck="false"') +
      '<div class="au-mod"><label for="au-nv-senha">Senha inicial</label><div style="display:flex;gap:6px"><input id="au-nv-senha" data-nv="senha" type="text" value="' + esc(n.senha) + '" autocomplete="off" spellcheck="false" style="font-family:\'IBM Plex Mono\',monospace"><button type="button" class="ax-btn" data-novo="gerar" style="white-space:nowrap;padding:6px 10px">Gerar</button></div></div></div>' +
      '<label class="ax-chk" style="margin:0"><input type="checkbox" data-nvc="trocar"' + (n.trocar ? " checked" : "") + '> Exigir que a pessoa troque a senha no primeiro acesso</label>' +
      '<label class="ax-chk" style="margin:0"><input type="checkbox" data-nvc="admin"' + (n.admin ? " checked" : "") + '> Administrador (acesso total e gerencia usuários)</label>' +
      '<div class="au-mods">' + blocoModulos(n) + '</div>' +
      '<div class="au-bot"><button type="submit" class="ax-btn prim" data-novo="criar"' + (n.ocupado ? " disabled" : "") + '>' + (n.ocupado ? "Criando…" : "Criar usuário") + '</button><button type="button" class="ax-btn" data-novo="cancelar">Cancelar</button><span class="ax-erro" style="margin:0" role="alert">' + esc(n.erro) + '</span></div></form>';
  }
  function avisoCriado() {
    var c = admin.criado; if (!c) return "";
    return '<div class="au-prov"><span><b>' + esc(c.nome) + '</b> foi criado(a). Passe estes dados (a senha só aparece agora' + (c.trocar ? "; será pedida a troca no primeiro acesso" : "") + '):</span><code>' + esc(c.login) + ' / ' + esc(c.senha) + '</code><button type="button" class="ax-btn" data-novo="copiar">Copiar</button><button type="button" class="ax-btn" data-novo="fechar">Fechar</button></div>';
  }
  function criarNovo() {
    var n = admin.novo; if (!n || n.ocupado) return;
    var f = {nome: n.nome, email: String(n.email).trim(), login: n.login, senha: n.senha, confirma: n.senha};
    var msg = validarCadastro(f);
    if (!msg && !n.admin && !MODS.some(function (m) { return n.niveis[m]; })) msg = "Escolha pelo menos um módulo (ou marque Administrador).";
    if (!msg && !n.admin && COM_ANALISTA.some(function (m) { return n.niveis[m] === "analista" && !String(n.analista[m] || "").trim(); })) msg = "Para o nível Analista, informe o nome do analista naquele módulo.";
    if (msg) { n.erro = msg; desenharAdmin(); return; }
    var niveis = {}, an = {};
    MODS.forEach(function (m) { niveis[m] = n.admin ? "coord" : (n.niveis[m] || ""); });
    COM_ANALISTA.forEach(function (m) { if (!n.admin && niveis[m] === "analista") an[m] = String(n.analista[m]).trim(); });
    n.ocupado = true; n.erro = ""; desenharAdmin();
    criarConta(f, {admin: !!n.admin, niveis: niveis, analista: an, trocarSenha: !!n.trocar, por: atual.id}).then(function () {
      admin.criado = {nome: String(n.nome).trim(), login: norm(n.login), senha: n.senha, trocar: !!n.trocar};
      admin.novo = null; admin.aba = "ativos"; desenharAdmin();
    }).catch(function (e) { n.ocupado = false; n.erro = e && e.amigavel ? e.message : "Não consegui criar o usuário agora. Tente de novo."; if (!(e && e.amigavel)) console.error(e); desenharAdmin(); });
  }
  function cardUsuario(u) {
    var e = dadosEdit(u), eu = atual && atual.id === u.id;
    var tags = '<span class="au-tag ' + (u.status === "pendente" ? "pend" : u.status === "bloqueado" ? "blq" : "") + '">' + (u.status === "pendente" ? "Aguardando liberação" : u.status === "bloqueado" ? "Bloqueado" : "Ativo") + '</span>' + (u.admin ? '<span class="au-tag adm">Administrador</span>' : "") + (eu ? '<span class="au-tag">você</span>' : "");
    var mods = blocoModulos(e);
    var prov = admin.prov[u.id] ? '<div class="au-prov"><span>Senha provisória (mostrada só agora):</span><code>' + esc(admin.prov[u.id]) + '</code><button type="button" class="ax-btn" data-copia="' + esc(u.id) + '">Copiar</button></div>' : "";
    var bot = u.status === "pendente" ? '<button type="button" class="ax-btn prim" data-ac="aprovar">Aprovar e salvar</button><button type="button" class="ax-btn perigo" data-ac="recusar">Recusar cadastro</button>'
      : '<button type="button" class="ax-btn prim" data-ac="salvar"' + (e.sujo ? "" : " disabled") + '>Salvar</button>' +
        (u.status === "bloqueado" ? '<button type="button" class="ax-btn" data-ac="desbloquear">Desbloquear</button>' : (eu ? "" : '<button type="button" class="ax-btn perigo" data-ac="bloquear">Bloquear</button>')) +
        '<button type="button" class="ax-btn" data-ac="senha">Redefinir senha</button>' + (eu ? "" : '<button type="button" class="ax-btn perigo" data-ac="excluir">Excluir</button>');
    var idf = function (k, rot, tipo, extra) { return '<div class="au-mod"><label>' + rot + '</label><input data-f="' + k + '" type="' + tipo + '" value="' + esc(e[k]) + '" aria-label="' + rot + '" autocomplete="off" ' + (extra || "") + '></div>'; };
    var ident = '<div class="au-mods">' + idf("nome", "Nome", "text", 'maxlength="80"') + idf("email", "E-mail", "email") + idf("login", "Usuário (para entrar)", "text", 'autocapitalize="none" spellcheck="false"') + '</div>';
    return '<div class="au-u' + (u.status === "pendente" ? " pend" : "") + '" data-id="' + esc(u.id) + '"><div class="au-cab"><b>' + esc(u.nome) + '</b><span>' + esc(u.login) + ' · ' + esc(u.email || "") + '</span>' + tags + '<span>Cadastro ' + fmtData(u.criadoEm) + ' · último acesso ' + fmtData(u.ultimoAcesso) + '</span></div>' + ident +
      '<label class="ax-chk" style="margin:0"><input type="checkbox" data-adm' + (e.admin ? " checked" : "") + (eu && nAdminsAtivos(u.id) === 0 ? " disabled" : "") + '> Administrador (acesso total e gerencia usuários)</label>' +
      '<div class="au-mods">' + mods + '</div>' + prov + '<div class="au-bot">' + bot + '<span class="ax-erro" style="margin:0" data-msg role="status"></span></div></div>';
  }
  function desenharAdmin() {
    var raiz = admin.raiz; if (!raiz || !raiz.isConnected) return;
    var porStatus = function (s) { return admin.lista.filter(function (u) { return u.status === s; }); };
    var pend = porStatus("pendente"), ativos = porStatus("ativo"), blq = porStatus("bloqueado");
    var abas = [["pendentes", "Pendentes", pend.length], ["ativos", "Ativos", ativos.length], ["bloqueados", "Bloqueados", blq.length], ["acessos", "Acessos", null]];
    var corpo = "";
    if (admin.aba === "acessos") corpo = '<div class="au-log" id="au-log"><div class="au-vazio">Carregando os acessos dos últimos dias…</div></div>';
    else {
      var l = admin.aba === "pendentes" ? pend : admin.aba === "ativos" ? ativos : blq;
      corpo = l.length ? '<div class="au-lista">' + l.slice().sort(function (a, b) { return norm(a.nome) < norm(b.nome) ? -1 : 1; }).map(cardUsuario).join("") + '</div>' : '<div class="au-vazio">' + (admin.aba === "pendentes" ? "Nenhum cadastro aguardando liberação." : admin.aba === "ativos" ? "Nenhum usuário ativo." : "Nenhum usuário bloqueado.") + '</div>';
    }
    var dls = COM_ANALISTA.map(function (m) { return '<datalist id="au-dl-' + m + '">' + (admin.analistas[m] || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist>'; }).join("");
    var ae = doc.activeElement && raiz.contains(doc.activeElement) ? doc.activeElement : null, noNovo = !!(ae && ae.closest(".au-novo"));
    var foco = ae ? ae.getAttribute("data-n") || ae.getAttribute("data-a") : null;
    raiz.innerHTML = '<div class="au"><p style="margin:0;color:var(--ink-3,#5F6D77)">Cada pessoa tem um nível por módulo. <b>Coordenador</b> edita tudo no módulo, <b>Analista</b> edita só a própria carteira (use o nome que aparece nas listas de analistas), <b>Consulta</b> só vê. Sem nível, o módulo fica escondido.</p>' +
      avisoCriado() + formNovo() + '<div class="au-abas" role="group" aria-label="Filtro">' + abas.map(function (a) { return '<button type="button" data-aba="' + a[0] + '" aria-pressed="' + (admin.aba === a[0]) + '">' + a[1] + (a[2] != null ? " (" + a[2] + ")" : "") + '</button>'; }).join("") + '</div>' + corpo + dls + '</div>';
    if (foco) { var pre = noNovo ? ".au-novo " : ".au-lista ", f = raiz.querySelector(pre + '[data-n="' + foco + '"],' + pre + '[data-a="' + foco + '"]'); if (f) f.focus(); }
    if (admin.aba === "acessos") carregarLog();
  }
  function carregarLog() {
    var dias = [], d = new Date(); for (var i = 0; i < 7; i++) { dias.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())); d.setDate(d.getDate() - 1); }
    Promise.all(dias.map(function (k) { return BACKEND.ler("auth_log/" + k).then(function (x) { return Object.keys((x && x.itens) || {}).map(function (id) { return x.itens[id]; }); }, function () { return []; }); })).then(function (r) {
      var itens = [].concat.apply([], r).sort(function (a, b) { return a.em < b.em ? 1 : -1; }).slice(0, 120), nome = {};
      admin.lista.forEach(function (u) { nome[u.id] = u.nome; });
      var ROT = {login: "entrou", sair: "saiu", senha_errada: "errou a senha", cadastro: "criou a conta", primeiro_admin: "criou a conta (primeiro administrador)", troca_senha: "trocou a senha", aprovado: "teve a conta aprovada", bloqueado: "foi bloqueado(a)", desbloqueado: "foi desbloqueado(a)", senha_redefinida: "teve a senha redefinida", acesso_alterado: "teve o acesso alterado", recusado: "teve o cadastro recusado", excluido: "foi excluído(a)", criado_admin: "teve a conta criada pelo administrador", dados_alterados: "teve nome, e-mail ou usuário corrigido"};
      var el = doc.getElementById("au-log"); if (!el) return;
      el.innerHTML = itens.length ? itens.map(function (x) { var por = x.por && x.por !== x.uid && nome[x.por] ? " · por " + esc(nome[x.por]) : ""; return '<div><time>' + fmtData(Date.parse(x.em)) + '</time><span><b>' + esc(nome[x.uid] || x.nomeAntigo || "(conta removida)") + '</b> ' + esc(ROT[x.tipo] || x.tipo) + por + '</span></div>'; }).join("") : '<div class="au-vazio">Sem acessos registrados nos últimos 7 dias.</div>';
    });
  }
  function msgCard(card, txt, ok) { var m = card && card.querySelector("[data-msg]"); if (m) { m.textContent = txt; m.className = "ax-erro" + (ok ? " ax-ok" : ""); m.style.margin = "0"; } }
  function salvarAcesso(u, extra) {
    var e = dadosEdit(u), niveis = {}, an = {};
    MODS.forEach(function (m) { niveis[m] = e.admin ? "coord" : (e.niveis[m] || ""); });
    COM_ANALISTA.forEach(function (m) { if (!e.admin && niveis[m] === "analista" && String(e.analista[m] || "").trim()) an[m] = String(e.analista[m]).trim(); });
    var up = Object.assign({admin: !!e.admin, niveis: niveis, analista: an}, extra || {});
    return BACKEND.atualizar("auth_usuarios/" + u.id, up).then(function () { delete admin.rasc[u.id]; });
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
  function acaoAdmin(ac, id, card) {
    var u = admin.lista.filter(function (x) { return x.id === id; })[0]; if (!u) return;
    var por = atual.id, e = dadosEdit(u);
    function erroGenerico(err) { if (err && err.amigavel) { msgCard(card, err.message); return; } console.error(err); msgCard(card, "Não consegui salvar agora. Tente de novo."); }
    if (ac === "aprovar" || ac === "salvar") {
      if (u.admin && !e.admin && nAdminsAtivos(u.id) === 0) { msgCard(card, "Precisa existir pelo menos um administrador ativo."); return; }
      var temModulo = e.admin || MODS.some(function (m) { return e.niveis[m]; });
      if (ac === "aprovar" && !temModulo) { msgCard(card, "Escolha pelo menos um módulo antes de aprovar."); return; }
      var semNome = !e.admin && COM_ANALISTA.some(function (m) { return e.niveis[m] === "analista" && !String(e.analista[m] || "").trim(); });
      if (semNome) { msgCard(card, "Para o nível Analista, informe o nome do analista naquele módulo."); return; }
      salvarIdentidade(u, e).then(function (mudou) {
        if (mudou) BACKEND.registrar("dados_alterados", id, por, {antes: u.login});
        return salvarAcesso(u, ac === "aprovar" ? {status: "ativo", aprovadoPor: por, aprovadoEm: agora()} : {});
      }).then(function () { BACKEND.registrar(ac === "aprovar" ? "aprovado" : "acesso_alterado", id, por); }).catch(erroGenerico);
    } else if (ac === "bloquear" || ac === "desbloquear") {
      if (ac === "bloquear" && u.admin && nAdminsAtivos(u.id) === 0) { msgCard(card, "Não dá para bloquear o único administrador."); return; }
      BACKEND.atualizar("auth_usuarios/" + id, ac === "bloquear" ? {status: "bloqueado", sv: (u.sv || 1) + 1} : {status: "ativo", falhas: 0, bloqueadoAte: 0}).then(function () { BACKEND.registrar(ac === "bloquear" ? "bloqueado" : "desbloqueado", id, por); }).catch(erroGenerico);
    } else if (ac === "senha") {
      var nova = senhaProvisoria(), sal = novoSal();
      hashSenha(nova, sal, ITER).then(function (h) { return BACKEND.atualizar("auth_usuarios/" + id, {hash: h, salt: sal, iter: ITER, trocarSenha: true, sv: (u.sv || 1) + 1, falhas: 0, bloqueadoAte: 0}); })
        .then(function () { admin.prov[id] = nova; BACKEND.registrar("senha_redefinida", id, por); desenharAdmin(); }).catch(erroGenerico);
    } else if (ac === "recusar" || ac === "excluir") {
      if (u.admin && nAdminsAtivos(u.id) === 0) { msgCard(card, "Não dá para excluir o único administrador."); return; }
      var m = card.querySelector("[data-msg]"); if (!card._conf) { card._conf = true; msgCard(card, "Clique de novo para confirmar: a conta será apagada."); setTimeout(function () { card._conf = false; msgCard(card, ""); }, 4000); return; }
      Promise.all((u.chaves || []).map(function (k) { return BACKEND.apagar("auth_logins/" + k); })).then(function () { return BACKEND.apagar("auth_usuarios/" + id); }).then(function () { BACKEND.registrar(ac === "recusar" ? "recusado" : "excluido", id, por, {nomeAntigo: u.nome}); }).catch(erroGenerico);
    }
  }
  function montarUsuarios(raiz) {
    if (!atual || !atual.admin) { raiz.innerHTML = '<div class="au-vazio">Só o administrador acessa esta tela.</div>'; return; }
    injetarCss(); admin.raiz = raiz; if (admin.off) admin.off();
    admin.off = BACKEND.ouvirColecao("auth_usuarios", function (l) {
      admin.lista = l;
      var ae = doc.activeElement; if (ae && ae.tagName === "INPUT" && ae.type !== "checkbox" && admin.raiz && admin.raiz.contains(ae)) return; // não atrapalha quem está digitando
      desenharAdmin();
    });
    carregarAnalistas();
    if (!raiz.__ax) {
      raiz.__ax = true;
      raiz.addEventListener("click", function (ev) {
        var ab = ev.target.closest("[data-aba]"); if (ab) { admin.aba = ab.getAttribute("data-aba"); desenharAdmin(); return; }
        var nv = ev.target.closest("[data-novo]");
        if (nv) {
          var a = nv.getAttribute("data-novo");
          if (a === "abrir") { admin.novo = rascunhoNovo(); admin.criado = null; desenharAdmin(); var i = raiz.querySelector("#au-nv-nome"); if (i) i.focus(); }
          else if (a === "cancelar") { admin.novo = null; desenharAdmin(); }
          else if (a === "gerar" && admin.novo) { admin.novo.senha = senhaProvisoria(); var sn = raiz.querySelector("#au-nv-senha"); if (sn) sn.value = admin.novo.senha; }
          else if (a === "fechar") { admin.criado = null; desenharAdmin(); }
          else if (a === "copiar" && admin.criado) { var c = admin.criado, t = "Control Hub\nUsuário: " + c.login + "\nSenha: " + c.senha, ok2 = function () { nv.textContent = "Copiado"; }; try { navigator.clipboard.writeText(t).then(ok2, function () { nv.textContent = "Selecione e copie"; }); } catch (e) { nv.textContent = "Selecione e copie"; } }
          return;
        }
        var cp = ev.target.closest("[data-copia]"); if (cp) { var t = admin.prov[cp.getAttribute("data-copia")]; var ok = function () { cp.textContent = "Copiado"; }; try { navigator.clipboard.writeText(t).then(ok, function () { cp.textContent = "Selecione e copie"; }); } catch (e) { cp.textContent = "Selecione e copie"; } return; }
        var b = ev.target.closest("[data-ac]"), card = ev.target.closest(".au-u"); if (b && card) acaoAdmin(b.getAttribute("data-ac"), card.getAttribute("data-id"), card);
      });
      raiz.addEventListener("submit", function (ev) { if (ev.target.closest(".au-novo")) { ev.preventDefault(); criarNovo(); } });
      raiz.addEventListener("input", function (ev) {
        var t = ev.target, n = admin.novo, cd = t.closest(".au-u:not(.au-novo)");
        if (cd && t.hasAttribute("data-f")) {
          var uu = admin.lista.filter(function (x) { return x.id === cd.getAttribute("data-id"); })[0]; if (!uu) return;
          var ee = dadosEdit(uu); ee[t.getAttribute("data-f")] = t.value; ee.sujo = true;
          var sv = cd.querySelector("[data-ac=salvar]"); if (sv) sv.disabled = false; return;
        }
        if (!n || !t.closest(".au-novo")) return;
        if (t.hasAttribute("data-nv")) n[t.getAttribute("data-nv")] = t.value;
        else if (t.hasAttribute("data-a")) n.analista[t.getAttribute("data-a")] = t.value;
      });
      raiz.addEventListener("change", function (ev) {
        var t = ev.target, n = admin.novo;
        if (n && t.closest(".au-novo")) {
          if (t.hasAttribute("data-nvc")) n[t.getAttribute("data-nvc")] = t.checked;
          else if (t.hasAttribute("data-n")) n.niveis[t.getAttribute("data-n")] = t.value;
          else if (t.hasAttribute("data-nv")) n[t.getAttribute("data-nv")] = t.value;
          else if (t.hasAttribute("data-a")) n.analista[t.getAttribute("data-a")] = t.value;
          if (t.hasAttribute("data-nvc") || t.hasAttribute("data-n")) setTimeout(desenharAdmin, 0);
          return;
        }
        var card = ev.target.closest(".au-u"); if (!card || ev.target.hasAttribute("data-f")) return;
        var u = admin.lista.filter(function (x) { return x.id === card.getAttribute("data-id"); })[0]; if (!u) return; var e = dadosEdit(u);
        if (ev.target.hasAttribute("data-adm")) e.admin = ev.target.checked;
        else if (ev.target.hasAttribute("data-n")) e.niveis[ev.target.getAttribute("data-n")] = ev.target.value;
        else if (ev.target.hasAttribute("data-a")) e.analista[ev.target.getAttribute("data-a")] = ev.target.value;
        e.sujo = true; setTimeout(desenharAdmin, 0);
      });
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
