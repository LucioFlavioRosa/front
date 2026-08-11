/**
 * Handlers do MSW para a NOVA SIMULACAO.
 *
 * Separado dos outros dois pelo mesmo motivo: sao contratos distintos. Aqui esta
 * a unica CRIACAO do app inteiro — um POST que devolve um `run_id` novo.
 *
 * A rodada avanca de verdade nesta sessao (um cronometro move o progresso ate
 * 100 e o status vira SUCESSO). Sem isso, o modal de progresso ficaria parado e
 * ninguem descobriria que o polling nao funciona.
 */
import { http, HttpResponse } from 'msw'
import ctsRaw from '@/mocks/fixtures/cts.json'
import estruturaRaw from '@/mocks/fixtures/estrutura.json'
import subbaciasRaw from '@/mocks/fixtures/subbacias.json'
import unidadesRaw from '@/mocks/fixtures/unidades.json'
import type { CorpoNovaRodada } from '@/simulacao/domain/simulacao'

const BASE = '/api'

interface UnidadeRaw {
  id: string
  nome: string
}
const unidades = unidadesRaw as unknown as UnidadeRaw[]

type Fichas = Record<string, { obrasOverride?: Record<string, unknown> }>
const estrutura = estruturaRaw as unknown as { cidades?: unknown[]; sistemas?: unknown[] }
const subbacias = subbaciasRaw as unknown as { subs?: Fichas }
const cts = ctsRaw as unknown as { ctss?: Fichas }

/**
 * Pendencias por unidade. A primeira e completa (roda); as demais tem pendencia,
 * para o bloqueio ser exercitavel sem precisar zerar um cadastro inteiro.
 */
function pendenciasDe(id: string): number {
  const i = unidades.findIndex((u) => u.id === id)
  if (i <= 0) return 0
  return [46, 12, 3][(i - 1) % 3]
}

interface RodadaEmVoo {
  runId: string
  status: 'PENDENTE' | 'RODANDO' | 'SUCESSO' | 'CANCELADA'
  progresso: number
  inicio: number
}

const rodadas = new Map<string, RodadaEmVoo>()
let seq = 0

/**
 * Quanto tempo a rodada passa na fila antes de um executor pega-la.
 *
 * Existe para o estado PENDENTE ser ALCANCAVEL em desenvolvimento. O mock nascia
 * RODANDO, entao o bloco `fila` — a razao de o backend ter ganhado o campo —
 * nunca aparecia em tela, e quem mexesse nela nao teria como ver o que fez.
 */
const MS_NA_FILA = 1500

/** Progresso pelo tempo decorrido — sem timer, para nao vazar entre testes. */
function avanca(r: RodadaEmVoo): RodadaEmVoo {
  if (r.status !== 'PENDENTE' && r.status !== 'RODANDO') return r
  const decorrido = Date.now() - r.inicio
  if (decorrido < MS_NA_FILA) {
    r.status = 'PENDENTE'
    r.progresso = 0
    return r
  }
  r.status = 'RODANDO'
  r.progresso = Math.min(100, Math.round((decorrido - MS_NA_FILA) / 60))
  if (r.progresso >= 100) r.status = 'SUCESSO'
  return r
}

/**
 * O bloco `fila`, com UM executor de pe e uma vaga.
 *
 * Nao ha simulacao de fila cheia nem de executor ausente aqui: seriam estados
 * inventados por um mock que nao tem executor nenhum de verdade. O que ele
 * garante e o formato e o caminho — a tela recebe o campo, escolhe o tom e
 * mostra a frase. Os outros dois motivos vem prontos do backend.
 */
function filaDe(r: RodadaEmVoo) {
  return {
    vivos: 1,
    capacidade: 1,
    ocupadas: r.status === 'RODANDO' ? 1 : 0,
    posicao: 0,
    motivo:
      r.status === 'RODANDO'
        ? 'Em execução.'
        : 'Há 1 vaga(s) livre(s) — deve começar em instantes.',
    atencao: false,
  }
}

