FROM node:20-alpine AS builder
WORKDIR /app
COPY smart-canteen-web/package*.json ./
RUN npm install
COPY smart-canteen-web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY k3s-version/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
