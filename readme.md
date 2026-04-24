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

## Core Concepts

### File-backed routing
- Every folder under `.crux` maps directly to an HTTP route. Static segments reuse the folder name, while dynamic segments use bracket notation (`users/[id]` → `/users/:id`). The JSON file that sits in the last folder defines the route contract (for example, `.crux/users/[id]/users.id.crux.json`).
- The file watcher (chokidar) keeps the Express router in sync with the filesystem. Saving or removing a route file hot-swaps the in-memory router without restarting the process.

Example route file (`.crux/users/[id]/users.id.crux.json`):

```json
{
  "actions": [
    {
      "name": "user_id_json",
      "req": {
        "method": "get",
        "params": { "id": 1 },
        "query": { "date_created": "00010101" },
        "headers": { "accept": "application/json" }
      },
      "res": {
        "status": 200,
        "bodyFile": "test_body.json"
      }
    },
    {
      "name": "user_id_xml",
      "req": {
        "method": "get",
        "params": { "id": 1 },
        "query": { "date_created": "00010101" },
        "headers": { "accept": "application/xml" }
      },
      "res": {
        "status": 200,
        "bodyFile": "test_body.xml"
      }
    }
  ]
}
```

### Defaults, routes, and actions
- `defaults.json` sets defaults for requests and responses at any level of the `.crux` tree: shared headers, default status codes, or reusable query parameters. The root `defaults.json` applies to every route; a `defaults.json` inside any subfolder applies only to routes beneath that folder.
- Defaults cascade from the root down. Each `defaults.json` deep-merges on top of the accumulated ancestor defaults; a child file overrides only the fields it expressly declares. Each route file's own `globals` block then merges on top of the fully-cascaded defaults, and finally every action's `req`/`res` merges on top of that.
- Deep-merge semantics: object values merge key-by-key, **arrays replace wholesale**, and a child writing `"field": null` **erases** the inherited value.
- `defaults.json` files never declare `actions` — they only contribute `req`/`res` defaults. They are not passed through route validation.
- Action matching is deterministic. Crux normalizes method names, then picks the first action whose `req.method`, `req.params`, `req.headers` and `req.query` all match the incoming request.
- Missing methods yield a 405 with an `Allow` header. Missing matches yield a structured 400 explaining the mismatch.

Example root defaults (`.crux/defaults.json`):

```json
{
  "req": {
    "method": "get",
    "headers": {
      "policy": "warn",
      "schema": {
        "authorization": {
          "scheme": "Bearer",
          "pattern": "^[A-Za-z0-9._-]{20,}$"
        },
        "content-type": "application/json"
      }
    }
  },
  "res": {
    "status": 200
  }
}
```

Example cascading defaults — relax CORS for just the `/v1/public/**` subtree while every other route keeps the root defaults:

```
.crux/
  defaults.json                    # root defaults (strict auth, no CORS)
  v1/
    public/
      defaults.json                # adds CORS headers for this subtree
      health/
        health.crux.json
      version/
        version.crux.json
    internal/
      users/
        users.crux.json            # inherits root defaults only
```

`.crux/v1/public/defaults.json`:

```json
{
  "res": {
    "headers": {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS"
    }
  }
}
```

### Response composition
- Response shapes come from the merged `res` object: choose status codes, headers, and optional `bodyFile`. The `bodyFile` path must stay inside the route directory, keeping fixtures self-contained.
- When `bodyFile` is present, Crux streams the referenced file back with an inferred `Content-Type`. JSON, XML, HTML, text, and binary payloads are supported out of the box.
- Validation runs before a route is registered. Invalid configs are skipped and logged so broken fixtures never take over a path.

Fixtures referenced by the example route:

```json
[
  {
    "name": "Count Olaf",
    "type": "Character",
    "famous_quote": "WRONG! It's a list."
  }
]
```

```xml
<user id="1">
  <name>Count Olaf</name>
  <type>Character</type>
  <famous_quote>WRONG! It's a list.</famous_quote>
</user>
```

### CORS preflight
- Every route automatically answers `OPTIONS` with `204 No Content` so browser preflight requests can pass. The response includes the merged `res.headers` from every cascaded `defaults.json` and the route file, so CORS headers declared in defaults (e.g. `access-control-allow-origin`, `access-control-allow-methods`, `access-control-allow-headers`) are echoed back on the preflight.
- The auto-registered preflight also sets an `Allow` header listing every method declared on the route, plus `OPTIONS`.
- If a route defines its own `OPTIONS` action, that action wins and the auto-preflight is skipped.

### Operator utilities
- The root route (`GET /`) lists every discovered route, its dynamic params, and the available actions. Use it to confirm wiring before invoking real clients.
- `GET /health` runs the validator across all loaded configs and returns warnings or errors as machine-readable diagnostics.

### CLI surface
- `dusk-crux init` scaffolds `.crux`, adds the `dusk-crux` script, and pins the package as a devDependency to the generated project when it runs inside `npx`.
- `dusk-crux run` starts the watcher-driven Express server. Override the port with `--port` and relocate the config tree with `--root` when your mock data lives elsewhere.
- The CLI never mutates files outside the working tree, so you can check in the scaffold and iterate alongside the rest of your app.

## Development

```bash
npm install
npm run build
npm run start
```

`npm run start` mirrors `npm run dusk-crux` and launches the server against the local `.crux` fixtures for package development.
