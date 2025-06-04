# ------------ Étape 1 : build (Debian slim) -------------------------------
FROM node:18-slim AS build
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# Installation complète, sans les optional natives (onnx/esbuild linux-musl etc.)
RUN npm ci --include=dev --omit=optional --no-audit --no-fund

# Build
RUN npm run build

# ------------ Étape 2 : image finale ultra-légère -------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
