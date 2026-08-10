/**
 * Reducer puro do cadastro (sem React) — fonte unica de mutacao dos 5 datasets.
 * Isolado aqui para ser testavel: reducer(state, action) -> state, sem efeitos.
 * Valores impuros (timestamp) chegam prontos no payload das actions.
 */
import {
  camposDaSub,
  cidadePorSub,
  subPend,
  type Obra,
  type SubBacia,
  type SubBaciaDb,
  type SubBaciaParams,
  type SupNode,
  OBRAS_POR_SUBBACIA,
} from '@/cadastro/domain/subbacia'
import { auditoriaDe, type Auditoria } from '@/cadastro/domain/auditoria'
import { reguaDe, type Regua } from '@/cadastro/domain/baseComercial'
import { g2Pend, type Cidade, type Fator, type Meta } from '@/cadastro/domain/contrato'
import { etePend, isNova, type Ete } from '@/cadastro/domain/ete'
import { camposDaCts, ctsPend, OBRAS_POR_CTS, type Cts, type ParCts } from '@/cadastro/domain/cts'
import type {
  CidadeH,
  SistemaH,
  Superintendencia,
  TopoRow,
  UnidReg,
} from '@/cadastro/domain/hierarquia'
import {
  assinatura,
  chaveCidade,
  chaveCts,
  chaveEte,
  chaveSub,
  fichaDe,
  type ChaveFicha,
} from '@/cadastro/state/fichas'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const AUTOR = 'Regional/Unidade'

export interface Hier {
  unidReg: UnidReg
  superintendencias: Superintendencia[]
  cidades: CidadeH[]
  sistemas: SistemaH[]
  topo: TopoRow[]
}

/** Registro da trilha de auditoria de um dado do Databricks sobrescrito. */
export interface Override {
  campo: string
  valorAntigo: string
  valorNovo: string
  autor: string
  /** ISO timestamp — carimbado no dispatch (mantem o reducer puro). */
  at: string
}

export interface State {
  subs: Record<string, SubBacia> | null
  cidades: Cidade[] | null
  metas: Meta[] | null
  fator: Fator[] | null
  etes: Ete[] | null
  hier: Hier | null
  /** Grupo 05 — CTS (esparsa: so existe para algumas sub-bacias). */
  ctss: Record<string, Cts> | null
  /** De-para da sobreposicao CTS ↔ sub-bacia (1:1). */
  pares: ParCts[] | null
  /**
   * De-para sub-bacia → cidade, tirado da arvore no seed. E por ele que a ficha
   * sabe a regua da meta (a cobertura e atributo da CIDADE, grupo 02) — e a
   * regua decide se os campos de populacao existem e contam pendencia.
   */
  cidadeDaSub: Record<string, string> | null
  /** Snapshots imutaveis do servidor — usados como valorAntigo dos overrides. */
  originalSubs: Record<string, SubBacia> | null
  originalCtss: Record<string, Cts> | null
  originalHier: Hier | null
  overrides: Record<string, Override>
  /**
   * Assinatura de cada ficha no ultimo estado que o SERVIDOR tem — o que veio
   * dele no seed e, dai em diante, o que cada Salvar bem-sucedido enviou.
   * Ficha cuja assinatura atual difere desta e "nao salva" (state/fichas.ts).
   * Nao substitui `originalSubs`/`originalHier`: aqueles guardam o dado bruto
   * do Databricks, que continua sendo o `valorAntigo` da trilha de override
   * mesmo depois de varios salvamentos.
   */
  salvas: Record<ChaveFicha, string>
  /**
   * Assinatura do payload de cada fatia no momento em que ela foi semeada.
   * Serve para o rascunho: ao recuperar um, o app compara estas impressoes com
   * o que a rede acabou de trazer e avisa se o servidor mudou nesse meio tempo
   * (enquanto nao ha versao/ETag por ficha, e o que da para conferir).
   */
  impressoes: Impressoes
}

export type FatiaDados = 'subs' | 'contrato' | 'etes' | 'hier' | 'cts'
export type Impressoes = Partial<Record<FatiaDados, string>>

export const initialState: State = {
  subs: null,
  cidades: null,
  metas: null,
  fator: null,
  etes: null,
  hier: null,
  ctss: null,
  pares: null,
  cidadeDaSub: null,
  originalSubs: null,
  originalCtss: null,
  originalHier: null,
  overrides: {},
  salvas: {},
  impressoes: {},
}

