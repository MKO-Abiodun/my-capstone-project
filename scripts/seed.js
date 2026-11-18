import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

const repository = createSqliteRepository(createDatabase());
const eventService = createEventService({ repository });

try {
  const existingEvents = await repository.listEvents();
  if (existingEvents.length > 0) {
    console.log(`Database already contains ${existingEvents.length} event(s); seed skipped.`);
  } else {
    const event = await eventService.createEvent({
      title: 'Capstone Launch Night',
      city: 'Lagos',
      venue: 'Main Hall',
      startsAt: '2027-06-01T18:00:00Z',
      organizerId: 'seed-organizer',
    });
    const tier = await eventService.addTier(event.id, {
      name: 'General',
      priceCents: 5000,
      capacity: 100,
    });
    await eventService.publishEvent(event.id);
    console.log(`Seeded event ${event.id} with ticket tier ${tier.id}.`);
  }
} finally {
  repository.close();
}
