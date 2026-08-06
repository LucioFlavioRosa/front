import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { RecordSheet } from '@/cadastro/components/RecordSheet'
import { DbCard, DbField, DbFieldGrid } from '@/cadastro/components/DbCard'
import { FieldRow } from '@/cadastro/components/FieldRow'
import { ObrasTable } from '@/cadastro/components/ObrasTable'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { chipPendencias } from '@/cadastro/lib/chip'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import { useSubBacias } from '@/cadastro/api/queries'
import { useCriarCts, useRemoverCts, useSalvarCts } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveCts } from '@/cadastro/state/fichas'
import { mkObrasCts, novaCts } from '@/cadastro/domain/cts'
import type { Obra, SubBaciaDb, SubBaciaParams } from '@/cadastro/domain/subbacia'
import { CAMPOS_DB, camposParametros } from '@/cadastro/domain/baseComercial'
import { NotaDaRegua } from '@/cadastro/components/NotaDaRegua'
import { NotaIndustrial } from '@/cadastro/components/NotaIndustrial'
import { CamposPopulacao } from '@/cadastro/pages/CamposPopulacao'
import styles from './GrupoSubBacias.module.css'
import ctsStyles from './GrupoCts.module.css'

/**
 * Grupo 05 — CTS (Coletor de Tempo Seco).
 *
 * A CTS e a "irma" da sub-bacia: mesmos dados operacionais, pareada 1:1 com uma
 * sub-bacia (areas sobrepostas) e ESPARSA — a maioria das sub-bacias nao tem CTS.
 * A tela e a do grupo 03 reaproveitada, com tres diferencas:
 *  1. a lista de obras e a da CTS (4 componentes, ancorada no Coletor de tempo seco);
 *  2. todo lugar que mostra a CTS mostra tambem a sub-bacia pareada;
 *  3. existe "adicionar CTS a esta sub-bacia" — a CTS e um acrescimo, nao um item
 *     obrigatorio do cadastro.
 *
 * O seletor "Usar CTS?" NAO esta aqui de proposito: e parametro da rodada de
 * simulacao (orcar a CTS a parte x somar a demanda dela a sub-bacia), nao dado de
 * cadastro. A tela so explica o efeito da escolha.
 */

/** Ramo do rail que recolhe CTS cuja sub-bacia pareada nao esta na arvore. */
const RAMO_ORFAS = '__sem-arvore__'

const TITULO = 'CTS · Coletor de Tempo Seco'
const SUB = (
  <>
    Estrutura de coleta irmã da sub-bacia, pareada <strong>1:1</strong> e opcional. Mesmos dados
    operacionais, com <strong>4 obras próprias</strong> — a âncora é o coletor de tempo seco.
  </>
)

