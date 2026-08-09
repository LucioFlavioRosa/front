import { useNavigate, useParams } from 'react-router-dom'
import { GroupCard } from '@/cadastro/components/GroupCard'
import { Carregando, ErroCarga } from '@/comum/components/Estado'
import { chipConferir, chipPendencias, type ChipStatus } from '@/cadastro/lib/chip'
import { useUnidade } from '@/comum/api/organizacao'
import { useApp } from '@/comum/state/AppContext'
import { useCadastro } from '@/cadastro/state/CadastroContext'
import type { Contadores } from '@/comum/domain/organizacao'
import styles from './Hub.module.css'

/**
 * Hub: 4 cards de grupo com pendencias ao vivo + card de importacao de Excel +
 * card de aviso de bloqueio da simulacao. Copy final do prototipo (linhas 904-914).
 */
const nf = new Intl.NumberFormat('pt-BR')

interface Pend {
  g2: number
  g3: number
  g4: number
  g5: number
}

interface GrupoDef {
  n: string
  slug: string
  titulo: string
  descricao: string
  origem: string
  linhas: (c: Contadores) => string
  chip: (p: Pend) => ChipStatus
}

const GRUPOS: GrupoDef[] = [
  {
    n: '01',
    slug: 'hierarquia',
    titulo: 'Hierarquia & Topologia',
    descricao:
      'Unidade, regional, superintendências, cidades, sistemas e o caminho de cada sub-bacia até a ETE. Confira o campo "escoa para" — é ele que libera a receita.',
    origem: 'Databricks — editável com confirmação',
    linhas: () => '4 tabelas + topologia',
    chip: () => chipConferir,
  },
  {
    n: '02',
    slug: 'contrato-metas',
    titulo: 'Contrato & Metas',
    descricao:
      'Fim da concessão, régua de cobertura, metas por ano e escala de paridade esgoto/água de cada cidade.',
    origem: 'você preenche',
    linhas: (c) => `${nf.format(c.cidades)} cidades · ${nf.format(c.metas)} metas`,
    chip: (p) => chipPendencias(p.g2),
  },
  {
    n: '03',
    slug: 'sub-bacias',
    titulo: 'Sub-bacias & Obras',
    descricao:
      'A base comercial já vem do Databricks. Você informa taxa de ligação, prazos, vazão nova, potencial e as obras de cada sub-bacia.',
    origem: 'Databricks + campos seus',
    linhas: (c) => `${nf.format(c.subBacias)} sub-bacias · ${nf.format(c.obras)} obras`,
    chip: (p) => chipPendencias(p.g3),
  },
  {
    n: '04',
    slug: 'etes',
    titulo: 'ETEs',
    descricao: 'Capacidade por módulo, custos, folga e restrições de cada estação de tratamento.',
    origem: 'você preenche',
    linhas: (c) => `${nf.format(c.etes)} ETEs`,
    chip: (p) => chipPendencias(p.g4),
  },
  {
    n: '05',
    slug: 'cts',
    titulo: 'CTS · Coletor de Tempo Seco',
    descricao:
      'A irmã da sub-bacia: pareada 1:1, opcional e esparsa. Mesmos dados operacionais, com 4 obras próprias — para comparar o custo de coletar em tempo seco à parte.',
    origem: 'Databricks + campos seus',
    linhas: (c) =>
      c.cts === 0
        ? 'nenhuma cadastrada'
        : `${nf.format(c.cts)} CTS · ${nf.format(c.ctsObras)} obras`,
    chip: (p) => chipPendencias(p.g5),
  },
]

export function Hub() {
  const { unidadeId } = useParams()
  const navigate = useNavigate()
  const { toast } = useApp()
  const unidQ = useUnidade(unidadeId)
  const unidade = unidQ.data
  const { seeded, hier, derivado, carregando, erro, erroBruto, recarregar, recarregando } =
    useCadastro()

  if (erro || unidQ.isError) {
    const detalhe = erro ?? (unidQ.error instanceof Error ? unidQ.error.message : undefined)
    return (
      <ErroCarga
        detalhe={detalhe}
        // 404 aqui é unidade fora do escopo do usuário, e não queda de conexão:
        // sem isto a tela dizia "a conexão com a base falhou" e oferecia tentar
        // de novo para sempre.
        erro={erroBruto ?? unidQ.error}
        tentando={recarregando || unidQ.isFetching}
        onRetry={() => {
          recarregar()
          void unidQ.refetch()
        }}
      />
    )
  }
  if (carregando || !unidade || !seeded || !hier) return <Carregando />

  const { g2, g3, g4, g5, pendTotal, counts } = derivado
  const liberada = pendTotal === 0

  return (
    <section>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.h1}>Dados da {unidade.nome}</h1>
          <p className={styles.sub}>
            {hier.unidReg.rnome} · o que veio do Databricks já está preenchido. Faltam{' '}
            <strong className={styles.faltam}>{nf.format(pendTotal)} campos</strong>.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {GRUPOS.map((g) => (
          <GroupCard
            key={g.n}
            n={g.n}
            titulo={g.titulo}
            descricao={g.descricao}
            origem={g.origem}
            linhas={g.linhas(counts)}
            chip={g.chip({ g2, g3, g4, g5 })}
            onClick={() => navigate(`/unidade/${unidadeId}/${g.slug}`)}
          />
        ))}
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.importCard}>
          <div className={styles.importIcon}>⇪</div>
          <div className={styles.importBody}>
            <div className={styles.importTitle}>Já preencheu na planilha Excel?</div>
            <div className={styles.importSub}>
              Envie o arquivo — a tela mostra o que será importado e aponta divergências antes de
              gravar.
            </div>
          </div>
          <button
            type="button"
            className={styles.importBtn}
            onClick={() =>
              toast('Upload de planilha: fluxo de importação com revisão (próxima etapa).')
            }
          >
            Importar planilha
          </button>
        </div>

        <div
          className={styles.aviso}
          style={
            liberada
              ? { background: 'var(--ok-bg)', borderColor: 'var(--ok-border-2)' }
              : { background: 'var(--pend-bg)', borderColor: 'var(--pend-border-2)' }
          }
        >
          <div
            className={styles.avisoTitulo}
            style={{ color: liberada ? 'var(--ok-text)' : 'var(--pend-text)' }}
          >
            {liberada ? '✓ Base completa' : 'Para liberar a simulação'}
          </div>
          <div
            className={styles.avisoTexto}
            style={{ color: liberada ? 'var(--ok-text-2)' : 'var(--pend-text-3)' }}
          >
            {liberada
              ? 'Todos os campos da unidade estão preenchidos. A tela de simulação está liberada.'
              : `${nf.format(pendTotal)} pendências. A tela de simulação fica bloqueada até zerar — clique num grupo para completar.`}
          </div>
          {/* Sem atalho para o historico daqui: o cadastro cuida de PREPARAR o
              dado, e resultado e outra area. Quem quer ver rodadas passa pelo
              portal, que e onde os tres caminhos convivem. Atalho cruzado entre
              areas embaralha a mesma escolha que o portal acabou de organizar. */}
        </div>
      </div>
    </section>
  )
}
