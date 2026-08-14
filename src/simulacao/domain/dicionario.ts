/**
 * Dicionario dos PARAMETROS DA RODADA — o equivalente, aqui, ao dicionario de
 * dados do cadastro.
 *
 * A tela de nova simulacao dispara algo que vai existir para sempre no historico,
 * e cada controle muda o plano de investimento de um jeito que nao e obvio pelo
 * rotulo. O cadastro ja resolveu esse problema com o "?" e um painel de verbete;
 * isto e a mesma coisa, do outro lado do produto.
 *
 * HA UM VERBETE PARA CADA CONTROLE DA TELA, e so para eles: o que a rodada nao
 * escolhe nao aparece aqui, porque o painel so abre por chave — verbete sem "?"
 * que o abra e texto que ninguem le. O que o backend fixa esta documentado onde
 * e fixado, em `app/dominio/parametros.py`.
 */
import type { Verbete } from '@/comum/domain/dicionario'

/** Quem decide o valor. Espelha o selo de origem do cadastro. */
const VOCE = 'você escolhe'

export const DICT_SIMULACAO: Record<string, Verbete> = {
  // ------------------------------------------------------------- 01 escopo
  UNIDADE: {
    rotulo: 'Unidade',
    tec: 'UNIDADE',
    origem: VOCE,
    tipo: 'unidade do cadastro',
    oque: 'A unidade cujo cadastro será otimizado. Cada rodada olha uma só.',
    porque:
      'É o recorte de tudo: cidades, sistemas, sub-bacias e obras vêm dela. O porte aparece no resumo, ao lado do nome.',
    exemplo: 'Unidade Leste',
  },
  ROTULO: {
    rotulo: 'Nome da simulação',
    tec: 'ROTULO',
    origem: VOCE,
    tipo: 'texto livre',
    oque: 'O nome que identifica esta rodada no histórico.',
    porque:
      'Duas rodadas da mesma unidade só se distinguem pelo nome e pelos parâmetros. Sem ele, o histórico vira uma lista de identificadores.',
    exemplo: 'Leste — janela 8a, foco cobertura',
  },

  // ---------------------------------------------------------- 02 orçamento
  ORCAMENTO: {
    rotulo: 'Orçamento de CAPEX',
    tec: 'ORCAMENTO',
    origem: VOCE,
    tipo: 'R$ por ano',
    oque: 'Quanto pode ser investido em cada ano-calendário.',
    porque:
      'É o teto anual que o otimizador respeita. A JANELA DE CAPEX é derivada dele — os anos com verba —, e não digitada: duas fontes para a mesma verdade divergiriam no primeiro ano zerado.',
    exemplo: '2027: 60 Mi · 2028: 50 Mi',
  },
  HORIZONTE_CAPEX: {
    rotulo: 'Horizonte',
    tec: 'HORIZONTE_CAPEX',
    origem: VOCE,
    tipo: 'anos',
    oque: 'Por quantos anos a verba única se repete.',
    porque:
      'Só existe no modo "valor único": ele monta um cronograma de N anos com a mesma verba em cada um. No modo por ano, quem define a janela é o próprio cronograma.',
    exemplo: '8',
  },
  DATA_INICIO: {
    rotulo: 'Data de início',
    tec: 'DATA_INICIO',
    origem: VOCE,
    tipo: 'AAAA-MM',
    oque: 'O mês a partir do qual as obras podem começar.',
    porque:
      'Nada inicia antes dela, e o primeiro ano-calendário fica parcial. Vazia = janeiro do ano-base do cadastro.',
    exemplo: '2027-03',
  },

  // ----------------------------------------------------------- 03 objetivo
  FOCO_COBERTURA: {
    rotulo: 'Foco em cobertura',
    tec: 'FOCO_COBERTURA',
    origem: VOCE,
    tipo: '0 · 0,5 · 1',
    oque: 'O que o otimizador prioriza quando VPL e cobertura entram em conflito.',
    porque:
      'Só VPL (0) maximiza retorno e ignora a meta. Cobertura primeiro (1) prioriza cumprir o contrato. Equilíbrio (0,5) pondera os dois.',
    exemplo: 'Cobertura primeiro',
  },
  PENALIDADE_COBERTURA: {
    rotulo: 'Penalidade',
    tec: 'PENALIDADE_COBERTURA',
    origem: VOCE,
    tipo: 'meta+cobertura · meta',
    oque: 'Como o descumprimento é cobrado na função objetivo.',
    porque:
      '"meta+cobertura" penaliza não bater a meta E ficar abaixo do possível. "meta" penaliza só o descumprimento do ano.',
    exemplo: 'meta + cobertura',
  },

  // ------------------------------------------------------------- 04 receita
  BASE_RECEITA: {
    rotulo: 'Base de receita',
    tec: 'BASE_RECEITA',
    origem: VOCE,
    tipo: 'arrecadada · faturada',
    oque: 'Qual receita alimenta o ticket da simulação.',
    porque:
      'Arrecadada é o que de fato entrou — já reflete inadimplência. Faturada é o bruto. O ticket é a receita escolhida ÷ ligações atuais, então a escolha muda o VPL de toda a rodada.',
    exemplo: 'Arrecadada',
  },
  CURVA_ADOCAO: {
    rotulo: 'Curva de adesão',
    tec: 'CURVA_ADOCAO',
    origem: VOCE,
    tipo: 'scurve · linear',
    oque: 'Como as ligações novas se conectam ao longo do tempo depois da obra.',
    porque:
      'Curva S concentra a adesão no meio do período; linear distribui igual. Afeta quando a receita aparece, e portanto o VPL — não quanto ela é no total.',
    exemplo: 'Curva S',
  },

  // ------------------------------------------------- 05 o que entra no plano
  USAR_CTS: {
    rotulo: 'Usar CTS',
    tec: 'USAR_CTS',
    origem: VOCE,
    tipo: 'sim · não',
    oque: 'Se o coletor de tempo seco entra como estrutura própria na otimização.',
    porque:
      'Sim: a CTS tem obras, receita e cobertura próprias. Não: ligações, economias, população, receita e vazão dela são somadas à sub-bacia irmã. Só faz efeito se a base tiver CTS cadastrada.',
    exemplo: 'sim',
  },
  COBERTURA_SO_RESIDENCIAL: {
    rotulo: 'Medir a meta só em ligações residenciais',
    tec: 'COBERTURA_SO_RESIDENCIAL',
    origem: VOCE,
    tipo: 'sim · não',
    oque: 'Se a cobertura é medida contando só ligações e economias residenciais.',
    porque:
      'O RECORTE ACABA NA COBERTURA. Receita, VPL, vazão e CAPEX usam o total nos dois casos — quem paga a conta é a ligação, seja de casa ou de fábrica, e a indústria manda esgoto que a ETE precisa tratar. Sim: universo e base atendida saem das colunas residenciais da base comercial. Não: saem dos totais.',
    exemplo: 'não',
  },
}
