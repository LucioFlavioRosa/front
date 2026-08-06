import { useCallback, useEffect } from 'react'
import { useBlocker, useParams } from 'react-router-dom'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'

/**
 * Guarda de saida — avisa quando o usuario esta prestes a deixar a tela com
 * ficha que o servidor ainda nao recebeu. Nao renderiza nada.
 *
 * Sao dois riscos diferentes, e so um deles perde dado:
 *
 *  - **Fechar/recarregar a aba** (`beforeunload`): o rascunho vive no
 *    sessionStorage, que morre junto com a aba. Aqui o aviso e do navegador,
 *    porque so ele consegue segurar a saida.
 *  - **Sair da unidade dentro do app**: o rascunho sobrevive e a edicao volta
 *    quando o usuario reabrir a unidade. Nao ha perda — o aviso existe porque
 *    "esta guardado no meu navegador" e diferente de "esta no cadastro", e o
 *    momento de deixar a unidade e quando essa diferenca importa.
 *
 * Trocar de grupo dentro da mesma unidade nao dispara nada: o estado e o mesmo
 * durante toda a permanencia na unidade.
 */
export function GuardaSaida() {
  const { unidadeId } = useParams()
  const { temEdicaoLocal, hierEditada, sujas } = useCadastro()
  const { askConfirm } = useApp()

  // Fechar a aba leva junto o rascunho — inclusive as correcoes de hierarquia,
  // que nao tem ficha nem Salvar. Por isso este aviso observa TODA edicao local.
  useEffect(() => {
    if (!temEdicaoLocal) return
    const aoSair = (e: BeforeUnloadEvent) => {
      // O texto e do navegador desde 2019; o que importa e cancelar o evento.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [temEdicaoLocal])

  // O bloqueio observa TODA edicao local, nao so as fichas: a correcao de
  // hierarquia tambem so existe neste navegador, e sair sem saber disso e o
  // mesmo susto — mesmo que o rascunho a traga de volta depois.
  const bloqueador = useBlocker(
    useCallback(
      ({ nextLocation }: { nextLocation: { pathname: string } }) =>
        temEdicaoLocal && !nextLocation.pathname.startsWith(`/unidade/${unidadeId}`),
      [temEdicaoLocal, unidadeId],
    ),
  )

  useEffect(() => {
    if (bloqueador.state !== 'blocked') return
    const n = sujas.length
    const pendencias = [
      n > 0
        ? `${n} ficha${n === 1 ? '' : 's'} ainda não foi${n === 1 ? '' : 'ram'} enviada${n === 1 ? '' : 's'} ao cadastro`
        : '',
      hierEditada ? 'a hierarquia tem correções que nenhum backend recebe ainda' : '',
    ].filter(Boolean)
    askConfirm({
      titulo: 'Sair desta unidade com edições não salvas?',
      texto:
        `${pendencias.join('; ')}. ` +
        'Fica tudo guardado nesta sessão do navegador e volta quando você reabrir a unidade, ' +
        'mas ninguém mais vê enquanto você não usar Salvar.',
      confirmarLabel: 'Sair mesmo assim',
      onConfirm: () => bloqueador.proceed?.(),
      onCancel: () => bloqueador.reset?.(),
    })
  }, [bloqueador, sujas.length, hierEditada, askConfirm])

  return null
}
