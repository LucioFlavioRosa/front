import styles from './Estado.module.css'

/**
 * Skeleton de carga. Substitui o antigo `return null` das paginas — sem ele a
 * tela fica branca enquanto o mock (e, depois, o backend) responde.
 */
export function Carregando({ label = 'Carregando dados da unidade…' }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.titulo}>{label}</div>
      <div className={styles.barras} aria-hidden="true">
        <div className={styles.barra} style={{ width: '38%' }} />
        <div className={styles.barra} style={{ width: '72%' }} />
        <div className={styles.barra} style={{ width: '55%' }} />
        <div className={styles.barra} style={{ width: '80%' }} />
      </div>
    </div>
  )
}

/**
 * Unidade sem nenhum registro daquele grupo. Sem isto a tela ficava no skeleton
 * para sempre — "carregando" e "nao existe" pareciam a mesma coisa para quem
 * abrisse uma unidade nova, ainda sem base carregada no Databricks.
 */
export function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.titulo}>{titulo}</div>
      <p className={styles.texto}>{texto}</p>
    </div>
  )
}

export interface ErroCargaProps {
  /** O que falhou, na voz do usuario (ex.: "os dados desta unidade"). */
  alvo?: string
  onRetry?: () => void
  /** Uma nova tentativa esta em voo — o botao vira "Tentando…". */
  tentando?: boolean
  /** Mensagem tecnica do erro, quando houver (mono, discreta). */
  detalhe?: string
}

/**
 * Erro de carga com saida: explica o que falhou e oferece "Tentar de novo"
 * (refetch). Sem isto, uma falha de rede deixava a pagina em branco pra sempre.
 */
export function ErroCarga({
  alvo = 'os dados desta unidade',
  onRetry,
  tentando,
  detalhe,
}: ErroCargaProps) {
  return (
    <div className={`${styles.wrap} ${styles.erro}`} role="alert">
      <div className={`${styles.titulo} ${styles.erroTitulo}`}>
        Não foi possível carregar {alvo}
      </div>
      <p className={`${styles.texto} ${styles.erroTexto}`}>
        A conexão com a base falhou. Nada foi perdido — as edições que você já fez continuam nesta
        sessão. Tente de novo; se persistir, avise o time da Base do Otimizador.
      </p>
      <div className={styles.acoes}>
        {onRetry && (
          <button type="button" className={styles.retry} onClick={onRetry} disabled={tentando}>
            {tentando ? 'Tentando…' : 'Tentar de novo'}
          </button>
        )}
        {detalhe && <span className={styles.detalhe}>{detalhe}</span>}
      </div>
    </div>
  )
}
