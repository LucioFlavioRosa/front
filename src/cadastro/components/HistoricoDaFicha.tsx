import { useEffect } from 'react'
import { useAlteracoes } from '@/cadastro/api/queries'
import { comoLer, rotuloDoCampo, verboDaOrigem } from '@/cadastro/domain/alteracao'
import styles from './HistoricoDaFicha.module.css'

/**
 * O HISTÓRICO DE UMA FICHA — quem mudou o quê, quando.
 *
 * ## Por que ele existe
 *
 * A trilha de auditoria era gravada desde a primeira migração e **ninguém
 * conseguia lê-la pelo produto**. Ela crescia a cada gravação, e responder "quem
 * mudou este preço em julho" exigia SQL na mão. Auditoria que só o DBA alcança
 * não é auditoria: alguém ia confiar nela numa discussão sobre um número e
 * descobrir, na hora, que não dava para abrir.
 *
 * A ficha já mostrava a ÚLTIMA alteração no cabeçalho. Ela responde "alguém mexeu
 * nisto depois de mim?" — que é a pergunta do momento da edição. Este painel
 * responde a outra, que aparece meses depois: "de quanto para quanto, e por quem".
 *
 * ## As decisões de leitura
 *
 * **O verbo separa correção de preenchimento.** `corrigiu` é discordar de um
 * número que veio do Databricks; `alterou` é a Regional fazendo o próprio
 * trabalho. Chamar as duas de "alterou" apagaria a distinção que a auditoria
 * existe para fazer.
 *
 * **Criação e remoção não viram "vazio".** `de: null` é "criou como X", `para:
 * null` é "removeu (era X)" — sem isso, remover uma meta e apagar o número dela
 * ficariam indistinguíveis.
 *
 * **O corte é dito.** O servidor tem teto por resposta; se ele cortou, o painel
 * avisa em vez de deixar a lista afirmar, em silêncio, que aquilo é tudo.
 *
 * `Esc` fecha, como no painel de dicionário — é o mesmo gesto na mesma tela.
 */
export function HistoricoDaFicha({
  unidadeId,
  tipo,
  fichaId,
  nome,
  onFechar,
}: {
  unidadeId: string | undefined
  /** `sub-bacia` | `cts` | `ete` | `cidade` — o mesmo vocabulário do servidor. */
  tipo: string
  fichaId: string | undefined
  /** Como a ficha se chama na tela, para o cabeçalho não mostrar só um id. */
  nome?: string
  onFechar: () => void
}) {
  const q = useAlteracoes(unidadeId, tipo, fichaId, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  const lista = q.data?.alteracoes ?? []

  return (
    <aside className={styles.painel} role="complementary" aria-label="Histórico de alterações">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Histórico de alterações</span>
          <div className={styles.titulo}>{nome || fichaId}</div>
        </div>
        <button type="button" className={styles.fechar} onClick={onFechar} aria-label="Fechar">
          ×
        </button>
      </div>

      <div className={styles.corpo} aria-live="polite">
        {q.isPending && <p className={styles.aviso}>Carregando…</p>}

        {q.isError && (
          <p className={styles.aviso}>
            Não foi possível carregar o histórico.{' '}
            <button type="button" className={styles.link} onClick={() => void q.refetch()}>
              Tentar de novo
            </button>
          </p>
        )}

        {q.isSuccess && lista.length === 0 && (
          // "Nada mudou" e "nunca foi gravada" são diferentes, e a tela não tem
          // como distinguir as duas — então afirma só o que sabe.
          <p className={styles.aviso}>
            Nenhuma alteração registrada nesta ficha. A trilha guarda o que mudou
            desde que o cadastro passou a registrar — o que veio da planilha na
            carga não aparece aqui.
          </p>
        )}

        {lista.length > 0 && (
          <ol className={styles.lista}>
            {lista.map((a, i) => (
              <li key={i} className={styles.item}>
                <div className={styles.campo}>{rotuloDoCampo(a.campo)}</div>
                <div className={styles.valores}>{comoLer(a)}</div>
                <div className={styles.assinatura}>
                  {a.autor} {verboDaOrigem(a.origem)} · <time dateTime={a.quando}>{quando(a.quando)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}

        {q.data?.cortado && (
          <p className={styles.aviso}>
            Mostrando as alterações mais recentes. Esta ficha tem mais histórico do
            que cabe aqui.
          </p>
        )}
      </div>
    </aside>
  )
}

/** `10/08/2026 14:32` — no fuso de quem lê, como a linha do cabeçalho. */
function quando(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${DIA.format(d)} ${HORA.format(d)}`
}

const DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
