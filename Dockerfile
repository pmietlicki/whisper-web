# syntax=docker/dockerfile:1

FROM node:20-slim AS build

WORKDIR /app

ENV npm_config_onnxruntime_node_install=skip

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine

USER root
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && chown nginx:nginx /usr/share/nginx/html/runtime-config.js
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
