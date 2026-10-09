/**
 * Importação de cadastros exportados do Domínio, em duas etapas: prévia e aplicação.
 * As regras (colunas, formatos, comparação) ficam em importacao-regras.ts.
 */
import { and, eq, max } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { cargos, empresas, funcionarios } from "../db/schema.js";
import { ErroNegocio, registrarAuditoria, uid } from "../util.js";
import { CAMPOS_EMP, CAMPOS_FUNC, filtrar, planejarImportacao, type Linha, type Previa, type TipoImportacao } from "./importacao-regras.js";

export type { Previa, TipoImportacao } from "./importacao-regras.js";
export { lerData, lerValor } from "./importacao-regras.js";

export async function previaImportacao(db: Db, tipo: TipoImportacao, linhas: Linha[], empresaId?: string): Promise<Previa> {
  if (tipo === "empresas") {
    return planejarImportacao(tipo, linhas, { empresas: await db.select().from(empresas), funcionarios: [] });
  }
  if (!empresaId) throw new ErroNegocio("Escolha a empresa de destino dos funcionários");
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  if (!empresa) throw new ErroNegocio("Empresa não encontrada", 404);
  const existentes = await db.select().from(funcionarios).where(eq(funcionarios.empresaId, empresaId));
  return planejarImportacao(tipo, linhas, { empresas: [], funcionarios: existentes });
}

export async function aplicarImportacao(
  db: Db,
  tipo: TipoImportacao,
  linhas: Linha[],
  usuario: string,
  empresaId?: string,
): Promise<{ inseridos: number; atualizados: number; revisar: number }> {
  const previa = await previaImportacao(db, tipo, linhas, empresaId);
  await db.transaction(async (tx) => {
    if (tipo === "empresas") {
      for (const n of previa.novos) {
        await tx.insert(empresas).values({
          id: uid(),
          ...(filtrar(n.dados, CAMPOS_EMP) as object),
          cnpj: n.dados.cnpj as string,
          razaoSocial: n.dados.razaoSocial as string,
          regime: n.dados.regime as "simples" | "presumido" | "real",
        });
      }
      for (const a of previa.alterados) {
        await tx
          .update(empresas)
          .set({ ...filtrar(a.dados, CAMPOS_EMP), atualizadoEm: new Date() })
          .where(eq(empresas.id, a.id));
      }
    } else {
      const [m] = await tx
        .select({ m: max(funcionarios.matricula) })
        .from(funcionarios)
        .where(eq(funcionarios.empresaId, empresaId!));
      let proxima = (m?.m ?? 0) + 1;
      const usadas = new Set(
        (await tx.select({ m: funcionarios.matricula }).from(funcionarios).where(eq(funcionarios.empresaId, empresaId!))).map((x) => x.m),
      );
      const cargosExistentes = await tx.select().from(cargos);
      const cargoId = async (nome: unknown, cbo: unknown) => {
        if (!nome) return null;
        const achado = cargosExistentes.find((c) => c.nome.toUpperCase() === String(nome).toUpperCase());
        if (achado) return achado.id;
        const novo = { id: uid(), nome: String(nome).toUpperCase(), cbo: cbo ? String(cbo) : null };
        await tx.insert(cargos).values(novo);
        cargosExistentes.push(novo);
        return novo.id;
      };
      for (const n of previa.novos) {
        const cod = Number(n.dados.codigoDominio);
        let matricula = Number.isInteger(cod) && cod > 0 && !usadas.has(cod) ? cod : proxima;
        while (usadas.has(matricula)) matricula = ++proxima;
        usadas.add(matricula);
        if (matricula >= proxima) proxima = matricula + 1;
        await tx.insert(funcionarios).values({
          id: uid(),
          empresaId: empresaId!,
          matricula,
          ...(filtrar(n.dados, CAMPOS_FUNC) as object),
          nome: n.dados.nome as string,
          cpf: n.dados.cpf as string,
          cargoId: await cargoId(n.dados.cargo, n.dados.cbo),
          admissao: n.dados.admissao as string,
          salario: n.dados.salario as string,
        });
      }
      for (const a of previa.alterados) {
        await tx
          .update(funcionarios)
          .set({ ...filtrar(a.dados, CAMPOS_FUNC), atualizadoEm: new Date() })
          .where(and(eq(funcionarios.id, a.id), eq(funcionarios.empresaId, empresaId!)));
      }
    }
    await registrarAuditoria(tx, usuario, "importar", tipo, empresaId ?? null, {
      inseridos: previa.novos.length,
      atualizados: previa.alterados.length,
      revisar: previa.revisar.length,
    });
  });
  return { inseridos: previa.novos.length, atualizados: previa.alterados.length, revisar: previa.revisar.length };
}
