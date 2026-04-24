# syntax=docker/dockerfile:1
# Dusk Crux — official container image.
#
# File-backed mock API server. Two consumption patterns:
#
#   (1) Volume mount (hot-reload friendly, dev default):
#         services:
#           crux:
#             image: dusk-crux:1.0.6
#             volumes: ["./api/.crux:/crux:ro"]
#             ports: ["4000:4000"]
#
#   (2) Hermetic derived image (CI / staging):
#         FROM dusk-crux:1.0.6
#         COPY .crux /crux
#
# Override port or root at run time by appending CLI args:
#   docker run dusk-crux --port 5000 --root /mnt/api

# --- Stage 1: compile TypeScript to dist/ ---
FROM node:22-alpine AS build

WORKDIR /src

COPY package.json package-lock.json tsconfig.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY app ./app
COPY resources ./resources
RUN npm run build

# --- Stage 2: minimal runtime image ---
FROM node:22-alpine AS runtime

# The CLI requires --root to be inside the current working directory, so we
# stage the install under /opt/dusk-crux and run from /, where /crux can live.
WORKDIR /opt/dusk-crux

COPY --from=build /src/package.json /src/package-lock.json ./
COPY --from=build /src/dist ./dist
COPY --from=build /src/resources ./resources
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Run from / so /crux sits inside cwd; the CLI enforces that constraint.
WORKDIR /

# .crux tree is expected here — mount it or COPY it in a derived image.
# Callers can point elsewhere with --root (must still be inside cwd).
VOLUME ["/crux"]

EXPOSE 4000

# Alpine's busybox ships wget, so no extra install is needed for this probe.
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# ENTRYPOINT + CMD: appended args override the defaults, not the subcommand.
#   docker run dusk-crux --port 5000 --root /mnt/api
ENTRYPOINT ["node", "/opt/dusk-crux/dist/cli.js", "run"]
CMD ["--port", "4000", "--root", "/crux"]
