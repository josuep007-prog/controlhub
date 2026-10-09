/** Entrega um arquivo gerado na tela ao usuário. No artefato é preciso pedir à plataforma; na versão instalada é um download comum. */
export async function salvarArquivo(nome: string, bytes: Uint8Array, mime: string): Promise<"salvo" | "cancelado"> {
  if (import.meta.env.VITE_DEMO === "1") {
    const claude = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: Uint8Array }) => Promise<unknown> } | null> } }).claude;
    const downloads = await claude?.use("downloads");
    if (!downloads) throw new Error("Este ambiente não permite baixar arquivos. Abra o artefato direto no claude.ai.");
    try {
      await downloads.save({ filename: nome, data: bytes });
      return "salvo";
    } catch (e) {
      if ((e as { code?: string }).code === "declined") return "cancelado";
      throw new Error("Não consegui salvar o arquivo.");
    }
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "salvo";
}
