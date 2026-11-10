/* Control Hub · gerador de planilhas (.xlsx) com o visual do Hub.
 * Sem bibliotecas de fora: monta o SpreadsheetML (estilos, células, mesclas, filtros, barras de dados), os gráficos NATIVOS do Excel
 * (DrawingML: colunas, barras, linhas e rosca, ligados às células da aba "Base dos gráficos") e o zip (sem compressão).
 * Uso: HubPlanilha.gerar(spec) → Uint8Array. spec = { titulo, subtitulo, modulo, kpis:[{v,l,s,tom}], graficos:[{titulo,tipo,cats,series:[{nome,vals,cor}],formato}],
 *      tabela:{ titulo, cab, linhas, total, num, pct, sinal, datas, barras }, filtros:[[rótulo, valor]], notas:[texto] }.
 * Abas: Resumo (até 4 indicadores e 2 gráficos, com link para a lista), Dados (a lista inteira, com filtro e link de volta) e Base (oculta: os números dos gráficos). */
(function (raiz) {
  'use strict';
  const COR = { escuro: '0E151B', escuro2: '182229', vermelho: 'C2000C', vermelhoClaro: 'E11520', azul: '3C659B', azulMedio: '6BAAC9', azulClaro: 'DCE8F1',
    tinta: '101820', tinta2: '47545F', tinta3: '5F6D77', linha: 'D8E2EC', fundo: 'F4F8FC', fundo2: 'E6EEF6', branco: 'FFFFFF', verde: '167A45', ambar: 'B5530C', cinza: '8FA0AD', marcaAzul: '7FC2DE' };
  // séries: azul do Hub, verde (entradas), vermelho (saídas), azul médio, âmbar, roxo, cinza-azulado
  const PALETA = ['3C659B', '167A45', 'C2000C', '6BAAC9', 'B5530C', '6250D6', '5F6D77', '1BAF7A', 'E34948', '2A78D6'];
  const TOM = { up: COR.verde, ad: COR.verde, down: COR.vermelho, de: COR.vermelho, '': COR.azul };
  const FONTE = 'Calibri';

  // ---------- utilidades ----------
  const xml = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const letra = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };   // 0 → A
  const ref = (r, c) => letra(c) + (r + 1);                                                                                                      // 0-based
  const absRef = (aba, r1, c1, r2, c2) => `'${String(aba).replace(/'/g, "''")}'!$${letra(c1)}$${r1 + 1}` + (r2 == null ? '' : `:$${letra(c2)}$${r2 + 1}`);
  const serial = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5;
  const nomeAba = (s) => String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

  // ---------- estilos (deduplicados) ----------
  function Estilos() {
    const fontes = ['<font><sz val="10"/><color rgb="FF101820"/><name val="' + FONTE + '"/><family val="2"/></font>'];
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const fmts = []; const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const idx = (lista, x) => { let i = lista.indexOf(x); if (i < 0) { lista.push(x); i = lista.length - 1; } return i; };
    const cache = new Map();
    const FMT_FIXO = { 'General': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10 };
    return {
      id(o) {
        if (!o) return 0;
        const k = JSON.stringify(o); if (cache.has(k)) return cache.get(k);
        const f = o.fonte || {};
        const fonte = `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}${f.u ? '<u/>' : ''}<sz val="${f.sz || 10}"/><color rgb="FF${f.cor || COR.tinta}"/><name val="${f.nome || FONTE}"/><family val="2"/></font>`;
        const fill = o.fundo ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${o.fundo}"/><bgColor indexed="64"/></patternFill></fill>` : null;
        const b = o.borda || {}, lado = (n) => b[n] ? `<${n} style="${b[n][1] || 'thin'}"><color rgb="FF${b[n][0]}"/></${n}>` : `<${n}/>`;
        const borda = o.borda ? `<border>${lado('left')}${lado('right')}${lado('top')}${lado('bottom')}<diagonal/></border>` : null;
        let numFmtId = 0;
        if (o.fmt) { if (o.fmt in FMT_FIXO) numFmtId = FMT_FIXO[o.fmt]; else { let i = fmts.indexOf(o.fmt); if (i < 0) { fmts.push(o.fmt); i = fmts.length - 1; } numFmtId = 164 + i; } }
        const a = o.al || {}, al = (a.h || a.v || a.wrap || a.ind) ? `<alignment${a.h ? ` horizontal="${a.h}"` : ''} vertical="${a.v || 'center'}"${a.wrap ? ' wrapText="1"' : ''}${a.ind ? ` indent="${a.ind}"` : ''}/>` : '<alignment vertical="center"/>';
        const x = `<xf numFmtId="${numFmtId}" fontId="${idx(fontes, fonte)}" fillId="${fill ? idx(fills, fill) : 0}" borderId="${borda ? idx(bordas, borda) : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1">${al}</xf>`;
        const i = idx(xfs, x); cache.set(k, i); return i;
      },
      xml() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          (fmts.length ? `<numFmts count="${fmts.length}">${fmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xml(f)}"/>`).join('')}</numFmts>` : '') +
          `<fonts count="${fontes.length}">${fontes.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${bordas.length}">${bordas.join('')}</borders>` +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0"/></styleSheet>`;
      },
    };
  }

  // ---------- aba ----------
  function Folha(nome, est) {
    const linhas = new Map();      // r → Map(c → {v, s})
    const f = { nome: nomeAba(nome), merges: [], larg: {}, alt: {}, graficos: [], barras: [], freeze: null, filtro: null, cor: null, maxC: 0, maxR: 0, zoom: null, links: [], oculta: false,
      set(r, c, v, st) { if (!linhas.has(r)) linhas.set(r, new Map()); linhas.get(r).set(c, { v, s: est.id(st) }); f.maxC = Math.max(f.maxC, c); f.maxR = Math.max(f.maxR, r); },
      // mescla e pinta o bloco inteiro (as bordas e o fundo aparecem em todas as células do bloco)
      bloco(r1, c1, r2, c2, v, st) { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) f.set(r, c, r === r1 && c === c1 ? v : null, st); if (r2 > r1 || c2 > c1) f.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`); },
      xml(temDesenho) {
        const rows = [...linhas.keys()].sort((a, b) => a - b).map(r => {
          const cs = [...linhas.get(r).entries()].sort((a, b) => a[0] - b[0]).map(([c, { v, s }]) => celula(r, c, v, s)).join('');
          const h = f.alt[r]; return `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs}</row>`;
        }).join('');
        const larg = Object.keys(f.larg).map(Number).sort((a, b) => a - b).map(c => `<col min="${c + 1}" max="${c + 1}" width="${f.larg[c]}" customWidth="1"/>`).join('');
        const pane = f.freeze ? `<pane${f.freeze[1] ? ` xSplit="${f.freeze[1]}"` : ''}${f.freeze[0] ? ` ySplit="${f.freeze[0]}"` : ''} topLeftCell="${ref(f.freeze[0], f.freeze[1])}" activePane="${f.freeze[0] && f.freeze[1] ? 'bottomRight' : f.freeze[0] ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
        const cf = f.barras.map((b, i) => `<conditionalFormatting sqref="${b.sqref}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF${b.cor || COR.azulMedio}"/></dataBar></cfRule></conditionalFormatting>`).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheetPr>${f.cor ? `<tabColor rgb="FF${f.cor}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>` +
          `<dimension ref="A1:${ref(Math.max(0, f.maxR), Math.max(0, f.maxC))}"/>` +
          `<sheetViews><sheetView workbookViewId="0" showGridLines="0"${f.zoom ? ` zoomScale="${f.zoom}" zoomScaleNormal="${f.zoom}"` : ''}${f.sel ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
          '<sheetFormatPr defaultRowHeight="15"/>' + (larg ? `<cols>${larg}</cols>` : '') + `<sheetData>${rows}</sheetData>` +
          (f.filtro ? `<autoFilter ref="${f.filtro}"/>` : '') + (f.merges.length ? `<mergeCells count="${f.merges.length}">${f.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') + cf +
          (f.links.length ? `<hyperlinks>${f.links.map(l => `<hyperlink ref="${l.ref}" location="${xml(l.alvo)}"/>`).join('')}</hyperlinks>` : '') +
          '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
          (temDesenho ? '<drawing r:id="rId1"/>' : '') + '</worksheet>';
      },
    };
    return f;
  }
  function celula(r, c, v, s) {
    const a = `r="${ref(r, c)}"${s ? ` s="${s}"` : ''}`;
    if (v == null || v === '') return `<c ${a}/>`;
    if (v instanceof Date) return isNaN(v) ? `<c ${a}/>` : `<c ${a}><v>${serial(v)}</v></c>`;
    if (typeof v === 'number') return isFinite(v) ? `<c ${a}><v>${v}</v></c>` : `<c ${a}/>`;
    if (typeof v === 'boolean') return `<c ${a} t="b"><v>${v ? 1 : 0}</v></c>`;
    if (v && v.rich) return `<c ${a} t="inlineStr"><is>${v.rich.map(p => `<r><rPr>${p.b ? '<b/>' : ''}<sz val="${p.sz || 10}"/><color rgb="FF${p.cor || COR.tinta}"/><rFont val="${FONTE}"/><family val="2"/></rPr><t xml:space="preserve">${xml(p.t)}</t></r>`).join('')}</is></c>`;
    return `<c ${a} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }

  // ---------- gráficos (DrawingML) ----------
  const txPr = (sz, cor, b) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"${b ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="${FONTE}"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
  const preenche = (cor) => `<a:solidFill><a:srgbClr val="${cor}"/></a:solidFill>`;
  function graficoXml(g, base) {
    // base = { aba, r0 (linha do cabeçalho), c0, n } → endereços da tabela que alimenta o gráfico
    const n = g.cats.length, aba = base.aba, cat = absRef(aba, base.r0 + 1, base.c0, base.r0 + n, base.c0);
    const strCache = (vals) => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = (vals, fmt) => `<c:numCache><c:formatCode>${xml(fmt || 'General')}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => typeof v === 'number' && isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : '').join('')}</c:numCache>`;
    const fmt = g.formato || '#,##0';
    const pizza = g.tipo === 'rosca', linha = g.tipo === 'linha', barra = /^barra/.test(g.tipo), emp = /Empilhada$/.test(g.tipo);
    // rótulo: sem o zero (num gráfico com muitos períodos, os "0" poluem); o eixo dos valores começa sempre no zero quando não há negativos
    const partes = fmt.split(';'), fmtRotulo = partes.length >= 3 ? `${partes[0]};${partes[1]};` : `${partes[0]};-${partes[0]};`;
    const semNegativo = g.series.every(s => s.vals.every(v => !(typeof v === 'number' && v < 0)));
    const rotulos = (pos) => `<c:dLbls><c:numFmt formatCode="${xml(fmtRotulo)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, pizza || emp ? COR.branco : COR.tinta2, pizza || emp)}${pos ? `<c:dLblPos val="${pos}"/>` : ''}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
    const comRotulo = pizza || n <= 16;
    const series = g.series.map((s, k) => {
      const cor = s.cor || PALETA[k % PALETA.length];
      const tx = `<c:tx><c:strRef><c:f>${absRef(aba, base.r0, base.c0 + 1 + k)}</c:f>${strCache([s.nome])}</c:strRef></c:tx>`;
      const catR = `<c:cat><c:strRef><c:f>${cat}</c:f>${strCache(g.cats.map(String))}</c:strRef></c:cat>`;
      const valR = `<c:val><c:numRef><c:f>${absRef(aba, base.r0 + 1, base.c0 + 1 + k, base.r0 + n, base.c0 + 1 + k)}</c:f>${numCache(s.vals, fmt)}</c:numRef></c:val>`;
      if (pizza) {
        const pontos = g.cats.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${preenche((g.cores && g.cores[i]) || PALETA[i % PALETA.length])}<a:ln w="19050">${preenche(COR.branco)}</a:ln></c:spPr></c:dPt>`).join('');
        return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}${pontos}${rotulos('')}${catR}${valR}</c:ser>`;
      }
      if (linha) return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}<c:spPr><a:ln w="28575" cap="rnd">${preenche(cor)}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${preenche(cor)}<a:ln w="9525">${preenche(COR.branco)}</a:ln></c:spPr></c:marker>${comRotulo ? rotulos('t') : ''}${catR}${valR}<c:smooth val="0"/></c:ser>`;
      return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}<c:spPr>${preenche(cor)}</c:spPr><c:invertIfNegative val="0"/>${comRotulo ? rotulos(emp ? 'ctr' : 'outEnd') : ''}${catR}${valR}</c:ser>`;
    }).join('');
    const eixos = (horiz) => `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${horiz ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${preenche(COR.linha)}</a:ln></c:spPr>${txPr(900, COR.tinta2)}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/>${semNegativo ? '<c:min val="0"/>' : ''}</c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="9525">${preenche(COR.fundo2)}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${xml(fmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, COR.tinta3)}<c:crossAx val="5001"/><c:crosses val="${horiz ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
    let plot;
    if (pizza) plot = `<c:doughnutChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
    else if (linha) plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>${eixos(false)}`;
    else plot = `<c:barChart><c:barDir val="${barra ? 'bar' : 'col'}"/><c:grouping val="${emp ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${series}<c:gapWidth val="${emp ? 50 : 70}"/>${emp ? '<c:overlap val="100"/>' : '<c:overlap val="-10"/>'}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>${eixos(barra)}`;
    const legenda = pizza || g.series.length > 1 ? `<c:legend><c:legendPos val="${pizza ? 'r' : 'b'}"/><c:overlay val="0"/>${txPr(900, COR.tinta2)}</c:legend>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:lang val="pt-BR"/><c:roundedCorners val="0"/><c:chart>' +
      `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1">${preenche(COR.tinta)}</a:defRPr></a:pPr><a:r><a:rPr lang="pt-BR" sz="1200" b="1">${preenche(COR.tinta)}<a:latin typeface="${FONTE}"/></a:rPr><a:t>${xml(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
      `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
      `<c:spPr>${preenche(COR.branco)}<a:ln w="9525">${preenche(COR.linha)}</a:ln></c:spPr>${txPr(900, COR.tinta2)}` +
      '<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>';
  }
  function desenhoXml(lista, primeiro) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      lista.map((g, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${g.pos.c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.pos.r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${g.pos.c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.pos.r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${primeiro + i}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('') + '</xdr:wsDr>';
  }

  // ---------- zip (sem compressão) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(arquivos) {
    const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
    const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [nome, conteudo] of arquivos) {
      const n = enc.encode(nome), dados = typeof conteudo === 'string' ? enc.encode(conteudo) : conteudo, crc = crc32(dados);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, hora, true); h.setUint16(12, dia, true);
      h.setUint32(14, crc, true); h.setUint32(18, dados.length, true); h.setUint32(22, dados.length, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), n, dados);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, dia, true);
      c.setUint32(16, crc, true); c.setUint32(20, dados.length, true); c.setUint32(24, dados.length, true); c.setUint16(28, n.length, true); c.setUint32(42, pos, true);
      central.push(new Uint8Array(c.buffer), n);
      pos += 30 + n.length + dados.length;
    }
    const tamC = central.reduce((s, x) => s + x.length, 0), fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tamC, true); fim.setUint32(16, pos, true);
    const tudo = [...partes, ...central, new Uint8Array(fim.buffer)], out = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0)); let o = 0;
    for (const x of tudo) { out.set(x, o); o += x.length; }
    return out;
  }

  // ---------- montagem ----------
  const larguraTexto = (v) => { const s = v instanceof Date ? '00/00/0000' : typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v == null ? '' : v); return Math.max(...s.split('\n').map(l => l.length)); };
  function cabecalho(f, est, ultimaCol, modulo) {
    // faixa escura com a marca do Hub e um fio vermelho embaixo, como o topo do Hub
    f.bloco(0, 0, 0, ultimaCol, { rich: [{ t: 'Control', b: 1, sz: 16, cor: COR.vermelhoClaro }, { t: 'Hub', b: 1, sz: 16, cor: COR.marcaAzul }, { t: '   ·   ' + (modulo || 'Departamento Pessoal'), sz: 11, cor: COR.cinza }] }, { fundo: COR.escuro, al: { h: 'left', ind: 1 } });
    f.alt[0] = 34;
    f.bloco(1, 0, 1, ultimaCol, null, { fundo: COR.vermelho }); f.alt[1] = 4;
  }
  function gerar(spec) {
    const est = Estilos(), folhas = [];
    const T = spec.tabela || { cab: [], linhas: [] };
    // no máximo 2 gráficos e 4 indicadores: a primeira tela responde o essencial; o resto está na lista
    const graficos = (spec.graficos || []).filter(g => g && g.cats && g.cats.length && g.series && g.series.length && g.series.some(s => s.vals.some(v => typeof v === 'number' && v !== 0))).slice(0, 2);
    const LINK = { fonte: { u: 1, b: 1, sz: 10, cor: COR.azul }, al: { h: 'left' } };

    // ===== Resumo =====
    const P = Folha('Resumo', est); P.cor = COR.vermelho; P.sel = true; folhas.push(P);
    const COLS = 12; for (let c = 0; c < COLS; c++) P.larg[c] = 13.5;
    cabecalho(P, est, COLS - 1, spec.modulo);
    P.bloco(3, 0, 3, COLS - 1, spec.titulo || 'Relatório', { fonte: { b: 1, sz: 18 }, al: { h: 'left' } }); P.alt[3] = 30;
    P.bloco(4, 0, 4, COLS - 1, spec.subtitulo || '', { fonte: { sz: 10, cor: COR.tinta3 }, al: { h: 'left', wrap: 1 } }); P.alt[4] = 20;
    const filtros = (spec.filtros || []).filter(x => x && x[1]);
    let r = 5;
    if (filtros.length) { P.bloco(r, 0, r, COLS - 1, filtros.map(([k, v]) => `${k}: ${v}`).join('   ·   '), { fonte: { sz: 9, cor: COR.tinta3 }, al: { h: 'left', wrap: 1 } }); P.alt[r] = 18; r++; }
    r++;
    const kpis = (spec.kpis || []).slice(0, 4);
    if (kpis.length) {
      const largura = COLS / Math.max(kpis.length, 3) | 0;
      kpis.forEach((k, j) => {
        const c1 = j * largura, c2 = c1 + largura - 1, acento = TOM[k.tom || ''] || COR.azul;
        const bL = { left: [acento, 'thick'], top: [COR.linha], right: [COR.linha] }, bM = { left: [acento, 'thick'], right: [COR.linha] }, bB = { left: [acento, 'thick'], right: [COR.linha], bottom: [COR.linha] };
        const v = typeof k.v === 'number' ? k.v : (/^[+−-]?\d[\d.]*(,\d+)?$/.test(String(k.v)) && !/%/.test(String(k.v)) ? Number(String(k.v).replace('−', '-').replace(/\./g, '').replace(',', '.')) : k.v);
        P.bloco(r, c1, r, c2, v, { fonte: { b: 1, sz: 24, cor: k.tom === 'down' || k.tom === 'de' ? COR.vermelho : k.tom === 'up' || k.tom === 'ad' ? COR.verde : COR.tinta }, fundo: COR.fundo, borda: bL, al: { h: 'left', ind: 1 }, fmt: typeof v === 'number' ? (/^[+−-]/.test(String(k.v)) ? '+#,##0;-#,##0;0' : Number.isInteger(v) ? '#,##0' : '#,##0.0') : undefined });
        P.bloco(r + 1, c1, r + 1, c2, k.l || '', { fonte: { b: 1, sz: 10, cor: COR.tinta2 }, fundo: COR.fundo, borda: bM, al: { h: 'left', ind: 1, wrap: 1 } });
        P.bloco(r + 2, c1, r + 2, c2, k.s || '', { fonte: { i: 1, sz: 9, cor: COR.tinta3 }, fundo: COR.fundo, borda: bB, al: { h: 'left', ind: 1, wrap: 1 } });
      });
      P.alt[r] = 38; P.alt[r + 1] = 18; P.alt[r + 2] = 18;
      r += 4;
    }
    const nLin = T.linhas.length;
    P.bloco(r, 0, r, COLS - 1, nLin ? `Ver a lista completa (${nLin.toLocaleString('pt-BR')} linha${nLin === 1 ? '' : 's'}) na aba Dados  →` : 'Nada a listar com esses filtros.', nLin ? LINK : { fonte: { i: 1, sz: 10, cor: COR.tinta3 }, al: { h: 'left' } });
    if (nLin) P.links.push({ ref: ref(r, 0), alvo: "'Dados'!A1" });
    P.alt[r] = 20; r += 2;
    // gráficos lado a lado (um só ocupa a largura toda)
    if (graficos.length) {
      const larg = graficos.length === 1 ? COLS : COLS / 2;
      graficos.forEach((g, i) => { g.pos = { c1: i * larg, c2: i * larg + larg, r1: r, r2: r + 18 }; });
      P.graficos = graficos; r += 19;
    }
    const notas = (spec.notas || []).filter(Boolean);
    notas.forEach(n => { P.bloco(r, 0, r, COLS - 1, n, { fonte: { i: 1, sz: 9, cor: COR.tinta3 }, al: { h: 'left', wrap: 1 } }); P.alt[r] = n.length > 160 ? 30 : 16; r++; });

    // ===== Dados: só a lista, com o cabeçalho travado e filtro em cada coluna =====
    const D = Folha('Dados', est); D.cor = COR.azul; folhas.push(D);
    const nC = Math.max(1, T.cab.length), ultima = nC - 1, larga = Math.max(ultima, 3);
    D.bloco(0, 0, 0, larga, T.titulo || spec.titulo || 'Dados', { fonte: { b: 1, sz: 14 }, al: { h: 'left' } }); D.alt[0] = 26;
    D.set(1, 0, '←  Voltar ao resumo', LINK); D.links.push({ ref: 'A2', alvo: "'Resumo'!A1" });
    if (larga >= 1) D.bloco(1, 1, 1, larga, `${nLin.toLocaleString('pt-BR')} linha${nLin === 1 ? '' : 's'}${spec.subtitulo ? ' · ' + spec.subtitulo : ''}`, { fonte: { sz: 9, cor: COR.tinta3 }, al: { h: 'left' } });
    D.alt[1] = 18;
    const R0 = 3, num = new Set(T.num || []), pct = new Set(T.pct || []), sinal = new Set(T.sinal || []), datas = new Set(T.datas || []);
    const fmtCol = (i) => datas.has(i) ? 'dd/mm/yyyy' : pct.has(i) ? '0.0"%"' : sinal.has(i) ? '+#,##0;[Red]-#,##0;0' : num.has(i) ? '#,##0' : undefined;
    const alCol = (i) => num.has(i) || pct.has(i) || sinal.has(i) ? 'right' : datas.has(i) ? 'center' : 'left';
    T.cab.forEach((c, i) => D.set(R0, i, c, { fonte: { b: 1, sz: 10, cor: COR.branco }, fundo: COR.escuro, borda: { bottom: [COR.vermelho, 'medium'] }, al: { h: alCol(i), wrap: 1 } }));
    D.alt[R0] = 30;
    T.linhas.forEach((l, k) => {
      const zebra = k % 2 ? COR.fundo : null;
      l.forEach((v, i) => D.set(R0 + 1 + k, i, v, { fonte: { sz: 10 }, fundo: zebra, borda: { bottom: [COR.linha, 'hair'] }, al: { h: alCol(i), wrap: !num.has(i) && String(v || '').length > 60 ? 1 : 0 }, fmt: fmtCol(i) }));
    });
    const ultLin = R0 + nLin;
    if (T.total) T.total.forEach((v, i) => D.set(ultLin + 1, i, v, { fonte: { b: 1, sz: 10 }, fundo: COR.fundo2, borda: { top: [COR.azul, 'medium'], bottom: [COR.azul, 'medium'] }, al: { h: alCol(i) }, fmt: fmtCol(i) }));
    if (nLin) {
      D.filtro = `${ref(R0, 0)}:${ref(ultLin, ultima)}`;
      D.filtroRC = [R0, 0, ultLin, ultima];
      (T.barras || []).forEach(i => { if (i <= ultima && nLin > 1) D.barras.push({ sqref: `${ref(R0 + 1, i)}:${ref(ultLin, i)}`, cor: COR.azulMedio }); });
    } else D.bloco(R0 + 1, 0, R0 + 1, larga, 'Nada a listar com esses filtros.', { fonte: { i: 1, cor: COR.tinta3 }, al: { h: 'left' } });
    D.freeze = [R0 + 1, 0];
    T.cab.forEach((c, i) => { const amostra = T.linhas.slice(0, 400).map(l => larguraTexto(l[i])); D.larg[i] = Math.min(56, Math.max(10, larguraTexto(c) * 0.9 + 3, ...amostra.map(x => x + 2))); });
    if (D.larg[0] < 20) D.larg[0] = 20;   // cabe o "Voltar ao resumo"

    // ===== Base: os números dos gráficos (aba oculta; o Excel lê dela para desenhar) =====
    if (graficos.length) {
      const B = Folha('Base', est); B.oculta = true; folhas.push(B);
      B.larg[0] = 30; for (let c = 1; c < 8; c++) B.larg[c] = 16;
      let rb = 0;
      graficos.forEach(g => {
        B.set(rb, 0, g.titulo, { fonte: { b: 1, sz: 11, cor: COR.azul } }); rb++;
        B.set(rb, 0, g.rotuloCat || 'Categoria', { fonte: { b: 1, cor: COR.branco }, fundo: COR.escuro });
        g.series.forEach((s, k) => B.set(rb, 1 + k, s.nome, { fonte: { b: 1, cor: COR.branco }, fundo: COR.escuro, al: { h: 'right' } }));
        g.base = { aba: B.nome, r0: rb, c0: 0 };
        g.cats.forEach((c, i) => { B.set(rb + 1 + i, 0, String(c)); g.series.forEach((s, k) => B.set(rb + 1 + i, 1 + k, typeof s.vals[i] === 'number' && isFinite(s.vals[i]) ? s.vals[i] : null, { al: { h: 'right' }, fmt: g.formato || '#,##0' })); });
        rb += g.cats.length + 3;
      });
    }

    // ===== pacote =====
    const arq = [], ctOver = [], wbRels = [];
    let nGraf = 0, nDes = 0;
    folhas.forEach((f, i) => {
      const temDes = f.graficos.length > 0;
      arq.push([`xl/worksheets/sheet${i + 1}.xml`, f.xml(temDes)]);
      ctOver.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      wbRels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
      if (temDes) {
        nDes++;
        arq.push([`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${nDes}.xml"/></Relationships>`]);
        arq.push([`xl/drawings/drawing${nDes}.xml`, desenhoXml(f.graficos, nGraf + 1)]);
        ctOver.push(`<Override PartName="/xl/drawings/drawing${nDes}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        const rels = f.graficos.map((g, k) => { nGraf++; arq.push([`xl/charts/chart${nGraf}.xml`, graficoXml(g, g.base)]); ctOver.push(`<Override PartName="/xl/charts/chart${nGraf}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`); return `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${nGraf}.xml"/>`; });
        arq.push([`xl/drawings/_rels/drawing${nDes}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`]);
      }
    });
    wbRels.push(`<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
    const nomes = folhas.map((f, i) => f.filtroRC ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${absRef(f.nome, ...f.filtroRC)}</definedName>` : '').join('');
    const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000" activeTab="0"/></bookViews><sheets>${folhas.map((f, i) => `<sheet name="${xml(f.nome)}" sheetId="${i + 1}"${f.oculta ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>` +
      (nomes ? `<definedNames>${nomes}</definedNames>` : '') + '<calcPr calcId="191029"/></workbook>';
    const agoraIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const titulo = xml((spec.titulo || 'Relatório') + ' · ControlTax');
    const tudo = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + ctOver.join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'],
      ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${titulo}</dc:title><dc:creator>Control Hub</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agoraIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${agoraIso}</dcterms:modified></cp:coreProperties>`],
      ['docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Control Hub</Application></Properties>'],
      ['xl/workbook.xml', workbook],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>`],
      ...arq,
      ['xl/styles.xml', est.xml()],
    ];
    return zip(tudo);
  }

  const api = { gerar, PALETA, COR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.HubPlanilha = api;
})(typeof window !== 'undefined' ? window : globalThis);
