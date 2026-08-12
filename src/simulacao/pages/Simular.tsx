import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRegionais, useUnidades } from '@/comum/api/organizacao'
import { useCancelarRodada, useCriarRodada, useProntidao } from '@/simulacao/api/queries'
import { useStatusRodada, type FilaDaRodada } from '@/comum/api/rodada'
import { decorrido, demorandoDemais } from '@/comum/domain/espera'
import { useApp } from '@/comum/state/AppContext'
import {
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
} from '@/simulacao/domain/simulacao'
import type { UnidadeResumo } from '@/comum/domain/organizacao'
import { Ajuda, Campo, Interruptor, Opcao, Rotulo, Secao } from '@/simulacao/components/campos'
import styles from './Simular.module.css'

const AJUDA_PENALIDADE: Record<Penalidade, string> = {
  'meta+cobertura': 'Penaliza o descumprimento da meta e também a cobertura abaixo do possível.',
  meta: 'Penaliza apenas o descumprimento da meta do ano.',
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
  const cancelar = useCancelarRodada()
  const status = useStatusRodada(runId)

  const set = <K extends keyof EstadoSimulacao>(k: K, v: EstadoSimulacao[K]) =>
    setE((s) => ({ ...s, [k]: v }))

  /** A unidade escolhida, com o `resumo` que a lista do select já trouxe. */
  const unidadeEscolhida = (unidades.data ?? []).find((u) => u.id === e.unidadeId)

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

  /**
   * Desiste da rodada em voo.
   *
   * Nao fecha o modal por conta propria: quem o fecha e o `emVoo` abaixo, quando
   * o status recarregado voltar `CANCELADA`. Fechar aqui, no otimismo, mostraria
   * a tela liberada enquanto o cluster ainda estaria processando se o cancelamento
   * tivesse falhado — e a rodada apareceria concluida minutos depois.
   */
  function cancelarRodada() {
    if (!runId) return
    cancelar.mutate(runId, {
      onSuccess: () => toast('Rodada cancelada.'),
      onError: () => toast('Não foi possível cancelar a rodada. Ela continua no servidor.'),
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

          {/* A REDISTRIBUIÇÃO NÃO É OFERECIDA hoje, por decisão do produto — a
              verba de cada ano é a que está no cronograma acima, e o otimizador
              não a move entre anos.
              O `TETO_EXECUCAO_ANUAL` saiu junto porque só existia dentro dela: era
              o teto que cada ano recebia DEPOIS do achatamento. Sem redistribuir,
              o teto de cada ano já é a própria verba dele.
              Nada disso existe no motor — são pré-processamento que
              `app/dominio/parametros.py` faz (célula 3 do notebook), e o backend
              continua sabendo fazê-lo. Voltar é reintroduzir este interruptor. */}

          {/* "Anos extra para concluir" saiu da tela e vale ZERO: a obra inicia e
              conclui dentro da janela de CAPEX, sem rabo custeado pela sobra.
              O parâmetro CONTINUA existindo no backend e no motor — quem o fixa em
              0 é `app/dominio/parametros.py`, e ele viaja no `params` da rodada
              para o histórico registrar o que foi usado.
              ATENÇÃO ao mexer: o default do motor é 3, não 0. Deixar de mandar a
              chave NÃO dá zero — dá três. */}

          {/* A DATA DE INÍCIO mora aqui, e não mais em "ETE e solver": ela é do
              mesmo assunto que o cronograma — quando o dinheiro começa a poder ser
              gasto. O primeiro ano-calendário fica parcial a partir dela. */}
          <div>
            <Campo
              rotulo="Data de início"
              tecnico="DATA_INICIO"
              valor={e.dataInicio}
              onChange={(v) => set('dataInicio', v)}
              placeholder="2026-06"
              largura={120}
              inputMode="text"
            />
            <Ajuda>Vazia = janeiro do ano-base do cadastro. Formato AAAA-MM.</Ajuda>
          </div>
        </Secao>

        {/* ---------------- 03 OBJETIVO ---------------- */}
        <Secao
          numero="03"
          titulo="Objetivo — VPL x cobertura"
          descricao="O que o otimizador deve maximizar quando os dois entram em conflito."
        >
          <div>
            <Rotulo texto="Foco em cobertura" tecnico="FOCO_COBERTURA" />
            {/* TRÊS ESCOLHAS, e não um número livre entre 0 e 1.
                O campo digitável saiu com a barra e a régua: quem decide entre VPL
                e cobertura escolhe uma POSTURA, não calibra um peso. O valor
                intermediário existia e ninguém sabia o que 0,37 significava — a
                própria tela precisava de um rótulo ("puxando para VPL") para
                traduzi-lo de volta.
                O payload continua levando o número (0 · 0,5 · 1): o que saiu foi a
                digitação, não o parâmetro. */}
            <div className={styles.atalhos} role="group" aria-label="Foco em cobertura">
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
            </select>
            <Ajuda>{AJUDA_PENALIDADE[e.penalidade]}</Ajuda>
          </div>

          {/* NÃO HÁ ESCOLHA DE FONTE DAS METAS, e a ausência é a regra.
              As metas vêm sempre da base. O único descarte legítimo é por ANO: meta
              fora da janela de CAPEX não é cobrada — com CAPEX até 2031, a meta de
              2030 conta e a de 2032 não. Isso o motor já faz sozinho
              (`otimizador_capex_v62.py`, na avaliação: `idx >= anos_capex → continue`),
              e não é decisão de quem dispara a rodada.
              Houve aqui um seletor "Ignorar as metas nesta rodada". Ele nunca
              funcionou — o backend colapsava as duas opções no mesmo valor, e o
              motor carregava as metas de qualquer jeito. Quando o colapso foi
              corrigido, a opção passou a produzir rodada sem meta nenhuma, que a
              regra não admite. Saiu inteira, em vez de virar um controle que só
              tem uma escolha certa. */}
          <div>
            <Rotulo texto="Metas de cobertura" tecnico="METAS_COBERTURA" />
            <p className={styles.metasNota}>
              Sempre as do cadastro. Metas em anos fora da janela de CAPEX não são cobradas nesta
              rodada.
            </p>
          </div>

          {/* PRIORIDADE POR CIDADE saiu, e a ausência É o padrão pedido: todas as
              cidades pesam 1. O motor multiplica a contribuição de cada cidade por
              `peso_cidade.get(cidade, 1.0)` — sem o parâmetro, o multiplicador é 1
              para todas, que é exatamente "peso igual".
              Não há valor a afirmar aqui, ao contrário do `ANOS_EXTRA_CONCLUSAO`:
              lá o default do motor era 3 e precisávamos de 0; aqui o default já é
              o que se quer. Mandar `{}` daria no mesmo e sugeriria uma escolha. */}
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
          titulo="ETE"
          descricao="Como cada estação entra no plano — decidido pela ficha dela, não por esta tela."
        >
          {/* NÃO HÁ INTERRUPTOR DE ETE, e a ausência é a regra do negócio.
              Qual tratamento a ETE recebe não é escolha da rodada: é o que a ficha
              dela diz. ETE com terreno e número de módulos informados é NOVA, e
              entra como pacote único — sem faseamento. ETE que já existe é
              expandida em módulos, conforme a vazão passa da capacidade ociosa. O
              motor decide isso por ETE (`otimizador_capex_v62.py`, detecção por
              `nova=Sim` ou `capex_terreno > 0`), e não por rodada.
              Havia aqui dois interruptores. `ETE_FASEADA` oferecia desligar o
              tratamento por módulos — e o modo desligado trata a expansão PIOR,
              porque o CP-SAT força o pré-dimensionamento pelo total do sistema.
              `ETE_FIXO` era controle morto: com faseada ligada, o motor sai do
              fluxo antes de olhar para ele. */}
          <p className={styles.metasNota}>
            <strong>ETE.</strong> Cada ETE é tratada conforme a ficha dela: a nova (terreno e
            módulos informados) entra como pacote único; a que já existe é expandida em módulos,
            conforme a vazão conectada passa da capacidade ociosa.
          </p>
          {/* TEMPO DE SOLVER e WORKERS saíram: são afinação de execução, não
              decisão de negócio, e quem dispara a rodada não tem como calibrá-los.
              `MAX_TIME_S` é fixado em 1000s por `app/dominio/parametros.py` e viaja
              no `params` — o histórico registra o que a rodada usou. `WORKERS` não
              viaja: o executor usa o próprio padrão. */}
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
                Serrana" de "rodar a Leste" — 710 obras contra 11.525.
                Sai do `resumo` da unidade, que a lista do select JÁ trouxe: não
                custa request nenhum, e é o mesmo número que a seleção do cadastro
                mostra. Antes vinha de um `tamanho` em `/prontidao` que o backend
                nunca implementou, então a linha simplesmente não aparecia. */}
            {unidadeEscolhida?.resumo && (
              <>
                <Item k="Tamanho" v={textoDoTamanho(unidadeEscolhida.resumo)} calc />
                {/* As obras em linha própria, e com as três categorias: é o número
                    que prediz o custo da rodada, e o único aqui em que "quanto"
                    depende de quem paga.
                    A presença de `obrasAegea` é conferida porque um servidor
                    anterior a esta mudança manda `resumo` SEM as três — e aí
                    `toLocaleString(undefined)` derrubaria a página pelo error
                    boundary. Foi assim que o `tamanho` sumiu da tela um dia; a
                    diferença é que ali a falha era silenciosa. */}
                {unidadeEscolhida.resumo.obrasAegea !== undefined && (
                  <Item k="Obras" v={textoDasObras(unidadeEscolhida.resumo)} calc />
                )}
              </>
            )}
            <Item k="Orçamento total" v={`R$ ${orc.total.toLocaleString('pt-BR')} Mi`} calc />
            <Item k="Janela de CAPEX" v={orc.janelaTexto} calc />
            <Item
              k="Foco em cobertura"
              v={`${focoV.toFixed(2).replace('.', ',')} · ${rotuloFoco(focoV)}`}
            />
            <Item k="Penalidade" v={e.penalidade} />
            <Item k="Metas" v="do cadastro" />
            <Item k="Prioridade de cidade" v="todas com peso 1" />
            <Item k="Base de receita" v={e.baseReceita} />
            <Item k="Curva de adesão" v={e.curvaAdocao === 'scurve' ? 'curva S' : 'linear'} />
            <Item k="Usar CTS" v={e.usarCts ? 'sim' : 'não'} />
            <Item k="Incluir industrial" v={e.incluirIndustrial ? 'sim' : 'não'} />
            <Item k="ETE" v="nova em pacote · existente por módulos" />
            <Item k="Solver" v="1000 s" />
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
          fila={status.data?.fila}
          pedidaEm={status.data?.pedidaEm}
          naFila={st === 'PENDENTE'}
          cancelando={cancelar.isPending}
          onCancelar={cancelarRodada}
          onFechar={() => setRunId(undefined)}
          onHistorico={() => navigate('/resultados')}
        />
      )}
    </div>
  )
}

