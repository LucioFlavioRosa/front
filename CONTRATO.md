# Contrato da API — Resultados e Nova Simulação

Este documento é para quem vai **escrever o backend**. Ele descreve o que o
frontend chama hoje, com que formato espera a resposta e — mais importante — as
poucas garantias sem as quais a tela mente para o usuário.

> **O contrato do CADASTRO não está aqui.** Ele já existe em
> [`DEPLOY.md`](DEPLOY.md) §3 (leitura das fichas, PUT por ficha, trilha de
> override, 409). Este documento cobre as duas áreas novas: **resultados**
> (leitura pura de uma rodada) e **simulação** (o disparo da rodada).

O frontend inteiro roda hoje contra mocks (MSW). Cada endpoint abaixo tem um
handler em `src/mocks/handlersResultado.ts` e `src/mocks/handlersSimulacao.ts` —
eles são a referência executável deste documento, e os testes os exercitam. Se
uma dúvida sobrar depois de ler aqui, o mock responde.

---

## 1. Convenções

| Assunto      | Regra                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Base         | Tudo sob `/api` (configurável em runtime — ver `DEPLOY.md` §1)         |
| Formato      | JSON, `Content-Type: application/json`. Corpo vazio só em 204          |
| Autenticação | `Authorization: Bearer <token>` quando houver SSO (ver `DEPLOY.md` §4) |
| Dinheiro     | **Reais**, `number`, sem formatação. A tela formata em pt-BR           |
| Percentual   | Campos com sufixo `Pct` vão de **0 a 100** (`77.6`), não de 0 a 1      |
| Fração       | `fracaoRateio` e `focoCobertura` vão de **0 a 1**                      |
| Vazão        | L/s, `number`                                                          |
| Data         | ISO 8601 (`2026-08-04T14:32:00-03:00`); mês isolado como `2026-06`     |
| Ausência     | `null` explícito. **Nunca 0 no lugar de "não existe"** — ver §2.3      |

### 1.1 Erros

O client (`src/api/client.ts`) distingue três famílias, e a UI reage diferente em
cada uma:

| Status        | Significado para a tela                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `401` / `403` | Sessão inválida — dispara o fluxo de re-login                            |
| `400` / `422` | Conteúdo recusado. **Mande `{ "erro": "mensagem" }`** — ela é exibida    |
| `409`         | Conflito (usado no cadastro; ver `DEPLOY.md`)                            |
| `404`         | Recurso inexistente. A tela mostra o estado de erro com "Tentar de novo" |
| `5xx`         | Idem 404, sem detalhe técnico ao usuário                                 |

Uma resposta 2xx que **não** seja JSON válido é tratada como erro. Isso é
proposital: proxy devolvendo HTML já quebrou este app antes, e falhar cedo é
melhor que um `undefined` aparecendo três telas adiante.

---

## 2. As três garantias que sustentam o front

Estas não são preferências de implementação. Se qualquer uma for quebrada, a
tela passa a mostrar número errado **sem nenhum sinal de erro** — que é o pior
modo de falha possível num app de decisão de investimento.

### 2.1 Um `run_id` publicado é IMUTÁVEL

O frontend cacheia tudo que pertence a uma rodada com `staleTime: Infinity`: lido
uma vez, nunca mais refetch. Isso torna a navegação pela cascata instantânea e
poupa o backend, mas **assume que o dado daquele `run_id` não muda**.

Se o backend republicar o mesmo `run_id` com resultado diferente, quem já abriu a
rodada continuará vendo o resultado antigo até fechar a aba.

Duas saídas aceitáveis:

- **honrar a imutabilidade** — reprocessar gera um `run_id` novo; ou
- **versionar** — acrescentar `versao` (ou `ETag`) em `/runs/{id}/meta`, e a gente
  passa a incluí-lo na chave de cache.

A primeira é a preferida, e é a que o job de produção já pratica: ele republica
apagando e regravando **o mesmo** `run_id`. Ou seja, hoje o backend violaria esta
garantia num reprocessamento — vale decidir isto antes do go-live.

