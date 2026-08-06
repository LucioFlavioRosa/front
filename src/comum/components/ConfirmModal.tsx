import { useCallback, useEffect, useRef } from 'react'
import { useApp } from '@/comum/state/AppContext'
import { Icon } from '@/comum/lib/Icon'
import styles from './ConfirmModal.module.css'

/**
 * Modal de confirmacao para editar dado do Databricks (override).
 * Backdrop fecha; clique no card nao propaga.
 *
 * Acessibilidade: Esc fecha, o foco entra no "Cancelar" (opcao segura), fica
 * preso dentro do card enquanto aberto e volta para o botao de origem ao fechar
 * — sem isso o teclado continuava navegando a pagina atras do overlay.
 */
export function ConfirmModal() {
  const { confirm, closeConfirm } = useApp()
  // Fechar sem confirmar e uma resposta, nao um nao-evento: quem pediu a
  // confirmacao pode precisar desfazer algo (a guarda de saida, por exemplo,
  // tem de liberar o bloqueio de navegacao que ela mesma criou).
  const cancelar = useCallback(() => {
    confirm?.onCancel?.()
    closeConfirm()
  }, [confirm, closeConfirm])
  const cardRef = useRef<HTMLDivElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const origemRef = useRef<HTMLElement | null>(null)
  const aberto = !!confirm

  // Guarda quem abriu, poe o foco no card e devolve o foco ao fechar.
  useEffect(() => {
    if (!aberto) return
    origemRef.current = document.activeElement as HTMLElement | null
    cancelarRef.current?.focus()
    return () => {
      // A propria acao confirmada pode ter desmontado o gatilho (ex.: "Remover
      // CTS" apaga o botao que abriu o modal). Focar um elemento desconectado
      // joga o foco no <body> e o teclado volta ao inicio da pagina; nesse caso
      // caimos no <main>, que e o alvo do skip link.
      const origem = origemRef.current
      if (origem?.isConnected) origem.focus()
      else document.getElementById('conteudo')?.focus()
    }
  }, [aberto])

  // Esc fecha; Tab circula apenas entre os controles do card.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelar()
        return
      }
      if (e.key !== 'Tab') return
      const focaveis = cardRef.current?.querySelectorAll<HTMLElement>('button')
      if (!focaveis?.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, cancelar])

  if (!confirm) return null

  return (
    <div className={styles.overlay} onClick={cancelar} role="presentation">
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.title} id="confirm-title">
          <Icon name="warning" className={styles.warn} /> {confirm.titulo}
        </div>
        <p className={styles.text} id="confirm-text">
          {confirm.texto}
        </p>
        <div className={styles.actions}>
          <button type="button" ref={cancelarRef} className={styles.btn} onClick={cancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.confirm}`}
            onClick={() => {
              confirm.onConfirm()
              closeConfirm()
            }}
          >
            {confirm.confirmarLabel ?? 'Sim, editar'}
          </button>
        </div>
      </div>
    </div>
  )
}
