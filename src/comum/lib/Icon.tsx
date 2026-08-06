/**
 * Icone interno. O handoff usa caracteres (⚠ ▸ ▾ ✓ ✕ 🔒) em vez de SVG; este
 * componente centraliza o `aria-hidden` para o glifo nao ser lido em voz alta
 * como pontuacao solta, e e o lugar de trocar por uma biblioteca de icones
 * depois — num arquivo so.
 *
 * A lista comecou com todos os glifos do prototipo e foi reduzida ao que o app
 * realmente usa: os outros lugares desenham o caractere direto no JSX, junto do
 * texto que ele acompanha, e um catalogo de glifos sem uso so envelhece.
 */
export type IconName = 'warning'

const GLYPH: Record<IconName, string> = {
  warning: '⚠',
}

interface IconProps {
  name: IconName
  className?: string
  'aria-hidden'?: boolean
  title?: string
}

export function Icon({ name, className, title, ...rest }: IconProps) {
  return (
    <span className={className} aria-hidden={rest['aria-hidden'] ?? true} title={title}>
      {GLYPH[name]}
    </span>
  )
}
