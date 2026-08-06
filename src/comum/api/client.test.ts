import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/comum/api/client'
import { configurarSessao, limparSessao } from '@/comum/auth/sessao'

/** Resposta fake de fetch (só o subconjunto que o client usa). */
const ok = (data: unknown, status = 200, tipo = 'application/json') => ({
  ok: true,
  status,
  statusText: 'OK',
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? tipo : null) },
  json: async () => data,
  text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
})
const fail = (status = 500) => ({
  ok: false,
  status,
  statusText: 'Server Error',
  json: async () => ({}),
  text: async () => 'boom',
})

function mockFetch(res: unknown) {
  const fn = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  limparSessao()
})

describe('api client (canal com o backend)', () => {
  it('GET monta a URL com o BASE e devolve o JSON', async () => {
    const f = mockFetch(ok({ hello: 'world' }))
    const r = await api.get<{ hello: string }>('/regionais')
    expect(f).toHaveBeenCalledWith(
      '/api/regionais',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
    expect(r).toEqual({ hello: 'world' })
  })

  it('POST envia método e corpo JSON', async () => {
    const f = mockFetch(ok({ ok: true }))
    await api.post('/overrides', { campo: 'fat', valorNovo: 'X' })
    const init = f.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ campo: 'fat', valorNovo: 'X' }))
  })

  it('PUT e DELETE usam os métodos corretos', async () => {
    const f = mockFetch(ok({}))
    await api.put('/sub-bacias/b1/parametros', { preco: '10' })
    await api.del('/cidades/c1/metas')
    expect(f.mock.calls[0][1].method).toBe('PUT')
    expect(f.mock.calls[1][1].method).toBe('DELETE')
  })

  it('lança erro em resposta não-ok (falha do backend não passa silenciosa)', async () => {
    mockFetch(fail(500))
    await expect(api.get('/x')).rejects.toThrow(/500/)
  })

  it('204 (sem conteúdo) devolve undefined sem tentar parsear', async () => {
    mockFetch({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => {
        throw new Error('não deveria parsear 204')
      },
      text: async () => '',
    })
    await expect(api.get('/x')).resolves.toBeUndefined()
  })

  // 2xx não garante corpo JSON. Sem estas três guardas o `as T` passava lixo
  // adiante e o estouro aparecia depois, no reducer ou no render.
  it('200 com corpo vazio devolve undefined em vez de estourar no parse', async () => {
    mockFetch(ok('', 200))
    await expect(api.put('/unidades/u1/etes/e1', {})).resolves.toBeUndefined()
  })

  it('200 que não é JSON (proxy devolvendo HTML) vira ApiError', async () => {
    mockFetch(ok('<html>login</html>', 200, 'text/html'))
    const erro = await api.get('/regionais').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toMatch(/não-JSON/)
  })

  it('JSON malformado vira ApiError com o começo do corpo', async () => {
    mockFetch(ok('{"cidades": [', 200))
    const erro = await api.get('/unidades/u1/contrato').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).corpo).toBe('{"cidades": [')
  })
})

describe('sessão (SSO)', () => {
  it('sem provedor de token registrado, não manda Authorization', async () => {
    const f = mockFetch(ok({}))
    await api.get('/regionais')
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('com provedor registrado, manda Bearer em toda chamada', async () => {
    configurarSessao({ token: () => 'tok-123' })
    const f = mockFetch(ok({}))
    await api.get('/regionais')
    await api.put('/unidades/u1/etes/e1', {})
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123')
    expect(f.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-123')
  })

  it('aceita provedor assíncrono (renovação de token do SSO)', async () => {
    configurarSessao({ token: async () => 'tok-renovado' })
    const f = mockFetch(ok({}))
    await api.get('/regionais')
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-renovado')
  })

  it('401/403 avisa o app (relogar) e vem tipado como ApiError', async () => {
    const onNaoAutorizado = vi.fn()
    configurarSessao({ onNaoAutorizado })
    mockFetch(fail(401))

    const erro = await api.get('/regionais').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).naoAutorizado).toBe(true)
    expect(onNaoAutorizado).toHaveBeenCalledWith(401)
  })

  it('erro comum não dispara o fluxo de sessão', async () => {
    const onNaoAutorizado = vi.fn()
    configurarSessao({ onNaoAutorizado })
    mockFetch(fail(500))

    const erro = await api.get('/regionais').catch((e: unknown) => e)
    expect((erro as ApiError).naoAutorizado).toBe(false)
    expect((erro as ApiError).status).toBe(500)
    expect(onNaoAutorizado).not.toHaveBeenCalled()
  })

  it('422 é marcado como erro de validação (o servidor recusou o conteúdo)', async () => {
    mockFetch(fail(422))
    const erro = await api.put('/unidades/u1/etes/e1', {}).catch((e: unknown) => e)
    expect((erro as ApiError).invalido).toBe(true)
    expect((erro as ApiError).corpo).toBe('boom')
  })
})
