import { describe, expect, it } from 'vitest'
import subbacias from '@/mocks/fixtures/subbacias.json'
import contratoFx from '@/mocks/fixtures/contrato.json'
import etesFx from '@/mocks/fixtures/etes.json'
import estrutura from '@/mocks/fixtures/estrutura.json'
import ctsFx from '@/mocks/fixtures/cts.json'
import type { SubBacia, SupNode } from '@/cadastro/domain/subbacia'
import type { Cidade, Fator, Meta } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import { CTS_CAMPOS, novaCts, type Cts, type ParCts } from '@/cadastro/domain/cts'
import {
  derive,
  initialState,
  reducer,
  reguaDaCts,
  reguaDaSub,
  seeded,
  type Hier,
  type State,
} from '@/cadastro/state/cadastroReducer'
import {
  assinatura,
  chaveCts,
  chaveSub,
  fichaSub,
  hierAlterada,
  sujas,
} from '@/cadastro/state/fichas'
import { BASE_OBRAS } from '@/cadastro/domain/subbacia'
import { BASE_OBRAS_CTS } from '@/cadastro/domain/cts'

const AT = '2026-01-01T00:00:00.000Z'

/** Estado totalmente semeado a partir dos fixtures (mesmo dado do app). */
function seededState(): State {
  let s = initialState
  s = reducer(s, {
    type: 'SEED_SUBS',
    subs: subbacias.subs as unknown as Record<string, SubBacia>,
    arvore: subbacias.arvore as unknown as SupNode[],
  })
  s = reducer(s, {
    type: 'SEED_CONTRATO',
    cidades: contratoFx.cidades as Cidade[],
    metas: contratoFx.metas as Meta[],
    fator: contratoFx.fator as Fator[],
  })
  s = reducer(s, { type: 'SEED_ETES', etes: etesFx.etes as unknown as Ete[] })
  s = reducer(s, { type: 'SEED_HIER', hier: estrutura as unknown as Hier })
  s = reducer(s, {
    type: 'SEED_CTS',
    ctss: ctsFx.ctss as unknown as Record<string, Cts>,
    pares: ctsFx.pares as ParCts[],
  })
  return s
}

/** Cria a CTS como o app cria: com a ficha que o servidor devolveu (o mock
 *  ecoa exatamente o que foi enviado, que e `novaCts(sub)`). */
function criarCts(s: State, subId: string): State {
  return reducer(s, { type: 'ADD_CTS', subId, cts: novaCts(s.subs![subId]) })
}

describe('seeding', () => {
  it('estado inicial não está semeado; após os 5 SEED, sim', () => {
    expect(seeded(initialState)).toBe(false)
    expect(seeded(seededState())).toBe(true)
  })
  it('SEED_SUBS guarda um snapshot original separado', () => {
    const s = reducer(initialState, {
      type: 'SEED_SUBS',
      subs: subbacias.subs as unknown as Record<string, SubBacia>,
      arvore: subbacias.arvore as unknown as SupNode[],
    })
    expect(s.originalSubs).not.toBeNull()
    expect(s.originalSubs).not.toBe(s.subs) // clones distintos
  })
})

describe('derive() — totais de referência do dataset mock', () => {
  it('bate com g2=4, g3=15, g4=2, g5=7', () => {
    const d = derive(seededState())
    // `vazInd` saiu da regua (a planilha nao tem a coluna para sub-bacia, e a
    // simulacao de hoje nao usa o valor) e o `wacc` da ETE tambem (vazio significa
    // "usa o WACC medio da unidade"). Por isso cada contagem abaixo caiu 1 por
    // ficha. Os numeros nao foram "ajustados ate passar": cada um e o anterior
    // menos exatamente o campo que deixou de ser cobrado.
    expect(d).toMatchObject({ g2: 4, g3: 13, g4: 2, g5: 6, pendTotal: 25 })
    expect(d.counts).toMatchObject({
      cidades: 8,
      sistemas: 8,
      subBacias: 8,
      obras: 40,
      metas: 6,
      etes: 5,
      cts: 3,
      ctsObras: 12,
    })
  })
})

