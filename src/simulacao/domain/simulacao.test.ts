/**
 * As regras da nova simulação. Testáveis sem tela porque tudo em
 * `domain/simulacao.ts` é função pura — que é o motivo de ter sido escrito assim.
 */
import { describe, expect, it } from 'vitest'
import {
  aceitaFoco,
  bloqueado,
  corpoDaRodada,
  derivarOrcamento,
  estadoInicial,
  etapaDe,
  MILHAO,
  num,
  numOuNulo,
  rotuloFoco,
  validar,
  resumirFaltando,
  type Prontidao,
} from '@/simulacao/domain/simulacao'

const PRONTA: Prontidao = { unidadeId: 'u1', unidadeNome: 'Unidade Litoral', pendencias: 0 }
const PENDENTE: Prontidao = { unidadeId: 'u2', unidadeNome: 'Unidade Serrana', pendencias: 46 }

describe('num — parsing pt-BR com a notação do notebook', () => {
  it('COM vírgula, o ponto é separador de milhar', () => {
    expect(num('1.234,5')).toBe(1234.5)
    expect(num('60.000,00')).toBe(60000)
  })

  it('SEM vírgula, o ponto é decimal — é como o notebook escreve', () => {
    // Esta e a metade da regra que quase todo mundo erra: `0.35` copiado do
    // notebook nao pode virar 35.
    expect(num('0.35')).toBe(0.35)
    expect(num('60.5')).toBe(60.5)
  })

  it('vírgula sozinha é decimal', () => {
    expect(num('0,35')).toBe(0.35)
  })

  it('lixo é RECUSADO, não parcialmente aceito', () => {
    // O projeto de cadastro ja pagou por um parser tolerante: parseFloat('123abc')
    // devolvia 123 e o lixo contaminava CAPEX em silencio. Aqui seria pior — um
    // "12abc" num ano do orcamento viraria verba que ninguem digitou.
    expect(numOuNulo('12abc')).toBeNull()
    expect(numOuNulo('abc')).toBeNull()
    expect(numOuNulo('1.2.3')).toBeNull()
    expect(numOuNulo('')).toBeNull()
    // Para somas e derivacoes, invalido conta como 0.
    expect(num('12abc')).toBe(0)
  })
})

describe('cronograma inválido bloqueia em vez de enviar outra coisa', () => {
  it('ano repetido bloqueia — o rodapé somaria os dois, o payload manda um', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    e.orcamento = [
      { ano: '2026', valor: '10' },
      { ano: '2026', valor: '20' },
    ]
    // O total mostra 30...
    expect(derivarOrcamento(e).total).toBe(30)
    // ...mas o payload so leva um dos dois. Por isso bloqueia.
    expect(Object.keys(corpoDaRodada(e).orcamento ?? {})).toEqual(['2026'])
    const c = validar(e, PRONTA)
    expect(bloqueado(c)).toBe(true)
    expect(c.some((x) => x.texto.includes('repetido'))).toBe(true)
  })

  it('ano ou valor inválido bloqueia', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    e.orcamento = [{ ano: 'abcd', valor: '10' }]
    expect(bloqueado(validar(e, PRONTA))).toBe(true)

    const e2 = { ...estadoInicial(), unidadeId: 'u1' }
    e2.orcamento = [{ ano: '2026', valor: '12abc' }]
    expect(bloqueado(validar(e2, PRONTA))).toBe(true)
  })

  it('verba negativa bloqueia', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    e.orcamento = [{ ano: '2026', valor: '-5' }]
    expect(bloqueado(validar(e, PRONTA))).toBe(true)
  })
})

describe('aceitaFoco — digitação intermediária preservada', () => {
  it('deixa digitar "0", "0," e "0,3" sem reescrever no meio', () => {
    // Quem quer "0,35" digita "0," antes. Corrigir aqui apagaria a digitacao.
    expect(aceitaFoco('0')).toBe('0')
    expect(aceitaFoco('0,')).toBe('0,')
    expect(aceitaFoco('0,3')).toBe('0,3')
  })

  it('clampa o que sai da faixa 0–1', () => {
    // O campo nunca pode exibir numero diferente do que sera enviado.
    expect(aceitaFoco('5')).toBe('1')
    expect(aceitaFoco('-2')).toBe('0')
  })

  it('aceita o extremo 1', () => {
    expect(aceitaFoco('1')).toBe('1')
  })
})