export type Action =
  // seeding (uma vez, quando cada query resolve)
  | { type: 'SEED_SUBS'; subs: Record<string, SubBacia>; arvore: SupNode[] }
  | { type: 'SEED_CONTRATO'; cidades: Cidade[]; metas: Meta[]; fator: Fator[] }
  | { type: 'SEED_ETES'; etes: Ete[] }
  | { type: 'SEED_HIER'; hier: Hier }
  | { type: 'SEED_CTS'; ctss: Record<string, Cts>; pares: ParCts[] }
  // grupo 03 · sub-bacias
  | { type: 'SET_SUB_PARAM'; subId: string; key: keyof SubBaciaParams; value: string }
  | { type: 'SET_OBRA_FIELD'; subId: string; index: number; key: keyof Obra; value: string }
  | { type: 'EDIT_DB_FIELD'; subId: string; key: keyof SubBaciaDb; value: string; at: string }
  // grupo 04 · ETEs
  | { type: 'SET_ETE_FIELD'; eteId: string; key: keyof Ete; value: string }
  // grupo 05 · CTS (irma da sub-bacia: mesmas acoes + criar/remover, por ser esparsa)
  | { type: 'SET_CTS_PARAM'; ctsId: string; key: keyof SubBaciaParams; value: string }
  | { type: 'SET_CTS_OBRA_FIELD'; ctsId: string; index: number; key: keyof Obra; value: string }
  | { type: 'EDIT_CTS_DB_FIELD'; ctsId: string; key: keyof SubBaciaDb; value: string; at: string }
  // grupo 02 · contrato & metas
  | { type: 'SET_CIDADE_FIELD'; cidId: string; key: keyof Cidade; value: string }
  | { type: 'ADD_META'; cid: string }
  | { type: 'SET_META'; index: number; key: keyof Meta; value: string }
  | { type: 'REMOVE_META'; index: number }
  | { type: 'ADD_FATOR'; cid: string }
  | { type: 'SET_FATOR'; index: number; key: keyof Fator; value: string }
  | { type: 'REMOVE_FATOR'; index: number }
  // grupo 01 · hierarquia (Databricks — todos gravam override)
  | { type: 'SET_HIER_UNIDREG'; key: keyof UnidReg; value: string; at: string }
  | { type: 'SET_HIER_SUP_NOME'; supId: string; value: string; at: string }
  | { type: 'SET_HIER_CID_NOME'; cidId: string; value: string; at: string }
  | { type: 'SET_HIER_SIS_NOME'; sisId: string; value: string; at: string }
  | { type: 'SET_HIER_TOPO_JUSANTE'; index: number; value: string; at: string }
  // o servidor aceitou uma ficha: ela passa a ser o novo "sem mudancas"
  | { type: 'FICHA_SALVA'; chave: ChaveFicha; assinatura: string; auditoria?: Partial<Auditoria> }

/**
 * Acrescenta/atualiza um override, sempre preservando o valor ORIGINAL.
 *
 * Voltar o campo ao valor que veio do servidor APAGA o override: nao houve
 * correcao nenhuma. Sem isso o backend receberia uma trilha dizendo "X virou X"
 * e a ficha ficaria eternamente "nao salva" (a assinatura inclui a trilha).
 */
function withOverride(
  state: State,
  chave: string,
  campo: string,
  original: string | undefined,
  novo: string,
  at: string,
): Record<string, Override> {
  if (novo === (original ?? '')) {
    const { [chave]: _desfeito, ...resto } = state.overrides
    return resto
  }
  return {
    ...state.overrides,
    [chave]: { campo, valorAntigo: original ?? '', valorNovo: novo, autor: AUTOR, at },
  }
}

