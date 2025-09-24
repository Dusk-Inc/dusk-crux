import { jest } from '@jest/globals'

jest.mock('chokidar', () => {
  const callbacks: Record<string, Function> = {};
  const api = {
    watch: jest.fn(() => ({
      on(event: string, cb: Function) { callbacks[event] = cb; return this; }
    })),
    __callbacks: callbacks
  } as any;
  return api;
});

jest.mock('express', () => {
  const use = jest.fn();
  const get = jest.fn();
  const listen = jest.fn((_port: number, cb?: Function) => { if (cb) cb(); });
  const json = () => (_req: any, _res: any, next: Function) => next();
  const app = { use, get, listen };
  const express = () => app;
  (express as any).Router = () => ({ stack: [] });
  (express as any).json = json;
  return express;
});

jest.mock('../builder/builder.core', () => {
  return {
    buildRouterFromFS: jest.fn(async (_root: string) => {
      const mw: any = (_req: any, _res: any, next: Function) => next();
      (mw as any).stack = [];
      return mw;
    })
  };
});

import { describe, test, expect } from '@jest/globals'
import chokidar from 'chokidar'
import { buildRouterFromFS } from '../builder/builder.core'
import { startServer } from './server.core'
import { registerServerRoutes } from './server.routes'
import { createVfs, vfsDir } from '../test/helpers'
describe('server_rebuild_triggers', () => {
  test('file_added_triggers_rebuild__router_rebuilt', async () => {
    (buildRouterFromFS as jest.Mock).mockClear();
    const opts = { port: 0, cruxDir: vfsDir, cwd: '/' } as any;
    await startServer(opts);
    const initialCalls = (buildRouterFromFS as jest.Mock).mock.calls.length;
    const cb = (chokidar as any).__callbacks['add'];
    expect(typeof cb).toBe('function');
    await cb('somefile.crux.json');
    expect((buildRouterFromFS as jest.Mock).mock.calls.length).toBe(initialCalls + 1);
  })

  test('file_changed_triggers_rebuild__router_rebuilt', async () => {
    (buildRouterFromFS as jest.Mock).mockClear();
    const opts = { port: 0, cruxDir: vfsDir, cwd: '/' } as any;
    await startServer(opts);
    const initialCalls = (buildRouterFromFS as jest.Mock).mock.calls.length;
    const cb = (chokidar as any).__callbacks['change'];
    expect(typeof cb).toBe('function');
    await cb('somefile.crux.json');
    expect((buildRouterFromFS as jest.Mock).mock.calls.length).toBe(initialCalls + 1);
  })

  test('file_unlinked_triggers_rebuild__router_rebuilt', async () => {
    (buildRouterFromFS as jest.Mock).mockClear();
    const opts = { port: 0, cruxDir: vfsDir, cwd: '/' } as any;
    await startServer(opts);
    const initialCalls = (buildRouterFromFS as jest.Mock).mock.calls.length;
    const cb = (chokidar as any).__callbacks['unlink'];
    expect(typeof cb).toBe('function');
    await cb('somefile.crux.json');
    expect((buildRouterFromFS as jest.Mock).mock.calls.length).toBe(initialCalls + 1);
  })

  test('directory_added_triggers_rebuild__router_rebuilt', async () => {
    (buildRouterFromFS as jest.Mock).mockClear();
    const opts = { port: 0, cruxDir: vfsDir, cwd: '/' } as any;
    await startServer(opts);
    const initialCalls = (buildRouterFromFS as jest.Mock).mock.calls.length;
    const cb = (chokidar as any).__callbacks['addDir'];
    expect(typeof cb).toBe('function');
    await cb('somedir');
    expect((buildRouterFromFS as jest.Mock).mock.calls.length).toBe(initialCalls + 1);
  })

  test('directory_unlinked_triggers_rebuild__router_rebuilt', async () => {
    (buildRouterFromFS as jest.Mock).mockClear();
    const opts = { port: 0, cruxDir: vfsDir, cwd: '/' } as any;
    await startServer(opts);
    const initialCalls = (buildRouterFromFS as jest.Mock).mock.calls.length;
    const cb = (chokidar as any).__callbacks['unlinkDir'];
    expect(typeof cb).toBe('function');
    await cb('somedir');
    expect((buildRouterFromFS as jest.Mock).mock.calls.length).toBe(initialCalls + 1);
  })
})