export function GrupoCts() {
  const { unidadeId } = useParams()
  const { openDict, askConfirm, toast } = useApp()
  const { data } = useSubBacias(unidadeId)
  const {
    subs,
    ctss,
    pares,
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
    addCts,
    removeCts,
    carregando,
    erro,
    recarregar,
    recarregando,
  } = useCadastro()
  const erroAoSalvar = useErroAoSalvar(unidadeId)
  const salvarM = useSalvarCts(unidadeId, {
    onSalva: ({ ctsId, ficha }) => marcarSalva(chaveCts(ctsId), ficha),
  })

  const [selCts, setSelCts] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [soPend, setSoPend] = useState(false)
  const [override, setOverride] = useState(false)

  // Caminho [sup, cid, sis] de cada sub-bacia + ordem linear das CTS existentes.
  const { path, ordered, orfas } = useMemo(() => {
    const path: Record<string, [string, string, string]> = {}
    const ordemSubs: string[] = []
    data?.arvore.forEach((sup) =>
      sup.cidades.forEach((c) =>
        c.sistemas.forEach((s) =>
          s.subIds.forEach((id) => {
            path[id] = [sup.id, c.id, s.id]
            ordemSubs.push(id)
          }),
        ),
      ),
    )
    // A ordem das CTS segue a ordem das sub-bacias pareadas (mesma geografia).
    const porSub = new Map(pares.map((p) => [p.sub, p.cts]))
    const naArvore = ordemSubs.map((s) => porSub.get(s)).filter((x): x is string => !!x)
    // CTS cuja sub-bacia pareada nao esta na arvore (payloads fora de sincronia)
    // continuam existindo no cadastro: entram no fim da ordem e num ramo proprio
    // do rail, em vez de desaparecerem da tela.
    const vistas = new Set(naArvore)
    const orfas = pares.map((p) => p.cts).filter((c) => !vistas.has(c))
    return { path, ordered: [...naArvore, ...orfas], orfas }
  }, [data, pares])

  // Criacao PESSIMISTA: a CTS so entra no cadastro quando o servidor aceita.
  // Otimista era pior de duas formas — se o POST falhasse com a tela ja
  // desmontada o rollback nao rodava, e se o usuario editasse a CTS nova durante
  // o voo o rollback apagava o que ele tinha digitado.
  // Entra no cadastro a CTS QUE O SERVIDOR DEVOLVEU (nao uma copia local): se
  // ele normalizar campos ou gerar outro id, e a versao dele que vale — inclusive
  // para a selecao, que segue `cts.id` e nao o id que mandamos.
  const criarM = useCriarCts(unidadeId, {
    onSuccess: (cts, { subId }) => {
      addCts(subId, cts)
      setSelCts(cts.id)
      setOverride(false)
      setExpanded((e) => new Set([...e, ...(path[subId] ?? [RAMO_ORFAS])]))
      toast('CTS criada. Preencha a base comercial e as 4 obras dela.')
    },
    onError: erroAoSalvar,
  })

  // Remocao tambem so mexe no store depois do 204 — e pelo callback do hook,
  // para o 204 nao se perder se o usuario ja tiver saido da tela.
  const removerM = useRemoverCts(unidadeId, {
    onSuccess: (_dado, ctsId) => {
      removeCts(ctsId)
      setSelCts('')
      toast('CTS removida.')
    },
    onError: erroAoSalvar,
  })

  // Seleciona a primeira CTS quando a lista muda (inclui a CTS recem-criada).
  // Espera a arvore: a ordem das CTS vem da geografia das sub-bacias, e sem ela
  // toda CTS parece orfa — a primeira escolhida seria outra, e a escolha fica.
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
    setExpanded(new Set(path[ctss[inicial]?.subId ?? ''] ?? [RAMO_ORFAS]))
  }, [data, ordered, selCts, ctss, path])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
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

  // Sub-bacias que ainda nao tem CTS (a relacao e 1:1).
  const pareadas = new Set(pares.map((p) => p.sub))
  const semCts = Object.values(subs).filter((s) => !pareadas.has(s.id))

  /** Ramos a abrir para revelar uma CTS no rail (ou o ramo das orfas). */
  const caminhoDaCts = (ctsId: string) => path[ctss[ctsId]?.subId ?? ''] ?? [RAMO_ORFAS]

  const adicionar = (subId: string) => criarM.mutate({ subId, cts: novaCts(subs[subId]) })

  const cardSemCts =
    semCts.length > 0 ? (
      <div className={ctsStyles.semCts}>
        <div className={ctsStyles.semCtsTitulo}>
          Sub-bacias sem CTS ({semCts.length} de {Object.keys(subs).length})
        </div>
        <div className={ctsStyles.semCtsSub}>
          A CTS é opcional — só crie onde existe coleta de tempo seco a orçar à parte. Cada
          sub-bacia aceita <strong>uma</strong> CTS.
        </div>
        <div className={ctsStyles.semCtsLista}>
          {semCts.map((s) => (
            <button
              key={s.id}
              type="button"
              className={ctsStyles.addBtn}
              onClick={() => adicionar(s.id)}
              disabled={criarM.isPending}
            >
              {criarM.isPending && criarM.variables?.subId === s.id ? (
                'Criando…'
              ) : (
                <>
                  + CTS em <span className={ctsStyles.addBtnId}>{s.id}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    ) : null

  // Nenhuma CTS cadastrada: a tela vira o convite a criar a primeira.
  if (!selCts || !ctss[selCts])
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <div className={ctsStyles.vazio}>
          <div className={ctsStyles.vazioTitulo}>Nenhuma CTS cadastrada nesta unidade</div>
          <p className={ctsStyles.vazioTexto}>
            O coletor de tempo seco capta o esgoto que escorre em dias sem chuva e o leva até a ETE.
            Vale cadastrar uma CTS quando a área já tem coleta de tempo seco e o negócio precisa
            comparar, em reais, construir essa estrutura dedicada contra atender a mesma área pela
            rede da sub-bacia.
          </p>
        </div>
        {cardSemCts}
      </section>
    )

  const cur = ctss[selCts]
  const subPar = subs[cur.subId]
  const pCts = ctsPendOf(selCts)
  const obras = mkObrasCts(cur.obrasOverride)

  // A régua da meta vem da cidade da sub-bacia pareada (a CTS não aparece
  // sozinha na árvore). CTS órfã fica sem cidade: os três trios continuam na
  // tela, sem destaque em nenhum.
  const cidadeDaCts = cidadeCts(selCts)
  const regua = reguaDaCts(selCts)
  const porPopulacao = regua === 'populacao'

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

  const remover = () =>
    askConfirm({
      titulo: 'Remover esta CTS?',
      texto: `A CTS ${cur.id} e as 4 obras dela saem do cadastro. A sub-bacia ${cur.subId} continua intacta — a área dela passa a ser atendida só pela rede da própria sub-bacia.`,
      onConfirm: () => removerM.mutate(selCts),
    })

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
  const ctsDoSub = new Map(pares.map((p) => [p.sub, p.cts]))
  const leafOk = (ctsId: string) => {
    const c = ctss[ctsId]
    if (!c) return false
    return (
      (!soPend || ctsPendOf(ctsId) > 0) &&
      (q === '' ||
        c.id.toLowerCase().includes(q) ||
        c.subId.toLowerCase().includes(q) ||
        c.sistema.toLowerCase().includes(q))
    )
  }

  const folhaCts = (id: string): TreeNode => {
    const p = ctsPendOf(id)
    return {
      id,
      titulo: id,
      sub: `↔ ${ctss[id].subId}`,
      leaf: true,
      status: { ok: p === 0, label: p === 0 ? '✓' : `${p} pend.` },
    }
  }

  const nodes: TreeNode[] = data.arvore.flatMap((sup) => {
    const cids = sup.cidades.flatMap((cid) => {
      const siss = cid.sistemas.flatMap((sis) => {
        const leaves = sis.subIds
          .map((subId) => ctsDoSub.get(subId))
          .filter((id): id is string => !!id && leafOk(id))
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

  // Ramo de exceção: CTS existentes cuja sub-bacia pareada não está na árvore.
  // Sem ele a CTS ficava invisível e a tela podia até cair no estado "nenhuma
  // CTS cadastrada" com dados no store.
  const orfasVisiveis = orfas.filter(leafOk)
  if (orfasVisiveis.length)
    nodes.push({
      id: RAMO_ORFAS,
      titulo: 'Fora da árvore de sub-bacias',
      sub: `${orfasVisiveis.length} CTS · confira o de-para no Databricks`,
      children: orfasVisiveis.map(folhaCts),
    })

  const filtrando = q !== '' || soPend
  const allBranchIds = new Set<string>([RAMO_ORFAS])
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
          buscaPlaceholder="⌕ Buscar CTS, sub-bacia ou sistema…"
          buscaLabel="Buscar CTS, sub-bacia ou sistema"
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
          chip={sheetChip}
          onSalvar={salvar}
          salvarLabel="Salvar CTS"
          salvando={salvarM.isPending}
          sujo={estaSuja(chaveCts(selCts))}
          impedimento={removerM.isPending ? 'Esta CTS está sendo removida.' : undefined}
        >
          {/* Vinculo com a sub-bacia pareada — a area das duas se sobrepoe. */}
          <div className={styles.sheetFoot}>
            <span className={ctsStyles.parChip}>
              {`CTS ↔ sub-bacia ${cur.subId}${subPar ? ` · ${subPar.nome}` : ''}`}
            </span>
            {/* Nunca DELETE com um PUT da mesma CTS em voo: a ordem de chegada
                no servidor decidiria se a ficha volta a existir. */}
            <button
              type="button"
              className={ctsStyles.remover}
              onClick={remover}
              disabled={removerM.isPending || salvarM.isPending}
              title={salvarM.isPending ? 'Aguarde o salvamento terminar.' : undefined}
            >
              {removerM.isPending ? 'Removendo…' : 'Remover CTS'}
            </button>
          </div>

          {/* O que a escolha "Usar CTS?" muda — e onde ela e feita. */}
          <div className={ctsStyles.notaRodada}>
            <div className={ctsStyles.notaTitulo}>
              A decisão "Usar CTS?" é da rodada de simulação, não deste cadastro
            </div>
            <p className={ctsStyles.notaTexto}>
              <strong>Sim</strong> = a CTS é orçada à parte, com as obras dela no plano.{' '}
              <strong>Não</strong> = a área da CTS é atendida pela rede da sub-bacia {cur.subId} e a
              demanda daqui é somada à dela. A demanda atendida é a mesma nos dois modos — muda o
              CAPEX, o VPL e o plano de obras.
            </p>
          </div>

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
                    A sub-bacia pareada {cur.subId} não está na árvore, então não dá para saber a
                    régua da meta desta CTS. Preencha os três trios e confira o de-para no
                    Databricks.
                  </>
                }
                extra={
                  <>
                    Os números são <strong>da CTS</strong>, não uma fatia da sub-bacia {cur.subId}:
                    as áreas se sobrepõem, a demanda não.
                  </>
                }
              />,
              <NotaIndustrial key="industrial" />,
            ]}
          >
            <DbFieldGrid>
              {CAMPOS_DB.map((campo) => (
                <DbField
                  key={campo.chave}
                  rotulo={campo.rotulo}
                  valor={cur.db[campo.chave]}
                  unidade={campo.unidade}
                  editando={override}
                  ativo={!!campo.regua && campo.regua === regua}
                  onHelp={campo.dict ? () => openDict(campo.dict!) : undefined}
                  onChange={(v) => setDb(campo.chave, v)}
                />
              ))}
            </DbFieldGrid>
          </DbCard>

          {/* Populacao — logo depois da base, como na sub-bacia */}
          {porPopulacao && (
            <CamposPopulacao
              params={cur.params}
              cidade={cidadeDaCts?.nome ?? 'Esta cidade'}
              escopo="desta CTS"
              onChange={setParam}
              onHelp={openDict}
            />
          )}

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
                  Obras próprias da CTS — ela não compartilha as obras da sub-bacia {cur.subId}.
                  WACC vazio = usa o WACC médio da unidade.
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

      {cardSemCts}
    </section>
  )
}
