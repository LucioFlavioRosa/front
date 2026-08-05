# Colocar em produção e ligar o backend

Este é o **frontend** do Cadastro de Dados do Otimizador CAPEX. O build é um
site estático (`npm run build` → `dist/`). Ele não tem servidor próprio: precisa
de um servidor de arquivos com duas configurações e de uma API que honre o
contrato descrito abaixo.

---

## 1. Configuração

A config real vem de **`/config.js`**, resolvida em runtime — não de variável de
build. Isso é o que permite **uma imagem só** rodar em todos os ambientes: cada
um monta o seu `/config.js` por ConfigMap. Precedência em `src/config.ts`:
`/config.js` > `VITE_*` > padrão.

Como mexer nisso no dia a dia: **[`deploy/README.md`](deploy/README.md)**.

| Onde                   | Efeito                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `config.js` → `apiUrl` | Base das chamadas. Vazio → `/api` (mesma origem).                                                      |
| `config.js` → `sso`    | `authority`/`clientId`/`escopos`. Vazio = SSO desligado.                                               |
| `VITE_API_URL`         | Fallback de build, útil em dev (`.env.local`).                                                         |
| `VITE_API_PROXY`       | **Só em dev.** Aponta o `/api` do vite dev-server para o backend local. Sem ela, o MSW serve os mocks. |

Nada disso é segredo: `VITE_*` é embutido no bundle e o `config.js` é servido ao
navegador. **Nenhuma credencial entra em nenhum dos dois** — SPA usa
Authorization Code + PKCE, sem client secret.

O mock (MSW) só sobe quando `import.meta.env.DEV` é verdadeiro (`src/main.tsx`),
então **o build de produção nunca carrega mock** — se a API não responder, a tela
mostra o estado de erro com "Tentar de novo".

---

## 2. Duas exigências do servidor de arquivos

> Já vem pronto: **`Dockerfile`** (nginx sem root na 8080), **`deploy/nginx.conf`**
> e os manifests de exemplo em **`deploy/k8s/`**. O que está abaixo explica o
> porquê de cada exigência, para quem for adaptar a outro servidor.

### 2.1 History fallback (obrigatório)

O app usa `createBrowserRouter`. Sem fallback, abrir/atualizar direto em
`/unidade/u-jacarei/cts` devolve **404** — só a raiz funcionaria.

```nginx
server {
  root /usr/share/nginx/html;

  # Assets com hash no nome: cache longo.
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # index.html nunca em cache: é ele que aponta para o bundle novo.
  location = /index.html {
    add_header Cache-Control "no-store";
  }

  location / {
    try_files $uri $uri/ /index.html;   # <- o fallback
  }
}
```

Equivalentes: `_redirects` com `/* /index.html 200` (Netlify), `rewrites` para
`/index.html` (Vercel), `--single` no `serve`.

### 2.2 `/api` na mesma origem (recomendado)

O caminho mais simples é o servidor de arquivos também fazer proxy de `/api`
para o backend. Assim `VITE_API_URL` fica no default, não há CORS e o cookie de
sessão (se o SSO usar cookie) é same-site.

```nginx
  location /api/ {
    proxy_pass http://cadastro-api:8000/;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;   # não engolir o Bearer
  }
```

Se preferir domínio separado, aponte `VITE_API_URL` para a URL absoluta e libere
CORS no backend para a origem do frontend, com `Authorization` nos
`Access-Control-Allow-Headers` e os métodos `GET, PUT, POST, DELETE`.

---

## 3. Contrato da API

### Leitura

Formato fixado por teste em `src/mocks/handlers.test.ts` — as fixtures em
`src/mocks/fixtures/` são exemplos válidos de cada resposta.

```
GET /regionais                      -> [{ id, nome }]
GET /regionais/:id/unidades         -> Unidade[]
GET /unidades/:id                   -> Unidade
GET /unidades/:id/sub-bacias        -> { arvore, subs }   # db: ver nota abaixo
GET /unidades/:id/contrato          -> { cidades, metas, fator }
GET /unidades/:id/etes              -> { etes }
GET /unidades/:id/hierarquia        -> { unidReg, superintendencias, cidades, sistemas, topo }
GET /unidades/:id/cts               -> { pares, ctss }
```

A ficha de coleta (sub-bacia e CTS, que são iguais) tem **dois blocos de origem
diferente**, e a régua da meta da cidade (`Cidade.cob`) decide o que aparece:

| Onde     | Campos                                                                                                                       | Origem                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `db`     | `fat`, `arr`, `ligU`/`ligA`/`ligN`, `ecoU`/`ecoA`/`ecoN` (`economias_novas_obras`), o recorte industrial (abaixo) e `ticket` | **Databricks** — travado, corrigível com override        |
| `params` | `preco`, `tarr`, `ramp`, `vaz`, `vazInd` (`vazao_contribuicao_industrial`), `pot`                                            | **a Regional preenche**                                  |
| `params` | `popU`, `popA`                                                                                                               | **a Regional preenche** — visíveis só na régua população |

