import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useContrato, useCts, useEtes, useHierarquia, useSubBacias } from '@/cadastro/api/queries'
import {
  subPend,
  type Obra,
  type SubBacia,
  type SubBaciaDb,
  type SubBaciaParams,
} from '@/cadastro/domain/subbacia'
import { cidadePend, type Cidade, type Fator, type Meta } from '@/cadastro/domain/contrato'
import { etePend, type Ete } from '@/cadastro/domain/ete'
import type { UnidReg } from '@/cadastro/domain/hierarquia'
import { ctsPend, type Cts, type CtsInconsistente, type ParCts } from '@/cadastro/domain/cts'
import type { Regua } from '@/cadastro/domain/baseComercial'
import {
  derive,
  initialState,
  reducer,
  reguaDaCts,
  reguaDaSub,
  seeded as isSeeded,
  type Derivado,
  type Hier,
  type Override,
} from '@/cadastro/state/cadastroReducer'
import {
  assinatura,
  fichaCidade,
  fichaCts,
  fichaEte,
  fichaSub,
  hierAlterada,
  sujas as fichasSujas,
  type ChaveFicha,
} from '@/cadastro/state/fichas'
import type { FichaCidade, FichaCts, FichaEte, FichaSubBacia } from '@/cadastro/api/escrita'
import { gravarRascunho, lerRascunho, limparRascunho } from '@/cadastro/state/rascunho'
import { useApp } from '@/comum/state/AppContext'
import { useRecarregarDoServidor } from '@/cadastro/state/recarregar'

const now = () => new Date().toISOString()

/** Espera entre a ultima tecla e a gravacao do rascunho (evita gravar por letra). */
const ESPERA_RASCUNHO = 400

interface CadastroValue {
  seeded: boolean
  /** Alguma das 5 fatias ainda esta em voo (e nenhuma falhou). */
  carregando: boolean
  /** Mensagem tecnica da primeira fatia que falhou, ou null. */
  erro: string | null
  /** Ha requisicao em voo (inclui a nova tentativa depois de um erro). */
  recarregando: boolean
  /** Refetch das 5 fatias — usado pelo botao "Tentar de novo". */
  recarregar: () => void
  subs: Record<string, SubBacia>
  cidades: Cidade[]
  metas: Meta[]
  fator: Fator[]
  etes: Ete[]
  hier: Hier | null
  ctss: Record<string, Cts>
  pares: ParCts[]
  /** CTS incompletas denunciadas pelo servidor. Vem da query, nao do reducer. */
  ctsInconsistentes: CtsInconsistente[]
  overrides: Record<string, Override>
  derivado: Derivado
  /** Chaves das fichas com edicao que o servidor ainda nao recebeu. */
  sujas: ChaveFicha[]
  /** Atalho de `sujas.length > 0` — usado pela guarda de saida. */
  temSujas: boolean
  /** Qualquer edicao local ainda nao gravada, INCLUSIVE a hierarquia (que nao
   *  tem ficha). E o que o rascunho guarda e o aviso de fechar a aba observa. */
  temEdicaoLocal: boolean
  /** A hierarquia foi corrigida (nao tem ficha nem Salvar: so rascunho). */
  hierEditada: boolean
  estaSuja: (chave: ChaveFicha) => boolean
  /** Chamado quando o servidor aceita uma ficha, com o corpo que foi enviado. */
  marcarSalva: (chave: ChaveFicha, ficha: unknown, versao?: string) => void
  // Corpo do PUT de cada tela. Vem daqui (e nao montado na pagina) para o que
  // o botao envia ser exatamente o que o controle de "tem mudanca?" compara.
  fichaDaSub: (subId: string) => FichaSubBacia | null
  fichaDaCidade: (cidId: string) => FichaCidade | null
  fichaDaEte: (eteId: string) => FichaEte | null
  fichaDaCts: (ctsId: string) => FichaCts | null
  subPendOf: (id: string) => number
  etePendOf: (id: string) => number
  cidadePendOf: (id: string) => number
  ctsPendOf: (id: string) => number
  /** Id da CTS pareada com a sub-bacia, se houver (relacao 1:1). */
  ctsDaSub: (subId: string) => string | null
  // Regua da meta e cidade de cada ficha (a cobertura e atributo da cidade).
  reguaDaSub: (subId: string) => Regua | null
  reguaDaCts: (ctsId: string) => Regua | null
  cidadeDaSub: (subId: string) => Cidade | null
  cidadeDaCts: (ctsId: string) => Cidade | null
  // ── acoes de dominio (as unicas formas de mutar o estado) ──
  setSubParam: (subId: string, key: keyof SubBaciaParams, value: string) => void
  setObraField: (subId: string, index: number, key: keyof Obra, value: string) => void
  editDbField: (subId: string, key: keyof SubBaciaDb, value: string) => void
  setEteField: (eteId: string, key: keyof Ete, value: string) => void
  setCidadeField: (cidId: string, key: keyof Cidade, value: string) => void
  addMeta: (cid: string) => void
  setMeta: (index: number, key: keyof Meta, value: string) => void
  removeMeta: (index: number) => void
  addFator: (cid: string) => void
  setFator: (index: number, key: keyof Fator, value: string) => void
  removeFator: (index: number) => void
  setHierUnidReg: (key: keyof UnidReg, value: string) => void
  setHierSupNome: (supId: string, value: string) => void
  setHierCidNome: (cidId: string, value: string) => void
  setHierSisNome: (sisId: string, value: string) => void
  setHierTopoJusante: (index: number, value: string) => void
  // grupo 05 · CTS
  setCtsParam: (ctsId: string, key: keyof SubBaciaParams, value: string) => void
  setCtsObraField: (ctsId: string, index: number, key: keyof Obra, value: string) => void
  editCtsDbField: (ctsId: string, key: keyof SubBaciaDb, value: string) => void
}

