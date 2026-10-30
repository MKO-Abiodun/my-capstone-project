# Build 3 architecture

## Layers

```mermaid
flowchart TD
  Routes[HTTP routes] --> Services[Application services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories]
  Repositories --> Data[(Database or in-memory store)]
```

- **Routes** translate HTTP requests and responses; they do not contain business rules or access storage directly.
- **Services** coordinate use cases and repositories; they do not implement transport details or bypass domain rules.
- **Rules** enforce domain behavior and state transitions; they do not know about HTTP or persistence.
- **Repositories** load and save data; they do not make business decisions or call routes/services.
- **Data** is the persisted or in-memory state; it does not initiate calls into other layers.

## Data model

```mermaid
erDiagram
  USER ||--o{ EVENT : organizes
  EVENT ||--|{ TICKET_TIER : offers
  USER ||--o{ BOOKING : makes
  TICKET_TIER ||--o{ BOOKING : reserves

  USER {
    string id
    string name
    string role
  }
  EVENT {
    string id
    string organizerId
    string title
    string city
    string venue
    datetime date
    string status
  }
  TICKET_TIER {
    string id
    string eventId
    string name
    integer priceCents
    integer capacity
  }
  BOOKING {
    string id
    string attendeeId
    string tierId
    integer quantity
    integer totalPriceCents
    string status
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```

`cancelled`, `refunded`, and `checked_in` are terminal states. No transition is permitted out of them.
