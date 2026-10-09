/**
 * Monta a página do artefato a partir do build de demonstração (dist-artefato):
 * CSS e JS da aplicação embutidos, SheetJS pelo cdnjs e fontes pelo Google Fonts.
 * A página sai sem <html>/<head>/<body>: quem publica acrescenta o esqueleto.
 * Uso: node scripts/artefato.mjs [arquivo-de-saída]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(raiz, "dist-artefato");
const html = readFileSync(join(dist, "index.html"), "utf8");
const js = html.match(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/)?.[1];
const css = html.match(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/)?.[1];
if (!js || !css) throw new Error("Não achei o JS/CSS do build em dist-artefato/index.html");

const codigo = readFileSync(join(dist, js), "utf8").replace(/<\/script/gi, "<\\/script");
const estilo = readFileSync(join(dist, css), "utf8").replace(/<\/style/gi, "<\\/style");
const saida = process.argv[2] ? resolve(process.argv[2]) : join(dist, "folha-controltax.html");

writeFileSync(
  saida,
  `<title>Folha ControlTax</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${estilo}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script type="module">${codigo}</script>
`,
);
console.log(`Artefato: ${saida} (${(Buffer.byteLength(readFileSync(saida)) / 1024).toFixed(0)} KB)`);
