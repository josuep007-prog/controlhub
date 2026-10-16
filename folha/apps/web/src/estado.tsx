import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, definirUsuario, type Usuario } from "./api";
import type { Rascunho } from "./regras";

/** Estado global da tela: competência em trabalho, usuário e avisos (toasts). */

const ler = (k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const gravar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
};

/** A folha que se processa agora é a do mês anterior. */
const competenciaPadrao = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)).toISOString().slice(0, 7);
};

interface Toast {
  id: number;
  texto: string;
  erro?: boolean;
}

/** Admissão em conferência: o que foi lido da ficha ou dos documentos e ainda não foi gravado. */
export interface RascunhoLocal extends Rascunho {
  id: string;
  empresaId: string;
}

const CHAVE_RASCUNHOS = "folha-rascunhos-v1";
const lerRascunhos = (): RascunhoLocal[] => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHOS) ?? "[]") as RascunhoLocal[];
  } catch {
    return [];
  }
};

interface Estado {
  rascunhos: RascunhoLocal[];
  adicionarRascunhos: (r: (Rascunho & { empresaId: string })[]) => RascunhoLocal[];
  atualizarRascunho: (id: string, mudanca: Partial<RascunhoLocal>) => void;
  removerRascunho: (id: string) => void;
  competencia: string;
  setCompetencia: (c: string) => void;
  usuarios: Usuario[];
  usuario: Usuario | null;
  setUsuarioId: (id: string) => void;
  avisar: (texto: string, erro?: boolean) => void;
}

const Ctx = createContext<Estado | null>(null);

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [competencia, setComp] = useState(() => ler("folha-competencia") || competenciaPadrao());
  const [usuarioId, setUid] = useState(() => ler("folha-usuario"));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rascunhos, setRascunhos] = useState<RascunhoLocal[]>(lerRascunhos);
  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios"], queryFn: () => api.get<Usuario[]>("/api/usuarios") });

  const usuario = usuarios.find((u) => u.id === usuarioId) ?? usuarios[0] ?? null;
  useEffect(() => {
    definirUsuario(usuario?.id ?? "");
  }, [usuario?.id]);
  // Garante o cabeçalho já na primeira renderização.
  definirUsuario(usuario?.id ?? "");

  const avisar = useCallback((texto: string, erro = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, erro }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), erro ? 6000 : 3200);
  }, []);

  useEffect(() => {
    // Fica só nesta aba do navegador e some quando ela fecha (tem CPF e dados pessoais).
    try {
      sessionStorage.setItem(CHAVE_RASCUNHOS, JSON.stringify(rascunhos));
    } catch {
      /* sem armazenamento: segue em memória */
    }
  }, [rascunhos]);

  const valor = useMemo<Estado>(
    () => ({
      rascunhos,
      adicionarRascunhos: (novos) => {
        const prontos = novos.map((r) => ({ ...r, id: crypto.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        setRascunhos((atual) => [...atual, ...prontos]);
        return prontos;
      },
      atualizarRascunho: (id, mudanca) => setRascunhos((atual) => atual.map((r) => (r.id === id ? { ...r, ...mudanca } : r))),
      removerRascunho: (id) => setRascunhos((atual) => atual.filter((r) => r.id !== id)),
      competencia,
      setCompetencia: (c) => {
        setComp(c);
        gravar("folha-competencia", c);
      },
      usuarios,
      usuario,
      setUsuarioId: (id) => {
        setUid(id);
        gravar("folha-usuario", id);
        definirUsuario(id);
      },
      avisar,
    }),
    [competencia, usuarios, usuario, avisar, rascunhos],
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.erro ? " erro" : ""}`}>
            {t.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useEstado() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEstado fora do ProvedorEstado");
  return c;
}
