/**
 * Costura de autenticacao. O cadastro vai autenticar por SSO, mas a biblioteca
 * do IdP (MSAL/Entra, OIDC generico, ...) ainda nao foi escolhida — entao aqui
 * fica so o ENCAIXE, sem dependencia nova:
 *
 *   - o app registra um provedor de token no bootstrap (`main.tsx`);
 *   - `api/client.ts` pede o token a cada request e manda no Authorization;
 *   - um 401/403 do servidor chama `onNaoAutorizado` (renovar sessao / relogar).
 *
 * Enquanto nao ha SSO, nenhum provedor e registrado: o client nao manda header
 * nenhum e o MSW responde normalmente. Ligar o SSO depois e uma chamada de
 * `configurarSessao({...})` no bootstrap — nada mais no resto do codigo.
 */

/** Devolve o access token atual (ou null se ainda nao ha sessao). */
export type ProvedorDeToken = () => string | null | Promise<string | null>

interface Sessao {
  token: ProvedorDeToken | null
  /** Chamado quando o servidor recusa a credencial (401/403). */
  onNaoAutorizado: ((status: number) => void) | null
}

const sessao: Sessao = { token: null, onNaoAutorizado: null }

export function configurarSessao(cfg: Partial<Sessao>) {
  if (cfg.token !== undefined) sessao.token = cfg.token
  if (cfg.onNaoAutorizado !== undefined) sessao.onNaoAutorizado = cfg.onNaoAutorizado
}

/** Usado pelos testes para voltar ao estado sem sessao. */
export function limparSessao() {
  sessao.token = null
  sessao.onNaoAutorizado = null
}

export async function tokenAtual(): Promise<string | null> {
  return sessao.token ? await sessao.token() : null
}

export function notificarNaoAutorizado(status: number) {
  sessao.onNaoAutorizado?.(status)
}
