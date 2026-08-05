/**
 * Handlers do MSW para as telas de RESULTADO.
 *
 * Arquivo separado de `handlers.ts` de proposito: cadastro e resultado sao dois
 * contratos com backends diferentes (o de cadastro grava; este so le), e mistura-
 * los faria uma fatia mexer no mock da outra.
 *
 * A exclusao e efetiva DENTRO da sessao (a rodada some da lista ate o reload),
 * porque so assim a tela de historico pode ser testada de ponta a ponta — um
 * DELETE que responde 204 e nao muda nada esconderia justamente o bug de a lista
 * nao se atualizar.
 */
import { http, HttpResponse } from 'msw'
import fixture from './fixtures/runs.json'
import type { RunMeta, RunResumo } from '../domain/resultado'

const BASE = '/api'

const runsTodas = fixture.runs as unknown as RunResumo[]
const metas = fixture.meta as unknown as Record<string, RunMeta>

/** Rodadas apagadas nesta sessao. Reset no reload — e mock, nao banco. */
const excluidas = new Set<string>()

export const handlersResultado = [
  http.get(`${BASE}/runs`, ({ request }) => {
    const url = new URL(request.url)
    const unidade = url.searchParams.get('unidade')
    const usuario = url.searchParams.get('usuario')
    const lista = runsTodas
      .filter((r) => !excluidas.has(r.runId))
      .filter((r) => !unidade || r.unidadeId === unidade)
      .filter((r) => !usuario || r.autor === usuario)
    return HttpResponse.json(lista)
  }),

  http.get(`${BASE}/runs/:runId/meta`, ({ params }) => {
    const id = String(params.runId)
    if (excluidas.has(id)) return new HttpResponse(null, { status: 404 })
    const meta = metas[id]
    // Rodada INFEASIBLE nao tem meta: o solver nao chegou a um plano. 404 e a
    // resposta honesta — a UI ja impede de chegar aqui, mas o mock nao mente.
    return meta ? HttpResponse.json(meta) : new HttpResponse(null, { status: 404 })
  }),

  http.delete(`${BASE}/runs/:runId`, ({ params }) => {
    excluidas.add(String(params.runId))
    return new HttpResponse(null, { status: 204 })
  }),
]

/** Usado pelos testes para voltar ao estado inicial entre casos. */
export function resetarExclusoes() {
  excluidas.clear()
}
