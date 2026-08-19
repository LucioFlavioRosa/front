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
import { camposDaCts, ctsPend, OBRAS_POR_CTS, type Cts } from '@/cadastro/domain/cts'
import type {
  CidadeH,
  SistemaH,
  Superintendencia,
  TopoRow,
  UnidReg,
} from '@/cadastro/domain/hierarquia'
import {
  assinatura,
  assinaturasDaHierarquia,
  chaveCidade,
  chaveCts,
  chaveEte,
  chaveSub,
  fichaDe,
  type ChaveFicha,
} from '@/cadastro/state/fichas'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export interface Hier {
  unidReg: UnidReg
  superintendencias: Superintendencia[]
  cidades: CidadeH[]
  sistemas: SistemaH[]
  /** Componentes da unidade E os que estao fora de sistema — o `SEED_HIER` funde
   *  as duas listas do servidor aqui, e `sis` vazio marca os de fora. */
  topo: TopoRow[]
  /** So existe no payload que CHEGA do servidor; depois do seed, vive em `topo`. */
  semSistema?: TopoRow[]
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
  /**
   * De-para sub-bacia → cidade, tirado da arvore no seed. E por ele que a ficha
   * sabe a regua da meta (a cobertura e atributo da CIDADE, grupo 02) — e a
   * regua decide se os campos de populacao existem e contam pendencia.
   */
  cidadeDaSub: Record<string, string> | null
  /** Snapshots imutaveis do servidor — a referencia de "o que veio" para
   *  comparar contra o que esta em edicao. */
  originalSubs: Record<string, SubBacia> | null
  originalCtss: Record<string, Cts> | null
  originalHier: Hier | null
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
  cidadeDaSub: null,
  originalSubs: null,
  originalCtss: null,
  originalHier: null,
  salvas: {},
  impressoes: {},
}

export type Action =
  // seeding (uma vez, quando cada query resolve)
  | { type: 'SEED_SUBS'; subs: Record<string, SubBacia>; arvore: SupNode[] }
  | { type: 'SEED_CONTRATO'; cidades: Cidade[]; metas: Meta[]; fator: Fator[] }
  | { type: 'SEED_ETES'; etes: Ete[] }
  | { type: 'SEED_HIER'; hier: Hier }
  | { type: 'SEED_CTS'; ctss: Record<string, Cts> }
  // grupo 03 · sub-bacias
  | { type: 'SET_SUB_PARAM'; subId: string; key: keyof SubBaciaParams; value: string }
  | { type: 'SET_OBRA_FIELD'; subId: string; index: number; key: keyof Obra; value: string }
  | { type: 'EDIT_DB_FIELD'; subId: string; key: keyof SubBaciaDb; value: string }
  // grupo 04 · ETEs
  | { type: 'SET_ETE_FIELD'; eteId: string; key: keyof Ete; value: string }
  // grupo 05 · CTS (irma da sub-bacia: mesmas acoes + criar/remover, por ser esparsa)
  | { type: 'SET_CTS_PARAM'; ctsId: string; key: keyof SubBaciaParams; value: string }
  | { type: 'SET_CTS_OBRA_FIELD'; ctsId: string; index: number; key: keyof Obra; value: string }
  | { type: 'EDIT_CTS_DB_FIELD'; ctsId: string; key: keyof SubBaciaDb; value: string }
  // grupo 02 · contrato & metas
  | { type: 'SET_CIDADE_FIELD'; cidId: string; key: keyof Cidade; value: string }
  | { type: 'ADD_META'; cid: string }
  | { type: 'SET_META'; index: number; key: keyof Meta; value: string }
  | { type: 'REMOVE_META'; index: number }
  | { type: 'ADD_FATOR'; cid: string }
  | { type: 'SET_FATOR'; index: number; key: keyof Fator; value: string }
  | { type: 'REMOVE_FATOR'; index: number }
  // grupo 01 · hierarquia (Databricks — todos gravam override)
  | { type: 'SET_HIER_UNIDREG'; key: keyof UnidReg; value: string }
  | { type: 'SET_HIER_SUP_NOME'; supId: string; value: string }
  | { type: 'SET_HIER_CID_NOME'; cidId: string; value: string }
  | { type: 'SET_HIER_SIS_NOME'; sisId: string; value: string }
  // A topologia e por ID, e nao por indice como os nomes acima: colocar um
  // componente num sistema muda a lista que a tela mostra, e um indice guardado
  // de um render anterior passaria a apontar para outra linha.
  | { type: 'SET_HIER_TOPO_JUSANTE'; compId: string; value: string }
  | { type: 'SET_HIER_TOPO_SISTEMA'; compId: string; sisId: string }
  | { type: 'SET_HIER_SISTEMA_USA_CTS'; sisId: string; value: boolean }
  // o servidor aceitou uma ficha: ela passa a ser o novo "sem mudancas"
  | { type: 'FICHA_SALVA'; chave: ChaveFicha; assinatura: string; auditoria?: Partial<Auditoria> }

/**
 * A trilha de auditoria e do SERVIDOR: ele compara o que esta gravado com o que
 * chega no `PUT` (`cadastro_escrita.diferencas`). Este reducer cuida so do estado
 * da tela, e o corpo da requisicao nao carrega registro de mudanca nenhum.
 */

