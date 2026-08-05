/**
 * Placeholder da marca: circulo com gradiente verde->cyan (README secao Assets).
 * Substituir pela marca Aegea do design system interno. Isolado de proposito.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-label="Aegea"
      role="img"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--brand-grad-a), var(--brand-grad-b))',
        flexShrink: 0,
      }}
    />
  )
}
