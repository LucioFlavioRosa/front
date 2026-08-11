import { describe, expect, it } from 'vitest'
import { auditoriaDe, formatarAuditoria } from '@/cadastro/domain/auditoria'

/**
 * A auditoria substituiu o 409 de ficha (R6). Como ela virou o ÚNICO aviso sobre
 * gravação concorrente, os modos de falha dela deixaram de ser cosméticos: uma
 * data quebrada ou um nome errado não estragam um detalhe da tela — estragam a
 * única informação que separa duas pessoas se sobrescrevendo.
 */
describe('formatarAuditoria', () => {
  it('junta quem e quando, no formato que a tela mostra', () => {
    expect(
      formatarAuditoria({ atualizadoEm: '2026-08-10T14:32:00+00:00', atualizadoPor: 'ana@aegea' }),
    ).toMatch(/^ana@aegea, \d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it('ficha nunca gravada pela tela não rende texto nenhum', () => {
    // As 4.850 sub-bacias vieram da planilha, e a coluna só existe desde a
    // migração: dizer "nunca alterada" afirmaria o que o dado não sustenta.
    expect(formatarAuditoria({ atualizadoEm: '', atualizadoPor: '' })).toBe('')
  })

  it('data quebrada some, e o autor fica', () => {
    // `Invalid Date` renderizado na ficha pareceria defeito do cadastro, e não
    // do payload — e o nome de quem gravou continua sendo verdade.
    expect(formatarAuditoria({ atualizadoEm: 'ontem de tarde', atualizadoPor: 'ana@aegea' })).toBe(
      'ana@aegea',
    )
  })

  it('autor sem data, e data sem autor, cada um aparece sozinho', () => {
    expect(formatarAuditoria({ atualizadoEm: '', atualizadoPor: 'bruno@aegea' })).toBe(
      'bruno@aegea',
    )
    expect(
      formatarAuditoria({ atualizadoEm: '2026-08-10T14:32:00+00:00', atualizadoPor: '' }),
    ).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
  })
})

describe('auditoriaDe', () => {
  it('pega SÓ os dois campos da resposta do PUT', () => {
    // O bug que motivou a função: espalhar a resposta inteira dentro da ficha
    // levava `id` e `overridesGravados` junto, e a auditoria não era trocada —
    // a tela seguia creditando a gravação a quem tinha salvado antes.
    const r = {
      id: 'b2_1_4',
      overridesGravados: 0,
      atualizadoEm: '2026-08-10T15:01:00+00:00',
      atualizadoPor: 'voce@aegea',
    }
    expect(auditoriaDe(r)).toEqual({
      atualizadoEm: '2026-08-10T15:01:00+00:00',
      atualizadoPor: 'voce@aegea',
    })
  })

  it('servidor que aceita e não diz quem gravou deixa os dois vazios', () => {
    // Vazio, e não o valor anterior: "não sei" é mais honesto que o nome errado.
    expect(auditoriaDe({ id: 'x' } as never)).toEqual({ atualizadoEm: '', atualizadoPor: '' })
    expect(auditoriaDe(undefined)).toEqual({ atualizadoEm: '', atualizadoPor: '' })
  })
})
