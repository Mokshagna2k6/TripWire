FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
