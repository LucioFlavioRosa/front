import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComentarDaRodada } from '@/resultado/api/queries'
import { ordenarParametros, rotuloDoParametro, valorDoParametro } from '@/resultado/domain/pedido'
import type { RunResumo } from '@/resultado/domain/resultado'
import styles from './DetalhesDaSimulacao.module.css'

/**
 * OS METADADOS DA SIMULAÇÃO, antes de abrir o resultado.
 *
 * Responde "qual dessas rodadas é a que eu quero?" sem sair da lista: quem fez,
 * quando, em que unidade, e com que variáveis ela foi pedida. Duas saídas, e
 * nada mais — abrir o resultado, ou fechar.
 *
 * ## Acessibilidade
 *
 * Segue o `ConfirmModal`: `Esc` fecha, o foco entra no card, fica preso enquanto
 * ele estiver aberto e volta ao elemento de origem ao fechar. Sem o retorno de
 * foco, o teclado volta ao início da página — e a lista de rodadas é longa.
 *
 * O foco inicial vai em **Fechar**, e não em "Ver resultados": o modal é uma
 * parada para ler, e Enter logo após abrir não pode navegar para fora antes de a
 * pessoa ter lido o que pediu para ver.
 */
export function DetalhesDaSimulacao({ run, onFechar }: { run: RunResumo; onFechar: () => void }) {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const origemRef = useRef<HTMLElement | null>(null)

  const semResultado = !run.publicada || run.status === 'INFEASIBLE'

  useEffect(() => {
    origemRef.current = document.activeElement as HTMLElement | null
    fecharRef.current?.focus()
    return () => {
      const origem = origemRef.current
      if (origem?.isConnected) origem.focus()
      else document.getElementById('conteudo')?.focus()
    }
  }, [])

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar()
        return
      }
      if (e.key !== 'Tab') return
      // `textarea` entra na lista: o comentário é editável aqui dentro, e um
      // campo que o Tab pula é um campo que o teclado não alcança.
      const focaveis = cardRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], textarea',
      )
      if (!focaveis?.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    },
    [onFechar],
  )

  useEffect(() => {
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onKey])

  const parametros = run.pedido ? ordenarParametros(run.pedido) : []

  return (
    <div className={styles.overlay} onClick={onFechar} role="presentation">
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="det-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.titulo} id="det-titulo">
          {run.nome || 'Simulação sem nome'}
        </h2>

        <dl className={styles.meta}>
          <Linha k="Quem fez" v={run.autor || '—'} />
          <Linha k="Quando" v={quando(run.dataHora)} />
          <Linha k="Unidade" v={run.unidadeNome || run.unidadeId || '—'} />
          <Linha k="Situação" v={run.publicada ? `solver ${run.status}` : run.status} />
          <Linha k="Identificador" v={run.runId} mono />
        </dl>

        <h3 className={styles.secao}>Variáveis usadas nesta simulação</h3>
        {parametros.length > 0 ? (
          <dl className={styles.params}>
            {parametros.map(([chave, valor]) => (
              <div key={chave} className={styles.param}>
                <dt className={styles.paramRotulo}>
                  {rotuloDoParametro(chave)} <code className={styles.tecnico}>{chave}</code>
                </dt>
                <dd className={styles.paramValor}>{valorDoParametro(chave, valor)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          // Rodada publicada direto pelo pacote de produção não passou pela fila,
          // e por isso não tem pedido gravado. Dizer isso é melhor que uma lista
          // vazia, que se lê como "rodou sem parâmetro nenhum".
          <p className={styles.semParams}>
            Esta rodada não tem o pedido registrado — ela foi publicada sem passar pela fila, e as
            variáveis não ficaram guardadas.
          </p>
        )}

        <Comentario run={run} />

        <div className={styles.acoes}>
          <button type="button" ref={fecharRef} className={styles.btn} onClick={onFechar}>
            Fechar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.primario}`}
            disabled={semResultado}
            title={semResultado ? 'Esta rodada não tem resultado para abrir.' : undefined}
            onClick={() => navigate(`/resultados/${run.runId}`)}
          >
            Ver resultados →
          </button>
        </div>
      </div>
    </div>
  )
}

/** Teto do texto — o mesmo que o backend recusa acima (`_MAX_COMENTARIO`). */
const MAX = 4000

/**
 * A ANOTAÇÃO DA RODADA, escrita depois de ver o resultado.
 *
 * Fica aqui, e não no formulário de simulação, porque é isso que ela é: o nome da
 * rodada descreve a intenção e é dado no disparo; o comentário descreve a
 * conclusão e só existe depois. Quem abre a rodada semanas depois lê os dois.
 *
 * É COMPARTILHADO: qualquer pessoa que enxerga a rodada pode reescrever. Por isso
 * o rodapé mostra quem escreveu por último e quando — sem isso, um texto que
 * mudou sozinho aos olhos de quem já tinha lido não teria explicação.
 *
 * Salvar fica DESABILITADO sem mudança, como no cadastro: um botão que aceita
 * clique sem ter o que gravar ensina que salvar não significa nada.
 */
function Comentario({ run }: { run: RunResumo }) {
  const salvo = run.comentario?.texto ?? ''
  const [texto, setTexto] = useState(salvo)
  const comentar = useComentarDaRodada()
  const id = useId()

  // Se o servidor trouxer outra versão (outra pessoa escreveu, ou a lista
  // recarregou), o campo acompanha — MAS só quando não há edição local pendente,
  // senão o refetch apagaria o que está sendo digitado agora.
  //
  // Ajuste DURANTE O RENDER, e não num efeito: é o padrão do React para estado
  // derivado de prop, e roda antes da pintura — o efeito faria a tela mostrar o
  // texto velho por um quadro. É também o que evita mais um `eslint-disable` de
  // `set-state-in-effect`, dos quais o projeto já carrega cinco.
  const [salvoVisto, setSalvoVisto] = useState(salvo)
  if (salvo !== salvoVisto) {
    setSalvoVisto(salvo)
    if (texto === '' || texto === salvoVisto) setTexto(salvo)
  }

  const mudou = texto.trim() !== salvo.trim()

  return (
    <>
      <h3 className={styles.secao}>Comentário</h3>
      <p className={styles.comentarioAjuda} id={`${id}-ajuda`}>
        Anotação sobre esta rodada — o que ela mostrou, por que ela importa. Todo mundo que vê a
        rodada lê e pode editar.
      </p>
      <textarea
        id={id}
        className={styles.comentarioCampo}
        value={texto}
        maxLength={MAX}
        rows={3}
        aria-describedby={`${id}-ajuda`}
        placeholder="Ex.: melhor cenário até agora — o pico de CAPEX de 2029 desaparece."
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className={styles.comentarioRodape}>
        <span className={styles.comentarioAutoria}>
          {run.comentario?.autor
            ? `Última edição de ${run.comentario.autor}, ${quando(run.comentario.atualizadoEm)}`
            : 'Ninguém anotou esta rodada ainda.'}
        </span>
        <button
          type="button"
          className={styles.btn}
          disabled={!mudou || comentar.isPending}
          onClick={() => comentar.mutate({ runId: run.runId, texto: texto.trim() })}
        >
          {comentar.isPending ? 'Salvando…' : 'Salvar comentário'}
        </button>
      </div>
      {/* Pessimista: o texto na tela só é o do servidor depois que ele aceita.
          `role="alert"` porque a falha acontece longe do olho — o botão fica no
          rodapé e a pessoa pode já estar lendo os parâmetros acima. */}
      {comentar.isError && (
        <p className={styles.comentarioErro} role="alert">
          Não foi possível salvar o comentário. O texto continua aqui — tente de novo.
        </p>
      )}
    </>
  )
}

function Linha({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className={styles.linha}>
      <dt className={styles.chave}>{k}</dt>
      <dd className={`${styles.valor} ${mono ? styles.mono : ''}`}>{v}</dd>
    </div>
  )
}

/** `10/08/2026 14:32` — no fuso de quem lê. */
function quando(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${DIA.format(d)} ${HORA.format(d)}`
}

const DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
