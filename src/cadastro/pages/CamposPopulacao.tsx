import { FieldRow } from '@/cadastro/components/FieldRow'
import { CAMPOS_POPULACAO } from '@/cadastro/domain/baseComercial'
import { popNovas, type SubBaciaParams } from '@/cadastro/domain/subbacia'
import styles from './GrupoSubBacias.module.css'

/**
 * Bloco de população da ficha de coleta — sub-bacia e CTS usam o mesmo.
 *
 * Só entra na tela quando a cidade mede a meta por população: nas outras réguas
 * o denominador é ligações ou economias e estes números não têm uso.
 *
 * Houve uma versão em que o bloco ficava sempre visível, bloqueado nas outras
 * réguas — a ideia era que "não se preenche agora" não é "não existe". Foi
 * revertido: na planilha de origem população está vazia nas 4.850 sub-bacias e
 * nas 337 CTS, então não havia dado nenhum a preservar da vista, e o bloco
 * cinza só somava ruído em 140 das 141 cidades.
 *
 * O que ficou daquela rodada, e não deve voltar atrás: o bloco vem ANTES do card
 * do Databricks. Ele ficava depois, e o card tem 13 campos — a nota dizia "os
 * campos estão logo abaixo" e ninguém os achava.
 *
 * Como é dado que a Regional informa (não vem do Databricks), os campos vazios
 * contam pendência; é isso que faz a completude cair e o hub segurar a simulação
 * se a régua virar população depois do cadastro pronto.
 *
 * A terceira parcela é calculada e nunca digitada: a população que as obras
 * passam a atender é, por definição, o que falta do universo.
 */
export function CamposPopulacao({
  params,
  cidade,
  escopo,
  onChange,
  onHelp,
}: {
  params: SubBaciaParams
  cidade: string
  /** Como chamar a ficha na microcopy ("desta sub-bacia" / "desta CTS"). */
  escopo: string
  onChange: (k: 'popU' | 'popA', v: string) => void
  onHelp: (dictKey: string) => void
}) {
  return (
    <div className={styles.userCard}>
      <div className={styles.userHeader}>
        <span className={styles.userHeaderLabel}>População {escopo} — você preenche</span>
        <span className={styles.userHeaderNote}>{cidade} mede a meta por população</span>
      </div>
      <div className={styles.paramsBody}>
        {CAMPOS_POPULACAO.map(([rotulo, chave, dictKey, unidade, placeholder, ajuda]) => (
          <FieldRow
            key={chave}
            rotulo={rotulo}
            tecnico={dictKey}
            ajuda={ajuda}
            unidade={unidade}
            placeholder={placeholder}
            valor={params[chave]}
            onChange={(v) => onChange(chave, v)}
            onHelp={() => onHelp(dictKey)}
          />
        ))}
        <FieldRow
          rotulo="População nova (obras)"
          tecnico="populacao_novas_obras"
          ajuda="Calculado: universo × potencial de crescimento − atendida hoje. É a população que as obras deste plano passam a atender."
          unidade="hab."
          valor={popNovas(params)}
          variant="calc"
        />
      </div>
    </div>
  )
}
