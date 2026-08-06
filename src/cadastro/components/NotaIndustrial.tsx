/**
 * A regra de leitura do recorte industrial, na própria tela.
 *
 * Está aqui — e não só no dicionário — porque o erro que ela evita é silencioso:
 * quem lê "Ligações industriais: 80" ao lado de "Ligações — universo: 1.000"
 * tende a somar, e some com a diferença entre 1.000 e 1.080 sem nunca ver um
 * aviso. O número certo depende de uma decisão que nem é deste cadastro.
 *
 * Mesmo padrão da nota "Usar CTS?" do Grupo 05: o app explica o efeito da
 * escolha da rodada de simulação, sem oferecer a escolha.
 */
export function NotaIndustrial() {
  return (
    <>
      As quatro medidas industriais são <strong>parcela já contida</strong> nos totais acima — não
      se somam a eles. Incluir ou não a indústria é decisão da <strong>rodada de simulação</strong>,
      não deste cadastro: com indústria vale o total como está; só residencial, é{' '}
      <strong>total − industrial</strong>.
    </>
  )
}
