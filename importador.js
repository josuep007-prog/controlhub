/* Importador Domínio — ferramenta do Departamento Pessoal no Control Hub.
   Porte do "Gerador de importação Domínio" (RPA e Lançamentos): a regra de
   negócio (leitura da planilha e do PDF, conferências, registro de largura
   fixa, Latin-1 + CRLF) é a mesma do original. O que muda é a borda: visual do
   Hub, downloads pela página, empresa escolhida da lista do DP, cadastro
   atualizado com os códigos lidos e registro das importações da equipe.
   Carregado sob demanda pelo index.html: window.HubImportador.montar(el, api). */
(function(){

const ICONE_SETA = '<svg class="ic ic-sm" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';

const TEMPLATE = `
<div class="imp-drag" id="imp-dragOverlay" hidden>
  <div class="imp-drag-card"><b>Solte a planilha para gerar</b><span>Aceita .xlsx e .xls — solte várias para gerar em lote. PDF do Domínio também.</span></div>
</div>

<div class="imp-cab">
  <div class="imp-cab-txt">
    <h3>Importador Domínio</h3>
    <p>Lê a planilha preenchida pelo cliente, confere linha a linha e monta o arquivo de largura fixa para
      <b>Utilitários › Importação › de Arquivo Texto</b>.</p>
  </div>
  <div class="seg imp-mods" role="tablist" aria-label="Módulo">
    <button type="button" id="imp-tabRpa" role="tab">RPA <small>autônomos</small></button>
    <button type="button" id="imp-tabLanc" role="tab">Lançamentos <small>rubricas</small></button>
  </div>
</div>
<details class="imp-leiaute">
  <summary>Leiaute do registro · <b id="imp-leiauteTam"></b></summary>
  <div class="imp-fita" id="imp-leiaute"></div>
</details>

<section class="imp-passo" id="imp-cardContra">
  <div class="imp-passo-h"><span class="imp-n">1</span><h4>Empresa e modelo para o cliente</h4></div>
  <div class="imp-emp-linha">
    <div class="field imp-emp">Empresa
      <div class="cb"><input id="imp-emp" role="combobox" aria-expanded="false" aria-controls="imp-empLista" aria-autocomplete="list" placeholder="Escolha a empresa do DP (opcional)" autocomplete="off"><button type="button" class="cb-btn" id="imp-empBtn" tabindex="-1" aria-label="Ver as empresas">${ICONE_SETA}</button><div class="cb-lista imp-emp-lista" id="imp-empLista" role="listbox" hidden></div></div>
    </div>
    <div class="imp-emp-info" id="imp-empInfo"></div>
  </div>
  <p class="imp-txt">Baixe a planilha travada para o cliente completar só a coluna de valor. Com a empresa escolhida,
    o modelo já sai com o código no Domínio e as rubricas, autônomos e funcionários do cadastro — você confere tudo antes.</p>
  <div class="imp-acoes">
    <button type="button" class="btn btn-primary" id="imp-btnModelo">Baixar modelo de RPA</button>
    <button type="button" class="btn" id="imp-btnContra">Ler PDF do Domínio</button>
    <details class="imp-colar">
      <summary>ou cole o texto do contracheque</summary>
      <textarea id="imp-cpColado" rows="4" placeholder="Cole aqui o texto copiado do contracheque, mantendo as colunas…"></textarea>
      <button type="button" class="btn btn-sm" id="imp-btnColar">Ler o texto colado</button>
    </details>
  </div>
  <p class="imp-dica">Também dá para soltar aqui um PDF do Domínio — <b>Relação Geral dos Líquidos</b> (traz o código de cada um), contracheque ou recibo de RPA.</p>
  <input type="file" id="imp-inContra" accept=".pdf,.txt" hidden>
</section>

<section class="imp-passo">
  <div class="imp-passo-h"><span class="imp-n">2</span><h4>Planilha preenchida</h4></div>
  <div class="imp-drop" id="imp-dropDePara" tabindex="0" role="button" aria-label="Carregar a planilha preenchida">
    <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>
    <div>
      <div class="imp-drop-tit" id="imp-dropTitulo"></div>
      <div class="imp-drop-dica" id="imp-dropHint"></div>
      <div class="imp-drop-arq" id="imp-fileDePara"></div>
    </div>
  </div>
  <input type="file" id="imp-inDePara" accept=".xlsx,.xlsm,.xls" multiple hidden>
  <p class="imp-txt">Lê nome, código e valor direto da aba de cadastro. Preencha também o <b>Total esperado</b>
    na aba Parametros: a soma é conferida e a diferença aparece aqui.</p>
  <div class="imp-bar">
    <button type="button" class="btn btn-primary" id="imp-btnGerar" disabled>Gerar arquivo</button>
    <button type="button" class="btn" id="imp-btnBaixar" disabled>Baixar .txt</button>
    <button type="button" class="btn" id="imp-btnRelatorio" disabled>Conferência (.csv)</button>
    <button type="button" class="btn" id="imp-btnCopiar" disabled>Copiar texto</button>
    <button type="button" class="btn" id="imp-btnVoltarLote" hidden>Voltar ao lote</button>
    <button type="button" class="btn btn-ghost" id="imp-btnLimpar" hidden>Limpar</button>
    <span class="imp-status" id="imp-status" role="status" aria-live="polite"></span>
    <span class="imp-atalho"><kbd>Ctrl</kbd>+<kbd>↵</kbd> gerar · <kbd>Ctrl</kbd>+<kbd>S</kbd> baixar</span>
  </div>
</section>

<div id="imp-avisos" aria-live="polite"></div>
<div id="imp-saida"></div>

<p class="imp-rodape">Leiaute oficial Domínio — RPA: registro Sefip 13 por valor líquido, 148 caracteres ·
  Lançamentos: registro “10”, 48 caracteres. Arquivo gravado em Latin-1 com quebra de linha CRLF, como o Domínio espera.
  Cada arquivo baixado fica registrado em Ferramentas › Últimas importações e no histórico da empresa.</p>
`;

const DIALOGOS = `
<dialog class="dlg dlg-lg imp-dlg" id="imp-modalContra" aria-labelledby="imp-cpTitulo">
  <div class="dlg-head">
    <div class="imp-dlg-tit"><h2 id="imp-cpTitulo">Confira antes de montar a planilha</h2><p id="imp-cpOrigem"></p></div>
    <button type="button" class="icon-btn dlg-close" id="imp-cpFechar" aria-label="Fechar sem gerar"><svg class="ic"><use href="#i-x"/></svg></button>
  </div>
  <div class="dlg-body">
    <div id="imp-cpAvisos"></div>
    <div class="imp-campos">
      <label class="field">Empresa<input id="imp-cpEmpresa" type="text" autocomplete="off"></label>
      <label class="field">Código no Domínio<input id="imp-cpCodigo" type="text" inputmode="numeric" placeholder="obrigatório" autocomplete="off"></label>
      <label class="field">Competência<input id="imp-cpComp" type="text" placeholder="MM/AAAA" autocomplete="off"></label>
      <div class="field" id="imp-campoTipo">
        <label for="imp-cpTipo">Tipo do processo</label>
        <input id="imp-cpTipo" type="text" inputmode="numeric" value="11" autocomplete="off">
        <span class="imp-tipo-nome" id="imp-cpTipoNome"></span>
        <details class="imp-tipos">
          <summary>tipos cadastrados</summary>
          <div class="imp-tipos-pop">
            <table><tbody id="imp-cpTipoLista"></tbody></table>
            <button type="button" class="linkish" id="imp-cpTipoEditar">editar lista da equipe</button>
            <div id="imp-cpTipoEditor" hidden>
              <textarea id="imp-cpTipoTexto" rows="5" placeholder="11 = Folha mensal"></textarea>
              <button type="button" class="btn btn-sm" id="imp-cpTipoSalvar">Salvar lista</button>
            </div>
          </div>
        </details>
      </div>
      <label class="field" id="imp-campoData" hidden>Data de pagamento<input id="imp-cpData" type="text" placeholder="DD/MM/AAAA" autocomplete="off"></label>
      <label class="field imp-campo-largo" id="imp-campoDesc" hidden>Descrição do serviço<input id="imp-cpDesc" type="text" maxlength="100" autocomplete="off"></label>
      <label class="field">Total esperado<input id="imp-cpTotal" type="text" inputmode="decimal" placeholder="opcional" autocomplete="off"></label>
    </div>
    <label class="imp-check" id="imp-linhaValores"><input type="checkbox" id="imp-cpTrazerValores"><span id="imp-cpTextoValores"></span></label>

    <div id="imp-secRubricas">
      <div class="imp-lista-h"><h4>Rubricas que viram coluna <span class="imp-conta" id="imp-cpRubCount"></span></h4>
        <span class="imp-lista-acoes"><button type="button" class="linkish" data-todos="rub">Todas</button><button type="button" class="linkish" data-nenhum="rub">Nenhuma</button></span></div>
      <input class="imp-lista-busca" id="imp-cpBuscaRub" type="search" placeholder="Filtrar rubricas por nome ou código…" aria-label="Filtrar rubricas">
      <div class="imp-lista" id="imp-cpRubricas"></div>
      <p class="imp-lista-nada" id="imp-cpNadaRub" hidden>Nenhuma rubrica com esse texto.</p>
      <details class="imp-descartadas" id="imp-cpDescartadas" hidden><summary id="imp-cpDescartadasN"></summary><div id="imp-cpDescartadasLista"></div></details>
      <div class="imp-add-rub">
        <input id="imp-cpNovoCod" type="text" inputmode="numeric" placeholder="código" autocomplete="off" aria-label="Código da rubrica">
        <input id="imp-cpNovoDesc" type="text" placeholder="nome da rubrica que faltou" autocomplete="off" aria-label="Nome da rubrica">
        <button type="button" class="btn btn-sm" id="imp-cpAdicionar">Adicionar</button>
        <span class="imp-erro" id="imp-cpNovoErro"></span>
      </div>
    </div>

    <div class="imp-lista-h"><h4><span id="imp-cpTituloPessoas">Empregados que viram linha</span> <span class="imp-conta" id="imp-cpEmpCount"></span></h4>
      <span class="imp-lista-acoes"><button type="button" class="linkish" data-todos="emp">Todos</button><button type="button" class="linkish" data-nenhum="emp">Nenhum</button></span></div>
    <input class="imp-lista-busca" id="imp-cpBuscaPes" type="search" placeholder="Filtrar por nome ou código…" aria-label="Filtrar pessoas">
    <div class="imp-lista" id="imp-cpEmpregados"></div>
    <p class="imp-lista-nada" id="imp-cpNadaPes" hidden>Ninguém com esse texto.</p>
    <p class="imp-nota" id="imp-cpNotaPessoas"></p>

    <div class="dlg-actions">
      <span class="imp-resumo" id="imp-cpResumo"></span>
      <span class="imp-erro" id="imp-cpErro"></span>
      <button type="button" class="btn" id="imp-cpCancelar">Cancelar</button>
      <button type="button" class="btn btn-primary" id="imp-cpGerar">Gerar modelo</button>
    </div>
  </div>
</dialog>

<dialog class="dlg imp-dlg" id="imp-dlgCad" aria-labelledby="imp-cadTit">
  <div class="dlg-head">
    <div class="imp-dlg-tit"><h2 id="imp-cadTit">Atualizar o cadastro da empresa?</h2><p id="imp-cadEmp"></p></div>
    <button type="button" class="icon-btn dlg-close" id="imp-cadFechar" aria-label="Fechar"><svg class="ic"><use href="#i-x"/></svg></button>
  </div>
  <div class="dlg-body">
    <p class="imp-txt" style="margin:0">Estes dados apareceram na planilha que você acabou de montar e ainda não estão no cadastro.
      Marque o que deve ser gravado — nada muda sem a sua confirmação.</p>
    <div id="imp-cadLista" class="imp-cad-lista"></div>
    <div class="dlg-actions">
      <span class="imp-resumo" id="imp-cadResumo"></span>
      <button type="button" class="btn" id="imp-cadNao">Agora não</button>
      <button type="button" class="btn btn-primary" id="imp-cadOk">Gravar no cadastro</button>
    </div>
  </div>
</dialog>
`;

function montar(root, api){
const $id = id => document.getElementById("imp-"+id);
root.classList.add("imp");
root.innerHTML = TEMPLATE;
["imp-modalContra","imp-dlgCad"].forEach(id=>{ const d=document.getElementById(id); if(d) d.remove(); });
document.body.insertAdjacentHTML("beforeend", DIALOGOS);
const dlgContra = $id("modalContra"), dlgCad = $id("dlgCad");
function abrirDialogo(){ if(!dlgContra.open) dlgContra.showModal(); }
function fecharDialogo(){ if(dlgContra.open) dlgContra.close(); }


/* ##################### leitura de contracheque ##################### */
/* Extrai empregados e rubricas de um recibo de pagamento (PDF ou texto).
   O resultado nunca vai direto para a planilha: passa pelo menu de
   parâmetros, onde o usuário confere, corrige e escolhe o que entra. */

const RE_MOEDA   = /^-?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
const RE_CODIGO  = /^\d{1,6}$/;
const RE_CNPJ    = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

const RUB_TOTAL      = /^(total|totais|base(s)? |faixa|valor l[íi]quido|l[íi]quido|liquido|dep[óo]sito|a receber|resumo|salario base$|sal[áa]rio base$)/i;
const RUB_AUTOMATICA = new RegExp([
  /* tributos e encargos */
  "(^|\\b)(inss|i\\.?n\\.?s\\.?s|irrf|i\\.?r\\.?r\\.?f|imposto( de)? renda|ir sobre|ir retido",
  "|fgts|f\\.?g\\.?t\\.?s|contribui[çc][ãa]o previdenci|sal[áa]rio fam[íi]lia|sal-familia|arredondamento",
  /* o Domínio calcula sozinho */
  "|f[ée]rias|rescis|m[ée]dia|aviso pr[ée]vio|aviso indeniz",
  "|13[º°]|d[ée]cimo|\\b13\\s*[ºo°.]?\\s*sal",
  "|desc\\.?\\s*emp\\.?\\s*cred|cred\\.?\\s*trab|credito do trabalhador",
  "|saldo de sal|saldo sal|dias normais|pr[óo]\\s*-?\\s*labore",
  ")",   /* sem \\b no fim: sao prefixos (rescis -> RESCISAO, insalubr -> INSALUBRIDADE) */
].join(""), "i");
const RUB_FIXA       = /(^|\b)(sal[áa]rio( base| mensal| contratual| nominal)?|ordenado|vencimento base|hora normal|horas normais)/i;
const RUB_VARIAVEL   = /(^|\b)(hora[s]? extra|h\.?\s?e\.?\s?\d|adicional|noturn|insalubr|periculos|dsr|d\.?s\.?r|repouso remunerado|falta|atraso|comiss|pr[êe]mio|gratifica|bonifica|produtividade|ajuda de custo|di[áa]ria|reembolso|vale|adiantamento|plano de sa[úu]de|assist[êe]ncia|odontol|empr[ée]stimo|pens[ãa]o|aux[íi]lio|aux|abono|sindical|mensalidade|convenio|conv[êe]nio|desconto|desc|estorno|provisao|provis[ãa]o|cesta|quebra de caixa)/i;

const MESES_BUSCA = {janeiro:1,fevereiro:2,"março":3,marco:3,abril:4,maio:5,junho:6,
  julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};

/* --- PDF: reconstrói linhas a partir das coordenadas dos fragmentos --- */
function agruparLinhas(itens){
  const linhas=[];
  for(const it of itens){
    if(!it.str || !it.str.trim()) continue;
    const y = it.transform[5], x = it.transform[4];
    const larg = it.width || (String(it.str).length*4);
    let alvo = linhas.find(l=>Math.abs(l.y-y)<=2.5);
    if(!alvo){ alvo={y, pedacos:[]}; linhas.push(alvo); }
    alvo.pedacos.push({x, fim:x+larg, t:it.str});
  }
  return linhas
    .sort((a,b)=>b.y-a.y)
    .map(l=>{
      l.pedacos.sort((a,b)=>a.x-b.x);
      const celulas=[];
      for(const p of l.pedacos){
        const ult=celulas[celulas.length-1];
        /* fragmentos quase colados são a mesma palavra quebrada pelo PDF */
        if(ult && p.x-ult.fim < 4){ ult.t+=p.t; ult.fim=p.fim; }
        else celulas.push({x:p.x, fim:p.fim, t:p.t});
      }
      const cels=celulas.map(c=>({x:c.x, t:c.t.trim()})).filter(c=>c.t);
      return {celulas:cels, texto:cels.map(c=>c.t).join(" ").replace(/\s+/g," ").trim()};
    })
    .filter(l=>l.texto);
}

async function linhasDoPdf(buffer){
  const pdfjsLib = await api.carregarPdf();
  const doc = await pdfjsLib.getDocument({data:buffer, isEvalSupported:false}).promise;
  const paginas=[];
  for(let p=1;p<=doc.numPages;p++){
    const pag = await doc.getPage(p);
    const tc = await pag.getTextContent();
    paginas.push(agruparLinhas(tc.items));
  }
  try{ await doc.destroy(); }catch(e){}
  return paginas;
}

/* --- texto colado: as colunas viram células por espaçamento --- */
function linhasDoTexto(txt){
  return txt.split(/\r?\n/).map(l=>{
    const cels = l.split(/\s{2,}|\t+/).map(t=>t.trim()).filter(Boolean)
      .map((t,i)=>({x:i*100, t}));
    return {celulas:cels, texto:cels.map(c=>c.t).join(" ").replace(/\s+/g," ").trim()};
  }).filter(l=>l.texto);
}

const ehMoeda = t => RE_MOEDA.test(t);
/* tira número de documento e pontuação solta que o recibo deixa na descrição */
const limparDescricao = d => String(d)
  .replace(/\s*N[ºo°]?\.?\s*\d{4,}\s*$/i,"")
  .replace(/\s*N[ºo°]\.?\s*$/i,"")
  .replace(/[\s|.\-_,;:]+$/,"")
  .replace(/\s+/g," ").trim().slice(0,60);
const moedaParaNumero = t => Number(String(t).replace(/\./g,"").replace(",",".").replace(/-$/,"")) * (/-$/.test(t)?-1:1);

/* --- classificação de rubrica --- */
function classificarRubrica(desc){
  if(RUB_TOTAL.test(desc))      return "total";
  if(RUB_AUTOMATICA.test(desc)) return "automatica";
  if(RUB_VARIAVEL.test(desc))   return "variavel";
  if(RUB_FIXA.test(desc))       return "fixa";
  return "indefinida";
}

function analisarContracheque(paginas){
  const todas = [].concat(...paginas);
  const avisos=[];

  /* --- empresa e CNPJ --- */
  let empresa="", cnpj="";
  for(let i=0;i<Math.min(todas.length,14);i++){
    const m = todas[i].texto.match(RE_CNPJ);
    if(m && !cnpj){
      cnpj = m[0];
      /* só o que vem ANTES do CNPJ — depois costuma ser cabeçalho alinhado à direita */
      const antes = todas[i].texto.slice(0, todas[i].texto.indexOf(m[0]))
        .replace(/cnpj:?/i,"").replace(/[-–|]\s*$/,"").trim();
      if(antes.replace(/[^A-Za-zÀ-ÿ]/g,"").length>=6) empresa=antes;
      else if(i>0) empresa=todas[i-1].texto.trim();
      break;
    }
  }
  if(!empresa){
    const cand = todas.slice(0,6).find(l=>
      l.texto.replace(/[^A-Za-zÀ-ÿ]/g,"").length>=10 && !/recibo|demonstrativo|folha|p[áa]gina/i.test(l.texto));
    if(cand) empresa=cand.texto.trim();
  }
  empresa = empresa.replace(/\s*[-–|]\s*$/,"").trim();

  /* --- competência --- */
  let competencia="";
  for(const l of todas){
    let m = l.texto.match(/(?:compet[êe]ncia|refer[êe]ncia|m[êe]s\/ano|per[íi]odo)\D{0,4}(\d{1,2})[\/\-](\d{4})/i);
    if(m){ competencia=String(m[1]).padStart(2,"0")+"/"+m[2]; break; }
    m = l.texto.match(/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s*|\/)\s*(\d{4})\b/i);
    if(m){
      const mes = MESES_BUSCA[m[1].toLowerCase().replace("ç","ç")] || MESES_BUSCA[m[1].toLowerCase()];
      if(mes){ competencia=String(mes).padStart(2,"0")+"/"+m[2]; break; }
    }
  }
  if(!competencia){
    for(const l of todas){
      const m = l.texto.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
      if(m){ competencia=m[1]+"/"+m[2]; break; }
    }
  }

  /* --- empregados: cabeçalho "Código | Nome" e a linha logo abaixo --- */
  const empregados=[], vistosEmp=new Map();
  const registrar=(cod,nome,funcao)=>{
    cod=String(cod).trim(); nome=String(nome).trim().replace(/\s+/g," ");
    if(!cod||!nome) return null;
    if(nome.replace(/[^A-Za-zÀ-ÿ]/g,"").length<4) return null;
    const k=cod+"|"+chave(nome);
    if(vistosEmp.has(k)) return vistosEmp.get(k);
    const e={codigo:cod, codigoOriginal:cod, nome, funcao:(funcao||"").trim(), rubricas:new Set()};
    vistosEmp.set(k,e); empregados.push(e);
    return e;
  };

  const ehCabecalhoEmp = l => {
    const t=l.texto.toLowerCase();
    return /c[óo]digo|matr[íi]cula/.test(t) && /nome|funcion[áa]rio|empregado/.test(t)
           && !l.celulas.some(c=>ehMoeda(c.t));
  };
  /* o PDF do Domínio quebra o nome em várias células ("MARCELA","FITTIPALDI",
     "MARCONDES"). Cada célula de dado é atribuída ao cabeçalho mais próximo e
     depois as células do mesmo cabeçalho são juntadas de volta. */
  const colunaDe = (linhaDados, cabecalho, alvo) => {
    const partes=[];
    for(const c of linhaDados.celulas){
      let perto=null, dist=Infinity;
      for(const h of cabecalho.celulas){
        const d=Math.abs(c.x-h.x);
        if(d<dist){ dist=d; perto=h; }
      }
      if(perto===alvo) partes.push(c.t);
    }
    return partes.join(" ").replace(/\s+/g," ").trim();
  };

  for(let i=0;i<todas.length-1;i++){
    if(!ehCabecalhoEmp(todas[i])) continue;
    const cab=todas[i], dados=todas[i+1];
    if(dados.celulas.some(c=>ehMoeda(c.t))) continue;
    const cCod = cab.celulas.find(c=>/c[óo]digo|matr[íi]cula/i.test(c.t));
    const cNome= cab.celulas.find(c=>/nome|funcion[áa]rio|empregado/i.test(c.t));
    const cFun = cab.celulas.find(c=>/fun[çc][ãa]o|cargo/i.test(c.t));
    if(!cCod||!cNome) continue;
    const vCod = colunaDe(dados, cab, cCod);
    const vNome= colunaDe(dados, cab, cNome);
    let vFun = cFun ? colunaDe(dados, cab, cFun) : "";
    /* no recibo do Domínio o cargo vem na linha seguinte, antes de "Admissão:" */
    if(!vFun && todas[i+2] && /admiss/i.test(todas[i+2].texto)){
      const t=todas[i+2].texto.split(/admiss/i)[0].trim();
      if(t.replace(/[^A-Za-zÀ-ÿ]/g,"").length>=4) vFun=t;
    }
    if(vCod && vNome && /\d/.test(vCod))
      registrar(vCod.replace(/\D/g,""), vNome, vFun);
  }

  /* rótulos em linha: "Código: 12  Nome: FULANO" */
  if(!empregados.length){
    for(const l of todas){
      const m = l.texto.match(/c[óo]digo:?\s*(\d{1,8})\b.*?nome:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.\s]{4,60})/i);
      if(m) registrar(m[1], m[2]);
    }
  }
  /* último recurso: linha "código nome" sem valores */
  if(!empregados.length){
    for(const l of todas){
      const c=l.celulas;
      if(c.length<2 || c.some(x=>ehMoeda(x.t))) continue;
      if(!RE_CODIGO.test(c[0].t)) continue;
      if(!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.\s]{4,}$/.test(c[1].t)) continue;
      if(/descri|total|base/i.test(c[1].t)) continue;
      registrar(c[0].t, c[1].t, c[2]?c[2].t:"");
    }
  }

  /* --- rubricas, associadas ao empregado corrente --- */
  const rubricas=new Map();
  let atual=null;
  const chaveEmp = new Map(empregados.map(e=>[e.codigo+"|"+chave(e.nome), e]));

  for(let i=0;i<todas.length;i++){
    const l=todas[i];

    if(ehCabecalhoEmp(l) && todas[i+1]){
      const d=todas[i+1];
      const cCod=l.celulas.find(c=>/c[óo]digo|matr[íi]cula/i.test(c.t));
      const cNome=l.celulas.find(c=>/nome|funcion[áa]rio|empregado/i.test(c.t));
      if(cCod&&cNome){
        const vCod=colunaDe(d,l,cCod), vNome=colunaDe(d,l,cNome);
        if(vCod&&vNome){
          const k=String(vCod.replace(/\D/g,"")).trim()+"|"+chave(vNome);
          if(chaveEmp.has(k)) atual=chaveEmp.get(k);
        }
      }
      continue;
    }

    const c=l.celulas;
    if(c.length<2) continue;
    if(!RE_CODIGO.test(c[0].t)) continue;
    const valores=c.filter(x=>ehMoeda(x.t));
    if(!valores.length) continue;

    /* A descrição vai só até o primeiro valor. No recibo do Domínio as duas vias
       ficam na mesma folha e textos da outra via ("Assinatura do Funcionário")
       caem na mesma altura, à direita das colunas de valor. */
    const iPrimeiroValor = c.findIndex(x=>ehMoeda(x.t));
    const antesDoValor = c.slice(1, iPrimeiroValor<0 ? c.length : iPrimeiroValor);
    const desc = limparDescricao(
      antesDoValor.filter(x=>!/^\d+([,.]\d+)?$/.test(x.t)).map(x=>x.t).join(" "));
    if(!desc || desc.replace(/[^A-Za-zÀ-ÿ]/g,"").length<3) continue;
    if(RUB_TOTAL.test(desc)) continue;

    const codigo=Number(c[0].t);
    const k=codigo+"|"+chave(desc);
    if(!rubricas.has(k))
      rubricas.set(k,{codigo, descricao:desc, tipo:classificarRubrica(desc),
                      valores:[], empregados:new Set(), porEmpregado:{}});
    const r=rubricas.get(k);
    const v = moedaParaNumero(valores[valores.length-1].t);
    r.valores.push(v);
    if(atual){
      r.empregados.add(atual.codigo);
      atual.rubricas.add(k);
      r.porEmpregado[atual.codigo] = v;   /* usado quando o usuário pede os valores */
    }
  }

  /* --- decide o que já vem marcado --- */
  const totalEmp = Math.max(empregados.length,1);
  const lista=[...rubricas.values()].map(r=>{
    const distintos=new Set(r.valores.map(v=>Math.round(v*100)));
    const emTodos = r.empregados.size>=totalEmp;
    const variaValor = distintos.size>1;
    let tipo=r.tipo;
    if(tipo==="indefinida") tipo = (!emTodos||variaValor) ? "variavel" : "fixa";
    return {
      codigo:r.codigo, descricao:r.descricao, tipo,
      qtdEmpregados:r.empregados.size, ocorrencias:r.valores.length,
      porEmpregado:r.porEmpregado, variaValor, emTodos,
      marcada: tipo==="variavel",
    };
  }).sort((a,b)=>a.codigo-b.codigo);

  /* o que o Domínio calcula sozinho não entra na planilha nem vira opção;
     fica só registrado para o escritório poder conferir o que ficou de fora */
  const descartadas = lista.filter(r=>r.tipo==="automatica");
  const oferecidas  = lista.filter(r=>r.tipo!=="automatica");

  if(!empregados.length) avisos.push("Não reconheci nenhum empregado — confira o arquivo ou digite os nomes na mão.");
  if(!oferecidas.length) avisos.push("Todas as rubricas do documento são calculadas pelo Domínio — cadastre abaixo a que você precisa lançar.");
  if(!competencia)       avisos.push("Não achei a competência no documento — preencha abaixo.");

  return {
    empresa, cnpj, competencia,
    empregados: empregados.map(e=>({codigo:e.codigo, codigoOriginal:e.codigoOriginal,
                                    nome:e.nome, funcao:e.funcao, marcado:true})),
    rubricas: oferecidas,
    rubricasDescartadas: descartadas,
    avisos,
    paginas: paginas.length,
  };
}

