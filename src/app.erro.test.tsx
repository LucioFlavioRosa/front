// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * Falha de rede na carga de uma unidade. Antes das telas terem estado de erro,
 * isto deixava a pagina em branco para sempre; o teste fixa o contrato novo:
 * mensagem + "Tentar de novo" que realmente recarrega.
 */
vi.mock('./api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('./testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { api, limparApi } from './testes/apiFake'
import { renderApp } from './testes/renderApp'

// A rede começa fora do ar em todo caso deste arquivo; quem quiser sucesso
// zera `api.erroGet` no meio do teste (é o que o "Tentar de novo" exercita).
beforeEach(() => {
  limparApi(api)
  api.erroGet = new Error('Falha de rede simulada')
})
afterEach(cleanup)

describe('falha de carga', () => {
  it('mostra o erro com saída e recarrega no "Tentar de novo"', async () => {
    renderApp('/unidade/u-jacarei/contrato-metas')

    // Erro visível — e o cabeçalho do grupo continua ali (caminho de volta).
    expect(await screen.findByText(/Não foi possível carregar/)).toBeTruthy()
    expect(screen.getByText('Contrato & Metas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Voltar para o hub da unidade' })).toBeTruthy()

    // Rede volta: o retry carrega a tela de verdade.
    api.erroGet = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('4 pendências')).toBeTruthy()
  })

  it('a tela de seleção avisa quando não consegue listar as regionais', async () => {
    renderApp('/cadastro')

    expect(await screen.findByText(/Não foi possível carregar a lista de regionais/)).toBeTruthy()
    // O select fica desabilitado com o motivo no lugar do "Selecione…".
    const sel = screen.getByLabelText('Regional') as HTMLSelectElement
    expect(sel.disabled).toBe(true)
    expect(screen.getByText('Não foi possível carregar')).toBeTruthy()
  })
})
