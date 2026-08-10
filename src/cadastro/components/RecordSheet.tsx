import type { ReactNode } from 'react'
import type { ChipStatus } from '@/cadastro/lib/chip'
import { MarcaSalvamento } from '@/cadastro/components/MarcaSalvamento'
import { UltimaAlteracao } from '@/cadastro/components/UltimaAlteracao'
import type { Auditoria } from '@/cadastro/domain/auditoria'
import styles from './RecordSheet.module.css'

export interface RecordSheetProps {
  subtitulo?: ReactNode
  titulo: ReactNode
  /** Nome amigavel ao lado do titulo mono. */
  nome?: string
  /**
   * Quem gravou esta ficha por ultimo, e quando.
   *
   * E o que substituiu o 409 (R6 — ver `domain/auditoria.ts`): o servidor nao
   * recusa mais a gravacao de quem leu a ficha antes de um colega salvar, entao
   * este e o unico lugar em que uma pessoa descobre que outra mexeu. Fica no
   * cabecalho da ficha, e nao numa aba de historico, porque a pergunta ("alguem
   * mexeu nisto?") aparece na hora de editar, e nao na de investigar.
   *
   * Ausente ou vazia nao mostra linha nenhuma. Ficha vinda da planilha e nunca
   * gravada pela tela nao tem autor, e escrever "nunca alterada" afirmaria algo
   * que o dado nao sustenta: a coluna so existe desde a migracao.
   */
  auditoria?: Auditoria
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
  auditoria,
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
          <UltimaAlteracao auditoria={auditoria} />
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
