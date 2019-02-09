FROM node:alpine as base

FROM base as pkg
RUN apk add --no-cache python g++ gcc libgcc libstdc++ make libxslt py-pip
RUN pip install docutils

FROM pkg as installer
RUN mkdir /app
WORKDIR /app
RUN npm install libxmljs

FROM installer as builder
WORKDIR /app
COPY package.json.docker /app/package.json
COPY package-lock.json /app
COPY xmlcontent /app/xmlcontent
RUN npm install --only=prod

FROM installer
COPY --from=builder /app /app
COPY server.js /app
WORKDIR /app
EXPOSE 80
ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production
ENV PORT=80
ENV PATH="${PATH}:/app/node_modules/.bin"
CMD ["node", "server.js"]
