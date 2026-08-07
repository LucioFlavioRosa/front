// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * O bloco de população contra o BANCO REAL, e não contra o mock.
 *
 * `Araruama Interior1` (`e1c3`, unidade uB2) é a única cidade das 141 carregadas
 * da planilha com `unidade_cobertura = 'populacao'`. O dono do produto navegou
 * uma sub-bacia dela e viu a nota prometendo os campos ("os campos estão logo
 * abaixo") sem os campos aparecerem.
 *
 * O mock `u-jacarei` que o `populacao.test.tsx` usa já traz `cob: 'populacao'`
 * limpo — ele prova a UI, não prova o caminho do dado real. Este arquivo fecha
 * essa lacuna: se a nota aparece, os três campos têm de aparecer junto. Nota sem
 * bloco é a tela prometendo o que não entrega.
 */
vi.mock('@/comum/api/client', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  const { api, apiFake } = await import('@/testes/apiFake')
  const subbacias = (await import('@/mocks/fixtures/real/subbacias.json')).default
  const contrato = (await import('@/mocks/fixtures/real/contrato.json')).default
  const etes = (await import('@/mocks/fixtures/real/etes.json')).default
  const cts = (await import('@/mocks/fixtures/real/cts.json')).default
  const estrutura = (await import('@/mocks/fixtures/real/estrutura.json')).default
  const unidade = {
    id: 'uB2',
    regionalId: 'rB',
    nome: 'Unidade B2',
    resumo: { cidades: 14, sistemas: 14, subBacias: 700, obras: 0 },
    completude: 0,
    databricksConectado: true,
  }
  return {
    ...original,
    api: apiFake(api, {
      '/regionais': [{ id: 'rB', nome: 'Regional Norte' }],
      '/regionais/rB/unidades': [unidade],
      '/unidades/uB2': unidade,
      '/unidades/uB2/sub-bacias': subbacias,
      '/unidades/uB2/contrato': contrato,
      '/unidades/uB2/etes': etes,
      '/unidades/uB2/cts': cts,
      '/unidades/uB2/hierarquia': estrutura,
    }),
  }
})

import { renderApp } from '@/testes/renderApp'

afterEach(cleanup)

describe('população com dado real (Araruama Interior1)', () => {
  it('a nota não aparece sozinha: os campos que ela promete estão na tela', async () => {
    renderApp('/unidade/uB2/sub-bacias')
    await screen.findByRole('button', { name: 'Salvar sub-bacia' })

    // A rota não carrega o id da sub-bacia: a seleção é estado interno e a tela
    // abre na primeira da árvore. Navegar até uma sub-bacia de Araruama
    // Interior1 é parte do que se está reproduzindo.
    fireEvent.change(screen.getByLabelText('Buscar sub-bacia por código ou sistema'), {
      target: { value: 'e1b39_1_1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /e1b39_1_1/ }))

    // A nota, que é o que o dono do produto viu.
    expect(screen.getByText(/é medida em/)).toBeTruthy()
    // O nome aparece em mais de um lugar (a nota e o cabecalho do bloco).
    expect(screen.getAllByText(/Araruama Interior1/).length).toBeGreaterThan(0)

    // E o bloco que ela promete — dois digitáveis e o derivado.
    expect(screen.getAllByText(/População desta sub-bacia — você preenche/).length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText('População nova (obras)')).toBeTruthy()

    // Os campos existem e estao VAZIOS — e assim que o dado real chega. O teste
    // afirma que a tela os oferece, nao que o cadastro esta preenchido: as 49
    // sub-bacias desta cidade estao sem populacao no banco, e isso e defeito de
    // dado a corrigir, nao comportamento a congelar aqui.
    expect(screen.getByLabelText('População — universo')).toBeTruthy()
    expect(screen.getByLabelText('População atendida hoje')).toBeTruthy()
  })
})
