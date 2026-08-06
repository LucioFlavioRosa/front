# Otimizador CAPEX de Esgoto — Cadastro e Resultados

Frontend do **Otimizador de sequência de obras** (o MILP que escolhe quais obras
entram no plano, em que ano). São dois produtos na mesma casca, ligados pelo hub
da unidade:

| Rota          | O que é                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `/`           | **Portal** — os três caminhos do fluxo                                    |
| `/cadastro`   | **Cadastro** — confere e grava os dados que a simulação consome (escrita) |
| `/simular`    | **Simulação** — dispara uma rodada do otimizador (a única criação do app) |
| `/resultados` | **Resultados** — lê as tabelas de uma rodada executada (leitura pura)     |

A raiz é um portal, e não a seleção de unidade, porque **o que você quer fazer
determina se a unidade importa**: cadastro e simulação são de uma unidade, o
histórico é do usuário e já traz a unidade em cada rodada. Antes era preciso
escolher uma unidade para só então descobrir o que dava para fazer com ela.

A tela de `/simular` traduz os parâmetros do notebook de teste em controles de
negócio, valida o que impede a rodada e acompanha o progresso. Três regras dela
merecem atenção de quem for mexer:

- **Parsing pt-BR + notação do notebook**: se a string tem vírgula, o ponto é
  separador de milhar (`1.234,5`); se não tem, o ponto é decimal (`0.35`). Sem
  isso, um valor copiado do notebook vira outro número.
- **A janela de CAPEX é derivada** do cronograma, nunca digitada. Dois campos
  para a mesma verdade divergiriam no primeiro ano zerado.
- **Bloquear × avisar**: só impedem a rodada as coisas que a tornam impossível
  (sem unidade, cadastro com pendências, orçamento zerado). Ignorar as metas
  muda muito o resultado, mas é escolha legítima — avisa. Bloquear o incomum
  treina o usuário a ignorar avisos.

Este app **não roda a simulação** — ele prepara o cadastro que ela consome e lê o
resultado que ela produziu. Quem executa é o job no Databricks.

- **Para colocar em produção e ligar o backend:** [`DEPLOY.md`](DEPLOY.md)
  (configuração, servidor de arquivos, SSO e o contrato do **cadastro**) e
  [`CONTRATO.md`](CONTRATO.md) (contrato de **resultados** e **simulação**, com
  as garantias que o backend precisa honrar).
- **Para revisar o código:** [`REVIEW.md`](REVIEW.md) — ordem de leitura e as
  decisões que parecem estranhas até você saber o porquê.

## Rodar

```bash
npm install
npm run dev          # localhost:5173, com dados de mentira (MSW)
```

