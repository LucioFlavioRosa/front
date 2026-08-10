// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * Caminho de ESCRITA ponta a ponta: editar → Salvar → PUT com a ficha inteira.
 * Prova o contrato de api/escrita.ts contra a tela real, incluindo a trilha de
 * override viajando junto com o dado (e não sendo esquecida no navegador).
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { api, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'
import { ApiError } from '@/comum/api/client'

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

beforeEach(() => limparApi(api))
afterEach(cleanup)

describe('salvar sub-bacia', () => {
  it('manda a ficha inteira, com a trilha de override junto', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Corrige um dado do Databricks (passa pelo modal de confirmação).
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do Databricks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText('Receita faturada (12m)'), {
      target: { value: '9.999' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [caminho, corpo] = api.puts[0]
    expect(caminho).toBe('/unidades/u-jacarei/sub-bacias/b2_1_4')

    // Ficha inteira, não um patch — e SÓ os blocos de dado.
    expect(Object.keys(corpo).sort()).toEqual(['db', 'obrasOverride', 'params'])
    expect(corpo.db.fat).toBe('9.999')

    // O corpo não carrega NADA sobre concorrência, autoria ou trilha. As três
    // coisas moravam aqui e saíram pelo mesmo motivo — o cliente não é fonte
    // confiável sobre si mesmo:
    //
    //   `versao`     o servidor comparava para responder 409 (saiu com o 409)
    //   `overrides`  a trilha vinha PRONTA daqui; hoje o servidor a calcula
    //   auditoria    quem assina a gravação é o token
    //
    // A trilha em si continua existindo, e agora cobre a ficha inteira — só que
    // do outro lado. Ver `tests/test_trilha_cadastro.py` no backend.
    for (const proibido of ['versao', 'overrides', 'atualizadoPor', 'atualizadoEm']) {
      expect(proibido in corpo).toBe(false)
    }
  })

  it('a ficha de outra sub-bacia não leva nada da que ficou para trás', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do Databricks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText('Receita faturada (12m)'), { target: { value: '1' } })

    // Troca de sub-bacia e salva a OUTRA: o corpo é o dela, e nada da primeira
    // viaja junto. (Editar um parâmetro é o que habilita o Salvar dela.)
    fireEvent.click(screen.getByRole('button', { name: /b2_1_3/ }))
    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [caminho, corpo] = api.puts[0]
    expect(caminho).toBe('/unidades/u-jacarei/sub-bacias/b2_1_3')
    expect(corpo.params.preco).toBe('7')
    // A edição da PRIMEIRA ficha não contaminou esta.
    expect(corpo.db.fat).not.toBe('1')
  })

  it('falha do servidor avisa e mantém as edições na tela', async () => {
    api.erroPut = new ApiError(500, 'Server Error', '/x', 'boom')
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    const preco = screen.getByLabelText('Taxa de ligação') as HTMLInputElement
    fireEvent.change(preco, { target: { value: '1.234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    expect(await screen.findByText(/Não foi possível salvar \(erro 500\)/)).toBeTruthy()
    // O que o usuário digitou continua lá — nada é descartado por causa da falha.
    expect((screen.getByLabelText('Taxa de ligação') as HTMLInputElement).value).toBe('1.234')
  })

  it('sessão expirada tem mensagem própria', async () => {
    api.erroPut = new ApiError(401, 'Unauthorized', '/x', '')
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))
    expect(await screen.findByText(/Sua sessão expirou/)).toBeTruthy()
  })
})

describe('o ciclo da auditoria', () => {
  it('o que o PUT devolve aparece na tela, sem recarregar', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // A fixture de `b2_1_4` traz `ana@aegea` como ultima alteracao. Depois de
    // VOCE salvar, a ficha nao pode continuar dizendo isso: o unico aviso que
    // sobrou sobre gravacao concorrente estaria apontando a pessoa errada.
    expect(screen.getByText(/ana@aegea/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))
    await waitFor(() => expect(api.puts).toHaveLength(1))

    // `voce@aegea` e o que o apiFake devolve no PUT — ou seja, veio da RESPOSTA,
    // e nao de um refetch: as mutations nao invalidam query nenhuma.
    expect(await screen.findByText(/voce@aegea/)).toBeTruthy()
    expect(screen.queryByText(/ana@aegea/)).toBeNull()
  })

  it('servidor 2xx SEM auditoria: a ficha fica salva, e a tela nao mente', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    const salvar = () =>
      screen.getByRole('button', { name: 'Salvar sub-bacia' }) as HTMLButtonElement
    await waitFor(() => expect(salvar()).toBeTruthy())

    // Servidor quebrando o contrato: aceita e nao devolve a auditoria nova.
    api.putSemAuditoria = true

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '1.000,00' } })
    fireEvent.click(salvar())
    await waitFor(() => expect(api.puts).toHaveLength(1))

    // 1. O servidor ACEITOU, entao a ficha esta salva. Marca-la como suja faria a
    //    pessoa salvar de novo um dado que ja esta no banco.
    await waitFor(() => expect(salvar().disabled).toBe(true))

    // 2. E a ficha para de creditar a alteracao a `ana@aegea`, que NAO foi quem
    //    acabou de salvar. Sem saber quem foi, a tela nao diz — dizer o nome
    //    errado ensinaria a ignorar o aviso.
    await waitFor(() => expect(screen.queryByText(/ana@aegea/)).toBeNull())
  })

  it('gravar nao deixa a ficha suja: a auditoria nova nao conta como edicao', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    const salvar = () =>
      screen.getByRole('button', { name: 'Salvar sub-bacia' }) as HTMLButtonElement
    await waitFor(() => expect(salvar()).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '1.000,00' } })
    expect(salvar().disabled).toBe(false)
    fireEvent.click(salvar())
    await waitFor(() => expect(api.puts).toHaveLength(1))

    // A auditoria mudou no state, mas ela nao e edicao do usuario: ela nem
    // chega a `assinatura()`, porque o corpo da ficha nao a carrega. Se
    // contasse, o Salvar nunca mais apagaria e a guarda de saida perguntaria
    // "descartar alteracoes?" em toda navegacao.
    await waitFor(() => expect(salvar().disabled).toBe(true))
  })
})

