#!/usr/bin/env node
import { startServer } from "./server/index";
import * as fs from "fs";
import path from "path";

function parseArgs(argv: string[]) {
  const args = { cmd: "run", port: 4000, cruxDir: ".crux" };
  const rest = argv.slice(2);

  if (rest[0]) args.cmd = rest[0];

  for (let i = 1; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--port" || a === "-p") {
      args.port = Number(rest[++i] ?? args.port);
    } else if (a === "--root" || a === "-r") {
      args.cruxDir = String(rest[++i] ?? args.cruxDir);
    }
  }

  return args;
}

(function main() {
  const parsed = parseArgs(process.argv);
  const cwd = process.cwd();

  try {
    const { port, cruxDir } = validateCliOptions({ port: parsed.port, cruxDir: parsed.cruxDir, cwd });

    if (parsed.cmd === "run") {
      startServer({
        port,
        cruxDir,
        cwd
      }).catch(err => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      });
    } else {
      console.log(`Unknown command: ${parsed.cmd}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();

type CliValidationInput = {
  port: number;
  cruxDir: string;
  cwd: string;
}

function validateCliOptions(opts: CliValidationInput): { port: number; cruxDir: string } {
  const port = Number(opts.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${opts.port}. Use an integer between 1 and 65535.`);
  }

  const normalizedCwd = path.resolve(opts.cwd);
  const resolvedCrux = path.resolve(normalizedCwd, opts.cruxDir);
  const relative = path.relative(normalizedCwd, resolvedCrux);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Crux directory must be inside the current working directory: ${opts.cruxDir}`);
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedCrux);
  } catch {
    throw new Error(`Crux directory does not exist: ${resolvedCrux}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Crux path is not a directory: ${resolvedCrux}`);
  }

  return { port, cruxDir: relative || '.' };
}
