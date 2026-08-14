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
import type { RunResumo } from '@/resultado/domain/resultado'

const chavesResultado = {
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

/**
 * Marca ou desmarca uma rodada como favorita.
 *
 * OTIMISTA, ao contrario do resto do pacote. A estrela e um clique que o usuario
 * repete varias vezes seguidas enquanto organiza a lista, e esperar o servidor a
 * cada uma faria a interface parecer emperrada. O risco e proporcional: se
 * falhar, o que se perde e uma marca, e o `onError` a devolve ao estado anterior.
 *
 * Compare com criar/remover CTS no cadastro, que sao PESSIMISTAS: la o otimismo
 * foi tentado e revertido, porque o rollback vivia no callback por chamada de
 * `mutate` — que o TanStack nao dispara quando o observer perde os listeners — e
 * ainda apagava o que o usuario digitasse durante o voo. Aqui o callback esta no
 * NIVEL DO HOOK, entao ele roda mesmo se a tela desmontar, e nao ha nada que o
 * usuario possa digitar em cima.
 */
export function useAlternarFavorita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, favorita }: { runId: string; favorita: boolean }) =>
      favorita ? resultados.favoritar(runId) : resultados.desfavoritar(runId),

    onMutate: async ({ runId, favorita }) => {
      // Cancela refetch em voo: uma resposta antiga chegando depois desfaria a
      // marca na tela, e o usuario veria a estrela piscar de volta sozinha.
      await qc.cancelQueries({ queryKey: ['runs', 'lista'] })
      const antes = qc.getQueriesData<RunResumo[]>({ queryKey: ['runs', 'lista'] })
      for (const [chave, lista] of antes) {
        if (!lista) continue
        qc.setQueryData(
          chave,
          lista.map((r) => (r.runId === runId ? { ...r, favorita } : r)),
        )
      }
      return { antes }
    },

    onError: (_e, _vars, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista)
    },

    // Reconcilia com o servidor no fim, dê certo ou não: a lista tem filtro por
    // favorita, e o recorte depende deste dado estar correto.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['runs', 'lista'] })
    },
  })
}

/**
 * Grava (ou apaga) o comentário de uma rodada.
 *
 * PESSIMISTA, ao contrário da favorita logo acima, e a diferença não é gosto: ali
 * o usuário clica uma estrela e não há nada em voo que ele possa digitar por
 * cima; aqui ele está DIGITANDO. Um update otimista revertido pelo `onError`
 * apagaria o texto que ele continuou escrevendo durante o voo — que foi
 * exatamente o defeito que fez criar/remover CTS voltarem a ser pessimistas no
 * cadastro. O texto só muda na tela depois que o servidor aceita.
 *
 * `onSuccess` no NÍVEL DO HOOK, e não no `mutate` da página: ele precisa rodar
 * mesmo que a pessoa feche o modal antes da resposta, senão a lista fica sem a
 * anotação que já foi gravada.
 */
export function useComentarDaRodada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, texto }: { runId: string; texto: string }) =>
      resultados.comentar(runId, texto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['runs', 'lista'] })
    },
  })
}

// `RunMeta`/`RunResumo` NAO sao re-exportados daqui: quem precisa dos tipos os
// importa de `@/resultado/domain/resultado`, que e onde eles sao definidos. Um
// re-export sem importador so cria um segundo caminho para a mesma coisa — e
// dois caminhos e como um deles envelhece sem ninguem notar.
