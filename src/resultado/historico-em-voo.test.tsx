// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

/**
 * O histórico com rodadas que AINDA NÃO PUBLICARAM.
 *
 * `GET /runs` passou a juntar `controle.*` (o que está na fila, rodando ou
 * falhou) com `otim_*` (o que tem resultado). Sem isso, quem fechasse o modal de
 * acompanhamento perdia a rodada de vista, e a tela mais operacional do produto
 * era cega justamente para o estado operacional.
 *
 * A mudança quebrou a tela inteira, e o modo de falha vale registrar: o card lia
 * `r.parametros.janelaCapex` incondicionalmente, e rodada em voo não tem
 * `parametros` — eles saem de `otim_meta`, escrita só na publicação. Resultado:
 * `Cannot read properties of undefined` e o error boundary comendo a página.
 *
 * Eu tinha percebido que a forma da resposta mudou (dois smokes do backend
 * quebraram e eu os consertei) e escrevi no commit que "o front tem a mesma
 * armadilha" — sem ir verificar. Este arquivo é o que faltava naquele momento.
 */
/**
 * As tres ficam em FIXTURE, e nao numa constante aqui, porque `vi.mock` e HOISTED
 * para o topo do arquivo: uma constante declarada acima dele ainda nao existe
 * quando a fabrica roda, e o teste morre com "Cannot access before initialization".
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake } = await import('@/testes/apiFake')
  const runsFx = (await import('@/mocks/fixtures/runs.json')).default
  const publicadas = (runsFx.runs as unknown[]).map((r) => ({
    ...(r as object),
    publicada: true,
  }))
  const emVoo = (await import('@/mocks/fixtures/runs-em-voo.json')).default
  return { ...original, api: apiFake(api, { '/runs': [...emVoo, ...publicadas] }) }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('histórico com rodadas em voo', () => {
  it('a tela não quebra, e as três aparecem com o estado delas', async () => {
    renderApp('/resultados')

    expect(await screen.findByText('Cenário na fila')).toBeTruthy()
    expect(screen.getByText('Cenário rodando')).toBeTruthy()
    expect(screen.getByText('Cenário que falhou')).toBeTruthy()

    // Cada estado diz o que está acontecendo, em vez de mostrar métricas vazias.
    expect(screen.getByText(/Na fila, esperando um executor/)).toBeTruthy()
    expect(screen.getByText(/62% concluído/)).toBeTruthy()
    expect(screen.getByText(/Fila de simulações não configurada/)).toBeTruthy()
  })

  it('não oferece "Ver detalhes" para o que não tem resultado', async () => {
    renderApp('/resultados')
    await screen.findByText('Cenário rodando')

    // Uma por rodada em voo. O link levaria a `meta`/`painel` que não existem —
    // e o usuário só descobriria depois de clicar.
    expect(screen.getAllByText('ainda sem resultado')).toHaveLength(3)

    // As publicadas continuam abrindo normalmente.
    expect(screen.getAllByText('Ver detalhes →').length).toBeGreaterThan(0)
  })

  it('rodada em voo não mostra parâmetros: eles só existem depois de publicar', async () => {
    renderApp('/resultados')
    await screen.findByText('Cenário na fila')

    // Era exatamente aqui que a tela caía: `r.parametros.janelaCapex` num objeto
    // que o backend não manda enquanto a rodada não publicou. Contar os blocos
    // prova que os cards em voo não os renderizam — se voltassem, seriam 7.
    expect(screen.getAllByText('janela de CAPEX')).toHaveLength(4)
  })
})
