# syntax=docker/dockerfile:1
# Usage and derived-image pattern: see readme.md "Container image".

# --- Stage 1: compile TypeScript to dist/ ---
# Pinned to the node:22-alpine multi-arch index digest; re-resolve it with `docker buildx imagetools inspect` only to move the base.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /src

COPY package.json package-lock.json tsconfig.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY app ./app
COPY resources ./resources
RUN npm run build

# --- Stage 2: minimal runtime image ---
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime

# The CLI requires --root inside cwd, so the install lives under /opt/dusk-crux and the image runs from /.
WORKDIR /opt/dusk-crux

COPY --from=build /src/package.json /src/package-lock.json ./
COPY --from=build /src/dist ./dist
COPY --from=build /src/resources ./resources
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

WORKDIR /

# Mount the .crux tree here or COPY it in a derived image.
VOLUME ["/crux"]

EXPOSE 4000

# Alpine's busybox ships wget, so no extra install is needed for this probe.
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Appended args replace CMD's defaults, never the `run` subcommand.
ENTRYPOINT ["node", "/opt/dusk-crux/dist/cli.js", "run"]
CMD ["--port", "4000", "--root", "/crux"]