### 2.2 Os totais já vêm reconciliados

**O front não recomputa nada.** Ele não soma as parcelas da cascata para conferir
o VPL, não soma o CAPEX por ano para conferir o total, não soma as frações de
rateio. Isso é decisão consciente: recalcular criaria uma segunda opinião sobre o
mesmo número, que discordaria da primeira por arredondamento e apareceria na tela
como "99,9%" num app que promete precisão.

O que se espera fechar (é o que o portão de qualidade da rodada já checa):

- soma das parcelas da cascata = VPL, em cada nível (global, cidade, sub-bacia);
- soma dos VPL por cidade = VPL do plano;
- CAPEX de `run_mes` = `run_ano` = `run_meta`;
- frações de rateio somam 1 por obra (desvio < 1e-6).

### 2.3 `null` significa "não existe", e nunca 0

O caso que motivou a regra: **ocupação de uma ETE com capacidade 0**. A tela
mostra `—`, não `0%` — porque "0%" afirma que a ETE está vazia, quando o fato é
que a conta não existe. Mandar `0` aqui faria a tela afirmar algo falso.

Onde isso vale explicitamente:

| Campo                          | `null` significa                          |
| ------------------------------ | ----------------------------------------- |
| `EteTopologia.ocupacaoPct`     | capacidade é 0 — a divisão não existe     |
| `AnoFinanceiro.tetoCapex`      | ano fora da janela de CAPEX               |
| `EbitdaAno.margemPct`          | não houve receita no ano                  |
| `RunResumo.metricas` (ausente) | rodada `INFEASIBLE` — não houve plano     |
| `ComponenteNo.obraId`          | não há ficha de obra para esse componente |
| `Explicacao.elo`               | nada travando (a sub-bacia fatura)        |

---

## 3. Resultados

Onze endpoints, todos **somente leitura**, exceto o `DELETE`. Tudo é por
`run_id`; a unidade **não** entra na URL porque uma rodada pertence a exatamente
uma unidade — o `run_id` já determina o recorte.

### 3.1 `GET /runs` — histórico de simulações

Query opcional: `unidade`, `usuario`.

```jsonc
[
  {
    "runId": "run_2026_0814",
    "nome": "Litoral 1 — janela 8a, foco cobertura",
    "unidadeId": "u1",
    "unidadeNome": "Litoral 1",
    "dataHora": "2026-08-04T14:32:00-03:00",
    "autor": "lucio.rosa",
    "duracaoS": 274, // segundos de solver
    "status": "OPTIMAL", // OPTIMAL | FEASIBLE | INFEASIBLE
    "favorita": true,
    "parametros": {
      "baseReceita": "arrecadada", // arrecadada | faturada
      "usarCts": true,
      "janelaCapex": 8, // anos
      "orcamento": 410000000, // reais
      "focoCobertura": 1.0, // 0 a 1
      "incluirIndustrial": true,
    },
    // AUSENTE quando status = INFEASIBLE. Ver §2.3.
    "metricas": {
      "vpl": 168069034,
      "capex": 304182900,
      "usoOrcamentoPct": 74.2,
      "obrasConstruidas": 367,
      "obrasTotal": 902,
      "coberturaFimPct": 77.6,
      "metasAtingidas": 2,
      "metasTotal": 2,
      "ebitdaTotal": 469377285,
    },
  },
]
```

> **Paginação:** hoje devolvemos tudo. Com o volume real isso não se sustenta —
> vale definir `?pagina=&porPagina=` (ou cursor) antes do go-live. O front ainda
> não implementa, e é ajuste pequeno quando o formato estiver decidido.

### 3.2 `DELETE /runs/{run_id}`

Responde `204`. **A única mutação de todo o pacote de resultados.** Apaga o
resultado; **não** toca no cadastro da unidade — a tela promete isso ao usuário,
no texto do modal de confirmação.

