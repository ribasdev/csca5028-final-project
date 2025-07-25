FROM node:18-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app
COPY collection-service/package.json ./collection-service/
WORKDIR /app/collection-service
RUN npm install

COPY collection-service/src ./src
COPY collection-service/tsconfig.json ./

RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app

COPY collection-service/package.json ./
RUN npm install --only=production

COPY --from=build /app/collection-service/dist ./dist

EXPOSE 4003

CMD ["node", "dist/src/index.js"]