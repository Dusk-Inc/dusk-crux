# Builder
Builder is a feature which reads the file structure of the .crux folder and produces routes for express.js at runtime. 

## Input
No input precisely, but it reads the file structure of .crux folder located at the root of the current working directory and and builds express routes based on that.

## Output
Dynamically generated express.js routes that are accessible to call.

## Tests
- Given a folder structure in the .crux folder, when a folder exists called "user" and a file within it called `user.crux.json`, routes for method used in actions are created.
- Given a folder structure in the .crux folder, when a directory of `/user/[id]`, a route of `localhost:<port_num>/user/:id` is created that accepts parameters for id.
- Given a folder structure in the .crux folder, when a directory of `/user/[id]/details`, a route of `localhost:<port_num>/user/:id/details` is created that accepts parameters for id.
- Given a folder structure in the .crux folder, when a file in one of its subdirectories does not have .crux.json in its name, then builder ignores the file.
- Given a folder structure in the .crux folder, when file path looks like `/user/[id]/details/[detail_id]`, then builder creates a route that accepts two parameters: id, and detail_id and route looks like `localhost:<port_num>/user/:id/details/[detail_id]`.
- Given by default, then a route is made available `localhost:<port_num>/health` that runs "validate" and returns its results.
- Given by default, then a route is made available `localhost:<port_num>/dir` that outputs the route structure of the API including possible headers, parameters, and query parameters. 
- Given route files in the .crux folder, when there are valid and invalid configurations present, the valid ones should still mount, and the non-valid ones should not.
- Given multiple operating systems, then crux should adapt to the file system of each.