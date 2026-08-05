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
} from '../../lib/svg'
import { brl, brlMi, inteiro, pct, VAZIO } from '../../lib/formato'
import { ChartFrame } from './ChartFrame'
import type {
  AnoFinanceiro,
  CapexPorComponente,
  EbitdaAno,
  FaixaVpl,
  MetaCobertura,
  ObrasDoAno,
  ParcelaCascata,
  PontoCobertura,
  PontoCurvaS,
  ReceitaAno,
} from '../../domain/resultado'

const W = 560
const H = 240

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
          <text x={cx.x - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill={COR.eixo}>
            {formataY(v)}
          </text>
        </g>
      ))}
      {rotulosX.map((r) => (
        <text
          key={r.texto}
          x={r.x}
          y={cx.y + cx.altura + 14}
          textAnchor="middle"
          fontSize={9}
          fill={COR.eixo}
        >
          {r.texto}
        </text>
      ))}
      {rotuloY && (
        <text x={cx.x - 38} y={cx.y - 4} fontSize={8.5} fill={COR.eixo}>
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
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="R$ mi (VP)"
            formataY={milhoes}
            rotulosX={passos.map((p, i) => ({
              x: cx.x + (cx.largura / passos.length) * (i + 0.5),
              texto: p.rotulo.length > 12 ? `${p.rotulo.slice(0, 11)}…` : p.rotulo,
            }))}
          />
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
                <text
                  x={cxBarra}
                  y={yTopo - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={corDe(p.tipo, p.valor)}
                >
                  {milhoes(p.valor)}
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
//  2 · DESEMBOLSO E RECEITA POR ANO vs TETO
// ===========================================================================
export function GraficoDesembolso({ anos }: { anos: AnoFinanceiro[] }) {
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
  const alturaLinha = 24
  const alt = itens.length * alturaLinha + 20
  const cx = areaUtil(W, alt, { topo: 6, direita: 60, baixo: 14, esquerda: 120 })
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
                <text x={cx.x - 8} y={yLinha + 12} textAnchor="end" fontSize={10} fill="#334155">
                  {i.componente}
                </text>
                <rect
                  x={cx.x}
                  y={yLinha + 2}
                  width={Math.max(1, x(i.capex) - cx.x)}
                  height={14}
                  fill={COR.teal}
                  rx={2}
                />
                <text x={x(i.capex) + 6} y={yLinha + 13} fontSize={9.5} fill="#475569">
                  {brlMi(i.capex)}
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
//  5 · HISTOGRAMA DE VPL POR SUB-BACIA
// ===========================================================================
export function GraficoHistograma({
  faixas,
  positivas,
  negativas,
}: {
  faixas: FaixaVpl[]
  positivas: number
  negativas: number
}) {
  const cx = areaUtil(W, H)
  const dominio = limites(faixas.map((f) => f.quantidade))
  const y = escala(dominio, [cx.y + cx.altura, cx.y])
  const larg = (cx.largura / faixas.length) * 0.82

  return (
    <ChartFrame
      titulo="Quantidade de sub-bacias por faixa de VPL"
      subtitulo={`${inteiro(positivas)} criam valor · ${inteiro(negativas)} destroem`}
      origem="run_subbacia"
      legenda={[
        { rotulo: 'VPL positivo', cor: COR.teal },
        { rotulo: 'VPL negativo', cor: COR.vermelho },
      ]}
      tabela={{
        colunas: ['Faixa de VPL', 'Sub-bacias'],
        linhas: faixas.map((f) => [`${brlMi(f.de)} a ${brlMi(f.ate)}`, inteiro(f.quantidade)]),
      }}
    >
      {({ mostrar }) => (
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <Eixos
            cx={cx}
            dominio={dominio}
            rotuloY="sub-bacias"
            formataY={(v) => String(Math.round(v))}
            rotulosX={faixas.map((f, i) => ({
              x: cx.x + (cx.largura / faixas.length) * (i + 0.5),
              texto: milhoes(f.de),
            }))}
          />
          {faixas.map((f, i) => {
            const cxBarra = cx.x + (cx.largura / faixas.length) * (i + 0.5)
            const cor = f.ate <= 0 ? COR.vermelho : COR.teal
            return (
              <rect
                key={`${f.de}`}
                x={cxBarra - larg / 2}
                y={y(f.quantidade)}
                width={larg}
                height={Math.max(1, y(0) - y(f.quantidade))}
                fill={cor}
                rx={2}
                onMouseEnter={() =>
                  mostrar({
                    x: (cxBarra / W) * 100,
                    y: (y(f.quantidade) / H) * 100,
                    titulo: `${brlMi(f.de)} a ${brlMi(f.ate)}`,
                    linhas: [{ rotulo: 'sub-bacias', valor: inteiro(f.quantidade), cor }],
                  })
                }
              />
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
  const cx = areaUtil(W, H, { topo: 16, direita: 40, baixo: 24, esquerda: 46 })
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
            <text key={v} x={cx.x + cx.largura + 6} y={yMargem(v) + 3} fontSize={9} fill={COR.eixo}>
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
          <line
            x1={x(fimCapex)}
            y1={cx.y}
            x2={x(fimCapex)}
            y2={cx.y + cx.altura}
            stroke={COR.laranja}
            strokeWidth={1.3}
            strokeDasharray="5 3"
          />
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

          <line
            x1={x(fimCapex)}
            y1={cx.y}
            x2={x(fimCapex)}
            y2={cx.y + cx.altura}
            stroke={COR.laranja}
            strokeWidth={1.3}
            strokeDasharray="5 3"
          />
          <line
            x1={x(fimConcessao)}
            y1={cx.y}
            x2={x(fimConcessao)}
            y2={cx.y + cx.altura}
            stroke="#0f172a"
            strokeWidth={1.2}
            strokeDasharray="4 3"
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
