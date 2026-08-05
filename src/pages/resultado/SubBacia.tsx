import { useParams } from 'react-router-dom'
import { useCrumbs } from '../../state/CrumbsResultado'
import { EmConstrucao } from './EmConstrucao'

/** Nivel 4 — por que esta sub-bacia entrou ou ficou de fora (explicabilidade). */
export function SubBacia() {
  const { subId } = useParams()
  useCrumbs([{ rotulo: subId ?? 'Sub-bacia' }])

  return (
    <EmConstrucao
      titulo={`Sub-bacia ${subId ?? ''}`}
      fatia={6}
      conteudo="A cascata do VPL, a receita ao longo do tempo (ou o estado vazio «sub-bacia não fatura neste plano»), a explicabilidade como UI — selo de categoria, card do elo que trava com link para o elemento, narrativa e a mini-tabela «se fosse ligada agora» —, o caminho até a ETE e a tabela de elementos."
    />
  )
}