/* ##################### Relação Geral dos Líquidos ##################### */
/* Relatório do Domínio que lista código, nome e líquido de cada pessoa,
   separados por grupo (Contribuintes, Empregados, Estagiários) e com o
   total da empresa no rodapé. É a melhor origem para montar o modelo:
   já vem com o código do cadastro, que o recibo não traz. */

const RE_SECAO = /^(contribuintes|autonomos|empregados|estagiarios|dirigentes|socios|diretores)$/i;

function ehRelacaoLiquidos(paginas){
  const t = semAc([].concat(...paginas).slice(0,30).map(l=>l.texto).join(" ")).toLowerCase();
  return /rela[çc]?[aã]?o geral dos liquidos|relacao geral dos liquidos/.test(t)
      || (/total da empresa/.test(t) && /nome do empregado/.test(t));
}

function grupoDaSecao(txt){
  const t = semAc(txt).toLowerCase();
  if(/contribuinte|autonomo/.test(t)) return "contribuintes";
  if(/estagiario/.test(t))            return "estagiarios";
  if(/empregado/.test(t))             return "empregados";
  return "outros";
}

function analisarRelacaoLiquidos(paginas){
  const todas = [].concat(...paginas);
  const avisos = [];
  let empresa="", cnpj="", competencia="", calculo="", emissao="", totalEmpresa=null;

  /* cabeçalho: rótulo numa célula, valor na seguinte */
  for(const l of todas){
    const c = l.celulas;
    for(let i=0;i<c.length-1;i++){
      const t = semAc(c[i].t).toLowerCase().replace(/\s+/g,"");
      const v = c[i+1].t.trim();
      if(!v) continue;
      if(t.startsWith("empresa:")      && !empresa)     empresa = v;
      else if(t.startsWith("cnpj:")    && !cnpj)        cnpj = v;
      else if(t.startsWith("calculo:") && !calculo)     calculo = v;
      else if(t.startsWith("competencia:") && !competencia) competencia = v;
      else if(t.startsWith("emissao:") && !emissao)     emissao = v;
    }
  }

  const grupos = {contribuintes:[], empregados:[], estagiarios:[], outros:[]};
  let secao = "outros";

  for(const l of todas){
    const c = l.celulas;
    if(!c.length) continue;

    /* rodapé com o total da empresa */
    if(/total da empresa/i.test(semAc(l.texto))){
      const m = c.filter(x=>ehMoeda(x.t));
      if(m.length) totalEmpresa = moedaParaNumero(m[m.length-1].t);
      continue;
    }
    /* cabeçalho de grupo */
    if(c.length<=2 && RE_SECAO.test(semAc(c[0].t).trim())){
      secao = grupoDaSecao(c[0].t);
      continue;
    }
    /* linha de pessoa: código, nome, (identidade), valor */
    if(!/^\d{1,10}$/.test(c[0].t)) continue;
    const valores = c.filter(x=>ehMoeda(x.t));
    if(!valores.length) continue;
    const nome = c.slice(1)
      .filter(x=>!ehMoeda(x.t) && !/^\d+$/.test(x.t))
      .map(x=>x.t).join(" ").replace(/\s+/g," ").trim();
    if(nome.replace(/[^A-Za-zÀ-ÿ]/g,"").length < 4) continue;

    grupos[secao].push({
      codigo: c[0].t,
      nome,
      valor: moedaParaNumero(valores[valores.length-1].t),
      cpf: "",
      cpfValido: null,
      descricao: "",
      numeroRecibo: "",
      marcado: true,
    });
  }

  const total = grupos.contribuintes.length + grupos.empregados.length +
                grupos.estagiarios.length + grupos.outros.length;
  if(!total) avisos.push("Não reconheci nenhuma linha de pessoa neste relatório.");
  if(grupos.outros.length)
    avisos.push(`${grupos.outros.length} linha(s) apareceram antes de qualquer cabeçalho de grupo e entraram como contribuintes.`);
  grupos.contribuintes = grupos.contribuintes.concat(grupos.outros);
  grupos.outros = [];

  if(totalEmpresa!==null){
    const soma = [].concat(grupos.contribuintes, grupos.empregados, grupos.estagiarios)
      .reduce((s,p)=>s+p.valor,0);
    if(Math.abs(soma-totalEmpresa) > 0.005)
      avisos.push(`A soma das linhas (R$ ${moeda(soma)}) não bate com o total do relatório (R$ ${moeda(totalEmpresa)}) — pode ter linha que não consegui ler.`);
  }

  return {empresa, cnpj, competencia, calculo, emissao, totalEmpresa,
          grupos, avisos, paginas:paginas.length};
}

/* ##################### leitura de recibos de RPA ##################### */
/* O recibo do Domínio é um formulário: cada bloco começa em "RECIBO DE
   PAGAMENTO A AUTÔNOMO" e traz nome, CPF, nº do recibo, data e valor líquido.
   O código do contribuinte não aparece no papel — fica para o escritório. */

/* compara sem acento: o recibo escreve AUTÔNOMO, LÍQUIDO, ESPECIFICAÇÃO */
const semAc = s => String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const RE_CPF_FMT = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/;
const RE_DATA_BR = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const BOILERPLATE = /remunera[çc][ãa]o ser[áa] inclu[íi]da|assinatura|declaro ter recebido|conforme discriminativo|discriminativo abaixo/i;

function detectarTipoDocumento(paginas){
  if(ehRelacaoLiquidos(paginas)) return "liquidos";
  const texto = semAc([].concat(...paginas).slice(0,80).map(l=>l.texto).join(" ")).toLowerCase();
  if(/recibo de pagamento a autonomo|\brpa\b/.test(texto)) return "rpa";
  if(/nome do funcionario|recibo de pagamento de sal|demonstrativo de pagamento/.test(texto))
    return "lancamentos";
  return null;
}

function analisarRecibosRpa(paginas){
  const todas = [].concat(...paginas);
  const avisos = [];

  const inicios = [];
  todas.forEach((l,i)=>{ if(/recibo de pagamento a autonomo/i.test(semAc(l.texto))) inicios.push(i); });
  if(!inicios.length) return {empresa:"", cnpj:"", competencia:"", dataPagamento:"",
    autonomos:[], avisos:["Não encontrei nenhum recibo de RPA neste arquivo."], paginas:paginas.length};

  let empresa="", cnpj="";
  const autonomos=[], vistos=new Set();

  for(let b=0;b<inicios.length;b++){
    const ini=inicios[b], fim=(b+1<inicios.length)?inicios[b+1]:todas.length;
    const bloco=todas.slice(ini,fim);
    const texto=bloco.map(l=>l.texto).join(" ");

    /* empresa e CNPJ — a linha do CNPJ traz a razão social do outro lado */
    if(!cnpj){
      for(const l of bloco){
        const m=l.texto.match(RE_CNPJ);
        if(!m) continue;
        cnpj=m[0];
        const resto=l.celulas.filter(c=>!RE_CNPJ.test(c.t)).map(c=>c.t).join(" ").trim();
        if(resto.replace(/[^A-Za-zÀ-ÿ]/g,"").length>=4) empresa=resto;
        break;
      }
    }

    /* nome completo: vem na linha logo abaixo do rótulo */
    let nome="";
    for(let i=0;i<bloco.length;i++){
      if(!/nome completo/i.test(semAc(bloco[i].texto))) continue;
      for(let j=i+1;j<Math.min(i+4,bloco.length);j++){
        const t=bloco[j].celulas[0] ? bloco[j].celulas[0].t.trim() : "";
        if(!t || BOILERPLATE.test(bloco[j].texto)) continue;
        if(t.replace(/[^A-Za-zÀ-ÿ]/g,"").length<4) continue;
        nome=t; break;
      }
      if(nome) break;
    }
    if(!nome) continue;

    /* valor líquido: o rótulo e o número ficam na mesma linha */
    let valor=null;
    for(const l of bloco){
      if(!/valor liquido/i.test(semAc(l.texto))) continue;
      const money=l.celulas.filter(c=>ehMoeda(c.t));
      if(money.length){ valor=moedaParaNumero(money[money.length-1].t); break; }
    }
    if(valor===null){
      const m=semAc(texto).match(/importancia de R\$\s*([\d.]+,\d{2})/i);
      if(m) valor=moedaParaNumero(m[1]);
    }

    /* nº do recibo: valor solto logo abaixo do rótulo, na mesma coluna */
    let numeroRecibo="";
    for(let i=0;i<bloco.length;i++){
      const rot=bloco[i].celulas.find(c=>/n[ºo°]?\s*recibo/i.test(semAc(c.t)));
      if(!rot) continue;
      for(let j=i+1;j<Math.min(i+3,bloco.length);j++){
        const c=bloco[j].celulas.find(x=>/^\d{1,8}$/.test(x.t) && Math.abs(x.x-rot.x)<40);
        if(c){ numeroRecibo=c.t; break; }
      }
      if(numeroRecibo) break;
    }

    const mCpf  = texto.match(RE_CPF_FMT);
    const mData = texto.match(RE_DATA_BR);
    const mEsp  = semAc(texto).match(/servicos? de\s+(.+?)\s+a importancia/i);

    const cpf = mCpf ? mCpf[1] : "";
    const k = chave(nome)+"|"+cpf+"|"+numeroRecibo;
    if(vistos.has(k)) continue;
    vistos.add(k);

    autonomos.push({
      nome, cpf,
      codigo: "",            /* preenchido pelo usuário no menu */
      cpfValido: cpf ? cpfValido(cpf) : null,
      valor,
      numeroRecibo,
      data: mData ? mData[1] : "",
      descricao: mEsp ? mEsp[1].trim().replace(/\s+/g," ").slice(0,100) : "",
      marcado: true,
    });
  }

  /* data de pagamento e competência: a mais frequente do lote */
  const contagem=new Map();
  autonomos.forEach(a=>{ if(a.data) contagem.set(a.data,(contagem.get(a.data)||0)+1); });
  let dataPagamento="";
  let maior=0;
  contagem.forEach((n,d)=>{ if(n>maior){ maior=n; dataPagamento=d; } });
  const competencia = dataPagamento ? dataPagamento.slice(3,10).replace("/","/") : "";

  const semValor = autonomos.filter(a=>a.valor===null).length;
  const cpfRuim  = autonomos.filter(a=>a.cpfValido===false).map(a=>`${a.nome} — ${a.cpf}`);
  if(semValor) avisos.push(`${semValor} recibo(s) sem valor líquido reconhecido.`);
  if(cpfRuim.length) avisos.push("CPF que não passa na validação: "+cpfRuim.join("; "));
  if(contagem.size>1) avisos.push("Os recibos têm datas de pagamento diferentes — confirme a data do lote.");
  avisos.push("O código do contribuinte não vem no recibo — preencha na lista abaixo, antes de gerar.");

  return {empresa, cnpj, competencia, dataPagamento, autonomos, avisos, paginas:paginas.length};
}

/* ##################### menu de parâmetros do documento lido ##################### */
let contraDados = null;
let contraTipo = "lancamentos";

const $cp = $id;
const listaAtual = () => contraTipo==="rpa" ? contraDados.autonomos : contraDados.empregados;

/* último dia do mês da competência — é a data de pagamento que o escritório usa */
function ultimoDiaDaCompetencia(comp){
  try{
    const a = competenciaAAAAMM(comp);
    const ano = Number(a.slice(0,4)), mes = Number(a.slice(4,6));
    const dia = new Date(ano, mes, 0).getDate();
    return `${String(dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}/${ano}`;
  }catch(e){ return ""; }
}

let dataEditadaAMao = false;

function sugerirDataPagamento(forcar){
  if(!forcar && dataEditadaAMao) return;
  const d = ultimoDiaDaCompetencia($cp("cpComp").value);
  if(d) $cp("cpData").value = d;
}

/* máscaras: o usuário digita só números */
function mascararData(inp){
  let v = inp.value.replace(/\D/g,"").slice(0,8);
  if(v.length>4)      v = v.slice(0,2)+"/"+v.slice(2,4)+"/"+v.slice(4);
  else if(v.length>2) v = v.slice(0,2)+"/"+v.slice(2);
  inp.value = v;
}
function mascararCompetencia(inp){
  let v = inp.value.replace(/\D/g,"").slice(0,6);
  if(v.length>2) v = v.slice(0,2)+"/"+v.slice(2);
  inp.value = v;
}

