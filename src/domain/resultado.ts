/**
 * Tipos do RESULTADO de uma rodada do otimizador.
 *
 * Diferenca fundamental para o resto deste app: aqui e LEITURA PURA. O cadastro
 * tem reducer, rascunho e trilha de override porque o usuario edita; resultado de
 * rodada e imutavel — um `run_id` publicado nunca muda. Por isso nada aqui tem
 * equivalente de escrita, e as queries podem cachear para sempre (ver
 * `api/queriesResultado.ts`).
 *
 * A tela NUNCA reexecuta o otimizador e NUNCA recomputa totais: as tabelas
 * `run_*` ja vem reconciliadas do Databricks (a soma dos VPL por sub-bacia = VPL
 * do plano; CAPEX de `run_mes` = `run_ano` = `run_meta`). Se um numero parecer
 * errado, o bug esta na materializacao, nao aqui.
 */

/** Status do solver, como o CP-SAT devolve. INFEASIBLE = rodada sem resultado. */
export type StatusSolver = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE'

/**
 * Parametros com que a rodada foi feita (de `run_meta`). Aparecem como chips no
 * header em todos os niveis: sem eles, dois resultados diferentes da mesma
 * unidade sao indistinguiveis na tela.
 */
export interface ParametrosRodada {
  /** 'arrecadada' = o que entrou · 'faturada' = o que era para entrar. */
  baseReceita: 'arrecadada' | 'faturada'
  /** CTS orcada a parte (true) ou demanda somada a sub-bacia pareada (false). */
  usarCts: boolean
  /** Anos em que uma obra pode COMECAR (a conclusao pode passar disso). */
  janelaCapex: number
  /** Teto total do orcamento, em R$. */
  orcamento: number
  /** 0 = so VPL · 1 = so cobertura. */
  focoCobertura: number
  incluirIndustrial: boolean
}

/**
 * Um card do historico de simulacoes (nivel 0). E a capa da rodada: o suficiente
 * para comparar rodadas sem abrir nenhuma.
 *
 * Rodada INFEASIBLE nao tem metricas — o solver nao chegou a um plano. Por isso
 * `metricas` e opcional, e a UI mostra o aviso em vez de zeros (que seriam
 * mentira: zero VPL e um resultado, "nao houve resultado" e outra coisa).
 */
export interface RunResumo {
  runId: string
  nome: string
  unidadeId: string
  unidadeNome: string
  dataHora: string
  autor: string
  /** Segundos de solver — ajuda a explicar VIAVEL(limite de tempo). */
  duracaoS: number
  status: StatusSolver
  favorita: boolean
  parametros: ParametrosRodada
  metricas?: MetricasCapa
}

export interface MetricasCapa {
  vpl: number
  capex: number
  /** CAPEX / orcamento, em %. Perto de 100 = o teto foi o gargalo. */
  usoOrcamentoPct: number
  obrasConstruidas: number
  obrasTotal: number
  coberturaFimPct: number
  metasAtingidas: number
  metasTotal: number
  ebitdaTotal: number
}

/** KPIs do nivel global (de `run_meta`). */
export interface RunMeta {
  runId: string
  nome: string
  unidadeId: string
  unidadeNome: string
  dataHora: string
  autor: string
  status: StatusSolver
  /** Texto do solver como ele veio ('OTIMO | OBRIG 3/3', 'VIAVEL(limite de tempo)'). */
  statusTexto: string
  parametros: ParametrosRodada
  kpis: KpisGlobais
}

export interface KpisGlobais {
  vpl: number
  capexTotal: number
  opexTotal: number
  receitaTotal: number
  obrasConstruidas: number
  obrasTotal: number
  obrigatoriasConstruidas: number
  obrigatoriasTotal: number
  subbaciasFaturando: number
  subbaciasTotal: number
  coberturaFimPct: number
  metasAtingidas: number
  metasTotal: number
}

/**
 * Os 6 niveis da cascata. `historico` e a porta de entrada; os outros cinco sao
 * o drill-down descrito na spec.
 */
export type NivelResultado = 'historico' | 'global' | 'cidade' | 'sistema' | 'subbacia' | 'elemento'

/**
 * Ordem canonica da cascata — o breadcrumb e a navegacao dependem dela.
 * `historico` fica fora: ele e a raiz, nao um degrau da rodada.
 */
export const CASCATA: readonly NivelResultado[] = [
  'global',
  'cidade',
  'sistema',
  'subbacia',
  'elemento',
] as const

/**
 * Componentes de obra, nos nomes CANONICOS.
 *
 * Duas regras do handoff moram aqui: "Linha de recalque" e o nome canonico (nao
 * "recalque", nao "linha"), e TRANSPORTE NUNCA E AGRUPADO — Tronco, EEE e Linha
 * de recalque aparecem sempre separados, nunca somados num "Transporte". Agrupar
 * esconde exatamente o que o usuario precisa ver para entender o gargalo.
 */
export const COMPONENTES_SUBBACIA = [
  'Ligação de esgoto',
  'Rede coletora',
  'Tronco',
  'EEE',
  'Linha de recalque',
] as const

/** A CTS tem 4 obras proprias, ancoradas no coletor em vez da ligacao. */
export const COMPONENTES_CTS = [
  'Coletor de tempo seco',
  'Tronco',
  'EEE',
  'Linha de recalque',
] as const

/** Situacao de uma obra na topologia e nas tabelas — dirige a cor. */
export type SituacaoObra = 'construida' | 'nao-construida' | 'terceiro' | 'sem-obra'

/**
 * Estrutura que aparece como no da topologia. A CTS e visualmente distinta
 * (cabecalho azul, selo "· CTS", "↔ sub-bacia pareada") porque e uma decisao de
 * negocio diferente, nao uma sub-bacia qualquer.
 */
export type TipoEstrutura = 'subbacia' | 'cts'
