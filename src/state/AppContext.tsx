import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'

/** Pedido de confirmacao (modal) — override de dado do Databricks, saida com
 *  edicao pendente, remocao de CTS. */
export interface ConfirmRequest {
  titulo: string
  texto: string
  onConfirm: () => void
  /** Rotulo do botao de acao (default: "Sim, editar"). */
  confirmarLabel?: string
  /** Fechou sem confirmar (Cancelar, Esc ou clique fora). */
  onCancel?: () => void
}

export interface ToastItem {
  id: number
  mensagem: string
}

interface AppState {
  /** Chave do verbete aberto no painel de dicionario (null = fechado). */
  dictKey: string | null
  /** Pedido de confirmacao ativo (null = sem modal). */
  confirm: ConfirmRequest | null
  toasts: ToastItem[]
  /**
   * Contador de recargas forcadas do cadastro. Entra na `key` do
   * CadastroProvider (AppShell): subir o numero desmonta o store e obriga um
   * seed novo. E o unico jeito de trocar dado ja carregado — os efeitos de seed
   * so preenchem fatia vazia, de proposito (senao um refetch de fundo apagaria
   * o que o usuario esta digitando).
   */
  geracaoDados: number
}

type Action =
  | { type: 'OPEN_DICT'; key: string }
  | { type: 'CLOSE_DICT' }
  | { type: 'ASK_CONFIRM'; req: ConfirmRequest }
  | { type: 'CLOSE_CONFIRM' }
  | { type: 'PUSH_TOAST'; toast: ToastItem }
  | { type: 'DISMISS_TOAST'; id: number }
  | { type: 'NOVA_GERACAO' }

const initialState: AppState = {
  dictKey: null,
  confirm: null,
  toasts: [],
  geracaoDados: 0,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'OPEN_DICT':
      return { ...state, dictKey: action.key }
    case 'CLOSE_DICT':
      return { ...state, dictKey: null }
    case 'ASK_CONFIRM':
      return { ...state, confirm: action.req }
    case 'CLOSE_CONFIRM':
      return { ...state, confirm: null }
    case 'PUSH_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'NOVA_GERACAO':
      return { ...state, geracaoDados: state.geracaoDados + 1 }
    default:
      return state
  }
}

interface AppContextValue extends AppState {
  openDict: (key: string) => void
  closeDict: () => void
  askConfirm: (req: ConfirmRequest) => void
  closeConfirm: () => void
  toast: (mensagem: string) => void
  dismissToast: (id: number) => void
  /** Descarta o store do cadastro e obriga um seed novo (ver `geracaoDados`).
   *  Quem chama e `useRecarregarDoServidor`, que limpa cache e rascunho antes. */
  novaGeracao: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

// Contador de ids de toast fora do render (Date.now/Math.random evitados por
// determinismo; um contador simples basta para chaves de lista).
let toastSeq = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const openDict = useCallback((key: string) => dispatch({ type: 'OPEN_DICT', key }), [])
  const closeDict = useCallback(() => dispatch({ type: 'CLOSE_DICT' }), [])
  const askConfirm = useCallback(
    (req: ConfirmRequest) => dispatch({ type: 'ASK_CONFIRM', req }),
    [],
  )
  const closeConfirm = useCallback(() => dispatch({ type: 'CLOSE_CONFIRM' }), [])
  const dismissToast = useCallback((id: number) => dispatch({ type: 'DISMISS_TOAST', id }), [])
  const novaGeracao = useCallback(() => dispatch({ type: 'NOVA_GERACAO' }), [])
  const toast = useCallback((mensagem: string) => {
    const id = ++toastSeq
    dispatch({ type: 'PUSH_TOAST', toast: { id, mensagem } })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      openDict,
      closeDict,
      askConfirm,
      closeConfirm,
      toast,
      dismissToast,
      novaGeracao,
    }),
    [state, openDict, closeDict, askConfirm, closeConfirm, toast, dismissToast, novaGeracao],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return ctx
}
