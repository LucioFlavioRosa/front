import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { FieldRow } from '@/cadastro/components/FieldRow'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { MarcaSalvamento } from '@/cadastro/components/MarcaSalvamento'
import { UltimaAlteracao } from '@/cadastro/components/UltimaAlteracao'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { chipPendencias } from '@/cadastro/lib/chip'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import { DICT } from '@/cadastro/domain/dict'
import { useSalvarEte } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveEte } from '@/cadastro/state/fichas'
import { camposVisiveis, capacidadeOciosa, isNova, type Ete } from '@/cadastro/domain/ete'
import styles from './grupo.module.css'

const TITULO = 'ETEs'
const SUB =
  'Capacidade, módulos e custos de cada estação de tratamento. A capacidade ociosa é calculada.'

export function GrupoEtes() {
  const { unidadeId } = useParams()
  const { openDict, toast } = useApp()
  const {
    etes,
    hier,
    fichaDaEte,
    estaSuja,
    marcarSalva,
    seeded,
    etePendOf,
    derivado,
    setEteField,
    carregando,
    erro,
    erroBruto,
    recarregar,
    recarregando,
  } = useCadastro()
  const erroAoSalvar = useErroAoSalvar(unidadeId)
  const salvarM = useSalvarEte(unidadeId, {
    onSalva: ({ eteId, ficha }, r) => marcarSalva(chaveEte(eteId), ficha, r),
  })

  const [selEte, setSelEte] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [soPend, setSoPend] = useState(false)

  useEffect(() => {
    if (!seeded || selEte) return
    const inicial = etes.some((e) => e.id === 'e2') ? 'e2' : etes[0]?.id
    // A seleção inicial só pode existir depois que a lista chega da rede, então
    // nasce aqui. Roda UMA vez por unidade (as guardas acima cortam o resto):
    // não é a cascata de renders que a regra persegue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelEte(inicial ?? '')
    setExpanded(new Set(['sup2', 'c6']))
  }, [seeded, selEte, etes])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
          // 404 aqui e unidade fora do escopo do usuario, e nao queda de
          // conexao: sem isto a tela dizia "a conexao com a base falhou" e
          // oferecia tentar de novo para sempre.
          erro={erroBruto}
          alvo="as ETEs desta unidade"
          detalhe={erro}
          onRetry={recarregar}
          tentando={recarregando}
        />
      </section>
    )

  // Unidade sem ETE: possivel de verdade (sistema que manda tudo para fora).
  if (seeded && etes.length === 0)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Vazio
          titulo="Nenhuma ETE nesta unidade"
          texto="Não há estação de tratamento cadastrada para esta unidade. Se houver ETE em operação, avise o time da Base do Otimizador: sem ela a simulação não dimensiona módulos nem rateia o custo de tratamento."
        />
      </section>
    )

  if (carregando || !seeded || !hier || !selEte)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Carregando label="Carregando ETEs…" />
      </section>
    )

  const cur = etes.find((e) => e.id === selEte)!
  const eteSuja = estaSuja(chaveEte(selEte))
  const pEte = etePendOf(selEte)
  const totalPend = derivado.g4
  const g4Chip = chipPendencias(totalPend)

  const setCampo = (k: keyof Ete, v: string) => setEteField(selEte, k, v)

  const salvar = () =>
    salvarM.mutate(
      { eteId: selEte, ficha: fichaDaEte(selEte)! },
      {
        onSuccess: () =>
          toast(
            pEte === 0
              ? '✓ ETE salva.'
              : `Salvo como rascunho — ${pEte} pendência${pEte === 1 ? '' : 's'} restante${pEte === 1 ? '' : 's'}.`,
          ),
        onError: erroAoSalvar,
      },
    )

  // Arvore Sup -> Cidade -> ETE (so ramos com ETE), filtrada por busca/pendentes.
  const q = busca.trim().toLowerCase()
  const eteOk = (e: Ete, cidNome: string) =>
    (!soPend || etePendOf(e.id) > 0) &&
    (q === '' ||
      e.id.toLowerCase().includes(q) ||
      e.sub.toLowerCase().includes(q) ||
      cidNome.toLowerCase().includes(q))

  const nodes: TreeNode[] = hier.superintendencias.flatMap((sup) => {
    const cids = hier.cidades
      .filter((c) => c.supId === sup.id)
      .flatMap((c) => {
        const cidEtes = etes.filter((e) => e.cidId === c.id && eteOk(e, c.nome))
        if (!cidEtes.length) return []
        return [
          {
            id: c.id,
            titulo: c.nome,
            sub: `${cidEtes.length} ETE${cidEtes.length > 1 ? 's' : ''}`,
            children: cidEtes.map<TreeNode>((e) => {
              const p = etePendOf(e.id)
              return {
                id: e.id,
                titulo: e.id,
                sub: e.sub,
                leaf: true,
                status: { ok: p === 0, label: p === 0 ? '✓' : `${p} pend.` },
              }
            }),
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

  // Ao buscar/filtrar, expande tudo para os resultados aparecerem.
  const filtrando = q !== '' || soPend
  const allBranch = new Set<string>()
  hier.superintendencias.forEach((s) => allBranch.add(s.id))
  hier.cidades.forEach((c) => allBranch.add(c.id))
  const effExpanded = filtrando ? allBranch : expanded

  const nPend = etes.filter((e) => etePendOf(e.id) > 0).length
  const nova = isNova(cur)

  return (
    <section>
      <GrupoHeader titulo={TITULO} sub={SUB}>
        <span
          className={styles.headChip}
          style={{ background: g4Chip.bg, color: g4Chip.fg, borderColor: g4Chip.bd }}
        >
          {g4Chip.label}
        </span>
        <UltimaAlteracao auditoria={cur} />
        <MarcaSalvamento sujo={eteSuja} />
        <button
          type="button"
          className={`${styles.salvar} ${!eteSuja && !salvarM.isPending ? styles.semMudanca : ''}`}
          onClick={salvar}
          disabled={salvarM.isPending || !eteSuja}
          title={eteSuja ? undefined : 'Nada mudou desde o último salvamento'}
        >
          {salvarM.isPending ? 'Salvando…' : 'Salvar ETE'}
        </button>
      </GrupoHeader>

      <div className={styles.board} style={{ minHeight: 600 }}>
        <CascadeTree
          nodes={nodes}
          selectedId={selEte}
          expanded={effExpanded}
          onToggle={(id) =>
            setExpanded((e) => {
              const next = new Set(e)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onSelect={setSelEte}
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="⌕ Buscar ETE, sistema ou cidade…"
          buscaLabel="Buscar ETE, sistema ou cidade"
          aria="ETEs por superintendência e cidade"
          filtros={{
            pendentes: {
              label: `Pendentes (${nPend})`,
              ativo: soPend,
              onClick: () => setSoPend(true),
            },
            todas: {
              label: `Todas (${etes.length})`,
              ativo: !soPend,
              onClick: () => setSoPend(false),
            },
          }}
        />

        <div className={styles.detailPane}>
          <div className={styles.detailHeader}>
            <span className={styles.titleMono}>{cur.id}</span>
            <span
              className={styles.novaBadge}
              style={
                nova
                  ? { color: '#7c3aed', background: '#f5f3ff', borderColor: '#ddd6fe' }
                  : {
                      color: 'var(--db-text-2)',
                      background: 'var(--db-bg)',
                      borderColor: 'var(--db-border)',
                    }
              }
            >
              {nova ? 'ETE nova (greenfield)' : 'ETE existente — expansão'}
            </span>
            <span className={styles.titleSub}>{cur.sub}</span>
          </div>

          <div className={styles.userCard}>
            <div className={styles.paramsBody}>
              {camposVisiveis(cur).map(([rotulo, k, dictKey, un, ph, ajuda]) => (
                <FieldRow
                  key={k}
                  rotulo={rotulo}
                  tecnico={dictKey}
                  ajuda={ajuda}
                  unidade={un}
                  placeholder={ph}
                  valor={cur[k]}
                  onChange={(v) => setCampo(k, v)}
                  onHelp={() => (DICT[dictKey] ? openDict(dictKey) : toast(ajuda))}
                />
              ))}
              <FieldRow
                rotulo="Capacidade ociosa"
                tecnico="capacidade_ociosa · ƒ calculado"
                ajuda="Folga = capacidade nominal − vazão de operação. Absorve vazão nova sem exigir módulo novo."
                variant="calc"
                valor={capacidadeOciosa(cur)}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