> **`params` viaja sempre inteiro**, inclusive `popU`/`popA`. A régua da cidade
> decide se esses dois **aparecem na tela** e se contam pendência — não se são
> enviados. É de propósito: trocar a régua de uma cidade não pode apagar o que
> alguém já preencheu, e o PUT é substituição da ficha inteira (idempotente).
> Guarde-os como vierem, mesmo que a cidade meça por ligações; quem decide se
> eles são **usados** é a régua, na hora de verificar a meta.

Quatro consequências para o backend:

- **Recorte industrial**: as mesmas medidas do topo, restritas à categoria.

  | Chave     | Coluna                          |
  | --------- | ------------------------------- |
  | `ligUInd` | `universo_ligacoes_industrial`  |
  | `ligAInd` | `ligacoes_atuais_industrial`    |
  | `fatInd`  | `receita_faturada_industrial`   |
  | `arrInd`  | `receita_arrecadada_industrial` |

  **A regra que não pode ser esquecida:** as colunas "normais"
  (`universo_ligacoes`, `receita_faturada`, `vazao_contribuicao`…) **já são o
  total** — residencial **mais** industrial. As colunas `_industrial` guardam a
  **parcela** industrial, que já está contida nesse total. Então:

  | Rodada                       | Como ler                                                                                                      |
  | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
  | `INCLUIR_INDUSTRIAL = True`  | usa as colunas normais **como estão** (já são o total). As `_industrial` são ignoradas — **não se soma nada** |
  | `INCLUIR_INDUSTRIAL = False` | **residencial = total − industrial**: subtrai a parcela das colunas normais                                   |

  Exemplo: uma sub-bacia com `universo_ligacoes = 1.000` e
  `universo_ligacoes_industrial = 80` → com indústria, usa **1.000**; só
  residencial, **1.000 − 80 = 920**.

  Não é "normal + industrial" para somar, nem "só o normal" para o residencial.
  Somar duplicaria receita e cobertura; ignorar a parcela numa rodada só
  residencial contaria demanda que não existe naquele cenário.

  **A mesma regra vale para a vazão**, que é campo da Regional e não do
  Databricks: `vazao_contribuicao` é o total e `vazao_contribuicao_industrial`
  (`vazInd`, em `params`) é a parcela contida nele. Sem indústria na área, o
  valor é `0` — e, por ser resposta com valor próprio, **conta pendência**
  quando fica em branco.

  `INCLUIR_INDUSTRIAL` é **parâmetro da rodada de simulação**, não deste
  cadastro — como o `usar_cts`. O app não oferece a escolha; ele só carrega os
  dois números e explica a leitura (nota no card + dicionário de dados).

  Por consequência: os valores são **subconjuntos** dos totais
  (`ligUInd ≤ ligU`, `fatInd ≤ fat`) e não é trio de cobertura — **não vira
  denominador de meta nenhuma**. É o que explica o ticket, porque indústria
  costuma ser pouca ligação respondendo por uma fatia desproporcional da receita.

- **`db` sempre com ligações e economias completas**, para toda sub-bacia e CTS.
  A tela mostra os dois trios em qualquer régua e destaca o que é o denominador
  da meta — esconder um deles seria esconder dado que ninguém conferiria.
- **População não vem do Databricks.** `universo_populacao` e `populacao_atual`
  chegam e voltam em `params`, como qualquer parâmetro da Regional: sem trilha
  de override, e **contando pendência** quando a cidade mede por população. É
  isso que faz a completude cair e o hub segurar a simulação se a régua virar
  população depois do cadastro pronto.
- **`populacao_novas_obras` não existe no payload**: a tela calcula
  (`popU − popA`) e mostra como campo ƒ, sem input. Se um dia vier do
  Databricks, o ponto de troca é `popNovas()` em `src/domain/subbacia.ts`.

A lista de campos das duas telas vive em `src/domain/baseComercial.ts` — campo
novo entra ali e aparece na sub-bacia e na CTS.

### Obras (`obrasOverride`)

Cada componente tem estas colunas. A ficha manda **só o que difere da obra-base**
(`BASE_OBRAS` / `BASE_OBRAS_CTS` em `src/domain/`), por índice:

