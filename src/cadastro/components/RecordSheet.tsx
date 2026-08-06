import type { ReactNode } from 'react'
import type { ChipStatus } from '@/cadastro/lib/chip'
import { MarcaSalvamento } from '@/cadastro/components/MarcaSalvamento'
import styles from './RecordSheet.module.css'

export interface RecordSheetProps {
  subtitulo?: ReactNode
  titulo: ReactNode
  /** Nome amigavel ao lado do titulo mono. */
  nome?: string
  chip?: ChipStatus
  onSalvar?: () => void
  salvarLabel?: string
  /** Gravacao em voo: trava o botao para nao salvar duas vezes. */
  salvando?: boolean
  /** Ha edicao que o servidor ainda nao recebeu (default: true). */
  sujo?: boolean
  /** Motivo para travar o Salvar agora (ex.: remocao em voo). Vira o title. */
  impedimento?: string
  children: ReactNode
}

/**
 * Ficha de detalhe (painel direito): cabecalho com subtitulo, titulo mono +
 * nome, chip de pendencias e botao "Salvar" verde; abaixo, os cards empilhados.
 */
export function RecordSheet({
  subtitulo,
  titulo,
  nome,
  chip,
  onSalvar,
  salvarLabel = 'Salvar',
  salvando,
  sujo = true,
  impedimento,
  children,
}: RecordSheetProps) {
  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <div>
          {subtitulo && <div className={styles.subtitulo}>{subtitulo}</div>}
          <div className={styles.titulo}>
            {titulo} {nome && <span className={styles.nome}>{nome}</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {chip && (
            <span
              className={styles.chip}
              style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}
            >
              {chip.label}
            </span>
          )}
          {onSalvar && (
            <>
              <MarcaSalvamento sujo={sujo} />
              <button
                type="button"
                className={`${styles.salvar} ${!sujo && !salvando ? styles.semMudanca : ''}`}
                onClick={onSalvar}
                disabled={salvando || !sujo || !!impedimento}
                title={impedimento ?? (sujo ? undefined : 'Nada mudou desde o último salvamento')}
              >
                {salvando ? 'Salvando…' : salvarLabel}
              </button>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}
