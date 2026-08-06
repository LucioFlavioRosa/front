import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './CascadeTree.module.css'

export interface TreeNode {
  id: string
  titulo: ReactNode
  /** Segunda linha (id mono · contagem). */
  sub?: ReactNode
  children?: TreeNode[]
  /** Folha selecionavel (nivel final da cascata). */
  leaf?: boolean
  /** Status da folha: dot verde (ok) / ambar + rotulo (ex.: "✓" ou "3 pend."). */
  status?: { ok: boolean; label: string }
  /** Cor do dot da folha, quando nao ha status (ex.: sistema cyan no G1). */
  dotColor?: string
}

export interface FiltroChip {
  label: string
  ativo: boolean
  onClick: () => void
}

export interface CascadeTreeProps {
  nodes: TreeNode[]
  selectedId?: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  busca?: string
  onBusca?: (v: string) => void
  buscaPlaceholder?: string
  /** Rotulo acessivel do rail (ex.: "Sub-bacias por sistema"). */
  aria?: string
  /** Rotulo do campo de busca (usado no <label> oculto). */
  buscaLabel?: string
  filtros?: { pendentes: FiltroChip; todas: FiltroChip }
}

const INDENT_BASE = 16
const INDENT_STEP = 12

/**
 * Rail em cascata: niveis expansiveis (▸/▾) ate a folha. Busca + filtros no topo;
 * folha selecionada com fundo verde + trilho esquerdo; dot de status. Recursivo,
 * dirige-se pelos props controlados (expanded/selectedId) — sem estado interno.
 *
 * Acessibilidade: cada linha e um <button> (Tab/Enter/Espaco funcionam de graca),
 * ramos anunciam aria-expanded e a folha atual anuncia aria-current. As setas
 * ↑↓ andam entre as linhas visiveis e ←→ fecham/abrem o ramo, como num explorador
 * de arquivos; a navegacao usa o DOM (data-linha) em vez de um mapa de refs.
 */
export function CascadeTree({
  nodes,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  busca,
  onBusca,
  buscaPlaceholder = '⌕ Buscar…',
  aria = 'Itens do cadastro',
  buscaLabel = 'Buscar na lista',
  filtros,
}: CascadeTreeProps) {
  const listaRef = useRef<HTMLDivElement>(null)
  const idBusca = useId()

  const linhas = () =>
    Array.from(listaRef.current?.querySelectorAll<HTMLButtonElement>('[data-linha]') ?? [])

  const focar = (el: HTMLButtonElement | undefined) => el?.focus()

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement
    if (!alvo.matches('[data-linha]')) return

    const itens = linhas()
    const i = itens.indexOf(alvo as HTMLButtonElement)
    if (i < 0) return

    const depth = Number(alvo.dataset.depth ?? 0)
    const aberto = alvo.getAttribute('aria-expanded')

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focar(itens[i + 1])
        break
      case 'ArrowUp':
        e.preventDefault()
        focar(itens[i - 1])
        break
      case 'ArrowRight':
        e.preventDefault()
        // Ramo fechado abre; ramo aberto desce para o primeiro filho.
        if (aberto === 'false') alvo.click()
        else if (aberto === 'true') focar(itens[i + 1])
        break
      case 'ArrowLeft': {
        e.preventDefault()
        if (aberto === 'true') {
          alvo.click()
          break
        }
        // Senao, sobe para o ramo-pai (primeira linha acima menos indentada).
        for (let k = i - 1; k >= 0; k--) {
          if (Number(itens[k].dataset.depth ?? 0) < depth) {
            focar(itens[k])
            break
          }
        }
        break
      }
      case 'Home':
        e.preventDefault()
        focar(itens[0])
        break
      case 'End':
        e.preventDefault()
        focar(itens[itens.length - 1])
        break
    }
  }

  return (
    <div className={styles.rail}>
      {(onBusca || filtros) && (
        <div className={styles.toolbar}>
          {onBusca && (
            <>
              <label className={styles.oculto} htmlFor={idBusca}>
                {buscaLabel}
              </label>
              <input
                id={idBusca}
                type="search"
                className={styles.busca}
                placeholder={buscaPlaceholder}
                value={busca ?? ''}
                onChange={(e) => onBusca(e.target.value)}
              />
            </>
          )}
          {filtros && (
            <div className={styles.filtros} role="group" aria-label="Filtrar a lista">
              <button
                type="button"
                className={`${styles.filtro} ${filtros.pendentes.ativo ? styles.filtroAtivoPend : ''}`}
                aria-pressed={filtros.pendentes.ativo}
                onClick={filtros.pendentes.onClick}
              >
                {filtros.pendentes.label}
              </button>
              <button
                type="button"
                className={`${styles.filtro} ${filtros.todas.ativo ? styles.filtroAtivoTodas : ''}`}
                aria-pressed={filtros.todas.ativo}
                onClick={filtros.todas.onClick}
              >
                {filtros.todas.label}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={styles.scroll}
        ref={listaRef}
        onKeyDown={onKeyDown}
        role="group"
        aria-label={aria}
      >
        {nodes.map((n) => (
          <TreeRow
            key={n.id}
            node={n}
            depth={0}
            selectedId={selectedId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  selectedId?: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

function TreeRow({ node, depth, selectedId, expanded, onToggle, onSelect }: TreeRowProps) {
  const pad = INDENT_BASE + depth * INDENT_STEP

  if (node.leaf) {
    const sel = node.id === selectedId
    const ok = node.status?.ok ?? true
    return (
      <button
        type="button"
        data-linha
        data-depth={depth}
        aria-current={sel ? 'true' : undefined}
        className={`${styles.leaf} ${sel ? styles.leafSel : ''}`}
        style={{ padding: `8px 12px 8px ${pad}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span
          className={styles.dot}
          aria-hidden="true"
          style={{ background: node.dotColor ?? (ok ? 'var(--brand)' : 'var(--pend-accent)') }}
        />
        {node.sub ? (
          <span className={styles.leafBody}>
            <span className={styles.leafId}>{node.titulo}</span>
            <span className={styles.leafSub}>{node.sub}</span>
          </span>
        ) : (
          <span className={styles.leafId}>{node.titulo}</span>
        )}
        {node.status && (
          <span
            className={styles.leafStatus}
            style={{ color: ok ? 'var(--ok-text)' : 'var(--pend-text-2)' }}
          >
            {node.status.label}
          </span>
        )}
      </button>
    )
  }

  const aberto = expanded.has(node.id)
  return (
    <div>
      <button
        type="button"
        data-linha
        data-depth={depth}
        aria-expanded={aberto}
        className={`${styles.branch} ${depth === 0 ? styles.branchRoot : ''}`}
        style={{ paddingLeft: pad }}
        onClick={() => onToggle(node.id)}
      >
        <span className={styles.arrow} aria-hidden="true">
          {aberto ? '▾' : '▸'}
        </span>
        <span className={styles.branchBody}>
          <span className={styles.branchTitulo}>{node.titulo}</span>
          {node.sub && <span className={styles.branchSub}>{node.sub}</span>}
        </span>
      </button>
      {aberto &&
        node.children?.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}
