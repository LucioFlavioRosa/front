import { useId, useState, type ReactNode } from 'react'
import styles from './ChartFrame.module.css'

export interface LinhaTooltip {
  rotulo: string
  valor: string
  /** Cor do marcador da linha; ausente = sem marcador. */
  cor?: string
}

export interface Tooltip {
  x: number
  y: number
  titulo: string
  linhas: LinhaTooltip[]
}

export interface ItemLegenda {
  rotulo: string
  cor: string
  /** 'linha' desenha um traco em vez do quadrado. */
  forma?: 'quadrado' | 'linha' | 'tracejada' | 'losango'
}

export interface ChartFrameProps {
  titulo: string
  subtitulo?: string
  /** Tabela `run_*` de onde o dado veio — o chip cyan do canto. */
  origem: string
  legenda?: ItemLegenda[]
  /** Nota explicativa opcional, abaixo do grafico. */
  nota?: ReactNode
  /**
   * Equivalente textual do grafico. OBRIGATORIO: o SVG e `aria-hidden`, entao
   * esta tabela e a unica forma de o dado chegar a quem usa leitor de tela.
   * Tooltip e afordancia visual — nao substitui isto.
   */
  tabela: { colunas: string[]; linhas: (string | number)[][] }
  children: (ctx: { mostrar: (t: Tooltip | null) => void }) => ReactNode
}

/**
 * Moldura de todo quadro de grafico: titulo, subtitulo, chip da tabela de origem,
 * o desenho, legenda e nota.
 *
 * O chip de origem nao e enfeite — ele diz de qual tabela materializada aquele
 * numero saiu, e e o que permite a alguem conferir um valor estranho direto no
 * banco em vez de abrir um chamado.
 */
export function ChartFrame({
  titulo,
  subtitulo,
  origem,
  legenda,
  nota,
  tabela,
  children,
}: ChartFrameProps) {
  const [tip, setTip] = useState<Tooltip | null>(null)
  const id = useId()

  return (
    <figure className={styles.quadro} aria-labelledby={`${id}-t`}>
      <div className={styles.cabecalho}>
        <div>
          <figcaption className={styles.titulo} id={`${id}-t`}>
            {titulo}
          </figcaption>
          {subtitulo && <p className={styles.subtitulo}>{subtitulo}</p>}
        </div>
        <span className={styles.origem} title={`Dado lido de ${origem}`}>
          {origem}
        </span>
      </div>

      <div className={styles.area} onMouseLeave={() => setTip(null)}>
        {children({ mostrar: setTip })}
        {tip && (
          <div
            className={styles.tooltip}
            style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
            role="presentation"
          >
            <div className={styles.tipTitulo}>{tip.titulo}</div>
            {tip.linhas.map((l) => (
              <div key={l.rotulo} className={styles.tipLinha}>
                {l.cor && <span className={styles.tipCor} style={{ background: l.cor }} />}
                <span className={styles.tipRotulo}>{l.rotulo}</span>
                <span className={styles.tipValor}>{l.valor}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {legenda && legenda.length > 0 && (
        <ul className={styles.legenda}>
          {legenda.map((l) => (
            <li key={l.rotulo} className={styles.legendaItem}>
              <span
                className={
                  l.forma === 'linha'
                    ? styles.marcaLinha
                    : l.forma === 'tracejada'
                      ? styles.marcaTracejada
                      : l.forma === 'losango'
                        ? styles.marcaLosango
                        : styles.marcaQuadrado
                }
                style={
                  l.forma === 'linha' || l.forma === 'tracejada'
                    ? { borderColor: l.cor }
                    : { background: l.cor }
                }
              />
              {l.rotulo}
            </li>
          ))}
        </ul>
      )}

      {nota && <p className={styles.nota}>{nota}</p>}

      {/* Equivalente textual: o SVG e aria-hidden. */}
      <table className={styles.tabelaOculta}>
        <caption>{titulo}</caption>
        <thead>
          <tr>
            {tabela.colunas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabela.linhas.map((linha, i) => (
            <tr key={i}>
              {linha.map((celula, j) => (
                <td key={j}>{celula}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