describe('derivarOrcamento', () => {
  it('a janela é derivada dos anos COM verba, não do tamanho da lista', () => {
    const e = estadoInicial()
    e.orcamento = [
      { ano: '2026', valor: '60' },
      { ano: '2027', valor: '0' },
      { ano: '2028', valor: '40' },
    ]
    const d = derivarOrcamento(e)
    expect(d.total).toBe(100)
    // 2027 esta na lista mas nao tem verba: nao entra na contagem.
    expect(d.anosComVerba).toEqual([2026, 2028])
    expect(d.janelaTexto).toBe('2026–2028 (2 anos)')
  })

  it('o pico é o default do teto de execução', () => {
    const e = estadoInicial()
    expect(derivarOrcamento(e).pico).toBe(60)
  })

  it('no modo valor único, replica a verba pelo horizonte', () => {
    const e = {
      ...estadoInicial(),
      modoOrcamento: 'unico' as const,
      orcamentoValor: '50',
      horizonte: '8',
    }
    const d = derivarOrcamento(e)
    expect(d.total).toBe(400)
    expect(d.anosComVerba.length).toBe(8)
  })

  it('cronograma zerado não inventa janela', () => {
    const e = estadoInicial()
    e.orcamento = [{ ano: '2026', valor: '0' }]
    expect(derivarOrcamento(e).janelaTexto).toBe('sem verba')
  })
})

describe('validar — o que bloqueia e o que só avisa', () => {
  it('sem unidade, bloqueia', () => {
    expect(bloqueado(validar(estadoInicial(), undefined))).toBe(true)
  })

  it('cadastro com pendências bloqueia, e diz quantas', () => {
    const e = { ...estadoInicial(), unidadeId: 'u2' }
    const c = validar(e, PENDENTE)
    expect(bloqueado(c)).toBe(true)
    expect(c[0].texto).toContain('46 campos pendentes')
  })

  it('componente faltando vira linha própria, com a ficha e o nome', () => {
    // O total ("46 campos pendentes") não ajuda quem precisa corrigir ISTO: a
    // linha do componente que falta nem aparece na ficha, então a pessoa não tem
    // como descobri-la abrindo a tela. Enquanto havia base literal era pior — a
    // ficha mostrava a linha, preenchida com números de template.
    const c = validar(
      { ...estadoInicial(), unidadeId: 'u2' },
      {
        ...PENDENTE,
        faltando: [
          {
            tipo: 'sub-bacia',
            id: 'a1b25_1_1',
            componente: 'Coletor tronco',
            detalhe: 'Falta o componente Coletor tronco nesta sub-bacia.',
          },
        ],
      },
    )
    expect(bloqueado(c)).toBe(true)
    expect(c.some((x) => x.texto.includes('sub-bacia a1b25_1_1'))).toBe(true)
    expect(c.some((x) => x.texto.includes('Coletor tronco'))).toBe(true)
  })

  it('lista longa é cortada, e o corte DIZ quantos ficaram de fora', () => {
    // Trinta linhas vermelhas viram uma parede que ninguém lê. Silenciar as
    // demais seria pior: a pessoa corrigiria cinco e levaria a mesma recusa.
    const faltando = Array.from({ length: 9 }, (_, i) => ({
      tipo: 'sub-bacia',
      id: `b${i}`,
      componente: 'Rede coletora',
      detalhe: '',
    }))
    const frases = resumirFaltando(faltando)
    expect(frases).toHaveLength(6) // 5 + a linha do resto
    expect(frases[5]).toContain('mais 4')
  })

  it('servidor que não manda `faltando` não quebra o checklist', () => {
    // Compatibilidade com backend anterior a esta mudança: o campo é opcional, e
    // ausência é lista vazia — nunca um estouro no meio do render.
    expect(resumirFaltando(undefined)).toEqual([])
  })

  it('orçamento zerado bloqueia', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1', orcamento: [{ ano: '2026', valor: '0' }] }
    expect(bloqueado(validar(e, PRONTA))).toBe(true)
  })

  it('ignorar as metas AVISA, não bloqueia — é escolha legítima', () => {
    // Bloquear uma escolha incomum treina o usuario a ignorar avisos.
    const e = { ...estadoInicial(), unidadeId: 'u1', fonteMetas: 'ignorar' as const }
    const c = validar(e, PRONTA)
    expect(bloqueado(c)).toBe(false)
    expect(c.some((x) => x.severidade === 'avisa' && x.texto.includes('metas'))).toBe(true)
  })

  it('ETE faseada + módulos fixos avisa da contradição', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1', eteFaseada: true, eteFixo: true }
    expect(validar(e, PRONTA).some((x) => x.severidade === 'avisa')).toBe(true)
  })

  it('prioridade de cidade incompleta avisa que será ignorada', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1', pesos: [{ cidade: '', peso: '5' }] }
    const c = validar(e, PRONTA)
    expect(bloqueado(c)).toBe(false)
    expect(c.some((x) => x.texto.includes('ignorada'))).toBe(true)
  })

  it('tudo em ordem não gera nem bloqueio nem aviso', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    const c = validar(e, PRONTA)
    expect(c.every((x) => x.severidade === 'ok')).toBe(true)
  })
})

