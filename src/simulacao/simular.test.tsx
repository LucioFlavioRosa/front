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
  it('não há seletor de fonte das metas, e a tela diz a regra', async () => {
    // O seletor "Ignorar as metas nesta rodada" saiu. Ele nunca funcionou, e
    // quando o bug que o neutralizava foi corrigido ele passou a produzir rodada
    // sem meta nenhuma — que a regra de negócio não admite.
    renderApp('/simular')
    await escolherUnidade()

    expect(screen.queryByLabelText(/Metas de cobertura/)).toBeNull()
    expect(await screen.findByText(/Sempre as do cadastro/)).toBeTruthy()
    expect(screen.getByText(/fora da janela de CAPEX não são cobradas/)).toBeTruthy()
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

describe('por que a rodada está esperando', () => {
  /** Deixa a tela pronta e dispara, com o status que o caso quer observar. */
  async function disparar(status: Record<string, unknown>) {
    estado.respostas['/runs'] = { runId: 'run_fila', status: 'PENDENTE' }
    dados['/runs/run_fila/status'] = { runId: 'run_fila', progresso: 0, ...status }
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))
    return screen.findByRole('dialog')
  }

  it('mostra o motivo que o servidor mandou, com o tempo decorrido', async () => {
    // A etapa ("Lendo dados da unidade…") diz o que o job FARIA; ela não
    // distingue "vai começar em instantes" de "não há executor nenhum de pé".
    const modal = await disparar({
      status: 'PENDENTE',
      pedidaEm: new Date(Date.now() - 90_000).toISOString(),
      fila: {
        vivos: 2,
        capacidade: 4,
        ocupadas: 4,
        posicao: 2,
        motivo: 'Todas as 4 vagas estão ocupadas. Há 2 simulação(ões) na frente desta.',
        atencao: false,
      },
    })

    const linha = await within(modal).findByText(/Todas as 4 vagas estão ocupadas/)
    expect(linha.textContent).toMatch(/pedida há 1 min/)
  })

  it('espera longa com motivo tranquilo também vira alerta', async () => {
    // "Deve começar em instantes" há vinte minutos é o caso que ninguém reporta,
    // porque a frase continua parecendo normal — e `atencao` vem `false`, já que
    // do lado do servidor há vaga livre mesmo.
    const modal = await disparar({
      status: 'PENDENTE',
      pedidaEm: new Date(Date.now() - 20 * 60_000).toISOString(),
      fila: {
        vivos: 1,
        capacidade: 4,
        ocupadas: 0,
        posicao: 0,
        motivo: 'Há 4 vaga(s) livre(s) — deve começar em instantes.',
        atencao: false,
      },
    })

    const linha = await within(modal).findByText(/deve começar em instantes/)
    expect(linha.className).toMatch(/filaAtencao/)
  })

  it('servidor sem o bloco `fila` não mostra linha nenhuma', async () => {
    // Compatibilidade: campo ausente é "não sei", e "não sei" não pode virar uma
    // frase afirmando qualquer coisa sobre a fila.
    const modal = await disparar({ status: 'PENDENTE', progresso: 5 })
    expect(await within(modal).findByText(/Ainda não começou/)).toBeTruthy()
    expect(within(modal).queryByText(/vaga/i)).toBeNull()
    expect(within(modal).queryByText(/pedida há/)).toBeNull()
  })

  it('a etapa não diz "Lendo dados" enquanto a rodada está na fila', async () => {
    // A contradição que isto impede: a etapa anunciando leitura de dados duas
    // linhas acima do motivo dizendo que todas as vagas estão ocupadas.
    const modal = await disparar({
      status: 'PENDENTE',
      progresso: 0,
      fila: {
        vivos: 1,
        capacidade: 1,
        ocupadas: 1,
        posicao: 0,
        motivo: 'A única vaga está ocupada. Esta é a próxima a entrar.',
        atencao: false,
      },
    })

    expect(await within(modal).findByText(/A única vaga está ocupada/)).toBeTruthy()
    expect(within(modal).queryByText(/Lendo dados da unidade/)).toBeNull()
    expect(within(modal).getByText(/Ainda não começou/)).toBeTruthy()
  })

  it('assim que passa a RODANDO, a etapa volta a nomear o trabalho', async () => {
    const modal = await disparar({ status: 'RODANDO', progresso: 5 })
    expect(await within(modal).findByText(/Lendo dados da unidade/)).toBeTruthy()
  })
})

