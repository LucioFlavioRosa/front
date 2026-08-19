import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { RecordSheet } from '@/cadastro/components/RecordSheet'
import { HistoricoDaFicha } from '@/cadastro/components/HistoricoDaFicha'
import { DbCard, DbField, DbFieldGrid } from '@/cadastro/components/DbCard'
import { FieldRow } from '@/cadastro/components/FieldRow'
import { ObrasTable } from '@/cadastro/components/ObrasTable'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { chipPendencias } from '@/cadastro/lib/chip'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import { useSubBacias } from '@/cadastro/api/queries'
import { useSalvarCts } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveCts } from '@/cadastro/state/fichas'
import { mkObrasCts } from '@/cadastro/domain/cts'
import {
  notaDeNovas,
  novasDeObras,
  type Obra,
  type SubBaciaDb,
  type SubBaciaParams,
} from '@/cadastro/domain/subbacia'
import { CAMPOS_DB, camposParametros } from '@/cadastro/domain/baseComercial'
import { NotaDaRegua } from '@/cadastro/components/NotaDaRegua'
import { NotaResidencial } from '@/cadastro/components/NotaResidencial'
import { CamposPopulacao } from '@/cadastro/pages/CamposPopulacao'
import styles from './GrupoSubBacias.module.css'
import ctsStyles from './GrupoCts.module.css'

/**
 * Grupo 05 — CTS (Coletor de Tempo Seco).
 *
 * A CTS e a "irma" da sub-bacia: mesmos dados operacionais, e um no do sistema
 * como ela. A tela e a do grupo 03 reaproveitada, com duas diferencas: a lista de
 * obras e a da CTS (4 componentes, ancorada no Coletor de tempo seco), e o rail se
 * orienta pelo SISTEMA em que a CTS foi colocada.
 *
 * SO APARECEM AS CTS COLOCADAS num sistema desta unidade. Uma CTS ainda nao
 * colocada nao e de unidade nenhuma, nao entra na simulacao e nao tem o que
 * preencher — ela espera no Grupo 01, na lista de CTS disponiveis da base.
 *
 * NAO HA VINCULO COM SUB-BACIA aqui. Ele existiu (`subbacia_cts`, 1:1) e nunca
 * significou pertencimento: e sobreposicao de area, e nao diz onde a CTS esta.
 *
 * O seletor "Usar CTS?" NAO esta aqui de proposito: e parametro da rodada de
 * simulacao, nao dado de cadastro. A tela so explica o efeito da escolha.
 */

/** Ramo do rail que recolhe CTS cujo SISTEMA nao aparece na arvore de sub-bacias
 *  (sistema que so tem CTS e ETE). */
const RAMO_SEM_ARVORE = '__sem-arvore__'

const TITULO = 'CTS · Coletor de Tempo Seco'
const SUB = (
  <>
    Estrutura de coleta irmã da sub-bacia, com os mesmos dados operacionais e{' '}
    <strong>4 obras próprias</strong> — a âncora é o coletor de tempo seco. Aparecem aqui as CTS já{' '}
    <strong>adicionadas a um sistema</strong> desta unidade, no Grupo 01.
  </>
)

