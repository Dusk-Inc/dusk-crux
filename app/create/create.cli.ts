#!/usr/bin/env node
import { scaffoldProject } from './create.core'

async function main() {
  const targetDir = process.cwd()
  try {
    await scaffoldProject({ targetDir })
    console.log('✔ dusk-crux ready!')
    console.log(" • '.crux' directory is available for editing")
    console.log(" • Run 'npm install' if dependencies need to be updated")
    console.log(" • Start the mock server with 'npm run dusk-crux'")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`dusk-crux setup failed: ${message}`)
    process.exit(1)
  }
}

main()
