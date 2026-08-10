import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { FieldRow } from '@/cadastro/components/FieldRow'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { MarcaSalvamento } from '@/cadastro/components/MarcaSalvamento'
import { UltimaAlteracao } from '@/cadastro/components/UltimaAlteracao'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { fieldStyle } from '@/cadastro/lib/fieldState'
import { chipPendencias } from '@/cadastro/lib/chip'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import { useSalvarCidade } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveCidade } from '@/cadastro/state/fichas'
import { COBERTURA_OPCOES, type Cidade } from '@/cadastro/domain/contrato'
import styles from './grupo.module.css'

const TITULO = 'Contrato & Metas'
const SUB =
  'Uma ficha por cidade: fim da concessão, régua de cobertura, metas por ano e paridade esgoto/água.'

export function GrupoContrato() {
  const { unidadeId } = useParams()
  const { openDict, toast } = useApp()
  const {
    fichaDaCidade,
    estaSuja,
    marcarSalva,
    carregando,
    erro,
    erroBruto,
    recarregar,
    recarregando,
    cidades,
    metas,
    fator,
    hier,
    seeded,
    cidadePendOf,
    derivado,
    setCidadeField,
    addMeta,
    setMeta,
    removeMeta,
    addFator,
    setFator,
    removeFator,
  } = useCadastro()
  const erroAoSalvar = useErroAoSalvar(unidadeId)
  const salvarM = useSalvarCidade(unidadeId, {
    onSalva: ({ cidId, ficha }, r) => marcarSalva(chaveCidade(cidId), ficha, r),
  })

  const [selCid, setSelCid] = useState('')
  const [busca, setBusca] = useState('')
  const [soPend, setSoPend] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!seeded || !hier || selCid) return
    // A seleção inicial só pode existir depois que a lista chega da rede, então
    // nasce aqui. Roda UMA vez por unidade (as guardas acima cortam o resto):
    // não é a cascata de renders que a regra persegue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelCid(cidades[0]?.id ?? '')
    // Começa com todas as superintendências abertas (lista de cidades visível).
    setExpanded(new Set(hier.superintendencias.map((s) => s.id)))
  }, [seeded, hier, selCid, cidades])

  if (erro)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <ErroCarga
          // 404 aqui e unidade fora do escopo do usuario, e nao queda de
          // conexao: sem isto a tela dizia "a conexao com a base falhou" e
          // oferecia tentar de novo para sempre.
          erro={erroBruto}
          alvo="o contrato e as metas desta unidade"
          detalhe={erro}
          onRetry={recarregar}
          tentando={recarregando}
        />
      </section>
    )

  // Unidade sem cidade no contrato: nao ha ficha a preencher aqui.
  if (seeded && cidades.length === 0)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Vazio
          titulo="Nenhuma cidade no contrato desta unidade"
          texto="Sem cidade não há régua de cobertura nem metas por ano para cadastrar. Confirme com o time da Base do Otimizador se o contrato desta unidade já foi carregado."
        />
      </section>
    )

  if (carregando || !seeded || !hier || !selCid)
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        <Carregando label="Carregando contrato e metas…" />
      </section>
    )

  const cur = cidades.find((c) => c.id === selCid)!
  const cidSuja = estaSuja(chaveCidade(selCid))
  const pCid = cidadePendOf(selCid)
  const totalPend = derivado.g2
  const g2Chip = chipPendencias(totalPend)
  const cidChip = chipPendencias(pCid)

  const setCidade = (k: keyof Cidade, v: string) => setCidadeField(selCid, k, v)

  // A cidade e suas metas/faixas de paridade sao uma ficha so (api/escrita.ts).
  const salvar = () =>
    salvarM.mutate(
      { cidId: selCid, ficha: fichaDaCidade(selCid)! },
      {
        onSuccess: () =>
          toast(
            pCid === 0
              ? '✓ Cidade salva.'
              : `Salvo como rascunho — ${pCid} pendência${pCid === 1 ? '' : 's'} restante${pCid === 1 ? '' : 's'}.`,
          ),
        onError: erroAoSalvar,
      },
    )

  // metas/fator com indice global (para editar/remover)
  const metasCid = metas.map((m, i) => ({ m, i })).filter((x) => x.m.cid === selCid)
  const fatorCid = fator.map((f, i) => ({ f, i })).filter((x) => x.f.cid === selCid)

  // Menu lateral: arvore Superintendencia -> Cidade (folha), com busca.
  const q = busca.trim().toLowerCase()
  const cidadeSup = (id: string) => hier.cidades.find((hc) => hc.id === id)?.supId
  const cityOk = (c: Cidade) =>
    (!soPend || cidadePendOf(c.id) > 0) &&
    (q === '' || c.nome.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))

  const nodes: TreeNode[] = hier.superintendencias.flatMap((sup) => {
    const cids = cidades
      .filter((c) => cidadeSup(c.id) === sup.id && cityOk(c))
      .map<TreeNode>((c) => {
        const p = cidadePendOf(c.id)
        return {
          id: c.id,
          leaf: true,
          titulo: <span style={{ fontFamily: 'var(--font-sans)' }}>{c.nome}</span>,
          sub: <span className="mono">{c.id}</span>,
          status: { ok: p === 0, label: p === 0 ? '✓' : `${p} pend.` },
        }
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

  const filtrando = q !== '' || soPend
  const allBranch = new Set(hier.superintendencias.map((s) => s.id))
  const effExpanded = filtrando ? allBranch : expanded
  const nPend = cidades.filter((c) => cidadePendOf(c.id) > 0).length

  return (
    <section>
      <GrupoHeader titulo={TITULO} sub={SUB}>
        <span
          className={styles.headChip}
          style={{ background: g2Chip.bg, color: g2Chip.fg, borderColor: g2Chip.bd }}
        >
          {g2Chip.label}
        </span>
        <UltimaAlteracao auditoria={cur} />
        <MarcaSalvamento sujo={cidSuja} />
        <button
          type="button"
          className={`${styles.salvar} ${!cidSuja && !salvarM.isPending ? styles.semMudanca : ''}`}
          onClick={salvar}
          disabled={salvarM.isPending || !cidSuja}
          title={cidSuja ? undefined : 'Nada mudou desde o último salvamento'}
        >
          {salvarM.isPending ? 'Salvando…' : 'Salvar cidade'}
        </button>
      </GrupoHeader>

      <div className={styles.board} style={{ minHeight: 560 }}>
        {/* master: arvore Superintendencia -> Cidade, com busca */}
        <CascadeTree
          nodes={nodes}
          selectedId={selCid}
          expanded={effExpanded}
          onToggle={(id) =>
            setExpanded((e) => {
              const next = new Set(e)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onSelect={setSelCid}
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="⌕ Buscar cidade…"
          buscaLabel="Buscar cidade"
          aria="Cidades por superintendência"
          filtros={{
            pendentes: {
              label: `Pendentes (${nPend})`,
              ativo: soPend,
              onClick: () => setSoPend(true),
            },
            todas: {
              label: `Todas (${cidades.length})`,
              ativo: !soPend,
              onClick: () => setSoPend(false),
            },
          }}
        />

        {/* detail */}
        <div className={styles.detailPane}>
          <div className={`${styles.detailHeader} ${styles.detailHeaderBetween}`}>
            <div className={styles.detailHeader}>
              <span className={styles.titlePlain}>{cur.nome}</span>
              <span className={styles.titleId}>{cur.id}</span>
            </div>
            <span
              className={styles.headChip}
              style={{ background: cidChip.bg, color: cidChip.fg, borderColor: cidChip.bd }}
            >
              {cidChip.label}
            </span>
          </div>

          {/* Contrato */}
          <div className={styles.userCard}>
            <div className={styles.userHeader}>
              <span className={styles.userHeaderLabel}>Contrato — você preenche</span>
            </div>
            <div className={styles.paramsBody}>
              <FieldRow
                rotulo="Fim da concessão"
                tecnico="data_fim_concessao"
                ajuda="Define até quando a receita desta cidade entra no VPL. Depois disso, nada é contado."
                unidade="ano"
                placeholder="AAAA"
                valor={cur.fim}
                onChange={(v) => setCidade('fim', v)}
                onHelp={() => openDict('data_fim_concessao')}
              />
              <FieldRow
                rotulo="Cobertura medida em"
                tecnico="unidade_cobertura"
                ajuda="Régua da META e da faixa de PARIDADE. A receita continua sempre por ligação."
                variant="select"
                options={COBERTURA_OPCOES}
                valor={cur.cob}
                onChange={(v) => setCidade('cob', v)}
                onHelp={() => openDict('unidade_cobertura')}
              />
            </div>
          </div>

          {/* Metas | Paridade */}
          <div className={styles.twoCol}>
            <div className={styles.userCard}>
              <div className={styles.userHeader}>
                <span className={styles.userHeaderLabel}>
                  Metas de cobertura{' '}
                  <button
                    type="button"
                    className={styles.help}
                    aria-label="O que são as metas de cobertura?"
                    onClick={() => openDict('cobertura_pct')}
                  >
                    ?
                  </button>
                </span>
                <button type="button" className={styles.addLink} onClick={() => addMeta(selCid)}>
                  + Meta
                </button>
              </div>
              <div className={styles.cardIntro}>
                Percentual do universo da cidade que deve estar atendido em cada ano, medido na
                régua do contrato. O otimizador prioriza cumprir estas metas; metas fora do
                horizonte de CAPEX são ignoradas.
              </div>
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Cobertura %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {metasCid.map(({ m, i }, linha) => (
                    <tr key={i}>
                      <MiniCell
                        valor={m.ano}
                        width={70}
                        ph="AAAA"
                        rotulo={`Ano da meta ${linha + 1}`}
                        onChange={(v) => setMeta(i, 'ano', v)}
                      />
                      <MiniCell
                        valor={m.pct}
                        width={60}
                        ph="%"
                        rotulo={`Cobertura % da meta ${linha + 1}`}
                        onChange={(v) => setMeta(i, 'pct', v)}
                      />
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.del}
                          aria-label={`Remover a meta de ${m.ano || `linha ${linha + 1}`}`}
                          onClick={() => removeMeta(i)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.userCard}>
              <div className={styles.userHeader}>
                <span className={styles.userHeaderLabel}>
                  Paridade esgoto/água{' '}
                  <button
                    type="button"
                    className={styles.help}
                    aria-label="O que é a paridade esgoto/água?"
                    onClick={() => openDict('paridade')}
                  >
                    ?
                  </button>
                </span>
                <button type="button" className={styles.addLink} onClick={() => addFator(selCid)}>
                  + Faixa
                </button>
              </div>
              <div className={styles.cardIntro}>
                Quanto a tarifa de esgoto representa da tarifa de água em cada faixa de cobertura
                (ex.: a partir de 60% → 0,90). Ao subir de faixa, o reajuste vale também para a base
                existente.
              </div>
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>A partir de %</th>
                    <th>Paridade</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fatorCid.map(({ f, i }, linha) => (
                    <tr key={i}>
                      <MiniCell
                        valor={f.cob}
                        width={60}
                        ph="%"
                        rotulo={`Cobertura inicial da faixa ${linha + 1}`}
                        onChange={(v) => setFator(i, 'cob', v)}
                      />
                      <MiniCell
                        valor={f.par}
                        width={60}
                        ph="0,80"
                        rotulo={`Paridade da faixa ${linha + 1}`}
                        onChange={(v) => setFator(i, 'par', v)}
                      />
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.del}
                          aria-label={`Remover a faixa de paridade ${linha + 1}`}
                          onClick={() => removeFator(i)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.tableNote}>
                Para paridade constante, use uma única faixa a partir de 0%.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MiniCell({
  valor,
  width,
  ph,
  rotulo,
  onChange,
}: {
  valor: string
  width: number
  ph: string
  /** Nome acessivel da celula — o cabecalho da coluna nao chega ao leitor. */
  rotulo: string
  onChange: (v: string) => void
}) {
  const fs = fieldStyle(valor)
  return (
    <td>
      <input
        className={styles.miniInput}
        style={{ width, border: fs.border, background: fs.background }}
        value={valor}
        placeholder={ph}
        aria-label={rotulo}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  )
}
