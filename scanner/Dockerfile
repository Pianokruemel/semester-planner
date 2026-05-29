FROM node:20-alpine

WORKDIR /app

COPY packages/shared/package*.json packages/shared/
COPY scanner/package*.json scanner/
RUN cd packages/shared && npm install
RUN cd scanner && npm install

COPY packages/shared packages/shared
COPY scanner scanner
RUN cd packages/shared && npm run build
RUN cd scanner && npm run build

WORKDIR /app/scanner
CMD ["npm", "run", "scan:watch"]
