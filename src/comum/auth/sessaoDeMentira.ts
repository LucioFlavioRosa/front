/**
 * SESSÃO CONTRA O IdP DE MENTIRA — só desenvolvimento.
 *
 * O que ela é: um provedor de token que pede um `access_token` ao
 * `mock-oauth2-server` que o backend sobe em `docker-compose.sso.yml`, e o
 * registra em `configurarSessao`. A partir daí o app inteiro roda com a
 * autenticação LIGADA — `Authorization` em toda chamada, 401 quando o token não
 * presta, e escopo diferente por usuário.
 *
 * O que ela NÃO é: um login. O token é real e o backend o valida de verdade
 * (assinatura, `aud`, `iss`, `exp`); o que é de mentira é o ato de entrar — aqui
 * se escolhe um nome numa lista, sem senha, sem redirect, sem MFA. Essa parte só
 * existe com o MSAL contra um tenant.
 *
 * Ela some inteira quando o SSO de verdade entrar: `configurarSessao` continua
 * sendo o único ponto de contato com o resto do app, e o MSAL entra por ele.
 */
import { config } from '@/comum/config'
import { configurarSessao } from '@/comum/auth/sessao'

/**
 * `sessionStorage`, e não `localStorage`: a escolha é DA ABA.
 *
 * É o que permite abrir duas abas como duas pessoas diferentes e comparar o que
 * cada uma vê — a coisa mais útil de se fazer com um recorte por usuário. Em
 * `localStorage`, trocar numa aba trocaria na outra. É também onde o rascunho do
 * cadastro já mora (`cadastro/state/rascunho.ts`), pela mesma razão.
 */
const CHAVE = 'cadastro:usuario-de-mentira'

/**
 * Margem antes do vencimento. Um token que expira no caminho até o servidor vira
 * um 401 que ninguém provocou, e que reaparece de forma intermitente.
 */
const MARGEM_MS = 60_000

interface Guardado {
  token: string
  expiraEm: number
}

let cache: Guardado | null = null

export function usuarioAtual(): string {
  const guardado = sessionStorage.getItem(CHAVE)
  const conhecidos = config.ssoDeMentira.usuarios
  if (guardado && conhecidos.includes(guardado)) return guardado
  return conhecidos[0] ?? 'dev'
}

/** Troca o usuário e recarrega: o cache de dados da tela é do usuário anterior. */
export function trocarUsuario(usuario: string) {
  sessionStorage.setItem(CHAVE, usuario)
  cache = null
  // Recarregar a página inteira, e não só invalidar as queries: o escopo muda
  // QUAIS unidades existem, e metade do estado do cadastro é semeada na montagem.
  // Um refetch deixaria a tela mostrando dado de quem saiu.
  window.location.reload()
}

async function pedirToken(): Promise<string | null> {
  const { tokenUrl, escopo } = config.ssoDeMentira
  if (!tokenUrl) return null

  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: usuarioAtual(),
    client_secret: 'nao-conferido-pelo-mock',
    scope: escopo,
  })

  const resposta = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corpo,
  })
  if (!resposta.ok) {
    console.error('[sso de mentira] o IdP recusou o pedido de token', resposta.status)
    return null
  }

  const dados = (await resposta.json()) as { access_token?: string; expires_in?: number }
  if (!dados.access_token) return null

  cache = {
    token: dados.access_token,
    expiraEm: Date.now() + (dados.expires_in ?? 3600) * 1000 - MARGEM_MS,
  }
  return cache.token
}

/**
 * Liga a sessão de mentira. Chamada no bootstrap, e só quando
 * `temSsoDeMentira()`.
 */
export function iniciarSessaoDeMentira() {
  configurarSessao({
    token: async () => {
      if (cache && Date.now() < cache.expiraEm) return cache.token
      return pedirToken()
    },
    // 401 do servidor invalida o que está guardado. Sem isto, um token revogado
    // (ou o IdP reiniciado, que gera chaves novas) faria toda chamada seguinte
    // falhar com a MESMA credencial morta, até alguém recarregar a aba.
    onNaoAutorizado: () => {
      cache = null
    },
  })
}
