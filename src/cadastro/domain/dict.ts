/**
 * Dicionario de dados (aba "02 Dicionario de Dados" da planilha, exposto no
 * prototipo como objeto DICT). Copy FINAL — extraido do Cadastro de Dados.dc.html
 * (linhas 834-851). Chave = nome tecnico da coluna.
 *
 * O TIPO e o selo de origem vivem em `comum/domain/dicionario.ts`: a simulacao
 * tem o dicionario dela, e o painel que exibe os dois e um so.
 */
import type { Verbete } from '@/comum/domain/dicionario'

export type { Verbete }
export const DICT: Record<string, Verbete> = {
  preco_por_ligacao: {
    rotulo: 'Taxa de ligação',
    tec: 'preco_por_ligacao',
    origem: 'você preenche',
    tipo: 'R$ por ligação (uma vez)',
    oque: 'Taxa cobrada uma única vez ao conectar o cliente, sempre POR LIGAÇÃO.',
    porque: 'Vira receita indireta no ano da conexão.',
    exemplo: '784',
  },
  tempo_arrecadacao: {
    rotulo: 'Início da arrecadação',
    tec: 'tempo_arrecadacao',
    origem: 'você preenche',
    tipo: 'meses',
    oque: 'Tempo entre a obra ficar pronta e a sub-bacia começar a faturar.',
    porque: 'Atrasa o início da receita (lag) no cálculo do VPL.',
    exemplo: '6',
  },
  tempo_ramp_up: {
    rotulo: 'Rampa de adesão',
    tec: 'tempo_ramp_up',
    origem: 'você preenche',
    tipo: 'meses',
    oque: 'Tempo até a adesão plena dos clientes após o início do faturamento.',
    porque:
      'A receita cresce em curva S (lenta–pico–lenta) até o pleno neste prazo; o OPEX sobe no mesmo período.',
    exemplo: '12',
  },
  vazao_contribuicao: {
    rotulo: 'Vazão nova',
    tec: 'vazao_contribuicao',
    origem: 'você preenche',
    tipo: 'vazão · mesma unidade da ETE',
    oque: 'A vazão NOVA que a sub-bacia passa a mandar quando conectada — não a vazão já existente. É o TOTAL: residencial mais industrial.',
    porque:
      'Dimensiona os módulos da ETE e é o peso do rateio das obras compartilhadas. Errar aqui distorce quem paga o quê. É sempre o total, inclusive na rodada que mede a meta só em residenciais: indústria contribui com esgoto mesmo quando não conta para a meta, e descontá-la subdimensionaria a estação.',
    exemplo: '165,9',
  },
  potencial_crescimento: {
    rotulo: 'Potencial de crescimento',
    tec: 'potencial_crescimento',
    origem: 'você preenche',
    tipo: 'fator ≥ 1,0 · default 1,0',
    oque: 'Multiplicador do universo da sub-bacia. 1,0 = sem crescimento; 1,5 = universo 50% maior.',
    porque:
      'Amplia o denominador da meta de cobertura E as novas das obras — ligações, economias e população passam a ser universo × potencial − atuais. Antes só o denominador crescia: a meta subia e o meio de alcançá-la, não.',
    exemplo: '1,0',
  },
  quantidade: {
    rotulo: 'Quantidade',
    tec: 'quantidade',
    origem: 'você preenche',
    tipo: 'número, na unidade da obra',
    oque: 'Quanto será construído do componente (ex.: 2.472 m de rede, 38 ligações).',
    porque: 'CAPEX = quantidade × preço unitário. Dá rastreabilidade ao investimento.',
    exemplo: '2.472',
  },
  opex: {
    rotulo: 'OPEX',
    tec: 'opex',
    origem: 'você preenche',
    tipo: 'R$ por ano',
    oque: 'Custo de operar a obra, por ano, depois de pronta. Informe o valor MÁXIMO (todas as ligações faturando).',
    porque:
      'Obra ociosa não gera OPEX; a operação sobe de forma côncava até o máximo no tempo de rampa.',
    exemplo: '49.847',
  },
  tempo_predecessoras: {
    rotulo: 'Após predecessoras',
    tec: 'tempo_predecessoras',
    origem: 'você preenche',
    tipo: 'meses',
    oque: 'Espera entre as obras que vêm antes ficarem prontas e esta poder começar.',
    porque:
      'É assim que a sequência é montada: a simulação escolhe o ano de cada obra, mas respeita a ordem física. 0 = pode começar junto.',
    exemplo: '4',
  },
  tempo_de_execucao: {
    rotulo: 'Tempo de execução',
    tec: 'tempo_de_execucao',
    origem: 'você preenche',
    tipo: 'meses',
    oque: 'Quanto dura a construção desta obra, do início à entrega.',
    porque: 'Define quando a obra passa a atender e a gerar receita.',
    exemplo: '9',
  },
  obra_obrigatoria_ano: {
    rotulo: 'Obrigatória em',
    tec: 'obra_obrigatoria_ano',
    origem: 'você preenche · sempre com valor',
    tipo: '0 · -1 · ano (AAAA)',
    oque: '0 = a obra não é obrigatória, a simulação decide se entra. -1 = é obrigatória, mas em qualquer ano — a simulação escolhe quando. AAAA = é obrigatória naquele ano exato.',
    porque:
      'Amarra compromisso já assumido (TAC, licença, ordem de serviço). Com 0 a obra concorre pelo retorno como as outras; com -1 ela entra em algum momento; com o ano, a simulação perde a escolha.',
    exemplo: '2027',
  },
  obra_proibida_ate: {
    rotulo: 'Proibida até',
    tec: 'obra_proibida_ate',
    origem: 'você preenche · sempre com valor',
    tipo: '0 · ano (AAAA)',
    oque: '0 = sem impedimento. AAAA = a obra não pode COMEÇAR até esse ano.',
    porque:
      'Trava obra que depende de licença, desapropriação ou de outra frente. A simulação só pode começá-la depois do ano informado.',
    exemplo: '2026',
  },
  wacc: {
    rotulo: 'WACC da obra',
    tec: 'wacc',
    origem: 'você preenche · opcional',
    tipo: 'fração (0 a 1)',
    oque: 'Custo de capital do componente, quando há financiamento nominalmente atrelado.',
    porque:
      'Desconta CAPEX e OPEX da obra. Vazio = usa o WACC médio da unidade (Operações Financeiras).',
    exemplo: '0,091',
  },
  data_fim_concessao: {
    rotulo: 'Fim da concessão',
    tec: 'data_fim_concessao',
    origem: 'você preenche',
    tipo: 'ano (AAAA)',
    oque: 'Ano-calendário do fim da concessão da cidade.',
    porque: 'Define até quando a receita entra no VPL. Depois disso, nada é contado.',
    exemplo: '2045',
  },
  unidade_cobertura: {
    rotulo: 'Cobertura medida em',
    tec: 'unidade_cobertura',
    origem: 'você preenche · default ligações',
    tipo: 'ligações | economias | população',
    oque: 'A régua em que a cobertura da cidade é medida.',
    porque:
      'Vale para a verificação da META e para a faixa de PARIDADE. A receita continua sempre por ligação.',
    exemplo: 'ligações',
  },
  // ─── Recorte residencial ──────────────────────────────────────────────────
  // Os quatro verbetes repetem a mesma regra de propósito: ela é a fonte de dois
  // erros clássicos — somar residencial ao total, e achar que o recorte muda a
  // receita. Quem abre um deles pode não abrir os outros.
  universo_ligacoes_residencial: {
    rotulo: 'Ligações residenciais — universo',
    tec: 'universo_ligacoes_residencial',
    origem: 'Databricks 🔒 · corrigível com override',
    tipo: 'ligações · parcela já contida no total',
    oque: 'Quantas ligações do universo são residenciais. NÃO é um número a somar: `universo_ligacoes` já é o total (residencial + industrial), e esta coluna diz quanto daquele total é residência.',
    porque:
      'A rodada de simulação escolhe se a META é medida só em ligações residenciais. Quando é, este número vira o denominador da cobertura no lugar do total. Receita, VPL e vazão seguem no total em qualquer caso — quem paga a conta é a ligação, seja de casa ou de fábrica.',
    exemplo: '920 (de um universo de 1.000)',
  },
  ligacoes_atuais_residencial: {
    rotulo: 'Ligações residenciais atuais',
    tec: 'ligacoes_atuais_residencial',
    origem: 'Databricks 🔒 · corrigível com override',
    tipo: 'ligações · parcela já contida no total',
    oque: 'Quantas das ligações já atendidas hoje são residenciais. Parcela de `ligacoes_atuais`, não um acréscimo a ele.',
    porque:
      'É a base de partida da meta quando a rodada mede só residencial. As duas pontas da fração precisam vir do mesmo recorte: medir o atendido no total contra um universo residencial faria a cobertura nascer inflada.',
    exemplo: '1.290 (de 1.318 atuais)',
  },
  universo_economias_residencial: {
    rotulo: 'Economias residenciais — universo',
    tec: 'universo_economias_residencial',
    origem: 'Databricks 🔒 · corrigível com override',
    tipo: 'economias · parcela já contida no total',
    oque: 'Quantas economias do universo são residenciais. Uma ligação pode ter várias economias — por isso o número não acompanha o de ligações.',
    porque:
      'Só entra em cidade que mede a meta em ECONOMIAS. Nas que medem em ligações ela não é usada, e nas que medem em população também não: indústria não mora, então o universo de população já é residencial.',
    exemplo: '9.441 (de 9.642)',
  },
  economias_atuais_residencial: {
    rotulo: 'Economias residenciais atuais',
    tec: 'economias_atuais_residencial',
    origem: 'Databricks 🔒 · corrigível com override',
    tipo: 'economias · parcela já contida no total',
    oque: 'Quantas das economias já atendidas são residenciais. Parcela de `economias_atuais`.',
    porque:
      'Fecha o par com o universo residencial de economias. É o que permite a cidade que mede em economias ter uma meta residencial coerente dos dois lados.',
    exemplo: '3.869 (de 3.953)',
  },

  universo_populacao: {
    rotulo: 'População — universo',
    tec: 'universo_populacao',
    origem: 'você preenche · só quando a cidade mede por população',
    tipo: 'habitantes',
    oque: 'Toda a população da área da sub-bacia, atendida ou não por esgoto.',
    porque:
      'É o denominador da meta quando a cidade mede cobertura por população. Sem ele não dá para verificar o percentual contratado.',
    exemplo: '1.267',
  },
  populacao_atual: {
    rotulo: 'População atendida hoje',
    tec: 'populacao_atual',
    origem: 'você preenche · só quando a cidade mede por população',
    tipo: 'habitantes',
    oque: 'População que já tem coleta de esgoto, antes das obras deste plano.',
    porque:
      'É o numerador de partida da meta. A diferença para o universo é a população que as obras precisam atender.',
    exemplo: '406',
  },
  cobertura_pct: {
    rotulo: 'Cobertura %',
    tec: 'cobertura_pct',
    origem: 'você preenche',
    tipo: '% (0 a 100)',
    oque: 'Percentual do universo que deve estar atendido naquele ano.',
    porque:
      'O alvo em quantidade = % × universo, medido na régua da cidade. Metas fora do horizonte de CAPEX são ignoradas.',
    exemplo: '48',
  },
  paridade: {
    rotulo: 'Paridade',
    tec: 'paridade',
    origem: 'você preenche',
    tipo: 'fração · tipicamente 0,8 a 1,0',
    oque: 'Quanto a tarifa de esgoto representa da tarifa de água naquela faixa de cobertura.',
    porque:
      'tarifa_esgoto = ticket (água) × paridade. Quando a cobertura sobe de faixa, o reajuste vale também para a base existente.',
    exemplo: '0,80 / 0,85 / … / 1,00',
  },
  componente_sistema_id_jusante: {
    rotulo: 'Escoa para',
    tec: 'componente_sistema_id_jusante',
    origem: 'Databricks 🔒',
    tipo: 'texto (código)',
    oque: 'Para ONDE esta sub-bacia escoa: outra sub-bacia ou a ETE.',
    porque:
      'COLUNA MAIS CRÍTICA DA BASE. Define o caminho até a ETE e quais obras liberam a receita. Um erro aqui libera receita sem infraestrutura.',
    exemplo: 'e1',
  },
  capacidade_por_modulo: {
    rotulo: 'Capacidade por módulo',
    tec: 'capacidade_por_modulo',
    origem: 'você preenche',
    tipo: 'vazão',
    oque: 'Vazão que cada módulo da ETE trata.',
    porque: 'Define quantos módulos são necessários para a vazão conectada.',
    exemplo: '49',
  },
  capex_terreno: {
    rotulo: 'CAPEX do terreno',
    tec: 'capex_terreno',
    origem: 'você preenche · só ETE nova',
    tipo: 'R$',
    oque: 'Custo do terreno da ETE nova.',
    porque: 'ETE nova é um pacote único: terreno + módulos.',
    exemplo: '912.405',
  },
  modulos: {
    rotulo: 'Nº de módulos',
    tec: 'modulos',
    origem: 'você preenche · só ETE nova',
    tipo: 'quantidade',
    oque: 'Número de módulos da ETE nova.',
    porque: 'Define a capacidade total do pacote (teto de vazão).',
    exemplo: '4',
  },
}

/** Cor do chip de origem no painel: Databricks = cyan, usuario = ambar. */
