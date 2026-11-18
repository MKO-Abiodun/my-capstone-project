# AI log

## Build 1

- **Asked:** Build the in-memory booking domain, queue, demo, and lookup benchmark.
- **Came back:** The demo used an obsolete inventory API, reference generation used `Math.random`, and the queue was not a linked list.
- **Review and changes:** Updated the demo to use the current domain API, switched references to `node:crypto`, implemented the queue with linked nodes, and added queue and inventory tests.

## Build 2

- **Asked:** Add event search, sorting, event publication, and acceptance tests.
- **Came back:** The S06 test was a placeholder that always passed; several search, inventory, and unpublish cases were not covered.
- **Review and changes:** Replaced the placeholder with booking behavior tests, added the missing acceptance cases, and recorded the Build 1–4 stories in `docs/user-stories.md`.

## Build 3

- **Asked:** Implement the Build 3 state machine, HTTP router/server skeleton, configuration, architecture diagrams, and tests using the Build 3 brief and Build 2 project files.
- **Came back:** Added the requested Build 3 modules and documentation, plus tests for state transitions, route parameters, HTTP health, JSON errors, and static-file path containment.
- **Review and changes:** Kept the existing Build 2 domain modules unchanged. The static server checks both resolved paths and real paths so traversal and symlink escapes cannot expose files outside `public/`; HTTP errors do not include stack traces.

## Build 4

- **Asked:** Complete the in-memory API for event and booking workflows.
- **Came back:** The payment gateway received card data, unpublishing was not reachable through the API, and important API acceptance cases were untested.
- **Review and changes:** The HTTP boundary now turns the mock card input into a decline flag; the gateway receives only the amount and that flag. Added the unpublish endpoint, API examples, and integration tests for validation, search, booking, ownership, cancellation, and repeat payment.

## Build 5

- **Asked:** Replace volatile production storage with SQLite and prevent concurrent requests from overselling a ticket tier.
- **Came back:** Added a parameterized SQLite repository, schema constraints, a persistent production server, seeding and oversell demos, and concurrency and restart-persistence tests.
- **Review and changes:** The initial payment service updated only a returned in-memory object, which would not persist with SQLite. Changed it to call an explicit repository update after successful mock payment; tests cover persistence of payment status as well as inventory and event data.

## Architecture alignment

- **Asked:** Apply the documented separation of HTTP routes, services, domain rules, repositories, and persistence.
- **Came back:** Domain use cases had been delegated to repository methods, API routing constructed default infrastructure, and the payment adapter lived in a generic `lib` folder.
- **Review and changes:** Moved event and booking decisions into services using domain rules; repositories now expose persistence operations, API routing receives its dependencies, and the mock gateway lives under `src/gateways/`.
