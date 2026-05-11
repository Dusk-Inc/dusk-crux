# Dusk Crux — Implementation Log

What's shipped today and what's still open. Behavior docs live in [readme.md](readme.md); this file tracks state over time.

## Fixes

- **`create-dusk-crux` bin path mismatch.** `package.json` declared `"create-dusk-crux": "dist/create.cli.js"`, but the TypeScript build emits the file at `dist/create/create.cli.js` (because the source lives at `app/create/create.cli.ts`). When consumers installed dusk-crux, pnpm/npm tried to link the bin and logged `ENOENT: ... dist/create.cli.js`, leaving the bin unlinked. `npx -y create-dusk-crux` therefore could not work against a fresh install of the published v1.0.6. The main `dusk-crux` bin (`dist/cli.js`) was unaffected. Fix: corrected the bin path to `dist/create/create.cli.js`. The `files` array already shipped the `dist/` directory, so no change was needed to the tarball contents — only the bin entry. Requires a republish to reach existing consumers.
