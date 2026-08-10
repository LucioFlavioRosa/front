/** Dominio do Grupo 04 (ETEs). Regras: prototipo linhas 819-825, 1104-1126. */
import type { Auditoria } from '@/cadastro/domain/auditoria'

import { num } from '@/cadastro/domain/subbacia'

export interface Ete extends Auditoria {
  id: string
  sub: string
  cidId: string
  nova: string // "Sim" | "Nao"
  capMod: string
  capexMod: string
  opexMod: string
  tExec: string
  capNom: string
  vazOp: string
  terreno: string
  modulos: string
  wacc: string
}

export interface EtesPayload {
  etes: Ete[]
}

/** Campo editavel da ETE: [rotulo, chave, dictKey, unidade, placeholder, ajuda]. */
export type EteCampo = [string, keyof Ete, string, string, string, string]

// prettier-ignore
const ETE_DEFS: EteCampo[] = [
  ['Capacidade por módulo', 'capMod', 'capacidade_por_modulo', 'L/s', 'vazão', 'Vazão que cada módulo trata. Define quantos módulos a vazão conectada exige.'],
  ['CAPEX por módulo', 'capexMod', 'capex_por_modulo', 'R$', 'R$', 'Investimento de um módulo — o custo da expansão.'],
  ['OPEX por módulo', 'opexMod', 'opex_por_modulo', 'R$/ano', 'R$/ano', 'Custo anual de operar um módulo.'],
  ['Duração da construção', 'tExec', 'tempo_de_execucao', 'meses', 'meses', 'Quanto dura a construção de um módulo. Mesma lógica das demais obras.'],
  ['Capacidade nominal atual', 'capNom', 'capacidade_nominal_atual', 'L/s', 'vazão', 'Capacidade instalada hoje. Com a vazão de operação, define a folga.'],
  ['Vazão de operação atual', 'vazOp', 'vazao_de_operacao_atual', 'L/s', 'vazão', 'Vazão tratada hoje.'],
  ['CAPEX do terreno', 'terreno', 'capex_terreno', 'R$', 'R$', 'Só para ETE nova — entra no pacote único terreno + módulos.'],
  ['Nº de módulos (ETE nova)', 'modulos', 'modulos', 'un', 'qtde', 'Define a capacidade total do pacote da ETE nova (teto de vazão).'],
  ['WACC da ETE', 'wacc', 'wacc', 'fração', '0,091', 'Desconta CAPEX/OPEX e entra rateado por vazão na taxa da receita das sub-bacias.'],
]

const BASE_KEYS: (keyof Ete)[] = ['capMod', 'capexMod', 'opexMod', 'tExec', 'capNom', 'vazOp']
// `wacc` NAO entra: vazio aqui significa "usa o WACC medio da unidade", que e
// resposta e nao silencio. Sao 598 das 997 ETEs da planilha sem wacc proprio, e
// o motor roda 2 de cada 3 obras com o herdado — cobrar isso travava a simulacao
// por um default que funciona. O backend dizia o mesmo no comentario dele e
// cobrava assim mesmo; os dois lados foram corrigidos juntos.
const NOVA_KEYS: (keyof Ete)[] = ['terreno', 'modulos']

export const isNova = (e: Ete) => e.nova === 'Sim'

/** Campos visiveis: terreno/modulos so aparecem quando a ETE e nova. */
export function camposVisiveis(e: Ete): EteCampo[] {
  return ETE_DEFS.filter((d) => isNova(e) || (d[1] !== 'terreno' && d[1] !== 'modulos'))
}

/** Pendencias da ETE: campos-base vazios (+ terreno/modulos se nova). */
export function etePend(e: Ete): number {
  let n = 0
  BASE_KEYS.forEach((k) => {
    if (String(e[k]).trim() === '') n++
  })
  if (isNova(e))
    NOVA_KEYS.forEach((k) => {
      if (String(e[k]).trim() === '') n++
    })
  return n
}

const FMT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Capacidade ociosa (ƒ) = capacidade nominal − vazão de operação. */
export function capacidadeOciosa(e: Ete): string {
  return FMT.format((num(e.capNom) ?? 0) - (num(e.vazOp) ?? 0))
}
