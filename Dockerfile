# Compila la SPA y la sirve con nginx, que también hace de proxy hacia la API.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# A dónde reenviar /api y /healthz. Se puede cambiar sin reconstruir la imagen.
ENV API_UPSTREAM=http://host.docker.internal:8080
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build/client /usr/share/nginx/html

EXPOSE 80
