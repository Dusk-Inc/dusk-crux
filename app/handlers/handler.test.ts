import type { Request, Response } from "express";
import { buildJsonResponse, makeJsonHandler } from "./handlers";


jest.mock("../filters/filters", () => ({
  applyFilters: jest.fn(),
}));

import { applyFilters } from "../filters/filters";

const mockApply = applyFilters as jest.Mock;

const makeReq = (params: Record<string, string> = {}): Request =>
  ({ params } as unknown as Request);

const makeRes = (): Response => {
  const res: Partial<Response> = {};
  res.type = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("buildJsonResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 + application/json + filtered body", () => {
    const payload = { data: [{ id: 1 }, { id: 2 }] };
    const req = makeReq({ id: "2" });
    const filtered = { data: { id: 2 } };

    mockApply.mockReturnValueOnce(filtered);

    const out = buildJsonResponse(payload, req);

    expect(mockApply).toHaveBeenCalledWith(payload, req);
    expect(out.status).toBe(200);
    expect(out.contentType).toBe("application/json");
    expect(out.body).toEqual(filtered);
  });

  test("passes through empty results from filters", () => {
    const payload = { data: [{ id: 1 }] };
    const req = makeReq({ id: "999" });

    mockApply.mockReturnValueOnce({ data: [] });

    const out = buildJsonResponse(payload, req);

    expect(out.status).toBe(200);
    expect(out.contentType).toBe("application/json");
    expect(out.body).toEqual({ data: [] });
  });

  test("handles undefined from filters", () => {
    const payload = { anything: true };
    const req = makeReq();

    mockApply.mockReturnValueOnce(undefined);

    const out = buildJsonResponse(payload, req);

    expect(out.status).toBe(200);
    expect(out.contentType).toBe("application/json");
    expect(out.body).toBeUndefined();
  });
});

describe("makeJsonHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("writes filtered response to res", () => {
    const payload = { data: [{ id: 1 }, { id: 2 }] };
    const req = makeReq({ id: "1" });
    const res = makeRes();

    const filtered = { data: { id: 1 } };
    mockApply.mockReturnValueOnce(filtered);

    const handler = makeJsonHandler(payload);
    handler(req, res);

    expect(mockApply).toHaveBeenCalledWith(payload, req);
    expect(res.type).toHaveBeenCalledWith("application/json");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(filtered);
  });

  test("still sends when filters return an empty array", () => {
    const payload = { data: [{ id: 1 }] };
    const req = makeReq({ id: "999" });
    const res = makeRes();

    const filtered: any = { data: [] };
    mockApply.mockReturnValueOnce(filtered);

    const handler = makeJsonHandler(payload);
    handler(req, res);

    expect(res.type).toHaveBeenCalledWith("application/json");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(filtered);
  });
});
