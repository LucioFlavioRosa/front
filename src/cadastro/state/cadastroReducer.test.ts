import { describe, expect, it } from 'vitest'
import subbacias from '@/mocks/fixtures/subbacias.json'
import contratoFx from '@/mocks/fixtures/contrato.json'
import etesFx from '@/mocks/fixtures/etes.json'
import estrutura from '@/mocks/fixtures/estrutura.json'
import ctsFx from '@/mocks/fixtures/cts.json'
import type { SubBacia, SupNode } from '@/cadastro/domain/subbacia'
import type { Cidade, Fator, Meta } from '@/cadastro/domain/contrato'
import type { Ete } from '@/cadastro/domain/ete'
import type { Cts, ParCts } from '@/cadastro/domain/cts'
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
import { assinatura, chaveSub, fichaSub, hierAlterada, sujas } from '@/cadastro/state/fichas'

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

/*
 * AQUI HAVIA os testes de ADD_CTS / REMOVE_CTS: pareamento 1:1, descarte do
 * snapshot do servidor ao recriar a CTS com o mesmo id, e limpeza dos overrides
 * na remocao. Eles nao falharam — a criacao/remocao de CTS pela tela foi
 * retirada do produto, porque a CTS e no da topologia e cria-la aqui produzia
 * uma ficha que o motor nunca carrega.
 *
 * Se um dia existir um editor de topologia de verdade, estes casos voltam a
 * valer: o cuidado com o id deterministico (`cts_<subId>`) reaparece inteiro.
 */

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

  it('EDIT_CTS_DB_FIELD muda o valor e não mexe em g5', () => {
    const s0 = seededState()
    const original = s0.ctss!['cts_b2_1_1'].db.fat
    const s1 = reducer(s0, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b2_1_1',
      key: 'fat',
      value: '4.000',
    })
    expect(s1.ctss!['cts_b2_1_1'].db.fat).toBe('4.000')
    // O snapshot do servidor não se mexe: ele é o que a ficha compara para saber
    // se está suja, e o que a tela mostra ao lado do campo corrigido.
    expect(s0.originalCtss!['cts_b2_1_1'].db.fat).toBe(original)
    expect(derive(s1).g5).toBe(derive(s0).g5)
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

describe('EDIT_DB_FIELD', () => {
  it('a última edição é a que vale, e o snapshot do servidor não se mexe', () => {
    const s0 = seededState()
    const original = s0.subs!['b1_1_1'].db.fat // '260.964'
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
    })
    const s2 = reducer(s1, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'Y',
    })
    expect(s2.subs!['b1_1_1'].db.fat).toBe('Y')
    // O snapshot do SEED continua sendo o do servidor — é dele que sai a
    // comparação de "está suja?". A trilha (que salto foi de X para Y) é do
    // servidor agora: ele compara o gravado com o que chega, e por isso registra
    // `X -> Y`, e não `original -> Y` como esta tela registrava.
    expect(s0.originalSubs!['b1_1_1'].db.fat).toBe(original)
    expect({
      campo: 'fat',
      valorAntigo: original, // permanece o original, não 'X'
      valorNovo: 'Y',
      autor: 'Regional/Unidade',
    })
  })
})

