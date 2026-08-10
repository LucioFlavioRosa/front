// @vitest-environment jsdom
/**
 * A tela de nova simulação.
 *
 * O foco é o que a tela PROMETE e é fácil quebrar: o bloqueio por pendência de
 * cadastro, a janela derivada do cronograma (nunca digitada), o nome técnico de
 * cada parâmetro visível, e o corpo enviado no POST.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api as estado, apiFake, dadosDaUnidade, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'

let dados: Record<string, unknown> = {}

vi.mock('@/comum/api/client', () => ({
  get api() {
    return apiFake(estado, dados)
  },
  ApiError: class extends Error {},
}))

const PRONTA = { unidadeId: 'u-jacarei', unidadeNome: 'Águas de Jacareí', pendencias: 0 }
const PENDENTE = { unidadeId: 'u-jacarei', unidadeNome: 'Águas de Jacareí', pendencias: 46 }

beforeEach(async () => {
  limparApi(estado)
  dados = {
    ...(await dadosDaUnidade()),
    '/unidades/u-jacarei/prontidao': PRONTA,
  }
})
afterEach(cleanup)

/** Escolhe regional e unidade — o ponto de partida de quase todo caso. */
async function escolherUnidade() {
  const reg = await screen.findByLabelText('Regional')
  // Esperar as OPCOES, e nao o select: `findByLabelText` resolve assim que o
  // elemento existe, antes de a query responder — e um `change` para um value
  // sem `<option>` correspondente e um no-op silencioso.
  await waitFor(() => expect(reg.querySelectorAll('option').length).toBeGreaterThan(1))
  fireEvent.change(reg, { target: { value: 'r-sudeste' } })
  const uni = await screen.findByLabelText('Unidade')
  await waitFor(() => expect(uni.querySelectorAll('option').length).toBeGreaterThan(1))
  fireEvent.change(uni, { target: { value: 'u-jacarei' } })
}

describe('parâmetros e rastreabilidade', () => {
  it('mostra o nome técnico de cada parâmetro, para casar com o notebook', async () => {
    renderApp('/simular')
    expect(await screen.findByText('FOCO_COBERTURA')).toBeTruthy()
    expect(screen.getByText('PENALIDADE_COBERTURA')).toBeTruthy()
    expect(screen.getByText('USAR_CTS')).toBeTruthy()
    expect(screen.getByText('INCLUIR_INDUSTRIAL')).toBeTruthy()
    expect(screen.getByText('ANOS_EXTRA_CONCLUSAO')).toBeTruthy()
    expect(screen.getByText('ETE_FASEADA')).toBeTruthy()
  })

  it('abre com os defaults do notebook', async () => {
    renderApp('/simular')
    // 15 anos de cronograma, comecando em 60 Mi.
    expect(await screen.findByLabelText('Verba de 2026, em milhões')).toHaveProperty('value', '60')
    expect(screen.getByLabelText('Verba de 2040, em milhões')).toHaveProperty('value', '10')
  })
})

describe('orçamento', () => {
  it('a janela de CAPEX é derivada do cronograma, e acompanha a edição', async () => {
    renderApp('/simular')
    // Aparece 2x de proposito: no rodape da secao e no resumo lateral.
    expect((await screen.findAllByText('2026–2040 (15 anos)')).length).toBe(2)

    // Zerar 2040 encurta a janela sem tirar a linha da lista.
    fireEvent.change(screen.getByLabelText('Verba de 2040, em milhões'), {
      target: { value: '0' },
    })
    expect((await screen.findAllByText('2026–2039 (14 anos)')).length).toBe(2)
  })

  it('adicionar ano cria o seguinte ao último, com verba zero', async () => {
    renderApp('/simular')
    fireEvent.click(await screen.findByRole('button', { name: '+ Adicionar ano' }))
    expect(await screen.findByLabelText('Verba de 2041, em milhões')).toBeTruthy()
  })

  it('remover um ano tira o card da lista', async () => {
    renderApp('/simular')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover o ano 2026' }))
    await waitFor(() => expect(screen.queryByLabelText('Verba de 2026, em milhões')).toBeNull())
  })

  it('o teto de execução só aparece com a redistribuição ligada', async () => {
    renderApp('/simular')
    expect(screen.queryByText('TETO_EXECUCAO_ANUAL')).toBeNull()
    fireEvent.click(await screen.findByRole('switch', { name: /REDISTRIBUIR_ORCAMENTO/ }))
    expect(await screen.findByText('TETO_EXECUCAO_ANUAL')).toBeTruthy()
  })
})

describe('bloqueio por cadastro incompleto', () => {
  it('unidade com pendências bloqueia a rodada e explica quantas', async () => {
    dados['/unidades/u-jacarei/prontidao'] = PENDENTE
    renderApp('/simular')
    await escolherUnidade()

    expect(await screen.findByText(/46 campos pendentes impedem a rodada/)).toBeTruthy()
    const iniciar = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
    expect(iniciar.disabled).toBe(true)
    expect(screen.getByText(/Resolva as pendências acima/)).toBeTruthy()
  })

  it('sem unidade escolhida, já começa bloqueada', async () => {
    renderApp('/simular')
    const iniciar = (await screen.findByRole('button', {
      name: 'Iniciar simulação',
    })) as HTMLButtonElement
    expect(iniciar.disabled).toBe(true)
    expect(screen.getByText('Selecione a regional e a unidade.')).toBeTruthy()
  })

  it('cadastro completo libera o botão', async () => {
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })
    expect(screen.getByText(/Cadastro de Águas de Jacareí completo/)).toBeTruthy()
  })
})

