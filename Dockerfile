# Use official Node.js lightweight image
FROM node:20-slim as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the frontend and bundle the server
RUN npm run build

# Use a clean, production-only runner stage
FROM node:20-slim as runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.cjs"]
