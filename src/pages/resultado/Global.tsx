import { useParams } from 'react-router-dom'
import { useRunMeta } from '../../api/queriesResultado'
import { Carregando, ErroCarga } from '../../components/Estado'
import { useCrumbs } from '../../state/CrumbsResultado'
import { EmConstrucao } from './EmConstrucao'

/**
 * Nivel 1 — a unidade inteira. Sem degrau proprio no breadcrumb: o nome da
 * rodada, que a casca ja mostra, E este nivel.
 */
export function Global() {
  const { runId } = useParams()
  const { isPending, isError, refetch, isFetching } = useRunMeta(runId)
  useCrumbs([])

  if (isPending) return <Carregando label="Carregando a rodada…" />
  if (isError)
    return <ErroCarga alvo="esta rodada" onRetry={() => void refetch()} tentando={isFetching} />

  return (
    <EmConstrucao
      titulo="Painel geral da rodada"
      fatia={3}
      conteudo="Os 10 cartões de KPI, os 6 quadros do painel (desembolso e receita por ano vs teto, curva S do CAPEX acumulado, cascata do VPL, CAPEX por elemento, histograma de VPL por sub-bacia e obras por ano), a aba de EBITDA e a tabela de cidades para descer um nível."
    />
  )
}
