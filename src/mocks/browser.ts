import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { handlersResultado } from './handlersResultado'
import { handlersSimulacao } from './handlersSimulacao'

/** Service worker do MSW para dev. Iniciado no main.tsx quando DEV. */
export const worker = setupWorker(...handlers, ...handlersResultado, ...handlersSimulacao)
