import { useParams, useSearchParams } from 'react-router-dom'
import { useCidades, useEbitda, usePainel, useRunMeta } from '@/resultado/api/queries'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { useCrumbs } from '@/resultado/state/Crumbs'
import { brl, brlMi, deTotal, inteiro, pct } from '@/resultado/lib/formato'
import { DataTable, KpiCard, KpiGrid } from '@/resultado/components/pecas'
import {
  GraficoCapexComponente,
  GraficoCascata,
  GraficoCurvaS,
  GraficoDesembolso,
  GraficoEbitda,
  GraficoHistograma,
  GraficoObrasPorAno,
} from '@/resultado/components/graficos'
import type { CidadeLinha } from '@/resultado/domain/resultado'
import styles from './Global.module.css'

/**
 * Nivel 1 — a unidade inteira. Sem degrau proprio no breadcrumb: o nome da
 * rodada, que a casca ja mostra, E este nivel.
 *
 * A aba fica em query param (`?aba=ebitda`) e nao em rota filha: EBITDA e uma
 * alternancia DENTRO deste nivel, nao um degrau da cascata. Assim o breadcrumb
 * nao se mexe e o link continua compartilhavel.
 */
export function Global() {
  const { runId } = useParams()
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'ebitda' ? 'ebitda' : 'painel'

  const meta = useRunMeta(runId)
  const painel = usePainel(runId)
  const cidades = useCidades(runId)
  const ebitda = useEbitda(runId)
  useCrumbs([])

  if (meta.isPending || painel.isPending) return <Carregando label="Carregando a rodada…" />
  if (meta.isError || painel.isError)
    return (
      <ErroCarga
        erro={meta.error ?? painel.error}
        alvo="esta rodada"
        onRetry={() => {
          void meta.refetch()
          void painel.refetch()
        }}
        tentando={meta.isFetching || painel.isFetching}
      />
    )

  const k = meta.data.kpis
  const p = painel.data
  const metasOk = k.metasAtingidas === k.metasTotal

  return (
    <section aria-labelledby="titulo-global">
      <h1 className={styles.titulo} id="titulo-global">
        {meta.data.nome}
      </h1>
      <p className={styles.resumo}>
        Janela de {meta.data.parametros.janelaCapex} anos · foco{' '}
        {meta.data.parametros.focoCobertura} · orçamento {brlMi(meta.data.parametros.orcamento)} ·
        VPL {brl(k.vpl)} — lido das tabelas materializadas da rodada, sem recomputar nada.
      </p>

      <KpiGrid>
        <KpiCard rotulo="VPL do plano" valor={brl(k.vpl)} tom={k.vpl > 0 ? 'bom' : 'ruim'} />
        <KpiCard rotulo="CAPEX total" valor={brl(k.capexTotal)} />
        <KpiCard rotulo="OPEX total" valor={brl(k.opexTotal)} />
        <KpiCard rotulo="Receita total" valor={brl(k.receitaTotal)} />
        <KpiCard
          rotulo="Obras construídas"
          valor={deTotal(k.obrasConstruidas, k.obrasTotal)}
          sub={pct((k.obrasConstruidas / k.obrasTotal) * 100)}
        />
        <KpiCard
          rotulo="Obrigatórias"
          valor={deTotal(k.obrigatoriasConstruidas, k.obrigatoriasTotal)}
          tom={k.obrigatoriasConstruidas === k.obrigatoriasTotal ? 'bom' : 'ruim'}
        />
        <KpiCard
          rotulo="Sub-bacias faturando"
          valor={deTotal(k.subbaciasFaturando, k.subbaciasTotal)}
        />
        <KpiCard rotulo="Cobertura no fim" valor={pct(k.coberturaFimPct)} />
        <KpiCard
          rotulo="Metas de cobertura"
          valor={deTotal(k.metasAtingidas, k.metasTotal)}
          tom={metasOk ? 'bom' : 'atencao'}
        />
        <KpiCard rotulo="Status do solver" valor={meta.data.statusTexto} />
      </KpiGrid>

      <div className={styles.abas} role="tablist" aria-label="Visão do painel">
        {(['painel', 'ebitda'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            className={aba === id ? styles.abaAtiva : styles.aba}
            onClick={() => setParams(id === 'painel' ? {} : { aba: id }, { replace: true })}
          >
            {id === 'painel' ? 'Painel geral' : 'EBITDA'}
          </button>
        ))}
      </div>

      {aba === 'painel' ? (
        <div className={styles.quadros}>
          <GraficoDesembolso anos={p.anos} />
          <GraficoCurvaS pontos={p.curvaS} />
          <GraficoCascata
            parcelas={p.cascata}
            titulo="Cascata do VPL"
            subtitulo="as parcelas somam exatamente o VPL do plano"
            origem="run_subbacia"
          />
          <GraficoCapexComponente itens={p.capexPorComponente} />
          <GraficoHistograma
            faixas={p.histogramaVpl}
            positivas={p.subbaciasPositivas}
            negativas={p.subbaciasNegativas}
          />
          <GraficoObrasPorAno anos={p.obrasPorAno} />
        </div>
      ) : (
        <div className={styles.abaEbitda}>
          {ebitda.isPending ? (
            <Carregando label="Carregando EBITDA…" />
          ) : ebitda.isError ? (
            <ErroCarga
              alvo="o EBITDA da rodada"
              erro={ebitda.error}
              onRetry={() => void ebitda.refetch()}
            />
          ) : (
            <GraficoEbitda
              anos={ebitda.data.anos}
              total={ebitda.data.total}
              anoViraPositivo={ebitda.data.anoViraPositivo}
              fimCapex={ebitda.data.fimCapex}
              escopo="unidade"
            />
          )}
        </div>
      )}

      <h2 className={styles.tituloTabela}>Cidades</h2>
      <p className={styles.subTabela}>Clique numa cidade para ver cobertura, metas e paridade.</p>
      {cidades.isPending ? (
        <Carregando label="Carregando cidades…" />
      ) : cidades.isError ? (
        <ErroCarga
          alvo="as cidades desta rodada"
          erro={cidades.error}
          onRetry={() => void cidades.refetch()}
        />
      ) : (
        <DataTable<CidadeLinha>
          linhas={cidades.data}
          chaveDe={(c) => c.id}
          href={(c) => `/resultados/${runId}/cidades/${c.id}`}
          rotuloDe={(c) => c.nome}
          colunas={[
            { chave: 'nome', titulo: 'Cidade', render: (c) => <strong>{c.nome}</strong> },
            { chave: 'vpl', titulo: 'VPL', numerica: true, render: (c) => brl(c.vpl) },
            { chave: 'capex', titulo: 'CAPEX', numerica: true, render: (c) => brl(c.capex) },
            {
              chave: 'cob',
              titulo: 'Cobertura no fim',
              numerica: true,
              render: (c) => pct(c.coberturaFimPct),
            },
            {
              chave: 'metas',
              titulo: 'Metas',
              numerica: true,
              render: (c) => deTotal(c.metasAtingidas, c.metasTotal),
            },
            {
              chave: 'sis',
              titulo: 'Sistemas',
              numerica: true,
              render: (c) => inteiro(c.sistemas),
            },
          ]}
        />
      )}
    </section>
  )
}
