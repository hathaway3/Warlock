# Use a multi-stage build for clean separation of build artifacts
# Stage 1: Build Stage (uses full node environment for build tools)
FROM node:24-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the frontend source code and build it
COPY frontend/ ./frontend
RUN npm --prefix frontend install
# Assuming the build script handles the full frontend build
RUN npm run build:frontend

# Stage 2: Production Runtime Stage (minimal image, only necessary files)
FROM node:24-alpine AS production
WORKDIR /app

# Define a health check to ensure basic service availability
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["curl", "-f", "http://localhost:3000/health"]

# Install only production dependencies
RUN npm install --production

# Copy the compiled static assets (SPA build)
COPY --from=build /app/frontend/dist ./public/dist
# Copy backend source code
COPY . .

# Set necessary environment variables
ENV SKIP_AUTHENTICATION=false \
    SKIP_2FA=false

# Run as non-root user
USER warlock

# Expose the application port (assuming Express runs on 3000)
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]