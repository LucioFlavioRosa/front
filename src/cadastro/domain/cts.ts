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
import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'
import { CAMPOS_PARAMS, CAMPOS_POR_OBRA, mkObrasDe, pendDe } from '@/cadastro/domain/subbacia'

export interface Cts {
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
 * As 4 obras-base de toda CTS. O "Coletor de tempo seco" e a ancora de coleta
 * (o equivalente da "Ligacao de esgoto" da sub-bacia: e ele que liga o
 * faturamento); os tres de transporte espelham os da sub-bacia.
 */
// prettier-ignore
export const BASE_OBRAS_CTS: Obra[] = [
  { nome: 'Coletor de tempo seco', un: 'm', qtd: '0', preco: '1.480,00', opex: '0', tPred: '0', dur: '0', anoObrig: '0', proibAte: '0', wacc: '0,091' },
  { nome: 'Coletor tronco', un: 'm', qtd: '0', preco: '1.200,00', opex: '0', tPred: '0', dur: '0', anoObrig: '0', proibAte: '0', wacc: '0,091' },
  { nome: 'Estação elevatória (EEE)', un: 'un', qtd: '0', preco: '0', opex: '0', tPred: '0', dur: '0', anoObrig: '0', proibAte: '0', wacc: '' },
  { nome: 'Linha de recalque (LR)', un: 'm', qtd: '0', preco: '900,00', opex: '0', tPred: '0', dur: '15', anoObrig: '0', proibAte: '0', wacc: '0,067' },
]

/** Resolve as 4 obras aplicando os overrides da CTS sobre a base. */
export function mkObrasCts(override: Record<string, Partial<Obra>>): Obra[] {
  return mkObrasDe(BASE_OBRAS_CTS, override)
}

/** Campos que uma CTS precisa ter preenchidos: params + 4 obras. */
export const CTS_CAMPOS = CAMPOS_PARAMS + BASE_OBRAS_CTS.length * CAMPOS_POR_OBRA

/** Idem, com os 2 campos de populacao quando a cidade mede a meta por ela. */
export const camposDaCts = (porPopulacao: boolean) => CTS_CAMPOS + (porPopulacao ? 2 : 0)

/** Pendencias da CTS — mesma regra da sub-bacia, com 4 obras (wacc nao conta). */
export function ctsPend(c: Cts, porPopulacao = false): number {
  return pendDe(c.params, mkObrasCts(c.obrasOverride), porPopulacao)
}

/**
 * CTS nova, criada a partir da sub-bacia pareada. A base comercial NAO e
 * copiada: sao areas sobrepostas, mas a demanda da CTS e propria e vem do
 * Databricks — aqui entra vazia, para a Regional preencher ou corrigir.
 */
export function novaCts(sub: {
  id: string
  nome: string
  sisId: string
  sistema: string
  jusante: string
}): Cts {
  return {
    id: `cts_${sub.id}`,
    nome: `CTS ${sub.nome.replace(/^Sub-bacia /, '')}`,
    subId: sub.id,
    sisId: sub.sisId,
    sistema: sub.sistema,
    jusante: sub.jusante,
    db: {
      fat: '',
      arr: '',
      ligU: '',
      ligA: '',
      ligN: '',
      ligUInd: '',
      ligAInd: '',
      fatInd: '',
      arrInd: '',
      ecoU: '',
      ecoA: '',
      ecoN: '',
      ticket: '—',
    },
    params: { preco: '', tarr: '', ramp: '', vaz: '', vazInd: '', pot: '', popU: '', popA: '' },
    obrasOverride: {},
  }
}
