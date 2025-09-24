import express, { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { log } from '../utils/utils.core'
import { validateConfig, ValidationIssue } from "../validator";
import { ValidationSeverity } from '../validator/validator.enum';
import { ConsoleColors } from "../utils/utils.enum";
import { composePayload, loadCruxRoutes, LoadCruxRoutesOptions } from "../payload";
import type { CruxRouteDescriptor } from "../payload/payload.core";
import type { RequestContext, ComposeResult } from "../payload/payload.models";

export type BuildOptions = Pick<LoadCruxRoutesOptions, 'fileSystem' | 'listFiles'>

export async function buildRouterFromFS(root: string, opts: BuildOptions = {}): Promise<Router> {
  const router = express.Router();

  const descriptors = await loadCruxRoutes(root, {
    fileSystem: opts.fileSystem,
    listFiles: opts.listFiles
  })

  for (const descriptor of descriptors) {
    const actions: any[] = Array.isArray(descriptor.config?.actions) ? descriptor.config.actions : []
    const issues: ValidationIssue[] = validateConfig(descriptor.config, {
      actionDirs: Array(actions.length).fill(descriptor.routePath)
    })
    if (issues.length > 0) {
      logIssues(issues, descriptor.routePath, path.relative(root, descriptor.file))
      continue
    }

    registerRoute(router, descriptor, root, opts)
  }

  return router;
}

function registerRoute(router: Router, descriptor: CruxRouteDescriptor, root: string, opts: BuildOptions) {
  const actions: any[] = Array.isArray(descriptor.config?.actions) ? descriptor.config.actions : []
  const methods = new Map<string, Function>()

  for (const action of actions) {
    const method = String(action?.req?.method || '').toLowerCase()
    if (!method || typeof (router as any)[method] !== 'function') continue
    if (!methods.has(method)) {
      const handler = createActionHandler(descriptor, root, opts)
      methods.set(method, handler)
      ;(router as any)[method](descriptor.routePath, handler)
    }
    log?.(`${method.toUpperCase()} ${descriptor.routePath}  ←  ${path.relative(root, descriptor.file)}#${action?.name ?? 'action'}`)
  }
}

function createActionHandler(descriptor: CruxRouteDescriptor, root: string, opts: BuildOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = buildRequestContext(req)
      const result = await composePayload(ctx, {
        cruxDir: root,
        fileSystem: opts.fileSystem as any,
        routeFile: descriptor.file
      })
      applyComposeResult(res, result)
    } catch (err) {
      next(err)
    }
  }
}

function buildRequestContext(req: Request): RequestContext {
  return {
    path: req.path.replace(/^\/+/, ''),
    method: req.method,
    headers: extractHeaders(req.headers as Record<string, unknown>),
    query: extractValues(req.query as Record<string, unknown>),
    params: extractValues(req.params as Record<string, unknown>)
  }
}

function applyComposeResult(res: Response, result: ComposeResult) {
  if (result.allow && result.allow.length > 0) {
    res.set('Allow', result.allow.join(', '))
  }
  for (const [key, value] of Object.entries(result.headers || {})) {
    res.set(key, value)
  }
  res.status(result.status)
  if (result.body !== undefined && result.body !== null) {
    res.send(result.body)
    return
  }
  if (result.errors && result.errors.length > 0) {
    res.json({ errors: result.errors })
    return
  }
  res.end()
}

function extractHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) out[key] = value.map(v => String(v)).join(', ')
    else if (value !== undefined && value !== null && typeof value !== 'object') out[key] = String(value)
  }
  return out
}

function extractValues(values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values || {})) {
    if (Array.isArray(value)) out[key] = value.map(v => String(v)).join(', ')
    else if (value !== undefined && value !== null && typeof value !== 'object') out[key] = String(value)
    else if (typeof value === 'object' && value !== null) out[key] = JSON.stringify(value)
  }
  return out
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