### 3.3 `GET /runs/{run_id}/meta` — KPIs do nível global

Alimenta o **header de todos os níveis** (chips de parâmetro e status do solver),
não só a tela global.

```jsonc
{
  "runId": "run_2026_0814",
  "nome": "Litoral 1 — janela 8a, foco cobertura",
  "unidadeId": "u1",
  "unidadeNome": "Litoral 1",
  "dataHora": "2026-08-04T14:32:00-03:00",
  "autor": "lucio.rosa",
  "status": "OPTIMAL",
  "statusTexto": "OTIMO | OBRIG 3/3", // como o CP-SAT devolveu, cru
  "parametros": {/* igual a §3.1 */},
  "kpis": {
    "vpl": 168069034,
    "capexTotal": 304182900,
    "opexTotal": 81440200,
    "receitaTotal": 553692134,
    "obrasConstruidas": 367,
    "obrasTotal": 902,
    "obrigatoriasConstruidas": 3,
    "obrigatoriasTotal": 3,
    "subbaciasFaturando": 218,
    "subbaciasTotal": 902,
    "coberturaFimPct": 77.6,
    "metasAtingidas": 2,
    "metasTotal": 2,
  },
}
```

`404` para rodada `INFEASIBLE`: ela não tem meta, e a UI já impede de chegar lá.

### 3.4 `GET /runs/{run_id}/painel` — os 6 quadros do nível global

**Desvio consciente do handoff**, que sugeria `/ano`, `/mes`,
`/obras/agregado` e `/subbacias/histograma` separados. São seis quadros que
aparecem sempre juntos; seis requisições para montar uma tela seria custo sem
ganho, e o backend lê as tabelas da mesma rodada de qualquer jeito.

```jsonc
{
  "anos": [
    // run_ano
    { "ano": 2026, "capex": 48000000, "opex": 1660000, "receita": 0, "tetoCapex": 52000000 }, // tetoCapex null = fora da janela
  ],
  "curvaS": [
    // run_mes, JÁ acumulado
    { "mes": "2026-01", "capexAcumulado": 4000000, "capexMes": 4000000 },
  ],
  "cascata": [
    // run_subbacia
    { "rotulo": "Receita direta", "valor": 469000000, "tipo": "entra" },
    { "rotulo": "Receita indireta", "valor": 38000000, "tipo": "entra" },
    { "rotulo": "Efeito-base paridade", "valor": 46692134, "tipo": "entra" },
    { "rotulo": "CAPEX", "valor": -304182900, "tipo": "sai" },
    { "rotulo": "OPEX", "valor": -81440200, "tipo": "sai" },
    { "rotulo": "VPL", "valor": 168069034, "tipo": "total" },
  ],
  "capexPorComponente": [
    // run_obra, somado por componente
    { "componente": "ETE (módulo)", "capex": 137000000, "pctDoTotal": 45.1 },
  ],
  "histogramaVpl": [{ "de": -2000000, "ate": -1000000, "quantidade": 61 }],
  "subbaciasPositivas": 218,
  "subbaciasNegativas": 684,
  "obrasPorAno": [
    { "ano": 2026, "porComponente": [{ "componente": "Ligação de esgoto", "quantidade": 20 }] },
  ],
  "fimCapex": 2033, // vira linha de referência em vários gráficos
}
```

Duas regras de conteúdo, não de formato:

- **`tipo` na cascata é semântico, não o sinal.** `total` é o VPL e é desenhado
  do zero; `entra`/`sai` acumulam. Mandar o VPL como `entra` desenharia uma barra
  flutuando no ar em vez do valor final.
- **Transporte NUNCA agrupado** em `capexPorComponente`: `Tronco`, `EEE` e
  `Linha de recalque` vão sempre separados, nunca somados num "Transporte".
  Agrupar esconde justamente o elo que costuma travar a cadeia. `Linha de
recalque` é o nome canônico.

Séries vazias são aceitas (o quadro mostra estado vazio), mas se houver rodada
com plano, espera-se `anos` e `curvaS` não vazios.

