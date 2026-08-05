import { Link, useParams } from 'react-router-dom'
import { useObra } from '../../api/queriesResultado'
import { Carregando, ErroCarga } from '../../components/Estado'
import { useCrumbs } from '../../state/CrumbsResultado'
import { brl, inteiro, pct, vazao as fmtVazao, VAZIO } from '../../lib/formato'
import {
  Campo,
  DataTable,
  FieldGroup,
  Painel,
  SeloSituacao,
} from '../../components/resultado/pecas'
import type { DependenciaObra } from '../../domain/resultado'
import styles from './Elemento.module.css'

/** Nivel 5 — a ficha da obra, ultimo nivel de detalhe. */
export function Elemento() {
  const { runId, obraId } = useParams()
  const q = useObra(runId, obraId)

  useCrumbs(
    q.data
      ? [
          { rotulo: q.data.cidadeNome, to: `/resultados/${runId}/cidades/${q.data.cidadeId}` },
          { rotulo: q.data.sistemaNome, to: `/resultados/${runId}/sistemas/${q.data.sistemaId}` },
          {
            rotulo: q.data.subbaciaId,
            to: `/resultados/${runId}/sub-bacias/${q.data.subbaciaId}`,
          },
          { rotulo: q.data.rotulo },
        ]
      : [{ rotulo: obraId ?? 'Elemento' }],
  )

  if (q.isPending) return <Carregando label="Carregando a obra…" />
  if (q.isError)
    return <ErroCarga alvo="esta obra" onRetry={() => void q.refetch()} tentando={q.isFetching} />

  const o = q.data
  const somaFracoes = o.dependencias.reduce((s, d) => s + d.fracaoRateio, 0)

  return (
    <section aria-labelledby="titulo-obra">
      <div className={styles.topo}>
        <div>
          <h1 className={styles.titulo} id="titulo-obra">
            {o.rotulo}
          </h1>
          <p className={styles.sub}>
            {o.componente} · {o.cidadeNome} · {o.sistemaNome} ·{' '}
            <Link to={`/resultados/${runId}/sub-bacias/${o.subbaciaId}`}>{o.subbaciaId}</Link>
          </p>
        </div>
        <SeloSituacao situacao={o.situacao} />
      </div>

      <div className={styles.grupos}>
        <FieldGroup titulo="Identificação">
          <Campo rotulo="Componente" valor={o.componente} />
          <Campo rotulo="Responsável" valor={o.responsavel} />
          <Campo rotulo="Obrigatória" valor={o.obrigatoria ? 'sim' : 'não'} />
          <Campo rotulo="Sub-bacia" valor={o.subbaciaId} />
        </FieldGroup>

        <FieldGroup titulo="Custos">
          <Campo rotulo="Quantidade" valor={`${inteiro(o.quantidade)} ${o.unidade ?? ''}`} />
          <Campo rotulo="Preço unitário" valor={brl(o.precoUnitario)} />
          {/* CAPEX = quantidade x preco unitario. Mostrar a conta ao lado do
              resultado e o que permite conferir sem sair da tela. */}
          <Campo
            rotulo="CAPEX"
            valor={brl(o.capex)}
            nota={
              o.quantidade && o.precoUnitario
                ? `${inteiro(o.quantidade)} × ${brl(o.precoUnitario)}`
                : undefined
            }
          />
          <Campo rotulo="OPEX por ano" valor={brl(o.opexAno)} />
        </FieldGroup>

        <FieldGroup titulo="Prazos">
          <Campo
            rotulo="Prazo de execução"
            valor={o.prazoMeses === null ? VAZIO : `${inteiro(o.prazoMeses)} meses`}
          />
          <Campo
            rotulo="Início mais cedo"
            valor={o.mesMaisCedo === null ? VAZIO : `mês ${inteiro(o.mesMaisCedo)}`}
          />
          <Campo rotulo="Início" valor={o.dataInicio ?? VAZIO} />
          <Campo rotulo="Pronta" valor={o.dataPronta ?? VAZIO} />
        </FieldGroup>

        <FieldGroup titulo="Capital">
          {/* A ORIGEM do WACC importa tanto quanto o numero: "proprio" e um
              financiamento contratado para esta obra; "medio" e o campo que veio
              vazio e herdou o wacc_medio da unidade. Sao coisas diferentes. */}
          <Campo
            rotulo="WACC"
            valor={pct(o.wacc)}
            nota={o.waccOrigem === 'medio' ? 'médio da unidade' : 'próprio da obra'}
          />
        </FieldGroup>
      </div>

      <div className={styles.bloco}>
        <section className={o.situacao === 'construida' ? styles.decisaoOk : styles.decisaoFora}>
          <div className={styles.decisaoTopo}>
            <span className={styles.decisaoSelo}>
              {o.situacao === 'construida' ? 'CONSTRUÍDA' : 'FORA DO PLANO'}
            </span>
            {o.categoria && <span className={styles.categoria}>{o.categoria}</span>}
            {o.elo && (
              <span className={styles.elo}>
                elo que trava:{' '}
                <Link to={`/resultados/${runId}/obras/${o.elo}`} className={styles.eloLink}>
                  {o.elo}
                </Link>
              </span>
            )}
          </div>
          {o.narrativa ? (
            <p className={styles.narrativa}>{o.narrativa}</p>
          ) : (
            <p className={styles.narrativa}>
              Entra no plano com início em {o.dataInicio ?? VAZIO} e conclusão em{' '}
              {o.dataPronta ?? VAZIO}.
            </p>
          )}
        </section>
      </div>

      <div className={styles.bloco}>
        <Painel
          titulo="Quem depende deste elemento"
          subtitulo="rateio por vazão — as frações somam 100%"
          origem="run_dependencia"
        >
          <DataTable<DependenciaObra>
            linhas={o.dependencias}
            chaveDe={(d) => d.subbaciaId}
            href={(d) => `/resultados/${runId}/sub-bacias/${d.subbaciaId}`}
            rotuloDe={(d) => d.subbaciaId}
            colunas={[
              {
                chave: 'sub',
                titulo: 'Sub-bacia',
                render: (d) => <code className={styles.id}>{d.subbaciaId}</code>,
              },
              {
                chave: 'vazao',
                titulo: 'Vazão',
                numerica: true,
                render: (d) => fmtVazao(d.vazao),
              },
              {
                chave: 'fr',
                titulo: 'Fração do rateio',
                numerica: true,
                render: (d) => pct(d.fracaoRateio * 100),
              },
              {
                chave: 'cap',
                titulo: 'CAPEX rateado',
                numerica: true,
                render: (d) => brl(d.capexRateado),
              },
              {
                chave: 'fat',
                titulo: 'Fatura?',
                render: (d) => (
                  <span className={d.fatura ? styles.sim : styles.nao}>
                    {d.fatura ? 'sim' : 'não'}
                  </span>
                ),
              },
            ]}
          />
          <p className={styles.somaFracoes}>
            Soma das frações: <strong>{pct(somaFracoes * 100)}</strong> — a reconciliação é
            garantida pelo portão de qualidade da rodada, não recalculada aqui.
          </p>
        </Painel>
      </div>
    </section>
  )
}
