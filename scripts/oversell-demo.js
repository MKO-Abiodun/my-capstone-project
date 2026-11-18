import assert from 'node:assert/strict';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/gateways/mockPaymentGateway.js';

const repository = createSqliteRepository(createDatabase(':memory:'));
const eventService = createEventService({ repository });
const bookingService = createBookingService({
  repository,
  paymentGateway: createMockPaymentGateway(),
});

try {
  const event = await eventService.createEvent({
    title: 'Last Ticket Race',
    city: 'Lagos',
    venue: 'Demo Hall',
    startsAt: '2027-06-01T18:00:00Z',
    organizerId: 'demo-organizer',
  });
  const tier = await eventService.addTier(event.id, {
    name: 'Last Seat',
    priceCents: 1000,
    capacity: 1,
  });

  const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
    bookingService.bookTickets({ tierId: tier.id, userId: `demo-attendee-${index}`, quantity: 1 })
      .then((booking) => ({ booking }))
      .catch((error) => {
        if (error.code !== 'SOLD_OUT') throw error;
        return { error };
      })
  ));
  const successes = results.filter((result) => result.booking).length;
  const soldOut = results.filter((result) => result.error?.code === 'SOLD_OUT').length;
  const finalTier = await repository.getTier(tier.id);

  console.log(`50 booking attempts: ${successes} succeeded, ${soldOut} received SOLD_OUT.`);
  console.log(`Tickets sold: ${finalTier.sold}/${finalTier.capacity}.`);
  assert.equal(successes, 1);
  assert.equal(soldOut, 49);
  assert.ok(finalTier.sold <= finalTier.capacity);
} finally {
  repository.close();
}
