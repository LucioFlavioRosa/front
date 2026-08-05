// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AppProvider } from '../state/AppContext'
import { ObrasTable } from './ObrasTable'
import { mkObras, type Obra } from '../domain/subbacia'
import { mkObrasCts } from '../domain/cts'

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
    renderTabela(mkObras({}))
    expect(cabecalhos()).toEqual(COLUNAS)
  })

  it('a CTS usa exatamente as mesmas colunas', () => {
    renderTabela(mkObrasCts({}))
    expect(cabecalhos()).toEqual(COLUNAS)
    // 4 componentes na CTS, contra 5 da sub-bacia.
    expect(screen.getAllByRole('row')).toHaveLength(5) // 1 cabeçalho + 4 obras
  })
})

describe('CAPEX', () => {
  it('é quantidade × preço unitário, e não é campo digitável', () => {
    renderTabela(mkObras({}))
    // Ligação de esgoto: 244 × 2.497,70 = 609.438,80 → arredondado na exibição.
    expect(texto(screen.getAllByRole('row')[1])).toContain('R$ 609.439')
    expect(screen.queryByLabelText(/CAPEX/)).toBeNull()
  })

  it('acompanha a quantidade digitada', () => {
    // A tabela é controlada: quem recalcula é o store, então o teste passa a
    // obra já com a quantidade nova — é o que a tela recebe depois do onChange.
    renderTabela(mkObras({ '0': { qtd: '100', preco: '1.000,00' } }))
    expect(texto(screen.getAllByRole('row')[1])).toContain('R$ 100.000')
  })
})

describe('restrições de janela', () => {
  it('tempo após predecessoras vazio aparece pendente', () => {
    renderTabela(mkObras({ '1': { tPred: '' } }))
    expect(
      celulaDe('Tempo após as predecessoras, em meses', 'Rede coletora').style.border,
    ).toContain('dashed')
  })

  it('editar uma restrição avisa o store com a chave certa', () => {
    const onChange = renderTabela(mkObras({}))
    fireEvent.change(celulaDe('Ano em que a obra é obrigatória', 'Coletor tronco'), {
      target: { value: '2027' },
    })
    expect(onChange).toHaveBeenCalledWith(2, 'anoObrig', '2027')
  })
})

describe('leitura da tabela', () => {
  it('o cabeçalho leva rótulo e unidade para o leitor de tela', () => {
    renderTabela(mkObras({}))
    const opex = screen.getAllByRole('columnheader')[5]
    // As duas linhas ficam no mesmo <th>: quem usa leitor de tela ouve
    // "OPEX R$/ano" ao entrar na coluna, não só "OPEX".
    expect(opex.textContent).toContain('OPEX')
    expect(opex.textContent).toContain('R$/ano')
  })

  it('campos do mesmo tipo têm a mesma largura (a tabela não fica serrilhada)', () => {
    renderTabela(mkObras({}))
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
    renderTabela(mkObras({}))
    const obrigatoria = screen.getByText(/Obrigatória em:/).parentElement?.textContent ?? ''
    expect(obrigatoria).toContain('não é obrigatória')
    expect(obrigatoria).toContain('obrigatória em qualquer ano')
    const proibida = screen.getByText(/Proibida até:/).parentElement?.textContent ?? ''
    expect(proibida).toContain('não pode começar até esse ano')
  })

  it('a obra-base já vem com 0: sem restrição é uma resposta, não um vazio', () => {
    renderTabela(mkObras({}))
    expect(celulaDe('Ano em que a obra é obrigatória', 'Rede coletora').value).toBe('0')
    expect(celulaDe('Ano até o qual a obra é proibida', 'Rede coletora').value).toBe('0')
  })

  it('apagar o código vira pendência — silêncio a simulação não sabe ler', () => {
    renderTabela(mkObras({ '1': { anoObrig: '' } }))
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
    renderTabela(mkObras({ '2': { qtd: '0', dur: '8' } }))
    expect(linhaDe('Coletor tronco')).toContain('de terceiros')

    const legenda = screen.getByText(/Obra de terceiros:/).parentElement?.textContent ?? ''
    expect(legenda).toContain('ocupa prazo na sequência')
  })

  it('sem prazo não ganha selo: aí a obra só não entra no plano', () => {
    renderTabela(mkObras({ '2': { qtd: '0', dur: '0' } }))
    expect(linhaDe('Coletor tronco')).not.toContain('de terceiros')
  })

  it('o selo some quando a obra volta a ter CAPEX', () => {
    renderTabela(mkObras({ '2': { qtd: '120', dur: '8' } }))
    expect(linhaDe('Coletor tronco')).not.toContain('de terceiros')
  })

  it('vale para qualquer linha, inclusive a que já vem assim da base', () => {
    // Linha de recalque nasce com quantidade 0 e 15 meses de execução.
    renderTabela(mkObras({}))
    expect(linhaDe('Linha de recalque (LR)')).toContain('de terceiros')
  })
})
