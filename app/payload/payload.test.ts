import { describe, test, expect, jest } from '@jest/globals'
import { composePayload, composePreflight, deepMerge, loadDefaultsChain, loadCruxRoutes } from './payload.core'
import { ResponseClass, PayloadErrorCode } from './payload.enum'
import type { RequestContext } from './payload.models'
import { HttpMethod } from '../validator'
import { createVfs, vfsDir } from '../test/helpers'

describe("composePayload", () => {
  test("combines_defaults_and_route_configs__composed_correctly", async () => {
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

  test("route_level_globals_override_defaults_json_action_overrides_route__composed_correctly", async () => {
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

  test("bodyfile_outside_crux_forbidden__throws_error", async () => {
    const ctx: RequestContext = { path: 'escape/route', method: 'get' };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'escape/route', [
      { name: 'escape', description: 'escape', req: { method: HttpMethod.GET }, res: { status: 200, bodyFile: '../secret.txt' } as any }
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

  test("header_content_type_distinguishes_actions__selects_matching_header", async () => {
    const ctx: RequestContext = { path: 'headers/route', method: 'get', headers: { 'Content-Type': 'application/json' } };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'headers/route', [
      { name: 'json', description: 'returns json', req: { method: HttpMethod.GET, headers: { 'content-type': 'application/json' } as any }, res: { status: 200 } },
      { name: 'xml', description: 'returns xml', req: { method: HttpMethod.GET, headers: { 'content-type': 'application/xml' } as any }, res: { status: 201 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })

  test("merged_response_headers_forward_to_payload__cors_headers_preserved", async () => {
    const ctx: RequestContext = { path: 'headers/cors', method: 'post' };
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'headers/cors',
      [
        {
          name: 'cors',
          description: 'cors action',
          req: { method: HttpMethod.POST },
          res: { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } } as any
        }
      ] as any,
      { res: { status: 200, headers: { 'Access-Control-Allow-Headers': 'content-type' } } }
    )
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.headers['access-control-allow-origin']).toBe('*')
    expect(res.headers['access-control-allow-headers']).toBe('content-type')
  })

  test("header_constraint_not_met__returns_no_matching_action", async () => {
    const ctx: RequestContext = { path: 'headers/mismatch', method: 'get', headers: { 'content-type': 'application/xml' } };
    const { mockFs, cruxDir } = createVfs(vfsDir, 'headers/mismatch', [
      { name: 'json', description: 'json only', req: { method: HttpMethod.GET, headers: { 'content-type': 'application/json' } as any }, res: { status: 200 } }
    ] as any)
    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.errors && res.errors[0]?.code).toBe(PayloadErrorCode.NO_MATCHING_ACTION)
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

  test("defaults_json_missing__ignored_and_route_still_composes", async () => {
    const ctx: RequestContext = { path: 'nodefaults/route', method: 'get' };

    const { mockFs, cruxDir } = createVfs(vfsDir, 'nodefaults/route', [
      { name: 'ok', description: 'no defaults present', req: { method: HttpMethod.GET }, res: { status: 204 } }
    ], { res: { status: 200 } })

    const defaultsPath = `${cruxDir}/defaults.json`
    const originalExists = mockFs.existsSync.bind(mockFs)
    mockFs.existsSync = (p: string) => p === defaultsPath ? false : originalExists(p)

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

  test("method_inherited_from_defaults__request_matches", async () => {
    const ctx: RequestContext = { path: 'inherit/method', method: 'get' };
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'inherit/method',
      [
        { name: 'inherited', description: 'uses global method', req: {} as any, res: { status: 204 } as any }
      ] as any,
      { req: { method: HttpMethod.GET } }
    )

    const res = await composePayload(ctx, { cruxDir, fileSystem: mockFs } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(204)
  })

  test("preflight_returns_204_with_defaults_cors_headers__allow_lists_action_methods_and_options", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'cors/route',
      [
        { name: 'get', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any,
        { name: 'post', description: 'd', req: { method: HttpMethod.POST }, res: { status: 201 } } as any
      ],
      {
        res: {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'content-type, accept'
          }
        }
      }
    )
    const res = await composePreflight({
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/cors/route.crux.json`
    } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('*')
    expect(res.headers['access-control-allow-headers']).toBe('content-type, accept')
    expect(res.body).toBeUndefined()
    const allow = [...(res.allow ?? [])].sort()
    expect(allow).toEqual(['GET', 'OPTIONS', 'POST'])
  })

  test("preflight_with_no_defaults_cors_headers__returns_empty_headers_and_204", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'bare/route',
      [ { name: 'g', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ]
    )
    const res = await composePreflight({
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/bare/route.crux.json`
    } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(204)
    expect(Object.keys(res.headers)).toHaveLength(0)
  })

  test("dynamic_route_with_route_file__returns_expected_body", async () => {
    const body = JSON.stringify([
      { name: 'Count Ollaf', type: 'Character', famous_quote: "WRONG! It's a list." }
    ])
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'users/[id]/payload',
      [
        {
          name: 'user_id_test',
          description: 'example dynamic route',
          req: { method: HttpMethod.GET, params: { id: '1' } as any, query: { date_created: '00010101' } as any } as any,
          res: { status: 200, bodyFile: 'test_4.json' } as any
        }
      ] as any,
      { res: { status: 200 } },
      { 'users/[id]/test_4.json': body }
    )

    const ctx: RequestContext = {
      path: 'users/1',
      method: 'get',
      params: { id: '1' },
      query: { date_created: '00010101' }
    }

    const res = await composePayload(ctx, {
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/users/[id]/payload.crux.json`
    } as any)

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect((res.body as Buffer).toString()).toBe(body)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
  })
})

describe("loadDefaultsChain", () => {
  test("two_level_cascade_child_overrides_parent__merged_correctly", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ],
      { res: { status: 200, headers: { x: '1', y: '2' } } },
      { 'a/defaults.json': JSON.stringify({ res: { headers: { y: '3', z: '4' } } }) }
    )
    const merged = await loadDefaultsChain(mockFs, cruxDir, `${cruxDir}/a`)
    expect(merged.res.status).toBe(200)
    expect(merged.res.headers).toEqual({ x: '1', y: '3', z: '4' })
  })

  test("three_level_cascade_with_gap__middle_folder_skipped_ancestors_applied", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/b/c/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ],
      { res: { status: 200, headers: { x: '1' } } },
      { 'a/b/c/defaults.json': JSON.stringify({ res: { headers: { z: '9' } } }) }
    )
    const merged = await loadDefaultsChain(mockFs, cruxDir, `${cruxDir}/a/b/c`)
    expect(merged.res.status).toBe(200)
    expect(merged.res.headers).toEqual({ x: '1', z: '9' })
  })

  test("child_null_erases_inherited_value__field_removed", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ],
      { res: { status: 200, headers: { x: '1' } } },
      { 'a/defaults.json': JSON.stringify({ res: { headers: null } }) }
    )
    const merged = await loadDefaultsChain(mockFs, cruxDir, `${cruxDir}/a`)
    expect(merged.res.headers).toBeNull()
  })

  test("target_equal_to_crux_root__returns_root_defaults_only", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'solo/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ],
      { res: { status: 200, headers: { x: '1' } } }
    )
    const merged = await loadDefaultsChain(mockFs, cruxDir, cruxDir)
    expect(merged.res.headers).toEqual({ x: '1' })
  })

  test("target_outside_crux_dir__throws_error", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ]
    )
    await expect(loadDefaultsChain(mockFs, cruxDir, '/vfs/outside')).rejects.toThrow()
  })

  test("no_defaults_files_anywhere__returns_null", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/b/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ]
    )
    const originalExists = mockFs.existsSync.bind(mockFs)
    mockFs.existsSync = (p: string) => p.endsWith('defaults.json') ? false : originalExists(p)
    const merged = await loadDefaultsChain(mockFs, cruxDir, `${cruxDir}/a/b`)
    expect(merged).toBeNull()
  })
})

describe("composePayload with cascading defaults", () => {
  test("intermediate_folder_defaults_cascade_to_route__granular_override_applied", async () => {
    const ctx: RequestContext = { path: 'a/b/route', method: 'get' }
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/b/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: {} } as any ],
      { res: { status: 200, headers: { x: '1', y: '2' } } },
      { 'a/defaults.json': JSON.stringify({ res: { headers: { y: '3' } } }) }
    )
    const res = await composePayload(ctx, {
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/a/b/route.crux.json`
    } as any)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.headers['x']).toBe('1')
    expect(res.headers['y']).toBe('3')
  })

  test("route_globals_block_overrides_folder_defaults__route_wins", async () => {
    const ctx: RequestContext = { path: 'a/route', method: 'get' }
    const routeJson = JSON.stringify({
      globals: { res: { status: 202 } },
      actions: [ { name: 'r', description: 'd', req: { method: 'get' }, res: {} } ]
    })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: {} } as any ],
      { res: { status: 200 } },
      {
        'a/defaults.json': JSON.stringify({ res: { status: 201 } }),
        'a/route.crux.json': routeJson
      }
    )
    const res = await composePayload(ctx, {
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/a/route.crux.json`
    } as any)
    expect(res.status).toBe(202)
  })

  test("action_res_status_overrides_folder_defaults_and_route_globals__action_wins", async () => {
    const ctx: RequestContext = { path: 'a/route', method: 'get' }
    const routeJson = JSON.stringify({
      globals: { res: { status: 202 } },
      actions: [ { name: 'r', description: 'd', req: { method: 'get' }, res: { status: 203 } } ]
    })
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 203 } } as any ],
      { res: { status: 200 } },
      {
        'a/defaults.json': JSON.stringify({ res: { status: 201 } }),
        'a/route.crux.json': routeJson
      }
    )
    const res = await composePayload(ctx, {
      cruxDir,
      fileSystem: mockFs,
      routeFile: `${cruxDir}/a/route.crux.json`
    } as any)
    expect(res.status).toBe(203)
  })
})

describe("loadCruxRoutes legacy detection", () => {
  test("legacy_globals_json_present__logs_deprecation_warning", async () => {
    const { mockFs, cruxDir } = createVfs(
      vfsDir,
      'a/route',
      [ { name: 'r', description: 'd', req: { method: HttpMethod.GET }, res: { status: 200 } } as any ],
      { res: { status: 200 } },
      { 'a/globals.json': JSON.stringify({ res: { headers: { legacy: 'yes' } } }) }
    )
    const legacyPath = `${cruxDir}/a/globals.json`
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await loadCruxRoutes(cruxDir, {
        fileSystem: mockFs,
        listFiles: async (root) => Object.keys((mockFs as any)._files).filter((f: string) => f.startsWith(root) && f.endsWith('.crux.json')),
        listLegacyFiles: async () => [legacyPath]
      })
      const warned = logSpy.mock.calls.some((call: any[]) => String(call[0] ?? '').includes("legacy 'globals.json'") && String(call[0]).includes(legacyPath))
      expect(warned).toBe(true)
    } finally {
      logSpy.mockRestore()
    }
  })
})
