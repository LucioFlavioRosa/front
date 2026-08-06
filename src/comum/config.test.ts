// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConfigRuntime } from '@/comum/config'

/**
 * Precedência da config: /config.js (runtime) > VITE_* (build) > padrão.
 * É o que permite a MESMA imagem rodar em todos os ambientes — se isto quebrar,
 * volta a ser necessária uma imagem por ambiente.
 *
 * `config.ts` lê o window no momento em que o módulo carrega, então cada caso
 * reimporta o módulo depois de montar o cenário.
 */
async function carregar(runtime?: ConfigRuntime) {
  vi.resetModules()
  if (runtime) window.__CADASTRO_CONFIG__ = runtime
  else delete window.__CADASTRO_CONFIG__
  return await import('@/comum/config')
}

afterEach(() => {
  delete window.__CADASTRO_CONFIG__
})

describe('config de runtime', () => {
  it('sem /config.js e sem VITE_API_URL, cai em /api (mesma origem)', async () => {
    const { config } = await carregar()
    expect(config.apiUrl).toBe('/api')
  })

  it('o que vem do /config.js ganha do padrão', async () => {
    const { config } = await carregar({ apiUrl: 'https://api.exemplo/api' })
    expect(config.apiUrl).toBe('https://api.exemplo/api')
  })

  it('campo vazio no ConfigMap não vira apiUrl vazia', async () => {
    // ConfigMap costuma trazer '' para "não configurado"; sem o tratamento, o
    // fetch iria para a raiz do site em vez de /api.
    const { config } = await carregar({ apiUrl: '   ' })
    expect(config.apiUrl).toBe('/api')
  })

  it('config ausente ou parcial não quebra o app', async () => {
    const { config } = await carregar({})
    expect(config.apiUrl).toBe('/api')
    expect(config.sso.escopos).toEqual([])
    expect(config.sso.clientId).toBeUndefined()
  })
})

describe('temSso()', () => {
  it('é falso sem configuração — o app roda sem autenticação (modo mock)', async () => {
    const { temSso } = await carregar()
    expect(temSso()).toBe(false)
  })

  it('é falso com configuração pela metade', async () => {
    const { temSso } = await carregar({ sso: { authority: 'https://login/x', clientId: '' } })
    expect(temSso()).toBe(false)
  })

  it('é verdadeiro com authority e clientId', async () => {
    const { temSso, config } = await carregar({
      sso: {
        authority: 'https://login.microsoftonline.com/tenant/v2.0',
        clientId: 'abc-123',
        escopos: ['api://cadastro/.default'],
      },
    })
    expect(temSso()).toBe(true)
    expect(config.sso.escopos).toEqual(['api://cadastro/.default'])
  })
})
