/**
 * Queries das telas de resultado.
 *
 * A decisao que molda este arquivo: RESULTADO DE RODADA E IMUTAVEL. Um `run_id`
 * congela na primeira publicacao bem-sucedida; reexecutar depois disso gera id
 * novo (CONTRATO.md 2.1). Nao e convencao: o contrato EXIGE que o backend recuse
 * (409) execucao sobre um `run_id` ja publicado, e e isso que torna o cache eterno
 * abaixo correto por construcao. Enquanto o backend nao existe, e uma promessa —
 * `src/contrato.test.ts` guarda os dois lados dela.
 *
 * Consequencias praticas:
 *   - `staleTime: Infinity` em tudo que e de uma rodada: uma vez lido, nunca mais
 *     refetch. Descer e subir a cascata fica instantaneo e nao castiga o backend.
 *   - Nao ha invalidacao a fazer, porque nao ha escrita que invalide.
 *   - A LISTA do historico e a excecao: ela muda quando alguem exclui uma rodada.
 *     So ela tem `staleTime` curto e so ela e invalidada.
 *
 * As chaves sao todas prefixadas por `['runs', runId]`, entao trocar de rodada no
 * header troca a subarvore inteira do cache sem tocar nas outras rodadas ja lidas.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resultados } from '@/resultado/api/endpoints'
import type { RunMeta, RunResumo } from '@/resultado/domain/resultado'

export const chavesResultado = {
  /** A lista do historico. Muda com exclusao — por isso nao e "para sempre". */
  runs: (filtro?: { unidadeId?: string; usuario?: string }) =>
    ['runs', 'lista', filtro?.unidadeId ?? '*', filtro?.usuario ?? '*'] as const,
  meta: (runId: string) => ['runs', runId, 'meta'] as const,
  painel: (runId: string) => ['runs', runId, 'painel'] as const,
  ebitda: (runId: string, cidadeId?: string) =>
    ['runs', runId, 'ebitda', cidadeId ?? 'unidade'] as const,
  cidades: (runId: string) => ['runs', runId, 'cidades'] as const,
  cidade: (runId: string, cidadeId: string) => ['runs', runId, 'cidades', cidadeId] as const,
  topologia: (runId: string, sistemaId: string) => ['runs', runId, 'sistemas', sistemaId] as const,
  subbacia: (runId: string, subId: string) => ['runs', runId, 'subbacias', subId] as const,
  obra: (runId: string, obraId: string) => ['runs', runId, 'obras', obraId] as const,
}

/** Opcoes de quem le uma rodada: leu uma vez, vale para sempre. */
const IMUTAVEL = { staleTime: Infinity, gcTime: Infinity } as const

export function useRuns(filtro?: { unidadeId?: string; usuario?: string }) {
  return useQuery({
    queryKey: chavesResultado.runs(filtro),
    queryFn: () => resultados.listar(filtro),
  })
}

export function useRunMeta(runId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.meta(runId ?? '—'),
    queryFn: () => resultados.meta(runId as string),
    enabled: !!runId,
    ...IMUTAVEL,
  })
}

export function usePainel(runId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.painel(runId ?? '—'),
    queryFn: () => resultados.painel(runId as string),
    enabled: !!runId,
    ...IMUTAVEL,
  })
}

export function useEbitda(runId: string | undefined, cidadeId?: string) {
  return useQuery({
    queryKey: chavesResultado.ebitda(runId ?? '—', cidadeId),
    queryFn: () => resultados.ebitda(runId as string, cidadeId),
    enabled: !!runId,
    ...IMUTAVEL,
  })
}

export function useCidades(runId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.cidades(runId ?? '—'),
    queryFn: () => resultados.cidades(runId as string),
    enabled: !!runId,
    ...IMUTAVEL,
  })
}

export function useCidade(runId: string | undefined, cidadeId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.cidade(runId ?? '—', cidadeId ?? '—'),
    queryFn: () => resultados.cidade(runId as string, cidadeId as string),
    enabled: !!runId && !!cidadeId,
    ...IMUTAVEL,
  })
}

export function useTopologia(runId: string | undefined, sistemaId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.topologia(runId ?? '—', sistemaId ?? '—'),
    queryFn: () => resultados.topologia(runId as string, sistemaId as string),
    enabled: !!runId && !!sistemaId,
    ...IMUTAVEL,
  })
}

export function useSubBacia(runId: string | undefined, subId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.subbacia(runId ?? '—', subId ?? '—'),
    queryFn: () => resultados.subbacia(runId as string, subId as string),
    enabled: !!runId && !!subId,
    ...IMUTAVEL,
  })
}

export function useObra(runId: string | undefined, obraId: string | undefined) {
  return useQuery({
    queryKey: chavesResultado.obra(runId ?? '—', obraId ?? '—'),
    queryFn: () => resultados.obra(runId as string, obraId as string),
    enabled: !!runId && !!obraId,
    ...IMUTAVEL,
  })
}

/**
 * Exclusao de rodada — a unica mutacao do pacote.
 *
 * O `onSuccess` fica NO NIVEL DO HOOK, e nao no `mutate(vars, {...})` da pagina:
 * e a mesma licao que o caminho de escrita do cadastro custou a aprender — o
 * callback por chamada nao roda quando o observer perde os listeners (o usuario
 * sai da tela antes da resposta), e a lista ficaria mostrando uma rodada que o
 * servidor ja apagou.
 */
export function useExcluirRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => resultados.excluir(runId),
    onSuccess: (_dados, runId) => {
      qc.invalidateQueries({ queryKey: ['runs', 'lista'] })
      // O cache daquela rodada nao serve mais para nada.
      qc.removeQueries({ queryKey: ['runs', runId] })
    },
  })
}

export type { RunMeta, RunResumo }
