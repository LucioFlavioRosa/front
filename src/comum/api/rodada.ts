/**
 * O estado OPERACIONAL de uma rodada: em que pe ela esta, e por que espera.
 *
 * Mora em `comum/` e nao em `simulacao/` porque duas areas perguntam a mesma
 * coisa ao mesmo endpoint: o modal da nova simulacao acompanha a rodada que
 * acabou de disparar, e o card do historico mostra as que ainda nao publicaram —
 * que e onde alguem repara, porque o modal some quando se fecha a aba. Duplicar a
 * chamada daria dois contratos para uma URL so.
 *
 * O RESULTADO da rodada continua sendo de `resultado/`, e o DISPARO de
 * `simulacao/`. O que subiu foi so o estado enquanto ela nao terminou.
 *
 * As `chaves` ficam com os hooks: quem invalida cache precisa da mesma chave que
 * quem le, e separar as duas coisas e como esses pares se perdem.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/comum/api/client'

/**
 * POR QUE a rodada esta onde esta.
 *
 * "Na fila, esperando um executor" cobria dois mundos opostos — todas as vagas
 * ocupadas (espere) e NENHUM executor de pe (isto nunca vai rodar) — e quem
 * olhava a tela nao tinha como distinguir. Em producao, com o job do Databricks,
 * o segundo caso e silencioso: a fila cresce e ninguem descobre.
 */
export interface FilaDaRodada {
  /** Executores que bateram ponto ha pouco. Zero = ninguem vai executar isto. */
  vivos: number
  /** Soma das vagas dos executores vivos, e quantas estao em uso. */
  capacidade: number
  ocupadas: number
  /** Quantas rodadas PENDENTES estao na frente. 0 = e a proxima. */
  posicao: number
  /** Frase pronta para a tela. O backend a monta porque so ele ve a fila toda. */
  motivo: string
  /** true quando a espera exige acao humana — sem executor, ou lease vencido. */
  atencao: boolean
}

export interface StatusRodada {
  runId: string
  status: 'PENDENTE' | 'RODANDO' | 'SUCESSO' | 'FALHOU_QUALIDADE' | 'ERRO' | 'CANCELADA'
  /** 0 a 100. O modal mostra a etapa a partir dele. */
  progresso: number
  erro?: string | null
  /** ISO-8601. Sem ele nao ha tempo decorrido, e "esperando" com dois segundos e
   *  com quarenta minutos viram a mesma frase. */
  pedidaEm?: string | null
  /** So enquanto PENDENTE ou RODANDO. Opcional: servidor antigo nao manda. */
  fila?: FilaDaRodada
}

export const chavesRodada = {
  status: (runId: string) => ['runs', runId, 'status'] as const,
  /** A lista do historico. Prefixo, porque ela e filtrada por unidade/usuario. */
  lista: ['runs', 'lista'] as const,
}

export const rodada = {
  status: (runId: string) => api.get<StatusRodada>(`/runs/${runId}/status`),
}

/** Cadencia do modal, que e uma barra de progresso: precisa parecer viva. */
export const RITMO_MODAL = 1200

/**
 * Cadencia do historico, que e uma LISTA — e uma lista pergunta por cada rodada
 * em voo. Com 1,2s e dez rodadas na fila seriam oito requests por segundo para
 * uma tela que ninguem fica olhando; 5s mostra a mesma coisa e custa cinco vezes
 * menos. O modal segue rapido porque la ha uma rodada so, e o usuario esta parado
 * esperando por ela.
 */
export const RITMO_LISTA = 5000

/**
 * Acompanha a rodada em voo.
 *
 * `refetchInterval` so enquanto ela nao terminou — parar de perguntar quando a
 * resposta nao muda mais e o minimo de respeito com o backend. E `enabled` so com
 * `runId`, entao nao ha polling nenhum antes de haver rodada.
 */
export function useStatusRodada(runId: string | undefined, ritmo = RITMO_MODAL) {
  return useQuery({
    queryKey: chavesRodada.status(runId ?? '—'),
    queryFn: () => rodada.status(runId as string),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'PENDENTE' || s === 'RODANDO' ? ritmo : false
    },
  })
}