/**
 * Grava o campo digitado na obra daquele indice.
 *
 * O mapa carrega a obra INTEIRA, como o servidor a mandou — nenhum campo e
 * apagado dele. Apagar criaria buraco: o campo voltaria vazio na tela, contaria
 * pendencia, e o `PUT` gravaria NULL numa coluna que tinha valor.
 *
 * "Digitou de volta o valor original" nao precisa de tratamento: valor igual
 * deixa o objeto identico ao que veio, e a comparacao de conteudo (`assinatura`
 * em `state/fichas.ts`) e quem responde se a ficha esta suja.
 *
 * Indice que nao existe no mapa nao e criado. A tela so renderiza as obras que
 * vieram do servidor, e criar uma aqui seria inventar linha de cadastro.
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
    case 'SEED_HIER': {
      // Os componentes FORA de sistema entram na mesma lista dos que estao
      // dentro, com `sis` vazio. Sao a mesma coisa — uma linha de
      // `sistema_topologia` — e a diferenca e so ter ou nao sistema; duas listas
      // separadas obrigariam cada consumidor a lembrar de olhar as duas, e o que
      // esquecesse trataria "fora de sistema" como "nao existe".
      const hier: Hier = {
        ...action.hier,
        topo: [...action.hier.topo, ...(action.hier.semSistema ?? [])],
      }
      // A LINHA-BASE entrou junto com a topologia virar ficha: sem ela, TODO
      // componente nasceria sujo e a tela abriria com o Salvar aceso, oferecendo
      // gravar o que acabou de chegar do servidor.
      //
      // Calculada de uma vez (`assinaturasDaHierarquia`), e nao por
      // `semMudancas`: aquele monta a ficha a partir do ID, e para a topologia
      // isso custa um `find` por chave — com mais de mil componentes, quadratico,
      // no instante exato em que a tela esta abrindo.
      //
      // A impressao e do payload CRU, e nao do fundido: ela e comparada contra
      // `assinatura(hierQ.data)` para detectar "o servidor mudou desde este
      // rascunho" (CadastroContext). Guardar a versao fundida faria toda sessao
      // recuperada acusar mudanca que nao houve.
      const semeado = comImpressao(
        { ...state, hier: clone(hier), originalHier: clone(hier) },
        'hier',
        action.hier,
      )
      return {
        ...semeado,
        salvas: { ...semeado.salvas, ...assinaturasDaHierarquia(hier) },
      }
    }
    case 'SEED_CTS':
      return semMudancas(
        comImpressao(
          {
            ...state,
            ctss: clone(action.ctss),
            originalCtss: clone(action.ctss),
          },
          'cts',
          { ctss: action.ctss },
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
      return {
        ...state,
        subs: {
          ...state.subs,
          [action.subId]: { ...sub, db: { ...sub.db, [action.key]: action.value } },
        },
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
      return {
        ...state,
        ctss: {
          ...state.ctss,
          [action.ctsId]: { ...cts, db: { ...cts.db, [action.key]: action.value } },
        },
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
      }
    case 'SET_HIER_TOPO_JUSANTE':
      return {
        ...state,
        hier: {
          ...state.hier!,
          topo: state.hier!.topo.map((t) =>
            t.id === action.compId ? { ...t, jus: action.value } : t,
          ),
        },
      }
    case 'SET_HIER_SISTEMA_USA_CTS':
      return {
        ...state,
        hier: {
          ...state.hier!,
          sistemas: state.hier!.sistemas.map((s) =>
            s.id === action.sisId ? { ...s, usaCts: action.value ? 'true' : 'false' } : s,
          ),
        },
      }
    case 'SET_HIER_TOPO_SISTEMA':
      return {
        ...state,
        hier: {
          ...state.hier!,
          // TIRAR do sistema zera o jusante junto, e isso espelha o servidor: o
          // `DELETE` poe os dois como nulos. Guardar um jusante orfao aqui faria
          // a ficha parecer suja para sempre — a assinatura local nunca bateria
          // com a que voltou do servidor.
          topo: state.hier!.topo.map((t) =>
            t.id === action.compId
              ? { ...t, sis: action.sisId, jus: action.sisId ? t.jus : '' }
              : t,
          ),
        },
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

/**
 * A regua da CTS vem da cidade do SISTEMA em que ela foi colocada.
 *
 * Antes vinha da sub-bacia pareada, o que so funcionava enquanto a CTS
 * pertencesse a mesma cidade da irma — e dava `null` (nenhuma regua) para
 * qualquer CTS sem par. Hoje a CTS esta num sistema, o sistema esta numa cidade,
 * e a cidade e que decide se a cobertura se mede em ligacoes ou em populacao.
 */
export function reguaDaCts(state: State, ctsId: string): Regua | null {
  const sisId = state.ctss?.[ctsId]?.sisId
  if (!sisId) return null
  const cidId = state.hier?.sistemas.find((s) => s.id === sisId)?.cidId
  if (!cidId) return null
  return reguaDe(state.cidades?.find((c) => c.id === cidId)?.cob)
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
    state.ctss
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
