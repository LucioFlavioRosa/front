import styles from './EmConstrucao.module.css'

/**
 * Marcador honesto de nivel ainda nao implementado.
 *
 * Existe para a casca ser navegavel de ponta a ponta desde a primeira fatia: da
 * para descer os 6 niveis, ver o breadcrumb montar e o seletor de rodada trocar
 * tudo, antes de qualquer grafico existir. Cada fatia troca um destes por tela de
 * verdade — e enquanto nao troca, a tela diz o que falta em vez de fingir.
 */
export function EmConstrucao({
  titulo,
  fatia,
  conteudo,
}: {
  titulo: string
  /** Numero da fatia do plano que preenche esta tela. */
  fatia: number
  /** O que vai aparecer aqui, na voz de quem vai ler. */
  conteudo: string
}) {
  return (
    <section className={styles.wrap} aria-labelledby="em-construcao">
      <h1 className={styles.titulo} id="em-construcao">
        {titulo}
      </h1>
      <p className={styles.texto}>{conteudo}</p>
      <p className={styles.fatia}>
        Navegação e dados já funcionam; o conteúdo desta tela entra na fatia {fatia}.
      </p>
    </section>
  )
}
