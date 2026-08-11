// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * SALVAR INTELIGENTE + RASCUNHO LOCAL.
 *
 * Dois comportamentos que so existem juntos: o app sabe o que ainda nao foi
 * para o servidor (por isso o Salvar acende e apaga, e a saida avisa) e guarda
 * essa edicao na sessao do navegador (por isso um F5 nao apaga a ficha).
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { api, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'

const salvarSub = () =>
  screen.getByRole('button', { name: 'Salvar sub-bacia' }) as HTMLButtonElement
const taxa = () => screen.getByLabelText('Taxa de ligação') as HTMLInputElement

beforeEach(() => limparApi(api))
afterEach(cleanup)

describe('Salvar só quando há o que salvar', () => {
  it('começa desabilitado, acende ao editar e apaga de novo depois de gravar', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    expect(salvarSub().disabled).toBe(true)
    expect(screen.getByText('Salvo')).toBeTruthy()

    fireEvent.change(taxa(), { target: { value: '1.234' } })
    expect(salvarSub().disabled).toBe(false)
    expect(screen.getByText('Alterações não salvas')).toBeTruthy()

    fireEvent.click(salvarSub())
    await waitFor(() => expect(api.puts).toHaveLength(1))
    await waitFor(() => expect(salvarSub().disabled).toBe(true))
    expect(screen.getByText('Salvo')).toBeTruthy()
  })

  it('desfazer a digitação (voltar ao valor original) apaga o Salvar de novo', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    const original = taxa().value

    fireEvent.change(taxa(), { target: { value: '999' } })
    expect(salvarSub().disabled).toBe(false)

    fireEvent.change(taxa(), { target: { value: original } })
    expect(salvarSub().disabled).toBe(true)
  })

  it('o header conta as fichas pendentes de gravação', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    expect(screen.queryByText(/não salva/)).toBeNull()

    fireEvent.change(taxa(), { target: { value: '7' } })
    expect(screen.getByText(/1 não salva$/)).toBeTruthy()

    // Outra sub-bacia editada = segunda ficha pendente.
    fireEvent.click(screen.getByRole('button', { name: /b2_1_3/ }))
    fireEvent.change(taxa(), { target: { value: '8' } })
    expect(screen.getByText(/2 não salvas$/)).toBeTruthy()
  })
})

describe('rascunho local (sessionStorage)', () => {
  it('recarregar a tela antes de salvar não perde a edição', async () => {
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '4.321' } })

    // Desmontar e montar de novo é o F5: sem rascunho, a ficha voltaria do
    // servidor e a digitação sumiria sem aviso.
    tela.unmount()
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    expect(taxa().value).toBe('4.321')
    expect(salvarSub().disabled).toBe(false)
    expect(await screen.findByText(/Rascunho desta sessão recuperado — 1 ficha/)).toBeTruthy()
  })

  it('depois de gravar não há rascunho a recuperar', async () => {
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '4.321' } })
    fireEvent.click(salvarSub())
    await waitFor(() => expect(api.puts).toHaveLength(1))
    await waitFor(() => expect(salvarSub().disabled).toBe(true))

    tela.unmount()
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // O valor volta do servidor (o mock não persiste), sem aviso de rascunho.
    expect(taxa().value).not.toBe('4.321')
    expect(screen.queryByText(/Rascunho desta sessão recuperado/)).toBeNull()
  })
})

describe('guarda de saída', () => {
  it('fechar a aba com edição pendente é barrado pelo navegador', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Sem edição, nada de aviso: recarregar tem de continuar barato.
    const limpo = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(limpo)
    expect(limpo.defaultPrevented).toBe(false)

    fireEvent.change(taxa(), { target: { value: '3' } })
    const sujo = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(sujo)
    expect(sujo.defaultPrevented).toBe(true)
  })

  it('sair da unidade com ficha pendente pede confirmação; cancelar mantém a tela', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '5' } })

    fireEvent.click(screen.getByRole('button', { name: '▾ trocar unidade' }))
    expect(await screen.findByText('Sair desta unidade com edições não salvas?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Continua na ficha, com o que foi digitado.
    expect(taxa().value).toBe('5')
  })

  it('confirmar sai da unidade', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '5' } })

    fireEvent.click(screen.getByRole('button', { name: '▾ trocar unidade' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sair mesmo assim' }))

    expect(await screen.findByText('Onde você vai trabalhar?')).toBeTruthy()
  })

  it('trocar de grupo dentro da mesma unidade não pergunta nada', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '5' } })

    // Voltar ao hub da unidade: mesmo estado, nada a perder.
    fireEvent.click(screen.getByRole('button', { name: 'Águas de Jacareí' }))
    expect(await screen.findByText('Já preencheu na planilha Excel?')).toBeTruthy()
    expect(screen.queryByText('Sair desta unidade com edições não salvas?')).toBeNull()
  })
})

