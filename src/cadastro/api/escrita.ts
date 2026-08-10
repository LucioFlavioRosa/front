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
 *  - a trilha de auditoria e gravada na MESMA transacao do dado (senao um erro
 *    parcial deixa dado sem trilha) — mas quem a calcula e o SERVIDOR, comparando
 *    o gravado com o que chega. O corpo nao a carrega;
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

/**
 * O que TODA ficha carrega, seja qual for a tela.
 *
 * Hoje: nada alem dos blocos de dado. Duas coisas moravam aqui e sairam, e as
 * duas pelo mesmo motivo — o cliente nao e fonte confiavel sobre si mesmo:
 *
 *   `versao`     o corpo a devolvia para o servidor conferir e responder 409.
 *                Saiu com o 409 (R6); a ultima alteracao vem do SERVIDOR, no
 *                `GET` e na resposta do `PUT`.
 *   `overrides`  o corpo trazia a trilha PRONTA, montada aqui. Auditoria que
 *                pergunta ao auditado o que ele mudou tem o defeito no desenho:
 *                um bug neste arquivo e o rastro sumia sem sinal. E era o caso
 *                de metade da ficha — `params`, obras, cidade e ETE nunca
 *                geraram linha, porque so o bloco do Databricks virava override.
 *                Hoje o SERVIDOR compara o gravado com o que chega.
 *
 * A interface fica, vazia, porque as quatro fichas a estendem e ela e o lugar de
 * "o que toda ficha carrega" — voltar a haver algo comum e provavel.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ver acima
export interface ComOverrides {}

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
  /** Quantos campos o servidor viu mudar. Zero e resposta legitima: salvar sem
   *  alterar nada nao gera trilha, e a contagem e o unico jeito de quem chamou
   *  conferir que ela foi junto sem consultar o banco. */
  alteracoesGravadas: number
  atualizadoEm: string
  atualizadoPor: string
}

