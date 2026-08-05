/**
 * Parametros de uma nova rodada do otimizador.
 *
 * Tudo aqui e FUNCAO PURA — parser, derivacoes e validacao. E o que permite
 * travar as regras chatas (parsing pt-BR, janela derivada, o que bloqueia a
 * rodada) em teste unitario, sem montar tela.
 *
 * Os defaults vem do notebook de teste, e nao de gosto: sao os valores com que a
 * equipe roda hoje. Mudar um deles muda o resultado de quem so clicar "Iniciar".
 */

/** O orcamento e digitado e exibido em MILHOES; o payload vai em reais. */
export const MILHAO = 1_000_000

export type ModoOrcamento = 'ano' | 'unico'
export type Penalidade = 'meta+cobertura' | 'meta' | 'ligacao'
export type FonteMetas = 'cadastro' | 'ignorar'
export type BaseReceita = 'arrecadada' | 'faturada'
export type CurvaAdocao = 'scurve' | 'linear'

/** Uma linha do cronograma: ano e verba, ambos como TEXTO enquanto se digita. */
export interface LinhaOrcamento {
  ano: string
  valor: string
}

/** Prioridade de uma cidade (`PESO_CIDADE`). Linha incompleta e ignorada. */
export interface PesoCidade {
  cidade: string
  peso: string
}

export interface EstadoSimulacao {
  regionalId: string
  unidadeId: string
  nome: string
  modoOrcamento: ModoOrcamento
  orcamento: LinhaOrcamento[]
  /** Modo "valor unico": verba por ano e quantos anos. */
  orcamentoValor: string
  horizonte: string
  redistribuir: boolean
  teto: string
  anosExtra: string
  foco: string
  penalidade: Penalidade
  fonteMetas: FonteMetas
  pesos: PesoCidade[]
  baseReceita: BaseReceita
  curvaAdocao: CurvaAdocao
  usarCts: boolean
  incluirIndustrial: boolean
  eteFaseada: boolean
  eteFixo: boolean
  dataInicio: string
  maxTimeS: string
  workers: string
}

/**
 * Cronograma padrao do notebook (em milhoes). Nao e exemplo: e o cronograma com
 * que a equipe roda hoje.
 */
const ORCAMENTO_PADRAO: [number, number][] = [
  [2026, 60],
  [2027, 60],
  [2028, 50],
  [2029, 50],
  [2030, 50],
  [2031, 50],
  [2032, 40],
  [2033, 40],
  [2034, 30],
  [2035, 30],
  [2036, 30],
  [2037, 20],
  [2038, 20],
  [2039, 20],
  [2040, 10],
]

export function estadoInicial(): EstadoSimulacao {
  return {
    regionalId: '',
    unidadeId: '',
    nome: '',
    modoOrcamento: 'ano',
    orcamento: ORCAMENTO_PADRAO.map(([ano, v]) => ({ ano: String(ano), valor: String(v) })),
    orcamentoValor: '50',
    horizonte: '8',
    redistribuir: false,
    teto: '',
    anosExtra: '3',
    foco: '1',
    penalidade: 'meta+cobertura',
    fonteMetas: 'cadastro',
    pesos: [],
    baseReceita: 'arrecadada',
    curvaAdocao: 'scurve',
    usarCts: true,
    incluirIndustrial: true,
    eteFaseada: true,
    eteFixo: false,
    dataInicio: '',
    maxTimeS: '300',
    workers: '8',
  }
}

/**
 * Numero em pt-BR, tolerando a notacao do notebook.
 *
 * A regra que resolve a ambiguidade do ponto: SE HA VIRGULA, o ponto e separador
 * de milhar (`1.234,5` = 1234.5). SE NAO HA, o ponto e decimal (`0.35` = 0.35).
 * Sem isso, `0.35` copiado do notebook viraria 35, e `1.234` digitado por um
 * brasileiro viraria 1.234 em vez de 1234.
 */
