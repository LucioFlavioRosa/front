import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { SelecaoUnidade } from './pages/SelecaoUnidade'
import { Hub } from './pages/Hub'
import { GrupoHierarquia } from './pages/GrupoHierarquia'
import { GrupoContrato } from './pages/GrupoContrato'
import { GrupoSubBacias } from './pages/GrupoSubBacias'
import { GrupoEtes } from './pages/GrupoEtes'
import { GrupoCts } from './pages/GrupoCts'
import { ResultsShell } from './layout/ResultsShell'
import { Historico } from './pages/resultado/Historico'
import { Global } from './pages/resultado/Global'
import { Cidade } from './pages/resultado/Cidade'
import { Sistema } from './pages/resultado/Sistema'
import { SubBacia } from './pages/resultado/SubBacia'
import { Elemento } from './pages/resultado/Elemento'

// Duas cascas irmas, uma por produto:
//   `/`            AppShell     — cadastro (escrita: reducer, rascunho, guarda de saida)
//   `/resultados`  ResultsShell — resultados (leitura pura de uma rodada imutavel)
//
// As rotas de resultado sao PLANAS: nao carregam a ancestralidade no caminho
// (`/resultados/:runId/sistemas/:id`, e nao `.../cidades/:c/sistemas/:s`). Bate
// com o contrato de API do handoff, mantem a URL curta e faz o deep link
// funcionar para quem chega de fora. Quem sabe a que cidade um sistema pertence e
// o payload — por isso o breadcrumb vem do `CrumbsProvider`, nao da rota.
//
// A unidade tambem nao entra na URL: uma rodada pertence a exatamente uma unidade
// (`run_meta.unidade`), entao o `run_id` ja determina o recorte.
//
// `routes` e exportado para os testes montarem um MemoryRouter equivalente.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <SelecaoUnidade /> },
      {
        path: 'unidade/:unidadeId',
        children: [
          { index: true, element: <Hub /> },
          { path: 'hierarquia', element: <GrupoHierarquia /> },
          { path: 'contrato-metas', element: <GrupoContrato /> },
          { path: 'sub-bacias', element: <GrupoSubBacias /> },
          { path: 'etes', element: <GrupoEtes /> },
          { path: 'cts', element: <GrupoCts /> },
        ],
      },
    ],
  },
  {
    path: '/resultados',
    element: <ResultsShell />,
    children: [
      { index: true, element: <Historico /> },
      {
        path: ':runId',
        children: [
          { index: true, element: <Global /> },
          { path: 'cidades/:cidadeId', element: <Cidade /> },
          { path: 'sistemas/:sistemaId', element: <Sistema /> },
          { path: 'sub-bacias/:subId', element: <SubBacia /> },
          { path: 'obras/:obraId', element: <Elemento /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
