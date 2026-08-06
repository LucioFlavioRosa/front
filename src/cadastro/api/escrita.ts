/**
 * CONTRATO DE ESCRITA — a especificacao que o backend do cadastro tem de honrar.
 *
 * Granularidade: **uma ficha por vez** (o que o botao "Salvar" de cada tela
 * promete). Nao ha autosave por campo; o usuario edita a ficha inteira e salva.
 *
 *   PUT    /unidades/:uid/sub-bacias/:subId   FichaSubBacia  -> 200 (eco da ficha)
 *   PUT    /unidades/:uid/contrato/:cidId     FichaCidade    -> 200
 *   PUT    /unidades/:uid/etes/:eteId         FichaEte       -> 200
 *   PUT    /unidades/:uid/cts/:ctsId          FichaCts       -> 200
 *   POST   /unidades/:uid/cts                 NovaCts        -> 201 (a CTS criada)
 *   DELETE /unidades/:uid/cts/:ctsId                         -> 204
 *
 * Regras que valem para todas:
 *  - o corpo carrega a ficha INTEIRA, nao um patch: salvar e idempotente;
 *  - `overrides` viaja junto com a ficha para a trilha de auditoria ser gravada
 *    na MESMA transacao do dado (senao um erro parcial deixa dado sem trilha);
 *  - 400/422 = conteudo recusado; 409 = alguem salvou a mesma ficha antes;
 *    401/403 = sessao (ver auth/sessao.ts).
 */
import type { Cidade, Fator, Meta } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'
import type { Cts } from '@/cadastro/domain/cts'
import type { Override } from '@/cadastro/state/cadastroReducer'

/** Trilha de auditoria dos dados do Databricks sobrescritos nesta ficha. */
export interface ComOverrides {
  overrides: Override[]
}

export interface FichaSubBacia extends ComOverrides {
  params: SubBaciaParams
  db: SubBaciaDb
  /** Só os campos alterados de cada obra, por índice ("0".."4"). */
  obrasOverride: Record<string, Partial<Obra>>
}

/** A cidade e suas metas/faixas de paridade formam uma ficha só. */
export interface FichaCidade extends ComOverrides {
  cidade: Cidade
  metas: Meta[]
  fator: Fator[]
}

export interface FichaEte extends ComOverrides {
  ete: Ete
}

export interface FichaCts extends ComOverrides {
  params: SubBaciaParams
  db: SubBaciaDb
  /** Índices "0".."3" — a CTS tem 4 componentes. */
  obrasOverride: Record<string, Partial<Obra>>
}

/**
 * Criação de CTS — fluxo PESSIMISTA: a CTS só entra no cadastro depois do 201,
 * e o que entra é a ficha que o servidor DEVOLVEU, não a que foi enviada.
 *
 * O corpo traz um id sugerido, derivado da sub-bacia (`cts_<subId>`), mas o
 * backend pode normalizar campos ou gerar outro id: o front adota o retorno
 * (`useCriarCts` em api/mutations.ts → `ADD_CTS` no reducer). Devolva a CTS
 * criada no 201; sem ela, o cadastro fica sem a ficha.
 */
export interface NovaCts {
  subId: string
  cts: Cts
}

/** Recorta do mapa global de overrides os que pertencem a uma ficha. */
export function overridesDaFicha(overrides: Record<string, Override>, prefixo: string): Override[] {
  return Object.entries(overrides)
    .filter(([chave]) => chave.startsWith(`${prefixo}.`))
    .map(([, o]) => o)
}