export function num(v: string | number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (s === '') return 0
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = parseFloat(norm)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Aceita o que esta sendo digitado num campo de 0 a 1.
 *
 * "0", "0," e "0,3" sao estados VALIDOS de digitacao e nao podem ser reescritos
 * no meio — quem tenta digitar "0,35" digita "0," antes. So corrige (clampa)
 * quando o valor sai da faixa, porque o campo nunca deve exibir numero diferente
 * do que sera enviado.
 */
export function aceitaFoco(bruto: string): string {
  if (bruto === '' || /^[01]?[.,]?\d*$/.test(bruto)) {
    const n = num(bruto)
    if (n >= 0 && n <= 1) return bruto
  }
  const clampado = Math.min(1, Math.max(0, num(bruto)))
  return String(clampado).replace('.', ',')
}

export interface DerivadoOrcamento {
  /** Verba de cada ano, em milhoes, na ordem do cronograma. */
  valores: number[]
  /** Soma, em milhoes. */
  total: number
  /** Anos que efetivamente recebem verba, ordenados. */
  anosComVerba: number[]
  /** "2026–2033 (8 anos)" — a janela e DERIVADA, nunca digitada. */
  janelaTexto: string
  /** Maior verba anual; e o default do teto de execucao. */
  pico: number
}

/**
 * Derivacoes do orcamento.
 *
 * A janela de CAPEX NAO e um campo: ela e o intervalo dos anos com verba. Deixar
 * o usuario digitar a janela E o cronograma criaria duas fontes para a mesma
 * verdade, e elas divergiriam no primeiro ano zerado.
 */
export function derivarOrcamento(e: EstadoSimulacao): DerivadoOrcamento {
  let valores: number[]
  let anosComVerba: number[]

  if (e.modoOrcamento === 'ano') {
    valores = e.orcamento.map((l) => num(l.valor))
    anosComVerba = e.orcamento
      .filter((l) => num(l.valor) > 0)
      .map((l) => num(l.ano))
      .sort((a, b) => a - b)
  } else {
    const anos = Math.max(0, Math.round(num(e.horizonte)))
    const porAno = num(e.orcamentoValor)
    valores = Array<number>(anos).fill(porAno)
    const base = num(e.orcamento[0]?.ano) || new Date().getFullYear()
    anosComVerba = porAno > 0 ? Array.from({ length: anos }, (_, i) => base + i) : []
  }

  const total = valores.reduce((a, b) => a + b, 0)
  const janelaTexto = anosComVerba.length
    ? `${anosComVerba[0]}–${anosComVerba[anosComVerba.length - 1]} (${anosComVerba.length} anos)`
    : 'sem verba'

  return { valores, total, anosComVerba, janelaTexto, pico: Math.max(0, ...valores) }
}

/** Rotulo do foco, para o usuario ler o numero sem precisar interpretar. */
export function rotuloFoco(v: number): string {
  if (v === 0) return 'só VPL'
  if (v === 1) return 'cobertura em 1º lugar'
  if (v < 0.35) return 'puxando para VPL'
  if (v > 0.65) return 'puxando para cobertura'
  return 'equilíbrio'
}

export type Severidade = 'bloqueia' | 'avisa' | 'ok'

export interface ItemChecklist {
  severidade: Severidade
  texto: string
}

/** Prontidao do cadastro da unidade — quem manda no bloqueio da rodada. */
export interface Prontidao {
  unidadeId: string
  unidadeNome: string
  pendencias: number
}

/**
 * O checklist e a validacao da tela, na ordem em que o usuario preenche.
 *
 * Bloqueia (✕) so o que impede a rodada de existir: sem unidade, cadastro
 * incompleto, orcamento zerado. Tudo o mais avisa (!) — inclusive coisas que
 * mudam MUITO o resultado, como ignorar as metas. A diferenca importa: bloquear
 * uma escolha legitima porque ela e incomum treina o usuario a ignorar avisos.
 */
export function validar(e: EstadoSimulacao, prontidao: Prontidao | undefined): ItemChecklist[] {
  const itens: ItemChecklist[] = []
  const { total, anosComVerba } = derivarOrcamento(e)

  if (!e.unidadeId || !prontidao) {
    itens.push({ severidade: 'bloqueia', texto: 'Selecione a regional e a unidade.' })
  } else if (prontidao.pendencias > 0) {
    itens.push({
      severidade: 'bloqueia',
      texto: `${prontidao.unidadeNome} tem ${prontidao.pendencias} campos pendentes no cadastro — a simulação fica bloqueada até zerar.`,
    })
  } else {
    itens.push({
      severidade: 'ok',
      texto: `Cadastro de ${prontidao.unidadeNome} completo, sem pendências.`,
    })
  }

  if (total <= 0) {
    itens.push({
      severidade: 'bloqueia',
      texto: 'Informe verba em pelo menos um ano do orçamento.',
    })
  } else {
    itens.push({
      severidade: 'ok',
      texto: `Orçamento de R$ ${total.toLocaleString('pt-BR')} Mi distribuído em ${anosComVerba.length} anos.`,
    })
  }

  if (e.fonteMetas === 'ignorar') {
    itens.push({
      severidade: 'avisa',
      texto:
        'As metas do contrato serão ignoradas nesta rodada — o resultado não pode ser usado para aferir cumprimento.',
    })
  }
  if (e.eteFixo && e.eteFaseada) {
    itens.push({
      severidade: 'avisa',
      texto: 'ETE faseada com número fixo de módulos: a expansão não será otimizada.',
    })
  }
  if (e.pesos.some((p) => p.cidade === '' || p.peso === '')) {
    itens.push({
      severidade: 'avisa',
      texto: 'Há prioridade de cidade incompleta — será ignorada.',
    })
  }

  return itens
}

export function bloqueado(checklist: ItemChecklist[]): boolean {
  return checklist.some((c) => c.severidade === 'bloqueia')
}

/**
 * Corpo do `POST /runs`, na ordem em que o resumo da tela mostra.
 *
 * Duas conversoes acontecem aqui, e so aqui: milhoes viram reais, e os campos
 * vazios viram `null` em vez de 0 — `TETO_EXECUCAO_ANUAL` vazio significa "usa o
 * pico", que e diferente de "teto zero".
 */
export interface CorpoNovaRodada {
  unidade_id: string
  nome: string | null
  orcamento?: Record<string, number>
  orcamento_anual?: number
  horizonte_capex?: number
  redistribuir_orcamento: boolean
  teto_execucao_anual: number | null
  anos_extra_conclusao: number
  foco_cobertura: number
  penalidade_cobertura: Penalidade
  metas_cobertura: 'cadastro' | null
  peso_cidade: Record<string, number>
  base_receita: BaseReceita
  curva_adocao: CurvaAdocao
  usar_cts: boolean
  incluir_industrial: boolean
  ete_faseada: boolean
  ete_fixo: boolean
  data_inicio: string | null
  max_time_s: number
  workers: number
}

export function corpoDaRodada(e: EstadoSimulacao): CorpoNovaRodada {
  const base: CorpoNovaRodada = {
    unidade_id: e.unidadeId,
    nome: e.nome.trim() || null,
    redistribuir_orcamento: e.redistribuir,
    teto_execucao_anual: e.teto.trim() === '' ? null : num(e.teto) * MILHAO,
    anos_extra_conclusao: Math.max(0, Math.round(num(e.anosExtra))),
    foco_cobertura: Math.min(1, Math.max(0, num(e.foco))),
    penalidade_cobertura: e.penalidade,
    // `null` = ignorar as metas nesta rodada; 'cadastro' = usar a aba do cadastro.
    metas_cobertura: e.fonteMetas === 'cadastro' ? 'cadastro' : null,
    peso_cidade: Object.fromEntries(
      e.pesos
        .filter((p) => p.cidade !== '' && p.peso !== '')
        .map((p) => [p.cidade, num(p.peso)] as const),
    ),
    base_receita: e.baseReceita,
    curva_adocao: e.curvaAdocao,
    usar_cts: e.usarCts,
    incluir_industrial: e.incluirIndustrial,
    ete_faseada: e.eteFaseada,
    ete_fixo: e.eteFixo,
    data_inicio: e.dataInicio.trim() || null,
    max_time_s: Math.max(1, Math.round(num(e.maxTimeS))),
    workers: Math.max(1, Math.round(num(e.workers))),
  }

  if (e.modoOrcamento === 'ano') {
    base.orcamento = Object.fromEntries(
      e.orcamento
        .filter((l) => num(l.valor) > 0)
        .map((l) => [String(Math.round(num(l.ano))), num(l.valor) * MILHAO] as const),
    )
  } else {
    base.orcamento_anual = num(e.orcamentoValor) * MILHAO
    base.horizonte_capex = Math.max(0, Math.round(num(e.horizonte)))
  }
  return base
}

/** Etapas do modal de progresso, na ordem em que o job as executa. */
export const ETAPAS = [
  { ate: 20, texto: 'Lendo dados da unidade…' },
  { ate: 45, texto: 'Montando o modelo de otimização…' },
  { ate: 90, texto: 'Resolvendo (solver)…' },
  { ate: 100, texto: 'Materializando as tabelas de resultado…' },
] as const

export function etapaDe(progresso: number): string {
  if (progresso >= 100) return 'Concluída — disponível no histórico.'
  return ETAPAS.find((e) => progresso < e.ate)?.texto ?? ETAPAS[0].texto
}
