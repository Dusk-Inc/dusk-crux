#!/usr/bin/env node
import { startServer } from "./server/index";

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

(async () => {
  const { cmd, port, cruxDir } = parseArgs(process.argv);

  if (cmd === "run") {
    await startServer({
      port,
      cruxDir,
      cwd: process.cwd()
    });
  } else {
    console.log(`Unknown command: ${cmd}`);
    process.exit(1);
  }
})();