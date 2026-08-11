import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/routes'
import { AppProvider } from '@/comum/state/AppContext'
import { temSsoDeMentira } from '@/comum/config'
import '@/comum/styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

async function bootstrap() {
  // Em dev, sobe o mock server (MSW) antes de renderizar.
  if (import.meta.env.DEV) {
    const { worker } = await import('@/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  // Sessão contra o IdP de mentira, quando ele estiver configurado. Import
  // DINÂMICO: sem `ssoDeMentira.tokenUrl` no `/config.js`, nada disto entra no
  // bundle que vai para produção.
  let Faixa: (() => React.ReactNode) | null = null
  if (temSsoDeMentira()) {
    const [{ iniciarSessaoDeMentira }, { FaixaDeMentira }] = await Promise.all([
      import('@/comum/auth/sessaoDeMentira'),
      import('@/comum/auth/FaixaDeMentira'),
    ])
    // ANTES de renderizar: a primeira tela já dispara chamadas de API, e sem o
    // provedor registrado elas sairiam sem `Authorization` e voltariam 401.
    iniciarSessaoDeMentira()
    Faixa = FaixaDeMentira
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <RouterProvider router={router} />
          {Faixa ? <Faixa /> : null}
        </AppProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