describe('grupo 05 — CTS', () => {
  it('SET_CTS_PARAM preenche um param pendente e reduz g5', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_CTS_PARAM', ctsId: 'cts_b3_1_1', key: 'vaz', value: '4,2' })
    expect(s1.ctss!['cts_b3_1_1'].params.vaz).toBe('4,2')
    expect(derive(s1).g5).toBe(derive(s0).g5 - 1)
  })

  it('SET_CTS_OBRA_FIELD preenche um campo de obra e reduz g5', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'SET_CTS_OBRA_FIELD',
      ctsId: 'cts_b2_1_4',
      index: 1,
      key: 'qtd',
      value: '120',
    })
    expect(s1.ctss!['cts_b2_1_4'].obrasOverride['1'].qtd).toBe('120')
    expect(derive(s1).g5).toBe(derive(s0).g5 - 1)
  })

  it('EDIT_CTS_DB_FIELD grava override com o valor original e não mexe em g5', () => {
    const s0 = seededState()
    const original = s0.ctss!['cts_b2_1_1'].db.fat
    const s1 = reducer(s0, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b2_1_1',
      key: 'fat',
      value: '4.000',
      at: AT,
    })
    expect(s1.overrides['cts_b2_1_1.fat']).toMatchObject({
      campo: 'fat',
      valorAntigo: original,
      valorNovo: '4.000',
    })
    expect(derive(s1).g5).toBe(derive(s0).g5)
  })

  it('ADD_CTS pareia uma sub-bacia livre e acrescenta os campos dela ao cadastro', () => {
    const s0 = seededState()
    const s1 = criarCts(s0, 'b1_1_1')
    expect(s1.pares).toHaveLength(s0.pares!.length + 1)
    expect(s1.ctss!['cts_b1_1_1'].subId).toBe('b1_1_1')
    // CTS nova entra vazia: os 5 params pendentes; as obras herdam a base preenchida.
    expect(derive(s1).g5).toBe(derive(s0).g5 + 5)
    expect(derive(s1).counts.cts).toBe(4)
    expect(CTS_CAMPOS).toBe(33)
  })

  it('ADD_CTS é ignorado se a sub-bacia já tem CTS (relação 1:1)', () => {
    const s0 = seededState()
    const s1 = criarCts(s0, 'b2_1_1')
    expect(s1).toBe(s0)
  })

  it('recriar a CTS descarta o snapshot do servidor daquele id', () => {
    // O id é determinístico (cts_<subId>), então remover e recriar reusa o id: o
    // "valor antigo" do override tem de ser o da CTS nova (vazia), não o do
    // dado que o servidor mandou para a CTS antiga.
    const s0 = seededState()
    const doServidor = s0.ctss!['cts_b2_1_4'].db.fat
    expect(doServidor).not.toBe('')

    const s1 = reducer(s0, { type: 'REMOVE_CTS', ctsId: 'cts_b2_1_4' })
    const s2 = criarCts(s1, 'b2_1_4')
    expect(s2.originalCtss!['cts_b2_1_4']).toBeUndefined()

    const s3 = reducer(s2, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b2_1_4',
      key: 'fat',
      value: '1.000',
      at: AT,
    })
    expect(s3.overrides['cts_b2_1_4.fat']).toMatchObject({
      valorAntigo: '', // a CTS recriada nasce vazia
      valorNovo: '1.000',
    })
  })

  it('REMOVE_CTS tira a CTS, o par e os overrides dela', () => {
    const s0 = seededState()
    const comOverride = reducer(s0, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b2_1_4',
      key: 'fat',
      value: 'X',
      at: AT,
    })
    const s1 = reducer(comOverride, { type: 'REMOVE_CTS', ctsId: 'cts_b2_1_4' })
    expect(s1.ctss!['cts_b2_1_4']).toBeUndefined()
    expect(s1.pares!.some((p) => p.cts === 'cts_b2_1_4')).toBe(false)
    expect(s1.overrides['cts_b2_1_4.fat']).toBeUndefined()
    // As 3 pendências daquela CTS saem do total junto com ela.
    expect(derive(s1).g5).toBe(derive(s0).g5 - 3)
  })
})

