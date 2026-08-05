// @vitest-environment jsdom
/**
 * Casca das telas de resultado (fatia 1): rotas, header, breadcrumb e a camada
 * de dados com mocks.
 *
 * O que estes testes protegem e o encanamento, nao o conteudo — as telas dos
 * niveis 1 a 5 ainda sao marcadores. Especificamente: que a cascata inteira e
 * navegavel, que o breadcrumb monta a partir do payload (e nao da URL, que e
 * plana de proposito) e que os chips de parametro aparecem em TODOS os niveis.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api as estado, apiFake, limparApi } from './testes/apiFake'
import { renderApp } from './testes/renderApp'
import fixture from './mocks/fixtures/runs.json'

const RUN = 'run_2026_0814'

const dados: Record<string, unknown> = {
  '/runs': fixture.runs,
  ...Object.fromEntries(Object.entries(fixture.meta).map(([id, m]) => [`/runs/${id}/meta`, m])),
}

vi.mock('./api/client', () => ({
  get api() {
    return apiFake(estado, dados)
  },
  ApiError: class extends Error {},
}))

beforeEach(() => limparApi(estado))
// Sem isto, a arvore do caso anterior fica no document e as buscas por role
// encontram dois headers — o `screen` consulta o body inteiro, nao o render.
afterEach(cleanup)

describe('histórico de simulações', () => {
  it('lista as rodadas e abre a que tem resultado', async () => {
    renderApp('/resultados')

    expect(await screen.findByRole('heading', { name: 'Histórico de simulações' })).toBeTruthy()
    expect(await screen.findByText('Litoral 1 — janela 8a, foco cobertura')).toBeTruthy()

    const ver = await screen.findAllByRole('link', { name: /Ver detalhes/ })
    // 4 rodadas na fixture, mas a INFEASIBLE nao tem para onde levar.
    expect(ver.length).toBe(3)
  })

  it('rodada INFEASIBLE avisa em vez de mostrar métricas zeradas', async () => {
    renderApp('/resultados')

    expect(await screen.findByText('solver INFEASIBLE')).toBeTruthy()
    expect(
      await screen.findByText(/O solver não encontrou um plano viável com estes parâmetros/),
    ).toBeTruthy()
  })
})

describe('casca dos níveis', () => {
  it('mostra os parâmetros da rodada no header — em qualquer nível', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)

    // Sem estes chips, dois resultados da mesma unidade sao indistinguiveis.
    expect(await screen.findByText('usar CTS')).toBeTruthy()
    expect(await screen.findByText('sim')).toBeTruthy()
    expect(await screen.findByText(/solver OTIMO \| OBRIG 3\/3/)).toBeTruthy()
    expect(await screen.findByText('R$ 410,0 Mi')).toBeTruthy()
  })

  it('breadcrumb monta a partir da página, não da URL', async () => {
    renderApp(`/resultados/${RUN}/cidades/c_rio`)

    // Espera o nome da rodada chegar: ele vem da query, o degrau da cidade vem
    // da pagina (sincrono). Ler antes disso testaria so o segundo.
    await screen.findByRole('link', { name: 'Litoral 1 — janela 8a, foco cobertura' })

    const trilha = screen.getByRole('navigation', { name: 'Onde você está' })
    // A rota e plana (/cidades/c_rio): quem declara o degrau e a pagina.
    expect(trilha.textContent).toContain('Histórico de simulações')
    expect(trilha.textContent).toContain('c_rio')
  })

  it('no nível global a rodada é o degrau atual, sem link para si mesma', async () => {
    renderApp(`/resultados/${RUN}`)

    await waitFor(() => {
      const trilha = screen.getByRole('navigation', { name: 'Onde você está' })
      expect(trilha.querySelector('[aria-current="page"]')?.textContent).toBe(
        'Litoral 1 — janela 8a, foco cobertura',
      )
    })
    // E, sendo o atual, nao e link para si mesma.
    expect(screen.queryByRole('link', { name: 'Litoral 1 — janela 8a, foco cobertura' })).toBeNull()
  })

  it('do último nível volta ao histórico pelo breadcrumb', async () => {
    renderApp(`/resultados/${RUN}/obras/lig_d1b38_2_1`)

    expect(await screen.findByRole('heading', { name: /Elemento lig_d1b38_2_1/ })).toBeTruthy()

    fireEvent.click(await screen.findByRole('link', { name: 'Histórico de simulações' }))
    expect(await screen.findByRole('heading', { name: 'Histórico de simulações' })).toBeTruthy()
  })

  it('trocar de rodada no seletor leva para o nível global da outra', async () => {
    renderApp(`/resultados/${RUN}/cidades/c_rio`)

    const seletor = (await screen.findByLabelText('rodada')) as HTMLSelectElement
    // A INFEASIBLE nao entra: escolher levaria a uma tela sem o que mostrar.
    await waitFor(() => expect(seletor.querySelectorAll('option').length).toBe(3))

    fireEvent.change(seletor, { target: { value: 'run_2026_0811' } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Painel geral da rodada' })).toBeTruthy(),
    )
  })
})

describe('estados de carga', () => {
  it('falha de rede no histórico oferece tentar de novo', async () => {
    estado.erroGet = new Error('rede caiu')
    renderApp('/resultados')

    expect(await screen.findByText(/Não foi possível carregar o histórico/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})
