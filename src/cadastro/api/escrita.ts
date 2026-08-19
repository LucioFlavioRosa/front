/**
 * CONTRATO DE ESCRITA — a especificacao que o backend do cadastro tem de honrar.
 *
 * Granularidade: **uma ficha por vez** (o que o botao "Salvar" de cada tela
 * promete). Nao ha autosave por campo; o usuario edita a ficha inteira e salva.
 *
 *   PUT    /unidades/:uid/sub-bacias/:subId   FichaSubBacia   -> 200 (eco da ficha)
 *   PUT    /unidades/:uid/contrato/:cidId     FichaCidade     -> 200
 *   PUT    /unidades/:uid/etes/:eteId         FichaEte        -> 200
 *   PUT    /unidades/:uid/cts/:ctsId          FichaCts        -> 200
 *   PUT    /unidades/:uid/topologia/:compId   FichaTopologia  -> 200 (SEM auditoria)
 *   PUT    /unidades/:uid/sistemas/:sisId     FichaSistema    -> 200 (SEM auditoria)
 *   DELETE /unidades/:uid/topologia/:compId                   -> 200 (SEM auditoria)
 *
 * NAO ha POST nem DELETE de CTS, de proposito: a CTS e no da topologia, e
 * cria-la aqui produziria uma ficha que o motor nunca carrega. Colocar e tirar
 * CTS de um sistema sao as duas rotas de TOPOLOGIA acima.
 *
 * Regras que valem para todas:
 *  - o corpo carrega a ficha INTEIRA, nao um patch: salvar e idempotente;
 *  - a trilha de auditoria e gravada na MESMA transacao do dado (senao um erro
 *    parcial deixa dado sem trilha) — mas quem a calcula e o SERVIDOR, comparando
 *    o gravado com o que chega. O corpo nao a carrega;
 *  - 400/422 = conteudo recusado; 401/403 = sessao (ver auth/sessao.ts).
 *
 * NAO ha 409 na escrita de ficha: o servidor aceita a gravacao e REGISTRA quem
 * gravou (`atualizadoEm`/`atualizadoPor`). O 409 de SIMULACAO existe, e e outro
 * assunto (ver `CONTRATO.md` §1).
 */
import type { Cidade, Fator, Meta } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'

/**
 * O que TODA ficha carrega, seja qual for a tela: hoje, nada alem dos blocos de
 * dado.
 *
 * Vazia de proposito. O corpo do PUT NAO leva versao nem trilha de alteracoes —
 * quem sabe o que mudou e o servidor, que compara o gravado com o que chega. As
 * quatro fichas a estendem, e ela e o lugar de "o que toda ficha carrega" se
 * voltar a haver algo comum.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ver acima
export interface FichaComum {}

export interface FichaSubBacia extends FichaComum {
  params: SubBaciaParams
  db: SubBaciaDb
  /** Só os campos alterados de cada obra, por índice ("0".."4"). */
  obrasOverride: Record<string, Partial<Obra>>
}

/** A cidade e suas metas/faixas de paridade formam uma ficha só. */
export interface FichaCidade extends FichaComum {
  cidade: Cidade
  metas: Meta[]
  fator: Fator[]
}

export interface FichaEte extends FichaComum {
  ete: Ete
}

export interface FichaCts extends FichaComum {
  params: SubBaciaParams
  db: SubBaciaDb
  /** Índices "0".."3" — a CTS tem 4 componentes. */
  obrasOverride: Record<string, Partial<Obra>>
}

/**
 * A POSICAO de um componente: em que sistema ele esta, e para onde escoa.
 *
 * E a ficha do Grupo 01, e a unica que nao descreve numeros — descreve a forma do
 * sistema. `sisId` vazio tira o componente do sistema (o mesmo efeito do
 * `DELETE`); `jusante` vazio e caminho ainda nao montado.
 *
 * O servidor RECUSA (422) o que deixaria a forma incoerente: ciclo, jusante em
 * outro sistema, jusante em si mesmo, ETE com jusante, segunda ETE no sistema, e
 * tirar/mover componente para o qual alguem ainda escoa. A mensagem nomeia os
 * componentes envolvidos, e e ela que vai para o toast — "topologia invalida" nao
 * ajudaria quem esta montando um sistema.
 *
 * O que e apenas INCOMPLETO passa: durante a montagem o caminho fica pela metade
 * o tempo todo.
 */
export interface FichaTopologia extends FichaComum {
  sisId: string
  jusante: string
}

/**
 * O que o SISTEMA declara sobre si.
 *
 * `usaCts` marcado: o sistema aceita UMA CTS. Desmarcado: aceita varias. O
 * servidor recusa (422) marcar num sistema que ja tem mais de uma, e recusa
 * adicionar a segunda num sistema marcado — nomeando as que estao la.
 *
 * O NOME do sistema nao entra aqui: vem do Databricks e nao tem rota de escrita,
 * como o resto dos nomes do Grupo 01.
 */
export interface FichaSistema extends FichaComum {
  usaCts: boolean
}

/**
 * O que o servidor devolve em qualquer PUT de ficha.
 *
 * A auditoria volta JA COM ESTA GRAVACAO APLICADA, e entra no state na mesma
 * hora. Sem isso a ficha exibiria "ultima alteracao: fulano, ontem" no segundo
 * seguinte a voce salvar, ate alguem recarregar a tela.
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

/**
 * A resposta da TOPOLOGIA — sem auditoria, e nao por esquecimento.
 *
 * `sistema_topologia` nao tem `atualizado_em`/`atualizado_por`: ela e a tabela de
 * ESTRUTURA, e as colunas de auditoria existem so nas quatro tabelas de ficha
 * (`006_auditoria_cadastro.sql`). Quem gravou o que esta na trilha, em
 * `GET /unidades/:uid/alteracoes?tipo=topologia`.
 *
 * Por isso as mutations de topologia nao passam por `conferirContrato`: exigir
 * `atualizadoPor` aqui acusaria o servidor de quebrar um contrato que nunca foi
 * o dele.
 */
export type RespostaTopologia = Pick<RespostaSalvar, 'id' | 'alteracoesGravadas'>
