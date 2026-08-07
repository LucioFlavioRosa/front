import { useId } from 'react'
import { fieldStyle } from '@/cadastro/lib/fieldState'
import styles from './FieldRow.module.css'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldRowProps {
  rotulo: string
  /** Nome tecnico da coluna (mono, linha de baixo). */
  tecnico?: string
  /** Texto de ajuda (linha inferior, coluna esquerda). */
  ajuda?: string
  valor: string
  onChange?: (v: string) => void
  /** Clique no "?" — normalmente abre o verbete no painel de dicionario. */
  onHelp?: () => void
  /** Sufixo de unidade a direita do input. */
  unidade?: string
  placeholder?: string
  /** input (padrao) · select (dropdown) · calc (ƒ calculado, cinza, so leitura). */
  variant?: 'input' | 'select' | 'calc'
  /** Opcoes para variant="select". */
  options?: FieldOption[]
  /**
   * Campo que EXISTE mas nao se preenche agora (ex.: populacao numa cidade que
   * mede a meta por ligacoes). Diferente de `calc`: aquele nunca e digitavel;
   * este volta a ser quando a regra mudar.
   */
  bloqueado?: boolean
  /** Por que esta bloqueado — vira `title` e entra no aria-describedby. */
  motivoBloqueio?: string
}

/**
 * Linha de campo: grid [rotulo+? / nome tecnico] | [controle + unidade], com
 * ajuda opcional. O controle troca de cor pelo estado (vazio=pendente ambar;
 * preenchido=verde); "calc" e sempre cinza (campos ƒ, nunca editaveis).
 *
 * Acessibilidade: o rotulo e um <label> ligado ao controle e a unidade/ajuda
 * entram no aria-describedby — um leitor de tela anuncia "Vazão nova, L/s" em
 * vez de um campo sem nome. O "?" e botao de verdade (alcancavel por Tab).
 */
const BLOQUEADO = {
  border: '1.5px solid var(--border)',
  background: 'var(--surface-2, #f4f5f7)',
}

export function FieldRow({
  rotulo,
  tecnico,
  ajuda,
  valor,
  onChange,
  onHelp,
  unidade,
  placeholder,
  variant = 'input',
  options = [],
  bloqueado = false,
  motivoBloqueio,
}: FieldRowProps) {
  // Campo bloqueado NAO usa o estilo de pendencia: vazio-e-ambar significa
  // "falta voce preencher", e aqui nao falta nada — nao ha o que preencher.
  // Pintar de ambar seria a tela cobrando uma acao que ela mesma impede.
  const fs = bloqueado ? BLOQUEADO : fieldStyle(valor)
  const id = useId()
  const idCampo = `${id}-campo`
  const idUnidade = `${id}-unidade`
  const idAjuda = `${id}-ajuda`
  const idBloqueio = `${id}-bloqueio`
  const descrito =
    [unidade && idUnidade, ajuda && idAjuda, bloqueado && motivoBloqueio && idBloqueio]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className={styles.row}>
      <div>
        <label className={styles.rotulo} htmlFor={idCampo}>
          {rotulo}
        </label>
        {onHelp && (
          <button
            type="button"
            className={styles.help}
            onClick={onHelp}
            aria-label={`O que é "${rotulo}"?`}
          >
            ?
          </button>
        )}
        {tecnico && <div className={styles.tecnico}>{tecnico}</div>}
      </div>

      <div className={styles.control}>
        {variant === 'input' && (
          <input
            id={idCampo}
            className={styles.input}
            style={{ border: fs.border, background: fs.background }}
            value={valor}
            placeholder={bloqueado ? '' : placeholder}
            aria-describedby={descrito}
            disabled={bloqueado}
            title={bloqueado ? motivoBloqueio : undefined}
            onChange={(e) => onChange?.(e.target.value)}
          />
        )}
        {variant === 'select' && (
          <select
            id={idCampo}
            className={styles.select}
            style={{ border: fs.border, background: fs.background }}
            value={valor}
            aria-describedby={descrito}
            onChange={(e) => onChange?.(e.target.value)}
          >
            <option value="">— escolher —</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {/* Campo ƒ: nao editavel, mas precisa do id para o <label> apontar. */}
        {variant === 'calc' && (
          <output id={idCampo} className={styles.calc}>
            {valor}
          </output>
        )}
        {unidade && (
          <span className={styles.unidade} id={idUnidade}>
            {unidade}
          </span>
        )}
      </div>

      {ajuda && (
        <div className={styles.ajuda} id={idAjuda}>
          {ajuda}
        </div>
      )}

      {bloqueado && motivoBloqueio && (
        <div className={styles.ajuda} id={idBloqueio}>
          {motivoBloqueio}
        </div>
      )}
    </div>
  )
}
