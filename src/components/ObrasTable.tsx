import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { fieldStyle } from '../lib/fieldState'
import { capex, deTerceiros, type Obra } from '../domain/subbacia'
import styles from './ObrasTable.module.css'

/**
 * Larguras por natureza do dado, nao por coluna: valores em R$ e quantidades
 * pedem espaco (milhar + decimal), meses e anos nao. Campos do mesmo tipo com a
 * mesma largura fazem a tabela parar de parecer serrilhada.
 */
const LARGURA = { valor: 82, prazo: 60, ano: 62 }
const INPUT_W: Record<keyof Obra, number> = {
  nome: 0,
  un: 0,
  qtd: LARGURA.valor,
  preco: LARGURA.valor,
  opex: LARGURA.valor,
  tPred: LARGURA.prazo,
  dur: LARGURA.prazo,
  anoObrig: LARGURA.ano,
  proibAte: LARGURA.ano,
  wacc: LARGURA.ano,
}
const PLACEHOLDER: Partial<Record<keyof Obra, string>> = {
  qtd: 'qtde',
  preco: 'R$',
  opex: 'R$/ano',
  tPred: 'meses',
  dur: 'meses',
  anoObrig: '0',
  proibAte: '0',
  wacc: 'médio',
}
/** Nome acessivel de cada celula (o th da coluna nao chega ao leitor de tela). */
const ROTULO: Record<keyof Obra, string> = {
  nome: 'Componente',
  un: 'Unidade',
  qtd: 'Quantidade',
  preco: 'Preço unitário em R$',
  opex: 'OPEX em R$ por ano',
  tPred: 'Tempo após as predecessoras, em meses',
  dur: 'Tempo de execução em meses',
  anoObrig: 'Ano em que a obra é obrigatória',
  proibAte: 'Ano até o qual a obra é proibida',
  wacc: 'WACC',
}

/**
 * Campos em que o VAZIO e resposta valida, nao pendencia — so o WACC.
 *
 * As duas janelas (`anoObrig`/`proibAte`) tem codigo proprio para "sem
 * restricao" (`0`), entao deixar em branco ali nao diz nada e cobra preenchimento.
 */
const VAZIO_VALIDO: (keyof Obra)[] = ['wacc']

export interface ObrasTableProps {
  obras: Obra[]
  onChange: (index: number, key: keyof Obra, value: string) => void
  /** Nota do rodape da tabela. */
  nota: ReactNode
}

/**
 * Tabela editavel de obras, compartilhada pelos grupos 03 e 05: a sub-bacia tem
 * 5 componentes e a CTS 4 (a "ancora de coleta" muda de Ligacao de esgoto para
 * Coletor de tempo seco), mas as colunas, o CAPEX ƒ e as regras sao as mesmas —
 * por isso a lista de obras vem por prop em vez de ser fixada aqui.
 */
