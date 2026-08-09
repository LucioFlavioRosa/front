// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * Unidade fora do escopo do usuário: o servidor responde **404**.
 *
 * É 404 e não 403 de propósito — 403 confirmaria que a unidade existe, e "existe
 * mas não é sua" já é informação: daria para mapear a organização inteira
 * variando o id na URL.
 *
 * Mas 404 chega ao front pelo mesmo caminho de um erro de rede, e a tela tratava
 * os dois igual: dizia "a conexão com a base falhou. Nada foi perdido" e oferecia
 * tentar de novo. Três problemas numa tela só — o título é falso, a promessa não
 * é da tela para fazer, e o botão nunca vai funcionar.
 *
 * Arquivo separado do irmão `sem-acesso.test.tsx` porque o `vi.mock` é avaliado
 * UMA vez por arquivo: os dois cenários precisam de mocks diferentes, e uma flag
 * trocada dentro do teste não chegaria a tempo.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  const { ApiError } = original as { ApiError: typeof import('@/comum/api/client').ApiError }
  // É assim que o recorte por unidade chega: 404 em toda leitura da unidade.
  api.erroGet = new ApiError(404, 'Not Found', '/unidades/u-jacarei', 'Unidade não encontrada.')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('unidade fora do escopo do usuário', () => {
  it('diz que não tem acesso, e não que a conexão falhou', async () => {
    renderApp('/unidade/u-jacarei')

    expect(await screen.findByText(/Sem acesso a/)).toBeTruthy()
    expect(screen.getByText(/não existe ou não está liberado/)).toBeTruthy()

    // As duas frases que estavam erradas. "Nada foi perdido" é a pior: este
    // componente não tem como saber, e o usuário nem chegou a editar.
    expect(screen.queryByText(/A conexão com a base falhou/)).toBeNull()
    expect(screen.queryByText(/Nada foi perdido/)).toBeNull()
  })
})