/**
 * `"5 cidades · 28 sistemas · 92 sub-bacias · 3 CTS · 4 ETEs · 710 obras"` — o
 * porte da unidade, numa linha.
 *
 * A ordem é a da árvore: cidade contém sistema, que contém sub-bacia, que tem CTS
 * pareada; ETEs ao lado; e `obras` fecha porque é o número que resume o custo da
 * rodada — o total, sub-bacia mais CTS.
 *
 * CTS aparece mesmo quando é zero. Ela é esparsa, e "0 CTS" responde uma pergunta
 * que a ausência da palavra deixaria no ar: se a unidade não tem, ligar `USAR_CTS`
 * nos parâmetros não muda nada, e é melhor descobrir isso aqui.
 *
 * Singular e plural porque "1 cidades" numa tela que o usuário lê o dia inteiro
 * é o tipo de descuido que faz duvidar do resto dos números. Milhar com separador
 * pt-BR: `11525` custa a ler, `11.525` não. CTS não flexiona.
 */
const nPtBr = (v: number) => v.toLocaleString('pt-BR')
const plural = (v: number, um: string, muitos: string) => `${nPtBr(v)} ${v === 1 ? um : muitos}`

function textoDoTamanho({ cidades, sistemas, subBacias, cts, etes }: UnidadeResumo): string {
  return [
    plural(cidades, 'cidade', 'cidades'),
    plural(sistemas, 'sistema', 'sistemas'),
    plural(subBacias, 'sub-bacia', 'sub-bacias'),
    `${nPtBr(cts)} CTS`,
    plural(etes, 'ETE', 'ETEs'),
  ].join(' · ')
}

