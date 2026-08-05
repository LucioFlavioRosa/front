import { Outlet } from 'react-router-dom'
import { ResultsHeader } from './ResultsHeader'
import { ConfirmModal } from '../components/ConfirmModal'
import { ToastHost } from '../components/ToastHost'
import { CrumbsProvider } from '../state/CrumbsResultado'
import styles from './ResultsShell.module.css'

/**
 * Casca das telas de RESULTADO — irma do `AppShell` do cadastro.
 *
 * Sao duas cascas e nao uma generica com condicionais porque elas divergem no
 * essencial: o cadastro monta o `CadastroProvider` (reducer, rascunho, guarda de
 * saida) porque o usuario EDITA; aqui nada disso existe. Resultado e leitura
 * pura de uma rodada imutavel — sem estado sujo, nao ha o que guardar na saida.
 *
 * O que as duas compartilham (modal de confirmacao e toasts) vem do `AppContext`,
 * que vive acima do router, entao basta montar os hosts.
 */
export function ResultsShell() {
  return (
    <CrumbsProvider>
      <div className={styles.shell}>
        <a className={styles.skip} href="#conteudo">
          Pular para o conteúdo
        </a>
        <ResultsHeader />
        <main className={styles.content} id="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
        {/* Usado pelo "excluir simulação" do historico. */}
        <ConfirmModal />
        <ToastHost />
      </div>
    </CrumbsProvider>
  )
}
