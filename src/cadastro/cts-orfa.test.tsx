// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * De-para de CTS fora de sincronia com a árvore de sub-bacias: as 3 CTS do mock
 * apontam para sub-bacias que a árvore não lista. Elas continuam existindo no
 * cadastro, então a tela tem de mostrá-las num ramo próprio — antes elas
 * desapareciam do rail e a tela caía no estado "nenhuma CTS cadastrada" com os
 * dados no store.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  const subbacias = (await import('@/mocks/fixtures/subbacias.json')).default
  const cts = (await import('@/mocks/fixtures/cts.json')).default

  // A mesma árvore, sem as sub-bacias que têm CTS: é o payload fora de sincronia
  // que este teste existe para cobrir.
  const pareadas = new Set(cts.pares.map((p) => p.sub))
  const arvore = subbacias.arvore.map((sup) => ({
    ...sup,
    cidades: sup.cidades.map((c) => ({
      ...c,
      sistemas: c.sistemas.map((s) => ({
        ...s,
        subIds: s.subIds.filter((id) => !pareadas.has(id)),
      })),
    })),
  }))
  return { ...original, api: apiFake(api, await dadosDaUnidade({ arvore })) }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('CTS órfã da árvore de sub-bacias', () => {
  it('aparece num ramo próprio em vez de sumir da tela', async () => {
    renderApp('/unidade/u-jacarei/cts')

    // A ficha abre normalmente — não é o estado vazio.
    expect(await screen.findByText(/CTS ↔ sub-bacia b/)).toBeTruthy()
    expect(screen.queryByText('Nenhuma CTS cadastrada nesta unidade')).toBeNull()

    // As 3 CTS existentes ficam alcançáveis pelo ramo de exceção.
    expect(screen.getByRole('button', { name: /Fora da árvore de sub-bacias/ })).toBeTruthy()
    expect(screen.getByText(/3 CTS · confira o de-para no Databricks/)).toBeTruthy()

    // E o chip do grupo segue contando as pendências delas.
    expect(await screen.findByText('7 pendências')).toBeTruthy()

    // Sem árvore não dá para saber a régua da meta: a base do Databricks
    // aparece inteira, sem destaque em nenhum trio, e a tela diz o porquê.
    expect(screen.getByText('Economias novas (obras)')).toBeTruthy()
    expect(screen.getByText(/não está na árvore/)).toBeTruthy()
    // Sem régua conhecida os campos de população ficam BLOQUEADOS, não ausentes:
    // preenchê-los sem saber se contam seria trabalho no escuro, mas escondê-los
    // faria a CTS órfã parecer uma ficha diferente das outras — e o problema
    // dela é o de-para, não o formulário.
    const universo = screen.getByLabelText('População — universo') as HTMLInputElement
    expect(universo.disabled).toBe(true)
    expect(screen.getByText(/ainda não foi escolhida/)).toBeTruthy()
  })
})
