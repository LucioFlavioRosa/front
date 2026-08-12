# Colocar em produção e ligar o backend

Este é o **frontend** do Cadastro de Dados do Otimizador CAPEX. O build é um
site estático (`npm run build` → `dist/`). Ele não tem servidor próprio: precisa
de um servidor de arquivos com duas configurações e de uma API que honre o
contrato descrito abaixo.

---

## 1. Configuração

A config real vem de **`/config.js`**, resolvida em runtime — não de variável de
build. Isso é o que permite **uma imagem só** rodar em todos os ambientes: cada
um monta o seu `/config.js` por ConfigMap. Precedência em `src/comum/config.ts`:
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

> Esta seção cobre o **cadastro**. O contrato das duas áreas novas — resultados
> (leitura de uma rodada) e nova simulação (o disparo) — está em
> [`CONTRATO.md`](CONTRATO.md), com as garantias que o backend precisa honrar.

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
GET /unidades/:id/cts               -> { pares, ctss, inconsistencias }
```

**`Unidade.resumo` — o porte da unidade.** Duas telas dependem dele: a seleção do
cadastro e o **resumo da nova simulação**, que o usa para dizer se a rodada é de
minutos ou de meia hora antes de disparar.

```jsonc
// Unidade Norte Litoral, medida na base de desenvolvimento
"resumo": {
  "cidades": 21,
  "sistemas": 155,
  "subBacias": 751,
  "cts": 151, // esparsas — zero é comum, e a tela mostra "0 CTS"
  "etes": 155,
  "obras": 2799, // = obrasAegea + obrasTerceiros
  "obrasAegea": 2615, // capex > 0
  "obrasTerceiros": 184, // capex = 0 e tempo_execucao > 0
  "semObra": 1560 // capex = 0 e tempo_execucao = 0
}
```

**As três categorias de componente**, e por que o total sozinho não serve:

| categoria        | regra                              | o que é                                    |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| `obrasAegea`     | `capex > 0`                        | investimento da Aegea                      |
| `obrasTerceiros` | `capex = 0` e `tempo_execucao > 0` | a obra acontece e ocupa prazo; outro paga  |
| `semObra`        | `capex = 0` e `tempo_execucao = 0` | o elemento existe na ficha e não gera obra |

São exaustivas e não se sobrepõem: somadas dão o total de linhas de
`componentes_subbacias_capex` + `componentes_cts_capex` da unidade. Conte-as, não
as deduza de constantes — a base tem 5 linhas por sub-bacia e 4 por CTS hoje, mas
isso é dado, não contrato.

`obras` (= Aegea + terceiros) é **o mesmo critério do motor**
(`otimizador_capex_v62.ler_banco`: `necess = capex > 0 or tempo_execucao > 0`).
Ele ainda fica **abaixo** do que o motor conta, e a diferença é conhecida: falta
uma obra por ETE de sistema e, com `ETE_FASEADA`, os módulos de expansão. Esses
dependem de parâmetro da **rodada**, então nenhum número por unidade os alcança —
e a tela não promete que alcança.

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
  Databricks, o ponto de troca é `popNovas()` em `src/cadastro/domain/subbacia.ts`.

A lista de campos das duas telas vive em `src/cadastro/domain/baseComercial.ts` — campo
novo entra ali e aparece na sub-bacia e na CTS.

### Trilha de auditoria (`GET /unidades/:uid/alteracoes`)

Quem mudou o quê, quando — a ficha inteira, e não só o bloco do Databricks.

```jsonc
{
  "alteracoes": [
    {
      "tipo": "sub-bacia", // sub-bacia | cts | ete | cidade
      "fichaId": "b1b25_1_1",
      "campo": "obra:Rede coletora:qtd",
      "de": "2.472,6", // null = não existia (foi criado)
      "para": "3.000", // null = deixou de existir (foi removido)
      "autor": "ana@aegea",
      "quando": "2026-08-10T14:32:00+00:00",
      "origem": "regional", // databricks | regional
    },
  ],
  "cortado": false, // true = o servidor cortou no teto; NÃO é o histórico inteiro
}
```

**`campo` usa a IDENTIDADE do registro, nunca a posição.** Três formas compostas:

| forma                        | exemplo                  | por quê                                                       |
| ---------------------------- | ------------------------ | ------------------------------------------------------------- |
| `obra:<componente>:<campo>`  | `obra:Rede coletora:qtd` | a obra não tem id próprio; quem a identifica na tela é o nome |
| `meta:<ano>:pct`             | `meta:2030:pct`          | a meta é identificada pelo ano                                |
| `faixa:<cobertura>:paridade` | `faixa:80:paridade`      | a faixa, pela cobertura                                       |

Por índice (`obra:2:qtd`) seria mais curto, não diria nada a quem abre a auditoria
seis meses depois, e mudaria de significado se a ordem mudasse.

**`origem` separa correção de preenchimento** — `databricks` é discordar de um
número que veio de fora, `regional` é a Regional fazendo o próprio trabalho. A
tela usa verbos diferentes ("corrigiu" / "alterou"), e é a distinção que a
auditoria existe para fazer. Fica **gravada**, e não derivada do nome do campo:
o conjunto do que vem do Databricks muda com o tempo, e uma trilha cuja leitura
muda retroativamente não é trilha.

A tela abre isto pela linha "última alteração" do cabeçalho da ficha. Os dois se
completam: a linha responde "alguém mexeu depois de mim?" (a pergunta do momento
da edição), o painel responde "de quanto para quanto, e por quem" (a que aparece
meses depois).

### Obras (`obrasOverride`)

Cada componente tem estas colunas. A ficha carrega a obra **inteira**, por
índice — `{"0": {...}, "1": {...}}`, na posição do componente:

| Coluna               | Chave      | Obrigatória?                                      |
| -------------------- | ---------- | ------------------------------------------------- |
| componente           | `nome`     | fixa (não editável)                               |
| quantidade           | `qtd`      | sim                                               |
| unidade              | `un`       | fixa (vem do banco, não editável)                 |
| preco_unitario       | `preco`    | sim                                               |
| **capex**            | —          | **calculado** (`qtd × preco`), não vai no payload |
| opex                 | `opex`     | sim                                               |
| tempo_predecessoras  | `tPred`    | sim (0 = pode começar junto)                      |
| tempo_execucao       | `dur`      | sim                                               |
| obra_obrigatoria_ano | `anoObrig` | sim — **código**, ver abaixo                      |
| obra_proibida_ate    | `proibAte` | sim — **código**, ver abaixo                      |
| wacc                 | `wacc`     | **não** — vazio = usa o WACC médio da unidade     |

> **Não há obra-base, dos dois lados.** Havia: duas listas literais de 5 e 4
> obras, uma em `src/cadastro/domain/` e outra em `cadastro_escrita.py`, e o
> `obrasOverride` era mesmo um override sobre elas. As duas saíram (R1/R2).
>
> O que elas produziam, medido: um `PUT` numa ficha sem o componente gravado
> escrevia `Linha de recalque (LR) | qtd 0 | preco 900 | dur 15 | wacc 0,067` —
> números que ninguém digitou e que o banco não tem, indo para a simulação com
> cara de cadastro. A tela mostrava 5 linhas onde havia 4, e a quinta era
> invenção.
>
> Três consequências para quem integra:
>
> 1. o `GET` manda `nome` e `un` junto dos números — a linha inteira vem do banco;
> 2. o `PUT` **recusa** (422) a ficha cujo banco tem menos que 5 (ou 4)
>    componentes: completá-los seria inventá-los;
> 3. `GET /unidades/:uid/prontidao` devolve `faltando[]` dizendo **qual**
>    componente falta em qual ficha — a tela não teria como saber, porque a linha
>    que falta não chega no payload.

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
o selo "de terceiros" (`deTerceiros()` em `src/cadastro/domain/subbacia.ts`); se um dia
virar coluna própria no Databricks, é ali que a regra muda.

### Escrita

Tipos e regras em `src/cadastro/api/escrita.ts`; o corpo de cada ficha é montado num
lugar só (`src/cadastro/state/fichas.ts`); handlers de exemplo em `src/mocks/handlers.ts`.
**Granularidade: uma ficha por vez** — o corpo carrega a ficha inteira
(idempotente), não um patch.

```
PUT    /unidades/:uid/sub-bacias/:subId   { params, db, obrasOverride, overrides }
PUT    /unidades/:uid/contrato/:cidId     { cidade, metas, fator, overrides }
PUT    /unidades/:uid/etes/:eteId         { ete, overrides }
PUT    /unidades/:uid/cts/:ctsId          { params, db, obrasOverride, overrides }

