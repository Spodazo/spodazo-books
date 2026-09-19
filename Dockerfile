FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY scripts/copy-pdfjs-assets.mjs scripts/
ENV NPM_CONFIG_ENGINE_STRICT=false
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.cjs"]
