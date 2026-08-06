import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { SelecaoUnidade } from '@/cadastro/pages/SelecaoUnidade'
import { Hub } from '@/cadastro/pages/Hub'
import { GrupoHierarquia } from '@/cadastro/pages/GrupoHierarquia'
import { GrupoContrato } from '@/cadastro/pages/GrupoContrato'
import { GrupoSubBacias } from '@/cadastro/pages/GrupoSubBacias'
import { GrupoEtes } from '@/cadastro/pages/GrupoEtes'
import { GrupoCts } from '@/cadastro/pages/GrupoCts'
import { Portal } from '@/comum/pages/Portal'
import { Simular } from '@/simulacao/pages/Simular'
import { ResultsShell } from '@/app/ResultsShell'
import { Historico } from '@/resultado/pages/Historico'
import { Global } from '@/resultado/pages/Global'
import { Cidade } from '@/resultado/pages/Cidade'
import { Sistema } from '@/resultado/pages/Sistema'
import { SubBacia } from '@/resultado/pages/SubBacia'
import { Elemento } from '@/resultado/pages/Elemento'

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
      // A raiz e o PORTAL: os tres caminhos do produto. Antes era a selecao de
      // unidade, o que obrigava a escolher uma unidade para so depois descobrir o
      // que dava para fazer com ela — e o historico nem precisa de unidade.
      { index: true, element: <Portal /> },
      { path: 'cadastro', element: <SelecaoUnidade /> },
      { path: 'simular', element: <Simular /> },
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
