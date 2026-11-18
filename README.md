# mycap-project

An event ticketing API built with plain JavaScript ES modules and Node.js
built-ins. Use Node.js 22.13 or newer; no package installation is required.

## Run it

```powershell
node --version
npm test
npm run seed
npm start
```

The server listens on `http://localhost:3000` by default. Set `PORT` to use a
different port. The SQLite database is created at `data/ticketing.sqlite` and
keeps events, ticket tiers, bookings, and payment status between restarts.
`npm run seed` adds a sample event only when the database has no events.

Use `http://localhost:3000/openapi.json` as the OpenAPI document URL in Scalar.
See [docs/api-examples.md](docs/api-examples.md) for request examples.

## Build 5

The SQLite schema and connection are in `src/db/`. The production server uses
`src/repositories/sqlite.js`; API tests may inject the in-memory repository.
Ticket inventory is reserved with one conditional SQL update, so concurrent
requests cannot sell more seats than a tier's capacity.

```powershell
npm run oversell
```

The demo runs 50 booking attempts for one seat and reports the successful and
sold-out requests. Build acceptance criteria are in [docs/build-5.md](docs/build-5.md).

## Project structure

- `src/domain/`: business rules and validation
- `src/services/`: use-case coordination
- `src/repositories/`: memory and SQLite persistence
- `src/gateways/`: injected payment-provider adapters
- `src/http/`: HTTP routes, server behavior, and OpenAPI document
- `src/db/`: SQLite schema and connection
- `test/`: Node's built-in test runner tests