export function GrupoCts() {
  const { unidadeId } = useParams()
  const { openDict, askConfirm, toast } = useApp()
  const { data } = useSubBacias(unidadeId)
  const {
    ctss,
    ctsInconsistentes,
    cidadeDaCts: cidadeCts,
    reguaDaCts,
    fichaDaCts,
    estaSuja,
    marcarSalva,
    seeded,
    ctsPendOf,
    derivado,
    setCtsParam,
    setCtsObraField,
    editCtsDbField,
    carregando,
    erro,
    erroBruto,
    recarregar,
    recarregando,
  } = useCadastro()
  const erroAoSalvar = useErroAoSalvar(unidadeId)
  const salvarM = useSalvarCts(unidadeId, {
    onSalva: ({ ctsId, ficha }, r) => marcarSalva(chaveCts(ctsId), ficha, r),
  })

  const [selCts, setSelCts] = useState('')
  const [verHistorico, setVerHistorico] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [soPend, setSoPend] = useState(false)
  const [override, setOverride] = useState(false)

  // Caminho [sup, cid, sis] de cada SISTEMA + ordem linear das CTS.
  //
  // A geografia da CTS e a do sistema em que ela foi colocada. Antes vinha da
  // sub-bacia pareada, o que so coincidia enquanto as duas fossem da mesma
  // cidade — e deixava sem lugar qualquer CTS sem par.
  const { path, ordered, semRamo } = useMemo(() => {
    const path: Record<string, [string, string, string]> = {}
    const ordemSis: string[] = []
    data?.arvore.forEach((sup) =>
      sup.cidades.forEach((c) =>
        c.sistemas.forEach((s) => {
          path[s.id] = [sup.id, c.id, s.id]
          ordemSis.push(s.id)
        }),
      ),
    )
    // A ordem SEGUE A ARVORE, e nao a do payload: e ela que o rail desenha, e e
    // por `ordered` que "proxima pendente" anda. Ordens diferentes fariam o botao
    // pular para uma ficha que esta longe de onde o olho estava.
    const ids = Object.keys(ctss)
    const naArvore = ordemSis.flatMap((sis) => ids.filter((id) => ctss[id]?.sisId === sis))
    // A arvore do rail e montada a partir das SUB-BACIAS, entao um sistema que
    // so tenha CTS e ETE nao aparece nela. Essas CTS entram num ramo proprio em
    // vez de sumirem da tela.
    const vistas = new Set(naArvore)
    const semRamo = ids.filter((id) => !vistas.has(id))
    return { path, ordered: [...naArvore, ...semRamo], semRamo }
  }, [data, ctss])

  // COLOCAR e TIRAR CTS e no GRUPO 01, e nao aqui. Aqui se le e se edita a ficha
  // de uma CTS que ja esta num sistema.
  //
  // Nao e divisao arbitraria: a CTS precisa de duas metades — o no na topologia
  // (onde ela esta) e a ficha em `cts_operacional` (a demanda dela). O motor faz
  // `cts_ids = fichas ∩ nos`, entao mexer numa metade sem a outra produz meia
  // CTS: ficha sem no e invisivel para a simulacao, no sem ficha ENTRA nela com
  // demanda zero. As duas ja aconteceram no cadastro real.

  // Seleciona a primeira CTS quando a lista muda.
  // Espera a arvore: e dela que sai o caminho ate o sistema no rail, e sem ela
  // toda CTS cairia no ramo de excecao — a primeira escolhida seria outra, e a
  // escolha fica.
  // (Com rascunho recuperado o estado ja chega pronto, antes da arvore.)
  useEffect(() => {
    if (!data || !ordered.length) return
    if (selCts && ctss[selCts]) return
    const inicial = ordered[0]
    // A seleção inicial só pode existir depois que a lista chega da rede, então
    // nasce aqui. Roda UMA vez por unidade (as guardas acima cortam o resto):
    // não é a cascata de renders que a regra persegue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelCts(inicial)
    setOverride(false)
    setExpanded(new Set(path[ctss[inicial]?.sisId ?? ''] ?? [RAMO_SEM_ARVORE]))
  }, [data, ordered, selCts, ctss, path])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
          // 404 aqui e unidade fora do escopo do usuario, e nao queda de
          // conexao: sem isto a tela dizia "a conexao com a base falhou" e
          // oferecia tentar de novo para sempre.
          erro={erroBruto}
          alvo="as CTS desta unidade"
          detalhe={erro}
          onRetry={recarregar}
          tentando={recarregando}
        />
      </section>
    )

  if (carregando || !data || !seeded)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Carregando label="Carregando CTS…" />
      </section>
    )

  const g5Chip = chipPendencias(derivado.g5)

  /** Ramos a abrir para revelar uma CTS no rail. */
  const caminhoDaCts = (ctsId: string) => path[ctss[ctsId]?.sisId ?? ''] ?? [RAMO_SEM_ARVORE]

  // O servidor denuncia as CTS que existem pela metade. Isto NAO e erro de
  // carregamento: a leitura funcionou, o cadastro e que esta incompleto. Fica
  // acima de tudo e nos DOIS caminhos de render — inclusive no vazio, que e
  // justamente onde um no sem ficha ficaria invisivel (a unidade nao tem ficha
  // nenhuma para listar, e e por isso que ha um no orfao para denunciar).
  const aviso = ctsInconsistentes.length > 0 && (
    <div className={ctsStyles.incons} role="status">
      <div className={ctsStyles.inconsTitulo}>
        {ctsInconsistentes.length === 1
          ? '1 CTS com cadastro incompleto'
          : `${ctsInconsistentes.length} CTS com cadastro incompleto`}
      </div>
      <ul className={ctsStyles.inconsLista}>
        {ctsInconsistentes.map((x) => (
          <li key={`${x.tipo}:${x.id}`}>
            <span className={ctsStyles.inconsId}>{x.id}</span>
            {x.nome ? ` (${x.nome})` : ''} — {x.detalhe}
          </li>
        ))}
      </ul>
      <p className={ctsStyles.inconsNota}>
        A posição da CTS na rede vem da topologia do sistema, e a demanda vem da ficha. Faltando uma
        das duas, a simulação roda mesmo assim e o resultado sai errado sem avisar. A correção é no
        cadastro estrutural (Grupo 01), não aqui.
      </p>
    </div>
  )

  // Nenhuma CTS COLOCADA nesta unidade: a tela nao tem ficha para mostrar. Nao
  // quer dizer que a base nao tenha CTS — quer dizer que nenhuma foi adicionada
  // a um sistema daqui ainda, e e no Grupo 01 que isso se faz.
  if (!selCts || !ctss[selCts])
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        {aviso}
        <div className={ctsStyles.vazio}>
          <div className={ctsStyles.vazioTitulo}>Nenhuma CTS nesta unidade</div>
          <p className={ctsStyles.vazioTexto}>
            O coletor de tempo seco capta o esgoto que escorre em dias sem chuva e o leva até a ETE.
            Nenhuma CTS da base foi adicionada a um sistema desta unidade ainda — é no{' '}
            <strong>Grupo 01</strong>, logo abaixo do caminho até a ETE, que se escolhe qual CTS
            entra em qual sistema. Depois disso ela aparece aqui para ser preenchida.
          </p>
        </div>
      </section>
    )

  const cur = ctss[selCts]
  const pCts = ctsPendOf(selCts)
  const obras = mkObrasCts(cur.obrasOverride)

  // A régua da meta vem da cidade do SISTEMA em que a CTS foi colocada.
  const cidadeDaCts = cidadeCts(selCts)
  const regua = reguaDaCts(selCts)

  const setParam = (k: keyof SubBaciaParams, v: string) => setCtsParam(selCts, k, v)
  const setDb = (k: keyof SubBaciaDb, v: string) => editCtsDbField(selCts, k, v)
  const setObra = (i: number, k: keyof Obra, v: string) => setCtsObraField(selCts, i, k, v)

  const toggleOverride = () => {
    if (override) return setOverride(false)
    askConfirm({
      titulo: 'Editar dados do Databricks?',
      texto:
        'Você vai corrigir valores que vieram do Databricks. As alterações ficam marcadas como override e registradas no histórico da unidade.',
      onConfirm: () => setOverride(true),
    })
  }

  const salvar = () =>
    salvarM.mutate(
      { ctsId: selCts, ficha: fichaDaCts(selCts)! },
      {
        onSuccess: () =>
          toast(
            pCts === 0
              ? '✓ CTS salva.'
              : `Salvo como rascunho — ${pCts} pendência${pCts === 1 ? '' : 's'} restante${pCts === 1 ? '' : 's'}.`,
          ),
        onError: erroAoSalvar,
      },
    )

  const proximaPendente = () => {
    const start = ordered.indexOf(selCts)
    for (let k = 1; k <= ordered.length; k++) {
      const id = ordered[(start + k) % ordered.length]
      if (ctsPendOf(id) > 0) {
        setSelCts(id)
        setExpanded((e) => new Set([...e, ...caminhoDaCts(id)]))
        setOverride(false)
        return
      }
    }
    toast('Nenhuma pendência restante nas CTS. ✓')
  }

  // ---- arvore Sup -> Cidade -> Sistema -> CTS (so ramos com CTS) ----
  const q = busca.trim().toLowerCase()
  const leafOk = (ctsId: string) => {
    const c = ctss[ctsId]
    if (!c) return false
    return (
      (!soPend || ctsPendOf(ctsId) > 0) &&
      (q === '' ||
        c.id.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        c.sistema.toLowerCase().includes(q))
    )
  }

  const folhaCts = (id: string): TreeNode => {
    const p = ctsPendOf(id)
    return {
      id,
      titulo: ctss[id].nome || id,
      sub: id,
      leaf: true,
      status: { ok: p === 0, label: p === 0 ? '✓' : `${p} pend.` },
    }
  }

  const nodes: TreeNode[] = data.arvore.flatMap((sup) => {
    const cids = sup.cidades.flatMap((cid) => {
      const siss = cid.sistemas.flatMap((sis) => {
        const leaves = ordered
          .filter((id) => ctss[id]?.sisId === sis.id && leafOk(id))
          .map(folhaCts)
        if (!leaves.length) return []
        return [
          {
            id: sis.id,
            titulo: sis.nome,
            sub: `${leaves.length} CTS`,
            children: leaves,
          },
        ]
      })
      if (!siss.length) return []
      return [
        {
          id: cid.id,
          titulo: cid.nome,
          sub: `${siss.length} sistema${siss.length > 1 ? 's' : ''}`,
          children: siss,
        },
      ]
    })
    if (!cids.length) return []
    return [
      {
        id: sup.id,
        titulo: sup.nome,
        sub: `${cids.length} cidade${cids.length > 1 ? 's' : ''}`,
        children: cids,
      },
    ]
  })

  // Ramo de exceção: CTS num sistema que não aparece na árvore de sub-bacias —
  // um sistema que só tem CTS e ETE. Sem ele a CTS ficava invisível e a tela
  // podia até cair no estado "nenhuma CTS" com dados no store.
  const semRamoVisiveis = semRamo.filter(leafOk)
  if (semRamoVisiveis.length)
    nodes.push({
      id: RAMO_SEM_ARVORE,
      titulo: 'Sistemas sem sub-bacia',
      sub: `${semRamoVisiveis.length} CTS`,
      children: semRamoVisiveis.map(folhaCts),
    })

  const filtrando = q !== '' || soPend
  const allBranchIds = new Set<string>([RAMO_SEM_ARVORE])
  data.arvore.forEach((sup) => {
    allBranchIds.add(sup.id)
    sup.cidades.forEach((c) => {
      allBranchIds.add(c.id)
      c.sistemas.forEach((s) => allBranchIds.add(s.id))
    })
  })
  const effectiveExpanded = filtrando ? allBranchIds : expanded

  const nPend = ordered.filter((id) => ctsPendOf(id) > 0).length
  const sheetChip = chipPendencias(pCts)

  return (
    <section>
      <GrupoHeader titulo={TITULO} sub={SUB}>
        <span
          className={styles.headChip}
          style={{ background: g5Chip.bg, color: g5Chip.fg, borderColor: g5Chip.bd }}
        >
          {g5Chip.label}
        </span>
      </GrupoHeader>

      {aviso}

      <div className={styles.board}>
        <CascadeTree
          nodes={nodes}
          selectedId={selCts}
          expanded={effectiveExpanded}
          onToggle={(id) =>
            setExpanded((e) => {
              const next = new Set(e)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onSelect={(id) => {
            setSelCts(id)
            setOverride(false)
          }}
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="⌕ Buscar CTS ou sistema…"
          buscaLabel="Buscar CTS ou sistema"
          aria="CTS por superintendência, cidade e sistema"
          filtros={{
            pendentes: {
              label: `Pendentes (${nPend})`,
              ativo: soPend,
              onClick: () => setSoPend(true),
            },
            todas: {
              label: `Todas (${ordered.length})`,
              ativo: !soPend,
              onClick: () => setSoPend(false),
            },
          }}
        />

        <RecordSheet
          subtitulo={
            <>
              {cur.sistema} · escoa para{' '}
              <span className="mono" style={{ color: 'var(--text-600)' }}>
                {cur.jusante}
              </span>
            </>
          }
          titulo={cur.id}
          nome={cur.nome}
          auditoria={cur}
          onAbrirHistorico={() => setVerHistorico(true)}
          chip={sheetChip}
          onSalvar={salvar}
          salvarLabel="Salvar CTS"
          salvando={salvarM.isPending}
          sujo={estaSuja(chaveCts(selCts))}
        >
          {/* AQUI HAVIA o chip do par com a sub-bacia (`CTS ↔ sub-bacia b2_1_1`).
              Ele saiu com o vinculo: o par era sobreposicao de area, e nao dizia
              onde a CTS esta. Quem diz e o sistema, e ele ja aparece no subtitulo
              da ficha junto do "escoa para" — repetir aqui seria a mesma frase
              duas vezes na mesma tela. Colocar e tirar do sistema e no Grupo 01. */}

          {/* O que a escolha "Usar CTS?" muda — e onde ela e feita. */}
          <div className={ctsStyles.notaRodada}>
            <div className={ctsStyles.notaTitulo}>
              A decisão "Usar CTS?" é da rodada de simulação, não deste cadastro
            </div>
            <p className={ctsStyles.notaTexto}>
              <strong>Sim</strong> = a CTS é orçada à parte, com as obras dela no plano.{' '}
              <strong>Não</strong> = o coletor não é construído, e as sub-bacias do sistema passam a
              ser lidas pelas colunas que já incluem a área sobreposta. A escolha muda o CAPEX, o
              VPL e o plano de obras.
            </p>
          </div>

          {/* Populacao ANTES da base comercial. Ficava depois, e o card do
              Databricks tem 13 campos entre a nota e ele: a nota dizia "logo
              abaixo" e o usuario nao achava — reportou como campo faltando.
              Vem antes tambem porque e o unico bloco daqui que ele PREENCHE;
              o resto e leitura do Databricks. */}
          {regua === 'populacao' && (
            <CamposPopulacao
              params={cur.params}
              cidade={cidadeDaCts?.nome ?? 'Esta cidade'}
              escopo="desta CTS"
              onChange={setParam}
              onHelp={openDict}
            />
          )}

          {/* Base comercial (Databricks) */}
          <DbCard
            titulo="Base comercial da CTS — veio do Databricks 🔒"
            editando={override}
            onToggleEdit={toggleOverride}
            notas={[
              <NotaDaRegua
                key="regua"
                cidade={cidadeDaCts}
                escopo="desta CTS"
                semCidade={
                  <>
                    O sistema {cur.sistema} não está numa cidade conhecida, então não dá para saber
                    a régua da meta desta CTS. Preencha os três trios.
                  </>
                }
                extra={
                  <>
                    Os números são <strong>da CTS</strong>, e não uma fatia de sub-bacia nenhuma: as
                    áreas se sobrepõem, a demanda não.
                  </>
                }
              />,
              <NotaResidencial key="residencial" />,
            ]}
          >
            <DbFieldGrid>
              {CAMPOS_DB.map((campo) => {
                // DERIVADO ganha a conta no lugar do valor do banco: o motor
                // recalcula `universo x potencial - atuais` de qualquer forma, e
                // mostrar aqui o que o Databricks trouxe faria a tela e a
                // simulacao discordarem sobre o mesmo numero — em silencio.
                const derivado = campo.derivado
                  ? novasDeObras(
                      cur.db[campo.derivado.universo],
                      cur.db[campo.derivado.atuais],
                      cur.params.pot,
                    )
                  : null
                return (
                  <DbField
                    key={campo.chave}
                    rotulo={campo.rotulo}
                    valor={derivado ?? cur.db[campo.chave]}
                    unidade={campo.unidade}
                    editando={override}
                    calculado={derivado !== null}
                    hint={derivado === null ? undefined : notaDeNovas(derivado)}
                    ativo={!!campo.regua && campo.regua === regua}
                    onHelp={campo.dict ? () => openDict(campo.dict!) : undefined}
                    onChange={(v) => setDb(campo.chave, v)}
                  />
                )
              })}
            </DbFieldGrid>
          </DbCard>

          {/* Parametros do usuario */}
          <div className={styles.userCard}>
            <div className={styles.userHeader}>
              <span className={styles.userHeaderLabel}>Parâmetros da CTS — você preenche</span>
            </div>
            <div className={styles.paramsBody}>
              {camposParametros('cts').map(([rotulo, k, dictKey, un, ph, ajuda]) => (
                <FieldRow
                  key={k}
                  rotulo={rotulo}
                  tecnico={dictKey}
                  ajuda={ajuda}
                  unidade={un}
                  placeholder={ph}
                  valor={cur.params[k]}
                  onChange={(v) => setParam(k, v)}
                  onHelp={() => openDict(dictKey)}
                />
              ))}
            </div>
          </div>

          {/* Obras da CTS — 4 componentes, ancorados no coletor de tempo seco */}
          <div className={styles.userCard}>
            <div className={styles.userHeader}>
              <span className={styles.userHeaderLabel}>Obras desta CTS — você preenche</span>
              <span className={styles.userHeaderNote}>
                CAPEX = quantidade × preço unitário (calculado)
              </span>
            </div>
            <ObrasTable
              obras={obras}
              onChange={setObra}
              nota={
                <>
                  Obras próprias da CTS — ela não compartilha as obras de nenhuma sub-bacia. WACC
                  vazio = usa o WACC médio da unidade.
                </>
              }
            />
          </div>

          <div className={styles.sheetFoot}>
            <span className={styles.sheetFootNote}>
              Ao salvar, a próxima pendente abre automaticamente
            </span>
            <button type="button" className={styles.prox} onClick={proximaPendente}>
              Próxima pendente →
            </button>
          </div>
        </RecordSheet>
      </div>
      {verHistorico && (
        <HistoricoDaFicha
          unidadeId={unidadeId}
          tipo="cts"
          fichaId={cur.id}
          nome={cur.nome}
          onFechar={() => setVerHistorico(false)}
        />
      )}
    </section>
  )
}
