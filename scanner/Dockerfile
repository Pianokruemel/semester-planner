FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY scanner/package.json scanner/
RUN npm ci --workspace=packages/shared --workspace=scanner --include=dev

COPY packages/shared packages/shared
COPY scanner scanner
RUN cd packages/shared && npm run build
RUN cd scanner && npm run build

# Drop privileges: the crawler only needs to read its own files and make
# outbound HTTPS requests.
RUN chown -R node:node /app
USER node

WORKDIR /app/scanner
CMD ["npm", "run", "scan:watch"]