| Coluna               | Chave      | Obrigatória?                                      |
| -------------------- | ---------- | ------------------------------------------------- |
| componente           | `nome`     | fixa (não editável)                               |
| quantidade           | `qtd`      | sim                                               |
| unidade              | `un`       | fixa (vem da obra-base)                           |
| preco_unitario       | `preco`    | sim                                               |
| **capex**            | —          | **calculado** (`qtd × preco`), não vai no payload |
| opex                 | `opex`     | sim                                               |
| tempo_predecessoras  | `tPred`    | sim (0 = pode começar junto)                      |
| tempo_execucao       | `dur`      | sim                                               |
| obra_obrigatoria_ano | `anoObrig` | sim — **código**, ver abaixo                      |
| obra_proibida_ate    | `proibAte` | sim — **código**, ver abaixo                      |
| wacc                 | `wacc`     | **não** — vazio = usa o WACC médio da unidade     |

As duas janelas são código, não um ano qualquer:

| `obra_obrigatoria_ano` | significado                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `0`                    | não é obrigatória — a simulação decide se entra             |
| `-1`                   | é obrigatória, em qualquer ano — a simulação escolhe quando |
| `AAAA`                 | é obrigatória naquele ano exato                             |

| `obra_proibida_ate` | significado                       |
| ------------------- | --------------------------------- |
| `0`                 | sem impedimento                   |
| `AAAA`              | não pode **começar** até esse ano |

Por isso elas contam pendência: "sem restrição" tem valor próprio (`0`), então
campo em branco não é resposta — é silêncio que a simulação não sabe ler.
**Mande sempre um número nessas duas colunas**, nem que seja `0`. O `wacc` é o
único em que o vazio significa algo ("usa o WACC médio da unidade").

**Obra de terceiros** é uma leitura, não uma coluna: CAPEX `0` (quantidade ou
preço zerados) **com `tempo_execucao` maior que zero** significa que a obra
acontece e ocupa prazo na sequência — as obras que dependem dela esperam — mas o
investimento é de outro (loteador, prefeitura, contrapartida). Sem CAPEX **e**
sem prazo, a obra simplesmente não entra no plano. A tela marca essas linhas com
o selo "de terceiros" (`deTerceiros()` em `src/domain/subbacia.ts`); se um dia
virar coluna própria no Databricks, é ali que a regra muda.

### Escrita

Tipos e regras em `src/api/escrita.ts`; o corpo de cada ficha é montado num
lugar só (`src/state/fichas.ts`); handlers de exemplo em `src/mocks/handlers.ts`.
**Granularidade: uma ficha por vez** — o corpo carrega a ficha inteira
(idempotente), não um patch.

```
PUT    /unidades/:uid/sub-bacias/:subId   { params, db, obrasOverride, overrides }
PUT    /unidades/:uid/contrato/:cidId     { cidade, metas, fator, overrides }
PUT    /unidades/:uid/etes/:eteId         { ete, overrides }
PUT    /unidades/:uid/cts/:ctsId          { params, db, obrasOverride, overrides }
POST   /unidades/:uid/cts                 { subId, cts }   -> 201 com a CTS
DELETE /unidades/:uid/cts/:ctsId          -> 204
```

**`overrides` viaja junto com a ficha de propósito**: é a trilha de auditoria de
cada dado do Databricks sobrescrito (campo, valor antigo, valor novo, autor,
timestamp). Gravar na mesma transação do dado evita dado corrigido sem trilha.
Só entra na trilha o que **de fato** difere do valor do servidor: voltar o campo
ao valor original apaga o registro, então "X virou X" não chega até vocês.

Duas expectativas do lado da resposta:

- **O `POST /cts` devolve a CTS criada, e é essa versão que entra no cadastro.**
  Se o backend normalizar campos ou gerar outro id, mande no corpo do 201 — o
  front adota o que voltou, não a cópia que enviou.
- **Corpo de 2xx é JSON ou vazio.** `204` e corpo vazio viram `undefined`;
  `Content-Type` não-JSON (o HTML de login de um proxy, por exemplo) vira erro
  de API na hora, com a tela de erro — não um estouro tardio dentro da tela.
- **Número é string pt-BR estrita**: `1.234,5`, `784`, `-50`. O front recusa
  qualquer coisa fora disso (`"1.234 hab."`, `"123abc"`, `"1.2"`) e mostra
  travessão em vez de calcular por cima de dado sujo. **Não mande unidade nem
  símbolo dentro do valor** — a unidade é da tela.

Códigos que a UI já distingue (`src/api/client.ts`, `mensagemDeErro`):

| Código    | O que a tela faz                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------- |
| 400 / 422 | "O servidor recusou os dados desta ficha."                                                           |
| 401 / 403 | "Sua sessão expirou." + dispara o fluxo de re-login                                                  |
| 409       | Pergunta se pode **recarregar do servidor** (descarta o estado local desta unidade e semeia de novo) |
| outros    | "Não foi possível salvar (erro N)."                                                                  |

---

## 4. SSO

O client já manda `Authorization: Bearer <token>` **quando um provedor de token
está registrado**, e chama um callback em 401/403. A biblioteca do IdP ainda não
foi escolhida, então o encaixe está isolado em `src/auth/sessao.ts` e nada mais
no app depende dela.

