# syntax=docker/dockerfile:1

FROM node:20-slim AS build

WORKDIR /app

ENV npm_config_onnxruntime_node_install=skip
ARG VITE_LIVE_TRANSCRIPTION_WS_URL
ARG VITE_LIVE_TRANSCRIPTION_SERVER
ARG VITE_LIVE_TRANSCRIPTION_MODEL
ENV VITE_LIVE_TRANSCRIPTION_WS_URL=$VITE_LIVE_TRANSCRIPTION_WS_URL
ENV VITE_LIVE_TRANSCRIPTION_SERVER=$VITE_LIVE_TRANSCRIPTION_SERVER
ENV VITE_LIVE_TRANSCRIPTION_MODEL=$VITE_LIVE_TRANSCRIPTION_MODEL

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
