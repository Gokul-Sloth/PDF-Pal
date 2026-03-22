# ============================================
# Stage 1: Build the Vite React application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies (clean install for reproducibility)
RUN npm ci

# Copy source code and config files
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY public/ public/
COPY src/ src/

# Build for production with root base path
ENV VITE_BASE_PATH=/
RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the WASM binary to serve at root (fallback for self-contained operation)
COPY --from=build /app/src/lib/gs-worker.wasm /usr/share/nginx/html/gs-worker.wasm

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
