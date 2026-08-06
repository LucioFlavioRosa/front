/**
 * Integridade da fixture de resultado.
 *
 * A fixture e gerada por script, e o gerador ja confere isto — mas o JSON esta
 * versionado e pode ser editado a mao. Estes testes existem para que uma edicao
 * manual nao reintroduza o que ja aconteceu duas vezes: um `obraId` apontando
 * para uma ficha que nao existe.
 *
 * O caso real: os modulos da ETE traziam `obraId` desde o inicio, e o link deles
 * dava 404 — ninguem notou porque nao havia teste cruzando as duas pontas. O
 * segundo caso apareceu quando esta checagem foi escrita: o "elo que trava" de
 * uma CTS era montado por string (`red_` + id), assumindo que todo no tem rede
 * coletora. A CTS nao tem — ela tem coletor de tempo seco.
 */
import { describe, expect, it } from 'vitest'
import fx from '@/mocks/fixtures/resultado.json'
import type { ObraDetalhe, SubBaciaDetalhe, Topologia } from '@/resultado/domain/resultado'

const topologias = fx.topologias as unknown as Record<string, Topologia>
const subbacias = fx.subbacias as unknown as Record<string, SubBaciaDetalhe>
const obras = fx.obras as unknown as Record<string, ObraDetalhe>

/** Todo `obraId` que a fixture cita, com a procedencia, para o erro ser legivel. */
function citados(): { id: string; onde: string }[] {
  const out: { id: string; onde: string }[] = []
  for (const t of Object.values(topologias)) {
    for (const no of t.nos)
      for (const c of no.componentes)
        if (c.obraId) out.push({ id: c.obraId, onde: `topologia ${t.sistemaId} · nó ${no.id}` })
    for (const m of t.ete.modulos)
      if (m.obraId) out.push({ id: m.obraId, onde: `ETE de ${t.sistemaId}` })
  }
  for (const s of Object.values(subbacias)) {
    for (const e of s.elementos)
      if (e.obraId) out.push({ id: e.obraId, onde: `elementos de ${s.id}` })
    if (s.explicacao.elo) out.push({ id: s.explicacao.elo, onde: `elo que trava ${s.id}` })
  }
  for (const o of Object.values(obras)) {
    if (o.elo) out.push({ id: o.elo, onde: `elo que trava da obra ${o.obraId}` })
  }
  return out
}

describe('fixture de resultado', () => {
  it('todo obraId citado resolve numa ficha existente', () => {
    const orfas = citados().filter((c) => !obras[c.id])
    expect(orfas).toEqual([])
  })

  it('o elo que trava de um nó é uma obra DAQUELE nó', () => {
    // Apontar para a obra de outro no seria pior que 404: leva o usuario a uma
    // ficha plausivel e errada.
    const fora = Object.values(subbacias)
      .filter((s) => s.explicacao.elo)
      .filter((s) => obras[s.explicacao.elo as string]?.subbaciaId !== s.id)
      .map((s) => `${s.id} → ${s.explicacao.elo}`)
    expect(fora).toEqual([])
  })

  it('a CTS tem 4 componentes e a sub-bacia 5', () => {
    for (const t of Object.values(topologias)) {
      for (const no of t.nos) {
        expect(no.componentes.length).toBe(no.tipo === 'cts' ? 4 : 5)
      }
    }
  })

  it('toda CTS declara a sub-bacia pareada, e ela existe', () => {
    for (const t of Object.values(topologias)) {
      for (const no of t.nos.filter((n) => n.tipo === 'cts')) {
        expect(no.pareadaCom).toBeTruthy()
        expect(subbacias[no.pareadaCom as string]).toBeTruthy()
      }
    }
  })

  it('as frações de rateio somam 1 em toda obra', () => {
    for (const o of Object.values(obras)) {
      const soma = o.dependencias.reduce((s, d) => s + d.fracaoRateio, 0)
      expect(Math.abs(soma - 1)).toBeLessThan(1e-6)
    }
  })
})
