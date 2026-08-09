/**
 * Mutations de escrita — uma por ficha, espelhando api/escrita.ts.
 *
 * Nao invalidam queries de proposito: a fonte de verdade da edicao e o
 * `CadastroContext` (o seed so acontece uma vez), entao um refetch nao traria
 * nada novo e ainda piscaria a tela. Quando o backend passar a devolver campos
 * recalculados por ele (ticket, capex), o lugar de reconciliar e o `onSuccess`
 * de cada mutation aqui.
 */
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/comum/api/client'
import type {
  FichaCidade,
  FichaCts,
  FichaEte,
  FichaSubBacia,
  RespostaSalvar,
} from '@/cadastro/api/escrita'

/** Mensagem curta, em português, para o toast de falha ao salvar. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.naoAutorizado) return 'Sua sessão expirou. Entre de novo para salvar.'
    // O 409 normalmente nao chega aqui: a tela oferece recarregar do servidor
    // (state/erroAoSalvar.ts). Este texto e a saida de emergencia.
    if (e.conflito) return 'Outra pessoa salvou esta ficha antes.'
    if (e.invalido) return 'O servidor recusou os dados desta ficha. Confira os campos preenchidos.'
    return `Não foi possível salvar (erro ${e.status}). Suas edições continuam nesta tela.`
  }
  return 'Não foi possível salvar. Suas edições continuam nesta tela.'
}

/**
 * `onSalva` recebe as variaveis da chamada que o servidor aceitou E a resposta
 * dele — a resposta traz a `versao` nova, que precisa voltar para o state ou o
 * proximo salvamento da mesma ficha conflita consigo mesmo. E por ele
 * que a ficha vira "sem mudancas" no store — no nivel do hook, pela mesma razao
 * dos callbacks de CTS abaixo: sair da tela antes da resposta nao pode fazer o
 * app achar que a ficha continua nao salva.
 */
interface OpcoesSalvar<V> {
  onSalva?: (vars: V, resposta: RespostaSalvar) => void
}

/**
 * Denuncia servidor que aceitou (2xx) e nao devolveu `versao`.
 *
 * Nao vira toast: o salvamento DEU CERTO e o usuario nao tem o que fazer com a
 * informacao. Mas a ficha perde a protecao de conflito ate a proxima carga (ver
 * `FICHA_SALVA` no reducer), e isso nao pode acontecer em silencio para quem
 * mantem o sistema — foi exatamente um silencio desses que deixou o 409 inteiro
 * sem funcionar por semanas.
 */
function conferirContrato(rota: string, dado: RespostaSalvar | undefined): void {
  if (!dado?.versao) {
    console.error(
      `[contrato] PUT ${rota} respondeu 2xx sem "versao". A ficha fica sem ` +
        'protecao de conflito (409) ate a tela recarregar.',
    )
  }
}

type VarsSubBacia = { subId: string; ficha: FichaSubBacia }

export function useSalvarSubBacia(
  unidadeId: string | undefined,
  opcoes?: OpcoesSalvar<VarsSubBacia>,
) {
  return useMutation({
    mutationFn: ({ subId, ficha }: VarsSubBacia) =>
      api.put<RespostaSalvar>(`/unidades/${unidadeId}/sub-bacias/${subId}`, ficha),
    onSuccess: (dado, vars) => {
      conferirContrato(`/unidades/${unidadeId}/sub-bacias/${vars.subId}`, dado)
      opcoes?.onSalva?.(vars, dado)
    },
  })
}

type VarsCidade = { cidId: string; ficha: FichaCidade }

export function useSalvarCidade(unidadeId: string | undefined, opcoes?: OpcoesSalvar<VarsCidade>) {
  return useMutation({
    mutationFn: ({ cidId, ficha }: VarsCidade) =>
      api.put<RespostaSalvar>(`/unidades/${unidadeId}/contrato/${cidId}`, ficha),
    onSuccess: (dado, vars) => {
      conferirContrato(`/unidades/${unidadeId}/contrato/${vars.cidId}`, dado)
      opcoes?.onSalva?.(vars, dado)
    },
  })
}

type VarsEte = { eteId: string; ficha: FichaEte }

export function useSalvarEte(unidadeId: string | undefined, opcoes?: OpcoesSalvar<VarsEte>) {
  return useMutation({
    mutationFn: ({ eteId, ficha }: VarsEte) =>
      api.put<RespostaSalvar>(`/unidades/${unidadeId}/etes/${eteId}`, ficha),
    onSuccess: (dado, vars) => {
      conferirContrato(`/unidades/${unidadeId}/etes/${vars.eteId}`, dado)
      opcoes?.onSalva?.(vars, dado)
    },
  })
}

type VarsCts = { ctsId: string; ficha: FichaCts }

export function useSalvarCts(unidadeId: string | undefined, opcoes?: OpcoesSalvar<VarsCts>) {
  return useMutation({
    mutationFn: ({ ctsId, ficha }: VarsCts) =>
      api.put<RespostaSalvar>(`/unidades/${unidadeId}/cts/${ctsId}`, ficha),
    onSuccess: (dado, vars) => {
      conferirContrato(`/unidades/${unidadeId}/cts/${vars.ctsId}`, dado)
      opcoes?.onSalva?.(vars, dado)
    },
  })
}
