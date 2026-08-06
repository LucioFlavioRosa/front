/**
 * Geometria dos graficos. Testavel sem DOM porque tudo em `lib/svg.ts` e funcao
 * pura de dados para coordenadas — foi por isso que a camada de graficos foi
 * escrita assim em vez de com uma biblioteca.
 */
import { describe, expect, it } from 'vitest'
import {
  areaSob,
  caminho,
  escala,
  limites,
  marcas,
  passoBonito,
  passosCascata,
} from '@/resultado/lib/svg'

describe('escala', () => {
  it('mapeia o dominio no alcance', () => {
    const e = escala([0, 100], [0, 200])
    expect(e(0)).toBe(0)
    expect(e(50)).toBe(100)
    expect(e(100)).toBe(200)
  })

  it('dominio degenerado devolve o meio, em vez de dividir por zero', () => {
    // Acontece de verdade: cidade com um unico ano de dado.
    const e = escala([7, 7], [0, 200])
    expect(e(7)).toBe(100)
    expect(Number.isNaN(e(7))).toBe(false)
  })
})

describe('limites', () => {
  it('sempre inclui o zero', () => {
    // Cortar a base num grafico de dinheiro exagera a diferenca entre as barras
    // e mente sobre a proporcao.
    const [min, max] = limites([120, 140, 160])
    expect(min).toBe(0)
    expect(max).toBeGreaterThanOrEqual(160)
  })

  it('acomoda valores negativos', () => {
    const [min, max] = limites([-80, 40])
    expect(min).toBeLessThanOrEqual(-80)
    expect(max).toBeGreaterThanOrEqual(40)
  })

  it('lista vazia nao quebra', () => {
    expect(limites([])).toEqual([0, 1])
  })
})

describe('passoBonito', () => {
  it('escolhe 1, 2, 2.5 ou 5 vezes uma potencia de 10', () => {
    expect(passoBonito(0.9)).toBe(1)
    expect(passoBonito(1.7)).toBe(2)
    expect(passoBonito(2.3)).toBe(2.5)
    expect(passoBonito(4)).toBe(5)
    expect(passoBonito(17)).toBe(20)
  })
})

describe('marcas', () => {
  it('cobre o intervalo inteiro', () => {
    const m = marcas([0, 100])
    expect(m[0]).toBe(0)
    expect(m[m.length - 1]).toBeGreaterThanOrEqual(100)
  })
})

describe('passosCascata', () => {
  const parcelas = [
    { rotulo: 'Receita', valor: 100, tipo: 'entra' as const },
    { rotulo: 'CAPEX', valor: -60, tipo: 'sai' as const },
    { rotulo: 'OPEX', valor: -10, tipo: 'sai' as const },
    { rotulo: 'VPL', valor: 30, tipo: 'total' as const },
  ]

  it('cada barra comeca onde a anterior parou', () => {
    const p = passosCascata(parcelas)
    expect(p[0]).toMatchObject({ de: 0, ate: 100 })
    expect(p[1]).toMatchObject({ de: 100, ate: 40 })
    expect(p[2]).toMatchObject({ de: 40, ate: 30 })
  })

  it('o total e desenhado do zero, nao flutuando', () => {
    // Tratar o total como mais uma parcela desenharia uma barra solta no ar em
    // vez do valor final — o erro classico de waterfall feito a mao.
    const p = passosCascata(parcelas)
    expect(p[3]).toMatchObject({ de: 0, ate: 30 })
  })

  it('o acumulado antes do total bate com o total', () => {
    const p = passosCascata(parcelas)
    expect(p[2].ate).toBe(parcelas[3].valor)
  })
})

describe('caminho e area', () => {
  it('gera M/L a partir dos pontos', () => {
    expect(
      caminho([
        [0, 0],
        [10, 5],
      ]),
    ).toBe('M0.0,0.0 L10.0,5.0')
  })

  it('area fecha na linha de base', () => {
    const d = areaSob(
      [
        [0, 10],
        [20, 4],
      ],
      50,
    )
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('L20.0,50.0')
    expect(d).toContain('L0.0,50.0')
  })

  it('sem pontos devolve vazio em vez de caminho invalido', () => {
    expect(caminho([])).toBe('')
    expect(areaSob([], 0)).toBe('')
  })
})
