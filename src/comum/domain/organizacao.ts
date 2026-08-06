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

export interface UnidadeResumo {
  cidades: number
  sistemas: number
  subBacias: number
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
