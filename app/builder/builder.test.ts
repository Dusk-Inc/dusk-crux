import { describe, test, expect } from '@jest/globals'
import { buildRouterFromFS } from './builder.core'
import { createVfs, vfsDir } from '../test/helpers'
import { ActionSpec } from '../validator';

describe("builder", () => {
  function listVfsCruxFiles(mockFs: any, root: string): string[] {
    const files = Object.keys((mockFs as any)._files || {});
    return files.filter(f => f.startsWith(root) && f.endsWith('.crux.json'));
  }

  test("user_folder_with_user_crux_json__routes_for_action_methods_created", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/user', [
      { name: 'getUser', description: 'get user', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any },
      { name: 'createUser', description: 'create user', req: { method: 'POST' } as any, res: { status: 201, bodyFile: null } as any }
    ] as any);

    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: (root) => Promise.resolve(listVfsCruxFiles(mockFs, root)) });
    const stack: any[] = (router as any).stack || [];
    const routes = stack.filter(l => l?.route?.path === '/user').map(l => l.route);
    const methods = new Set<string>();
    for (const r of routes) {
      for (const k of Object.keys(r.methods || {})) {
        if (r.methods[k]) methods.add(k);
      }
    }
    expect(methods.has('get')).toBe(true);
    expect(methods.has('post')).toBe(true);
  })
  
  test("non_crux_json_files_ignored__no_route_created", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/noop', [] as any, { res: { status: 200 } }, { 'user/get.json': JSON.stringify({ ok: true }) });
    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: (root) => Promise.resolve(listVfsCruxFiles(mockFs, root)) });
    const stack: any[] = (router as any).stack || [];
    const userRoutes = stack.filter(l => l?.route?.path === '/user');
    expect(userRoutes.length).toBe(0);
  })
  
  test("param_dir_user_id__creates_route_with_id_param", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/[id]/user', [
      { name: 'getUser', description: 'get user by id', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any);

    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: (root) => Promise.resolve(listVfsCruxFiles(mockFs, root)) });
    const stack: any[] = (router as any).stack || [];
    const routes = stack.filter(l => l?.route?.path === '/user/:id').map(l => l.route);
    const methods = new Set<string>();
    for (const r of routes) {
      for (const k of Object.keys(r.methods || {})) {
        if (r.methods[k]) methods.add(k);
      }
    }
    expect(methods.has('get')).toBe(true);
  })

  test("nested_param_dir_user_id_details__creates_route_with_id_param", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/[id]/details/details', [
      { name: 'getDetails', description: 'get user details', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any);

    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: (root) => Promise.resolve(listVfsCruxFiles(mockFs, root)) });
    const stack: any[] = (router as any).stack || [];
    const routes = stack.filter(l => l?.route?.path === '/user/:id/details').map(l => l.route);
    const methods = new Set<string>();
    for (const r of routes) {
      for (const k of Object.keys(r.methods || {})) {
        if (r.methods[k]) methods.add(k);
      }
    }
    expect(methods.has('get')).toBe(true);
  })

  test("multi_param_dirs_user_id_details_detail_id__creates_route_with_two_params", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'user/[id]/details/[detail_id]/cfg', [
      { name: 'getDetail', description: 'get user detail', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any);

    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: (root) => Promise.resolve(listVfsCruxFiles(mockFs, root)) });
    const stack: any[] = (router as any).stack || [];
    const routes = stack.filter(l => l?.route?.path === '/user/:id/details/:detail_id').map(l => l.route);
    const methods = new Set<string>();
    for (const r of routes) {
      for (const k of Object.keys(r.methods || {})) {
        if (r.methods[k]) methods.add(k);
      }
    }
    expect(methods.has('get')).toBe(true);
  })
  
  test("valid_mounts_invalid_skipped__partial_mounting_supported", async () => {
    const validActions = [
      { name: 'ok', description: 'ok', req: { method: 'get' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any;
    const invalidCfg = { actions: [ { name: 'bad', description: 'bad', req: {} as any, res: {} as any } ] };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'good/user', validActions, { res: { status: 200 } }, {
      'bad/bad.crux.json': JSON.stringify(invalidCfg)
    });

    const list = (root: string) => Promise.resolve(Object.keys((mockFs as any)._files).filter(f => f.startsWith(root) && f.endsWith('.crux.json')));
    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: list });

    const stack: any[] = (router as any).stack || [];
    const hasGood = stack.some(l => l?.route?.path === '/good/user' || l?.route?.path === '/good');
    const hasBad = stack.some(l => l?.route?.path === '/bad');
    expect(hasGood).toBe(true);
    expect(hasBad).toBe(false);
  })
  
  test("cross_platform_path_handling__works_on_multiple_os", async () => {
    const { mockFs, cruxDir } = createVfs(vfsDir, 'cross/user', [
      { name: 'getCross', description: 'ok', req: { method: 'GET' } as any, res: { status: 200, bodyFile: null } as any }
    ] as any);

    const posixPath = `${cruxDir}/cross/user.crux.json`;
    const winPath = `${cruxDir}\\cross\\user.crux.json`;
    (mockFs as any)._files[winPath] = (mockFs as any)._files[posixPath];

    const list = (_root: string) => Promise.resolve([winPath]);
    const router = await buildRouterFromFS(cruxDir, { fileSystem: mockFs, listFiles: list });

    const stack: any[] = (router as any).stack || [];
    const routes = stack.filter(l => l?.route?.path === '/cross').map(l => l.route);
    const methods = new Set<string>();
    for (const r of routes) {
      for (const k of Object.keys(r.methods || {})) {
        if (r.methods[k]) methods.add(k);
      }
    }
    expect(methods.has('get')).toBe(true);
  })
  
})
