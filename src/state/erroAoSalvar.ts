/**
 * O que a tela faz quando uma gravacao falha.
 *
 * Quase tudo vira toast (a edicao continua na tela, o usuario tenta de novo).
 * O 409 e diferente: dizer "recarregue" num toast nao ajudava, porque recarregar
 * a pagina NAO trazia a versao nova — os efeitos de seed so preenchem fatia
 * vazia e o rascunho reidratava o estado antigo. Entao o 409 abre a confirmacao
 * que realmente resolve: descartar o local e resemear do servidor.
 */
import { useCallback } from 'react'
import { ApiError } from '../api/client'
import { mensagemDeErro } from '../api/mutations'
import { useApp } from './AppContext'
import { useCadastro } from './CadastroContext'
import { useRecarregarDoServidor } from './recarregar'

export function useErroAoSalvar(unidadeId: string | undefined) {
  const { toast, askConfirm } = useApp()
  const recarregarDoServidor = useRecarregarDoServidor()
  const { sujas, hierEditada } = useCadastro()

  return useCallback(
    (erro: unknown) => {
      if (!(erro instanceof ApiError) || !erro.conflito || !unidadeId) {
        toast(mensagemDeErro(erro))
        return
      }
      // O recarregar descarta TUDO o que e local nesta unidade, nao so as
      // fichas: as correcoes de hierarquia vao junto e precisam ser ditas.
      const n = sujas.length
      const fichas =
        n === 0
          ? ''
          : n === 1
            ? 'a ficha que você ainda não salvou'
            : `as ${n} fichas que você ainda não salvou`
      const perdas = [fichas, hierEditada ? 'as correções de hierarquia' : '']
        .filter(Boolean)
        .join(' e ')
      askConfirm({
        titulo: 'Outra pessoa salvou esta ficha antes',
        texto:
          'O servidor tem uma versão mais nova desta ficha. Recarregar traz a versão dele e ' +
          `descarta ${perdas || 'as edições locais'} nesta unidade. ` +
          'Cancelar mantém tudo como está — dá para copiar o que você digitou antes de recarregar.',
        confirmarLabel: 'Recarregar do servidor',
        onConfirm: () => void recarregarDoServidor(unidadeId),
      })
    },
    [toast, askConfirm, recarregarDoServidor, sujas.length, hierEditada, unidadeId],
  )
}
