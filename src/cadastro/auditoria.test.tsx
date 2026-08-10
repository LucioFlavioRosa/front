// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * "última alteração: ana@aegea, 10/08 14:32" nas QUATRO fichas.
 *
 * Este arquivo existe porque a linha não é enfeite: ela é o que substituiu o 409
 * de ficha (R6). O servidor não recusa mais a gravação de quem leu a ficha antes
 * de um colega salvar, então esta linha passou a ser o único lugar em que uma
 * pessoa descobre que outra mexeu. Sumir de uma das quatro telas devolveria
 * aquela tela ao estado anterior à mudança — sem proteção E sem aviso.
 *
 * As quatro estão aqui de propósito, e não só uma "representativa": duas usam o
 * `RecordSheet` (sub-bacia e CTS) e duas montam o cabeçalho por conta própria
 * (ETE e cidade). São dois caminhos de renderização, e um pode quebrar sozinho.
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { api, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'

beforeEach(() => limparApi(api))
afterEach(cleanup)

/** `dd/mm hh:mm` — a hora sai no fuso de quem lê, então não se fixa o valor. */
const QUANDO = /\d{2}\/\d{2} \d{2}:\d{2}/

describe('a ficha diz quem mexeu nela por último', () => {
  it.each([
    ['sub-bacia', '/unidade/u-jacarei/sub-bacias', 'Salvar sub-bacia'],
    ['CTS', '/unidade/u-jacarei/cts', 'Salvar CTS'],
    ['ETE', '/unidade/u-jacarei/etes', 'Salvar ETE'],
    ['cidade', '/unidade/u-jacarei/contrato-metas', 'Salvar cidade'],
  ])('%s', async (_nome, rota, botao) => {
    renderApp(rota)
    await screen.findByRole('button', { name: botao })

    const linha = await screen.findByText(/última alteração:/)
    expect(linha.textContent).toMatch(/@aegea/)
    expect(linha.textContent).toMatch(QUANDO)
  })
})

describe('ficha que nunca foi gravada pela tela não inventa histórico', () => {
  it('não mostra a linha, e não diz "nunca alterada"', async () => {
    // `b2_1_2` é a única ficha sem auditoria na fixture — o caso das 4.850
    // sub-bacias que vieram da planilha e nunca passaram pela tela. A coluna só
    // existe desde a migração, então "nunca alterada" seria dizer o que o dado
    // não sustenta.
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // A ficha aberta por padrão (`b2_1_4`) tem auditoria — a linha está na tela
    // antes do clique, e é o sumiço dela que este caso observa.
    expect(await screen.findByText(/última alteração:/)).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: /b2_1_2/ }))
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    expect(screen.queryByText(/última alteração:/)).toBeNull()
    expect(screen.queryByText(/nunca alterada/i)).toBeNull()
  })
})
