# AI log

## Build 3

- **Asked:** Implement the Build 3 state machine, HTTP router/server skeleton, configuration, architecture diagrams, and tests using the Build 3 brief and Build 2 project files.
- **Came back:** Added the requested Build 3 modules and documentation, plus tests for state transitions, route parameters, HTTP health, JSON errors, and static-file path containment.
- **Review and changes:** Kept the existing Build 2 domain modules unchanged. The static server checks both resolved paths and real paths so traversal and symlink escapes cannot expose files outside `public/`; HTTP errors do not include stack traces.
