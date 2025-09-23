import { PolicyMode, ValidationSeverity, HttpNoBodyStatus } from "./validator.enum";

export interface HeaderSchemas {
  [headerNameLower: string]: {
    oneOf?: string[];
    pattern?: string;
    scheme?: "Bearer" | string;
  };
}

export interface HeaderPolicy {
  policy?: PolicyMode;
  required?: string[];
  optional?: string[];
  forbidden?: string[];
  schemas?: HeaderSchemas;
  strip?: string[];
  trustProxy?: boolean;
}

export interface RequestSpec {
  headers?: HeaderPolicy;
  params?: Record<string, string | number | boolean>;
  query?: Record<string, string | number | boolean>;
  body?: {
    expected?: boolean;
    mediaTypes?: string[];
    mode?: "warn" | "strict";
    constraints?: { requireBoundary?: boolean };
  };
}

export interface Representation {
  name?: string;
  contentType?: string | null;
  bodyFile?: string | null;
  default?: boolean;
}

export interface ResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  representations?: Representation[];
  range?: boolean;
}

export interface ActionSpec {
  name?: string;
  description?: string;
  req?: RequestSpec;
  res?: ResponseSpec;
  match?: Array<{
    when?: {
      headers?: Record<string, string>;
      params?: Record<string, string | number | boolean>;
      query?: Record<string, string | number | boolean>;
    };
    useResponse?: string; // must match a representation.name
  }>;
}

export interface LatticeConfig {
  version?: string;
  globals?: {
    req?: RequestSpec;
    res?: ResponseSpec;
    diagnostics?: {
      onWarn?: "collect" | "log" | "throw";
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
