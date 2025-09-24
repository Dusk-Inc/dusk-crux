import * as fs from 'fs'
import * as path from 'path'
import { PayloadErrorCode, ResponseClass } from './payload.enum'
import { RequestContext, ComposeOptions, ComposeResult } from './payload.models'
import { ValidationSummaryModel, ValidationIssue } from '../validator'
import { validateConfig } from '../validator'

export async function composePayload(ctx: RequestContext, opts: ComposeOptions = {}): Promise<ComposeResult> {
  const fsys = opts.fileSystem ?? fs
  const cruxDir = opts.cruxDir ?? path.resolve(process.cwd(), '.crux')

  const routeConfigPath = resolveRouteConfigPath(cruxDir, ctx.path)
  const globals = await loadGlobals(fsys, cruxDir)
  const routeCfg = await loadRouteConfig(fsys, routeConfigPath)

  const effectiveCfg = { ...routeCfg, globals: deepMerge(globals || {}, routeCfg?.globals || {}) }
  if (opts.validate) {
    const validationIssues = validateConfig(effectiveCfg as any)
    if (validationIssues.length > 0) {
      return {
        ok: false,
        status: 400,
        headers: {},
        errors: validationIssues.map(i => ({ code: PayloadErrorCode.VALIDATION_FAILED, message: i.message })),
        class: classifyStatus(400)
      }
    }
  }

  const method = String(ctx.method || '').toLowerCase()
  const actions: any[] = Array.isArray(routeCfg?.actions) ? routeCfg.actions : []
  const methodMatches = actions.filter(a => (a?.req?.method || '').toLowerCase() === method)
  if (methodMatches.length === 0) {
    return {
      ok: false,
      status: 405,
      headers: {},
      allow: Array.from(new Set(actions.map(a => (a?.req?.method || '').toUpperCase()).filter(Boolean))),
      class: classifyStatus(405)
    }
  }
  const matchesConstraints = (a: any) => {
    const qp = a?.req?.query || {}
    const pp = a?.req?.params || {}
    const has = (o: any, k: string) => o && Object.prototype.hasOwnProperty.call(o, k)
    for (const k of Object.keys(qp)) {
      if (!has(ctx.query || {}, k) || String((ctx.query as any)[k]) !== String((qp as any)[k])) return false
    }
    for (const k of Object.keys(pp)) {
      if (!has(ctx.params || {}, k) || String((ctx.params as any)[k]) !== String((pp as any)[k])) return false
    }
    return true
  }
  const action = methodMatches.find(matchesConstraints)
  if (!action) {
    return {
      ok: false,
      status: 400,
      headers: {},
      errors: [{ code: PayloadErrorCode.NO_MATCHING_ACTION, message: 'No matching action found' }],
      class: classifyStatus(400)
    }
  }

  const globalRes = globals?.res ?? {}
  const routeRes = routeCfg?.globals?.res ?? {}
  const actionRes = action?.res ?? {}
  const status = (actionRes.status ?? routeRes.status ?? globalRes.status ?? 200) as number

  let body: Buffer | undefined
  const routeDir = path.dirname(routeConfigPath)
  const bodyFile = actionRes.bodyFile as any
  if (typeof bodyFile === 'string') {
    await ensureRelativeBodyFile(bodyFile)
    body = await readBodyFile(fsys, routeDir, bodyFile)
  }

  const headers: Record<string,string> = {}
  if (typeof bodyFile === 'string') {
    headers['content-type'] = contentTypeFor(bodyFile)
  }

  return {
    ok: true,
    status,
    headers,
    body,
    class: classifyStatus(status)
  }
}

export function composeCruxConfig(globalsJson: any | null, routeCfg: any): any {
  const effectiveGlobals = deepMerge(globalsJson || {}, routeCfg?.globals || {})
  const actions = Array.isArray(routeCfg?.actions) ? routeCfg.actions : []
  const composedActions = actions.map((a: any) => {
    const effReq = deepMerge(effectiveGlobals?.req || {}, a?.req || {})
    const effRes = deepMerge(effectiveGlobals?.res || {}, a?.res || {})
    const normReq = { ...(effReq || {}) }
    if (typeof normReq.method === 'string') normReq.method = normReq.method.toLowerCase()
    const q = normReq.query || {}
    const p = normReq.params || {}
    const query: Record<string, string> = {}
    for (const k of Object.keys(q || {})) query[k] = String((q as any)[k])
    const params: Record<string, string> = {}
    for (const k of Object.keys(p || {})) params[k] = String((p as any)[k])
    normReq.query = query
    normReq.params = params
    const normRes = { ...(effRes || {}) }
    return {
      name: a?.name,
      description: a?.description,
      req: normReq,
      res: normRes
    }
  })
  return { ...routeCfg, globals: effectiveGlobals, actions: composedActions }
}

export function deepMerge<T>(base: T, override: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(override as any ?? [])] : { ...(base as any) }
  if (Array.isArray(base)) return out as T
  for (const [k, v] of Object.entries(override || {})) {
    const bv = (base as any)[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, v as any)
    } else {
      out[k] = v
    }
  }
  return out as T
}

export function normalizeHeaders(h?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(h || {})) out[k.toLowerCase()] = String((h as any)[k])
  return out
}

export function resolveRouteConfigPath(cruxDir: string, routePath: string): string {
  const trimmed = routePath.replace(/^\/+/, '')
  return path.join(cruxDir, `${trimmed}.crux.json`)
}

export async function loadGlobals(fsys: typeof fs, cruxDir: string): Promise<any | null> {
  const p = path.join(cruxDir, 'globals.json')
  if (!fsys.existsSync(p)) return null
  const raw = await (fsys as any).promises.readFile(p, 'utf8')
  return JSON.parse(raw)
}

export async function loadRouteConfig(fsys: typeof fs, routeConfigPath: string): Promise<any> {
  const raw = await (fsys as any).promises.readFile(routeConfigPath, 'utf8')
  return JSON.parse(raw)
}

export function classifyStatus(status: number): ResponseClass {
  if (status >= 100 && status < 200) return ResponseClass.INFORMATIONAL
  if (status >= 200 && status < 300) return ResponseClass.SUCCESS
  if (status >= 300 && status < 400) return ResponseClass.REDIRECTION
  if (status >= 400 && status < 500) return ResponseClass.CLIENT_ERROR
  return ResponseClass.SERVER_ERROR
}

export async function ensureRelativeBodyFile(bodyFile: string): Promise<void> {
  if (path.isAbsolute(bodyFile)) {
    throw new Error('Absolute bodyFile paths are not allowed')
  }
}

export async function readBodyFile(fsys: typeof fs, baseDir: string, bodyFile: string): Promise<Buffer> {
  const full = path.resolve(baseDir, bodyFile)
  const data = await (fsys as any).promises.readFile(full)
  return Buffer.isBuffer(data) ? data : Buffer.from(String(data))
}

export function toValidationSummary(issues: ValidationIssue[]): ValidationSummaryModel {
  return { ok: issues.length === 0, issues }
}

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.xml') return 'application/xml; charset=utf-8'
  if (ext === '.txt' || ext === '.html' || ext === '.md') {
    if (ext === '.txt') return 'text/plain; charset=utf-8'
    if (ext === '.html') return 'text/html; charset=utf-8'
    return 'text/plain; charset=utf-8'
  }
  return 'application/octet-stream'
}