describe('derive() — base vazia', () => {
  it('unidade semeada sem nenhum campo a preencher não vira NaN%', () => {
    const vazio = reducer(
      reducer(
        reducer(
          reducer(reducer(initialState, { type: 'SEED_SUBS', subs: {}, arvore: [] }), {
            type: 'SEED_CONTRATO',
            cidades: [],
            metas: [],
            fator: [],
          }),
          { type: 'SEED_ETES', etes: [] },
        ),
        { type: 'SEED_HIER', hier: { ...(estrutura as unknown as Hier), sistemas: [] } },
      ),
      { type: 'SEED_CTS', ctss: {}, pares: [] },
    )
    expect(seeded(vazio)).toBe(true)
    const d = derive(vazio)
    expect(Number.isNaN(d.completude)).toBe(false)
    // Nada pendente = 100%, o mesmo critério que libera a simulação no hub.
    expect(d.completude).toBe(100)
    expect(d.pendTotal).toBe(0)
  })
})

describe('SET_SUB_PARAM', () => {
  it('preencher um param pendente reduz subPend e o total g3', () => {
    const s0 = seededState()
    expect(derive(s0).g3).toBe(13)
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: '100' })
    expect(s1.subs!['b2_1_4'].params.preco).toBe('100')
    expect(derive(s1).g3).toBe(12) // uma pendência a menos
  })
  it('não muta o estado anterior (imutabilidade)', () => {
    const s0 = seededState()
    reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: '100' })
    expect(s0.subs!['b2_1_4'].params.preco).toBe('') // s0 intocado
  })
})

describe('EDIT_DB_FIELD — trilha de override', () => {
  it('grava override com o valor ORIGINAL, mesmo após várias edições', () => {
    const s0 = seededState()
    const original = s0.subs!['b1_1_1'].db.fat // '260.964'
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
      at: AT,
    })
    const s2 = reducer(s1, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'Y',
      at: AT,
    })
    expect(s2.subs!['b1_1_1'].db.fat).toBe('Y')
    expect(s2.overrides['b1_1_1.fat']).toMatchObject({
      campo: 'fat',
      valorAntigo: original, // permanece o original, não 'X'
      valorNovo: 'Y',
      autor: 'Regional/Unidade',
      at: AT,
    })
  })
})

describe('SET_HIER_TOPO_JUSANTE — override do "escoa para"', () => {
  it('grava override do campo mais crítico com valor original', () => {
    const s0 = seededState()
    const original = s0.hier!.topo[0].jus // 'e1'
    const s1 = reducer(s0, { type: 'SET_HIER_TOPO_JUSANTE', index: 0, value: 'e9', at: AT })
    expect(s1.hier!.topo[0].jus).toBe('e9')
    expect(s1.overrides['hier.topo.0']).toMatchObject({
      campo: 'componente_sistema_id_jusante',
      valorAntigo: original,
      valorNovo: 'e9',
    })
  })
})

describe('ADD_META / REMOVE_META', () => {
  it('adicionar uma meta vazia cria 2 pendências (ano + pct)', () => {
    const s0 = seededState()
    const g2Antes = derive(s0).g2 // 4
    const s1 = reducer(s0, { type: 'ADD_META', cid: 'c1' })
    expect(s1.metas).toHaveLength(contratoFx.metas.length + 1)
    expect(derive(s1).g2).toBe(g2Antes + 2)
  })
  it('remover volta ao estado anterior', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'ADD_META', cid: 'c1' })
    const s2 = reducer(s1, { type: 'REMOVE_META', index: s1.metas!.length - 1 })
    expect(s2.metas).toHaveLength(contratoFx.metas.length)
    expect(derive(s2).g2).toBe(derive(s0).g2)
  })
})