/**
 * Grava o campo digitado na obra daquele indice.
 *
 * Antes esta funcao APAGAVA o campo quando o valor digitado era igual ao da
 * obra-base, e apagava o indice inteiro quando nao sobrava campo nenhum. Fazia
 * sentido enquanto `obrasOverride` era mesmo um override: o que nao estivesse la
 * seria completado pela base literal, dos dois lados.
 *
 * As bases sairam (R1/R2). O mapa agora carrega a obra INTEIRA, como o servidor
 * a mandou, e apagar campo dele nao economizaria payload: criaria buraco. O
 * campo voltaria vazio na tela, contaria pendencia e o `PUT` gravaria NULL numa
 * coluna que tinha valor.
 *
 * E o "digitou de volta o valor original" continua funcionando sem truque
 * nenhum: se o valor e o mesmo, o objeto fica identico ao que veio, a assinatura
 * bate com a de `salvas`, e a ficha nao aparece como suja. Quem decide isso e a
 * comparacao de conteudo (`assinatura` em `state/fichas.ts`) — nunca foi preciso
 * apagar chave para consegui-lo.
 *
 * O indice que nao existe no mapa continua nao existindo: a tela so renderiza as
 * obras que vieram, entao nao ha como digitar num indice ausente. Cria-lo aqui
 * seria a base literal de volta, uma linha por vez.
 */
function withObraOverride(
  override: Record<string, Partial<Obra>>,
  index: number,
  key: keyof Obra,
  value: string,
): Record<string, Partial<Obra>> {
  const i = String(index)
  if (!(i in override)) return override
  return { ...override, [i]: { ...override[i], [key]: value } }
}

/**
 * Marca as fichas indicadas como iguais ao que o servidor tem — usado no seed
 * (acabou de chegar dele) e depois de cada gravacao aceita.
 */
function semMudancas(state: State, chaves: ChaveFicha[]): State {
  const salvas = { ...state.salvas }
  for (const chave of chaves) salvas[chave] = assinatura(fichaDe(state, chave))
  return { ...state, salvas }
}

