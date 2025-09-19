# Base stage
FROM node:latest AS base
USER root

FROM base AS dev
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm install
CMD ["bash", "entrypoint.sh"]

FROM base AS prod
COPY . .
RUN npm install
RUN npm run build
CMD ["bash", "entrypoint.sh"]