# syntax=docker/dockerfile:1
# Angular SPA served by NGINX, which also proxies /accountant/ to the backend. Build context: repository root.

# ---------------------------------------------------------------- build
FROM node:22-alpine AS build
WORKDIR /workspace

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY frontend/ .
RUN npx ng build --configuration production

# -------------------------------------------------------------- runtime
FROM nginx:alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /workspace/dist/accountant/browser /usr/share/nginx/html
EXPOSE 80
