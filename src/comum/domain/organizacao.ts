/** Tipos de dominio. As 12 tabelas serao detalhadas nos milestones seguintes;
 *  aqui ficam os tipos ja necessarios para selecao/hub/header. */

export interface Regional {
  id: string
  nome: string
}

/** Contadores da base da unidade (usados no resumo da selecao e no hub). */
export interface Contadores {
  cidades: number
  sistemas: number
  subBacias: number
  /** Obras de sub-bacia (5 por sub-bacia). */
  obras: number
  metas: number
  etes: number
  /** CTS cadastradas — esparsas, podem ser zero. */
  cts: number
  /** Obras de CTS (4 por CTS). */
  ctsObras: number
}

/**
 * O PORTE da unidade, como o servidor o conta.
 *
 * Serve para escolher: 67 cidades e 11.525 obras nao e a mesma decisao que 8
 * cidades e 710, e a tela de nova simulacao usa estes numeros para dizer se a
 * rodada e de minutos ou de meia hora.
 *
 * CUIDADO com `obras`: aqui ele e o TOTAL de candidatas de CAPEX — as da
 * sub-bacia mais as da CTS. O `Contadores.obras` do hub do cadastro conta so a
 * metade da sub-bacia, porque la a CTS tem cartao proprio (`ctsObras`). Os dois
 * numeros sao certos no lugar deles, e nunca aparecem na mesma tela.
 */
export interface UnidadeResumo {
  cidades: number
  sistemas: number
  subBacias: number
  /** Esparsas: nem toda sub-bacia tem CTS pareada, e zero e comum. */
  cts: number
  etes: number
  /**
   * Candidatas de CAPEX: `obrasAegea + obrasTerceiros`.
   *
   * E o mesmo criterio do motor (`necess = capex > 0 || tempo_execucao > 0`), e
   * NAO o total de linhas da ficha. Ainda fica abaixo do que o motor conta: falta
   * uma obra por ETE e, com `ETE_FASEADA`, os modulos de expansao — e esses
   * dependem de parametro da RODADA, que nenhum numero por unidade alcanca.
   */
  obras: number
  /** `capex > 0` — investimento da Aegea. */
  obrasAegea: number
  /** `capex = 0` e prazo > 0: a obra acontece e ocupa a sequencia, outro paga. */
  obrasTerceiros: number
  /** `capex = 0` e prazo = 0: o elemento existe na ficha e nao gera obra. */
  semObra: number
}

export interface Unidade {
  id: string
  regionalId: string
  nome: string
  resumo: UnidadeResumo
  /** 0..100 — completude do cadastro (derivada no backend/mocks). */
  completude: number
  databricksConectado: boolean
}
