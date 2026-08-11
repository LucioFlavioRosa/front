import { describe, expect, it } from 'vitest'
import subbacias from '@/mocks/fixtures/subbacias.json'
import contratoFx from '@/mocks/fixtures/contrato.json'
import etesFx from '@/mocks/fixtures/etes.json'
import {
  camposDaSub,
  capex,
  deTerceiros,
  mkObras,
  num,
  popNovas,
  subPend,
  type SubBacia,
} from '@/cadastro/domain/subbacia'
import { cidadePend, g2Pend, type ContratoPayload } from '@/cadastro/domain/contrato'
import { capacidadeOciosa, etePend, isNova, type Ete } from '@/cadastro/domain/ete'
import ctsFx from '@/mocks/fixtures/cts.json'
import { CTS_CAMPOS, ctsPend, mkObrasCts, OBRAS_POR_CTS, type Cts } from '@/cadastro/domain/cts'

const subs = subbacias.subs as unknown as Record<string, SubBacia>
const contrato = contratoFx as ContratoPayload
const etes = etesFx.etes as unknown as Ete[]
const ete = (id: string) => etes.find((e) => e.id === id)!
const ctss = ctsFx.ctss as unknown as Record<string, Cts>

describe('num()', () => {
  it('converte pt-BR para número', () => {
    expect(num('1.234,5')).toBe(1234.5)
    expect(num('784')).toBe(784)
  })
  it('vazio/invalido = null', () => {
    expect(num('')).toBeNull()
    expect(num('abc')).toBeNull()
  })
  it('recusa número com sujeira junto (parse parcial dá conta errada, calada)', () => {
    expect(num('123abc')).toBeNull()
    expect(num('1.234 hab.')).toBeNull()
    expect(num('R$ 198')).toBeNull()
    expect(num('1,2,3')).toBeNull()
    // "1.2" é digitação pela metade, não mil e duzentos.
    expect(num('1.2')).toBeNull()
  })
  it('aceita negativo, milhar e decimal', () => {
    expect(num('-50')).toBe(-50)
    expect(num('12.345.678')).toBe(12345678)
    expect(num('0,091')).toBe(0.091)
    expect(num(' 784 ')).toBe(784)
  })
})

describe('subPend()', () => {
  it('conta params vazios + campos de obra vazios (wacc e vazInd não contam)', () => {
    // b2_1_4: preco+tarr vazios (2) + obra índice 3 toda vazia (5) = 7
    expect(subPend(subs['b2_1_4'])).toBe(7)
    // b2_1_3: vaz e vazInd vazios = 2 (quem não sabe a vazão total também
    // não sabe a parcela industrial)
    expect(subPend(subs['b2_1_3'])).toBe(1)
    // b1_1_1: tudo preenchido = 0
    expect(subPend(subs['b1_1_1'])).toBe(0)
  })
})

describe('etePend() / isNova()', () => {
  it('ETE nova conta terreno/módulos; existente não', () => {
    expect(isNova(ete('e2'))).toBe(true)
    expect(etePend(ete('e2'))).toBe(1) // modulos vazio
    expect(isNova(ete('e6'))).toBe(false)
    expect(etePend(ete('e6'))).toBe(0) // terreno/módulos ignorados quando não é nova
  })
})

describe('capacidadeOciosa()', () => {
  it('= capacidade nominal − vazão de operação (pt-BR)', () => {
    expect(capacidadeOciosa(ete('e6'))).toBe('72,5') // 302,6 − 230,1
    expect(capacidadeOciosa(ete('e2'))).toBe('0') // 0 − 0
  })
})

describe('cidadePend() / g2Pend()', () => {
  it('cidade sem fim e cobertura conta 2', () => {
    const c5 = contrato.cidades.find((c) => c.id === 'c5')!
    expect(cidadePend(c5, contrato.metas, contrato.fator)).toBe(2)
  })
  it('cidade com meta de pct vazio conta a pendência da meta', () => {
    const c2 = contrato.cidades.find((c) => c.id === 'c2')!
    expect(cidadePend(c2, contrato.metas, contrato.fator)).toBe(1)
  })
  it('total do grupo 02 = 4', () => {
    expect(g2Pend(contrato)).toBe(4)
  })
})

describe('mkObras() / capex()', () => {
  it('monta as obras SÓ com o que o servidor mandou', () => {
    // Havia aqui `BASE_OBRAS`, e `mkObras` mesclava o payload sobre ela. A base
    // saiu (R1/R2): o `GET` passou a mandar `nome` e `un` junto dos números, e a
    // linha inteira vem do banco.
    const obras = mkObras(subs['b1_1_1'].obrasOverride)
    expect(obras).toHaveLength(5)
    expect(obras[0].qtd).toBe('761,6')
    expect(obras[1].nome).toBe('Rede coletora') // veio no payload, não de literal
  })

  it('ficha com componente FALTANDO rende menos linhas — e conta a pendência', () => {
    // O caso que a base literal escondia: ela completava a linha ausente com
    // números de template, a tela mostrava 5 onde havia 4, e a ficha se
    // declarava completa. Agora falta linha, e a falta pesa como obra em branco.
    const { '2': _semTronco, ...quatro } = subs['b1_1_1'].obrasOverride
    expect(mkObras(quatro)).toHaveLength(4)
    expect(subPend({ ...subs['b1_1_1'], obrasOverride: quatro })).toBe(7)
  })
  it('CAPEX = quantidade × preço (calculado)', () => {
    expect(capex('4', '2.500,00')).toContain('10.000') // 4 × 2.500
    expect(capex('', '10')).toBe('—') // sem quantidade = não calcula
  })
})

