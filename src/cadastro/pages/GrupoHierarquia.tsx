import { useEffect, useId, useState } from 'react'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import type { SistemaH, UnidReg } from '@/cadastro/domain/hierarquia'
import styles from './grupo.module.css'

const CONFIRM = {
  titulo: 'Editar dados do Databricks?',
  texto:
    'Você vai corrigir valores que vieram do Databricks. As alterações ficam marcadas como override e registradas no histórico da unidade.',
}

const TITULO = 'Hierarquia & Topologia'
const SUB = (
  <>
    Estrutura importada do Databricks, navegada por sistema. Confira principalmente a coluna{' '}
    <strong>escoa para</strong> — é ela que libera a receita.
  </>
)

export function GrupoHierarquia() {
  const { askConfirm, openDict } = useApp()
  const {
    hier,
    seeded,
    carregando,
    erro,
    recarregar,
    recarregando,
    setHierUnidReg,
    setHierSupNome,
    setHierCidNome,
    setHierSisNome,
    setHierTopoJusante,
  } = useCadastro()

  const [selSis, setSelSis] = useState('')
  const [busca, setBusca] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editUr, setEditUr] = useState(false)
  const [editHier, setEditHier] = useState(false)
  const [editTopo, setEditTopo] = useState(false)

  useEffect(() => {
    if (!seeded || !hier || selSis) return
    const inicial = hier.sistemas.some((s) => s.id === 's2') ? 's2' : hier.sistemas[0]?.id
    // A seleção inicial só pode existir depois que a lista chega da rede, então
    // nasce aqui. Roda UMA vez por unidade (as guardas acima cortam o resto):
    // não é a cascata de renders que a regra persegue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelSis(inicial ?? '')
    setExpanded(new Set(['sup2', 'c6']))
  }, [seeded, hier, selSis])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
          alvo="a hierarquia desta unidade"
          detalhe={erro}
          onRetry={recarregar}
          tentando={recarregando}
        />
      </section>
    )

  // Unidade sem sistema nenhum: sem isto a tela ficava no skeleton para sempre,
  // esperando uma seleção inicial que nunca ia existir.
  if (seeded && hier && hier.sistemas.length === 0)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Vazio
          titulo="Nenhum sistema nesta unidade"
          texto="A estrutura do Databricks não trouxe sistemas para esta unidade — sem eles não há topologia a conferir aqui. Confirme com o time da Base do Otimizador se a carga da unidade já foi feita."
        />
      </section>
    )

  if (carregando || !seeded || !hier || !selSis)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Carregando label="Carregando hierarquia e topologia…" />
      </section>
    )

  const { unidReg, superintendencias: sups, cidades, sistemas, topo } = hier

  const askEdit = (enter: boolean, set: (v: boolean) => void) => {
    if (!enter) return set(false)
    askConfirm({ ...CONFIRM, onConfirm: () => set(true) })
  }

  const sis = sistemas.find((s) => s.id === selSis)!
  const cid = cidades.find((c) => c.id === sis.cidId)
  const sup = cid ? sups.find((s) => s.id === cid.supId) : undefined

  // Edicoes de dado Databricks: as actions ja gravam override (valor original
  // vem do snapshot no reducer). As paginas so disparam a intencao.
  const setUr = (k: keyof UnidReg, v: string) => setHierUnidReg(k, v)
  const setSup = (v: string) => sup && setHierSupNome(sup.id, v)
  const setCid = (v: string) => cid && setHierCidNome(cid.id, v)
  const setSis = (v: string) => setHierSisNome(selSis, v)
  const setJus = (idx: number, v: string) => setHierTopoJusante(idx, v)

  // Arvore Sup -> Cidade -> Sistema (folha).
  const q = busca.trim().toLowerCase()
  const sisOk = (s: SistemaH) => {
    if (q === '') return true
    const c = cidades.find((x) => x.id === s.cidId)
    return (
      s.id.includes(q) || s.nome.toLowerCase().includes(q) || !!c?.nome.toLowerCase().includes(q)
    )
  }
  const nodes: TreeNode[] = sups.flatMap((sp) => {
    const cids = cidades
      .filter((c) => c.supId === sp.id)
      .flatMap((c) => {
        const sis = sistemas.filter((s) => s.cidId === c.id && sisOk(s))
        if (!sis.length) return []
        return [
          {
            id: c.id,
            titulo: c.nome,
            sub: `${sis.length} sistema${sis.length > 1 ? 's' : ''}`,
            children: sis.map<TreeNode>((s) => ({
              id: s.id,
              leaf: true,
              dotColor: '#0891b2',
              titulo: (
                <>
                  {s.id}{' '}
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      color: 'var(--text-600)',
                    }}
                  >
                    {s.nome}
                  </span>
                </>
              ),
            })),
          },
        ]
      })
    if (!cids.length) return []
    return [
      {
        id: sp.id,
        titulo: sp.nome,
        sub: `${cids.length} cidade${cids.length > 1 ? 's' : ''}`,
        children: cids,
      },
    ]
  })
  const allBranch = new Set<string>()
  sups.forEach((s) => allBranch.add(s.id))
  cidades.forEach((c) => allBranch.add(c.id))
  const effExpanded = q !== '' ? allBranch : expanded

  const topoSis = topo.map((t, i) => ({ t, i })).filter((x) => x.t.sis === selSis)

  return (
    <section>
      <GrupoHeader titulo={TITULO} sub={SUB}>
        <span
          className={styles.headChip}
          style={{
            background: 'var(--db-bg)',
            color: 'var(--db-text-2)',
            borderColor: 'var(--db-border)',
          }}
        >
          🔒 Databricks · editável com confirmação
        </span>
      </GrupoHeader>

      {/* Esta tela nao tem Salvar: o contrato de escrita ainda nao cobre a
          hierarquia (ver DEPLOY.md). Dizer isso e melhor do que deixar o
          usuario supor que a correcao foi para o cadastro. O rascunho guarda
          estas correcoes junto com o resto (fichas.ts, hierAlterada), entao a
          promessa de "sobrevive a um F5" vale tambem aqui. */}
      <p className={styles.avisoSemSalvar}>
        As correções desta tela ainda <strong>não são gravadas no cadastro</strong> — o backend não
        expõe escrita da hierarquia. Elas ficam guardadas nesta aba do navegador (sobrevivem a
        recarregar a página) e servem para conferência, mas ninguém mais as vê.
      </p>

      {/* unidade-regional */}
      <div className={styles.dbGridCard} style={{ marginBottom: 16 }}>
        <div className={styles.dbGridHeader}>
          <span className={styles.dbGridTitle}>unidade-regional</span>
          <button
            type="button"
            className={`${styles.dbToggle} ${editUr ? styles.dbToggleOn : ''}`}
            onClick={() => askEdit(!editUr, setEditUr)}
          >
            {editUr ? '✓ Concluir edição' : 'Editar dados do Databricks'}
          </button>
        </div>
        <div className={`${styles.dbGridBody} ${styles.dbGridBody5}`}>
          <HierField
            label="Regional (id)"
            valor={unidReg.rid}
            editando={editUr}
            onChange={(v) => setUr('rid', v)}
          />
          <HierField
            label="Nome da regional"
            valor={unidReg.rnome}
            editando={editUr}
            onChange={(v) => setUr('rnome', v)}
          />
          <HierField
            label="Unidade (id)"
            valor={unidReg.uid}
            editando={editUr}
            onChange={(v) => setUr('uid', v)}
          />
          <HierField
            label="Nome da unidade"
            valor={unidReg.unome}
            editando={editUr}
            onChange={(v) => setUr('unome', v)}
          />
          <div>
            <div className={styles.dbFieldLabel} style={{ color: 'var(--text-500)' }}>
              WACC médio da unidade 🔒
            </div>
            <div className={styles.dbCalcBox}>{unidReg.waccMedio}</div>
            <div className={styles.dbHint}>preenchido por Operações Financeiras</div>
          </div>
        </div>
      </div>

      <div className={styles.board} style={{ minHeight: 520 }}>
        <CascadeTree
          nodes={nodes}
          selectedId={selSis}
          expanded={effExpanded}
          onToggle={(id) =>
            setExpanded((e) => {
              const next = new Set(e)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onSelect={setSelSis}
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="⌕ Buscar sistema ou cidade…"
          buscaLabel="Buscar sistema ou cidade"
          aria="Sistemas por superintendência e cidade"
        />

        <div className={styles.detailPane}>
          <div className={styles.detailHeader}>
            <span className={styles.titleMono}>{sis.id}</span>
            <span className={styles.titleNome}>{sis.nome}</span>
          </div>

          {/* Cadeia hierarquica */}
          <div className={styles.dbGridCard}>
            <div className={styles.dbGridHeader}>
              <span className={styles.dbGridTitle} style={{ fontFamily: 'var(--font-sans)' }}>
                Cadeia hierárquica — Databricks 🔒
              </span>
              <button
                type="button"
                className={`${styles.dbToggle} ${editHier ? styles.dbToggleOn : ''}`}
                onClick={() => askEdit(!editHier, setEditHier)}
              >
                {editHier ? '✓ Concluir' : 'Editar'}
              </button>
            </div>
            <div className={`${styles.dbGridBody} ${styles.dbGridBodyAuto}`}>
              <HierField label="Regional" valor={unidReg.rnome} readOnly />
              <HierField label="Unidade" valor={unidReg.unome} readOnly />
              <HierField
                label="Superintendência"
                tecnico={sup?.id}
                valor={sup?.nome ?? ''}
                editando={editHier}
                onChange={setSup}
              />
              <HierField
                label="Cidade"
                tecnico={cid?.id}
                valor={cid?.nome ?? ''}
                editando={editHier}
                onChange={setCid}
              />
              <HierField
                label="Sistema"
                tecnico={sis.id}
                valor={sis.nome}
                editando={editHier}
                onChange={setSis}
              />
            </div>
          </div>

          {/* Topologia */}
          <div className={styles.dbGridCard}>
            <div className={styles.dbGridHeader}>
              <span className={styles.dbGridTitle}>
                sistema-topologia · caminho até a ETE — a tabela mais crítica da base
              </span>
              <button
                type="button"
                className={`${styles.dbToggle} ${editTopo ? styles.dbToggleOn : ''}`}
                onClick={() => askEdit(!editTopo, setEditTopo)}
              >
                {editTopo ? '✓ Concluir' : 'Editar'}
              </button>
            </div>
            {topoSis.length > 0 ? (
              <div className={styles.tabelaWrap}>
                <table className={styles.topoTable}>
                  <thead>
                    <tr>
                      <th scope="col">Componente</th>
                      <th scope="col">Nome</th>
                      <th scope="col">
                        Escoa para{' '}
                        <button
                          type="button"
                          className={styles.help}
                          aria-label="O que é o campo “escoa para”?"
                          onClick={() => openDict('componente_sistema_id_jusante')}
                        >
                          ?
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topoSis.map(({ t, i }) => (
                      <tr key={t.id}>
                        <td className={styles.topoId}>{t.id}</td>
                        <td style={{ color: 'var(--text-600)' }}>{t.nome}</td>
                        <td>
                          {editTopo ? (
                            <input
                              className={styles.topoInput}
                              style={{
                                border: '1.5px solid var(--pend-border)',
                                background: 'var(--pend-bg)',
                              }}
                              value={t.jus}
                              aria-label={`Escoa para — ${t.nome} (${t.id})`}
                              onChange={(e) => setJus(i, e.target.value)}
                            />
                          ) : t.jus ? (
                            <span
                              className={styles.topoJus}
                              style={{ color: 'var(--db-text)', background: 'var(--db-bg)' }}
                            >
                              {t.jus}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-400)' }}>— (ETE final)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '14px 18px', fontSize: 12.5, color: 'var(--text-400)' }}>
                Sem amostra de topologia para este sistema neste protótipo — na versão final os
                dados vêm do Databricks.
              </div>
            )}
            <div className={styles.tableFoot}>
              O esgoto percorre o campo "escoa para" de componente em componente até chegar à ETE.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HierField({
  label,
  tecnico,
  valor,
  editando,
  readOnly,
  onChange,
}: {
  label: string
  tecnico?: string
  valor: string
  editando?: boolean
  readOnly?: boolean
  onChange?: (v: string) => void
}) {
  const id = useId()
  const editavel = !readOnly && editando
  const rotulo = (
    <>
      {label}{' '}
      {tecnico && (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-400)' }}>{tecnico}</span>
      )}
    </>
  )

  return (
    <div>
      {editavel ? (
        <label className={styles.dbFieldLabel} htmlFor={id}>
          {rotulo}
        </label>
      ) : (
        <div className={styles.dbFieldLabel}>{rotulo}</div>
      )}
      {editavel ? (
        <input
          id={id}
          className={styles.dbInput}
          style={{ border: '1.5px solid var(--pend-border)', background: 'var(--pend-bg)' }}
          value={valor}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <div className={styles.dbReadBox}>{valor}</div>
      )}
    </div>
  )
}
