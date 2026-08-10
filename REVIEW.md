# Guia de revisão

Este documento existe para você não perder tempo descobrindo sozinho _por que_
o código é como é. Ele tem duas partes: uma **ordem de leitura** e a lista das
**decisões que parecem erradas até você saber o motivo** — cada uma com onde
está o teste que a segura.

Antes de tudo:

```bash
npm install
npm run verificar    # lint + formatação + build + 299 testes
npm run dev          # a tela, com dados de mentira
```

Se `verificar` passar, o mecânico está de pé e você pode gastar sua atenção na
lógica.

---

## Ordem de leitura sugerida (~1h)

O `src/` está organizado por **área de produto** — `cadastro/`, `resultado/`,
`simulacao/` — com `comum/` para o que não é de nenhuma e `app/` para as rotas e
as cascas. Dá para ler uma área inteira sem abrir as outras: o ESLint recusa uma
importar a outra, então não há fio escondido.

Se você tem uma hora, leia **o cadastro**, que é a área mais densa e a única que
escreve:

1. **`README.md`** — o que é o app e de onde vem o dado.
2. **`src/cadastro/domain/`** — as regras, sem React. Comece por `subbacia.ts`:
   obras, CAPEX, o que conta pendência. Depois `baseComercial.ts` (quais campos
   existem em cada ficha) e `cts.ts` (a irmã da sub-bacia).
3. **`src/cadastro/state/cadastroReducer.ts`** — o coração. Toda mutação passa
   por aqui. Leia `State`, as actions e `derive()` (contadores e completude).
4. **`src/cadastro/state/fichas.ts`** — o que é uma "ficha", como o corpo do PUT
   é montado e como o app sabe o que ainda não foi salvo.
5. **`src/cadastro/state/CadastroContext.tsx`** — a costura: queries, seed,
   rascunho e a superfície que as telas consomem. É o arquivo mais denso do
   projeto.
6. **Uma tela inteira**: `src/cadastro/pages/GrupoSubBacias.tsx` (a de
   referência). As outras quatro seguem o mesmo formato.
7. **`src/cadastro/api/escrita.ts` + `DEPLOY.md`** — o contrato que o backend
   terá de honrar. É o documento que sai daqui para outra equipe.
8. **Testes**, na ordem: `cadastro/domain/pendencias.test.ts` →
   `cadastro/state/cadastroReducer.test.ts` → `cadastro/escrita.test.tsx` →
   `cadastro/rascunho.test.tsx`.

As outras duas áreas são de **leitura** e cabem em bem menos tempo:

