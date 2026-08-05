/**
 * Escalas e caminhos para os graficos das telas de resultado.
 *
 * Tudo aqui e FUNCAO PURA de dados para coordenadas — nada de React, nada de
 * DOM. E o que torna a matematica dos graficos testavel sem renderizar: dá para
 * travar "a barra do teto fica acima da barra do ano" ou "a cascata fecha no
 * total" num teste unitario.
 *
 * Por que nao uma biblioteca: os 7 graficos do handoff sao estaticos (nenhum tem
 * zoom, brush ou pan) e tres deles — cascata, losangos de meta e duplo eixo com
 * anotacao — sao justamente o que as bibliotecas cobram caro para customizar. O
 * protótipo ja resolveu a geometria; isto e a transcricao dela.
 */

export interface Caixa {
  /** Area util do desenho, ja descontadas as margens dos eixos. */
  x: number
  y: number
  largura: number
  altura: number
}

/**
 * Margens padrao. Generosas de proposito: o topo precisa caber o rotulo do eixo Y
 * e os valores escritos acima das barras sem encostar na borda; a esquerda,
 * "R$ mi" mais o maior numero do eixo.
 */
export const MARGEM = { topo: 30, direita: 20, baixo: 34, esquerda: 60 }

export function areaUtil(largura: number, altura: number, margem = MARGEM): Caixa {
  return {
    x: margem.esquerda,
    y: margem.topo,
    largura: Math.max(0, largura - margem.esquerda - margem.direita),
    altura: Math.max(0, altura - margem.topo - margem.baixo),
  }
}

/**
 * Escala linear de um dominio para um alcance de pixels.
 * Dominio degenerado (min == max) devolve o meio do alcance em vez de dividir
 * por zero — acontece de verdade: uma cidade com um unico ano de dado.
 */
export function escala(dominio: [number, number], alcance: [number, number]) {
  const [d0, d1] = dominio
  const [a0, a1] = alcance
  const span = d1 - d0
  return (v: number): number => (span === 0 ? (a0 + a1) / 2 : a0 + ((v - d0) / span) * (a1 - a0))
}

/**
 * Limites "redondos" para o eixo, sempre incluindo o zero.
 *
 * Incluir o zero e uma decisao, nao um detalhe: num grafico de dinheiro, cortar
 * a base exagera a diferenca entre as barras e mente sobre a proporcao.
 */
export function limites(valores: number[]): [number, number] {
  const finitos = valores.filter((v) => Number.isFinite(v))
  if (finitos.length === 0) return [0, 1]
  const min = Math.min(0, ...finitos)
  const max = Math.max(0, ...finitos)
  if (min === max) return [0, max === 0 ? 1 : max * 1.1]
  const passo = passoBonito((max - min) / 4)
  return [Math.floor(min / passo) * passo, Math.ceil(max / passo) * passo]
}

/** 1, 2, 2.5 ou 5 vezes uma potencia de 10 — os passos que leem bem num eixo. */
export function passoBonito(bruto: number): number {
  if (bruto <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)))
  const norm = bruto / exp
  const escolhido = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return escolhido * exp
}

/** Marcas do eixo, incluindo os extremos. */
export function marcas([min, max]: [number, number], quantas = 4): number[] {
  if (min === max) return [min]
  const passo = passoBonito((max - min) / quantas)
  const saida: number[] = []
  for (let v = min; v <= max + passo / 2; v += passo) saida.push(Number(v.toFixed(6)))
  return saida
}

/** `M x,y L x,y ...` a partir de pontos ja em pixels. */
export function caminho(pontos: [number, number][]): string {
  if (pontos.length === 0) return ''
  return pontos
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

/** Poligono fechado ate a linha de base — a area sob uma curva. */
export function areaSob(pontos: [number, number][], base: number): string {
  if (pontos.length === 0) return ''
  const p = caminho(pontos)
  const [xIni] = pontos[0]
  const [xFim] = pontos[pontos.length - 1]
  return `${p} L${xFim.toFixed(1)},${base.toFixed(1)} L${xIni.toFixed(1)},${base.toFixed(1)} Z`
}

/**
 * Passos de uma cascata: para cada parcela, de onde a barra comeca e onde
 * termina, no acumulado.
 *
 * A ultima parcela (`tipo: 'total'`) nao acumula — ela e desenhada do zero ate o
 * proprio valor, porque ela E o acumulado. Confundir isso desenha uma barra
 * flutuante no lugar do total.
 */
export interface PassoCascata {
  rotulo: string
  valor: number
  tipo: 'entra' | 'sai' | 'total'
  /** Base e topo em unidades do dominio (nao em pixels). */
  de: number
  ate: number
}

export function passosCascata(
  parcelas: { rotulo: string; valor: number; tipo: 'entra' | 'sai' | 'total' }[],
): PassoCascata[] {
  let acc = 0
  return parcelas.map((p) => {
    if (p.tipo === 'total') return { ...p, de: 0, ate: p.valor }
    const de = acc
    acc += p.valor
    return { ...p, de, ate: acc }
  })
}

/** Losango (meta de cobertura) centrado num ponto. */
export function losango(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}
