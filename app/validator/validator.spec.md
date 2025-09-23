# Validator
The validator is meant to inspect all crux route files for logical errors in their configuration and return descriptive errors to developers.

## Inputs
The feature will take in the JSON files from the .crux folder at the root of the current working directory. A version of the JSON looks like this:

```json
{
    "globals": {
        "req": {
            "headers": {
                "policy": "warn",
                "schema": {
                    "authorization": {
                        "scheme": "Bearer",
                        "pattern": "^[A-Za-z0-9._-]{20,}$"
                    },
                    "content-type": {
                        "oneof": [
                            "application/json"
                        ]
                    }
                }
            }
        },
        "res": {
            "status": 200
        }
    },
    "actions": [
        {
            "name": "test_1",
            "description": "example of using JSON as body data.",
            "req": {
                "method": "post",
                "params": {
                    "id": 1
                },
                "query": {
                    "date_created": "01010001"
                }
            },
            "res": {
                "bodyFile": "test_1.json"
            }
        },
        {
            "name": "test_2",
            "description": "example of using xml as body data",
            "req": {
                "method": "get",
                "headers": {
                    "schema": {
                        "content-type": "application/xml"
                    }
                },
                "params": {
                    "id": 1
                },
                "query": {
                    "date_created": "01010001"
                }
            },
            "res": {
                "bodyFile": "test_2.xml"
            }
        },
        {
            "name": "test_3",
            "description": "example of error response",
            "req": {
                "method": "get",
                "headers": {
                    "policy": "strict",
                    "schema": {
                        "content-type": "application/xml"
                    }
                },
                "params": {
                    "id": 1
                },
                "query": {
                    "date_created": "01010001"
                }
            },
            "res": {
                "status": 404,
                "bodyFile": "test_3.json"
            }
        }
    ]
}
```

With the `globals.json` looking something like this:
```json
{
    "req": {
        "headers": {
            "schema": {
                "authorization": {
                    "scheme": "Bearer",
                    "pattern": "^[A-Za-z0-9._-]{20,}$"
                },
                "content-type": {
                    "oneof": [
                        "application/json"
                    ]
                }
            }
        }
    },
    "res": {
        "status": 200
    }
}
```

## Outputs
The validator should output a list of issues that describe which JSON files have issues, what the issues are, and where. These issues should be accessible from:
1. The dev's terminal
2. Log files
3. Health checkpoints such as `localhost:4000/health`

## Tests
1. there are no duplicate action names 
2. no duplicate descriptions 
3. params that do not exist in the path are not present (requires some awareness of the file system as we are using that rather than having a "path" attribute)
5. the attribute name is present 
6. the attribute description is present 
7. the attribute req and res is present in each actions entry 
8. there are no empty actions entries 
9. each action has a status 
10. each action's status is a valid HTTP code (check against a standard package if possible so we don't have to keep track of when a new code is added) 
11. check if a representation's content-type is missing from headers. 
12. each representation has a name, bodyFile, and, contentType associated with it, even if the bodyFile and contentType is None. 
13. each representation as atleast one entry. 
14. If the status is 204/304, ensure res.bodyFile is absent 
15. match uses headers listed in the approved or optional headers, and none from the forbidden list. 
16. match should link to a valid representation
18. No duplicate representation names within an action.
19. bodyFile existence check (optional flag) to catch broken paths early. The file system should check paths relative to .crux
20. policy enum is valid (permissive|warn|strict) anywhere it appears.
21. Content-Type vs status sanity: For statuses that forbid bodies (1xx, 204, 304, HEAD), there must be no bodyFile or if you allow keeping them for negotiation metadata, they must not be sent—pick one rule and enforce.
22. Empty strings: name, description, contentType, bodyFile cannot be empty.
24. Headers schema keys are lowercase (normalize or warn).
25. Media types look like type/subtype (very light regex).
26. No orphan params/query keys: params & query must be objects of string/number/boolean, no nested objects/arrays unless explicitly allowed.
27. Actions array non-empty and all actions are objects.
28. For headers and params, reserved JS/TS keywords and names like `__proto__` are forbiddden to prevent injection or runtime issues.

## Constraints
1. The validator must take into account that there is a "globals.json" file that defines global settings that can later be overwritten by the individual json files if needed.
2. Policy attribute is allowed to have "error", "warn", "info" as configurable flags.
3. the /health endpoint must return 200 if no errors, and 500 if warnings/errors exist. The endpoint should be defined in a seperate "routes" file.
4. Validator must complete within 10 seconds for 100 files of 1mb each.
5. Each rule is a pure function and should return of type `ValidationIssue[]`.
6. The server rebuilds whenever new files are added/changed. It shouldn't re-validate files that have already been validated/haven't changed since the last time validation was run.

## Environment
- Language: Typescript