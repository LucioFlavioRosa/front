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
const FONTES_API = ['src/api/resultados.ts', 'src/api/simulacao.ts']
const FONTES_TIPOS = ['src/domain/resultado.ts', 'src/domain/simulacao.ts', 'src/api/simulacao.ts']

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