/** Registra de que versao do payload esta fatia foi semeada. */
function comImpressao(state: State, fatia: FatiaDados, payload: unknown): State {
  return { ...state, impressoes: { ...state.impressoes, [fatia]: assinatura(payload) } }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SEED_SUBS':
      return semMudancas(
        comImpressao(
          {
            ...state,
            subs: clone(action.subs),
            originalSubs: clone(action.subs),
            cidadeDaSub: cidadePorSub(action.arvore),
          },
          'subs',
          action.subs,
        ),
        Object.keys(action.subs).map(chaveSub),
      )
    case 'SEED_CONTRATO':
      return semMudancas(
        comImpressao(
          {
            ...state,
            cidades: clone(action.cidades),
            metas: clone(action.metas),
            fator: clone(action.fator),
          },
          'contrato',
          { cidades: action.cidades, metas: action.metas, fator: action.fator },
        ),
        action.cidades.map((c) => chaveCidade(c.id)),
      )
    case 'SEED_ETES':
      return semMudancas(
        comImpressao({ ...state, etes: clone(action.etes) }, 'etes', action.etes),
        action.etes.map((e) => chaveEte(e.id)),
      )
    case 'SEED_HIER':
      // A hierarquia nao tem ficha: o backend ainda nao expoe gravacao dela.
      return comImpressao(
        { ...state, hier: clone(action.hier), originalHier: clone(action.hier) },
        'hier',
        action.hier,
      )
    case 'SEED_CTS':
      return semMudancas(
        comImpressao(
          {
            ...state,
            ctss: clone(action.ctss),
            pares: clone(action.pares),
            originalCtss: clone(action.ctss),
          },
          'cts',
          { ctss: action.ctss, pares: action.pares },
        ),
        Object.keys(action.ctss).map(chaveCts),
      )

    case 'FICHA_SALVA': {
      const salvas = { ...state.salvas, [action.chave]: action.assinatura }
      // A auditoria NOVA volta para a entidade: quem acabou de salvar tem de ver
      // o proprio nome na ficha, e nao o de quem salvou antes dele.
      //
      // SERVIDOR 2xx SEM auditoria é quebra de contrato, e há duas saídas ruins:
      //
      //  a) manter a auditoria antiga → a ficha exibe "última alteração: fulano,
      //     ontem" logo depois de VOCÊ salvar. O único aviso que sobrou sobre
      //     gravação concorrente passa a apontar a pessoa errada, e aviso que
      //     MENTE é pior que aviso ausente: ensina a ignorá-lo.
      //  b) marcar a ficha como NÃO salva → mas o servidor ACEITOU. Dizer que
      //     não salvou faz a pessoa salvar de novo um dado que já está no banco.
      //
      // Nenhuma das duas: sem auditoria na resposta, a ficha fica com os campos
      // VAZIOS — que é o que a tela mostra para ficha nunca gravada, e é a
      // afirmação mais fraca possível ("não sei"), em vez de uma errada. A perda
      // vai para o console (`conferirContrato` em api/mutations.ts).
      return {
        ...state,
        salvas,
        ...comAuditoria(state, action.chave, auditoriaDe(action.auditoria)),
      }
    }

    case 'SET_SUB_PARAM': {
      const sub = state.subs![action.subId]
      return {
        ...state,
        subs: {
          ...state.subs,
          [action.subId]: { ...sub, params: { ...sub.params, [action.key]: action.value } },
        },
      }
    }
    case 'SET_OBRA_FIELD': {
      const sub = state.subs![action.subId]
      return {
        ...state,
        subs: {
          ...state.subs,
          [action.subId]: {
            ...sub,
            obrasOverride: withObraOverride(
              sub.obrasOverride,
              action.index,
              action.key,
              action.value,
            ),
          },
        },
      }
    }
    case 'EDIT_DB_FIELD': {
      const sub = state.subs![action.subId]
      const original = state.originalSubs?.[action.subId]?.db[action.key] ?? sub.db[action.key]
      return {
        ...state,
        subs: {
          ...state.subs,
          [action.subId]: { ...sub, db: { ...sub.db, [action.key]: action.value } },
        },
        overrides: withOverride(
          state,
          `${action.subId}.${action.key}`,
          action.key,
          original,
          action.value,
          action.at,
        ),
      }
    }

    case 'SET_ETE_FIELD':
      return {
        ...state,
        etes: state.etes!.map((e) =>
          e.id === action.eteId ? { ...e, [action.key]: action.value } : e,
        ),
      }

    case 'SET_CTS_PARAM': {
      const cts = state.ctss![action.ctsId]
      return {
        ...state,
        ctss: {
          ...state.ctss,
          [action.ctsId]: { ...cts, params: { ...cts.params, [action.key]: action.value } },
        },
      }
    }
    case 'SET_CTS_OBRA_FIELD': {
      const cts = state.ctss![action.ctsId]
      return {
        ...state,
        ctss: {
          ...state.ctss,
          [action.ctsId]: {
            ...cts,
            obrasOverride: withObraOverride(
              cts.obrasOverride,
              action.index,
              action.key,
              action.value,
            ),
          },
        },
      }
    }
    case 'EDIT_CTS_DB_FIELD': {
      const cts = state.ctss![action.ctsId]
      const original = state.originalCtss?.[action.ctsId]?.db[action.key] ?? cts.db[action.key]
      return {
        ...state,
        ctss: {
          ...state.ctss,
          [action.ctsId]: { ...cts, db: { ...cts.db, [action.key]: action.value } },
        },
        overrides: withOverride(
          state,
          `${action.ctsId}.${action.key}`,
          action.key,
          original,
          action.value,
          action.at,
        ),
      }
    }
    // NAO ha ADD_CTS nem REMOVE_CTS, e isso e deliberado. A CTS e um NO DA
    // TOPOLOGIA: cria-la pela tela gravava ficha e par sem tocar em
    // `sistema_topologia`, produzindo uma CTS que o motor nunca ve; remove-la
    // apagava a ficha e deixava o no, que virava um no de demanda ZERO.
    // Topologia se corrige no cadastro estrutural (Grupo 01).
    case 'SET_CIDADE_FIELD':
      return {
        ...state,
        cidades: state.cidades!.map((c) =>
          c.id === action.cidId ? { ...c, [action.key]: action.value } : c,
        ),
      }
    case 'ADD_META':
      return { ...state, metas: [...state.metas!, { cid: action.cid, ano: '', pct: '' }] }
    case 'SET_META':
      return {
        ...state,
        metas: state.metas!.map((m, j) =>
          j === action.index ? { ...m, [action.key]: action.value } : m,
        ),
      }
    case 'REMOVE_META':
      return { ...state, metas: state.metas!.filter((_, j) => j !== action.index) }
    case 'ADD_FATOR':
      return { ...state, fator: [...state.fator!, { cid: action.cid, cob: '', par: '' }] }
    case 'SET_FATOR':
      return {
        ...state,
        fator: state.fator!.map((f, j) =>
          j === action.index ? { ...f, [action.key]: action.value } : f,
        ),
      }
    case 'REMOVE_FATOR':
      return { ...state, fator: state.fator!.filter((_, j) => j !== action.index) }

    case 'SET_HIER_UNIDREG':
      return {
        ...state,
        hier: { ...state.hier!, unidReg: { ...state.hier!.unidReg, [action.key]: action.value } },
        overrides: withOverride(
          state,
          `hier.unidReg.${action.key}`,
          action.key,
          state.originalHier?.unidReg[action.key],
          action.value,
          action.at,
        ),
      }
    case 'SET_HIER_SUP_NOME':
      return {
        ...state,
        hier: {
          ...state.hier!,
          superintendencias: state.hier!.superintendencias.map((s) =>
            s.id === action.supId ? { ...s, nome: action.value } : s,
          ),
        },
        overrides: withOverride(
          state,
          `hier.sup.${action.supId}`,
          'nome',
          state.originalHier?.superintendencias.find((s) => s.id === action.supId)?.nome,
          action.value,
          action.at,
        ),
      }
    case 'SET_HIER_CID_NOME':
      return {
        ...state,
        hier: {
          ...state.hier!,
          cidades: state.hier!.cidades.map((c) =>
            c.id === action.cidId ? { ...c, nome: action.value } : c,
          ),
        },
        overrides: withOverride(
          state,
          `hier.cid.${action.cidId}`,
          'nome',
          state.originalHier?.cidades.find((c) => c.id === action.cidId)?.nome,
          action.value,
          action.at,
        ),
      }
    case 'SET_HIER_SIS_NOME':
      return {
        ...state,
        hier: {
          ...state.hier!,
          sistemas: state.hier!.sistemas.map((s) =>
            s.id === action.sisId ? { ...s, nome: action.value } : s,
          ),
        },
        overrides: withOverride(
          state,
          `hier.sis.${action.sisId}`,
          'nome',
          state.originalHier?.sistemas.find((s) => s.id === action.sisId)?.nome,
          action.value,
          action.at,
        ),
      }
    case 'SET_HIER_TOPO_JUSANTE':
      return {
        ...state,
        hier: {
          ...state.hier!,
          topo: state.hier!.topo.map((t, j) =>
            j === action.index ? { ...t, jus: action.value } : t,
          ),
        },
        overrides: withOverride(
          state,
          `hier.topo.${action.index}`,
          'componente_sistema_id_jusante',
          state.originalHier?.topo[action.index]?.jus,
          action.value,
          action.at,
        ),
      }

    default:
      return state
  }
}

