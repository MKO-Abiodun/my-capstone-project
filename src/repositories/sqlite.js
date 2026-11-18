import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '../db/connection.js';

function mapTier(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    price: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function mapBooking(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    attendee: {
      id: row.user_id,
      name: row.user_name,
      role: 'attendee',
    },
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    priceCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapEvent(row, tierIds = []) {
  if (!row) return undefined;
  const organizer = {
    id: row.organizer_id,
    name: row.organizer_name,
    role: 'organizer',
  };
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizer,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    date: row.starts_at,
    status: row.status,
    tierIds,
  };
}

function withTransaction(database, operation) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function insertUser(database, user) {
  database.prepare(`
    INSERT INTO users (id, name, role)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(user.id, user.name, user.role);
}

export function createSqliteRepository(database = createDatabase()) {
  if (!(database instanceof DatabaseSync)) {
    throw new TypeError('A SQLite repository requires a DatabaseSync connection');
  }

  function getEvent(eventId) {
    const row = database.prepare(`
      SELECT e.*, u.name AS organizer_name
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      WHERE e.id = ?
    `).get(eventId);
    if (!row) return undefined;
    const tierIds = database.prepare(
      'SELECT id FROM ticket_tiers WHERE event_id = ? ORDER BY rowid'
    ).all(eventId).map((tier) => tier.id);
    return mapEvent(row, tierIds);
  }

  function getTier(tierId) {
    return mapTier(database.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(tierId));
  }

  function getBookingByReference(reference) {
    const row = database.prepare(`
      SELECT b.*, u.name AS user_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.reference = ?
    `).get(reference);
    return mapBooking(row);
  }

  return {
    async saveEvent(event) {
      withTransaction(database, () => {
        insertUser(database, event.organizer);
        database.prepare(`
          INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          event.id,
          event.organizerId,
          event.title,
          event.city,
          event.venue,
          event.startsAt,
          event.status
        );
      });
      return event;
    },

    async updateEvent(event) {
      const result = database.prepare(`
        UPDATE events
        SET title = ?, city = ?, venue = ?, starts_at = ?, status = ?
        WHERE id = ?
      `).run(event.title, event.city, event.venue, event.startsAt, event.status, event.id);
      return result.changes === 1 ? getEvent(event.id) : undefined;
    },

    async listEvents() {
      const eventRows = database.prepare(`
        SELECT e.*, u.name AS organizer_name
        FROM events e
        JOIN users u ON u.id = e.organizer_id
        ORDER BY e.rowid
      `).all();
      const tierRows = database.prepare('SELECT id, event_id FROM ticket_tiers ORDER BY rowid').all();
      return eventRows.map((row) => mapEvent(
        row,
        tierRows.filter((tier) => tier.event_id === row.id).map((tier) => tier.id)
      ));
    },

    async getEvent(eventId) {
      return getEvent(eventId);
    },

    async saveTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      return tier;
    },

    async getTier(tierId) {
      return getTier(tierId);
    },

    async createBookingWithReservation(booking) {
      return withTransaction(database, () => {
        const reservation = database.prepare(`
          UPDATE ticket_tiers
          SET sold = sold + ?
          WHERE id = ? AND sold + ? <= capacity
        `).run(booking.quantity, booking.tierId, booking.quantity);
        if (reservation.changes !== 1) return false;

        insertUser(database, booking.attendee);
        database.prepare(`
          INSERT INTO bookings (
            id, user_id, tier_id, reference, quantity, amount_cents, status, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          booking.id,
          booking.userId,
          booking.tierId,
          booking.reference,
          booking.quantity,
          booking.amountCents,
          booking.status,
          booking.createdAt
        );
        return true;
      });
    },

    async getBookingByReference(reference) {
      return getBookingByReference(reference);
    },

    async markBookingPaid(reference) {
      const result = database.prepare(`
        UPDATE bookings SET status = ?
        WHERE reference = ? AND status = ?
      `).run('paid', reference, 'pending');
      return result.changes === 1 ? getBookingByReference(reference) : undefined;
    },

    async cancelBooking(reference, expectedStatus) {
      return withTransaction(database, () => {
        const booking = getBookingByReference(reference);
        if (!booking || booking.status !== expectedStatus) return undefined;

        const statusUpdate = database.prepare(`
          UPDATE bookings SET status = ?
          WHERE reference = ? AND status = ?
        `).run('cancelled', reference, expectedStatus);
        if (statusUpdate.changes !== 1) return undefined;

        const seatRelease = database.prepare(`
          UPDATE ticket_tiers SET sold = sold - ?
          WHERE id = ? AND sold >= ?
        `).run(booking.quantity, booking.tierId, booking.quantity);
        if (seatRelease.changes !== 1) {
          throw new Error('Booking inventory could not be released');
        }
        return getBookingByReference(reference);
      });
    },

    close() {
      database.close();
    },
  };
}

export default createSqliteRepository;
