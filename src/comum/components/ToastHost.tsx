import { useEffect } from 'react'
import { useApp } from '@/comum/state/AppContext'
import type { ToastItem } from '@/comum/state/AppContext'
import styles from './ToastHost.module.css'

/**
 * Fila de toasts fixa no canto inferior direito; cada um some em ~2,6s.
 *
 * O timer vive em cada toast (nao na fila): antes um toast novo remontava o
 * efeito e reiniciava a contagem de todos os anteriores, que ficavam na tela
 * bem mais que os 2,6s prometidos.
 */
export function ToastHost() {
  const { toasts, dismissToast } = useApp()

  if (toasts.length === 0) return null

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

const DURACAO_MS = 2600

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURACAO_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={styles.toast}>
      <span>{toast.mensagem}</span>
      <button
        type="button"
        className={styles.fechar}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dispensar aviso"
      >
        ✕
      </button>
    </div>
  )
}
