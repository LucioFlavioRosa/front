/**
 * Dominio do Grupo 05 (CTS — Coletor de Tempo Seco).
 *
 * A CTS e a "irma" da sub-bacia: pareada 1:1 com UMA sub-bacia (sobreposicao de
 * area), com os MESMOS dados operacionais — por isso reaproveita os tipos
 * `SubBaciaDb` / `SubBaciaParams` / `Obra` do grupo 03 em vez de duplica-los.
 *
 * Muda so o que o CTS_para_a_tela.md aponta como diferente:
 *  - 4 componentes de obra (nao 5): a ancora de coleta e o "Coletor de tempo
 *    seco", que ocupa o lugar de "Ligacao de esgoto" + "Rede coletora";
 *  - as obras sao proprias e distintas (a CTS nao compartilha obra da sub-bacia);
 *  - existencia esparsa: a maioria das sub-bacias NAO tem CTS.
 *
 * Fora de escopo aqui: o seletor `usar_cts` e parametro da RODADA de simulacao
 * (Sim = CTS orcada a parte; Nao = demanda somada a sub-bacia pareada), nao dado
 * de cadastro — vive na tela de simulacao, que nao faz parte deste app.
 */
import type { Auditoria } from '@/cadastro/domain/auditoria'

import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'
import { CAMPOS_PARAMS, CAMPOS_POR_OBRA, mkObras, pendDe } from '@/cadastro/domain/subbacia'

export interface Cts extends Auditoria {
  id: string
  nome: string
  /** O sistema em que a CTS foi COLOCADA (Grupo 01). Uma CTS so aparece aqui
   *  depois de adicionada a um sistema — antes disso ela nao e de unidade
   *  nenhuma e nao entra na simulacao. */
  sisId: string
  sistema: string
  /** Proximo no no caminho até a ETE (a CTS entra na topologia como a sub-bacia). */
  jusante: string
  db: SubBaciaDb
  params: SubBaciaParams
  /** Overrides das 4 obras-base, por indice (o resto herda a base). */
  obrasOverride: Record<string, Partial<Obra>>
}

/**
 * Componente COLOCADO num sistema que nao tem ficha em lugar nenhum — o servidor
 * o denuncia em vez de servir a unidade calada. Ver `_cts_inconsistentes` no back.
 *
 * E o unico estado meio-existente que sobrou, e o unico que MUDA O RESULTADO: o
 * no entra na simulacao com demanda ZERO, ocupa posicao na rede e puxa a media do
 * sistema para baixo, sem erro em lugar nenhum.
 *
 * Componente fora de sistema nao entra aqui: nao estar colocado e estado normal —
 * e o de toda CTS antes de a Regional adiciona-la a um sistema.
 */
export interface CtsInconsistente {
  tipo: 'no-sem-ficha'
  id: string
  nome: string | null
  detalhe: string
}

export interface CtsPayload {
  ctss: Record<string, Cts>
  /**
   * Diagnostico, e nao ficha. Nao passa pelo reducer de propósito: e verdade do
   * servidor sobre a estrutura, e nenhuma edicao local a muda. Sai da query
   * direto para a tela.
   */
  inconsistencias: CtsInconsistente[]
}

/**
 * Quantos componentes de obra toda CTS tem — quatro, contra os cinco da
 * sub-bacia. Espelha `pendencias.OBRAS_CTS`; ver `OBRAS_POR_SUBBACIA`.
 */
export const OBRAS_POR_CTS = 4

/**
 * As obras da CTS: as MESMAS de `mkObras`, porque a diferenca era a base.
 *
 * Havia aqui `BASE_OBRAS_CTS`, quatro obras literais — e ela guardava uma
 * armadilha propria: usava o vocabulario da SUB-BACIA (`Coletor tronco`,
 * `Estação elevatória (EEE)`) enquanto `componentes_cts_capex` chama os mesmos
 * componentes de `Tronco` e `EEE`. Agora o nome vem do banco, por tabela, e a
 * divergencia de vocabulario deixa de ser problema de alguem.
 */
export const mkObrasCts = mkObras

/** Campos que uma CTS precisa ter preenchidos: params + 4 obras. */
export const CTS_CAMPOS = CAMPOS_PARAMS + OBRAS_POR_CTS * CAMPOS_POR_OBRA

/** Idem, com os 2 campos de populacao quando a cidade mede a meta por ela. */
export const camposDaCts = (porPopulacao: boolean) => CTS_CAMPOS + (porPopulacao ? 2 : 0)

/** Pendencias da CTS — mesma regra da sub-bacia, com 4 obras (wacc nao conta). */
export function ctsPend(c: Cts, porPopulacao = false): number {
  return pendDe(c.params, mkObrasCts(c.obrasOverride), porPopulacao, OBRAS_POR_CTS)
}
