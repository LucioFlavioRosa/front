/**
 * Formatacao pt-BR das telas de resultado.
 *
 * Duas regras do handoff que estao codificadas aqui, e nao espalhadas pelas
 * telas:
 *
 * 1. R$ SEM CENTAVOS nos agregados. Centavo em cima de R$ 168 milhoes e ruido —
 *    e pior, sugere uma precisao que a rodada nao tem.
 * 2. NULO VIRA "—", NUNCA 0. O caso que motivou: ocupacao de ETE com capacidade
 *    zero. "0%" afirma que a ETE esta vazia; a verdade e que a conta nao existe.
 *    Sao coisas diferentes e a tela nao pode confundi-las.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const NUM1 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const INT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** O tracao (em dash) de valor ausente. Um lugar so, para nao virar '-' aqui e '--' ali. */
export const VAZIO = '—'

function ausente(v: number | null | undefined): v is null | undefined {
  return v === null || v === undefined || Number.isNaN(v)
}

/** R$ 1.234.567 — agregados, sem centavos. */
export function brl(v: number | null | undefined): string {
  return ausente(v) ? VAZIO : BRL.format(v)
}

/**
 * R$ 168,1 Mi — para eixos e cards onde o numero cheio nao cabe.
 * Abaixo de 1 milhao cai para o formato cheio: "R$ 0,3 Mi" esconde a ordem de
 * grandeza de quem le rapido.
 */
export function brlMi(v: number | null | undefined): string {
  if (ausente(v)) return VAZIO
  if (Math.abs(v) < 1_000_000) return BRL.format(v)
  return `R$ ${NUM1.format(v / 1_000_000)} Mi`
}

/** 94,1% — percentuais com 1 casa, como o handoff pede. */
export function pct(v: number | null | undefined): string {
  return ausente(v) ? VAZIO : `${NUM1.format(v)}%`
}

/** 209,7 L/s — vazao com 1 casa. */
export function vazao(v: number | null | undefined): string {
  return ausente(v) ? VAZIO : `${NUM1.format(v)} L/s`
}

/** 1.234 — contagens. */
export function inteiro(v: number | null | undefined): string {
  return ausente(v) ? VAZIO : INT.format(v)
}

/** "28 de 31" — o par construidas/total, que aparece em varios cards. */
export function deTotal(
  parte: number | null | undefined,
  total: number | null | undefined,
): string {
  if (ausente(parte) || ausente(total)) return VAZIO
  return `${INT.format(parte)} de ${INT.format(total)}`
}

/** 05/08/2026 14:32 — data/hora do card do historico. */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return VAZIO
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return VAZIO
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * 05/08 14:32 — data curta, para desempatar rodadas na mesma linha.
 *
 * Existe por causa da regra da §2.1 do CONTRATO: reexecutar gera rodada NOVA, entao
 * o historico passa a ter entradas com o mesmo nome e parametros quase iguais. Num
 * seletor que mostra so o nome, elas ficam indistinguiveis — e trocar de rodada as
 * cegas num app de decisao de investimento e pior que nao poder trocar.
 */
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return VAZIO
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return VAZIO
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** "1m 40s" — tempo de solver; segundos crus ficam ilegiveis acima de 2 minutos. */
export function duracao(segundos: number | null | undefined): string {
  if (ausente(segundos)) return VAZIO
  if (segundos < 60) return `${INT.format(segundos)}s`
  const min = Math.floor(segundos / 60)
  const s = Math.round(segundos % 60)
  return s === 0 ? `${min}m` : `${min}m ${s}s`
}
