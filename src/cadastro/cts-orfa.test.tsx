// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * CTS num sistema que a árvore do rail não lista.
 *
 * O rail do Grupo 05 é montado a partir das SUB-BACIAS, então um sistema que só
 * tenha CTS e ETE não aparece nele. As CTS desse sistema continuam existindo no
 * cadastro, e a tela tem de mostrá-las num ramo próprio — senão elas somem do
 * rail e a tela cai no estado "nenhuma CTS" com os dados no store.
 *
 * Aqui o cenário é forçado tirando da árvore os sistemas que têm CTS.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  const subbacias = (await import('@/mocks/fixtures/subbacias.json')).default
  const cts = (await import('@/mocks/fixtures/cts.json')).default

  const comCts = new Set(Object.values(cts.ctss).map((c) => c.sisId))
  const arvore = subbacias.arvore.map((sup) => ({
    ...sup,
    cidades: sup.cidades.map((c) => ({
      ...c,
      sistemas: c.sistemas.filter((s) => !comCts.has(s.id)),
    })),
  }))
  return { ...original, api: apiFake(api, await dadosDaUnidade({ arvore })) }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('CTS em sistema fora da árvore de sub-bacias', () => {
  it('aparece num ramo próprio em vez de sumir da tela', async () => {
    renderApp('/unidade/u-jacarei/cts')

    // A ficha abre normalmente — não é o estado vazio.
    expect(await screen.findByRole('button', { name: 'Salvar CTS' })).toBeTruthy()
    expect(screen.queryByText('Nenhuma CTS nesta unidade')).toBeNull()

    // As 3 CTS existentes ficam alcançáveis pelo ramo de exceção.
    expect(screen.getByRole('button', { name: /Sistemas sem sub-bacia/ })).toBeTruthy()
    expect(screen.getByText(/3 CTS/)).toBeTruthy()

    // E o chip do grupo segue contando as pendências delas.
    expect(await screen.findByText('6 pendências')).toBeTruthy()

    // A régua da meta vem da cidade do SISTEMA, e o sistema não está na árvore
    // do rail — mas continua na hierarquia, então a régua é conhecida assim
    // mesmo. É a diferença do modelo antigo, em que sumir da árvore de
    // sub-bacias significava perder a régua junto.
    expect(screen.getByText('Economias novas (obras)')).toBeTruthy()
  })
})
