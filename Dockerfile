# ---------- Étape 1 : build ---------------------------------------------------
FROM node:20-alpine AS build
# Outils nécessaires
RUN apk add --no-cache git

WORKDIR /app
# Clone léger pour gagner du temps de build
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# Skip du très gros binaire onnxruntime-node
# et installation de TOUTES les dépendances (dev comprises)
RUN npm install \
      --include=dev \
      --legacy-peer-deps \
      --onnxruntime-node-install=skip

# Compilation TypeScript + Vite
RUN npm run build

# ---------- Étape 2 : image finale statique ----------------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
