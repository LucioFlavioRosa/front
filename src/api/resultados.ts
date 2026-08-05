/**
 * Contrato de LEITURA das telas de resultado, como o README do handoff propoe.
 * Um metodo por endpoint; nenhuma regra de negocio — quem interpreta o payload
 * sao as telas.
 *
 * Escopo: tudo e por `run_id`. A unidade NAO entra na URL de proposito — uma
 * rodada pertence a exatamente uma unidade (`run_meta.unidade`), entao o `run_id`
 * ja determina o recorte. Filtrar de novo por unidade seria redundante e abriria
 * a porta para os dois discordarem.
 *
 * ESTADO DESTA FATIA: os tres primeiros metodos tem handler no MSW e sao usados
 * pela casca. Os demais estao aqui porque sao o contrato acordado — cada fatia
 * seguinte liga o seu handler e as suas telas. Chamar um deles hoje da 404, o que
 * e o comportamento honesto: o endpoint ainda nao existe nem no mock.
 */
import { api } from './client'
import type { RunMeta, RunResumo } from '../domain/resultado'

const BASE = '/runs'

export const resultados = {
  // ---- implementado nesta fatia -------------------------------------------

  /** Historico de simulacoes (nivel 0). Filtra por unidade e/ou autor. */
  listar: (filtro?: { unidadeId?: string; usuario?: string }) => {
    const q = new URLSearchParams()
    if (filtro?.unidadeId) q.set('unidade', filtro.unidadeId)
    if (filtro?.usuario) q.set('usuario', filtro.usuario)
    const qs = q.toString()
    return api.get<RunResumo[]>(`${BASE}${qs ? `?${qs}` : ''}`)
  },

  /** KPIs + parametros + status de uma rodada. Alimenta o header em TODOS os niveis. */
  meta: (runId: string) => api.get<RunMeta>(`${BASE}/${runId}/meta`),

  /**
   * Apaga uma rodada. A UNICA mutacao deste pacote inteiro — o resto e leitura.
   * Nao toca no cadastro: o que se apaga e o resultado, nao o dado de entrada.
   */
  excluir: (runId: string) => api.del<void>(`${BASE}/${runId}`),

  // ---- contrato das fatias seguintes --------------------------------------
  // (sem handler no MSW ainda; ver o cabecalho deste arquivo)

  /** Quadros do painel global: desembolso/receita por ano vs teto. */
  ano: (runId: string) => api.get<unknown>(`${BASE}/${runId}/ano`),
  /** Curva S do CAPEX acumulado. */
  mes: (runId: string) => api.get<unknown>(`${BASE}/${runId}/mes`),
  /** CAPEX por componente, ou contagem de obras por ano. */
  obrasAgregado: (runId: string, por: 'componente' | 'ano') =>
    api.get<unknown>(`${BASE}/${runId}/obras/agregado?por=${por}`),
  /** Histograma de VPL por sub-bacia. */
  histogramaSubbacias: (runId: string) => api.get<unknown>(`${BASE}/${runId}/subbacias/histograma`),
  /** EBITDA da unidade ou de uma cidade. */
  ebitda: (runId: string, escopo: 'unidade' | 'cidade', cidadeId?: string) =>
    api.get<unknown>(
      `${BASE}/${runId}/ebitda?escopo=${escopo}${cidadeId ? `&cidade=${cidadeId}` : ''}`,
    ),
  /** Tabela de cidades do nivel global. */
  cidades: (runId: string) => api.get<unknown>(`${BASE}/${runId}/cidades`),
  /** Nivel 2: cobertura, metas, cascata, paridade e sistemas da cidade. */
  cidade: (runId: string, cidadeId: string) =>
    api.get<unknown>(`${BASE}/${runId}/cidades/${cidadeId}`),
  /** Nivel 3: nos, componentes, arestas de jusante e a ETE do sistema. */
  topologia: (runId: string, sistemaId: string) =>
    api.get<unknown>(`${BASE}/${runId}/sistemas/${sistemaId}/topologia`),
  /** Nivel 4: VPL decomposto, serie anual, explicabilidade, caminho e elementos. */
  subbacia: (runId: string, subId: string) =>
    api.get<unknown>(`${BASE}/${runId}/subbacias/${subId}`),
  /** Nivel 5: ficha da obra + quem depende dela (rateio por vazao). */
  obra: (runId: string, obraId: string) => api.get<unknown>(`${BASE}/${runId}/obras/${obraId}`),
}
