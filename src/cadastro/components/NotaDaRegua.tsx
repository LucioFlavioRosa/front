import type { ReactNode } from 'react'
import { NOME_DA_REGUA, reguaDe } from '@/cadastro/domain/baseComercial'

/**
 * Nota do card da base comercial: diz QUAL régua é o denominador da meta
 * daquela cidade — e, principalmente, ONDE estão os campos dela.
 *
 * As três réguas não moram no mesmo lugar: ligações e economias vêm do
 * Databricks e estão neste card; população é preenchida pela Regional e fica no
 * bloco LOGO ACIMA. Uma nota que dissesse "é o trio destacado" no caso da
 * população mandaria o usuário procurar aqui um campo que não está aqui.
 *
 * A nota já disse "os campos estão logo abaixo" quando o bloco de população
 * vinha depois deste card — e este card tem 13 campos. Era verdade no DOM e
 * mentira no olho: o usuário rolou, não achou, e reportou campo faltando. O
 * bloco subiu para antes do card e o texto passou a apontar para cima. Se o
 * bloco mudar de lugar de novo, ESTE TEXTO muda junto — é a única coisa que diz
 * ao usuário onde procurar.
 */
export function NotaDaRegua({
  cidade,
  escopo,
  semCidade,
  extra,
}: {
  cidade?: { nome: string; cob: string } | null
  /** Como a ficha se chama na microcopy ("desta sub-bacia" / "desta CTS"). */
  escopo: string
  /** Texto para quando nao da para saber a cidade (ficha fora da arvore). */
  semCidade: ReactNode
  /** Complemento especifico da tela. */
  extra?: ReactNode
}) {
  if (!cidade) return <>{semCidade}</>

  const regua = reguaDe(cidade.cob)
  if (!regua)
    return (
      <>
        A régua de cobertura de <strong>{cidade.nome}</strong> ainda não foi escolhida em Contrato
        &amp; Metas, então <strong>nenhum</strong> destes números é o denominador da meta por
        enquanto.
      </>
    )

  if (regua === 'populacao')
    return (
      <>
        A meta de <strong>{cidade.nome}</strong> é medida em <strong>população</strong>, que não vem
        do Databricks — os campos ficam <strong>logo acima</strong>, no bloco{' '}
        <strong>“População {escopo} — você preenche”</strong>. Ligações e economias continuam aqui
        porque a régua muda por aditivo de contrato.
        {extra ? <> {extra}</> : null}
      </>
    )

  return (
    <>
      A meta de <strong>{cidade.nome}</strong> é medida em <strong>{NOME_DA_REGUA[regua]}</strong> —
      é o trio destacado aqui. O outro continua na tela de propósito: a régua muda por aditivo de
      contrato, e dado escondido é dado que ninguém confere.
      {extra ? <> {extra}</> : null}
    </>
  )
}
