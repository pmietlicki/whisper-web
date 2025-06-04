# ------------ Étape 1 : build (Debian slim) -------------------------------
    FROM node:18-slim AS build
    RUN apt-get update -y && \
        apt-get install -y --no-install-recommends git ca-certificates && \
        rm -rf /var/lib/apt/lists/*
    
    WORKDIR /app
    RUN git clone --depth 1 https://github.com/pmietlicki/whisper-web.git .
    
    ENV npm_config_onnxruntime_node_install=skip
    
    # on installe TOUTES les dépendances, y compris optionnelles
    RUN npm ci --include=dev --no-audit --no-fund
    
    # Build
    RUN npm run build
    
    # ------------ Étape 2 : image finale ultra-légère -------------------------
    FROM nginx:alpine
    COPY --from=build /app/dist /usr/share/nginx/html
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
        try_files $uri =404;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    gzip on;\n\
    gzip_vary on;\n\
    gzip_min_length 1024;\n\
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;\n\
}\n' > /etc/nginx/conf.d/default.conf

# Exposition du port 8080 (port par défaut de nginx-unprivileged)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
