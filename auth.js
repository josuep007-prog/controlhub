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
    ".ax-erro{color:var(--brand-red,#C2000C);font-size:13px;min-height:20px;margin:-2px 0 8px}.ax-ok{color:var(--dp-ok,#167A45)}.ax-aviso{background:color-mix(in srgb,var(--status-warn,#B5530C) 14%,var(--surface,#fff));border:1px solid var(--status-warn,#B5530C);color:var(--ink,#101820);padding:8px 10px;border-radius:6px;font-size:12.5px;margin-bottom:12px}" +
    ".ax-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ax-acoes .ax-btn{flex:1}.ax-pe{padding:12px 20px;font-size:11.5px;color:var(--ink-3,#5F6D77);text-align:center}" +
    ".ax-chip-home{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:16px;z-index:60}.ax-chip{display:flex;justify-content:center;padding:6px 0}.ax-av{width:38px;height:38px;border-radius:50%;border:2px solid var(--rule-strong,#35434E);background:var(--blue-deep,#3C659B);color:#fff;font:700 13px Archivo,sans-serif;cursor:pointer;letter-spacing:.02em}.ax-av:hover,.ax-av[aria-expanded=true]{border-color:var(--brand-red,#C2000C)}.ax-av:focus-visible{outline:2px solid var(--blue-mid,#6BAAC9);outline-offset:2px}" +
    ".ax-pop{position:fixed;z-index:100003;width:230px;background:var(--surface,#fff);color:var(--ink,#101820);border:1px solid var(--rule-strong,#C2CCD5);border-radius:8px;box-shadow:0 12px 32px rgba(16,24,32,.28);padding:10px;display:flex;flex-direction:column;gap:8px;font:13px 'IBM Plex Sans',sans-serif}.ax-pop b{display:block;font-size:14px;line-height:1.25}.ax-pop span{display:block;color:var(--ink-3,#5F6D77);font-size:12px}.ax-pop button{border:1px solid var(--rule-strong,#C2CCD5);background:var(--surface,#fff);color:var(--ink-2,#47545F);border-radius:6px;padding:7px 10px;font:600 12.5px 'IBM Plex Sans',sans-serif;cursor:pointer;text-align:left}.ax-pop button:hover{border-color:var(--blue-deep,#3C659B);color:var(--blue-deep,#3C659B)}" +
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

  // botão Mostrar/Ocultar nos campos de senha e indicador de força nas senhas novas
  function melhorarSenhas(cont) {
    [].forEach.call(cont.querySelectorAll('input[type="password"]'), function (i) {
      if (i.parentNode.classList.contains("ax-sen")) return;
      var w = doc.createElement("div"); w.className = "ax-sen"; i.parentNode.insertBefore(w, i); w.appendChild(i);
      var b = doc.createElement("button"); b.type = "button"; b.className = "ax-olho"; b.textContent = "Mostrar"; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", "Mostrar a senha");
      b.onclick = function () { var vis = i.type === "password"; i.type = vis ? "text" : "password"; b.textContent = vis ? "Ocultar" : "Mostrar"; b.setAttribute("aria-pressed", String(vis)); b.setAttribute("aria-label", vis ? "Ocultar a senha" : "Mostrar a senha"); i.focus(); };
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
    melhorarSenhas(c);
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
    melhorarSenhas(c);
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
    doc.body.appendChild(d); melhorarSenhas(d);
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
  var ROTULO = {login: "entrou", sair: "saiu", senha_errada: "errou a senha", cadastro: "criou a conta", primeiro_admin: "criou a conta (primeiro administrador)", troca_senha: "trocou a senha", aprovado: "teve a conta aprovada", bloqueado: "foi bloqueado(a)", desbloqueado: "foi desbloqueado(a)", senha_redefinida: "teve a senha redefinida", acesso_alterado: "teve o acesso alterado", recusado: "teve o cadastro recusado", excluido: "foi excluído(a)", criado_admin: "teve a conta criada pelo administrador", dados_alterados: "teve nome, e-mail ou usuário corrigido", sessoes_encerradas: "teve as sessões encerradas"};
  var GRUPOS = {entradas: ["login", "sair"], erros: ["senha_errada"], acessos: ["acesso_alterado", "aprovado", "bloqueado", "desbloqueado", "senha_redefinida", "dados_alterados", "sessoes_encerradas", "troca_senha"], contas: ["cadastro", "primeiro_admin", "criado_admin", "recusado", "excluido"]};
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
