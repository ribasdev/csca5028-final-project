FROM node:18-alpine AS build

WORKDIR /app

COPY tsconfig.json ./

COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app
COPY frontend/package.json ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/tsconfig.json ./

RUN sed -i '/  "homepage": "https:\/\/ribasdev.github.io\/csca5028-final-project",/d' package.json
RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=build /app/frontend/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]