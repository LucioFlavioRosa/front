import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** Service worker do MSW para dev. Iniciado no main.tsx quando DEV. */
export const worker = setupWorker(...handlers)
