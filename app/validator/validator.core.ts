import { ValidationIssue, LatticeConfig, ValidationSummaryModel, ValidationIssueModel } from "./validator.interfaces";
import { ValidationSeverity, PolicyMode } from "./validator.enum";
import { isEmptyString, statusForbidsBody, isValidMediaType, toLowerKeys, isValidHttpStatus, extractPathParamsFromDir } from "../utils/utils";
import { fileExistsSync } from "../utils/utils";
import * as fs from "fs";

export function validateNonEmptyActions(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!cfg.actions || !Array.isArray(cfg.actions) || cfg.actions.length === 0) {
    issues.push({ severity: ValidationSeverity.ERROR, code: "ACTIONS_EMPTY", message: "actions[] must be a non-empty array.", path: "actions" });
  }
  return issues;
}

export function validateUniqueActionNames(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  cfg.actions?.forEach((a, i) => {
    const k = (a.name ?? "").trim();
    if (!k) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "ACTION_NAME_MISSING", message: "Action name is required.", path: `actions[${i}].name` });
      return;
    }
    if (seen.has(k)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "ACTION_NAME_DUP", message: `Duplicate action name '${k}'.`, path: `actions[${i}].name` });
    }
    seen.add(k);
  });
  return issues;
}

export function validateUniqueActionDescriptions(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  cfg.actions?.forEach((a, i) => {
    const d = (a.description ?? "").trim();
    if (!d) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "ACTION_DESC_MISSING", message: "Action description is required.", path: `actions[${i}].description` });
      return;
    }
    if (seen.has(d)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "ACTION_DESC_DUP", message: `Duplicate description '${d}'.`, path: `actions[${i}].description` });
    }
    seen.add(d);
  });
  return issues;
}

export function validateReqResPresence(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    if (!a.req) issues.push({ severity: ValidationSeverity.ERROR, code: "REQ_MISSING", message: "req is required.", path: `actions[${i}].req` });
    if (!a.res) issues.push({ severity: ValidationSeverity.ERROR, code: "RES_MISSING", message: "res is required.", path: `actions[${i}].res` });
  });
  return issues;
}

export function validateStatusPresenceAndValidity(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const status = a.res?.status;
    if (status === undefined) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "STATUS_MISSING", message: "res.status is required.", path: `actions[${i}].res.status` });
      return;
    }
    if (!isValidHttpStatus(status)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "STATUS_INVALID", message: `Invalid HTTP status '${status}'.`, path: `actions[${i}].res.status` });
    }
  });
  return issues;
}

export function validateRepresentationsBasic(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const reps = a.res?.representations;
    const status = a.res?.status;

    if (statusForbidsBody(status)) {
      if (reps && reps.length > 0) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "STATUS_FORBIDS_BODY", message: `Status ${status} forbids body; no representations allowed.`, path: `actions[${i}].res.representations` });
      }
      return;
    }

    if (!reps || reps.length === 0) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "REPS_EMPTY", message: "At least one representation is required.", path: `actions[${i}].res.representations` });
      return;
    }

    let defaultCount = 0;
    const names = new Set<string>();

    reps.forEach((r, j) => {
      if (!r.name || isEmptyString(r.name)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "REP_NAME_MISSING", message: "representation.name is required and non-empty.", path: `actions[${i}].res.representations[${j}].name` });
      } else if (names.has(r.name)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "REP_NAME_DUP", message: `Duplicate representation name '${r.name}'.`, path: `actions[${i}].res.representations[${j}].name` });
      } else {
        names.add(r.name);
      }

      if (r.default) defaultCount += 1;

      if (!("bodyFile" in r)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "REP_BODYFILE_KEY_MISSING", message: "representation.bodyFile key must exist (can be null).", path: `actions[${i}].res.representations[${j}]` });
      } else if (r.bodyFile !== null && typeof r.bodyFile !== "string") {
        issues.push({ severity: ValidationSeverity.ERROR, code: "REP_BODYFILE_TYPE", message: "representation.bodyFile must be string or null.", path: `actions[${i}].res.representations[${j}].bodyFile` });
      }

      if (!("contentType" in r)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "REP_CONTENTTYPE_KEY_MISSING", message: "representation.contentType key must exist (can be null).", path: `actions[${i}].res.representations[${j}]` });
      } else if (r.contentType !== null && typeof r.contentType === "string" && !isValidMediaType(r.contentType)) {
        issues.push({ severity: ValidationSeverity.WARNING, code: "REP_CONTENTTYPE_FORMAT", message: `contentType '${r.contentType}' does not look like type/subtype.`, path: `actions[${i}].res.representations[${j}].contentType` });
      }
    });

    if (defaultCount !== 1) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "REP_DEFAULT_COUNT", message: `Exactly one representation must be default; found ${defaultCount}.`, path: `actions[${i}].res.representations` });
    }
  });
  return issues;
}

