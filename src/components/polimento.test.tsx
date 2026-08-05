// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FieldRow } from './FieldRow'
import { CascadeTree, type TreeNode } from './CascadeTree'
import { ToastHost } from './ToastHost'
import { ConfirmModal } from './ConfirmModal'
import { AppProvider, useApp } from '../state/AppContext'

afterEach(cleanup)

describe('FieldRow', () => {
  it('liga rótulo, unidade e ajuda ao controle', () => {
    render(
      <FieldRow
        rotulo="Vazão nova"
        unidade="L/s"
        ajuda="Vazão NOVA quando conectada."
        valor="12"
        onChange={() => {}}
      />,
    )

    // O rótulo nomeia o campo (antes era um div solto: campo sem nome).
    const campo = screen.getByLabelText('Vazão nova') as HTMLInputElement
    expect(campo.value).toBe('12')

    // Unidade e ajuda entram na descrição, não no nome.
    const descrito = campo.getAttribute('aria-describedby')!.split(' ')
    expect(descrito).toHaveLength(2)
    expect(descrito.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'L/s',
      'Vazão NOVA quando conectada.',
    ])
  })

  it('o "?" é um botão alcançável, com nome próprio', () => {
    const onHelp = vi.fn()
    render(<FieldRow rotulo="Rampa de adesão" valor="" onHelp={onHelp} />)

    const ajuda = screen.getByRole('button', { name: 'O que é "Rampa de adesão"?' })
    fireEvent.click(ajuda)
    expect(onHelp).toHaveBeenCalledOnce()
  })
})

const NODES: TreeNode[] = [
  {
    id: 'sup1',
    titulo: 'Superintendência 1',
    children: [
      { id: 'b1', titulo: 'b1', leaf: true, status: { ok: false, label: '2 pend.' } },
      { id: 'b2', titulo: 'b2', leaf: true, status: { ok: true, label: '✓' } },
    ],
  },
]

function renderTree(over: Partial<React.ComponentProps<typeof CascadeTree>> = {}) {
  const onSelect = vi.fn()
  const onToggle = vi.fn()
  const utils = render(
    <CascadeTree
      nodes={NODES}
      selectedId="b1"
      expanded={new Set(['sup1'])}
      onToggle={onToggle}
      onSelect={onSelect}
      {...over}
    />,
  )
  return { ...utils, onSelect, onToggle }
}

