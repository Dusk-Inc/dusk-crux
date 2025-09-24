import express, { Router } from "express";
import fg from "fast-glob";
import path from "path";
import fs from "fs/promises";
import { log, error } from '../utils/utils.core'
import { makeJsonHandler } from '../utils/utils.core'
import { validateConfig, ValidationIssue } from "../validator";
import { ValidationSeverity } from '../validator/validator.enum';
import { ConsoleColors } from "../utils/utils.enum";
import { composeCruxConfig } from "../payload";

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

  // load globals.json once
  let globals: any = null;
  try {
    const readFile = opts.fileSystem?.promises?.readFile ?? fs.readFile;
    const raw = await readFile(path.join(root, 'globals.json'), 'utf8');
    globals = JSON.parse(raw);
  } catch {}

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

    const composed = composeCruxConfig(globals, cfg);
    const actions: any[] = Array.isArray(composed?.actions) ? composed.actions : [];
    const issues: ValidationIssue[] = validateConfig(composed, { actionDirs: Array(actions.length).fill(routePath) });
    if (issues.length === 0) {
      const handler = makeJsonHandler(composed);
      for (const a of actions) {
        const m = String(a?.req?.method || "").toLowerCase();
        if (!m || typeof (router as any)[m] !== "function") continue;
        (router as any)[m](routePath, handler);
        log?.(`${m.toUpperCase()} ${routePath}  ←  ${path.relative(root, file)}#${a?.name ?? "action"}`);
      }
    } else {
      logIssues(issues, routePath, path.relative(root, file))

    }
  }

  return router;
}

function logIssues(issues: ValidationIssue[], routePath: string, relativePath: string){
  let logString = `SKIP (invalid) ${routePath}  ←  ${relativePath} (#issues=${issues.length})`
  
  for(let x=0; x<issues.length;x++){
    let color = '';
    if(issues[x].severity == ValidationSeverity.ERROR){ color=ConsoleColors.RED }
    if(issues[x].severity == ValidationSeverity.WARNING){ color=ConsoleColors.YELLOW }
    if(issues[x].severity == ValidationSeverity.INFO){ color=ConsoleColors.BLUE }
    let issueString: string = ""
    issueString += `\n\t\x1b[${color}Code: ${issues[x].code}\x1b[0m`
    issueString += `\n\t\x1b[${color}Severity: ${issues[x].severity}\x1b[0m`
    issueString += `\n\t\x1b[${color}Path: ${issues[x].path}\x1b[0m`
    issueString += `\n\t\x1b[${color}Message: ${issues[x].message}\x1b[0m\n`
    logString += issueString
  }
  log?.(logString)
}
