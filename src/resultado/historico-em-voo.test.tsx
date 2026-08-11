// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

/**
 * O histórico com rodadas que AINDA NÃO PUBLICARAM.
 *
 * `GET /runs` passou a juntar `controle.*` (o que está na fila, rodando ou
 * falhou) com `otim_*` (o que tem resultado). Sem isso, quem fechasse o modal de
 * acompanhamento perdia a rodada de vista, e a tela mais operacional do produto
 * era cega justamente para o estado operacional.
 *
 * Rodada em voo NÃO tem `parametros` nem `metricas`: os dois saem de `otim_meta`,
 * escrita só na publicação. O card precisa renderizar esses estados sem tentar
 * montar bloco de resultado — ler `r.parametros.janelaCapex` sem guarda derruba a
 * página inteira pelo error boundary.
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

  it('a rodada em voo ABRE os detalhes, mas não deixa ir ao resultado', async () => {
    // Antes ela não oferecia nada: sem resultado, sem link, e nenhuma forma de
    // ver com que parâmetros tinha sido pedida — justamente a pergunta que se faz
    // sobre uma rodada que está demorando ou que falhou.
    //
    // Agora abre o modal de metadados, e o bloqueio mudou de lugar: quem fica
    // desabilitado é o "Ver resultados" lá dentro. A garantia que importa é a
    // mesma — não se navega para um resultado que não existe.
    renderApp('/resultados')
    await screen.findByText('Cenário rodando')

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes →' })[0])
    const modal = await screen.findByRole('dialog')
    const ver = within(modal).getByRole('button', { name: /Ver resultados/ }) as HTMLButtonElement
    expect(ver.disabled).toBe(true)
    expect(within(modal).getByRole('button', { name: 'Fechar' })).toBeTruthy()
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
