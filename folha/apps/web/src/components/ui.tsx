import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { api, type Empresa, type Nota } from "../api";

export function Dialogo({ aberto, titulo, onFechar, children, largura }: {
  aberto: boolean;
  titulo: ReactNode;
  onFechar: () => void;
  children: ReactNode;
  largura?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dlg" onClose={onFechar} style={largura ? { width: `min(${largura}px, calc(100vw - 24px))` } : undefined}>
      {aberto && (
        <>
          <div className="dlg-head">
            <h2>{titulo}</h2>
            <button className="x" onClick={onFechar} aria-label="Fechar">
              ×
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

/** Origem e confiança de cada campo de uma admissão em conferência (vazio nas telas comuns). */
export const NotasCtx = createContext<{ notas: Record<string, Nota>; confirmar?: (chave: string) => void }>({ notas: {} });

const TEXTO_CONFIANCA = { alta: "", media: " · confira", baixa: " · confiança baixa, confira" } as const;

export function Campo({ rotulo, children, largo, erro, campo }: { rotulo: string; children: ReactNode; largo?: boolean; erro?: string; campo?: string }) {
  const { notas, confirmar } = useContext(NotasCtx);
  const nota = notas[campo ?? ""];
  const nivel = nota?.confianca ?? "alta";
  return (
    <label className={`campo${largo ? " largo" : ""}${nota ? ` nota-${nivel}` : ""}`}>
      {rotulo}
      {children}
      {nota && (
        <span className={`nota-txt ${nivel}`}>
          lido de {nota.origem}
          {TEXTO_CONFIANCA[nivel]}{" "}
          {confirmar && nivel !== "alta" && (
            <button type="button" className="linkish" onClick={() => confirmar(campo!)}>
              confere
            </button>
          )}
        </span>
      )}
      {nota?.aviso && <span className="erro-campo">{nota.aviso}</span>}
      {erro && <span className="erro-campo">{erro}</span>}
    </label>
  );
}

export function useEmpresas() {
  return useQuery({ queryKey: ["empresas"], queryFn: () => api.get<Empresa[]>("/api/empresas") });
}

/** Seletor de empresa usado nas telas de trabalho da competência. */
export function SeletorEmpresa({ valor, onChange, todas }: { valor?: string; onChange: (id: string) => void; todas?: boolean }) {
  const { data = [] } = useEmpresas();
  return (
    <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)} aria-label="Empresa" style={{ minWidth: 280 }}>
      {todas ? <option value="">Todas as empresas</option> : <option value="">Escolha a empresa…</option>}
      {data
        .filter((e) => e.ativa)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.codigoDominio ? `${e.codigoDominio} · ` : ""}
            {e.razaoSocial}
          </option>
        ))}
    </select>
  );
}

export const Carregando = () => <div className="carregando">Carregando…</div>;

export function Erro({ erro }: { erro: unknown }) {
  return <div className="aviso erro">{(erro as Error)?.message ?? "Erro ao carregar"}</div>;
}
