# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (respecting lockfile)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Set up build-time environment variables for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the production bundle
RUN npm run build

# Stage 2: Serve the production bundle
FROM node:20-alpine

WORKDIR /app

# Copy only built assets and package configuration from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Serve using Vite's preview utility
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
