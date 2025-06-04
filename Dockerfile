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

# Installation explicite de TypeScript globalement
RUN npm install -g typescript

# Nettoyage du cache npm et installation des dépendances
RUN npm cache clean --force
RUN npm ci --include=dev --no-audit --no-fund --verbose || (cat /root/.npm/_logs/*-debug-0.log && exit 1)

# Installation explicite des types manquants
RUN npm install --save-dev @types/json-schema @types/react @types/react-dom || true

# Vérification que tsc est disponible
RUN which tsc || npm list typescript || npm install typescript

# Debug: Lister les packages installés
RUN npm list --depth=0 || true

# Build avec gestion d'erreurs et mode verbose
RUN npm run build -- --verbose

# ------------ Étape 2 : image finale ultra-légère -------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
