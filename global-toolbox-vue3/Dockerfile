# Multi-stage frontend build. Runtime container only seeds a shared volume then exits.
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Must use package.json build (includes prerender-seo).
ARG SITE_ORIGIN=http://localhost:8080
ARG VITE_BASE=/
ENV SITE_ORIGIN=$SITE_ORIGIN
ENV VITE_BASE=$VITE_BASE
RUN npm run build

FROM alpine:3.19 AS runtime

WORKDIR /dist-src
COPY --from=build /app/dist ./

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

VOLUME ["/srv/frontend"]
ENTRYPOINT ["/docker-entrypoint.sh"]
