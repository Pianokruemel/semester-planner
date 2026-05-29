FROM node:20-alpine AS build

WORKDIR /app

COPY packages/shared/package*.json packages/shared/
COPY frontend/package*.json frontend/
RUN cd packages/shared && npm install
RUN cd frontend && npm install

COPY packages/shared packages/shared
COPY frontend frontend
RUN cd packages/shared && npm run build

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN cd frontend && npm run build

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 3000
