import { useParams } from 'react-router-dom'
import { useCidade, useEbitda } from '@/resultado/api/queries'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { useCrumbs } from '@/resultado/state/Crumbs'
import { brl, inteiro, pct, VAZIO } from '@/resultado/lib/formato'
import { DataTable, KpiCard, KpiGrid, Painel } from '@/resultado/components/pecas'
import { GraficoCascata, GraficoCobertura, GraficoEbitda } from '@/resultado/components/graficos'
import type { Paridade, SistemaLinha } from '@/resultado/domain/resultado'
import styles from './Cidade.module.css'

/** Nivel 2 — cobertura vs metas, cascata, paridade e EBITDA da cidade. */
export function Cidade() {
  const { runId, cidadeId } = useParams()
  const cidade = useCidade(runId, cidadeId)
  const ebitda = useEbitda(runId, cidadeId)
  useCrumbs([{ rotulo: cidade.data?.nome ?? cidadeId ?? 'Cidade' }])

  if (cidade.isPending) return <Carregando label="Carregando a cidade…" />
  if (cidade.isError)
    return (
      <ErroCarga
        erro={cidade.error}
        alvo="os dados desta cidade"
        onRetry={() => void cidade.refetch()}
        tentando={cidade.isFetching}
      />
    )

  const c = cidade.data
  const naJanela = c.metas.filter((m) => m.dentroDaJanela)
  const atingidas = naJanela.filter((m) => m.atingida).length

  return (
    <section aria-labelledby="titulo-cidade">
      <h1 className={styles.titulo} id="titulo-cidade">
        {c.nome}
      </h1>
      <p className={styles.sub}>
        Concessão até {c.fimConcessao} · janela de CAPEX até {c.fimCapex}
      </p>

      <KpiGrid>
        <KpiCard rotulo="VPL da cidade" valor={brl(c.vpl)} tom={c.vpl > 0 ? 'bom' : 'ruim'} />
        <KpiCard rotulo="CAPEX construído" valor={brl(c.capexTotal)} />
        <KpiCard rotulo="Ligações novas" valor={inteiro(c.ligacoesNovas)} />
        <KpiCard
          rotulo="Cobertura"
          valor={`${pct(c.coberturaBasePct)} → ${pct(c.coberturaFinalPct)}`}
        />
        <KpiCard
          rotulo="Metas na janela"
          valor={`${atingidas} de ${naJanela.length}`}
          tom={atingidas === naJanela.length ? 'bom' : 'atencao'}
        />
      </KpiGrid>

      <div className={styles.dupla}>
        <GraficoCobertura
          pontos={c.cobertura}
          metas={c.metas}
          fimCapex={c.fimCapex}
          fimConcessao={c.fimConcessao}
          regua="ligações"
        />
        <GraficoCascata
          parcelas={c.cascata}
          titulo="Economia da cidade — as barras somam o VPL"
          subtitulo={`CAPEX nominal construído ${brl(c.capexTotal)}`}
          origem="run_cidade_ano"
        />
      </div>

      <div className={styles.paridadeBloco}>
        <PainelParidade paridade={c.paridade} nome={c.nome} vpl={c.vpl} />
      </div>

      <div className={styles.ebitdaBloco}>
        {ebitda.isPending ? (
          <Carregando label="Carregando EBITDA da cidade…" />
        ) : ebitda.isError ? (
          <ErroCarga
            alvo="o EBITDA desta cidade"
            erro={ebitda.error}
            onRetry={() => void ebitda.refetch()}
          />
        ) : (
          <GraficoEbitda
            anos={ebitda.data.anos}
            total={ebitda.data.total}
            anoViraPositivo={ebitda.data.anoViraPositivo}
            fimCapex={ebitda.data.fimCapex}
            escopo={c.nome}
          />
        )}
      </div>

      <h2 className={styles.tituloTabela}>Sistemas</h2>
      <p className={styles.subTabela}>
        Clique num sistema para ver a topologia completa — sub-bacias, CTS e a ETE.
      </p>
      <DataTable<SistemaLinha>
        linhas={c.sistemas}
        chaveDe={(s) => s.id}
        href={(s) => `/resultados/${runId}/sistemas/${s.id}`}
        rotuloDe={(s) => s.nome}
        colunas={[
          { chave: 'nome', titulo: 'Sistema', render: (s) => <strong>{s.nome}</strong> },
          {
            chave: 'subs',
            titulo: 'Sub-bacias',
            numerica: true,
            render: (s) => `${inteiro(s.faturando)} de ${inteiro(s.subbacias)} faturando`,
          },
          { chave: 'capex', titulo: 'CAPEX', numerica: true, render: (s) => brl(s.capex) },
          {
            chave: 'ete',
            titulo: 'Ocupação da ETE',
            numerica: true,
            // Capacidade 0 -> ocupacao NULA. "—" e a verdade; "0%" seria mentira.
            render: (s) => (
              <span className={s.ocupacaoPct === null ? styles.semDado : undefined}>
                {pct(s.ocupacaoPct)}
              </span>
            ),
          },
        ]}
      />
    </section>
  )
}

