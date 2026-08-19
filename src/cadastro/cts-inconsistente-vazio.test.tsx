// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * As CTS que existem pela metade: o servidor as denuncia em `inconsistencias`,
 * e a tela tem de mostrá-las.
 *
 * Isto NÃO é erro de carregamento — a leitura funcionou, o cadastro é que está
 * incompleto. A diferença importa: erro de rede se resolve tentando de novo,
 * isto só se resolve mexendo no cadastro estrutural, e ninguém mexe no que não
 * sabe que está quebrado. Antes, essas CTS eram servidas em silêncio e a
 * simulação saía errada sem nenhum sinal na tela.
 */

/**
 * O caso do `no-sem-ficha` sem ficha nenhuma para listar — o mais importante dos
 * três, e o que corria mais risco de ser engolido: é exatamente quando a unidade
 * não tem CTS cadastrada que existe um nó órfão a denunciar, e o estado vazio
 * ocupa a tela inteira.
 *
 * Arquivo separado do irmão `cts-inconsistente.test.tsx` porque o `vi.mock` é
 * avaliado UMA vez por arquivo: uma flag trocada dentro do teste não chegaria a
 * tempo, e o teste passaria sempre — contra o payload errado.
 */
/**
 * Os dois casos vem do BANCO REAL (uA2 e uA3, carregados da planilha), e nao de
 * um cadastro inventado para o teste: sao CTS com ficha e par que nunca
 * entraram na topologia. Ficam em fixture porque o `vi.mock` e hoisted para o
 * topo do arquivo — uma constante declarada acima dele ainda nao existe quando a
 * fabrica roda, e o teste morre com "Cannot access before initialization".
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  const inconsistencias = (await import('@/mocks/fixtures/cts-inconsistencias.json')).default
  return {
    ...original,
    api: apiFake(api, await dadosDaUnidade({ cts: { pares: [], ctss: {}, inconsistencias } })),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('CTS incompleta numa unidade sem ficha de CTS', () => {
  it('o estado vazio não engole a denúncia', async () => {
    renderApp('/unidade/u-jacarei/cts')

    expect(await screen.findByText('Nenhuma CTS nesta unidade')).toBeTruthy()
    expect(screen.getByText('2 CTS com cadastro incompleto')).toBeTruthy()
    expect(screen.getByText('cts_c2b12_3_1')).toBeTruthy()
  })
})
