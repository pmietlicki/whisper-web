# ------------ Étape 1 : build (Debian slim) -------------------------------
FROM node:18-slim AS build

# Installation des dépendances système
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone du repository
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# Configuration NPM et nettoyage du cache
ENV npm_config_onnxruntime_node_install=skip
RUN npm cache clean --force

# Installation avec npm install au lieu de npm ci (plus permissif)
RUN npm install --include=dev --no-audit --no-fund

# Vérification et installation manuelle de TypeScript si nécessaire
RUN npx tsc --version || npm install typescript

# Build
RUN npm run build

# ------------ Étape 2 : image finale ultra-légère -------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
