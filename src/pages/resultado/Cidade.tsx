import { useParams } from 'react-router-dom'
import { useCrumbs } from '../../state/CrumbsResultado'
import { EmConstrucao } from './EmConstrucao'

/** Nivel 2 — cobertura vs metas, cascata, paridade e EBITDA da cidade. */
export function Cidade() {
  const { cidadeId } = useParams()
  // O rotulo e o id ate a fatia 4 trazer o payload com o nome da cidade — e o
  // payload que sabe, nao a rota (as rotas de resultado sao planas de proposito).
  useCrumbs([{ rotulo: cidadeId ?? 'Cidade' }])

  return (
    <EmConstrucao
      titulo={`Cidade ${cidadeId ?? ''}`}
      fatia={4}
      conteudo="Os 5 KPIs da cidade, a curva de cobertura até o fim da concessão com os losangos de meta, a cascata que soma o VPL, o painel de paridade esgoto/água com o efeito-base, o EBITDA da cidade e a tabela de sistemas com ocupação da ETE."
    />
  )
}
