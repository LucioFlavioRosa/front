import { Link, useParams } from 'react-router-dom'
import { useSubBacia } from '@/resultado/api/queries'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { useCrumbs } from '@/resultado/state/Crumbs'
import { brl, inteiro, vazao as fmtVazao, VAZIO } from '@/resultado/lib/formato'
import { DataTable, Painel, SeloSituacao } from '@/resultado/components/pecas'
import { GraficoCascata, GraficoReceitaSubBacia } from '@/resultado/components/graficos'
import type { ElementoLinha, Explicacao } from '@/resultado/domain/resultado'
import styles from './SubBacia.module.css'

/** Nivel 4 — por que esta sub-bacia entrou ou ficou de fora. */
export function SubBacia() {
  const { runId, subId } = useParams()
  const q = useSubBacia(runId, subId)

  useCrumbs(
    q.data
      ? [
          { rotulo: q.data.cidadeNome, to: `/resultados/${runId}/cidades/${q.data.cidadeId}` },
          { rotulo: q.data.sistemaNome, to: `/resultados/${runId}/sistemas/${q.data.sistemaId}` },
          { rotulo: q.data.id },
        ]
      : [{ rotulo: subId ?? 'Sub-bacia' }],
  )

  if (q.isPending) return <Carregando label="Carregando a sub-bacia…" />
  if (q.isError)
    return (
      <ErroCarga
        erro={q.error}
        alvo="os dados desta sub-bacia"
        onRetry={() => void q.refetch()}
        tentando={q.isFetching}
      />
    )

  const s = q.data

  return (
    <section aria-labelledby="titulo-sub">
      <div className={styles.topo}>
        <div>
          <h1 className={styles.titulo} id="titulo-sub">
            {s.tipo === 'cts' ? 'CTS' : 'Sub-bacia'} {s.id}
          </h1>
          <p className={styles.sub}>
            {s.cidadeNome} · {s.sistemaNome} · vazão {fmtVazao(s.vazao)}
            {s.pareadaCom && (
              <>
                {' '}
                · pareada com{' '}
                <Link to={`/resultados/${runId}/sub-bacias/${s.pareadaCom}`}>{s.pareadaCom}</Link>
              </>
            )}
          </p>
        </div>
        <span className={s.fatura ? styles.seloFatura : styles.seloNaoFatura}>
          {s.fatura ? 'FATURA' : 'NÃO FATURA'}
        </span>
      </div>

      <div className={styles.dupla}>
        <GraficoCascata
          parcelas={s.cascata}
          titulo="Cascata do VPL"
          subtitulo={`as parcelas somam o VPL desta ${s.tipo === 'cts' ? 'CTS' : 'sub-bacia'}`}
          origem="run_subbacia"
        />

        {/* Sub-bacia que nao fatura NAO ganha um grafico vazio: um eixo com zero
            em tudo parece dado, e nao e — e a ausencia de receita. */}
        {s.receita.length > 0 ? (
          <GraficoReceitaSubBacia receita={s.receita} />
        ) : (
          <Painel titulo="Receita ao longo do tempo" origem="run_subbacia_ano">
            <p className={styles.semReceita}>
              <strong>Esta sub-bacia não fatura neste plano.</strong> Sem a cadeia completa até a
              ETE, nenhuma ligação desta área gera receita — por isso não há curva a mostrar.
            </p>
          </Painel>
        )}
      </div>

      <div className={styles.bloco}>
        <CardExplicacao explicacao={s.explicacao} runId={runId as string} />
      </div>

      <div className={styles.bloco}>
        <Painel
          titulo="Caminho até a ETE"
          subtitulo="a ordem em que o esgoto escoa — qualquer elo faltando trava tudo a montante"
          origem="run_dependencia"
        >
          <ol className={styles.caminho}>
            <li className={styles.passoAtual}>{s.id}</li>
            {s.caminho.map((p) => (
              <li key={p} className={styles.passo}>
                <span className={styles.setaCaminho} aria-hidden="true">
                  →
                </span>
                {p}
              </li>
            ))}
          </ol>
        </Painel>
      </div>

      <h2 className={styles.tituloTabela}>Elementos</h2>
      <DataTable<ElementoLinha>
        linhas={s.elementos}
        chaveDe={(e) => e.obraId}
        href={(e) => `/resultados/${runId}/obras/${e.obraId}`}
        rotuloDe={(e) => e.componente}
        vazio="Esta ficha não tem obras cadastradas."
        colunas={[
          {
            chave: 'id',
            titulo: 'Elemento',
            render: (e) => <code className={styles.id}>{e.obraId}</code>,
          },
          { chave: 'comp', titulo: 'Componente', render: (e) => <strong>{e.componente}</strong> },
          {
            chave: 'qtd',
            titulo: 'Quantidade',
            numerica: true,
            render: (e) =>
              e.quantidade === null ? VAZIO : `${inteiro(e.quantidade)} ${e.unidade ?? ''}`,
          },
          {
            chave: 'preco',
            titulo: 'Preço unitário',
            numerica: true,
            render: (e) => brl(e.precoUnitario),
          },
          {
            chave: 'capex',
            titulo: 'CAPEX',
            numerica: true,
            render: (e) => <strong>{brl(e.capex)}</strong>,
          },
          {
            chave: 'ano',
            titulo: 'Início',
            numerica: true,
            // Obra de terceiro nao tem inicio nosso — tem prazo, que e o que
            // importa: ela ocupa lugar na sequencia sem consumir orcamento.
            render: (e) =>
              e.anoInicio !== null ? (
                String(e.anoInicio)
              ) : e.situacao === 'terceiro' ? (
                <span className={styles.fraco}>prazo {inteiro(e.prazoMeses)}m</span>
              ) : (
                VAZIO
              ),
          },
          {
            chave: 'sit',
            titulo: 'Decisão',
            render: (e) => <SeloSituacao situacao={e.situacao} />,
          },
        ]}
      />
    </section>
  )
}

