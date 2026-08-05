import styles from './MarcaSalvamento.module.css'

/**
 * Selo ao lado do botao Salvar: diz se a ficha aberta tem edicao que o servidor
 * ainda nao recebeu. Sozinho, um botao desabilitado nao explica o porque.
 *
 * `aria-live="polite"` porque a mudanca de estado e consequencia de outra acao
 * (digitar, salvar) e nao tem foco proprio — sem isso, quem usa leitor de tela
 * so descobre que o botao travou ao chegar nele.
 */
export function MarcaSalvamento({ sujo }: { sujo: boolean }) {
  return (
    <span
      className={`${styles.marca} ${sujo ? styles.sujo : styles.limpo}`}
      aria-live="polite"
      data-estado={sujo ? 'nao-salvo' : 'salvo'}
    >
      {sujo ? 'Alterações não salvas' : 'Salvo'}
    </span>
  )
}
