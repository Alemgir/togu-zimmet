FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_DEMO_LOGIN=true
ENV VITE_DEMO_LOGIN=$VITE_DEMO_LOGIN
RUN npm run build

FROM nginx:1.27-alpine
# nginx imajı /etc/nginx/templates/*.template dosyalarındaki ${DEĞİŞKEN}'leri açılışta doldurur
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80 BACKEND_URL=http://backend:3000
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