describe('corpoDaRodada', () => {
  it('converte milhões para reais', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    const corpo = corpoDaRodada(e)
    expect(corpo.orcamento?.['2026']).toBe(60 * MILHAO)
  })

  it('só manda anos COM verba no cronograma', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1' }
    e.orcamento = [
      { ano: '2026', valor: '60' },
      { ano: '2027', valor: '0' },
    ]
    expect(Object.keys(corpoDaRodada(e).orcamento ?? {})).toEqual(['2026'])
  })

  it('teto vazio vira null, não zero', () => {
    // "vazio" significa "usa o pico"; zero significaria "nao pode executar nada".
    const e = { ...estadoInicial(), unidadeId: 'u1', redistribuir: true, teto: '' }
    expect(corpoDaRodada(e).teto_execucao_anual).toBeNull()
  })

  it('metas ignoradas viram null, como no notebook', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1', fonteMetas: 'ignorar' as const }
    expect(corpoDaRodada(e).metas_cobertura).toBeNull()
  })

  it('descarta prioridade de cidade incompleta', () => {
    const e = {
      ...estadoInicial(),
      unidadeId: 'u1',
      pesos: [
        { cidade: 'Cabo Frio', peso: '5' },
        { cidade: '', peso: '3' },
      ],
    }
    expect(corpoDaRodada(e).peso_cidade).toEqual({ 'Cabo Frio': 5 })
  })

  it('no modo valor único manda orcamento_anual + horizonte, e não o mapa', () => {
    const e = { ...estadoInicial(), unidadeId: 'u1', modoOrcamento: 'unico' as const }
    const corpo = corpoDaRodada(e)
    expect(corpo.orcamento).toBeUndefined()
    expect(corpo.orcamento_anual).toBe(50 * MILHAO)
    expect(corpo.horizonte_capex).toBe(8)
  })

  it('os defaults enviados são os do notebook', () => {
    const corpo = corpoDaRodada({ ...estadoInicial(), unidadeId: 'u1' })
    expect(corpo.foco_cobertura).toBe(1)
    expect(corpo.penalidade_cobertura).toBe('meta+cobertura')
    expect(corpo.anos_extra_conclusao).toBe(3)
    expect(corpo.base_receita).toBe('arrecadada')
    expect(corpo.curva_adocao).toBe('scurve')
    expect(corpo.usar_cts).toBe(true)
    expect(corpo.incluir_industrial).toBe(true)
    expect(corpo.ete_faseada).toBe(true)
    expect(corpo.ete_fixo).toBe(false)
    expect(corpo.max_time_s).toBe(300)
    expect(corpo.workers).toBe(8)
  })
})

describe('rótulos', () => {
  it('o foco ganha um rótulo legível', () => {
    expect(rotuloFoco(0)).toBe('só VPL')
    expect(rotuloFoco(0.5)).toBe('equilíbrio')
    expect(rotuloFoco(1)).toBe('cobertura em 1º lugar')
    expect(rotuloFoco(0.2)).toContain('VPL')
    expect(rotuloFoco(0.8)).toContain('cobertura')
  })

  it('as etapas do progresso seguem a ordem do job', () => {
    expect(etapaDe(0)).toContain('Lendo dados')
    expect(etapaDe(30)).toContain('modelo')
    expect(etapaDe(60)).toContain('solver')
    expect(etapaDe(95)).toContain('Materializando')
    expect(etapaDe(100)).toContain('Concluída')
  })
})
