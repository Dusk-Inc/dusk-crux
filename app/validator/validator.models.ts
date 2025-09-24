import { PolicyMode, ValidationSeverity, BodyMode, DiagnosticsOnWarn, HttpMethod } from "./validator.enum";

export interface HeaderPolicy {
  policy?: PolicyMode;
  schema?: Record<string, unknown>;
  strip?: string[];
  trustProxy?: boolean;
}

export interface RequestSpec {
  headers?: HeaderPolicy;
  params?: Record<string, string | number | boolean>;
  query?: Record<string, string | number | boolean>;
  method: HttpMethod;
  body?: {
    expected?: boolean;
    mediaTypes?: string[];
    mode?: BodyMode;
    constraints?: { requireBoundary?: boolean };
  };
}

export interface ResponseSpec {
  status: number;
  headers?: Record<string, string>;
  bodyFile?: string | null;
  range?: boolean;
}

export interface ActionSpec {
  name: string;
  description: string;
  req: RequestSpec;
  res: ResponseSpec;
}

export interface CruxConfig {
  version?: string;
  globals?: {
    req?: RequestSpec;
    res?: ResponseSpec;
    diagnostics?: {
      onWarn?: DiagnosticsOnWarn;
      explain?: boolean;
    };
  };
  actions: ActionSpec[];
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface ValidationSummaryModel {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface FsOptions {
  checkFilesExist?: boolean;
  baseDir?: string;
}

export interface RunOptions {
  checkFilesExist?: boolean;
  bodyFilesBaseDir?: string;
  actionDirs?: string[];
}