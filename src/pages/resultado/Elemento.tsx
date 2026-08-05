import { useParams } from 'react-router-dom'
import { useCrumbs } from '../../state/CrumbsResultado'
import { EmConstrucao } from './EmConstrucao'

/** Nivel 5 — a ficha da obra, ultimo nivel de detalhe. */
export function Elemento() {
  const { obraId } = useParams()
  useCrumbs([{ rotulo: obraId ?? 'Elemento' }])

  return (
    <EmConstrucao
      titulo={`Elemento ${obraId ?? ''}`}
      fatia={6}
      conteudo="A ficha da obra em grupos de campos (identificação, custos, prazos e capital), o WACC com a origem — próprio ou médio da unidade —, o bloco de decisão com a narrativa do porquê, e a tabela «quem depende deste elemento» com o rateio por vazão."
    />
  )
}
