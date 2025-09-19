import { PayloadModel, ResponseModel, HeaderModel } from "../payload/payload";
import { Severity } from "./validator.enum";
import { STATUS_CODES } from "http";

export interface ResponseFileModel {
    route: string;
    file: string;
    json: string;
}

export interface ValidationIssueModel {
    message: string;
    severity: Severity;
}

export interface ValidationSummaryModel {
    ok: boolean;
    route: string;
    file: string;
    issues: Array<ValidationIssueModel>
}

// general process:
// check if expected field is there
// if it is, then check individual aspects of the fields
// check in case variants aren't unique in a single file
// check if status is a valid status

export function ValidateResponseData(responseData: string){
    const issues: Array<ValidationIssueModel> = []
    // add to issues and return if this parses incorrectly
    const parsed: PayloadModel = JSON.parse(responseData)
    // add to issues if this parses incorrectly
    const headers: Array<HeaderModel> = parsed.headers ?? []
    // add to issues if this parses incorrectly and return
    const responses: Array<ResponseModel> = parsed.responses ?? []

    // alter this so the specific variant name and where it is can be found
    const checkHeadersForDuplicates: boolean = hasDuplicateKeyValue(headers, "headerName")
    const checkResponsesForDuplicates: boolean = hasDuplicateKeyValue(responses, "variant")
    
    if(checkHeadersForDuplicates == true){
        const headerDuplicateValidationError: ValidationIssueModel = {
            message: "header array contains duplicate headers.",
            severity: Severity.ERROR
        }
        issues.push(headerDuplicateValidationError)
    }

    if(checkResponsesForDuplicates == true){
        const responseDuplicateValidationError: ValidationIssueModel = {
            message: "response array contains duplicate response variants.",
            severity: Severity.ERROR
        }
        issues.push(responseDuplicateValidationError)
    }

    for(let response in responses){
        
    }

    return issues;
}

export function DistributeValidationToChannels(){

}

export function GatherResponses(){
    return null;
}

export function ValidateAllResponses(){
    // const responses: Array<ResponseModel> = GatherResponses();
    // for(let r in responses){

    // }
    return null
}

function hasDuplicateKeyValue<T>(arr: T[], key: keyof T): boolean {
    const seenValues = new Set<T[typeof key]>();
    for (const item of arr) {
      const value = item[key];
      if (seenValues.has(value)) {
        return true;
      }
      seenValues.add(value);
    }
    return false;
}

// make sure there are:
// console results of validation
// JSON artifact
// JUnit XML
// HTTP Endpoint for validation (__lattice/validation) to read and display results in a Docs UI.