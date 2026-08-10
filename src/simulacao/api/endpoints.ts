/**
 * Contrato do disparo de uma rodada, como o README do handoff propoe.
 *
 * Esta e a UNICA parte do app que cria alguma coisa no servidor. O cadastro
 * grava fichas (PUT idempotente sobre algo que ja existe); aqui um POST cria uma
 * rodada nova, com um `run_id` que passa a existir para sempre no historico.
 */
import { api } from '@/comum/api/client'
import type { CorpoNovaRodada, Prontidao } from '@/simulacao/domain/simulacao'

export interface RespostaNovaRodada {
  runId: string
  /**
   * Pode ser `SUCESSO`: quando o servidor deduplica para uma rodada CONCLUIDA
   * (R5), ele devolve o status REAL dela. Dizer `PENDENTE` faria esta tela abrir
   * o modal de acompanhamento de algo que terminou ontem.
   */
  status: 'PENDENTE' | 'RODANDO' | 'SUCESSO'
  /**
   * O servidor nao criou rodada: devolveu uma que ja existia, com o mesmo pedido
   * e do mesmo usuario — em voo (duplo clique, retry) ou concluida.
   *
   * Vem no CORPO, e nao pelo codigo 200 vs 201, porque `comum/api/client.ts`
   * devolve o JSON e descarta o status. Ler o codigo exigiria mudar o transporte
   * inteiro para saber o que o corpo ja diz.
   *
   * Opcional: servidor anterior a esta mudanca nao manda o campo, e ausencia
   * significa "nao sei", que a tela trata como o caminho normal.
   */
  jaExistia?: boolean
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

  // NAO ha `cancelar` aqui: o endpoint responde 501 enquanto `CANCELADA` nao
  // entra no CHECK de `controle.run_status`, e o botao saiu da tela. O codigo
  // exato para religar os tres pontos esta no CONTRATO.md §4.4 — em texto, e nao
  // como funcao sem chamador que o `knip` acusa e ninguem sabe se ainda vale.
}
