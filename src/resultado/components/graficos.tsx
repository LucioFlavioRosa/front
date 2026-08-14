/**
 * Os graficos das telas de resultado.
 *
 * Num arquivo so porque compartilham escalas, eixos e o mecanismo de tooltip —
 * separa-los faria a consistencia entre eles depender de disciplina, e eles
 * PRECISAM ser consistentes: o handoff especifica cor, eixo e tooltip de cada um.
 *
 * Regras que valem para todos:
 *  - o SVG e `aria-hidden`; o equivalente textual e a tabela do ChartFrame;
 *  - tooltip e OBRIGATORIO (passar o mouse mostra os numeros daquele ponto);
 *  - a posicao do tooltip vai em % do container, para acompanhar o SVG fluido.
 */
import type { ReactNode } from 'react'
import {
  areaSob,
  areaUtil,
  caminho,
  escala,
  limites,
  losango,
  marcas,
  passosCascata,
} from '@/resultado/lib/svg'
import { brl, brlMi, inteiro, pct, VAZIO } from '@/resultado/lib/formato'
import { ChartFrame } from '@/resultado/components/ChartFrame'
import frame from './ChartFrame.module.css'
import type {
  AnoFinanceiro,
  CapexPorComponente,
  EbitdaAno,
  MetaCobertura,
  ObrasDoAno,
  ParcelaCascata,
  PontoCobertura,
  PontoCurvaS,
  ReceitaAno,
} from '@/resultado/domain/resultado'

const W = 860
const H = 340

/**
 * Tamanhos de texto em unidades do viewBox.
 *
 * O SVG e desenhado num viewBox de 860 e renderizado em ~700px, entao tudo
 * encolhe ~20% na tela: 12 aqui vira ~10px lidos. Antes era o contrario — 560 de
 * viewBox num container de 740px AMPLIAVA todo texto em 32%, e foi isso que fez
 * os rotulos parecerem grandes demais e colidirem.
 */
const TXT = { eixo: 12, rotuloEixo: 11, valor: 12, nome: 13 }

const COR = {
  teal: 'var(--res-teal)',
  ink: 'var(--res-ink)',
  laranja: 'var(--res-laranja)',
  vermelho: 'var(--res-vermelho)',
  cinza: 'var(--res-cinza)',
  cts: 'var(--res-cts)',
  ete: 'var(--res-ete)',
  grid: 'var(--res-grid)',
  eixo: 'var(--res-eixo)',
}

/** Grade horizontal + rotulos dos dois eixos. */
function Eixos({
  cx,
  dominio,
  rotuloY,
  rotulosX,
  formataY,
}: {
  cx: ReturnType<typeof areaUtil>
  dominio: [number, number]
  rotuloY?: string
  rotulosX: { x: number; texto: string }[]
  formataY: (v: number) => string
}) {
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  return (
    <g>
      {marcas(dominio).map((v) => (
        <g key={v}>
          <line
            x1={cx.x}
            y1={y(v)}
            x2={cx.x + cx.largura}
            y2={y(v)}
            stroke={v === 0 ? COR.eixo : COR.grid}
            strokeWidth={v === 0 ? 1 : 1}
          />
          <text x={cx.x - 10} y={y(v) + 4} textAnchor="end" fontSize={TXT.eixo} fill={COR.eixo}>
            {formataY(v)}
          </text>
        </g>
      ))}
      {rotulosX.map((r, i) => (
        <text
          key={`${i}-${r.texto}`}
          x={r.x}
          y={cx.y + cx.altura + 20}
          textAnchor="middle"
          fontSize={TXT.eixo}
          fill={COR.eixo}
        >
          {r.texto}
        </text>
      ))}
      {rotuloY && (
        <text x={cx.x - 54} y={cx.y - 14} fontSize={TXT.rotuloEixo} fill={COR.eixo}>
          {rotuloY}
        </text>
      )}
    </g>
  )
}

/** Rotulo de ano a cada N, para o eixo nao virar um borrao. */
function rotulosDeAno(anos: number[], x: (a: number) => number) {
  const passo = Math.max(1, Math.ceil(anos.length / 8))
  return anos.filter((_, i) => i % passo === 0).map((a) => ({ x: x(a), texto: String(a) }))
}

const milhoes = (v: number) => (v === 0 ? '0' : `${Math.round(v / 1_000_000)}`)

/**
 * Estado vazio de um quadro.
 *
 * Existe porque varios graficos leem `serie[0]` e `serie[serie.length - 1]` para
 * montar a escala do eixo X — com serie vazia isso e um TypeError que derruba a
 * pagina inteira, nao um grafico feio. A fixture nunca traz vazio; o backend
 * real pode, e uma cidade sem nenhum ano de cobertura e um caso legitimo.
 */
