# Build 5: SQLite and the overselling fix

Build 5 moves persistent application data into SQLite and prevents a ticket
tier from selling beyond its capacity.

## Acceptance criteria

- The schema stores users, events, ticket tiers, and bookings with primary
  keys, foreign keys, unique booking references, and relevant check constraints.
- The database enforces `sold >= 0 AND sold <= capacity`.
- The SQLite repository supports the same event, tier, and booking operations
  used by the services; values are passed through SQL placeholders.
- The production server uses SQLite, and the same events, inventory, bookings,
  and payment status remain available after reopening the database.
- A conditional atomic update reserves seats. When it cannot reserve the
  requested quantity, the operation returns `SOLD_OUT`.
- Fifty attempts to book one remaining seat produce exactly one success,
  forty-nine `SOLD_OUT` results, and one seat sold.

## Run and verify

```powershell
npm test
npm run oversell
npm run seed
npm start
```

The database file defaults to `data/ticketing.sqlite`. The seed script is
idempotent: it skips seeding when the database already contains events.