describe('CascadeTree', () => {
  it('as linhas são botões, com estado de expansão e de seleção', () => {
    renderTree()

    const ramo = screen.getByRole('button', { name: /Superintendência 1/ })
    expect(ramo.getAttribute('aria-expanded')).toBe('true')

    const selecionada = screen.getByRole('button', { name: /b1/ })
    expect(selecionada.getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: /b2/ }).getAttribute('aria-current')).toBe(null)
  })

  it('as setas andam pelas linhas visíveis e fecham o ramo', () => {
    const { onToggle } = renderTree()
    const ramo = screen.getByRole('button', { name: /Superintendência 1/ })
    const b1 = screen.getByRole('button', { name: /b1/ })
    const b2 = screen.getByRole('button', { name: /b2/ })

    ramo.focus()
    fireEvent.keyDown(ramo, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(b1)

    fireEvent.keyDown(b1, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(b2)

    // ← numa folha sobe para o ramo-pai (menos indentado).
    fireEvent.keyDown(b2, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(ramo)

    // ← num ramo aberto fecha o ramo.
    fireEvent.keyDown(ramo, { key: 'ArrowLeft' })
    expect(onToggle).toHaveBeenCalledWith('sup1')
  })

  it('os filtros são botões com aria-pressed', () => {
    renderTree({
      filtros: {
        pendentes: { label: 'Pendentes (1)', ativo: true, onClick: () => {} },
        todas: { label: 'Todas (2)', ativo: false, onClick: () => {} },
      },
    })

    expect(screen.getByRole('button', { name: 'Pendentes (1)' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Todas (2)' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('o campo de busca tem rótulo, não só placeholder', () => {
    renderTree({ onBusca: () => {}, buscaLabel: 'Buscar sub-bacia por código ou sistema' })
    expect(screen.getByLabelText('Buscar sub-bacia por código ou sistema')).toBeTruthy()
  })
})

function Disparador() {
  const { toast } = useApp()
  return (
    <>
      <button type="button" onClick={() => toast('primeiro')}>
        um
      </button>
      <button type="button" onClick={() => toast('segundo')}>
        dois
      </button>
      <ToastHost />
    </>
  )
}

describe('ToastHost', () => {
  it('cada toast tem o próprio timer — um novo não estende a vida do anterior', () => {
    vi.useFakeTimers()
    try {
      render(
        <AppProvider>
          <Disparador />
        </AppProvider>,
      )

      fireEvent.click(screen.getByText('um'))
      act(() => void vi.advanceTimersByTime(2000))

      // 2s depois entra o segundo: o primeiro já gastou 2s do seu tempo.
      fireEvent.click(screen.getByText('dois'))
      expect(screen.getByText('primeiro')).toBeTruthy()
      expect(screen.getByText('segundo')).toBeTruthy()

      // Aos 2,6s do primeiro ele sai; o segundo continua (só tem 0,6s de vida).
      act(() => void vi.advanceTimersByTime(700))
      expect(screen.queryByText('primeiro')).toBeNull()
      expect(screen.getByText('segundo')).toBeTruthy()

      act(() => void vi.advanceTimersByTime(2000))
      expect(screen.queryByText('segundo')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dá para dispensar o toast na hora', () => {
    render(
      <AppProvider>
        <Disparador />
      </AppProvider>,
    )

    fireEvent.click(screen.getByText('um'))
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }))
    expect(screen.queryByText('primeiro')).toBeNull()
  })
})

function AbreModal({ onConfirm }: { onConfirm: () => void }) {
  const { askConfirm } = useApp()
  return (
    <>
      <button
        type="button"
        onClick={() =>
          askConfirm({ titulo: 'Editar dados do Databricks?', texto: 'Vira override.', onConfirm })
        }
      >
        Editar
      </button>
      <ConfirmModal />
    </>
  )
}

describe('ConfirmModal', () => {
  it('foca o Cancelar, fecha no Esc e devolve o foco a quem abriu', () => {
    const onConfirm = vi.fn()
    render(
      <AppProvider>
        <AbreModal onConfirm={onConfirm} />
      </AppProvider>,
    )

    const gatilho = screen.getByRole('button', { name: 'Editar' })
    gatilho.focus()
    fireEvent.click(gatilho)

    // Abre com o foco na opção segura.
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(document.activeElement).toBe(cancelar)

    // Esc fecha sem confirmar e o foco volta para o botão de origem.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(gatilho)
  })

  it('devolve o foco ao <main> quando a ação confirmada desmonta o gatilho', () => {
    // Cenário real: "Remover CTS" apaga o próprio botão que abriu o modal.
    // Focar o elemento desconectado jogaria o foco no <body>.
    function GatilhoQueDesmonta() {
      const { askConfirm } = useApp()
      const [existe, setExiste] = useState(true)
      return (
        <>
          <main id="conteudo" tabIndex={-1}>
            conteúdo
          </main>
          {existe && (
            <button
              type="button"
              onClick={() =>
                askConfirm({
                  titulo: 'Remover esta CTS?',
                  texto: 'A CTS sai do cadastro.',
                  onConfirm: () => setExiste(false),
                })
              }
            >
              Remover CTS
            </button>
          )}
          <ConfirmModal />
        </>
      )
    }

    render(
      <AppProvider>
        <GatilhoQueDesmonta />
      </AppProvider>,
    )

    const gatilho = screen.getByRole('button', { name: 'Remover CTS' })
    gatilho.focus() // jsdom não move o foco no clique; o navegador move
    fireEvent.click(gatilho)
    fireEvent.click(screen.getByRole('button', { name: 'Sim, editar' }))

    expect(screen.queryByRole('button', { name: 'Remover CTS' })).toBeNull()
    expect(document.activeElement).toBe(document.getElementById('conteudo'))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('Tab circula dentro do card em vez de sair para a página', () => {
    render(
      <AppProvider>
        <AbreModal onConfirm={() => {}} />
      </AppProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const confirmar = screen.getByRole('button', { name: 'Sim, editar' })

    // Shift+Tab no primeiro volta para o último (e não para trás do overlay).
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmar)

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cancelar)
  })
})
