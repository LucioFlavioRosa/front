// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

/**
 * O HISTÓRICO DE UMA FICHA.
 *
 * Estes casos cobrem o caminho da tela: a linha "última alteração" abre o painel,
 * o painel lê do servidor, e o que ele mostra distingue as coisas que a auditoria
 * existe para distinguir — correção de preenchimento, criação de remoção.
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  const dados = await dadosDaUnidade()
  return {
    ...original,
    api: apiFake(api, {
      ...dados,
      // A trilha, como o servidor a devolve. As quatro linhas cobrem os quatro
      // formatos que o painel precisa saber ler.
      '/unidades/u-jacarei/alteracoes?tipo=sub-bacia&fichaId=b2_1_4': {
        alteracoes: [
          {
            tipo: 'sub-bacia',
            fichaId: 'b2_1_4',
            campo: 'fat',
            de: '35.659',
            para: '9.999',
            autor: 'ana@aegea',
            quando: '2026-08-10T14:32:00+00:00',
            origem: 'databricks',
          },
          {
            tipo: 'sub-bacia',
            fichaId: 'b2_1_4',
            campo: 'obra:Rede coletora:qtd',
            de: '2.472,6',
            para: '3.000',
            autor: 'bruno@aegea',
            quando: '2026-08-09T09:05:00+00:00',
            origem: 'regional',
          },
          {
            tipo: 'sub-bacia',
            fichaId: 'b2_1_4',
            campo: 'meta:2030:pct',
            de: null,
            para: '85',
            autor: 'ana@aegea',
            quando: '2026-08-08T11:00:00+00:00',
            origem: 'regional',
          },
          {
            tipo: 'sub-bacia',
            fichaId: 'b2_1_4',
            campo: 'meta:2028:pct',
            de: '70',
            para: null,
            autor: 'ana@aegea',
            quando: '2026-08-08T10:00:00+00:00',
            origem: 'regional',
          },
        ],
        cortado: true,
      },
    }),
  }
})

import { api, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'

beforeEach(() => limparApi(api))
afterEach(cleanup)

/**
 * Abre o painel E ESPERA a resposta chegar.
 *
 * `findByRole` resolve assim que o painel existe — e ele existe em "Carregando…",
 * antes de a query voltar. Esperar por um pedaço do CONTEÚDO é o que torna as
 * asserções seguintes verdadeiras em vez de correrem contra a rede.
 */
async function abrirHistorico(esperar: RegExp = /alterou|corrigiu|Nenhuma alteração/) {
  renderApp('/unidade/u-jacarei/sub-bacias')
  await screen.findByRole('button', { name: 'Salvar sub-bacia' })
  fireEvent.click(await screen.findByRole('button', { name: /última alteração/ }))
  const painel = await screen.findByRole('complementary', { name: 'Histórico de alterações' })
  await within(painel).findAllByText(esperar)  // `All`: o padrão casa várias linhas
  return painel
}

describe('a linha "última alteração" abre o histórico', () => {
  it('a ficha aberta é a que o painel mostra, pelo NOME dela', async () => {
    // O cabeçalho mostra o nome, e cai no id só quando não há nome: quem abriu o
    // histórico já sabe em que ficha está, e um id cru ali seria um passo atrás.
    const painel = await abrirHistorico()
    expect(painel.textContent).toContain('Sub-bacia 1_4')
  })

  it('fecha no × e no Esc', async () => {
    await abrirHistorico()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('complementary', { name: 'Histórico de alterações' })).toBeNull()

    await abrirHistorico()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('complementary', { name: 'Histórico de alterações' })).toBeNull()
  })
})

describe('o que o painel mostra', () => {
  it('traduz o campo para o rótulo que a tela usa, e não a chave crua', async () => {
    const painel = await abrirHistorico()
    // `fat` é a chave; "Receita faturada (12m)" é como a ficha a chama. Os dois
    // saem da MESMA lista (`CAMPOS_DB`), então renomear na tela renomeia aqui.
    expect(painel.textContent).toContain('Receita faturada (12m)')
    expect(painel.textContent).not.toContain('campo: fat')
  })

  it('a obra aparece pelo NOME do componente, não por índice', async () => {
    // `obra:Rede coletora:qtd`. Por índice (`obra:1:qtd`) seria mais curto e não
    // diria nada a quem abre a auditoria seis meses depois.
    const painel = await abrirHistorico()
    expect(painel.textContent).toContain('Rede coletora — quantidade')
    expect(painel.textContent).toContain('2.472,6 → 3.000')
  })

  it('separa CORRIGIU de ALTEROU — é a distinção que a auditoria existe para fazer', async () => {
    // `databricks` é discordar de um número que veio de fora; `regional` é a
    // Regional fazendo o próprio trabalho. Chamar as duas de "alterou" apagaria
    // a diferença.
    const painel = await abrirHistorico()
    expect(painel.textContent).toContain('ana@aegea corrigiu')
    expect(painel.textContent).toContain('bruno@aegea alterou')
  })

  it('criação e remoção não viram "vazio"', async () => {
    // Sem isto, remover uma meta e apagar o número dela ficariam iguais na tela.
    const painel = await abrirHistorico()
    expect(painel.textContent).toContain('criou como 85')
    expect(painel.textContent).toContain('removeu (era 70)')
  })

  it('avisa quando o servidor cortou, em vez de fingir que aquilo é tudo', async () => {
    const painel = await abrirHistorico()
    expect(painel.textContent).toMatch(/mais histórico do que cabe aqui/)
  })
})

describe('ficha sem histórico', () => {
  it('diz que não há registro, e não inventa que nada mudou', async () => {
    // "Nada mudou" e "nunca foi gravada" são coisas diferentes, e a tela não tem
    // como distinguir as duas — então afirma só o que sabe.
    api.respostas['/unidades/u-jacarei/alteracoes?tipo=sub-bacia&fichaId=b2_1_4'] = {
      alteracoes: [],
      cortado: false,
    }
    const painel = await abrirHistorico(/Nenhuma alteração/)
    expect(painel.textContent).toContain('Nenhuma alteração registrada')
  })
})
