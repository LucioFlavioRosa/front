import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { SelecaoUnidade } from './pages/SelecaoUnidade'
import { Hub } from './pages/Hub'
import { GrupoHierarquia } from './pages/GrupoHierarquia'
import { GrupoContrato } from './pages/GrupoContrato'
import { GrupoSubBacias } from './pages/GrupoSubBacias'
import { GrupoEtes } from './pages/GrupoEtes'
import { GrupoCts } from './pages/GrupoCts'

// O AppShell (header + transversais) envolve tudo, como no prototipo — o header
// aparece ate na selecao, em forma reduzida (sem contexto/completude).
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
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
