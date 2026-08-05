import type { ChipStatus } from '../lib/chip'
import styles from './GroupCard.module.css'

export interface GroupCardProps {
  n: string
  titulo: string
  descricao: string
  origem: string
  linhas: string
  chip: ChipStatus
  onClick: () => void
}

/**
 * Card de grupo do hub: numero + titulo, chip de pendencias/origem, descricao e
 * rodape "linhas · origem" + "Abrir →". A borda acompanha a cor do chip.
 */
export function GroupCard({ n, titulo, descricao, origem, linhas, chip, onClick }: GroupCardProps) {
  return (
    <button
      type="button"
      className={styles.card}
      style={{ borderColor: chip.bd }}
      onClick={onClick}
    >
      <div className={styles.top}>
        <div className={styles.titleWrap}>
          <span className={styles.n}>{n}</span>
          <span className={styles.titulo}>{titulo}</span>
        </div>
        <span
          className={styles.chip}
          style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}
        >
          {chip.label}
        </span>
      </div>

      <div className={styles.desc}>{descricao}</div>

      <div className={styles.footer}>
        <span className={styles.rows}>
          {linhas} · <span className={styles.origem}>{origem}</span>
        </span>
        <span className={styles.abrir}>Abrir →</span>
      </div>
    </button>
  )
}
