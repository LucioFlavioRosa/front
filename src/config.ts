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

export interface ConfigRuntime {
  /** Base das chamadas de API. Relativo ("/api") = mesma origem, sem CORS. */
  apiUrl?: string
  sso?: SsoConfig
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
}

/** true quando há SSO configurado — o bootstrap decide se inicializa a lib. */
export function temSso(): boolean {
  return !!(config.sso.authority && config.sso.clientId)
}
