import { PayloadModel, HeaderModel, SuccessModel } from "../payload/payload.core";
import { ValidateResponseData, validateConfig } from "./validator.core";
import { LatticeConfig, ValidationSummaryModel } from "./validator.interfaces";
import * as utils from "../utils/utils";
describe("ValidateResponseData → valid minimal payload → ok:true", () => {
  test("arrange valid headers & response, act validate, assert ok", () => {
    const contentTypeHeader: HeaderModel = {
      headerName: "content-type",
      headerValue: "application/json"
    };
    const headers: Array<HeaderModel> = [contentTypeHeader];
    const successVariantOne: SuccessModel = {
      variant: "firstPayloadVariant",
      status: 200,
      data: [
        { id: 1, name: "John Doe" }
      ]
    };
    const responseData: PayloadModel = {
      headers,
      responses: [successVariantOne]
    };
    const actual: ValidationSummaryModel = ValidateResponseData(JSON.stringify(responseData));
    expect(actual).toStrictEqual({ ok: true, issues: [] });
  });
});

function baseConfig(): LatticeConfig {
  return {
    actions: [
      {
        name: "get-user",
        description: "Returns a user",
        req: { headers: {} },
        res: {
          status: 200,
          representations: [
            { name: "json", default: true, bodyFile: "user.json", contentType: "application/json" }
          ]
        }
      }
    ]
  };
}

function expectIssue(issues: Array<{code: string}>, code: string) {
  expect(issues.some(i => i.code === code)).toBe(true);
}

