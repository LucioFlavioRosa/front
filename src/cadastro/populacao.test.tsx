// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * A RÉGUA DA META MANDA NA FICHA.
 *
 * A meta do contrato é medida em ligações, economias OU população, e quem
 * escolhe é a cidade (Grupo 02). Ligações e economias vêm do Databricks e ficam
 * sempre visíveis, com destaque no trio que é a régua. População é diferente:
 * é dado que a Regional informa, só aparece quando é ela a régua — e, por ser
 * campo do usuário, conta pendência. É essa contagem que impede o cadastro de
 * parecer completo com o denominador da meta em branco.
 *
 * No mock: Rio das Ostras (c6) mede por população; Maricá (c1) e Búzios (c9),
 * por ligações.
 */

vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake, dadosDaUnidade } = await import('@/testes/apiFake')
  return { ...original, api: apiFake(api, await dadosDaUnidade()) }
})

import { api, limparApi } from '@/testes/apiFake'
import { renderApp } from '@/testes/renderApp'

/** Texto que marca, só para leitor de tela, o trio que é a régua da meta. */
const SELO = '— régua da meta desta cidade'

/** Rótulo sem o selo do leitor de tela e sem o "?" do dicionário. */
const limpo = (texto?: string | null) => (texto ?? '').replace(SELO, '').replace('?', '').trim()

/** Rótulo de uma célula do card do Databricks (ignorando o selo, quando houver). */
function rotuloDb(rotulo: string): HTMLElement {
  return screen.getByText(
    (_conteudo, el) =>
      String(el?.className ?? '').includes('fieldRotulo') && limpo(el?.textContent) === rotulo,
  )
}

/** Valor exibido numa célula do card do Databricks. */
function celula(rotulo: string): string {
  const label = rotuloDb(rotulo)
  return (label.parentElement?.textContent ?? '').replace(label.textContent ?? '', '').trim()
}

/** A célula está marcada como parte da régua da meta desta cidade? */
function ehRegua(rotulo: string): boolean {
  return (rotuloDb(rotulo).textContent ?? '').includes(SELO)
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement

/** Existe célula travada (Databricks) com este rótulo? */
function temCelulaDb(rotulo: string): boolean {
  return !!screen.queryByText(
    (_conteudo, el) =>
      String(el?.className ?? '').includes('fieldRotulo') && limpo(el?.textContent) === rotulo,
  )
}

/** Chip de pendências DA FICHA aberta (o do cabeçalho do grupo é outro). */
const chipDaFicha = () =>
  screen.getByText(
    (_conteudo, el) => String(el?.className ?? '').includes('_chip_') && !!el?.textContent,
  )

beforeEach(() => limparApi(api))
afterEach(cleanup)

describe('base comercial (Databricks)', () => {
  it('traz ligações e economias completas, sem população', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // b2_1_4: 396 economias no universo, 127 atendidas → 269 pelas obras.
    expect(celula('Economias novas (obras)')).toBe('269')
    expect(celula('Ligações novas (obras)')).toBe('244')
    // População não é dado do Databricks: não tem célula travada aqui.
    expect(temCelulaDb('População — universo')).toBe(false)
  })

  it('destaca o trio que é a régua da cidade', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Rio das Ostras mede por população: nenhum dos dois trios travados é a régua.
    expect(ehRegua('Ligações — universo')).toBe(false)
    expect(ehRegua('Economias — universo')).toBe(false)
    expect(screen.getByText(/é medida em/)).toBeTruthy()

    // Maricá mede por ligações — aí o destaque aparece no card.
    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'b1_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /b1_1_1/ }))
    expect(ehRegua('Ligações — universo')).toBe(true)
    expect(ehRegua('Economias — universo')).toBe(false)
  })
})

