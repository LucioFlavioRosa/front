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
  const bloco = label.parentElement
  // A NOTA DA CONTA sai junto: campo derivado ("universo × potencial − atuais")
  // descreve como o número saiu, e ela vive no mesmo bloco do valor. Sem tirá-la,
  // toda asserção de valor passaria a comparar valor + explicação.
  // O `id` do hint termina em `-hint` (`DbCard`, `aria-describedby`); a classe do
  // CSS Module vira hash, entao o sufixo do id e a ancora estavel.
  const hint = bloco?.querySelector('[id$="-hint"]')?.textContent ?? ''
  return (bloco?.textContent ?? '')
    .replace(label.textContent ?? '', '')
    .replace(hint, '')
    .trim()
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

  it('não aparece quando a cidade mede por ligações', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'b1_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /b1_1_1/ }))

    // Houve uma versão em que o bloco ficava visível e bloqueado nas outras
    // réguas — a ideia era que "não se preenche agora" não é "não existe". Foi
    // revertida: na planilha de origem população está vazia nas 4.850
    // sub-bacias, então não havia dado a preservar da vista, e o bloco cinza só
    // somava ruído em 140 das 141 cidades.
    expect(screen.queryByLabelText('População — universo')).toBeNull()
    expect(screen.queryByLabelText('População nova (obras)')).toBeNull()
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

    // A primeira CTS da árvore é a de Búzios (b3_1_1), que mede por ligações.
    expect(screen.queryByLabelText('População — universo')).toBeNull()
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

describe('recorte residencial', () => {
  it('traz as quatro medidas, e nenhuma delas é régua de meta por padrão', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // b2_1_4: 350 das 360 ligações são residenciais. O recorte existe para a
    // rodada que mede a meta só nelas — e ele vem APURADO da base comercial, não
    // deduzido subtraindo indústria, como era antes.
    expect(celula('Ligações residenciais — universo')).toBe('350')
    expect(celula('Ligações residenciais atuais')).toBe('113')
    expect(celula('Economias residenciais — universo')).toBe('385')
    expect(celula('Economias residenciais atuais')).toBe('124')

    // A régua marca o trio que a cidade usa por padrão. Estes campos só viram
    // denominador quando a RODADA pede — não são a régua da ficha.
    expect(ehRegua('Ligações residenciais — universo')).toBe(false)
    expect(ehRegua('Economias residenciais — universo')).toBe(false)
  })

  it('é corrigível como qualquer dado do Databricks, com trilha de override', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do Databricks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, editar' }))
    fireEvent.change(screen.getByLabelText('Ligações residenciais atuais'), {
      target: { value: '110' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, corpo] = api.puts[0]
    expect(corpo.db.ligARes).toBe('110')
    // A trilha do que mudou é do SERVIDOR (ele compara o gravado com o que
    // chega), então o corpo não a carrega.
    expect('overrides' in corpo).toBe(false)
  })

  it('a CTS tem o dela, não o da sub-bacia pareada', async () => {
    renderApp('/unidade/u-jacarei/cts')
    await screen.findByRole('button', { name: 'Salvar CTS' })
    // A primeira CTS da árvore é a de b3_1_1. São áreas sobrepostas, mas a base
    // comercial — inclusive o recorte residencial — é de cada uma.
    expect(celula('Ligações residenciais — universo')).toBe('202')
    expect(celula('Economias residenciais atuais')).toBe('71')
  })
})

describe('como o recorte residencial deve ser lido', () => {
  it('a nota do card avisa que é parcela, e que o recorte para na meta', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Dois erros silenciosos de uma vez: somar 360 + 350, e achar que o recorte
    // muda o dinheiro. O segundo tem história — a versão anterior descontava
    // indústria da receita e da vazão junto.
    expect(screen.getByText(/parcela já contida/)).toBeTruthy()
    expect(screen.getByText(/receita, VPL e vazão usam sempre o total/i)).toBeTruthy()
  })

  it('o "?" abre o verbete com a regra e o exemplo numérico', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.click(
      screen.getByRole('button', { name: 'O que é "Ligações residenciais — universo"?' }),
    )
    expect(await screen.findByText(/920 \(de um universo de 1.000\)/)).toBeTruthy()
  })

  it('as quatro medidas residenciais têm verbete; as outras células não têm "?"', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // 4 no card travado. A vazão industrial, que era a quinta, deixou de existir:
    // o recorte não toca em vazão.
    const ajudas = screen.getAllByRole('button', { name: /^O que é ".*[Rr]esidencia/ })
    expect(ajudas).toHaveLength(4)
    // As demais células do Databricks continuam sem "?": não há regra a explicar.
    expect(screen.queryByRole('button', { name: 'O que é "Ligações — universo"?' })).toBeNull()
  })
})

describe('a vazão industrial saiu do cadastro', () => {
  it('não existe mais campo de vazão industrial', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // Ela existia para o motor subtrair a parcela da indústria na rodada "só
    // residencial". Esse recorte deixou de tocar em vazão: ela dimensiona módulo
    // de ETE e rateia obra compartilhada, e indústria manda esgoto mesmo quando
    // não conta para a meta. Um campo a menos para a Regional preencher.
    expect(campo('Vazão nova').value).toBe('18,1')
    expect(screen.queryByLabelText('Vazão nova industrial')).toBeNull()
  })

  it('a CTS também perdeu o campo', async () => {
    renderApp('/unidade/u-jacarei/cts')
    await screen.findByRole('button', { name: 'Salvar CTS' })
    expect(screen.queryByLabelText('Vazão nova industrial')).toBeNull()
  })

  it('e não viaja mais no params do PUT', async () => {
    renderApp('/unidade/u-jacarei/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    fireEvent.change(campo('Vazão nova'), { target: { value: '19,2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sub-bacia' }))

    await waitFor(() => expect(api.puts).toHaveLength(1))
    const [, corpo] = api.puts[0]
    expect(corpo.params.vaz).toBe('19,2')
    expect('vazInd' in corpo.params).toBe(false)
  })
})