/**
 * `"2.615 Aegea · 184 de terceiros · 1.560 sem obra"` — o que há de CAPEX.
 *
 * TRÊS categorias e não um total, porque um número só escondia os dois extremos.
 * "11.525 obras" na Leste contava 4.830 linhas que não são obra nenhuma, e não
 * distinguia o que a Aegea paga do que ocupa prazo por conta de terceiros.
 *
 * As três são exaustivas e não se sobrepõem: somadas, dão o total de componentes
 * das fichas. As duas primeiras são o que o motor considera candidato.
 */
function textoDasObras({ obrasAegea, obrasTerceiros, semObra }: UnidadeResumo): string {
  return [
    `${nPtBr(obrasAegea)} Aegea`,
    `${nPtBr(obrasTerceiros)} de terceiros`,
    `${nPtBr(semObra)} sem obra`,
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
  fila,
  pedidaEm,
  naFila,
  cancelando,
  onCancelar,
  onFechar,
  onHistorico,
}: {
  progresso: number
  terminal: boolean
  falhou: boolean
  erro?: string
  /** Ausente quando a rodada já terminou, e quando o servidor é anterior a isto. */
  fila?: FilaDaRodada
  pedidaEm?: string | null
  /** PENDENTE: nada está executando ainda, e a etapa não pode dizer que sim. */
  naFila: boolean
  cancelando: boolean
  onCancelar: () => void
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

  const espera = decorrido(pedidaEm)
  // Duas origens para o mesmo destaque, e elas cobrem coisas diferentes.
  // `atencao` é o que o backend SABE (nenhum executor de pé, lease vencido);
  // `demorandoDemais` é o que só o relógio sabe — "deve começar em instantes" há
  // vinte minutos é um motivo tranquilo que parou de ser verdade, e é justamente
  // o caso que ninguém reporta porque a frase continua parecendo normal.
  const alerta = !!fila?.atencao || demorandoDemais(pedidaEm)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="prog-t">
      <div className={styles.modal} ref={caixa} tabIndex={-1}>
        <h2 className={styles.modalTitulo} id="prog-t">
          {titulo}
        </h2>
        <p className={styles.modalEtapa} aria-live="polite">
          {falhou
            ? (erro ?? 'O servidor não conseguiu concluir esta rodada.')
            : etapaDe(progresso, naFila)}
        </p>
        {/* POR QUE ela está esperando, e há quanto tempo.
            A etapa acima diz o que o job FARIA; ela não distingue "vai começar em
            instantes" de "não há executor nenhum de pé". Quem olha precisa dos
            dois, e o segundo é o que o dono do produto marcou como inegociável em
            produção. `fila` é opcional: servidor antigo simplesmente não mostra. */}
        {!falhou && fila && (
          <p className={alerta ? styles.filaAtencao : styles.fila} role="status">
            {fila.motivo}
            {espera && <span className={styles.decorrido}> · pedida {espera}</span>}
          </p>
        )}
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
          {/* Cancelar aparece sob `!terminal`, e so ai: cancelar uma rodada que ja
              terminou — bem ou mal — seria um botao que mente, e o backend
              responde 409. Ele esteve ausente da tela enquanto
              `POST /runs/{id}/cancelar` respondia 501, porque botao que sempre da
              erro ensina o usuario a desconfiar da tela inteira; a migracao 008
              pos `CANCELADA` no CHECK de `controle.run_status` e o endpoint passou
              a cancelar de verdade. Ver CONTRATO.md §4.4. */}
          {!terminal && (
            <button
              type="button"
              className={styles.modalCancelar}
              onClick={onCancelar}
              disabled={cancelando}
            >
              {cancelando ? 'Cancelando…' : 'Cancelar rodada'}
            </button>
          )}
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
