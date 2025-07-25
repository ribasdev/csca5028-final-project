# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy root configuration
COPY tsconfig.json ./

# Copy shared module
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Copy frontend
WORKDIR /app
COPY frontend/package.json ./frontend/
WORKDIR /app/frontend
RUN npm install

# Copy frontend source
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/tsconfig.json ./

# Build the application
RUN sed -i '/  "homepage": "https:\/\/ribasdev.github.io\/csca5028-final-project",/d' package.json
RUN npm run build

# Runtime stage
FROM nginx:alpine AS runtime

# Copy built application to nginx
COPY --from=build /app/frontend/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]