import { PayloadModel, HeaderModel, SuccessModel } from "../payload/payload.core";
import { ValidateResponseData, validateConfig } from "./validator.core";
import { CruxConfig, ValidationSummaryModel } from "./validator.models";
import * as utils from "../utils/utils";

function baseConfig(): CruxConfig {
  return {
    actions: [
      {
        name: "get-user",
        description: "Returns a user",
        req: { headers: {} },
        res: {
          status: 200,
          bodyFile: "user.json"
        }
      }
    ]
  };
}

function expectIssue(issues: Array<{code: string}>, code: string) {
  expect(issues.some(i => i.code === code)).toBe(true);
}

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


describe("validateConfig - core rules", () => {
  test("validateConfig → empty actions → ACTIONS_EMPTY", () => {
    const cfg: CruxConfig = { actions: [] } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTIONS_EMPTY");
  });

  test("validateConfig → missing name → ACTION_NAME_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { description: "d", req: {}, res: { status: 200, bodyFile: null } as any } ] as any
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_NAME_MISSING");
  });

  test("validateConfig → missing description → ACTION_DESC_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", req: {}, res: { status: 200, bodyFile: null } as any } ] as any
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_DESC_MISSING");
  });

  test("validateConfig → duplicate action names → ACTION_NAME_DUP", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "dup", description: "one", req: {}, res: { status: 200, bodyFile: null } as any },
        { name: "dup", description: "two", req: {}, res: { status: 200, bodyFile: null } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_NAME_DUP");
  });

  test("validateConfig → duplicate action descriptions → ACTION_DESC_DUP", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "a", description: "same", req: {}, res: { status: 200, bodyFile: null } as any },
        { name: "b", description: "same", req: {}, res: { status: 200, bodyFile: null } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "ACTION_DESC_DUP");
  });

  test("validateConfig → missing req/res → REQ_MISSING & RES_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d" } as any ]
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, "REQ_MISSING");
    expectIssue(issues, "RES_MISSING");
  });

  test("validateConfig → missing/invalid status → STATUS_MISSING or STATUS_INVALID", () => {
    const missing: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: {} as any } ]
    } as any;
    const missingIssues = validateConfig(missing);
    expectIssue(missingIssues, "STATUS_MISSING");

    const invalid: CruxConfig = baseConfig();
    (invalid.actions[0].res as any).status = 9999;
    const invalidIssues = validateConfig(invalid);
    expectIssue(invalidIssues, "STATUS_INVALID");
  });
  test("validateConfig → status allows body but res.bodyFile missing → RES_BODYFILE_KEY_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "a", description: "d", req: {}, res: { status: 200 } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "RES_BODYFILE_KEY_MISSING");
  });

  test("validateConfig → 204 with bodyFile present → STATUS_FORBIDS_BODY", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.status = 204;
    cfg.actions[0].res!.bodyFile = "x.json";
    const issues = validateConfig(cfg);
    expectIssue(issues, "STATUS_FORBIDS_BODY");
  });

  test("validateConfig → bodyFile wrong type → RES_BODYFILE_TYPE", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: { status: 200, bodyFile: 123 } as any } ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "RES_BODYFILE_TYPE");
  });

  test("validateConfig → bodyFile empty string → RES_BODYFILE_EMPTY", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: { status: 200, bodyFile: "" } } ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "RES_BODYFILE_EMPTY");
  });

  test("validateConfig → req.headers.schema content-type not in globals oneOf → REP_CT_NOT_IN_SCHEMA (warn)", () => {
    const cfg = baseConfig();
    cfg.globals = {
      req: { headers: { schemas: { "content-type": { oneOf: ["application/json"] } } } },
      res: { status: 200 }
    } as any;
    cfg.actions[0].req = {
      headers: {
        schema: { "content-type": "application/xml" }
      }
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, "REP_CT_NOT_IN_SCHEMA");
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

  test("validateConfig → res.status fallback from globals.res.status → no STATUS_MISSING", () => {
    const cfg: CruxConfig = {
      globals: { res: { status: 201 } } as any,
      actions: [ { name: "a", description: "d", req: {}, res: {} as any } ]
    } as any;
    const issues = validateConfig(cfg);
    expect(issues.some(i => i.code === "STATUS_MISSING")).toBe(false);
  });
});
