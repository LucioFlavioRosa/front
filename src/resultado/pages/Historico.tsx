import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAlternarFavorita, useExcluirRun, useRuns } from '@/resultado/api/queries'
import { RITMO_LISTA, chavesRodada, useStatusRodada } from '@/comum/api/rodada'
import { decorrido, demorandoDemais } from '@/comum/domain/espera'
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
  const favorita = useAlternarFavorita()
  const { askConfirm, toast } = useApp()
  const [busca, setBusca] = useState('')
  /** A rodada cujos metadados estão abertos. `null` = modal fechado. */
  const [detalhes, setDetalhes] = useState<RunResumo | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const [soFavoritas, setSoFavoritas] = useState(false)
  useCrumbs([])

  // Sobre TODAS as rodadas, e não sobre o resultado da busca: é a contagem que
  // diz se vale ligar o filtro, e ela não pode mudar enquanto se digita.
  const nFavoritas = (runs ?? []).filter((r) => r.favorita).length

  const lista = useMemo(() => {
    if (!runs) return []
    const q = busca.trim().toLowerCase()
    const filtradas = runs.filter(
      (r) =>
        (!soFavoritas || r.favorita) &&
        (q === '' ||
          r.nome.toLowerCase().includes(q) ||
          r.runId.toLowerCase().includes(q) ||
          r.unidadeNome.toLowerCase().includes(q)),
    )
    const ordenadas = [...filtradas]
    if (ordem === 'vpl')
      ordenadas.sort((a, b) => (b.metricas?.vpl ?? -Infinity) - (a.metricas?.vpl ?? -Infinity))
    else if (ordem === 'capex')
      ordenadas.sort((a, b) => (b.metricas?.capex ?? -Infinity) - (a.metricas?.capex ?? -Infinity))
    else ordenadas.sort((a, b) => b.dataHora.localeCompare(a.dataHora))
    return ordenadas
  }, [runs, busca, ordem, soFavoritas])

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
          {/* Filtro, e não ordenação: por isso fora do grupo acima. Ele é um
              interruptor de um estado só — "só as favoritas" — e `aria-pressed`
              diz ao leitor de tela que ele fica ligado, o que um botão comum não
              diria. */}
          <button
            type="button"
            className={soFavoritas ? styles.filtroAtivo : styles.filtro}
            aria-pressed={soFavoritas}
            onClick={() => setSoFavoritas((v) => !v)}
          >
            ★ Só favoritas
            {nFavoritas > 0 && <span className={styles.filtroContagem}>{nFavoritas}</span>}
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        // A frase tem de dizer QUAL recorte esvaziou a lista. Com o filtro de
        // favoritas ligado e a busca vazia, "não corresponde a ''" mandaria o
        // usuário procurar erro de digitação num campo em branco.
        <p className={styles.semResultado}>
          {soFavoritas && nFavoritas === 0 ? (
            <>
              Nenhuma simulação foi marcada como favorita. Use a estrela ao lado do nome para marcar
              as que você quer reencontrar depois.
            </>
          ) : soFavoritas && busca ? (
            <>
              Nenhuma <strong>favorita</strong> corresponde a <strong>{busca}</strong>.
            </>
          ) : (
            <>
              Nenhuma simulação corresponde a <strong>{busca}</strong>.
            </>
          )}
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
              onAlternarFavorita={() =>
                favorita.mutate(
                  { runId: r.runId, favorita: !r.favorita },
                  {
                    // Só o toast fica no `mutate`: ele é da tela, e se ela sair
                    // não há onde mostrá-lo. O que mexe no cache está no nível do
                    // hook, e sobrevive à desmontagem.
                    onError: () => toast('Não foi possível mudar a favorita.'),
                  },
                )
              }
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
  onAlternarFavorita,
  excluindo,
}: {
  run: RunResumo
  melhorVpl: number
  onExcluir: () => void
  /** Abre os metadados da rodada. Antes daqui se ia direto para o resultado. */
  onAbrirDetalhes: () => void
  onAlternarFavorita: () => void
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
            {/* A estrela é o CONTROLE, e não um enfeite ao lado do nome. Ela
                estava aqui como `<span>` desde sempre, mas nada a ligava: o
                backend mandava `favorita: false` fixo, então ela nunca apareceu
                em produção.
                Botão próprio e fora do botão do nome — um dentro do outro é HTML
                inválido, e o clique dispararia os dois. */}
            <button
              type="button"
              className={r.favorita ? styles.favorita : styles.favoritaVazia}
              aria-pressed={r.favorita}
              aria-label={
                r.favorita
                  ? `Desmarcar "${r.nome || r.runId}" como favorita`
                  : `Marcar "${r.nome || r.runId}" como favorita`
              }
              onClick={onAlternarFavorita}
            >
              {r.favorita ? '★' : '☆'}
            </button>
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
        <AvisoEmVoo run={r} />
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

/**
 * O que está acontecendo com uma rodada que ainda não publicou.
 *
 * A frase era fixa — "Na fila, esperando um executor" — e cobria dois mundos
 * opostos: todas as vagas ocupadas (espere) e NENHUM executor de pé (isto nunca
 * vai rodar). Em produção o segundo caso é silencioso, e esta é a tela em que
 * alguém repara: o modal da nova simulação some quando se fecha a aba, o
 * histórico fica.
 *
 * COMPONENTE PRÓPRIO porque o hook só pode existir na rodada em voo. A lista tem
 * dezenas de publicadas, e nenhuma delas deve disparar request — chamar
 * `useStatusRodada` dentro do `CardRodada` faria exatamente isso, já que hook não
 * roda sob condição.
 *
 * O hook vem de `comum/`, e não de `simulacao/`: foi esta tela que tornou o
 * `GET /runs/{id}/status` uma pergunta de duas áreas, e a fronteira do ESLint
 * recusou o atalho de importar da outra — o que estava certo.
 */
function AvisoEmVoo({ run: r }: { run: RunResumo }) {
  const qc = useQueryClient()
  const status = useStatusRodada(r.runId, RITMO_LISTA)
  const atual = status.data?.status ?? r.status
  const fila = status.data?.fila

  // A lista foi buscada uma vez e não se atualiza sozinha. Sem isto, a rodada que
  // termina enquanto alguém olha a tela fica em "Em execução — 100%" para sempre,
  // com o resultado já gravado logo ali, e só um F5 revelaria.
  useEffect(() => {
    if (atual !== 'PENDENTE' && atual !== 'RODANDO') {
      void qc.invalidateQueries({ queryKey: chavesRodada.lista })
    }
  }, [atual, qc])

  // `pedidaEm` do status é a fonte melhor; `dataHora` da lista é a mesma coluna
  // (`solicitado_em`) e serve enquanto o primeiro request não voltou.
  const pedidaEm = status.data?.pedidaEm ?? r.dataHora
  const emExecucao = atual === 'RODANDO'
  const esperando = atual === 'PENDENTE' || emExecucao
  const progresso = status.data?.progresso ?? r.progresso ?? 0

  const texto =
    atual === 'ERRO'
      ? (status.data?.erro ??
        r.erro ??
        'A execução falhou e o job não informou a causa. O histórico guarda a rodada para reexecução.')
      : atual === 'CANCELADA'
        ? 'Cancelada antes de terminar — não há resultado para abrir. Para rodar de novo, crie uma nova simulação.'
        : // Em execução o `motivo` do backend é só "Em execução.", que o selo de
          // status já diz e sem o progresso; a exceção é o lease vencido, que vem
          // com `atencao` e é a única coisa aqui que a lista não teria como saber.
          emExecucao && !fila?.atencao
          ? `Em execução — ${progresso}% concluído. O resultado aparece aqui quando o job publicar.`
          : (fila?.motivo ?? 'Na fila. Ainda não começou a rodar.')

  // O relógio e o destaque só valem enquanto a rodada ESPERA. Numa que já parou,
  // o tempo desde o pedido não é espera nenhuma — "pedida há 54h" sobre uma
  // rodada que falhou anteontem é ruído, e com cara de alerta é ruído que assusta.
  //
  // Sem o bloco `fila` (servidor anterior a ele), o relógio sozinho ainda
  // distingue lento de travado, que é o mínimo que esta tela deve a quem olha.
  const espera = esperando ? decorrido(pedidaEm) : ''
  const alerta = esperando && (!!fila?.atencao || (!emExecucao && demorandoDemais(pedidaEm)))

  return (
    <>
      <p className={alerta ? styles.avisoAtencao : styles.aviso}>
        {texto}
        {espera && <span className={styles.espera}> · pedida {espera}</span>}
      </p>
      {/* O QUE O SOLVER ACHOU, quando a rodada morreu depois dele. Sem isto, uma
          falha na publicação apaga um plano que existiu — e o número só ficava no
          log do executor, que some quando alguém fecha o terminal. */}
      {r.solver && (
        <p className={styles.solverNota}>
          <strong>O solver chegou a:</strong> {r.solver}
          {' — '}o resultado não chegou a ser publicado, então não há o que abrir.
        </p>
      )}
    </>
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
