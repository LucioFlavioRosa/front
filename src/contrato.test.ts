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

/** O texto de uma seção, do título ate o proximo titulo de mesmo nivel ou acima. */
function secao(titulo: string): string {
  const i = doc.indexOf(titulo)
  if (i < 0) throw new Error(`seção ausente no CONTRATO.md: ${titulo}`)
  const resto = doc.slice(i + titulo.length)
  const fim = resto.search(/\n#{1,3} /)
  return fim < 0 ? resto : resto.slice(0, fim)
}

/** Cada `export function useX(...)` de `queriesResultado.ts`, com o corpo. */
function hooksDeResultado(): { nome: string; corpo: string }[] {
  return QUERIES.split('export function ')
    .slice(1)
    .map((p) => ({ nome: p.slice(0, p.indexOf('(')), corpo: p }))
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

/** `GET /runs/{}/meta` — o que o documento promete. */
function endpointsDoDocumento(): Set<string> {
  const achados = new Set<string>()
  for (const m of doc.matchAll(/`(GET|POST|PUT|DELETE) ([^`]+)`/g)) {
    achados.add(`${m[1]} ${forma(m[2])}`)
  }
  return achados
}

describe('CONTRATO.md × código', () => {
  it('todo endpoint que o app chama está documentado', () => {
    const documentados = endpointsDoDocumento()
    const semDoc = [...chamadasDoCodigo()].filter((e) => !documentados.has(e)).sort()
    expect(semDoc).toEqual([])
  })

  it('todo endpoint documentado é realmente chamado pelo app', () => {
    // Pega o outro sentido da deriva: o documento descrevendo algo que foi
    // removido do codigo, e que o backend implementaria a toa.
    const chamados = chamadasDoCodigo()
    const orfaos = [...endpointsDoDocumento()].filter((e) => !chamados.has(e)).sort()
    expect(orfaos).toEqual([])
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
  it('todo hook que lê dados de uma rodada cacheia para sempre', () => {
    const semCache = hooksDeResultado()
      .filter((h) => h.nome.startsWith('use'))
      .filter((h) => /runId/.test(h.corpo)) // e de UMA rodada (fora a lista)
      .filter((h) => !/useMutation/.test(h.corpo)) // a exclusao nao e leitura
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
    expect(secao('## 6. Decisões em aberto')).not.toMatch(/imutabilidade/i)
  })
})
