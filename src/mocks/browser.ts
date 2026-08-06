import { setupWorker } from 'msw/browser'
import { handlers } from '@/mocks/handlers'
import { handlersResultado } from '@/mocks/handlersResultado'
import { handlersSimulacao } from '@/mocks/handlersSimulacao'

/** Service worker do MSW para dev. Iniciado no main.tsx quando DEV. */
export const worker = setupWorker(...handlers, ...handlersResultado, ...handlersSimulacao)
