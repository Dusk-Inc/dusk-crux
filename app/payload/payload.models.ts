import { PayloadConfigHeaders, ResponseClass, PayloadErrorCode } from './payload.enum'
import * as fs from 'fs'

export interface PayloadModel {
    headers: Array<HeaderModel>;
    responses: Array<ResponseModel>
}

export interface ResponseModel {
    action: string,
    status: number
}

export interface ErrorModel extends ResponseModel {
    code: string,
    message: string
}

export interface SuccessModel extends ResponseModel {
    data: Array<Object>
}

export interface InformationModel extends ResponseModel {
    
}

export interface HeaderModel {
    headerName: string | PayloadConfigHeaders;
    headerValue: string;
}

export interface RedirectModel extends ResponseModel{
    location: string
}

export interface RequestContext {
  path: string
  method: string
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  params?: Record<string, string | number | boolean>
}

export interface ComposeOptions {
  cruxDir?: string
  baseDir?: string
  fileSystem?: typeof fs
  validate?: boolean
}

export interface PayloadError {
  code: PayloadErrorCode
  message: string
  path?: string
}

export interface ComposeResult {
  ok: boolean
  status: number
  headers: Record<string, string>
  body?: string | Buffer | null
  errors?: PayloadError[]
  allow?: string[]
  class?: ResponseClass
}
