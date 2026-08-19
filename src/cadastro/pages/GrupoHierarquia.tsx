import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CascadeTree, type TreeNode } from '@/cadastro/components/CascadeTree'
import { Carregando, ErroCarga, Vazio } from '@/comum/components/Estado'
import { GrupoHeader } from '@/cadastro/pages/GrupoHeader'
import { MarcaSalvamento } from '@/cadastro/components/MarcaSalvamento'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import {
  mensagemDeErroTopologia,
  useSalvarSistema,
  useSalvarTopologia,
} from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveSistema, chaveTopo } from '@/cadastro/state/fichas'
import type { SistemaH, TopoRow, UnidReg } from '@/cadastro/domain/hierarquia'
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
  const { unidadeId } = useParams()
  const { askConfirm, openDict } = useApp()
  const {
    hier,
    seeded,
    carregando,
    erro,
    erroBruto,
    recarregar,
    recarregando,
    sujas,
    marcarSalva,
    setHierUnidReg,
    setHierSupNome,
    setHierCidNome,
    setHierSisNome,
    setHierTopoJusante,
    setHierTopoSistema,
    setHierSistemaUsaCts,
  } = useCadastro()

  const aoFalhar = useErroAoSalvar(unidadeId, mensagemDeErroTopologia)
  // Uma gravacao por componente, e nao um lote: o `PUT` e por componente, e a
  // recusa do servidor tambem — se uma ligacao fecha ciclo, so ela volta, e as
  // outras ja entraram.
  const salvarM = useSalvarTopologia(unidadeId, {
    onSalva: ({ compId, ficha }) => marcarSalva(chaveTopo(compId), ficha),
  })
  const salvarSisM = useSalvarSistema(unidadeId, {
    onSalva: ({ sisId, ficha }) => marcarSalva(chaveSistema(sisId), ficha),
  })

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
          // 404 aqui e unidade fora do escopo do usuario, e nao queda de
          // conexao: sem isto a tela dizia "a conexao com a base falhou" e
          // oferecia tentar de novo para sempre.
          erro={erroBruto}
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

  // ---------------------------------------------------------------- gravacao
  const topoSujo = sujas.filter((c) => c.startsWith('topo:')).map((c) => c.slice(5))
  const sisSujo = sujas.filter((c) => c.startsWith('sis:')).map((c) => c.slice(4))
  const nSujo = topoSujo.length + sisSujo.length
  const salvando = salvarM.isPending || salvarSisM.isPending

  /**
   * Grava componente a componente, e SOLTAR ANTES DE LIGAR.
   *
   * A ordem importa porque o servidor valida contra o que ESTA gravado, e nao
   * contra o que a tela tem: inverter um trecho (`A → B` virar `B → A`) manda
   * duas mudancas, e se a ligacao nova for primeiro o servidor ainda ve a antiga
   * e recusa, com razao, por ciclo. Soltando primeiro, as duas passam.
   *
   * O MESMO vale entre desmarcar "usa sistema de CTS" e adicionar a segunda CTS:
   * por isso os sistemas DESMARCADOS vao primeiro, a topologia no meio, e os
   * MARCADOS no fim — marcar so pode valer depois que as excedentes sairam.
   *
   * Sequencial, e nao em paralelo: as recusas dependem umas das outras, e disparar
   * tudo de uma vez tornaria o resultado dependente de quem chegasse primeiro.
   */
  const salvar = async () => {
    const fichasTopo = topoSujo
      .map((id) => hier.topo.find((t) => t.id === id))
      .filter((t): t is TopoRow => !!t)
      .map((t) => ({ compId: t.id, ficha: { sisId: t.sis, jusante: t.jus } }))
    const solta = (f: (typeof fichasTopo)[number]) => !f.ficha.sisId || !f.ficha.jusante
    const fichasSis = sisSujo
      .map((id) => sistemas.find((s) => s.id === id))
      .filter((s): s is SistemaH => !!s)
      .map((s) => ({ sisId: s.id, ficha: { usaCts: s.usaCts === 'true' } }))

    const passos: (() => Promise<unknown>)[] = [
      ...fichasSis.filter((f) => !f.ficha.usaCts).map((f) => () => salvarSisM.mutateAsync(f)),
      ...fichasTopo.filter(solta).map((f) => () => salvarM.mutateAsync(f)),
      ...fichasTopo.filter((x) => !solta(x)).map((f) => () => salvarM.mutateAsync(f)),
      ...fichasSis.filter((f) => f.ficha.usaCts).map((f) => () => salvarSisM.mutateAsync(f)),
    ]
    for (const passo of passos) {
      try {
        await passo()
      } catch (e) {
        // Para na primeira recusa: as seguintes provavelmente dependem desta, e
        // uma pilha de toasts contraditorios seria pior que um motivo claro.
        aoFalhar(e)
        return
      }
    }
  }

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

  const topoSis = topo.filter((t) => t.sis === selSis)
  const ctsDoSistema = topoSis.filter((t) => t.tipo === 'cts')
  // As CTS que ainda nao estao em sistema nenhum — o que o seletor abaixo do
  // caminho ate a ETE oferece. NAO e recortado por unidade, e nao poderia ser:
  // sem sistema nao ha cidade, nem superintendencia, nem unidade.
  const ctsDisponiveis = topo.filter((t) => !t.sis && t.tipo === 'cts')

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
        <MarcaSalvamento sujo={nSujo > 0} />
        <button
          type="button"
          className={`${styles.salvar} ${!nSujo && !salvando ? styles.semMudanca : ''}`}
          onClick={salvar}
          disabled={salvando || !nSujo}
          title={
            nSujo
              ? `${nSujo} alteração(ões) de topologia não salva(s)`
              : 'Nada mudou desde o último salvamento'
          }
        >
          {salvando ? 'Salvando…' : `Salvar topologia${nSujo ? ` (${nSujo})` : ''}`}
        </button>
      </GrupoHeader>

      {/* O aviso ficou SO com os nomes. A topologia saiu dele porque agora tem
          para onde ir (`PUT /topologia/:compId`), e manter os dois juntos faria
          a tela dizer, sobre a mesma edicao, que ela grava (botao Salvar) e que
          nao grava (este paragrafo). Os nomes continuam sem rota de escrita. */}
      <p className={styles.avisoSemSalvar}>
        O <strong>caminho até a ETE</strong> e o sistema de cada componente são gravados no cadastro
        pelo botão <strong>Salvar topologia</strong>. Já as correções de <strong>nome</strong>{' '}
        (regional, unidade, superintendência, cidade, sistema) ainda não têm onde ser gravadas —
        ficam nesta aba do navegador, sobrevivem a recarregar a página e servem para conferência,
        mas ninguém mais as vê.
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
            {/* A caixa fica FORA do grid travado acima: aquele bloco é dado do
                Databricks, e este campo é da Regional. Juntá-los faria a tela
                dizer que ele também vem de fora — e ele é justamente o único do
                sistema que alguém daqui preenche. */}
            <UsaSistemaCts
              marcado={sis.usaCts === 'true'}
              quantasCts={ctsDoSistema.length}
              onChange={(v) => setHierSistemaUsaCts(sis.id, v)}
            />
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
                      <th scope="col" style={{ textAlign: 'right' }}>
                        {editTopo ? 'Ações' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topoSis.map((t) => (
                      <tr key={t.id}>
                        <td className={styles.topoId}>{t.id}</td>
                        <td style={{ color: 'var(--text-600)' }}>{t.nome}</td>
                        <td>
                          {editTopo ? (
                            // SELETOR, e nao campo livre: o jusante e um id de
                            // componente DO MESMO sistema, e digitar um id de
                            // outro sistema (ou com um typo) so descobriria o
                            // erro no Salvar. Aqui o conjunto de opcoes ja e a
                            // regra.
                            <select
                              className={styles.topoInput}
                              style={{
                                border: '1.5px solid var(--pend-border)',
                                background: 'var(--pend-bg)',
                              }}
                              value={t.jus}
                              aria-label={`Escoa para — ${t.nome} (${t.id})`}
                              onChange={(e) => setHierTopoJusante(t.id, e.target.value)}
                            >
                              <option value="">— não escoa (fim do caminho)</option>
                              {topoSis
                                .filter((o) => o.id !== t.id)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.id} · {o.nome}
                                  </option>
                                ))}
                            </select>
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
                        <td style={{ textAlign: 'right' }}>
                          {/* SO a CTS sai daqui. Sub-bacia e ETE pertencem ao
                              sistema por carga do Databricks — tira-las nao e
                              decisao desta tela, e oferecer o botao convidaria a
                              desmontar o que veio de fora. */}
                          {editTopo && t.tipo === 'cts' && (
                            <button
                              type="button"
                              className={styles.del}
                              aria-label={`Tirar ${t.nome} (${t.id}) do sistema`}
                              title="Tira a CTS do sistema. A ficha continua no cadastro."
                              onClick={() => setHierTopoSistema(t.id, '')}
                            >
                              tirar do sistema
                            </button>
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

          <CtsDoSistema
            disponiveis={ctsDisponiveis}
            sistema={sis}
            // Marcado, o sistema aceita UMA CTS: com uma já lá, não há o que
            // adicionar. O servidor recusa de todo jeito (422) — aqui a tela só
            // evita oferecer o que ela sabe que será negado.
            travado={sis.usaCts === 'true' && ctsDoSistema.length > 0}
            onColocar={(compId) => setHierTopoSistema(compId, selSis)}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * "Este sistema usa sistema de CTS" — quantas CTS ele comporta.
 *
 * MARCADO, o sistema aceita UMA CTS. DESMARCADO, aceita quantas forem colocadas
 * nele. É regra de CADASTRO, e não de simulação: o motor nunca contou CTS por
 * sistema, e para ele uma ou duas são nós como quaisquer outros.
 *
 * A caixa fica DESABILITADA quando o sistema já tem mais de uma CTS, em vez de
 * aceitar e falhar no Salvar: o servidor recusa marcar nesse estado (422), e um
 * controle que muda de posição para depois voltar sozinha é pior que um que não
 * se mexe e diz por quê.
 */
function UsaSistemaCts({
  marcado,
  quantasCts,
  onChange,
}: {
  marcado: boolean
  quantasCts: number
  onChange: (v: boolean) => void
}) {
  const id = useId()
  const impedido = !marcado && quantasCts > 1

  return (
    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
      <label
        htmlFor={id}
        style={{ display: 'flex', gap: 8, alignItems: 'baseline', cursor: 'pointer' }}
      >
        <input
          id={id}
          type="checkbox"
          checked={marcado}
          disabled={impedido}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.dbFieldLabel} style={{ margin: 0 }}>
          Usar o sistema de CTS
        </span>
      </label>
      <div className={styles.dbHint} style={{ marginLeft: 24 }}>
        {impedido ? (
          <>
            O sistema tem <strong>{quantasCts} CTS</strong>. Tire as excedentes para poder marcar —
            marcado, ele aceita uma só.
          </>
        ) : marcado ? (
          <>
            O sistema aceita <strong>uma CTS</strong>.
          </>
        ) : (
          <>
            O sistema aceita <strong>mais de uma CTS</strong>.
            {quantasCts > 0 && ` Hoje tem ${quantasCts}.`}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * ADICIONAR UMA CTS AO SISTEMA.
 *
 * A CTS e o unico componente que a Regional coloca. Do Databricks vem quais
 * sub-bacias e qual ETE pertencem ao sistema — e TODAS as CTS cadastradas, sem
 * dizer de qual sistema sao. Nenhuma nasce atrelada: em que sistema cada uma
 * entra e decisao de quem monta, aqui.
 *
 * A lista sao as CTS que NAO estao em nenhum outro sistema. Uma CTS ja colocada
 * nao aparece, porque um componente esta em um sistema so — coloca-la noutro
 * seria move-la, e mover e tirar de la primeiro.
 *
 * NAO e recortado por unidade: CTS fora de sistema nao tem cidade, nem
 * superintendencia, nem unidade. Por isso o texto diz "da base" — colocar uma
 * aqui e trazer para ca algo que nao era de ninguem.
 *
 * SELETOR, e nao lista com um botao por linha: a base tem centenas de CTS, e uma
 * lista dessas empurraria o caminho ate a ETE — que e o assunto da tela — para
 * fora do campo de visao.
 */
function CtsDoSistema({
  disponiveis,
  sistema,
  travado,
  onColocar,
}: {
  disponiveis: TopoRow[]
  sistema: SistemaH
  travado: boolean
  onColocar: (compId: string) => void
}) {
  const [sel, setSel] = useState('')
  const id = useId()

  if (travado)
    return (
      <div className={styles.dbGridCard} style={{ marginTop: 16 }}>
        <div className={styles.dbGridHeader}>
          <span className={styles.dbGridTitle}>adicionar CTS ao sistema</span>
        </div>
        <div style={{ padding: '12px 18px' }} className={styles.dbHint}>
          Este sistema está marcado como <strong>sistema de CTS</strong>, e já tem a dele. Para
          adicionar outra, desmarque a opção no quadro do sistema, acima — ou tire a atual na tabela
          do caminho até a ETE.
        </div>
      </div>
    )

  return (
    <div className={styles.dbGridCard} style={{ marginTop: 16 }}>
      <div className={styles.dbGridHeader}>
        <span className={styles.dbGridTitle}>
          adicionar CTS ao sistema · {disponiveis.length} disponíve
          {disponiveis.length === 1 ? 'l' : 'is'} na base
        </span>
      </div>
      <div style={{ padding: '12px 18px' }}>
        <label className={styles.dbFieldLabel} htmlFor={id}>
          Colocar em <strong>{sistema.nome}</strong>{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-400)' }}>
            {sistema.id}
          </span>
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id={id}
            className={styles.dbInput}
            style={{ maxWidth: 420 }}
            value={sel}
            disabled={!disponiveis.length}
            onChange={(e) => setSel(e.target.value)}
          >
            <option value="">
              {disponiveis.length ? 'Escolha uma CTS…' : 'Nenhuma CTS livre na base'}
            </option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.addLink}
            disabled={!sel}
            onClick={() => {
              onColocar(sel)
              setSel('')
            }}
          >
            + adicionar ao sistema
          </button>
        </div>
        <div className={styles.dbHint}>
          Só aparecem CTS que não estão em nenhum outro sistema. CTS fora de sistema não entra na
          simulação — depois de colocá-la, defina para onde ela escoa e salve.
        </div>
      </div>
    </div>
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
