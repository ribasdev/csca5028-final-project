FROM node:18-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app
COPY alert-service/package.json ./alert-service/
WORKDIR /app/alert-service
RUN npm install

COPY alert-service/src ./src
COPY alert-service/tsconfig.json ./

RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app

COPY alert-service/package.json ./
RUN npm install --only=production

COPY --from=build /app/alert-service/dist ./dist

EXPOSE 4001

CMD ["node", "dist/src/index.js"]