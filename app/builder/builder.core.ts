import express, { Router } from "express";
import fg from "fast-glob";
import path from "path";
import fs from "fs/promises";
import { makeJsonHandler } from "../utils/utils";
import { log, error } from '../utils/utils'
import { validateConfig } from "../validator";

function toRouteSegment(seg: string) {
  if (seg.startsWith("[") && seg.endsWith("]")) {
    const name = seg.slice(1, -1);
    return `:${name}`;
  }
  return seg;
}

function relativize(file: string, root: string) {
  const normalizeSeps = (p: string) => p.replace(/[\\/]+/g, path.sep);
  const rel = path.relative(normalizeSeps(root), normalizeSeps(file));
  return rel.split(path.sep);
}

export type BuildOptions = {
  fileSystem?: { promises: { readFile: (p: string, enc?: string) => Promise<string> } };
  listFiles?: (root: string) => Promise<string[]>;
}

function normalizeConfig(cfg: any): any {
  const out = { ...(cfg || {}) };
  if (Array.isArray(out.actions)) {
    out.actions = out.actions.map((a: any) => ({
      ...a,
      req: {
        ...(a?.req || {}),
        method: typeof a?.req?.method === 'string' ? a.req.method.toLowerCase() : a?.req?.method
      }
    }));
  }
  return out;
}

export async function buildRouterFromFS(root: string, opts: BuildOptions = {}): Promise<Router> {
  const router = express.Router();

  const pattern = ["**/*.crux.json"];
  const files = opts.listFiles
    ? await opts.listFiles(root)
    : await fg(pattern, { cwd: root, dot: true, onlyFiles: true, absolute: true });

  const parsed: Array<{ cfg: any; routePath: string; file: string }> = [];

  for (const file of files) {
    const parts = relativize(file, root);

    const dirs = parts.slice(0, -1).map(toRouteSegment);
    const routePath = "/" + dirs.join("/");

    let cfg: any;
    try {
      const readFile = opts.fileSystem?.promises?.readFile ?? fs.readFile;
      const raw = await readFile(file, "utf8");
      cfg = JSON.parse(raw);
    } catch (e) {
      error?.(`invalid JSON: ${file}`, e);
      continue;
    }

    const normCfg = normalizeConfig(cfg);
    const actions: any[] = Array.isArray(normCfg?.actions) ? normCfg.actions : [];
    const issues = validateConfig(normCfg, { actionDirs: Array(actions.length).fill(routePath) });
    if (issues.length === 0) {
      const handler = makeJsonHandler(normCfg);
      for (const a of actions) {
        const m = String(a?.req?.method || "").toLowerCase();
        if (!m || typeof (router as any)[m] !== "function") continue;
        (router as any)[m](routePath, handler);
        log?.(`${m.toUpperCase()} ${routePath}  ←  ${path.relative(root, file)}#${a?.name ?? "action"}`);
      }
    } else {
      log?.(`SKIP (invalid) ${routePath}  ←  ${path.relative(root, file)} (#issues=${issues.length})`);
    }

    parsed.push({ cfg: normCfg, routePath, file });
  }

  router.get('/dir', (_req, res) => {
    const routes = parsed.map(({ cfg, routePath }) => {
      const actions: any[] = Array.isArray(cfg?.actions) ? cfg.actions : [];
      const methods = Array.from(new Set(actions.map(a => String(a?.req?.method || '').toUpperCase()).filter(Boolean)));
      const params = routePath.split('/').filter(s => s.startsWith(':')).map(s => s.slice(1));
      const actionSummaries = actions.map(a => ({
        name: a?.name,
        method: String(a?.req?.method || '').toUpperCase(),
        query: a?.req?.query ? Object.keys(a.req.query) : [],
        params: a?.req?.params ? Object.keys(a.req.params) : [],
        headers: a?.req?.headers ? {
          required: Array.isArray(a.req.headers.required) ? a.req.headers.required : [],
          optional: Array.isArray(a.req.headers.optional) ? a.req.headers.optional : [],
          forbidden: Array.isArray(a.req.headers.forbidden) ? a.req.headers.forbidden : []
        } : { required: [], optional: [], forbidden: [] }
      }));
      return { path: routePath, methods, params, actions: actionSummaries };
    });
    res.json({ routes });
  });

  router.get('/health', (_req, res) => {
    const allIssues = parsed.flatMap(({ cfg, routePath }) => {
      const n = Array.isArray(cfg?.actions) ? cfg.actions.length : 0;
      const dirs = Array(n).fill(routePath);
      return validateConfig(cfg, { actionDirs: dirs });
    });
    res.json({ ok: allIssues.length === 0, issues: allIssues });
  });

  return router;
}
