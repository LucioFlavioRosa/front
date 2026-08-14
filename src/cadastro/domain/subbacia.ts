/**
 * Dominio do Grupo 03 (Sub-bacias & Obras). Espelha o seed e as regras do
 * prototipo (linhas 705-715, 804-816, 1050-1069). Numeros sao strings pt-BR
 * (como o usuario digita); num()/brl() convertem para calculo/exibicao.
 */

/**
 * Base comercial que vem do Databricks — ligacoes e economias, com o trio
 * universo / atendidas hoje / novas por obra de cada uma.
 *
 * Populacao NAO esta aqui: quando a cidade mede a meta por populacao, quem
 * informa esses numeros e a Regional (ver SubBaciaParams).
 */
import type { Auditoria } from '@/cadastro/domain/auditoria'

export interface SubBaciaDb {
  fat: string
  arr: string
  ligU: string
  ligA: string
  ligN: string
  /**
   * Recorte RESIDENCIAL: quanto das medidas de cima e residencial. Vem APURADO da
   * base comercial — nao e estimativa de quem cadastra, e nao se deduz subtraindo
   * uma parcela industrial, como era antes.
   *
   * Serve a UMA coisa: a rodada que mede a meta so em ligacoes residenciais. Nao
   * entra em receita, VPL, vazao nem CAPEX, que seguem no total em qualquer modo —
   * quem paga a conta e a ligacao, seja de casa ou de fabrica.
   */
  /** `universo_ligacoes_residencial` */
  ligURes: string
  /** `ligacoes_atuais_residencial` */
  ligARes: string
  ecoU: string
  ecoA: string
  /** Economias que as obras passam a atender (`economias_novas_obras`). */
  ecoN: string
  /** `universo_economias_residencial` — o par de `ligURes`, para a cidade que mede a meta em economias. */
  ecoURes: string
  /** `economias_atuais_residencial` */
  ecoARes: string
  ticket: string
}

/** Parametros preenchidos pela Regional/Unidade (nao vem do Databricks). */
export interface SubBaciaParams {
  preco: string
  tarr: string
  ramp: string
  vaz: string
  pot: string
  /**
   * Populacao do universo e populacao ja atendida. So existem como campo
   * quando a cidade mede a meta por populacao — nas outras reguas nao entram
   * na tela nem contam pendencia. A terceira parcela (populacao que as obras
   * passam a atender) e calculada, nunca digitada: ver `popNovas`.
   */
  popU: string
  popA: string
}

/**
 * Componente de obra. Os nomes tecnicos das colunas (o que o backend recebe e o
 * que o dicionario de dados explica) estao ao lado de cada campo.
 */
export interface Obra {
  /** `componente` — ancora de coleta ou transporte; nao editavel. */
  nome: string
  /** `unidade` — em que a quantidade e medida (m, ligação, un). */
  un: string
  /** `quantidade` */
  qtd: string
  /** `preco_unitario` — CAPEX = quantidade × este preco (campo ƒ, nao gravado). */
  preco: string
  /** `opex` — custo anual de operar a obra. */
  opex: string
  /** `tempo_predecessoras` — meses de espera depois das obras que vem antes. */
  tPred: string
  /** `tempo_execucao` — quanto dura a construcao. */
  dur: string
  /**
   * `obra_obrigatoria_ano` — codigo, nao so um ano:
   *   `0`    a obra nao e obrigatoria (a simulacao decide se entra);
   *   `-1`   e obrigatoria, mas em qualquer ano (a simulacao escolhe quando);
   *   `AAAA` e obrigatoria naquele ano exato.
   */
  anoObrig: string
  /**
   * `obra_proibida_ate` — ano ate o qual a obra NAO pode comecar.
   *   `0`    sem impedimento;
   *   `AAAA` so pode comecar depois desse ano.
   */
  proibAte: string
  /** `wacc` — vazio usa o WACC medio da unidade. */
  wacc: string
}

export interface SubBacia extends Auditoria {
  id: string
  nome: string
  sisId: string
  sistema: string
  jusante: string
  db: SubBaciaDb
  params: SubBaciaParams
  /** Overrides das 5 obras-base, por indice (o resto herda a base). */
  obrasOverride: Record<string, Partial<Obra>>
}

