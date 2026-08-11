/**
 * Configuração do app, resolvida em RUNTIME.
 *
 * Por que não usar só `import.meta.env.VITE_*`: o Vite embute essas variáveis no
 * bundle durante o build. Em Kubernetes isso obrigaria uma imagem por ambiente —
 * o oposto de "construir uma vez e promover o mesmo artefato". Então o valor
 * real vem de `/config.js`, um arquivo servido junto com o site que cada
 * ambiente sobrescreve por ConfigMap (ver deploy/README.md).
 *
 * Precedência: `/config.js` > variável de build (`VITE_*`) > padrão.
 * A variável de build continua valendo em dev, onde `.env.local` é mais prático.
 */

export interface SsoConfig {
  /** URL do emissor (ex.: https://login.microsoftonline.com/<tenant>/v2.0). */
  authority?: string
  clientId?: string
  /** Escopos pedidos no token de acesso da API do cadastro. */
  escopos?: string[]
}

/**
 * SSO DE MENTIRA, só para desenvolvimento.
 *
 * Aponta para o provedor OIDC falso que o backend sobe em
 * `docker-compose.sso.yml`. Existe para dar para navegar o app com a autenticação
 * LIGADA antes de o MSAL existir: o token é real e o backend o valida de verdade
 * — o que não é real é o login, que aqui é escolher um nome numa lista.
 *
 * Sai quando o SSO de verdade entrar. Ele e o `sso` são mutuamente exclusivos:
 * havendo `authority`/`clientId`, é o MSAL que manda (ver `temSsoDeMentira`).
 */
export interface SsoDeMentiraConfig {
  /** Endpoint de token do IdP falso. Vazio = desligado. */
  tokenUrl?: string
  /** Os `client_id` que o mock mapeia para usuários. O primeiro é o padrão. */
  usuarios?: string[]
  /** Escopo pedido; vira o `aud` do token no mock. */
  escopo?: string
}

export interface ConfigRuntime {
  /** Base das chamadas de API. Relativo ("/api") = mesma origem, sem CORS. */
  apiUrl?: string
  sso?: SsoConfig
  ssoDeMentira?: SsoDeMentiraConfig
}

declare global {
  interface Window {
    __CADASTRO_CONFIG__?: ConfigRuntime
  }
}

// `typeof window` protege os testes de domínio/API, que rodam em ambiente node.
const runtime: ConfigRuntime =
  (typeof window !== 'undefined' ? window.__CADASTRO_CONFIG__ : undefined) ?? {}

/** Trata string vazia como "não configurado" — ConfigMap costuma vir com "". */
const ou = (...valores: (string | undefined)[]) =>
  valores.find((v) => typeof v === 'string' && v.trim() !== '')

export const config = {
  apiUrl: ou(runtime.apiUrl, import.meta.env.VITE_API_URL) ?? '/api',
  sso: {
    authority: ou(runtime.sso?.authority, import.meta.env.VITE_SSO_AUTHORITY),
    clientId: ou(runtime.sso?.clientId, import.meta.env.VITE_SSO_CLIENT_ID),
    escopos: runtime.sso?.escopos ?? [],
  },
  ssoDeMentira: {
    tokenUrl: ou(runtime.ssoDeMentira?.tokenUrl, import.meta.env.VITE_SSO_MENTIRA_URL),
    usuarios: runtime.ssoDeMentira?.usuarios ?? [],
    escopo: ou(runtime.ssoDeMentira?.escopo) ?? 'otimizador-api',
  },
}

/** true quando há SSO configurado — o bootstrap decide se inicializa a lib. */
export function temSso(): boolean {
  return !!(config.sso.authority && config.sso.clientId)
}

/**
 * true quando o IdP de mentira está configurado E não há SSO de verdade.
 *
 * A ordem importa: se um ambiente tiver os dois preenchidos por descuido, quem
 * vale é o real. Um app que caísse para o provedor falso porque uma variável
 * ficou para trás seria exatamente o modo de falha que a auth existe para evitar.
 */
export function temSsoDeMentira(): boolean {
  return !temSso() && !!config.ssoDeMentira.tokenUrl
}
