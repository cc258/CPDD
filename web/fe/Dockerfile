FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# 先安装依赖，利用构建缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY fe/package.json fe/package.json
COPY admin/package.json admin/package.json
RUN pnpm install --frozen-lockfile

COPY nginx.conf.template ./nginx.conf.template
COPY fe ./fe
RUN pnpm --filter fe build

FROM nginx:1.27-alpine

ENV API_UPSTREAM=http://api:8000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/fe/dist /usr/share/nginx/html

EXPOSE 80
