import { formatarAuditoria, type Auditoria } from '@/cadastro/domain/auditoria'
import styles from './UltimaAlteracao.module.css'

/**
 * "última alteração: ana@aegea, 10/08 14:32" — quem gravou esta ficha por último.
 *
 * É o que substituiu o 409 de ficha (R6 — ver `domain/auditoria.ts`). O servidor
 * não recusa mais a gravação de quem leu a ficha antes de um colega salvar,
 * então esta linha é o único lugar em que uma pessoa descobre que outra mexeu.
 *
 * Existe como componente próprio, e não inline em cada tela, porque as quatro
 * fichas o mostram e duas delas nem usam o mesmo cabeçalho: sub-bacia e CTS têm
 * `RecordSheet`, ETE e cidade põem o Salvar no `GrupoHeader`. Copiado, o texto
 * divergiria — e "última alteração" numa tela e "alterado por" noutra fariam o
 * usuário achar que são coisas diferentes.
 *
 * Ficha nunca gravada pela tela não rende linha nenhuma: escrever "nunca
 * alterada" afirmaria o que o dado não sustenta, já que a coluna só existe desde
 * a migração e as 4.850 sub-bacias vieram da planilha.
 *
 * `aria-live` pela mesma razão da `MarcaSalvamento`: o texto muda como
 * consequência de salvar, sem foco próprio. Sem isso, quem usa leitor de tela
 * não fica sabendo que a autoria passou a ser sua.
 */
export function UltimaAlteracao({ auditoria }: { auditoria?: Auditoria }) {
  const texto = auditoria ? formatarAuditoria(auditoria) : ''
  if (!texto) return null
  return (
    <span className={styles.linha} aria-live="polite">
      última alteração: {texto}
    </span>
  )
}
