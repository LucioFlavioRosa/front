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

// ===========================================================================
//  NIVEL 1 — painel global
// ===========================================================================

/**
 * Uma parcela da cascata (waterfall). O mesmo tipo serve aos tres niveis que tem
 * cascata (global, cidade e sub-bacia) — e por isso o componente de grafico e um
 * so.
 *
 * `tipo` dirige a cor pela SEMANTICA, nao pelo sinal: o total e ink escuro mesmo
 * sendo positivo, porque ele nao "entra valor" — ele E o valor.
 */
export interface ParcelaCascata {
  rotulo: string
  valor: number
  tipo: 'entra' | 'sai' | 'total'
}

/** Uma linha de `run_ano`: desembolso, receita e o teto daquele ano. */
export interface AnoFinanceiro {
  ano: number
  capex: number
  opex: number
  receita: number
  /** Teto anual de CAPEX. Nulo = ano fora da janela de orcamento. */
  tetoCapex: number | null
}

/** Ponto da curva S (`run_mes`), ja acumulado pelo backend. */
export interface PontoCurvaS {
  /** ISO 'AAAA-MM'. */
  mes: string
  capexAcumulado: number
  /** CAPEX do mes — o tooltip mostra os dois. */
  capexMes: number
}

/** CAPEX somado por componente (`run_obra`). Transporte NUNCA agrupado. */
export interface CapexPorComponente {
  componente: string
  capex: number
  pctDoTotal: number
}

/** Uma barra do histograma de VPL por sub-bacia. */
export interface FaixaVpl {
  de: number
  ate: number
  quantidade: number
}

/** Obras iniciadas num ano, quebradas por componente (barra empilhada). */
export interface ObrasDoAno {
  ano: number
  porComponente: { componente: string; quantidade: number }[]
}

/** EBITDA de um ano — saida CALCULADA, fora da funcao objetivo. */
export interface EbitdaAno {
  ano: number
  ebitda: number
  /** EBITDA / receita operacional. Nulo quando nao houve receita no ano. */
  margemPct: number | null
}

/** Tudo que o nivel global desenha, num payload so. */
export interface PainelGlobal {
  anos: AnoFinanceiro[]
  curvaS: PontoCurvaS[]
  cascata: ParcelaCascata[]
  capexPorComponente: CapexPorComponente[]
  histogramaVpl: FaixaVpl[]
  subbaciasPositivas: number
  subbaciasNegativas: number
  obrasPorAno: ObrasDoAno[]
  /** Ano em que o CAPEX termina — vira linha de referencia em varios graficos. */
  fimCapex: number
}

/** Serie de EBITDA + total, da unidade ou de uma cidade. */
export interface PainelEbitda {
  anos: EbitdaAno[]
  total: number
  /** Primeiro ano com EBITDA positivo; nulo se nunca vira. */
  anoViraPositivo: number | null
  fimCapex: number
}

/** Linha da tabela de cidades do nivel global. */
export interface CidadeLinha {
  id: string
  nome: string
  vpl: number
  capex: number
  coberturaFimPct: number
  metasAtingidas: number
  metasTotal: number
  sistemas: number
}

// ===========================================================================
//  NIVEL 2 — cidade
// ===========================================================================

/** Um ponto da curva de cobertura da cidade (`run_cobertura`). */
export interface PontoCobertura {
  ano: number
  coberturaPct: number
}

/** Uma meta de cobertura (`run_meta_cobertura`). */
export interface MetaCobertura {
  ano: number
  alvoPct: number
  realizadoPct: number
  atingida: boolean
  /** Meta fora da janela de CAPEX nao e cobrada da rodada. */
  dentroDaJanela: boolean
}

/**
 * Uma faixa da escada de paridade cadastrada (`snapshot__fator_esgoto`):
 * a partir de `coberturaPct` de cobertura, a paridade vale `paridade`.
 */
export interface FaixaParidade {
  coberturaPct: number
  paridade: number
  /** Faixa em que a cidade estava antes do plano. */
  ehBase: boolean
  /** Faixa em que a cidade termina o plano. */
  ehFinal: boolean
}

/**
 * Paridade esgoto/agua e o efeito-base.
 *
 * A causalidade que a tela e OBRIGADA a explicitar: o degrau de faixa e a origem
 * da barra "Efeito-base paridade" da cascata, porque o reajuste vale tambem para
 * as ligacoes JA existentes — nao so para as novas.
 */
export interface Paridade {
  faixas: FaixaParidade[]
  paridadeInicial: number
  paridadeFinal: number
  /** Houve mudanca de faixa? Sem degrau, nao ha efeito-base. */
  houveDegrau: boolean
  /** VP do efeito-base, em R$. */
  vpEfeitoBase: number
  /** Quanto o efeito-base representa do VPL da cidade. */
  pctDoVplDaCidade: number
}

/** Linha da tabela de sistemas da cidade. */
export interface SistemaLinha {
  id: string
  nome: string
  subbacias: number
  faturando: number
  capex: number
  /** Ocupacao da ETE. NULO quando a capacidade e 0 — a tela mostra "—", nao 0%. */
  ocupacaoPct: number | null
}

