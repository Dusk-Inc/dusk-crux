# Payload
This feature composes the response based on global and local configurations in the .crux routes.

## Inputs
This feature receives an object that described the path to look for in the .crux folder and any headers/query values sent from the original request.

## Outputs
This feature will compose a response from the globals.json and the route that was called, with the route file overwritting the globals when the same key is used.

## Tests
1. Payload successfully combines configurations from globals.json as well as globals and route settings in the route file being requested (see complex.crux.json for example).
2. Payload is able to compose a response from a request object with method "get" and with a 200 status response and no body.
3. Payload is able to compose a response from a request object with method "get" and with a 200 status and json body from file.
4. Payload is able to compose a response from a request object with method "get" and with a 400 error with message and code.
5. payload is able to compose a response from a request object with method "get" and with a 500 error with message and code.
6. Payload is able to compose a response from a request object with method "post" and with a 200 status and response and no body.
7. Payload is able to compose a response from a request object with method "post" and with a 200 status and response and a body from file.
8. Payload is able to compose a response from a request object with method "get" and with a 200 status and XML body from file.
9. Payload is able to compose a response from a request object with a method "post" and with a 400 status error with message and code.
10. Payload is able to compose a response from a request object with a method "patch" and with a 400 status error with message and code.
11. Payload is able to compose a response from a request object with method "patch" and with a 200 status and json body from file.
12. Deep object merge prefers route over globals for overlapping nested keys; arrays replace, not concat.
13. Route-level globals override globals.json, and action-level overrides route-level for the same keys.
14. Keys unique to lower precedence survive merge (no accidental deletion).
15. Method name matching is case-insensitive (e.g., "GET" vs "get").
16. Absolute bodyFile path is not allowed and throws error if attempted
17. Large body file (e.g., 5–10 MB) loads without truncation.
18. Payload throws error if validation fails (use validator feature)
19. Given payload receives a request with a query member of ?version=beta, when payload checks for actions, then it matches the first action that meets all the criteria.
20. Given payload recieves a request with a query member of ?version=beta and a parameter of 1 for :id, when payload searches for an action and doesn't find one, it throws an error that describes that no matching action was found.
21. Actions with no explicitely set status default to 200.
22. Given validator is run against the files being used, when Payload recieves the result and errors exist, the erros should be returned so the class using Payload can ship the errors to the developer.
23. Given the same inputs, Payload output is byte-for-byte identical across funs
24. If charset omitted, defaults to UTF-8 for text types; binary types (e.g., application/octet-stream) skip charset.
25. Headers like Authorization pass through to selection rules but are not echoed back unless explicitly configured in response headers.
26. Payload never includes internal file paths or stack traces in its normal response; only structured error objects for the server to map to 5xx.
27. Given a route has a parameter folder `[<folder_name>]` in the path, when payload checks the request object and finds no matching parameters, an error is thrown.
28. Given a route has no parameter folder in the path, when payload checks the request object and finds a parameters, an error is thrown.
29. Given a route has a parameter folder `[<folder_name>]` in the path, when payload checks the request object and finds a matching parameter, the payload is able to match the request to an action in the route file.

## Constraints
- If globals.json is missing, ignore it.
- Objects merge deeply. Don't concat, just add unique items from both, favoring the .crux file configurations.
- If the route exists but the method doesn’t → 405 with Allow header (all defined methods for the route).
- Files referenced by the bodyFile attribute in the res attribute of an action should resolve to a file in the same directory as the route file.
- normalize header lookups so errors aren't thrown over case.
- On malformed JSON or unreadable bodyFile, return a Payload error object (for the server to translate to 500) including a machine-readable code and the failing path (no stack traces).

## Additional Notes
The intent is to hand this result off the the server to respond to a request.