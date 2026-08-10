// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AppProvider } from '@/comum/state/AppContext'
import { ObrasTable } from '@/cadastro/components/ObrasTable'
import { mkObras, type Obra } from '@/cadastro/domain/subbacia'
import { mkObrasCts } from '@/cadastro/domain/cts'
import subbacias from '@/mocks/fixtures/subbacias.json'
import ctsFx from '@/mocks/fixtures/cts.json'

/**
 * As obras saem de uma ficha DE VERDADE, e não mais de `obrasSub()`.
 *
 * Enquanto a base literal existia, `{}` rendia as cinco obras-base e servia de
 * ponto de partida para todo caso aqui. A base saiu (R1/R2): sem payload não há
 * obra nenhuma, que é justamente o comportamento novo — a tela mostra o que o
 * servidor mandou e nada mais. `b1_1_1` é a ficha completa da fixture.
 */
const sobrepor = (
  payload: Record<string, Partial<Obra>>,
  over: Record<string, Partial<Obra>>,
) =>
  Object.fromEntries(
    Object.entries(payload).map(([i, o]) => [i, { ...o, ...(over[i] ?? {}) }]),
  )

const obrasSub = (over: Record<string, Partial<Obra>> = {}) =>
  mkObras(sobrepor(subbacias.subs.b1_1_1.obrasOverride as Record<string, Partial<Obra>>, over))

const obrasCts = (over: Record<string, Partial<Obra>> = {}) =>
  mkObrasCts(
    sobrepor(ctsFx.ctss.cts_b2_1_1.obrasOverride as Record<string, Partial<Obra>>, over),
  )

/**
 * COLUNAS DA TABELA DE OBRAS — o contrato visível do plano de obras.
 *
 * A ordem e o conjunto são os que a simulação consome: componente, quantidade,
 * unidade, preço unitário, CAPEX (ƒ), OPEX, tempo após predecessoras, tempo de
 * execução, e as duas janelas de restrição (obrigatória em / proibida até),
 * mais o WACC.
 */
const COLUNAS = [
  ['Componente', ''],
  ['Quantidade', ''],
  ['Unidade', ''],
  ['Preço unitário', 'R$'],
  ['CAPEX ƒ', 'R$ · calculado'],
  ['OPEX', 'R$/ano'],
  ['Após predecessoras', 'meses'],
  ['Execução', 'meses'],
  ['Obrigatória em', 'ano · 0 · -1'],
  ['Proibida até', 'ano · 0'],
  ['WACC', 'fração'],
]

/** [rótulo, unidade] de cada coluna — as duas linhas do cabeçalho. */
function cabecalhos(): string[][] {
  return screen
    .getAllByRole('columnheader')
    .map((th) => [
      (th.querySelector('[class*=thRotulo]')?.textContent ?? '').replace('?', '').trim(),
      (th.querySelector('[class*=thUnidade]')?.textContent ?? '').trim(),
    ])
}

function renderTabela(obras: Obra[], onChange = vi.fn()) {
  render(
    <AppProvider>
      <ObrasTable obras={obras} onChange={onChange} nota="nota" />
    </AppProvider>,
  )
  return onChange
}

const celulaDe = (rotulo: string, obra: string) =>
  screen.getByLabelText(`${rotulo} — ${obra}`) as HTMLInputElement

/** O Intl pt-BR separa "R$" do número com NBSP (U+00A0), não com espaço comum. */
const NBSP = String.fromCharCode(0xa0)
const texto = (el: HTMLElement) => (el.textContent ?? '').split(NBSP).join(' ')

afterEach(cleanup)

describe('colunas', () => {
  it('estão na ordem que a simulação espera', () => {
    renderTabela(obrasSub())
    expect(cabecalhos()).toEqual(COLUNAS)
  })

  it('a CTS usa exatamente as mesmas colunas', () => {
    renderTabela(obrasCts())
    expect(cabecalhos()).toEqual(COLUNAS)
    // 4 componentes na CTS, contra 5 da sub-bacia.
    expect(screen.getAllByRole('row')).toHaveLength(5) // 1 cabeçalho + 4 obras
  })
})

describe('CAPEX', () => {
  it('é quantidade × preço unitário, e não é campo digitável', () => {
    // Os números são os da FICHA, e não os de uma base literal: `b1_1_1` traz
    // 761,6 ligações a 2.500,14 = 1.904.106,62, arredondado na exibição.
    renderTabela(obrasSub())
    expect(texto(screen.getAllByRole('row')[1])).toContain('R$ 1.904.107')
    expect(screen.queryByLabelText(/CAPEX/)).toBeNull()
  })

  it('acompanha a quantidade digitada', () => {
    // A tabela é controlada: quem recalcula é o store, então o teste passa a
    // obra já com a quantidade nova — é o que a tela recebe depois do onChange.
    renderTabela(obrasSub({ '0': { qtd: '100', preco: '1.000,00' } }))
    expect(texto(screen.getAllByRole('row')[1])).toContain('R$ 100.000')
  })
})

