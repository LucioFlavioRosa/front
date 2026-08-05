import { useParams } from 'react-router-dom'
import { useCrumbs } from '../../state/CrumbsResultado'
import { EmConstrucao } from './EmConstrucao'

/** Nivel 3 — a topologia do sistema. A tela mais rica do pacote. */
export function Sistema() {
  const { sistemaId } = useParams()
  useCrumbs([{ rotulo: sistemaId ?? 'Sistema' }])

  return (
    <EmConstrucao
      titulo={`Sistema ${sistemaId ?? ''}`}
      fatia={5}
      conteudo="O diagrama de blocos ligados por setas de jusante até a ETE: sub-bacias (5 componentes), CTS em azul com o pareamento «↔ sub-bacia», a ETE em lilás com capacidade, ocupação e vazão não atendida, mais a legenda obrigatória e o rail com a lista de nós."
    />
  )
}
