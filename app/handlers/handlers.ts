import { Request, Response } from "express";
import { applyFilters } from "../filters/filters";

export type JsonResponse = {
  status: number;
  contentType: string;
  body: any;
};

export function buildJsonResponse(payload: any, req: Request): JsonResponse {
  const body = applyFilters(payload, req);
  return {
    status: 200,
    contentType: "application/json",
    body
  };
}

export function makeJsonHandler(payload: any) {
  return (req: Request, res: Response) => {
    const { status, contentType, body } = buildJsonResponse(payload, req);
    res.type(contentType).status(status).send(body);
  };
}
