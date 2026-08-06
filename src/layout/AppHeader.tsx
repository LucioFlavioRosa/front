import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Logo } from './Logo'
import { useUnidade } from '../api/queries'
import { useCadastroOptional } from '../state/CadastroContext'
import styles from './AppHeader.module.css'

/**
 * Header sticky (z-20) — espelha o prototipo: brand em 2 linhas, contexto
 * (unidade / titulo do grupo + "trocar unidade"), barra de completude e chip
 * "Databricks conectado". max-width 1500px.
 */
/** Segunda linha da marca, por area. No portal fica so o nome do produto. */
function areaDaRota(pathname: string): string {
  if (pathname.startsWith('/simular')) return 'Simulação'
  if (pathname === '/') return 'Otimizador de CAPEX'
  return 'Cadastro de dados'
}

const TITULO_GRUPO: Record<string, string> = {
  hierarquia: 'Hierarquia & Topologia',
  'contrato-metas': 'Contrato & Metas',
  'sub-bacias': 'Sub-bacias & Obras',
  etes: 'ETEs',
  cts: 'CTS',
}

export function AppHeader() {
  const { unidadeId } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: unidade } = useUnidade(unidadeId)
  const cad = useCadastroOptional()

  // Completude ao vivo do store quando semeado; senao o valor do servidor.
  const completude = cad?.seeded ? cad.derivado.completude : (unidade?.completude ?? 0)
  const slug = pathname.split('/').filter(Boolean).pop()
  const grupoTitulo = slug && slug !== unidadeId ? TITULO_GRUPO[slug] : undefined

  const goHub = () => navigate(unidadeId ? `/unidade/${unidadeId}` : '/')
  const goInicio = () => navigate('/')

  // Titulo da aba acompanha onde o usuario esta (o header ja tem os dois dados).
  useEffect(() => {
    // O portal e a tela de simulacao definem o proprio titulo.
    if (pathname === '/' || pathname.startsWith('/simular')) return
    const partes = [grupoTitulo, unidade?.nome, 'Cadastro · Otimizador CAPEX'].filter(Boolean)
    document.title = partes.join(' · ')
  }, [grupoTitulo, unidade?.nome, pathname])

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Sempre o inicio, com ou sem unidade no contexto — a mesma regra das
            telas de resultado. Dentro de uma unidade ela levava ao hub, e ai nao
            sobrava caminho nenhum de volta ao portal: "trocar unidade" vai para a
            selecao e o nome da unidade ja vai para o hub. */}
        <button
          type="button"
          className={styles.brand}
          onClick={goInicio}
          aria-label="Ir para a tela inicial"
        >
          <Logo size={32} />
          <span>
            <span className={styles.brandText1}>aegea · Base do Otimizador</span>
            <span className={styles.brandText2}>{areaDaRota(pathname)}</span>
          </span>
        </button>

        {/* Contexto e completude so aparecem quando ha unidade (mostraCtx). */}
        {unidade && (
          <nav className={styles.context} aria-label="Onde você está">
            <button type="button" className={styles.unidadeLink} onClick={goHub}>
              {unidade.nome}
            </button>
            {grupoTitulo && (
              <>
                <span> / </span>
                <strong className={styles.grupoTitulo}>{grupoTitulo}</strong>
              </>
            )}
            <button type="button" className={styles.trocar} onClick={() => navigate('/cadastro')}>
              ▾ trocar unidade
            </button>
          </nav>
        )}

        <div className={styles.right}>
          {unidade && (
            <div className={styles.completude}>
              <div className={styles.completudeTop}>
                <span id="completude-rotulo">Completude</span>
                <strong className={styles.pct}>{completude}%</strong>
              </div>
              <div
                className={styles.bar}
                role="progressbar"
                aria-labelledby="completude-rotulo"
                aria-valuenow={completude}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${completude}% dos campos preenchidos`}
              >
                <div className={styles.barFill} style={{ width: `${completude}%` }} />
              </div>
            </div>
          )}
          {/* Quantas fichas ainda nao foram para o servidor — o Salvar e por
              ficha, entao sem isto uma edicao esquecida em outra tela some. */}
          {cad?.temSujas && (
            <span className={styles.naoSalvo} aria-live="polite">
              <span aria-hidden="true">● </span>
              {cad.sujas.length} não salva{cad.sujas.length === 1 ? '' : 's'}
            </span>
          )}
          <span className={styles.dbChip}>
            <span aria-hidden="true">● </span>Databricks conectado
          </span>
        </div>
      </div>
    </header>
  )
}
