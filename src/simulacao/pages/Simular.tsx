import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRegionais, useUnidades } from '@/comum/api/organizacao'
import { useCriarRodada, useProntidao, useStatusRodada } from '@/simulacao/api/queries'
import { useApp } from '@/comum/state/AppContext'
import {
  aceitaFoco,
  bloqueado,
  corpoDaRodada,
  derivarOrcamento,
  estadoInicial,
  etapaDe,
  num,
  rotuloFoco,
  validar,
  type EstadoSimulacao,
  type Penalidade,
  type TamanhoDaUnidade,
} from '@/simulacao/domain/simulacao'
import { Ajuda, Campo, Interruptor, Opcao, Rotulo, Secao } from '@/simulacao/components/campos'
import styles from './Simular.module.css'

const CIDADES_EXEMPLO = [
  'Maricá',
  'Saquarema',
  'Araruama',
  'Cabo Frio',
  'Iguaba',
  'Rio das Ostras',
  'Búzios',
  'Silva Jardim',
]

const AJUDA_PENALIDADE: Record<Penalidade, string> = {
  'meta+cobertura': 'Penaliza o descumprimento da meta e também a cobertura abaixo do possível.',
  meta: 'Penaliza apenas o descumprimento da meta do ano.',
  ligacao: 'Penaliza por ligação não atendida, independente da meta.',
}

/**
 * Nova simulação — o disparo de uma rodada do otimizador.
 *
 * Duas colunas: as 5 seções de parâmetro à esquerda, o resumo fixo à direita. O
 * resumo NAO e decorativo: ele lista os parametros na ordem em que serao
 * enviados, e e a conferencia final antes de criar algo que vai existir para
 * sempre no historico.
 */
