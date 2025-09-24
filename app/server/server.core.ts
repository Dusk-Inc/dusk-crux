import express from "express";
import path from "path";
import chokidar from "chokidar";
import { buildRouterFromFS } from "../builder/builder.core";
import { log, error } from "console";
import { registerServerRoutes } from './server.routes'


type StartOpts = {
  port: number;
  cruxDir: string;
  cwd: string;
};

export async function startServer(opts: StartOpts) {
  const app = express();
  app.use(express.json());

  const absoluteCrux = path.resolve(opts.cwd, opts.cruxDir);

  let current = await buildRouterFromFS(absoluteCrux);
  app.use((req, res, next) => current(req, res, next));

  await registerServerRoutes(app, absoluteCrux)

  const watcher = chokidar.watch(absoluteCrux, {
    ignoreInitial: true,
    persistent: true
  });

  const rebuild = async () => {
    try {
      const nextRouter = await buildRouterFromFS(absoluteCrux);
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
    log(`crux root: ${absoluteCrux}`);
  });
}