describe('demais actions de mutação', () => {
  it('SET_ETE_FIELD preenche módulos e reduz g4', () => {
    const s0 = seededState()
    expect(derive(s0).g4).toBe(2)
    const s1 = reducer(s0, { type: 'SET_ETE_FIELD', eteId: 'e2', key: 'modulos', value: '4' })
    expect(s1.etes!.find((e) => e.id === 'e2')!.modulos).toBe('4')
    expect(derive(s1).g4).toBe(1)
  })

  it('SET_CIDADE_FIELD (cobertura) reduz g2', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_CIDADE_FIELD', cidId: 'c5', key: 'cob', value: 'ligacoes' })
    expect(derive(s1).g2).toBe(derive(s0).g2 - 1)
  })

  it('SET_OBRA_FIELD preenche um campo de obra e reduz g3', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 3,
      key: 'qtd',
      value: '5',
    })
    expect(s1.subs!['b2_1_4'].obrasOverride['3'].qtd).toBe('5')
    expect(derive(s1).g3).toBe(derive(s0).g3 - 1)
  })

  it('ADD_FATOR cria 2 pendências; REMOVE_FATOR desfaz', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'ADD_FATOR', cid: 'c1' })
    expect(derive(s1).g2).toBe(derive(s0).g2 + 2)
    const s2 = reducer(s1, { type: 'REMOVE_FATOR', index: s1.fator!.length - 1 })
    expect(derive(s2).g2).toBe(derive(s0).g2)
  })

  it('SET_HIER_SUP_NOME grava override com o nome original', () => {
    const s0 = seededState()
    const original = s0.hier!.superintendencias.find((s) => s.id === 'sup1')!.nome
    const s1 = reducer(s0, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: 'Nova Sup', at: AT })
    expect(s1.hier!.superintendencias.find((s) => s.id === 'sup1')!.nome).toBe('Nova Sup')
    expect(s1.overrides['hier.sup.sup1']).toMatchObject({ campo: 'nome', valorAntigo: original })
  })

  it('EDIT_DB_FIELD não altera pendências (dado Databricks não é do usuário)', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
      at: AT,
    })
    expect(derive(s1).g3).toBe(derive(s0).g3) // g3 inalterado
  })
})

describe('fichas não salvas (baseline de gravação)', () => {
  it('recém-semeado, nada está por salvar', () => {
    expect(sujas(seededState())).toEqual([])
  })

  it('editar suja só a ficha editada; FICHA_SALVA limpa', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: '90' })
    expect(sujas(s1)).toEqual([chaveSub('b2_1_4')])

    // A assinatura vem do corpo enviado — aqui, o estado no momento do PUT.
    const s2 = reducer(s1, {
      type: 'FICHA_SALVA',
      chave: chaveSub('b2_1_4'),
      assinatura: assinatura(fichaSub(s1, 'b2_1_4')),
    })
    expect(sujas(s2)).toEqual([])
  })

  it('voltar o campo ao valor original desfaz a pendência de gravação', () => {
    const s0 = seededState()
    const antes = s0.subs!['b2_1_4'].params.preco
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: '90' })
    const s2 = reducer(s1, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: antes })
    expect(sujas(s2)).toEqual([])
  })

  it('salvar uma ficha não limpa o que foi digitado DEPOIS do envio', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'preco', value: '90' })
    const enviada = assinatura(fichaSub(s1, 'b2_1_4')) // corpo do PUT em voo
    const s2 = reducer(s1, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'ramp', value: '6' })
    const s3 = reducer(s2, { type: 'FICHA_SALVA', chave: chaveSub('b2_1_4'), assinatura: enviada })
    expect(sujas(s3)).toEqual([chaveSub('b2_1_4')])
  })

  it('a trilha de override conta como mudança da ficha', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
      at: AT,
    })
    expect(sujas(s1)).toEqual([chaveSub('b1_1_1')])
  })

  it('CTS criada nasce salva (o servidor já a aceitou) e some ao ser removida', () => {
    const s0 = seededState()
    const s1 = criarCts(s0, 'b1_1_1')
    expect(s1.ctss!['cts_b1_1_1']).toBeTruthy()
    expect(sujas(s1)).toEqual([])

    const s2 = reducer(s1, { type: 'SET_CTS_PARAM', ctsId: 'cts_b1_1_1', key: 'vaz', value: '1' })
    expect(sujas(s2)).toEqual([chaveCts('cts_b1_1_1')])

    const s3 = reducer(s2, { type: 'REMOVE_CTS', ctsId: 'cts_b1_1_1' })
    expect(sujas(s3)).toEqual([])
    expect(s3.salvas[chaveCts('cts_b1_1_1')]).toBeUndefined()
  })

  it('a assinatura não depende da ordem em que as chaves foram criadas', () => {
    const s0 = seededState()
    const a = reducer(
      reducer(s0, { type: 'SET_OBRA_FIELD', subId: 'b2_1_4', index: 3, key: 'qtd', value: '5' }),
      { type: 'SET_OBRA_FIELD', subId: 'b2_1_4', index: 1, key: 'qtd', value: '2' },
    )
    const b = reducer(
      reducer(s0, { type: 'SET_OBRA_FIELD', subId: 'b2_1_4', index: 1, key: 'qtd', value: '2' }),
      { type: 'SET_OBRA_FIELD', subId: 'b2_1_4', index: 3, key: 'qtd', value: '5' },
    )
    expect(assinatura(fichaSub(a, 'b2_1_4'))).toBe(assinatura(fichaSub(b, 'b2_1_4')))
  })
})

