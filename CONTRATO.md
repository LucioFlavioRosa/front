# Contrato da API — Resultados e Nova Simulação

Este documento é para quem vai **escrever o backend**. Ele descreve o que o
frontend chama hoje, com que formato espera a resposta e — mais importante — as
poucas garantias sem as quais a tela mente para o usuário.

> **O contrato do CADASTRO não está aqui.** Ele já existe em
> [`DEPLOY.md`](DEPLOY.md) §3 (leitura das fichas, PUT por ficha, trilha de
> override, auditoria da ficha). Este documento cobre as duas áreas novas:
> **resultados** (leitura pura de uma rodada) e **simulação** (o disparo da
> rodada).

O frontend inteiro roda hoje contra mocks (MSW). Cada endpoint abaixo tem um
handler em `src/mocks/handlersResultado.ts` e `src/mocks/handlersSimulacao.ts` —
eles são a referência executável deste documento, e os testes os exercitam. Se
uma dúvida sobrar depois de ler aqui, o mock responde.

> **Este documento é verificado por teste** (`src/contrato.test.ts`, no portão do
> repositório). Quebra o build se um endpoint chamado pelo app não estiver aqui,
> se um endpoint daqui não for mais chamado, ou se algum campo citado não existir
> nos tipos. Contrato que diverge do código é pior que contrato nenhum.

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

O client (`src/comum/api/client.ts`) distingue três famílias, e a UI reage diferente em
cada uma:

| Status        | Significado para a tela                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `401` / `403` | Sessão inválida — dispara o fluxo de re-login                            |
| `400` / `422` | Conteúdo recusado. **Mande `{ "erro": "mensagem" }`** — ela é exibida    |
| `409`         | Conflito. **Mande `{ "erro": "mensagem" }`** — ela é exibida             |
| `404`         | Recurso inexistente. A tela mostra o estado de erro com "Tentar de novo" |
| `5xx`         | Idem 404, sem detalhe técnico ao usuário                                 |

O `409` aparece **só na simulação**: tentativa de reexecutar uma rodada já
publicada (§4.5). O usuário precisa entender **o que** conflitou, e a única fonte
é o texto que vem no corpo.

A **edição de cadastro não responde 409**: o servidor aceita a gravação de quem
leu a ficha antes de um colega salvar. O sinal de concorrência é a auditoria —
toda ficha carrega `atualizadoEm`/`atualizadoPor`, e a tela mostra quem mexeu por
último (`DEPLOY.md` §3).

Uma resposta 2xx que **não** seja JSON válido é tratada como erro. Isso é
proposital: proxy que devolve a página de login em HTML com status 200 é um modo
de falha real, e falhar cedo é melhor que um `undefined` aparecendo três telas
adiante.

---

## 2. As três garantias que sustentam o front

Estas não são preferências de implementação. Se qualquer uma for quebrada, a
tela passa a mostrar número errado **sem nenhum sinal de erro** — que é o pior
modo de falha possível num app de decisão de investimento.

### 2.1 Um `run_id` publicado é IMUTÁVEL

**Regra, decidida em 06/08/2026:** um `run_id` congela na primeira publicação
bem-sucedida.

- Enquanto `run_status` **não** for `SUCESSO` — ou seja `PENDENTE`, `RODANDO`,
  `ERRO`, `FALHOU_QUALIDADE`, `CANCELADA` — reexecutar **pode** reusar o mesmo
  `run_id`. Nada foi publicado, ninguém viu resultado nenhum e o histórico não
  ganha entrada-fantasma. É o retry de falha técnica, e ele continua barato.
- Depois de `SUCESSO`, **qualquer** nova execução recebe um `run_id` novo, mesmo
  com parâmetros idênticos. O backend deve **recusar** (`409`) um pedido de
  execução sobre um `run_id` já publicado.

A condição é `run_status`, e não a intenção de quem dispara, porque a publicação
do job é atômica: `public.otim_*` e `run_status = SUCESSO` entram na mesma
transação. Então "já foi publicado" é um fato consultável, não um julgamento.

**Por que não bastava republicar o mesmo id.** O motivo óbvio é o cache: o front
lê tudo que pertence a uma rodada com `staleTime: Infinity`, e quem já tivesse a
rodada aberta continuaria vendo o resultado antigo. Mas esse é o sintoma menor —
dá para contornar com refresh. O motivo real é a **auditoria**: o job lê o
cadastro no instante da execução, então a mesma rodada, com os mesmos parâmetros,
depois de uma correção no cadastro, produz outro plano. Republicando sob o mesmo
id, o `DELETE`+`INSERT` da publicação apaga o resultado anterior, e a pergunta
"quais números a gente aprovou na reunião de setembro?" deixa de ter resposta.
Rodada nova é rodada nova.

**`reprocessa_de`.** Para o histórico não virar uma lista de rodadas soltas, a
`run_request` da reexecução deve guardar o `run_id` de origem (campo novo, opcional,
nulo na primeira rodada de uma unidade).

