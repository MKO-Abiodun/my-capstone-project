# Build 4 API examples

These curl examples cover the happy path in the in-memory API.

## Create an event

```bash
curl -sS -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -d '{
    "title": "Tech Summit",
    "city": "Lagos",
    "venue": "Main Hall",
    "startsAt": "2026-12-10T09:00:00Z",
    "organizerId": "org-1"
  }'
```

## Add a tier

```bash
curl -sS -X POST http://localhost:3000/api/events/<event-id>/tiers \
  -H 'content-type: application/json' \
  -d '{
    "name": "VIP",
    "priceCents": 25000,
    "capacity": 20
  }'
```

## Publish the event

```bash
curl -sS -X POST http://localhost:3000/api/events/<event-id>/publish
```

## Search published events

```bash
curl -sS "http://localhost:3000/api/events?q=Tech&city=Lagos&sort=date&onlyAvailable=true"
```

## Unpublish the event

```bash
curl -sS -X POST http://localhost:3000/api/events/<event-id>/unpublish
```

## Book tickets

```bash
curl -sS -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -H 'x-user-id: user-1' \
  -d '{
    "tierId": "<tier-id>",
    "quantity": 2
  }'
```

## Pay for the booking

```bash
curl -sS -X POST http://localhost:3000/api/bookings/<reference>/pay \
  -H 'content-type: application/json' \
  -H 'x-user-id: user-1' \
  -d '{
    "cardNumber": "4111 1111 1111 1111"
  }'
```

## Cancel an unpaid booking

```bash
curl -sS -X POST http://localhost:3000/api/bookings/<reference>/cancel \
  -H 'x-user-id: user-1'
```
