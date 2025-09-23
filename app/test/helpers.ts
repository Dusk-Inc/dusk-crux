import { ActionSpec } from '../validator/validator.models'

export const vfsDir: string = '/vfs/.crux';
export function createVfs(
  cruxDir: string,
  routePath: string,
  actions: ActionSpec[],
  globals: any = { res: { status: 200 } },
  extraFiles: Record<string, string> = {}
) {
  if (!Array.isArray(actions)) throw new Error('actions must be an array of ActionSpec')
  const files: Record<string, string> = {
    [`${cruxDir}/globals.json`]: JSON.stringify(globals),
    [`${cruxDir}/${routePath}.crux.json`]: JSON.stringify({ actions })
  }
  for (const [rel, content] of Object.entries(extraFiles)) {
    const trimmed = rel.replace(/^\/+/, '')
    files[`${cruxDir}/${trimmed}`] = content
  }
  const mockFs: any = {
    existsSync: (p: string) => p in files,
    promises: {
      readFile: async (p: string, enc: string) => {
        if (!(p in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        return files[p]
      }
    }
  }
  ;(mockFs as any)._files = files
  return { mockFs, cruxDir }
}