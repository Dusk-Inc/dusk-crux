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