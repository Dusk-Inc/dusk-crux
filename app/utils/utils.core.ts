import { HttpNoBodyStatus } from "../validator/validator.enum";
import { STATUS_CODES } from "http";
import { Request, Response, NextFunction } from "express";

export function isEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

export function isValidMediaType(mt: string): boolean {
  return /^[\w!#$&^.-]+\/[\w!#$&^.+-]+/.test(mt);
}

export function statusForbidsBody(status?: number): boolean {
  if (status === undefined || status === null) return false;
  if (status === HttpNoBodyStatus.NO_CONTENT_204 || status === HttpNoBodyStatus.NOT_MODIFIED_304) return true;
  return status >= 100 && status < 200;
}

export function toLowerKeys(obj: Record<string, unknown> | undefined | null): Record<string, unknown> | null {
  if (!obj) return null;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) out[k.toLowerCase()] = (obj as any)[k];
  return out;
}

export function extractPathParamsFromDir(absoluteDirPath: string): string[] {
  const parts = absoluteDirPath.split(/[\\/]/);
  const params: string[] = [];
  for (const p of parts) {
    if (p.startsWith(":") && p.length > 1) params.push(p.slice(1));
  }
  return params;
}

export function fileExistsSync(fsModule: typeof import("fs"), path: string): boolean {
  try { return fsModule.statSync(path).isFile(); } catch { return false; }
}

export function log(message: string){
    console.log(`[dusk-crux]: ${message}`)
}

export function error(message: string, additional: any = ""){
    console.error(`[dusk-crux]: ${message} ${additional}`)
}

export function isValidHttpStatus(code: unknown): boolean {
  if (typeof code !== "number") return false;
  return Object.prototype.hasOwnProperty.call(STATUS_CODES, code);
}

export function makeJsonHandler(payload: any) {
  return (_req: Request, res: Response, _next: NextFunction) => {
    res.json(payload ?? {});
  };
}