### 3.5 `GET /runs/{run_id}/ebitda` — EBITDA

Query opcional `cidade={id}`; sem ela, é o EBITDA da unidade.

```jsonc
{
  "anos": [{ "ano": 2028, "ebitda": 8100000, "margemPct": 86.4 }],
  "total": 469377285,
  "anoViraPositivo": 2028, // null se nunca vira
  "fimCapex": 2033,
}
```

`margemPct` é `null` no ano sem receita. O EBITDA é **saída calculada** (receita
operacional − OPEX, nominal) e **não entra na função objetivo** — a tela diz isso
ao usuário, e o número precisa ser coerente com essa definição.

### 3.6 `GET /runs/{run_id}/cidades` — tabela do nível global

```jsonc
[
  {
    "id": "c_rio",
    "nome": "Rio Bonito Litoral1",
    "vpl": 69100000,
    "capex": 48900000,
    "coberturaFimPct": 77.6,
    "metasAtingidas": 2,
    "metasTotal": 2,
    "sistemas": 1,
  },
]
```

### 3.7 `GET /runs/{run_id}/cidades/{cidade_id}` — nível 2

```jsonc
{
  "id": "c_rio",
  "nome": "Rio Bonito Litoral1",
  "fimConcessao": 2049, // o eixo da cobertura vai até aqui
  "fimCapex": 2033,
  "capexTotal": 48900000,
  "vpl": 69100000,
  "ligacoesNovas": 12480,
  "coberturaBasePct": 31.8,
  "coberturaFinalPct": 77.6,
  "cobertura": [{ "ano": 2026, "coberturaPct": 31.8 }],
  "metas": [
    {
      "ano": 2030,
      "alvoPct": 40.0,
      "realizadoPct": 52.4,
      "atingida": true,
      "dentroDaJanela": true,
    },
  ],
  "cascata": [/* como §3.4, somando o VPL DA CIDADE */],
  "paridade": {
    "faixas": [{ "coberturaPct": 40, "paridade": 0.72, "ehBase": false, "ehFinal": false }],
    "paridadeInicial": 0.6,
    "paridadeFinal": 0.72,
    "houveDegrau": true,
    "vpEfeitoBase": 10400000,
    "pctDoVplDaCidade": 15.1,
  },
  "sistemas": [
    {
      "id": "s38",
      "nome": "Sistema 38 Litoral1",
      "subbacias": 6,
      "faturando": 4,
      "capex": 11344500,
      "ocupacaoPct": 77.7,
    },
  ], // null quando capacidade = 0
}
```

**Sobre a paridade.** A tela é obrigada a explicitar a causalidade: o degrau de
faixa é a origem da barra "Efeito-base paridade" da cascata, porque o reajuste
vale também para as ligações **já existentes**. Por isso `houveDegrau`,
`vpEfeitoBase` e `pctDoVplDaCidade` vêm juntos — sem eles a tela teria que
inferir, e inferir é recomputar.

`ehBase` marca a faixa da cobertura de partida; `ehFinal`, a do fim do plano.

### 3.8 `GET /runs/{run_id}/sistemas/{sistema_id}/topologia` — nível 3

```jsonc
{
  "sistemaId": "s38",
  "sistemaNome": "Sistema 38 Litoral1",
  "cidadeId": "c_rio",
  "cidadeNome": "Rio Bonito Litoral1",
  "subbacias": 6,
  "faturando": 4,
  "capexConstruido": 11344500,
  "nos": [
    {
      "id": "d1b38_1_1",
      "tipo": "subbacia", // subbacia | cts
      "vazao": 41.2,
      "fatura": true,
      "pareadaCom": null, // só para CTS: a sub-bacia pareada 1:1
      "jusante": "d1b38_2_3", // null = liga direto na ETE
      "componentes": [
        {
          "nome": "Ligação de esgoto",
          "obraId": "lig_d1b38_1_1", // null = sem ficha (ver abaixo)
          "situacao": "construida", // construida | nao-construida | terceiro | sem-obra
          "capex": 180000,
          "precoUnitario": 1850.0,
          "quantidade": 80.0,
          "unidade": "un",
          "anoInicio": 2027,
          "prazoMeses": 6,
        },
      ],
    },
  ],
  "ete": {
    "id": "ete_d1e38",
    "nome": "ETE · Sistema 38 Litoral1",
    "capacidade": 270.0,
    "vazaoConectada": 209.7,
    "ocupacaoPct": 77.7, // null quando capacidade = 0 — ver §2.3
    "vazaoNaoAtendida": 102.2, // destacado em vermelho quando > 0
    "modulos": [/* mesmos campos de ComponenteNo */],
  },
}
```

