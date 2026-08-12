// @vitest-environment jsdom
/**
 * Marcar favoritas e ver só elas.
 *
 * A estrela existia no card desde o começo, como `<span>`, e nunca apareceu em
 * produção: o backend respondia `favorita: false` fixo. Estes testes cobrem o que
 * passou a existir — o controle, o recorte, e as duas frases de lista vazia, que
 * são diferentes conforme o que esvaziou a lista.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
// `apiFake` NAO entra aqui: o `vi.mock` e icado para o topo, entao a fabrica o
// importa por dentro. Um import aqui em cima seria uma segunda referencia, e o
// lint acusa por nao ser usada.
import { api as estado, limparApi } from '@/testes/apiFake'

/** Três rodadas publicadas; a do meio começa favoritada. */
function runs(favoritas: string[] = []) {
  return ['alfa', 'beta', 'gama'].map((n, i) => ({
    runId: `run_${n}`,
    nome: `Cenário ${n}`,
    unidadeId: 'uA1',
    unidadeNome: 'Unidade Serrana',
    dataHora: `2026-08-1${i}T14:00:00+00:00`,
    autor: 'ana@aegea',
    duracaoS: 120,
    status: 'OPTIMAL',
    favorita: favoritas.includes(`run_${n}`),
    publicada: true,
    parametros: {
      baseReceita: 'arrecadada',
      usarCts: true,
      janelaCapex: 8,
      orcamento: 1e8,
      focoCobertura: 1,
      incluirIndustrial: true,
    },
    metricas: {
      vpl: 1e6 * (i + 1),
      capex: 1e6,
      usoOrcamentoPct: 50,
      obrasConstruidas: 1,
      obrasTotal: 2,
      coberturaFimPct: 80,
      metasAtingidas: 1,
      metasTotal: 1,
      ebitdaTotal: 1e6,
    },
  }))
}

/** O estado que o "servidor" devolve; os testes trocam entre um render e outro. */
let marcadas: string[] = []

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake } = await import('@/testes/apiFake')
  return {
    ...original,
    // Getter: o `apiFake` e montado a cada acesso, entao ele enxerga o estado do
    // caso em execucao — um objeto fixo congelaria o primeiro.
    //
    // E o `/runs` DERIVA das chamadas ja registradas, em vez de devolver sempre a
    // fixture. Sem isso o fake nao se comporta como servidor: a mutation invalida
    // a lista, o refetch traz `favorita: false` de novo, e a estrela que o usuario
    // acabou de acender apaga sozinha. O teste mediria o mock, e nao a tela.
    get api() {
      const atuais = new Set(marcadas)
      // Com `erroPut` armado, o PUT e registrado e DEPOIS falha — entao ignorar as
      // chamadas e o que faz o servidor de mentira recusar de verdade.
      if (!api.erroPut) {
        for (const [p] of api.puts) {
          const m = /^\/runs\/(.+)\/favorita$/.exec(p)
          if (m) atuais.add(m[1])
        }
      }
      for (const p of api.dels) {
        const m = /^\/runs\/(.+)\/favorita$/.exec(p)
        if (m) atuais.delete(m[1])
      }
      return apiFake(api, { '/runs': runs([...atuais]) })
    },
  }
})

const { renderApp } = await import('@/testes/renderApp')

beforeEach(() => {
  limparApi(estado)
  marcadas = []
})
afterEach(cleanup)

const estrela = (nome: string) => screen.getByRole('button', { name: new RegExp(nome) })

describe('marcar uma simulação como favorita', () => {
  it('a estrela vazia chama o PUT e acende sem esperar o servidor', async () => {
    renderApp('/resultados')
    await screen.findByText('Cenário alfa')

    const b = estrela('Marcar "Cenário alfa" como favorita')
    expect(b.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(b)

    // Otimista: a marca aparece antes de qualquer resposta.
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /Desmarcar "Cenário alfa"/ })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    )
    await waitFor(() => expect(estado.puts.map(([p]) => p)).toContain('/runs/run_alfa/favorita'))
  })

  it('a estrela cheia desmarca, e é DELETE — não outro PUT', async () => {
    marcadas = ['run_beta']
    renderApp('/resultados')
    await screen.findByText('Cenário beta')

    fireEvent.click(estrela('Desmarcar "Cenário beta" como favorita'))
    await waitFor(() => expect(estado.dels).toContain('/runs/run_beta/favorita'))
    expect(estado.puts.length).toBe(0)
  })

  it('falha do servidor devolve a estrela ao estado anterior', async () => {
    // O otimismo so e aceitavel com o desfazer funcionando: sem ele, a tela
    // afirmaria uma marca que o servidor nao tem, e o proximo refetch a apagaria
    // sozinha, sem explicacao nenhuma.
    estado.erroPut = new Error('500')
    renderApp('/resultados')
    await screen.findByText('Cenário alfa')

    fireEvent.click(estrela('Marcar "Cenário alfa" como favorita'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Marcar "Cenário alfa"/ })).toBeTruthy(),
    )
  })
})

describe('filtrar por favoritas', () => {
  it('mostra só as marcadas, e a contagem antecipa quantas são', async () => {
    marcadas = ['run_beta', 'run_gama']
    renderApp('/resultados')
    await screen.findByText('Cenário alfa')

    const filtro = screen.getByRole('button', { name: /Só favoritas/ })
    expect(within(filtro).getByText('2')).toBeTruthy()

    fireEvent.click(filtro)
    await waitFor(() => expect(screen.queryByText('Cenário alfa')).toBeNull())
    expect(screen.getByText('Cenário beta')).toBeTruthy()
    expect(screen.getByText('Cenário gama')).toBeTruthy()
  })

  it('sem nenhuma favorita, a frase ensina como marcar', async () => {
    // "Nenhuma simulação corresponde a ''" mandaria o usuario procurar erro de
    // digitacao num campo em branco — o recorte que esvaziou a lista foi outro.
    renderApp('/resultados')
    await screen.findByText('Cenário alfa')

    fireEvent.click(screen.getByRole('button', { name: /Só favoritas/ }))
    expect(await screen.findByText(/Use a estrela ao lado do nome/)).toBeTruthy()
  })

  it('o filtro combina com a busca, e a frase diz que o recorte é duplo', async () => {
    marcadas = ['run_beta']
    renderApp('/resultados')
    await screen.findByText('Cenário alfa')

    fireEvent.click(screen.getByRole('button', { name: /Só favoritas/ }))
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'gama' } })

    expect(await screen.findByText(/Nenhuma/)).toBeTruthy()
    expect(screen.getByText('gama')).toBeTruthy()
  })
})