/** Arvore Sup -> Cidade -> Sistema -> (subIds), so ramos com sub-bacias. */
export interface SistemaNode {
  id: string
  nome: string
  subIds: string[]
}
export interface CidadeNode {
  id: string
  nome: string
  sistemas: SistemaNode[]
}
export interface SupNode {
  id: string
  nome: string
  cidades: CidadeNode[]
}

export interface SubBaciasPayload {
  arvore: SupNode[]
  subs: Record<string, SubBacia>
}

/**
 * Quantos componentes de obra toda sub-bacia tem.
 *
 * NAO e um valor de cadastro — e a CARDINALIDADE que a simulacao exige, a mesma
 * de `pendencias.OBRAS_SUBBACIA` no backend. Serve para uma coisa so: uma obra
 * que FALTA pesar como uma obra em branco na contagem de pendencias. Sem isso a
 * ficha com quatro componentes se declararia completa, porque o que nao veio nao
 * tem campo vazio para contar.
 *
 * Quem denuncia QUAL componente falta e o backend (`/prontidao` -> `faltando`):
 * so ele pode saber, porque o que falta nao chega no payload da ficha.
 * `tests/test_obras_do_banco.py` prende os dois numeros ao banco real.
 */
export const OBRAS_POR_SUBBACIA = 5

/**
 * As obras da ficha, na ordem dos indices — SO o que o servidor mandou.
 *
 * Aqui havia `BASE_OBRAS`: cinco obras literais que esta funcao mesclava com o
 * que vinha do `GET`. Ela e a gemea da `_BASE_SUBBACIA` que saiu do backend, e
 * pelo mesmo motivo (R1/R2): componente ausente reaparecia com `preco 900` e
 * `dur 15`, numeros que ninguem digitou e que o banco nao tem. A tela mostrava
 * cinco linhas onde havia quatro, e a quinta era invencao — plausivel, o que a
 * torna pior.
 *
 * O `GET` passou a mandar `nome` e `un` junto dos numeros, entao a linha inteira
 * vem do banco. Campo que o payload nao trouxer fica VAZIO, e vazio conta
 * pendencia: e a leitura certa de "o servidor nao mandou", e nao um valor
 * inventado para tapar o buraco.
 */
export function mkObras(override: Record<string, Partial<Obra>>): Obra[] {
  return Object.keys(override ?? {})
    .sort((a, b) => Number(a) - Number(b))
    .map((i) => {
      // Campo a campo, e nao um cast: com `as Obra` sobre um objeto montado
      // dinamicamente, acrescentar campo ao tipo `Obra` compilaria e chegaria
      // `undefined` na tela. Escrito assim, o compilador cobra o campo novo aqui.
      const o = override[i] ?? {}
      return {
        nome: o.nome ?? '',
        un: o.un ?? '',
        qtd: o.qtd ?? '',
        preco: o.preco ?? '',
        opex: o.opex ?? '',
        tPred: o.tPred ?? '',
        dur: o.dur ?? '',
        anoObrig: o.anoObrig ?? '',
        proibAte: o.proibAte ?? '',
        wacc: o.wacc ?? '',
      }
    })
}

// A vazao industrial SAIU do cadastro. Ela existia para o motor subtrair a parcela
// da industria quando a rodada era "so residencial" — e esse recorte deixou de tocar
// em vazao: ela dimensiona modulo de ETE e rateia obra compartilhada, e industria
// contribui com esgoto mesmo quando nao conta para a meta. Descontar ali
// subdimensionaria a estacao. Um campo a menos para a Regional preencher.
const PARAM_KEYS: (keyof SubBaciaParams)[] = ['preco', 'tarr', 'ramp', 'vaz', 'pot']
/** Quantos parametros a ficha cobra fora da regua de populacao. */
export const CAMPOS_PARAMS = PARAM_KEYS.length
/** Entram na conta so quando a cidade mede a meta por populacao. */
const PARAM_KEYS_POP: (keyof SubBaciaParams)[] = ['popU', 'popA']
/**
 * Campos de obra que a simulacao exige.
 *
 * `anoObrig` e `proibAte` entram porque "sem restricao" tem valor proprio (`0`):
 * deixar em branco nao e resposta, e um silencio que a simulacao nao sabe ler.
 * Como a obra-base ja vem com `0`, na pratica so conta pendencia quando alguem
 * apaga o campo ou quando o payload chega sem ele.
 *
 * `wacc` continua fora: ali o vazio SIGNIFICA algo ("usa o WACC medio da
 * unidade"), entao cobrar preenchimento seria pedir para repetir o padrao.
 */
