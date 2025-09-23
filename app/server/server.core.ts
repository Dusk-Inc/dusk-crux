import express from "express";
import path from "path";
import chokidar from "chokidar";
import { buildRouterFromFS } from "../builder/builder.core";
import { log, error } from "console";


type StartOpts = {
  port: number;
  latticeDir: string;
  cwd: string;
};

export async function startServer(opts: StartOpts) {
  const app = express();
  app.use(express.json());

  const absoluteLattice = path.resolve(opts.cwd, opts.latticeDir);

  let current = await buildRouterFromFS(absoluteLattice);
  app.use((req, res, next) => current(req, res, next));

  app.get("/__lattice/health", (_req, res) =>
    res.json({ ok: true, lattice: absoluteLattice })
  );

  const watcher = chokidar.watch(absoluteLattice, {
    ignoreInitial: true,
    persistent: true
  });

  const rebuild = async () => {
    try {
      const nextRouter = await buildRouterFromFS(absoluteLattice);
      current = nextRouter;
      log(`routes reloaded`);
    } catch (err) {
      error(`rebuild failed`, err);
    }
  };

  watcher.on("add", rebuild)
         .on("change", rebuild)
         .on("unlink", rebuild)
         .on("addDir", rebuild)
         .on("unlinkDir", rebuild);

  app.listen(opts.port, () => {
    log(`listening on http://localhost:${opts.port}`);
    log(`lattice root: ${absoluteLattice}`);
  });
}
