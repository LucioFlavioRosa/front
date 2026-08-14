/**
 * O VERBETE — a unidade do dicionario de dados, e agora tambem do de parametros.
 *
 * Mora em `comum/` porque DUAS areas o preenchem: o cadastro explica as colunas
 * que a pessoa digita, e a simulacao explica os parametros da rodada. O painel
 * que os exibe e um so, e quem junta os dois e a raiz de composicao (`app/`) —
 * `comum/` nao conhece area nenhuma, e as areas nao se conhecem entre si.
 *
 * A forma e a mesma dos dois lados de proposito: quem aprendeu a ler o verbete
 * de um campo do cadastro nao precisa aprender outro formato ao abrir o de um
 * parametro da simulacao.
 */
export interface Verbete {
  rotulo: string
  tec: string
  /** De onde o valor vem. No cadastro: "Databricks" ou "voce preenche". Na
   *  simulacao: quem decide — "voce escolhe" ou "fixo nesta versao". */
  origem: string
  tipo: string
  oque: string
  porque: string
  exemplo: string
}

/**
 * Cor do selo de origem. O criterio e o MESMO das celulas do cadastro: o que vem
 * do Databricks (travado) tem uma cor, o que a pessoa preenche tem outra.
 *
 * Na simulacao a leitura e analoga: "fixo nesta versao" usa o tom do travado,
 * porque e a mesma mensagem — este valor nao esta na sua mao.
 */
export function origemStyle(origem: string): {
  background: string
  color: string
  borderColor: string
} {
  const travado = origem.includes('Databricks') || origem.includes('fixo')
  return travado
    ? { background: 'var(--db-bg)', color: 'var(--db-text-2)', borderColor: 'var(--db-border)' }
    : {
        background: 'var(--pend-bg)',
        color: 'var(--pend-text-3)',
        borderColor: 'var(--pend-border-2)',
      }
}