const OBRA_KEYS: (keyof Obra)[] = ['qtd', 'preco', 'opex', 'tPred', 'dur', 'anoObrig', 'proibAte']

/** Todas as chaves de `params` — usado para conferir o formato de um rascunho. */
export const CHAVES_PARAMS: (keyof SubBaciaParams)[] = [...PARAM_KEYS, ...PARAM_KEYS_POP]

/** Campos que uma estrutura de coleta precisa ter preenchidos, sem as obras. */
const paramsDaRegua = (porPopulacao: boolean) =>
  porPopulacao ? [...PARAM_KEYS, ...PARAM_KEYS_POP] : PARAM_KEYS

/**
 * Contagem de pendencias de uma estrutura de coleta: params vazios + campos de
 * obra vazios (wacc nao conta — vazio significa "usa o WACC medio da unidade").
 * Compartilhada por sub-bacia (5 obras) e CTS (4 obras).
 *
 * `porPopulacao` vem da cidade: com a meta medida em populacao, os dois campos
 * de populacao viram obrigatorios como qualquer outro parametro — e por isso a
 * completude cai e o hub trava a simulacao ate alguem preencher.
 */
export function pendDe(
  params: SubBaciaParams,
  obras: Obra[],
  porPopulacao = false,
  esperadas = OBRAS_POR_SUBBACIA,
): number {
  let n = 0
  paramsDaRegua(porPopulacao).forEach((k) => {
    // `?? ''` porque o payload do backend pode vir sem a chave: ausencia vira
    // pendencia, que e a leitura certa — e nao um estouro no meio do render.
    if (String(params[k] ?? '').trim() === '') n++
  })
  obras.forEach((o) => {
    OBRA_KEYS.forEach((k) => {
      if (String(o[k] ?? '').trim() === '') n++
    })
  })
  // Obra que FALTA pesa como obra toda em branco — que e exatamente o que ela e.
  // Enquanto a base literal existia, o componente ausente vinha preenchido com
  // valores de template e contribuia ZERO: a ficha se declarava completa sem
  // ele. Mesma regra do backend (`pendencias.sb_obras`), e nao por acaso: as
  // duas contas aparecem na mesma tela, uma no chip da ficha e outra no hub.
  n += Math.max(0, esperadas - obras.length) * OBRA_KEYS.length
  return n
}

/** Pendencias da sub-bacia: params vazios + campos de obra vazios (wacc nao conta). */
export function subPend(s: SubBacia, porPopulacao = false): number {
  return pendDe(s.params, mkObras(s.obrasOverride), porPopulacao)
}

/** Quantos campos cada componente de obra cobra (ver OBRA_KEYS). */
export const CAMPOS_POR_OBRA = OBRA_KEYS.length

/** Campos contados da sub-bacia: params + 5 obras (+2 quando a regua e populacao). */
export const camposDaSub = (porPopulacao: boolean) =>
  paramsDaRegua(porPopulacao).length + OBRAS_POR_SUBBACIA * CAMPOS_POR_OBRA

/** De-para sub-bacia → cidade, tirado da arvore (sup › cidade › sistema). */
export function cidadePorSub(arvore: SupNode[]): Record<string, string> {
  const mapa: Record<string, string> = {}
  arvore.forEach((sup) =>
    sup.cidades.forEach((cid) =>
      cid.sistemas.forEach((sis) => sis.subIds.forEach((id) => (mapa[id] = cid.id))),
    ),
  )
  return mapa
}

/**
 * Numero pt-BR: milhar com ponto, decimal com virgula. Aceita tambem inteiro
 * puro ("784") e sinal negativo.
 *
 * O `\.\d{3}` exige grupos de milhar completos de proposito — assim "1.2",
 * meio caminho de uma digitacao, nao vira 12.
 */
const NUMERO_BR = /^-?\d+(\.\d{3})*(,\d+)?$/

/**
 * Converte string pt-BR (1.234,5) em numero; vazio/invalido = null.
 *
 * Validacao ESTRITA: `parseFloat` aceitava prefixo numerico ("123abc" virava
 * 123), entao um dado sujo do Databricks virava calculo de aparencia correta —
 * CAPEX, capacidade ociosa e populacao nova saiam errados sem nenhum sinal.
 * Melhor devolver null e a tela mostrar travessao.
 */
