/**
 * Client HTTP unico. Toda chamada de rede passa por aqui — assim, quando o
 * backend real de dados existir, basta apontar VITE_API_URL e remover o MSW.
 *
 * Responsabilidades: base URL, Authorization vindo do SSO (ver auth/sessao.ts),
 * e traduzir falha HTTP em `ApiError` (com status, para a UI distinguir sessao
 * expirada de erro de validacao de erro de servidor).
 */
import { notificarNaoAutorizado, tokenAtual } from '@/comum/auth/sessao'
import { config } from '@/comum/config'

const BASE_URL = config.apiUrl

export class ApiError extends Error {
  readonly status: number
  /** Corpo da resposta, quando o servidor mandou detalhe do erro. */
  readonly corpo: string

  constructor(status: number, statusText: string, path: string, corpo: string) {
    super(`${status} ${statusText} — ${path}${corpo ? `\n${corpo}` : ''}`)
    this.name = 'ApiError'
    this.status = status
    this.corpo = corpo
  }

  /** Sessao invalida/expirada — quem chama deve mandar o usuario ao SSO. */
  get naoAutorizado(): boolean {
    return this.status === 401 || this.status === 403
  }

  /** O servidor recusou o conteudo enviado (validacao). */
  get invalido(): boolean {
    return this.status === 400 || this.status === 422
  }

  /** Outra pessoa alterou a mesma ficha antes (ver DEPLOY.md). */
  get conflito(): boolean {
    return this.status === 409
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await tokenAtual()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    const corpo = await res.text().catch(() => '')
    const erro = new ApiError(res.status, res.statusText, path, corpo)
    if (erro.naoAutorizado) notificarNaoAutorizado(res.status)
    throw erro
  }
  if (res.status === 204) return undefined as T

  // 2xx nao garante corpo JSON: 200 sem corpo, HTML de proxy e text/plain
  // acontecem em producao. Sem esta checagem o `as T` passava lixo adiante e o
  // estouro vinha depois, dentro do reducer ou do render — longe da causa.
  const texto = await res.text()
  if (texto.trim() === '') return undefined as T
  const tipo = res.headers.get('content-type') ?? ''
  if (tipo && !tipo.includes('json'))
    throw new ApiError(res.status, 'Resposta não-JSON', path, texto.slice(0, 200))
  try {
    return JSON.parse(texto) as T
  } catch {
    throw new ApiError(res.status, 'JSON inválido', path, texto.slice(0, 200))
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
