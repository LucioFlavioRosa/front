/**
 * Dicionario dos PARAMETROS DA RODADA — o equivalente, aqui, ao dicionario de
 * dados do cadastro.
 *
 * A tela de nova simulacao dispara algo que vai existir para sempre no historico,
 * e cada controle muda o plano de investimento de um jeito que nao e obvio pelo
 * rotulo. O cadastro ja resolveu esse problema com o "?" e um painel de verbete;
 * isto e a mesma coisa, do outro lado do produto.
 *
 * TAMBEM EXPLICA O QUE NAO SE ESCOLHE. Varios parametros sairam da tela nesta
 * versao (metas, ETE, prioridade por cidade, tempo de solver, anos extra), e a
 * pergunta "por que nao posso mexer nisso?" e tao legitima quanto "o que isto
 * faz?". Sem verbete, a resposta so existiria no commit.
 */
import type { Verbete } from '@/comum/domain/dicionario'

/** Quem decide o valor. Espelha o selo de origem do cadastro. */
const VOCE = 'você escolhe'
const FIXO = 'fixo nesta versão'

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
      'Só VPL (0) maximiza retorno e ignora a meta. Cobertura primeiro (1) prioriza cumprir o contrato. Equilíbrio (0,5) pondera os dois. Eram três escolhas travadas de propósito: o campo livre entre 0 e 1 precisava de um rótulo para ser entendido, e isso é sinal de que o número não comunicava.',
    exemplo: 'Cobertura primeiro',
  },
  PENALIDADE_COBERTURA: {
    rotulo: 'Penalidade',
    tec: 'PENALIDADE_COBERTURA',
    origem: VOCE,
    tipo: 'meta+cobertura · meta',
    oque: 'Como o descumprimento é cobrado na função objetivo.',
    porque:
      '"meta+cobertura" penaliza não bater a meta E ficar abaixo do possível. "meta" penaliza só o descumprimento do ano. Havia um terceiro modo, por ligação não atendida; saiu porque a meta é sempre a referência.',
    exemplo: 'meta + cobertura',
  },
  METAS_COBERTURA: {
    rotulo: 'Metas de cobertura',
    tec: 'METAS_COBERTURA',
    origem: FIXO,
    tipo: 'sempre as do cadastro',
    oque: 'As metas contratuais vêm sempre da base — não há o que escolher aqui.',
    porque:
      'O único descarte legítimo é por ANO: meta fora da janela de CAPEX não é cobrada. Com CAPEX até 2031, a meta de 2030 conta e a de 2032 não. Houve uma opção de "ignorar as metas": ela nunca funcionou e, quando passou a funcionar, produzia rodada sem meta nenhuma — que a regra não admite.',
    exemplo: 'do cadastro',
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
  INCLUIR_INDUSTRIAL: {
    rotulo: 'Incluir demanda industrial',
    tec: 'INCLUIR_INDUSTRIAL',
    origem: VOCE,
    tipo: 'sim · não',
    oque: 'Se a parcela industrial entra na conta de ligações, receita e vazão.',
    porque:
      'As colunas normais JÁ SÃO o total (residencial + industrial). Sim: usa o total como está. Não: subtrai a parcela industrial — residencial = total − industrial. O CAPEX não muda nos dois casos.',
    exemplo: 'sim',
  },
  ETE_FASEADA: {
    rotulo: 'Tratamento da ETE',
    tec: 'ETE_FASEADA',
    origem: FIXO,
    tipo: 'decidido pela ficha',
    oque: 'Cada ETE entra no plano conforme o cadastro dela, não conforme a rodada.',
    porque:
      'ETE com terreno e número de módulos informados é NOVA: entra como pacote único, sem faseamento. A que já existe é expandida em módulos, conforme a vazão passa da capacidade ociosa. Havia um interruptor para desligar o tratamento por módulos, e o modo desligado tratava a expansão pior.',
    exemplo: 'nova em pacote · existente por módulos',
  },

  // ------------------------------------------------------- fixos, sem controle
  ANOS_EXTRA_CONCLUSAO: {
    rotulo: 'Anos extra para concluir',
    tec: 'ANOS_EXTRA_CONCLUSAO',
    origem: FIXO,
    tipo: '0 anos',
    oque: 'A obra inicia e conclui dentro da janela de CAPEX.',
    porque:
      'Com valor maior que zero, uma obra iniciada na janela poderia concluir depois dela, com o "rabo" custeado pela sobra acumulada. A decisão desta versão é não ter rabo.',
    exemplo: '0',
  },
  PESO_CIDADE: {
    rotulo: 'Prioridade por cidade',
    tec: 'PESO_CIDADE',
    origem: FIXO,
    tipo: 'todas com peso 1',
    oque: 'Nenhuma cidade tem prioridade sobre outra.',
    porque:
      'O peso multiplica a contribuição de cada cidade no objetivo. Sem prioridade declarada, o multiplicador é 1 para todas — que é exatamente o padrão desta versão.',
    exemplo: '1 para todas',
  },
  MAX_TIME_S: {
    rotulo: 'Tempo do solver',
    tec: 'MAX_TIME_S',
    origem: FIXO,
    tipo: '1000 segundos',
    oque: 'Quanto tempo o solver tem para procurar a melhor solução.',
    porque:
      'É afinação de execução, não decisão de negócio — e o efeito só aparece depois de rodar. Tempo curto demais numa unidade grande faz o solver devolver a melhor solução que achou até ali, ou nenhuma.',
    exemplo: '1000',
  },
}