export interface CidadeDetalhe {
  id: string
  nome: string
  /** Ano do fim da concessao — o eixo da cobertura vai ate ele. */
  fimConcessao: number
  fimCapex: number
  capexTotal: number
  vpl: number
  ligacoesNovas: number
  coberturaBasePct: number
  coberturaFinalPct: number
  cobertura: PontoCobertura[]
  metas: MetaCobertura[]
  cascata: ParcelaCascata[]
  paridade: Paridade
  sistemas: SistemaLinha[]
}

// ===========================================================================
//  NIVEL 3 — topologia do sistema
// ===========================================================================

/** Um componente dentro de um no da topologia. */
export interface ComponenteNo {
  /** Nome canonico (ver COMPONENTES_SUBBACIA / COMPONENTES_CTS). */
  nome: string
  /** Id da obra — leva ao nivel 5. */
  obraId: string | null
  situacao: SituacaoObra
  capex: number
  precoUnitario: number | null
  quantidade: number | null
  unidade: string | null
  anoInicio: number | null
  /** Meses de execucao — o que aparece em "terceiro · prazo 7m". */
  prazoMeses: number | null
}

export interface NoTopologia {
  id: string
  tipo: TipoEstrutura
  vazao: number
  /** Sub-bacia que fatura tem cabecalho teal; a que nao fatura, ink. */
  fatura: boolean
  /** Só para CTS: a sub-bacia pareada 1:1 (de `snapshot__subbacia_cts`). */
  pareadaCom: string | null
  /** Para onde escoa. `null` = liga direto na ETE. */
  jusante: string | null
  componentes: ComponenteNo[]
}

export interface EteTopologia {
  id: string
  nome: string
  /** Capacidade instalada. Zero e possivel — e o caso que gera ocupacao nula. */
  capacidade: number
  vazaoConectada: number
  /** NULO quando a capacidade e 0: a conta nao existe, e a tela mostra "—". */
  ocupacaoPct: number | null
  /** Em vermelho quando > 0. */
  vazaoNaoAtendida: number
  modulos: ComponenteNo[]
}

export interface Topologia {
  sistemaId: string
  sistemaNome: string
  cidadeId: string
  cidadeNome: string
  subbacias: number
  faturando: number
  capexConstruido: number
  nos: NoTopologia[]
  ete: EteTopologia
}

// ===========================================================================
//  NIVEL 4 — sub-bacia (explicabilidade)
// ===========================================================================

/** Receita da sub-bacia num ano (`run_subbacia_ano`). */
export interface ReceitaAno {
  ano: number
  direta: number
  /** So aparece no ano da conexao — o tooltip diz isso. */
  indireta: number
}

/**
 * A explicabilidade que hoje sai como texto de console e vira UI estruturada.
 * `elo` e o que trava a cadeia: um id de obra, que a tela linka para o nivel 5.
 */
export interface Explicacao {
  categoria: string
  elo: string | null
  narrativa: string
  /** "Se fosse ligada agora", em valor presente. */
  seFosseLigada: {
    receita: number
    capexSozinha: number
    opex: number
    saldoSozinha: number
    saldoComRateio: number
  } | null
}

/** Linha da tabela de elementos da sub-bacia. */
export interface ElementoLinha {
  obraId: string
  componente: string
  situacao: SituacaoObra
  capex: number
  anoInicio: number | null
}

export interface SubBaciaDetalhe {
  id: string
  tipo: TipoEstrutura
  pareadaCom: string | null
  cidadeId: string
  cidadeNome: string
  sistemaId: string
  sistemaNome: string
  fatura: boolean
  vazao: number
  vpl: number
  cascata: ParcelaCascata[]
  receita: ReceitaAno[]
  explicacao: Explicacao
  /** Caminho de jusante ate a ETE, na ordem. */
  caminho: string[]
  elementos: ElementoLinha[]
}

// ===========================================================================
//  NIVEL 5 — elemento (a obra)
// ===========================================================================

/** Quem rateia esta obra. As fracoes somam 1 (o portao de qualidade garante). */
export interface DependenciaObra {
  subbaciaId: string
  vazao: number
  fracaoRateio: number
  capexRateado: number
  fatura: boolean
}

export interface ObraDetalhe {
  obraId: string
  componente: string
  /** Nome exibido, com "(CTS)" quando a obra e de um no de CTS. */
  rotulo: string
  situacao: SituacaoObra
  cidadeId: string
  cidadeNome: string
  sistemaId: string
  sistemaNome: string
  subbaciaId: string
  /** 'Aegea' ou 'Terceiro'. Obra de terceiro nao consome orcamento. */
  responsavel: string
  obrigatoria: boolean
  quantidade: number | null
  unidade: string | null
  precoUnitario: number | null
  capex: number
  opexAno: number
  prazoMeses: number | null
  mesMaisCedo: number | null
  wacc: number
  /**
   * De onde veio o WACC: 'proprio' = financiamento contratado para a obra;
   * 'medio' = o campo veio vazio e herdou o `wacc_medio` da unidade. A tela e
   * obrigada a mostrar a origem — sao coisas economicamente diferentes.
   */
  waccOrigem: 'proprio' | 'medio'
  dataInicio: string | null
  dataPronta: string | null
  categoria: string | null
  elo: string | null
  narrativa: string | null
  dependencias: DependenciaObra[]
}
