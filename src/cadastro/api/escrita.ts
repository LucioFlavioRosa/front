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
 *  - 400/422 = conteudo recusado; 401/403 = sessao (ver auth/sessao.ts).
 *
 * NAO ha mais 409 na escrita de ficha. Ele existia quando o corpo levava
 * `versao` e o servidor recusava a gravacao de quem tinha lido antes; hoje o
 * servidor aceita e REGISTRA quem gravou (`atualizadoEm`/`atualizadoPor`). O 409
 * de SIMULACAO continua existindo, e e outro assunto.
 */
import type { Cidade, Fator, Meta } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'
import type { Override } from '@/cadastro/state/cadastroReducer'

/**
 * O que TODA ficha carrega, seja qual for a tela.
 *
 * Aqui havia tambem `versao`, que o corpo devolvia para o servidor conferir e
 * responder 409. Ela saiu inteira (R6): o corpo NAO carrega mais nada sobre
 * concorrencia, e a ultima alteracao vem do servidor no `GET` e na resposta do
 * `PUT` — nunca daqui para la. Autoria que o cliente pudesse escolher nao seria
 * auditoria.
 */
export interface ComOverrides {
  /** Trilha de auditoria dos dados do Databricks sobrescritos nesta ficha. */
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
 * O que o servidor devolve em qualquer PUT de ficha.
 *
 * A auditoria volta JA COM ESTA GRAVACAO APLICADA, e tem de entrar no state pelo
 * mesmo caminho que a `versao` usava. Sem isso a ficha continuaria exibindo
 * "ultima alteracao: fulano, ontem" no segundo seguinte a voce salvar, ate
 * alguem recarregar a tela — e o campo que substituiu o 409 nasceria mentindo.
 */
export interface RespostaSalvar {
  id: string
  overridesGravados: number
  atualizadoEm: string
  atualizadoPor: string
}

/** Recorta do mapa global de overrides os que pertencem a uma ficha. */
export function overridesDaFicha(overrides: Record<string, Override>, prefixo: string): Override[] {
  return Object.entries(overrides)
    .filter(([chave]) => chave.startsWith(`${prefixo}.`))
    .map(([, o]) => o)
}
