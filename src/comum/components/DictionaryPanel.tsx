import { useEffect } from 'react'
import { useApp } from '@/comum/state/AppContext'
import { origemStyle, type Verbete } from '@/comum/domain/dicionario'
import styles from './DictionaryPanel.module.css'

/**
 * Painel fixo a direita (360px) do dicionario. Aberto pelo "?" via `dictKey`.
 *
 * Ele NAO conhece os verbetes: quem os passa e a raiz de composicao (`app/`), que
 * junta o dicionario do cadastro (colunas que a pessoa digita) com o da simulacao
 * (parametros da rodada). Sem isso o painel viveria numa area e teria de importar
 * da outra — que e o que a fronteira do ESLint recusa, e com razao.
 *
 * Nao rouba o foco ao abrir (o usuario continua no campo que estava lendo), mas
 * Esc fecha e o verbete e anunciado por aria-live — abrir o painel com o teclado
 * antes nao dava nenhum retorno.
 */
export function DictionaryPanel({ verbetes }: { verbetes: Record<string, Verbete> }) {
  const { dictKey, closeDict } = useApp()
  const aberto = !!dictKey

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDict()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, closeDict])

  if (!dictKey) return null

  const v = verbetes[dictKey]

  return (
    <aside
      className={styles.panel}
      aria-label="Dicionário de dados"
      role="complementary"
      aria-live="polite"
    >
      <div className={styles.header}>
        <span className={styles.kicker}>Dicionário de dados</span>
        <button
          type="button"
          className={styles.close}
          onClick={closeDict}
          aria-label="Fechar o dicionário de dados"
        >
          ✕
        </button>
      </div>

      {!v ? (
        <p className={styles.empty}>Verbete “{dictKey}” ainda não cadastrado no dicionário.</p>
      ) : (
        <>
          <div>
            <div className={styles.titleRow}>
              <span className={styles.rotulo}>{v.rotulo}</span>
              <span className={styles.tec}>{v.tec}</span>
            </div>
            <div className={styles.chips}>
              <span className={styles.chip} style={origemStyle(v.origem)}>
                {v.origem}
              </span>
              <span className={`${styles.chip} ${styles.chipTipo}`}>{v.tipo}</span>
            </div>
          </div>

          <div className={styles.sectionTop}>
            <div className={styles.sectionTitle}>O que é</div>
            <div className={styles.sectionBody}>{v.oque}</div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Por que o modelo usa</div>
            <div className={styles.sectionBody}>{v.porque}</div>
          </div>

          <div className={styles.exemplo}>
            <div className={styles.exemploLabel}>Exemplo</div>
            <div className={styles.exemploValor}>{v.exemplo}</div>
          </div>
        </>
      )}
    </aside>
  )
}
