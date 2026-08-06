import { Link } from 'react-router-dom'
import { brl, inteiro, pct, vazao as fmtVazao, VAZIO } from '@/resultado/lib/formato'
import type { ComponenteNo, EteTopologia, NoTopologia } from '@/resultado/domain/resultado'
import styles from './NodeCard.module.css'

/**
 * Um no da topologia. Tres variantes de cabecalho, e a cor NAO e decorativa:
 *
 *   teal  sub-bacia que FATURA
 *   ink   sub-bacia que nao fatura
 *   azul  CTS — decisao de negocio diferente (estrutura dedicada x rede da
 *         sub-bacia pareada), por isso destacada e com o pareamento visivel
 *
 * Cada componente mostra CAPEX a direita e tres sub-linhas: preco unitario,
 * quantidade e ano — ou "NÃO CONSTRUÍDA", ou "terceiro · prazo Nm".
 */
export function NodeCard({
  no,
  runId,
  destacado,
}: {
  no: NoTopologia
  runId: string
  destacado?: boolean
}) {
  const classeCabecalho =
    no.tipo === 'cts' ? styles.cabCts : no.fatura ? styles.cabFatura : styles.cabInk

  return (
    <article
      className={`${styles.card} ${destacado ? styles.destacado : ''}`}
      id={`no-${no.id}`}
      aria-labelledby={`no-${no.id}-t`}
    >
      <header className={`${styles.cabecalho} ${classeCabecalho}`}>
        <div className={styles.identidade}>
          <h3 className={styles.id} id={`no-${no.id}-t`}>
            {no.id}
            {no.tipo === 'cts' && <span className={styles.marcaCts}> · CTS</span>}
          </h3>
          {no.pareadaCom && (
            <p className={styles.pareada}>
              <span aria-hidden="true">↔ </span>
              <Link
                to={`/resultados/${runId}/sub-bacias/${no.pareadaCom}`}
                className={styles.linkPar}
              >
                {no.pareadaCom}
              </Link>
            </p>
          )}
        </div>
        <div className={styles.direita}>
          <span className={styles.vazao}>{fmtVazao(no.vazao)}</span>
          <span className={styles.selo}>
            {no.tipo === 'cts' ? 'CTS' : no.fatura ? 'FATURA' : 'NÃO FATURA'}
          </span>
        </div>
      </header>

      <ul className={styles.componentes}>
        {no.componentes.map((c) => (
          <LinhaComponente key={c.nome} c={c} />
        ))}
      </ul>

      {/* Unico caminho para frente a partir da topologia. Os componentes acima
          nao sao clicaveis: o elemento se alcanca pela tabela da sub-bacia. */}
      <footer className={styles.rodapeNo}>
        <Link to={`/resultados/${runId}/sub-bacias/${no.id}`} className={styles.abrirNo}>
          Ver {no.tipo === 'cts' ? 'a CTS' : 'a sub-bacia'} e seus elementos →
        </Link>
      </footer>
    </article>
  )
}

/**
 * Uma linha de componente. NAO e link para a obra, de proposito.
 *
 * A cascata do handoff e sistema → sub-bacia → elemento, e pular a sub-bacia
 * quebra a navegacao: o breadcrumb do elemento inclui a sub-bacia, entao quem
 * chegasse direto veria um degrau que nunca visitou. O caminho para o elemento e
 * a tabela de elementos da sub-bacia.
 */
