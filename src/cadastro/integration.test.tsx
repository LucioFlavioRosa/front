// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * Teste de integração ponta a ponta: mocka só o canal HTTP (api/client) com as
 * fixtures e exercita o app real (router + providers + store + telas). Prova o
 * wiring que os testes unitários não pegam: editar numa tela propaga para o chip
 * do grupo e para a completude do header.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('Contrato & Metas (integração)', () => {
  it('preencher uma pendência propaga para o chip do grupo e para o header', async () => {
    renderApp('/unidade/u-jacarei/contrato-metas')

    // Estado inicial: tela carregada, chip do grupo = 4 pendências, header = 95%.
    expect(await screen.findByText('Contrato & Metas')).toBeTruthy()
    expect(await screen.findByText('4 pendências')).toBeTruthy()
    const barra = screen.getByRole('progressbar')
    expect(barra.getAttribute('aria-valuenow')).toBe('95')

    // Seleciona Iguaba (cidade com fim + cobertura vazios).
    fireEvent.click(await screen.findByText('Iguaba'))

    // Preenche o "Fim da concessão" (único input com placeholder AAAA nesta cidade).
    const fim = await screen.findByPlaceholderText('AAAA')
    fireEvent.change(fim, { target: { value: '2050' } })

    // Propagação: o chip do grupo cai de 4 para 3 pendências.
    expect(await screen.findByText('3 pendências')).toBeTruthy()
    // A completude é a mesma barra viva: 1 campo em ~490 não move o
    // arredondamento (o denominador inclui obras e CTS), mas o valor continua
    // sendo derivado do store.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('95')
  })
})

describe('CTS (integração)', () => {
  it('mostra o pareamento e propaga a edição para o chip do grupo', async () => {
    renderApp('/unidade/u-jacarei/cts')

    // A primeira CTS da árvore (Búzios vem antes de Rio das Ostras) abre
    // selecionada, com o vínculo 1:1 visível.
    expect(await screen.findByText(/CTS ↔ sub-bacia b3_1_1/)).toBeTruthy()
    // Chip do grupo: as 3 CTS do mock somam 7 pendências.
    expect(await screen.findByText('7 pendências')).toBeTruthy()

    // "Próxima pendente" pula a CTS completa (cts_b2_1_1) e para na incompleta.
    fireEvent.click(screen.getByRole('button', { name: 'Próxima pendente →' }))
    expect(await screen.findByText(/CTS ↔ sub-bacia b2_1_4/)).toBeTruthy()

    // Preencher o potencial de crescimento (pendente nessa CTS) tira 1 do grupo.
    fireEvent.change(screen.getByLabelText('Potencial de crescimento'), {
      target: { value: '1,0' },
    })
    expect(await screen.findByText('6 pendências')).toBeTruthy()
  })

  it('adicionar CTS a uma sub-bacia livre cria as 4 obras dela', async () => {
    renderApp('/unidade/u-jacarei/cts')

    // b1_1_1 não tem CTS no mock — aparece na lista de "sub-bacias sem CTS".
    const botao = await screen.findByRole('button', { name: /\+ CTS em b1_1_1/ })
    fireEvent.click(botao)

    // A CTS nova abre selecionada, com a âncora de coleta própria da CTS.
    expect(await screen.findByText(/CTS ↔ sub-bacia b1_1_1/)).toBeTruthy()
    expect(screen.getByText('Coletor de tempo seco')).toBeTruthy()
    // Não existe "Ligação de esgoto"/"Rede coletora" aqui: a CTS tem 4 componentes.
    expect(screen.queryByText('Rede coletora')).toBeNull()

    // Os 6 params entram vazios: 7 + 6 pendências no grupo.
    expect(await screen.findByText('13 pendências')).toBeTruthy()
  })
})