function abrirMenuContracheque(dados, origem, tipo){
  contraDados = dados;
  contraTipo = tipo || "lancamentos";
  const rpa = contraTipo==="rpa";

  $cp("cpTitulo").textContent = rpa
    ? "Confira antes de montar a planilha de RPA"
    : "Confira antes de montar a planilha de Lançamentos";
  $cp("cpOrigem").textContent = origem && dados.daCadastro ? origem : origem
    ? `${origem} · ${dados.paginas} página${dados.paginas===1?"":"s"} lida${dados.paginas===1?"":"s"}`
    : "";

  $cp("cpEmpresa").value = dados.empresa || "";
  $cp("cpCodigo").value  = "";
  $cp("cpComp").value    = dados.competencia || "";
  $cp("cpTipo").value    = "11";
  dataEditadaAMao = false;
  $cp("cpData").value    = dados.dataPagamento || ultimoDiaDaCompetencia(dados.competencia||"") || "";
  const descDoc = (dados.autonomos||[]).map(a=>(a.descricao||"").trim()).filter(Boolean);
  $cp("cpDesc").value    = descDoc[0] || "AUTONOMO";
  $cp("cpTotal").value   = "";
  integrarDocumento(dados, rpa);

  $cp("campoTipo").hidden   = rpa;
  $cp("campoData").hidden   = !rpa;
  $cp("campoDesc").hidden   = !rpa;
  $cp("secRubricas").hidden = rpa;
  $cp("cpTextoValores").textContent = rpa
    ? "Trazer os valores deste documento. Deixe desmarcado para a planilha sair em branco, pronta para o cliente preencher."
    : "Trazer os valores deste contracheque para cada rubrica. Deixe desmarcado para a planilha sair em branco, pronta para o cliente preencher.";
  $cp("cpBuscaRub").value = "";
  $cp("cpBuscaPes").value = "";
  $cp("cpTrazerValores").checked = false;
  $cp("cpTituloPessoas").textContent = rpa
    ? "Autônomos que viram linha" : "Empregados que viram linha";
  const jaTemCodigo = listaAtual().some(p=>!vazio(p.codigo));
  $cp("cpNotaPessoas").textContent = jaTemCodigo
    ? "Os códigos vieram do documento ou do cadastro. Confira um contra o cadastro do Domínio antes de mandar a planilha para o cliente — dá para corrigir aqui mesmo."
    : "O código não vem neste documento — digite aqui o código do cadastro no Domínio. Quem ficar sem código sai com a célula em branco na planilha.";

  $cp("cpAvisos").innerHTML = dados.avisos.length
    ? `<div class="msg warn"><strong>Confira antes de gerar</strong><ul>`+
      dados.avisos.map(a=>`<li>${escapar(a)}</li>`).join("")+`</ul></div>`
    : "";

  if(dados.calculo && !rpa){
    const t = tiposProcesso().find(x=>chave(x.nome)===chave(dados.calculo));
    if(t) $cp("cpTipo").value = t.codigo;
  }
  nomeDoTipo();

  renderDescartadas();
  if(!rpa) renderListaRubricas();
  renderListaPessoas();

  abrirDialogo();
  setTimeout(()=>$cp("cpCodigo").focus(), 60);
}

function fecharMenuContracheque(){
  fecharDialogo();
}

const SELO = {
  variavel:   ['selo-var',  'variável'],
  fixa:       ['selo-fix',  'fixa'],
  automatica: ['selo-auto', 'o Domínio calcula'],
  indefinida: ['selo-neu',  'a conferir'],
};

function renderListaRubricas(){
  const alvo = $cp("cpRubricas");
  alvo.innerHTML = contraDados.rubricas.map((r,i)=>{
    const [cls,txt] = SELO[r.tipo] || SELO.indefinida;
    const quantos = r.daCadastro ? "do cadastro" : r.qtdEmpregados
      ? `${r.qtdEmpregados} empregado${r.qtdEmpregados===1?"":"s"}`
      : `${r.ocorrencias} ocorrência${r.ocorrencias===1?"":"s"}`;
    return `<label class="item${r.marcada?" marcado":""}" data-busca="${escapar(chave(r.codigo+" "+r.descricao))}">
      <input type="checkbox" data-rub="${i}"${r.marcada?" checked":""}>
      <span class="item-cod">${r.codigo}</span>
      <span class="item-nome">${escapar(r.descricao)}</span>
      <span class="selo ${cls}">${txt}</span>
      <span class="item-meta">${quantos}</span>
    </label>`;
  }).join("") || `<p class="item-vazio">Nenhuma rubrica reconhecida — adicione abaixo.</p>`;

  alvo.querySelectorAll("[data-rub]").forEach(cb=>{
    cb.addEventListener("change",()=>{
      contraDados.rubricas[Number(cb.dataset.rub)].marcada = cb.checked;
      cb.closest(".item").classList.toggle("marcado", cb.checked);
      atualizarContagens();
    });
  });
  filtrarRubricas();
  atualizarContagens();
}

/* o que o Domínio calcula não vira opção — fica só listado, para conferir */
function renderDescartadas(){
  const desc = (contraDados && contraDados.rubricasDescartadas) || [];
  const bloco = $cp("cpDescartadas");
  if(contraTipo==="rpa" || !desc.length){ bloco.hidden = true; return; }
  bloco.hidden = false;
  bloco.open = false;
  $cp("cpDescartadasN").textContent =
    `${desc.length} rubrica${desc.length===1?"":"s"} que o Domínio calcula ${desc.length===1?"ficou":"ficaram"} de fora — ver ${desc.length===1?"qual":"quais"}`;
  $cp("cpDescartadasLista").innerHTML =
    desc.map(r=>`<b>${r.codigo}</b> ${escapar(r.descricao)}`).join(" · ") +
    `<br>Se precisar lançar alguma delas, cadastre pelo campo abaixo.`;
}

function renderListaPessoas(){
  const alvo = $cp("cpEmpregados");
  const rpa = contraTipo==="rpa";
  const lista = listaAtual();

  alvo.innerHTML = lista.map((p,i)=>{
    const cod = `<input class="item-cod-input${p.marcado&&vazio(p.codigo)?" faltando":""}" `+
      `data-cod="${i}" inputmode="numeric" value="${escapar(p.codigo||"")}" `+
      `placeholder="código" aria-label="Código de ${escapar(p.nome)}">`;
    if(rpa){
      const cpfRuim = p.cpfValido===false;
      return `<div class="item${p.marcado?" marcado":""}" data-busca="${escapar(chave((p.codigo||"")+" "+p.nome))}">
        <input type="checkbox" data-pes="${i}"${p.marcado?" checked":""} aria-label="Incluir ${escapar(p.nome)}">
        ${cod}
        <span class="item-nome">${escapar(p.nome)}</span>
        ${p.cpf?`<span class="selo ${cpfRuim?"selo-auto":"selo-fix"}">${escapar(p.cpf)}${cpfRuim?" ?":""}</span>`:""}
        <span class="item-meta">${p.numeroRecibo?"recibo "+escapar(p.numeroRecibo)+" · ":""}${p.valor!==null&&p.valor!==undefined?"R$ "+moeda(p.valor):"sem valor"}</span>
      </div>`;
    }
    return `<div class="item${p.marcado?" marcado":""}" data-busca="${escapar(chave((p.codigo||"")+" "+p.nome+" "+(p.funcao||"")))}">
      <input type="checkbox" data-pes="${i}"${p.marcado?" checked":""} aria-label="Incluir ${escapar(p.nome)}">
      ${cod}
      <span class="item-nome">${escapar(p.nome)}</span>
      <span class="item-meta">${escapar(p.funcao||"")}</span>
    </div>`;
  }).join("") || `<p class="item-vazio">Ninguém reconhecido — a planilha sai com as linhas em branco.</p>`;

  alvo.querySelectorAll("[data-pes]").forEach(cb=>{
    cb.addEventListener("change",()=>{
      lista[Number(cb.dataset.pes)].marcado = cb.checked;
      cb.closest(".item").classList.toggle("marcado", cb.checked);
      renderMarcasCodigo();
      atualizarContagens();
    });
  });

  /* código digitado direto na lista — é o que vai para a coluna Código */
  alvo.querySelectorAll("[data-cod]").forEach(inp=>{
    inp.addEventListener("input",()=>{
      const p = lista[Number(inp.dataset.cod)];
      const limpo = inp.value.replace(/\D/g,"").slice(0,10);
      if(inp.value!==limpo) inp.value = limpo;
      p.codigo = limpo;
      inp.classList.toggle("faltando", p.marcado && !limpo);
      atualizarContagens();
    });
  });

  /* clicar na linha marca e desmarca, sem atrapalhar os campos */
  alvo.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click",e=>{
      if(e.target.tagName==="INPUT") return;
      const cb = el.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change"));
    });
  });

  filtrarPessoas();
  atualizarContagens();
}

function renderMarcasCodigo(){
  const lista = listaAtual();
  $cp("cpEmpregados").querySelectorAll("[data-cod]").forEach(inp=>{
    const p = lista[Number(inp.dataset.cod)];
    inp.classList.toggle("faltando", p.marcado && vazio(p.codigo));
  });
}

function filtrarLista(idBusca, idLista, idNada){
  const q = chave($cp(idBusca).value);
  const itens = $cp(idLista).querySelectorAll(".item");
  let vis = 0;
  itens.forEach(el=>{
    const mostra = !q || (el.dataset.busca||"").includes(q);
    el.hidden = !mostra;
    if(mostra) vis++;
  });
  $cp(idNada).hidden = !(q && itens.length && vis===0);
}
const filtrarRubricas = () => filtrarLista("cpBuscaRub","cpRubricas","cpNadaRub");
const filtrarPessoas  = () => filtrarLista("cpBuscaPes","cpEmpregados","cpNadaPes");

function atualizarContagens(){
  if(!contraDados) return;
  const rpa = contraTipo==="rpa";
  const lista = listaAtual();
  const e = lista.filter(x=>x.marcado).length;
  $cp("cpEmpCount").textContent = `${e} de ${lista.length}`;

  const semCod = lista.filter(x=>x.marcado && vazio(x.codigo)).length;
  const faltando = semCod ? ` · ${semCod} sem código` : "";

  if(rpa){
    const soma = lista.filter(x=>x.marcado).reduce((s,x)=>s+(x.valor||0),0);
    $cp("cpResumo").textContent =
      `A planilha sai com ${e} contribuinte${e===1?"":"s"}` +
      ($cp("cpTrazerValores").checked ? ` · soma R$ ${moeda(soma)}` : " e a coluna de valor em branco") +
      faltando;
    return;
  }
  const r = contraDados.rubricas.filter(x=>x.marcada).length;
  $cp("cpRubCount").textContent = `${r} de ${contraDados.rubricas.length}`;
  let soma = "";
  if($cp("cpTrazerValores").checked){
    const marcados = new Set(lista.filter(x=>x.marcado).map(x=>x.codigoOriginal));
    let t=0;
    contraDados.rubricas.filter(x=>x.marcada).forEach(x=>{
      Object.keys(x.porEmpregado||{}).forEach(k=>{ if(marcados.has(k)) t += x.porEmpregado[k]; });
    });
    if(t) soma = ` · soma R$ ${moeda(t)}`;
  }
  $cp("cpResumo").textContent =
    `A planilha sai com ${e} linha${e===1?"":"s"} de empregado e ${r} coluna${r===1?"":"s"} de rubrica${soma}${faltando}.`;
}

function alternarValoresRpa(){
  if(!contraDados) return;
  if($cp("cpTrazerValores").checked){
    let soma = 0;
    if(contraTipo==="rpa"){
      soma = contraDados.autonomos.filter(a=>a.marcado).reduce((s,a)=>s+(a.valor||0),0);
    }else{
      const marcados = new Set(contraDados.empregados.filter(e=>e.marcado).map(e=>e.codigoOriginal));
      contraDados.rubricas.filter(r=>r.marcada).forEach(r=>{
        Object.keys(r.porEmpregado||{}).forEach(k=>{ if(marcados.has(k)) soma += r.porEmpregado[k]; });
      });
    }
    if(soma) $cp("cpTotal").value = moeda(soma);
  }
  atualizarContagens();
}

function adicionarRubricaManual(){
  const cod = $cp("cpNovoCod").value.trim();
  const desc = $cp("cpNovoDesc").value.trim();
  const erro = $cp("cpNovoErro");
  if(!/^\d{1,9}$/.test(cod)){ erro.textContent = "o código da rubrica tem que ser numérico"; return; }
  if(desc.length<2){ erro.textContent = "escreva o nome da rubrica"; return; }
  if(contraDados.rubricas.some(r=>r.codigo===Number(cod))){ erro.textContent = "esse código já está na lista"; return; }
  erro.textContent = "";
  contraDados.rubricas.push({codigo:Number(cod), descricao:desc, tipo:"variavel",
    qtdEmpregados:0, ocorrencias:0, variaValor:false, emTodos:false, marcada:true});
  contraDados.rubricas.sort((a,b)=>a.codigo-b.codigo);
  $cp("cpNovoCod").value=""; $cp("cpNovoDesc").value="";
  renderListaRubricas();
}

/* tudo que o .txt precisa é exigido aqui — a planilha não sai pela metade */
function reprovar(msg, campo){
  $cp("cpErro").textContent = msg;
  if(campo){
    const el = $cp(campo);
    el.classList.add("faltando");
    el.focus();
    setTimeout(()=>el.classList.remove("faltando"), 2600);
  }
  return false;
}

