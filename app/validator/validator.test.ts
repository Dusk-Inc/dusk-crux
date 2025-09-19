import { PayloadModel, HeaderModel, ErrorModel, SuccessModel } from "../payload/payload"
import { ValidateResponseData, ValidationSummaryModel, ValidationIssueModel } from "./validator"

describe("validateStructure", () => {
    test("does validate minimal structure", () => {
        const contentTypeHeader: HeaderModel = {
            headerName: "content-type",
            headerValue: "application/json"
        }
        const headers: Array<HeaderModel> = [
            contentTypeHeader
        ]
        const successVarientOne: SuccessModel = {
            variant: "firstPayloadVariant",
            status: 200,
            data: [
                {
                    id: 1,
                    name: "John Doe"
                }
            ]
        }
        const responseData: PayloadModel = {
            headers: headers,
            responses: [
                successVarientOne
            ]
        }
        const actualValidationResult = ValidateResponseData(JSON.stringify(responseData))
        const expectedValidationResult: ValidationSummaryModel = {
            ok: true,
            issues: []
        }
        expect(actualValidationResult).toStrictEqual(expectedValidationResult)
    })
})