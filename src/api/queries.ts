import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { Regional, Unidade } from '../domain/types'
import type { SubBaciasPayload } from '../domain/subbacia'
import type { ContratoPayload } from '../domain/contrato'
import type { EtesPayload } from '../domain/ete'
import type { HierarquiaPayload } from '../domain/hierarquia'
import type { CtsPayload } from '../domain/cts'

export const keys = {
  regionais: ['regionais'] as const,
  unidades: (regionalId: string) => ['regionais', regionalId, 'unidades'] as const,
  unidade: (id: string) => ['unidades', id] as const,
  subBacias: (id: string) => ['unidades', id, 'sub-bacias'] as const,
  contrato: (id: string) => ['unidades', id, 'contrato'] as const,
  etes: (id: string) => ['unidades', id, 'etes'] as const,
  hierarquia: (id: string) => ['unidades', id, 'hierarquia'] as const,
  cts: (id: string) => ['unidades', id, 'cts'] as const,
}

export function useRegionais() {
  return useQuery({
    queryKey: keys.regionais,
    queryFn: () => api.get<Regional[]>('/regionais'),
  })
}

export function useUnidades(regionalId: string | null) {
  return useQuery({
    queryKey: keys.unidades(regionalId ?? '—'),
    queryFn: () => api.get<Unidade[]>(`/regionais/${regionalId}/unidades`),
    enabled: !!regionalId,
  })
}

export function useUnidade(id: string | undefined) {
  return useQuery({
    queryKey: keys.unidade(id ?? '—'),
    queryFn: () => api.get<Unidade>(`/unidades/${id}`),
    enabled: !!id,
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