function QuadroVazio({
  titulo,
  origem,
  motivo,
}: {
  titulo: string
  origem: string
  motivo: string
}) {
  return (
    <ChartFrame titulo={titulo} origem={origem} tabela={{ colunas: [], linhas: [] }}>
      {() => <p className={frame.vazio}>{motivo}</p>}
    </ChartFrame>
  )
}

/** Quebra um rotulo em ate 2 linhas, sem cortar palavra no meio. */
function quebra(texto: string, largura: number): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    if (atual === '') atual = palavra
    else if (`${atual} ${palavra}`.length <= largura) atual += ` ${palavra}`
    else {
      linhas.push(atual)
      atual = palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas.slice(0, 2)
}

/**
 * Linha vertical de referencia COM rotulo. Sem o texto, a tracejada so significa
 * algo para quem for ate a legenda — e no meio de um grafico denso, ninguem vai.
 */
function Referencia({
  x,
  cx,
  cor,
  texto,
  ancora = 'start',
}: {
  x: number
  cx: ReturnType<typeof areaUtil>
  cor: string
  texto: string
  ancora?: 'start' | 'end'
}) {
  return (
    <g>
      <line
        x1={x}
        y1={cx.y}
        x2={x}
        y2={cx.y + cx.altura}
        stroke={cor}
        strokeWidth={1.3}
        strokeDasharray="5 3"
      />
      <text
        x={ancora === 'start' ? x + 6 : x - 6}
        y={cx.y - 6}
        textAnchor={ancora}
        fontSize={TXT.rotuloEixo}
        fill={cor}
      >
        {texto}
      </text>
    </g>
  )
}