function gerarModeloDoContracheque(){
  $cp("cpErro").textContent = "";
  $cp("cpEmpregados").querySelectorAll(".item").forEach(el=>el.classList.remove("sem-codigo"));
  const rpa = contraTipo==="rpa";

  const codigo = $cp("cpCodigo").value.trim();
  const comp   = $cp("cpComp").value.trim();

  if(!codigo)                    return reprovar("informe o código da empresa no Domínio","cpCodigo");
  if(!/^\d{1,10}$/.test(codigo)) return reprovar("o código da empresa é só número","cpCodigo");
  if(!comp)                      return reprovar("informe a competência","cpComp");
  try{ competenciaAAAAMM(comp); }
  catch(e){ return reprovar("competência inválida — digite MM/AAAA","cpComp"); }

  let total = null;
  if($cp("cpTotal").value.trim()){
    try{ total = paraNumero($cp("cpTotal").value); }
    catch(e){ return reprovar("total esperado inválido","cpTotal"); }
  }

  const marcados = listaAtual().filter(p=>p.marcado);
  if(!marcados.length)
    return reprovar(rpa ? "marque pelo menos um contribuinte" : "marque pelo menos um empregado");

  /* sem código não dá para montar o registro */
  const semCodigo = marcados.filter(p=>vazio(p.codigo));
  if(semCodigo.length){
    const lista = listaAtual();
    $cp("cpEmpregados").querySelectorAll(".item").forEach((el,i)=>{
      if(lista[i] && lista[i].marcado && vazio(lista[i].codigo)) el.classList.add("sem-codigo");
    });
    const primeiro = $cp("cpEmpregados").querySelector(".item.sem-codigo [data-cod]");
    if(primeiro){
      primeiro.focus();
      if(primeiro.scrollIntoView) primeiro.scrollIntoView({block:"center"});
    }
    return reprovar(`${semCodigo.length} ${semCodigo.length===1?"pessoa está":"pessoas estão"} sem código — preencha na lista abaixo`);
  }

  const trazer = $cp("cpTrazerValores").checked;
  let dados, modulo;

  if(rpa){
    const dataPg = $cp("cpData").value.trim();
    if(!dataPg) return reprovar("informe a data de pagamento","cpData");
    try{ dataAAAAMMDD(dataPg); }
    catch(e){ return reprovar("data de pagamento inválida — digite DDMMAAAA","cpData"); }
    const desc = $cp("cpDesc").value.trim().slice(0,100);
    if(!desc) return reprovar("informe a descrição do serviço","cpDesc");

    modulo = "rpa";
    dados = {
      empresa: $cp("cpEmpresa").value.trim(), codigo, competencia: comp,
      dataPagamento: dataPg, totalEsperado: total, descricaoPadrao: desc,
      contribuintes: marcados.map(a=>({
        nome: a.nome, codigo: a.codigo, cpf: a.cpf, descricao: desc,
        valor: trazer ? a.valor : null,
      })),
    };
  }else{
    const tipo = $cp("cpTipo").value.trim();
    if(!tipo)                  return reprovar("informe o tipo do processo","cpTipo");
    if(!/^\d{1,2}$/.test(tipo)) return reprovar("o tipo do processo é um número de até 2 dígitos","cpTipo");

    const rubricas = contraDados.rubricas.filter(r=>r.marcada);
    if(!rubricas.length) return reprovar("marque pelo menos uma rubrica");

    modulo = "lancamentos";
    dados = {
      empresa: $cp("cpEmpresa").value.trim(), codigo, competencia: comp,
      tipoProcesso: tipo, totalEsperado: total,
      trazerValores: trazer, rubricas, empregados: marcados,
    };
  }

  if(moduloAtivo!==modulo) trocarModulo(modulo);
  const m = planilhaModelo(modulo, dados);
  baixarBytes(construirZip(XL.montar(m.abas, m.cor)), m.nome,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  fecharMenuContracheque();
  oferecerCadastro(dados, rpa);
  const quem = rpa ? "contribuinte" : "empregado";
  $id("avisos").innerHTML =
    `<div class="msg ok"><strong>Modelo montado a partir ${dados.daCadastro?"do cadastro da empresa":(rpa?"do recibo de RPA":"do contracheque")}</strong>`+
    `${marcados.length} ${quem}${marcados.length===1?"":"s"}`+
    (rpa?"":` e ${dados.rubricas.length} rubrica${dados.rubricas.length===1?"":"s"}`)+
    ` — arquivo <code>${escapar(m.nome)}</code>. `+
    (rpa?"Preencha a coluna Código antes de gerar o arquivo do Domínio."
        :"Confira os códigos antes de mandar para o cliente.")+`</div>`;
}

/* ##################### entrada do documento ##################### */
async function lerContracheque(file){
  const cartao = $id("cardContra");
  cartao.classList.add("lendo");
  const btn = $id("btnContra");
  const rotulo = btn.textContent;
  btn.textContent = "Lendo…";
  btn.disabled = true;
  /* o pdf.js roda na thread principal: deixa a tela repintar antes de travar */
  await new Promise(r=>setTimeout(r,30));

  try{
    let paginas;
    if(/\.pdf$/i.test(file.name)){
      const buf = new Uint8Array(await file.arrayBuffer());
      paginas = await linhasDoPdf(buf);
      const totalLinhas = paginas.reduce((s,p)=>s+p.length,0);
      if(!totalLinhas)
        throw new Error("esse PDF não tem texto — parece digitalizado. Exporte o documento de novo em PDF de texto, ou use o botão de colar.");
    }else{
      paginas = [ linhasDoTexto(await file.text()) ];
    }
    interpretarDocumento(paginas, file.name);
  }catch(e){
    erro("não consegui ler o documento: "+e.message);
  }finally{
    cartao.classList.remove("lendo");
    btn.textContent = rotulo;
    btn.disabled = false;
  }
}

function interpretarDocumento(paginas, origem){
  const tipo = detectarTipoDocumento(paginas) || moduloAtivo;

  if(tipo==="liquidos") return interpretarRelacaoLiquidos(paginas, origem);

  if(tipo==="rpa"){
    const dados = analisarRecibosRpa(paginas);
    if(!dados.autonomos.length)
      return erro("reconheci um recibo de RPA, mas não consegui extrair nenhum contribuinte dele.");
    abrirMenuContracheque(dados, origem, "rpa");
  }else{
    const dados = analisarContracheque(paginas);
    abrirMenuContracheque(dados, origem, "lancamentos");
  }
}

/* A Relação Geral dos Líquidos serve aos dois módulos: o grupo Contribuintes
   alimenta o RPA e o grupo Empregados alimenta Lançamentos. */
function interpretarRelacaoLiquidos(paginas, origem){
  const rel = analisarRelacaoLiquidos(paginas);
  const contrib = rel.grupos.contribuintes;
  const empreg  = rel.grupos.empregados.concat(rel.grupos.estagiarios);
  if(!contrib.length && !empreg.length)
    return erro("reconheci a Relação Geral dos Líquidos, mas não consegui ler nenhuma linha de pessoa.");

  let modo;
  if(moduloAtivo==="rpa" && contrib.length)              modo="rpa";
  else if(moduloAtivo==="lancamentos" && empreg.length)  modo="lancamentos";
  else                                                   modo = contrib.length ? "rpa" : "lancamentos";

  const avisos = rel.avisos.slice();
  if(modo==="rpa" && empreg.length)
    avisos.push(`O relatório também traz ${empreg.length} empregado(s) — abra a aba Lançamentos e leia o arquivo de novo para usá-los.`);
  if(modo==="lancamentos" && contrib.length)
    avisos.push(`O relatório também traz ${contrib.length} contribuinte(s) — abra a aba RPA e leia o arquivo de novo para usá-los.`);

  const base = {
    empresa: rel.empresa, cnpj: rel.cnpj, competencia: rel.competencia,
    calculo: rel.calculo, totalEmpresa: rel.totalEmpresa, paginas: rel.paginas,
  };

  if(modo==="rpa"){
    abrirMenuContracheque(Object.assign({}, base, {
      dataPagamento: "", autonomos: contrib, avisos,
    }), origem, "rpa");
  }else{
    abrirMenuContracheque(Object.assign({}, base, {
      empregados: empreg.map(p=>({codigo:p.codigo, nome:p.nome, funcao:"", marcado:true})),
      rubricas: [],
      avisos: avisos.concat(["Este relatório não traz rubricas — cadastre abaixo as que você vai lançar."]),
    }), origem, "lancamentos");
  }
}

function lerContrachequeTexto(){
  const txt = $id("cpColado").value;
  if(txt.trim().length<20){ erro("cole o texto do documento antes de ler"); return; }
  try{ interpretarDocumento([ linhasDoTexto(txt) ], "texto colado"); }
  catch(e){ erro("não consegui interpretar o texto: "+e.message); }
}

/* ##################### tipos de processo ##################### */
/* A lista fica salva no Control Hub, para a equipe toda. Vem só com o 11, que é o padrão do
   próprio gerador — os outros o escritório cadastra conforme a sua Domínio. */
const TIPOS_PADRAO = [{codigo:"11", nome:"Folha mensal"}];

function tiposProcesso(){
  const l = api.tipos();
  return Array.isArray(l) && l.length ? l.filter(t=>t && t.codigo) : TIPOS_PADRAO.slice();
}

function salvarTiposProcesso(lista){
  api.salvarTipos(lista);
}

function nomeDoTipo(){
  const v = $cp("cpTipo").value.trim();
  const alvo = $cp("cpTipoNome");
  if(!v){ alvo.textContent=""; alvo.classList.remove("desconhecido"); return; }
  const t = tiposProcesso().find(x=>String(x.codigo)===v);
  alvo.textContent = t ? t.nome : "tipo não cadastrado";
  alvo.classList.toggle("desconhecido", !t);
}

function renderTiposProcesso(){
  const lista = tiposProcesso();
  const corpo = $cp("cpTipoLista");
  corpo.innerHTML = lista.length
    ? lista.map(t=>`<tr data-tipo="${escapar(t.codigo)}">`+
        `<td class="ajuda-cod">${escapar(t.codigo)}</td>`+
        `<td>${escapar(t.nome||"")}</td></tr>`).join("")
    : `<tr><td colspan="2" class="ajuda-vazio">nenhum tipo cadastrado ainda</td></tr>`;

  corpo.querySelectorAll("[data-tipo]").forEach(tr=>{
    tr.addEventListener("click",()=>{
      $cp("cpTipo").value = tr.dataset.tipo;
      nomeDoTipo();
    });
  });
  $cp("cpTipoTexto").value = lista.map(t=>`${t.codigo} = ${t.nome||""}`).join("\n");
  nomeDoTipo();
}

function salvarListaDeTipos(){
  const linhas = $cp("cpTipoTexto").value.split(/\r?\n/);
  const lista = [];
  for(const l of linhas){
    const m = l.match(/^\s*(\d{1,2})\s*[=\-:]\s*(.*)$/);
    if(m) lista.push({codigo:m[1], nome:m[2].trim()});
  }
  salvarTiposProcesso(lista);
  $cp("cpTipoEditor").hidden = true;
  renderTiposProcesso();
}
/* ##################### definição dos módulos ##################### */
const MODULOS = {

rpa: {
  rotulo: "RPA",
  nomeArquivoSaida: "rpa_importacao.txt",
  dropTitulo: "Arraste a planilha de RPA, ou clique para escolher",
  dropHint: "Abas <em>Parametros</em> e <em>Contribuintes</em> — nome, código e valor do mês na mesma linha. Pode soltar mais de uma planilha para gerar em lote",
  abaValores: "Contribuintes",
  campos: [
    {nome:"Código da empresa",     ini:1,   tam:7,   curto:"empresa"},
    {nome:"Código do contribuinte",ini:8,   tam:10,  curto:"contrib."},
    {nome:"Competência",           ini:18,  tam:6,   curto:"compet"},
    {nome:"Descrição da atividade",ini:24,  tam:100, curto:"descrição da atividade"},
    {nome:"Nº do RPA",             ini:124, tam:6,   curto:"nº RPA"},
    {nome:"Data de pagamento",     ini:130, tam:8,   curto:"data pg."},
    {nome:"Valor líquido",         ini:138, tam:11,  curto:"valor líq.", principal:true},
  ],
  abaEntidade: "contribuinte",
  colunaEntidade: "autônomo",

  parseDePara(wb){
    const abaP=acharAba(wb,"parametro");
    if(!abaP) throw new Error("a planilha de RPA precisa ter a aba 'Parametros'");

    let empresa=null, empresaNome=null, competencia=null, dataPagto=null,
        totalEsperado=null, descricaoPadrao=null;
    for(const l of lerAba(wb,abaP)){
      const rot=String(l[0]||"").toLowerCase(), val=l[1];
      if(val===""||val===undefined||val===null) continue;
      if(rot.includes("empresa") && rot.includes("código"))            empresa=val;
      else if(rot.includes("empresa") && !rot.includes("nome do arq")) empresaNome=val;
      else if(rot.includes("compet"))                                  competencia=val;
      else if(rot.includes("data") && rot.includes("pagamento"))       dataPagto=val;
      else if(rot.includes("total") && rot.includes("esperado"))       totalEsperado=val;
      else if(rot.includes("descri"))                                  descricaoPadrao=val;
    }
    if(empresa===null)     throw new Error("preencha o código da empresa na aba Parametros");
    if(competencia===null) throw new Error("preencha a competência na aba Parametros");
    if(dataPagto===null)   throw new Error("preencha a data de pagamento do lote na aba Parametros");
    return {empresa,empresaNome,competencia,dataPagto,
            descricaoPadrao: String(descricaoPadrao==null?"AUTONOMO":descricaoPadrao).trim() || "AUTONOMO",
            totalEsperado: totalEsperado===null?null:seguro(()=>paraNumero(totalEsperado))};
  },

  parseItensPlanilha(dp, wb){
    const abaC = acharAba(wb,"contribuinte");
    if(!abaC) throw new Error("não encontrei a aba 'Contribuintes' na planilha carregada");
    const linhas = lerAba(wb, abaC);
    const h = acharLinhaCabecalho(linhas,["nome"]);
    if(h<0) throw new Error("não encontrei o cabeçalho da aba Contribuintes (esperava uma coluna 'Nome')");
    const headerRow = linhas[h].map(c=>String(c).toLowerCase());
    const colNome  = headerRow.findIndex(c=>c.includes("nome"));
    const colCod   = headerRow.findIndex(c=>c.includes("código")||c.includes("codigo"));
    const colDesc  = headerRow.findIndex(c=>c.includes("descri")||c.includes("serviço")||c.includes("servico"));
    const colValor = headerRow.findIndex(c=>c.includes("valor"));
    const colCpf   = headerRow.findIndex(c=>c.replace(/[^a-z]/g,"")==="cpf");
    if(colCod<0)   throw new Error("não encontrei a coluna de CÓDIGO na aba Contribuintes");
    if(colValor<0) throw new Error("não encontrei a coluna VALOR na aba Contribuintes");

    const itens=[], ignoradas=[], incompletos=[], duplicados=[],
          cpfRuins=[], cpfRepetidos=[], nomesRepetidos=[];
    const porCodigo=new Map(), porNome=new Map(), porCpf=new Map();

    for(let i=h+1;i<linhas.length;i++){
      const nome=linhas[i][colNome];
      if(!nome||ehExemplo(nome)) continue;
      const val=linhas[i][colValor];
      if(vazio(val)) continue;
      const cod=linhas[i][colCod];
      if(vazio(cod)){
        incompletos.push(`${nome} — falta o código do contribuinte nessa linha`);
        continue;
      }
      const nomeLimpo=String(nome).trim();

      if(porCodigo.has(String(cod)))
        duplicados.push(`${nomeLimpo} e ${porCodigo.get(String(cod))} usam o mesmo código (${cod})`);
      else porCodigo.set(String(cod), nomeLimpo);

      const kNome=chave(nomeLimpo);
      if(porNome.has(kNome) && porNome.get(kNome)!==String(cod))
        nomesRepetidos.push(`${nomeLimpo} — aparece com os códigos ${porNome.get(kNome)} e ${cod}`);
      else porNome.set(kNome, String(cod));

      let cpf=null;
      if(colCpf>=0 && !vazio(linhas[i][colCpf])){
        cpf = soDigitos(linhas[i][colCpf]).padStart(11,"0");
        if(!cpfValido(cpf)) cpfRuins.push(`${nomeLimpo} — CPF ${formatarCpf(cpf)} não passa na validação`);
        else if(porCpf.has(cpf)) cpfRepetidos.push(`${nomeLimpo} e ${porCpf.get(cpf)} têm o mesmo CPF (${formatarCpf(cpf)})`);
        else porCpf.set(cpf, nomeLimpo);
      }

      const descricao = String((colDesc>=0 ? linhas[i][colDesc] : "")||"").trim();
      try{
        itens.push({nome:nomeLimpo, codigo:cod, descricao, cpf,
                    valor:paraNumero(val), valorBruto:val, linhaPlanilha:i+1});
      }
      catch(e){ ignoradas.push(`${nomeLimpo} — valor inválido: "${val}"`); }
    }

    const avisos=[];
    if(incompletos.length)    avisos.push({titulo:"Valor preenchido sem código cadastrado — corrija a linha na aba Contribuintes", lista:incompletos});
    if(duplicados.length)     avisos.push({titulo:"Mesmo código usado em mais de uma linha — confira se é duplicidade", lista:duplicados});
    if(nomesRepetidos.length) avisos.push({titulo:"Mesmo nome com códigos diferentes — pode ser cadastro duplicado no Domínio", lista:nomesRepetidos});
    if(cpfRuins.length)       avisos.push({titulo:"CPF inválido no cadastro — corrija antes de transmitir", lista:cpfRuins});
    if(cpfRepetidos.length)   avisos.push({titulo:"Mesmo CPF em mais de um contribuinte", lista:cpfRepetidos});
    return {itens, ignoradas, avisos};
  },

  gerar(dp, itens){
    const comp=competenciaAAAAMM(dp.competencia), dataFmt=dataAAAAMMDD(dp.dataPagto);
    const linhas=[], comErro=[], avisosExtra=[];
    const usados=new Set();

    const padrao = String(dp.descricaoPadrao||"").trim();
    const semDescricao=[], usaramPadrao=[];
    for(const it of itens){
      const descricao = it.descricao || padrao;
      if(!descricao) semDescricao.push(it.nome);
      else if(!it.descricao) usaramPadrao.push(it.nome);
      try{
        /* o nº do RPA é sempre sorteado pelo programa, sem repetir dentro do lote */
        const n = numeroAleatorioRPA(usados, 6);
        const texto =
          num(dp.empresa,7)+num(it.codigo,10)+comp+
          alfa(descricao,100)+num(n,6)+dataFmt+centavos(it.valor,11);
        linhas.push({
          nome: it.nome, valor: it.valor, rotulo: `RPA ${String(n).padStart(6,"0")}`,
          codigo: it.codigo, cpf: it.cpf, detalhe: descricao,
          linhaPlanilha: it.linhaPlanilha, texto, campos: MODULOS.rpa.campos,
        });
      }catch(e){ comErro.push(`${it.nome} — ${e.message}`); }
    }

    if(semDescricao.length) avisosExtra.push({titulo:"Sem descrição do serviço — o campo da atividade vai em branco no arquivo", lista:semDescricao});
    if(usaramPadrao.length) avisosExtra.push({
      titulo:`Sem descrição na planilha — usei a padrão "${padrao}"`, lista:usaramPadrao});

    return {
      linhas, comErro, semCadastro:[], pendentes:[], avisosExtra,
      resumoExtra: linhas.length ? `Numeração dos RPA<b>sorteada</b>` : "",
    };
  },
},

lancamentos: {
  rotulo: "Lançamentos",
  nomeArquivoSaida: "lancamentos_importacao.txt",
  dropTitulo: "Arraste a planilha de Lançamentos, ou clique para escolher",
  dropHint: "Abas <em>Parametros</em> e <em>Empregados</em> — nome, código e valores do mês na mesma linha; código da rubrica embutido no cabeçalho da coluna. Pode soltar mais de uma planilha para gerar em lote",
  abaValores: "Empregados",
  campos: [
    {nome:"Fixo \"10\"",           ini:1,  tam:2,  curto:"tp"},
    {nome:"Código do empregado",   ini:3,  tam:10, curto:"empregado"},
    {nome:"Competência",           ini:13, tam:6,  curto:"compet"},
    {nome:"Código da rubrica",     ini:19, tam:9,  curto:"rubrica"},
    {nome:"Tipo do processo",      ini:28, tam:2,  curto:"pr"},
    {nome:"Valor",                 ini:30, tam:9,  curto:"valor", principal:true},
    {nome:"Código da empresa",     ini:39, tam:10, curto:"empresa"},
  ],
  abaEntidade: "empregado",
  colunaEntidade: "empregado",

  parseDePara(wb){
    const abaP=acharAba(wb,"parametro");
    if(!abaP) throw new Error("a planilha de Lançamentos precisa ter a aba 'Parametros'");

    let empresa=null, empresaNome=null, competencia=null, tipoProcesso=null, totalEsperado=null;
    for(const l of lerAba(wb,abaP)){
      const rot=String(l[0]||"").toLowerCase(), val=l[1];
      if(vazio(val)) continue;
      if(rot.includes("empresa") && rot.includes("código"))       empresa=val;
      else if(rot.includes("empresa"))                            empresaNome=val;
      else if(rot.includes("compet"))                             competencia=val;
      else if(rot.includes("total") && rot.includes("esperado"))  totalEsperado=val;
      else if(rot.includes("tipo") && rot.includes("processo") && !rot.startsWith(" "))
        tipoProcesso=val;
    }
    if(empresa===null)      throw new Error("preencha o código da empresa na aba Parametros");
    if(competencia===null)  throw new Error("preencha a competência na aba Parametros");
    if(tipoProcesso===null) tipoProcesso=11;
    return {empresa,empresaNome,competencia,tipoProcesso,
            totalEsperado: totalEsperado===null?null:seguro(()=>paraNumero(totalEsperado))};
  },

  parseItensPlanilha(dp, wb){
    const abaE = acharAba(wb,"empregado");
    if(!abaE) throw new Error("não encontrei a aba 'Empregados' na planilha carregada");
    const linhas = lerAba(wb, abaE);
    const h = acharLinhaCabecalho(linhas,["nome"]);
    if(h<0) throw new Error("não encontrei o cabeçalho da aba Empregados (esperava uma coluna 'Nome')");
    const headerRow = linhas[h];
    const headerLower = headerRow.map(c=>String(c).toLowerCase());
    const colNome = headerLower.findIndex(c=>c.includes("nome"));
    const colCod  = headerLower.findIndex(c=>c.includes("código")||c.includes("codigo"));
    if(colCod<0) throw new Error("não encontrei a coluna de CÓDIGO na aba Empregados");

    const colunas=[], colunasIgnoradas=[], rubricasDuplicadas=[];
    const vistasRubricas=new Map();
    for(let c=0;c<headerRow.length;c++){
      if(c===colNome||c===colCod) continue;
      const titulo=headerRow[c];
      if(vazio(titulo)) continue;
      const m = String(titulo).trim().match(/^(.*?)\s*\((\d+)\)\s*$/);
      if(m){
        const codigo=Number(m[2]), exibicao=m[1].trim();
        if(vistasRubricas.has(codigo))
          rubricasDuplicadas.push(`"${exibicao}" e "${vistasRubricas.get(codigo)}" usam o mesmo código de rubrica (${codigo})`);
        else vistasRubricas.set(codigo, exibicao);
        colunas.push({idx:c, rubrica:{exibicao, codigo}});
      }
      else colunasIgnoradas.push(String(titulo));
    }
    if(!colunas.length) throw new Error("nenhuma coluna com o formato 'Nome da rubrica (código)' encontrada no cabeçalho da aba Empregados");

    const itens=[], ignoradas=[], incompletos=[], duplicados=[], nomesRepetidos=[];
    const porCodigo=new Map(), porNome=new Map();
    for(let i=h+1;i<linhas.length;i++){
      const nome=linhas[i][colNome];
      if(!nome||ehExemplo(nome)) continue;
      const temValor = colunas.some(col=>!vazio(linhas[i][col.idx]));
      if(!temValor) continue;
      const cod=linhas[i][colCod];
      if(vazio(cod)){
        incompletos.push(`${nome} — falta o código do empregado nessa linha`);
        continue;
      }
      const nomeLimpo=String(nome).trim();
      if(porCodigo.has(String(cod)))
        duplicados.push(`${nomeLimpo} e ${porCodigo.get(String(cod))} usam o mesmo código (${cod})`);
      else porCodigo.set(String(cod), nomeLimpo);

      const kNome=chave(nomeLimpo);
      if(porNome.has(kNome) && porNome.get(kNome)!==String(cod))
        nomesRepetidos.push(`${nomeLimpo} — aparece com os códigos ${porNome.get(kNome)} e ${cod}`);
      else porNome.set(kNome, String(cod));

      for(const col of colunas){
        const val=linhas[i][col.idx];
        if(vazio(val)) continue;
        try{ itens.push({nome:nomeLimpo, codigo:cod, valor:paraNumero(val), valorBruto:val,
                         rubrica:col.rubrica, linhaPlanilha:i+1}); }
        catch(e){ ignoradas.push(`${nomeLimpo} — ${col.rubrica.exibicao} — valor inválido: "${val}"`); }
      }
    }
    const avisos=[];
    if(colunasIgnoradas.length)   avisos.push({titulo:"Colunas sem código no cabeçalho — use o formato 'Nome da rubrica (código)'", lista:colunasIgnoradas});
    if(rubricasDuplicadas.length) avisos.push({titulo:"Código de rubrica repetido em duas colunas", lista:rubricasDuplicadas});
    if(incompletos.length)        avisos.push({titulo:"Valor preenchido sem código cadastrado — corrija a linha na aba Empregados", lista:incompletos});
    if(duplicados.length)         avisos.push({titulo:"Mesmo código usado em mais de uma linha — confira se é duplicidade", lista:duplicados});
    if(nomesRepetidos.length)     avisos.push({titulo:"Mesmo nome com códigos diferentes — pode ser cadastro duplicado no Domínio", lista:nomesRepetidos});
    return {itens, ignoradas, avisos};
  },

  gerar(dp, itens){
    const comp=competenciaAAAAMM(dp.competencia);
    const linhas=[], comErro=[];

    for(const it of itens){
      try{
        linhas.push({
          nome: it.nome, valor: it.valor, rotulo: it.rubrica.exibicao,
          codigo: it.codigo, detalhe: `rubrica ${it.rubrica.codigo}`,
          rubricaCodigo: it.rubrica.codigo, linhaPlanilha: it.linhaPlanilha,
          texto: "10"+num(it.codigo,10)+comp+num(it.rubrica.codigo,9)+
                 num(dp.tipoProcesso,2)+centavos(it.valor,9)+num(dp.empresa,10),
          campos: MODULOS.lancamentos.campos,
        });
      }catch(e){ comErro.push(`${it.nome} — ${it.rubrica.exibicao} — ${e.message}`); }
    }

    const rubricasUsadas=[...new Set(linhas.map(l=>l.rotulo))];
    return {
      linhas, comErro, semCadastro:[], pendentes:[], avisosExtra:[],
      resumoExtra: `Rubricas neste lote<b>${rubricasUsadas.length}</b>`,
    };
  },
},

};

let moduloAtivo = "rpa";

/* ##################### utilidades comuns ##################### */
const vazio = v => v===""||v===undefined||v===null;
const seguro = fn => { try{ return fn(); }catch(e){ return null; } };
const soDigitos = v => String(v==null?"":v).replace(/\D/g,"");

function num(v,t){
  if(vazio(v)) v=0;
  const n=Number(v);
  if(!Number.isFinite(n)) throw new Error("código não numérico no cadastro");
  if(n<0) throw new Error("código negativo não é aceito");
  const s=String(Math.trunc(n));
  if(s.length>t) throw new Error(`valor "${s}" excede ${t} posições`);
  return s.padStart(t,"0");
}
function alfa(v,t){
  let s=(v===null||v===undefined)?"":String(v);
  return s.slice(0,t).padEnd(t," ");
}
function paraNumero(v){
  if(typeof v==="number"){
    if(!Number.isFinite(v)) throw new Error(`valor inválido: "${v}"`);
    return v;
  }
  let s=String(v).trim().replace(/[R$\s\u00A0]/gi,"");
  const negativo = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/^[-(]|\)$/g,"");
  if(s.includes(",")){
    s=s.replace(/\./g,"").replace(",",".");
  }else{
    const pontos=(s.match(/\./g)||[]).length;
    if(pontos>1 || (pontos===1 && /\.\d{3}$/.test(s))) s=s.replace(/\./g,"");
  }
  const n=Number(s);
  if(s===""||isNaN(n)) throw new Error(`valor inválido: "${v}"`);
  return negativo ? -n : n;
}
function centavos(v,t){
  const n=paraNumero(v);
  if(n<0) throw new Error(`valor negativo (R$ ${moeda(n)}) — o leiaute não tem campo de sinal; use a rubrica de desconto correspondente`);
  const c=String(Math.round(n*100));
  if(c.length>t) throw new Error(`valor R$ ${moeda(n)} excede as ${t} posições do campo`);
  return c.padStart(t,"0");
}
function dataAAAAMMDD(v){
  if(vazio(v)) throw new Error("data vazia");
  let d;
  if(v instanceof Date) d=v;
  else{
    const s=String(v).trim();
    let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if(m) d=new Date(+m[3],+m[2]-1,+m[1]);
    else{
      m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
      d = m ? new Date(+m[1],+m[2]-1,+m[3]) : new Date(s);
    }
  }
  if(isNaN(d)) throw new Error(`data inválida: "${v}"`);
  return String(d.getFullYear())+String(d.getMonth()+1).padStart(2,"0")+
         String(d.getDate()).padStart(2,"0");
}
function numeroAleatorioRPA(usados, digitos){
  const max = Math.pow(10, digitos) - 1;
  const min = Math.floor(max * 0.5);
  let n;
  do{ n = min + Math.floor(Math.random() * (max - min + 1)); }while(usados.has(n));
  usados.add(n);
  return n;
}
function competenciaAAAAMM(v){
  if(v instanceof Date) return String(v.getFullYear())+String(v.getMonth()+1).padStart(2,"0");
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[\/\-](\d{4})$/); if(m) return m[2]+m[1].padStart(2,"0");
  m=s.match(/^(\d{4})[\/\-](\d{1,2})$/);     if(m) return m[1]+m[2].padStart(2,"0");
  if(/^\d{6}$/.test(s)) return s;
  throw new Error(`competência inválida: "${v}" (use MM/AAAA)`);
}
const MESES_PT=["janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"];
function competenciaExibicao(v){
  try{
    const aaaamm=competenciaAAAAMM(v);
    const mes=Number(aaaamm.slice(4,6));
    return `${MESES_PT[mes-1]}/${aaaamm.slice(0,4)}`;
  }catch(e){ return String(v||""); }
}
function cpfValido(cpf){
  const d=soDigitos(cpf);
  if(d.length!==11 || /^(\d)\1{10}$/.test(d)) return false;
  for(let t=9;t<11;t++){
    let s=0;
    for(let i=0;i<t;i++) s+=Number(d[i])*((t+1)-i);
    let dv=(s*10)%11; if(dv===10) dv=0;
    if(dv!==Number(d[t])) return false;
  }
  return true;
}
const formatarCpf = c => {
  const d=soDigitos(c).padStart(11,"0");
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};
function sanitizarNomeArquivo(s){
  const limpo=String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  return limpo || "empresa";
}
const semAcento = s => String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function detectarPlanilhaDesatualizada(wb, modulo){
  const nomes=wb.SheetNames.map(n=>n.toLowerCase());
  if(modulo==="lancamentos" && nomes.some(n=>n.includes("rubrica")))
    return "Essa planilha tem uma aba separada de Rubricas — modelo antigo. No modelo atual, "+
      "o código de cada rubrica fica embutido no cabeçalho da coluna, na aba Empregados "+
      "(formato \"Nome da rubrica (código)\"). Baixe o modelo atualizado e migre os dados.";
  if(nomes.some(n=>n.includes("valores do")))
    return "Essa planilha tem uma aba separada de Valores do Mês — modelo antigo. No modelo "+
      "atual, o valor fica na mesma linha do cadastro. Baixe o modelo atualizado e migre os dados.";
  return null;
}
function detectarValoresForaDoPadrao(itens, agrupador){
  const grupos=new Map();
  for(const it of itens){
    const k=agrupador?agrupador(it):"_";
    if(!grupos.has(k)) grupos.set(k,[]);
    grupos.get(k).push(it);
  }
  const avisos=[];
  for(const lista of grupos.values()){
    if(lista.length<3) continue;
    const valores=lista.map(i=>i.valor).sort((a,b)=>a-b);
    const meio=Math.floor(valores.length/2);
    const mediana=valores.length%2 ? valores[meio] : (valores[meio-1]+valores[meio])/2;
    if(mediana<=0) continue;
    for(const it of lista){
      if(it.valor>=mediana*3 && (it.valor-mediana)>50){
        const rotulo=it.rubrica ? `${it.nome} — ${it.rubrica.exibicao}` : it.nome;
        avisos.push(`${rotulo} — R$ ${moeda(it.valor)} (mediana do grupo: R$ ${moeda(mediana)})`);
      }
    }
  }
  return avisos;
}
/* valores zerados, negativos e com mais de dois decimais */
function conferirValores(itens){
  const zerados=[], negativos=[], arredondados=[];
  for(const it of itens){
    const r = it.rubrica ? ` — ${it.rubrica.exibicao}` : "";
    if(it.valor===0) zerados.push(`${it.nome}${r} — linha ${it.linhaPlanilha} da planilha`);
    else if(it.valor<0) negativos.push(`${it.nome}${r} — R$ ${moeda(it.valor)} (linha ${it.linhaPlanilha})`);
    if(Math.abs(it.valor*100 - Math.round(it.valor*100)) > 1e-6)
      arredondados.push(`${it.nome}${r} — ${it.valorBruto} vira R$ ${moeda(Math.round(it.valor*100)/100)}`);
  }
  const avisos=[];
  if(zerados.length)      avisos.push({titulo:"Valor zerado — o registro é gerado com R$ 0,00; apague a linha se não for lançar", lista:zerados});
  if(negativos.length)    avisos.push({titulo:"Valor negativo — o leiaute não tem campo de sinal e essas linhas não serão geradas", lista:negativos});
  if(arredondados.length) avisos.push({titulo:"Mais de duas casas decimais — arredondado para centavos", lista:arredondados});
  return avisos;
}
/* data de pagamento coerente com a competência */
function conferirDataPagamento(dp){
  if(!dp || vazio(dp.dataPagto)) return [];
  try{
    const comp=competenciaAAAAMM(dp.competencia);
    const dataStr=dataAAAAMMDD(dp.dataPagto);
    const compData=dataStr.slice(0,6);
    const compNum=Number(comp), dataNum=Number(compData);
    const dif=(Math.floor(dataNum/100)-Math.floor(compNum/100))*12+((dataNum%100)-(compNum%100));
    if(dif<0 || dif>1) return [{titulo:"Data de pagamento fora da competência",
      lista:[`Competência ${competenciaExibicao(dp.competencia)}, pagamento em `+
             `${dataStr.slice(6,8)}/${dataStr.slice(4,6)}/${dataStr.slice(0,4)} — confira se é isso mesmo.`]}];
  }catch(e){}
  return [];
}
function chave(n){
  return String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .trim().toUpperCase().replace(/\s+/g," ");
}
const ehExemplo = n => /exemplo/i.test(String(n||""));
const escapar = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const moeda = n => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

