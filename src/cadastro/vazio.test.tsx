// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * UNIDADE SEM DADO. Uma unidade recém-criada (ou cuja carga do Databricks ainda
 * não rodou) devolve listas vazias — e "vazio" não pode parecer "carregando":
 * as telas ficavam no skeleton para sempre, esperando um primeiro item que não
 * vem. Cada grupo precisa dizer que não há nada e o que fazer a respeito.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return {
    ...original,
    api: apiFake(api, await dadosDaUnidade({ id: 'u-nova', nome: 'Unidade Nova', vazio: true })),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('unidade sem registros', () => {
  it('sub-bacias diz que não há nenhuma, em vez de carregar para sempre', async () => {
    renderApp('/unidade/u-nova/sub-bacias')
    expect(await screen.findByText('Nenhuma sub-bacia nesta unidade')).toBeTruthy()
    expect(screen.queryByText(/Carregando sub-bacias/)).toBeNull()
  })

  it('contrato & metas diz que não há cidade', async () => {
    renderApp('/unidade/u-nova/contrato-metas')
    expect(await screen.findByText('Nenhuma cidade no contrato desta unidade')).toBeTruthy()
  })

  it('ETEs diz que não há estação', async () => {
    renderApp('/unidade/u-nova/etes')
    expect(await screen.findByText('Nenhuma ETE nesta unidade')).toBeTruthy()
  })

  it('hierarquia diz que não há sistema, em vez de carregar para sempre', async () => {
    renderApp('/unidade/u-nova/hierarquia')
    expect(await screen.findByText('Nenhum sistema nesta unidade')).toBeTruthy()
    expect(screen.queryByText(/Carregando hierarquia/)).toBeNull()
  })

  it('completude de base vazia é 100% e não NaN', async () => {
    renderApp('/unidade/u-nova')
    const barra = await screen.findByRole('progressbar')
    expect(barra.getAttribute('aria-valuenow')).toBe('100')
  })
})