describe('população — campo do usuário, só na régua certa', () => {
  it('aparece na sub-bacia da cidade que mede por população, com o ƒ calculado', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    expect(campo('População — universo').value).toBe('1.267')
    expect(campo('População atendida hoje').value).toBe('406')
    expect(screen.getByLabelText('População nova (obras)').textContent).toContain('861')
    expect(screen.getByText(/mede a meta por população/)).toBeTruthy()
    // A nota do card travado precisa APONTAR para o bloco: dizer só "é medida em
    // população" mandava procurar o campo no card errado. E aponta para CIMA:
    // o bloco passou a vir antes da base comercial, porque o card tem 13 campos
    // e "logo abaixo" mandava rolar uma tela inteira — o dono do produto
    // procurou, nao achou, e reportou como campo faltando.
    expect(screen.getByText(/logo acima/)).toBeTruthy()
  })

  it('fica BLOQUEADO — não some — quando a cidade mede por ligações', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'b1_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /b1_1_1/ }))

    // Antes o bloco sumia. Sumir ensinava que o campo NAO EXISTE, e ele existe:
    // a regua muda por aditivo de contrato, e no dia que virar populacao o
    // numero que ja estava ali continua valendo. Some-lo tambem escondia do
    // usuario que havia dado guardado que ele nunca poderia conferir.
    const universo = screen.getByLabelText('População — universo') as HTMLInputElement
    expect(universo).toBeTruthy()
    expect(universo.disabled).toBe(true)
    expect(screen.getByLabelText('População nova (obras)')).toBeTruthy()

    // E diz POR QUE esta bloqueado. Campo cinza sem explicacao vira suporte.
    expect(screen.getByText(/mede a meta por ligações/)).toBeTruthy()
  })

  it('bloqueado não conta pendência: a tela não cobra o que ela mesma impede', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'b1_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /b1_1_1/ }))

    // Esta sub-bacia TEM populacao cadastrada (30.854) mesmo medindo por
    // ligacoes. O valor continua a vista: e exatamente o dado que sumia quando o
    // bloco era escondido, e que volta a valer se a regua mudar por aditivo.
    const universo = screen.getByLabelText('População — universo') as HTMLInputElement
    expect(universo.value).toBe('30.854')

    // Bloqueado nao pinta de ambar. O ambar promete "preencha isto", e num campo
    // que a tela impede de editar isso seria uma cobranca impossivel de atender.
    expect(universo.style.border).not.toContain('dashed')
  })

  it('o ƒ recalcula ao digitar e vira travessão com um lado vazio', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    const novo = () => screen.getByLabelText('População nova (obras)')

    fireEvent.change(campo('População — universo'), { target: { value: '2.000' } })
    expect(novo().textContent).toContain('1.594') // 2.000 − 406
    expect(novo().tagName).toBe('OUTPUT') // resultado, não campo digitável

    fireEvent.change(campo('População atendida hoje'), { target: { value: '' } })
    expect(novo().textContent).toContain('—')
  })

  it('é dado do usuário: entra vazio como pendência e sai da conta ao preencher', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // b2_1_4 tem 7 pendências (2 params + 1 obra vazia) com a população preenchida.
    expect(chipDaFicha().textContent).toBe('7 pendências')
    fireEvent.change(campo('População — universo'), { target: { value: '' } })
    expect(chipDaFicha().textContent).toBe('8 pendências')
    fireEvent.change(campo('População — universo'), { target: { value: '1.300' } })
    expect(chipDaFicha().textContent).toBe('7 pendências')
  })

  it('trocar a régua da cidade para população cria as pendências na hora', async () => {
    renderApp('/unidade/u-jacarei/contrato-metas')
    await screen.findByRole('button', { name: 'Salvar cidade' })

    // Maricá passa a medir por população; b1_1_1 é dela e está sem esses dados.
    fireEvent.change(screen.getByLabelText('Buscar cidade'), { target: { value: 'Maricá' } })
    fireEvent.click(await screen.findByRole('button', { name: /Maricá/ }))
    fireEvent.change(screen.getByLabelText('Cobertura medida em'), {
      target: { value: 'populacao' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Águas de Jacareí' }))
    fireEvent.click(await screen.findByRole('button', { name: /Sub-bacias & Obras/ }))
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })
    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'b1_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /b1_1_1/ }))

    // Este é o caminho que o usuário reportou quebrado: a cidade era ligações,
    // virou população, e a ficha dela tem de ganhar o bloco na hora.
    // (duas vezes: a nota do card travado aponta para o bloco, e o bloco existe)
    expect(screen.getAllByText(/População desta sub-bacia — você preenche/).length).toBe(2)
    expect(campo('População — universo')).toBeTruthy()
    expect(campo('População atendida hoje')).toBeTruthy()
    expect(screen.getByLabelText('População nova (obras)')).toBeTruthy()

    // Os campos surgem preenchidos (o mock tem os números), mas a régua mudou:
    // esvaziar um deles agora conta pendência, e é isso que trava a simulação.
    const antes = chipDaFicha().textContent
    fireEvent.change(campo('População atendida hoje'), { target: { value: '' } })
    expect(chipDaFicha().textContent).not.toBe(antes)
  })
})

