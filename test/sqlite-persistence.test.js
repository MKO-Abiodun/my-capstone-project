import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/gateways/mockPaymentGateway.js';

it('persists events, tiers, bookings, and payment status after reopening SQLite', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'mycap-sqlite-'));
  const databasePath = path.join(directory, 'ticketing.sqlite');
  const repositories = [];

  try {
    const firstRepository = createSqliteRepository(createDatabase(databasePath));
    repositories.push(firstRepository);
    const eventService = createEventService({ repository: firstRepository });
    const bookingService = createBookingService({
      repository: firstRepository,
      paymentGateway: createMockPaymentGateway(),
    });
    const event = await eventService.createEvent({
      title: 'Persistent Event',
      city: 'Abuja',
      venue: 'Persistence Hall',
      startsAt: '2027-06-01T18:00:00Z',
      organizerId: 'persistent-organizer',
    });
    const tier = await eventService.addTier(event.id, {
      name: 'General',
      priceCents: 2500,
      capacity: 3,
    });
    await eventService.publishEvent(event.id);
    const booking = await bookingService.bookTickets({
      tierId: tier.id,
      userId: 'persistent-attendee',
      quantity: 1,
    });
    await bookingService.payBooking(booking.reference, {
      userId: 'persistent-attendee',
    });
    const reopenedRepository = createSqliteRepository(createDatabase(databasePath));
    repositories.push(reopenedRepository);
    assert.equal((await reopenedRepository.getEvent(event.id)).status, 'published');
    assert.equal((await reopenedRepository.getTier(tier.id)).sold, 1);
    assert.equal((await reopenedRepository.getBookingByReference(booking.reference)).status, 'paid');
    assert.equal((await reopenedRepository.listEvents()).length, 1);
  } finally {
    for (const repository of repositories) repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