// ===========================================================================
//  1 · CASCATA (global, cidade e sub-bacia usam este mesmo componente)
// ===========================================================================
export function GraficoCascata({
  parcelas,
  titulo,
  subtitulo,
  origem,
  nota,
}: {
  parcelas: ParcelaCascata[]
  titulo: string
  subtitulo?: string
  origem: string
  nota?: ReactNode
}) {
  if (parcelas.length === 0)
    return <QuadroVazio titulo={titulo} origem={origem} motivo="Sem parcelas para decompor." />
  const passos = passosCascata(parcelas)
  const dominio = limites(passos.flatMap((p) => [p.de, p.ate]))
  const cx = areaUtil(W, H)
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const larguraBarra = (cx.largura / passos.length) * 0.62

  const corDe = (tipo: string, valor: number) =>
    tipo === 'total' ? COR.ink : valor >= 0 ? COR.teal : COR.vermelho

  return (
    <ChartFrame
      titulo={titulo}
      subtitulo={subtitulo}
      origem={origem}
      nota={nota}
      legenda={[
        { rotulo: 'entra valor', cor: COR.teal },
        { rotulo: 'consome valor', cor: COR.vermelho },
        { rotulo: 'VPL', cor: COR.ink },
      ]}
      tabela={{
        colunas: ['Parcela', 'Valor', 'Acumulado'],
        linhas: passos.map((p) => [
          p.rotulo,
          brl(p.valor),
          brl(p.tipo === 'total' ? p.ate : p.ate),
        ]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos cx={cx} dominio={dominio} rotuloY="R$ mi (VP)" formataY={milhoes} rotulosX={[]} />
          {passos.map((p, i) => {
            const cxBarra = cx.x + (cx.largura / passos.length) * (i + 0.5)
            const yTopo = y(Math.max(p.de, p.ate))
            const alt = Math.max(1, Math.abs(y(p.de) - y(p.ate)))
            return (
              <g
                key={p.rotulo}
                onMouseEnter={() =>
                  mostrar({
                    x: (cxBarra / W) * 100,
                    y: (yTopo / H) * 100,
                    titulo: p.rotulo,
                    linhas: [
                      { rotulo: 'valor', valor: brl(p.valor), cor: corDe(p.tipo, p.valor) },
                      { rotulo: 'acumulado', valor: brl(p.ate) },
                    ],
                  })
                }
              >
                <rect
                  x={cxBarra - larguraBarra / 2}
                  y={yTopo}
                  width={larguraBarra}
                  height={alt}
                  fill={corDe(p.tipo, p.valor)}
                  rx={2}
                />
                {/* Preso dentro da area util: sem o clamp, a barra mais alta
                    empurrava o valor para fora do viewBox. */}
                <text
                  x={cxBarra}
                  y={Math.max(cx.y + 12, yTopo - 8)}
                  textAnchor="middle"
                  fontSize={TXT.valor}
                  fontWeight={700}
                  fill={corDe(p.tipo, p.valor)}
                >
                  {milhoes(p.valor)}
                </text>
                {/* Rotulo em ate 2 linhas, sob a barra. Truncar com reticencias
                    escondia qual parcela era: "Receita…" e "Receita…" ficavam
                    iguais, e sao a direta e a indireta. */}
                {quebra(p.rotulo, 14).map((linha, li) => (
                  <text
                    key={li}
                    x={cxBarra}
                    y={cx.y + cx.altura + 18 + li * 14}
                    textAnchor="middle"
                    fontSize={TXT.eixo}
                    fill={COR.eixo}
                  >
                    {linha}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  2 · DESEMBOLSO E RECEITA POR ANO vs TETO
// ===========================================================================
export function GraficoDesembolso({ anos }: { anos: AnoFinanceiro[] }) {
  if (anos.length === 0)
    return (
      <QuadroVazio
        titulo="Desembolso e receita por ano, contra o teto"
        origem="run_ano"
        motivo="Esta rodada não tem nenhum ano de desembolso materializado."
      />
    )
  const cx = areaUtil(W, H)
  const dominio = limites([
    ...anos.map((a) => a.capex),
    ...anos.map((a) => a.opex),
    ...anos.map((a) => a.receita),
    ...anos.map((a) => a.tetoCapex ?? 0),
  ])
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const x = escala([anos[0].ano, anos[anos.length - 1].ano], [cx.x + 14, cx.x + cx.largura - 14])
  const larg = Math.max(3, (cx.largura / anos.length) * 0.3)

  const comTeto = anos.filter((a) => a.tetoCapex !== null)

  return (
    <ChartFrame
      titulo="Desembolso e receita por ano, contra o teto"
      subtitulo="CAPEX e OPEX em barras; receita e teto do orçamento em linha"
      origem="run_ano"
      legenda={[
        { rotulo: 'CAPEX', cor: COR.teal },
        { rotulo: 'OPEX', cor: COR.laranja },
        { rotulo: 'Receita', cor: '#0f172a', forma: 'linha' },
        { rotulo: 'teto de CAPEX', cor: COR.vermelho, forma: 'tracejada' },
      ]}
      nota={
        <>
          <strong>Sobra de orçamento nos anos finais é normal</strong> — não é falha. O otimizador
          só constrói obra com retorno positivo; se sobrou teto, é porque não havia mais obra que
          compensasse.
        </>
      }
      tabela={{
        colunas: ['Ano', 'CAPEX', 'OPEX', 'Receita', 'Teto'],
        linhas: anos.map((a) => [
          a.ano,
          brl(a.capex),
          brl(a.opex),
          brl(a.receita),
          brl(a.tetoCapex),
        ]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="R$ mi"
            formataY={milhoes}
            rotulosX={rotulosDeAno(
              anos.map((a) => a.ano),
              x,
            )}
          />
          {anos.map((a) => (
            <g
              key={a.ano}
              onMouseEnter={() =>
                mostrar({
                  x: (x(a.ano) / W) * 100,
                  y: (y(Math.max(a.capex, a.receita)) / H) * 100,
                  titulo: String(a.ano),
                  linhas: [
                    { rotulo: 'CAPEX', valor: brl(a.capex), cor: COR.teal },
                    { rotulo: 'OPEX', valor: brl(a.opex), cor: COR.laranja },
                    { rotulo: 'receita', valor: brl(a.receita), cor: '#0f172a' },
                    { rotulo: 'teto', valor: brl(a.tetoCapex), cor: COR.vermelho },
                  ],
                })
              }
            >
              <rect
                x={x(a.ano) - larg}
                y={y(a.capex)}
                width={larg}
                height={Math.max(0, y(0) - y(a.capex))}
                fill={COR.teal}
              />
              <rect
                x={x(a.ano)}
                y={y(a.opex)}
                width={larg}
                height={Math.max(0, y(0) - y(a.opex))}
                fill={COR.laranja}
              />
              {/* alvo de hover largo: a barra fina e dificil de acertar */}
              <rect
                x={x(a.ano) - cx.largura / anos.length / 2}
                y={cx.y}
                width={cx.largura / anos.length}
                height={cx.altura}
                fill="transparent"
              />
            </g>
          ))}
          <path
            d={caminho(anos.map((a) => [x(a.ano), y(a.receita)]))}
            fill="none"
            stroke="#0f172a"
            strokeWidth={1.6}
          />
          {comTeto.length > 0 && (
            <path
              d={caminho(comTeto.map((a) => [x(a.ano), y(a.tetoCapex as number)]))}
              fill="none"
              stroke={COR.vermelho}
              strokeWidth={1.4}
              strokeDasharray="5 3"
            />
          )}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  3 · CURVA S — CAPEX ACUMULADO
// ===========================================================================
export function GraficoCurvaS({ pontos }: { pontos: PontoCurvaS[] }) {
  if (pontos.length === 0)
    return (
      <QuadroVazio
        titulo="Curva S — CAPEX acumulado"
        origem="run_mes"
        motivo="Esta rodada não tem curva mensal de CAPEX."
      />
    )
  const cx = areaUtil(W, H)
  const dominio = limites(pontos.map((p) => p.capexAcumulado))
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const x = escala([0, pontos.length - 1], [cx.x, cx.x + cx.largura])
  const coords: [number, number][] = pontos.map((p, i) => [x(i), y(p.capexAcumulado)])
  const anos = [...new Set(pontos.map((p) => Number(p.mes.slice(0, 4))))]

  return (
    <ChartFrame
      titulo="Curva S — CAPEX acumulado"
      subtitulo="quanto do investimento já foi desembolsado, mês a mês"
      origem="run_mes"
      tabela={{
        colunas: ['Mês', 'CAPEX do mês', 'Acumulado'],
        linhas: pontos
          .filter((_, i) => i % 6 === 0)
          .map((p) => [p.mes, brl(p.capexMes), brl(p.capexAcumulado)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="R$ mi"
            formataY={milhoes}
            rotulosX={anos.map((a) => ({
              x: x(pontos.findIndex((p) => p.mes.startsWith(String(a)))),
              texto: String(a),
            }))}
          />
          <path d={areaSob(coords, y(0))} fill={COR.teal} opacity={0.16} />
          <path d={caminho(coords)} fill="none" stroke={COR.teal} strokeWidth={2} />
          {pontos.map((p, i) => (
            <rect
              key={p.mes}
              x={x(i) - cx.largura / pontos.length / 2}
              y={cx.y}
              width={Math.max(1, cx.largura / pontos.length)}
              height={cx.altura}
              fill="transparent"
              onMouseEnter={() =>
                mostrar({
                  x: (x(i) / W) * 100,
                  y: (y(p.capexAcumulado) / H) * 100,
                  titulo: p.mes,
                  linhas: [
                    { rotulo: 'acumulado', valor: brl(p.capexAcumulado), cor: COR.teal },
                    { rotulo: 'no mês', valor: brl(p.capexMes) },
                  ],
                })
              }
            />
          ))}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  4 · CAPEX POR ELEMENTO DE OBRA (barras horizontais)
// ===========================================================================
export function GraficoCapexComponente({ itens }: { itens: CapexPorComponente[] }) {
  if (itens.length === 0)
    return (
      <QuadroVazio
        titulo="CAPEX por elemento de obra"
        origem="run_obra"
        motivo="Nenhum CAPEX por componente nesta rodada."
      />
    )
  const alturaLinha = 38
  const alt = itens.length * alturaLinha + 26
  // A esquerda cabe "Coletor de tempo seco"; a direita, "R$ 137,0 Mi · 45,1%".
  const cx = areaUtil(W, alt, { topo: 10, direita: 200, baixo: 16, esquerda: 230 })
  const max = Math.max(...itens.map((i) => i.capex), 1)
  const x = escala([0, max], [cx.x, cx.x + cx.largura])

  return (
    <ChartFrame
      titulo="CAPEX por elemento de obra"
      subtitulo="Tronco, EEE e Linha de recalque aparecem sempre separados"
      origem="run_obra"
      nota={
        <>
          <strong>Transporte nunca é agrupado.</strong> Somar Tronco, EEE e Linha de recalque num
          único &quot;Transporte&quot; esconderia justamente o elo que costuma travar a cadeia.
        </>
      }
      tabela={{
        colunas: ['Componente', 'CAPEX', '% do total'],
        linhas: itens.map((i) => [i.componente, brl(i.capex), pct(i.pctDoTotal)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${alt}`} aria-hidden="true">
          {itens.map((i, idx) => {
            const yLinha = cx.y + idx * alturaLinha
            return (
              <g
                key={i.componente}
                onMouseEnter={() =>
                  mostrar({
                    x: (x(i.capex) / W) * 100,
                    y: ((yLinha + 8) / alt) * 100,
                    titulo: i.componente,
                    linhas: [
                      { rotulo: 'CAPEX', valor: brl(i.capex), cor: COR.teal },
                      { rotulo: '% do total', valor: pct(i.pctDoTotal) },
                    ],
                  })
                }
              >
                <text
                  x={cx.x - 14}
                  y={yLinha + 21}
                  textAnchor="end"
                  fontSize={TXT.nome}
                  fill="#334155"
                >
                  {i.componente}
                </text>
                <rect
                  x={cx.x}
                  y={yLinha + 9}
                  width={Math.max(1, x(i.capex) - cx.x)}
                  height={18}
                  fill={COR.teal}
                  rx={3}
                />
                <text
                  x={x(i.capex) + 12}
                  y={yLinha + 23}
                  fontSize={TXT.valor}
                  fontWeight={700}
                  fill="#475569"
                >
                  {brlMi(i.capex)} · {pct(i.pctDoTotal)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  5 · UNIDADES CONSTRUÍDAS POR ELEMENTO DE OBRA (barras horizontais)
// ===========================================================================
/**
 * O irmão do quadro de CAPEX: mesmas linhas, mesma ordem, outra pergunta.
 *
 * Um vale quanto CUSTOU, o outro quanto FOI FEITO — 1.042.571 m de rede, 126.807
 * ligações, 252 unidades de EEE. Juntos respondem a pergunta que nenhum dos dois
 * responde sozinho: se um elemento leva um terço do orçamento, ele entrega um terço
 * da obra? Por isso os dois leem a MESMA lista, filtrada pelas mesmas obras
 * construídas — se viessem de consultas diferentes, poderiam discordar sobre quais
 * obras entraram, e dois quadros da mesma tela discordando é pior que qualquer um
 * dos dois errado sozinho.
 *
 * Substituiu o histograma de VPL por sub-bacia, que mostrava a distribuição mas não
 * dizia o que foi entregue.
 */
export function GraficoUnidadesComponente({ itens }: { itens: CapexPorComponente[] }) {
  // Elemento sem unidade não vira barra de tamanho zero: zero se lê como "nada
  // construído", e o caso é outro — não há quantidade a medir naquele elemento.
  const comQuantidade = itens.filter((i) => i.unidadesConstruidas != null)
  if (comQuantidade.length === 0)
    return (
      <QuadroVazio
        titulo="Unidades construídas por elemento"
        origem="run_obra"
        motivo="Nenhum elemento desta rodada tem quantidade construída."
      />
    )
  const alturaLinha = 38
  const alt = itens.length * alturaLinha + 26
  const cx = areaUtil(W, alt, { topo: 10, direita: 200, baixo: 16, esquerda: 230 })
  const max = Math.max(...comQuantidade.map((i) => i.unidadesConstruidas ?? 0), 1)
  const x = escala([0, max], [cx.x, cx.x + cx.largura])
  const qtd = (i: CapexPorComponente) =>
    i.unidadesConstruidas == null ? '—' : `${inteiro(i.unidadesConstruidas)} ${i.unidade ?? ''}`.trim()

  return (
    <ChartFrame
      titulo="Unidades construídas por elemento"
      subtitulo="quanto foi entregue, na unidade física de cada elemento"
      origem="run_obra"
      nota={
        <>
          <strong>Cada elemento tem a sua unidade</strong> — ligação, metro, unidade —, então as
          barras <strong>não se somam</strong>: elas comparam cada elemento com ele mesmo, não
          entre si. Na <strong>ETE</strong> a unidade é a <strong>capacidade acrescentada</strong>{' '}
          pelos módulos construídos, e não um número de peças. <strong>ETE nova</strong> aparece
          com travessão: o executor não publica a capacidade dela por sistema, e estimar aqui
          seria pior que não mostrar.
        </>
      }
      tabela={{
        colunas: ['Componente', 'Unidades construídas', 'Obras', 'CAPEX'],
        linhas: itens.map((i) => [i.componente, qtd(i), inteiro(i.obras), brl(i.capex)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${alt}`} aria-hidden="true">
          {itens.map((i, idx) => {
            const yLinha = cx.y + idx * alturaLinha
            const larguraBarra =
              i.unidadesConstruidas == null ? 0 : Math.max(1, x(i.unidadesConstruidas) - cx.x)
            return (
              <g
                key={i.componente}
                onMouseEnter={() =>
                  mostrar({
                    x: ((cx.x + larguraBarra) / W) * 100,
                    y: ((yLinha + 8) / alt) * 100,
                    titulo: i.componente,
                    linhas: [
                      { rotulo: 'construído', valor: qtd(i), cor: COR.teal },
                      { rotulo: 'obras', valor: inteiro(i.obras) },
                      { rotulo: 'CAPEX', valor: brl(i.capex) },
                    ],
                  })
                }
              >
                <text
                  x={cx.x - 14}
                  y={yLinha + 21}
                  textAnchor="end"
                  fontSize={TXT.nome}
                  fill="#334155"
                >
                  {i.componente}
                </text>
                {larguraBarra > 0 && (
                  <rect
                    x={cx.x}
                    y={yLinha + 9}
                    width={larguraBarra}
                    height={18}
                    fill={COR.teal}
                    rx={3}
                  />
                )}
                <text
                  x={cx.x + larguraBarra + 12}
                  y={yLinha + 23}
                  fontSize={TXT.valor}
                  fontWeight={700}
                  fill="#475569"
                >
                  {qtd(i)} · {inteiro(i.obras)} obras
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  6 · QUANTIDADE DE OBRAS POR ANO (empilhada por componente)
// ===========================================================================
const CORES_COMPONENTE: Record<string, string> = {
  'Ligação de esgoto': '#0f9b8e',
  'Rede coletora': '#22c55e',
  Tronco: '#0891b2',
  EEE: '#6366f1',
  'Linha de recalque': '#f59e0b',
  'ETE (módulo)': '#7c3aed',
  'Coletor de tempo seco': '#1d4ed8',
}

export function GraficoObrasPorAno({ anos }: { anos: ObrasDoAno[] }) {
  if (anos.length === 0)
    return (
      <QuadroVazio
        titulo="Quantidade de obras por ano de início"
        origem="run_obra"
        motivo="Nenhuma obra com ano de início nesta rodada."
      />
    )
  const cx = areaUtil(W, H)
  const totais = anos.map((a) => a.porComponente.reduce((s, c) => s + c.quantidade, 0))
  const dominio = limites(totais)
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const larg = (cx.largura / anos.length) * 0.6
  const componentes = [...new Set(anos.flatMap((a) => a.porComponente.map((c) => c.componente)))]

  return (
    <ChartFrame
      titulo="Quantidade de obras por ano de início"
      subtitulo="empilhadas por componente"
      origem="run_obra"
      legenda={componentes.map((c) => ({ rotulo: c, cor: CORES_COMPONENTE[c] ?? COR.cinza }))}
      tabela={{
        colunas: ['Ano', 'Componente', 'Obras'],
        linhas: anos.flatMap((a) =>
          a.porComponente.map((c) => [a.ano, c.componente, c.quantidade]),
        ),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="obras"
            formataY={(v) => String(Math.round(v))}
            rotulosX={anos.map((a, i) => ({
              x: cx.x + (cx.largura / anos.length) * (i + 0.5),
              texto: String(a.ano),
            }))}
          />
          {anos.map((a, i) => {
            const cxBarra = cx.x + (cx.largura / anos.length) * (i + 0.5)
            const total = totais[i]
            let acc = 0
            return (
              <g
                key={a.ano}
                onMouseEnter={() =>
                  mostrar({
                    x: (cxBarra / W) * 100,
                    y: (y(total) / H) * 100,
                    titulo: `${a.ano} · ${inteiro(total)} obras`,
                    linhas: a.porComponente.map((c) => ({
                      rotulo: c.componente,
                      valor: `${inteiro(c.quantidade)} · ${pct((c.quantidade / total) * 100)}`,
                      cor: CORES_COMPONENTE[c.componente] ?? COR.cinza,
                    })),
                  })
                }
              >
                {a.porComponente.map((c) => {
                  const base = acc
                  acc += c.quantidade
                  return (
                    <rect
                      key={c.componente}
                      x={cxBarra - larg / 2}
                      y={y(base + c.quantidade)}
                      width={larg}
                      height={Math.max(1, y(base) - y(base + c.quantidade))}
                      fill={CORES_COMPONENTE[c.componente] ?? COR.cinza}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  7 · EBITDA (barras + linha de margem, dois eixos)
// ===========================================================================
export function GraficoEbitda({
  anos,
  total,
  anoViraPositivo,
  fimCapex,
  escopo,
}: {
  anos: EbitdaAno[]
  total: number
  anoViraPositivo: number | null
  fimCapex: number
  escopo: string
}) {
  if (anos.length === 0)
    return (
      <QuadroVazio
        titulo={`EBITDA por ano — ${escopo}`}
        origem="run_ano"
        motivo="Sem anos de EBITDA materializados para este escopo."
      />
    )
  const cx = areaUtil(W, H, { topo: 38, direita: 58, baixo: 34, esquerda: 60 })
  const dominio = limites(anos.map((a) => a.ebitda))
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const x = escala([anos[0].ano, anos[anos.length - 1].ano], [cx.x + 12, cx.x + cx.largura - 12])
  const yMargem = escala([0, 100], [cx.y + cx.altura, cx.y])
  const larg = Math.max(3, (cx.largura / anos.length) * 0.55)
  const comMargem = anos.filter((a) => a.margemPct !== null)

  return (
    <ChartFrame
      titulo={`EBITDA por ano — ${escopo}`}
      subtitulo={`receita operacional − OPEX, nominal · total ${brl(total)}`}
      origem="run_ano"
      legenda={[
        { rotulo: 'EBITDA positivo', cor: COR.teal },
        { rotulo: 'EBITDA negativo', cor: COR.vermelho },
        { rotulo: 'margem EBITDA %', cor: '#0f172a', forma: 'linha' },
        { rotulo: 'fim do CAPEX', cor: COR.laranja, forma: 'tracejada' },
      ]}
      nota={
        <>
          O EBITDA é <strong>saída calculada</strong> e{' '}
          <strong>não entra na função objetivo</strong>: quem decide o plano é o VPL. Os primeiros
          anos podem ser negativos porque o OPEX começa antes de as ligações faturarem.
        </>
      }
      tabela={{
        colunas: ['Ano', 'EBITDA', 'Margem'],
        linhas: anos.map((a) => [a.ano, brl(a.ebitda), pct(a.margemPct)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="R$ mi/ano"
            formataY={milhoes}
            rotulosX={rotulosDeAno(
              anos.map((a) => a.ano),
              x,
            )}
          />
          {/* eixo direito: margem % */}
          {[0, 50, 100].map((v) => (
            <text
              key={v}
              x={cx.x + cx.largura + 10}
              y={yMargem(v) + 4}
              fontSize={TXT.eixo}
              fill={COR.eixo}
            >
              {v}%
            </text>
          ))}
          {anos.map((a) => (
            <rect
              key={a.ano}
              x={x(a.ano) - larg / 2}
              y={Math.min(y(a.ebitda), y(0))}
              width={larg}
              height={Math.max(1, Math.abs(y(0) - y(a.ebitda)))}
              fill={a.ebitda >= 0 ? COR.teal : COR.vermelho}
              rx={2}
              onMouseEnter={() =>
                mostrar({
                  x: (x(a.ano) / W) * 100,
                  y: (Math.min(y(a.ebitda), y(0)) / H) * 100,
                  titulo: String(a.ano),
                  linhas: [
                    {
                      rotulo: 'EBITDA',
                      valor: brl(a.ebitda),
                      cor: a.ebitda >= 0 ? COR.teal : COR.vermelho,
                    },
                    { rotulo: 'margem', valor: pct(a.margemPct) },
                  ],
                })
              }
            />
          ))}
          {comMargem.length > 1 && (
            <path
              d={caminho(comMargem.map((a) => [x(a.ano), yMargem(a.margemPct as number)]))}
              fill="none"
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          )}
          <Referencia x={x(fimCapex)} cx={cx} cor={COR.laranja} texto="fim do CAPEX" />
          {anoViraPositivo && (
            <text
              x={x(anoViraPositivo)}
              y={cx.y - 4}
              textAnchor="middle"
              fontSize={9}
              fill={COR.teal}
            >
              EBITDA &gt; 0 em {anoViraPositivo}
            </text>
          )}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  8 · COBERTURA DA CIDADE (com losangos de meta e duas referencias)
// ===========================================================================
export function GraficoCobertura({
  pontos,
  metas,
  fimCapex,
  fimConcessao,
  regua,
}: {
  pontos: PontoCobertura[]
  metas: MetaCobertura[]
  fimCapex: number
  fimConcessao: number
  regua: string
}) {
  if (pontos.length === 0)
    return (
      <QuadroVazio
        titulo="Cobertura até o fim da concessão"
        origem="run_cobertura + run_meta_cobertura"
        motivo="Sem curva de cobertura materializada para esta cidade."
      />
    )
  const cx = areaUtil(W, H)
  const dominio: [number, number] = [0, 100]
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const x = escala([pontos[0].ano, pontos[pontos.length - 1].ano], [cx.x, cx.x + cx.largura])
  const coords: [number, number][] = pontos.map((p) => [x(p.ano), y(p.coberturaPct)])
  const naJanela = metas.filter((m) => m.dentroDaJanela)
  const atingidas = naJanela.filter((m) => m.atingida).length

  return (
    <ChartFrame
      titulo={`Cobertura até o fim da concessão (${fimConcessao})`}
      subtitulo={`${atingidas}/${naJanela.length} metas na janela atingidas · régua: ${regua}`}
      origem="run_cobertura + run_meta_cobertura"
      legenda={[
        { rotulo: 'cobertura', cor: COR.teal },
        { rotulo: 'meta atingida', cor: COR.teal, forma: 'losango' },
        { rotulo: 'meta não atingida', cor: COR.vermelho, forma: 'losango' },
        { rotulo: 'fim do CAPEX', cor: COR.laranja, forma: 'tracejada' },
        { rotulo: 'fim da concessão', cor: '#0f172a', forma: 'tracejada' },
      ]}
      tabela={{
        colunas: ['Ano', 'Cobertura', 'Meta', 'Atingida'],
        linhas: pontos.map((p) => {
          const m = metas.find((x2) => x2.ano === p.ano)
          return [
            p.ano,
            pct(p.coberturaPct),
            m ? pct(m.alvoPct) : VAZIO,
            m ? (m.atingida ? 'sim' : 'não') : VAZIO,
          ]
        }),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="% de cobertura"
            formataY={(v) => `${Math.round(v)}`}
            rotulosX={rotulosDeAno(
              pontos.map((p) => p.ano),
              x,
            )}
          />
          <path d={areaSob(coords, y(0))} fill={COR.teal} opacity={0.14} />
          <path d={caminho(coords)} fill="none" stroke={COR.teal} strokeWidth={2} />

          <Referencia x={x(fimCapex)} cx={cx} cor={COR.laranja} texto="fim do CAPEX" />
          <Referencia
            x={x(fimConcessao)}
            cx={cx}
            cor="#0f172a"
            texto="fim da concessão"
            ancora="end"
          />

          {metas.map((m) => (
            <polygon
              key={m.ano}
              points={losango(x(m.ano), y(m.alvoPct), 5)}
              fill={m.atingida ? COR.teal : COR.vermelho}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}

          {pontos.map((p) => (
            <rect
              key={p.ano}
              x={x(p.ano) - cx.largura / pontos.length / 2}
              y={cx.y}
              width={Math.max(1, cx.largura / pontos.length)}
              height={cx.altura}
              fill="transparent"
              onMouseEnter={() => {
                const m = metas.find((x2) => x2.ano === p.ano)
                mostrar({
                  x: (x(p.ano) / W) * 100,
                  y: (y(p.coberturaPct) / H) * 100,
                  titulo: String(p.ano),
                  linhas: [
                    { rotulo: 'cobertura', valor: pct(p.coberturaPct), cor: COR.teal },
                    ...(m
                      ? [
                          {
                            rotulo: 'meta',
                            valor: `${pct(m.alvoPct)} · ${m.atingida ? 'atingida' : 'não atingida'}`,
                            cor: m.atingida ? COR.teal : COR.vermelho,
                          },
                        ]
                      : []),
                  ],
                })
              }}
            />
          ))}
        </svg>
      )}
    </ChartFrame>
  )
}

// ===========================================================================
//  9 · RECEITA DA SUB-BACIA NO TEMPO
// ===========================================================================
export function GraficoReceitaSubBacia({ receita }: { receita: ReceitaAno[] }) {
  if (receita.length === 0)
    return (
      <QuadroVazio
        titulo="Receita ao longo do tempo"
        origem="run_subbacia_ano"
        motivo="Sem série de receita para esta sub-bacia."
      />
    )
  const cx = areaUtil(W, H)
  const dominio = limites([...receita.map((r) => r.direta), ...receita.map((r) => r.indireta)])
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const x = escala(
    [receita[0].ano, receita[receita.length - 1].ano],
    [cx.x + 10, cx.x + cx.largura - 10],
  )
  const larg = Math.max(3, (cx.largura / receita.length) * 0.5)

  return (
    <ChartFrame
      titulo="Receita ao longo do tempo"
      subtitulo="direta em linha; indireta aparece no ano da conexão"
      origem="run_subbacia_ano"
      legenda={[
        { rotulo: 'receita direta', cor: COR.teal, forma: 'linha' },
        { rotulo: 'receita indireta', cor: COR.cts },
      ]}
      tabela={{
        colunas: ['Ano', 'Receita direta', 'Receita indireta'],
        linhas: receita.map((r) => [r.ano, brl(r.direta), brl(r.indireta)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="R$"
            formataY={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
            rotulosX={rotulosDeAno(
              receita.map((r) => r.ano),
              x,
            )}
          />
          {receita
            .filter((r) => r.indireta > 0)
            .map((r) => (
              <rect
                key={r.ano}
                x={x(r.ano) - larg / 2}
                y={y(r.indireta)}
                width={larg}
                height={Math.max(1, y(0) - y(r.indireta))}
                fill={COR.cts}
                rx={2}
              />
            ))}
          <path
            d={caminho(receita.map((r) => [x(r.ano), y(r.direta)]))}
            fill="none"
            stroke={COR.teal}
            strokeWidth={2}
          />
          {receita.map((r) => (
            <rect
              key={`h-${r.ano}`}
              x={x(r.ano) - cx.largura / receita.length / 2}
              y={cx.y}
              width={Math.max(1, cx.largura / receita.length)}
              height={cx.altura}
              fill="transparent"
              onMouseEnter={() =>
                mostrar({
                  x: (x(r.ano) / W) * 100,
                  y: (y(r.direta) / H) * 100,
                  titulo: String(r.ano),
                  linhas: [
                    { rotulo: 'direta', valor: brl(r.direta), cor: COR.teal },
                    ...(r.indireta > 0
                      ? [{ rotulo: 'indireta', valor: brl(r.indireta), cor: COR.cts }]
                      : []),
                  ],
                })
              }
            />
          ))}
        </svg>
      )}
    </ChartFrame>
  )
}
