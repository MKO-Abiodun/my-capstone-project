import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

it('enforces foreign keys and prevents sold inventory from exceeding capacity', async () => {
  const database = createDatabase(':memory:');
  const repository = createSqliteRepository(database);
  const eventService = createEventService({ repository });

  try {
    const event = await eventService.createEvent({
      title: 'Schema Constraint Event',
      city: 'Lagos',
      startsAt: '2027-06-01T18:00:00Z',
      organizerId: 'schema-organizer',
    });
    const tier = await eventService.addTier(event.id, {
      name: 'General',
      priceCents: 1000,
      capacity: 1,
    });

    assert.throws(() => database.prepare(`
      UPDATE ticket_tiers SET sold = 2 WHERE id = ?
    `).run(tier.id));
    assert.throws(() => database.prepare(`
      INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('orphan-tier', 'missing-event', 'Orphan', 100, 1, 0));
    assert.throws(() => database.prepare(`
      INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('orphan-event', 'missing-user', 'Orphan', 'Lagos', '', '2027-06-01T00:00:00Z', 'draft'));
  } finally {
    repository.close();
  }
});
