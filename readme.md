![crux image header](./dusk_crux_github_image.png "crux image header")

# Dusk Crux

Dusk Crux bootstraps a file-backed mock API server. Generate a `.crux` workspace and start the watcher-driven server without leaving your project root.

## Quickstart

```bash
npx -y dusk-crux
npm install
npm run dusk-crux
```

- `npx -y dusk-crux` scaffolds the `.crux` directory and adds a `dusk-crux` npm script if missing.
- `npm run dusk-crux` proxies to `dusk-crux run`, starting the mock server on port 4000 by default.
- Pass `--port` or `--root` when needed, for example `npm run dusk-crux -- --port 4100`.

## Development

```bash
npm install
npm run build
npm run start
```

`npm run start` mirrors `npm run dusk-crux` and launches the server against the local `.crux` fixtures for package development.
