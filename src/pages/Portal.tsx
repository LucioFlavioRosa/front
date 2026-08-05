import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './Portal.module.css'

/**
 * Tela inicial — os tres caminhos do produto, como o handoff descreve o fluxo:
 * "apos o login o usuario escolhe entre cadastrar/revisar dados, fazer simulacao
 * e ver historico de simulacoes".
 *
 * Antes a raiz era a selecao de unidade, o que forcava escolher uma unidade para
 * so depois descobrir o que dava para fazer com ela. A ordem certa e a inversa: o
 * que voce quer fazer determina se a unidade importa (cadastro e simulacao) ou
 * nao (o historico e do usuario, e ja traz a unidade em cada rodada).
 */
const CAMINHOS = [
  {
    to: '/cadastro',
    titulo: 'Cadastrar ou revisar dados',
    texto:
      'Confere e completa a base que a simulação consome: hierarquia, contrato e metas, sub-bacias e obras, ETEs e CTS.',
    acao: 'Escolher unidade →',
    tom: 'cadastro' as const,
  },
  {
    to: '/simular',
    titulo: 'Fazer simulação',
    texto:
      'Dispara uma rodada do otimizador: orçamento por ano, janela de CAPEX, objetivo entre VPL e cobertura, receita e demanda.',
    acao: 'Nova simulação →',
    tom: 'simular' as const,
  },
  {
    to: '/resultados',
    titulo: 'Ver histórico de simulações',
    texto:
      'Compara as rodadas já executadas e abre o resultado de qualquer uma: VPL, cobertura, topologia e o porquê de cada obra.',
    acao: 'Abrir histórico →',
    tom: 'resultados' as const,
  },
]

export function Portal() {
  useEffect(() => {
    document.title = 'Otimizador de CAPEX · Aegea'
  }, [])

  return (
    <section className={styles.wrap} aria-labelledby="titulo-portal">
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo} id="titulo-portal">
          Otimizador de CAPEX de Esgoto
        </h1>
        <p className={styles.sub}>
          O otimizador escolhe <strong>quais obras entram no plano e em que ano</strong>, dentro do
          teto de orçamento. Por onde você quer começar?
        </p>
      </div>

      <ul className={styles.cards}>
        {CAMINHOS.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className={`${styles.card} ${styles[c.tom]}`}>
              <h2 className={styles.cardTitulo}>{c.titulo}</h2>
              <p className={styles.cardTexto}>{c.texto}</p>
              <span className={styles.cardAcao}>{c.acao}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.rodape}>
        A ordem natural é <strong>cadastrar → simular → ver resultado</strong>, mas os três são
        independentes: o histórico mostra rodadas antigas mesmo com o cadastro de hoje incompleto.
      </p>
    </section>
  )
}