describe('restrições de janela', () => {
  it('tempo após predecessoras vazio aparece pendente', () => {
    renderTabela(obrasSub({ '1': { tPred: '' } }))
    expect(
      celulaDe('Tempo após as predecessoras, em meses', 'Rede coletora').style.border,
    ).toContain('dashed')
  })

  it('editar uma restrição avisa o store com a chave certa', () => {
    const onChange = renderTabela(obrasSub())
    fireEvent.change(celulaDe('Ano em que a obra é obrigatória', 'Coletor tronco'), {
      target: { value: '2027' },
    })
    expect(onChange).toHaveBeenCalledWith(2, 'anoObrig', '2027')
  })
})

describe('leitura da tabela', () => {
  it('o cabeçalho leva rótulo e unidade para o leitor de tela', () => {
    renderTabela(obrasSub())
    const opex = screen.getAllByRole('columnheader')[5]
    // As duas linhas ficam no mesmo <th>: quem usa leitor de tela ouve
    // "OPEX R$/ano" ao entrar na coluna, não só "OPEX".
    expect(opex.textContent).toContain('OPEX')
    expect(opex.textContent).toContain('R$/ano')
  })

  it('campos do mesmo tipo têm a mesma largura (a tabela não fica serrilhada)', () => {
    renderTabela(obrasSub())
    const largura = (rotulo: string) => celulaDe(rotulo, 'Rede coletora').style.width
    expect(largura('Quantidade')).toBe(largura('OPEX em R$ por ano'))
    expect(largura('Tempo após as predecessoras, em meses')).toBe(
      largura('Tempo de execução em meses'),
    )
    expect(largura('Ano em que a obra é obrigatória')).toBe(
      largura('Ano até o qual a obra é proibida'),
    )
  })
})

describe('janelas de execução (códigos)', () => {
  it('a legenda explica o que 0 e -1 significam', () => {
    renderTabela(obrasSub())
    const obrigatoria = screen.getByText(/Obrigatória em:/).parentElement?.textContent ?? ''
    expect(obrigatoria).toContain('não é obrigatória')
    expect(obrigatoria).toContain('obrigatória em qualquer ano')
    const proibida = screen.getByText(/Proibida até:/).parentElement?.textContent ?? ''
    expect(proibida).toContain('não pode começar até esse ano')
  })

  it('a obra-base já vem com 0: sem restrição é uma resposta, não um vazio', () => {
    renderTabela(obrasSub())
    expect(celulaDe('Ano em que a obra é obrigatória', 'Rede coletora').value).toBe('0')
    expect(celulaDe('Ano até o qual a obra é proibida', 'Rede coletora').value).toBe('0')
  })

  it('apagar o código vira pendência — silêncio a simulação não sabe ler', () => {
    renderTabela(obrasSub({ '1': { anoObrig: '' } }))
    expect(celulaDe('Ano em que a obra é obrigatória', 'Rede coletora').style.border).toContain(
      'dashed',
    )
    // O WACC continua sendo o único vazio que significa algo ("usa o médio"):
    // a EEE nasce sem WACC próprio e mesmo assim não é pendência.
    expect(celulaDe('WACC', 'Estação elevatória (EEE)').style.border).not.toContain('dashed')
  })
})

/** Texto da linha de um componente. */
const linhaDe = (nome: string) =>
  screen.getAllByRole('row').find((tr) => tr.textContent?.startsWith(nome))?.textContent ?? ''

describe('obra de terceiros', () => {
  it('ganha selo na linha e a legenda explica a combinação', () => {
    // Coletor tronco com quantidade 0 e 8 meses de execução.
    renderTabela(obrasSub({ '2': { qtd: '0', dur: '8' } }))
    expect(linhaDe('Coletor tronco')).toContain('de terceiros')

    const legenda = screen.getByText(/Obra de terceiros:/).parentElement?.textContent ?? ''
    expect(legenda).toContain('ocupa prazo na sequência')
  })

  it('sem prazo não ganha selo: aí a obra só não entra no plano', () => {
    renderTabela(obrasSub({ '2': { qtd: '0', dur: '0' } }))
    expect(linhaDe('Coletor tronco')).not.toContain('de terceiros')
  })

  it('o selo some quando a obra volta a ter CAPEX', () => {
    renderTabela(obrasSub({ '2': { qtd: '120', dur: '8' } }))
    expect(linhaDe('Coletor tronco')).not.toContain('de terceiros')
  })

  it('vale para qualquer linha, e vem do dado — não de um índice privilegiado', () => {
    // Antes este caso apontava para a linha que "já nasce assim da base": a
    // Linha de recalque, que a base literal criava com quantidade 0 e 15 meses.
    // Sem base, nenhuma linha nasce de nada — a combinação vem do cadastro, e é
    // ela que o teste monta.
    renderTabela(obrasSub({ '4': { qtd: '0', dur: '15' } }))
    expect(linhaDe('Linha de recalque (LR)')).toContain('de terceiros')
  })
})
