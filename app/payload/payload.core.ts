import * as fs from 'fs'
import * as path from 'path'
import fg from 'fast-glob'
import { PayloadErrorCode, ResponseClass } from './payload.enum'
import { RequestContext, ComposeOptions, ComposeResult } from './payload.models'
import { ValidationSummaryModel, ValidationIssue } from '../validator'
import { validateConfig } from '../validator'
import { log } from '../utils/utils.core'

type FileSystemService = {
  existsSync?: (p: string) => boolean
  promises?: {
    readFile?: (p: string, enc?: any) => Promise<string | Buffer>
  }
}

type ReadFile = (p: string, enc?: BufferEncoding) => Promise<string>

function resolveReadFile(fsys?: FileSystemService | typeof fs): { readFile: ReadFile; existsSync?: (p: string) => boolean } {
  const fallback = fs as unknown as FileSystemService & typeof fs
  const active = (fsys ?? fallback) as FileSystemService & typeof fs
  const existsSync = selectExistsSync(active, fallback)
  return {
    async readFile(p: string, enc: BufferEncoding = 'utf8') {
      const selected = selectReadFileCandidate(active, fallback)
      return normalizeRead(selected, p, enc)
    },
    existsSync
  }
}

type CandidateRead = (p: string, enc?: any) => Promise<string | Buffer>

function selectReadFileCandidate(active: FileSystemService & typeof fs, fallback: FileSystemService & typeof fs): CandidateRead {
  if (active.promises?.readFile) return active.promises.readFile.bind(active.promises) as CandidateRead
  if (fallback.promises?.readFile) return fallback.promises.readFile.bind(fallback.promises) as CandidateRead
  throw new Error('readFile is not implemented on the provided file system')
}

function selectExistsSync(active: FileSystemService & typeof fs, fallback: FileSystemService & typeof fs) {
  if (typeof active.existsSync === 'function') return active.existsSync.bind(active)
  if (typeof fallback.existsSync === 'function') return fallback.existsSync.bind(fallback)
  return undefined
}

async function normalizeRead(candidate: CandidateRead, p: string, enc: BufferEncoding): Promise<string> {
  const data = await candidate(p, enc)
  return typeof data === 'string' ? data : data.toString()
}

