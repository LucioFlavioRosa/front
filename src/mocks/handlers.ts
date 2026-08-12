import { http, HttpResponse } from 'msw'
import regionais from '@/mocks/fixtures/regionais.json'
import unidadesRaw from '@/mocks/fixtures/unidades.json'
import subbacias from '@/mocks/fixtures/subbacias.json'
import contrato from '@/mocks/fixtures/contrato.json'
import etesFx from '@/mocks/fixtures/etes.json'
import estrutura from '@/mocks/fixtures/estrutura.json'
import ctsFx from '@/mocks/fixtures/cts.json'
import type { Unidade } from '@/comum/domain/organizacao'
import {
  camposDaSub,
  cidadePorSub,
  deTerceiros,
  num,
  subPend,
  type Obra,
  type SubBacia,
} from '@/cadastro/domain/subbacia'
import { g2Pend, type ContratoPayload } from '@/cadastro/domain/contrato'
import { etePend, isNova, type Ete } from '@/cadastro/domain/ete'
import { camposDaCts, ctsPend, type Cts } from '@/cadastro/domain/cts'

/**
 * Handlers do MSW seguindo o contrato de API do README. Um dataset mock unico de
 * grupos (sub-bacias, contrato, ETEs, estrutura) e servido para qualquer unidade;
 * contadores, pendencias e completude sao DERIVADOS desse dado real (nao fixos),
 * para o hub e o header baterem com as telas dos grupos.
 */
const BASE = '/api'

interface UnidadeRaw {
  id: string
  regionalId: string
  nome: string
  databricksConectado: boolean
}
const unidades = unidadesRaw as unknown as UnidadeRaw[]

const subsMap = subbacias.subs as unknown as Record<string, SubBacia>
const subsList = Object.values(subsMap)
const etesList = etesFx.etes as unknown as Ete[]
const contratoData = contrato as ContratoPayload
const ctsList = Object.values(ctsFx.ctss as unknown as Record<string, Cts>)

// ---- derivacoes (uma vez, no load) ----
// A regua da meta e da cidade: quando e populacao, a ficha ganha 2 campos —
// mesma conta do derive() do reducer, para hub e telas nao discordarem.
const cidadeDoSub = cidadePorSub(subbacias.arvore)
const porPopulacaoSub = (subId: string) =>
  contratoData.cidades.find((c) => c.id === cidadeDoSub[subId])?.cob === 'populacao'
const porPopulacaoCts = (ctsId: string) => {
  const sub = ctsFx.pares.find((p) => p.cts === ctsId)?.sub
  return sub ? porPopulacaoSub(sub) : false
}

const g2 = g2Pend(contratoData)
const g3 = subsList.reduce((a, s) => a + subPend(s, porPopulacaoSub(s.id)), 0)
const g4 = etesList.reduce((a, e) => a + etePend(e), 0)
const g5 = ctsList.reduce((a, c) => a + ctsPend(c, porPopulacaoCts(c.id)), 0)
const pendTotal = g2 + g3 + g4 + g5

const g2Total =
  contratoData.cidades.length * 2 + contratoData.metas.length * 3 + contratoData.fator.length * 3
const g3Total = subsList.reduce((a, s) => a + camposDaSub(porPopulacaoSub(s.id)), 0)
const g4Total = etesList.reduce((a, e) => a + 7 + (isNova(e) ? 2 : 0), 0)
// CTS e esparsa: so as que existem entram no denominador.
const g5Total = ctsList.reduce((a, c) => a + camposDaCts(porPopulacaoCts(c.id)), 0)
// Guarda o 0/0 (base vazia), igual ao derive() do reducer.
const totalCampos = g2Total + g3Total + g4Total + g5Total
const completude = totalCampos === 0 ? 100 : Math.round((1 - pendTotal / totalCampos) * 100)

const contadores = {
  cidades: contratoData.cidades.length,
  sistemas: estrutura.sistemas.length,
  subBacias: subsList.length,
  obras: subsList.length * 5,
  metas: contratoData.metas.length,
  etes: etesList.length,
  cts: ctsList.length,
}