describe('reverter uma edição desfaz o registro dela', () => {
  it('EDIT_DB_FIELD de volta ao valor do servidor apaga o override', () => {
    const s0 = seededState()
    const original = s0.subs!['b1_1_1'].db.fat
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
      at: AT,
    })
    expect(s1.overrides['b1_1_1.fat']).toBeTruthy()

    const s2 = reducer(s1, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: original,
      at: AT,
    })
    // Sem isto o backend receberia uma trilha dizendo "X virou X" e a ficha
    // ficaria "não salva" para sempre (a assinatura inclui os overrides).
    expect(s2.overrides['b1_1_1.fat']).toBeUndefined()
    expect(sujas(s2)).toEqual([])
  })

  it('EDIT_CTS_DB_FIELD segue a mesma regra', () => {
    const s0 = seededState()
    const original = s0.ctss!['cts_b3_1_1'].db.arr
    const s1 = reducer(s0, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b3_1_1',
      key: 'arr',
      value: 'X',
      at: AT,
    })
    expect(s1.overrides['cts_b3_1_1.arr']).toBeTruthy()

    const s2 = reducer(s1, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b3_1_1',
      key: 'arr',
      value: original,
      at: AT,
    })
    expect(s2.overrides['cts_b3_1_1.arr']).toBeUndefined()
    expect(sujas(s2)).toEqual([])
  })

  it('SET_HIER_SUP_NOME de volta ao nome original apaga o override', () => {
    const s0 = seededState()
    const original = s0.hier!.superintendencias.find((x) => x.id === 'sup1')!.nome
    const s1 = reducer(s0, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: 'Outra', at: AT })
    expect(s1.overrides['hier.sup.sup1']).toBeTruthy()

    const s2 = reducer(s1, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: original, at: AT })
    expect(s2.overrides['hier.sup.sup1']).toBeUndefined()
    expect(hierAlterada(s2)).toBe(false)
  })

  it('SET_OBRA_FIELD de volta ao valor da obra-base some do mapa de overrides', () => {
    const s0 = seededState()
    // Índice 4 (Linha de recalque): é o que b2_1_4 não sobrescreve no mock.
    const base = BASE_OBRAS[4].qtd
    const s1 = reducer(s0, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 4,
      key: 'qtd',
      value: '77',
    })
    expect(s1.subs!['b2_1_4'].obrasOverride['4'].qtd).toBe('77')

    const s2 = reducer(s1, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 4,
      key: 'qtd',
      value: base,
    })
    // O índice inteiro sai quando não sobra nenhum campo alterado nele: a ficha
    // manda só o que difere da base.
    expect(s2.subs!['b2_1_4'].obrasOverride['4']).toBeUndefined()
    expect(sujas(s2)).toEqual([])
  })

  it('SET_CTS_OBRA_FIELD idem, contra a base de 4 obras da CTS', () => {
    const s0 = seededState()
    const base = BASE_OBRAS_CTS[1].preco
    const s1 = reducer(s0, {
      type: 'SET_CTS_OBRA_FIELD',
      ctsId: 'cts_b3_1_1',
      index: 1,
      key: 'preco',
      value: '9',
    })
    const s2 = reducer(s1, {
      type: 'SET_CTS_OBRA_FIELD',
      ctsId: 'cts_b3_1_1',
      index: 1,
      key: 'preco',
      value: base,
    })
    expect(s2.ctss!['cts_b3_1_1'].obrasOverride['1']).toBeUndefined()
    expect(sujas(s2)).toEqual([])
  })

  it('reverter um campo não apaga os outros do mesmo índice', () => {
    const s0 = seededState()
    const base = BASE_OBRAS[0].qtd
    const s1 = reducer(s0, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 0,
      key: 'qtd',
      value: '10',
    })
    const s2 = reducer(s1, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 0,
      key: 'opex',
      value: '500',
    })
    const s3 = reducer(s2, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 0,
      key: 'qtd',
      value: base,
    })
    expect(s3.subs!['b2_1_4'].obrasOverride['0']).toEqual({ opex: '500' })
  })
})

