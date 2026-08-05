// @vitest-environment jsdom
/**
 * Telas de resultado, das 6 fatias.
 *
 * O foco destes testes sao as REGRAS que o handoff impoe e que sao faceis de
 * quebrar sem ninguem notar: nulo virando "—" em vez de 0%, rodada sem solucao
 * nao inventando metricas, transporte nao agrupado, a CTS visualmente distinta,
 * o elo que trava sendo um link, e a causalidade da paridade escrita na tela.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api as estado, apiFake, limparApi } from './testes/apiFake'
import { renderApp } from './testes/renderApp'
import runsFx from './mocks/fixtures/runs.json'
import dadosFx from './mocks/fixtures/resultado.json'

const RUN = 'run_2026_0814'
const D = dadosFx as unknown as Record<string, Record<string, unknown>>

const dados: Record<string, unknown> = {
  '/runs': runsFx.runs,
  ...Object.fromEntries(Object.entries(runsFx.meta).map(([id, m]) => [`/runs/${id}/meta`, m])),
  // Painel/EBITDA/cidades de TODAS as rodadas com resultado: o seletor do header
  // navega entre elas, e sem isto a outra rodada cairia na tela de erro.
  ...Object.fromEntries(
    Object.keys(runsFx.meta).flatMap((id) => [
      [`/runs/${id}/painel`, dadosFx.painel],
      [`/runs/${id}/ebitda`, dadosFx.ebitdaUnidade],
      [`/runs/${id}/cidades`, dadosFx.cidades],
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(D.ebitdaPorCidade).map(([id, e]) => [`/runs/${RUN}/ebitda?cidade=${id}`, e]),
  ),
  ...Object.fromEntries(
    Object.entries(D.cidadeDetalhe).map(([id, c]) => [`/runs/${RUN}/cidades/${id}`, c]),
  ),
  ...Object.fromEntries(
    Object.entries(D.topologias).map(([id, t]) => [`/runs/${RUN}/sistemas/${id}/topologia`, t]),
  ),
  ...Object.fromEntries(
    Object.entries(D.subbacias).map(([id, s]) => [`/runs/${RUN}/subbacias/${id}`, s]),
  ),
  ...Object.fromEntries(Object.entries(D.obras).map(([id, o]) => [`/runs/${RUN}/obras/${id}`, o])),
}

vi.mock('./api/client', () => ({
  get api() {
    return apiFake(estado, dados)
  },
  ApiError: class extends Error {},
}))

beforeEach(() => limparApi(estado))
afterEach(cleanup)

// ===========================================================================
//  Fatia 1 · casca
// ===========================================================================
describe('casca', () => {
  it('mostra os parâmetros da rodada no header — em qualquer nível', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    expect(await screen.findByText('usar CTS')).toBeTruthy()
    expect(await screen.findByText(/solver OTIMO \| OBRIG 3\/3/)).toBeTruthy()
  })

  it('breadcrumb da sub-bacia traz cidade e sistema, que vêm do payload', async () => {
    renderApp(`/resultados/${RUN}/sub-bacias/d1b38_1_1`)
    const trilha = await screen.findByRole('navigation', { name: 'Onde você está' })
    await waitFor(() => expect(trilha.textContent).toContain('Rio Bonito Litoral1'))
    expect(trilha.textContent).toContain('Sistema 38 Litoral1')
    expect(trilha.textContent).toContain('d1b38_1_1')
  })

  it('trocar de rodada no seletor leva para o nível global da outra', async () => {
    renderApp(`/resultados/${RUN}/cidades/c_rio`)
    const seletor = (await screen.findByLabelText('rodada')) as HTMLSelectElement
    await waitFor(() => expect(seletor.querySelectorAll('option').length).toBe(3))
    fireEvent.change(seletor, { target: { value: 'run_2026_0811' } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sem CTS, base faturada/ })).toBeTruthy(),
    )
  })
})

// ===========================================================================
//  Fatia 2 · histórico
// ===========================================================================
describe('histórico de simulações', () => {
  it('busca filtra por nome, unidade ou id', async () => {
    renderApp('/resultados')
    await screen.findByText('Litoral 1 — janela 8a, foco cobertura')

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'apertado' } })
    expect(await screen.findByText(/orçamento apertado/)).toBeTruthy()
    expect(screen.queryByText('Litoral 1 — janela 8a, foco cobertura')).toBeNull()
  })

  it('ordenar por maior VPL reordena os cards', async () => {
    renderApp('/resultados')
    await screen.findByText('Litoral 1 — janela 8a, foco cobertura')

    fireEvent.click(screen.getByRole('button', { name: 'Maior VPL' }))
    await waitFor(() => {
      const nomes = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
      expect(nomes[0]).toContain('sem CTS, base faturada')
    })
  })

  it('rodada INFEASIBLE avisa, não abre e não inventa métricas', async () => {
    renderApp('/resultados')
    expect(await screen.findByText('solver INFEASIBLE')).toBeTruthy()
    expect(await screen.findByText(/não encontrou um plano viável/)).toBeTruthy()
    expect(await screen.findByText('sem resultados')).toBeTruthy()
    // 4 rodadas, 3 com resultado.
    expect(screen.getAllByRole('link', { name: /Ver detalhes/ }).length).toBe(3)
  })

  it('excluir pede confirmação e deixa claro que o cadastro não é afetado', async () => {
    renderApp('/resultados')
    await screen.findByText('Litoral 1 — janela 8a, foco cobertura')

    fireEvent.click(screen.getByRole('button', { name: /Excluir simulação Litoral 1 — janela 8a/ }))
    expect(await screen.findByText(/O cadastro da unidade NÃO é afetado/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(estado.dels).toContain(`/runs/${RUN}`))
  })

  it('os parâmetros ficam visíveis mesmo na rodada que falhou', async () => {
    // E olhando para eles que se entende POR QUE ela falhou.
    renderApp('/resultados')
    const cards = await screen.findAllByRole('listitem')
    const infeasible = cards.find((c) => c.textContent?.includes('INFEASIBLE'))
    expect(within(infeasible as HTMLElement).getByText('orçamento')).toBeTruthy()
  })
})

// ===========================================================================
//  Fatia 3 · global
// ===========================================================================
describe('nível global', () => {
  it('mostra os KPIs e os 6 quadros do painel', async () => {
    renderApp(`/resultados/${RUN}`)
    expect(await screen.findByText('VPL do plano')).toBeTruthy()
    // Cada titulo aparece 2x de proposito: na figcaption e na <caption> da
    // tabela oculta que serve de equivalente textual ao SVG.
    expect((await screen.findAllByText('Cascata do VPL')).length).toBe(2)
    expect((await screen.findAllByText('Curva S — CAPEX acumulado')).length).toBe(2)
    expect((await screen.findAllByText('CAPEX por elemento de obra')).length).toBe(2)
  })

  it('o quadro de desembolso explica que sobra de orçamento é normal', async () => {
    renderApp(`/resultados/${RUN}`)
    expect(await screen.findByText(/Sobra de orçamento nos anos finais é normal/)).toBeTruthy()
  })

  it('transporte não é agrupado: Tronco, EEE e Linha de recalque aparecem separados', async () => {
    renderApp(`/resultados/${RUN}`)
    const quadro = (await screen.findAllByText('CAPEX por elemento de obra'))[0].closest('figure')
    const tabela = within(quadro as HTMLElement).getByRole('table')
    const texto = tabela.textContent ?? ''
    expect(texto).toContain('Tronco')
    expect(texto).toContain('EEE')
    expect(texto).toContain('Linha de recalque')
    expect(texto).not.toContain('Transporte')
  })

  it('a aba EBITDA diz que ele não entra na função objetivo', async () => {
    renderApp(`/resultados/${RUN}?aba=ebitda`)
    expect(await screen.findByText(/não entra na função objetivo/)).toBeTruthy()
  })

  it('a tabela de cidades desce um nível', async () => {
    renderApp(`/resultados/${RUN}`)
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir Rio Bonito Litoral1' }))
    expect(await screen.findByRole('heading', { name: 'Rio Bonito Litoral1' })).toBeTruthy()
  })
})

// ===========================================================================
//  Fatia 4 · cidade
// ===========================================================================
describe('nível cidade', () => {
  it('explicita a causalidade do efeito-base da paridade', async () => {
    renderApp(`/resultados/${RUN}/cidades/c_rio`)
    expect(await screen.findByText(/Paridade esgoto\/água e efeito-base/)).toBeTruthy()
    expect(await screen.findByText(/ligações que já existiam/)).toBeTruthy()
  })

  it('ETE com capacidade zero mostra "—", nunca 0%', async () => {
    // "0%" afirmaria que a ETE esta vazia; a verdade e que a conta nao existe.
    renderApp(`/resultados/${RUN}/cidades/c_bar`)
    const linha = (await screen.findByText('Sistema 41 Litoral1')).closest('tr')
    expect(within(linha as HTMLElement).getByText('—')).toBeTruthy()
    expect(linha?.textContent).not.toContain('0,0%')
  })

  it('a tabela de sistemas desce para a topologia', async () => {
    renderApp(`/resultados/${RUN}/cidades/c_rio`)
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir Sistema 38 Litoral1' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /Sistema 38 Litoral1/ }),
    ).toBeTruthy()
  })
})

// ===========================================================================
//  Fatia 5 · topologia
// ===========================================================================
describe('nível sistema (topologia)', () => {
  it('a CTS aparece com o selo e o pareamento com a sub-bacia', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    const bloco = await screen.findByLabelText('cts_d1b38_1_1 · CTS')
    // O pareamento 1:1 e o que distingue a CTS de uma sub-bacia qualquer.
    expect(within(bloco).getByRole('link', { name: 'd1b38_1_1' })).toBeTruthy()
    expect(within(bloco).getByText('CTS')).toBeTruthy()
  })

  it('a CTS tem 4 componentes e a sub-bacia tem 5', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    const cts = await screen.findByLabelText('cts_d1b38_1_1 · CTS')
    const sub = await screen.findByLabelText('d1b38_1_1')
    expect(within(cts).getAllByRole('listitem').length).toBe(4)
    expect(within(sub).getAllByRole('listitem').length).toBe(5)
    expect(within(cts).getByText('Coletor de tempo seco')).toBeTruthy()
  })

  it('a ETE mostra ocupação e destaca a vazão não atendida', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    const ete = await screen.findByLabelText('ETE · Sistema 38 Litoral1')
    expect(within(ete).getByText('capacidade instalada')).toBeTruthy()
    expect(within(ete).getByText('vazão NÃO atendida')).toBeTruthy()
  })

  it('a legenda obrigatória está presente', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    expect(await screen.findByText('sem obra prevista (CAPEX 0)')).toBeTruthy()
    expect(await screen.findByText('nó CTS (↔ sub-bacia pareada)')).toBeTruthy()
  })

  it('o rail lista todos os nós do sistema', async () => {
    renderApp(`/resultados/${RUN}/sistemas/s38`)
    const rail = await screen.findByRole('navigation', { name: 'Nós do sistema' })
    // 6 sub-bacias + 2 CTS
    expect(within(rail).getAllByRole('button').length).toBe(8)
  })
})

// ===========================================================================
//  Fatia 6 · sub-bacia e elemento
// ===========================================================================
describe('nível sub-bacia', () => {
  it('a que não fatura mostra a mensagem, não um gráfico vazio', async () => {
    renderApp(`/resultados/${RUN}/sub-bacias/d1b38_2_1`)
    expect(await screen.findByText(/não fatura neste plano/)).toBeTruthy()
    expect(screen.queryByText('Receita ao longo do tempo')).toBeTruthy()
  })

  it('o elo que trava é um link para o elemento', async () => {
    renderApp(`/resultados/${RUN}/sub-bacias/d1b38_2_1`)
    const elo = await screen.findByRole('link', { name: 'red_d1b38_2_1' })
    expect(elo.getAttribute('href')).toContain('/obras/red_d1b38_2_1')
  })

  it('mostra o "se fosse ligada agora" com a ressalva sobre o teto', async () => {
    renderApp(`/resultados/${RUN}/sub-bacias/d1b38_2_1`)
    expect(await screen.findByText(/Se fosse ligada agora/)).toBeTruthy()
    expect(await screen.findByText(/mesmo teto de orçamento/)).toBeTruthy()
  })

  it('a que fatura mostra a curva de receita', async () => {
    renderApp(`/resultados/${RUN}/sub-bacias/d1b38_1_1`)
    expect((await screen.findAllByText('Receita ao longo do tempo')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/não fatura neste plano/)).toBeNull()
  })
})

describe('nível elemento', () => {
  it('mostra o WACC com a origem', async () => {
    // "proprio" e financiamento contratado; "medio" e heranca do wacc_medio.
    renderApp(`/resultados/${RUN}/obras/lig_d1b38_1_1`)
    expect(await screen.findByText('WACC')).toBeTruthy()
    expect(await screen.findByText(/da unidade|própria da obra|próprio da obra/)).toBeTruthy()
  })

  it('mostra o rateio e diz que a soma é garantida pelo portão', async () => {
    renderApp(`/resultados/${RUN}/obras/tro_d1b38_1_1`)
    expect(await screen.findByText('Quem depende deste elemento')).toBeTruthy()
    expect(await screen.findByText(/portão de qualidade da rodada/)).toBeTruthy()
  })

  it('CAPEX traz a conta quantidade × preço ao lado', async () => {
    renderApp(`/resultados/${RUN}/obras/lig_d1b38_1_1`)
    const capex = (await screen.findByText('CAPEX')).closest('div')
    expect(capex?.textContent).toMatch(/×/)
  })
})
