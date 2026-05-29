FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY packages/shared/package*.json packages/shared/
COPY backend/package*.json backend/
RUN cd packages/shared && npm install --include=dev
RUN cd backend && npm install --include=dev

COPY packages/shared packages/shared
COPY backend backend
RUN cd packages/shared && npm run build
RUN cd backend && npx prisma generate && npm run build

EXPOSE 4000

WORKDIR /app/backend
CMD ["npm", "run", "docker:start"]
