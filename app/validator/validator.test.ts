import { PayloadModel, HeaderModel, SuccessModel } from "../payload/payload.models";
import { ValidateResponseData, validateConfig } from "./validator.core";
import { CruxConfig, ValidationSummaryModel } from "./validator.models";
import { ValidationCode } from "./validator.enum";
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

function expectIssue(issues: Array<{code: string}>, code: ValidationCode) {
  expect(issues.some(i => i.code === code)).toBe(true);
}

describe("ValidateResponseData", () => {
  test("valid_minimal_payload__ok_true", () => {
    const contentTypeHeader: HeaderModel = {
      headerName: "content-type",
      headerValue: "application/json"
    };
    const headers: Array<HeaderModel> = [contentTypeHeader];
    const successVariantOne: SuccessModel = {
      action: "firstPayloadVariant",
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


describe("validateConfig", () => {
  test("empty_actions__ACTIONS_EMPTY", () => {
    const cfg: CruxConfig = { actions: [] } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.ACTIONS_EMPTY);
  });

  test("missing_name__ACTION_NAME_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { description: "d", req: {}, res: { status: 200, bodyFile: null } as any } ] as any
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.ACTION_NAME_MISSING);
  });

  test("missing_description__ACTION_DESC_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", req: {}, res: { status: 200, bodyFile: null } as any } ] as any
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.ACTION_DESC_MISSING);
  });

  test("duplicate_action_names__ACTION_NAME_DUP", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "dup", description: "one", req: {}, res: { status: 200, bodyFile: null } as any },
        { name: "dup", description: "two", req: {}, res: { status: 200, bodyFile: null } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.ACTION_NAME_DUP);
  });

  test("duplicate_action_descriptions__ACTION_DESC_DUP", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "a", description: "same", req: {}, res: { status: 200, bodyFile: null } as any },
        { name: "b", description: "same", req: {}, res: { status: 200, bodyFile: null } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.ACTION_DESC_DUP);
  });

  test("missing_req_res__REQ_MISSING_and_RES_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d" } as any ]
    };
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.REQ_MISSING);
    expectIssue(issues, ValidationCode.RES_MISSING);
  });

  test("missing_or_invalid_status__STATUS_MISSING_or_STATUS_INVALID", () => {
    const missing: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: {} as any } ]
    } as any;
    const missingIssues = validateConfig(missing);
    expectIssue(missingIssues, ValidationCode.STATUS_MISSING);

    const invalid: CruxConfig = baseConfig();
    (invalid.actions[0].res as any).status = 9999;
    const invalidIssues = validateConfig(invalid);
    expectIssue(invalidIssues, ValidationCode.STATUS_INVALID);
  });
  test("status_allows_body_but_bodyFile_missing__RES_BODYFILE_KEY_MISSING", () => {
    const cfg: CruxConfig = {
      actions: [
        { name: "a", description: "d", req: {}, res: { status: 200 } as any }
      ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.RES_BODYFILE_KEY_MISSING);
  });

  test("status_204_with_bodyFile__STATUS_FORBIDS_BODY", () => {
    const cfg = baseConfig();
    cfg.actions[0].res!.status = 204;
    cfg.actions[0].res!.bodyFile = "x.json";
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.STATUS_FORBIDS_BODY);
  });

  test("bodyFile_wrong_type__RES_BODYFILE_TYPE", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: { status: 200, bodyFile: 123 } as any } ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.RES_BODYFILE_TYPE);
  });

  test("bodyFile_empty_string__RES_BODYFILE_EMPTY", () => {
    const cfg: CruxConfig = {
      actions: [ { name: "a", description: "d", req: {}, res: { status: 200, bodyFile: "" } } ]
    } as any;
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.RES_BODYFILE_EMPTY);
  });

  test("param_not_in_route_path__PARAM_NOT_IN_PATH", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = { params: { id: 1, stray: 2 } } as any;
    const issues = validateConfig(cfg, { actionDirs: ["/api/users/:id"] });
    expectIssue(issues, ValidationCode.PARAM_NOT_IN_PATH);
  });

  test("bodyFile_missing_with_check_enabled__BODYFILE_MISSING", () => {
    const spy = jest.spyOn(utils, "fileExistsSync").mockReturnValue(false);
    try {
      const cfg = baseConfig();
      const issues = validateConfig(cfg, { checkFilesExist: true, bodyFilesBaseDir: "/virtual" });
      expectIssue(issues, ValidationCode.BODYFILE_MISSING);
    } finally {
      spy.mockRestore();
    }
  });

  test("invalid_header_policy__POLICY_INVALID", () => {
    const cfg = baseConfig();
    cfg.actions[0].req = { headers: { policy: "invalid" as any } };
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.POLICY_INVALID);
  });

  test("status_fallback_from_globals__no_STATUS_MISSING", () => {
    const cfg: CruxConfig = {
      globals: { res: { status: 201 } } as any,
      actions: [ { name: "a", description: "d", req: {}, res: {} as any } ]
    } as any;
    const issues = validateConfig(cfg);
    expect(issues.some(i => i.code === ValidationCode.STATUS_MISSING)).toBe(false);
  });

  test("missing_req_method__METHOD_MISSING", () => {
    const cfg = baseConfig();
    const issues = validateConfig(cfg);
    expectIssue(issues, ValidationCode.METHOD_MISSING);
  });
});
