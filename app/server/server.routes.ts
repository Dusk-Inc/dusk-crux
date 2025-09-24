import type { Application } from 'express'
import fg from 'fast-glob'
import path from 'path'
import fs from 'fs/promises'
import { validateConfig } from '../validator'
import { composeCruxConfig } from '../payload'

function toRouteSegment(seg: string) {
  if (seg.startsWith('[') && seg.endsWith(']')) return `:${seg.slice(1, -1)}`
  return seg
}

function relativize(file: string, root: string) {
  const normalizeSeps = (p: string) => p.replace(/[\\/]+/g, path.sep)
  const rel = path.relative(normalizeSeps(root), normalizeSeps(file))
  return rel.split(path.sep)
}

export type ServerRoutesOptions = {
  listFiles?: (root: string) => Promise<string[]>
  fileSystem?: { promises: { readFile: (p: string, enc?: string) => Promise<string> } }
}

export async function registerServerRoutes(app: Application, cruxRoot: string, opts: ServerRoutesOptions = {}) {
  const pattern = ['**/*.crux.json']
  async function loadGlobals(): Promise<any | null> {
    try {
      const readFile = opts.fileSystem?.promises?.readFile ?? fs.readFile
      const raw = await readFile(path.join(cruxRoot, 'globals.json'), 'utf8')
      return JSON.parse(raw)
    } catch { return null }
  }
  const globals = await loadGlobals()
  const files = opts.listFiles
    ? await opts.listFiles(cruxRoot)
    : await fg(pattern, { cwd: cruxRoot, dot: true, onlyFiles: true, absolute: true })

  const parsed: Array<{ cfg: any; routePath: string; file: string }>= []
  for (const file of files) {
    let cfg: any
    try {
      const readFile = opts.fileSystem?.promises?.readFile ?? fs.readFile
      const raw = await readFile(file, 'utf8')
      cfg = JSON.parse(raw)
    } catch {
      continue
    }
    const parts = relativize(file, cruxRoot)
    const dirs = parts.slice(0, -1).map(toRouteSegment)
    const routePath = '/' + dirs.join('/')
    const comp = composeCruxConfig(globals, cfg)
    parsed.push({ cfg: comp, routePath, file })
  }

  app.get('/', (_req, res) => {
    const routes = parsed.map(({ cfg, routePath }) => {
      const actions: any[] = Array.isArray(cfg?.actions) ? cfg.actions : []
      const pathParams = routePath.split('/').filter(s => s.startsWith(':')).map(s => s.slice(1))
      const actionSummaries = actions.map(a => {
        const methodUpper = String(a?.req?.method || '').toUpperCase()
        const status = a?.res?.status ?? 200
        return {
          name: a?.name,
          description: a?.description,
          method: methodUpper,
          status,
          query: a?.req?.query || {},
          params: a?.req?.params || {}
        }
      })
      return { path: routePath, params: pathParams, actions: actionSummaries }
    })
    res.json({ routes })
  })

  app.get('/health', (_req, res) => {
    const allIssues = parsed.flatMap(({ cfg, routePath }) => {
      const n = Array.isArray(cfg?.actions) ? cfg.actions.length : 0
      const dirs = Array(n).fill(routePath)
      return validateConfig(cfg, { actionDirs: dirs })
    })
    res.json({ ok: allIssues.length === 0, issues: allIssues })
  })
}
