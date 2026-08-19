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
  const cts = (await import('@/mocks/fixtures/cts.json')).default
  return {
    ...original,
    api: apiFake(api, await dadosDaUnidade({ cts: { ...cts, inconsistencias } })),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('CTS com cadastro incompleto', () => {
  it('a tela lista cada uma, com o id e o motivo', async () => {
    renderApp('/unidade/u-jacarei/cts')

    expect(await screen.findByText('2 CTS com cadastro incompleto')).toBeTruthy()
    expect(screen.getByText('cts_b2b80_1_3')).toBeTruthy()
    expect(screen.getByText('cts_c2b12_3_1')).toBeTruthy()

    // O motivo vem do servidor e não é reescrito pela tela: quem corrige o
    // cadastro precisa saber QUAL das três coisas falta, não só que falta algo.
    expect(screen.getByText(/A simulacao nao a enxerga/)).toBeTruthy()
    expect(screen.getByText(/Entra na simulacao com demanda zero/)).toBeTruthy()

    // E diz onde se corrige — o Grupo 05 não edita topologia.
    expect(screen.getByText(/cadastro estrutural \(Grupo 01\)/)).toBeTruthy()
  })

  it('a ficha denunciada continua editável em vez de sumir do rail', async () => {
    renderApp('/unidade/u-jacarei/cts')

    // ESPERA PELA FICHA, e nao pelo painel. O painel vem de `ctsQ.data` direto
    // (CadastroContext), enquanto a ficha depende do efeito de seed do reducer:
    // ha sempre uma janela em que o painel ja esta na tela e a ficha ainda nao —
    // e nessa janela o texto do estado vazio ESTA correto.
    //
    // A versao anterior esperava pelo painel, que aparece nos DOIS caminhos de
    // render (de proposito: no estado vazio e justamente onde um no orfao ficaria
    // invisivel). Ganhava a corrida quase sempre, e perdia sob a suite inteira,
    // com os workers do vitest disputando CPU. Teste que falha as vezes ensina a
    // ignorar falha de teste.
    await screen.findByRole('button', { name: 'Salvar CTS' })
    expect(screen.getByText('2 CTS com cadastro incompleto')).toBeTruthy()

    // Esconder a ficha "defeituosa" seria pior que mostrá-la: tiraria do usuário
    // a única tela onde ele veria o problema, e a ficha em si é editável.
    expect(screen.queryByText('Nenhuma CTS nesta unidade')).toBeNull()
  })
})
