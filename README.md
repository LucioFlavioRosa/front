# Cadastro de Dados — Otimizador CAPEX de Esgoto

Frontend das telas em que a Regional/Unidade confere e completa os dados que
alimentam o **Otimizador de sequência de obras** (o MILP que escolhe quais obras
entram no plano, em que ano). Este app **não roda a simulação**: ele prepara e
grava o cadastro que ela consome.

- **Para colocar em produção e ligar o backend:** [`DEPLOY.md`](DEPLOY.md) — é lá
  que está o contrato da API, o que cada campo significa e o que o backend
  precisa honrar.
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
| `npm test`              | Suíte completa (171 testes)                              |
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
zero pendências.

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
