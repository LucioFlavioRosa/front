/**
 * O CONTRATO.md nao pode divergir do codigo.
 *
 * Um contrato de API desatualizado e pior que contrato nenhum: o backend e
 * escrito contra ele, e a divergencia so aparece na integracao, quando corrigir
 * custa dez vezes mais. Estes testes fazem a conferencia que antes era manual —
 * agora o portao (`npm run verificar`) quebra quando os dois se separam.
 *
 * Duas direcoes, e as duas importam:
 *   - endpoint que o app CHAMA e o documento nao descreve: o backend nao vai
 *     implementar, e a tela quebra em producao;
 *   - endpoint que o documento DESCREVE e o app nao chama: o backend implementa
 *     algo que ninguem usa, e ninguem descobre.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(`${raiz}/${p}`, 'utf-8')

const doc = ler('CONTRATO.md')
const QUERIES = ler('src/api/queriesResultado.ts')
const FONTES_API = ['src/api/resultados.ts', 'src/api/simulacao.ts']
const FONTES_TIPOS = ['src/domain/resultado.ts', 'src/domain/simulacao.ts', 'src/api/simulacao.ts']

/**
 * O texto de uma seção, do titulo ate o proximo titulo de nivel IGUAL OU SUPERIOR.
 *
 * O nivel sai do proprio titulo procurado: `### 2.1` para numa `###`, `##` ou `#`,
 * mas nao numa `####` dentro dela. Cortar num nivel fixo truncava a secao no
 * primeiro subtitulo, e o teste passava a medir um pedaco do texto sem avisar.
 */
function secao(titulo: string): string {
  const nivel = /^#+/.exec(titulo)?.[0].length
  if (!nivel) throw new Error(`secao() espera um titulo com #: ${titulo}`)
  // `\n` antes: evita casar com uma citacao do titulo no meio de um paragrafo.
  const i = doc.indexOf(`\n${titulo}`)
  if (i < 0) throw new Error(`seção ausente no CONTRATO.md: ${titulo}`)
  const resto = doc.slice(i + titulo.length + 1)
  const fim = resto.search(new RegExp(`\\n#{1,${nivel}} `))
  return fim < 0 ? resto : resto.slice(0, fim)
}

/** Cada `export function useX(...)` de `queriesResultado.ts`, com o corpo. */
function hooksDeResultado(): { nome: string; corpo: string }[] {
  return QUERIES.split('export function ')
    .slice(1)
    .map((p) => ({ nome: p.slice(0, p.indexOf('(')), corpo: p }))
}

/**
 * Os hooks que leem dados de UMA rodada — os que a garantia da §2.1 cobre.
 * Fora: `useRuns` (a lista muda com exclusao) e a mutation de excluir.
 */
function hooksDeUmaRodada(): { nome: string; corpo: string }[] {
  return hooksDeResultado()
    .filter((h) => h.nome.startsWith('use'))
    .filter((h) => /runId/.test(h.corpo))
    .filter((h) => !/useMutation/.test(h.corpo))
}

/**
 * Reduz um caminho a sua FORMA: `/runs/{}/meta`. Assim `{run_id}` do documento e
 * `${runId}` do codigo comparam iguais, que e o que interessa — o nome do
 * parametro e escolha de quem escreve, a forma e o contrato.
 */
function forma(caminho: string): string {
  let s = caminho
    .replace(/\$\{BASE\}/g, '/runs')
    // interpolacao simples: ${runId} -> {}
    .replace(/\$\{\s*[A-Za-z_$][\w$]*\s*\}/g, '{}')
    // placeholder do documento: {run_id} -> {}
    .replace(/\{[^}]*\}/g, '{}')
  // corta interpolacao complexa (query condicional) e query string
  s = s.split('${')[0].split('?')[0]
  return s.replace(/\/+$/, '')
}