/**
 * As TRES categorias de componente, contadas das fixtures pela regra do dominio.
 *
 * Nao ha numero escrito a mao aqui de proposito: o mock e a referencia executavel
 * do contrato, e um total redondo esconderia o dia em que a fixture mudasse. A
 * classificacao usa `deTerceiros` do proprio dominio — a mesma funcao que a tela
 * de obras usa para por o selo —, entao mock e app nao tem como discordar.
 */
const obrasDasFixtures = (() => {
  const todas = [...subsList, ...ctsList].flatMap((f) =>
    Object.values((f.obrasOverride ?? {}) as Record<string, Obra>),
  )
  // `num` devolve `null` em texto invalido — mesmo cuidado de `deTerceiros`, que
  // trata "nao consigo ler" como diferente de zero.
  const temCapex = (o: Obra) => {
    const q = num(o.qtd)
    const p = num(o.preco)
    return q != null && p != null && q * p > 0
  }
  const terceiros = todas.filter(deTerceiros).length
  const aegea = todas.filter(temCapex).length
  return {
    obras: aegea + terceiros,
    obrasAegea: aegea,
    obrasTerceiros: terceiros,
    semObra: todas.length - aegea - terceiros,
  }
})()

const nomeRegional = (id: string) => regionais.find((r) => r.id === id)?.nome ?? ''

function toUnidade(u: UnidadeRaw): Unidade {
  return {
    id: u.id,
    regionalId: u.regionalId,
    nome: u.nome,
    resumo: {
      cidades: contadores.cidades,
      sistemas: contadores.sistemas,
      subBacias: contadores.subBacias,
      cts: contadores.cts,
      etes: contadores.etes,
      ...obrasDasFixtures,
    },
    completude,
    databricksConectado: u.databricksConectado,
  }
}

/** Primeiro campo obrigatorio ausente do corpo, ou null se esta tudo la. */
function exigir(corpo: Record<string, unknown>, campos: string[]): string | null {
  return campos.find((c) => corpo?.[c] === undefined) ?? null
}

/**
 * Colunas da base comercial que toda ficha de sub-bacia/CTS carrega — os tres
 * trios de cobertura (ligacoes, economias, populacao) mais receita e ticket.
 * O mock confere o interior de `db` para uma coluna nova nao entrar no dominio
 * sem entrar tambem no contrato de escrita.
 */
const COLUNAS_DB = [
  'fat',
  'arr',
  'ligU',
  'ligA',
  'ligN',
  'ligUInd',
  'ligAInd',
  'fatInd',
  'arrInd',
  'ecoU',
  'ecoA',
  'ecoN',
  'ticket',
]

/** Parametros da Regional — populacao inclusive, mesmo vazia. */
const COLUNAS_PARAMS = ['preco', 'tarr', 'ramp', 'vaz', 'vazInd', 'pot', 'popU', 'popA']

/** Valida a ficha de coleta (sub-bacia ou CTS): campos de topo + os dois grupos. */
function recusaDaFicha(ficha: Record<string, unknown>): string | null {
  const falta = exigir(ficha, ['params', 'db', 'obrasOverride'])
  if (falta) return falta
  const faltaDb = exigir(ficha.db as Record<string, unknown>, COLUNAS_DB)
  if (faltaDb) return `db.${faltaDb}`
  const faltaParam = exigir(ficha.params as Record<string, unknown>, COLUNAS_PARAMS)
  return faltaParam ? `params.${faltaParam}` : null
}

/** 422: o servidor recusou o conteudo (mesmo codigo que o backend real usara). */
function recusa(campo: string) {
  return HttpResponse.json({ erro: `campo obrigatório ausente: ${campo}` }, { status: 422 })
}

