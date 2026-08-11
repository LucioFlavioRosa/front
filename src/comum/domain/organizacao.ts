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
  /** Sub-bacia + CTS — o tamanho do problema que o motor vai resolver. */
  obras: number
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