/**
 * O tamanho da unidade, CONTADO das fixtures — nao inventado.
 *
 * As fixtures descrevem um cadastro so, e o mock o serve para qualquer unidade;
 * e a mesma simplificacao que o resto deste arquivo faz. Numeros redondos
 * escritos a mao dariam a mesma tela e esconderiam o dia em que a fixture mudar
 * e a contagem parar de bater com ela.
 */
function tamanhoDasFixtures() {
  const obras = (fichas: Record<string, { obrasOverride?: Record<string, unknown> }>) =>
    Object.values(fichas).reduce((n, f) => n + Object.keys(f.obrasOverride ?? {}).length, 0)
  return {
    cidades: (estrutura.cidades ?? []).length,
    sistemas: (estrutura.sistemas ?? []).length,
    obras: obras(subbacias.subs ?? {}) + obras(cts.ctss ?? {}),
  }
}

export const handlersSimulacao = [
  http.get(`${BASE}/unidades/:id/prontidao`, ({ params }) => {
    const id = String(params.id)
    const u = unidades.find((x) => x.id === id)
    if (!u) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({
      unidadeId: id,
      unidadeNome: u.nome,
      pendencias: pendenciasDe(id),
      // O mock nao tem ficha com componente faltando: as fixtures trazem as 5 e
      // as 4 completas, como o banco real. Lista vazia e a resposta honesta —
      // inventar uma aqui faria o checklist de desenvolvimento mostrar um erro
      // que o dado nao tem.
      faltando: [],
      tamanho: tamanhoDasFixtures(),
    })
  }),

  http.post(`${BASE}/runs`, async ({ request }) => {
    const corpo = (await request.json()) as CorpoNovaRodada

    // O bloqueio por pendencia e regra de NEGOCIO, e o handoff e explicito: o
    // backend tambem precisa validar. Um mock que aceita tudo esconderia o dia em
    // que a tela deixasse passar.
    if (!corpo?.unidade_id) {
      return HttpResponse.json({ erro: 'unidade_id é obrigatório' }, { status: 422 })
    }
    if (pendenciasDe(corpo.unidade_id) > 0) {
      return HttpResponse.json({ erro: 'cadastro da unidade tem pendências' }, { status: 422 })
    }
    const temOrcamento =
      (corpo.orcamento && Object.keys(corpo.orcamento).length > 0) ||
      (corpo.orcamento_anual ?? 0) > 0
    if (!temOrcamento) {
      return HttpResponse.json({ erro: 'sem verba de CAPEX' }, { status: 422 })
    }

    const runId = `run_novo_${String(++seq).padStart(4, '0')}`
    rodadas.set(runId, { runId, status: 'PENDENTE', progresso: 0, inicio: Date.now() })
    // `jaExistia: false` sempre: este mock NAO deduplica, e nao deve fingir que
    // sim — a dedupe de rodada concluida (R5) depende de historico publicado e do
    // carimbo de alteracao do cadastro, que so o backend tem. O caminho do
    // `jaExistia: true` e exercitado no teste de tela, com a resposta declarada.
    return HttpResponse.json({ runId, status: 'PENDENTE', jaExistia: false }, { status: 201 })
  }),

  http.get(`${BASE}/runs/:runId/status`, ({ params }) => {
    const r = rodadas.get(String(params.runId))
    if (!r) return new HttpResponse(null, { status: 404 })
    const atual = avanca(r)
    const emVoo = atual.status === 'PENDENTE' || atual.status === 'RODANDO'
    return HttpResponse.json({
      runId: atual.runId,
      status: atual.status,
      progresso: atual.progresso,
      erro: null,
      pedidaEm: new Date(atual.inicio).toISOString(),
      // O bloco `fila` so existe enquanto ela nao terminou, como no backend. Um
      // mock que o mandasse sempre esconderia o dia em que a tela passasse a
      // depender dele numa rodada concluida.
      fila: emVoo ? filaDe(atual) : undefined,
    })
  }),

  http.post(`${BASE}/runs/:runId/cancelar`, ({ params }) => {
    const r = rodadas.get(String(params.runId))
    if (!r) return new HttpResponse(null, { status: 404 })
    r.status = 'CANCELADA'
    return new HttpResponse(null, { status: 204 })
  }),
]
