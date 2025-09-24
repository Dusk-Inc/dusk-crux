import type { Application } from 'express'
import { validateConfig } from '../validator'
import { loadCruxRoutes, LoadCruxRoutesOptions } from '../payload'

export type ServerRoutesOptions = Pick<LoadCruxRoutesOptions, 'listFiles' | 'fileSystem'>

export async function registerServerRoutes(app: Application, cruxRoot: string, opts: ServerRoutesOptions = {}) {
  const descriptors = await loadCruxRoutes(cruxRoot, {
    listFiles: opts.listFiles,
    fileSystem: opts.fileSystem
  })

  const parsed = descriptors.map(d => ({ cfg: d.config, routePath: d.routePath, file: d.file }))

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