# Feature: Validator
The validator is meant to inspect all crux route files for logical errors in their configuration and return descriptive errors to developers.

## Inputs
The feature will take in the JSON files from the .crux folder at the root of the current working directory. A version of the JSON looks like this:

## Operations
The validator will need to check for the following potential issues:
1. there are no duplicate action names 
2. no duplicate descriptions 
3. params that do not exist in the path are not present (requires some awareness of the file system as we are using that rather than having a "path" attribute 
4. each representation has a "default" representation, even if there's only one 
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
17. Exactly one default representation per action. (Your #4 says “has a default even if only one”; let’s also enforce “exactly one”.)
18. No duplicate representation names within an action.
19. bodyFile existence check (optional flag) to catch broken paths early.
20. policy enum is valid (permissive|warn|strict) anywhere it appears.
21. Content-Type vs status sanity: For statuses that forbid bodies (1xx, 204, 304, HEAD), there must be no representations; or if you allow keeping them for negotiation metadata, they must not be sent—pick one rule and enforce. Below I enforce no representations for those statuses.
22. Empty strings: name, description, contentType, bodyFile cannot be empty.
23. Match blocks reference existing targets:
- useResponse (or variant) must reference an existing representation name.
- match.headers.* keys must not be in forbidden and (if you want stricter) must exist in required ∪ optional when a policy defines those.
24. Headers schema keys are lowercase (normalize or warn).
25. Media types look like type/subtype (very light regex).
26. No orphan params/query keys: params & query must be objects of string/number/boolean, no nested objects/arrays unless explicitly allowed.
27. Actions array non-empty (your #8), and all actions are objects.
28. HTTP method sanity (if you add method later): in HttpMethod enum.

## Outputs
The validator should output a list of issues that describe which JSON files have issues, what the issues are, and where. These issues should be accessible from:
1. The dev's terminal
2. Log files
3. Health checkpoints such as `localhost:4000/health`

## Constraints


## Environment
- Language: Typescript

## Examples

## Additional Notes