describe('cancelar a rodada', () => {
  it('o botão chama o endpoint e some quando a rodada volta CANCELADA', async () => {
    // Esteve fora da tela enquanto o endpoint respondia 501: botão que sempre dá
    // erro ensina o usuário a desconfiar da tela inteira. Voltou com a migração
    // 008, e sob `!terminal` — ver CONTRATO.md §4.4.
    estado.respostas['/runs'] = { runId: 'run_c', status: 'RODANDO' }
    dados['/runs/run_c/status'] = { runId: 'run_c', status: 'RODANDO', progresso: 20 }
    renderApp('/simular')
    await escolherUnidade()
    await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Iniciar simulação' }) as HTMLButtonElement
      expect(b.disabled).toBe(false)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulação' }))

    const modal = await screen.findByRole('dialog')
    fireEvent.click(await within(modal).findByRole('button', { name: 'Cancelar rodada' }))
    // A próxima leitura do status já responde CANCELADA — e é ELA que fecha o
    // modal, não o clique. Fechar no otimismo mostraria a tela liberada enquanto
    // o cluster ainda processaria, se o cancelamento tivesse falhado; é por isso
    // que o `useCancelarRodada` invalida o status em vez de a tela se fechar.
    dados['/runs/run_c/status'] = { runId: 'run_c', status: 'CANCELADA', progresso: 20 }

    await waitFor(() => expect(estado.posts.map(([p]) => p)).toContain('/runs/run_c/cancelar'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
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

describe('o tamanho da unidade no resumo', () => {
  /**
   * Ele responde "que unidade é essa?" ANTES de rodar. Sem isto, o porte do
   * problema só aparecia depois — e escolher entre a Serrana (710 obras) e a
   * Leste (11.525) era escolher no escuro.
   *
   * Sai do `resumo` da UNIDADE, e não de um campo em `/prontidao`. O campo em
   * `/prontidao` existiu, o backend nunca o implementou, e a linha não aparecia
   * em produção — o mock era o único lugar onde ela funcionava.
   */
  /** Um `resumo` completo, com só o que o caso quer mudar por cima. */
  const RESUMO = {
    cidades: 11,
    sistemas: 8,
    subBacias: 9,
    cts: 3,
    etes: 2,
    obras: 34,
    obrasAegea: 30,
    obrasTerceiros: 4,
    semObra: 23,
  }

  /** Troca o `resumo` da unidade que o select carrega. */
  function comResumo(resumo: Record<string, number>) {
    const u = (dados['/regionais/r-sudeste/unidades'] as { id: string }[])[0]
    dados['/regionais/r-sudeste/unidades'] = [{ ...u, resumo }]
  }

  it('aparece assim que a unidade é escolhida, com as cinco contagens', async () => {
    comResumo(RESUMO)
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    expect(
      await within(resumo).findByText('11 cidades · 8 sistemas · 9 sub-bacias · 3 CTS · 2 ETEs'),
    ).toBeTruthy()
  })

  it('as obras vêm nas três categorias, e não num total só', async () => {
    // Um numero so escondia os dois extremos: o que a Aegea paga e as linhas que
    // nao sao obra nenhuma. Na Leste eram 4.830 de 11.525.
    comResumo(RESUMO)
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    expect(await within(resumo).findByText('30 Aegea · 4 de terceiros · 23 sem obra')).toBeTruthy()
  })

  it('vem logo depois da unidade, e não no fim da lista', async () => {
    comResumo(RESUMO)
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    await within(resumo).findByText(/sub-bacias/)
    const chaves = within(resumo)
      .getAllByRole('term')
      .map((t) => t.textContent)
    expect(chaves.slice(0, 3)).toEqual(['Unidade', 'Tamanho', 'Obras'])
  })

  it('separa o milhar, porque 11525 não se lê', async () => {
    comResumo({ ...RESUMO, subBacias: 2305, obrasAegea: 6135, obrasTerceiros: 560, semObra: 4830 })
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    expect(await within(resumo).findByText(/6\.135 Aegea/)).toBeTruthy()
    expect(within(resumo).getByText(/4\.830 sem obra/)).toBeTruthy()
  })

  it('unidade sem CTS mostra "0 CTS", em vez de omitir', async () => {
    // A CTS e esparsa. Omitir a palavra deixaria no ar se a unidade nao tem
    // nenhuma ou se a tela nao sabe — e sem CTS, ligar USAR_CTS nao muda nada.
    comResumo({ ...RESUMO, cts: 0 })
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    expect(await within(resumo).findByText(/0 CTS/)).toBeTruthy()
  })

  it('singular nao vira "1 cidades"', async () => {
    // Descuido que faz duvidar do resto dos numeros numa tela que se le o dia
    // inteiro — e o backend cometia o mesmo em "Todas as 1 vagas estao ocupadas".
    comResumo({ ...RESUMO, cidades: 1, sistemas: 1, subBacias: 1, cts: 1, etes: 1 })
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    expect(
      await within(resumo).findByText('1 cidade · 1 sistema · 1 sub-bacia · 1 CTS · 1 ETE'),
    ).toBeTruthy()
  })

  it('servidor que manda `resumo` SEM as três categorias não quebra a tela', async () => {
    // Backend anterior a esta mudanca: o bloco vem, as tres nao. Sem a guarda,
    // `toLocaleString(undefined)` derruba a pagina pelo error boundary — pior que
    // a linha faltar, que foi o que aconteceu com o `tamanho`.
    const { obrasAegea: _a, obrasTerceiros: _t, semObra: _s, ...antigo } = RESUMO
    comResumo(antigo)
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    const chaves = within(resumo)
      .getAllByRole('term')
      .map((t) => t.textContent)
    expect(chaves).toContain('Tamanho')
    expect(chaves).not.toContain('Obras')
  })

  it('servidor que NÃO manda `resumo` não quebra a tela', async () => {
    // Contrato antigo: a unidade vem sem o bloco. A linha some e o resto do resumo
    // continua inteiro — sem a guarda, `textoDoTamanho` desestruturaria
    // `undefined` e derrubaria a página pelo error boundary, que é muito pior que
    // uma linha a menos.
    const u = (dados['/regionais/r-sudeste/unidades'] as Record<string, unknown>[])[0]
    const { resumo: _fora, ...semResumo } = u
    dados['/regionais/r-sudeste/unidades'] = [semResumo]
    renderApp('/simular')
    await escolherUnidade()

    const resumo = await screen.findByRole('complementary', { name: 'Resumo da rodada' })
    await within(resumo).findByText('Águas de Jacareí')
    const chaves = within(resumo)
      .getAllByRole('term')
      .map((t) => t.textContent)
    expect(chaves).not.toContain('Tamanho')
    expect(chaves).toContain('Solver')
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