describe("validateConfig - core rules", () => {
  test("validateConfig → empty actions → ACTIONS_EMPTY", () => {
    const cfg: LatticeConfig = { actions: [] } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTIONS_EMPTY");
  });

  test("validateConfig → missing name → ACTION_NAME_MISSING", () => {
    const cfg: LatticeConfig = {
      actions: [ { description: "d", req: {}, res: { status: 200, representations: [{ name: "json", default: true, bodyFile: null, contentType: null }] } } as any ]
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_NAME_MISSING");
  });

  test("validateConfig → missing description → ACTION_DESC_MISSING", () => {
    const cfg: LatticeConfig = {
      actions: [ { name: "a", req: {}, res: { status: 200, representations: [{ name: "json", default: true, bodyFile: null, contentType: null }] } } as any ]
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_DESC_MISSING");
  });

  test("validateConfig → duplicate action names → ACTION_NAME_DUP", () => {
    const cfg: LatticeConfig = {
      actions: [
        { name: "dup", description: "one", req: {}, res: { status: 200, representations: [{ name: "a", default: true, bodyFile: null, contentType: null }] } },
        { name: "dup", description: "two", req: {}, res: { status: 200, representations: [{ name: "b", default: true, bodyFile: null, contentType: null }] } }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_NAME_DUP");
  });

  test("validateConfig → duplicate action descriptions → ACTION_DESC_DUP", () => {
    const cfg: LatticeConfig = {
      actions: [
        { name: "a", description: "same", req: {}, res: { status: 200, representations: [{ name: "a", default: true, bodyFile: null, contentType: null }] } },
        { name: "b", description: "same", req: {}, res: { status: 200, representations: [{ name: "b", default: true, bodyFile: null, contentType: null }] } }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_DESC_DUP");
  });

  test("validateConfig → missing req/res → REQ_MISSING & RES_MISSING", () => {
    const cfg: LatticeConfig = {
      actions: [ { name: "a", description: "d" } as any ]
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "REQ_MISSING");
    expectIssue(issues, "RES_MISSING");
  });

  test("validateConfig → missing/invalid status → STATUS_MISSING or STATUS_INVALID", () => {
    const missing: LatticeConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: {} as any } ]
    } as any;
    const missingIssues = validateConfig(missing);
    expectIssue(missingIssues, "STATUS_MISSING");

    const invalid: LatticeConfig = baseConfig();
    (invalid.actions[0].res as any).status = 9999;
    const invalidIssues = validateConfig(invalid);
    expectIssue(invalidIssues, "STATUS_INVALID");
  });

  test("validateConfig → no representations with 200 → REPS_EMPTY", () => {
    const cfg: LatticeConfig = {
      actions: [
        { name: "a", description: "d", req: {}, res: { status: 200 } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "REPS_EMPTY");
  });

  test("validateConfig → 204/1xx/304 with reps → STATUS_FORBIDS_BODY", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.status = 204;
    const issues = validateConfig(cfg);
    expectIssue(issues, "STATUS_FORBIDS_BODY");
  });

  test("validateConfig → missing rep keys → REP_NAME_MISSING & REP_BODYFILE_KEY_MISSING & REP_CONTENTTYPE_KEY_MISSING", () => {
    const cfg: LatticeConfig = {
      actions: [
        { name: "a", description: "d", req: {}, res: { status: 200, representations: [ {} as any ] } }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_NAME_MISSING");
    expectIssue(issues, "REP_BODYFILE_KEY_MISSING");
    expectIssue(issues, "REP_CONTENTTYPE_KEY_MISSING");
  });

  test("validateConfig → two default reps → REP_DEFAULT_COUNT", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.representations = [
      { name: "a", default: true, bodyFile: null, contentType: null },
      { name: "b", default: true, bodyFile: null, contentType: null }
    ];
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_DEFAULT_COUNT");
  });

  test("validateConfig → duplicate rep names → REP_NAME_DUP", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.representations = [
      { name: "dup", default: true, bodyFile: null, contentType: null },
      { name: "dup", default: false, bodyFile: null, contentType: null }
    ];
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_NAME_DUP");
  });

  test("validateConfig → rep contentType not in headers.schemas.oneOf → REP_CT_NOT_IN_SCHEMA", () => {
    const cfg = baseConfig();
    cfg.globals = {
      req: { headers: { schemas: { "content-type": { oneOf: ["application/xml"] } } } },
      res: { }
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_CT_NOT_IN_SCHEMA");
  });

  test("validateConfig → invalid media type format → REP_CONTENTTYPE_FORMAT", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.representations![0].contentType = "not-a-type";
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_CONTENTTYPE_FORMAT");
  });

  test("validateConfig → match.useResponse missing → MATCH_UNKNOWN_RESPONSE", () => {
    const cfg = baseConfig();
    cfg.actions[0].match = [ { useResponse: "missing" } as any ];
    const issues = validateConfig(cfg);
    expectIssue(issues, "MATCH_UNKNOWN_RESPONSE");
  });

  test("validateConfig → match forbidden header → MATCH_FORBIDDEN_HEADER", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = {
      headers: {
        required: [],
        optional: ["content-type"],
        forbidden: ["x-secret"]
      }
    };
    cfg.actions[0].match = [
      { when: { headers: { "X-Secret": "1" } }, useResponse: "json" }
    ];
    const issues = validateConfig(cfg);
    expectIssue(issues, "MATCH_FORBIDDEN_HEADER");
  });

  test("validateConfig → match header not declared → MATCH_HEADER_NOT_DECLARED", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = {
      headers: {
        required: ["authorization"],
        optional: ["content-type"],
        forbidden: []
      }
    };
    cfg.actions[0].match = [
      { when: { headers: { Accept: "application/json" } }, useResponse: "json" }
    ];
    const issues = validateConfig(cfg);
    expectIssue(issues, "MATCH_HEADER_NOT_DECLARED");
  });

  test("validateConfig → param not in route path → PARAM_NOT_IN_PATH", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = { params: { id: 1, stray: 2 } } as any;
    const issues = validateConfig(cfg, { actionDirs: ["/api/users/:id"] });
    expectIssue(issues, "PARAM_NOT_IN_PATH");
  });

  test("validateConfig → bodyFile missing with check enabled → BODYFILE_MISSING", () => {
    const spy = jest.spyOn(utils, "fileExistsSync").mockReturnValue(false);
    try {
      const cfg = baseConfig();
      const issues = validateConfig(cfg, { checkFilesExist: true, bodyFilesBaseDir: "/virtual" });
      expectIssue(issues, "BODYFILE_MISSING");
    } finally {
      spy.mockRestore();
    }
  });

  test("validateConfig → invalid header policy → POLICY_INVALID", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = { headers: { policy: "invalid" as any } };
    const issues = validateConfig(cfg);
    expectIssue(issues, "POLICY_INVALID");
  });
});