**Hoje é só escrita.** Ele **não** aparece em `GET /runs` (§3.1) nem nos tipos do
front, e isso é deliberado: nenhuma tela o consome ainda, e campo em resposta que
ninguém lê é contrato que envelhece sozinho. O que se pede agora é que a **coluna
exista desde o começo**, porque preencher o histórico retroativamente depois é a
parte cara. Quando a tela for rotular "reprocessamento de `run_2026_0814`" e comparar
antes/depois, `reprocessaDe: string | null` entra em §3.1 — está registrado na §6.

> **Para quem implementar o retry:** no pacote de produção a rodada é idempotente
> nos dois lados — Postgres (`DELETE` por `run_id`, depois `INSERT`) e cópia
> congelada em blob (substitui a partição `run_id=<rid>`). O blob **não** era: a
> gravação era `mode("append")` particionada por `run_id`, e reexecutar duplicava o
> parquet. Corrigido em 06/08/2026, junto desta decisão.
>
> Duas exigências de lá que valem aqui: o `run_id` precisa obedecer
> `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` — ele vira caminho de partição e literal SQL,
> e o job recusa fora disso; e **não** dispare dois jobs no mesmo `run_id` em
> paralelo, porque a idempotência protege repetição sequencial, não concorrência.

**Descartado: versionar** (`versao`/`ETag` em `/runs/{id}/meta`, entrando na chave
de cache). Custa mais e entrega menos: o front passaria a precisar de `/meta`
antes de qualquer outra chamada só para montar a chave — o cache eterno vira cache
condicional, uma ida ao servidor por navegação — e não resolve a auditoria, já que
a versão anterior continua apagada. Versionar rotula a perda, não a evita.

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
    // AS VARIÁVEIS COM QUE A RODADA FOI PEDIDA — as chaves de `controle.run_request`,
    // como vieram. `parametros` acima traz seis campos tipados (os que o card
    // mostra); o formulário tem mais de vinte, e os outros não apareciam em lugar
    // nenhum depois de a rodada existir. O modal de detalhes os lista.
    //
    // `null` quando a rodada foi publicada SEM passar pela fila (o pacote de
    // produção publica direto) — aí não há `run_request` de onde tirá-las.
    // `UNIDADE`, `USUARIO` e `REGIONAL` ficam de fora: já são campo próprio acima,
    // e repeti-las mostraria a mesma coisa duas vezes, com nome técnico na segunda.
    "pedido": {
      "ORCAMENTO": { "2026": 60000000 },
      "PENALIDADE_COBERTURA": "meta+cobertura",
      "CURVA_ADOCAO": "scurve",
      "WORKERS": 8,
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

Resposta `201` — rodada criada:

```jsonc
{ "runId": "run_novo_0001", "status": "RODANDO", "jaExistia": false } // PENDENTE | RODANDO
```

Resposta `200` — **nada foi criado; já existia uma rodada idêntica** (R5):

```jsonc
{ "runId": "run_de_ontem", "status": "SUCESSO", "jaExistia": true }
```

O `200` acontece quando o pedido é **idêntico** (mesmos parâmetros) e **da mesma
pessoa** — o `USUARIO` entra na identidade do pedido, então duas pessoas pedindo a
mesma coisa geram duas rodadas. Dois casos caem aqui:

| caso | o que a tela faz |
| --- | --- |
| rodada **em voo** (`PENDENTE`/`RODANDO`) | acompanha, como se a tivesse criado — é o duplo clique levando ao mesmo lugar |
| rodada **concluída** (`SUCESSO`) | avisa que já existe e oferece o link; não abre acompanhamento de algo que terminou |

Três condições para uma rodada **concluída** deduplicar, e nenhuma é dispensável:

1. **`SUCESSO`** — `ERRO` libera execução nova, sempre. Quem repete depois de uma
   falha está corrigindo algo, e apontá-lo para o fracasso anterior impediria a
   correção.
2. **publicada** — `SUCESSO` sem resultado consultável é um estado que mente;
   mandar alguém para ele é prometer uma tela vazia.
3. **posterior à última alteração do cadastro da unidade** — os mesmos parâmetros
   de tela não são a mesma simulação se o cadastro mudou no meio. O servidor
   compara com `atualizado_em` das fichas.

**`jaExistia` viaja no CORPO**, e não só no código HTTP. É deliberado: o cliente
do front devolve o JSON e descarta o status, então ler `200` vs `201` exigiria
mudar o transporte para saber o que o corpo já diz. O código continua correto para
quem lê HTTP — quem tem os dois, use o que preferir.

Três detalhes que o front garante e o backend **não deve assumir**:

- **A janela de CAPEX é derivada**, nunca enviada: ela é o intervalo dos anos com
  verba em `orcamento`. Não existe campo de janela no modo cronograma.
- **`teto_execucao_anual: null` ≠ 0.** `null` significa "usa o pico do
  cronograma"; `0` significaria "não pode executar nada".
- **`metas_cobertura: null` significa ignorar as metas** nesta rodada — é uma
  escolha legítima do usuário, e a tela avisa que o resultado não serve para
  aferir cumprimento.

**Quem cunha o `run_id`.** Este endpoint, sempre. No pacote de produção o `run_id`
é de quem insere a `controle.run_request`, não do job (`docs/01-visao-geral.md`), e
`novo_run_id()` já existe lá. Este `POST` nunca aceita `run_id` no corpo: o front
não tem como escolher um, e permitir isso abriria a porta para sobrescrever rodada
publicada. Reexecução é assunto de um endpoint separado, sujeito à regra da §2.1.

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

<!-- somente-backend -->

**Não é chamado pelo front hoje** — e a marcação acima diz isso ao
`contrato.test.ts`, que exige que todo endpoint documentado tenha chamador. Sai
da marcação no dia em que o botão voltar.

> **Ainda não disponível — responde `501`.** `controle.run_status` tem
> `CHECK (status IN ('PENDENTE','RODANDO','SUCESSO','FALHOU_QUALIDADE','ERRO'))`,
> e `CANCELADA` viola o CHECK: o UPDATE falharia. Responder `204` sem cancelar
> seria pior que responder erro — a tela fecharia dizendo "cancelado" e o cluster
> continuaria processando e cobrando, com a rodada aparecendo concluída minutos
> depois.
>
> Enquanto a migração não roda, **o front não oferece o botão**. Quando `CANCELADA`
> entrar no CHECK e o job souber interromper a execução, o endpoint passa a
> responder `204` e o botão volta — os dois na mesma entrega, nunca um sem o outro.

**Quando a migração entrar**, o endpoint responde `204` e o front religa em três
pontos. Os três na mesma entrega: cada um sozinho mente.

```ts
// simulacao/api/endpoints.ts
cancelar: (runId: string) => api.post<void>(`/runs/${runId}/cancelar`),

// simulacao/api/queries.ts — invalidar o status é a parte que se esquece: sem
// isso o modal segue exibindo RODANDO depois do cancelamento aceito.
export function useCancelarRodada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => simulacao.cancelar(runId),
    onSuccess: (_d, runId) =>
      void qc.invalidateQueries({ queryKey: chavesSimulacao.status(runId) }),
  })
}

// simulacao/pages/Simular.tsx — o botão volta sob `!terminal`: cancelar uma
// rodada que já terminou também é um botão que mente.
```

Está aqui em texto, e não como código sem chamador no repositório, porque função
que ninguém usa envelhece sem que ninguém perceba — e o `knip` a acusa a cada
execução até alguém a apagar sem saber por que existia.

### 4.5 `POST /runs/{run_id}/reexecutar` — retry

<!-- somente-backend -->

**Não é chamado pelo front.** Está aqui porque a §2.1 exige que ele exista e define
o comportamento dele; sem isso, quem escrever o backend teria de inventar como
"reexecutar" se distingue de "criar". O dia em que a tela ganhar um botão "rodar de
novo", este é o endpoint — e aí ele sai desta marcação.

Reexecuta a rodada com **os mesmos parâmetros da `run_request` original**, sem corpo.
A resposta depende do `run_status` no momento da chamada:

| `run_status`                            | resposta                           | efeito                                                                          |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `PENDENTE`, `RODANDO`                   | `409`                              | já está em voo; não há o que reexecutar                                         |
| `ERRO`, `FALHOU_QUALIDADE`, `CANCELADA` | `202` + `{ "runId": "<o mesmo>" }` | retry: **reusa** o `run_id`, porque nada foi publicado                          |
| `SUCESSO`                               | `409`                              | a rodada congelou (§2.1); para rodar de novo, `POST /runs` com um `run_id` novo |

O `409` do `SUCESSO` **não** é erro de sistema — é a garantia funcionando. Mande no
corpo uma mensagem que explique isso ao usuário, algo como "esta rodada já foi
publicada; crie uma nova simulação".

Quando o backend cria a rodada nova depois de um `SUCESSO`, ele grava
`reprocessa_de = <run_id anterior>` na `run_request`. Ver §2.1.

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

1. **Paginação de `GET /runs`** (§3.1) — formato a definir. A decisão da §2.1 aumenta a
   cardinalidade natural do histórico (reexecução vira rodada nova), então isto deixou de
   ser só uma questão de volume futuro.
2. **Expor `reprocessa_de` na resposta** (§2.1) — a coluna nasce agora, mas o campo só
   entra em `GET /runs` quando a tela for rotular a relação entre a rodada e sua origem.
3. **Módulos da ETE sem ficha** (§3.8) — hoje mandamos `obraId: null`. Se eles
   ganharem ficha, é preciso um caminho de navegação para ela, porque a cascata
   não tem nível de ETE.
4. **Escala da topologia** — o handoff fala em 902 sub-bacias. O payload de
   `/topologia` é de um sistema, o que mantém o tamanho razoável; se algum
   sistema tiver dezenas de nós, o diagrama vai precisar de paginação ou filtro.
5. **Escrita da hierarquia** — pendência antiga do cadastro (ver `DEPLOY.md` §6),
   citada aqui porque quem desenhar o backend vai encontrar a lacuna.
