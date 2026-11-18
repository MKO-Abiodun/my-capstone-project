# Builds 1–5 user stories

## S02: Create an event

As an organizer, I want to create an event with a title, city, venue, and date so that attendees can find it.

- A valid event is saved as a draft with a new id and is hidden from the public list.
- A missing title or city, or an invalid date, returns `VALIDATION` and does not save an event.

## S03: Add ticket tiers

As an organizer, I want to add ticket tiers with a price and capacity so that I can offer ticket options.

- A valid tier starts with zero tickets sold and its full capacity available.
- A non-integer or negative price, or capacity below one, returns `VALIDATION`.
- An unknown event id returns `NOT_FOUND`.

## S04: Publish and unpublish an event

As an organizer, I want to publish and unpublish an event so that I control when it is public.

- An event without a tier cannot be published.
- Publishing an event with a tier makes it visible in public event search.
- Unpublishing returns it to draft and removes it from public search.

## S05: Search events

As an attendee, I want to search, filter, and sort published events so that I can find one to attend.

- Text matches title or venue, and city matching ignores case.
- Date bounds are inclusive; a date-only upper bound includes the whole day.
- Maximum price uses the cheapest tier; events without tiers do not match a price limit.
- Results sort by date, price, or availability, with deterministic title and id tie-breakers.
- Invalid dates, non-integer prices, and unknown sort options return `VALIDATION`.
- Filtering and sorting do not mutate the input list.

## S06: Book tickets

As an attendee, I want to book tickets from a tier so that I can reserve a place.

- A successful booking is pending, uses whole cents, and reserves its quantity.
- Insufficient capacity returns `SOLD_OUT` and leaves inventory and bookings unchanged.
- Quantities must be whole numbers from 1 through 10.

## S07: Pay for a booking

As an attendee, I want to pay for a booking with mock payment so that it becomes confirmed.

- The owner can pay a pending booking; it becomes paid and its reference is returned.
- A declined payment returns `PAYMENT_DECLINED` without changing the pending booking.
- Cancelled bookings cannot be paid, and a paid booking cannot be charged again.
- A caller cannot pay another attendee's booking.

## S08: Prevent overselling

As an attendee, I want to be certain the last ticket is sold to only one person
so that nobody turns up to a full event.

- Given exactly one seat remains, when 50 attendees try to book at the same
  time, exactly one booking succeeds and 49 receive `SOLD_OUT`.
- The tier's sold count never exceeds its capacity.
- Removing the atomic database reservation causes the overselling test to fail.

## S16: Run tests

As a team, we want `npm test` to run the test suite and fail when any test fails.
