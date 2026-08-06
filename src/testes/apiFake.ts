/**
 * Canal HTTP de mentira para os testes de tela.
 *
 * Os testes de app mockam `api/client` e exercitam o resto de verdade (router,
 * providers, store, telas). Esse bloco de mock era copiado em cada arquivo —
 * seis cópias de ~40 linhas que ninguém comparava. Aqui ele vive uma vez só:
 * cada teste declara o ESTADO que quer observar (chamadas registradas, erro a
 * devolver, resposta a segurar) e monta a api a partir dele.
 *
 * O estado é um singleton DESTE módulo, não uma variável do arquivo de teste:
 * o `vi.mock` é içado para o topo do arquivo, então um `const` declarado lá
 * ainda está em TDZ quando o factory roda. Como o Vitest isola o registry de
 * módulos por arquivo de teste, o singleton é de um arquivo só — e tanto o
 * teste quanto o factory enxergam o mesmo objeto.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- corpo de request é JSON livre */

export interface EstadoApi {
  /** Registro das chamadas: `vi.fn` com promise rejeitada vira unhandled rejection. */
  puts: Array<[string, any]>
  posts: Array<[string, any]>
  dels: string[]
  /** Respostas que sobrescrevem as fixtures — simula dado que mudou no servidor. */
  respostas: Record<string, unknown>
  /** Falha em toda LEITURA — a tela de erro com "Tentar de novo". */
  erroGet: Error | null
  erroPut: Error | null
  erroPost: Error | null
  /** Segura a resposta para o teste observar a tela COM a gravação em voo. */
  segurarPut: boolean
  segurarPost: boolean
  liberarPut: (() => void) | null
  liberarPost: ((erro?: Error) => void) | null
}

/** Estado do arquivo de teste em execução (o Vitest isola módulos por arquivo). */
export const api: EstadoApi = estadoApi()

export function estadoApi(): EstadoApi {
  return {
    puts: [],
    posts: [],
    dels: [],
    respostas: {},
    erroGet: null,
    erroPut: null,
    erroPost: null,
    segurarPut: false,
    segurarPost: false,
    liberarPut: null,
    liberarPost: null,
  }
}

/** Zera o estado entre casos (chame no `beforeEach`). */
export function limparApi(e: EstadoApi): void {
  Object.assign(e, estadoApi())
}

export interface OpcoesDados {
  /** Id da unidade nas rotas (default: u-jacarei). */
  id?: string
  nome?: string
  /** Payloads sem nenhum registro — unidade recém-criada. */
  vazio?: boolean
  /** Troca a árvore de sub-bacias (ex.: esconder as pareadas com CTS). */
  arvore?: unknown
}

/**
 * Respostas de leitura a partir das fixtures — o mesmo dado que o MSW serve em
 * desenvolvimento, para o teste não inventar um formato próprio.
 */
export async function dadosDaUnidade(opcoes: OpcoesDados = {}): Promise<Record<string, unknown>> {
  const { id = 'u-jacarei', nome = 'Águas de Jacareí', vazio = false, arvore } = opcoes
  const subbacias = (await import('@/mocks/fixtures/subbacias.json')).default
  const contrato = (await import('@/mocks/fixtures/contrato.json')).default
  const etes = (await import('@/mocks/fixtures/etes.json')).default
  const estrutura = (await import('@/mocks/fixtures/estrutura.json')).default
  const cts = (await import('@/mocks/fixtures/cts.json')).default

  const unidade = {
    id,
    regionalId: 'r-sudeste',
    nome,
    resumo: { cidades: 8, sistemas: 8, subBacias: 8, obras: 40 },
    // Irrelevante nos testes de tela: o header usa a completude derivada do store.
    completude: 0,
    databricksConectado: true,
  }

  const hierarquia = {
    ...estrutura,
    ...(vazio ? { superintendencias: [], cidades: [], sistemas: [], topo: [] } : {}),
    unidReg: { ...estrutura.unidReg, uid: id, unome: nome },
  }

  return {
    '/regionais': [{ id: 'r-sudeste', nome: 'Sudeste' }],
    '/regionais/r-sudeste/unidades': [unidade],
    [`/unidades/${id}`]: unidade,
    [`/unidades/${id}/sub-bacias`]: vazio
      ? { arvore: [], subs: {} }
      : { ...subbacias, ...(arvore ? { arvore } : {}) },
    [`/unidades/${id}/contrato`]: vazio ? { cidades: [], metas: [], fator: [] } : contrato,
    [`/unidades/${id}/etes`]: vazio ? { etes: [] } : etes,
    [`/unidades/${id}/cts`]: vazio ? { pares: [], ctss: {} } : cts,
    [`/unidades/${id}/hierarquia`]: hierarquia,
  }
}

/** A api de mentira: leitura pelas fixtures, escrita registrada no estado. */
export function apiFake(estado: EstadoApi, dados: Record<string, unknown>) {
  return {
    get: async (path: string) => {
      if (estado.erroGet) throw estado.erroGet
      if (path in estado.respostas) return estado.respostas[path]
      if (path in dados) return dados[path]
      throw new Error(`sem mock para ${path}`)
    },
    put: async (path: string, body?: unknown) => {
      estado.puts.push([path, body])
      if (estado.segurarPut) await new Promise<void>((ok) => (estado.liberarPut = ok))
      if (estado.erroPut) throw estado.erroPut
      return {}
    },
    post: async (path: string, body?: unknown) => {
      estado.posts.push([path, body])
      if (estado.segurarPost)
        await new Promise<void>((ok, falha) => {
          estado.liberarPost = (erro?: Error) => (erro ? falha(erro) : ok())
        })
      if (estado.erroPost) throw estado.erroPost
      // Resposta declarada pelo teste ganha de tudo — é assim que o POST de
      // `/runs` devolve o `run_id` que a tela de simulação precisa.
      if (path in estado.respostas) return estado.respostas[path]
      // O POST de CTS devolve a ficha criada (contrato de api/escrita.ts) — e é
      // essa versão, a do servidor, que entra no cadastro.
      return (body as { cts?: unknown })?.cts ?? {}
    },
    del: async (path: string) => {
      estado.dels.push(path)
      return undefined
    },
  }
}