export function ObrasTable({ obras, onChange, nota }: ObrasTableProps) {
  return (
    <>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <Coluna titulo="Componente" alinha="comp" />
              <Coluna titulo="Quantidade" ajuda={['quantidade', 'a quantidade da obra']} />
              <Coluna titulo="Unidade" alinha="esq" />
              <Coluna titulo="Preço unitário" unidade="R$" />
              <Coluna titulo="CAPEX ƒ" unidade="R$ · calculado" alinha="calc" />
              <Coluna titulo="OPEX" unidade="R$/ano" ajuda={['opex', 'o OPEX da obra']} />
              <Coluna
                titulo="Após predecessoras"
                unidade="meses"
                grupo
                ajuda={['tempo_predecessoras', 'o tempo após as predecessoras']}
              />
              <Coluna
                titulo="Execução"
                unidade="meses"
                ajuda={['tempo_de_execucao', 'o tempo de execução']}
              />
              <Coluna
                titulo="Obrigatória em"
                unidade="ano · 0 · -1"
                grupo
                ajuda={['obra_obrigatoria_ano', 'o ano em que a obra é obrigatória']}
              />
              <Coluna
                titulo="Proibida até"
                unidade="ano · 0"
                ajuda={['obra_proibida_ate', 'o ano até o qual a obra é proibida']}
              />
              <Coluna titulo="WACC" unidade="fração" grupo ajuda={['wacc', 'o WACC da obra']} />
            </tr>
          </thead>
          <tbody>
            {obras.map((o, i) => (
              <tr key={o.nome}>
                <td className={`${styles.tdComp} ${i === 0 ? styles.tdAncora : ''}`}>
                  {o.nome}
                  {/* CAPEX 0 com prazo > 0: acontece, mas quem paga e executa e
                      outro. Fica no nome da obra porque e caracteristica dela,
                      nao do numero — e a coluna do nome e a que fica fixa. */}
                  {deTerceiros(o) && (
                    <span
                      className={styles.terceiros}
                      title="CAPEX zero com prazo de execução: a obra entra na sequência, mas o investimento é de terceiros."
                    >
                      de terceiros
                    </span>
                  )}
                </td>
                <ObraInput field="qtd" obra={o} onChange={(v) => onChange(i, 'qtd', v)} />
                <td className={styles.tdUn}>{o.un}</td>
                <ObraInput field="preco" obra={o} onChange={(v) => onChange(i, 'preco', v)} />
                <td className={styles.tdCapex}>{capex(o.qtd, o.preco)}</td>
                <ObraInput field="opex" obra={o} onChange={(v) => onChange(i, 'opex', v)} />
                <ObraInput field="tPred" obra={o} grupo onChange={(v) => onChange(i, 'tPred', v)} />
                <ObraInput field="dur" obra={o} onChange={(v) => onChange(i, 'dur', v)} />
                <ObraInput
                  field="anoObrig"
                  obra={o}
                  grupo
                  onChange={(v) => onChange(i, 'anoObrig', v)}
                />
                <ObraInput field="proibAte" obra={o} onChange={(v) => onChange(i, 'proibAte', v)} />
                <ObraInput field="wacc" obra={o} grupo onChange={(v) => onChange(i, 'wacc', v)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legenda dos codigos: sao duas colunas em que o numero nao vale pelo
          numero. Fica junto da tabela, nao na pagina, porque e da tabela. */}
      <div className={styles.legenda}>
        <span>
          <strong>Obrigatória em:</strong> <code>0</code> não é obrigatória · <code>-1</code>{' '}
          obrigatória em qualquer ano (a simulação escolhe) · <code>AAAA</code> obrigatória nesse
          ano
        </span>
        <span>
          <strong>Proibida até:</strong> <code>0</code> sem impedimento · <code>AAAA</code> não pode
          começar até esse ano
        </span>
        <span>
          <strong>Obra de terceiros:</strong> CAPEX <code>0</code> com execução maior que{' '}
          <code>0</code> — a obra <strong>acontece</strong> e ocupa prazo na sequência (as seguintes
          esperam por ela), mas o investimento não é da unidade. Sem CAPEX e sem prazo, a obra
          simplesmente não entra no plano.
        </span>
      </div>
      <div className={styles.foot}>{nota}</div>
    </>
  )
}

/**
 * Cabecalho de coluna em duas linhas: rotulo por extenso em cima, unidade em
 * cinza embaixo.
 *
 * Com 11 colunas, enfiar a unidade no rotulo ("Após predec. m.") obrigava a
 * abreviar e ainda deixava o texto quebrando em lugar aleatorio. Separando as
 * duas informacoes, o rotulo cabe inteiro numa linha (`nowrap`) e as unidades
 * formam uma faixa propria, que o olho ignora quando nao precisa dela.
 */
function Coluna({
  titulo,
  unidade,
  ajuda,
  alinha = 'dir',
  grupo,
}: {
  titulo: string
  unidade?: string
  /** [chave do dicionario, como o botao se anuncia]. */
  ajuda?: [string, string]
  alinha?: 'comp' | 'esq' | 'dir' | 'calc'
  /** Primeira coluna de um bloco (prazos, janela, custo do capital). */
  grupo?: boolean
}) {
  const classe = {
    comp: styles.thComp,
    esq: styles.thLeft,
    dir: styles.thRight,
    calc: styles.thCapex,
  }[alinha]

  return (
    <th scope="col" className={`${classe} ${grupo ? styles.grupo : ''}`}>
      <span className={styles.thRotulo}>
        {titulo}
        {ajuda && <Ajuda chave={ajuda[0]} rotulo={ajuda[1]} />}
      </span>
      <span className={styles.thUnidade}>{unidade ?? ' '}</span>
    </th>
  )
}

/** "?" do cabecalho: abre o verbete do dicionario de dados. */
function Ajuda({ chave, rotulo }: { chave: string; rotulo: string }) {
  const { openDict } = useApp()
  return (
    <button
      type="button"
      className={styles.help}
      aria-label={`O que é ${rotulo}?`}
      onClick={() => openDict(chave)}
    >
      ?
    </button>
  )
}

/** Celula de input de obra, com estado visual (vazio/preenchido) e WACC cinza. */
function ObraInput({
  field,
  obra,
  onChange,
  grupo,
}: {
  field: keyof Obra
  obra: Obra
  onChange: (v: string) => void
  /** Primeira celula de um bloco de colunas — ganha o filete separador. */
  grupo?: boolean
}) {
  const val = obra[field]
  // WACC vazio e valido (usa o medio da unidade): cinza, nao pendente.
  const fs =
    VAZIO_VALIDO.includes(field) && val.trim() === ''
      ? { border: '1.5px solid #cbd5e1', background: '#f8fafc' }
      : fieldStyle(val)
  return (
    <td className={`${styles.tdInput} ${grupo ? styles.grupo : ''}`}>
      <input
        className={styles.input}
        style={{ width: INPUT_W[field], border: fs.border, background: fs.background }}
        value={val}
        placeholder={PLACEHOLDER[field]}
        aria-label={`${ROTULO[field]} — ${obra.nome}`}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  )
}
