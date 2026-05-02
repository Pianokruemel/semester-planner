FROM node:20-alpine

WORKDIR /app

COPY packages/shared/package*.json packages/shared/
COPY backend/package*.json backend/
COPY scanner/package*.json scanner/
RUN cd packages/shared && npm install
RUN cd backend && npm install
RUN cd scanner && npm install

COPY packages/shared packages/shared
COPY backend backend
COPY scanner scanner
RUN cd packages/shared && npm run build
RUN cd backend && npx prisma generate

EXPOSE 4000

WORKDIR /app/backend
CMD ["npm", "run", "docker:dev"]
