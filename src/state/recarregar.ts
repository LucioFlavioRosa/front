/**
 * "Recarregar do servidor" — a saida para quando o servidor discorda do que
 * temos em maos: 409 ao salvar, ou rascunho recuperado sobre dado que mudou.
 *
 * Nao basta refetch: os efeitos de seed do CadastroContext so preenchem fatia
 * VAZIA (de proposito — senao um refetch de fundo apagaria o que o usuario esta
 * digitando). Entao a recarga de verdade sao tres passos, nesta ordem:
 *
 *   1. apagar o rascunho (senao o provider novo recupera o que foi descartado);
 *   2. zerar o cache das 5 fatias (senao o seed novo usa o dado velho em cache);
 *   3. subir a geracao, que remonta o CadastroProvider (AppShell) do zero.
 *
 * Vive fora do AppContext para nao obrigar todo consumidor dele a ter um
 * QueryClient por perto — quem chama isto ja esta dentro do app com dados.
 */
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from './AppContext'
import { descartarRascunho } from './rascunho'

export function useRecarregarDoServidor() {
  const queryClient = useQueryClient()
  const { novaGeracao } = useApp()

  return useCallback(
    async (unidadeId: string) => {
      descartarRascunho(unidadeId)
      // ESPERA o reset: `resetQueries` limpa o cache e refaz as buscas ativas.
      // Remontar antes de ele terminar abriria uma janela em que o provider novo
      // semeia do cache velho — exatamente o dado que se quis abandonar.
      await queryClient.resetQueries({ queryKey: ['unidades', unidadeId] })
      novaGeracao()
    },
    [queryClient, novaGeracao],
  )
}