describe('hierarquia — edição sem Salvar', () => {
  /** Entra no modo de correção do card unidade-regional e muda o nome da regional. */
  async function corrigirRegional(valor: string) {
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Editar dados do Databricks' }))[0],
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText(/Nome da regional/), { target: { value: valor } })
  }

  it('entra no rascunho mesmo sem ficha suja (a tela promete que sobrevive ao F5)', async () => {
    const tela = renderApp('/unidade/u-jacarei/hierarquia')
    await corrigirRegional('Sudeste corrigida')

    // Não há ficha suja: a hierarquia não tem Salvar nem entra em `sujas`.
    expect(screen.queryByText(/não salva/)).toBeNull()

    tela.unmount()
    renderApp('/unidade/u-jacarei/hierarquia')
    // Volta em modo de leitura (o card sai do modo de correção), então o valor
    // recuperado aparece como texto, não como input.
    // (aparece no card unidade-regional e na cadeia hierárquica do sistema)
    expect((await screen.findAllByText('Sudeste corrigida')).length).toBeGreaterThan(0)
    expect(
      await screen.findByText(/Rascunho desta sessão recuperado — correções na hierarquia/),
    ).toBeTruthy()
  })

  it('fechar a aba e sair da unidade avisam, porque o rascunho morre com a aba', async () => {
    renderApp('/unidade/u-jacarei/hierarquia')
    await corrigirRegional('Outra regional')

    const evento = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '▾ trocar unidade' }))
    expect(await screen.findByText('Sair desta unidade com edições não salvas?')).toBeTruthy()
    expect(screen.getByText(/nenhum backend recebe ainda/)).toBeTruthy()
  })
})

/** O payload de sub-bacias como se outra pessoa tivesse gravado `fat`. */
async function comOutroFat(fat: string) {
  const subbacias = (await import('@/mocks/fixtures/subbacias.json')).default
  return {
    ...subbacias,
    subs: {
      ...subbacias.subs,
      b2_1_4: { ...subbacias.subs.b2_1_4, db: { ...subbacias.subs.b2_1_4.db, fat } },
    },
  }
}

