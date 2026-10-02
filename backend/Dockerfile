# Imagem da API. O contexto de build é a raiz do repositório (monorepo com workspaces).
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --workspace shared --include-workspace-root=false

COPY shared shared
COPY backend backend

ENV NODE_ENV=production PORT=3333
EXPOSE 3333

# Aplica as migrations (idempotente) e inicia a API.
CMD ["sh", "-c", "npm run migrate -w backend && npm start -w backend"]
