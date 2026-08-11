/** Dominio do Grupo 02 (Contrato & Metas). Regras: prototipo linhas 826-833. */

import type { Auditoria } from '@/cadastro/domain/auditoria'

export interface Cidade extends Auditoria {
  id: string
  nome: string
  fim: string
  cob: string
}

export interface Meta {
  cid: string
  ano: string
  pct: string
}

export interface Fator {
  cid: string
  cob: string
  par: string
}

export interface ContratoPayload {
  cidades: Cidade[]
  metas: Meta[]
  fator: Fator[]
}

/** Pendencias de uma cidade: fim + cob vazios, e as metas/faixas dela. */
export function cidadePend(c: Cidade, metas: Meta[], fator: Fator[]): number {
  let n = 0
  if (c.fim.trim() === '') n++
  if (c.cob.trim() === '') n++
  metas
    .filter((m) => m.cid === c.id)
    .forEach((m) => {
      if (m.ano.trim() === '') n++
      if (m.pct.trim() === '') n++
    })
  fator
    .filter((f) => f.cid === c.id)
    .forEach((f) => {
      if (f.cob.trim() === '') n++
      if (f.par.trim() === '') n++
    })
  return n
}

/** Pendencia total do grupo (inclui linhas orfas sem cidade). */
export function g2Pend(p: ContratoPayload): number {
  let n = 0
  p.cidades.forEach((c) => {
    if (c.fim.trim() === '') n++
    if (c.cob.trim() === '') n++
  })
  p.metas.forEach((m) => {
    if (m.cid.trim() === '') n++
    if (m.ano.trim() === '') n++
    if (m.pct.trim() === '') n++
  })
  p.fator.forEach((f) => {
    if (f.cid.trim() === '') n++
    if (f.cob.trim() === '') n++
    if (f.par.trim() === '') n++
  })
  return n
}

export const COBERTURA_OPCOES = [
  { value: 'ligacoes', label: 'ligações' },
  { value: 'economias', label: 'economias' },
  { value: 'populacao', label: 'população' },
]
