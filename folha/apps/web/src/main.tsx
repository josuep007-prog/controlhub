import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Layout } from "./components/Layout";
import { ProvedorEstado } from "./estado";
import { Calculo } from "./pages/Calculo";
import { Empresas } from "./pages/Empresas";
import { FichaFuncionario } from "./pages/FichaFuncionario";
import { Funcionarios } from "./pages/Funcionarios";
import { Importacao } from "./pages/Importacao";
import { Lancamentos } from "./pages/Lancamentos";
import { Painel } from "./pages/Painel";
import { Relatorios } from "./pages/Relatorios";
import { Rubricas } from "./pages/Rubricas";
import { Tabelas } from "./pages/Tabelas";
import "./styles/app.css";
import { validarBusca } from "./busca";

const raiz = createRootRoute({ component: Layout });
const rota = <P extends string>(path: P, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => raiz, path, component, validateSearch: validarBusca });

const arvore = raiz.addChildren([
  rota("/", Painel),
  rota("/empresas", Empresas),
  rota("/funcionarios", Funcionarios),
  rota("/funcionarios/novo", FichaFuncionario),
  rota("/funcionarios/$id", FichaFuncionario),
  rota("/lancamentos", Lancamentos),
  rota("/calculo", Calculo),
  rota("/relatorios", Relatorios),
  rota("/rubricas", Rubricas),
  rota("/importacao", Importacao),
  rota("/tabelas", Tabelas),
]);

export const router = createRouter({ routeTree: arvore, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProvedorEstado>
        <RouterProvider router={router} />
      </ProvedorEstado>
    </QueryClientProvider>
  </StrictMode>,
);
