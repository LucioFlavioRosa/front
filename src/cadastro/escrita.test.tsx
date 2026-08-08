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

    // Ficha inteira, não um patch.
    expect(Object.keys(corpo).sort()).toEqual([
      'db',
      'obrasOverride',
      'overrides',
      'params',
      'versao',
    ])
    // `versao` é o que dispara o 409 no servidor. Ela viajava no GET e o front
    // simplesmente não a devolvia: a proteção existia no backend e nunca
    // disparava, e o teste de conflito passava porque mockava a resposta 409 em
    // vez de conferir o que o PUT manda.
    expect(corpo.versao).toBe('v-b2_1_4')
    expect(corpo.db.fat).toBe('9.999')

    // A trilha carrega o valor ORIGINAL do servidor, não o penúltimo.
    expect(corpo.overrides).toHaveLength(1)
    expect(corpo.overrides[0]).toMatchObject({
      campo: 'fat',
      valorNovo: '9.999',
      autor: 'Regional/Unidade',
    })
    expect(corpo.overrides[0].valorAntigo).not.toBe('9.999')
  })

  it('só manda os overrides desta ficha', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do Databricks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText('Receita faturada (12m)'), { target: { value: '1' } })

    // Troca de sub-bacia e salva a outra: a trilha da primeira não vai junto.
    // (Editar um parâmetro é o que habilita o Salvar dela — e parâmetro não
    // gera override, então a ficha sai com a trilha vazia.)
    fireEvent.click(screen.getByRole('button', { name: /b2_1_3/ }))
    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [caminho, corpo] = api.puts[0]
    expect(caminho).toBe('/unidades/u-jacarei/sub-bacias/b2_1_3')
    expect(corpo.overrides).toHaveLength(0)
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

describe('o ciclo da versao', () => {
  it('o SEGUNDO salvamento manda a versao que o PRIMEIRO devolveu', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Este e o teste que faltava, e a falta dele deixou passar o bug inteiro.
    // O backend recusa gravacao com versao obsoleta (409). O front lia a versao
    // no GET, mandava no PUT — e DESCARTAVA a resposta, que traz a versao nova.
    // Resultado: a segunda edicao da mesma ficha mandaria de novo a versao do
    // GET, ja obsoleta, e tomaria 409 contra a propria alteracao anterior.
    //
    // O smoke do backend (`dev/smoke_versao.py`) provava o ciclo da API. So um
    // teste de TELA prova que o front fecha o ciclo do lado dele.
    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))
    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, primeiro] = api.puts[0]
    expect(primeiro.versao).toBe('v-b2_1_4') // a que veio do GET

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '2.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))
    await waitFor(() => expect(api.puts).toHaveLength(2))
    const [, segundo] = api.puts[1]
    expect(segundo.versao).toBe('v1') // a que o PRIMEIRO PUT devolveu
  })

  it('gravar nao deixa a ficha suja: a versao nova nao conta como edicao', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    const salvar = () =>
      screen.getByRole('button', { name: 'Salvar sub-bacia' }) as HTMLButtonElement
    await waitFor(() => expect(salvar()).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Taxa de ligação'), { target: { value: '1.000,00' } })
    expect(salvar().disabled).toBe(false)
    fireEvent.click(salvar())
    await waitFor(() => expect(api.puts).toHaveLength(1))

    // A versao mudou no state, mas ela nao e edicao do usuario: `assinatura()`
    // a ignora. Se contasse, o Salvar nunca mais apagaria e a guarda de saida
    // perguntaria "descartar alteracoes?" em toda navegacao.
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
    expect(Object.keys(corpo).sort()).toEqual(['cidade', 'fator', 'metas', 'overrides', 'versao'])
    // A versão vai no TOPO e sai de dentro de `cidade`: duplicada, a cópia
    // aninhada entraria na assinatura de "ficha suja" e o Salvar nunca apagaria.
    expect(corpo.versao).toBe(`v-${corpo.cidade.id}`)
    expect('versao' in corpo.cidade).toBe(false)
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
    expect(corpo.overrides).toEqual([])
  })
})
