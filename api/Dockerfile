FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production && npm cache clean --force
COPY server.js .
RUN addgroup -S aiproxy && adduser -S aiproxy -G aiproxy
USER aiproxy
EXPOSE 3101
CMD ["node", "server.js"]