describe('salvar cidade (contrato & metas)', () => {
  it('manda a cidade com as metas e as faixas de paridade dela', async () => {
    renderApp('/unidade/u-jacarei/contrato-metas')
    await screen.findByRole('button', { name: 'Salvar cidade' })

    fireEvent.change(screen.getByLabelText('Fim da concessão'), { target: { value: '2050' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cidade' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [caminho, corpo] = api.puts[0]
    expect(caminho).toMatch(/^\/unidades\/u-jacarei\/contrato\//)
    expect(Object.keys(corpo).sort()).toEqual(['cidade', 'fator', 'metas'])
    // A auditoria sai de dentro de `cidade`: ela muda a cada gravação, e dentro
    // do corpo entraria na assinatura de "ficha suja" — o Salvar ficaria aceso
    // para sempre, num campo que o usuário não digitou.
    expect('atualizadoEm' in corpo.cidade).toBe(false)
    expect('atualizadoPor' in corpo.cidade).toBe(false)
    // As metas enviadas são só as da cidade aberta.
    for (const m of corpo.metas) expect(m.cid).toBe(corpo.cidade.id)
    for (const f of corpo.fator) expect(f.cid).toBe(corpo.cidade.id)
  })
})

describe('salvar ETE', () => {
  it('manda a ficha da ETE selecionada', async () => {
    renderApp('/unidade/u-jacarei/etes')
    await screen.findByRole('button', { name: 'Salvar ETE' })

    fireEvent.change(screen.getByLabelText('CAPEX por módulo'), { target: { value: '1.000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ETE' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [caminho, corpo] = api.puts[0]
    expect(caminho).toBe('/unidades/u-jacarei/etes/e2')
    expect(corpo.ete.id).toBe('e2')
  })
})
