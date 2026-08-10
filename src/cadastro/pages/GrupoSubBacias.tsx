import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { RecordSheet } from '@/cadastro/components/RecordSheet'
import { HistoricoDaFicha } from '@/cadastro/components/HistoricoDaFicha'
import { DbCard, DbField, DbFieldGrid } from '@/cadastro/components/DbCard'
import { FieldRow } from '@/cadastro/components/FieldRow'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { ObrasTable } from '@/cadastro/components/ObrasTable'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { chipPendencias } from '@/cadastro/lib/chip'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import { useSubBacias } from '@/cadastro/api/queries'
import { useSalvarSubBacia } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveSub } from '@/cadastro/state/fichas'
import {
  mkObras,
  type Obra,
  type SubBaciaParams,
  type SubBaciaDb,
} from '@/cadastro/domain/subbacia'
import { CAMPOS_DB, camposParametros } from '@/cadastro/domain/baseComercial'
import { NotaDaRegua } from '@/cadastro/components/NotaDaRegua'
import { NotaIndustrial } from '@/cadastro/components/NotaIndustrial'
import { CamposPopulacao } from '@/cadastro/pages/CamposPopulacao'
import styles from './GrupoSubBacias.module.css'

const TITULO = 'Sub-bacias & Obras'
const SUB =
  'Uma ficha por sub-bacia: base comercial do Databricks, parâmetros que você preenche e as obras dela.'

