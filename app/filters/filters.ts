import { Request } from "express";



export function applyFilters(payload: any, req: Request): any {
  if (!hasRouteParams(req)) return payload;

  const { isArrayPayload, hasDataArray, sourceArray } = detectSourceArray(payload);
  if (!sourceArray) return payload;

  const entries = paramEntries(req);
  const filtered = filterRowsByParams(sourceArray, entries);

  return wrapFilteredResult(payload, filtered, isArrayPayload, hasDataArray, entries);
}

export function hasRouteParams(req: Request): boolean {
  return !!req.params && Object.keys(req.params).length > 0;
}

export function detectSourceArray(payload: any): 
{
  isArrayPayload: boolean;
  hasDataArray: boolean;
  sourceArray: any[] | null;
} 
{
  const isArrayPayload = Array.isArray(payload);
  const hasDataArray = !isArrayPayload && payload && Array.isArray(payload.data);

  const sourceArray: any[] | null =
    isArrayPayload ? payload :
    hasDataArray   ? payload.data :
    null;

  return { isArrayPayload, hasDataArray, sourceArray };
}

export function paramEntries(req: Request): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(req.params ?? {})) {
    if (typeof v === "string" && v.length > 0) entries.push([k, v]);
  }
  return entries;
}

export function resolveFieldKey(row: any, key: string): string {
  if (row && Object.prototype.hasOwnProperty.call(row, key)) return key;
  const lower = key.toLowerCase();
  if (row && Object.prototype.hasOwnProperty.call(row, lower)) return lower;
  return key;
}

export function coerceToSampleType(value: string, sample: any): any {
  if (typeof sample === "number") {
    const n = Number(value);
    const result = Number.isNaN(n) ? value : n;
    return result;
  }
  if (typeof sample === "boolean") {
    const v = value.toLowerCase();
    const result = v === "true" ? true : v === "false" ? false : value;
    return result
  }
  return value;
}

export function filterRowsByParams(
  rows: any[],
  params: Array<[string, string]>
): any[] {
  if (params.length === 0) return rows;

  return rows.filter((row) => {
    for (const [k, v] of params) {
      const key = resolveFieldKey(row, k);
      const want = coerceToSampleType(v, row?.[key]);
      if (row?.[key] !== want) return false;
    }
    return true;
  });
}

export function wrapFilteredResult(
  originalPayload: any,
  filtered: any[],
  isArrayPayload: boolean,
  hasDataArray: boolean,
  params: Array<[string, string]>
): any {
  const singleParam = params.length === 1;
  const singleHit = filtered.length === 1;

  if (isArrayPayload) {
    return singleParam && singleHit ? filtered[0] : filtered;
  }

  if (hasDataArray) {
    const data = singleParam && singleHit ? filtered[0] : filtered;
    return { ...originalPayload, data };
  }

  return originalPayload;
}