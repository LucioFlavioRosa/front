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
 *
 * NAO ha POST nem DELETE de CTS, de proposito: a CTS e no da topologia, e
 * cria-la aqui produziria uma ficha que o motor nunca carrega. O backend
 * responde 405 nessas rotas.
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
import type { Override } from '@/cadastro/state/cadastroReducer'

/** O que TODA ficha carrega, seja qual for a tela. */
export interface ComOverrides {
  /** Trilha de auditoria dos dados do Databricks sobrescritos nesta ficha. */
  overrides: Override[]
  /**
   * A versao que o servidor entregou no `GET`. E o que dispara o 409 quando
   * outra pessoa gravou a mesma ficha no intervalo.
   *
   * Fica no TOPO do corpo, e nao dentro de `cidade`/`ete`, por dois motivos: e
   * onde o backend a le (`corpo.get("versao")`), e assim ha um so lugar de onde
   * `assinatura()` precisa remove-la para o controle de "ficha suja" nao
   * enxergar uma mudanca que o usuario nao fez.
   */
  versao: string
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

/** Recorta do mapa global de overrides os que pertencem a uma ficha. */
export function overridesDaFicha(overrides: Record<string, Override>, prefixo: string): Override[] {
  return Object.entries(overrides)
    .filter(([chave]) => chave.startsWith(`${prefixo}.`))
    .map(([, o]) => o)
}
