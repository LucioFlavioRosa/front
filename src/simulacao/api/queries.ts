import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { simulacao } from '@/simulacao/api/endpoints'
import type { CorpoNovaRodada } from '@/simulacao/domain/simulacao'

export const chavesSimulacao = {
  prontidao: (unidadeId: string) => ['unidades', unidadeId, 'prontidao'] as const,
  status: (runId: string) => ['runs', runId, 'status'] as const,
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
      void qc.invalidateQueries({ queryKey: ['runs', 'lista'] })
    },
  })
}

/**
 * Acompanha a rodada em voo.
 *
 * `refetchInterval` so enquanto ela nao terminou — parar de perguntar quando a
 * resposta nao muda mais e o minimo de respeito com o backend. E `enabled` so
 * com `runId`, entao nao ha polling nenhum antes de o usuario iniciar.
 */
export function useStatusRodada(runId: string | undefined) {
  return useQuery({
    queryKey: chavesSimulacao.status(runId ?? '—'),
    queryFn: () => simulacao.status(runId as string),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'PENDENTE' || s === 'RODANDO' ? 1200 : false
    },
  })
}

export function useCancelarRodada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => simulacao.cancelar(runId),
    onSuccess: (_d, runId) => {
      void qc.invalidateQueries({ queryKey: chavesSimulacao.status(runId) })
    },
  })
}
