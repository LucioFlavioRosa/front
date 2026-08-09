import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRegionais, useUnidades } from '@/comum/api/organizacao'
import { ErroCarga } from '@/comum/components/Estado'
import styles from './SelecaoUnidade.module.css'

/**
 * Tela de selecao (espelha o prototipo): cabecalho centralizado + card com 2
 * selects lado a lado (Unidade travada ate escolher Regional), resumo verde da
 * base e CTA "Iniciar cadastro" a direita, cinza ate a selecao completa.
 */
const nf = new Intl.NumberFormat('pt-BR')

export function SelecaoUnidade() {
  const navigate = useNavigate()
  const [regionalId, setRegionalId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')

  const regQ = useRegionais()
  const uniQ = useUnidades(regionalId || null)
  const regionais = regQ.data ?? []
  const unidades = uniQ.data ?? []

  const unidade = unidades.find((u) => u.id === unidadeId) ?? null

  // Placeholder do select conta a historia: carregando / falhou / escolha.
  const regPlaceholder = regQ.isPending
    ? 'Carregando regionais…'
    : regQ.isError
      ? 'Não foi possível carregar'
      : 'Selecione a regional…'
  const uniPlaceholder = !regionalId
    ? 'Escolha a regional primeiro…'
    : uniQ.isPending
      ? 'Carregando unidades…'
      : uniQ.isError
        ? 'Não foi possível carregar'
        : 'Selecione a unidade…'

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.logo} />
        <h1 className={styles.titulo}>Onde você vai trabalhar?</h1>
        <p className={styles.sub}>
          A análise do otimizador roda por <strong>unidade</strong>, uma de cada vez.
          <br />
          Selecione a regional e a unidade — todos os dados do cadastro passam a ser dela.
        </p>
      </div>

      <div className={styles.card}>
        {/* Lista VAZIA não é erro — é a resposta correta para quem não tem
            nenhuma unidade liberada. Sem este bloco a tela virava um beco: select
            vazio, nenhuma mensagem, e a pessoa concluindo que o sistema quebrou.
            O servidor recorta `/regionais` pelo escopo do usuário desde que o
            acesso passou a ser por pessoa. */}
        {regQ.isSuccess && regionais.length === 0 && (
          <div className={styles.erroSlot}>
            <ErroCarga
              alvo="nenhuma unidade"
              semAcesso
              detalhe="Nenhuma regional está liberada para o seu usuário."
            />
          </div>
        )}
        {(regQ.isError || uniQ.isError) && (
          <div className={styles.erroSlot}>
            <ErroCarga
              alvo={regQ.isError ? 'a lista de regionais' : 'as unidades desta regional'}
              onRetry={() => {
                if (regQ.isError) void regQ.refetch()
                if (uniQ.isError) void uniQ.refetch()
              }}
            />
          </div>
        )}

        <div className={styles.grid}>
          <div>
            <label className={styles.label} htmlFor="sel-regional">
              Regional
            </label>
            <select
              id="sel-regional"
              className={styles.select}
              value={regionalId}
              disabled={regQ.isPending || regQ.isError}
              onChange={(e) => {
                setRegionalId(e.target.value)
                setUnidadeId('')
              }}
            >
              <option value="">{regPlaceholder}</option>
              {regionais.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.label} htmlFor="sel-unidade">
              Unidade
            </label>
            <select
              id="sel-unidade"
              className={styles.select}
              value={unidadeId}
              disabled={!regionalId || uniQ.isPending || uniQ.isError}
              onChange={(e) => setUnidadeId(e.target.value)}
            >
              <option value="">{uniPlaceholder}</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {unidade && (
          <div className={styles.resumo}>
            {(
              [
                ['Cidades', unidade.resumo.cidades],
                ['Sistemas / ETEs', unidade.resumo.sistemas],
                ['Sub-bacias', unidade.resumo.subBacias],
                ['Obras', unidade.resumo.obras],
              ] as const
            ).map(([label, num]) => (
              <div key={label}>
                <div className={styles.resumoLabel}>{label}</div>
                <div className={styles.resumoNum}>{nf.format(num)}</div>
              </div>
            ))}
            <div className={styles.resumoNota}>Base comercial já carregada do Databricks</div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cta}
            disabled={!unidade}
            onClick={() => unidade && navigate(`/unidade/${unidade.id}`)}
          >
            Iniciar cadastro →
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        Ano-base e orçamento de CAPEX não entram aqui — são informados na tela de simulação.
      </div>
    </div>
  )
}
