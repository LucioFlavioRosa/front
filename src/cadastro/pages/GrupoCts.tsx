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
import { useSalvarCts } from '@/cadastro/api/mutations'
import { useErroAoSalvar } from '@/cadastro/state/erroAoSalvar'
import { chaveCts } from '@/cadastro/state/fichas'
import { mkObrasCts } from '@/cadastro/domain/cts'
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
    onSalva: ({ ctsId, ficha }, r) => marcarSalva(chaveCts(ctsId), ficha, r?.versao),
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

  // NAO HA "criar CTS" NEM "remover CTS" nesta tela, e isso e deliberado.
  //
  // A CTS e um NO DO SISTEMA, como a sub-bacia: a posicao dela ja esta na
  // topologia (`sistema_topologia`), com jusante proprio: no cadastro carregado
  // da planilha, TODAS estao la. O motor monta os nos percorrendo a topologia e faz
  // `cts_ids = fichas ∩ nos`: so e CTS efetiva a ficha que TAMBEM e no.
  //
  // Criar uma CTS aqui gravava ficha e par sem tocar na topologia — ela aparecia
  // no cadastro e NAO existia para a simulacao. Remover era pior: apagava a ficha
  // e deixava o no, que virava um no de demanda ZERO; e como o par sumia junto,
  // com `USAR_CTS` desligado a demanda dela deixava de ser somada a sub-bacia
  // irma. Duas perdas ao mesmo tempo, nenhuma com erro visivel.
  //
  // `subbacia_cts` e SOBREPOSICAO de area, e nao pertencimento: e ela que permite
  // ao `USAR_CTS` escolher entre tratar a CTS como estrutura propria ou somar
  // ligacoes, receita e vazao dela na sub-bacia pareada.
  //
  // Criar ou remover CTS e mudanca de TOPOLOGIA, e topologia vem do cadastro
  // estrutural (Grupo 01). Aqui se le e se edita a ficha de uma CTS que existe.

  // Seleciona a primeira CTS quando a lista muda.
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

  /** Ramos a abrir para revelar uma CTS no rail (ou o ramo das orfas). */
  const caminhoDaCts = (ctsId: string) => path[ctss[ctsId]?.subId ?? ''] ?? [RAMO_ORFAS]

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
            {x.subId ? ` (par de ${x.subId})` : ''} — {x.detalhe}
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

  // Nenhuma CTS cadastrada: a tela nao tem ficha para mostrar.
  if (!selCts || !ctss[selCts])
    return (
      <section>
        <GrupoHeader titulo={TITULO} sub={SUB} />
        {aviso}
        <div className={ctsStyles.vazio}>
          <div className={ctsStyles.vazioTitulo}>Nenhuma CTS cadastrada nesta unidade</div>
          <p className={ctsStyles.vazioTexto}>
            O coletor de tempo seco capta o esgoto que escorre em dias sem chuva e o leva até a ETE.
            As CTS desta unidade vêm do cadastro estrutural, junto da topologia do sistema — elas
            não se criam por aqui. Se esta unidade deveria ter CTS, é no Grupo 01 que a topologia é
            corrigida.
          </p>
        </div>
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
        >
          {/* Vinculo com a sub-bacia pareada — a area das duas se sobrepoe. */}
          <div className={styles.sheetFoot}>
            <span className={ctsStyles.parChip}>
              {`CTS ↔ sub-bacia ${cur.subId}${subPar ? ` · ${subPar.nome}` : ''}`}
            </span>
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
    </section>
  )
}
