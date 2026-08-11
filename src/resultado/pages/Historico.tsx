import { useMemo, useState } from 'react'
import { useExcluirRun, useRuns } from '@/resultado/api/queries'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { useCrumbs } from '@/resultado/state/Crumbs'
import { useApp } from '@/comum/state/AppContext'
import { brlMi, dataHora, deTotal, duracao, pct } from '@/resultado/lib/formato'
import type { RunResumo } from '@/resultado/domain/resultado'
import { DetalhesDaSimulacao } from '@/resultado/components/DetalhesDaSimulacao'
import styles from './Historico.module.css'

type Ordem = 'recentes' | 'vpl' | 'capex'

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: 'recentes', rotulo: 'Mais recentes' },
  { id: 'vpl', rotulo: 'Maior VPL' },
  { id: 'capex', rotulo: 'Maior CAPEX' },
]

/**
 * Nivel 0 — historico de simulacoes, a porta de entrada dos resultados.
 *
 * A tela existe para COMPARAR rodadas antes de abrir qualquer uma: por isso cada
 * card traz as metricas de capa e, principalmente, os PARAMETROS. Duas rodadas da
 * mesma unidade com VPL diferente so fazem sentido quando se ve que uma rodou com
 * CTS e a outra nao.
 */
export function Historico() {
  const { data: runs, isPending, isError, error, refetch, isFetching } = useRuns()
  const excluir = useExcluirRun()
  const { askConfirm, toast } = useApp()
  const [busca, setBusca] = useState('')
  /** A rodada cujos metadados estão abertos. `null` = modal fechado. */
  const [detalhes, setDetalhes] = useState<RunResumo | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  useCrumbs([])

  const lista = useMemo(() => {
    if (!runs) return []
    const q = busca.trim().toLowerCase()
    const filtradas = runs.filter(
      (r) =>
        q === '' ||
        r.nome.toLowerCase().includes(q) ||
        r.runId.toLowerCase().includes(q) ||
        r.unidadeNome.toLowerCase().includes(q),
    )
    const ordenadas = [...filtradas]
    if (ordem === 'vpl')
      ordenadas.sort((a, b) => (b.metricas?.vpl ?? -Infinity) - (a.metricas?.vpl ?? -Infinity))
    else if (ordem === 'capex')
      ordenadas.sort((a, b) => (b.metricas?.capex ?? -Infinity) - (a.metricas?.capex ?? -Infinity))
    else ordenadas.sort((a, b) => b.dataHora.localeCompare(a.dataHora))
    return ordenadas
  }, [runs, busca, ordem])

  // O destaque e sobre TODAS as rodadas, nao sobre o resultado do filtro: "maior
  // VPL" que muda quando voce digita na busca nao seria um destaque, seria ruido.
  const melhorVpl = useMemo(
    () => Math.max(...(runs ?? []).map((r) => r.metricas?.vpl ?? -Infinity), -Infinity),
    [runs],
  )

  function pedirExclusao(r: RunResumo) {
    askConfirm({
      titulo: `Excluir "${r.nome}"?`,
      texto:
        'O resultado desta simulação é apagado e não pode ser recuperado. ' +
        'O cadastro da unidade NÃO é afetado — os dados de entrada continuam onde estão, ' +
        'e você pode rodar a simulação de novo quando quiser.',
      confirmarLabel: 'Sim, excluir',
      onConfirm: () =>
        excluir.mutate(r.runId, {
          onSuccess: () => toast(`Simulação "${r.nome}" excluída.`),
          onError: () => toast('Não foi possível excluir. Tente de novo.'),
        }),
    })
  }

  if (isPending) return <Carregando label="Carregando simulações…" />
  if (isError)
    return (
      <ErroCarga
        erro={error}
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
      <div className={styles.topo}>
        <div>
          <h1 className={styles.titulo} id="titulo-historico">
            Histórico de simulações
          </h1>
          <p className={styles.sub}>
            {lista.length} de {runs.length} rodada{runs.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className={styles.controles}>
          <label className={styles.buscaLabel} htmlFor="busca-rodada">
            Buscar
          </label>
          <input
            id="busca-rodada"
            className={styles.busca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="nome, unidade ou id"
          />
          <div className={styles.ordens} role="group" aria-label="Ordenar por">
            {ORDENS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={o.id === ordem ? styles.ordemAtiva : styles.ordem}
                aria-pressed={o.id === ordem}
                onClick={() => setOrdem(o.id)}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className={styles.semResultado}>
          Nenhuma simulação corresponde a <strong>{busca}</strong>.
        </p>
      ) : (
        <ul className={styles.lista}>
          {lista.map((r) => (
            <CardRodada
              key={r.runId}
              run={r}
              melhorVpl={melhorVpl}
              onExcluir={() => pedirExclusao(r)}
              onAbrirDetalhes={() => setDetalhes(r)}
              excluindo={excluir.isPending && excluir.variables === r.runId}
            />
          ))}
        </ul>
      )}
      {detalhes && <DetalhesDaSimulacao run={detalhes} onFechar={() => setDetalhes(null)} />}
    </section>
  )
}

function CardRodada({
  run: r,
  melhorVpl,
  onExcluir,
  onAbrirDetalhes,
  excluindo,
}: {
  run: RunResumo
  melhorVpl: number
  onExcluir: () => void
  /** Abre os metadados da rodada. Antes daqui se ia direto para o resultado. */
  onAbrirDetalhes: () => void
  excluindo: boolean
}) {
  // TRES estados, e nao dois. A tela nasceu com "tem resultado" x "INFEASIBLE",
  // e desde que o historico inclui as rodadas EM VOO ha um terceiro: a que ainda
  // nao publicou. Ela nao tem metricas, nem parametros, nem para onde navegar —
  // e foi o que derrubou a tela inteira, com `r.parametros.janelaCapex` num
  // objeto `undefined`.
  const emVoo = !r.publicada
  const semResultado = !emVoo && r.status === 'INFEASIBLE'
  const ehMelhor = !semResultado && r.metricas?.vpl === melhorVpl
  const usoApertado = (r.metricas?.usoOrcamentoPct ?? 0) > 97

  return (
    <li className={`${styles.card} ${ehMelhor ? styles.cardDestaque : ''}`}>
      <div className={styles.cabecalho}>
        <div className={styles.identidade}>
          <h2 className={styles.nome}>
            {r.favorita && (
              <span className={styles.favorita} title="Favorita">
                ★
              </span>
            )}
            {/* O nome é o gatilho, e não o card inteiro: o card contém o botão
                Excluir, e um botão dentro de outro é HTML inválido — o clique em
                Excluir dispararia os dois. */}
            <button type="button" className={styles.abrir} onClick={onAbrirDetalhes}>
              {r.nome || 'Simulação sem nome'}
            </button>
          </h2>
          <p className={styles.meta}>
            <code className={styles.id}>{r.runId}</code> · {r.unidadeNome} · {dataHora(r.dataHora)}{' '}
            · {r.autor} · solver {duracao(r.duracaoS)}
          </p>
        </div>
        <div className={styles.selos}>
          {ehMelhor && <span className={styles.tag}>★ maior VPL</span>}
          <span className={emVoo || semResultado ? styles.seloRuim : styles.seloBom}>
            {emVoo ? r.status : `solver ${r.status}`}
          </span>
        </div>
      </div>

      {emVoo ? (
        <p className={styles.aviso}>
          {r.status === 'ERRO'
            ? (r.erro ??
              'A execução falhou e o job não informou a causa. O histórico guarda a rodada para reexecução.')
            : r.status === 'RODANDO'
              ? `Em execução — ${r.progresso ?? 0}% concluído. O resultado aparece aqui quando o job publicar.`
              : 'Na fila, esperando um executor. Ainda não começou a rodar.'}
        </p>
      ) : semResultado ? (
        <p className={styles.aviso}>
          O solver não encontrou um plano viável com estes parâmetros — não há resultados para
          abrir. Normalmente é orçamento pequeno demais para as obras obrigatórias, ou uma janela
          curta demais para a ordem física das obras.
        </p>
      ) : (
        <dl className={styles.metricas}>
          <Metrica k="VPL" v={brlMi(r.metricas?.vpl)} destaque />
          <Metrica k="CAPEX" v={brlMi(r.metricas?.capex)} />
          <Metrica
            k="Uso do orçamento"
            v={pct(r.metricas?.usoOrcamentoPct)}
            alerta={usoApertado}
            nota={usoApertado ? 'o teto foi o gargalo' : undefined}
          />
          <Metrica k="Obras" v={deTotal(r.metricas?.obrasConstruidas, r.metricas?.obrasTotal)} />
          <Metrica k="Cobertura no fim" v={pct(r.metricas?.coberturaFimPct)} />
          <Metrica
            k="Metas atingidas"
            v={deTotal(r.metricas?.metasAtingidas, r.metricas?.metasTotal)}
          />
          <Metrica k="EBITDA total" v={brlMi(r.metricas?.ebitdaTotal)} />
        </dl>
      )}

      {/* Os parametros ficam visiveis inclusive na rodada que FALHOU: e olhando
          para eles que se entende por que ela falhou.
          Na rodada EM VOO eles ainda nao existem — saem de `otim_meta`, que so e
          escrita na publicacao. Antes este bloco era incondicional, e a tela
          inteira caia em `undefined.janelaCapex`. */}
      {r.parametros && (
        <ul className={styles.params}>
          <Param k="janela de CAPEX" v={`${r.parametros.janelaCapex} anos`} />
          <Param k="orçamento" v={brlMi(r.parametros.orcamento)} />
          <Param k="foco" v={String(r.parametros.focoCobertura)} />
          <Param k="usar CTS" v={r.parametros.usarCts ? 'sim' : 'não'} />
          <Param k="base de receita" v={r.parametros.baseReceita} />
          <Param k="indústria" v={r.parametros.incluirIndustrial ? 'incluída' : 'só residencial'} />
        </ul>
      )}

      <div className={styles.acoes}>
        {/* NÃO navega mais direto. Abre os metadados, e é de lá que se vai ao
            resultado — inclusive na rodada EM VOO e na INFEASIBLE, que antes não
            tinham para onde ir e por isso não ofereciam nada. Justamente delas é
            que se quer saber "com que parâmetros isso foi pedido?". */}
        <button type="button" className={styles.ver} onClick={onAbrirDetalhes}>
          Ver detalhes →
        </button>
        <button
          type="button"
          className={styles.excluir}
          onClick={onExcluir}
          disabled={excluindo}
          aria-label={`Excluir simulação ${r.nome}`}
        >
          {excluindo ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
    </li>
  )
}

function Metrica({
  k,
  v,
  destaque,
  alerta,
  nota,
}: {
  k: string
  v: string
  destaque?: boolean
  alerta?: boolean
  nota?: string
}) {
  return (
    <div className={styles.metrica}>
      <dt className={styles.metricaK}>{k}</dt>
      <dd
        className={
          destaque ? styles.metricaVDestaque : alerta ? styles.metricaVAlerta : styles.metricaV
        }
      >
        {v}
        {nota && <span className={styles.metricaNota}>{nota}</span>}
      </dd>
    </div>
  )
}

function Param({ k, v }: { k: string; v: string }) {
  return (
    <li className={styles.param}>
      <span className={styles.paramK}>{k}</span> {v}
    </li>
  )
}
