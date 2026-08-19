/**
 * FICHAS — a unidade de gravacao do cadastro.
 *
 * Cada "Salvar" de tela manda UMA ficha (o contrato esta em api/escrita.ts).
 * Este modulo e o unico lugar que monta essa ficha a partir do estado, para que
 * a tela e o controle de "tem mudanca?" nunca discordem: o corpo que o botao
 * envia e exatamente o que a assinatura compara com o ultimo salvamento.
 *
 * `State` entra como TIPO (`import type`) de proposito: o cadastroReducer
 * importa FUNCOES daqui, e um import de valor no sentido contrario fecharia um
 * ciclo em runtime. Import de tipo e apagado na compilacao.
 */
import {
  type FichaCidade,
  type FichaCts,
  type FichaEte,
  type FichaSistema,
  type FichaSubBacia,
  type FichaTopologia,
} from '@/cadastro/api/escrita'
import type { Cidade } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import type { State } from '@/cadastro/state/cadastroReducer'

/** Chave de ficha: `tipo:id`. E o que o mapa de baselines (`salvas`) indexa. */
export type ChaveFicha = string

export const chaveSub = (subId: string): ChaveFicha => `sub:${subId}`
export const chaveCidade = (cidId: string): ChaveFicha => `cid:${cidId}`
export const chaveEte = (eteId: string): ChaveFicha => `ete:${eteId}`
export const chaveCts = (ctsId: string): ChaveFicha => `cts:${ctsId}`
/** A POSICAO de um componente na topologia — nao confundir com `ete:`/`cts:`,
 *  que sao as fichas de DADO do mesmo id. Um componente tem as duas. */
export const chaveTopo = (compId: string): ChaveFicha => `topo:${compId}`
/** O que o SISTEMA declara sobre si (hoje so `usaCts`). */
export const chaveSistema = (sisId: string): ChaveFicha => `sis:${sisId}`

export function fichaSub(state: State, subId: string): FichaSubBacia | null {
  const sub = state.subs?.[subId]
  if (!sub) return null
  return {
    params: sub.params,
    db: sub.db,
    obrasOverride: sub.obrasOverride,
  }
}

/** A cidade e suas metas/faixas de paridade formam uma ficha so. */
export function fichaCidade(state: State, cidId: string): FichaCidade | null {
  const cidade = state.cidades?.find((c) => c.id === cidId)
  if (!cidade || !state.metas || !state.fator) return null
  // A auditoria sai do bloco `cidade`: o corpo do PUT nao carrega autoria (o
  // servidor a tira do token), e inclui-la faria a ficha ficar SUJA no instante
  // seguinte a salvar — a assinatura mudaria sozinha, sem o usuario tocar em nada.
  const { atualizadoEm: _em, atualizadoPor: _por, ...semAuditoria } = cidade
  return {
    cidade: semAuditoria as Cidade,
    metas: state.metas.filter((m) => m.cid === cidId),
    fator: state.fator.filter((f) => f.cid === cidId),
  }
}

export function fichaEte(state: State, eteId: string): FichaEte | null {
  const ete = state.etes?.find((e) => e.id === eteId)
  if (!ete) return null
  const { atualizadoEm: _em, atualizadoPor: _por, ...semAuditoria } = ete
  return { ete: semAuditoria as Ete }
}

export function fichaCts(state: State, ctsId: string): FichaCts | null {
  const cts = state.ctss?.[ctsId]
  if (!cts) return null
  return {
    params: cts.params,
    db: cts.db,
    obrasOverride: cts.obrasOverride,
  }
}

/**
 * A posicao do componente: em que sistema ele esta, e para onde escoa.
 *
 * E exatamente o corpo do `PUT /topologia/:compId`, e nada alem — `nome` e
 * `tipo` ficam de fora porque o servidor nao os aceita: o nome vem do Databricks
 * e o tipo e derivado de onde o componente tem ficha.
 */