export function GrupoSubBacias() {
  const { unidadeId } = useParams()
  const { openDict, askConfirm, toast } = useApp()
  const { data } = useSubBacias(unidadeId)
  const {
    subs,
    cidadeDaSub: cidadeSub,
    reguaDaSub,
    fichaDaSub,
    estaSuja,
    marcarSalva,
    seeded,
    subPendOf,
    derivado,
    setSubParam,
    setObraField,
    editDbField,
    carregando,
    erro,
    erroBruto,
    recarregar,
    recarregando,
  } = useCadastro()
  const erroAoSalvar = useErroAoSalvar(unidadeId)
  const salvarM = useSalvarSubBacia(unidadeId, {
    onSalva: ({ subId, ficha }, r) => marcarSalva(chaveSub(subId), ficha, r),
  })

  const [selSub, setSelSub] = useState('')
  const [verHistorico, setVerHistorico] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [soPend, setSoPend] = useState(false)
  const [override, setOverride] = useState(false)

  // Mapa sub -> caminho [sup, cid, sis] + ordem linear (para "proxima pendente").
  const { path, ordered } = useMemo(() => {
    const path: Record<string, [string, string, string]> = {}
    const ordered: string[] = []
    data?.arvore.forEach((sup) =>
      sup.cidades.forEach((c) =>
        c.sistemas.forEach((s) =>
          s.subIds.forEach((id) => {
            path[id] = [sup.id, c.id, s.id]
            ordered.push(id)
          }),
        ),
      ),
    )
    return { path, ordered }
  }, [data])

  // Seleciona a primeira sub-bacia (b2_1_4) uma vez, abrindo seu caminho.
  useEffect(() => {
    if (!data || selSub) return
    const inicial = 'b2_1_4' in data.subs ? 'b2_1_4' : Object.keys(data.subs)[0]
    // A seleção inicial só pode existir depois que a lista chega da rede, então
    // nasce aqui. Roda UMA vez por unidade (as guardas acima cortam o resto):
    // não é a cascata de renders que a regra persegue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelSub(inicial)
    setExpanded(new Set(path[inicial] ?? []))
  }, [data, selSub, path])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
          // 404 aqui e unidade fora do escopo do usuario, e nao queda de
          // conexao: sem isto a tela dizia "a conexao com a base falhou" e
          // oferecia tentar de novo para sempre.
          erro={erroBruto}
          alvo="as sub-bacias desta unidade"
          detalhe={erro}
          onRetry={recarregar}
          tentando={recarregando}
        />
      </section>
    )

  // Unidade sem sub-bacia nenhuma: nao ha o que carregar nem o que selecionar.
  if (seeded && data && Object.keys(subs).length === 0)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Vazio
          titulo="Nenhuma sub-bacia nesta unidade"
          texto="A base do Databricks não trouxe sub-bacias para esta unidade. Sem elas não há obras a orçar aqui — confirme com o time da Base do Otimizador se a carga da unidade já foi feita."
        />
      </section>
    )

  if (carregando || !data || !seeded || !selSub || !subs[selSub])
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Carregando label="Carregando sub-bacias e obras…" />
      </section>
    )

  const cur = subs[selSub]
  const pSub = subPendOf(selSub)
  const totalPend = derivado.g3

  // A régua da meta é da CIDADE (Grupo 02) e chega aqui pela árvore
  // (sup › cidade › sistema › sub-bacia). Sub-bacia fora da árvore fica sem
  // cidade: os três trios continuam na tela, sem destaque em nenhum.
  const cidadeDaSub = cidadeSub(selSub)
  const regua = reguaDaSub(selSub)

  // ---- edicoes: apenas disparam actions de dominio (override e recalculo
  //      ficam no reducer do CadastroContext). Salvar so mostra toast. ----
  const setParam = (k: keyof SubBaciaParams, v: string) => setSubParam(selSub, k, v)
  const setDb = (k: keyof SubBaciaDb, v: string) => editDbField(selSub, k, v)
  const setObra = (i: number, k: keyof Obra, v: string) => setObraField(selSub, i, k, v)

  const toggleOverride = () => {
    if (override) return setOverride(false)
    askConfirm({
      titulo: 'Editar dados do Databricks?',
      texto:
        'Você vai corrigir valores que vieram do Databricks. As alterações ficam marcadas como override e registradas no histórico da unidade.',
      onConfirm: () => setOverride(true),
    })
  }

  // Salvar manda a ficha INTEIRA (params + base + obras + trilha de override),
  // como define api/escrita.ts. O estado local nao muda: ele ja e a verdade da
  // edicao; o que muda e a confirmacao de que o servidor gravou.
  const salvar = () =>
    salvarM.mutate(
      { subId: selSub, ficha: fichaDaSub(selSub)! },
      {
        onSuccess: () =>
          toast(
            pSub === 0
              ? '✓ Sub-bacia salva.'
              : `Salvo como rascunho — ${pSub} pendência${pSub === 1 ? '' : 's'} restante${pSub === 1 ? '' : 's'}.`,
          ),
        onError: erroAoSalvar,
      },
    )

  const proximaPendente = () => {
    const start = ordered.indexOf(selSub)
    for (let k = 1; k <= ordered.length; k++) {
      const id = ordered[(start + k) % ordered.length]
      if (subPendOf(id) > 0) {
        setSelSub(id)
        setExpanded((e) => new Set([...e, ...(path[id] ?? [])]))
        setOverride(false)
        return
      }
    }
    toast('Nenhuma pendência restante nas sub-bacias. ✓')
  }

  // ---- arvore (filtrada por busca/pendentes) ----
  const q = busca.trim().toLowerCase()
  const filtrando = q !== '' || soPend
  const leafOk = (id: string) => {
    const s = subs[id]
    return (
      (!soPend || subPendOf(id) > 0) &&
      (q === '' || s.id.toLowerCase().includes(q) || s.sistema.toLowerCase().includes(q))
    )
  }

  const nodes: TreeNode[] = data.arvore.flatMap((sup) => {
    const cids = sup.cidades.flatMap((cid) => {
      const siss = cid.sistemas.flatMap((sis) => {
        const leaves = sis.subIds
          .filter((id) => leafOk(id))
          .map<TreeNode>((id) => {
            const p = subPendOf(id)
            return {
              id,
              titulo: id,
              leaf: true,
              status: { ok: p === 0, label: p === 0 ? '✓' : `${p} pend.` },
            }
          })
        if (!leaves.length) return []
        return [
          { id: sis.id, titulo: sis.nome, sub: `${leaves.length} sub-bacias`, children: leaves },
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

  const allBranchIds = new Set<string>()
  data.arvore.forEach((sup) => {
    allBranchIds.add(sup.id)
    sup.cidades.forEach((c) => {
      allBranchIds.add(c.id)
      c.sistemas.forEach((s) => allBranchIds.add(s.id))
    })
  })
  const effectiveExpanded = filtrando ? allBranchIds : expanded

  const nPend = ordered.filter((id) => subPendOf(id) > 0).length
  const g3Chip = chipPendencias(totalPend)
  const sheetChip = chipPendencias(pSub)
  const obras = mkObras(cur.obrasOverride)

  return (
    <section>
      <GrupoHeader titulo={TITULO} sub={SUB}>
        <span
          className={styles.headChip}
          style={{ background: g3Chip.bg, color: g3Chip.fg, borderColor: g3Chip.bd }}
        >
          {g3Chip.label}
        </span>
      </GrupoHeader>

      <div className={styles.board}>
        <CascadeTree
          nodes={nodes}
          selectedId={selSub}
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
            setSelSub(id)
            setOverride(false)
          }}
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="⌕ Buscar por código ou sistema…"
          buscaLabel="Buscar sub-bacia por código ou sistema"
          aria="Sub-bacias por superintendência, cidade e sistema"
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
          salvarLabel="Salvar sub-bacia"
          salvando={salvarM.isPending}
          sujo={estaSuja(chaveSub(selSub))}
        >
          {/* Populacao ANTES da base comercial. Ficava depois, e o card do
              Databricks tem 13 campos entre a nota e ele: a nota dizia "logo
              abaixo" e o usuario nao achava — reportou como campo faltando.
              Vem antes tambem porque e o unico bloco daqui que ele PREENCHE;
              o resto e leitura do Databricks. */}
          {regua === 'populacao' && (
            <CamposPopulacao
              params={cur.params}
              cidade={cidadeDaSub?.nome ?? 'Esta cidade'}
              escopo="desta sub-bacia"
              onChange={setParam}
              onHelp={openDict}
            />
          )}

          {/* Base comercial (Databricks) */}
          <DbCard
            titulo="Base comercial — veio do Databricks 🔒"
            editando={override}
            onToggleEdit={toggleOverride}
            notas={[
              <NotaDaRegua
                key="regua"
                cidade={cidadeDaSub}
                escopo="desta sub-bacia"
                semCidade={
                  <>
                    Esta sub-bacia não aparece na árvore de superintendência › cidade › sistema,
                    então não dá para saber a régua da meta dela. Preencha os três trios e confira o
                    de-para no Databricks.
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

          {/* Parametros do usuario */}
          <div className={styles.userCard}>
            <div className={styles.userHeader}>
              <span className={styles.userHeaderLabel}>Parâmetros da unidade — você preenche</span>
            </div>
            <div className={styles.paramsBody}>
              {camposParametros('sub-bacia').map(([rotulo, k, dictKey, un, ph, ajuda]) => (
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

          {/* Obras */}
          <div className={styles.userCard}>
            <div className={styles.userHeader}>
              <span className={styles.userHeaderLabel}>Obras desta sub-bacia — você preenche</span>
              <span className={styles.userHeaderNote}>
                CAPEX = quantidade × preço unitário (calculado)
              </span>
            </div>
            <ObrasTable
              obras={obras}
              onChange={setObra}
              nota={
                <>
                  WACC vazio = usa o WACC médio da unidade (preenchido por Operações Financeiras).
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
          tipo="sub-bacia"
          fichaId={cur.id}
          nome={cur.nome}
          onFechar={() => setVerHistorico(false)}
        />
      )}
    </section>
  )
}