/**
 * A explicabilidade que hoje sai como texto de console, virada em UI.
 *
 * O "elo que trava" e um LINK para o elemento: e a pergunta seguinte que o
 * usuario sempre faz, e deixa-la a um clique e metade do valor desta tela.
 */
function CardExplicacao({ explicacao, runId }: { explicacao: Explicacao; runId: string }) {
  const e = explicacao
  const travada = !!e.elo

  return (
    <section className={travada ? styles.explicaTravada : styles.explicaOk}>
      <div className={styles.explicaTopo}>
        <span className={styles.categoria}>{e.categoria}</span>
        {travada && (
          <span className={styles.elo}>
            elo que trava:{' '}
            <Link to={`/resultados/${runId}/obras/${e.elo}`} className={styles.eloLink}>
              {e.elo}
            </Link>
          </span>
        )}
      </div>

      <p className={styles.narrativa}>{e.narrativa}</p>

      {e.seFosseLigada && (
        <div className={styles.seFosse}>
          <h3 className={styles.seFosseTitulo}>Se fosse ligada agora (valor presente)</h3>
          <dl className={styles.seFosseGrade}>
            <Linha k="(+) Receita" v={brl(e.seFosseLigada.receita)} />
            <Linha k="(−) CAPEX a construir sozinha" v={brl(e.seFosseLigada.capexSozinha)} />
            <Linha k="(−) OPEX" v={brl(e.seFosseLigada.opex)} />
            <Linha k="Saldo sozinha" v={brl(e.seFosseLigada.saldoSozinha)} forte />
            <Linha k="Saldo com rateio por vazão" v={brl(e.seFosseLigada.saldoComRateio)} forte />
          </dl>
          <p className={styles.seFosseNota}>
            Saldo positivo aqui não significa que a obra deveria entrar: o otimizador compara todas
            as oportunidades contra o mesmo teto de orçamento.
          </p>
        </div>
      )}
    </section>
  )
}

function Linha({ k, v, forte }: { k: string; v: string; forte?: boolean }) {
  return (
    <div className={styles.seFosseLinha}>
      <dt className={styles.seFosseK}>{k}</dt>
      <dd className={forte ? styles.seFosseVForte : styles.seFosseV}>{v}</dd>
    </div>
  )
}
