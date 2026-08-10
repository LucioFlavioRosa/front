import { useQuery } from '@tanstack/react-query'
import { api } from '@/comum/api/client'
import type { SubBaciasPayload } from '@/cadastro/domain/subbacia'
import type { ContratoPayload } from '@/cadastro/domain/contrato'
import type { EtesPayload } from '@/cadastro/domain/ete'
import type { HierarquiaPayload } from '@/cadastro/domain/hierarquia'
import type { CtsPayload } from '@/cadastro/domain/cts'
import type { AlteracoesPayload } from '@/cadastro/domain/alteracao'

// Regionais e unidades ficam em `@/comum/api/organizacao`: sao vocabulario das
// tres areas, nao do cadastro.
export const keys = {
  subBacias: (id: string) => ['unidades', id, 'sub-bacias'] as const,
  contrato: (id: string) => ['unidades', id, 'contrato'] as const,
  etes: (id: string) => ['unidades', id, 'etes'] as const,
  hierarquia: (id: string) => ['unidades', id, 'hierarquia'] as const,
  cts: (id: string) => ['unidades', id, 'cts'] as const,
  alteracoes: (id: string, tipo: string, ficha: string) =>
    ['unidades', id, 'alteracoes', tipo, ficha] as const,
}

/**
 * O historico de UMA ficha. Buscado so quando o painel abre (`enabled`), e nao
 * junto da ficha: e volumoso, muda por outro motivo, e ninguem quer paga-lo em
 * toda abertura de tela. Quem quiser so o ultimo evento ja o tem na propria
 * ficha (`atualizadoEm`/`atualizadoPor`).
 *
 * `staleTime: 0` porque a resposta muda a cada gravacao — inclusive a que o
 * usuario acabou de fazer, que e o motivo mais provavel de ele abrir isto.
 */
export function useAlteracoes(
  unidadeId: string | undefined,
  tipo: string,
  fichaId: string | undefined,
  ativo: boolean,
) {
  return useQuery({
    queryKey: keys.alteracoes(unidadeId ?? '—', tipo, fichaId ?? '—'),
    queryFn: () =>
      api.get<AlteracoesPayload>(
        `/unidades/${unidadeId}/alteracoes?tipo=${encodeURIComponent(tipo)}` +
          `&fichaId=${encodeURIComponent(fichaId as string)}`,
      ),
    enabled: ativo && !!unidadeId && !!fichaId,
    staleTime: 0,
  })
}

export function useSubBacias(id: string | undefined) {
  return useQuery({
    queryKey: keys.subBacias(id ?? '—'),
    queryFn: () => api.get<SubBaciasPayload>(`/unidades/${id}/sub-bacias`),
    enabled: !!id,
  })
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: keys.contrato(id ?? '—'),
    queryFn: () => api.get<ContratoPayload>(`/unidades/${id}/contrato`),
    enabled: !!id,
  })
}

export function useEtes(id: string | undefined) {
  return useQuery({
    queryKey: keys.etes(id ?? '—'),
    queryFn: () => api.get<EtesPayload>(`/unidades/${id}/etes`),
    enabled: !!id,
  })
}

export function useHierarquia(id: string | undefined) {
  return useQuery({
    queryKey: keys.hierarquia(id ?? '—'),
    queryFn: () => api.get<HierarquiaPayload>(`/unidades/${id}/hierarquia`),
    enabled: !!id,
  })
}

export function useCts(id: string | undefined) {
  return useQuery({
    queryKey: keys.cts(id ?? '—'),
    queryFn: () => api.get<CtsPayload>(`/unidades/${id}/cts`),
    enabled: !!id,
  })
}