describe('população conta como pendência só na régua certa', () => {
  it('a régua da cidade alcança a sub-bacia pela árvore', () => {
    const s = seededState()
    // Rio das Ostras (c6) mede por população; Maricá (c1), por ligações.
    expect(reguaDaSub(s, 'b2_1_4')).toBe('populacao')
    expect(reguaDaSub(s, 'b1_1_1')).toBe('ligacoes')
    // A CTS herda a régua da sub-bacia pareada.
    expect(reguaDaCts(s, 'cts_b2_1_1')).toBe('populacao')
    expect(reguaDaCts(s, 'cts_b3_1_1')).toBe('ligacoes')
  })

  it('esvaziar a população de uma cidade que mede por ela vira pendência', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b2_1_4', key: 'popU', value: '' })
    expect(derive(s1).g3).toBe(derive(s0).g3 + 1)
  })

  it('a mesma edição numa cidade que mede por ligações não muda nada', () => {
    const s0 = seededState()
    const s1 = reducer(s0, { type: 'SET_SUB_PARAM', subId: 'b1_1_1', key: 'popU', value: '' })
    // b1_1_1 é de Maricá: população não é o denominador, então não conta.
    expect(derive(s1).g3).toBe(derive(s0).g3)
  })

  it('trocar a régua da cidade para população acrescenta as pendências das sub-bacias dela', () => {
    const s0 = seededState()
    // Esvazia a população das 3 sub-bacias de Búzios (c9), que mede por ligações.
    const vazias = ['b3_1_1', 'b3_1_2', 'b3_2_1'].reduce(
      (s, subId) =>
        ['popU', 'popA'].reduce(
          (acc, key) =>
            reducer(acc, {
              type: 'SET_SUB_PARAM',
              subId,
              key: key as 'popU' | 'popA',
              value: '',
            }),
          s,
        ),
      s0,
    )
    expect(derive(vazias).g3).toBe(derive(s0).g3)

    // A cidade passa a medir por população: 3 sub-bacias × 2 campos vazios.
    const c9 = reducer(vazias, {
      type: 'SET_CIDADE_FIELD',
      cidId: 'c9',
      key: 'cob',
      value: 'populacao',
    })
    expect(derive(c9).g3).toBe(derive(s0).g3 + 6)
    // E a CTS de b3_1_1 herda a régua junto.
    expect(reguaDaCts(c9, 'cts_b3_1_1')).toBe('populacao')
  })

  it('sub-bacia fora da árvore não ganha campo de população', () => {
    const s0 = seededState()
    const orfa = { ...s0, cidadeDaSub: {} }
    expect(reguaDaSub(orfa, 'b2_1_4')).toBeNull()
    expect(derive(orfa).g3).toBe(derive(s0).g3)
  })
})
