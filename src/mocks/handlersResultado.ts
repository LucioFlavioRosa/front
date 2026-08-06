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
import runsFx from '@/mocks/fixtures/runs.json'
import dadosFx from '@/mocks/fixtures/resultado.json'
import type { RunMeta, RunResumo } from '@/resultado/domain/resultado'

const BASE = '/api'

const runsTodas = runsFx.runs as unknown as RunResumo[]
const metas = runsFx.meta as unknown as Record<string, RunMeta>

/**
 * O detalhe e de UMA rodada e serve para qualquer `run_id` com resultado. Gerar
 * um dataset coerente por rodada nao acrescentaria nada ao que as telas exercitam
 * — o que importa e que os totais fechem, e eles fecham.
 */
const D = dadosFx as unknown as Record<string, never>

/** Rodadas apagadas nesta sessao. Reset no reload — e mock, nao banco. */
const excluidas = new Set<string>()

function existe(runId: string): boolean {
  return !excluidas.has(runId) && !!metas[runId]
}

/** 404 para rodada apagada ou sem resultado (INFEASIBLE). O mock nao mente. */
function seExiste(runId: string, corpo: unknown) {
  return existe(runId)
    ? HttpResponse.json(corpo as Record<string, unknown>)
    : new HttpResponse(null, { status: 404 })
}

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
    // Rodada INFEASIBLE nao tem meta: o solver nao chegou a um plano.
    return seExiste(id, metas[id])
  }),

  http.delete(`${BASE}/runs/:runId`, ({ params }) => {
    excluidas.add(String(params.runId))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE}/runs/:runId/painel`, ({ params }) => seExiste(String(params.runId), D.painel)),

  http.get(`${BASE}/runs/:runId/ebitda`, ({ params, request }) => {
    const url = new URL(request.url)
    const cidade = url.searchParams.get('cidade')
    const porCidade = D.ebitdaPorCidade as unknown as Record<string, unknown>
    return seExiste(String(params.runId), cidade ? porCidade[cidade] : D.ebitdaUnidade)
  }),

  http.get(`${BASE}/runs/:runId/cidades`, ({ params }) =>
    seExiste(String(params.runId), D.cidades),
  ),

  http.get(`${BASE}/runs/:runId/cidades/:cidadeId`, ({ params }) => {
    const mapa = D.cidadeDetalhe as unknown as Record<string, unknown>
    const c = mapa[String(params.cidadeId)]
    if (!c) return new HttpResponse(null, { status: 404 })
    return seExiste(String(params.runId), c)
  }),

  http.get(`${BASE}/runs/:runId/sistemas/:sistemaId/topologia`, ({ params }) => {
    const mapa = D.topologias as unknown as Record<string, unknown>
    const t = mapa[String(params.sistemaId)]
    if (!t) return new HttpResponse(null, { status: 404 })
    return seExiste(String(params.runId), t)
  }),

  http.get(`${BASE}/runs/:runId/subbacias/:subId`, ({ params }) => {
    const mapa = D.subbacias as unknown as Record<string, unknown>
    const s = mapa[String(params.subId)]
    if (!s) return new HttpResponse(null, { status: 404 })
    return seExiste(String(params.runId), s)
  }),

  http.get(`${BASE}/runs/:runId/obras/:obraId`, ({ params }) => {
    const mapa = D.obras as unknown as Record<string, unknown>
    const o = mapa[String(params.obraId)]
    if (!o) return new HttpResponse(null, { status: 404 })
    return seExiste(String(params.runId), o)
  }),
]

/** Usado pelos testes para voltar ao estado inicial entre casos. */
export function resetarExclusoes() {
  excluidas.clear()
}
