import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { SituacaoObra } from '@/resultado/domain/resultado'
import styles from './pecas.module.css'

/** Cartao de KPI: rotulo em caixa alta, valor grande, subtitulo. */
export function KpiCard({
  rotulo,
  valor,
  sub,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  sub?: string
  /** 'bom' e 'atencao' pintam borda e valor — use com parcimonia. */
  tom?: 'neutro' | 'bom' | 'atencao' | 'ruim'
}) {
  return (
    <div className={`${styles.kpi} ${styles[`kpi_${tom}`]}`}>
      <div className={styles.kpiRotulo}>{rotulo}</div>
      <div className={styles.kpiValor}>{valor}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className={styles.kpiGrid}>{children}</div>
}

/** Rotulo humano de cada situacao de obra — um lugar so. */

const ROTULO_SITUACAO: Record<SituacaoObra, string> = {
  construida: 'construída',
  'nao-construida': 'não construída',
  terceiro: 'terceiro',
  'sem-obra': 'sem obra prevista',
}

/**
 * Selo de situacao. As cores sao as MESMAS da topologia de proposito: o usuario
 * aprende a semantica uma vez e ela vale na tabela, no bloco e na ficha.
 */
export function SeloSituacao({ situacao }: { situacao: SituacaoObra }) {
  return (
    <span className={`${styles.selo} ${styles[`selo_${situacao.replace('-', '_')}`]}`}>
      {ROTULO_SITUACAO[situacao]}
    </span>
  )
}

export interface ColunaTabela<T> {
  chave: string
  titulo: string
  /** Alinha a direita — use para numero. */
  numerica?: boolean
  render: (linha: T) => ReactNode
}

/**
 * Tabela de drill-down. A linha inteira e um link quando `href` e dado — clicar
 * em qualquer lugar desce um nivel, que e o que o handoff pede.
 */
export function DataTable<T>({
  colunas,
  linhas,
  chaveDe,
  href,
  rotuloDe,
  vazio,
}: {
  colunas: ColunaTabela<T>[]
  linhas: T[]
  chaveDe: (l: T) => string
  href?: (l: T) => string
  /** Texto do link — sem ele o leitor de tela ouve so "link". */
  rotuloDe?: (l: T) => string
  vazio?: string
}) {
  if (linhas.length === 0) {
    return <p className={styles.tabelaVazia}>{vazio ?? 'Nada para mostrar aqui.'}</p>
  }
  return (
    <div className={styles.tabelaWrap}>
      <table className={styles.tabela}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className={c.numerica ? styles.num : undefined}>
                {c.titulo}
              </th>
            ))}
            {href && <th scope="col" className={styles.colAcao} />}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={chaveDe(l)} className={href ? styles.linhaClicavel : undefined}>
              {colunas.map((c) => (
                <td key={c.chave} className={c.numerica ? styles.num : undefined}>
                  {c.render(l)}
                </td>
              ))}
              {href && (
                <td className={styles.colAcao}>
                  <Link to={href(l)} className={styles.abrir}>
                    <span className={styles.soLeitor}>
                      {rotuloDe ? `Abrir ${rotuloDe(l)}` : 'Abrir'}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Grupo de campos da ficha do elemento (nivel 5). */
export function FieldGroup({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={styles.grupo}>
      <h3 className={styles.grupoTitulo}>{titulo}</h3>
      <dl className={styles.campos}>{children}</dl>
    </section>
  )
}

export function Campo({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string
  valor: ReactNode
  nota?: string
}) {
  return (
    <div className={styles.campo}>
      <dt className={styles.campoRotulo}>{rotulo}</dt>
      <dd className={styles.campoValor}>
        {valor}
        {nota && <span className={styles.campoNota}>{nota}</span>}
      </dd>
    </div>
  )
}

/** Painel de titulo + conteudo, para blocos que nao sao grafico. */
export function Painel({
  titulo,
  subtitulo,
  origem,
  children,
}: {
  titulo: string
  subtitulo?: string
  origem?: string
  children: ReactNode
}) {
  return (
    <section className={styles.painel}>
      <div className={styles.painelCabecalho}>
        <div>
          <h2 className={styles.painelTitulo}>{titulo}</h2>
          {subtitulo && <p className={styles.painelSub}>{subtitulo}</p>}
        </div>
        {origem && <span className={styles.origem}>{origem}</span>}
      </div>
      {children}
    </section>
  )
}
