import { ValidationIssue, CruxConfig, ValidationSummaryModel, FsOptions, RunOptions } from "./validator.models";
import { ValidationSeverity, PolicyMode, ValidationCode, HttpMethod } from "./validator.enum";
import { statusForbidsBody, isValidHttpStatus, extractPathParamsFromDir } from "../utils/utils.core";
import { fileExistsSync } from "../utils/utils.core";
import * as fs from "fs";

export function validateNonEmptyActions(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!cfg.actions || !Array.isArray(cfg.actions) || cfg.actions.length === 0) {
    issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.ACTIONS_EMPTY, message: "actions[] must be a non-empty array.", path: "actions" });
  }
  return issues;
}

export function validateUniqueActionNames(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  cfg.actions?.forEach((a, i) => {
    const k = (a.name ?? "").trim();
    if (!k) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.ACTION_NAME_MISSING, message: "Action name is required.", path: `actions[${i}].name` });
      return;
    }
    if (seen.has(k)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.ACTION_NAME_DUP, message: `Duplicate action name '${k}'.`, path: `actions[${i}].name` });
    }
    seen.add(k);
  });
  return issues;
}

export function validateUniqueActionDescriptions(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  cfg.actions?.forEach((a, i) => {
    const d = (a.description ?? "").trim();
    if (!d) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.ACTION_DESC_MISSING, message: "Action description is required.", path: `actions[${i}].description` });
      return;
    }
    if (seen.has(d)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.ACTION_DESC_DUP, message: `Duplicate description '${d}'.`, path: `actions[${i}].description` });
    }
    seen.add(d);
  });
  return issues;
}

export function validateReqResPresence(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    if (!a.req) issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.REQ_MISSING, message: "req is required.", path: `actions[${i}].req` });
    if (!a.res) issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.RES_MISSING, message: "res is required.", path: `actions[${i}].res` });
  });
  return issues;
}

export function validateStatusPresenceAndValidity(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const status = a.res?.status ?? cfg.globals?.res?.status;
    if (status === undefined) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.STATUS_MISSING, message: "res.status is required.", path: `actions[${i}].res.status` });
      return;
    }
    if (!isValidHttpStatus(status)) {
      issues.push({ severity: ValidationSeverity.WARNING, code: ValidationCode.STATUS_INVALID, message: `Invalid HTTP status '${status}'.`, path: `actions[${i}].res.status` });
    }
  });
  return issues;
}

export function validateReqMethodPresenceAndValidity(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const method = a.req?.method as any;
    if (method === undefined) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.METHOD_MISSING, message: "req.method is required.", path: `actions[${i}].req.method` });
      return;
    }
    const allowed = new Set<string>(Object.values(HttpMethod));
    if (typeof method !== "string" || !allowed.has(method)) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.METHOD_INVALID, message: `Invalid HTTP method '${method}'.`, path: `actions[${i}].req.method` });
    }
  });
  return issues;
}

export function validateResponseBodyFileBasics(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const status = a.res?.status ?? cfg.globals?.res?.status;
    const hasKey = Object.prototype.hasOwnProperty.call(a.res || {}, "bodyFile");
    const bf = a.res?.bodyFile as any;
    if (statusForbidsBody(status)) {
      if (hasKey && bf) {
        issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.STATUS_FORBIDS_BODY, message: `Status ${status} forbids body; remove res.bodyFile.`, path: `actions[${i}].res.bodyFile` });
      }
      return;
    }
    if (!hasKey) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.RES_BODYFILE_KEY_MISSING, message: "res.bodyFile key must exist when body is allowed.", path: `actions[${i}].res` });
    } else if (bf !== null && typeof bf !== "string") {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.RES_BODYFILE_TYPE, message: "res.bodyFile must be string or null.", path: `actions[${i}].res.bodyFile` });
    } else if (typeof bf === "string" && bf.trim() === "") {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.RES_BODYFILE_EMPTY, message: "res.bodyFile cannot be empty.", path: `actions[${i}].res.bodyFile` });
    }
  });
  return issues;
}

export function validateHeaderPolicyEnums(cfg: CruxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const p = a.req?.headers?.policy ?? cfg.globals?.req?.headers?.policy;
    if (p && p !== PolicyMode.PERMISSIVE && p !== PolicyMode.WARN && p !== PolicyMode.STRICT) {
      issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.POLICY_INVALID, message: `Invalid header policy '${p}'.`, path: `actions[${i}].req.headers.policy` });
    }
  });
  return issues;
}

export function validateBodyFilesExist(cfg: CruxConfig, opts: FsOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!opts.checkFilesExist) return issues;

  const base = opts.baseDir ?? process.cwd();
  cfg.actions?.forEach((a, i) => {
    const bf = a.res?.bodyFile;
    if (typeof bf === "string") {
      const full = require("path").resolve(base, bf);
      if (!fileExistsSync(fs, full)) {
        issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.BODYFILE_MISSING, message: `bodyFile not found: ${bf}`, path: `actions[${i}].res.bodyFile` });
      }
    }
  });
  return issues;
}

export function validateParamsSubsetOfPath(cfg: CruxConfig, actionDirs: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  cfg.actions?.forEach((a, i) => {
    const params = a.req?.params || {};
    const inFs = new Set<string>(extractPathParamsFromDir(actionDirs[i]).map(s => s.toLowerCase()));
    for (const k of Object.keys(params)) {
      if (!inFs.has(k.toLowerCase())) {
        issues.push({ severity: ValidationSeverity.ERROR, code: ValidationCode.PARAM_NOT_IN_PATH, message: `Param '${k}' not present in route path derived from filesystem.`, path: `actions[${i}].req.params['${k}']` });
      }
    }
  });
  return issues;
}

export function validateConfig(cfg: CruxConfig, opts: RunOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...validateNonEmptyActions(cfg));
  issues.push(...validateUniqueActionNames(cfg));
  issues.push(...validateUniqueActionDescriptions(cfg));
  issues.push(...validateReqResPresence(cfg));
  issues.push(...validateReqMethodPresenceAndValidity(cfg));
  issues.push(...validateStatusPresenceAndValidity(cfg));
  issues.push(...validateResponseBodyFileBasics(cfg));
  issues.push(...validateHeaderPolicyEnums(cfg));
  if (opts.actionDirs) issues.push(...validateParamsSubsetOfPath(cfg, opts.actionDirs));
  
  issues.push(...validateBodyFilesExist(cfg, { checkFilesExist: !!opts.checkFilesExist, baseDir: opts.bodyFilesBaseDir }));
  return issues;
}