export function validateRepresentationVsHeaderSchemas(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const schemasGlobal = toLowerKeys(cfg.globals?.req?.headers?.schemas) as Record<string, any> | null;
    const schemasLocal = toLowerKeys(a.req?.headers?.schemas) as Record<string, any> | null;
    const schemas = { ...(schemasGlobal || {}), ...(schemasLocal || {}) };

    const reps = a.res?.representations || [];
    for (let j = 0; j < reps.length; j++) {
      const ct = reps[j].contentType;
      if (typeof ct === "string" && schemas["content-type"] && Array.isArray(schemas["content-type"].oneOf)) {
        const allowed = schemas["content-type"].oneOf as string[];
        if (allowed.length > 0 && !allowed.includes(ct)) {
          issues.push({ severity: ValidationSeverity.WARNING, code: "REP_CT_NOT_IN_SCHEMA", message: `Representation contentType '${ct}' not listed in headers.schemas['content-type'].oneOf.`, path: `actions[${i}].res.representations[${j}].contentType` });
        }
      }
    }
  });
  return issues;
}

export function validateHeaderPolicyEnums(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const p = a.req?.headers?.policy ?? cfg.globals?.req?.headers?.policy;
    if (p && p !== PolicyMode.PERMISSIVE && p !== PolicyMode.WARN && p !== PolicyMode.STRICT) {
      issues.push({ severity: ValidationSeverity.ERROR, code: "POLICY_INVALID", message: `Invalid header policy '${p}'.`, path: `actions[${i}].req.headers.policy` });
    }
  });
  return issues;
}

export function validateMatches(cfg: LatticeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    if (!a.match || a.match.length === 0) return;

    const repNames = new Set<string>((a.res?.representations || []).map(r => r.name || ""));

    const policy = a.req?.headers;
    const required = new Set<string>((policy?.required || []).map(s => s.toLowerCase()));
    const optional = new Set<string>((policy?.optional || []).map(s => s.toLowerCase()));
    const forbidden = new Set<string>((policy?.forbidden || []).map(s => s.toLowerCase()));

    for (let m = 0; m < a.match.length; m++) {
      const mm = a.match[m];

      if (mm.useResponse && !repNames.has(mm.useResponse)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "MATCH_UNKNOWN_RESPONSE", message: `match.useResponse '${mm.useResponse}' does not match any representation name.`, path: `actions[${i}].match[${m}].useResponse` });
      }
      if (mm.when?.headers) {
        const keys = Object.keys(mm.when.headers);
        for (const k of keys) {
          const kl = k.toLowerCase();
          if (forbidden.has(kl)) {
            issues.push({ severity: ValidationSeverity.ERROR, code: "MATCH_FORBIDDEN_HEADER", message: `match.when.headers uses forbidden header '${k}'.`, path: `actions[${i}].match[${m}].when.headers['${k}']` });
          }
          if ((required.size > 0 || optional.size > 0) && !required.has(kl) && !optional.has(kl)) {
            issues.push({ severity: ValidationSeverity.WARNING, code: "MATCH_HEADER_NOT_DECLARED", message: `Header '${k}' used in match is not declared in required/optional.`, path: `actions[${i}].match[${m}].when.headers['${k}']` });
          }
        }
      }
    }
  });
  return issues;
}

export interface FsOptions {
  checkFilesExist?: boolean;
  baseDir?: string;
}