export function fichaTopo(state: State, compId: string): FichaTopologia | null {
  const linha = state.hier?.topo.find((t) => t.id === compId)
  return linha ? fichaDaLinhaTopo(linha) : null
}

/** O que o sistema declara sobre si — hoje, se ele usa sistema de CTS. */
export function fichaSistema(state: State, sisId: string): FichaSistema | null {
  const sis = state.hier?.sistemas.find((s) => s.id === sisId)
  return sis ? fichaDoSistema(sis) : null
}

// As duas montagens abaixo recebem a LINHA, e nao o id, para que `sujas` possa
// varrer as listas sem procurar cada uma. Sem isso o custo era QUADRATICO: um
// `find` por chave, vezes uma chave por linha — com os 1.057 componentes de uma
// unidade real, ~1 milhao de comparacoes a cada tecla digitada, porque `sujas`
// recalcula a cada mudanca de estado. Continuam sendo o unico lugar que monta
// estas fichas, que e o que este modulo existe para garantir.
function fichaDaLinhaTopo(t: { sis: string; jus: string }): FichaTopologia {
  return { sisId: t.sis, jusante: t.jus }
}

function fichaDoSistema(s: { usaCts: string }): FichaSistema {
  return { usaCts: s.usaCts === 'true' }
}

/** Ficha de uma chave qualquer, ou null se ela nao existe (mais) no estado. */
export function fichaDe(state: State, chave: ChaveFicha): object | null {
  const corte = chave.indexOf(':')
  const tipo = chave.slice(0, corte)
  const id = chave.slice(corte + 1)
  switch (tipo) {
    case 'sub':
      return fichaSub(state, id)
    case 'cid':
      return fichaCidade(state, id)
    case 'ete':
      return fichaEte(state, id)
    case 'cts':
      return fichaCts(state, id)
    case 'topo':
      return fichaTopo(state, id)
    case 'sis':
      return fichaSistema(state, id)
    default:
      return null
  }
}

/**
 * As assinaturas de TODAS as fichas do Grupo 01, de uma vez.
 *
 * Existe pela mesma razao da varredura em `sujas`: o seed precisa registrar a
 * linha-base de cada componente e de cada sistema, e faze-lo chave a chave
 * custaria um `find` por chave — quadratico, num conjunto de mais de mil linhas,
 * bem no momento em que a tela esta abrindo.
 */
export function assinaturasDaHierarquia(hier: {
  topo: { id: string; sis: string; jus: string }[]
  sistemas: { id: string; usaCts: string }[]
}): Record<ChaveFicha, string> {
  const mapa: Record<ChaveFicha, string> = {}
  for (const t of hier.topo) mapa[chaveTopo(t.id)] = assinatura(fichaDaLinhaTopo(t))
  for (const s of hier.sistemas) mapa[chaveSistema(s.id)] = assinatura(fichaDoSistema(s))
  return mapa
}

// AQUI HAVIA `chavesDeFicha`, que montava a lista de chaves para `sujas` filtrar
// depois. Ela saiu junto com a varredura por chave: `sujas` agora percorre as
// proprias colecoes, e uma lista intermediaria de milhares de strings, refeita a
// cada render, nao servia a mais ninguem.

/** Ordena as chaves de objeto recursivamente (arrays mantem a ordem). */
function ordenado(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenado)
  if (valor && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, ordenado(obj[k])]),
    )
  }
  return valor
}

/**
 * Assinatura estavel da ficha — duas fichas com o mesmo conteudo dao a mesma
 * string mesmo que as chaves tenham sido criadas em ordens diferentes (o mapa
 * de obras, por exemplo, ganha indices na ordem em que o usuario edita).
 */
