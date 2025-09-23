import { PolicyMode, ValidationSeverity, HttpNoBodyStatus, AuthScheme, BodyMode, DiagnosticsOnWarn, HttpMethod } from "./validator.enum";

export interface HeaderSchemas {
  [headerNameLower: string]: {
    oneOf?: string[];
    pattern?: string;
    scheme?: AuthScheme | string;
  };
}

export interface HeaderPolicy {
  policy?: PolicyMode;
  required?: string[];
  optional?: string[];
  forbidden?: string[];
  schemas?: HeaderSchemas;
  schema?: HeaderSchemas | Record<string, unknown>;
  strip?: string[];
  trustProxy?: boolean;
}

export interface RequestSpec {
  headers?: HeaderPolicy;
  params?: Record<string, string | number | boolean>;
  query?: Record<string, string | number | boolean>;
  method?: HttpMethod;
  body?: {
    expected?: boolean;
    mediaTypes?: string[];
    mode?: BodyMode;
    constraints?: { requireBoundary?: boolean };
  };
}

export interface ResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  bodyFile?: string | null;
  range?: boolean;
}

export interface ActionSpec {
  name?: string;
  description?: string;
  req?: RequestSpec;
  res?: ResponseSpec;
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
  path: string;
}

export interface ValidationIssueModel {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationSummaryModel {
  ok: boolean;
  issues: ValidationIssueModel[];
}
