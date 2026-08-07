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

/**
 * NAO ha mais teste de CRIAR nem de REMOVER CTS, e a ausencia e deliberada.
 *
 * A CTS e um NO DO SISTEMA: a posicao dela vem da topologia (`sistema_topologia`),
 * como a da sub-bacia. Criar uma pela tela gravava ficha sem no — visivel no
 * cadastro, invisivel para a simulacao, porque o motor faz `cts_ids = fichas ∩ nos`.
 * Remover era pior: apagava a ficha e deixava o no, que virava demanda ZERO.
 *
 * Os testes que sairam eram bons — cobriam criacao pessimista, rollback e a corrida
 * entre DELETE e PUT. Eles nao falharam: a funcionalidade que testavam foi retirada
 * do produto. Ficam registrados aqui para ninguem os "restaurar" achando que sumiram
 * por descuido.
 */

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
