import { describe, expect, it } from 'vitest'
import regionais from '@/mocks/fixtures/regionais.json'
import unidades from '@/mocks/fixtures/unidades.json'
import subbacias from '@/mocks/fixtures/subbacias.json'
import contrato from '@/mocks/fixtures/contrato.json'
import etes from '@/mocks/fixtures/etes.json'
import estrutura from '@/mocks/fixtures/estrutura.json'
import cts from '@/mocks/fixtures/cts.json'
import { CHAVES_DB } from '@/cadastro/domain/baseComercial'
import { CHAVES_PARAMS } from '@/cadastro/domain/subbacia'

/**
 * Contrato de dados da API: valida o SHAPE dos payloads que o backend real terá
 * de devolver em cada endpoint (as fixtures espelham esse contrato). Se o formato
 * mudar sem querer, estes testes acusam antes de quebrar as telas.
 */
describe('contrato de dados (shape que o backend deve honrar)', () => {
  it('/regionais → [{ id, nome }]', () => {
    expect(regionais.length).toBeGreaterThan(0)
    for (const r of regionais) {
      expect(r).toMatchObject({ id: expect.any(String), nome: expect.any(String) })
    }
  })

  it('/regionais/:id/unidades → unidades com id/regionalId/nome', () => {
    expect(unidades.length).toBeGreaterThan(0)
    for (const u of unidades) {
      expect(u).toMatchObject({
        id: expect.any(String),
        regionalId: expect.any(String),
        nome: expect.any(String),
        databricksConectado: expect.any(Boolean),
      })
    }
  })

  it('/unidades/:id/sub-bacias → { arvore[], subs{db,params,obrasOverride} }', () => {
    expect(Array.isArray(subbacias.arvore)).toBe(true)
    const subs = subbacias.subs as Record<string, unknown>
    expect(Object.keys(subs)).toContain('b2_1_4')
    for (const s of Object.values(subs)) {
      expect(s).toMatchObject({
        id: expect.any(String),
        sisId: expect.any(String),
        db: expect.any(Object),
        params: expect.any(Object),
        obrasOverride: expect.any(Object),
      })
    }
    // cada nó da árvore tem cidades → sistemas → subIds
    const sup = subbacias.arvore[0]
    expect(sup).toMatchObject({ id: expect.any(String), cidades: expect.any(Array) })
    expect(sup.cidades[0].sistemas[0]).toMatchObject({ subIds: expect.any(Array) })
  })

  it('/unidades/:id/contrato → { cidades, metas, fator } com chaves esperadas', () => {
    expect(contrato).toMatchObject({
      cidades: expect.any(Array),
      metas: expect.any(Array),
      fator: expect.any(Array),
    })
    expect(contrato.cidades[0]).toMatchObject({
      id: expect.any(String),
      fim: expect.any(String),
      cob: expect.any(String),
    })
    expect(contrato.metas[0]).toMatchObject({
      cid: expect.any(String),
      ano: expect.any(String),
      pct: expect.any(String),
    })
    expect(contrato.fator[0]).toMatchObject({
      cid: expect.any(String),
      cob: expect.any(String),
      par: expect.any(String),
    })
  })

  it('/unidades/:id/etes → 5 ETEs com o flag "nova"', () => {
    expect(etes.etes).toHaveLength(5)
    for (const e of etes.etes) {
      expect(e).toMatchObject({
        id: expect.any(String),
        cidId: expect.any(String),
        nova: expect.stringMatching(/^(Sim|Nao)$/),
      })
    }
  })

  it('/unidades/:id/cts → { pares[], ctss{} } pareados 1:1 com sub-bacias', () => {
    expect(Array.isArray(cts.pares)).toBe(true)
    const ctss = cts.ctss as Record<string, { id: string; subId: string }>
    // De-para 1:1: cada sub-bacia aparece uma vez, cada CTS aparece uma vez.
    expect(new Set(cts.pares.map((p) => p.sub)).size).toBe(cts.pares.length)
    expect(new Set(cts.pares.map((p) => p.cts)).size).toBe(cts.pares.length)
    // Todo par aponta para uma CTS existente, e ela concorda com o par.
    for (const par of cts.pares) {
      expect(ctss[par.cts]).toBeDefined()
      expect(ctss[par.cts].subId).toBe(par.sub)
      expect(Object.keys(subbacias.subs)).toContain(par.sub)
    }
    for (const c of Object.values(ctss)) {
      expect(c).toMatchObject({
        id: expect.any(String),
        subId: expect.any(String),
        db: expect.any(Object),
        params: expect.any(Object),
        obrasOverride: expect.any(Object),
      })
    }
  })

  it('/unidades/:id/hierarquia → unidReg + estrutura (4 superintendências, topo)', () => {
    expect(estrutura.unidReg).toMatchObject({
      rid: expect.any(String),
      waccMedio: expect.any(String),
    })
    expect(estrutura.superintendencias).toHaveLength(4)
    expect(estrutura.cidades[0]).toMatchObject({
      id: expect.any(String),
      supId: expect.any(String),
    })
    expect(estrutura.sistemas[0]).toMatchObject({
      id: expect.any(String),
      cidId: expect.any(String),
    })
    expect(estrutura.topo[0]).toMatchObject({
      sis: expect.any(String),
      id: expect.any(String),
      jus: expect.any(String),
    })
  })
})

describe('fixtures × domínio (o mock faz o papel do backend)', () => {
  // Sem isto, acrescentar um campo no domínio e esquecer a fixture passa
  // despercebido: a tela mostra vazio e ninguém acusa.
  const fichas = [
    ...Object.values(subbacias.subs as Record<string, { db: object; params: object }>),
    ...Object.values(cts.ctss as unknown as Record<string, { db: object; params: object }>),
  ]

  it('toda ficha traz as chaves de `db` que a tela lê — inclusive o recorte industrial', () => {
    for (const f of fichas) {
      for (const chave of CHAVES_DB) expect(Object.keys(f.db)).toContain(chave)
    }
  })

  it('toda ficha traz as chaves de `params`, com a vazão industrial junto', () => {
    for (const f of fichas) {
      for (const chave of CHAVES_PARAMS) expect(Object.keys(f.params)).toContain(chave)
    }
  })
})