export function Simular() {
  const [e, setE] = useState<EstadoSimulacao>(estadoInicial)
  const [runId, setRunId] = useState<string | undefined>()
  /** Rodada CONCLUÍDA idêntica que o servidor devolveu em vez de criar (R5). */
  const [jaExistente, setJaExistente] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useApp()

  const regionais = useRegionais()
  const unidades = useUnidades(e.regionalId || null)
  const prontidao = useProntidao(e.unidadeId || undefined)
  const criar = useCriarRodada()
  const status = useStatusRodada(runId)

  const set = <K extends keyof EstadoSimulacao>(k: K, v: EstadoSimulacao[K]) =>
    setE((s) => ({ ...s, [k]: v }))

  const orc = useMemo(() => derivarOrcamento(e), [e])
  const checklist = useMemo(() => validar(e, prontidao.data), [e, prontidao.data])
  const travado = bloqueado(checklist)
  const focoV = Math.min(1, Math.max(0, num(e.foco)))

  useEffect(() => {
    document.title = 'Nova simulação · Otimizador CAPEX'
  }, [])

  // Terminou: a rodada ja esta no historico, e e para la que o usuario vai.
  useEffect(() => {
    if (status.data?.status === 'SUCESSO') {
      toast('Simulação concluída — disponível no histórico.')
    }
  }, [status.data?.status, toast])

  function iniciar() {
    if (travado) return
    setJaExistente(null)
    criar.mutate(corpoDaRodada(e), {
      onSuccess: (r) => {
        // O servidor deduplicou para uma rodada que JÁ TERMINOU (R5): não há o
        // que acompanhar, e abrir o modal de progresso de algo concluído ontem
        // seria teatro. Mostra o aviso com o link e não inicia polling nenhum.
        //
        // Dedupe de rodada EM VOO continua caindo no caminho normal: ali há
        // execução acontecendo, e acompanhá-la é exatamente o que o usuário quer
        // — é o duplo clique levando ao mesmo lugar.
        if (r.jaExistia && r.status === 'SUCESSO') {
          setJaExistente(r.runId)
          return
        }
        setRunId(r.runId)
      },
      onError: () => toast('Não foi possível iniciar a rodada. Tente de novo.'),
    })
  }

  const st = status.data?.status
  const terminal = st === 'SUCESSO' || st === 'ERRO' || st === 'FALHOU_QUALIDADE'
  const emVoo = !!runId && st !== 'CANCELADA'
  const progresso = status.data?.progresso ?? 0

  return (
    <div className={styles.pagina}>
      <div className={styles.coluna}>
        <h1 className={styles.titulo}>Nova simulação</h1>
        <p className={styles.sub}>
          Uma rodada do otimizador sobre o cadastro de uma unidade. Ao iniciar, ela roda no servidor
          e aparece no histórico ao terminar.
        </p>

        {/* ---------------- 01 ESCOPO ---------------- */}
        <Secao
          numero="01"
          titulo="Escopo"
          descricao="Qual unidade será otimizada e como chamar esta rodada."
        >
          <div className={styles.linha2}>
            <div className={styles.campo}>
              <label className={styles.rot} htmlFor="sim-regional">
                Regional
              </label>
              <select
                id="sim-regional"
                className={styles.select}
                value={e.regionalId}
                onChange={(ev) =>
                  setE((s) => ({ ...s, regionalId: ev.target.value, unidadeId: '' }))
                }
              >
                <option value="">— selecione —</option>
                {(regionais.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.rot} htmlFor="sim-unidade">
                Unidade
              </label>
              <select
                id="sim-unidade"
                className={styles.select}
                value={e.unidadeId}
                disabled={!e.regionalId}
                onChange={(ev) => set('unidadeId', ev.target.value)}
              >
                <option value="">{e.regionalId ? '— selecione —' : 'escolha a regional'}</option>
                {(unidades.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.campo}>
            <label className={styles.rot} htmlFor="sim-nome">
              Nome da simulação
            </label>
            <input
              id="sim-nome"
              className={styles.input}
              value={e.nome}
              placeholder="ex.: Litoral 1 — janela 8a, foco cobertura"
              onChange={(ev) => set('nome', ev.target.value)}
            />
          </div>

          <FaixaProntidao
            unidadeId={e.unidadeId}
            nome={prontidao.data?.unidadeNome}
            pendencias={prontidao.data?.pendencias}
            carregando={prontidao.isPending && !!e.unidadeId}
          />
        </Secao>

        {/* ---------------- 02 ORCAMENTO ---------------- */}
        <Secao
          numero="02"
          titulo="Orçamento de CAPEX"
          descricao="O cronograma define quanto se pode investir por ano — e é ele que determina a janela de CAPEX."
        >
          <div className={styles.modos} role="group" aria-label="Modo do orçamento">
            {(
              [
                ['ano', 'Cronograma por ano'],
                ['unico', 'Valor único + horizonte'],
              ] as const
            ).map(([id, t]) => (
              <button
                key={id}
                type="button"
                className={e.modoOrcamento === id ? styles.modoAtivo : styles.modo}
                aria-pressed={e.modoOrcamento === id}
                onClick={() => set('modoOrcamento', id)}
              >
                {t}
              </button>
            ))}
          </div>

          {e.modoOrcamento === 'ano' ? (
            <>
              <ul className={styles.anos}>
                {e.orcamento.map((linha, i) => {
                  const temVerba = num(linha.valor) > 0
                  return (
                    <li key={i} className={temVerba ? styles.anoComVerba : styles.anoSemVerba}>
                      <input
                        className={styles.anoInput}
                        value={linha.ano}
                        aria-label={`Ano da linha ${i + 1}`}
                        onChange={(ev) =>
                          setE((s) => {
                            const o = s.orcamento.map((x) => ({ ...x }))
                            o[i].ano = ev.target.value
                            return { ...s, orcamento: o }
                          })
                        }
                      />
                      <button
                        type="button"
                        className={styles.anoRemover}
                        aria-label={`Remover o ano ${linha.ano}`}
                        onClick={() =>
                          setE((s) => ({
                            ...s,
                            orcamento: s.orcamento.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ✕
                      </button>
                      <span className={styles.anoValorLinha}>
                        <input
                          className={styles.anoValor}
                          value={linha.valor}
                          inputMode="decimal"
                          aria-label={`Verba de ${linha.ano}, em milhões`}
                          onChange={(ev) =>
                            setE((s) => {
                              const o = s.orcamento.map((x) => ({ ...x }))
                              o[i].valor = ev.target.value
                              return { ...s, orcamento: o }
                            })
                          }
                        />
                        <span className={styles.anoMi}>Mi</span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className={styles.anosAcoes}>
                <button
                  type="button"
                  className={styles.acaoSecundaria}
                  onClick={() =>
                    setE((s) => {
                      const ultimo = s.orcamento[s.orcamento.length - 1]
                      const proximo = ultimo ? Math.round(num(ultimo.ano)) + 1 : 2026
                      return {
                        ...s,
                        orcamento: [...s.orcamento, { ano: String(proximo), valor: '0' }],
                      }
                    })
                  }
                >
                  + Adicionar ano
                </button>
                <button
                  type="button"
                  className={styles.acaoSecundaria}
                  onClick={() =>
                    setE((s) => ({ ...s, orcamento: s.orcamento.filter((l) => num(l.valor) > 0) }))
                  }
                >
                  Zerar anos sem verba
                </button>
              </div>
            </>
          ) : (
            <div className={styles.linha2}>
              <Campo
                rotulo="Verba por ano"
                tecnico="ORCAMENTO"
                valor={e.orcamentoValor}
                onChange={(v) => set('orcamentoValor', v)}
                sufixo="Mi por ano"
                largura={120}
              />
              <Campo
                rotulo="Horizonte"
                tecnico="HORIZONTE_CAPEX"
                valor={e.horizonte}
                onChange={(v) => set('horizonte', v)}
                sufixo="anos"
                largura={90}
              />
            </div>
          )}

          <div className={styles.totais}>
            <span>
              Total{' '}
              <strong className={styles.calculado}>
                R$ {orc.total.toLocaleString('pt-BR')} Mi
              </strong>
            </span>
            <span>
              Anos com verba <strong>{orc.anosComVerba.length}</strong>
            </span>
            <span>
              {/* A janela e DERIVADA do cronograma, nunca digitada — duas fontes
                  para a mesma verdade divergiriam no primeiro ano zerado. */}
              Janela de CAPEX <strong className={styles.calculado}>{orc.janelaTexto}</strong>
            </span>
          </div>

          <Interruptor
            rotulo="Redistribuir a verba entre os anos"
            tecnico="REDISTRIBUIR_ORCAMENTO"
            descricao="Mantém a SOMA do cronograma e libera o otimizador a antecipar ou postergar verba entre os anos."
            ligado={e.redistribuir}
            onToggle={() => set('redistribuir', !e.redistribuir)}
          />
          {e.redistribuir && (
            <div>
              <Campo
                rotulo="Teto de execução por ano"
                tecnico="TETO_EXECUCAO_ANUAL"
                valor={e.teto}
                onChange={(v) => set('teto', v)}
                sufixo="Mi"
                largura={120}
                placeholder={String(orc.pico)}
              />
              <Ajuda>Vazio usa o pico do cronograma ({orc.pico.toLocaleString('pt-BR')} Mi).</Ajuda>
            </div>
          )}

          <div>
            <Campo
              rotulo="Anos extra para concluir"
              tecnico="ANOS_EXTRA_CONCLUSAO"
              valor={e.anosExtra}
              onChange={(v) => set('anosExtra', v)}
              sufixo="anos"
              largura={90}
            />
            <Ajuda>
              A obra inicia dentro da janela e pode concluir até esses anos depois. O teto anual
              continua estrito <strong>dentro</strong> da janela; o “rabo” é custeado pela sobra
              acumulada. 0 = inicia e conclui na janela.
            </Ajuda>
          </div>
        </Secao>

        {/* ---------------- 03 OBJETIVO ---------------- */}
        <Secao
          numero="03"
          titulo="Objetivo — VPL x cobertura"
          descricao="O que o otimizador deve maximizar quando os dois entram em conflito."
        >
          <div>
            <Rotulo texto="Foco em cobertura" tecnico="FOCO_COBERTURA" htmlFor="sim-foco" />
            <div className={styles.focoLinha}>
              <input
                id="sim-foco"
                className={styles.focoInput}
                value={e.foco}
                inputMode="decimal"
                onChange={(ev) => set('foco', aceitaFoco(ev.target.value))}
              />
              <div className={styles.focoBarra} aria-hidden="true">
                <div className={styles.focoPreenchida} style={{ width: `${focoV * 100}%` }} />
              </div>
              <span className={styles.focoRotulo}>{rotuloFoco(focoV)}</span>
            </div>
            <div className={styles.focoEscala} aria-hidden="true">
              <span>0 · só VPL</span>
              <span>0,5 · equilíbrio</span>
              <span>1 · cobertura primeiro</span>
            </div>
            <div className={styles.atalhos}>
              {(
                [
                  ['0', 0, 'Só VPL', 'Ignora a meta e maximiza retorno.'],
                  ['0,5', 0.5, 'Equilíbrio', 'Pondera retorno e cobertura.'],
                  ['1', 1, 'Cobertura primeiro', 'Prioriza cumprir as metas do contrato.'],
                ] as const
              ).map(([texto, v, t, d]) => (
                <Opcao
                  key={texto}
                  titulo={t}
                  descricao={d}
                  // Comparacao NUMERICA: "1", "1,0" e "1.0" sao o mesmo valor, e
                  // o cartao tem de acender nos tres casos.
                  ativa={focoV === v}
                  onClick={() => set('foco', texto)}
                />
              ))}
            </div>
          </div>

          <div>
            <Rotulo texto="Penalidade" tecnico="PENALIDADE_COBERTURA" htmlFor="sim-penalidade" />
            <select
              id="sim-penalidade"
              className={styles.select}
              value={e.penalidade}
              onChange={(ev) => set('penalidade', ev.target.value as Penalidade)}
            >
              <option value="meta+cobertura">meta + cobertura</option>
              <option value="meta">meta</option>
              <option value="ligacao">ligação</option>
            </select>
            <Ajuda>{AJUDA_PENALIDADE[e.penalidade]}</Ajuda>
          </div>

          <div>
            <Rotulo texto="Metas de cobertura" tecnico="METAS_COBERTURA" htmlFor="sim-metas" />
            <select
              id="sim-metas"
              className={styles.select}
              value={e.fonteMetas}
              onChange={(ev) => set('fonteMetas', ev.target.value as 'cadastro' | 'ignorar')}
            >
              <option value="cadastro">Usar as metas do cadastro</option>
              <option value="ignorar">Ignorar as metas nesta rodada</option>
            </select>
          </div>

          <div>
            <Rotulo texto="Prioridade por cidade" tecnico="PESO_CIDADE" />
            <ul className={styles.pesos}>
              {e.pesos.map((p, i) => (
                <li key={i} className={styles.peso}>
                  <select
                    className={p.cidade === '' ? styles.selectPend : styles.select}
                    value={p.cidade}
                    aria-label={`Cidade da prioridade ${i + 1}`}
                    onChange={(ev) =>
                      setE((s) => {
                        const a = s.pesos.map((x) => ({ ...x }))
                        a[i].cidade = ev.target.value
                        return { ...s, pesos: a }
                      })
                    }
                  >
                    <option value="">— cidade —</option>
                    {CIDADES_EXEMPLO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    className={p.peso === '' ? styles.inputPend : styles.input}
                    value={p.peso}
                    inputMode="decimal"
                    placeholder="peso"
                    aria-label={`Peso da prioridade ${i + 1}`}
                    style={{ width: 90 }}
                    onChange={(ev) =>
                      setE((s) => {
                        const a = s.pesos.map((x) => ({ ...x }))
                        a[i].peso = ev.target.value
                        return { ...s, pesos: a }
                      })
                    }
                  />
                  <button
                    type="button"
                    className={styles.anoRemover}
                    aria-label={`Remover a prioridade ${i + 1}`}
                    onClick={() =>
                      setE((s) => ({ ...s, pesos: s.pesos.filter((_, j) => j !== i) }))
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.acaoSecundaria}
              onClick={() => setE((s) => ({ ...s, pesos: [...s.pesos, { cidade: '', peso: '' }] }))}
            >
              + Priorizar cidade
            </button>
          </div>
        </Secao>

        {/* ---------------- 04 RECEITA ---------------- */}
        <Secao
          numero="04"
          titulo="Receita, adesão e demanda"
          descricao="De onde sai o ticket e como as ligações novas entram ao longo do tempo."
        >
          <div>
            <Rotulo texto="Base de receita" tecnico="BASE_RECEITA" />
            <div className={styles.atalhos}>
              <Opcao
                titulo="Arrecadada · recomendado"
                descricao="O que de fato entrou — já reflete inadimplência."
                ativa={e.baseReceita === 'arrecadada'}
                onClick={() => set('baseReceita', 'arrecadada')}
              />
              <Opcao
                titulo="Faturada"
                descricao="O que era para entrar (bruto, sem inadimplência)."
                ativa={e.baseReceita === 'faturada'}
                onClick={() => set('baseReceita', 'faturada')}
              />
            </div>
            <Ajuda>O ticket da simulação é a receita escolhida ÷ ligações atuais.</Ajuda>
          </div>

          <div>
            <Rotulo texto="Curva de adesão" tecnico="CURVA_ADOCAO" />
            <div className={styles.atalhos}>
              <Opcao
                titulo="Curva S · recomendado"
                descricao="Adesão lenta, pico no meio, lenta no fim."
                ativa={e.curvaAdocao === 'scurve'}
                onClick={() => set('curvaAdocao', 'scurve')}
              />
              <Opcao
                titulo="Linear"
                descricao="Adesão constante mês a mês (comportamento antigo)."
                ativa={e.curvaAdocao === 'linear'}
                onClick={() => set('curvaAdocao', 'linear')}
              />
            </div>
          </div>

          <Interruptor
            rotulo="Usar CTS (coletor de tempo seco)"
            tecnico="USAR_CTS"
            descricao="SIM: a CTS entra como estrutura própria, com obras, receita e cobertura dela na otimização. Não: ligações, economias, população, receita e vazão da CTS são somadas à sub-bacia irmã."
            aviso="Só faz efeito se a base tiver CTS cadastrada."
            ligado={e.usarCts}
            onToggle={() => set('usarCts', !e.usarCts)}
          />
          <Interruptor
            rotulo="Incluir demanda industrial"
            tecnico="INCLUIR_INDUSTRIAL"
            descricao="SIM: residencial + industrial (usa os totais). Não: só residencial — subtrai a parcela industrial de ligações, receita e vazão; o CAPEX não muda."
            aviso="Só faz efeito se a base tiver as colunas *_industrial."
            ligado={e.incluirIndustrial}
            onToggle={() => set('incluirIndustrial', !e.incluirIndustrial)}
          />
        </Secao>

        {/* ---------------- 05 ETE E SOLVER ---------------- */}
        <Secao
          numero="05"
          titulo="ETE e execução do solver"
          descricao="Avançado — os padrões atendem à maioria das rodadas."
        >
          <Interruptor
            rotulo="ETE faseada"
            tecnico="ETE_FASEADA"
            descricao="Permite construir a ETE em módulos, conforme a vazão conectada cresce."
            ligado={e.eteFaseada}
            onToggle={() => set('eteFaseada', !e.eteFaseada)}
          />
          <Interruptor
            rotulo="ETE com número fixo de módulos"
            tecnico="ETE_FIXO"
            descricao="Trava a quantidade de módulos no que está cadastrado, sem otimizar a expansão."
            ligado={e.eteFixo}
            onToggle={() => set('eteFixo', !e.eteFixo)}
          />
          <div className={styles.linha3}>
            <Campo
              rotulo="Data de início"
              tecnico="DATA_INICIO"
              valor={e.dataInicio}
              onChange={(v) => set('dataInicio', v)}
              placeholder="2026-06"
              largura={120}
              inputMode="text"
            />
            <Campo
              rotulo="Tempo do solver"
              tecnico="MAX_TIME_S"
              valor={e.maxTimeS}
              onChange={(v) => set('maxTimeS', v)}
              sufixo="s"
              largura={90}
            />
            <Campo
              rotulo="Workers"
              tecnico="WORKERS"
              valor={e.workers}
              onChange={(v) => set('workers', v)}
              largura={70}
            />
          </div>
          <Ajuda>Data vazia = janeiro do ano-base do cadastro.</Ajuda>
        </Secao>
      </div>

      {/* ---------------- RESUMO FIXO ---------------- */}
      <aside className={styles.resumo} aria-label="Resumo da rodada">
        <div className={styles.resumoCaixa}>
          <h2 className={styles.resumoTitulo}>Resumo</h2>
          <dl className={styles.resumoLista}>
            <Item k="Unidade" v={prontidao.data?.unidadeNome ?? '—'} alerta={!e.unidadeId} />
            {/* O TAMANHO logo abaixo do nome, e não no fim: ele qualifica a
                unidade que se acabou de escolher, e é o que separa "rodar a
                Serrana" de "rodar a Leste" — 710 obras contra 11.525. Aparece só
                quando o servidor manda; um servidor antigo não quebra a tela. */}
            {prontidao.data?.tamanho && (
              <Item k="Tamanho" v={textoDoTamanho(prontidao.data.tamanho)} calc />
            )}
            <Item k="Orçamento total" v={`R$ ${orc.total.toLocaleString('pt-BR')} Mi`} calc />
            <Item k="Janela de CAPEX" v={orc.janelaTexto} calc />
            <Item
              k="Redistribuir verba"
              v={e.redistribuir ? `sim · teto ${e.teto ? `R$ ${e.teto} Mi` : '= pico'}` : 'não'}
            />
            <Item k="Anos extra p/ concluir" v={e.anosExtra} />
            <Item
              k="Foco em cobertura"
              v={`${focoV.toFixed(2).replace('.', ',')} · ${rotuloFoco(focoV)}`}
            />
            <Item k="Penalidade" v={e.penalidade} />
            <Item
              k="Metas"
              v={e.fonteMetas === 'cadastro' ? 'do cadastro' : 'ignoradas'}
              alerta={e.fonteMetas === 'ignorar'}
            />
            <Item
              k="Prioridade de cidade"
              v={e.pesos.length ? `${e.pesos.length} cidade(s)` : 'nenhuma'}
            />
            <Item k="Base de receita" v={e.baseReceita} />
            <Item k="Curva de adesão" v={e.curvaAdocao === 'scurve' ? 'curva S' : 'linear'} />
            <Item k="Usar CTS" v={e.usarCts ? 'sim' : 'não'} />
            <Item k="Incluir industrial" v={e.incluirIndustrial ? 'sim' : 'não'} />
            <Item
              k="ETE"
              v={`${e.eteFaseada ? 'faseada' : 'não faseada'}${e.eteFixo ? ' · módulos fixos' : ''}`}
            />
            <Item k="Solver" v={`${e.maxTimeS} s · ${e.workers} workers`} />
          </dl>
        </div>

        <div
          className={`${styles.checklist} ${travado ? styles.checkRuim : checklist.some((c) => c.severidade === 'avisa') ? styles.checkAviso : styles.checkBom}`}
        >
          <h3 className={styles.checkTitulo}>
            {travado
              ? 'Pendências que bloqueiam'
              : checklist.some((c) => c.severidade === 'avisa')
                ? 'Atenção antes de rodar'
                : 'Tudo pronto'}
          </h3>
          <ul className={styles.checkLista}>
            {checklist.map((c, i) => (
              <li key={i} className={styles[`check_${c.severidade}`]}>
                <span aria-hidden="true">
                  {c.severidade === 'bloqueia' ? '✕' : c.severidade === 'avisa' ? '!' : '✓'}
                </span>
                {c.texto}
              </li>
            ))}
          </ul>
        </div>

        {jaExistente && (
          // Aviso INLINE, e não toast: o toast some, e a informação útil aqui é
          // o link. Quem pediu de novo a mesma simulação quer abrir a que existe,
          // e não descobrir que ela existe e ter de procurá-la no histórico.
          <div className={styles.jaExiste} role="status">
            <strong>Já existe uma simulação idêntica a esta.</strong> Mesmos parâmetros, mesma
            unidade, e o cadastro não mudou desde então — o resultado seria o mesmo.{' '}
            <Link to={`/resultados/${jaExistente}`} onClick={() => setJaExistente(null)}>
              Abrir a simulação que já existe
            </Link>
            . Para rodar mesmo assim, mude algum parâmetro.
          </div>
        )}

        <button
          type="button"
          className={travado ? styles.iniciarTravado : styles.iniciar}
          disabled={travado || criar.isPending || emVoo}
          onClick={iniciar}
        >
          {criar.isPending ? 'Iniciando…' : 'Iniciar simulação'}
        </button>
        <p className={styles.iniciarNota}>
          {travado
            ? 'Resolva as pendências acima para liberar a rodada.'
            : 'A rodada roda no servidor e aparece no histórico ao terminar.'}
        </p>
      </aside>

      {emVoo && (
        <ModalProgresso
          progresso={progresso}
          terminal={terminal}
          falhou={st === 'ERRO' || st === 'FALHOU_QUALIDADE'}
          erro={status.data?.erro ?? undefined}
          onFechar={() => setRunId(undefined)}
          onHistorico={() => navigate('/resultados')}
        />
      )}
    </div>
  )
}

/**
 * `"5 cidades · 28 sistemas · 710 obras"` — o porte da unidade, numa linha.
 *
 * Singular e plural porque "1 cidades" numa tela que o usuário lê o dia inteiro
 * é o tipo de descuido que faz duvidar do resto do número. Milhar com separador
 * pt-BR: `11525` custa a ler, `11.525` não.
 */
function textoDoTamanho({ cidades, sistemas, obras }: TamanhoDaUnidade): string {
  const n = (v: number) => v.toLocaleString('pt-BR')
  const plural = (v: number, um: string, muitos: string) => `${n(v)} ${v === 1 ? um : muitos}`
  return [
    plural(cidades, 'cidade', 'cidades'),
    plural(sistemas, 'sistema', 'sistemas'),
    plural(obras, 'obra', 'obras'),
  ].join(' · ')
}

function Item({ k, v, calc, alerta }: { k: string; v: string; calc?: boolean; alerta?: boolean }) {
  return (
    <div className={styles.item}>
      <dt className={styles.itemK}>{k}</dt>
      <dd className={calc ? styles.itemVCalc : alerta ? styles.itemVAlerta : styles.itemV}>{v}</dd>
    </div>
  )
}

/** Faixa de status do cadastro — verde libera, vermelho bloqueia. */
function FaixaProntidao({
  unidadeId,
  nome,
  pendencias,
  carregando,
}: {
  unidadeId: string
  nome?: string
  pendencias?: number
  carregando: boolean
}) {
  if (!unidadeId) {
    return (
      <div className={styles.faixaNeutra}>
        <strong>Selecione a unidade</strong>
        <span>A simulação usa os dados cadastrados daquela unidade.</span>
      </div>
    )
  }
  if (carregando || pendencias === undefined) {
    return (
      <div className={styles.faixaNeutra}>
        <strong>Conferindo o cadastro…</strong>
      </div>
    )
  }
  const ok = pendencias === 0
  return (
    <div className={ok ? styles.faixaOk : styles.faixaRuim}>
      <strong>{ok ? '✓ Cadastro completo' : '✕ Cadastro incompleto'}</strong>
      <span>
        {ok
          ? `Todos os dados obrigatórios de ${nome} estão preenchidos.`
          : `${pendencias} campos pendentes impedem a rodada.`}
      </span>
      <Link to={`/unidade/${unidadeId}`} className={styles.faixaLink}>
        {ok ? 'Revisar cadastro →' : 'Completar cadastro →'}
      </Link>
    </div>
  )
}

/**
 * Progresso da rodada.
 *
 * A frase que mais importa aqui e "a rodada continua no servidor": sem ela, o
 * usuario fecha a aba achando que cancelou, e depois encontra uma rodada que ele
 * jura nao ter feito.
 */
function ModalProgresso({
  progresso,
  terminal,
  falhou,
  erro,
  onFechar,
  onHistorico,
}: {
  progresso: number
  terminal: boolean
  falhou: boolean
  erro?: string
  onFechar: () => void
  onHistorico: () => void
}) {
  const caixa = useRef<HTMLDivElement>(null)

  // Foco preso enquanto o modal esta aberto — mesmo padrao do ConfirmModal do
  // cadastro. Sem isto, quem navega por teclado continua tabulando pelos
  // controles ATRAS do overlay, editando parametros de uma rodada ja disparada.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    caixa.current?.focus()
    const naTecla = (ev: KeyboardEvent) => {
      if (ev.key !== 'Tab') return
      const focaveis = caixa.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focaveis || focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (ev.shiftKey && document.activeElement === primeiro) {
        ev.preventDefault()
        ultimo.focus()
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', naTecla)
    return () => {
      document.removeEventListener('keydown', naTecla)
      anterior?.focus()
    }
  }, [])

  const titulo = falhou
    ? 'A rodada não terminou'
    : terminal
      ? 'Simulação concluída'
      : 'Simulação em andamento'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="prog-t">
      <div className={styles.modal} ref={caixa} tabIndex={-1}>
        <h2 className={styles.modalTitulo} id="prog-t">
          {titulo}
        </h2>
        <p className={styles.modalEtapa} aria-live="polite">
          {falhou ? (erro ?? 'O servidor não conseguiu concluir esta rodada.') : etapaDe(progresso)}
        </p>
        <div
          className={styles.progresso}
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.progressoFill} style={{ width: `${progresso}%` }} />
        </div>
        {!terminal && (
          <p className={styles.modalNota}>
            A rodada continua no servidor mesmo se você fechar esta tela. Ao terminar, ela aparece
            no histórico de simulações.
          </p>
        )}
        <div className={styles.modalAcoes}>
          {/* O botao "Cancelar rodada" NAO esta aqui, e isso e temporario.
              `POST /runs/{id}/cancelar` responde 501: `controle.run_status` tem um
              CHECK sem `CANCELADA`, e o backend prefere dizer a verdade a fingir
              que cancelou enquanto o cluster segue processando e cobrando.
              Botao que sempre da erro e pior que botao ausente — ensina o usuario
              a desconfiar da tela inteira.

              Quando a migracao entrar, ele volta com a condicao que ja tinha:
              `!terminal`, porque cancelar uma rodada que ja terminou (bem ou mal)
              tambem seria um botao que mente. Ver CONTRATO.md §4.4. */}
          {falhou && (
            <button type="button" className={styles.modalCancelar} onClick={onFechar}>
              Ajustar parâmetros
            </button>
          )}
          <button type="button" className={styles.modalIr} onClick={onHistorico}>
            Ir para o histórico →
          </button>
        </div>
      </div>
    </div>
  )
}
