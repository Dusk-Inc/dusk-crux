import { PayloadConfigHeaders, ResponseClass } from './payload.enum'

export interface PayloadModel {
    headers: Array<HeaderModel>;
    responses: Array<ResponseModel>
}

export interface ErrorModel {
    code: string
    message: string
    status: number
}

export interface ResponseModel {
    variant: string,
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

// we should break this up so there's a generic "response" type with "success, error, info" responses.
// there should be atleast 1 successful response per request
// we should check the data types against the expected content type to ensure if XML is the correct format that it validates as XML correctly.