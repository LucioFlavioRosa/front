/**
 * A regra de leitura do recorte residencial, na própria tela.
 *
 * Está aqui — e não só no dicionário — porque ela evita dois erros silenciosos:
 *
 *   1. SOMAR. Quem lê "Ligações residenciais: 920" ao lado de "Ligações —
 *      universo: 1.000" tende a somar, e some com a diferença entre 1.000 e
 *      1.920 sem nunca ver um aviso.
 *   2. Achar que o recorte muda o dinheiro. Ele não muda: receita, VPL e vazão
 *      seguem no total. Só a META é medida em residenciais, e só quando a rodada
 *      pede. Essa confusão tem história — a versão anterior deste recorte
 *      descontava indústria da receita e da vazão junto.
 *
 * Mesmo padrão da nota "Usar CTS?" do Grupo 05: o app explica o efeito da
 * escolha da rodada de simulação, sem oferecer a escolha.
 */
export function NotaResidencial() {
  return (
    <>
      As quatro medidas residenciais são <strong>parcela já contida</strong> nos totais acima — não
      se somam a eles. Medir a meta só em residenciais é decisão da{' '}
      <strong>rodada de simulação</strong>, não deste cadastro. E o recorte para na cobertura:{' '}
      <strong>receita, VPL e vazão usam sempre o total</strong>, porque a indústria fatura e manda
      esgoto mesmo quando não conta para a meta.
    </>
  )
}