describe('server_routes_endpoints', () => {
  test('dir_route_outputs_api_structure__available_by_default', async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/[id]/user', [
      { name: 'getUser', description: 'get user', req: { method: 'GET', query: { version: 'beta', page: 1 } as any, params: { id: 1 } as any, headers: { required: ['authorization'] } as any } as any, res: { status: 200, bodyFile: null } as any }
    ] as any)

    const expressFactory: any = require('express')
    const app = expressFactory()
    ;((app as any).get as jest.Mock).mockClear()

    await registerServerRoutes(app as any, cruxDir, {
      fileSystem: mockFs,
      listFiles: (root) => Promise.resolve(Object.keys((mockFs as any)._files).filter(f => f.startsWith(root) && f.endsWith('.crux.json')))
    })

    const getMock: jest.Mock = (app as any).get
    const dirCalls = getMock.mock.calls.filter((c: any[]) => c[0] === '/')
    const call = dirCalls[dirCalls.length - 1]!
    expect(call).toBeDefined()
    const handler = call[1] as Function
    let payload: any = null
    const res: any = { json: (p: any) => { payload = p } }
    await handler({}, res)
    expect(payload && Array.isArray(payload.routes)).toBe(true)
    const entry = payload.routes.find((r: any) => r.path === '/user/:id')
    expect(entry).toBeDefined()
    // methods array removed from root listing; verify action method instead
    expect(entry.params.includes('id')).toBe(true)
    const act = entry.actions && entry.actions[0]
    expect(act).toBeDefined()
    expect(act.description).toBeDefined()
    expect(act.method).toBe('GET')
    expect(act.status).toBe(200)
    expect(typeof act.query).toBe('object')
    expect(act.query).toEqual(expect.objectContaining({ version: 'beta' }))
    expect(Object.prototype.hasOwnProperty.call(act, 'headers')).toBe(false)
  })

  test('health_route_exposes_validation_results__available_by_default', async () => {
    const validActions = [
      { name: 'getUser', description: 'ok', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any
    const invalidCfg = { actions: [ { name: 'bad', description: 'bad', req: {} as any, res: {} as any } ] }
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/user', validActions, { res: { status: 200 } }, {
      'bad/bad.crux.json': JSON.stringify(invalidCfg)
    })

    const expressFactory: any = require('express')
    const app = expressFactory()
    ;((app as any).get as jest.Mock).mockClear()

    await registerServerRoutes(app as any, cruxDir, {
      fileSystem: mockFs,
      listFiles: (root) => Promise.resolve(Object.keys((mockFs as any)._files).filter(f => f.startsWith(root) && f.endsWith('.crux.json')))
    })

    const getMock: jest.Mock = (app as any).get
    const healthCalls = getMock.mock.calls.filter((c: any[]) => c[0] === '/health')
    const call = healthCalls[healthCalls.length - 1]!
    expect(call).toBeDefined()
    const handler = call[1] as Function
    let payload: any = null
    const res: any = { json: (p: any) => { payload = p } }
    await handler({}, res)
    expect(payload && typeof payload === 'object').toBe(true)
    expect(Array.isArray(payload.issues)).toBe(true)
    expect(payload.ok).toBe(false)
    expect(payload.issues.length).toBeGreaterThan(0)
  })

  test('dir_inherits_method_and_status_from_globals__composed_in_listing', async () => {
    const validActions = [
      { name: 'inherited', description: 'inherits', req: { } as any, res: { } as any }
    ] as any
    const { mockFs, cruxDir } = createVfs(vfsDir, 'inherit/user', validActions, { req: { method: 'get' }, res: { status: 200 } })

    const expressFactory: any = require('express')
    const app = expressFactory()
    ;((app as any).get as jest.Mock).mockClear()

    await registerServerRoutes(app as any, cruxDir, {
      fileSystem: mockFs,
      listFiles: (root) => Promise.resolve(Object.keys((mockFs as any)._files).filter(f => f.startsWith(root) && f.endsWith('.crux.json')))
    })

    const getMock: jest.Mock = (app as any).get
    const dirCalls = getMock.mock.calls.filter((c: any[]) => c[0] === '/')
    const call = dirCalls[dirCalls.length - 1]!
    const handler = call[1] as Function
    let payload: any = null
    const res: any = { json: (p: any) => { payload = p } }
    await handler({}, res)
    const entry = payload.routes.find((r: any) => r.path === '/inherit')
    expect(entry).toBeDefined()
    const act = entry.actions && entry.actions[0]
    expect(act.method).toBe('GET')
    expect(act.status).toBe(200)
  })

  test('route_level_globals_override_globals_json__reflected_in_listing', async () => {
    const actions = [
      { name: 'ovr', description: 'route overrides', req: {} as any, res: {} as any }
    ] as any
    const routeJson = JSON.stringify({
      globals: { req: { method: 'post' }, res: { status: 201 } },
      actions
    })
    const { mockFs, cruxDir } = createVfs(vfsDir, 'ovr/user', actions, { req: { method: 'get' }, res: { status: 200 } }, {
      'ovr/user.crux.json': routeJson
    })

    const expressFactory: any = require('express')
    const app = expressFactory()
    ;((app as any).get as jest.Mock).mockClear()

    await registerServerRoutes(app as any, cruxDir, {
      fileSystem: mockFs,
      listFiles: (root) => Promise.resolve(Object.keys((mockFs as any)._files).filter(f => f.startsWith(root) && f.endsWith('.crux.json')))
    })

    const getMock: jest.Mock = (app as any).get
    const dirCalls = getMock.mock.calls.filter((c: any[]) => c[0] === '/')
    const call = dirCalls[dirCalls.length - 1]!
    const handler = call[1] as Function
    let payload: any = null
    const res: any = { json: (p: any) => { payload = p } }
    await handler({}, res)

    const entry = payload.routes.find((r: any) => r.path === '/ovr')
    expect(entry).toBeDefined()
    const act = entry.actions && entry.actions[0]
    expect(act.method).toBe('POST')
    expect(act.status).toBe(201)
  })
})
