import { useId, type ReactNode } from 'react'
import styles from './DbCard.module.css'

export interface DbCardProps {
  /** Titulo mono uppercase do header (ex.: "Base comercial — veio do Databricks 🔒"). */
  titulo: string
  editando: boolean
  /** Alterna o modo de edicao. Em uso real, passa antes pelo ConfirmModal. */
  onToggleEdit: () => void
  /**
   * Explicacoes de rodape — uma por paragrafo (por que os campos de populacao
   * estao ali, como se le o recorte industrial). Viram a descricao acessivel do
   * card inteiro, nao texto solto ao lado.
   */
  notas?: ReactNode[]
  children: ReactNode
}

/**
 * Card de dado do Databricks (travado): header cyan com titulo + botao "Editar
 * dados do Databricks" (vira "✓ Concluir edição"), banner ambar de aviso quando
 * em edicao, e corpo com as celulas (DbField).
 */
export function DbCard({ titulo, editando, onToggleEdit, notas = [], children }: DbCardProps) {
  const id = useId()
  const idTitulo = `${id}-tit`
  const idsNotas = notas.map((_, i) => `${id}-nota-${i}`)

  return (
    <div
      className={styles.card}
      role="group"
      aria-labelledby={idTitulo}
      aria-describedby={idsNotas.join(' ') || undefined}
    >
      <div className={styles.header}>
        <span className={styles.titulo} id={idTitulo}>
          {titulo}
        </span>
        <button
          type="button"
          className={`${styles.toggle} ${editando ? styles.toggleOn : ''}`}
          onClick={onToggleEdit}
        >
          {editando ? '✓ Concluir edição' : 'Editar dados do Databricks'}
        </button>
      </div>

      {editando && (
        <div className={styles.banner}>
          <strong>⚠ Modo de correção.</strong> Alterações sobrescrevem o valor do Databricks, ficam
          marcadas como override e registradas no histórico da unidade.
        </div>
      )}

      <div className={styles.body}>
        {children}
        {notas.map((nota, i) => (
          <p className={styles.nota} id={idsNotas[i]} key={idsNotas[i]}>
            {nota}
          </p>
        ))}
      </div>
    </div>
  )
}

export interface DbFieldProps {
  rotulo: string
  valor: string
  unidade?: string
  editando: boolean
  onChange?: (v: string) => void
  /**
   * Campo derivado de outros (ƒ): nunca vira input, nem no modo de correcao.
   * Corrigir o resultado sem corrigir as parcelas so criaria contradicao — quem
   * muda o numero e quem edita os campos de origem.
   */
  calculado?: boolean
  /** Uma linha abaixo do valor, para explicar de onde ele sai. */
  hint?: string
  /**
   * Campo do trio que e a regua da meta desta cidade. Marca visual (barra) +
   * texto so para leitor de tela — cor sozinha nao conta como informacao.
   */
  ativo?: boolean
  /** Abre o verbete do dicionario — o "?" so aparece quando ha verbete. */
  onHelp?: () => void
}

/** Celula de valor do Databricks: leitura (cyan) ou input de override (ambar). */
export function DbField({
  rotulo,
  valor,
  unidade,
  editando,
  onChange,
  calculado,
  hint,
  ativo,
  onHelp,
}: DbFieldProps) {
  const id = useId()
  const idRotulo = `${id}-rot`
  const idHint = `${id}-hint`
  const editavel = editando && !calculado
  // Entra no NOME do campo, nao numa descricao: quem navega por formulario ouve
  // "População — universo, régua da meta desta cidade" e sabe qual preencher.
  const selo = ativo ? <span className={styles.selo}> — régua da meta desta cidade</span> : null
  // Fora do <label>: o "?" e um controle proprio, nao parte do nome do campo.
  const ajuda = onHelp ? (
    <button
      type="button"
      className={styles.ajuda}
      aria-label={`O que é "${rotulo}"?`}
      onClick={onHelp}
    >
      ?
    </button>
  ) : null

  return (
    <div className={`${styles.field} ${ativo ? styles.fieldAtivo : ''}`}>
      {/* Em modo de leitura nao existe controle: o rotulo volta a ser um div. */}
      {editavel ? (
        <div className={styles.fieldRotulo}>
          <label htmlFor={id}>
            {rotulo}
            {selo}
          </label>
          {ajuda}
        </div>
      ) : (
        <div className={styles.fieldRotulo}>
          <span id={idRotulo}>
            {rotulo}
            {selo}
          </span>
          {ajuda}
        </div>
      )}
      {editavel ? (
        <input
          id={id}
          className={styles.fieldInput}
          value={valor}
          aria-describedby={hint ? idHint : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : calculado ? (
        // <output> e o elemento do resultado de um calculo: o leitor de tela o
        // anuncia sozinho quando o numero muda (aria-live implicito), e o
        // aria-labelledby amarra rotulo e valor, que sao divs irmas.
        <output
          className={styles.fieldCalc}
          aria-labelledby={idRotulo}
          aria-describedby={hint ? idHint : undefined}
        >
          {valor} {unidade && <span className={styles.fieldUnidade}>{unidade}</span>}
        </output>
      ) : (
        <div className={styles.fieldValor}>
          {valor} {unidade && <span className={styles.fieldUnidade}>{unidade}</span>}
        </div>
      )}
      {hint && (
        <div className={styles.fieldHint} id={idHint}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Grade de 4 colunas para agrupar DbFields (layout do prototipo). */
export function DbFieldGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid4}>{children}</div>
}
