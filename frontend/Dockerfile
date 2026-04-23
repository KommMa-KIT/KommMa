# frontend/Dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
ENV NODE_ENV=development
RUN npm install

COPY . .

CMD ["npm", "start", "node", "-e", "console.log('Frontend container ready')"]