export function validateBodyFilesExist(cfg: LatticeConfig, opts: FsOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!opts.checkFilesExist) return issues;

  const base = opts.baseDir ?? process.cwd();
  cfg.actions?.forEach((a, i) => {
    const reps = a.res?.representations || [];
    for (let j = 0; j < reps.length; j++) {
      const bf = reps[j].bodyFile;
      if (typeof bf === "string") {
        const full = require("path").resolve(base, bf);
        if (!fileExistsSync(fs, full)) {
          issues.push({ severity: ValidationSeverity.ERROR, code: "BODYFILE_MISSING", message: `bodyFile not found: ${bf}`, path: `actions[${i}].res.representations[${j}].bodyFile` });
        }
      }
    }
  });
  return issues;
}


export function validateParamsSubsetOfPath(cfg: LatticeConfig, actionDirs: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const params = a.req?.params || {};
    const inFs = new Set<string>(extractPathParamsFromDir(actionDirs[i]).map(s => s.toLowerCase()));
    for (const k of Object.keys(params)) {
      if (!inFs.has(k.toLowerCase())) {
        issues.push({ severity: ValidationSeverity.ERROR, code: "PARAM_NOT_IN_PATH", message: `Param '${k}' not present in route path derived from filesystem.`, path: `actions[${i}].req.params['${k}']` });
      }
    }
  });
  return issues;
}

export interface RunOptions {
  checkFilesExist?: boolean;
  bodyFilesBaseDir?: string;
  actionDirs?: string[];
}

export function validateConfig(cfg: LatticeConfig, opts: RunOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...validateNonEmptyActions(cfg));
  issues.push(...validateUniqueActionNames(cfg));
  issues.push(...validateUniqueActionDescriptions(cfg));
  issues.push(...validateReqResPresence(cfg));
  issues.push(...validateStatusPresenceAndValidity(cfg));
  issues.push(...validateRepresentationsBasic(cfg));
  issues.push(...validateRepresentationVsHeaderSchemas(cfg));
  issues.push(...validateHeaderPolicyEnums(cfg));
  if (opts.actionDirs) issues.push(...validateParamsSubsetOfPath(cfg, opts.actionDirs));
  issues.push(...validateMatches(cfg));
  issues.push(...validateBodyFilesExist(cfg, { checkFilesExist: !!opts.checkFilesExist, baseDir: opts.bodyFilesBaseDir }));
  return issues;
}

export function ValidateResponseData(payloadJson: string): ValidationSummaryModel {
  const issues: ValidationIssueModel[] = [];

  let payload: any;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e: any) {
    issues.push({ code: "PARSE_ERROR", message: `Invalid JSON: ${e?.message || "unknown"}` });
    return { ok: false, issues };
  }

  if (!Array.isArray(payload?.headers)) {
    issues.push({ code: "HEADERS_INVALID", message: "headers must be an array", path: "headers" });
  } else {
    payload.headers.forEach((h: any, idx: number) => {
      if (!h || typeof h !== "object") {
        issues.push({ code: "HEADER_NOT_OBJECT", message: "header entry must be an object", path: `headers[${idx}]` });
        return;
      }
      if (typeof h.headerName !== "string" || h.headerName.trim() === "") {
        issues.push({ code: "HEADER_NAME_INVALID", message: "headerName must be a non-empty string", path: `headers[${idx}].headerName` });
      }
      if (typeof h.headerValue !== "string") {
        issues.push({ code: "HEADER_VALUE_INVALID", message: "headerValue must be a string", path: `headers[${idx}].headerValue` });
      }
    });
  }

  if (!Array.isArray(payload?.responses) || payload.responses.length === 0) {
    issues.push({ code: "RESPONSES_EMPTY", message: "responses must be a non-empty array", path: "responses" });
  } else {
    payload.responses.forEach((r: any, idx: number) => {
      if (!r || typeof r !== "object") {
        issues.push({ code: "RESPONSE_NOT_OBJECT", message: "response entry must be an object", path: `responses[${idx}]` });
        return;
      }
      if (typeof r.status !== "number") {
        issues.push({ code: "STATUS_MISSING", message: "response.status must be a number", path: `responses[${idx}].status` });
      } else if (!isValidHttpStatus(r.status)) {
        issues.push({ code: "STATUS_INVALID", message: `Invalid HTTP status '${r.status}'`, path: `responses[${idx}].status` });
      }
    });
  }

  return { ok: issues.length === 0, issues };
}