Regras de conteúdo:

- **`jusante` é o que desenha o diagrama.** O front calcula a coluna de cada nó
  pela distância até a ETE. Um `jusante` apontando para um id que não está em
  `nos` é tratado como "liga direto na ETE".
- **CTS tem 4 componentes; sub-bacia tem 5.** Coletor de tempo seco · Tronco ·
  EEE · Linha de recalque, contra Ligação de esgoto · Rede coletora · Tronco ·
  EEE · Linha de recalque. A CTS também traz `pareadaCom` preenchido.
- **`obraId` só quando existe ficha.** Se um componente não tem detalhe em
  `GET /runs/{id}/obras/{obraId}`, mande `null`. Prometer um id que dá 404 é pior
  que não prometer nada — foi um bug real aqui, nos módulos da ETE.

### 3.9 `GET /runs/{run_id}/subbacias/{sub_id}` — nível 4

```jsonc
{
  "id": "d1b38_2_1",
  "tipo": "subbacia",
  "pareadaCom": null,
  "cidadeId": "c_rio",
  "cidadeNome": "Rio Bonito Litoral1",
  "sistemaId": "s38",
  "sistemaNome": "Sistema 38 Litoral1",
  "fatura": false,
  "vazao": 19.4,
  "vpl": -801848,
  "cascata": [/* como §3.4, somando o VPL DESTA sub-bacia */],
  "receita": [{ "ano": 2030, "direta": 477859, "indireta": 312400 }],
  "explicacao": {
    "categoria": "Travada por obra da cadeia",
    "elo": "tro_d1b38_2_1", // id de obra; null quando nada trava
    "narrativa": "A sub-bacia não fatura porque falta…",
    "seFosseLigada": {
      // null quando ela já fatura
      "receita": 4344178,
      "capexSozinha": 432619,
      "opex": 369229,
      "saldoSozinha": 3542330,
      "saldoComRateio": 3542330,
    },
  },
  "caminho": ["d1b38_2_3", "ete_d1e38"], // jusante até a ETE, em ordem
  "elementos": [
    {
      "obraId": "tro_d1b38_2_1",
      "componente": "Tronco",
      "situacao": "nao-construida",
      "quantidade": 126.8,
      "unidade": "m",
      "precoUnitario": 2691.0,
      "capex": 0,
      "anoInicio": null,
      "prazoMeses": 8,
    },
  ],
}
```

- **`receita: []` é o sinal de "não fatura".** A tela troca o gráfico por uma
  mensagem em vez de desenhar um eixo com zeros — um gráfico vazio parece dado.
- **`elo` tem de ser uma obra DESTA sub-bacia.** A tela o oferece como link; um
  elo apontando para obra de outro nó levaria a uma ficha plausível e errada, o
  que é pior que 404.

### 3.10 `GET /runs/{run_id}/obras/{obra_id}` — nível 5

