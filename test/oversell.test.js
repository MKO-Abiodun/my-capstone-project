import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/api.js';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createMockPaymentGateway } from '../src/gateways/mockPaymentGateway.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';

it('allows exactly one of 50 concurrent requests to book the last ticket', async (t) => {
  const repository = createSqliteRepository(createDatabase(':memory:'));
  const eventService = createEventService({ repository });
  const bookingService = createBookingService({
    repository,
    paymentGateway: createMockPaymentGateway(),
  });
  const app = createApp({
    router: createApiRouter({ eventService, bookingService }),
  });
  await new Promise((resolve, reject) => {
    app.once('error', reject);
    app.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
    repository.close();
  });

  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  const event = await eventService.createEvent({
    title: 'Concurrent Last Ticket',
    city: 'Lagos',
    venue: 'Test Hall',
    startsAt: '2027-06-01T18:00:00Z',
    organizerId: 'oversell-organizer',
  });
  const tier = await eventService.addTier(event.id, {
    name: 'General',
    priceCents: 1000,
    capacity: 1,
  });
  await eventService.publishEvent(event.id);

  const responses = await Promise.all(Array.from({ length: 50 }, (_, index) =>
    fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': `oversell-attendee-${index}`,
      },
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    })
  ));
  const outcomes = await Promise.all(responses.map(async (response) => ({
    status: response.status,
    body: await response.json(),
  })));
  const succeeded = outcomes.filter((outcome) => outcome.status === 201);
  const soldOut = outcomes.filter((outcome) =>
    outcome.status === 400 && outcome.body.error?.code === 'SOLD_OUT'
  );

  assert.equal(succeeded.length, 1);
  assert.equal(soldOut.length, 49);
  assert.equal((await repository.getTier(tier.id)).sold, 1);
});
