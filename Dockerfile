# ------------ Étape 1 : build (Debian slim) -------------------------------
FROM node:18-slim AS build

# Installation des dépendances système
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone du repository
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# Configuration NPM
ENV npm_config_onnxruntime_node_install=skip

# Installation explicite de TypeScript globalement comme fallback
RUN npm install -g typescript

# Installation des dépendances avec gestion d'erreurs
RUN npm ci --include=dev --no-audit --no-fund || (cat /root/.npm/_logs/*-debug-0.log && exit 1)

# Vérification que tsc est disponible
RUN which tsc || npm list typescript || npm install typescript

# Build avec gestion d'erreurs
RUN npm run build

# ------------ Étape 2 : image finale ultra-légère -------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
