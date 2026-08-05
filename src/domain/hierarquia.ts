/** Dominio do Grupo 01 (Hierarquia & Topologia). Tudo Databricks (linhas 143-256). */

export interface UnidReg {
  rid: string
  rnome: string
  uid: string
  unome: string
  waccMedio: string
}

export interface Superintendencia {
  id: string
  nome: string
}

export interface CidadeH {
  id: string
  nome: string
  supId: string
}

export interface SistemaH {
  id: string
  nome: string
  cidId: string
}

export interface TopoRow {
  sis: string
  id: string
  nome: string
  jus: string
}

export interface HierarquiaPayload {
  unidReg: UnidReg
  superintendencias: Superintendencia[]
  cidades: CidadeH[]
  sistemas: SistemaH[]
  topo: TopoRow[]
}