const lerAba = (wb,n) => wb.Sheets[n]
  ? XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:""}) : null;
const acharAba = (wb,t) => wb.SheetNames.find(n=>n.toLowerCase().includes(t.toLowerCase()));
function acharLinhaCabecalho(linhas,termos){
  for(let i=0;i<Math.min(linhas.length,25);i++){
    if(!linhas[i]) continue;
    const bate = termos.every(t=>linhas[i].some(c=>{
      const s=String(c).toLowerCase();
      return s.length<50 && s.includes(t);
    }));
    if(bate) return i;
  }
  return -1;
}

/* ##################### conferências de gravação ##################### */
function detectarForaLatin1(linhas){
  const problemas=[];
  for(const l of linhas){
    const ruins=[...new Set([...l.texto].filter(ch=>ch.codePointAt(0)>255))];
    if(ruins.length)
      problemas.push(`${l.nome} (${l.rotulo}) — ${ruins.map(c=>`"${c}"`).join(", ")}`);
  }
  return problemas;
}
function normalizarParaLatin1(linhas){
  let mudou=0;
  for(const l of linhas){
    if([...l.texto].some(ch=>ch.codePointAt(0)>255)){
      const antes=l.texto;
      l.texto=[...semAcento(l.texto)].map(ch=>ch.codePointAt(0)>255?" ":ch).join("");
      if(l.texto!==antes) mudou++;
      if(l.detalhe) l.detalhe=semAcento(l.detalhe);
    }
  }
  return mudou;
}

