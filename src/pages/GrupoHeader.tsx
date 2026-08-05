import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './grupo.module.css'

export interface GrupoHeaderProps {
  titulo: string
  sub: ReactNode
  /** Chip de pendencias, botao Salvar etc. (alinhados a direita). */
  children?: ReactNode
}

/**
 * Cabecalho comum aos 4 grupos: voltar + titulo + subtitulo + acoes. Extraido
 * para que os estados de carga/erro tambem o mostrem — sem ele o usuario perdia
 * o caminho de volta ao hub quando a carga falhava.
 */
export function GrupoHeader({ titulo, sub, children }: GrupoHeaderProps) {
  const { unidadeId } = useParams()
  const navigate = useNavigate()

  return (
    <div className={styles.groupHeader}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate(`/unidade/${unidadeId}`)}
        aria-label="Voltar para o hub da unidade"
      >
        ←
      </button>
      <div>
        <h2 className={styles.h2}>{titulo}</h2>
        <div className={styles.groupSub}>{sub}</div>
      </div>
      {children && <div className={styles.headActions}>{children}</div>}
    </div>
  )
}
