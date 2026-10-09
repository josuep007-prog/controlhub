import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 3333}` },
  },
  // Versão de demonstração (artefato): um único arquivo JS, embutido na página por scripts/artefato.mjs.
  build: mode === "demo" ? { cssCodeSplit: false, rolldownOptions: { output: { codeSplitting: false } } } : undefined,
}));