Não precisa de backend: em desenvolvimento o [MSW](https://mswjs.io) intercepta
`/api` e responde com as fixtures de `src/mocks/fixtures/`. Para apontar para um
backend real, use `VITE_API_PROXY` (ver `.env.example`).

| Comando                 | O que faz                                                |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Sobe o app com mocks                                     |
| `npm test`              | Suíte completa (292 testes)                              |
| `npm run test:watch`    | Testes em watch                                          |
| `npm run lint`          | ESLint                                                   |
| `npm run format`        | Prettier (escreve)                                       |
| `npm run build`         | `tsc -b` + build de produção                             |
| **`npm run verificar`** | **Lint + formatação + build + testes** — o que o CI roda |

## As telas

Uma unidade é escolhida na entrada; tudo depois é dela.

| Grupo | Tela                   | O que se faz ali                                                                                                                      |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 01    | Hierarquia & Topologia | Confere a estrutura vinda do Databricks — principalmente **escoa para**, que é o que liga a receita. _Sem gravação no backend ainda._ |
| 02    | Contrato & Metas       | Fim da concessão, **régua de cobertura** (ligações/economias/população), metas por ano e paridade esgoto/água                         |
| 03    | Sub-bacias & Obras     | A ficha central: base comercial do Databricks, parâmetros da unidade e as 5 obras                                                     |
| 04    | ETEs                   | Capacidade, módulos e custos das estações                                                                                             |
| 05    | CTS                    | Coletor de Tempo Seco: irmã da sub-bacia, pareada 1:1 e **opcional**                                                                  |

O **hub** da unidade mostra o estado de cada grupo e só libera a simulação com
zero pendências. É dele que se chega ao histórico de simulações.

## As telas de resultado (`/resultados`)

Cascata de 6 níveis que lê as tabelas `run_*` de **uma rodada** (`run_id`) e
nunca reexecuta o otimizador.

| Nível | Rota                 | O que mostra                                           |
| ----- | -------------------- | ------------------------------------------------------ |
| 0     | `/resultados`        | histórico de simulações — a porta de entrada           |
| 1     | `/resultados/:runId` | global: KPIs, 6 quadros do painel e a aba de EBITDA    |
| 2     | `.../cidades/:id`    | cobertura vs metas, cascata do VPL, paridade e EBITDA  |
| 3     | `.../sistemas/:id`   | topologia: sub-bacias, CTS e ETE ligadas até o destino |
| 4     | `.../sub-bacias/:id` | por que entrou ou ficou de fora (explicabilidade)      |
| 5     | `.../obras/:id`      | a ficha da obra e quem depende dela                    |

Três decisões que explicam o código:

- **Rotas planas** — a ancestralidade não vai no caminho. Bate com o contrato de
  API, encurta a URL e faz o deep link funcionar. Quem sabe a que cidade um
  sistema pertence é o payload, então o breadcrumb vem do `CrumbsProvider`.
- **A unidade não entra na URL** — uma rodada pertence a exatamente uma unidade,
  então o `run_id` já determina o recorte.
- **Resultado é imutável** — um `run_id` publicado nunca muda, então as queries
  usam `staleTime: Infinity` e a única mutação do pacote é excluir uma rodada.
  Nada de reducer, rascunho ou guarda de saída: aqui não se edita.

**Os gráficos são próprios**, em `components/resultado/graficos.tsx` sobre
`lib/svg.ts`. Não é teimosia: os 8 gráficos são estáticos (nenhum tem zoom ou
brush) e três deles — cascata, losangos de meta e duplo eixo com anotação — são
justamente o que as bibliotecas cobram caro para customizar. A geometria fica em
funções puras, então dá para travar "a cascata fecha no total" num teste
unitário, sem renderizar. O SVG é `aria-hidden` e cada quadro carrega uma tabela
visualmente oculta como equivalente textual.

**Estado:** as 6 fatias estão implementadas contra mocks. O que falta é o backend
real — nenhum destes endpoints existe fora do MSW.

## De onde vem o dado

```
Databricks ──► backend do cadastro ──► este app ──► backend ──► Otimizador
   (base)         (ainda não existe)     (telas)     (grava)      (MILP)
```

Duas origens convivem em cada ficha, e a tela deixa isso explícito:

- **Databricks** (cinza-azulado, cadeado): base comercial e hierarquia. Só se
  corrige em "modo de correção", e cada correção vira um **override** com valor
  antigo, valor novo, autor e data — a trilha viaja junto com o dado no PUT.
- **Você preenche** (âmbar quando vazio): parâmetros, obras, metas. Campo vazio
  é **pendência**, e pendência derruba a completude e trava a simulação.

Um conceito de negócio que vale saber antes de ler as telas: as medidas
"normais" (ligações, receita, vazão) são o **total** — residencial mais
industrial —, e as colunas `_industrial` são a **parcela já contida** nesse
total. Somar as duas duplica receita e cobertura. Quem decide se a indústria
entra é a rodada de simulação, não este cadastro. A regra completa, com exemplo
numérico, está no [`DEPLOY.md`](DEPLOY.md) e no dicionário de dados do app.

## Mapa do código

| Onde                            | O que é                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`                   | Regras e tipos, sem React. `subbacia.ts` (obras, CAPEX, pendências), `cts.ts`, `contrato.ts`, `ete.ts`, `baseComercial.ts` (campos das fichas), `dict.ts` (dicionário de dados) |
| `src/state/cadastroReducer.ts`  | Reducer puro: **única** forma de mutar o cadastro. Também deriva contadores e completude                                                                                        |
| `src/state/CadastroContext.tsx` | Liga o reducer às queries, ao rascunho local e expõe tudo às telas                                                                                                              |
| `src/state/fichas.ts`           | Monta o corpo de cada PUT e diz o que ainda não foi salvo                                                                                                                       |
| `src/state/rascunho.ts`         | Rascunho da sessão no `sessionStorage`                                                                                                                                          |
| `src/api/`                      | `client.ts` (HTTP), `queries.ts` (leitura), `mutations.ts` (escrita), `escrita.ts` (**contrato**)                                                                               |
| `src/pages/`                    | Uma tela por grupo + hub + seleção de unidade                                                                                                                                   |
| `src/components/`               | Peças compartilhadas (rail, ficha, tabela de obras, modal, toasts)                                                                                                              |
| `src/mocks/`                    | MSW + fixtures — o backend de mentira do desenvolvimento                                                                                                                        |
| **Resultado**                   | `domain/resultado.ts` (contrato), `api/resultados.ts` + `api/queriesResultado.ts`, `layout/ResultsShell` + `ResultsHeader`, `state/CrumbsResultado.tsx`, `pages/resultado/`     |
| `src/testes/`                   | Ajudantes dos testes de tela (`renderApp`, api de mentira)                                                                                                                      |

Stack: **Vite + React 18 + TypeScript**, React Router 6, TanStack Query, CSS
Modules com tokens em `src/styles/tokens.css`. Sem biblioteca de componentes: o
visual segue o protótipo do handoff.

## O que ainda não está pronto

Nada aqui é surpresa escondida — está tudo detalhado no `DEPLOY.md`:

- **Autenticação**: só o encaixe (`src/auth/sessao.ts`). Falta escolher IdP/lib
  (provável Entra ID) e ligar no bootstrap.
- **Concorrência**: sem versão/ETag por ficha. A UI já trata 409 (oferece
  recarregar do servidor), mas quem detecta o conflito é o backend.
- **Hierarquia (Grupo 01) não grava**: o contrato de escrita não cobre a
  hierarquia. A tela avisa o usuário; as correções ficam no rascunho da aba.
- **"Importar planilha"** no hub é um stub.
- **O backend do cadastro não existe** — hoje tudo responde pelo MSW.
