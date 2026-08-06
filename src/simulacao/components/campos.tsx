import { useId, type ReactNode } from 'react'
import styles from './campos.module.css'

/**
 * Secao numerada da tela de nova simulacao.
 *
 * O numero nao e enfeite: a tela tem 5 blocos de parametro e o resumo lateral os
 * cita nessa ordem, entao o usuario que ve um aviso sabe para onde rolar.
 */
export function Secao({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero: string
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.secao} aria-labelledby={id}>
      <header className={styles.secaoCabecalho}>
        <span className={styles.numero} aria-hidden="true">
          {numero}
        </span>
        <div>
          <h2 className={styles.secaoTitulo} id={id}>
            {titulo}
          </h2>
          {descricao && <p className={styles.secaoDesc}>{descricao}</p>}
        </div>
      </header>
      <div className={styles.secaoCorpo}>{children}</div>
    </section>
  )
}

/**
 * Rotulo de um parametro, com o NOME TECNICO em mono ao lado.
 *
 * O nome tecnico e requisito do handoff e existe para rastreabilidade: quem
 * conhece o notebook reconhece `FOCO_COBERTURA` e sabe exatamente o que o
 * controle mexe. Sem ele, a traducao para linguagem de negocio viraria adivinha.
 */
export function Rotulo({
  texto,
  tecnico,
  htmlFor,
}: {
  texto: string
  tecnico: string
  htmlFor?: string
}) {
  return (
    <label className={styles.rotulo} htmlFor={htmlFor}>
      {texto} <code className={styles.tecnico}>{tecnico}</code>
    </label>
  )
}

export function Ajuda({ children }: { children: ReactNode }) {
  return <p className={styles.ajuda}>{children}</p>
}

/** Alternativa em cartao (base de receita, curva, foco). */
export function Opcao({
  titulo,
  descricao,
  ativa,
  onClick,
}: {
  titulo: string
  descricao?: string
  ativa: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={ativa ? styles.opcaoAtiva : styles.opcao}
      aria-pressed={ativa}
      onClick={onClick}
    >
      <span className={styles.opcaoTitulo}>{titulo}</span>
      {descricao && <span className={styles.opcaoDesc}>{descricao}</span>}
    </button>
  )
}

/**
 * Interruptor SIM/nao.
 *
 * O `aviso` aparece quando o toggle esta DESLIGADO e serve para um caso especifico
 * do dominio: "so faz efeito se a base tiver CTS". Ou seja, o parametro pode nao
 * mudar nada — e melhor dizer isso do que deixar o usuario concluir que a tela
 * ignorou a escolha dele.
 */
export function Interruptor({
  rotulo,
  tecnico,
  descricao,
  aviso,
  ligado,
  onToggle,
}: {
  rotulo: string
  tecnico: string
  descricao: string
  aviso?: string
  ligado: boolean
  onToggle: () => void
}) {
  const id = useId()
  return (
    <div className={styles.interruptor}>
      <div className={styles.interruptorTopo}>
        <Rotulo texto={rotulo} tecnico={tecnico} htmlFor={id} />
        <button
          type="button"
          id={id}
          className={ligado ? styles.chaveOn : styles.chaveOff}
          role="switch"
          aria-checked={ligado}
          onClick={onToggle}
        >
          {ligado ? 'SIM' : 'não'}
        </button>
      </div>
      <p className={styles.interruptorDesc}>{descricao}</p>
      {aviso && !ligado && <p className={styles.interruptorAviso}>{aviso}</p>}
    </div>
  )
}

/** Campo de texto/numero com rotulo tecnico e sufixo opcional. */
export function Campo({
  rotulo,
  tecnico,
  valor,
  onChange,
  sufixo,
  placeholder,
  largura,
  tipo = 'text',
  inputMode = 'decimal',
}: {
  rotulo: string
  tecnico: string
  valor: string
  onChange: (v: string) => void
  sufixo?: string
  placeholder?: string
  largura?: number
  tipo?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
}) {
  const id = useId()
  return (
    <div className={styles.campo}>
      <Rotulo texto={rotulo} tecnico={tecnico} htmlFor={id} />
      <span className={styles.campoLinha}>
        <input
          id={id}
          className={styles.input}
          type={tipo}
          inputMode={inputMode}
          value={valor}
          placeholder={placeholder}
          style={largura ? { width: largura } : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {sufixo && <span className={styles.sufixo}>{sufixo}</span>}
      </span>
    </div>
  )
}
