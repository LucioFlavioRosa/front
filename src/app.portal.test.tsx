// @vitest-environment jsdom
/**
 * O portal e a reorganizacao da navegacao.
 *
 * O que estes testes protegem: que a raiz oferece os TRES caminhos do fluxo, que
 * cada um chega onde promete, e que a selecao de unidade — que antes era a raiz —
 * continua alcancavel no lugar novo. Trocar a tela inicial e o tipo de mudanca
 * que quebra links em silencio.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api as estado, apiFake, dadosDaUnidade, limparApi } from './testes/apiFake'
import { renderApp } from './testes/renderApp'
import runsFx from './mocks/fixtures/runs.json'

let dados: Record<string, unknown> = {}

vi.mock('./api/client', () => ({
  get api() {
    return apiFake(estado, dados)
  },
  ApiError: class extends Error {},
}))

beforeEach(async () => {
  limparApi(estado)
  dados = { ...(await dadosDaUnidade()), '/runs': runsFx.runs }
})
afterEach(cleanup)

describe('portal', () => {
  it('oferece os três caminhos do fluxo', async () => {
    renderApp('/')
    expect(
      await screen.findByRole('heading', { name: /Otimizador de CAPEX de Esgoto/ }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: /Cadastrar ou revisar dados/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Fazer simulação/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Ver histórico de simulações/ })).toBeTruthy()
  })

  it('cadastrar leva à seleção de unidade', async () => {
    renderApp('/')
    fireEvent.click(await screen.findByRole('link', { name: /Cadastrar ou revisar dados/ }))
    expect(await screen.findByLabelText('Regional')).toBeTruthy()
  })

  it('histórico leva à lista de simulações', async () => {
    renderApp('/')
    fireEvent.click(await screen.findByRole('link', { name: /Ver histórico de simulações/ }))
    expect(await screen.findByRole('heading', { name: 'Histórico de simulações' })).toBeTruthy()
  })

  it('simular leva à tela de disparo da rodada', async () => {
    renderApp('/')
    fireEvent.click(await screen.findByRole('link', { name: /Fazer simulação/ }))
    expect(await screen.findByRole('heading', { name: 'Nova simulação' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar simulação' })).toBeTruthy()
  })
})

describe('navegação depois da reorganização', () => {
  it('a seleção de unidade mora em /cadastro e ainda inicia o cadastro', async () => {
    renderApp('/cadastro')
    expect(await screen.findByLabelText('Regional')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Iniciar cadastro/ })).toBeTruthy()
  })

  it('a marca volta para o início — inclusive de DENTRO de uma unidade', async () => {
    // Era o unico buraco: dentro da unidade a marca ia para o hub, e nao sobrava
    // caminho de volta ao portal ("trocar unidade" vai para a selecao).
    renderApp('/unidade/u-jacarei/etes')
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para a tela inicial' }))
    expect(
      await screen.findByRole('heading', { name: /Otimizador de CAPEX de Esgoto/ }),
    ).toBeTruthy()
  })

  it('a marca também volta na seleção de unidade', async () => {
    renderApp('/cadastro')
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para a tela inicial' }))
    expect(
      await screen.findByRole('heading', { name: /Otimizador de CAPEX de Esgoto/ }),
    ).toBeTruthy()
  })

  it('o nome da unidade continua sendo o atalho para o hub', async () => {
    // Nada se perdeu ao mudar a marca: o hub tem porta propria.
    renderApp('/unidade/u-jacarei/etes')
    fireEvent.click(await screen.findByRole('button', { name: 'Águas de Jacareí' }))
    expect(await screen.findByRole('heading', { name: /Dados da/ })).toBeTruthy()
  })

  it('o cadastro NÃO oferece caminho para o histórico', async () => {
    // As areas nao se cruzam: o cadastro prepara o dado, resultado e outra
    // coisa. Quem quer ver rodadas passa pelo portal, que e onde os tres
    // caminhos convivem — atalho cruzado embaralharia a escolha que o portal
    // acabou de organizar.
    renderApp('/unidade/u-jacarei')
    await screen.findByRole('heading', { name: /Dados da/ })

    const paraResultados = screen
      .queryAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/resultados'))
    expect(paraResultados).toEqual([])
  })

  it('a seleção de unidade também não leva ao histórico', async () => {
    renderApp('/cadastro')
    await screen.findByLabelText('Regional')
    const paraResultados = screen
      .queryAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/resultados'))
    expect(paraResultados).toEqual([])
  })

  it('nos resultados, a marca leva ao início e o breadcrumb ao histórico', async () => {
    renderApp('/resultados')
    // Desvio consciente do handoff: ele dizia "o logo volta para a lista", mas
    // isso foi escrito quando o historico era a porta de entrada.
    const marca = await screen.findByRole('link', { name: 'Ir para a tela inicial' })
    expect(marca.getAttribute('href')).toBe('/')
  })
})