describe('salvar a ficha com população', () => {
  it('vai no `params` da ficha, sem trilha de override (não é dado do Databricks)', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(campo('População atendida hoje'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, corpo] = api.puts[0]
    expect(corpo.params.popA).toBe('500')
    expect(corpo.params.popU).toBe('1.267')
    expect(corpo.db.popA).toBeUndefined()
    expect(corpo.overrides).toEqual([])
  })

  it('voltar ao valor do servidor apaga o Salvar de novo', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    const salvar = () =>
      screen.getByRole('button', { name: 'Salvar sub-bacia' }) as HTMLButtonElement
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(campo('População — universo'), { target: { value: '9.999' } })
    expect(salvar().disabled).toBe(false)
    fireEvent.change(campo('População — universo'), { target: { value: '1.267' } })
    expect(salvar().disabled).toBe(true)
  })
})

describe('CTS', () => {
  it('segue a mesma regra da sub-bacia, com números próprios', async () => {
    renderApp('/unidade/u-jacarei/cts')
    await screen.findByRole('button', { name: 'Salvar CTS' })

    // A primeira CTS da árvore é a de Búzios (b3_1_1), que mede por ligações:
    // o bloco esta la, bloqueado, pela mesma razao da sub-bacia.
    expect((screen.getByLabelText('População — universo') as HTMLInputElement).disabled).toBe(true)
    expect(ehRegua('Ligações — universo')).toBe(true)
    expect(celula('Economias novas (obras)')).toBe('152')

    // Rio das Ostras mede por população — e a população da CTS é dela, não da
    // sub-bacia pareada.
    fireEvent.change(screen.getByLabelText('Buscar CTS, sub-bacia ou sistema'), {
      target: { value: 'cts_b2_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /cts_b2_1_1/ }))
    expect(campo('População — universo').value).toBe('218')
    expect(screen.getByLabelText('População nova (obras)').textContent).toContain('151') // 218 − 67
    // O nome do bloco aparece duas vezes de propósito: na nota do card travado
    // (que aponta para lá) e no cabeçalho do próprio bloco.
    expect(screen.getAllByText(/População desta CTS/).length).toBe(2)
  })
})

describe('recorte industrial', () => {
  it('traz as quatro medidas, e nenhuma delas é régua de meta', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // b2_1_4: 10 das 360 ligações são industriais, e elas respondem por
    // 1.148 dos 6.380 de receita — pouca ligação, muita receita. É esse
    // desequilíbrio que o recorte existe para mostrar.
    expect(celula('Ligações industriais — universo')).toBe('10')
    expect(celula('Ligações industriais atuais')).toBe('3')
    expect(celula('Receita faturada industrial (12m)')).toBe('1.148 R$/mês')
    expect(celula('Receita arrecadada industrial (12m)')).toBe('1.015 R$/mês')

    // Qualifica a base, não é denominador de meta nenhuma.
    expect(ehRegua('Ligações industriais — universo')).toBe(false)
    expect(ehRegua('Ligações industriais atuais')).toBe(false)
  })

  it('é corrigível como qualquer dado do Databricks, com trilha de override', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do Databricks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText('Ligações industriais atuais'), {
      target: { value: '7' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, corpo] = api.puts[0]
    expect(corpo.db.ligAInd).toBe('7')
    expect(corpo.overrides).toEqual([
      expect.objectContaining({ campo: 'ligAInd', valorAntigo: '3', valorNovo: '7' }),
    ])
  })

  it('a CTS tem o dela, não o da sub-bacia pareada', async () => {
    renderApp('/unidade/u-jacarei/cts')
    await screen.findByRole('button', { name: 'Salvar CTS' })
    // A primeira CTS da árvore é a de b3_1_1. São áreas sobrepostas, mas a base
    // comercial — inclusive o recorte industrial — é de cada uma.
    expect(celula('Ligações industriais — universo')).toBe('2')
    expect(celula('Receita faturada industrial (12m)')).toBe('1.098 R$/mês')
  })
})

describe('como o recorte industrial deve ser lido', () => {
  it('a nota do card avisa que é parcela, não parcela a somar', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // O erro que isto evita é silencioso: quem soma 360 + 10 perde a diferença
    // sem nunca ver um aviso.
    expect(screen.getByText(/parcela já contida/)).toBeTruthy()
    expect(screen.getByText(/total − industrial/)).toBeTruthy()
  })

  it('o "?" abre o verbete com a regra e o exemplo numérico', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(
      screen.getByRole('button', { name: 'O que é "Ligações industriais — universo"?' }),
    )
    expect(await screen.findByText(/1.000 − 80 = 920/)).toBeTruthy()
  })

  it('as quatro medidas industriais têm verbete; as outras células não têm "?"', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // 4 no card travado (o recorte) + 1 no card do usuário (a vazão industrial):
    // são justamente os campos em que "parcela já contida" precisa ser dita.
    const ajudas = screen.getAllByRole('button', { name: /^O que é ".*[Ii]ndustria/ })
    expect(ajudas).toHaveLength(5)
    // As demais células do Databricks continuam sem "?": não há regra a explicar.
    expect(screen.queryByRole('button', { name: 'O que é "Ligações — universo"?' })).toBeNull()
  })
})

describe('vazão industrial (parâmetro do usuário)', () => {
  it('fica no bloco "você preenche", logo abaixo da vazão total', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // b2_1_4: 18,1 L/s de vazão nova, dos quais 1,5 são industriais.
    expect(campo('Vazão nova').value).toBe('18,1')
    expect(campo('Vazão nova industrial').value).toBe('1,5')
    expect(screen.getByText(/já contida nela, não some as duas/)).toBeTruthy()
  })

  it('NÃO conta pendência: a planilha não tem a coluna e a simulação não a usa', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Este teste afirmava o contrário, e estava certo para a regra de então. A
    // regra mudou: `vazao_contribuicao_industrial` não existe na aba de
    // sub-bacia da planilha (só na de CTS), então chega vazio nas 4.850 linhas
    // e não há de onde preencher; e o motor só usa esse número para SUBTRAIR a
    // parcela industrial quando se roda `INCLUIR_INDUSTRIAL=False`, que não é a
    // análise de hoje. Cobrar travava as cinco unidades inteiras por nada.
    const antes = chipDaFicha().textContent
    fireEvent.change(campo('Vazão nova industrial'), { target: { value: '' } })
    expect(chipDaFicha().textContent).toBe(antes)

    // E continua editável e salvável — deixou de ser exigido, não de existir.
    fireEvent.change(campo('Vazão nova industrial'), { target: { value: '2,4' } })
    expect(chipDaFicha().textContent).toBe(antes)
  })

  it('o placeholder não finge ser um valor', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Era '0'. Como o texto de ajuda dizia "sem indústria, informe 0", o campo
    // vazio mostrava em cinza exatamente a resposta válida mais provável — e
    // quem olhava via um zero preenchido. Placeholder nunca pode ser um valor
    // que o campo aceita.
    fireEvent.change(campo('Vazão nova industrial'), { target: { value: '' } })
    expect(campo('Vazão nova industrial').placeholder).not.toBe('0')
    expect(campo('Vazão nova industrial').placeholder).toBe('sem indústria')
  })

  it('vai no params do PUT, sem override (não é dado do Databricks)', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(campo('Vazão nova industrial'), { target: { value: '2,4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, corpo] = api.puts[0]
    expect(corpo.params.vazInd).toBe('2,4')
    expect(corpo.overrides).toEqual([])
  })

  it('a CTS tem o mesmo parâmetro', async () => {
    renderApp('/unidade/u-jacarei/cts')
    await screen.findByRole('button', { name: 'Salvar CTS' })
    expect(campo('Vazão nova industrial')).toBeTruthy()
  })
})