/**
 * Paridade esgoto/agua e efeito-base.
 *
 * A tela e OBRIGADA a explicitar a causalidade: o degrau de faixa e a origem da
 * barra "Efeito-base paridade" da cascata, porque o reajuste tarifario vale
 * tambem para as ligacoes JA existentes — nao so para as novas. Sem essa frase,
 * o numero parece ter surgido do nada.
 */
function PainelParidade({
  paridade,
  nome,
  vpl,
}: {
  paridade: Paridade
  nome: string
  vpl: number
}) {
  const p = paridade
  return (
    <Painel
      titulo="Paridade esgoto/água e efeito-base"
      subtitulo={`escada de faixas cadastrada para ${nome}`}
      origem="run_paridade + snapshot__fator_esgoto"
    >
      <div className={styles.paridadeGrade}>
        <ul className={styles.faixas}>
          {p.faixas.map((f) => (
            <li key={f.coberturaPct} className={styles.faixa}>
              <span className={styles.faixaRotulo}>
                a partir de {pct(f.coberturaPct)} de cobertura
              </span>
              {/* Trilha de largura FIXA: sem ela as barras nao sao comparaveis
                  entre linhas, que e todo o ponto de mostrar a escada. */}
              <span className={styles.trilha}>
                <span className={styles.barra} style={{ width: `${f.paridade * 100}%` }} />
              </span>
              <span className={styles.faixaValor}>{f.paridade.toFixed(2)}</span>
              {/* O selo vai em LINHA PROPRIA para nao colidir com o valor. */}
              {(f.ehBase || f.ehFinal) && (
                <span className={styles.selos}>
                  {f.ehBase && <span className={styles.seloBase}>cobertura base</span>}
                  {f.ehFinal && <span className={styles.seloFinal}>fim do plano</span>}
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className={styles.efeito}>
          <div className={styles.efeitoLinha}>
            <span className={styles.efeitoK}>paridade inicial → final</span>
            <strong className={styles.efeitoV}>
              {p.paridadeInicial.toFixed(2)} → {p.paridadeFinal.toFixed(2)}
            </strong>
          </div>
          <div className={styles.efeitoLinha}>
            <span className={styles.efeitoK}>houve degrau de faixa?</span>
            <strong className={styles.efeitoV}>{p.houveDegrau ? 'sim' : 'não'}</strong>
          </div>
          <div className={styles.efeitoLinha}>
            <span className={styles.efeitoK}>VP do efeito-base</span>
            <strong className={styles.efeitoV}>{brl(p.vpEfeitoBase)}</strong>
          </div>
          <div className={styles.efeitoLinha}>
            <span className={styles.efeitoK}>% do VPL da cidade</span>
            <strong className={styles.efeitoV}>
              {vpl === 0 ? VAZIO : pct(p.pctDoVplDaCidade)}
            </strong>
          </div>

          <p className={styles.causalidade}>
            {p.houveDegrau ? (
              <>
                A cobertura subiu o bastante para <strong>trocar de faixa</strong>, e a paridade foi
                de {p.paridadeInicial.toFixed(2)} para {p.paridadeFinal.toFixed(2)}. É esse degrau
                que origina a barra <strong>&quot;Efeito-base paridade&quot;</strong> da cascata: o
                reajuste vale também para as <strong>ligações que já existiam</strong>, não só para
                as novas — por isso o ganho aparece mesmo sem obra nova naquelas ligações.
              </>
            ) : (
              <>
                A cobertura não chegou a trocar de faixa, então <strong>não há degrau</strong> de
                paridade. Sem degrau não existe efeito-base: o reajuste sobre a base já existente é
                o que geraria essa parcela na cascata.
              </>
            )}
          </p>
        </div>
      </div>
    </Painel>
  )
}
