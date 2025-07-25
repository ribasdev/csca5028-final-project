# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy root package.json and tsconfig.json
COPY package.json ./
COPY tsconfig.json ./

# Copy shared module
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Copy alert-service
WORKDIR /app
COPY alert-service/package.json ./alert-service/
WORKDIR /app/alert-service
RUN npm install

# Copy alert-service source
COPY alert-service/src ./src
COPY alert-service/tsconfig.json ./

# Build the service
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Install production dependencies
COPY alert-service/package.json ./
RUN npm install --only=production

# Copy built application
COPY --from=build /app/alert-service/dist ./dist

EXPOSE 4001

CMD ["node", "dist/src/index.js"]