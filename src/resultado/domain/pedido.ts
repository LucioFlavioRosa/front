/**
 * AS VARIÁVEIS COM QUE A RODADA FOI PEDIDA.
 *
 * Vem de `controle.run_request.params` — o pedido, e não o que o motor ecoou.
 * São coisas diferentes: `otim_meta.params_extra` guarda cinco chaves que o job
 * escolheu devolver, e o pedido é o que a pessoa mandou pela tela.
 *
 * ## Por que existe, se já há `parametros`
 *
 * `parametros` traz seis campos tipados — os que o card do histórico mostra e a
 * tela sabe formatar. O formulário de simulação tem **mais de vinte**, e os
 * outros dezessete não apareciam em lugar nenhum depois de a rodada existir:
 * penalidade de cobertura, curva de adoção, peso por cidade, anos extras de
 * conclusão, teto de execução, solver, workers.
 *
 * Quem abre "o que foi usado nesta simulação" está tentando reproduzir ou
 * explicar um resultado. Seis de vinte e três responde a pergunta errada.
 */
export type Pedido = Record<string, unknown>

/**
 * Rótulos das chaves do pedido.
 *
 * Os nomes técnicos são deliberados no formulário — a tela de simulação mostra
 * `FOCO_COBERTURA` ao lado de cada controle porque a rastreabilidade com o
 * notebook foi requisito de handoff. Aqui eles ganham o rótulo humano ao lado,
 * e não no lugar: quem compara com o notebook precisa do técnico, quem lê o
 * histórico precisa do outro.
 */
const ROTULOS: Record<string, string> = {
  ORCAMENTO: 'Orçamento por ano',
  ORCAMENTO_TOTAL: 'Orçamento total',
  HORIZONTE_CAPEX: 'Horizonte de CAPEX',
  ETE_FASEADA: 'ETE faseada',
  ETE_FIXO: 'Módulos de ETE fixos',
  METAS_COBERTURA: 'Metas de cobertura',
  PESO_COBERTURA: 'Peso da cobertura',
  FOCO_COBERTURA: 'Foco em cobertura',
  PENALIDADE_COBERTURA: 'Penalidade de cobertura',
  PESO_CIDADE: 'Prioridade por cidade',
  DATA_INICIO: 'Data de início',
  CURVA_ADOCAO: 'Curva de adoção',
  BASE_RECEITA: 'Base de receita',
  USAR_CTS: 'Usar CTS',
  ANOS_EXTRA_CONCLUSAO: 'Anos extras para concluir',
  INCLUIR_INDUSTRIAL: 'Incluir indústria',
  MAX_TIME_S: 'Tempo máximo do solver',
  WORKERS: 'Workers',
}

export function rotuloDoParametro(chave: string): string {
  return ROTULOS[chave] ?? chave
}

const MILHOES = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

/**
 * O valor como uma pessoa o lê.
 *
 * Três formas que o pedido usa e que `String(v)` estragaria:
 *
 *   booleano   `true` vira "sim" — "true" é vocabulário de máquina
 *   orçamento  `{2026: 60000000}` vira "2026: R$ 60 mi" — o JSON cru é
 *              ilegível, e é justamente o parâmetro mais consultado
 *   objeto     `{Cabo Frio: 5}` vira "Cabo Frio: 5"
 *
 * `{}` vira "—", e não "nenhum": prioridade vazia e prioridade não informada
 * são a mesma coisa no pedido, e afirmar qual delas foi seria inventar.
 */
export function valorDoParametro(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'

  if (chave === 'ORCAMENTO' && typeof v === 'object') {
    const anos = Object.entries(v as Record<string, number>)
    if (!anos.length) return '—'
    return anos
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ano, valor]) => `${ano}: R$ ${MILHOES.format(Number(valor) / 1e6)} mi`)
      .join(' · ')
  }

  if (typeof v === 'object') {
    const itens = Object.entries(v as Record<string, unknown>)
    if (!itens.length) return '—'
    return itens.map(([k, valor]) => `${k}: ${String(valor)}`).join(' · ')
  }

  if (typeof v === 'number') {
    // Valor em reais vira milhões; o resto vai como número mesmo. `1e6` como
    // corte porque orçamento é o único parâmetro dessa ordem de grandeza.
    if (chave.startsWith('ORCAMENTO') && v >= 1e6) return `R$ ${MILHOES.format(v / 1e6)} mi`
    return NUM.format(v)
  }
  return String(v)
}

/**
 * As chaves do pedido em ordem de leitura, e não a do JSON.
 *
 * A ordem de um objeto JSON não significa nada, e sem isto o modal listaria
 * `WORKERS` antes de `ORCAMENTO` só porque o servidor serializou assim. Aqui a
 * ordem é a do formulário: primeiro o que define o cenário, depois o que ajusta
 * a execução. Chave desconhecida vai para o fim, em ordem alfabética — ela
 * existe (o job pode ganhar parâmetro novo) e esconder seria pior.
 */
const ORDEM = [
  'ORCAMENTO',
  'ORCAMENTO_TOTAL',
  'HORIZONTE_CAPEX',
  'ANOS_EXTRA_CONCLUSAO',
  'FOCO_COBERTURA',
  'PENALIDADE_COBERTURA',
  'METAS_COBERTURA',
  'PESO_COBERTURA',
  'PESO_CIDADE',
  'BASE_RECEITA',
  'CURVA_ADOCAO',
  'USAR_CTS',
  'INCLUIR_INDUSTRIAL',
  'ETE_FASEADA',
  'ETE_FIXO',
  'DATA_INICIO',
  'MAX_TIME_S',
  'WORKERS',
]

export function ordenarParametros(pedido: Pedido): [string, unknown][] {
  const pos = (k: string) => {
    const i = ORDEM.indexOf(k)
    return i < 0 ? ORDEM.length : i
  }
  return Object.entries(pedido).sort(([a], [b]) => pos(a) - pos(b) || a.localeCompare(b))
}
