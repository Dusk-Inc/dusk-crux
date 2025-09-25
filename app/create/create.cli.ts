#!/usr/bin/env node
import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'

type ScaffoldOptions = {
  targetDir: string
}

async function main() {
  const targetDir = process.cwd()
  try {
    await scaffoldProject({ targetDir })
    console.log('✔ dusk-crux ready!')
    console.log(" • '.crux' directory is available for editing")
    console.log(" • Run 'npm install' if dependencies need to be updated")
    console.log(" • Start the mock server with 'npm run crux'")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`dusk-crux setup failed: ${message}`)
    process.exit(1)
  }
}

async function scaffoldProject(opts: ScaffoldOptions) {
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
  let pkg: any = {
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

  pkg.scripts = pkg.scripts ?? {}
  if (!pkg.scripts.crux) {
    pkg.scripts.crux = 'dusk-crux run'
    console.log("Added 'crux' npm script")
  } else {
    console.log("'crux' npm script already exists - leaving as-is")
  }

  const dependencyVersion = getLocalPackageVersion()
  const devDeps = pkg.devDependencies ?? {}
  if (!devDeps['dusk-crux']) {
    devDeps['dusk-crux'] = dependencyVersion
    console.log("Added 'dusk-crux' to devDependencies")
  }
  pkg.devDependencies = sortObjectKeys(devDeps)
  pkg.scripts = sortObjectKeys(pkg.scripts)

  const formatted = JSON.stringify(pkg, null, 2) + '\n'
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

function sortObjectKeys<T extends Record<string, any>>(obj: T): T {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
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

main()