describe('rascunho feito sobre dado que já mudou', () => {
  it('avisa e oferece a versão do servidor', async () => {
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '1.000' } })
    tela.unmount()

    // Outra pessoa mexeu na mesma unidade enquanto o rascunho dormia.
    api.respostas['/unidades/u-jacarei/sub-bacias'] = await comOutroFat('99.999')

    renderApp('/unidade/u-jacarei/sub-bacias')
    // Sem versão por ficha, o que dá para conferir é a impressão do payload.
    expect(await screen.findByText('O cadastro mudou no servidor desde este rascunho')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Recarregar do servidor' }))
    // O rascunho vai embora e entra a versão do servidor — inclusive o valor
    // que a outra pessoa gravou.
    await waitFor(() => expect(taxa().value).not.toBe('1.000'))
    expect(await screen.findByText('99.999')).toBeTruthy()
  })

  it('o que foi descartado não volta pelo rascunho', async () => {
    // Descartar remonta o provider, e o provider antigo grava uma última vez ao
    // desmontar: sem cuidado, esse flush ressuscitava o rascunho descartado na
    // próxima abertura da unidade. (Este caso vinha do bloco do 409, que saiu
    // com o 409 de ficha — a armadilha é do recarregar, não do conflito, e por
    // isso mudou de gatilho em vez de sumir.)
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    const doServidor = taxa().value
    fireEvent.change(taxa(), { target: { value: '3.333' } })
    tela.unmount()

    api.respostas['/unidades/u-jacarei/sub-bacias'] = await comOutroFat('99.999')
    const segunda = renderApp('/unidade/u-jacarei/sub-bacias')
    fireEvent.click(await screen.findByRole('button', { name: 'Recarregar do servidor' }))
    await waitFor(() => expect(taxa().value).toBe(doServidor))

    segunda.unmount()
    delete api.respostas['/unidades/u-jacarei/sub-bacias']
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    expect(taxa().value).toBe(doServidor)
    expect(screen.queryByText(/Rascunho desta sessão recuperado/)).toBeNull()
  })

  it('cancelar mantém a edição na tela', async () => {
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '2.222' } })
    tela.unmount()

    api.respostas['/unidades/u-jacarei/sub-bacias'] = await comOutroFat('99.999')
    renderApp('/unidade/u-jacarei/sub-bacias')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    // Continuar editando por cima é escolha do usuário, e a tela a respeita.
    expect(taxa().value).toBe('2.222')
    expect(salvarSub().disabled).toBe(false)
  })

  it('rascunho sobre dado igual não incomoda ninguém', async () => {
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '1.000' } })
    tela.unmount()

    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    expect(screen.queryByText('O cadastro mudou no servidor desde este rascunho')).toBeNull()
    expect(taxa().value).toBe('1.000')
  })
})

describe('rascunho gravado por uma versão anterior do app', () => {
  it('é descartado em vez de hidratar um estado sem os campos novos', async () => {
    // Era o bug: o rascunho v2 não tinha o de-para sub-bacia → cidade. Ele
    // hidratava um estado que `seeded()` dava por completo, o SEED_SUBS não
    // rodava de novo (a fatia não estava vazia) e a tela ficava sem saber a
    // régua da meta — os campos de população sumiam pelo resto da sessão.
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    expect(screen.getByLabelText('População — universo')).toBeTruthy()
    fireEvent.change(taxa(), { target: { value: '1.500' } })
    tela.unmount()

    // Rebaixa o rascunho ao formato antigo, como ficaria na aba de quem já
    // estava com o app aberto quando a versão nova subiu.
    const chave = Object.keys(sessionStorage).find((k) => k.includes('rascunho'))!
    const envelope = JSON.parse(sessionStorage.getItem(chave)!)
    delete envelope.estado.cidadeDaSub
    sessionStorage.setItem(chave, JSON.stringify(envelope))

    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // O rascunho velho vai embora (a edição volta do servidor) e a tela
    // funciona: é melhor perder o rascunho do que ficar com a ficha incompleta.
    expect(screen.getByLabelText('População — universo')).toBeTruthy()
    expect(taxa().value).not.toBe('1.500')
  })
})

describe('rascunho com formato antigo (chave nova faltando)', () => {
  it('é descartado mesmo se a VERSÃO não tiver sido subida', async () => {
    // Este é o cinto de segurança: a versão do rascunho depende de alguém
    // lembrar de subir, e já foi esquecida duas vezes. Aqui o envelope tem a
    // versão CERTA e mesmo assim está velho por dentro — sem `vazInd`, o
    // cálculo de pendência estouraria no primeiro `.trim()`.
    const tela = renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(taxa(), { target: { value: '2.222' } })
    tela.unmount()

    const chave = Object.keys(sessionStorage).find((k) => k.includes('rascunho'))!
    const envelope = JSON.parse(sessionStorage.getItem(chave)!)
    for (const ficha of Object.values(envelope.estado.subs) as Array<Record<string, never>>) {
      delete (ficha.params as Record<string, unknown>).vazInd
      delete (ficha.db as Record<string, unknown>).ligUInd
    }
    sessionStorage.setItem(chave, JSON.stringify(envelope))

    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // A tela abre inteira (não estourou) e o dado voltou do servidor.
    expect(screen.getByLabelText('Vazão nova industrial')).toBeTruthy()
    expect(taxa().value).not.toBe('2.222')
  })
})
