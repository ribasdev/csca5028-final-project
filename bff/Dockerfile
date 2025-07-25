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

# Copy bff service
WORKDIR /app
COPY bff/package.json ./bff/
WORKDIR /app/bff
RUN npm install

# Copy bff source
COPY bff/src ./src
COPY bff/tsconfig.json ./

# Build the service
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Install production dependencies
COPY bff/package.json ./
RUN npm install --only=production

# Copy built application
COPY --from=build /app/bff/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/index.js"]