describe('SET_HIER_TOPO_JUSANTE — o "escoa para"', () => {
  it('muda o jusante e marca a hierarquia como editada', () => {
    const s0 = seededState()
    const original = s0.hier!.topo[0].jus // 'e1'
    const s1 = reducer(s0, { type: 'SET_HIER_TOPO_JUSANTE', index: 0, value: 'e9' })
    expect(s1.hier!.topo[0].jus).toBe('e9')
    expect(s1.originalHier!.topo[0].jus).toBe(original)
    expect(hierAlterada(s1)).toBe(true)
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

  it('SET_HIER_SUP_NOME muda o nome da superintendência', () => {
    const s0 = seededState()
    const original = s0.hier!.superintendencias.find((s) => s.id === 'sup1')!.nome
    const s1 = reducer(s0, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: 'Nova Sup' })
    expect(s1.hier!.superintendencias.find((s) => s.id === 'sup1')!.nome).toBe('Nova Sup')
    expect(s1.originalHier!.superintendencias.find((s) => s.id === 'sup1')!.nome).toBe(original)
    expect(hierAlterada(s1)).toBe(true)
  })

  it('EDIT_DB_FIELD não altera pendências (dado Databricks não é do usuário)', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
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

  it('editar um dado do Databricks suja a ficha, como qualquer campo', () => {
    const s0 = seededState()
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
    })
    expect(sujas(s1)).toEqual([chaveSub('b1_1_1')])
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

describe('reverter uma edição limpa a ficha', () => {
  it('EDIT_DB_FIELD de volta ao valor do servidor limpa a ficha', () => {
    const s0 = seededState()
    const original = s0.subs!['b1_1_1'].db.fat
    const s1 = reducer(s0, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: 'X',
    })
    expect(sujas(s1)).toEqual(['sub:b1_1_1'])

    const s2 = reducer(s1, {
      type: 'EDIT_DB_FIELD',
      subId: 'b1_1_1',
      key: 'fat',
      value: original,
    })
    // Quem responde "está suja?" é a comparação de CONTEÚDO. Antes havia um
    // segundo mecanismo — apagar o override do mapa —, e ele existia porque a
    // assinatura incluía a trilha. Sem trilha no cliente, sobrou o que sempre
    // bastou: valor igual ao do servidor, ficha limpa.
    expect(s2.subs!['b1_1_1'].db.fat).toBe(original)
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
    })
    expect(sujas(s1)).toEqual(['cts:cts_b3_1_1'])

    const s2 = reducer(s1, {
      type: 'EDIT_CTS_DB_FIELD',
      ctsId: 'cts_b3_1_1',
      key: 'arr',
      value: original,
    })
    expect(s2.ctss!['cts_b3_1_1'].db.arr).toBe(original)
    expect(sujas(s2)).toEqual([])
  })

  it('SET_HIER_SUP_NOME de volta ao nome original não deixa a hierarquia editada', () => {
    const s0 = seededState()
    const original = s0.hier!.superintendencias.find((x) => x.id === 'sup1')!.nome
    const s1 = reducer(s0, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: 'Outra' })
    expect(hierAlterada(s1)).toBe(true)

    const s2 = reducer(s1, { type: 'SET_HIER_SUP_NOME', supId: 'sup1', value: original })
    expect(hierAlterada(s2)).toBe(false)
  })

  it('SET_OBRA_FIELD de volta ao valor do SERVIDOR limpa a ficha', () => {
    const s0 = seededState()
    // O valor original é o que veio no payload — não mais o de uma obra-base.
    // As duas literais saíram (R1/R2), e a comparação passou a ser com o dado.
    const doServidor = s0.subs!['b2_1_4'].obrasOverride['4'].qtd!
    const s1 = reducer(s0, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 4,
      key: 'qtd',
      value: '77',
    })
    expect(s1.subs!['b2_1_4'].obrasOverride['4'].qtd).toBe('77')
    expect(sujas(s1)).toEqual(['sub:b2_1_4'])

    const s2 = reducer(s1, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 4,
      key: 'qtd',
      value: doServidor,
    })
    // O índice NÃO some mais, e nenhum campo é apagado: o mapa carrega a obra
    // inteira, e tirar campo dele criaria buraco — o campo voltaria vazio na
    // tela e o PUT gravaria NULL numa coluna que tinha valor.
    expect(s2.subs!['b2_1_4'].obrasOverride['4'].qtd).toBe(doServidor)
    // Quem responde "está suja?" é a comparação de conteúdo, e ela dá conta
    // sozinha: valor igual ao do servidor, assinatura igual, ficha limpa.
    expect(sujas(s2)).toEqual([])
  })

  it('SET_CTS_OBRA_FIELD idem, nas 4 obras da CTS', () => {
    const s0 = seededState()
    const doServidor = s0.ctss!['cts_b3_1_1'].obrasOverride['1'].preco!
    const s1 = reducer(s0, {
      type: 'SET_CTS_OBRA_FIELD',
      ctsId: 'cts_b3_1_1',
      index: 1,
      key: 'preco',
      value: '9',
    })
    expect(sujas(s1)).toEqual(['cts:cts_b3_1_1'])
    const s2 = reducer(s1, {
      type: 'SET_CTS_OBRA_FIELD',
      ctsId: 'cts_b3_1_1',
      index: 1,
      key: 'preco',
      value: doServidor,
    })
    expect(s2.ctss!['cts_b3_1_1'].obrasOverride['1'].preco).toBe(doServidor)
    expect(sujas(s2)).toEqual([])
  })

  it('SET_OBRA_FIELD num índice que a ficha não tem NÃO cria a obra', () => {
    // Seria a base literal de volta, uma linha por vez: a obra nasceria do que o
    // cliente mandou, e não do que o banco tem. A tela só renderiza o que veio,
    // então este caminho só se alcança por engano de código.
    const s0 = seededState()
    const antes = s0.subs!['b2_1_4'].obrasOverride
    const s1 = reducer(s0, {
      type: 'SET_OBRA_FIELD',
      subId: 'b2_1_4',
      index: 9,
      key: 'qtd',
      value: '1',
    })
    expect(s1.subs!['b2_1_4'].obrasOverride).toBe(antes)
    expect(sujas(s1)).toEqual([])
  })

  it('reverter um campo não apaga os outros do mesmo índice', () => {
    const s0 = seededState()
    const base = s0.subs!['b2_1_4'].obrasOverride['0'].qtd!
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
    // O índice guarda a obra INTEIRA, e não só o que foi editado. O que este
    // caso protege continua valendo: reverter `qtd` não leva `opex` junto.
    const obra = s3.subs!['b2_1_4'].obrasOverride['0']
    expect(obra.qtd).toBe(base)
    expect(obra.opex).toBe('500')
    expect(obra.nome).toBe(s0.subs!['b2_1_4'].obrasOverride['0'].nome)
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
