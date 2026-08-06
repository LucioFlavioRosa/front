/**
 * Estados do chip de origem/pendencia (funcao chip() do prototipo, linhas
 * 902-903). Cores via tokens. Reutilizado no hub e nas arvores/listas dos grupos.
 */
export interface ChipStatus {
  label: string
  bg: string
  fg: string
  bd: string
}

/** Chip por contagem de pendencias: verde "Completo" (0) ou ambar "N pendências". */
export function chipPendencias(p: number): ChipStatus {
  return p === 0
    ? { label: '✓ Completo', bg: 'var(--ok-bg)', fg: 'var(--ok-text)', bd: 'var(--ok-border-2)' }
    : {
        label: `${p} pendência${p === 1 ? '' : 's'}`,
        bg: 'var(--pend-bg)',
        fg: 'var(--pend-text-2)',
        bd: 'var(--pend-border-2)',
      }
}

/** Chip azul de dado Databricks a conferir (grupo 01). */
export const chipConferir: ChipStatus = {
  label: '🔒 Conferir',
  bg: 'var(--db-bg)',
  fg: 'var(--db-text-2)',
  bd: 'var(--db-border)',
}
