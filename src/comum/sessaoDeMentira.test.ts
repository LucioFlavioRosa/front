// @vitest-environment jsdom
/**
 * O que este teste protege: a sessão de desenvolvimento não pode vazar para
 * produção, nem servir uma credencial morta.
 *
 * O caso que mais importa é `temSsoDeMentira` com os dois configurados: um
 * ambiente que caísse para o provedor falso porque uma variável do SSO real
 * ficou para trás seria exatamente o modo de falha que a autenticação existe
 * para evitar — e falharia em silêncio, com tudo funcionando.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function comConfig(runtime: Record<string, unknown>) {
  vi.resetModules()
  window.__CADASTRO_CONFIG__ = runtime as never
  return {
    config: await import('@/comum/config'),
    sessao: await import('@/comum/auth/sessao'),
    mentira: await import('@/comum/auth/sessaoDeMentira'),
  }
}

const IDP = 'http://idp.local/token'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  delete window.__CADASTRO_CONFIG__
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('quando o SSO de mentira vale', () => {
  it('não vale sem tokenUrl', async () => {
    const { config } = await comConfig({ apiUrl: '' })
    expect(config.temSsoDeMentira()).toBe(false)
  })

  it('vale com tokenUrl e sem SSO real', async () => {
    const { config } = await comConfig({ ssoDeMentira: { tokenUrl: IDP } })
    expect(config.temSsoDeMentira()).toBe(true)
  })

  it('NÃO vale quando há SSO real configurado junto', async () => {
    const { config } = await comConfig({
      sso: { authority: 'https://login.microsoftonline.com/t/v2.0', clientId: 'abc' },
      ssoDeMentira: { tokenUrl: IDP },
    })
    expect(config.temSso()).toBe(true)
    expect(config.temSsoDeMentira()).toBe(false)
  })
})

describe('o provedor de token', () => {
  it('pede o token com o usuário escolhido e o entrega ao client', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-ana', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchFalso)

    const { sessao, mentira } = await comConfig({
      ssoDeMentira: { tokenUrl: IDP, usuarios: ['dev', 'ana'] },
    })
    sessionStorage.setItem('cadastro:usuario-de-mentira', 'ana')
    mentira.iniciarSessaoDeMentira()

    expect(await sessao.tokenAtual()).toBe('tok-ana')

    const corpo = fetchFalso.mock.calls[0][1].body as URLSearchParams
    expect(corpo.get('client_id')).toBe('ana')
    expect(corpo.get('grant_type')).toBe('client_credentials')
  })

  it('reaproveita o token em vez de pedir um por chamada', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchFalso)

    const { sessao, mentira } = await comConfig({ ssoDeMentira: { tokenUrl: IDP } })
    mentira.iniciarSessaoDeMentira()

    await sessao.tokenAtual()
    await sessao.tokenAtual()
    await sessao.tokenAtual()

    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('descarta o token guardado quando o servidor devolve 401', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchFalso)

    const { sessao, mentira } = await comConfig({ ssoDeMentira: { tokenUrl: IDP } })
    mentira.iniciarSessaoDeMentira()

    await sessao.tokenAtual()
    expect(fetchFalso).toHaveBeenCalledTimes(1)

    // O IdP reiniciou e trocou de chave: o token guardado morreu, e insistir
    // nele faria TODA chamada seguinte falhar até alguém recarregar a aba.
    sessao.notificarNaoAutorizado(401)
    await sessao.tokenAtual()

    expect(fetchFalso).toHaveBeenCalledTimes(2)
  })

  it('devolve null quando o IdP recusa, em vez de mandar lixo no header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sessao, mentira } = await comConfig({ ssoDeMentira: { tokenUrl: IDP } })
    mentira.iniciarSessaoDeMentira()

    expect(await sessao.tokenAtual()).toBeNull()
  })
})

describe('o usuário escolhido', () => {
  it('cai no primeiro da lista quando o guardado não é conhecido', async () => {
    const { mentira } = await comConfig({
      ssoDeMentira: { tokenUrl: IDP, usuarios: ['dev', 'ana'] },
    })
    sessionStorage.setItem('cadastro:usuario-de-mentira', 'quem-saiu-da-lista')
    expect(mentira.usuarioAtual()).toBe('dev')
  })
})
