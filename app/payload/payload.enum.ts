export enum PayloadConfigHeaders {
    ERROR = "X-Crux-Error",
    DELAY = "X-Crux-Delay",
    SEED = "X-Crux-Seed"
}

export enum PayloadDataHeaders {
    HTML = "html",
    JSON = "json",
    XML = "xml",
    TEXT = "text",
    BIN = "binary"
}

export enum ResponseClass {
    INFORMATIONAL = "informational",
    SUCCESS       = "success",
    REDIRECTION   = "redirection",
    CLIENT_ERROR  = "client_error",
    SERVER_ERROR  = "server_error",
}

export enum PayloadErrorCode {
    VALIDATION_FAILED = "VALIDATION_FAILED",
    NO_MATCHING_ACTION = "NO_MATCHING_ACTION",
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
    BODYFILE_ABSOLUTE_PATH = "BODYFILE_ABSOLUTE_PATH",
    BODYFILE_READ_ERROR = "BODYFILE_READ_ERROR",
    MALFORMED_JSON = "MALFORMED_JSON",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
