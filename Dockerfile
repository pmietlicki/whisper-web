# ------------ Étape 1 : build (Debian slim) -------------------------------
FROM node:18-slim AS build

# Installation des dépendances système
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone FRAIS du repository
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# Configuration NPM
ENV npm_config_onnxruntime_node_install=skip

# NETTOYAGE COMPLET : suppression de tous les fichiers de lock et cache
RUN rm -rf package-lock.json node_modules .npm

# Reset git pour s'assurer qu'on a une version propre
RUN git reset --hard HEAD

# Nettoyage du cache npm global
RUN npm cache clean --force

# Vérification et correction du package.json si nécessaire
RUN echo "=== Contenu du package.json ===" && cat package.json
RUN echo "=== Vérification de la syntaxe JSON ===" && python3 -m json.tool package.json > /dev/null || echo "ATTENTION: package.json malformé"

# Installation FRAÎCHE des dépendances
RUN npm install --include=dev --no-audit --no-fund --verbose

# Installation des types si manquants
RUN npm install --save-dev @types/json-schema @types/react @types/react-dom @types/node || true

# Installation de TypeScript globalement
RUN npm install -g typescript

# Vérification de l'installation
RUN echo "=== Vérification des types ===" && ls -la node_modules/@types/ || echo "Pas de types installés"
RUN echo "=== TypeScript version ===" && tsc --version

# Build
RUN npm run build

# ------------ Étape 2 : image finale ultra-légère -------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