/**
 * A ficha reduzida ao que o USUARIO controla — e a base de "esta suja?".
 *
 * Nao precisa mais tirar nada: o corpo do PUT so tem o que o usuario controla.
 * Antes tirava `versao`, e agora `atualizadoEm`/`atualizadoPor` sequer chegam
 * aqui — as funcoes acima os removem ao montar a ficha. E a mesma razao de
 * sempre: os dois mudam SOZINHOS a cada gravacao, e um deles na assinatura
 * faria a ficha nascer suja logo depois de salva, com o botao Salvar aceso para
 * sempre.
 */
export function assinatura(ficha: unknown): string {
  return JSON.stringify(ordenado(ficha ?? {}))
}

/**
 * Chaves cujo conteudo atual difere do ultimo salvamento aceito pelo servidor
 * (ou do que veio dele, se nunca salvou). E a definicao de "edicao nao salva"
 * usada pelo botao Salvar, pela guarda de saida e pelo rascunho local.
 *
 * A TOPOLOGIA entra aqui (chaves `topo:`), porque tem para onde ser enviada. O
 * resto do Grupo 01 — nomes de superintendencia, cidade, sistema e unidade — nao
 * tem rota de escrita e continua fora, em `hierAlterada`.
 */
export function sujas(state: State): ChaveFicha[] {
  const fora: ChaveFicha[] = []
  const conferir = (chave: ChaveFicha, ficha: unknown) => {
    if (state.salvas[chave] !== assinatura(ficha)) fora.push(chave)
  }
  for (const id of Object.keys(state.subs ?? {})) conferir(chaveSub(id), fichaSub(state, id))
  for (const c of state.cidades ?? []) conferir(chaveCidade(c.id), fichaCidade(state, c.id))
  for (const e of state.etes ?? []) conferir(chaveEte(e.id), fichaEte(state, e.id))
  for (const id of Object.keys(state.ctss ?? {})) conferir(chaveCts(id), fichaCts(state, id))
  // Topologia e sistemas varrem a LISTA, e nao chave a chave: sao as duas maiores
  // colecoes do Grupo 01 (mais de mil componentes numa unidade real) e o `find`
  // por chave as tornava quadraticas — ver `fichaDaLinhaTopo`.
  for (const t of state.hier?.topo ?? []) conferir(chaveTopo(t.id), fichaDaLinhaTopo(t))
  for (const s of state.hier?.sistemas ?? []) conferir(chaveSistema(s.id), fichaDoSistema(s))
  return fora
}

/**
 * Os NOMES do Grupo 01 foram corrigidos em relacao ao que veio do servidor.
 *
 * Ficam fora de `sujas` porque nao ha para onde envia-los: nao existe rota que
 * grave nome de superintendencia, de cidade, de sistema ou da unidade. Mas SAO
 * edicao local — entram no rascunho e no aviso de fechar a aba, senao a tela
 * prometeria uma persistencia que nao existe.
 *
 * A topologia e comparada A PARTE (ela e ficha, e tem Salvar): sem tirar `topo`
 * daqui, montar o caminho deixaria a tela acesa nos dois lugares ao mesmo tempo —
 * o botao Salvar E o aviso de "isto nao vai para o cadastro", dizendo coisas
 * opostas sobre a mesma edicao.
 */
export function hierAlterada(state: State): boolean {
  if (!state.hier || !state.originalHier) return false
  // `sistemas` sai junto com `topo`: `usaCts` tambem e ficha (`sis:`), e deixa-lo
  // aqui acenderia o aviso de "isto nao vai para o cadastro" sobre um campo que
  // vai. O NOME do sistema continua contando — ele esta no mesmo objeto, e a
  // comparacao abaixo o alcanca pelo resto da lista.
  const semFichas = ({ topo: _t, ...resto }: { topo: unknown }) => ({
    ...resto,
    sistemas: (resto as { sistemas?: { id: string; nome: string; cidId: string }[] }).sistemas?.map(
      ({ usaCts: _u, ...s }: { usaCts?: string; id: string; nome: string; cidId: string }) => s,
    ),
  })
  return assinatura(semFichas(state.hier)) !== assinatura(semFichas(state.originalHier))
}
