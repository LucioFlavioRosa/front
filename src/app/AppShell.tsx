import { Outlet, useParams } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { DictionaryPanel } from '@/comum/components/DictionaryPanel'
import { ConfirmModal } from '@/comum/components/ConfirmModal'
import { GuardaSaida } from '@/cadastro/components/GuardaSaida'
import { ToastHost } from '@/comum/components/ToastHost'
import { CadastroProvider } from '@/cadastro/state/CadastroContext'
import { DICT } from '@/cadastro/domain/dict'
import { DICT_SIMULACAO } from '@/simulacao/domain/dicionario'
import { useApp } from '@/comum/state/AppContext'
import styles from './AppShell.module.css'

/**
 * Casca da aplicacao: header sticky + conteudo (paginas via Outlet) +
 * transversais. Quando ha unidade na rota, envolve tudo no CadastroProvider
 * (fonte unica dos dados dos grupos) — assim header e Hub veem edicoes ao vivo.
 */
export function AppShell() {
  const { unidadeId } = useParams()
  const { geracaoDados } = useApp()

  const conteudo = (
    <div className={styles.shell}>
      {/* Primeiro tab-stop: pula o header e o rail direto para o conteudo. */}
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <AppHeader />
      <div className={styles.body}>
        <main className={styles.content} id="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
        {/* O painel e um so, e os verbetes vem das DUAS areas: as colunas que a
            pessoa digita no cadastro e os parametros da rodada na simulacao.
            Juntar aqui e o que permite ao painel viver em `comum/` sem conhecer
            area nenhuma — e as areas nao se conhecem entre si. A raiz de
            composicao existe justamente para isto. */}
        <DictionaryPanel verbetes={{ ...DICT, ...DICT_SIMULACAO }} />
      </div>
      <ConfirmModal />
      {/* Dentro do provider (le as fichas nao salvas) e so quando ha unidade. */}
      {unidadeId && <GuardaSaida />}
      <ToastHost />
    </div>
  )

  // A `key` inclui a geracao: "recarregar do servidor" sobe o contador e o
  // provider remonta do zero, que e o unico jeito de trocar dado ja semeado.
  return unidadeId ? (
    <CadastroProvider key={`${unidadeId}:${geracaoDados}`} unidadeId={unidadeId}>
      {conteudo}
    </CadastroProvider>
  ) : (
    conteudo
  )
}