| Área        | Ordem                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resultado` | `domain/resultado.ts` (o contrato inteiro, comentado) → `api/queries.ts` (por que o cache é eterno) → `pages/Historico.tsx` → uma página funda, `pages/Sistema.tsx` |
| `simulacao` | `domain/simulacao.ts` (parser pt-BR, validação, corpo do POST) → `pages/Simular.tsx`                                                                                |

E o `CONTRATO.md`, que é o que essas duas áreas pedem do backend — vale mais que
qualquer código delas se você for escrever o servidor.

O que **não** precisa ler linha a linha: `src/mocks/` (backend de mentira),
`src/cadastro/components/CascadeTree.tsx`, `src/resultado/components/graficos.tsx`
(SVG na mão) e os `.module.css` (fidelidade ao protótipo).

---

## Decisões que parecem estranhas — e o porquê

### 1. O seed só preenche fatia vazia

`CadastroContext.tsx` semeia cada fatia **uma vez**, com `if (data && !state.x)`.
Parece bug ("e se o servidor mudar?"), mas é proteção: um refetch de fundo
sobrescreveria o que a pessoa está digitando. Trocar dado já carregado é
operação explícita — ver item 6.

### 2. Existem **dois** baselines, e isso é de propósito

- `originalSubs` / `originalHier` / `originalCtss`: o dado **bruto do
  Databricks**. É o `valorAntigo` da trilha de override, e não muda nunca.
- `salvas`: assinatura de cada ficha **no último salvamento aceito**. É o que
  responde "tem mudança para salvar?".

Unificar os dois quebraria a auditoria: depois de salvar, o "valor antigo" viraria
o valor recém-gravado e a origem Databricks se perderia.
→ `state/cadastroReducer.test.ts`, bloco "fichas não salvas".

### 3. Reverter uma edição limpa a ficha

Voltar um campo ao valor do servidor faz a ficha deixar de estar suja. Quem
responde isso é a comparação de **conteúdo** (`assinatura` em `state/fichas.ts`).

Havia aqui um segundo mecanismo: o mapa de `overrides` do cliente, do qual a
reversão apagava a entrada. Ele saiu junto com a trilha montada no front — o
servidor calcula a diferença agora —, e com ele saiu a razão de existir do
mecanismo: a assinatura não inclui mais trilha nenhuma.

Nas **obras** isso mudou: elas não têm mais obra-base para comparar, e o mapa
carrega a obra inteira como o servidor a mandou. Apagar chave dali criaria buraco
— o campo voltaria vazio na tela e o `PUT` gravaria NULL numa coluna que tinha
valor. O "digitou de volta o original" continua funcionando sem truque: valor
igual, assinatura igual, ficha limpa.
→ `cadastroReducer.test.ts`, bloco "reverter uma edição desfaz o registro dela".

### 4. Callback que mexe no store fica no nível do hook

> Esta seção descrevia a **criação de CTS**, que não existe mais: a CTS é nó da
> topologia, e criá-la pela tela produzia uma ficha que o motor nunca carrega
> (ver `DEPLOY.md` §3). O teste citado — `escrita.test.tsx`, bloco "criar CTS" —
> foi removido junto. A regra abaixo sobreviveu ao fluxo que a originou, e é o
> motivo de a seção continuar aqui.

A regra veio de uma criação otimista que foi implementada e revertida: o rollback
vivia no callback por chamada de `mutate`, que o TanStack **não dispara** quando o
observer perde os listeners — o usuário sai da tela antes da resposta e o rollback
nunca roda. E, quando rodava, apagava o que a pessoa tivesse digitado durante o voo.

Daí: **callback que mexe no store fica no nível do hook**
(`useMutation({ onSuccess })` em `api/mutations.ts`); callback que só mostra toast
pode ficar no `mutate(vars, {...})` da página.

É a mesma razão pela qual a **auditoria** devolvida pelo PUT (`atualizadoEm`,
`atualizadoPor`) volta ao store por `onSuccess` do hook, e não pela página. Ela
substituiu a `versao`, que fazia o mesmo caminho quando havia 409 de ficha.
→ `escrita.test.tsx`, bloco "o ciclo da auditoria".

### 5. O rascunho entra **no lugar** do seed

`sessionStorage`, por unidade. Ao montar, o estado hidratado já vem preenchido —
por isso os efeitos de seed não disparam e a rede não sobrescreve a edição.
Duas armadilhas que já morderam e agora têm proteção:

- **Campo novo no `State` tem de entrar em `seeded()` e subir a `VERSAO`** do
  rascunho. Senão um rascunho da versão anterior hidrata um estado "completo"
  sem o campo, o seed não roda de novo e o campo fica `undefined` pelo resto da
  sessão. Já aconteceu duas vezes (com `cidadeDaSub` e com `vazInd`) — por isso
  existe `formatoCompativel()`, que compara as chaves do rascunho com as que o
  domínio espera hoje (`CHAVES_DB`, `CHAVES_PARAMS`) e descarta o que não bate.
  A versão continua sendo a documentação da mudança; a conferência de formato é
  o que impede a tela branca quando alguém esquece de subi-la.
- **Descartar o rascunho precisa marcar a unidade** (`descartarRascunho`): o
  flush de saída do provider antigo, ao remontar, regravaria o que acabou de ser
  descartado.

→ `app.rascunho.test.tsx`, blocos "rascunho local", "rascunho gravado por uma
versão anterior" e "rascunho feito sobre dado que já mudou".

### 6. "Recarregar do servidor" desmonta o store inteiro

`state/recarregar.ts`: apaga o rascunho → **aguarda** `resetQueries` → sobe a
geração, que entra na `key` do `CadastroProvider` e o remonta do zero. É a única
forma de trocar dado já semeado (ver item 1). Um refetch sozinho não faria nada.
Usado quando o rascunho recuperado é mais velho que o servidor. Era usado também
no 409 de ficha, que saiu (R6) — o gatilho do rascunho é o que restou, e é o que
os testes exercitam.

### 7. A régua da cidade muda o que a ficha cobra

A cobertura é atributo da **cidade** (Grupo 02). Quando ela é `população`, a ficha
da sub-bacia (e da CTS pareada) ganha dois campos que **contam pendência** — o
numerador _e_ o denominador da completude variam por ficha.

Isso é o que torna seguro esconder esses campos nas outras réguas: se a régua
virar população depois do cadastro pronto, os campos entram vazios, a completude
cai e o hub trava a simulação. O de-para sub-bacia → cidade vem da árvore e vive
em `State.cidadeDaSub` (o reducer não tinha como chegar na cidade sozinho).
→ `cadastroReducer.test.ts`, bloco "população conta como pendência só na régua
certa"; `app.populacao.test.tsx`.

### 8. O mock repete a conta de pendência/completude

`src/mocks/handlers.ts` calcula os mesmos totais que `derive()`. É duplicação
consciente: o mock faz o papel do **backend**, e o hub compara o número dele com
o número derivado no cliente. Se um dia divergirem, é sinal de que a regra mudou
de um lado só.

### 9. `fichas.ts` importa `State` como **tipo**

`cadastroReducer.ts` importa funções de `fichas.ts`, e `fichas.ts` importa
`State` de volta. O `import type` é apagado na compilação, então não há ciclo em
runtime. Se alguém trocar por um import de valor, quebra em produção de um jeito
difícil de diagnosticar.

### 10. `num()` é estrito de propósito

Só aceita número pt-BR (`1.234,5`, `784`, `-50`). `"1.234 hab."`, `"123abc"` e
`"1.2"` viram `null` → a tela mostra travessão. Com `parseFloat`, dado sujo do
Databricks gerava CAPEX e população de aparência correta.
→ `domain/pendencias.test.ts`, bloco `num()`.

### 11. Nem todo campo vazio é pendência

- `wacc` vazio significa "usa o WACC médio da unidade" — resposta válida.
- `obra_obrigatoria_ano` e `obra_proibida_ate` têm código próprio para "sem
  restrição" (`0`), então vazio **é** pendência.
- "Obra de terceiros" não é coluna: é a leitura de **CAPEX 0 com prazo > 0** —
  a obra acontece e ocupa lugar na sequência, mas o investimento é de outro.

→ `components/obrasTable.test.tsx`.

### 12. Coisas que a acessibilidade explica

- O selo "régua da meta desta cidade" é **texto escondido** dentro do rótulo: cor
  sozinha não informa, e ele precisa entrar no _nome_ do campo, não numa
  descrição.
- Campos ƒ são `<output>` com `aria-labelledby`: o leitor de tela anuncia sozinho
  quando o número recalcula.
- O rail **não** usa `role="tree"`: é padrão de disclosure buttons, porque aqui
  alcançar cada linha com Tab é melhor que o tab-stop único do padrão ARIA.
  Decisão consciente — não é esquecimento.

### 13. Cinco `eslint-disable` de `set-state-in-effect`

Nas cinco telas de grupo, a seleção inicial ("abre na primeira sub-bacia") só
pode existir depois que a lista chega da rede, então nasce num efeito. Roda uma
vez por unidade. Se você conhecer um jeito melhor de derivar isso no render sem
perder o estado de expansão do rail, é uma melhoria legítima — foi deixada de
fora para não refatorar cinco telas às vésperas da revisão.

### 14. O `Request` de mentira em `src/setupTestes.ts`

Navegação de data router do React Router monta um `Request` com o `AbortSignal`
do jsdom, que o `Request` do Node recusa. É atrito de ambiente, não do app (no
navegador os dois são nativos). Sem o shim, **qualquer** teste que navega quebra.

---

## Onde eu olharia com mais desconfiança

Pontos que passaram por revisão automatizada, mas que merecem seu olho:

1. **`CadastroContext.tsx`** — 460 linhas e um value de ~30 membros. Funciona e
   está testado, mas é o candidato natural a ser dividido por fatia. Não fiz
   antes da revisão para não trocar risco conhecido por risco novo.
2. **`GrupoCts.tsx` (586 linhas) espelha `GrupoSubBacias.tsx`** — a parte
   compartilhada já saiu (`ObrasTable`, `CamposPopulacao`, `CAMPOS_DB`), mas a
   casca das telas ainda é paralela. Uma casca comum é possível; custa alinhar
   cinco telas.
3. **Rerender amplo**: o contexto entrega o estado inteiro, então cada tecla
   rerenderiza todos os consumidores. Não incomoda no volume atual (dezenas de
   fichas por unidade); com uma unidade grande, medir antes de otimizar.
4. **Nomes em português no domínio, inglês nas convenções de React.** É
   deliberado (o domínio é o vocabulário do negócio: sub-bacia, ficha, régua),
   mas é uma escolha que vale confirmar com o time.
5. **Sem validação de formato nos códigos** de `obra_obrigatoria_ano` /
   `obra_proibida_ate`: dá para digitar `2O27` e a tela aceita. Marcar erro
   exigiria um estado visual que a tela ainda não tem.

## O que este código **não** resolve

Está tudo no fim do `README.md` e detalhado no `DEPLOY.md`: autenticação,
concorrência (ETag), gravação da hierarquia, importar planilha — e o fato de que
**o backend do cadastro ainda não existe**. Nenhum desses é dívida escondida; são
decisões tomadas com o time e registradas.