resposta (todas): { id, alteracoesGravadas, atualizadoEm, atualizadoPor }

GET    /unidades/:uid/alteracoes?tipo=&fichaId=&limite=
       -> { alteracoes: [...], cortado: bool }
```

**O corpo NÃO carrega a trilha de auditoria.** Ele carregava: um campo
`overrides` com `{campo, valorAntigo, valorNovo, autor}`, montado pela tela. Saiu,
e o motivo é o mesmo da `versao` — o cliente não é fonte confiável sobre si mesmo:

- auditoria montada pelo auditado quebra em silêncio (um bug na tela, e o rastro
  some sem sinal);
- ela cobria **um quarto da ficha**: só o bloco do Databricks virava override, e
  `params`, obras, cidade e ETE não deixavam rastro nenhum;
- o `valorAntigo` era o valor lido no SEED, então duas edições na mesma sessão
  gravavam `A → B` e depois `A → C`, quando o segundo salto foi `B → C`.

Hoje o **servidor compara** o que está gravado com o que chega, campo a campo,
antes de cada gravação. `alteracoesGravadas` diz quantas diferenças ele viu —
zero é resposta legítima (salvar sem mudar nada não gera trilha).

**Auditoria da ficha.** As quatro fichas trazem no `GET` — e a resposta do `PUT`
devolve — dois campos que o corpo **nunca envia**:

| campo           | forma                                           |
| --------------- | ----------------------------------------------- |
| `atualizadoEm`  | ISO-8601 com fuso, ou `""` se nunca foi gravada |
| `atualizadoPor` | login de quem gravou, ou `""`                   |

Três regras, e as três importam:

1. **O autor vem do TOKEN**, nunca do corpo. Um cliente que pudesse escolher o
   nome que assina transformaria a auditoria em decoração.
2. **A resposta do PUT traz o carimbo novo**, já com aquela gravação aplicada.
   Sem isso a ficha continuaria exibindo "última alteração: fulano, ontem" no
   segundo seguinte a você salvar, até alguém recarregar.
3. **Vazio, e não nulo.** A tela trata todo campo de ficha como texto e chama
   `.trim()`; um `null` ali derruba a tela inteira, não só o campo. E ficha nunca
   gravada pela tela não ganha data inventada — as 4.850 sub-bacias vieram da
   planilha, e a coluna só existe desde a migração `006_auditoria_cadastro.sql`.

A escrita de ficha **não tem controle otimista** (R6): ver §6.

> **Não há criar nem remover CTS.** A CTS é um **nó do sistema**, como a sub-bacia:
> a posição dela vem da topologia (`sistema_topologia`), com jusante próprio. O motor
> monta os nós percorrendo a topologia e faz `cts_ids = fichas ∩ nós` — só é CTS
> efetiva a ficha que **também** é nó.
>
> Um `POST` que gravasse ficha e par sem tocar na topologia criaria uma CTS visível
> no cadastro e invisível para a simulação. Um `DELETE` que apagasse a ficha e
> deixasse o nó seria pior: a CTS viraria um nó de demanda **zero** e, sem o par, a
> demanda dela deixaria de ser somada à sub-bacia irmã com `USAR_CTS` desligado.
>
> `subbacia_cts` é **sobreposição de área**, não pertencimento — é o que permite ao
> `USAR_CTS` escolher entre CTS como estrutura própria ou demanda somada à
> sub-bacia pareada. Criar ou remover CTS é mudança de topologia, e topologia vem do
> cadastro estrutural (Grupo 01).

**`inconsistencias`** é o outro lado dessa modelagem. Como a CTS precisa de três
coisas para existir — nó na topologia, ficha em `cts_operacional` e par em
`subbacia_cts` — faltando qualquer uma delas o efeito é silencioso: a rodada
roda, o plano sai, e o número está errado sem nenhum erro em lugar nenhum. O pior
caso é o nó sem ficha, que **entra** na simulação com demanda zero.

```
inconsistencias: [{ tipo, id, subId, detalhe }]
tipo: 'ficha-sem-no' | 'no-sem-ficha' | 'sem-par'
```

Elas cruzam com `ctss`, não o substituem: uma CTS com ficha mas sem nó aparece
nos dois (continua editável, e agora se sabe que a simulação não a vê), enquanto
um nó sem ficha só existe aqui, porque não há ficha para editar. Servir a lista
sem isso era o comportamento anterior — e foi assim que duas CTS ficaram meio
existindo no cadastro real sem ninguém notar.

**A trilha de auditoria não viaja no corpo do PUT.** O servidor compara o que
está gravado com o que chega e registra a diferença na mesma transação do dado —
dado corrigido sem trilha fica impossível. Só entra o que **de fato** difere:
salvar sem mudar nada grava zero linhas (`alteracoesGravadas: 0` é resposta
legítima). Para ler a trilha, `GET /unidades/:uid/alteracoes`, acima.

Duas expectativas do lado da resposta:

- **Corpo de 2xx é JSON ou vazio.** `204` e corpo vazio viram `undefined`;
  `Content-Type` não-JSON (o HTML de login de um proxy, por exemplo) vira erro
  de API na hora, com a tela de erro — não um estouro tardio dentro da tela.
- **Número é string pt-BR estrita**: `1.234,5`, `784`, `-50`. O front recusa
  qualquer coisa fora disso (`"1.234 hab."`, `"123abc"`, `"1.2"`) e mostra
  travessão em vez de calcular por cima de dado sujo. **Não mande unidade nem
  símbolo dentro do valor** — a unidade é da tela.

Códigos que a UI já distingue (`src/comum/api/client.ts`, `mensagemDeErro`):

| Código    | O que a tela faz                                    |
| --------- | --------------------------------------------------- |
| 400 / 422 | "O servidor recusou os dados desta ficha."          |
| 401 / 403 | "Sua sessão expirou." + dispara o fluxo de re-login |
| outros    | "Não foi possível salvar (erro N)."                 |

O `409` saiu desta tabela junto com o 409 de ficha. O fluxo de **recarregar do
servidor** continua existindo, com o outro gatilho que sempre teve: rascunho
local recuperado sobre dado que mudou no servidor.

---

## 4. SSO

O client já manda `Authorization: Bearer <token>` **quando um provedor de token
está registrado**, e chama um callback em 401/403. A biblioteca do IdP ainda não
foi escolhida, então o encaixe está isolado em `src/comum/auth/sessao.ts` e nada mais
no app depende dela.

Os parâmetros (`authority`, `clientId`, `escopos`) vêm do `/config.js`, então
mudam por ambiente sem rebuild — leia `config` de `src/comum/config.ts` e use
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
  `src/cadastro/state/cadastroReducer.ts`. Com SSO, passa a ser o usuário logado.

Enquanto nada é registrado, o app funciona sem header — que é o modo de dev com
MSW.

---

## 5. O que o app faz com a edição antes de ela chegar em vocês

O Salvar é por ficha e manual, então entre a digitação e o PUT existe um estado
que só o navegador conhece. Duas coisas cuidam dele:

- **O app sabe o que ainda não foi enviado.** Cada ficha guarda a assinatura do
  último corpo que o servidor aceitou (`src/cadastro/state/fichas.ts`); enquanto o
  conteúdo atual difere dela, o Salvar fica ativo, o selo ao lado dele diz
  "Alterações não salvas", o header conta quantas fichas estão nesse estado e
  sair da unidade (ou fechar a aba) pede confirmação. Sem diferença, o botão
  fica apagado — **o servidor não recebe PUT sem mudança**.
- **A edição sobrevive a um F5.** O estado é espelhado no `sessionStorage` por
  unidade (`src/cadastro/state/rascunho.ts`) e volta quando a tela remonta, com um aviso.
  O rascunho é apagado quando tudo está salvo. É rede de segurança da aba, não
  persistência: fechar a aba descarta (aí vale o aviso do navegador).
- **Rascunho velho não passa despercebido.** Cada fatia semeada guarda a
  assinatura do payload que a originou. Ao recuperar um rascunho, o app compara
  com o que a rede acabou de trazer; se o servidor mudou nesse meio tempo, ele
  avisa e oferece recarregar de lá.

Consequência para o backend: **um Salvar = uma mudança real**. Se chegarem dois
PUT idênticos seguidos, é retry, não duplo clique.

**Como o app abandona o estado local** (`src/cadastro/state/recarregar.ts`): apaga o
rascunho → zera o cache das 5 fatias → remonta o store, que semeia do servidor.
Um refetch sozinho não bastaria: o seed só preenche fatia vazia, de propósito —
senão um refetch de fundo apagaria o que a pessoa está digitando.

---

## 6. Pendências conhecidas (não bloqueiam o deploy, mas o backend precisa saber)

- **Concorrência**: duas pessoas na mesma ficha podem sobrescrever uma à outra,
  e **sem aviso no momento da gravação**. É decisão do dono do produto (R6):
  barrar por hash da ficha INTEIRA fazia quem editava um campo perder o trabalho
  porque um colega editara outro.

  O sinal é posterior e legível, e não imediato e cego: toda ficha traz
  `atualizadoEm`/`atualizadoPor`, a tela mostra "última alteração: ana@aegea,
  10/08 14:32", e o painel de histórico abre por ela. Se um dia o conflito
  precisar ser barrado, o caminho é comparar por CAMPO — não o hash da ficha.

- **A hierarquia não tem gravação.** A tela do Grupo 01 deixa corrigir dado do
  Databricks, mas não há endpoint para mandar isso — a tela avisa o usuário, e as
  correções ficam só no rascunho da aba. Quando existir um
  `PUT /unidades/:uid/hierarquia` (corpo: a hierarquia inteira), ela entra como
  as outras: vira uma ficha em `src/cadastro/state/fichas.ts`, entra em `sujas` e
  ganha o botão Salvar.
- **Importar planilha** é um stub: o botão no hub só mostra um aviso.
- **O rascunho é da aba**: fechar a aba (não recarregar) descarta o que não foi
  salvo. O aviso do navegador ao fechar é o que existe hoje contra isso.
- **Rerender amplo**: o contexto do cadastro entrega o estado inteiro, então
  cada tecla rerenderiza todos os consumidores. Não incomoda no volume atual
  (dezenas de fichas); se uma unidade grande ficar lenta, o caminho é dividir o
  contexto por fatia.
