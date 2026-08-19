/**
 * O que a tela faz quando uma gravacao falha: toast, e a edicao continua aqui.
 *
 * Este modulo existia por causa de UM caso — o 409. Dizer "recarregue" num toast
 * nao resolvia, porque recarregar a pagina nao trazia a versao nova (os efeitos
 * de seed so preenchem fatia vazia, e o rascunho reidratava o estado antigo);
 * entao ele abria a confirmacao de descartar o local e resemear do servidor.
 *
 * O 409 de ficha SAIU (R6 — ver `domain/auditoria.ts`). A escrita de cadastro
 * nao responde mais esse codigo, e um ramo para uma resposta impossivel e pior
 * que ramo nenhum: ninguem consegue testa-lo, e ele envelhece afirmando algo
 * falso sobre o servidor.
 *
 * O fluxo de "recarregar do servidor" continua vivo e nao foi perdido junto: ele
 * e oferecido pelo `CadastroContext` quando um RASCUNHO local diverge do que a
 * rede acabou de trazer, que e a outra situacao em que ele resolve de verdade.
 *
 * O hook permanece — as quatro telas o chamam, e ter um so lugar para "o que
 * fazer quando o Salvar falha" e o que faz as quatro concordarem no dia em que
 * houver um caso novo.
 */
import { useCallback } from 'react'
import { mensagemDeErro } from '@/cadastro/api/mutations'
import { useApp } from '@/comum/state/AppContext'

/**
 * `formatar` troca so o TEXTO, e nao o que a tela faz com a falha.
 *
 * A topologia precisa disso: o 422 dela nao e "confira os campos preenchidos", e
 * sim a frase do servidor nomeando o ciclo ou quem escoa para o componente. O
 * resto do comportamento — toast, edicao continua na tela — segue igual para
 * todas, que e o motivo deste modulo existir.
 */
export function useErroAoSalvar(
  _unidadeId: string | undefined,
  formatar: (erro: unknown) => string = mensagemDeErro,
) {
  const { toast } = useApp()
  return useCallback((erro: unknown) => toast(formatar(erro)), [toast, formatar])
}
