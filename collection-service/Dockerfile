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

# Copy collection-service
WORKDIR /app
COPY collection-service/package.json ./collection-service/
WORKDIR /app/collection-service
RUN npm install

# Copy collection-service source
COPY collection-service/src ./src
COPY collection-service/tsconfig.json ./

# Build the service
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Install production dependencies
COPY collection-service/package.json ./
RUN npm install --only=production

# Copy built application
COPY --from=build /app/collection-service/dist ./dist

EXPOSE 4003

CMD ["node", "dist/src/index.js"]