# ---------- Étape 1 : build -----------------------------------------------
FROM node:20-alpine AS build
RUN apk add --no-cache git

WORKDIR /app
RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .

# -- corrige le bug npm -----------------------------------------------------
RUN corepack enable && npm install -g npm@11 typescript

# -- install + build --------------------------------------------------------
RUN npm ci --include=dev --legacy-peer-deps
RUN npm run build

# ---------- Étape 2 : image statique --------------------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
