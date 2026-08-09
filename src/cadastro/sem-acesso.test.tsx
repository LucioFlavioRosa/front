// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * O QUE A TELA FAZ QUANDO O SERVIDOR RECORTA.
 *
 * O backend passou a recortar por usuário: unidade fora do escopo responde 404,
 * e `/regionais` volta filtrado — vazio para quem não tem concessão nenhuma.
 *
 * O front não sabia disso. Uma revisão encontrou os dois becos:
 *
 *   404          aparecia como "a conexão com a base falhou. Nada foi perdido",
 *                com botão de tentar de novo. Título falso, promessa que a tela
 *                não tem como fazer, e um botão que nunca vai funcionar.
 *   lista vazia  virava um select morto, sem uma linha de explicação — a pessoa
 *                concluiria que o sistema quebrou.
 *
 * Eu construí o recorte no servidor e não olhei o que a tela faz quando ele age.
 * Estes testes existem para isso não se repetir em silêncio: os dois casos são
 * respostas NORMAIS do servidor, não falhas, e a tela precisa distingui-los de
 * queda de conexão — que é o único dos três que se resolve tentando de novo.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  // Usuário sem concessão: a lista vem VAZIA, com 200. Não é erro.
  return {
    ...original,
    api: apiFake(api, { ...(await dadosDaUnidade()), '/regionais': [] }),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('usuário sem nenhuma unidade liberada', () => {
  it('a seleção diz o que houve, em vez de virar um select vazio', async () => {
    renderApp('/cadastro')

    expect(await screen.findByText(/Sem acesso a nenhuma unidade/)).toBeTruthy()
    expect(screen.getByText(/não está liberado para o seu usuário/)).toBeTruthy()
    expect(screen.getByText(/Nenhuma regional está liberada/)).toBeTruthy()
  })

  it('não oferece "tentar de novo": não é falha de conexão', async () => {
    renderApp('/cadastro')
    await screen.findByText(/Sem acesso a nenhuma unidade/)

    // O botão existe no MESMO componente para o caso de queda de rede. Aqui ele
    // não pode aparecer: tentar de novo devolveria a mesma lista vazia, e a
    // pessoa ficaria clicando à espera de um resultado que não vem.
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).toBeNull()
    expect(screen.queryByText(/A conexão com a base falhou/)).toBeNull()
  })
})