/* ##################### gerador de planilha modelo ##################### */
const XL = (()=>{
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const colLetra=n=>{let s="";n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;};

  const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="7">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><color rgb="FF0F1922"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF0F1922"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF7A8794"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF0F1922"/><name val="Calibri"/></font>
<font><sz val="10.5"/><color rgb="FF3D4E5C"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFCOR_TEMA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFCF0"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFC9D2DC"/></left><right style="thin"><color rgb="FFC9D2DC"/></right><top style="thin"><color rgb="FFC9D2DC"/></top><bottom style="thin"><color rgb="FFC9D2DC"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyProtection="1"><protection locked="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyProtection="1"><protection locked="1"/></xf>
<xf numFmtId="49" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="164" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="165" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1" applyProtection="1"><alignment wrapText="1" vertical="top"/><protection locked="1"/></xf>
<xf numFmtId="1" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyProtection="1"><protection locked="1"/></xf>
<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyProtection="1"><protection locked="1"/></xf>
<xf numFmtId="49" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>
<xf numFmtId="49" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function celulaXml(ref,c){
    if(c===null||c===undefined) return "";
    const s=c.s!==undefined?` s="${c.s}"`:"";
    if(vazio(c.v)) return `<c r="${ref}"${s}/>`;
    if(c.t==="n") return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
  }
  function sheetXml(def){
    const linhas=def.linhas||[];
    let maxC=0; linhas.forEach(l=>{ if(l&&l.length>maxC) maxC=l.length; });
    const dim=`A1:${colLetra(Math.max(0,maxC-1))}${Math.max(1,linhas.length)}`;
    const cols=(def.larguras&&def.larguras.length)
      ? "<cols>"+def.larguras.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")+"</cols>" : "";
    let sheetData="<sheetData>";
    linhas.forEach((linha,r)=>{
      if(!linha||!linha.length) return;
      const alt=(def.alturas&&def.alturas[r])?` ht="${def.alturas[r]}" customHeight="1"`:"";
      let cells=""; linha.forEach((c,ci)=>{ cells+=celulaXml(colLetra(ci)+(r+1),c); });
      if(cells) sheetData+=`<row r="${r+1}"${alt}>${cells}</row>`;
    });
    sheetData+="</sheetData>";
    /* atenção: no OOXML cada atributo indica o que fica BLOQUEADO — 1 proíbe, 0 libera */
    const linhas01 = def.permitirInserir ? "0" : "1";
    const prot=def.protegida
      ? `<sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="0" selectUnlockedCells="0" formatCells="0" formatColumns="0" formatRows="0" insertRows="${linhas01}" deleteRows="${linhas01}" insertColumns="1" deleteColumns="1" sort="0" autoFilter="0" pivotTables="1"/>` : "";
    const painel=def.congelar
      ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${def.congelar}" topLeftCell="A${def.congelar+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${def.congelar+1}" sqref="A${def.congelar+1}"/></sheetView></sheetViews>`
      : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`;
    const merges=(def.merges&&def.merges.length)
      ? `<mergeCells count="${def.merges.length}">`+def.merges.map(m=>`<mergeCell ref="${m}"/>`).join("")+`</mergeCells>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/>${painel}<sheetFormatPr defaultRowHeight="15"/>${cols}${sheetData}${prot}${merges}</worksheet>`;
  }
  function montar(abas, corTema){
    const partes=[];
    partes.push({nome:"[Content_Types].xml", texto:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((a,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`});
    partes.push({nome:"_rels/.rels", texto:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
    partes.push({nome:"xl/workbook.xml", texto:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="21000" windowHeight="13000"/></bookViews><sheets>${abas.map((a,i)=>`<sheet name="${esc(a.nome)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`});
    partes.push({nome:"xl/_rels/workbook.xml.rels", texto:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((a,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${abas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
    partes.push({nome:"xl/styles.xml", texto:STYLES.replace("COR_TEMA", corTema||"3C659B")});
    abas.forEach((a,i)=>partes.push({nome:`xl/worksheets/sheet${i+1}.xml`, texto:sheetXml(a)}));
    return partes.map(p=>({nome:p.nome, bytes:new TextEncoder().encode(p.texto)}));
  }
  return {montar};
})();

const S=(v,s)=>({v,t:"s",s});
const N=(v,s)=>({v,t:"n",s});
const EST={titulo:1, cab:2, rotulo:3, txt:4, valor:5, data:6, nota:7, inteiro:8,
           cabEdit:11, exemploTxt:12, exemploNum:13};

function planilhaModelo(modulo, dados){
  const d = dados || {};
  const hoje=new Date();
  const compAtual=`${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`;
  const vaziasTxt=(n,cols)=>Array.from({length:n},()=>cols.map(c=>c==="n"?N(null,EST.valor):(c==="i"?N(null,EST.inteiro):S("",EST.txt))));

  if(modulo==="rpa"){
    const descPadrao = String(d.descricaoPadrao||"AUTONOMO").trim() || "AUTONOMO";
    let dataPadrao = d.dataPagamento || "";
    if(!dataPadrao){
      try{
        const a = competenciaAAAAMM(d.competencia||compAtual);
        const ano=Number(a.slice(0,4)), mes=Number(a.slice(4,6));
        const dia=new Date(ano,mes,0).getDate();
        dataPadrao = `${String(dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}/${ano}`;
      }catch(e){}
    }
    const abaParam={nome:"Parametros", protegida:true, larguras:[34,28],
      linhas:[
        [S("Parâmetros do lote de RPA",EST.titulo)],
        [S("Preencha só as células com fundo creme. O resto da planilha está travado de propósito.",EST.nota)],
        [],
        [S("Empresa",EST.rotulo), S(d.empresa||"",EST.txt)],
        [S("Código da empresa",EST.rotulo), N(vazio(d.codigo)?null:Number(d.codigo),EST.inteiro)],
        [S("Competência (MM/AAAA)",EST.rotulo), S(d.competencia||compAtual,EST.txt)],
        [S("Data de pagamento",EST.rotulo), S(dataPadrao,EST.txt)],
        [S("Descrição padrão do serviço",EST.rotulo), S(descPadrao,EST.txt)],
        [S("Total esperado (opcional)",EST.rotulo), N(vazio(d.totalEsperado)?null:Number(d.totalEsperado),EST.valor)],
        [],
        [S("Descrição padrão: vale para as linhas que ficarem sem descrição própria.",EST.nota)],
        [S("O nº de cada RPA é sorteado pelo gerador na hora de montar o arquivo.",EST.nota)],
        [S("Total esperado: soma que você espera do lote. O gerador confere e avisa se der diferença.",EST.nota)],
      ],
      alturas:{1:28, 10:24, 11:24, 12:24}};

    const tiposRpa = ["s","i","s","s","n"];
    const contribuintes = (d.contribuintes||[]).filter(c=>!vazio(c.nome));
    const linhasContrib = contribuintes.map(c=>[
      S(String(c.nome),EST.txt),
      N(vazio(c.codigo)?null:Number(String(c.codigo).replace(/\D/g,"")),EST.inteiro),
      S(c.cpf||"",EST.txt),
      S(c.descricao||descPadrao,EST.txt),
      N(vazio(c.valor)?null:Number(c.valor),EST.valor),
    ]);
    const exemploContrib = [S("EXEMPLO — apague esta linha",EST.exemploTxt),N(1,EST.exemploNum),
      S("000.000.000-00",EST.exemploTxt),
      S(descPadrao,EST.exemploTxt),N(1500,EST.exemploNum)];

    const abaContrib={nome:"Contribuintes", protegida:true, permitirInserir:true, congelar:1,
      larguras:[40,12,17,46,15],
      linhas:[
        [S("Nome",EST.cab),S("Código",EST.cab),S("CPF",EST.cab),
         S("Descrição do serviço",EST.cab),S("Valor",EST.cab)],
        ...(contribuintes.length ? linhasContrib : [exemploContrib]),
        ...vaziasTxt(contribuintes.length ? 15 : 60, tiposRpa),
      ],
      alturas:{0:30}};

    const abaInstr={nome:"Instrucoes", protegida:true, larguras:[110],
      linhas:[
        [S("Como preencher esta planilha",EST.titulo)],
        [],
        [S("1. Aba Parametros — informe empresa, código, competência e data de pagamento do lote.",EST.nota)],
        [S("2. Aba Contribuintes — o escritório preenche Nome, Código e CPF de antemão; o cliente completa só a coluna Valor.",EST.nota)],
        [S("3. O valor lançado é o LÍQUIDO. O Domínio calcula INSS, IRRF e ISS a partir dele (registro Sefip 13).",EST.nota)],
        [S("4. Contribuintes de categoria Padrão não entram aqui — lance direto no Domínio.",EST.nota)],
        [S("5. Linhas sem valor são ignoradas. Linhas com valor e sem código viram aviso.",EST.nota)],
        [S("6. O nº de cada RPA é sorteado pelo gerador; não existe coluna para ele.",EST.nota)],
        [S("7. Não renomeie as abas nem mexa nos cabeçalhos — o gerador procura por eles.",EST.nota)],
        [],
        [S("Depois de preenchida, arraste esta planilha no Importador Domínio do Control Hub (Departamento Pessoal › Ferramentas).",EST.nota)],
        [S("O arquivo .txt gerado entra no Domínio em Utilitários > Importação > de Arquivo Texto.",EST.nota)],
      ],
      alturas:{0:26}};

    const nomeRpa = d.empresa
      ? `Modelo_RPA_${sanitizarNomeArquivo(d.empresa)}.xlsx` : "Modelo_RPA.xlsx";
    return {abas:[abaParam,abaContrib,abaInstr], cor:"3C659B", nome:nomeRpa};
  }

  const abaParam={nome:"Parametros", protegida:true, larguras:[34,28],
    linhas:[
      [S("Parâmetros do lote de Lançamentos",EST.titulo)],
      [S("Preencha só as células com fundo creme. O resto da planilha está travado de propósito.",EST.nota)],
      [],
      [S("Empresa",EST.rotulo), S(d.empresa||"",EST.txt)],
      [S("Código da empresa",EST.rotulo), N(vazio(d.codigo)?null:Number(d.codigo),EST.inteiro)],
      [S("Competência (MM/AAAA)",EST.rotulo), S(d.competencia||compAtual,EST.txt)],
      [S("Tipo do processo",EST.rotulo), N(vazio(d.tipoProcesso)?11:Number(d.tipoProcesso),EST.inteiro)],
      [S("Total esperado (opcional)",EST.rotulo), N(vazio(d.totalEsperado)?null:Number(d.totalEsperado),EST.valor)],
      [],
      [S("Tipo do processo: 11 = folha mensal. Deixe 11 se não souber.",EST.nota)],
      [S("Total esperado: soma que você espera do lote. O gerador confere e avisa se der diferença.",EST.nota)],
    ],
    alturas:{1:28, 9:24, 10:24}};

  /* colunas de rubrica: vêm do contracheque quando houver, senão duas de exemplo.
     Sempre sobram colunas em branco destravadas para o escritório nomear. */
  const rubricas = (d.rubricas && d.rubricas.length)
    ? d.rubricas
    : [{descricao:"Vale transporte", codigo:1050},{descricao:"Prêmio", codigo:1080}];
  const colsRubrica = rubricas.map(r=>S(`${r.descricao} (${r.codigo})`, EST.cabEdit));
  const sobras = Math.max(2, 6-colsRubrica.length);
  for(let i=0;i<sobras;i++) colsRubrica.push(S("",EST.cabEdit));

  const tipos = ["s","i", ...colsRubrica.map(()=>"n")];
  const empregados = (d.empregados||[]).filter(e=>!vazio(e.nome));
  const linhasEmpregados = empregados.map(e=>[
    S(String(e.nome),EST.txt),
    N(vazio(e.codigo)?null:Number(String(e.codigo).replace(/\D/g,"")),EST.inteiro),
    /* com "trazer valores", cada célula recebe o que aquela pessoa teve na rubrica */
    ...colsRubrica.map((_,i)=>{
      const r = rubricas[i];
      const v = (d.trazerValores && r && r.porEmpregado) ? r.porEmpregado[e.codigoOriginal] : null;
      return N(vazio(v)?null:Number(v), EST.valor);
    }),
  ]);
  const linhaExemplo = [S("EXEMPLO — apague esta linha",EST.exemploTxt),N(1,EST.exemploNum),
    N(180,EST.exemploNum), ...colsRubrica.slice(1).map(()=>S("",EST.exemploTxt))];

  const abaEmpr={nome:"Empregados", protegida:true, permitirInserir:true, congelar:1,
    larguras:[40,12, ...colsRubrica.map(()=>22)],
    linhas:[
      [S("Nome",EST.cab),S("Código",EST.cab), ...colsRubrica],
      ...(empregados.length ? linhasEmpregados : [linhaExemplo]),
      ...vaziasTxt(empregados.length ? 15 : 60, tipos),
    ],
    alturas:{0:32}};

  const abaInstr={nome:"Instrucoes", protegida:true, larguras:[110],
    linhas:[
      [S("Como preencher esta planilha",EST.titulo)],
      [],
      [S("1. Aba Parametros — informe empresa, código e competência da folha.",EST.nota)],
      [S("2. Aba Empregados — cada coluna de valor é uma rubrica, e o cabeçalho tem que terminar com o código entre parênteses.",EST.nota)],
      [S("   Exemplo de cabeçalho válido: Vale transporte (1050)",EST.nota)],
      [S("3. Renomeie as colunas de rubrica conforme a empresa. As colunas de cabeçalho azul estão liberadas para digitar.",EST.nota)],
      [S("   Colunas de cabeçalho vazio são ignoradas; colunas sem código entre parênteses geram aviso.",EST.nota)],
      [S("4. O escritório preenche Nome e Código de antemão; o cliente completa só os valores.",EST.nota)],
      [S("5. Célula vazia não vira lançamento. Zero vira lançamento de R$ 0,00.",EST.nota)],
      [S("6. Não renomeie as abas — o gerador procura por elas.",EST.nota)],
      [],
      [S("Depois de preenchida, arraste esta planilha no Importador Domínio do Control Hub (Departamento Pessoal › Ferramentas).",EST.nota)],
      [S("O arquivo .txt gerado entra no Domínio em Utilitários > Importação > de Arquivo Texto.",EST.nota)],
      ...(empregados.length
        ? [[],[S("Nomes, códigos e rubricas vieram do contracheque de "+(d.competencia||"")+". Confira antes de mandar para o cliente.",EST.nota)]]
        : []),
    ],
    alturas:{0:26}};

  const nomeArq = d.empresa
    ? `Modelo_Lancamentos_${sanitizarNomeArquivo(d.empresa)}.xlsx`
    : "Modelo_Lancamentos.xlsx";
  return {abas:[abaParam,abaEmpr,abaInstr], cor:"3C659B", nome:nomeArq};
}

function baixarModeloEmBranco(d){
  const m=planilhaModelo(moduloAtivo, d);
  const bytes=construirZip(XL.montar(m.abas, m.cor));
  baixarBytes(bytes, m.nome, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const b=$id("btnModelo");
  const txt=b.textContent; b.textContent="Modelo baixado ✓";
  setTimeout(()=>{b.textContent=txt;},1800);
}

/* ##################### orquestração ##################### */
let dadosDePara=null, txtGerado=null;
let ultimoMod=null, ultimoResultado=null, ultimoIgnoradas=null, ultimoDp=null, recordsAbertos=new Set();
let avisoTransitorio="";
let modoLote=false, arquivosLote=[], ultimoLoteResultados=null;
let geradoEm=null, modoRelatorio=false;

function gerar(){
  geradoEm=new Date();
  return modoLote ? gerarLote() : gerarUnico();
}

function montarResultado(mod, wb, moduloNome){
  const alertaVersao = detectarPlanilhaDesatualizada(wb, moduloNome);
  if(alertaVersao) throw new Error(alertaVersao);
  const dp = mod.parseDePara(wb);
  completarEmpresa(dp);
  const parsed = mod.parseItensPlanilha(dp, wb);
  if(!parsed.itens.length)
    throw new Error("não encontrei nenhum registro reconhecível na aba "+mod.abaValores);

  const resultado = mod.gerar(dp, parsed.itens);

  const foraDoPadrao = detectarValoresForaDoPadrao(parsed.itens,
    moduloNome==="lancamentos" ? it=>it.rubrica.codigo : null);
  const avisosPadrao = foraDoPadrao.length
    ? [{titulo:"Valor bem acima dos demais no mesmo grupo — confira antes de gerar", lista:foraDoPadrao}]
    : [];

  resultado.avisosExtra = [
    ...(parsed.avisos||[]),
    ...conferirValores(parsed.itens),
    ...conferirDataPagamento(dp),
    ...avisosPadrao,
    ...(resultado.avisosExtra||[]),
  ];
  resultado.reconciliacao = reconciliar(dp, resultado.linhas);
  return {dp, parsed, resultado};
}

function reconciliar(dp, linhas){
  const soma = linhas.reduce((s,l)=>s+l.valor,0);
  if(dp.totalEsperado===null||dp.totalEsperado===undefined) return {soma, esperado:null};
  const dif = Math.round((soma-dp.totalEsperado)*100)/100;
  return {soma, esperado:dp.totalEsperado, diferenca:dif, confere:Math.abs(dif)<0.005};
}

function gerarUnico(){
  limparSaida();
  const mod = MODULOS[moduloAtivo];
  let r;
  try{ r = montarResultado(mod, dadosDePara, moduloAtivo); }
  catch(e){ return erro(e.message); }

  ultimoDp = r.dp;
  recordsAbertos = new Set();
  render(mod, r.resultado, r.parsed.ignoradas);
}

function gerarLote(){
  limparSaida();
  const mod = MODULOS[moduloAtivo];
  const resultados=[];

  for(const item of arquivosLote){
    if(!item.wb){ resultados.push({nome:item.nome, ok:false, mensagem:"não consegui ler o arquivo: "+item.erroLeitura}); continue; }
    let r;
    try{ r = montarResultado(mod, item.wb, moduloAtivo); }
    catch(e){ resultados.push({nome:item.nome, ok:false, mensagem:e.message}); continue; }

    const totalAvisos = (r.resultado.avisosExtra||[]).length + r.resultado.comErro.length;
    const txt = r.resultado.linhas.map(l=>l.texto).join("\r\n")+"\r\n";
    resultados.push({
      nome:item.nome, ok:true, dp:r.dp, resultado:r.resultado, txt,
      ignoradas:r.parsed.ignoradas,
      nomeArq: nomeArquivoSaida(moduloAtivo, r.dp), avisosCount: totalAvisos,
    });
  }

  ultimoLoteResultados = resultados;
  renderLote(resultados);
}

function limparSaida(){
  $id("avisos").innerHTML="";
  $id("saida").innerHTML="";
  $id("btnBaixar").disabled=true;
  const be=$id("btnRelatorio"); if(be) be.disabled=true;
  txtGerado=null;
}

function erro(msg){
  $id("avisos").innerHTML=
    `<div class="msg err"><strong>Não deu para gerar</strong>${escapar(msg)}</div>`;
  $id("status").textContent="";
}
const bloco=(cls,titulo,lista,acao)=>
  `<div class="msg ${cls}"><strong>${escapar(titulo)}</strong><ul>`+
  lista.map(x=>`<li>${escapar(x)}</li>`).join("")+`</ul>${acao||""}</div>`;

/* ##################### render — lote ##################### */
function renderLote(resultados){
  const ok = resultados.filter(r=>r.ok);
  const somaGeral = ok.reduce((s,r)=>s+r.resultado.linhas.reduce((a,l)=>a+l.valor,0),0);
  const regGeral = ok.reduce((s,r)=>s+r.resultado.linhas.length,0);

  let html = `<h2><span class="step">3</span> Lote — ${resultados.length} planilha${resultados.length===1?"":"s"}</h2>
    <table class="tabela-lote"><thead><tr>
      <th>Arquivo</th><th>Empresa</th><th>Competência</th><th class="num">Registros</th>
      <th class="num">Soma</th><th>Conferência</th><th>Avisos</th><th></th>
    </tr></thead><tbody>`;
  resultados.forEach((r,i)=>{
    if(r.ok){
      const soma = r.resultado.linhas.reduce((s,l)=>s+l.valor,0);
      const rec = r.resultado.reconciliacao;
      let conf='<span class="pill pill-neutro">sem total</span>';
      if(rec.esperado!==null)
        conf = rec.confere
          ? '<span class="pill pill-ok">confere</span>'
          : `<span class="pill pill-erro">${rec.diferenca>0?"+":"−"} R$ ${moeda(Math.abs(rec.diferenca))}</span>`;
      html += `<tr>
        <td>${escapar(r.nome)}</td>
        <td>${escapar(r.dp.empresaNome ? String(r.dp.empresaNome) : "código "+String(r.dp.empresa))}</td>
        <td>${escapar(competenciaExibicao(r.dp.competencia))}</td>
        <td class="pos num">${r.resultado.linhas.length}</td>
        <td class="pos num">R$ ${moeda(soma)}</td>
        <td>${conf}</td>
        <td class="pos">${r.avisosCount ? r.avisosCount+" aviso"+(r.avisosCount===1?"":"s") : "—"}</td>
        <td class="acoes">
          <button type="button" class="mini" data-lote-abrir="${i}">Conferir</button>
          <button type="button" class="mini" data-lote-baixar="${i}">.txt</button>
        </td>
      </tr>`;
    }else{
      html += `<tr class="linha-erro">
        <td>${escapar(r.nome)}</td>
        <td colspan="6">${escapar(r.mensagem)}</td>
        <td><span class="status-erro">erro</span></td>
      </tr>`;
    }
  });
  if(ok.length>1){
    html += `<tr class="linha-total">
      <td colspan="3">Total do lote</td>
      <td class="pos num">${regGeral}</td>
      <td class="pos num">R$ ${moeda(somaGeral)}</td>
      <td colspan="3"></td></tr>`;
  }
  html += `</tbody></table>`;
  $id("saida").innerHTML = html;
  $id("status").textContent =
    `${ok.length} de ${resultados.length} planilha${resultados.length===1?"":"s"} gerada${ok.length===1?"":"s"}`;
  $id("btnBaixar").disabled = !ok.length;
  const be=$id("btnRelatorio"); if(be) be.disabled=!ok.length;

  root.querySelectorAll("[data-lote-baixar]").forEach(b=>{
    b.addEventListener("click",()=>{
      const r=ultimoLoteResultados[Number(b.dataset.loteBaixar)];
      baixarBytes(paraBytesLatin1(r.txt), r.nomeArq, "text/plain");
      registrar(r.dp, r.resultado, r.nomeArq);
    });
  });
  root.querySelectorAll("[data-lote-abrir]").forEach(b=>{
    b.addEventListener("click",()=>{
      const r=ultimoLoteResultados[Number(b.dataset.loteAbrir)];
      modoLote=false;
      ultimoDp=r.dp; recordsAbertos=new Set();
      avisoTransitorio=`<div class="msg ok"><strong>Conferindo "${escapar(r.nome)}"</strong>`+
        `As edições valem só para este arquivo. Use "Voltar ao lote" para ver os outros.</div>`;
      $id("btnVoltarLote").hidden=false;
      atualizarBotaoGerar();
      render(MODULOS[moduloAtivo], r.resultado, r.ignoradas||[]);
    });
  });
}

function voltarAoLote(){
  modoLote=true;
  $id("btnVoltarLote").hidden=true;
  ultimoLoteResultados.forEach(r=>{
    if(r.ok) r.txt=r.resultado.linhas.map(l=>l.texto).join("\r\n")+"\r\n";
  });
  $id("avisos").innerHTML="";
  atualizarBotaoGerar();
  renderLote(ultimoLoteResultados);
}

/* ##################### render — conferência ##################### */
function resumoPorGrupo(linhas){
  const m=new Map();
  linhas.forEach(l=>{
    const k=l.rotulo;
    if(!m.has(k)) m.set(k,{n:0,soma:0});
    const g=m.get(k); g.n++; g.soma+=l.valor;
  });
  return [...m.entries()].sort((a,b)=>b[1].soma-a[1].soma);
}

function render(mod, r, ignoradas){
  ultimoMod=mod; ultimoResultado=r; ultimoIgnoradas=ignoradas||[];

  const foraLatin1 = detectarForaLatin1(r.linhas);

  let html = avisoTransitorio;
  avisoTransitorio="";
  if(r.comErro.length) html+=bloco("err","Linhas com erro — não entraram no arquivo",r.comErro);
  if(foraLatin1.length) html+=bloco("err",
    "Caracteres que o arquivo não aceita — viram \"?\" no Domínio", foraLatin1,
    `<button type="button" class="msg-acao" id="imp-btnNormalizar">Tirar os acentos e gerar de novo</button>`);
  (r.avisosExtra||[]).forEach(a=>{ html+=bloco("warn", a.titulo, a.lista); });
  if(ignoradas && ignoradas.length) html+=bloco("warn","Linhas que não viraram registro (confira se alguma deveria ter virado)",ignoradas);
  $id("avisos").innerHTML=html;

  const btnNorm=$id("btnNormalizar");
  if(btnNorm) btnNorm.addEventListener("click",()=>{
    const n=normalizarParaLatin1(r.linhas);
    avisoTransitorio=`<div class="msg ok"><strong>Acentos removidos</strong>${n} registro${n===1?"":"s"} ajustado${n===1?"":"s"}. Confira o texto antes de baixar.</div>`;
    render(mod, r, ignoradas);
  });

  if(!r.linhas.length){
    $id("status").textContent="nenhum registro gerado";
    $id("saida").innerHTML=""; return;
  }

  const total=r.linhas.reduce((s,l)=>s+l.valor,0);
  const editados=r.linhas.filter(l=>l.editado).length;
  const tamanhos=[...new Set(r.linhas.map(l=>l.texto.length))];
  $id("status").textContent=
    `${r.linhas.length} registro${r.linhas.length===1?"":"s"} · `+
    (tamanhos.length===1 ? `${tamanhos[0]} caracteres por linha` : `${tamanhos.join(" ou ")} caracteres por linha`);

  txtGerado=r.linhas.map(l=>l.texto).join("\r\n")+"\r\n";
  $id("btnBaixar").disabled=false;
  {const c=$id("btnCopiar"); if(c){ c.disabled=false; c.hidden=false; }}
  {const b=$id("btnRelatorio"); if(b) b.disabled=false;}

  const rec=r.reconciliacao||{soma:total,esperado:null};
  let painelRec="";
  if(rec.esperado!==null && rec.esperado!==undefined){
    painelRec = rec.confere
      ? `<div class="recon recon-ok"><span class="recon-tag">Confere</span>
          <span class="recon-txt">A soma bate com o total esperado de <b>R$ ${moeda(rec.esperado)}</b>.</span></div>`
      : `<div class="recon recon-dif"><span class="recon-tag">Diferença</span>
          <span class="recon-txt">Esperado <b>R$ ${moeda(rec.esperado)}</b>, gerado <b>R$ ${moeda(rec.soma)}</b> —
          ${rec.diferenca>0?"R$ "+moeda(rec.diferenca)+" a mais":"R$ "+moeda(Math.abs(rec.diferenca))+" a menos"}.</span></div>`;
  }

  const grupos=resumoPorGrupo(r.linhas);
  const mostrarResumoGrupo = moduloAtivo==="lancamentos" && grupos.length>1;

  let out=`<h2><span class="step">3</span> Conferência
      <span class="h2-note">passe o mouse num campo para localizá-lo nos caracteres</span></h2>
    <p class="lote-info">Gerando para <b>${escapar(ultimoDp && ultimoDp.empresaNome ? String(ultimoDp.empresaNome) : "empresa código "+String(ultimoDp.empresa))}</b>`+
      ` — <b>${escapar(competenciaExibicao(ultimoDp.competencia))}</b>`+
      (geradoEm?` <span class="carimbo">gerado em ${geradoEm.toLocaleString("pt-BR")}</span>`:"")+`</p>
    ${painelRec}
    <div class="tot">
      <div>Registros<b>${r.linhas.length}</b></div>
      <div>Soma dos valores<b id="imp-totalValores">R$ ${moeda(total)}</b></div>
      ${editados?`<div>Editados<b id="imp-totalEditados">${editados}</b></div>`:""}
      ${r.resumoExtra?`<div>${r.resumoExtra}</div>`:""}
    </div>`;

  if(mostrarResumoGrupo){
    out += `<details class="resumo-grupo" open><summary>Total por rubrica</summary>
      <table class="tabela-resumo"><thead><tr><th>Rubrica</th><th class="num">Lanç.</th><th class="num">Soma</th></tr></thead><tbody>`+
      grupos.map(([k,g])=>`<tr><td>${escapar(k)}</td><td class="pos num">${g.n}</td><td class="pos num">R$ ${moeda(g.soma)}</td></tr>`).join("")+
      `</tbody></table></details>`;
  }

  out += r.linhas.length>3?`
    <div class="rec-toolbar">
      <input id="imp-recFiltro" class="rec-filter" type="search" placeholder="Filtrar por nome, código ou rubrica…" aria-label="Filtrar registros">
      <span class="rec-filtro-count" id="imp-recFiltroCount"></span>
      <select id="imp-recSort" class="rec-sort" aria-label="Ordenar registros">
        <option value="orig">Ordem da planilha</option>
        <option value="nome">Nome (A→Z)</option>
        <option value="maior">Maior valor</option>
        <option value="menor">Menor valor</option>
      </select>
      <button type="button" class="rec-tool-btn" id="imp-recExpandir">Expandir tudo</button>
      <button type="button" class="rec-tool-btn" id="imp-recRecolher">Recolher tudo</button>
    </div>`:"";

  const contagemPorNome={}, somaPorNome={};
  r.linhas.forEach(l=>{ contagemPorNome[l.nome]=(contagemPorNome[l.nome]||0)+1;
    somaPorNome[l.nome]=(somaPorNome[l.nome]||0)+l.valor; });

  let prevNome=null;
  r.linhas.forEach((l,i)=>{
    if(l.nome!==prevNome){
      prevNome=l.nome;
      out+=`<div class="rec-grupo-head" data-nome="${escapar(chave(l.nome))}">`+
        `<span class="nome">${escapar(l.nome)}</span>`+
        `<span class="rec-grupo-meta">${contagemPorNome[l.nome]} lanç. · <b>R$ ${moeda(somaPorNome[l.nome])}</b></span>`+
        `</div>`;
    }
    out += cartaoRegistro(l, i, mod);
  });
  $id("saida").innerHTML=out;
  ligarEventosConferencia(mod, r);
}

function cartaoRegistro(l, i, mod){
  const aberto = recordsAbertos.has(i);
  let regua="", fita="", tabela="";
  (l.campos||mod.campos).forEach((c,ci)=>{
    regua += `<span data-f="${ci}" style="--n:${c.tam}">${c.ini}</span>`;
    fita  += `<span data-f="${ci}" style="--n:${c.tam}" title="${escapar(c.nome)}">`+
             `${escapar(l.texto.substr(c.ini-1,c.tam))}</span>`;
    tabela += `<tr data-f="${ci}">`+
      `<td class="pos">${String(c.ini).padStart(3,"0")}–${String(c.ini+c.tam-1).padStart(3,"0")}</td>`+
      `<td>${escapar(c.nome)}</td>`+
      `<td class="val">${escapar(l.texto.substr(c.ini-1,c.tam))}</td></tr>`;
  });
  const busca=chave([l.nome,l.rotulo,l.codigo,l.detalhe].filter(Boolean).join(" "));
  return `<div class="rec${aberto?" open":""}" data-rec="${i}" data-busca="${escapar(busca)}">`+
    `<div class="rec-head">`+
    `<button class="rec-toggle" data-idx="${i}" aria-expanded="${aberto}">`+
      `<span class="rec-nome">${escapar(l.nome)}</span>`+
      `<span class="chip chip-editado"${l.editado?"":' hidden'}>editado</span></button>`+
    `<span class="rec-valor-wrap">R$ <input class="rec-valor-input" data-idx="${i}" `+
      `inputmode="decimal" aria-label="Valor de ${escapar(l.nome)}" `+
      `value="${escapar(moeda(l.valor))}"></span>`+
    `<span class="rec-n">${escapar(l.rotulo)}</span>`+
    `</div>`+
    `<div class="rec-body">`+
      `<div class="fita-reg-wrap">`+
        `<div class="regua">${regua}</div>`+
        `<div class="fita-reg">${fita}</div>`+
      `</div>`+
      `<table><thead><tr><th>Posição</th><th>Campo</th><th>Conteúdo gravado</th></tr></thead>`+
      `<tbody>${tabela}</tbody></table>`+
    `</div></div>`;
}

function ligarEventosConferencia(mod, r){
  root.querySelectorAll(".rec-toggle").forEach(b=>{
    b.addEventListener("click",()=>{
      const i=Number(b.dataset.idx);
      if(recordsAbertos.has(i)) recordsAbertos.delete(i); else recordsAbertos.add(i);
      const aberto=b.closest(".rec").classList.toggle("open");
      b.setAttribute("aria-expanded",aberto?"true":"false");
    });
  });

  root.querySelectorAll(".rec").forEach(rec=>{
    const marcar=f=>rec.querySelectorAll("[data-f]").forEach(el=>
      el.classList.toggle("hl", f!==null && el.dataset.f===f));
    rec.addEventListener("mouseover",e=>{
      const alvo=e.target.closest && e.target.closest("[data-f]");
      if(alvo) marcar(alvo.dataset.f);
    });
    rec.addEventListener("mouseleave",()=>marcar(null));
  });

  root.querySelectorAll(".rec-valor-input").forEach(inp=>{
    inp.addEventListener("click",e=>e.stopPropagation());
    inp.addEventListener("blur",()=>editarValor(Number(inp.dataset.idx), inp.value, inp));
    inp.addEventListener("keydown",e=>{
      if(e.key==="Enter"){ e.preventDefault(); inp.blur(); }
      if(e.key==="Escape"){ inp.value=moeda(ultimoResultado.linhas[Number(inp.dataset.idx)].valor); inp.blur(); }
    });
  });

  const filtro=$id("recFiltro");
  if(!filtro) return;
  const saida=$id("saida");
  const cont=$id("recFiltroCount");
  const recs=[...saida.querySelectorAll(".rec")];
  const grupos=[...saida.querySelectorAll(".rec-grupo-head")];
  const idxDe=rc=>Number(rc.dataset.rec);
  const nomeDe=rc=>chave(rc.querySelector(".rec-nome").textContent);
  let agrupado=true;

  const aplicarFiltro=()=>{
    const q=chave(filtro.value);
    let vis=0, somaVis=0;
    recs.forEach(rc=>{
      const mostrar=!q||rc.dataset.busca.includes(q);
      rc.style.display=mostrar?"":"none";
      if(mostrar){ vis++; somaVis+=r.linhas[idxDe(rc)].valor; }
    });
    grupos.forEach(g=>{
      if(!agrupado){ g.style.display="none"; return; }
      const nome=g.dataset.nome;
      const temVis=recs.some(rc=>nomeDe(rc)===nome && rc.style.display!=="none");
      g.style.display=temVis?"":"none";
    });
    cont.textContent = q ? `${vis} de ${recs.length} · R$ ${moeda(somaVis)}` : "";
  };
  filtro.addEventListener("input",aplicarFiltro);

  const sort=$id("recSort");
  sort.addEventListener("change",()=>{
    const modo=sort.value;
    agrupado=(modo==="orig");
    const arr=[...recs];
    if(modo==="nome")       arr.sort((a,b)=>nomeDe(a).localeCompare(nomeDe(b))||idxDe(a)-idxDe(b));
    else if(modo==="maior") arr.sort((a,b)=>r.linhas[idxDe(b)].valor-r.linhas[idxDe(a)].valor);
    else if(modo==="menor") arr.sort((a,b)=>r.linhas[idxDe(a)].valor-r.linhas[idxDe(b)].valor);
    else                    arr.sort((a,b)=>idxDe(a)-idxDe(b));

    if(agrupado){
      let prev=null;
      arr.forEach(rc=>{
        const nome=nomeDe(rc);
        if(nome!==prev){ const g=grupos.find(x=>x.dataset.nome===nome); if(g) saida.appendChild(g); prev=nome; }
        saida.appendChild(rc);
      });
    }else{
      grupos.forEach(g=>saida.appendChild(g));
      arr.forEach(rc=>saida.appendChild(rc));
    }
    aplicarFiltro();
  });

  $id("recExpandir").addEventListener("click",()=>{
    recs.forEach(rc=>{ if(rc.style.display==="none") return;
      rc.classList.add("open");
      rc.querySelector(".rec-toggle").setAttribute("aria-expanded","true");
      recordsAbertos.add(idxDe(rc)); });
  });
  $id("recRecolher").addEventListener("click",()=>{
    recs.forEach(rc=>{ rc.classList.remove("open");
      rc.querySelector(".rec-toggle").setAttribute("aria-expanded","false"); });
    recordsAbertos.clear();
  });
}

/* edição de valor sem redesenhar a tela inteira */
function editarValor(idx, textoDigitado, input){
  const l = ultimoResultado.linhas[idx];
  const campos = l.campos || ultimoMod.campos;
  const campoValor = campos.find(c=>c.principal) || campos.find(c=>/valor/i.test(c.nome));
  const antes = l.valor;

  try{
    const novoValor = paraNumero(textoDigitado);
    const novoTrecho = centavos(novoValor, campoValor.tam);
    if(Math.round(novoValor*100) !== Math.round(antes*100)) l.editado = true;
    l.texto = l.texto.slice(0, campoValor.ini-1) + novoTrecho + l.texto.slice(campoValor.ini-1+campoValor.tam);
    l.valor = novoValor;
    if(input) input.classList.remove("invalido");
  }catch(e){
    if(input){
      input.value = moeda(antes);
      input.classList.add("invalido");
      setTimeout(()=>input.classList.remove("invalido"), 1600);
    }
    flash("err", "Valor não aplicado", `${l.nome}: ${e.message}`);
    return;
  }

  if(input) input.value = moeda(l.valor);
  atualizarCartao(idx);
  atualizarTotais();
}

function atualizarCartao(idx){
  const l = ultimoResultado.linhas[idx];
  const campos = l.campos || ultimoMod.campos;
  const rec = root.querySelector(`.rec[data-rec="${idx}"]`);
  if(!rec) return;
  const fitas = rec.querySelectorAll(".fita-reg span");
  const celulas = rec.querySelectorAll("tbody td.val");
  campos.forEach((c,ci)=>{
    const trecho = l.texto.substr(c.ini-1,c.tam);
    if(fitas[ci]) fitas[ci].textContent = trecho;
    if(celulas[ci]) celulas[ci].textContent = trecho;
  });
  const chip = rec.querySelector(".chip-editado");
  if(chip) chip.hidden = !l.editado;
}

function atualizarTotais(){
  const linhas = ultimoResultado.linhas;
  const total = linhas.reduce((s,l)=>s+l.valor,0);
  const alvo = $id("totalValores");
  if(alvo) alvo.textContent = "R$ "+moeda(total);
  const ed = linhas.filter(l=>l.editado).length;
  const alvoEd = $id("totalEditados");
  if(alvoEd) alvoEd.textContent = ed;

  txtGerado = linhas.map(l=>l.texto).join("\r\n")+"\r\n";

  if(ultimoResultado.reconciliacao){
    ultimoResultado.reconciliacao = reconciliar(ultimoDp, linhas);
    const rec = ultimoResultado.reconciliacao;
    const painel = root.querySelector(".recon");
    if(painel && rec.esperado!==null){
      painel.className = "recon "+(rec.confere?"recon-ok":"recon-dif");
      painel.innerHTML = rec.confere
        ? `<span class="recon-tag">Confere</span><span class="recon-txt">A soma bate com o total esperado de <b>R$ ${moeda(rec.esperado)}</b>.</span>`
        : `<span class="recon-tag">Diferença</span><span class="recon-txt">Esperado <b>R$ ${moeda(rec.esperado)}</b>, gerado <b>R$ ${moeda(rec.soma)}</b> — ${rec.diferenca>0?"R$ "+moeda(rec.diferenca)+" a mais":"R$ "+moeda(Math.abs(rec.diferenca))+" a menos"}.</span>`;
    }
  }
}

function flash(cls, titulo, texto){
  api.toast(`${titulo}: ${texto}`);
}

/* ##################### gravação ##################### */
function paraBytesLatin1(txt){
  const bytes=new Uint8Array(txt.length);
  for(let i=0;i<txt.length;i++){
    const cp=txt.charCodeAt(i);
    bytes[i]= cp<256 ? cp : 63;
  }
  return bytes;
}

const CRC_TABLE=(()=>{
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    t[n]=c>>>0;
  }
  return t;
})();
function crc32(bytes){
  let crc=0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++) crc=CRC_TABLE[(crc^bytes[i])&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}
function concatUint8(arrays){
  let total=0; for(const a of arrays) total+=a.length;
  const out=new Uint8Array(total); let pos=0;
  for(const a of arrays){ out.set(a,pos); pos+=a.length; }
  return out;
}
function construirZip(arquivos){
  const u16=v=>new Uint8Array([v&0xFF,(v>>>8)&0xFF]);
  const u32=v=>new Uint8Array([v&0xFF,(v>>>8)&0xFF,(v>>>16)&0xFF,(v>>>24)&0xFF]);
  const d=new Date();
  const horaDos=((d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)))&0xFFFF;
  const dataDos=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  const partes=[], central=[];
  let offset=0;
  for(const {nome, bytes} of arquivos){
    const nomeBytes=new TextEncoder().encode(nome);
    const crc=crc32(bytes);
    const localOffset=offset;
    const local=concatUint8([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(horaDos), u16(dataDos),
      u32(crc), u32(bytes.length), u32(bytes.length),
      u16(nomeBytes.length), u16(0), nomeBytes, bytes,
    ]);
    partes.push(local); offset+=local.length;
    central.push(concatUint8([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(horaDos), u16(dataDos),
      u32(crc), u32(bytes.length), u32(bytes.length),
      u16(nomeBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(localOffset), nomeBytes,
    ]));
  }
  const centralStart=offset;
  const centralBlob=concatUint8(central);
  partes.push(centralBlob); offset+=centralBlob.length;
  const fim=concatUint8([
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(centralBlob.length), u32(centralStart), u16(0),
  ]);
  partes.push(fim);
  return concatUint8(partes);
}

function baixarBytes(bytes, nome, tipo){
  return api.salvar(bytes, nome, tipo||"application/octet-stream");
}

function baixar(){
  if(modoLote) return baixarLote();
  if(!txtGerado) return;
  const nome = nomeArquivoSaida(moduloAtivo, ultimoDp);
  baixarBytes(paraBytesLatin1(txtGerado), nome, "text/plain");
  registrar(ultimoDp, ultimoResultado, nome);
}

function baixarLote(){
  const arquivos=(ultimoLoteResultados||[]).filter(r=>r.ok)
    .map(r=>({nome:r.nomeArq, bytes:paraBytesLatin1(r.txt)}));
  if(!arquivos.length) return;
  arquivos.push({nome:"conferencia_lote.csv", bytes:paraBytesLatin1(csvLote())});
  const nomeZip = (moduloAtivo==="rpa"?"RPA":"Lancamentos")+"_lote.zip";
  baixarBytes(construirZip(arquivos), nomeZip, "application/zip");
  (ultimoLoteResultados||[]).filter(r=>r.ok).forEach(r=>registrar(r.dp, r.resultado, nomeZip));
}

/* ##################### relatório de conferência ##################### */
const csvCampo = v => {
  const s=String(v==null?"":v);
  return /[;"\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
};
function csvDe(cabecalho, linhas){
  return [cabecalho, ...linhas].map(l=>l.map(csvCampo).join(";")).join("\r\n")+"\r\n";
}

function csvConferencia(dp, resultado, origem){
  const cab=["Arquivo de origem","Empresa","Cód. empresa","Competência","Nome",
             "Código","Detalhe","Identificador","Linha da planilha","Valor","Editado","Registro gravado"];
  const comp=competenciaExibicao(dp.competencia);
  const emp=dp.empresaNome||"";
  const linhas=resultado.linhas.map(l=>[
    origem||"", emp, dp.empresa, comp, l.nome, l.codigo??"", l.detalhe||"", l.rotulo,
    l.linhaPlanilha??"", moeda(l.valor), l.editado?"sim":"", l.texto,
  ]);
  const soma=resultado.linhas.reduce((s,l)=>s+l.valor,0);
  linhas.push([]);
  linhas.push(["","","","","TOTAL","","","",resultado.linhas.length, moeda(soma),"",""]);
  if(resultado.reconciliacao && resultado.reconciliacao.esperado!==null){
    const rc=resultado.reconciliacao;
    linhas.push(["","","","","TOTAL ESPERADO","","","","", moeda(rc.esperado),"",""]);
    linhas.push(["","","","","DIFERENÇA","","","","", moeda(rc.diferenca), rc.confere?"confere":"conferir",""]);
  }
  return csvDe(cab, linhas);
}

function csvLote(){
  const cab=["Arquivo de origem","Empresa","Cód. empresa","Competência","Nome",
             "Código","Detalhe","Identificador","Linha da planilha","Valor","Editado","Registro gravado"];
  const linhas=[];
  let somaGeral=0;
  (ultimoLoteResultados||[]).filter(r=>r.ok).forEach(r=>{
    const comp=competenciaExibicao(r.dp.competencia);
    r.resultado.linhas.forEach(l=>{
      somaGeral+=l.valor;
      linhas.push([r.nome, r.dp.empresaNome||"", r.dp.empresa, comp, l.nome, l.codigo??"",
                   l.detalhe||"", l.rotulo, l.linhaPlanilha??"", moeda(l.valor), l.editado?"sim":"", l.texto]);
    });
  });
  const qtd = linhas.length;
  linhas.push([]);
  linhas.push(["","","","","TOTAL DO LOTE","","","", qtd, moeda(somaGeral),"",""]);
  return csvDe(cab, linhas);
}

function baixarRelatorio(){
  if(modoLote){
    if(!ultimoLoteResultados) return;
    baixarBytes(paraBytesLatin1(csvLote()),
      `Conferencia_${moduloAtivo==="rpa"?"RPA":"Lancamentos"}_lote.csv`, "text/csv");
  }else{
    if(!ultimoResultado||!ultimoDp) return;
    const base=nomeArquivoSaida(moduloAtivo, ultimoDp).replace(/\.txt$/,"");
    baixarBytes(paraBytesLatin1(csvConferencia(ultimoDp, ultimoResultado, "")),
      `Conferencia_${base}.csv`, "text/csv");
  }
  const b=$id("btnRelatorio");
  const t=b.textContent; b.textContent="Relatório baixado ✓";
  setTimeout(()=>{b.textContent=t;},1600);
}

function nomeArquivoSaida(modulo, dp){
  const prefixo = modulo==="rpa" ? "RPA" : "Lancamentos";
  if(!dp) return `${prefixo}.txt`;
  const nomeBase = sanitizarNomeArquivo(dp.empresaNome || ("empresa"+dp.empresa));
  let comp = "";
  try{ comp = "_"+competenciaAAAAMM(dp.competencia); }catch(e){}
  return `${prefixo}_${nomeBase}${comp}.txt`;
}

/* ##################### troca de módulo ##################### */
function renderLeiaute(campos){
  const alvo=$id("leiaute");
  if(!alvo) return;
  const tam=campos.reduce((s,c)=>Math.max(s,c.ini+c.tam-1),0);
  alvo.innerHTML = campos.map(c=>
    `<span class="fita-seg" style="--n:${c.tam}" title="${escapar(c.nome)} — posição ${c.ini} a ${c.ini+c.tam-1}">`+
    `<i>${c.ini}</i><u>${escapar(c.curto||c.nome)}</u></span>`).join("");
  $id("leiauteTam").textContent = `${tam} caracteres por linha`;
}

function trocarModulo(nome){
  moduloAtivo=nome;
  try{ localStorage.setItem("dominio_modulo", nome); }catch(e){}
  const mod=MODULOS[nome];
  root.classList.toggle("m-rpa", nome==="rpa"); root.classList.toggle("m-lancamentos", nome!=="rpa");
  renderLeiaute(mod.campos);
  $id("tabRpa").classList.toggle("active", nome==="rpa");
  $id("tabRpa").setAttribute("aria-selected", nome==="rpa");
  $id("tabLanc").classList.toggle("active", nome==="lancamentos");
  $id("tabLanc").setAttribute("aria-selected", nome==="lancamentos");
  $id("dropTitulo").textContent=mod.dropTitulo;
  $id("dropHint").innerHTML=mod.dropHint;
  $id("btnModelo").textContent=`Baixar modelo de ${mod.rotulo}`;
  limparPlanilha();
  renderEmpInfo();
}

function atualizarBotaoGerar(){
  $id("btnGerar").disabled = modoLote ? arquivosLote.length===0 : !dadosDePara;
  $id("btnBaixar").textContent = modoLote ? "Baixar tudo (.zip)" : "Baixar .txt";
  const c=$id("btnCopiar");
  if(c){ c.disabled = modoLote || !txtGerado; c.hidden = modoLote; }
}

function mostrarLimpar(v){
  const b=$id("btnLimpar");
  if(b) b.hidden=!v;
}

function limparPlanilha(){
  dadosDePara=null; txtGerado=null; ultimoDp=null;
  modoLote=false; arquivosLote=[]; ultimoLoteResultados=null;
  ultimoResultado=null; recordsAbertos=new Set(); geradoEm=null;
  $id("fileDePara").textContent="";
  $id("dropDePara").classList.remove("ok");
  $id("avisos").innerHTML="";
  $id("saida").innerHTML="";
  $id("status").textContent="";
  $id("btnGerar").disabled=true;
  $id("btnBaixar").disabled=true;
  const br=$id("btnRelatorio"); if(br) br.disabled=true;
  const bv=$id("btnVoltarLote"); if(bv) bv.hidden=true;
  const inp=$id("inDePara"); if(inp) inp.value="";
  mostrarLimpar(false);
  atualizarBotaoGerar();
}

function copiarTexto(){
  if(modoLote||!txtGerado) return;
  const b=$id("btnCopiar");
  const done=ok=>{ b.textContent=ok?"Copiado ✓":"Copiar falhou"; setTimeout(()=>{b.textContent="Copiar texto";},1600); };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txtGerado).then(()=>done(true),()=>done(false));
  }else{
    try{
      const ta=document.createElement("textarea"); ta.value=txtGerado;
      ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove(); done(true);
    }catch(e){ done(false); }
  }
}
/* ##################### integração com o Control Hub ##################### */
let empSel = null;       /* empresa escolhida na lista do DP (id) */
let modalEmp = null;     /* empresa a que o menu de conferência se refere (id) */

const empresaAtual = () => empSel ? api.empresa(empSel) : null;
const codEmp = e => soDigitos(e && e.codigoDominio);

/* competência sugerida: o mês anterior, que é a folha em fechamento */
function compSugerida(){
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
  return `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

/* --- seletor de empresa (mesmo padrão do campo Responsável do Hub) --- */
const empInp = $id("emp"), empBox = $id("empLista");
let empOps = [], empOn = -1;

function listaEmpresas(q){
  const k = chave(q), dig = soDigitos(q);
  return api.empresas().filter(e => !k ||
    chave(e.nome).includes(k) ||
    (dig.length>=2 && (soDigitos(e.cnpj).includes(dig) || codEmp(e)===dig || soDigitos(e.cod)===dig)));
}
function renderEmpLista(q){
  empOps = listaEmpresas(q).slice(0, 80);
  empOn = -1;
  if(!empOps.length){ empBox.innerHTML = `<div class="cb-vazio">Nenhuma empresa com esse texto.</div>`; return; }
  let grupo = null, html = "";
  empOps.forEach((e,i)=>{
    const g = e.daCarteira ? "c" : "o";
    if(api.temCarteira() && g!==grupo){
      grupo = g;
      html += `<div class="imp-emp-grupo">${g==="c" ? "Sua carteira" : "Outras empresas"}</div>`;
    }
    const cod = codEmp(e);
    html += `<div class="cb-op${empSel===e.id?" sel":""}" role="option" data-emp-op="${i}">`+
      `<span class="imp-emp-nome">${api.nomeEmpHtml(e)}</span>`+
      `<span class="imp-emp-sub">${cod ? "Domínio "+escapar(cod) : "sem código Domínio"}${e.responsavel?" · "+escapar(e.responsavel):""}</span></div>`;
  });
  empBox.innerHTML = html;
}
function abrirEmpLista(){ renderEmpLista(empSel ? "" : empInp.value); empBox.hidden = false; empInp.setAttribute("aria-expanded","true"); }
function fecharEmpLista(){ empBox.hidden = true; empInp.setAttribute("aria-expanded","false"); }

function selecionarEmpresa(id, silencioso){
  empSel = id || null;
  const e = empresaAtual();
  empInp.value = e ? e.nome : "";
  fecharEmpLista();
  renderEmpInfo();
  if(e && !silencioso && !codEmp(e))
    api.toast(`${e.nome} está sem código Domínio no cadastro.`);
}

function renderEmpInfo(){
  const alvo = $id("empInfo");
  const e = empresaAtual();
  if(!e){
    if(empSel){ empSel = null; empInp.value = ""; }
    alvo.innerHTML = `<span class="imp-sub">Sem empresa escolhida, o modelo sai em branco — como no gerador original.</span>`;
    return;
  }
  const cod = codEmp(e);
  const rub = e.rubricas.filter(r=>soDigitos(r.rubrica)).length;
  const aut = e.rpa.filter(r=>r.nome).length;
  const fun = e.funcionarios.filter(f=>f.nome && f.status!=="Desligado");
  const funCod = fun.filter(f=>soDigitos(f.codigo)).length;
  const cad = moduloAtivo==="rpa"
    ? `${aut} autônomo${aut===1?"":"s"} no cadastro`
    : `${rub} rubrica${rub===1?"":"s"} · ${fun.length} funcionário${fun.length===1?"":"s"}${fun.length?` (${funCod} com código)`:""}`;
  alvo.innerHTML =
    (cod ? `<span>Código no Domínio <b>${escapar(cod)}</b></span>`
         : `<span class="imp-falta">Sem código Domínio no cadastro</span>`)+
    `<span>Competência sugerida <b>${compSugerida()}</b></span>`+
    `<span>${cad}</span>`+
    `<button type="button" class="linkish" id="imp-empCad">${cod?"Abrir cadastro":"Completar no cadastro"}</button>`+
    `<button type="button" class="linkish imp-link-sutil" id="imp-empLimpar">Trocar</button>`;
  $id("empCad").addEventListener("click", ()=>api.abrirEmpresa(e.id));
  $id("empLimpar").addEventListener("click", ()=>{ selecionarEmpresa(null); empInp.focus(); abrirEmpLista(); });
}

empInp.addEventListener("focus", abrirEmpLista);
empInp.addEventListener("input", ()=>{ if(empSel){ empSel=null; renderEmpInfo(); } renderEmpLista(empInp.value); empBox.hidden=false; });
empInp.addEventListener("keydown", e=>{
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault(); if(empBox.hidden) abrirEmpLista();
    const ops = [...empBox.querySelectorAll("[data-emp-op]")];
    if(!ops.length) return;
    empOn = (empOn + (e.key==="ArrowDown"?1:-1) + ops.length) % ops.length;
    ops.forEach((o,i)=>o.classList.toggle("on", i===empOn));
    ops[empOn].scrollIntoView({block:"nearest"});
  }else if(e.key==="Enter" && !empBox.hidden){
    e.preventDefault();
    const i = empOn>=0 ? empOn : (empOps.length===1 ? 0 : -1);
    if(i>=0) selecionarEmpresa(empOps[i].id);
  }else if(e.key==="Escape" && !empBox.hidden){ e.stopPropagation(); fecharEmpLista(); }
});
empInp.addEventListener("blur", ()=>setTimeout(()=>{
  if(root.contains(document.activeElement) && empBox.contains(document.activeElement)) return;
  fecharEmpLista();
  const e = empresaAtual(); empInp.value = e ? e.nome : "";
}, 150));
$id("empBtn").addEventListener("mousedown", e=>{ e.preventDefault(); if(empBox.hidden){ empInp.focus(); abrirEmpLista(); } else fecharEmpLista(); });
empBox.addEventListener("mousedown", e=>{
  const op = e.target.closest("[data-emp-op]");
  e.preventDefault();
  if(op) selecionarEmpresa(empOps[Number(op.dataset.empOp)].id);
});

/* --- modelo: com empresa escolhida, sai do cadastro e passa pela conferência --- */
function baixarModelo(){
  const e = empresaAtual();
  if(!e) return baixarModeloEmBranco();
  const comp = compSugerida();
  const base = {empresa:e.nome, cnpj:e.cnpj, competencia:comp, paginas:0, daCadastro:true};
  if(moduloAtivo==="rpa"){
    const autonomos = e.rpa.filter(r=>r.nome).map(r=>({
      nome:r.nome, codigo:soDigitos(r.codigo).slice(0,10), cpf:r.cpf||"",
      cpfValido: r.cpf ? cpfValido(r.cpf) : null, valor:null, numeroRecibo:"",
      descricao:"", marcado:true,
    }));
    if(!autonomos.length){
      baixarModeloEmBranco({empresa:e.nome, codigo:codEmp(e), competencia:comp});
      api.toast("Nenhum autônomo no cadastro desta empresa — o modelo saiu só com os parâmetros.");
      return;
    }
    const semCod = autonomos.filter(a=>!a.codigo).length;
    abrirMenuContracheque(Object.assign(base, {dataPagamento:"", autonomos,
      avisos: semCod ? [`${semCod} autônomo(s) sem código Domínio no cadastro — preencha aqui; ao gerar, ofereço gravar no cadastro.`] : []}),
      `Cadastro de ${e.nome}`, "rpa");
    return;
  }
  const empregados = e.funcionarios.filter(f=>f.nome && f.status!=="Desligado").map(f=>({
    codigo:soDigitos(f.codigo).slice(0,10), codigoOriginal:"cad-"+f.id, nome:f.nome, funcao:f.cargo||"", marcado:true,
  }));
  const vistos = new Set();
  const rubricas = e.rubricas.map(r=>({cod:soDigitos(r.rubrica), desc:String(r.descricao||"").trim()}))
    .filter(r=>/^\d{1,9}$/.test(r.cod) && !vistos.has(r.cod) && vistos.add(r.cod))
    .map(r=>({codigo:Number(r.cod), descricao:r.desc||`Rubrica ${r.cod}`, tipo:"variavel",
      qtdEmpregados:0, ocorrencias:0, porEmpregado:{}, variaValor:false, emTodos:false,
      marcada:true, daCadastro:true}))
    .sort((a,b)=>a.codigo-b.codigo);
  if(!empregados.length && !rubricas.length){
    baixarModeloEmBranco({empresa:e.nome, codigo:codEmp(e), competencia:comp});
    api.toast("Cadastro sem funcionários e rubricas — o modelo saiu só com os parâmetros.");
    return;
  }
  const avisos = [];
  const semCod = empregados.filter(p=>!p.codigo).length;
  if(semCod) avisos.push(`${semCod} funcionário(s) sem código Domínio no cadastro — preencha aqui; ao gerar, ofereço gravar no cadastro.`);
  if(!rubricas.length) avisos.push("Nenhuma rubrica com código no cadastro (aba Folha) — cadastre abaixo as que vão virar coluna.");
  abrirMenuContracheque(Object.assign(base, {empregados, rubricas, rubricasDescartadas:[], avisos}),
    `Cadastro de ${e.nome}`, "lancamentos");
}

/* --- documento lido: casa empresa e códigos com o cadastro --- */
function integrarDocumento(dados, rpa){
  /* modelo vindo do cadastro não tem valores para trazer */
  $id("linhaValores").hidden = !!dados.daCadastro;
  let e = empresaAtual();
  if(!e && dados.cnpj){
    e = api.empresaPorCnpj(dados.cnpj);
    if(e) selecionarEmpresa(e.id, true);
  }
  modalEmp = e ? e.id : null;
  if(!e) return;
  $cp("cpEmpresa").value = e.nome;
  $cp("cpCodigo").value = codEmp(e);
  if(!$cp("cpComp").value){
    $cp("cpComp").value = compSugerida();
    if(rpa) $cp("cpData").value = ultimoDiaDaCompetencia(compSugerida());
  }
  /* quem veio sem código ganha o do cadastro (por CPF ou nome) */
  const lista = rpa ? (dados.autonomos||[]) : (dados.empregados||[]);
  const base = rpa ? e.rpa : e.funcionarios;
  let n = 0;
  lista.forEach(p=>{
    if(!vazio(p.codigo)) return;
    const cpf = soDigitos(p.cpf);
    const r = (cpf && base.find(x=>soDigitos(x.cpf)===cpf)) || base.find(x=>chave(x.nome)===chave(p.nome));
    if(r && soDigitos(r.codigo)){ p.codigo = soDigitos(r.codigo).slice(0,10); n++; }
  });
  if(n && !dados.daCadastro)
    dados.avisos = dados.avisos.concat([`${n} código(s) de ${rpa?"autônomo":"empregado"} vieram do cadastro de ${e.nome}.`]);
}

/* --- depois do modelo montado: grava no cadastro o que é novo --- */
let cadItens = [];
function oferecerCadastro(dados, rpa){
  const e = modalEmp ? api.empresa(modalEmp) : null;
  if(!e || api.somenteLeitura()) return;
  const itens = [];
  const cod = soDigitos(dados.codigo);
  if(cod && cod!==codEmp(e))
    itens.push({tipo:"empresa", valor:cod, marcado:!codEmp(e),
      rotulo:`Código Domínio da empresa: ${codEmp(e)||"vazio"} → <b>${escapar(cod)}</b>`});
  if(!rpa){
    const tem = new Set(e.rubricas.map(r=>soDigitos(r.rubrica)));
    (dados.rubricas||[]).forEach(r=>{
      if(tem.has(String(r.codigo))) return;
      itens.push({tipo:"rubrica", marcado:true, dado:{rubrica:String(r.codigo), descricao:r.descricao},
        rotulo:`Rubrica <b>${r.codigo}</b> · ${escapar(r.descricao)}`});
    });
  }
  const pessoas = rpa ? (dados.contribuintes||[]) : (dados.empregados||[]);
  const base = rpa ? e.rpa : e.funcionarios;
  const chaveSec = rpa ? "rpa" : "funcionarios";
  pessoas.forEach(p=>{
    const c = soDigitos(p.codigo);
    if(!c) return;
    const cpf = soDigitos(p.cpf);
    const r = base.find(x=>chave(x.nome)===chave(p.nome)) || (cpf && base.find(x=>soDigitos(x.cpf)===cpf));
    if(r){
      const mud = {};
      if(soDigitos(r.codigo)!==c) mud.codigo = c;
      if(rpa && cpf.length===11 && !soDigitos(r.cpf)) mud.cpf = formatarCpf(cpf);
      if(!Object.keys(mud).length) return;
      itens.push({tipo:chaveSec, id:r.id, mud, marcado:!soDigitos(r.codigo),
        rotulo:`${escapar(p.nome)}: ${mud.codigo ? `código ${escapar(r.codigo||"vazio")} → <b>${c}</b>` : ""}${mud.codigo&&mud.cpf?" · ":""}${mud.cpf?`CPF <b>${mud.cpf}</b>`:""}`});
    }else{
      const novo = rpa
        ? {nome:p.nome, codigo:c, cpf:cpf.length===11?formatarCpf(cpf):"", tipo:"Autônomo"}
        : {nome:p.nome, codigo:c, cargo:p.funcao||"", status:"Ativo"};
      itens.push({tipo:chaveSec, novo, marcado:true,
        rotulo:`${escapar(p.nome)} · código <b>${c}</b> <span class="imp-novo">novo no cadastro</span>`});
    }
  });
  if(!itens.length) return;
  cadItens = itens;
  const GRUPOS = [["empresa","Empresa"],["rubrica","Rubricas (aba Folha)"],["rpa","RPA / Autônomos"],["funcionarios","Funcionários"]];
  $id("cadEmp").innerHTML = api.nomeEmpHtml(e);
  $id("cadLista").innerHTML = GRUPOS.map(([t,tit])=>{
    const doGrupo = itens.map((it,i)=>[it,i]).filter(([it])=>it.tipo===t);
    if(!doGrupo.length) return "";
    return `<h4>${tit} <span class="imp-conta">${doGrupo.length}</span></h4>`+
      doGrupo.map(([it,i])=>`<label class="imp-item${it.marcado?" marcado":""}"><input type="checkbox" data-cad="${i}"${it.marcado?" checked":""}><span>${it.rotulo}</span></label>`).join("");
  }).join("");
  contarCad();
  dlgCad.showModal();
}
function contarCad(){
  const n = cadItens.filter(i=>i.marcado).length;
  $id("cadResumo").textContent = `${n} de ${cadItens.length} marcado${cadItens.length===1?"":"s"}`;
  $id("cadOk").disabled = !n;
}
$id("cadLista").addEventListener("change", e=>{
  const cb = e.target.closest("[data-cad]");
  if(!cb) return;
  cadItens[Number(cb.dataset.cad)].marcado = cb.checked;
  cb.closest(".imp-item").classList.toggle("marcado", cb.checked);
  contarCad();
});
$id("cadOk").addEventListener("click", async ()=>{
  const marcados = cadItens.filter(i=>i.marcado);
  dlgCad.close();
  if(marcados.length && modalEmp) await api.atualizarCadastro(modalEmp, marcados);
  renderEmpInfo();
});
$id("cadNao").addEventListener("click", ()=>dlgCad.close());
$id("cadFechar").addEventListener("click", ()=>dlgCad.close());

/* --- planilha carregada: nome da empresa vem do cadastro pelo código --- */
function completarEmpresa(dp){
  const e = api.empresaPorCodigo(dp.empresa);
  if(!e) return;
  dp._empId = e.id;
  if(vazio(dp.empresaNome)) dp.empresaNome = e.nome;
}

/* --- registro da equipe: cada arquivo baixado --- */
function registrar(dp, resultado, arquivo){
  if(!dp || !resultado || !resultado.linhas.length) return;
  let comp = "";
  try{ const a = competenciaAAAAMM(dp.competencia); comp = a.slice(4,6)+"/"+a.slice(0,4); }catch(e){ comp = String(dp.competencia||""); }
  api.registrar({
    modulo: moduloAtivo,
    empId: dp._empId || "",
    empresaCod: String(dp.empresa==null?"":dp.empresa),
    empresaNome: dp.empresaNome ? String(dp.empresaNome) : "",
    competencia: comp,
    tipo: moduloAtivo==="lancamentos" ? String(dp.tipoProcesso==null?"":dp.tipoProcesso) : "",
    linhas: resultado.linhas.length,
    pessoas: new Set(resultado.linhas.map(l=>String(l.codigo))).size,
    total: Math.round(resultado.linhas.reduce((s,l)=>s+l.valor,0)*100)/100,
    arquivo,
  });
}

/* ##################### ligações ##################### */
const visivel = () => root.isConnected && root.offsetParent !== null;
const outroDialogo = () => [...document.querySelectorAll("dialog[open]")].some(d=>d!==dlgContra && d!==dlgCad);

const drop=$id("dropDePara"), input=$id("inDePara"), alvoArq=$id("fileDePara");
const overlay=$id("dragOverlay");
let dragDepth=0;
const abrirArq=()=>input.click();
drop.addEventListener("click",abrirArq);
drop.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault();abrirArq();} });
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add("over"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop",e=>{
  e.stopPropagation(); dragDepth=0; overlay.hidden=true;
  if(e.dataTransfer.files.length) processar(e.dataTransfer.files);
});
input.addEventListener("change",e=>{ if(e.target.files.length) processar(e.target.files); });

async function lerPlanilha(file){
  return XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array",cellDates:true});
}

async function processar(fileList){
  const todos=[...fileList];
  const contra=todos.find(f=>/\.(pdf|txt)$/i.test(f.name));
  const arquivos=todos.filter(f=>/\.(xlsx|xlsm|xls)$/i.test(f.name));
  if(!arquivos.length && contra){ lerContracheque(contra); return; }
  if(!arquivos.length){
    erro("solte uma planilha .xlsx ou um contracheque .pdf — foi outro tipo de arquivo que chegou aqui");
    return;
  }
  $id("status").textContent = arquivos.length===1 ? "lendo a planilha…" : `lendo ${arquivos.length} planilhas…`;
  try{ await api.carregarXlsx(); }
  catch(e){ $id("status").textContent=""; erro(e.message); return; }
  $id("btnVoltarLote").hidden=true;
  if(arquivos.length===1){
    modoLote=false;
    const file=arquivos[0];
    try{
      dadosDePara=await lerPlanilha(file);
      alvoArq.textContent=file.name;
      drop.classList.add("ok");
      mostrarLimpar(true);
      atualizarBotaoGerar();
      gerar();
    }catch(err){ erro(`não consegui ler "${file.name}": ${err.message}`); }
    return;
  }
  modoLote=true;
  dadosDePara=null;
  arquivosLote=[];
  for(const file of arquivos){
    try{ arquivosLote.push({nome:file.name, wb:await lerPlanilha(file)}); }
    catch(err){ arquivosLote.push({nome:file.name, wb:null, erroLeitura:err.message}); }
  }
  alvoArq.textContent = `${arquivosLote.length} planilhas · `+arquivosLote.map(a=>a.nome).join(", ");
  drop.classList.add("ok");
  mostrarLimpar(true);
  atualizarBotaoGerar();
  gerar();
}

$id("btnGerar").addEventListener("click",gerar);
$id("btnBaixar").addEventListener("click",baixar);
$id("btnCopiar").addEventListener("click",copiarTexto);
$id("btnLimpar").addEventListener("click",limparPlanilha);
$id("btnModelo").addEventListener("click",baixarModelo);
$id("btnRelatorio").addEventListener("click",baixarRelatorio);
$id("btnVoltarLote").addEventListener("click",voltarAoLote);
$id("tabRpa").addEventListener("click",()=>trocarModulo("rpa"));
$id("tabLanc").addEventListener("click",()=>trocarModulo("lancamentos"));

/* ---- documento do Domínio ---- */
const cardContra=$id("cardContra"), inContra=$id("inContra");
$id("btnContra").addEventListener("click",e=>{ e.stopPropagation(); inContra.click(); });
inContra.addEventListener("change",e=>{
  if(e.target.files.length) lerContracheque(e.target.files[0]);
  e.target.value="";
});
["dragenter","dragover"].forEach(ev=>cardContra.addEventListener(ev,e=>{ e.preventDefault(); cardContra.classList.add("over"); }));
["dragleave","drop"].forEach(ev=>cardContra.addEventListener(ev,e=>{
  if(ev==="dragleave" && cardContra.contains(e.relatedTarget)) return;
  e.preventDefault(); cardContra.classList.remove("over");
}));
cardContra.addEventListener("drop",e=>{
  e.stopPropagation(); dragDepth=0; overlay.hidden=true;
  const f=[...e.dataTransfer.files].find(x=>/\.(pdf|txt)$/i.test(x.name));
  if(f) lerContracheque(f);
  else erro("o leitor de documento aceita .pdf ou .txt — a planilha vai no passo 2");
});
$id("btnColar").addEventListener("click",lerContrachequeTexto);

/* ---- menu de conferência ---- */
$id("cpFechar").addEventListener("click",fecharMenuContracheque);
$id("cpCancelar").addEventListener("click",fecharMenuContracheque);
$id("cpGerar").addEventListener("click",gerarModeloDoContracheque);
$id("cpAdicionar").addEventListener("click",adicionarRubricaManual);
$id("cpTrazerValores").addEventListener("change",alternarValoresRpa);
$id("cpTipo").addEventListener("input",nomeDoTipo);
$id("cpBuscaRub").addEventListener("input",filtrarRubricas);
$id("cpBuscaPes").addEventListener("input",filtrarPessoas);
$id("cpData").addEventListener("input",function(){ dataEditadaAMao = true; mascararData(this); });
$id("cpComp").addEventListener("input",function(){ mascararCompetencia(this); sugerirDataPagamento(false); });
$id("cpTipoEditar").addEventListener("click",()=>{
  if(api.somenteLeitura()){ api.toast("Você não tem permissão para editar a lista da equipe."); return; }
  const ed=$id("cpTipoEditor");
  ed.hidden=!ed.hidden;
  if(!ed.hidden) $id("cpTipoTexto").focus();
});
$id("cpTipoSalvar").addEventListener("click",salvarListaDeTipos);
renderTiposProcesso();
$id("cpNovoDesc").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); adicionarRubricaManual(); } });
dlgContra.querySelectorAll("[data-todos],[data-nenhum]").forEach(b=>{
  b.addEventListener("click",()=>{
    if(!contraDados) return;
    const marcar=b.hasAttribute("data-todos");
    const qual=b.dataset.todos||b.dataset.nenhum;
    if(qual==="rub"){ contraDados.rubricas.forEach(r=>r.marcada=marcar); renderListaRubricas(); }
    else{ listaAtual().forEach(x=>x.marcado=marcar); renderListaPessoas(); }
  });
});

function aoTeclar(e){
  if(dlgContra.open){
    if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){ e.preventDefault(); gerarModeloDoContracheque(); }
    return;
  }
  if(!visivel() || dlgCad.open || outroDialogo()) return;
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){
    const b=$id("btnGerar");
    if(b&&!b.disabled){ e.preventDefault(); gerar(); }
  }
  if((e.ctrlKey||e.metaKey)&&(e.key==="s"||e.key==="S")){
    const b=$id("btnBaixar");
    if(b&&!b.disabled){ e.preventDefault(); baixar(); }
  }
}
const temArquivos = e => e.dataTransfer && [...e.dataTransfer.types].indexOf("Files")>=0;
function aoArrastarEntrar(e){
  if(!visivel() || outroDialogo() || dlgContra.open || !temArquivos(e)) return;
  e.preventDefault(); dragDepth++; overlay.hidden=false;
}
function aoArrastarSobre(e){
  if(overlay.hidden) return;
  e.preventDefault(); e.dataTransfer.dropEffect="copy";
}
function aoArrastarSair(){
  if(overlay.hidden) return;
  dragDepth=Math.max(0,dragDepth-1); if(dragDepth===0) overlay.hidden=true;
}
function aoSoltar(e){
  const mostrava = !overlay.hidden;
  dragDepth=0; overlay.hidden=true;
  if(!mostrava || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); processar(e.dataTransfer.files);
}
document.addEventListener("keydown",aoTeclar);
window.addEventListener("dragenter",aoArrastarEntrar);
window.addEventListener("dragover",aoArrastarSobre);
window.addEventListener("dragleave",aoArrastarSair);
window.addEventListener("drop",aoSoltar);

let inicial="rpa";
try{ const s=localStorage.getItem("dominio_modulo"); if(s==="rpa"||s==="lancamentos") inicial=s; }catch(e){}
trocarModulo(inicial);
renderEmpInfo();

return {
  /* chamado pelo Hub quando os dados mudam (cadastro, tipos de processo) */
  atualizar(){
    renderEmpInfo();
    if(!empBox.hidden) renderEmpLista(empSel ? "" : empInp.value);
    if(!dlgContra.open) renderTiposProcesso();
  },
  escolherEmpresa(id){ selecionarEmpresa(id, true); },
};
}

window.HubImportador = { montar };
})();
