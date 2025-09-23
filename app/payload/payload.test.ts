import { describe, test } from '@jest/globals'
import { composePayload, deepMerge } from './payload.core'
import { PayloadErrorCode, ResponseClass, PayloadConfigHeaders, PayloadDataHeaders } from './payload.enum'
import type { RequestContext, ComposeOptions, ComposeResult } from './payload.models'
import { HttpMethod, type ActionSpec } from '../validator'
import { createVfs, vfsDir } from '../test/helpers'



describe("composePayload", () => {
  test("combines_globals_and_route_configs__composed_correctly", async () => {
    const ctx: RequestContext = { path: 'complex/complex', method: 'post' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'complex/complex', [
      { name: 'test_1', description: 'example', req: { method: HttpMethod.POST }, res: {status:200} }
    ])
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.class).toBe(ResponseClass.SUCCESS);
  });

  test("get_method_200_no_body__composed_success", async () => {
    const ctx: RequestContext = { path: 'complex/complex', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'complex/complex', [
      { name: 'get_ok', description: 'get no body', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ])
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.body).toBeUndefined()
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })
  test("get_method_200_json_body_from_file__composed_success", async () => {
    const ctx: RequestContext = { path: 'complex/withbody', method: 'get' };
    const bodyJson = JSON.stringify({ id: 123, name: 'Jane' })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'complex/withbody',
      [
        { name: 'get_with_body', description: 'get json body', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: 'data.json' } as any }
      ],
      { res: { status: 200 } },
      { 'complex/data.json': bodyJson }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect((res.body as Buffer).toString()).toBe(bodyJson)
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })

  test("get_method_400_error_with_message_and_code__composed_client_error", async () => {
    const ctx: RequestContext = { path: 'errors/with400', method: 'get' };
    const bodyJson = JSON.stringify({ code: 'E_BAD', message: 'nope' })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'errors/with400',
      [
        { name: 'get_err', description: 'get client error', req: { method: HttpMethod.GET }, res: { status: 400, bodyFile: 'err.json' } as any }
      ],
      { res: { status: 200 } },
      { 'errors/err.json': bodyJson }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(400)
    expect(res.class).toBe(ResponseClass.CLIENT_ERROR)
    expect((res.body as Buffer).toString()).toBe(bodyJson)
  })

  test("get_method_500_error_with_message_and_code__composed_server_error", async () => {
    const ctx: RequestContext = { path: 'errors/with500', method: 'get' };
    const bodyJson = JSON.stringify({ code: 'E_OOPS', message: 'boom' })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'errors/with500',
      [
        { name: 'get_err_500', description: 'get server error', req: { method: HttpMethod.GET }, res: { status: 500, bodyFile: 'err500.json' } as any }
      ],
      { res: { status: 200 } },
      { 'errors/err500.json': bodyJson }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(500)
    expect(res.class).toBe(ResponseClass.SERVER_ERROR)
    expect((res.body as Buffer).toString()).toBe(bodyJson)
  })

  test("post_method_200_no_body__composed_success", async () => {
    const ctx: RequestContext = { path: 'posts/simple', method: 'post' };
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'posts/simple',
      [
        { name: 'post_ok', description: 'post no body', req: { method: HttpMethod.POST }, res: { status: 200 } }
      ]
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.body).toBeUndefined()
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })

  test("get_method_200_xml_body_from_file__composed_success", async () => {
    const ctx: RequestContext = { path: 'xml/withbody', method: 'get' };
    const bodyXml = '<user id="1">Jane</user>'
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'xml/withbody',
      [
        { name: 'get_with_xml', description: 'get xml body', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: 'data.xml' } as any }
      ],
      { res: { status: 200 } },
      { 'xml/data.xml': bodyXml }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect((res.body as Buffer).toString()).toBe(bodyXml)
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })

  test("post_method_400_error_with_message_and_code__composed_client_error", async () => {
    const ctx: RequestContext = { path: 'posts/error', method: 'post' };
    const bodyJson = JSON.stringify({ code: 'E_POST_BAD', message: 'bad post' })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'posts/error',
      [
        { name: 'post_err', description: 'post client error', req: { method: HttpMethod.POST }, res: { status: 400, bodyFile: 'err.json' } as any }
      ],
      { res: { status: 200 } },
      { 'posts/err.json': bodyJson }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(400)
    expect(res.class).toBe(ResponseClass.CLIENT_ERROR)
    expect((res.body as Buffer).toString()).toBe(bodyJson)
  })

  test("patch_method_200_json_body_from_file__composed_success", async () => {
    const ctx: RequestContext = { path: 'patches/withbody', method: 'patch' };
    const bodyJson = JSON.stringify({ updated: true })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'patches/withbody',
      [
        { name: 'patch_with_body', description: 'patch json body', req: { method: HttpMethod.PATCH }, res: { status: 200, bodyFile: 'data.json' } as any }
      ],
      { res: { status: 200 } },
      { 'patches/data.json': bodyJson }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect((res.body as Buffer).toString()).toBe(bodyJson)
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })

  test("deep_merge_prefers_route_arrays_replace__composed_correctly", () => {
    const base = { a: 1, list: [1,2], obj: { x: 1, y: 2 } }
    const over = { list: [9], obj: { y: 3, z: 4 } } as any
    const merged = deepMerge(base, over)
    expect(merged.list).toEqual([9])
    expect(merged.obj).toEqual({ x: 1, y: 3, z: 4 })
  })

  test("route_level_globals_override_globals_json_action_overrides_route__composed_correctly", async () => {
    const ctx1: RequestContext = { path: 'ovr/one', method: 'get' };
    const { mockFs: fs1, cruxDir: dir1 } = createVfs(
      vfsDir,
      'ovr/one',
      [ { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: {} } as any ],
      { res: { status: 200 } },
      {}
    )
    ;(fs1 as any).promises.readFile = async (p: string) => {
      if (p.endsWith('/ovr/one.crux.json')) return JSON.stringify({ globals: { res: { status: 201 } }, actions: [ { name:'a', description:'d', req: { method: 'get' }, res: {} } ] })
      return (fs1 as any).existsSync(p) ? (p in (fs1 as any)._files ? (fs1 as any)._files[p] : JSON.stringify({ res: { status: 200 } })) : ''
    }
    const r1 = await composePayload(ctx1, { cruxDir: dir1, fileSystem: fs1 } as any)
    expect(r1.status).toBe(201)

    const ctx2: RequestContext = { path: 'ovr/two', method: 'get' };
    const body = JSON.stringify({})
    const { mockFs: fs2, cruxDir: dir2 } = createVfs(
      vfsDir,
      'ovr/two',
      [ { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 202 } } as any ],
      { res: { status: 200 } },
      {}
    )
    const r2 = await composePayload(ctx2, { cruxDir: dir2, fileSystem: fs2 } as any)
    expect(r2.status).toBe(202)
  })

  test("unique_lower_precedence_keys_preserved__no_accidental_deletion", () => {
    const base = { keep: true, nested: { a: 1 } }
    const over = { nested: { a: 2 } }
    const merged = deepMerge(base, over)
    expect(merged.keep).toBe(true)
    expect(merged.nested).toEqual({ a: 2 })
  })

  test("method_name_matching_case_insensitive__works", async () => {
    const ctx: RequestContext = { path: 'case/route', method: 'GET' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'case/route', [
      { name: 'get_ok', description: 'upper', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ])
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.status).toBe(200)
  })

  test("absolute_bodyFile_path_forbidden__throws_error", async () => {
    const ctx: RequestContext = { path: 'abs/route', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'abs/route', [
      { name: 'abs', description: 'abs', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: '/etc/passwd' } as any }
    ])
    await expect(composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)).rejects.toThrow()
  })

  test("large_bodyfile_loads_without_truncation__composed_success", async () => {
    const ctx: RequestContext = { path: 'big/route', method: 'get' };
    const big = 'a'.repeat(5 * 1024 * 1024)
    const { mockFs, cruxDir } = createVfs(vfsDir, 'big/route', [
      { name: 'big', description: 'big', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: 'big.txt' } as any }
    ], { res: { status: 200 } }, { 'big/big.txt': big })
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect((res.body as Buffer).length).toBe(big.length)
  })

  test("throws_error_if_validation_fails__returns_validation_errors", async () => {
    const ctx: RequestContext = { path: 'invalid/route', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'invalid/route', [
      { name: 'bad', description: 'bad', req: { method: HttpMethod.GET }, res: {} as any }
    ], { res: {} })
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs, validate: true } as any)
    expect(res.ok).toBe(false)
    expect(res.errors && res.errors.length).toBeGreaterThan(0)
  })

  test("query_version_beta_matches_first_valid_action__selected_correctly", async () => {
    const ctx: RequestContext = { path: 'q/route', method: 'get', query: { version: 'beta' } };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'q/route', [
      { name: 'first', description: 'beta', req: { method: HttpMethod.GET, query: { version: 'beta' } as any }, res: { status: 201 } },
      { name: 'second', description: 'stable', req: { method: HttpMethod.GET, query: { version: 'stable' } as any }, res: { status: 202 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.status).toBe(201)
  })

  test("query_version_beta_and_id_1_no_match__throws_no_matching_action_error", async () => {
    const ctx: RequestContext = { path: 'q/nomatch', method: 'get', query: { version: 'beta' }, params: { id: 1 } };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'q/nomatch', [
      { name: 'first', description: 'beta', req: { method: HttpMethod.GET, query: { version: 'beta' } as any, params: { id: 2 } as any }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(false)
    expect(res.errors && res.errors[0].code).toBeDefined()
  })

  test("missing_status_defaults_to_200__composed_success", async () => {
    const ctx: RequestContext = { path: 'default/status', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'default/status', [
      { name: 'd', description: 'd', req: { method: HttpMethod.GET }, res: {} as any }
    ], { res: {} })
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.status).toBe(200)
  })

  test("same_inputs_produce_identical_output__deterministic", async () => {
    const ctx: RequestContext = { path: 'det/route', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'det/route', [
      { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: 'd.json' } as any }
    ], { res: { status: 200 } }, { 'det/d.json': JSON.stringify({ k: 1 }) })
    const r1 = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    const r2 = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(r1.status).toBe(r2.status)
    expect((r1.body as Buffer).toString()).toBe((r2.body as Buffer).toString())
  })

  test("charset_defaults_utf8_for_text_binary_skips_charset__headers_correct", async () => {
    const ctx1: RequestContext = { path: 'ctype/json', method: 'get' };
    let v = createVfs(vfsDir, 'ctype/json', [ { name:'a', description:'d', req:{ method: HttpMethod.GET }, res:{ status:200, bodyFile: 'a.json' } as any } ] as any, { res:{ status:200 } }, { 'ctype/a.json': '{}' })
    let r = await composePayload(ctx1, { cruxDir: v.cruxDir, fileSystem: v.mockFs } as any)
    expect(r.headers['content-type']).toBe('application/json; charset=utf-8')

    const ctx2: RequestContext = { path: 'ctype/bin', method: 'get' };
    v = createVfs(vfsDir, 'ctype/bin', [ { name:'a', description:'d', req:{ method: HttpMethod.GET }, res:{ status:200, bodyFile: 'a.bin' } as any } ] as any, { res:{ status:200 } }, { 'ctype/a.bin': 'xx' })
    r = await composePayload(ctx2, { cruxDir: v.cruxDir, fileSystem: v.mockFs } as any)
    expect(r.headers['content-type']).toBe('application/octet-stream')
  })

  test("authorization_used_for_selection_not_echoed_unless_configured__headers_correct", async () => {
    const ctx: RequestContext = { path: 'auth/route', method: 'get', headers: { Authorization: 'Bearer X' } };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'auth/route', [
      { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(Object.keys(res.headers)).not.toContain('authorization')
  })

  test("no_internal_paths_or_stack_in_normal_response__structured_error_only", async () => {
    const ctx: RequestContext = { path: 'clean/route', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'clean/route', [
      { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    const headersJoined = Object.values(res.headers).join(' ')
    expect(headersJoined).not.toMatch(/\/\w+/)
    expect(res.allow).toBeUndefined()
  })

  test("route_exists_method_missing__returns_405_with_allow_header", async () => {
    const ctx: RequestContext = { path: 'methods/onlyget', method: 'post' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'methods/onlyget', [
      { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(405)
    expect(Array.isArray(res.allow)).toBe(true)
    expect(res.allow && res.allow.includes('GET')).toBe(true)
  })

    test("route_exists_method_missing__returns_405_with_allow_header", async () => {
    const ctx: RequestContext = { path: 'methods/onlyget', method: 'post' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'methods/onlyget', [
      { name: 'a', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(405)
    expect(Array.isArray(res.allow)).toBe(true)
    expect(res.allow && res.allow.includes('GET')).toBe(true)
  })

  test("globals_json_missing__ignored_and_route_still_composes", async () => {
    const ctx: RequestContext = { path: 'noglobals/route', method: 'get' };

    const { mockFs, cruxDir } = createVfs(vfsDir, 'noglobals/route', [
      { name: 'ok', description: 'no globals present', req: { method: HttpMethod.GET }, res: { status: 204 } }
    ], { res: { status: 200 } })

    const globalsPath = `${cruxDir}/globals.json`
    const originalExists = mockFs.existsSync.bind(mockFs)
    mockFs.existsSync = (p: string) => p === globalsPath ? false : originalExists(p)

    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(204)
    expect(res.body).toBeUndefined()
    expect(res.class).toBe(ResponseClass.SUCCESS)
  })

  test("allow_header_lists_unique_uppercase_methods__no_duplicates", async () => {
    const ctx: RequestContext = { path: 'methods/multi', method: 'patch' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'methods/multi', [
      { name: 'g1', description: 'd', req: { method: 'get' as any }, res: { status: 200 } },
      { name: 'g2', description: 'd', req: { method: 'GET' as any }, res: { status: 200 } },
      { name: 'p1', description: 'd', req: { method: 'post' as any }, res: { status: 201 } }
    ] as any)

    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(405)
    const sorted = [...(res.allow ?? [])].sort()
    expect(sorted).toEqual(['GET', 'POST'])
  })
})
