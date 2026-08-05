import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTopologia } from '../../api/queriesResultado'
import { Carregando, ErroCarga } from '../../components/Estado'
import { useCrumbs } from '../../state/CrumbsResultado'
import { brl, inteiro, vazao as fmtVazao } from '../../lib/formato'
import { EteCard, LegendaTopologia, NodeCard } from '../../components/resultado/NodeCard'
import type { NoTopologia } from '../../domain/resultado'
import styles from './Sistema.module.css'

/**
 * Nivel 3 — a topologia do sistema. A tela mais rica do pacote.
 *
 * O layout NAO e posicionado a mao: a topologia e um DAG que converge na ETE,
 * entao a coluna de cada no e a sua DISTANCIA ate a ETE (caminho mais longo), e
 * o fluxo corre da esquerda (mais a montante) para a direita (a ETE). E o unico
 * arranjo que sobrevive a um sistema com dezenas de nos — o protótipo posiciona
 * os blocos manualmente, o que nao escala.
 */
export function Sistema() {
  const { runId, sistemaId } = useParams()
  const [params, setParams] = useSearchParams()
  const foco = params.get('no')
  const topo = useTopologia(runId, sistemaId)

  useCrumbs(
    topo.data
      ? [
          {
            rotulo: topo.data.cidadeNome,
            to: `/resultados/${runId}/cidades/${topo.data.cidadeId}`,
          },
          { rotulo: topo.data.sistemaNome },
        ]
      : [{ rotulo: sistemaId ?? 'Sistema' }],
  )

  const colunas = useMemo(() => (topo.data ? porDistanciaAteEte(topo.data.nos) : []), [topo.data])

  if (topo.isPending) return <Carregando label="Carregando a topologia…" />
  if (topo.isError)
    return (
      <ErroCarga
        alvo="a topologia deste sistema"
        onRetry={() => void topo.refetch()}
        tentando={topo.isFetching}
      />
    )

  const t = topo.data

  return (
    <section aria-labelledby="titulo-sistema">
      <h1 className={styles.titulo} id="titulo-sistema">
        {t.sistemaNome} · {t.cidadeNome}
      </h1>
      <p className={styles.sub}>
        {inteiro(t.subbacias)} sub-bacias · {inteiro(t.faturando)} faturando · CAPEX construído{' '}
        {brl(t.capexConstruido)}
      </p>

      <div className={styles.corpo}>
        <div className={styles.diagramaWrap}>
          <div className={styles.diagrama}>
            {colunas.map((coluna, i) => (
              <div key={i} className={styles.coluna}>
                <div className={styles.colunaRotulo} aria-hidden="true">
                  {i === 0 ? 'mais a montante' : `${colunas.length - i} passo(s) da ETE`}
                </div>
                {coluna.map((no) => (
                  <div key={no.id} className={styles.noWrap}>
                    <NodeCard no={no} runId={runId as string} destacado={foco === no.id} />
                    {/* A seta indica o sentido do escoamento — da esquerda para
                        a direita, sempre em direcao a ETE. */}
                    <span className={styles.seta} aria-hidden="true">
                      →
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div className={styles.coluna}>
              <div className={styles.colunaRotulo} aria-hidden="true">
                destino
              </div>
              <EteCard ete={t.ete} runId={runId as string} />
            </div>
          </div>
          <LegendaTopologia />
        </div>

        {/* Rail: com muitos nos, o diagrama vira um mapa grande. A lista da o
            indice — e o unico caminho de teclado ate um no especifico. */}
        <nav className={styles.rail} aria-label="Nós do sistema">
          <h2 className={styles.railTitulo}>Nós ({t.nos.length})</h2>
          <ul className={styles.railLista}>
            {t.nos.map((no) => (
              <li key={no.id}>
                <button
                  type="button"
                  className={foco === no.id ? styles.railItemAtivo : styles.railItem}
                  onClick={() => {
                    setParams({ no: no.id }, { replace: true })
                    document.getElementById(`no-${no.id}`)?.scrollIntoView({
                      block: 'nearest',
                      inline: 'center',
                    })
                  }}
                >
                  <span
                    className={
                      no.tipo === 'cts'
                        ? styles.pontoCts
                        : no.fatura
                          ? styles.pontoFatura
                          : styles.pontoInk
                    }
                    aria-hidden="true"
                  />
                  <span className={styles.railId}>{no.id}</span>
                  <span className={styles.railVazao}>{fmtVazao(no.vazao)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  )
}

/**
 * Agrupa os nos por distancia ate a ETE, do mais a montante (coluna 0) ao que
 * liga direto nela (ultima coluna antes do destino).
 *
 * Usa o caminho MAIS LONGO e nao o mais curto: com o mais curto, um no que escoa
 * por dois caminhos apareceria antes de algum de seus proprios montantes, e a
 * seta apontaria para tras. O `visitados` corta ciclo — cadastro ruim existe, e
 * um laco aqui congelaria a tela.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function porDistanciaAteEte(nos: NoTopologia[]): NoTopologia[][] {
  const porId = new Map(nos.map((n) => [n.id, n]))

  const distancia = (id: string, visitados: Set<string>): number => {
    if (visitados.has(id)) return 0
    visitados.add(id)
    const no = porId.get(id)
    if (!no || !no.jusante || !porId.has(no.jusante)) return 0
    return 1 + distancia(no.jusante, visitados)
  }

  const dist = new Map(nos.map((n) => [n.id, distancia(n.id, new Set())]))
  const maior = Math.max(0, ...dist.values())

  const colunas: NoTopologia[][] = Array.from({ length: maior + 1 }, () => [])
  for (const n of nos) {
    // Inverte: distancia maior = mais a montante = mais a esquerda.
    colunas[maior - (dist.get(n.id) ?? 0)].push(n)
  }
  return colunas.filter((c) => c.length > 0)
}