export const handlers = [
  http.get(`${BASE}/regionais`, () => HttpResponse.json(regionais)),

  http.get(`${BASE}/regionais/:id/unidades`, ({ params }) =>
    HttpResponse.json(unidades.filter((u) => u.regionalId === params.id).map(toUnidade)),
  ),

  http.get(`${BASE}/unidades/:id`, ({ params }) => {
    const u = unidades.find((x) => x.id === params.id)
    return u ? HttpResponse.json(toUnidade(u)) : new HttpResponse(null, { status: 404 })
  }),

  http.get(`${BASE}/unidades/:id/sub-bacias`, () => HttpResponse.json(subbacias)),

  http.get(`${BASE}/unidades/:id/contrato`, () => HttpResponse.json(contrato)),

  http.get(`${BASE}/unidades/:id/etes`, () => HttpResponse.json(etesFx)),

  http.get(`${BASE}/unidades/:id/cts`, () => HttpResponse.json(ctsFx)),

  // A trilha de auditoria. O mock nao a acumula: ele nao guarda o que os PUTs
  // gravaram, entao inventar historico aqui mostraria em desenvolvimento uma
  // lista que o banco de verdade nao teria. Uma entrada so, para o painel poder
  // ser visto, e a marca de que ela e de mentira esta no proprio autor.
  http.get(`${BASE}/unidades/:id/alteracoes`, ({ request }) => {
    const url = new URL(request.url)
    const fichaId = url.searchParams.get('fichaId') ?? ''
    return HttpResponse.json({
      alteracoes: fichaId
        ? [
            {
              tipo: url.searchParams.get('tipo') ?? 'sub-bacia',
              fichaId,
              campo: 'preco',
              de: '1.100,00',
              para: '1.234,00',
              autor: 'ana@aegea',
              quando: '2026-08-10T14:32:00+00:00',
              origem: 'regional',
            },
          ]
        : [],
      cortado: false,
    })
  }),

  http.get(`${BASE}/unidades/:id/hierarquia`, ({ params }) => {
    const u = unidades.find((x) => x.id === params.id)
    if (!u) return new HttpResponse(null, { status: 404 })
    // unidReg reflete a unidade selecionada; resto da estrutura e o mock global.
    const unidReg = {
      rid: u.regionalId,
      rnome: nomeRegional(u.regionalId),
      uid: u.id,
      unome: u.nome,
      waccMedio: estrutura.unidReg.waccMedio,
    }
    return HttpResponse.json({ ...estrutura, unidReg })
  }),

  // ─────────────────────── escrita (ver api/escrita.ts) ───────────────────────
  // O mock nao persiste: valida o formato e devolve o eco, que e o suficiente
  // para a UI exercitar salvando/sucesso/erro. O backend real e que grava.
  http.put(`${BASE}/unidades/:id/sub-bacias/:subId`, async ({ request, params }) => {
    const ficha = (await request.json()) as Record<string, unknown>
    const falta = recusaDaFicha(ficha)
    if (falta) return recusa(falta)
    if (!(String(params.subId) in subsMap)) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(ficha)
  }),

  http.put(`${BASE}/unidades/:id/contrato/:cidId`, async ({ request }) => {
    const ficha = (await request.json()) as Record<string, unknown>
    const falta = exigir(ficha, ['cidade', 'metas', 'fator'])
    if (falta) return recusa(falta)
    return HttpResponse.json(ficha)
  }),

  http.put(`${BASE}/unidades/:id/etes/:eteId`, async ({ request }) => {
    const ficha = (await request.json()) as Record<string, unknown>
    const falta = exigir(ficha, ['ete'])
    if (falta) return recusa(falta)
    return HttpResponse.json(ficha)
  }),

  http.put(`${BASE}/unidades/:id/cts/:ctsId`, async ({ request }) => {
    const ficha = (await request.json()) as Record<string, unknown>
    const falta = recusaDaFicha(ficha)
    if (falta) return recusa(falta)
    return HttpResponse.json(ficha)
  }),

  // NAO ha POST nem DELETE de CTS aqui, e nao pode haver: o backend real responde
  // 405 nessas rotas (a CTS e no da topologia). Um mock que aceita o que o
  // servidor recusa faz o desenvolvimento local validar um contrato que nao
  // existe — e foi assim que a criacao de CTS pareceu funcionar por semanas.
]
