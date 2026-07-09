FROM node:20-alpine

# Setup app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Hugging Face Spaces uses port 7860
ENV PORT=7860

# Expose port
EXPOSE 7860

# Run the server
CMD ["node", "src/index.js"]
