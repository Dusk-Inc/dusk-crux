import express, { Router } from "express";
import fg from "fast-glob";
import path from "path";
import fs from "fs/promises";
import { makeJsonHandler } from "../handlers/handlers";
import { log, error } from '../utils/utils'
import { METHOD_FILES } from "./builder.enum";

const METHOD_MAP: Record<string, "get"|"post"|"put"|"patch"|"delete"> = {
  "get.json": "get",
  "post.json": "post",
  "put.json": "put",
  "patch.json": "patch",
  "delete.json": "delete"
};

function toRouteSegment(seg: string) {
  if (seg.startsWith("[") && seg.endsWith("]")) {
    const name = seg.slice(1, -1);
    return `:${name}`;
  }
  return seg;
}

function relativize(file: string, root: string) {
  return path.relative(root, file).split(path.sep);
}

function pathFromParts(parts: string[]) {
  const dirs = parts.slice(0, -1).map(toRouteSegment);
  const last = parts[parts.length - 1];
  if (last === "index.json") {
    return { method: "get" as const, route: "/" + dirs.join("/") };
  }
  const method = METHOD_MAP[last];
  if (!method) return null;
  const routePath = "/" + dirs.join("/");
  return { method, route: routePath };
}

export async function buildRouterFromFS(root: string): Promise<Router> {
  const router = express.Router();

  const pattern = Object.values(METHOD_FILES)
    .map(name => `**/${name}`)
    .concat(["**/index.json"]);
  const files = await fg(pattern, { cwd: root, dot: true, onlyFiles: true, absolute: true });

  for (const file of files) {
    const parts = relativize(file, root);
    const mapping = pathFromParts(parts);
    if (!mapping) continue;

    let payload: any;
    try {
      const raw = await fs.readFile(file, "utf8");
      payload = JSON.parse(raw);
    } catch (e) {
      error?.(`invalid JSON: ${file}`, e);
      continue;
    }

    const handler = makeJsonHandler(payload);

    (router as any)[mapping.method](mapping.route, handler);
    log?.(
      `${mapping.method.toUpperCase()} ${mapping.route}  ←  ${path.relative(root, file)}`
    );
  }

  return router;
}
