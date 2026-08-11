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
 * Um desvio consciente do contrato do README: em vez de `/ano`, `/mes`,
 * `/obras/agregado` e `/subbacias/histograma` separados, o nivel global pede um
 * `/painel` so. Sao 6 quadros que aparecem juntos, sempre; 5 requisicoes em
 * paralelo para montar uma tela seria custo sem ganho, e o backend le todas as
 * tabelas da mesma rodada de qualquer jeito.
 */
import { api } from '@/comum/api/client'
import type {
  CidadeDetalhe,
  CidadeLinha,
  ObraDetalhe,
  PainelEbitda,
  PainelGlobal,
  RunMeta,
  RunResumo,
  SubBaciaDetalhe,
  Topologia,
} from '@/resultado/domain/resultado'

const BASE = '/runs'

export const resultados = {
  /** Historico de simulacoes (nivel 0). Filtra por unidade e/ou autor. */
  listar: (filtro?: { unidadeId?: string; usuario?: string }) => {
    const q = new URLSearchParams()
    if (filtro?.unidadeId) q.set('unidade', filtro.unidadeId)
    if (filtro?.usuario) q.set('usuario', filtro.usuario)
    const qs = q.toString()
    return api.get<RunResumo[]>(`${BASE}${qs ? `?${qs}` : ''}`)
  },

  /** KPIs + parametros + status. Alimenta o header em TODOS os niveis. */
  meta: (runId: string) => api.get<RunMeta>(`${BASE}/${runId}/meta`),

  /**
   * Apaga uma rodada. A UNICA mutacao deste pacote inteiro — o resto e leitura.
   * Nao toca no cadastro: o que se apaga e o resultado, nao o dado de entrada.
   */
  excluir: (runId: string) => api.del<void>(`${BASE}/${runId}`),

  /**
   * Favorita — a marca e DE QUEM PEDE, e nao um atributo da rodada.
   *
   * Os dois verbos sao idempotentes de proposito: marcar o que ja esta marcado e
   * desmarcar o que nao esta sao sucesso, porque o estado pedido e o estado final.
   * Duplo clique nao precisa de tratamento, e retry de rede tambem nao.
   */
  favoritar: (runId: string) => api.put<void>(`${BASE}/${runId}/favorita`),
  desfavoritar: (runId: string) => api.del<void>(`${BASE}/${runId}/favorita`),

  /** Os 6 quadros do nivel global, num payload so. */
  painel: (runId: string) => api.get<PainelGlobal>(`${BASE}/${runId}/painel`),

  /** EBITDA da unidade, ou de uma cidade quando `cidadeId` vem. */
  ebitda: (runId: string, cidadeId?: string) =>
    api.get<PainelEbitda>(`${BASE}/${runId}/ebitda${cidadeId ? `?cidade=${cidadeId}` : ''}`),

  /** Tabela de cidades do nivel global (drill-down). */
  cidades: (runId: string) => api.get<CidadeLinha[]>(`${BASE}/${runId}/cidades`),

  /** Nivel 2: cobertura, metas, cascata, paridade e sistemas da cidade. */
  cidade: (runId: string, cidadeId: string) =>
    api.get<CidadeDetalhe>(`${BASE}/${runId}/cidades/${cidadeId}`),

  /** Nivel 3: nos, componentes, arestas de jusante e a ETE do sistema. */
  topologia: (runId: string, sistemaId: string) =>
    api.get<Topologia>(`${BASE}/${runId}/sistemas/${sistemaId}/topologia`),

  /** Nivel 4: VPL decomposto, serie de receita, explicabilidade e elementos. */
  subbacia: (runId: string, subId: string) =>
    api.get<SubBaciaDetalhe>(`${BASE}/${runId}/subbacias/${subId}`),

  /** Nivel 5: ficha da obra + quem depende dela (rateio por vazao). */
  obra: (runId: string, obraId: string) => api.get<ObraDetalhe>(`${BASE}/${runId}/obras/${obraId}`),
}