/** `GET /runs/{}/meta` — o que o app realmente chama. */
function chamadasDoCodigo(): Set<string> {
  const VERBO: Record<string, string> = { get: 'GET', post: 'POST', put: 'PUT', del: 'DELETE' }
  const achadas = new Set<string>()
  for (const arq of FONTES_API) {
    const src = ler(arq)
    // api.get<T>(`...`) ou api.post<T>('...')
    const re = /api\.(get|post|put|del)\s*<[^>]*>\s*\(\s*([`'"])([\s\S]*?)\2/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      achadas.add(`${VERBO[m[1]]} ${forma(m[3])}`)
    }
  }
  return achadas
}

/**
 * Marca de secao cujo endpoint o front NAO chama — ele existe porque uma garantia
 * exige que o backend o tenha (hoje: o retry da §2.1). Sem a marca, o teste "todo
 * endpoint documentado e chamado" reprovaria; sem o teste, alguem documentaria
 * qualquer coisa e o backend implementaria a toa. A marca torna a excecao explicita
 * e contavel, em vez de virar um `if` escondido.
 */
const MARCA_SO_BACKEND = '<!-- somente-backend -->'

/** Divide o documento em blocos por heading, para saber onde cada endpoint mora. */
function blocos(): string[] {
  return doc.split(/\n(?=#{1,4} )/)
}

/** `GET /runs/{}/meta` — o que o documento promete, separado por quem chama. */
function endpointsDoDocumento(): { todos: Set<string>; doFront: Set<string> } {
  const todos = new Set<string>()
  const doFront = new Set<string>()
  for (const bloco of blocos()) {
    const soBackend = bloco.includes(MARCA_SO_BACKEND)
    for (const m of bloco.matchAll(/`(GET|POST|PUT|DELETE) ([^`]+)`/g)) {
      const e = `${m[1]} ${forma(m[2])}`
      todos.add(e)
      if (!soBackend) doFront.add(e)
    }
  }
  return { todos, doFront }
}

describe('CONTRATO.md × código', () => {
  it('todo endpoint que o app chama está documentado', () => {
    const { todos } = endpointsDoDocumento()
    const semDoc = [...chamadasDoCodigo()].filter((e) => !todos.has(e)).sort()
    expect(semDoc).toEqual([])
  })

  it('todo endpoint documentado é chamado pelo app, salvo os marcados', () => {
    // Pega o outro sentido da deriva: o documento descrevendo algo que foi
    // removido do codigo, e que o backend implementaria a toa.
    const chamados = chamadasDoCodigo()
    const { doFront } = endpointsDoDocumento()
    const orfaos = [...doFront].filter((e) => !chamados.has(e)).sort()
    expect(orfaos).toEqual([])
  })

  it('o que está marcado como só-backend realmente não é chamado', () => {
    // A marca e uma dispensa; se o app passar a chamar o endpoint, ela vira
    // mentira e some a cobertura dele. Este teste faz a marca se auto-expirar.
    const chamados = chamadasDoCodigo()
    const { todos, doFront } = endpointsDoDocumento()
    const soBackend = [...todos].filter((e) => !doFront.has(e))
    expect(soBackend.length).toBeGreaterThan(0) // a marca existe e foi lida
    expect(soBackend.filter((e) => chamados.has(e))).toEqual([])
  })

  it('nenhum campo citado no documento foi inventado', () => {
    const tipos = FONTES_TIPOS.map(ler).join('\n')
    // Chaves dos exemplos JSON do documento, fora as numericas (anos de orçamento).
    const citados = new Set([...doc.matchAll(/^\s*"([A-Za-z_]\w*)":/gm)].map((m) => m[1]))
    const inventados = [...citados].filter((c) => !new RegExp(`\\b${c}\\b`).test(tipos)).sort()
    expect(inventados).toEqual([])
  })

  it('o documento cobre as duas áreas novas, e diz onde está a do cadastro', () => {
    // Guarda contra alguem "limpar" o documento e remover a referencia cruzada:
    // sem ela, quem for escrever o backend do cadastro nao encontra o contrato.
    expect(doc).toContain('DEPLOY.md')
    expect(doc).toMatch(/## 3\. Resultados/)
    expect(doc).toMatch(/## 4\. Nova simulação/)
  })

  it('as três garantias continuam escritas — são o motivo do documento existir', () => {
    // Se alguem remover uma delas, o backend perde a unica descricao de uma
    // regra que, quebrada, faz a tela mentir sem sinal de erro.
    expect(doc).toMatch(/IMUTÁVEL/)
    expect(doc).toMatch(/reconciliad/i)
    expect(doc).toMatch(/nunca 0/i)
  })
})

/**
 * A §2.1 e a unica garantia que o front COBRA do backend em vez de so consumir:
 * ela existe porque o cache aqui e eterno. Entao ela tem duas pontas para vigiar —
 * o documento continuar afirmando a regra, e o codigo continuar dependendo dela.
 * Se alguem afrouxar o cache, a garantia vira exigencia gratuita sobre o backend;
 * se alguem reabrir a decisao no documento, o backend fica sem o que implementar
 * enquanto o front segue cacheando para sempre.
 */
describe('§2.1 — imutabilidade do run_id', () => {
  it('o filtro de hooks não está medindo o vazio', () => {
    // Sem isto, o teste seguinte passa por nao encontrar hook nenhum — que e
    // exatamente o que acontece se alguem trocar `export function useX()` por
    // `export const useX = () =>`, ou mover os hooks de arquivo. Falsa seguranca
    // e pior que teste ausente, porque ninguem volta a olhar.
    const nomes = hooksDeUmaRodada().map((h) => h.nome)
    expect(nomes).toEqual([
      'useRunMeta',
      'usePainel',
      'useEbitda',
      'useCidades',
      'useCidade',
      'useTopologia',
      'useSubBacia',
      'useObra',
    ])
  })

  it('todo hook que lê dados de uma rodada cacheia para sempre', () => {
    const semCache = hooksDeUmaRodada()
      .filter((h) => !h.corpo.includes('...IMUTAVEL'))
      .map((h) => h.nome)
    expect(semCache).toEqual([])
  })

  it('"para sempre" é literalmente Infinity', () => {
    // Trocar por um numero grande seria pior que trocar por um pequeno: a tela
    // continuaria parecendo correta e so divergiria depois do prazo.
    expect(QUERIES).toMatch(/const IMUTAVEL = \{\s*staleTime: Infinity/)
  })

  it('a decisão está fechada, e o documento diz qual é a condição', () => {
    const s = secao('### 2.1')
    // `SUCESSO` e a condicao consultavel; `409` e o que o backend faz quando
    // alguem tenta executar sobre rodada publicada. Sem os dois, o texto vira
    // intencao e nao regra.
    expect(s).toMatch(/SUCESSO/)
    expect(s).toMatch(/409/)
    expect(s).toMatch(/reprocessa_de/)
  })

  it('não voltou para a lista de decisões em aberto', () => {
    // Nao basta procurar a palavra "imutabilidade": a decisao pode ser reaberta
    // com outro nome ("versionamento da rodada publicada"). Procura pelos TERMOS
    // da decisao, e so nos itens da lista — mencionar a §2.1 de passagem, como o
    // item da paginacao faz, nao conta.
    const itens = secao('## 6. Decisões em aberto')
      .split('\n')
      .filter((l) => /^\d+\. /.test(l))
    const reabertos = itens.filter((l) => /imutabilidade|versionar|versionamento/i.test(l))
    expect(reabertos).toEqual([])
    expect(itens.length).toBeGreaterThan(0) // a lista existe e foi encontrada
  })

  it('o endpoint de reexecução está especificado, e marcado como não chamado', () => {
    // Foi a lacuna que a revisao pegou: a §2.1 mandava recusar com 409 "um pedido
    // de execucao", sem dizer que pedido era esse. Sem isto, quem escreve o backend
    // inventa o endpoint — e inventa diferente do que a tela vai chamar um dia.
    const s = secao('### 4.5 `POST /runs/{run_id}/reexecutar` — retry')
    expect(s).toContain(MARCA_SO_BACKEND)
    for (const st of ['PENDENTE', 'RODANDO', 'ERRO', 'FALHOU_QUALIDADE', 'CANCELADA', 'SUCESSO'])
      expect(s).toContain(st)
    expect(s).toMatch(/409/)
  })
})
