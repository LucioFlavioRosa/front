import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './Simular.module.css'

/**
 * Disparo de uma rodada — o terceiro caminho do portal.
 *
 * ESTA TELA AINDA NAO EXISTE de verdade, e o marcador e honesto sobre isso: ela
 * esta fora do escopo dos DOIS handoffs recebidos (o de cadastro diz que
 * `usar_cts` "vive na tela de simulacao, que nao faz parte deste app"; o de
 * resultados chama o disparo de "tela fora deste escopo"). Nao ha protótipo nem
 * contrato para ela.
 *
 * O que da para fazer hoje e o que esta aqui: explicar o que a rodada precisa,
 * mostrar de onde vem cada parametro, e levar aos dois lugares que ja funcionam
 * — o cadastro, onde a completude e verificada, e o historico, onde o resultado
 * aparece. Fingir um botao "Simular" que nao dispara nada seria pior que a
 * ausencia dele.
 */
const PARAMETROS = [
  {
    k: 'Orçamento e janela de CAPEX',
    v: 'teto anual de investimento e em quantos anos as obras podem começar',
  },
  {
    k: 'Foco',
    v: '0 = decidir só por VPL · 1 = priorizar cobertura mesmo com VPL menor',
  },
  {
    k: 'Base de receita',
    v: 'arrecadada (o que entrou) ou faturada (o que era para entrar)',
  },
  {
    k: 'Usar CTS',
    v: 'orçar o Coletor de Tempo Seco à parte, ou somar a demanda dele à sub-bacia pareada',
  },
  {
    k: 'Incluir indústria',
    v: 'usar o total (residencial + industrial) ou só a parcela residencial',
  },
]

export function Simular() {
  useEffect(() => {
    document.title = 'Fazer simulação · Otimizador CAPEX'
  }, [])

  return (
    <section className={styles.wrap} aria-labelledby="titulo-simular">
      <h1 className={styles.titulo} id="titulo-simular">
        Fazer simulação
      </h1>
      <p className={styles.sub}>
        Uma simulação é uma rodada do otimizador sobre o cadastro de <strong>uma unidade</strong>,
        com um conjunto de parâmetros. Cada rodada gera um <code>run_id</code>, e é ele que aparece
        no histórico.
      </p>

      <div className={styles.aviso} role="note">
        <h2 className={styles.avisoTitulo}>Esta tela ainda não foi construída</h2>
        <p className={styles.avisoTexto}>
          O disparo da rodada está fora do escopo dos dois handoffs recebidos — não há protótipo nem
          contrato de API para ele, e o backend que executa o job também não existe ainda. Um botão
          &quot;Simular&quot; aqui não dispararia nada, então preferimos não colocá-lo.
        </p>
      </div>

      <h2 className={styles.secao}>O que a rodada vai pedir</h2>
      <dl className={styles.params}>
        {PARAMETROS.map((p) => (
          <div key={p.k} className={styles.param}>
            <dt className={styles.paramK}>{p.k}</dt>
            <dd className={styles.paramV}>{p.v}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.nota}>
        Esses parâmetros são da <strong>rodada</strong>, não do cadastro — é por isso que &quot;usar
        CTS&quot; e &quot;incluir indústria&quot; não aparecem nas telas de cadastro. Depois de
        rodar, eles ficam visíveis como chips no topo da tela de resultados.
      </p>

      <h2 className={styles.secao}>Enquanto isso</h2>
      <div className={styles.atalhos}>
        <Link to="/cadastro" className={styles.atalho}>
          <strong>Conferir o cadastro de uma unidade</strong>
          <span>
            A simulação só é liberada com zero pendências — o hub da unidade mostra o que falta.
          </span>
        </Link>
        <Link to="/resultados" className={styles.atalho}>
          <strong>Ver as rodadas já executadas</strong>
          <span>
            O histórico traz os resultados de quem já rodou, com os parâmetros de cada um.
          </span>
        </Link>
      </div>
    </section>
  )
}
