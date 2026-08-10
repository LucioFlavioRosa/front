import { CAMPOS_DB, camposParametros } from '@/cadastro/domain/baseComercial'

/**
 * UMA MUDANÇA NO CADASTRO — quem mudou o quê, quando.
 *
 * Vem de `GET /unidades/:uid/alteracoes`. A trilha existe no banco desde a
 * primeira migração e por muito tempo **ninguém conseguia lê-la**: era gravada,
 * crescia, e responder "quem mudou este preço em julho" exigia SQL na mão.
 *
 * Ela também cobria só um quarto da ficha — o bloco do Databricks. `params`,
 * obras, cidade e ETE não deixavam rastro nenhum, porque quem montava a trilha
 * era o FRONT, e o front só a montava para os campos travados. Hoje quem compara
 * o gravado com o que chega é o servidor, e a cobertura é a ficha inteira.
 */
export interface Alteracao {
  /** `sub-bacia` | `cts` | `ete` | `cidade`. */
  tipo: string
  fichaId: string
  /** Chave do campo. Ver `rotuloDoCampo` — há três formas compostas. */
  campo: string
  /** Valor anterior. `null` = não existia (foi criado). */
  de: string | null
  /** Valor novo. `null` = deixou de existir (foi removido). */
  para: string | null
  autor: string
  /** ISO-8601 com fuso. */
  quando: string
  /** `databricks` = correção de número de fora; `regional` = campo da Regional. */
  origem: string
}

export interface AlteracoesPayload {
  alteracoes: Alteracao[]
  /** O servidor cortou no teto: isto NÃO é o histórico inteiro. */
  cortado: boolean
}

/**
 * Rótulos dos campos simples, montados a partir das MESMAS listas que desenham
 * a ficha — e não de uma tabela paralela.
 *
 * Uma segunda lista de rótulos envelheceria: alguém renomeia "Taxa de ligação"
 * na tela, e o histórico continua chamando pelo nome antigo. Como a fonte é a
 * mesma, os dois mudam juntos ou nenhum muda.
 */
const ROTULOS: Record<string, string> = {
  ...Object.fromEntries(CAMPOS_DB.map((c) => [c.chave, c.rotulo])),
  ...Object.fromEntries(camposParametros('sub-bacia').map(([rotulo, chave]) => [chave, rotulo])),
  ...Object.fromEntries(camposParametros('cts').map(([rotulo, chave]) => [chave, rotulo])),
  // Cidade e ETE não têm lista equivalente exportada; estes são os campos que a
  // trilha alcança, com o rótulo que a tela usa.
  fim: 'Fim da concessão',
  cob: 'Unidade de cobertura',
  capMod: 'Capacidade por módulo',
  capexMod: 'CAPEX por módulo',
  opexMod: 'OPEX por módulo',
  tExec: 'Tempo de execução',
  capNom: 'Capacidade nominal atual',
  vazOp: 'Vazão de operação atual',
  terreno: 'CAPEX do terreno',
  modulos: 'Módulos',
  nova: 'É nova',
  wacc: 'WACC',
  // Campos de obra, usados depois do nome do componente.
  qtd: 'quantidade',
  preco: 'preço unitário',
  opex: 'OPEX',
  tPred: 'tempo após predecessoras',
  dur: 'execução',
  anoObrig: 'obrigatória em',
  proibAte: 'proibida até',
  un: 'unidade',
}

/**
 * `obra:Rede coletora:qtd` → `Rede coletora — quantidade`.
 *
 * O servidor grava três formas compostas, e todas usam a IDENTIDADE do registro,
 * não a posição dele:
 *
 *   `obra:<componente>:<campo>`   a obra não tem id próprio; quem a identifica
 *                                 na tela é o nome do componente
 *   `meta:<ano>:pct`              a meta é identificada pelo ano
 *   `faixa:<cobertura>:paridade`  a faixa, pela cobertura
 *
 * Por índice (`obra:2:qtd`) seria mais curto e não diria nada a quem abre a
 * auditoria seis meses depois — e mudaria de significado se a ordem mudasse.
 *
 * Campo desconhecido volta como veio. A trilha é histórica: um campo que saiu do
 * produto continua na trilha, e mostrar a chave crua é melhor que esconder a
 * linha ou inventar um rótulo.
 */
export function rotuloDoCampo(campo: string): string {
  const partes = campo.split(':')
  if (partes.length === 3) {
    const [tipo, id, sub] = partes
    const nome = ROTULOS[sub] ?? sub
    if (tipo === 'obra') return `${id} — ${nome}`
    if (tipo === 'meta') return `Meta de ${id}`
    if (tipo === 'faixa') return `Paridade em ${id}% de cobertura`
    return `${id} — ${nome}`
  }
  return ROTULOS[campo] ?? campo
}

/**
 * O verbo. `databricks` é discordar de um número que veio de fora; `regional` é
 * fazer o próprio trabalho — e a auditoria trata as duas coisas de forma
 * diferente, então a tela não pode chamar as duas de "alterou".
 */
export function verboDaOrigem(origem: string): string {
  return origem === 'databricks' ? 'corrigiu' : 'alterou'
}

/** `null` de um lado tem significado, e ele é diferente em cada lado. */
export function comoLer(a: Alteracao): string {
  if (a.de === null) return `criou como ${a.para}`
  if (a.para === null) return `removeu (era ${a.de})`
  return `${a.de} → ${a.para}`
}
