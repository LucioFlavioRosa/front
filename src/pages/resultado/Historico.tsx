import { Link } from 'react-router-dom'
import { useRuns } from '../../api/queriesResultado'
import { Carregando, ErroCarga, Vazio } from '../../components/Estado'
import { useCrumbs } from '../../state/CrumbsResultado'
import { brlMi, dataHora, deTotal, pct } from '../../lib/formato'
import styles from './Historico.module.css'

/**
 * Nivel 0 — historico de simulacoes, a porta de entrada dos resultados.
 *
 * VERSAO DA CASCA: lista o essencial e navega. Busca, ordenacao, destaques,
 * exclusao com confirmacao e o layout de card do prototipo entram na fatia 2 —
 * o que esta aqui prova que a rota, a query e os estados de carga/erro/vazio
 * funcionam ponta a ponta.
 */
export function Historico() {
  const { data: runs, isPending, isError, refetch, isFetching } = useRuns()
  useCrumbs([])

  if (isPending) return <Carregando label="Carregando simulações…" />
  if (isError)
    return (
      <ErroCarga
        alvo="o histórico de simulações"
        onRetry={() => void refetch()}
        tentando={isFetching}
      />
    )
  if (runs.length === 0)
    return (
      <Vazio
        titulo="Nenhuma simulação ainda"
        texto="Quando uma rodada do otimizador terminar, ela aparece aqui com os resultados. Rodadas são criadas na tela de simulação."
      />
    )

  return (
    <section aria-labelledby="titulo-historico">
      <h1 className={styles.titulo} id="titulo-historico">
        Histórico de simulações
      </h1>
      <p className={styles.sub}>
        {runs.length} rodada{runs.length === 1 ? '' : 's'} · clique em uma para abrir os resultados
      </p>

      <ul className={styles.lista}>
        {runs.map((r) => {
          const semResultado = r.status === 'INFEASIBLE'
          return (
            <li key={r.runId} className={styles.card}>
              <div className={styles.cabecalho}>
                <div>
                  <h2 className={styles.nome}>{r.nome}</h2>
                  <p className={styles.meta}>
                    <code className={styles.id}>{r.runId}</code> · {r.unidadeNome} ·{' '}
                    {dataHora(r.dataHora)} · {r.autor}
                  </p>
                </div>
                {semResultado ? (
                  <span className={styles.seloRuim}>solver INFEASIBLE</span>
                ) : (
                  <span className={styles.seloBom}>solver {r.status}</span>
                )}
              </div>

              {/* Rodada sem solucao NAO ganha metricas zeradas: zero VPL e um
                  resultado, "nao houve resultado" e outra coisa. */}
              {semResultado ? (
                <p className={styles.aviso}>
                  O solver não encontrou um plano viável com estes parâmetros. Não há resultados
                  para abrir — ajuste o orçamento ou as obras obrigatórias e rode de novo.
                </p>
              ) : (
                <>
                  <dl className={styles.metricas}>
                    <Metrica k="VPL" v={brlMi(r.metricas?.vpl)} destaque />
                    <Metrica k="CAPEX" v={brlMi(r.metricas?.capex)} />
                    <Metrica k="Uso do orçamento" v={pct(r.metricas?.usoOrcamentoPct)} />
                    <Metrica
                      k="Obras"
                      v={deTotal(r.metricas?.obrasConstruidas, r.metricas?.obrasTotal)}
                    />
                    <Metrica k="Cobertura no fim" v={pct(r.metricas?.coberturaFimPct)} />
                    <Metrica
                      k="Metas atingidas"
                      v={deTotal(r.metricas?.metasAtingidas, r.metricas?.metasTotal)}
                    />
                  </dl>
                  <Link to={`/resultados/${r.runId}`} className={styles.ver}>
                    Ver detalhes →
                  </Link>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Metrica({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className={styles.metrica}>
      <dt className={styles.metricaK}>{k}</dt>
      <dd className={destaque ? styles.metricaVDestaque : styles.metricaV}>{v}</dd>
    </div>
  )
}