export function num(v: string): number | null {
  const texto = String(v).trim()
  if (!NUMERO_BR.test(texto)) return null
  const n = Number(texto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function brl(n: number | null): string {
  return n == null ? '—' : BRL.format(n)
}

const INT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Contagem (ligacoes, economias, pessoas) em pt-BR; null vira travessao. */
export function inteiro(n: number | null): string {
  return n == null ? '—' : INT.format(n)
}

/**
 * O POTENCIAL DE CRESCIMENTO como numero, com 1,0 quando nao ha o que ler.
 *
 * `1` e o neutro da multiplicacao, entao campo vazio, texto invalido ou valor nao
 * positivo se comportam como "sem crescimento" — nunca zeram o universo. E a
 * mesma tolerancia que o motor tem (`_pot`), e ela precisa ser a mesma dos dois
 * lados: tela e simulacao discordando sobre o fator seria pior que nao mostrar.
 */
export function fatorCrescimento(pot: string): number {
  const p = num(pot)
  return p != null && p > 0 ? p : 1
}

/**
 * As medidas que as obras passam a atender = universo × potencial − atendidas.
 *
 * O POTENCIAL ENTRA AQUI, e essa e a mudanca. Ele multiplicava so o denominador
 * da meta — o universo agregado por cidade —, e as "novas" ficavam sendo a
 * diferenca crua. O efeito era uma sub-bacia com crescimento previsto exigir mais
 * cobertura sem que as obras dela passassem a atender mais ninguem: a meta subia
 * e o meio de alcanca-la, nao.
 *
 * Campo calculado (ƒ), nunca digitado. Um dos dois vazio devolve travessao —
 * melhor nao mostrar numero que mostrar um numero errado.
 *
 * DIFERENCA NEGATIVA e devolvida como esta, e a decisao e antiga: e dado
 * inconsistente do Databricks (atuais > universo), e esconder isso nao ajuda
 * ninguem. Mas o MOTOR trunca em zero (`max(0.0, ...)`), entao a tela mostraria
 * -50 enquanto a simulacao usa 0 — e tela e simulacao discordando em silencio
 * sobre o mesmo numero foi exatamente o defeito que esta mudanca veio corrigir.
 * Por isso `notaDeNovas` existe: o valor denuncia, e a nota diz o que roda.
 */
export function novasDeObras(universo: string, atuais: string, pot: string): string {
  const u = num(universo)
  const a = num(atuais)
  if (u == null || a == null) return '—'
  return inteiro(u * fatorCrescimento(pot) - a)
}

/**
 * A nota da celula derivada — a conta, e o que o motor faz com ela.
 *
 * Sem o segundo caso, o negativo seria uma armadilha: quem le -50 supoe que a
 * simulacao vai usar -50.
 */
export function notaDeNovas(valor: string): string {
  const conta = 'universo × potencial de crescimento − atuais'
  return valor.startsWith('-') ? `${conta} · negativo: a simulação usa 0` : conta
}

/** Populacao que as obras passam a atender. Ver `novasDeObras`. */
export function popNovas(params: Pick<SubBaciaParams, 'popU' | 'popA' | 'pot'>): string {
  return novasDeObras(params.popU, params.popA, params.pot)
}

/** CAPEX = quantidade × preço unitário (campo calculado ƒ). */
export function capex(qtd: string, preco: string): string {
  const q = num(qtd)
  const p = num(preco)
  return q != null && p != null ? brl(q * p) : '—'
}

/**
 * Obra que ACONTECE, mas nao com dinheiro da unidade — quem executa e um
 * terceiro (loteador, prefeitura, contrapartida de empreendimento).
 *
 * A marca e a combinacao: CAPEX zerado com prazo de execucao maior que zero.
 * Sem investimento e sem prazo, a obra simplesmente nao entra no plano; com
 * prazo, ela entra na SEQUENCIA — ocupa tempo, e as obras que dependem dela
 * esperam — sem entrar no CAPEX. Confundir os dois casos tira do plano uma obra
 * que o cronograma precisa considerar.
 */
export function deTerceiros(o: Obra): boolean {
  const q = num(o.qtd)
  const p = num(o.preco)
  const execucao = num(o.dur)
  return q != null && p != null && q * p === 0 && execucao != null && execucao > 0
}
