FROM node:18-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app
COPY bff/package.json ./bff/
WORKDIR /app/bff
RUN npm install

COPY bff/src ./src
COPY bff/tsconfig.json ./

RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app

COPY bff/package.json ./
RUN npm install --only=production

COPY --from=build /app/bff/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/index.js"]