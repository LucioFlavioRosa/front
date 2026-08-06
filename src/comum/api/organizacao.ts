/**
 * Regionais e unidades — a estrutura organizacional da Aegea.
 *
 * Mora em `comum/` e nao em `cadastro/` porque nao e vocabulario de uma area: o
 * cadastro escolhe a unidade que vai editar, a simulacao escolhe a unidade que vai
 * rodar, e o resultado exibe o nome da unidade da rodada. Enquanto isto vivia em
 * `cadastro/api/queries.ts`, a tela de simulacao importava do cadastro — que e
 * exatamente o atalho que a regra de fronteira do ESLint recusa.
 *
 * As `chaves` ficam com os hooks: quem invalida cache precisa da mesma chave que
 * quem le, e separar as duas coisas e como esses pares se perdem.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/comum/api/client'
import type { Regional, Unidade } from '@/comum/domain/organizacao'

export const chavesOrganizacao = {
  regionais: ['regionais'] as const,
  unidades: (regionalId: string) => ['regionais', regionalId, 'unidades'] as const,
  unidade: (id: string) => ['unidades', id] as const,
}

export function useRegionais() {
  return useQuery({
    queryKey: chavesOrganizacao.regionais,
    queryFn: () => api.get<Regional[]>('/regionais'),
  })
}

export function useUnidades(regionalId: string | null) {
  return useQuery({
    queryKey: chavesOrganizacao.unidades(regionalId ?? '—'),
    queryFn: () => api.get<Unidade[]>(`/regionais/${regionalId}/unidades`),
    enabled: !!regionalId,
  })
}

export function useUnidade(id: string | undefined) {
  return useQuery({
    queryKey: chavesOrganizacao.unidade(id ?? '—'),
    queryFn: () => api.get<Unidade>(`/unidades/${id}`),
    enabled: !!id,
  })
}
