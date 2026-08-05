# Deploy — guia de manutenção

Guia de **como mexer** nos arquivos de deploy: o que cada um faz, o que você
muda e quando, e o que quebra se errar. Para o contrato da API e a visão geral,
veja o [`DEPLOY.md`](../DEPLOY.md) na raiz.

> **Nada aqui é segredo.** Tudo neste diretório vai para dentro da imagem ou
> para um ConfigMap servido ao navegador. Senha, connection string e client
> secret **não entram** — nem no `configmap.yaml`, nem no `.env`. Uma SPA não usa
> client secret: o fluxo correto de SSO é Authorization Code + PKCE.

---

## Os arquivos

| Arquivo               | O que é                                               | Muda com que frequência             |
| --------------------- | ----------------------------------------------------- | ----------------------------------- |
| `../Dockerfile`       | Build (node) + runtime (nginx sem root)               | Raro — versão de Node/nginx         |
| `nginx.conf`          | Servidor: fallback de SPA, cache, headers, `/healthz` | Raro — rota nova ou header          |
| `k8s/configmap.yaml`  | **Config por ambiente** (`/config.js`)                | Sempre que API ou SSO mudar         |
| `k8s/deployment.yaml` | Pod, imagem, probes, volumes                          | A cada release (tag da imagem)      |
| `k8s/service.yaml`    | ClusterIP na 8080                                     | Quase nunca                         |
| `k8s/ingress.yaml`    | Host, TLS e roteamento `/api`                         | Ao criar ambiente ou trocar domínio |

O `k8s/` é **exemplo, não verdade**: os valores marcados `TROCAR` são
placeholders. Se vocês usam Helm ou Kustomize, tratem estes YAMLs como a base a
ser parametrizada.

---

## A ideia central: uma imagem, muitos ambientes

O Vite embute `VITE_*` no bundle **durante o build**. Se a config viesse só de
variável de build, cada ambiente exigiria uma imagem própria — e você perderia o
"promover o artefato já testado".

Por isso a config real vem de **`/config.js`**, um arquivo servido junto com o
site e lido pelo `index.html` antes do bundle:

```
imagem (a mesma em todo lugar)
   └── /config.js  ← ConfigMap monta por cima  ← muda por ambiente
```

Precedência em `src/config.ts`: **`/config.js` > `VITE_*` do build > padrão**.
A variável de build continua útil em desenvolvimento (`.env.local`), onde editar
um arquivo é mais prático que um ConfigMap.

Consequência prática: **mudar API ou SSO não exige rebuild**. Edite o ConfigMap,
suba a anotação `configmap/revision` no Deployment e faça o rollout.

---

## Receitas

### Subir uma versão nova do app

1. Build e push da imagem com uma tag imutável (nunca `latest` — sem tag fixa não
   dá para saber o que está rodando nem voltar atrás):
   ```bash
   docker build -t registry.exemplo/cadastro-web:0.2.0 .
   docker push  registry.exemplo/cadastro-web:0.2.0
   ```
2. `k8s/deployment.yaml` → campo `image` → a tag nova.
3. `kubectl apply -f k8s/deployment.yaml`

### Apontar para outro backend

Se o backend está no mesmo host (recomendado), **não mexa no app**: ajuste o
Service de destino em `k8s/ingress.yaml`, no path `/api`.

Se ele fica em outro domínio:

1. `k8s/configmap.yaml` → `apiUrl: 'https://api.exemplo/api'`
2. O backend precisa liberar CORS para a origem do frontend, com `Authorization`
   nos `Access-Control-Allow-Headers`.
3. `nginx.conf` → `connect-src 'self'` na CSP passa a bloquear o domínio novo:
   acrescente-o (`connect-src 'self' https://api.exemplo`).
4. Suba `configmap/revision` no Deployment e aplique.

> O passo 3 é o que mais esquece. O sintoma é a tela de erro de carga com o
> console reclamando de Content Security Policy.

### Ligar o SSO

