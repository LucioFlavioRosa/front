# Imagem do frontend do Cadastro do Otimizador CAPEX.
# Uma imagem só serve todos os ambientes: o que muda por ambiente é o
# /config.js, montado por ConfigMap em runtime (ver deploy/README.md).

# ─────────────────────────── build ───────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Camada de dependências separada: só reinstala quando o lockfile muda.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# tsc -b + vite build. Falha aqui derruba a imagem — é de propósito.
RUN npm run build

# ────────────────────────── runtime ──────────────────────────
# nginx-unprivileged: roda como uid 101, sem root, ouvindo na 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# O /config.js do build é o padrão (tudo vazio = usa /api e SSO desligado).
# Em cluster, o ConfigMap é montado por cima dele.

EXPOSE 8080
USER 101

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
