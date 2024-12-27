# Stage 1: Build the React client
FROM node:18 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY client/package*.json ./client/

# Install dependencies for the client
RUN cd client && npm install

# Copy the rest of the client code
COPY client ./client

# Build the React client
RUN cd client && npm run build

# Stage 2: Set up the Express server
FROM node:18

# Install necessary dependencies for Puppeteer and ffmpeg
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libasound2 \
    libxdamage1 \
    libxkbcommon0 \
    libgtk-3-0 \
    libxshmfence1 \
    ffmpeg \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY server/package*.json ./server/

# Install dependencies for the server
RUN cd server && npm install

# Copy the server code
COPY server ./server

# Create necessary directories and set permissions
RUN mkdir -p /app/server/controllers/syntax-frames \
    && mkdir -p /app/server/controllers/temp_videos \
    && chown -R node:node /app \
    && chmod -R 755 /app/server/controllers

# Switch to non-root user
USER node

# Copy the built React client from the previous stage
COPY --from=build /app/client/dist ./server/client/dist

# Set the command to run the server
CMD ["node", "server/index.js"]

# Expose the port the app runs on
EXPOSE 3000
