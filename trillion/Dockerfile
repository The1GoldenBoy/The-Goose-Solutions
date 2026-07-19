# Trillion — image universelle (Railway, Fly.io, Cloud Run, n'importe quel hôte Docker).
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8888 HOST=0.0.0.0
EXPOSE 8888
CMD ["node", "server.mjs"]