const Ctx = createContext<CadastroValue | null>(null)

export function CadastroProvider({
  unidadeId,
  children,
}: {
  unidadeId: string
  children: ReactNode
}) {
  const subQ = useSubBacias(unidadeId)
  const contQ = useContrato(unidadeId)
  const eteQ = useEtes(unidadeId)
  const hierQ = useHierarquia(unidadeId)
  const ctsQ = useCts(unidadeId)
  const { toast, askConfirm } = useApp()
  const recarregarDoServidor = useRecarregarDoServidor()

  // Rascunho da sessao: se existe um para esta unidade, ele ENTRA no lugar do
  // estado vazio. Como as fatias ja chegam preenchidas, os efeitos de seed
  // abaixo nao disparam e o que veio da rede nao sobrescreve a edicao.
  const [state, dispatch] = useReducer(
    reducer,
    unidadeId,
    (uid) => lerRascunho(uid) ?? initialState,
  )
  // Se o estado JA NASCEU semeado, ele veio do rascunho: o seed da rede só
  // acontece depois, num efeito. Guardar o fato como estado (e não como ref
  // lida no render) mantém o render puro.
  const [veioDeRascunho] = useState(() => isSeeded(state))

  // Seed de cada fatia quando o mock chega (uma vez).
  useEffect(() => {
    if (subQ.data && !state.subs)
      dispatch({ type: 'SEED_SUBS', subs: subQ.data.subs, arvore: subQ.data.arvore })
  }, [subQ.data, state.subs])
  useEffect(() => {
    if (contQ.data && !state.cidades)
      dispatch({
        type: 'SEED_CONTRATO',
        cidades: contQ.data.cidades,
        metas: contQ.data.metas,
        fator: contQ.data.fator,
      })
  }, [contQ.data, state.cidades])
  useEffect(() => {
    if (eteQ.data && !state.etes) dispatch({ type: 'SEED_ETES', etes: eteQ.data.etes })
  }, [eteQ.data, state.etes])
  useEffect(() => {
    if (hierQ.data && !state.hier) dispatch({ type: 'SEED_HIER', hier: hierQ.data })
  }, [hierQ.data, state.hier])
  useEffect(() => {
    if (ctsQ.data && !state.ctss)
      dispatch({ type: 'SEED_CTS', ctss: ctsQ.data.ctss, pares: ctsQ.data.pares })
  }, [ctsQ.data, state.ctss])

  const seeded = isSeeded(state)
  const derivado = useMemo(() => derive(state), [state])
  const sujas = useMemo(() => fichasSujas(state), [state])
  const temSujas = sujas.length > 0
  // A hierarquia nao e ficha (nao ha para onde enviar), mas e edicao local: se
  // ficasse de fora, uma correcao so nela nao entraria no rascunho e a tela
  // estaria mentindo ao dizer que ela sobrevive a um F5.
  const hierEditada = useMemo(() => hierAlterada(state), [state])
  const temEdicaoLocal = temSujas || hierEditada

  // Espelha o estado no rascunho enquanto houver edicao local; quando tudo foi
  // para o servidor o rascunho e apagado (nao ha o que recuperar).
  // Espelho do último render, para o flush de saída gravar o estado mais novo.
  // Atualizado em efeito (nunca durante o render) — sem deps, roda a cada render.
  const ultimo = useRef({ state, temEdicaoLocal })
  useEffect(() => {
    ultimo.current = { state, temEdicaoLocal }
  })
  const persistir = useCallback(() => {
    const { state: atual, temEdicaoLocal: pendente } = ultimo.current
    if (!isSeeded(atual)) return
    if (pendente) gravarRascunho(unidadeId, atual)
    else limparRascunho(unidadeId)
  }, [unidadeId])

  useEffect(() => {
    if (!seeded) return
    const t = setTimeout(persistir, ESPERA_RASCUNHO)
    return () => clearTimeout(t)
  }, [state, seeded, persistir])

  // Sair da unidade desmonta o provider e o debounce pendente morre com ele:
  // grava uma ultima vez para as teclas dos ultimos milissegundos nao sumirem.
  useEffect(() => persistir, [persistir])

  // Fechar/esconder a aba nem sempre roda o cleanup do effect acima (mobile
  // mata a aba em background). `pagehide` e `visibilitychange` sao os eventos
  // que ainda dao tempo de gravar de forma sincrona.
  useEffect(() => {
    const aoSumir = () => persistir()
    window.addEventListener('pagehide', aoSumir)
    document.addEventListener('visibilitychange', aoSumir)
    return () => {
      window.removeEventListener('pagehide', aoSumir)
      document.removeEventListener('visibilitychange', aoSumir)
    }
  }, [persistir])

  // Avisa uma vez que a tela voltou com edicao nao salva — sem isso o usuario
  // pode achar que esta vendo o dado do servidor.
  const avisou = useRef(false)
  useEffect(() => {
    if (avisou.current || !veioDeRascunho) return
    avisou.current = true
    const n = sujas.length
    if (n > 0)
      toast(
        `Rascunho desta sessão recuperado — ${n} ficha${n === 1 ? '' : 's'} com edições ainda não salvas.`,
      )
    else if (hierEditada) toast('Rascunho desta sessão recuperado — correções na hierarquia.')
  }, [veioDeRascunho, sujas.length, hierEditada, toast])

  // Rascunho recuperado sobre dado que mudou no servidor: sem versao por ficha,
  // o que da para conferir e a impressao do payload de cada fatia. Se mudou,
  // avisa e oferece a saida — continuar editando por cima e escolha do usuario.
  const conferiu = useRef(false)
  const impressoes = state.impressoes
  useEffect(() => {
    if (conferiu.current || !veioDeRascunho) return
    if (!subQ.data || !contQ.data || !eteQ.data || !hierQ.data || !ctsQ.data) return
    conferiu.current = true
    const agora: Record<string, string> = {
      subs: assinatura(subQ.data.subs),
      contrato: assinatura({
        cidades: contQ.data.cidades,
        metas: contQ.data.metas,
        fator: contQ.data.fator,
      }),
      etes: assinatura(eteQ.data.etes),
      hier: assinatura(hierQ.data),
      cts: assinatura({ ctss: ctsQ.data.ctss, pares: ctsQ.data.pares }),
    }
    const mudou = Object.entries(agora).some(
      ([fatia, imp]) => impressoes[fatia as keyof typeof impressoes] !== imp,
    )
    if (!mudou) return
    askConfirm({
      titulo: 'O cadastro mudou no servidor desde este rascunho',
      texto:
        'Você está vendo edições guardadas nesta sessão, feitas sobre uma versão anterior dos ' +
        'dados. Recarregar traz a versão atual do servidor e descarta o rascunho. Cancelar ' +
        'mantém o rascunho — mas salvar por cima pode desfazer o que a outra pessoa gravou.',
      confirmarLabel: 'Recarregar do servidor',
      onConfirm: () => void recarregarDoServidor(unidadeId),
    })
  }, [
    subQ.data,
    contQ.data,
    eteQ.data,
    hierQ.data,
    ctsQ.data,
    impressoes,
    veioDeRascunho,
    askConfirm,
    recarregarDoServidor,
    unidadeId,
  ])

  // Estado de rede agregado das 5 fatias. `erro` ganha da carga: se uma falhou,
  // a pagina mostra o erro em vez de um skeleton que nunca resolve.
  const queries = [subQ, contQ, eteQ, hierQ, ctsQ]
  const erro = queries.find((q) => q.isError)?.error
  const erroMsg = erro instanceof Error ? erro.message : erro ? String(erro) : null
  const carregando = !erroMsg && queries.some((q) => q.isPending)
  const recarregando = queries.some((q) => q.isFetching)

  const recarregar = useCallback(() => {
    void subQ.refetch()
    void contQ.refetch()
    void eteQ.refetch()
    void hierQ.refetch()
    void ctsQ.refetch()
    // Depender dos objetos de query (e não dos `refetch`) recriaria este
    // callback a cada render — e ele vai para dentro do value do contexto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subQ.refetch, contQ.refetch, eteQ.refetch, hierQ.refetch, ctsQ.refetch])

  // A regua da meta e da cidade da ficha: decide se ela tem tambem os campos de
  // populacao (e, por isso, entra na conta de pendencia).
  const reguaSub = useCallback((subId: string) => reguaDaSub(state, subId), [state])
  const reguaCts = useCallback((ctsId: string) => reguaDaCts(state, ctsId), [state])
  const cidadeSub = useCallback(
    (subId: string) => state.cidades?.find((c) => c.id === state.cidadeDaSub?.[subId]) ?? null,
    [state.cidades, state.cidadeDaSub],
  )
  const cidadeCts = useCallback(
    (ctsId: string) => {
      const subId = state.pares?.find((p) => p.cts === ctsId)?.sub
      return subId ? cidadeSub(subId) : null
    },
    [state.pares, cidadeSub],
  )

  const subPendOf = useCallback(
    (id: string) =>
      state.subs?.[id] ? subPend(state.subs[id], reguaDaSub(state, id) === 'populacao') : 0,
    [state],
  )
  const etePendOf = useCallback(
    (id: string) => {
      const e = state.etes?.find((x) => x.id === id)
      return e ? etePend(e) : 0
    },
    [state.etes],
  )
  const ctsPendOf = useCallback(
    (id: string) =>
      state.ctss?.[id] ? ctsPend(state.ctss[id], reguaDaCts(state, id) === 'populacao') : 0,
    [state],
  )
  const ctsDaSub = useCallback(
    (subId: string) => state.pares?.find((p) => p.sub === subId)?.cts ?? null,
    [state.pares],
  )
  const cidadePendOf = useCallback(
    (id: string) => {
      const c = state.cidades?.find((x) => x.id === id)
      return c && state.metas && state.fator ? cidadePend(c, state.metas, state.fator) : 0
    },
    [state.cidades, state.metas, state.fator],
  )

  // Action creators (dispatch memoizado). Valores impuros (timestamp) sao
  // carimbados aqui, no handler — o reducer permanece puro/testavel.
  const actions = useMemo(
    () => ({
      setSubParam: (subId: string, key: keyof SubBaciaParams, value: string) =>
        dispatch({ type: 'SET_SUB_PARAM', subId, key, value }),
      setObraField: (subId: string, index: number, key: keyof Obra, value: string) =>
        dispatch({ type: 'SET_OBRA_FIELD', subId, index, key, value }),
      editDbField: (subId: string, key: keyof SubBaciaDb, value: string) =>
        dispatch({ type: 'EDIT_DB_FIELD', subId, key, value, at: now() }),
      setEteField: (eteId: string, key: keyof Ete, value: string) =>
        dispatch({ type: 'SET_ETE_FIELD', eteId, key, value }),
      setCidadeField: (cidId: string, key: keyof Cidade, value: string) =>
        dispatch({ type: 'SET_CIDADE_FIELD', cidId, key, value }),
      addMeta: (cid: string) => dispatch({ type: 'ADD_META', cid }),
      setMeta: (index: number, key: keyof Meta, value: string) =>
        dispatch({ type: 'SET_META', index, key, value }),
      removeMeta: (index: number) => dispatch({ type: 'REMOVE_META', index }),
      addFator: (cid: string) => dispatch({ type: 'ADD_FATOR', cid }),
      setFator: (index: number, key: keyof Fator, value: string) =>
        dispatch({ type: 'SET_FATOR', index, key, value }),
      removeFator: (index: number) => dispatch({ type: 'REMOVE_FATOR', index }),
      setHierUnidReg: (key: keyof UnidReg, value: string) =>
        dispatch({ type: 'SET_HIER_UNIDREG', key, value, at: now() }),
      setHierSupNome: (supId: string, value: string) =>
        dispatch({ type: 'SET_HIER_SUP_NOME', supId, value, at: now() }),
      setHierCidNome: (cidId: string, value: string) =>
        dispatch({ type: 'SET_HIER_CID_NOME', cidId, value, at: now() }),
      setHierSisNome: (sisId: string, value: string) =>
        dispatch({ type: 'SET_HIER_SIS_NOME', sisId, value, at: now() }),
      setHierTopoJusante: (index: number, value: string) =>
        dispatch({ type: 'SET_HIER_TOPO_JUSANTE', index, value, at: now() }),
      setCtsParam: (ctsId: string, key: keyof SubBaciaParams, value: string) =>
        dispatch({ type: 'SET_CTS_PARAM', ctsId, key, value }),
      setCtsObraField: (ctsId: string, index: number, key: keyof Obra, value: string) =>
        dispatch({ type: 'SET_CTS_OBRA_FIELD', ctsId, index, key, value }),
      editCtsDbField: (ctsId: string, key: keyof SubBaciaDb, value: string) =>
        dispatch({ type: 'EDIT_CTS_DB_FIELD', ctsId, key, value, at: now() }),
      // A assinatura vem do corpo QUE FOI ENVIADO, nao do estado atual: se o
      // usuario continuou digitando enquanto o PUT voava, essas teclas seguem
      // como nao salvas — que e a verdade.
      marcarSalva: (chave: ChaveFicha, ficha: unknown, versao?: string) =>
        dispatch({ type: 'FICHA_SALVA', chave, assinatura: assinatura(ficha), versao }),
    }),
    [],
  )

  const value = useMemo<CadastroValue>(
    () => ({
      seeded,
      carregando,
      erro: erroMsg,
      recarregando,
      recarregar,
      subs: state.subs ?? {},
      cidades: state.cidades ?? [],
      metas: state.metas ?? [],
      fator: state.fator ?? [],
      etes: state.etes ?? [],
      hier: state.hier,
      ctss: state.ctss ?? {},
      pares: state.pares ?? [],
      ctsInconsistentes: ctsQ.data?.inconsistencias ?? [],
      overrides: state.overrides,
      derivado,
      sujas,
      temSujas,
      temEdicaoLocal,
      hierEditada,
      estaSuja: (chave: ChaveFicha) => sujas.includes(chave),
      fichaDaSub: (subId: string) => fichaSub(state, subId),
      fichaDaCidade: (cidId: string) => fichaCidade(state, cidId),
      fichaDaEte: (eteId: string) => fichaEte(state, eteId),
      fichaDaCts: (ctsId: string) => fichaCts(state, ctsId),
      subPendOf,
      etePendOf,
      cidadePendOf,
      ctsPendOf,
      ctsDaSub,
      reguaDaSub: reguaSub,
      reguaDaCts: reguaCts,
      cidadeDaSub: cidadeSub,
      cidadeDaCts: cidadeCts,
      ...actions,
    }),
    [
      seeded,
      carregando,
      erroMsg,
      recarregando,
      recarregar,
      state,
      ctsQ.data,
      derivado,
      sujas,
      temSujas,
      temEdicaoLocal,
      hierEditada,
      subPendOf,
      etePendOf,
      cidadePendOf,
      ctsPendOf,
      ctsDaSub,
      reguaSub,
      reguaCts,
      cidadeSub,
      cidadeCts,
      actions,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCadastro(): CadastroValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCadastro deve ser usado dentro de <CadastroProvider>')
  return v
}

// Variante que nao lanca fora do provider (ex.: header na tela de selecao).
// eslint-disable-next-line react-refresh/only-export-components
export function useCadastroOptional(): CadastroValue | null {
  return useContext(Ctx)
}
