FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application code
COPY server.js ./

# Expose port 8080 (matches backend gateway URL generation)
ENV PORT=8080
EXPOSE 8080

# Health check - increased start period for AWS Fargate
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run the proxy server
CMD ["node", "server.js"]
