# Étape de build
FROM node:20-alpine AS build

WORKDIR /app
# git est nécessaire pour cloner le dépôt
RUN apk add --no-cache git

# Récupération du code source
RUN git clone https://github.com/pmietlicki/whisper-web.git .
RUN npm ci
RUN npm run build

# Étape finale : serveur web léger
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]