describe('CTS — a irmã da sub-bacia', () => {
  it('tem 4 componentes, ancorados no coletor de tempo seco', () => {
    // Os nomes vêm do PAYLOAD, e não de uma base literal — a de CTS, aliás,
    // usava o vocabulário da sub-bacia, e regravar a ficha trocava `Tronco` por
    // `Coletor tronco` num banco em que o motor casa pelo nome.
    const obras = mkObrasCts(ctss['cts_b2_1_1'].obrasOverride)
    expect(obras).toHaveLength(OBRAS_POR_CTS)
    expect(obras[0].nome).toBe('Coletor de tempo seco')
    // A CTS não tem "Ligação de esgoto"/"Rede coletora": o coletor ocupa o lugar das duas.
    const nomes = obras.map((o) => o.nome)
    expect(nomes).not.toContain('Ligação de esgoto')
    expect(nomes).not.toContain('Rede coletora')
    // 6 params + 4 obras × 7 campos cobrados.
    expect(CTS_CAMPOS).toBe(33)
  })

  it('ctsPend() conta igual à sub-bacia (wacc e vazInd não contam)', () => {
    // cts_b2_1_1 está completa.
    expect(ctsPend(ctss['cts_b2_1_1'])).toBe(0)
    // cts_b2_1_4: pot vazio (1) + opex da obra 0 (1) + qtd da obra 1 (1).
    expect(ctsPend(ctss['cts_b2_1_4'])).toBe(3)
    // cts_b3_1_1: vaz, vazInd e pot vazios (3) + dur da obra 0 (1).
    expect(ctsPend(ctss['cts_b3_1_1'])).toBe(3)
  })

  it('mkObrasCts() devolve as 4 obras como o servidor as mandou', () => {
    const payload = ctss['cts_b2_1_1'].obrasOverride
    const obras = mkObrasCts(payload)
    expect(obras).toHaveLength(4)
    expect(obras[0].qtd).toBe('412,5')
    // Nada é herdado de lugar nenhum: cada campo é o que veio no índice.
    expect(obras[2].nome).toBe(payload['2'].nome)
    expect(obras[2].preco).toBe(payload['2'].preco)
  })
})

describe('população nova (obras) — campo calculado', () => {
  it('é universo menos atendida hoje, em pt-BR', () => {
    expect(popNovas({ popU: '1.267', popA: '406' })).toBe('861')
    expect(popNovas({ popU: '30.854', popA: '12.650' })).toBe('18.204')
  })

  it('sem um dos dois lados vira travessão (melhor nada que número errado)', () => {
    expect(popNovas({ popU: '', popA: '406' })).toBe('—')
    expect(popNovas({ popU: '1.267', popA: '' })).toBe('—')
    expect(popNovas({ popU: 'n/d', popA: '406' })).toBe('—')
  })

  it('diferença negativa aparece como está: é dado inconsistente do Databricks', () => {
    expect(popNovas({ popU: '100', popA: '150' })).toBe('-50')
  })
})

describe('colunas de obra e pendência', () => {
  it('as restrições de janela vazias não contam (vazio = sem limite)', () => {
    const sub = subs['b1_1_1']
    const base = subPend(sub)
    const comRestricoes = {
      ...sub,
      // Sobrepõe a obra que veio, e não a substitui: sem a base literal, trocar
      // o índice por um objeto de dois campos deixaria os outros cinco vazios —
      // que é justamente o que a base escondia.
      obrasOverride: {
        ...sub.obrasOverride,
        '2': { ...sub.obrasOverride['2'], anoObrig: '2027', proibAte: '2026' },
      },
    }
    // Preencher restrição não tira pendência; deixá-la vazia não cria nenhuma.
    expect(subPend(comRestricoes)).toBe(base)
  })

  it('tempo após predecessoras é obrigatório, como quantidade e execução', () => {
    const sub = subs['b1_1_1']
    const semTPred = {
      ...sub,
      obrasOverride: { ...sub.obrasOverride, '2': { ...sub.obrasOverride['2'], tPred: '' } },
    }
    expect(subPend(semTPred)).toBe(subPend(sub) + 1)
  })

  it('cada obra cobra 7 campos: 5 obras = 35, mais os 5 params = 40', () => {
    expect(camposDaSub(false)).toBe(40)
    expect(camposDaSub(true)).toBe(42) // + população, quando é a régua
  })
})

describe('obra de terceiros (CAPEX 0 com prazo)', () => {
  // A obra sai do PAYLOAD, e não de uma base literal: é o índice 2 de uma ficha
  // de verdade da fixture.
  const modelo = mkObras(subs['b1_1_1'].obrasOverride)[2]
  const obra = (over: Partial<typeof modelo>) => ({ ...modelo, ...over })

  it('quantidade 0 com execução > 0 = alguém faz, mas não é investimento da unidade', () => {
    expect(deTerceiros(obra({ qtd: '0', dur: '8' }))).toBe(true)
    // Preço zerado dá no mesmo: o que importa é o CAPEX resultante.
    expect(deTerceiros(obra({ qtd: '500', preco: '0', dur: '8' }))).toBe(true)
  })

  it('sem prazo, CAPEX 0 é obra que não entra no plano — não é de terceiros', () => {
    expect(deTerceiros(obra({ qtd: '0', dur: '0' }))).toBe(false)
  })

  it('obra com CAPEX não é de terceiros, tendo prazo ou não', () => {
    expect(deTerceiros(obra({ qtd: '10', preco: '1.000,00', dur: '8' }))).toBe(false)
  })

  it('campo em branco não vira classificação nenhuma', () => {
    expect(deTerceiros(obra({ qtd: '0', dur: '' }))).toBe(false)
    expect(deTerceiros(obra({ qtd: '', dur: '8' }))).toBe(false)
  })
})
