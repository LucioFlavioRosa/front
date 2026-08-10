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
  /** Sub-bacia pareada 1:1 — a area da CTS se sobrepoe a dela. */
  subId: string
  sisId: string
  sistema: string
  /** Proximo no no caminho até a ETE (a CTS entra na topologia como a sub-bacia). */
  jusante: string
  db: SubBaciaDb
  params: SubBaciaParams
  /** Overrides das 4 obras-base, por indice (o resto herda a base). */
  obrasOverride: Record<string, Partial<Obra>>
}

/** De-para da sobreposicao (tabela `subbacia-cts`). */
export interface ParCts {
  sub: string
  cts: string
}

/**
 * Uma CTS que existe pela metade — o servidor a denuncia em vez de servi-la
 * calada. Ver `_cts_inconsistentes` no back para o porque de cada tipo.
 *
 * `ficha-sem-no`   tem ficha e par, nao esta na topologia: a simulacao nao a ve.
 * `no-sem-ficha`   esta na topologia sem ficha: ENTRA na conta com demanda zero.
 * `sem-par`        sem sub-bacia pareada: com USAR_CTS desligado a demanda some.
 */
export interface CtsInconsistente {
  tipo: 'ficha-sem-no' | 'no-sem-ficha' | 'sem-par'
  id: string
  subId: string | null
  detalhe: string
}

export interface CtsPayload {
  pares: ParCts[]
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