// ───────────────────────── selectors puros ─────────────────────────

export interface Derivado {
  g2: number
  g3: number
  g4: number
  /** Pendencias das CTS existentes (grupo 05). */
  g5: number
  pendTotal: number
  completude: number
  counts: {
    cidades: number
    sistemas: number
    subBacias: number
    obras: number
    metas: number
    etes: number
    cts: number
    /** Obras das CTS (4 por CTS) — separadas das obras de sub-bacia. */
    ctsObras: number
  }
}

/**
 * Regua da meta de uma sub-bacia: vem da cidade dela (grupo 02), alcancada pelo
 * de-para da arvore. Sub-bacia fora da arvore, ou cidade sem cobertura
 * escolhida, devolve null — e null nao acrescenta campo nem pendencia.
 */
/**
 * Grava a auditoria nova na entidade que a `chave` aponta.
 *
 * Devolve so a fatia mudada, para o `case` acima ficar legivel. Chave
 * desconhecida devolve `{}`: a ficha exibir uma alteracao desatualizada e ruim,
 * mas quebrar o salvamento por causa de um tipo de ficha novo seria pior.
 */
function comAuditoria(state: State, chave: ChaveFicha, a: Auditoria): Partial<State> {
  const [tipo, id] = chave.split(':')
  if (tipo === 'sub' && state.subs?.[id])
    return { subs: { ...state.subs, [id]: { ...state.subs[id], ...a } } }
  if (tipo === 'cts' && state.ctss?.[id])
    return { ctss: { ...state.ctss, [id]: { ...state.ctss[id], ...a } } }
  if (tipo === 'ete' && state.etes)
    return { etes: state.etes.map((e) => (e.id === id ? { ...e, ...a } : e)) }
  if (tipo === 'cid' && state.cidades)
    return { cidades: state.cidades.map((c) => (c.id === id ? { ...c, ...a } : c)) }
  return {}
}

