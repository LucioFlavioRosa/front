import { FieldRow } from '@/cadastro/components/FieldRow'
import { CAMPOS_POPULACAO, NOME_DA_REGUA, type Regua } from '@/cadastro/domain/baseComercial'
import { popNovas, type SubBaciaParams } from '@/cadastro/domain/subbacia'
import styles from './GrupoSubBacias.module.css'

/**
 * Bloco de população da ficha de coleta — sub-bacia e CTS usam o mesmo.
 *
 * O bloco está SEMPRE na tela. Antes ele só entrava quando a cidade media a meta
 * por população, e isso tinha dois defeitos: quem abria a ficha de uma cidade
 * medida por ligações não sabia que esses campos existiam, e quem abria a da
 * cidade medida por população achava que a tela estava incompleta, porque a nota
 * do card do Databricks prometia campos que ficavam longe da vista.
 *
 * Quando a régua é outra, os campos ficam BLOQUEADOS em vez de sumirem. É uma
 * distinção que a tela precisa fazer: "não se preenche agora" não é "não
 * existe". A régua muda por aditivo de contrato, e no dia em que mudar o número
 * que já estava ali continua valendo — dado escondido é dado que ninguém confere.
 *
 * Bloqueado é diferente de travado-do-Databricks: aquele é fonte (o valor vem de
 * fora e o override é exceção), este é pertinência (o valor é nosso, só não entra
 * na conta desta cidade hoje). Por isso não usa o cadeado nem o botão de editar.
 *
 * Campo bloqueado não conta pendência — `paramsDaRegua` só cobra `popU`/`popA`
 * quando a régua é população. Cobrar o que a tela impede de preencher seria
 * travar a simulação por um campo que ninguém pode resolver.
 *
 * A terceira parcela é calculada e nunca digitada: a população que as obras
 * passam a atender é, por definição, o que falta do universo.
 */
export function CamposPopulacao({
  params,
  cidade,
  escopo,
  regua,
  onChange,
  onHelp,
}: {
  params: SubBaciaParams
  cidade: string
  /** Como chamar a ficha na microcopy ("desta sub-bacia" / "desta CTS"). */
  escopo: string
  /** A régua da cidade. Qualquer coisa que não seja população bloqueia o bloco. */
  regua: Regua | null
  onChange: (k: 'popU' | 'popA', v: string) => void
  onHelp: (dictKey: string) => void
}) {
  const bloqueado = regua !== 'populacao'
  const motivo = regua
    ? `${cidade} mede a meta por ${NOME_DA_REGUA[regua]}, então estes números não entram na conta de cobertura. Ficam guardados: se a régua virar população por aditivo, eles voltam a valer.`
    : `A régua de cobertura de ${cidade} ainda não foi escolhida em Contrato & Metas. Enquanto isso não se resolve, não dá para saber se estes números entram na conta.`

  return (
    <div className={styles.userCard}>
      <div className={styles.userHeader}>
        <span className={styles.userHeaderLabel}>População {escopo} — você preenche</span>
        <span className={styles.userHeaderNote}>
          {bloqueado
            ? `${cidade} não mede a meta por população`
            : `${cidade} mede a meta por população`}
        </span>
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
            bloqueado={bloqueado}
            // Só a primeira linha explica o bloqueio: repetir o mesmo parágrafo
            // em cada campo vira ruído e ninguém lê nenhum.
            motivoBloqueio={chave === CAMPOS_POPULACAO[0][1] ? motivo : undefined}
            onChange={(v) => onChange(chave, v)}
            onHelp={() => onHelp(dictKey)}
          />
        ))}
        <FieldRow
          rotulo="População nova (obras)"
          tecnico="populacao_novas_obras"
          ajuda="Calculado: universo − atendida hoje. É a população que as obras deste plano passam a atender."
          unidade="hab."
          valor={popNovas(params)}
          variant="calc"
        />
      </div>
    </div>
  )
}
