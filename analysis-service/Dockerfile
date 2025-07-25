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

# Copy analysis-service
WORKDIR /app
COPY analysis-service/package.json ./analysis-service/
WORKDIR /app/analysis-service
RUN npm install

# Copy analysis-service source
COPY analysis-service/src ./src
COPY analysis-service/tsconfig.json ./

# Build the service
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Install production dependencies
COPY analysis-service/package.json ./
RUN npm install --only=production

# Copy built application
COPY --from=build /app/analysis-service/dist ./dist

EXPOSE 4002

CMD ["node", "dist/index.js"]