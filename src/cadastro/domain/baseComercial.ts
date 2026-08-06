/**
 * CAMPOS DA FICHA DE COLETA — sub-bacia e CTS, em UM lugar so.
 *
 * As duas telas mostram exatamente o mesmo conjunto (a CTS e a irma da
 * sub-bacia). A lista viveu duplicada nas duas por um tempo, e foi assim que
 * uma coluna nova entrou numa e nao na outra — daqui em diante, campo novo
 * entra aqui e aparece nos dois lugares.
 *
 * Duas origens, dois blocos na tela:
 *  - `CAMPOS_DB`: veio do Databricks (travado, corrigivel com override).
 *    Ligacoes e economias ficam sempre visiveis, e o trio que e a regua da meta
 *    daquela cidade ganha destaque.
 *  - `CAMPOS_POPULACAO`: a Regional preenche, e SO aparece quando a cidade mede
 *    a meta por populacao. Como e campo do usuario, conta pendencia: se a regua
 *    virar populacao depois, os campos entram vazios, a completude cai e o hub
 *    trava a simulacao ate alguem preencher — que e o que torna seguro mostrar
 *    esses campos so quando eles valem.
 */
import type { SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'

/** Regua de cobertura do contrato (`Cidade.cob`). */
export type Regua = 'ligacoes' | 'economias' | 'populacao'

export const NOME_DA_REGUA: Record<Regua, string> = {
  ligacoes: 'ligações',
  economias: 'economias',
  populacao: 'população',
}

/** `Cidade.cob` e string livre no payload: so vira Regua se for uma das tres. */
export function reguaDe(cob: string | undefined): Regua | null {
  return cob === 'ligacoes' || cob === 'economias' || cob === 'populacao' ? cob : null
}

export interface CampoDb {
  rotulo: string
  chave: keyof SubBaciaDb
  unidade: string
  /** Trio de cobertura a que o campo pertence (receita e ticket nao tem). */
  regua?: Regua
  /**
   * Chave do verbete no dicionario. So os campos cuja LEITURA tem regra
   * propria ganham "?" — o recorte industrial, porque "parcela ja contida no
   * total" e o tipo de coisa que ninguem adivinha olhando a celula.
   */
  dict?: string
}

/**
 * 13 celulas do card travado. A ordem agrupa por sentido, e a grade do
 * prototipo tem 4 colunas — cada bloco cai numa linha:
 *   receita total + inicio das ligacoes · fim das ligacoes + economias ·
 *   recorte industrial · ticket.
 */
export const CAMPOS_DB: CampoDb[] = [
  { rotulo: 'Receita faturada (12m)', chave: 'fat', unidade: 'R$/mês' },
  { rotulo: 'Receita arrecadada (12m)', chave: 'arr', unidade: 'R$/mês' },

  { rotulo: 'Ligações — universo', chave: 'ligU', unidade: '', regua: 'ligacoes' },
  { rotulo: 'Ligações atuais', chave: 'ligA', unidade: '', regua: 'ligacoes' },
  { rotulo: 'Ligações novas (obras)', chave: 'ligN', unidade: '', regua: 'ligacoes' },

  { rotulo: 'Economias — universo', chave: 'ecoU', unidade: '', regua: 'economias' },
  { rotulo: 'Economias atuais', chave: 'ecoA', unidade: '', regua: 'economias' },
  { rotulo: 'Economias novas (obras)', chave: 'ecoN', unidade: '', regua: 'economias' },

  // Recorte industrial: as mesmas medidas do topo, so da categoria industria.
  // Sem `regua` de proposito — nao e denominador de meta; e o que explica o
  // ticket, porque industria e pouca ligacao respondendo por muita receita.
  {
    rotulo: 'Ligações industriais — universo',
    chave: 'ligUInd',
    unidade: '',
    dict: 'universo_ligacoes_industrial',
  },
  {
    rotulo: 'Ligações industriais atuais',
    chave: 'ligAInd',
    unidade: '',
    dict: 'ligacoes_atuais_industrial',
  },
  {
    rotulo: 'Receita faturada industrial (12m)',
    chave: 'fatInd',
    unidade: 'R$/mês',
    dict: 'receita_faturada_industrial',
  },
  {
    rotulo: 'Receita arrecadada industrial (12m)',
    chave: 'arrInd',
    unidade: 'R$/mês',
    dict: 'receita_arrecadada_industrial',
  },

  { rotulo: 'Ticket derivado ƒ', chave: 'ticket', unidade: '/ligação' },
]

/** Chaves de `db` que a ficha espera — usado para conferir formato de rascunho. */
export const CHAVES_DB = CAMPOS_DB.map((c) => c.chave)

/** Campo do usuario: [rotulo, chave, dictKey, unidade, placeholder, ajuda]. */
export type CampoParam = [string, keyof SubBaciaParams, string, string, string, string]

/**
 * Parametros que a Regional preenche — os mesmos na sub-bacia e na CTS.
 *
 * A unica diferenca real entre as duas telas e a explicacao da vazao (a da CTS
 * e captada em tempo seco), entao ela vem por parametro em vez de a lista
 * inteira viver duplicada nas duas paginas — foi assim que uma coluna nova ja
 * entrou numa tela e nao na outra.
 */
// prettier-ignore
export function camposParametros(escopo: 'sub-bacia' | 'cts'): CampoParam[] {
  const vazao = escopo === 'cts'
    ? 'Vazão NOVA captada em tempo seco. Dimensiona a ETE e o rateio das obras compartilhadas.'
    : 'Vazão NOVA quando conectada. Dimensiona a ETE e o rateio das obras compartilhadas.'
  return [
    ['Taxa de ligação', 'preco', 'preco_por_ligacao', 'R$/lig', 'R$', 'Cobrada uma única vez ao conectar, POR LIGAÇÃO. Receita indireta no ano da conexão.'],
    ['Início da arrecadação', 'tarr', 'tempo_arrecadacao', 'meses', 'meses', 'Tempo entre a obra ficar pronta e começar a faturar.'],
    ['Rampa de adesão', 'ramp', 'tempo_ramp_up', 'meses', 'meses', 'Tempo até a adesão plena. A receita cresce em curva S até o pleno neste prazo.'],
    ['Vazão nova', 'vaz', 'vazao_contribuicao', 'L/s', 'vazão', vazao],
    ['Vazão nova industrial', 'vazInd', 'vazao_contribuicao_industrial', 'L/s', '0', 'Parcela industrial da vazão acima — já contida nela, não some as duas. Sem indústria na área, informe 0.'],
    ['Potencial de crescimento', 'pot', 'potencial_crescimento', 'fator', '1,0', 'Multiplica o universo de ligações (1,0 = sem). Só amplia o denominador da meta.'],
  ]
}

/** Campo de populacao preenchido pela Regional: [rotulo, chave, dictKey, unidade, placeholder, ajuda]. */
export type CampoPopulacao = [
  string,
  keyof Pick<SubBaciaParams, 'popU' | 'popA'>,
  string,
  string,
  string,
  string,
]

export const CAMPOS_POPULACAO: CampoPopulacao[] = [
  [
    'População — universo',
    'popU',
    'universo_populacao',
    'hab.',
    'habitantes',
    'Toda a população da área, atendida ou não. É o denominador da meta desta cidade.',
  ],
  [
    'População atendida hoje',
    'popA',
    'populacao_atual',
    'hab.',
    'habitantes',
    'População que já tem coleta de esgoto hoje, antes das obras deste plano.',
  ],
]
