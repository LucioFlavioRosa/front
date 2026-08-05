/**
 * Contrato do disparo de uma rodada, como o README do handoff propoe.
 *
 * Esta e a UNICA parte do app que cria alguma coisa no servidor. O cadastro
 * grava fichas (PUT idempotente sobre algo que ja existe); aqui um POST cria uma
 * rodada nova, com um `run_id` que passa a existir para sempre no historico.
 */
import { api } from './client'
import type { CorpoNovaRodada, Prontidao } from '../domain/simulacao'

export interface RespostaNovaRodada {
  runId: string
  status: 'PENDENTE' | 'RODANDO'
}

export interface StatusRodada {
  runId: string
  status: 'PENDENTE' | 'RODANDO' | 'SUCESSO' | 'FALHOU_QUALIDADE' | 'ERRO' | 'CANCELADA'
  /** 0 a 100. O modal mostra a etapa a partir dele. */
  progresso: number
  erro?: string | null
}

export const simulacao = {
  /**
   * Pendencias do cadastro da unidade — o que bloqueia a rodada.
   *
   * Endpoint proprio, e nao um campo em `/unidades/{id}`, porque a resposta e
   * volatil: ela muda a cada campo preenchido no cadastro, e esta tela precisa do
   * numero do momento em que se clica Iniciar.
   */
  prontidao: (unidadeId: string) => api.get<Prontidao>(`/unidades/${unidadeId}/prontidao`),

  criar: (corpo: CorpoNovaRodada) => api.post<RespostaNovaRodada>('/runs', corpo),

  status: (runId: string) => api.get<StatusRodada>(`/runs/${runId}/status`),

  cancelar: (runId: string) => api.post<void>(`/runs/${runId}/cancelar`),
}
