import { ApiError } from '@/comum/api/client'
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
  /**
   * O erro que a query devolveu. Serve para distinguir 404 de queda de conexao:
   * o servidor recorta por usuario, e o que nao e seu responde 404.
   */
  erro?: unknown
  /**
   * Diz "sem acesso" sem precisar de um erro. Para o caso em que o servidor
   * respondeu 200 com lista VAZIA — que é a resposta correta para quem não tem
   * escopo, e não um erro. Sem isto o chamador teria de fabricar um `ApiError`
   * falso só para alcançar o texto certo.
   */
  semAcesso?: boolean
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
  erro,
  semAcesso: semAcessoProp,
}: ErroCargaProps) {
  // 404 é OUTRA COISA, e tratá-lo como queda de conexão produzia a pior
  // combinação possível: um título falso ("não foi possível carregar"), uma
  // promessa que este componente não tem como fazer ("nada foi perdido"), e um
  // botão de tentar de novo que nunca vai funcionar.
  //
  // O servidor recorta por usuário: unidade fora do escopo e rodada de outra
  // pessoa respondem 404 — e não 403, de propósito, porque 403 confirmaria que
  // existe. Aqui a tela precisa dizer isso sem prometer que existe também.
  const semAcesso = semAcessoProp || (erro instanceof ApiError && erro.status === 404)

  return (
    <div className={`${styles.wrap} ${styles.erro}`} role="alert">
      <div className={`${styles.titulo} ${styles.erroTitulo}`}>
        {semAcesso ? `Sem acesso a ${alvo}` : `Não foi possível carregar ${alvo}`}
      </div>
      <p className={`${styles.texto} ${styles.erroTexto}`}>
        {semAcesso
          ? 'Isto não existe ou não está liberado para o seu usuário. Tentar de novo não resolve — se você deveria ter acesso, peça a liberação ao time da Base do Otimizador.'
          : 'A conexão com a base falhou. Nada foi perdido — as edições que você já fez continuam nesta sessão. Tente de novo; se persistir, avise o time da Base do Otimizador.'}
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