export async function composePayload(ctx: RequestContext, opts: ComposeOptions = {}): Promise<ComposeResult> {
  const fsys = opts.fileSystem ?? fs
  const cruxDir = opts.cruxDir ?? path.resolve(process.cwd(), '.crux')

  const routeConfigPath = opts.routeFile ?? resolveRouteConfigPath(cruxDir, ctx.path)
  const defaults = await loadDefaultsChain(fsys, cruxDir, path.dirname(routeConfigPath))
  const routeCfg = await loadRouteConfig(fsys, routeConfigPath)
  const composedCfg = composeCruxConfig(defaults, routeCfg)
  const ctxHeaders = normalizeHeaderMap(ctx.headers)

  if (opts.validate) {
    const validationIssues = validateConfig(composedCfg as any)
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
  const actions: any[] = Array.isArray(composedCfg?.actions) ? composedCfg.actions : []
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
  const action = methodMatches.find(a => actionMatchesRequest(a, ctx, ctxHeaders))
  if (!action) {
    return {
      ok: false,
      status: 400,
      headers: {},
      errors: [{ code: PayloadErrorCode.NO_MATCHING_ACTION, message: 'No matching action found' }],
      class: classifyStatus(400)
    }
  }

  const globalRes = composedCfg?.globals?.res ?? {}
  const actionRes = action?.res ?? {}
  const status = (actionRes.status ?? globalRes.status ?? 200) as number

  let body: Buffer | undefined
  const routeDir = path.dirname(routeConfigPath)
  const bodyFile = actionRes.bodyFile as any
  if (typeof bodyFile === 'string') {
    const absoluteBodyPath = resolveBodyFilePath(routeDir, bodyFile, cruxDir)
    body = await readBodyFile(fsys, absoluteBodyPath)
  }

  const headers: Record<string, string> = {
    ...normalizeHeaders(globalRes?.headers as Record<string, string> | undefined),
    ...normalizeHeaders(actionRes?.headers as Record<string, string> | undefined)
  }
  if (typeof bodyFile === 'string' && !headers['content-type']) {
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

export async function composePreflight(opts: ComposeOptions = {}): Promise<ComposeResult> {
  const fsys = opts.fileSystem ?? fs
  const cruxDir = opts.cruxDir ?? path.resolve(process.cwd(), '.crux')
  const routeConfigPath = opts.routeFile

  const targetDir = routeConfigPath ? path.dirname(routeConfigPath) : cruxDir
  const defaults = await loadDefaultsChain(fsys, cruxDir, targetDir)
  let routeCfg: any = null
  if (routeConfigPath) {
    try {
      routeCfg = await loadRouteConfig(fsys, routeConfigPath)
    } catch {
      routeCfg = null
    }
  }
  const composedCfg = composeCruxConfig(defaults, routeCfg)
  const globalRes = composedCfg?.globals?.res ?? {}
  const headers = normalizeHeaders(globalRes?.headers as Record<string, string> | undefined)

  const actions: any[] = Array.isArray(composedCfg?.actions) ? composedCfg.actions : []
  const methods = new Set<string>()
  for (const action of actions) {
    const m = String(action?.req?.method || '').toUpperCase()
    if (m) methods.add(m)
  }
  methods.add('OPTIONS')

  return {
    ok: true,
    status: 204,
    headers,
    allow: Array.from(methods),
    class: classifyStatus(204)
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

function normalizeHeaderMap(headers?: Record<string, unknown>): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      out[key.toLowerCase()] = value.map(v => String(v)).join(', ')
      continue
    }
    if (typeof value === 'object') continue
    out[key.toLowerCase()] = String(value)
  }
  return out
}

export function actionMatchesRequest(action: any, ctx: RequestContext, ctxHeaders: Record<string, string>): boolean {
  const requiredQuery = action?.req?.query || {}
  const requiredParams = action?.req?.params || {}
  const requiredHeaders = normalizeHeaderMap(action?.req?.headers)
  const has = (source: unknown, key: string) => !!source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, key)

  for (const key of Object.keys(requiredQuery)) {
    if (!has(ctx.query, key)) return false
    if (String((ctx.query as any)[key]) !== String((requiredQuery as any)[key])) return false
  }

  for (const key of Object.keys(requiredParams)) {
    if (!has(ctx.params, key)) return false
    if (String((ctx.params as any)[key]) !== String((requiredParams as any)[key])) return false
  }

  for (const [key, value] of Object.entries(requiredHeaders)) {
    if (!has(ctxHeaders, key)) return false
    if (ctxHeaders[key] !== value) return false
  }

  return true
}

export function resolveRouteConfigPath(cruxDir: string, routePath: string): string {
  const trimmed = routePath.replace(/^\/+/, '')
  const parts = trimmed.split('/').filter(Boolean)
  const normalized = parts.map(seg => {
    if (seg.startsWith(':')) return `[${seg.slice(1)}]`
    return seg
  })
  const target = normalized.join('/')
  return path.join(cruxDir, `${target}.crux.json`)
}

export async function loadDefaults(fsys: FileSystemService | typeof fs | undefined, dir: string): Promise<any | null> {
  const { readFile, existsSync } = resolveReadFile(fsys)
  const defaultsPath = path.join(dir, 'defaults.json')
  if (existsSync && !existsSync(defaultsPath)) return null
  try {
    const raw = await readFile(defaultsPath, 'utf8')
    return JSON.parse(raw)
  } catch (error: any) {
    if (error && typeof error === 'object' && (error as any).code === 'ENOENT') return null
    throw error
  }
}

export async function loadDefaultsChain(
  fsys: FileSystemService | typeof fs | undefined,
  cruxDir: string,
  targetDir: string
): Promise<any | null> {
  const normalize = (p: string) => p.replace(/[\\/]+/g, path.sep)
  const root = path.resolve(normalize(cruxDir))
  const target = path.resolve(normalize(targetDir))
  const rel = path.relative(root, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`targetDir ${targetDir} escapes cruxDir ${cruxDir}`)
  }
  const segments = rel === '' ? [] : rel.split(path.sep).filter(Boolean)
  const chain: string[] = [root]
  let current = root
  for (const seg of segments) {
    current = path.join(current, seg)
    chain.push(current)
  }
  let accumulator: any = null
  for (const dir of chain) {
    const cfg = await loadDefaults(fsys, dir)
    if (cfg !== null) {
      accumulator = accumulator === null ? cfg : deepMerge(accumulator, cfg)
    }
  }
  return accumulator
}

