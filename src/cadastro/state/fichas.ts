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
  overridesDaFicha,
  type FichaCidade,
  type FichaCts,
  type FichaEte,
  type FichaSubBacia,
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

export function fichaSub(state: State, subId: string): FichaSubBacia | null {
  const sub = state.subs?.[subId]
  if (!sub) return null
  return {
    params: sub.params,
    db: sub.db,
    obrasOverride: sub.obrasOverride,
    overrides: overridesDaFicha(state.overrides, subId),
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
    overrides: overridesDaFicha(state.overrides, cidId),
  }
}

export function fichaEte(state: State, eteId: string): FichaEte | null {
  const ete = state.etes?.find((e) => e.id === eteId)
  if (!ete) return null
  const { atualizadoEm: _em, atualizadoPor: _por, ...semAuditoria } = ete
  return { ete: semAuditoria as Ete, overrides: overridesDaFicha(state.overrides, eteId) }
}

export function fichaCts(state: State, ctsId: string): FichaCts | null {
  const cts = state.ctss?.[ctsId]
  if (!cts) return null
  return {
    params: cts.params,
    db: cts.db,
    obrasOverride: cts.obrasOverride,
    overrides: overridesDaFicha(state.overrides, ctsId),
  }
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
    default:
      return null
  }
}

/** Todas as chaves de ficha que existem no estado atual. */
function chavesDeFicha(state: State): ChaveFicha[] {
  return [
    ...Object.keys(state.subs ?? {}).map(chaveSub),
    ...(state.cidades ?? []).map((c) => chaveCidade(c.id)),
    ...(state.etes ?? []).map((e) => chaveEte(e.id)),
    ...Object.keys(state.ctss ?? {}).map(chaveCts),
  ]
}

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
 * Nao inclui a hierarquia: o backend ainda nao expoe gravacao dela, entao ela
 * nao tem ficha nem botao Salvar (ver DEPLOY.md).
 */
export function sujas(state: State): ChaveFicha[] {
  return chavesDeFicha(state).filter(
    (chave) => state.salvas[chave] !== assinatura(fichaDe(state, chave)),
  )
}

/**
 * A hierarquia foi corrigida em relacao ao que veio do servidor.
 *
 * Fica fora de `sujas` porque nao ha para onde enviar: ela nao tem ficha nem
 * botao Salvar. Mas E uma edicao local — entra no rascunho e no aviso de fechar
 * a aba, senao a tela prometeria uma persistencia que nao existe.
 */
export function hierAlterada(state: State): boolean {
  if (!state.hier || !state.originalHier) return false
  return assinatura(state.hier) !== assinatura(state.originalHier)
}