function LinhaComponente({ c }: { c: ComponenteNo }) {
  const classe =
    c.situacao === 'construida'
      ? styles.quadConstruida
      : c.situacao === 'nao-construida'
        ? styles.quadNaoConstruida
        : c.situacao === 'terceiro'
          ? styles.quadTerceiro
          : styles.quadSemObra

  const detalhe =
    c.situacao === 'sem-obra' ? (
      <span className={styles.detalheFraco}>sem obra prevista</span>
    ) : c.situacao === 'terceiro' ? (
      <span className={styles.detalheFraco}>terceiro · prazo {inteiro(c.prazoMeses)}m</span>
    ) : c.situacao === 'nao-construida' ? (
      <span className={styles.detalheLaranja}>NÃO CONSTRUÍDA</span>
    ) : (
      <span className={styles.detalhe}>
        {brl(c.precoUnitario)}/{c.unidade ?? 'un'} · {inteiro(c.quantidade)} {c.unidade ?? ''} ·
        início {c.anoInicio ?? VAZIO}
      </span>
    )

  return (
    <li className={styles.comp}>
      <span className={styles.compLinha}>
        <span className={`${styles.quad} ${classe}`} aria-hidden="true" />
        <span className={styles.nomeComp}>{c.nome}</span>
        <span className={styles.capex}>{brl(c.capex)}</span>
        <span className={styles.subLinha}>{detalhe}</span>
      </span>
    </li>
  )
}

/** A ETE: destino da cadeia, cabecalho lilas e o rodape com a ocupacao. */
export function EteCard({ ete }: { ete: EteTopologia }) {
  return (
    <article className={`${styles.card} ${styles.cardEte}`} aria-labelledby="ete-t">
      <header className={`${styles.cabecalho} ${styles.cabEte}`}>
        <h3 className={styles.id} id="ete-t">
          {ete.nome}
        </h3>
        <span className={styles.selo}>ETE</span>
      </header>

      <ul className={styles.componentes}>
        {ete.modulos.length === 0 ? (
          <li className={styles.semModulos}>Nenhum módulo cadastrado.</li>
        ) : (
          ete.modulos.map((m) => <LinhaComponente key={m.nome} c={m} />)
        )}
      </ul>

      <footer className={styles.rodapeEte}>
        <div className={styles.eteLinha}>
          <span>capacidade instalada</span>
          <strong>{fmtVazao(ete.capacidade)}</strong>
        </div>
        <div className={styles.eteLinha}>
          <span>vazão conectada</span>
          <strong>
            {fmtVazao(ete.vazaoConectada)}
            {/* Capacidade 0 -> ocupacao NULA. "—" e a verdade; "0%" diria que a
                ETE esta vazia, quando o fato e que a conta nao existe. */}
            <span className={ete.ocupacaoPct === null ? styles.semDado : styles.ocupacao}>
              {' '}
              ({pct(ete.ocupacaoPct)})
            </span>
          </strong>
        </div>
        {ete.vazaoNaoAtendida > 0 && (
          <div className={`${styles.eteLinha} ${styles.naoAtendida}`}>
            <span>vazão NÃO atendida</span>
            <strong>{fmtVazao(ete.vazaoNaoAtendida)}</strong>
          </div>
        )}
      </footer>
    </article>
  )
}

/** Legenda obrigatoria da topologia — sem ela as cores nao significam nada. */
export function LegendaTopologia() {
  const itens: { rotulo: string; classe: string }[] = [
    { rotulo: 'construída', classe: styles.quadConstruida },
    { rotulo: 'não construída', classe: styles.quadNaoConstruida },
    { rotulo: 'terceiro', classe: styles.quadTerceiro },
    { rotulo: 'sem obra prevista (CAPEX 0)', classe: styles.quadSemObra },
  ]
  return (
    <div className={styles.legenda}>
      <ul className={styles.legendaLista}>
        {itens.map((i) => (
          <li key={i.rotulo} className={styles.legendaItem}>
            <span className={`${styles.quad} ${i.classe}`} aria-hidden="true" />
            {i.rotulo}
          </li>
        ))}
        <li className={styles.legendaItem}>
          <span className={`${styles.faixaLegenda} ${styles.faixaCts}`} aria-hidden="true" />
          nó CTS (↔ sub-bacia pareada)
        </li>
        <li className={styles.legendaItem}>
          <span className={`${styles.faixaLegenda} ${styles.faixaEte}`} aria-hidden="true" />
          ETE (destino)
        </li>
      </ul>
    </div>
  )
}
