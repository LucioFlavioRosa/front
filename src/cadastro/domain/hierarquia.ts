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
  /**
   * `'true'` = o sistema usa SISTEMA DE CTS e aceita UMA CTS; `'false'` = aceita
   * varias. Viaja como texto porque o Grupo 01 e "tudo string" (o front chama
   * `.trim()` nos campos); o corpo do `PUT` leva booleano de verdade.
   *
   * E regra de CADASTRO, e nao de simulacao: o motor nunca contou CTS por
   * sistema, e para ele uma ou duas sao nos como quaisquer outros.
   */
  usaCts: string
}

/**
 * Um componente do sistema — sub-bacia, CTS ou ETE — e para onde ele escoa.
 *
 * `sis` VAZIO significa "ainda nao colocado em sistema nenhum", e nao "faltou
 * dado": e o estado normal de uma CTS antes de a Regional decidir em que sistema
 * ela entra. Componente sem sistema nao participa da simulacao — o motor pula
 * quem nao tem sistema.
 *
 * `jus` vazio e outra coisa: e o caminho ainda nao montado. Na ETE ele e vazio
 * para sempre, porque ela e o fim do caminho.
 */
export interface TopoRow {
  sis: string
  id: string
  nome: string
  jus: string
  /** `sub-bacia` | `cts` | `ete`. So vem preenchido nos que estao FORA de sistema,
   *  que e onde a tela precisa rotular o que esta oferecendo para colocar. */
  tipo?: string
}

export interface HierarquiaPayload {
  unidReg: UnidReg
  superintendencias: Superintendencia[]
  cidades: CidadeH[]
  sistemas: SistemaH[]
  topo: TopoRow[]
  /**
   * Componentes cadastrados e fora de qualquer sistema.
   *
   * NAO e recortado por unidade, e nao poderia ser: sem sistema nao ha cidade,
   * nem superintendencia, nem unidade. E o modelo do produto — do Databricks vem
   * quais sub-bacias e qual ETE sao do sistema, e TODAS as CTS cadastradas; em
   * que sistema cada CTS entra e a Regional que decide, e ela pode colocar
   * qualquer uma que exista na base.
   */
  semSistema: TopoRow[]
}
