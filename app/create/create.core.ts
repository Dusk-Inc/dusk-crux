import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'

type ScaffoldOptions = {
  targetDir: string
}

type PackageJson = {
  name?: string
  version?: string
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

export async function scaffoldProject(opts: ScaffoldOptions) {
  const templateRoot = getTemplateRoot()
  await ensureCruxDirectory(opts.targetDir, templateRoot)
  await ensurePackageJson(opts.targetDir)
}

function getTemplateRoot(): string | null {
  const templatePath = path.resolve(__dirname, '../..', 'resources', 'scaffold', '.crux')
  if (!fsSync.existsSync(templatePath)) {
    return null
  }
  return templatePath
}

async function ensureCruxDirectory(targetDir: string, templateRoot: string | null) {
  const destination = path.join(targetDir, '.crux')
  if (await pathExists(destination)) {
    console.log("'.crux' directory already exists - skipping scaffold copy")
    return
  }

  if (templateRoot && (await pathExists(templateRoot))) {
    await copyDirectory(templateRoot, destination)
    console.log("Created '.crux' directory")
    return
  }

  await fs.mkdir(destination, { recursive: true })
  console.log("Created empty '.crux' directory")
}

async function ensurePackageJson(targetDir: string) {
  const packagePath = path.join(targetDir, 'package.json')
  let pkg: PackageJson = {
    name: path.basename(targetDir),
    version: '0.0.0',
    scripts: {}
  }

  if (fsSync.existsSync(packagePath)) {
    try {
      const raw = await fs.readFile(packagePath, 'utf8')
      pkg = JSON.parse(raw)
    } catch (error) {
      throw new Error(`Failed to read package.json: ${error instanceof Error ? error.message : error}`)
    }
  }

  const nextScripts = pkg.scripts ?? {}
  if (!nextScripts['dusk-crux']) {
    nextScripts['dusk-crux'] = 'dusk-crux run'
    console.log("Added 'dusk-crux' npm script")
  } else {
    console.log("'dusk-crux' npm script already exists - leaving as-is")
  }

  const dependencyVersion = getLocalPackageVersion()
  const nextDevDeps = pkg.devDependencies ?? {}
  if (!nextDevDeps['dusk-crux']) {
    nextDevDeps['dusk-crux'] = dependencyVersion
    console.log("Added 'dusk-crux' to devDependencies")
  }

  const nextPackage: PackageJson = {
    ...pkg,
    scripts: sortObjectKeys(nextScripts),
    devDependencies: sortObjectKeys(nextDevDeps)
  }

  const formatted = JSON.stringify(nextPackage, null, 2) + '\n'
  await fs.writeFile(packagePath, formatted, 'utf8')
}

function getLocalPackageVersion(): string {
  const packageJsonPath = path.resolve(__dirname, '../..', 'package.json')
  try {
    const raw = fsSync.readFileSync(packageJsonPath, 'utf8')
    const pkg = JSON.parse(raw)
    return pkg.version ? `^${pkg.version}` : 'latest'
  } catch {
    return 'latest'
  }
}

async function copyDirectory(source: string, destination: string) {
  await fs.mkdir(destination, { recursive: true })
  const entries = await fs.readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name)
    const destPath = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

function sortObjectKeys<T extends Record<string, string>>(obj: T): T {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {})
  return sorted as T
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}
