FROM node:20.19-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dev.db

COPY package.json package-lock.json* ./

RUN npm install --omit=dev && npm cache clean --force
# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli

COPY . .

RUN npm run build
RUN mkdir -p /data

CMD ["npm", "run", "docker-start"]
