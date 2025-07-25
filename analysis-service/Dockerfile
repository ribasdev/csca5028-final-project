FROM node:18-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app
COPY analysis-service/package.json ./analysis-service/
WORKDIR /app/analysis-service
RUN npm install

COPY analysis-service/src ./src
COPY analysis-service/tsconfig.json ./

RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app

COPY analysis-service/package.json ./
RUN npm install --only=production

COPY --from=build /app/analysis-service/dist ./dist

EXPOSE 4002

CMD ["node", "dist/src/index.js"]