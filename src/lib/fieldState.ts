/**
 * Estado visual de um campo do usuario (funcao fld() do prototipo, linha 892):
 * vazio = pendente (borda ambar tracejada, fundo ambar); preenchido = verde.
 * Campos calculados (ƒ) e do Databricks nao usam isto — tem estilo proprio.
 */
export interface FieldStyle {
  border: string
  background: string
}

export function isPendente(value: string): boolean {
  return value.trim() === ''
}

export function fieldStyle(value: string): FieldStyle {
  return isPendente(value)
    ? { border: '1.5px dashed var(--pend-accent)', background: 'var(--pend-bg)' }
    : { border: '1.5px solid var(--ok-border)', background: 'var(--surface)' }
}
