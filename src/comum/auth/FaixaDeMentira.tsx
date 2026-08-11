/**
 * A faixa que diz "você não está logado de verdade".
 *
 * Ela é deliberadamente feia e fica fixa no rodapé. Um seletor de usuário
 * discreto seria pior que nenhum: quem abre a tela precisa saber, sem procurar,
 * que a sessão é de mentira — senão um print daqui vira "o SSO está pronto".
 *
 * Só é montada quando `temSsoDeMentira()`. Em produção ela não existe no bundle:
 * o `main.tsx` a importa dinamicamente dentro do mesmo `if`.
 */
import { config } from '@/comum/config'
import { trocarUsuario, usuarioAtual } from '@/comum/auth/sessaoDeMentira'
import styles from './FaixaDeMentira.module.css'

export function FaixaDeMentira() {
  const usuarios = config.ssoDeMentira.usuarios
  const atual = usuarioAtual()

  return (
    <>
      <div className={styles.espacador} aria-hidden="true" />
      <div className={styles.faixa} role="status">
        <span className={styles.aviso}>sessão de desenvolvimento — não é login real</span>
        <label className={styles.campo}>
          <span>entrar como</span>
          <select
            className={styles.select}
            value={atual}
            onChange={(e) => trocarUsuario(e.target.value)}
          >
            {usuarios.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}
