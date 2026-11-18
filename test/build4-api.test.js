import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/api.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/gateways/mockPaymentGateway.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';

function createTestApiRouter(options = {}) {
  const repository = options.repository ?? createMemoryRepository();
  const paymentGateway = options.paymentGateway ?? createMockPaymentGateway();
  return createApiRouter({
    eventService: createEventService({ repository }),
    bookingService: createBookingService({ repository, paymentGateway }),
  });
}

async function createEventWithTier(baseUrl, {
  title = 'API Acceptance Event',
  city = 'Lagos',
  venue = 'Acceptance Hall',
  startsAt = '2026-12-10T09:00:00Z',
  priceCents = 5000,
  capacity = 5,
} = {}) {
  const eventResponse = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, city, venue, startsAt, organizerId: 'organizer-test' }),
  });
  assert.equal(eventResponse.status, 201);
  const event = await eventResponse.json();

  const tierResponse = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'General', priceCents, capacity }),
  });
  assert.equal(tierResponse.status, 201);
  const tier = await tierResponse.json();
  return { event, tier };
}

async function publishEvent(baseUrl, eventId) {
  const response = await fetch(`${baseUrl}/api/events/${eventId}/publish`, { method: 'POST' });
  assert.equal(response.status, 200);
  return response.json();
}

async function createBooking(baseUrl, { userId = 'attendee-test', quantity = 1, ...eventOptions } = {}) {
  const { event, tier } = await createEventWithTier(baseUrl, eventOptions);
  await publishEvent(baseUrl, event.id);
  const response = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ tierId: tier.id, quantity }),
  });
  assert.equal(response.status, 201);
  return response.json();
}