export async function loadRouteConfig(fsys: FileSystemService | typeof fs | undefined, routeConfigPath: string): Promise<any> {
  const { readFile } = resolveReadFile(fsys)
  const raw = await readFile(routeConfigPath, 'utf8')
  return JSON.parse(raw)
}

export type LoadCruxRoutesOptions = {
  fileSystem?: FileSystemService | typeof fs
  listFiles?: (root: string) => Promise<string[]>
  listLegacyFiles?: (root: string) => Promise<string[]>
}

export type CruxRouteDescriptor = {
  file: string
  routePath: string
  config: any
}

export async function loadCruxRoutes(cruxDir: string, opts: LoadCruxRoutesOptions = {}): Promise<CruxRouteDescriptor[]> {
  const files = opts.listFiles
    ? await opts.listFiles(cruxDir)
    : await fg('**/*.crux.json', { cwd: cruxDir, dot: true, onlyFiles: true, absolute: true })

  const legacyFiles = opts.listFiles
    ? (opts.listLegacyFiles ? await opts.listLegacyFiles(cruxDir) : [])
    : await fg('**/globals.json', { cwd: cruxDir, dot: true, onlyFiles: true, absolute: true })
  for (const legacy of legacyFiles) {
    log(`legacy 'globals.json' found at ${legacy}; rename to 'defaults.json' (Dusk Crux 2.0 no longer reads globals.json)`)
  }

  const out: CruxRouteDescriptor[] = []
  for (const file of files) {
    try {
      const cfg = await loadRouteConfig(opts.fileSystem, file)
      const routePath = buildRoutePath(file, cruxDir)
      const defaults = await loadDefaultsChain(opts.fileSystem, cruxDir, path.dirname(file.replace(/[\\/]+/g, path.sep)))
      const composed = composeCruxConfig(defaults, cfg)
      out.push({ file, routePath, config: composed })
    } catch {
      continue
    }
  }
  return out
}

export function classifyStatus(status: number): ResponseClass {
  if (status >= 100 && status < 200) return ResponseClass.INFORMATIONAL
  if (status >= 200 && status < 300) return ResponseClass.SUCCESS
  if (status >= 300 && status < 400) return ResponseClass.REDIRECTION
  if (status >= 400 && status < 500) return ResponseClass.CLIENT_ERROR
  return ResponseClass.SERVER_ERROR
}

export function resolveBodyFilePath(baseDir: string, bodyFile: string, allowedRoot: string): string {
  if (path.isAbsolute(bodyFile)) {
    throw new Error('Absolute bodyFile paths are not allowed')
  }
  const normalizedRoot = path.resolve(allowedRoot)
  const full = path.resolve(baseDir, bodyFile)
  const relative = path.relative(normalizedRoot, full)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('bodyFile path escapes the crux root directory')
  }
  return full
}

export async function readBodyFile(fsys: typeof fs, absolutePath: string): Promise<Buffer> {
  const data = await (fsys as any).promises.readFile(absolutePath)
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

function buildRoutePath(file: string, cruxDir: string): string {
  const parts = relativize(file, cruxDir)
  const dirs = parts.slice(0, -1).map(toRouteSegment)
  return '/' + dirs.join('/')
}

function relativize(file: string, root: string) {
  const normalize = (p: string) => p.replace(/[\\/]+/g, path.sep)
  const rel = path.relative(normalize(root), normalize(file))
  return rel.split(path.sep)
}

function toRouteSegment(seg: string) {
  if (seg.startsWith('[') && seg.endsWith(']')) return `:${seg.slice(1, -1)}`
  return seg
}
