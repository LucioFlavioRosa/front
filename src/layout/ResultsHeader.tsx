import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Logo } from './Logo'
import { useRunMeta, useRuns } from '../api/queriesResultado'
import { useCrumbsAtuais } from '../state/CrumbsResultado'
import { brlMi } from '../lib/formato'
import type { ParametrosRodada } from '../domain/resultado'
import styles from './ResultsHeader.module.css'

/**
 * Header das telas de resultado. Espelha o prototipo: brand em 2 linhas, seletor
 * de rodada, unidade, chips dos parametros e do status do solver, e o breadcrumb
 * numa segunda linha.
 *
 * Os chips de parametro nao sao enfeite: sem eles, dois resultados da mesma
 * unidade sao indistinguiveis na tela — e a diferenca entre "com CTS" e "sem CTS"
 * muda o CAPEX em dezenas de milhoes. Por isso ficam visiveis em TODOS os niveis,
 * nao so no global.
 */
export function ResultsHeader() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { data: meta } = useRunMeta(runId)
  const { data: runs } = useRuns()
  const crumbs = useCrumbsAtuais()

  const noHistorico = !runId

  // Titulo da aba acompanha onde o usuario esta.
  useEffect(() => {
    // Sem `.at(-1)`: o `lib` do tsconfig deste repo e anterior ao ES2022.
    const ultimo = crumbs.length > 0 ? crumbs[crumbs.length - 1] : undefined
    const partes = noHistorico
      ? ['Histórico de simulações']
      : [ultimo?.rotulo, meta?.nome, 'Resultados · Otimizador CAPEX']
    document.title = partes.filter(Boolean).join(' · ')
  }, [noHistorico, crumbs, meta?.nome])

  // So rodadas com resultado entram no seletor: escolher uma INFEASIBLE levaria
  // a uma tela que nao tem o que mostrar.
  const opcoes = (runs ?? []).filter((r) => r.status !== 'INFEASIBLE')

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Desvio consciente do handoff, que dizia "o logo volta para a lista":
            aquilo foi escrito quando o historico ERA a porta de entrada. Agora
            existe um portal antes dele, e o logo leva la — a lista continua a um
            clique, como primeiro degrau do breadcrumb. */}
        <Link to="/" className={styles.brand} aria-label="Ir para a tela inicial">
          <Logo size={30} />
          <span>
            <span className={styles.brandText1}>aegea · Otimizador de CAPEX</span>
            <span className={styles.brandText2}>Resultados da rodada</span>
          </span>
        </Link>

        {!noHistorico && (
          <div className={styles.seletor}>
            <label className={styles.rotulo} htmlFor="seletor-rodada">
              rodada
            </label>
            <select
              id="seletor-rodada"
              className={styles.select}
              value={runId}
              onChange={(e) => navigate(`/resultados/${e.target.value}`)}
            >
              {opcoes.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.nome}
                </option>
              ))}
            </select>
            <span className={styles.rotulo}>unidade</span>
            <span className={styles.unidade}>{meta?.unidadeNome ?? '…'}</span>
          </div>
        )}

        {!noHistorico && meta && (
          <div className={styles.chips}>
            {chipsDeParametro(meta.parametros).map((c) => (
              <span key={c.k} className={styles.chip}>
                <span className={styles.chipK}>{c.k}</span> {c.v}
              </span>
            ))}
            <span className={styles.chipStatus}>solver {meta.statusTexto}</span>
          </div>
        )}
      </div>

      {!noHistorico && (
        <nav className={styles.trilha} aria-label="Onde você está">
          <Link to="/resultados" className={styles.crumbLink}>
            Histórico de simulações
          </Link>
          {meta && (
            <>
              <span className={styles.sep} aria-hidden="true">
                ›
              </span>
              {crumbs.length === 0 ? (
                <span className={styles.crumbAtual} aria-current="page">
                  {meta.nome}
                </span>
              ) : (
                <Link to={`/resultados/${runId}`} className={styles.crumbLink}>
                  {meta.nome}
                </Link>
              )}
            </>
          )}
          {crumbs.map((c, i) => (
            <span key={`${c.rotulo}-${i}`} className={styles.crumbItem}>
              <span className={styles.sep} aria-hidden="true">
                ›
              </span>
              {c.to ? (
                <Link to={c.to} className={styles.crumbLink}>
                  {c.rotulo}
                </Link>
              ) : (
                <span className={styles.crumbAtual} aria-current="page">
                  {c.rotulo}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
    </header>
  )
}

/**
 * Os parametros que mudam o resultado, na ordem em que o prototipo os mostra.
 * `incluirIndustrial` fica de fora do header por espaco — ele aparece no card do
 * historico, onde ha lugar para os cinco.
 */
function chipsDeParametro(p: ParametrosRodada): { k: string; v: string }[] {
  return [
    { k: 'janela', v: `${p.janelaCapex}a` },
    { k: 'orçamento', v: brlMi(p.orcamento) },
    { k: 'foco', v: String(p.focoCobertura) },
    { k: 'usar CTS', v: p.usarCts ? 'sim' : 'não' },
    { k: 'base', v: p.baseReceita },
  ]
}