describe('Build 4 API', () => {
  const app = createApp({ router: createTestApiRouter() });
  let baseUrl;

  before(async () => {
    await new Promise((resolve, reject) => {
      app.once('error', reject);
      app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${app.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  });

  it('creates, publishes and lists events through the API', async () => {
    const createResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Tech Summit',
        city: 'Lagos',
        venue: 'Main Hall',
        startsAt: '2026-12-10T09:00:00Z',
        organizerId: 'org-1',
      }),
    });

    assert.equal(createResponse.status, 201);
    const event = await createResponse.json();
    assert.equal(event.title, 'Tech Summit');
    assert.equal(event.status, 'draft');

    const tierResponse = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'VIP', priceCents: 25000, capacity: 20 }),
    });

    assert.equal(tierResponse.status, 201);
    const tier = await tierResponse.json();
    assert.equal(tier.name, 'VIP');

    const publishResponse = await fetch(`${baseUrl}/api/events/${event.id}/publish`, { method: 'POST' });
    assert.equal(publishResponse.status, 200);
    const published = await publishResponse.json();
    assert.equal(published.status, 'published');

    const listResponse = await fetch(`${baseUrl}/api/events?city=Lagos&sort=date`);
    assert.equal(listResponse.status, 200);
    const result = await listResponse.json();
    assert.ok(Array.isArray(result));
    assert.ok(result.some((item) => item.title === 'Tech Summit'));
  });

  it('books and pays a pending booking', async () => {
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Music Fest',
        city: 'Abuja',
        venue: 'Arena',
        startsAt: '2026-12-12T18:00:00Z',
        organizerId: 'org-2',
      }),
    });
    const event = await eventResponse.json();

    const tierResponse = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'GA', priceCents: 5000, capacity: 5 }),
    });
    const tier = await tierResponse.json();

    await fetch(`${baseUrl}/api/events/${event.id}/publish`, { method: 'POST' });

    const bookingResponse = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-1' },
      body: JSON.stringify({ tierId: tier.id, quantity: 2 }),
    });

    assert.equal(bookingResponse.status, 201);
    const booking = await bookingResponse.json();
    assert.equal(booking.status, 'pending');

    const payResponse = await fetch(`${baseUrl}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-1' },
      body: JSON.stringify({ cardNumber: '4111 1111 1111 1111' }),
    });

    assert.equal(payResponse.status, 200);
    const paid = await payResponse.json();
    assert.equal(paid.status, 'paid');
  });

  it('rejects a declined card without changing the booking state', async () => {
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Comedy Night',
        city: 'Ibadan',
        venue: 'Theatre',
        startsAt: '2026-12-14T19:00:00Z',
        organizerId: 'org-3',
      }),
    });
    const event = await eventResponse.json();

    const tierResponse = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Standard', priceCents: 4000, capacity: 10 }),
    });
    const tier = await tierResponse.json();

    await fetch(`${baseUrl}/api/events/${event.id}/publish`, { method: 'POST' });

    const bookingResponse = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-2' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    const booking = await bookingResponse.json();

    const declined = await fetch(`${baseUrl}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-2' },
      body: JSON.stringify({ cardNumber: 'declined' }),
    });

    assert.equal(declined.status, 400);
    const payload = await declined.json();
    assert.equal(payload.error.code, 'PAYMENT_DECLINED');

    const freshBooking = await fetch(`${baseUrl}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-2' },
      body: JSON.stringify({ cardNumber: '4242 4242 4242 4242' }),
    });
    assert.equal(freshBooking.status, 200);
  });

  it('allows an unpaid booking to be cancelled, but blocks other states', async () => {
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Lecture',
        city: 'Kaduna',
        venue: 'Campus',
        startsAt: '2026-12-16T12:00:00Z',
        organizerId: 'org-4',
      }),
    });
    const event = await eventResponse.json();

    const tierResponse = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Student', priceCents: 2000, capacity: 5 }),
    });
    const tier = await tierResponse.json();

    await fetch(`${baseUrl}/api/events/${event.id}/publish`, { method: 'POST' });

    const bookingResponse = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-3' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    const booking = await bookingResponse.json();

    const cancelResponse = await fetch(`${baseUrl}/api/bookings/${booking.reference}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-3' },
    });

    assert.equal(cancelResponse.status, 200);
    const cancelled = await cancelResponse.json();
    assert.equal(cancelled.status, 'cancelled');

    const rejectResponse = await fetch(`${baseUrl}/api/bookings/${booking.reference}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-3' },
    });
    assert.equal(rejectResponse.status, 400);
  });

  it('rejects invalid event and tier input with the common error shape', async () => {
    const invalidEvent = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', city: 'Lagos', startsAt: '2026-12-10' }),
    });
    assert.equal(invalidEvent.status, 400);
    assert.deepEqual(await invalidEvent.json(), {
      error: { code: 'VALIDATION', message: 'Title is required' },
    });

    const { event } = await createEventWithTier(baseUrl);
    const invalidTier = await fetch(`${baseUrl}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Invalid', priceCents: 2.5, capacity: 1 }),
    });
    assert.equal(invalidTier.status, 400);
    assert.equal((await invalidTier.json()).error.code, 'VALIDATION');

    const missingEvent = await fetch(`${baseUrl}/api/events/not-an-event/tiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'General', priceCents: 100, capacity: 1 }),
    });
    assert.equal(missingEvent.status, 404);
    assert.equal((await missingEvent.json()).error.code, 'NOT_FOUND');

    const invalidShape = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([]),
    });
    assert.equal(invalidShape.status, 400);
    assert.equal((await invalidShape.json()).error.code, 'VALIDATION');
  });

  it('exposes unpublish through the API and hides the event again', async () => {
    const { event } = await createEventWithTier(baseUrl, { title: 'Unpublish Acceptance' });
    await publishEvent(baseUrl, event.id);

    const response = await fetch(`${baseUrl}/api/events/${event.id}/unpublish`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'draft');

    const list = await fetch(`${baseUrl}/api/events?q=Unpublish%20Acceptance`);
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), []);
  });

  it('applies event search filters through the API and validates bad filters', async () => {
    const { event, tier } = await createEventWithTier(baseUrl, {
      title: 'Distinctive Searchable Event',
      city: 'Abuja',
      venue: 'OnlyVenueToken',
      startsAt: '2026-12-10T17:00:00Z',
      priceCents: 1000,
      capacity: 1,
    });
    await publishEvent(baseUrl, event.id);

    const matching = await fetch(
      `${baseUrl}/api/events?q=onlyvenuetoken&city=abuja&from=2026-12-10&to=2026-12-10&maxPriceCents=1000&onlyAvailable=true`
    );
    assert.equal(matching.status, 200);
    assert.equal((await matching.json()).length, 1);

    const bookLastSeat = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'search-test-attendee' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    assert.equal(bookLastSeat.status, 201);

    const soldOutFiltered = await fetch(
      `${baseUrl}/api/events?q=onlyvenuetoken&city=abuja&from=2026-12-10&to=2026-12-10&maxPriceCents=1000&onlyAvailable=true`
    );
    assert.equal((await soldOutFiltered.json()).length, 0);

    const badDate = await fetch(`${baseUrl}/api/events?from=not-a-date`);
    assert.equal(badDate.status, 400);
    assert.equal((await badDate.json()).error.code, 'VALIDATION');

    const badSort = await fetch(`${baseUrl}/api/events?sort=unknown`);
    assert.equal(badSort.status, 400);
    assert.equal((await badSort.json()).error.code, 'VALIDATION');

    const badPrice = await fetch(`${baseUrl}/api/events?maxPriceCents=1.5`);
    assert.equal(badPrice.status, 400);
    assert.equal((await badPrice.json()).error.code, 'VALIDATION');

    const badBoolean = await fetch(`${baseUrl}/api/events?onlyAvailable=maybe`);
    assert.equal(badBoolean.status, 400);
    assert.equal((await badBoolean.json()).error.code, 'VALIDATION');
  });

  it('validates booking input and returns SOLD_OUT without overselling', async () => {
    const { tier } = await createEventWithTier(baseUrl, { capacity: 1 });
    await fetch(`${baseUrl}/api/events/${tier.eventId}/publish`, { method: 'POST' });

    const missingUser = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1, userId: 'body-only-user' }),
    });
    assert.equal(missingUser.status, 400);

    const invalidQuantity = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-validation' },
      body: JSON.stringify({ tierId: tier.id, quantity: 0 }),
    });
    assert.equal(invalidQuantity.status, 400);
    assert.equal((await invalidQuantity.json()).error.code, 'VALIDATION');

    const stringQuantity = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-validation' },
      body: JSON.stringify({ tierId: tier.id, quantity: '1' }),
    });
    assert.equal(stringQuantity.status, 400);
    assert.equal((await stringQuantity.json()).error.code, 'VALIDATION');

    const tooMany = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-validation' },
      body: JSON.stringify({ tierId: tier.id, quantity: 2 }),
    });
    assert.equal(tooMany.status, 400);
    assert.equal((await tooMany.json()).error.code, 'SOLD_OUT');

    const lastSeat = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-validation' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    assert.equal(lastSeat.status, 201);

    const oversell = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-other' },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    assert.equal(oversell.status, 400);
    assert.equal((await oversell.json()).error.code, 'SOLD_OUT');
  });

  it('blocks cancelled-booking payment and enforces payment ownership', async () => {
    const cancelledBooking = await createBooking(baseUrl);
    const cancel = await fetch(`${baseUrl}/api/bookings/${cancelledBooking.reference}/cancel`, {
      method: 'POST',
      headers: { 'x-user-id': 'attendee-test' },
    });
    assert.equal(cancel.status, 200);

    const payCancelled = await fetch(`${baseUrl}/api/bookings/${cancelledBooking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-test' },
      body: JSON.stringify({ cardNumber: '4242 4242 4242 4242' }),
    });
    assert.equal(payCancelled.status, 400);
    assert.equal((await payCancelled.json()).error.code, 'INVALID_TRANSITION');

    const pending = await createBooking(baseUrl);
    const wrongOwner = await fetch(`${baseUrl}/api/bookings/${pending.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'someone-else' },
      body: JSON.stringify({ cardNumber: '4242 4242 4242 4242' }),
    });
    assert.equal(wrongOwner.status, 403);
    assert.equal((await wrongOwner.json()).error.code, 'FORBIDDEN');
  });

  it('charges only once for a successful payment and never passes card data to the gateway', async t => {
    const calls = [];
    const paymentGateway = {
      async charge(input) {
        calls.push(input);
        return { ok: true };
      },
    };
    const app = createApp({ router: createTestApiRouter({ paymentGateway }) });
    await new Promise((resolve, reject) => {
      app.once('error', reject);
      app.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise((resolve, reject) => {
      app.close(error => error ? reject(error) : resolve());
    }));
    const isolatedUrl = `http://127.0.0.1:${app.address().port}`;
    const booking = await createBooking(isolatedUrl);

    const first = await fetch(`${isolatedUrl}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-test' },
      body: JSON.stringify({ cardNumber: '4242 4242 4242 4242' }),
    });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).status, 'paid');

    const second = await fetch(`${isolatedUrl}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-test' },
      body: JSON.stringify({ cardNumber: '4242 4242 4242 4242' }),
    });
    assert.equal(second.status, 400);
    assert.equal((await second.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(calls[0]).sort(), ['amountCents', 'shouldDecline']);

    const cancelPaid = await fetch(`${isolatedUrl}/api/bookings/${booking.reference}/cancel`, {
      method: 'POST',
      headers: { 'x-user-id': 'attendee-test' },
    });
    assert.equal(cancelPaid.status, 400);
    assert.equal((await cancelPaid.json()).error.code, 'INVALID_TRANSITION');
  });
});
