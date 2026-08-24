FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