```jsonc
{
  "obraId": "lig_d1b38_1_1",
  "componente": "Ligação de esgoto",
  "rotulo": "lig_d1b38_1_1", // acrescente " (CTS)" quando o nó é CTS
  "situacao": "construida",
  "cidadeId": "c_rio",
  "cidadeNome": "Rio Bonito Litoral1",
  "sistemaId": "s38",
  "sistemaNome": "Sistema 38 Litoral1",
  "subbaciaId": "d1b38_1_1",
  "responsavel": "Aegea", // "Aegea" | "Terceiro"
  "obrigatoria": true,
  "quantidade": 80.0,
  "unidade": "un",
  "precoUnitario": 1850.0,
  "capex": 180000, // = quantidade × preçoUnitario
  "opexAno": 5580,
  "prazoMeses": 6,
  "mesMaisCedo": 12,
  "wacc": 9.45,
  "waccOrigem": "proprio", // "proprio" | "medio"
  "ligacoesNovas": 2530,
  "ticketMedio": 84.7,
  "precoPorLigacao": 71.15,
  "capexConstruido": 1050000,
  "capexQueFalta": 0,
  "dataInicio": "2027-03-01",
  "dataPronta": "2028-09-01",
  "categoria": null,
  "elo": null,
  "narrativa": null,
  "dependencias": [
    {
      "subbaciaId": "d1b38_1_1",
      "vazao": 41.2,
      "fracaoRateio": 1.0,
      "capexRateado": 180000,
      "fatura": true,
    },
  ],
}
```

- **`waccOrigem` não é enfeite.** `proprio` = financiamento contratado para a
  obra; `medio` = o campo veio vazio e herdou o `wacc_medio` da unidade. São
  coisas economicamente diferentes e a tela mostra qual é.
- **`fracaoRateio` de 0 a 1**, somando 1 por obra. A tela **não** soma — ela
  afirma ao usuário que a reconciliação é do portão de qualidade.
- `capexConstruido` / `capexQueFalta` são da **cadeia da sub-bacia**, não da
  obra: respondem "quão longe ela está de faturar".

---

## 4. Nova simulação

Quatro endpoints. Aqui está a **única criação** de todo o app: um `POST` que gera
um `run_id` novo, que passa a existir para sempre no histórico.

### 4.1 `GET /unidades/{unidade_id}/prontidao`

```jsonc
{ "unidadeId": "u1", "unidadeNome": "Litoral 1", "pendencias": 0 }
```

Endpoint próprio, e não um campo em `/unidades/{id}`, porque a resposta é
volátil: ela muda a cada campo preenchido no cadastro, e esta tela precisa do
número **do momento em que se clica Iniciar**. O front busca com `staleTime: 0` e
refaz ao voltar o foco da janela — o usuário costuma completar o cadastro noutra
aba e voltar.

`pendencias > 0` bloqueia a rodada na UI.

### 4.2 `POST /runs` — dispara a rodada

Corpo completo. **Os nomes aqui são `snake_case`**, espelhando os parâmetros do
notebook de teste, porque a rastreabilidade com ele foi requisito de handoff (a
tela mostra o nome técnico ao lado de cada controle).

```jsonc
{
  "unidade_id": "u1",
  "nome": "Litoral 1 — janela 8a, foco cobertura", // null = sem nome

  // ---- orçamento: UM dos dois blocos, nunca os dois ----
  // (a) cronograma por ano — o modo padrão
  "orcamento": { "2026": 60000000, "2027": 60000000 }, // só anos COM verba
  // (b) valor único replicado pelo horizonte
  "orcamento_anual": 50000000,
  "horizonte_capex": 8,

  "redistribuir_orcamento": false,
  "teto_execucao_anual": null, // null = usa o PICO do cronograma
  "anos_extra_conclusao": 3,

  "foco_cobertura": 1.0, // 0 a 1
  "penalidade_cobertura": "meta+cobertura", // meta+cobertura | meta | ligacao
  "metas_cobertura": "cadastro", // "cadastro" | null (null = IGNORAR as metas)
  "peso_cidade": { "Cabo Frio": 5 }, // {} quando não há prioridade

  "base_receita": "arrecadada", // arrecadada | faturada
  "curva_adocao": "scurve", // scurve | linear
  "usar_cts": true,
  "incluir_industrial": true,

  "ete_faseada": true,
  "ete_fixo": false,
  "data_inicio": null, // null = janeiro do ano-base; ou "2026-06"
  "max_time_s": 300,
  "workers": 8,
}
```

