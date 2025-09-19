export enum PayloadConfigHeaders {
    VARIANT = "X-Lattice-Variant",
    ERROR = "X-Lattice-Error",
    DELAY = "X-Lattice-Delay",
    SEED = "X-Lattice-Seed",
    FILTER = "X-Lattice-Filter"
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