import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chavesRodada } from '@/comum/api/rodada'
import { simulacao } from '@/simulacao/api/endpoints'
import type { CorpoNovaRodada } from '@/simulacao/domain/simulacao'

const chavesSimulacao = {
  prontidao: (unidadeId: string) => ['unidades', unidadeId, 'prontidao'] as const,
}

/**
 * Pendencias do cadastro da unidade.
 *
 * `staleTime: 0` de proposito, ao contrario de quase tudo no lado de resultado:
 * o usuario pode abrir o cadastro noutra aba, completar os campos e voltar. Se a
 * tela seguisse mostrando o numero velho, ela bloquearia uma rodada que ja pode
 * rodar — e o usuario nao teria como saber por que.
 */
export function useProntidao(unidadeId: string | undefined) {
  return useQuery({
    queryKey: chavesSimulacao.prontidao(unidadeId ?? '—'),
    queryFn: () => simulacao.prontidao(unidadeId as string),
    enabled: !!unidadeId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

/**
 * Dispara a rodada.
 *
 * O `onSuccess` invalida a lista do historico no NIVEL DO HOOK: a rodada nova
 * tem de aparecer la mesmo que o usuario saia desta tela antes de a resposta
 * chegar. E a mesma licao do caminho de escrita do cadastro.
 */
export function useCriarRodada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (corpo: CorpoNovaRodada) => simulacao.criar(corpo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesRodada.lista })
    },
  })
}

/**
 * Cancela uma rodada em voo.
 *
 * Invalidar o STATUS e a parte que se esquece: sem isso o modal segue exibindo
 * RODANDO depois de o cancelamento ter sido aceito, e o usuario clica de novo.
 * A lista tambem, porque o card do historico mostra o mesmo estado.
 */
export function useCancelarRodada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => simulacao.cancelar(runId),
    onSuccess: (_d, runId) => {
      void qc.invalidateQueries({ queryKey: chavesRodada.status(runId) })
      void qc.invalidateQueries({ queryKey: chavesRodada.lista })
    },
  })
}
