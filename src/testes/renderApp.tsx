import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { AppProvider } from '../state/AppContext'
import { routes } from '../routes'

/**
 * Monta o app inteiro numa rota — o mesmo empilhamento de providers do
 * `main.tsx`, com um router de memória. Só o canal HTTP é de mentira
 * (`vi.mock('./api/client')` no arquivo de teste); router, store e telas são os
 * de produção, que é o ponto destes testes.
 *
 * `retry: false` para uma falha simulada aparecer no primeiro tento, em vez de
 * o teste esperar a política de retry do TanStack.
 */
export function renderApp(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryClientProvider client={qc}>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </QueryClientProvider>,
  )
}
