/**
 * RASCUNHO LOCAL — rede de seguranca para a edicao que ainda nao foi salva.
 *
 * O estado do cadastro vive em memoria (CadastroContext). Sem isto, um F5 ou um
 * "voltar para a selecao de unidade" antes de Salvar apagava a ficha inteira.
 * Aqui ele e espelhado no `sessionStorage`, por unidade.
 *
 * Por que sessionStorage e nao localStorage: o rascunho e da SESSAO de trabalho
 * daquela aba. Sobrevive a recarga e a navegacao dentro do app, morre quando a
 * aba fecha — que e o comportamento que o usuario espera de algo "nao salvo", e
 * evita que uma edicao esquecida de semanas atras reapareca por cima de um dado
 * que o servidor mudou nesse meio tempo.
 *
 * Nao substitui Salvar: o que esta so aqui nao existe para mais ninguem.
 */
import { CHAVES_DB } from '../domain/baseComercial'
import { CHAVES_PARAMS } from '../domain/subbacia'
import { seeded, type State } from './cadastroReducer'

/**
 * Sobe quando o formato do State muda — rascunho de versao antiga e ignorado.
 *
 * v3: populacao saiu de `db` e entrou em `params`; o State ganhou `cidadeDaSub`.
 * v4: colunas novas nas duas fichas — recorte industrial (`ligUInd`, `ligAInd`,
 *     `fatInd`, `arrInd`) em `db`, `vazInd` em `params`, e as obras trocaram
 *     `ini` por `tPred`/`anoObrig`/`proibAte`.
 *
 * Subir este numero e OBRIGATORIO a cada mudanca de formato — mas depender de
 * alguem lembrar ja falhou duas vezes, por isso existe `formatoCompativel`.
 */
const VERSAO = 4

const chave = (unidadeId: string) => `cadastro:rascunho:v${VERSAO}:${unidadeId}`

interface Envelope {
  v: number
  unidadeId: string
  estado: State
}

/**
 * Unidades cujo rascunho o usuario mandou jogar fora ("recarregar do servidor").
 *
 * Descartar remonta o provider, e o provider antigo grava uma ultima vez ao
 * desmontar (o flush que salva as teclas dos ultimos milissegundos) — sem esta
 * marca, essa gravacao ressuscitava exatamente o rascunho recem-descartado, que
 * voltaria na proxima vez que a unidade fosse aberta. A marca cai quando um
 * provider novo le o rascunho daquela unidade: dai em diante e vida nova.
 */
const descartados = new Set<string>()

/** sessionStorage pode faltar (SSR) ou lancar (modo privado antigo, cota). */
function loja(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/**
 * O rascunho tem as chaves que a ficha usa hoje?
 *
 * O cinto de seguranca do `VERSAO`: como o numero depende de alguem lembrar de
 * subir — e ja foi esquecido duas vezes —, aqui se compara a forma do dado
 * guardado com o que o dominio espera. Ficha sem uma chave nova quebraria no
 * primeiro `params[k].trim()` do calculo de pendencia, com a tela em branco;
 * melhor perder o rascunho e recarregar do servidor.
 */
function formatoCompativel(estado: State): boolean {
  const fichas = [...Object.values(estado.subs ?? {}), ...Object.values(estado.ctss ?? {})]
  return fichas.every(
    (f) =>
      CHAVES_PARAMS.every((k) => k in (f.params ?? {})) &&
      CHAVES_DB.every((k) => k in (f.db ?? {})),
  )
}

/**
 * Rascunho da unidade, ou null se nao ha, esta corrompido, e de outra versao ou
 * tem formato antigo. Exige um estado ja semeado: hidratar um estado pela
 * metade deixaria as telas esperando por um seed que o CadastroContext nao vai
 * mais disparar.
 */
export function lerRascunho(unidadeId: string): State | null {
  descartados.delete(unidadeId)
  const store = loja()
  if (!store) return null
  const bruto = store.getItem(chave(unidadeId))
  if (!bruto) return null
  try {
    const envelope = JSON.parse(bruto) as Envelope
    if (envelope.v !== VERSAO || envelope.unidadeId !== unidadeId) throw new Error('rascunho velho')
    if (!envelope.estado || !seeded(envelope.estado)) throw new Error('rascunho incompleto')
    if (!formatoCompativel(envelope.estado)) throw new Error('rascunho de formato antigo')
    return envelope.estado
  } catch {
    store.removeItem(chave(unidadeId))
    return null
  }
}

export function gravarRascunho(unidadeId: string, estado: State): void {
  if (descartados.has(unidadeId)) return
  const store = loja()
  if (!store) return
  try {
    const envelope: Envelope = { v: VERSAO, unidadeId, estado }
    store.setItem(chave(unidadeId), JSON.stringify(envelope))
  } catch {
    // Cota estourada ou storage bloqueado: seguir sem rascunho e melhor do que
    // derrubar a tela. O dado continua em memoria e o Salvar continua valendo.
  }
}

/** Rascunho deixou de fazer sentido (tudo salvo). Nao bloqueia gravacoes futuras. */
export function limparRascunho(unidadeId: string): void {
  loja()?.removeItem(chave(unidadeId))
}

/** Descarte a pedido do usuario: apaga E impede o flush de saida de regravar. */
export function descartarRascunho(unidadeId: string): void {
  descartados.add(unidadeId)
  limparRascunho(unidadeId)
}