Resposta `201`:

```jsonc
{ "runId": "run_novo_0001", "status": "RODANDO" } // PENDENTE | RODANDO
```

Três detalhes que o front garante e o backend **não deve assumir**:

- **A janela de CAPEX é derivada**, nunca enviada: ela é o intervalo dos anos com
  verba em `orcamento`. Não existe campo de janela no modo cronograma.
- **`teto_execucao_anual: null` ≠ 0.** `null` significa "usa o pico do
  cronograma"; `0` significaria "não pode executar nada".
- **`metas_cobertura: null` significa ignorar as metas** nesta rodada — é uma
  escolha legítima do usuário, e a tela avisa que o resultado não serve para
  aferir cumprimento.

### 4.3 `GET /runs/{run_id}/status` — progresso

```jsonc
{
  "runId": "run_novo_0001",
  "status": "RODANDO", // PENDENTE | RODANDO | SUCESSO | FALHOU_QUALIDADE | ERRO | CANCELADA
  "progresso": 42, // 0 a 100
  "erro": null, // mensagem quando status = ERRO ou FALHOU_QUALIDADE
}
```

O front faz polling a cada 1,2 s **enquanto** o status for `PENDENTE` ou
`RODANDO`, e para sozinho nos demais. O modal nomeia a etapa a partir do
`progresso` (lendo dados → montando o modelo → resolvendo → materializando), então
um progresso que salta de 0 para 100 funciona, mas perde a informação útil.

`FALHOU_QUALIDADE` **não** é falha técnica: a rodada foi calculada e reprovou no
portão. A tela trata os dois como término, mas o texto de `erro` é o que explica
a diferença ao usuário — mande o motivo da reprovação aqui.

### 4.4 `POST /runs/{run_id}/cancelar`

Responde `204`. O front chama quando o usuário cancela no modal.

---

## 5. O que o backend precisa validar por conta própria

O frontend valida para dar feedback imediato, **não** para proteger o sistema.
Tudo abaixo precisa ser checado no servidor:

| Regra                                | Por quê                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| Cadastro da unidade sem pendências   | O handoff é explícito: é regra de negócio, não de UI          |
| Pelo menos um ano com verba          | Rodada sem teto anual estoura o CP-SAT com erro opaco         |
| Anos do cronograma sem repetição     | Chave repetida em `orcamento` perde silenciosamente uma delas |
| `foco_cobertura` entre 0 e 1         | Fora da faixa, o peso de cobertura satura                     |
| Permissão do usuário sobre a unidade | O front não sabe nada de autorização                          |

O mock já recusa `POST /runs` com `422` quando a unidade tem pendência — foi
proposital, para que o dia em que a tela deixasse passar não ficasse escondido.

---

## 6. Decisões em aberto

Nenhuma bloqueia o desenho do backend, mas todas mudam o contrato se forem
resolvidas de outro jeito:

1. **Imutabilidade do `run_id`** (§2.1) — reprocessar gera id novo, ou o payload
   ganha versão? É a decisão de maior impacto desta lista.
2. **Paginação de `GET /runs`** (§3.1) — formato a definir.
3. **Módulos da ETE sem ficha** (§3.8) — hoje mandamos `obraId: null`. Se eles
   ganharem ficha, é preciso um caminho de navegação para ela, porque a cascata
   não tem nível de ETE.
4. **Escala da topologia** — o handoff fala em 902 sub-bacias. O payload de
   `/topologia` é de um sistema, o que mantém o tamanho razoável; se algum
   sistema tiver dezenas de nós, o diagrama vai precisar de paginação ou filtro.
5. **Escrita da hierarquia** — pendência antiga do cadastro (ver `DEPLOY.md` §6),
   citada aqui porque quem desenhar o backend vai encontrar a lacuna.
