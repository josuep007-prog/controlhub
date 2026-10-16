import { criarApp } from "./app.js";
import { configuracaoBanco, HOST, PASTA_WEB, PORTA } from "./config.js";
import { abrirBanco } from "./db/index.js";
import { semear } from "./seed.js";

const conexao = await abrirBanco(configuracaoBanco());
if (process.env.SEM_EXEMPLOS !== "1" && (await semear(conexao.db))) {
  console.log("Banco vazio: dados de exemplo gravados.");
}

const app = await criarApp(conexao.db, { pastaWeb: PASTA_WEB, logger: process.env.LOG === "1" });
await app.listen({ port: PORTA, host: HOST });
console.log(`Folha ControlTax em http://${HOST}:${PORTA} — banco: ${conexao.descricao}`);

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    await app.close();
    await conexao.fechar();
    process.exit(0);
  });
}
