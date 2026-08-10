/**
 * QUEM MEXEU NESTA FICHA, E QUANDO — o que substituiu o 409 de ficha.
 *
 * As quatro fichas do cadastro (sub-bacia, CTS, ETE, cidade) carregam estes dois
 * campos, e por isso eles moram aqui em vez de repetidos nos quatro tipos.
 *
 * ## Por que existe
 *
 * Aqui havia `versao`: a impressao do conteudo que o `GET` entregava, o corpo
 * devolvia no `PUT`, e o servidor comparava para responder 409 quando alguem
 * tinha gravado no intervalo. O dono do produto trocou uma coisa pela outra (R6):
 * em vez de BARRAR a gravacao, MOSTRAR quem mexeu.
 *
 * O 409 comparava o hash da ficha INTEIRA. Quem abriu de manha e salvou a tarde
 * perdia o trabalho por causa de um colega que mexeu em OUTRO campo da mesma
 * ficha — ou seja, cobrava o preco de um conflito onde quase nunca havia um.
 *
 * ## O que se perde, dito sem enfeite
 *
 * Duas pessoas na mesma ficha continuam podendo sobrescrever uma a outra, e
 * agora sem aviso NO MOMENTO da gravacao. O sinal passou a ser posterior e
 * legivel. Os caminhos de sobrescrita estao mapeados no backend
 * (`migracoes/006_auditoria_cadastro.sql`).
 *
 * ## Duas regras que valem para os dois campos
 *
 * **Vem sempre do SERVIDOR** — no `GET` e na resposta do `PUT`. O corpo nunca os
 * envia: autoria que o cliente pudesse escolher nao seria auditoria.
 *
 * **NAO entram na assinatura de "ficha suja"** (`assinatura()` em
 * `state/fichas.ts`). Ela mede o que o USUARIO mudou; estes mudam sozinhos a
 * cada gravacao, e inclui-los deixaria toda ficha suja logo depois de salva,
 * com o botao Salvar aceso para sempre.
 */
export interface Auditoria {
  /**
   * Quando a ficha foi gravada pela ultima vez, em ISO-8601 com fuso
   * (`2026-08-10T14:32:00+00:00`). Vazio = nunca gravada pela tela.
   *
   * O servidor manda ISO e nao data formatada de proposito: quem le pode estar
   * em outro fuso, e um "10/08 14:32" escrito la congela o formato. A formatacao
   * e daqui — ver `formatarAuditoria`.
   */
  atualizadoEm: string
  /** Login de quem gravou. Vazio = ficha nunca gravada pela tela. */
  atualizadoPor: string
}

/**
 * Extrai a auditoria de uma resposta do servidor — E SO ELA.
 *
 * Existe porque a resposta do `PUT` traz mais coisas (`id`, `overridesGravados`),
 * e espalhar o objeto inteiro dentro da ficha a contaminaria com campos que nao
 * sao dela. Foi o que aconteceu na primeira versao desta mudanca: a ficha
 * ganhava `overridesGravados`, a auditoria NAO era trocada, e a tela continuava
 * creditando a gravacao a quem tinha salvado antes.
 *
 * Campo ausente vira vazio, e nao fica com o valor anterior: servidor que aceita
 * e nao diz quem gravou nos deixa sem saber, e "nao sei" e uma afirmacao mais
 * honesta que o nome da pessoa errada.
 */
export function auditoriaDe(resposta: Partial<Auditoria> | undefined): Auditoria {
  return {
    atualizadoEm: resposta?.atualizadoEm ?? '',
    atualizadoPor: resposta?.atualizadoPor ?? '',
  }
}

/**
 * `"ana@aegea, 10/08 14:32"` — ou vazio, quando a ficha nunca foi gravada.
 *
 * Vazio e nao "nunca alterada": a coluna so existe desde a migracao, entao
 * "nunca" seria uma afirmacao que o dado nao sustenta para as fichas que vieram
 * da planilha. Quem chama decide o que dizer no lugar.
 *
 * Data invalida tambem devolve vazio. Um `Invalid Date` renderizado na ficha
 * seria pior que a ausencia: parece defeito do cadastro, e nao do payload.
 */
export function formatarAuditoria({ atualizadoEm, atualizadoPor }: Auditoria): string {
  if (!atualizadoPor && !atualizadoEm) return ''
  const quando = atualizadoEm ? new Date(atualizadoEm) : null
  const valida = quando && !Number.isNaN(quando.getTime())
  // Dia e hora em formatos SEPARADOS, unidos por espaco. Um `Intl` unico com os
  // quatro campos devolve `10/08, 11:32` em pt-BR — e com o autor na frente a
  // linha sairia com duas virgulas ("ana@aegea, 10/08, 11:32"), que se le como
  // tres informacoes em vez de duas.
  const dia = valida ? DIA.format(quando) : ''
  const hora = valida ? HORA.format(quando) : ''
  return [atualizadoPor, [dia, hora].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

// Fora da funcao: construir um `Intl.DateTimeFormat` custa, e a lista de fichas
// chama isto uma vez por linha renderizada.
const DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