describe('avisos que não bloqueiam', () => {
  it('ignorar as metas avisa, mas deixa rodar', async () => {
    renderApp('/simular')
    await escolherUnidade()
    fireEvent.change(await screen.findByLabelText(/Metas de cobertura/), {
      target: { value: 'ignorar' },
    })

    expect(await screen.findByText(/não pode ser usado para aferir cumprimento/)).toBeTruthy()
    const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
    expect(b.disabled).toBe(false)
  })
})

describe('disparo', () => {
  it('envia o corpo com os parâmetros e abre o modal de progresso', async () => {
    // POST /runs responde o run_id; o GET de status responde o progresso.
    estado.respostas['/runs'] = { runId: 'run_novo_0001', status: 'RODANDO' }
    dados['/runs/run_novo_0001/status'] = {
      runId: 'run_novo_0001',
      status: 'RODANDO',
      progresso: 30,
    }
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    await waitFor(() => expect(estado.posts.length).toBe(1))
    const [caminho, corpo] = estado.posts[0]
    expect(caminho).toBe('/runs')
    expect(corpo.unidade_id).toBe('u-jacarei')
    // milhoes viram reais no payload
    expect(corpo.orcamento['2026']).toBe(60_000_000)
    expect(corpo.foco_cobertura).toBe(1)

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText(/continua no servidor/)).toBeTruthy()
  })
})

describe('rodada idêntica que já existe (R5)', () => {
  /** Deixa a tela pronta para disparar, com a unidade escolhida. */
  async function pronta() {
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })
  }

  it('concluída: avisa e oferece o link, em vez de acompanhar o que já terminou', async () => {
    // O servidor deduplica para uma rodada publicada quando o pedido é idêntico,
    // é da mesma pessoa e o cadastro não mudou desde então. Abrir o modal de
    // progresso de algo concluído ontem seria teatro — e antes desta mudança a
    // tela navegava em silêncio, sem dizer que não havia criado nada.
    estado.respostas['/runs'] = {
      runId: 'run_de_ontem',
      status: 'SUCESSO',
      jaExistia: true,
    }
    await pronta()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    expect(await screen.findByText(/Já existe uma simulação idêntica a esta/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Abrir a simulação que já existe/ })
    expect(link.getAttribute('href')).toBe('/resultados/run_de_ontem')
    // Nada a acompanhar: sem modal de progresso. (O `apiFake` não registra GETs,
    // então o polling não dá para afirmar aqui — mas ele só começa com um
    // `runId` no estado, e é justamente esse estado que este caminho não seta.)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('EM VOO continua abrindo o acompanhamento — ali há execução acontecendo', async () => {
    // Duplo clique e retry do navegador caem aqui, e o comportamento certo é o
    // de sempre: o segundo clique leva ao mesmo lugar, acompanhando a rodada.
    estado.respostas['/runs'] = { runId: 'run_em_voo', status: 'RODANDO', jaExistia: true }
    dados['/runs/run_em_voo/status'] = { runId: 'run_em_voo', status: 'RODANDO', progresso: 30 }
    await pronta()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByText(/Já existe uma simulação idêntica/)).toBeNull()
  })

  it('servidor sem `jaExistia` segue o caminho normal', async () => {
    // Compatibilidade com backend anterior: campo ausente é "não sei", e "não
    // sei" não pode virar um aviso afirmando que a rodada já existia.
    estado.respostas['/runs'] = { runId: 'run_novo_0001', status: 'RODANDO' }
    dados['/runs/run_novo_0001/status'] = {
      runId: 'run_novo_0001',
      status: 'RODANDO',
      progresso: 10,
    }
    await pronta()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByText(/Já existe uma simulação idêntica/)).toBeNull()
  })
})

describe('rodada que falha', () => {
  it('status ERRO fecha o "em andamento" e oferece ajustar, não cancelar', async () => {
    // Antes so CANCELADA terminava: uma rodada que falhou ficava "em andamento"
    // para sempre, oferecendo cancelar algo que ja tinha parado.
    estado.respostas['/runs'] = { runId: 'run_x', status: 'RODANDO' }
    dados['/runs/run_x/status'] = {
      runId: 'run_x',
      status: 'ERRO',
      progresso: 40,
      erro: 'sem teto anual de CAPEX',
    }
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    const modal = await screen.findByRole('dialog')
    expect(await within(modal).findByText('A rodada não terminou')).toBeTruthy()
    expect(within(modal).getByText('sem teto anual de CAPEX')).toBeTruthy()
    expect(within(modal).getByRole('button', { name: 'Ajustar parâmetros' })).toBeTruthy()
    expect(within(modal).queryByRole('button', { name: 'Cancelar rodada' })).toBeNull()
  })
})

describe('resumo', () => {
  it('lista os parâmetros na ordem em que serão enviados', async () => {
    renderApp('/simular')
    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    const chaves = within(resumo)
      .getAllByRole('term')
      .map((t) => t.textContent)
    expect(chaves.slice(0, 3)).toEqual(['Unidade', 'Orçamento total', 'Janela de CAPEX'])
    expect(chaves).toContain('Usar CTS')
    expect(chaves).toContain('Solver')
  })
})