1. `k8s/configmap.yaml` → preencha `authority`, `clientId` e `escopos`.
2. Registre a **redirect URI** no IdP: `https://<host>/` (o host do Ingress).
3. No código, o encaixe já existe — falta chamar `configurarSessao(...)` no
   bootstrap (`src/main.tsx`) com a lib escolhida. Ver a seção de SSO no
   [`DEPLOY.md`](../DEPLOY.md).
4. Se a lib do IdP fizer requisição para o domínio do provedor, libere-o na CSP
   (`connect-src`, e `frame-src` se o fluxo usar iframe para renovar token).

Enquanto `authority` e `clientId` estiverem vazios, o app **não manda
`Authorization`** e funciona sem autenticação — que é o modo de desenvolvimento.

### Criar um ambiente novo (homologação, por exemplo)

Copie `k8s/` para o novo namespace mudando só:

- `ingress.yaml`: `host`, `secretName` do TLS;
- `configmap.yaml`: `apiUrl`/SSO daquele ambiente;
- `deployment.yaml`: `replicas` e `resources`, se fizer sentido.

A **imagem é a mesma**. Se você se pegar reconstruindo a imagem para um ambiente,
algo saiu do trilho — a diferença deveria estar no ConfigMap.

### Trocar o domínio

`ingress.yaml` (`host` em `rules` e em `tls`) e a redirect URI registrada no IdP.
O bundle não conhece o domínio, então não precisa de rebuild.

---

## O que não pode sair do `nginx.conf`

Três blocos são estruturais. Removê-los não dá erro no deploy — quebra em uso:

| Bloco                                              | O que acontece se sair                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `try_files $uri $uri/ /index.html` em `location /` | F5 ou link direto em `/unidade/x/cts` devolve **404**. Só a raiz funciona.                                           |
| `no-store` em `/config.js`                         | O navegador reusa a config do ambiente anterior. Sintoma clássico: apontar para a API errada depois de uma migração. |
| `no-store` em `/index.html`                        | O index cacheado aponta para um bundle que o deploy novo apagou — tela branca até o usuário limpar o cache.          |

O `expires 1y` em `/assets/` é seguro **porque os nomes têm hash**: arquivo novo,
nome novo. Se um dia o build parar de gerar hash, esse cache vira armadilha.

---

## Restrições do runtime que já estão resolvidas

Se você trocar a imagem base ou endurecer a policy do cluster, lembre:

- **`readOnlyRootFilesystem: true`** exige os `emptyDir` em `/var/cache/nginx` e
  `/tmp`. Sem eles o nginx não sobe.
- **Porta 8080, não 80.** A imagem roda como uid 101; porta abaixo de 1024
  exigiria root. Trocar a base para o `nginx` oficial reintroduz o root.
- **`runAsUser: 101`** casa com o usuário da `nginx-unprivileged`. Outra imagem,
  outro uid.

---

## Verificar antes de aplicar

```bash
# A imagem sobe e responde?
docker build -t cadastro-web:teste .
docker run --rm -p 8080:8080 cadastro-web:teste

curl -i localhost:8080/healthz                    # 200 ok
curl -i localhost:8080/unidade/u-jacarei/cts      # 200 + HTML (fallback do SPA)
curl -sI localhost:8080/config.js | grep -i cache # no-store
```

Uma rota funda devolvendo 404 significa que o `try_files` não está valendo — é
o erro mais comum ao editar o `nginx.conf`.

Para conferir a config que o navegador realmente recebeu, abra o console em
qualquer ambiente:

```js
window.__CADASTRO_CONFIG__
```

---

## Pendências

- **CI não existe.** Não há pipeline de build/push da imagem; hoje é manual.
- **Anotação de revisão do ConfigMap é manual.** Mudar só o ConfigMap não
  reinicia os pods sozinho: suba `configmap/revision` no `deployment.yaml`, ou
  adote uma ferramenta que calcule o hash (`kustomize` com `configMapGenerator`,
  ou o `checksum/config` do padrão Helm).
- **`resources` são chute.** São valores de partida para um site estático;
  ajuste com métrica real depois do primeiro ambiente no ar.
