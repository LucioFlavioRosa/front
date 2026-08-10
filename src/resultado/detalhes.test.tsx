// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

/**
 * OS METADADOS DA SIMULAÇÃO, antes de abrir o resultado.
 *
 * Antes, clicar numa rodada levava direto ao resultado. Isso funciona quando você
 * sabe qual rodada quer; não funciona quando a lista tem dez cenários da mesma
 * unidade e a pergunta é "qual era o de orçamento apertado?".
 *
 * A resposta estava no pedido, e o pedido não chegava à tela: `parametros` traz
 * seis campos, e o formulário de simulação tem mais de vinte. Coisas como
 * `PENALIDADE_COBERTURA`, `CURVA_ADOCAO` e `WORKERS` não apareciam em lugar
 * nenhum depois de a rodada existir.
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake } = await import('@/testes/apiFake')
  return {
    ...original,
    api: apiFake(api, {
      '/runs': [
        {
          runId: 'run_com_pedido',
          nome: 'Cenário conservador',
          unidadeId: 'uA1',
          unidadeNome: 'Unidade Serrana',
          dataHora: '2026-08-10T14:32:00+00:00',
          autor: 'ana@aegea',
          duracaoS: 41,
          status: 'OPTIMAL',
          favorita: false,
          publicada: true,
          metricas: {
            vpl: 1e6,
            capex: 5e5,
            usoOrcamentoPct: 50,
            obrasConstruidas: 2,
            obrasTotal: 4,
            coberturaFimPct: 80,
            metasAtingidas: 1,
            metasTotal: 2,
            ebitdaTotal: 1e5,
          },
          parametros: {
            baseReceita: 'arrecadada',
            usarCts: true,
            janelaCapex: 3,
            orcamento: 6e7,
            focoCobertura: 1,
            incluirIndustrial: true,
          },
          // O pedido: as variáveis que `parametros` não alcança.
          pedido: {
            ORCAMENTO: { '2026': 60000000, '2027': 40000000 },
            PENALIDADE_COBERTURA: 'meta+cobertura',
            CURVA_ADOCAO: 'scurve',
            USAR_CTS: true,
            PESO_CIDADE: { 'Cabo Frio': 5 },
            WORKERS: 8,
          },
        },
        {
          runId: 'run_sem_pedido',
          nome: 'Rodada do pacote',
          unidadeId: 'uA1',
          unidadeNome: 'Unidade Serrana',
          dataHora: '2026-08-07T22:48:00+00:00',
          autor: 'lucio.rosa',
          duracaoS: 30,
          status: 'OPTIMAL',
          favorita: false,
          publicada: true,
          metricas: {
            vpl: 1,
            capex: 1,
            usoOrcamentoPct: 1,
            obrasConstruidas: 1,
            obrasTotal: 1,
            coberturaFimPct: 1,
            metasAtingidas: 1,
            metasTotal: 1,
            ebitdaTotal: 1,
          },
          pedido: null,
        },
      ],
    }),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

async function abrir(nome: string) {
  renderApp('/resultados')
  await screen.findByText(nome)
  const card = screen.getByText(nome).closest('li') as HTMLElement
  fireEvent.click(within(card).getByRole('button', { name: 'Ver detalhes →' }))
  return screen.findByRole('dialog')
}

describe('clicar na simulação abre os metadados, e não o resultado', () => {
  it('mostra quem fez, quando e em que unidade', async () => {
    const modal = await abrir('Cenário conservador')
    expect(modal.textContent).toContain('ana@aegea')
    expect(modal.textContent).toContain('Unidade Serrana')
    expect(modal.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(modal.textContent).toContain('run_com_pedido')
  })

  it('lista as variáveis do PEDIDO, não só as seis do card', async () => {
    // `PENALIDADE_COBERTURA`, `CURVA_ADOCAO` e `WORKERS` não existem em
    // `parametros` — antes deste modal não apareciam em lugar nenhum.
    const modal = await abrir('Cenário conservador')
    expect(modal.textContent).toContain('Penalidade de cobertura')
    expect(modal.textContent).toContain('Curva de adoção')
    expect(modal.textContent).toContain('Workers')
  })

  it('mostra o nome TÉCNICO ao lado do rótulo, e não no lugar', async () => {
    // A tela de simulação mostra o nome técnico porque a rastreabilidade com o
    // notebook foi requisito de handoff. Quem compara os dois precisa da chave.
    const modal = await abrir('Cenário conservador')
    expect(modal.textContent).toContain('PENALIDADE_COBERTURA')
  })

  it('formata o que `String(v)` estragaria', async () => {
    const modal = await abrir('Cenário conservador')
    // Orçamento por ano: o JSON cru é ilegível, e é o parâmetro mais consultado.
    expect(modal.textContent).toMatch(/2026: R\$ 60 mi/)
    expect(modal.textContent).toMatch(/2027: R\$ 40 mi/)
    // Booleano vira sim/não — "true" é vocabulário de máquina.
    expect(modal.textContent).toContain('sim')
    // Objeto vira par legível.
    expect(modal.textContent).toContain('Cabo Frio: 5')
  })
})

describe('as duas saídas, e nada mais', () => {
  it('"Ver resultados" navega; "Fechar" fecha', async () => {
    const modal = await abrir('Cenário conservador')
    expect(within(modal).getByRole('button', { name: 'Fechar' })).toBeTruthy()

    fireEvent.click(within(modal).getByRole('button', { name: /Ver resultados/ }))
    // Saiu do histórico: o modal fecha junto com a navegação, e a lista de
    // rodadas — com o botão de excluir de cada uma — deixa de existir.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: /Excluir simulação/ })).toBeNull()
  })

  it('Esc fecha, como em qualquer modal desta aplicação', async () => {
    await abrir('Cenário conservador')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clicar fora fecha; clicar no card não', async () => {
    const modal = await abrir('Cenário conservador')
    fireEvent.click(modal)
    expect(screen.queryByRole('dialog')).toBeTruthy()

    fireEvent.click(modal.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('rodada sem pedido registrado', () => {
  it('diz que não há, em vez de mostrar lista vazia', async () => {
    // O pacote de produção publica direto, sem passar pela fila — e aí não há
    // `run_request` de onde tirar o pedido. Lista vazia se leria como "rodou sem
    // parâmetro nenhum", que é outra coisa.
    const modal = await abrir('Rodada do pacote')
    expect(modal.textContent).toMatch(/não tem o pedido registrado/)
  })
})