Os parâmetros (`authority`, `clientId`, `escopos`) vêm do `/config.js`, então
mudam por ambiente sem rebuild — leia `config` de `src/config.ts` e use
`temSso()` para decidir se inicializa a lib.

Para ligar, no bootstrap (`src/main.tsx`), depois de inicializar a lib do SSO:

```ts
import { configurarSessao } from './auth/sessao'

configurarSessao({
  // Chamado a cada request: devolva o access token válido (a lib renova sozinha).
  token: async () => (await msal.acquireTokenSilent(escopos)).accessToken,
  // Servidor recusou a credencial: mande o usuário logar de novo.
  onNaoAutorizado: () => msal.loginRedirect(escopos),
})
```

Falta decidir (precisa vir de quem administra o SSO):

- **qual IdP e biblioteca** — Entra ID/Azure AD (`@azure/msal-browser`) é o
  provável, dado o restante do ambiente; alternativa genérica: `oidc-client-ts`;
- **tenant id, client id e escopo** da API do cadastro;
- **fluxo**: redirect (mais simples e robusto) ou popup;
- se o backend valida **token Bearer** ou **cookie de sessão** — se for cookie,
  troque o provedor de token por `credentials: 'include'` no `client.ts`;
- **de onde sai o autor do override**: hoje é a constante `AUTOR` em
  `src/state/cadastroReducer.ts`. Com SSO, passa a ser o usuário logado.

Enquanto nada é registrado, o app funciona sem header — que é o modo de dev com
MSW.

---

## 5. O que o app faz com a edição antes de ela chegar em vocês

O Salvar é por ficha e manual, então entre a digitação e o PUT existe um estado
que só o navegador conhece. Duas coisas cuidam dele:

- **O app sabe o que ainda não foi enviado.** Cada ficha guarda a assinatura do
  último corpo que o servidor aceitou (`src/state/fichas.ts`); enquanto o
  conteúdo atual difere dela, o Salvar fica ativo, o selo ao lado dele diz
  "Alterações não salvas", o header conta quantas fichas estão nesse estado e
  sair da unidade (ou fechar a aba) pede confirmação. Sem diferença, o botão
  fica apagado — **o servidor não recebe PUT sem mudança**.
- **A edição sobrevive a um F5.** O estado é espelhado no `sessionStorage` por
  unidade (`src/state/rascunho.ts`) e volta quando a tela remonta, com um aviso.
  O rascunho é apagado quando tudo está salvo. É rede de segurança da aba, não
  persistência: fechar a aba descarta (aí vale o aviso do navegador).
- **Rascunho velho não passa despercebido.** Cada fatia semeada guarda a
  assinatura do payload que a originou. Ao recuperar um rascunho, o app compara
  com o que a rede acabou de trazer; se o servidor mudou nesse meio tempo, ele
  avisa e oferece recarregar de lá.

Consequência para o backend: **um Salvar = uma mudança real**. Se chegarem dois
PUT idênticos seguidos, é retry, não duplo clique.

**Como o app abandona o estado local** (`src/state/recarregar.ts`): apaga o
rascunho → zera o cache das 5 fatias → remonta o store, que semeia do servidor.
Um refetch sozinho não bastaria: o seed só preenche fatia vazia, de propósito —
senão um refetch de fundo apagaria o que a pessoa está digitando.

---

## 6. Pendências conhecidas (não bloqueiam o deploy, mas o backend precisa saber)

- **Concorrência**: não há versão/ETag. Duas pessoas na mesma ficha: a última
  sobrescreve, e o 409 só aparece se o backend detectar o conflito por conta
  própria. Quando existir versão por ficha, o front já tem o fluxo de 409 pronto
  — falta enviar a versão junto e comparar.
- **A hierarquia não tem gravação.** A tela do Grupo 01 deixa corrigir dado do
  Databricks (e monta a trilha de override), mas não há endpoint para mandar
  isso — a tela avisa o usuário, e as correções ficam só no rascunho da aba.
  Quando existir um `PUT /unidades/:uid/hierarquia` (corpo: a hierarquia inteira
  - `overrides`), ela entra como as outras: vira uma ficha em
    `src/state/fichas.ts`, entra em `sujas` e ganha o botão Salvar.
- **Importar planilha** é um stub: o botão no hub só mostra um aviso.
- **O rascunho é da aba**: fechar a aba (não recarregar) descarta o que não foi
  salvo. O aviso do navegador ao fechar é o que existe hoje contra isso.
- **Rerender amplo**: o contexto do cadastro entrega o estado inteiro, então
  cada tecla rerenderiza todos os consumidores. Não incomoda no volume atual
  (dezenas de fichas); se uma unidade grande ficar lenta, o caminho é dividir o
  contexto por fatia.