export function reguaDaSub(state: State, subId: string): Regua | null {
  const cidId = state.cidadeDaSub?.[subId]
  if (!cidId) return null
  return reguaDe(state.cidades?.find((c) => c.id === cidId)?.cob)
}

/** A CTS herda a regua da sub-bacia pareada (a area e a mesma cidade). */
export function reguaDaCts(state: State, ctsId: string): Regua | null {
  const subId = state.pares?.find((p) => p.cts === ctsId)?.sub
  return subId ? reguaDaSub(state, subId) : null
}

/** true quando as 5 fatias ja foram semeadas. */
export function seeded(state: State): boolean {
  return !!(
    state.subs &&
    // Entra na conta junto com `subs` porque e semeado pela mesma action. Sem
    // ele, um rascunho gravado por uma versao anterior do app hidrataria um
    // estado "completo" mas sem o de-para sub-bacia → cidade: o seed nao roda
    // de novo (a fatia nao esta vazia) e a tela fica sem saber a regua da meta
    // pelo resto da sessao. Exigir aqui faz o rascunho velho ser descartado.
    state.cidadeDaSub &&
    state.cidades &&
    state.metas &&
    state.fator &&
    state.etes &&
    state.hier &&
    state.ctss &&
    state.pares
  )
}

/** Totais/contadores/completude derivados do estado (recalculam a cada edicao). */
export function derive(state: State): Derivado {
  const vazio = {
    cidades: 0,
    sistemas: 0,
    subBacias: 0,
    obras: 0,
    metas: 0,
    etes: 0,
    cts: 0,
    ctsObras: 0,
  }
  if (!seeded(state))
    return { g2: 0, g3: 0, g4: 0, g5: 0, pendTotal: 0, completude: 0, counts: vazio }
  const subsList = Object.values(state.subs!)
  const ctsList = Object.values(state.ctss!)
  const g2 = g2Pend({ cidades: state.cidades!, metas: state.metas!, fator: state.fator! })
  // A regua da cidade decide se a ficha tem tambem os 2 campos de populacao —
  // no numerador e no denominador. Trocar a cobertura de uma cidade para
  // populacao acrescenta pendencias as sub-bacias dela na hora, que e o efeito
  // desejado: a simulacao nao pode rodar com o denominador da meta em branco.
  const porPop = (regua: Regua | null) => regua === 'populacao'
  const g3 = subsList.reduce((a, s) => a + subPend(s, porPop(reguaDaSub(state, s.id))), 0)
  const g4 = state.etes!.reduce((a, e) => a + etePend(e), 0)
  const g5 = ctsList.reduce((a, c) => a + ctsPend(c, porPop(reguaDaCts(state, c.id))), 0)
  const pendTotal = g2 + g3 + g4 + g5
  const g2Total = state.cidades!.length * 2 + state.metas!.length * 3 + state.fator!.length * 3
  const g3Total = subsList.reduce((a, s) => a + camposDaSub(porPop(reguaDaSub(state, s.id))), 0)
  const g4Total = state.etes!.reduce((a, e) => a + 7 + (isNova(e) ? 2 : 0), 0)
  // CTS e esparsa: entra no denominador so quando existe (adicionar uma CTS
  // acrescenta 25 campos ao cadastro e derruba a completude — e o esperado).
  const g5Total = ctsList.reduce((a, c) => a + camposDaCts(porPop(reguaDaCts(state, c.id))), 0)
  // Unidade semeada mas sem nenhum campo a preencher (base vazia): sem o guarda,
  // 0/0 virava NaN e o header mostrava "NaN%". Zero campos pendentes = 100%, o
  // mesmo criterio que o hub usa para liberar a simulacao (pendTotal === 0).
  const totalCampos = g2Total + g3Total + g4Total + g5Total
  const completude = totalCampos === 0 ? 100 : Math.round((1 - pendTotal / totalCampos) * 100)
  return {
    g2,
    g3,
    g4,
    g5,
    pendTotal,
    completude,
    counts: {
      cidades: state.cidades!.length,
      sistemas: state.hier!.sistemas.length,
      subBacias: subsList.length,
      obras: subsList.length * OBRAS_POR_SUBBACIA,
      metas: state.metas!.length,
      etes: state.etes!.length,
      cts: ctsList.length,
      ctsObras: ctsList.length * OBRAS_POR_CTS,
    },
  }
}
