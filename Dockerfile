# Location: ./Dockerfile

# --- 1. BUILD STAGE ---
FROM node:20-alpine as builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# Build-time args — required so Vite bakes these into the bundle
ARG VITE_ADMIN_USER
ARG VITE_ADMIN_PASS
ENV VITE_ADMIN_USER=$VITE_ADMIN_USER
ENV VITE_ADMIN_PASS=$VITE_ADMIN_PASS

RUN npm run build

# --- 2. SERVE STAGE ---
FROM nginx:alpine
# Install curl for healthcheck (wget not reliably available as non-root in nginx:alpine)
RUN apk add --no-cache curl
# Set up non-root user and permissions
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html
USER nginx
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
