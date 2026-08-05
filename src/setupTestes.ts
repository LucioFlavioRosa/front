import { beforeEach } from 'vitest'

/**
 * Toda navegacao de um data router do React Router monta um `Request` com o
 * AbortSignal do jsdom, e o `Request` do Node recusa signal de outro realm
 * ("Expected signal to be an instance of AbortSignal") — a navegacao morre numa
 * rejeicao nao tratada. E atrito de jsdom + undici, nao do app: no navegador os
 * dois sao nativos e do mesmo realm.
 *
 * Um Request de mentira, que so guarda url e signal, tira o atrito do caminho.
 * So no ambiente jsdom, e sem risco para o app: nada em `src/` usa `Request`
 * (o client chama `fetch(url, init)`).
 */
if (typeof window !== 'undefined') {
  class RequestFalso {
    url: string
    signal: unknown
    constructor(url: string, init?: { signal?: unknown }) {
      this.url = String(url)
      this.signal = init?.signal
    }
  }
  globalThis.Request = RequestFalso as unknown as typeof Request
}

/**
 * Cada teste comeca sem rascunho.
 *
 * O rascunho vive no sessionStorage (state/rascunho.ts) e, no jsdom, o storage
 * e um so para o arquivo inteiro: sem isto, um teste que edita e desmonta deixa
 * o proximo recuperando a edicao do anterior — que e exatamente o que o recurso
 * faz de proposito no navegador, e ruido puro entre casos de teste.
 */
beforeEach(() => {
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
})
