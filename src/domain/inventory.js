import { newId, newReferenceCode } from './ids.js';
import { Queue } from './waitlistQueue.js';
import { DomainError } from './errors.js';
import { createOrganizer, createAttendee } from './user.js';
import { parseIsoDate } from './dates.js';

export const MAX_TICKETS_PER_BOOKING = 10;
const HOLDS_SEATS = new Set(['pending', 'paid']);

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
    waitlists: new Map(),
  };
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

function requireWholeNumber(value, field, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError('VALIDATION', `${field} must be a whole number of at least ${min}`);
  }
  return value;
}

function getTier(store, tierId) {
  const tier = store.tiers.get(tierId);
  if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  return tier;
}

function getEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return event;
}

export function createEvent(store, { title, city, venue = '', startsAt, date, organizerId } = {}) {
  const chosenDate = startsAt ?? date;
  const parsed = new Date(parseIsoDate(chosenDate, 'startsAt'));

  const organizer = createOrganizer({
    id: organizerId ?? 'unknown',
    name: organizerId ?? 'unknown',
    role: 'organizer',
  });

  const event = {
    id: newId(),
    organizerId: organizer.id,
    organizer,
    title: requireText(title, 'Title'),
    city: requireText(city, 'City'),
    venue: String(venue).trim(),
    startsAt: parsed.toISOString(),
    date: parsed.toISOString(),
    status: 'draft',
    tierIds: [],
  };
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, input = {}) {
  const event = getEvent(store, eventId);
  const { name, priceCents, capacity, price, cap } = input;
  const finalPrice = priceCents ?? price;
  const finalCapacity = capacity ?? cap;

  if (!Number.isInteger(finalPrice) || finalPrice < 0) {
    throw new DomainError('VALIDATION', 'priceCents must be a whole number of at least 0');
  }
  if (!Number.isInteger(finalCapacity) || finalCapacity < 1) {
    throw new DomainError('VALIDATION', 'capacity must be a whole number of at least 1');
  }

  const tier = {
    id: newId(),
    eventId,
    name: requireText(name ?? 'General', 'Tier name'),
    priceCents: finalPrice,
    price: finalPrice,
    capacity: finalCapacity,
    sold: 0,
  };

  store.tiers ??= new Map();
  store.waitlists ??= new Map();
  store.tiers.set(tier.id, tier);
  store.waitlists.set(tier.id, new Queue());
  event.tierIds.push(tier.id);
  return tier;
}

export function publishEvent(store, eventId) {
  const event = getEvent(store, eventId);
  if (event.tierIds.length === 0) {
    throw new DomainError('INVALID_STATE', 'Add at least one ticket tier before publishing');
  }
  event.status = 'published';
  return event;
}

export function unpublishEvent(store, eventId) {
  const event = getEvent(store, eventId);
  event.status = 'draft';
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.status === 'published')
    .map((event) => {
      const tiers = (event.tierIds || []).map((id) => store.tiers.get(id)).filter(Boolean);
      const minPriceCents = tiers.length ? Math.min(...tiers.map((tier) => tier.priceCents ?? tier.price)) : null;
      const totalSeatsLeft = tiers.reduce((total, tier) => total + (tier.capacity - (tier.sold || 0)), 0);
      const totalCapacity = tiers.reduce((total, tier) => total + tier.capacity, 0);

      return {
        id: event.id,
        title: event.title,
        city: event.city,
        venue: event.venue,
        date: event.date,
        startsAt: event.startsAt,
        status: event.status,
        tierCount: tiers.length,
        minPriceCents,
        cheapestPriceCents: minPriceCents,
        price: minPriceCents,
        seatsLeft: totalSeatsLeft,
        totalSeatsLeft,
        totalCapacity,
      };
    });
}

export function seatsLeft(tier) {
  return tier.capacity - (tier.sold || 0);
}

export function bookTickets(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);

  let finalUserId = userId;
  let finalQuantity = quantity;
  if (typeof userId === 'number' && quantity === undefined) {
    finalQuantity = userId;
    finalUserId = 'anonymous';
  }

  if (!Number.isInteger(finalQuantity) || finalQuantity < 1 || finalQuantity > MAX_TICKETS_PER_BOOKING) {
    throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
  }

  const left = seatsLeft(tier);
  if (left < finalQuantity) {
    const message = left === 0 ? `${tier.name} is sold out` : `Only ${left} ticket(s) left in ${tier.name}`;
    throw new DomainError('SOLD_OUT', message, { seatsLeft: left });
  }

  tier.sold += finalQuantity;

  let reference;
  do {
    reference = newReferenceCode();
  } while (store.bookingsByReference.has(reference));

  const attendee = createAttendee({
    id: finalUserId,
    name: finalUserId,
    role: 'attendee',
  });

  const booking = {
    id: newId(),
    reference,
    userId: attendee.id,
    attendee,
    tierId,
    quantity: finalQuantity,
    amountCents: (tier.priceCents ?? tier.price) * finalQuantity,
    priceCents: (tier.priceCents ?? tier.price) * finalQuantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(reference, booking);
  return booking;
}

export function findBookingByReference(store, reference) {
  return store.bookingsByReference.get(reference);
}

export function cancelBooking(store, reference) {
  const booking = findBookingByReference(store, reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (!HOLDS_SEATS.has(booking.status)) {
    throw new DomainError('INVALID_STATE', `A ${booking.status} booking cannot be cancelled`);
  }
  const tier = getTier(store, booking.tierId);
  tier.sold -= booking.quantity;
  booking.status = 'cancelled';
  return booking;
}

export function joinWaitlist(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
    throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
  }
  if (seatsLeft(tier) >= quantity) {
    throw new DomainError('NOT_SOLD_OUT', 'Seats are available, so book them instead');
  }
  const queue = store.waitlists.get(tierId);
  queue.enqueue({ userId, quantity });
  return { position: queue.size };
}

export function offerNextOnWaitlist(store, tierId) {
  const tier = getTier(store, tierId);
  const queue = store.waitlists.get(tierId);
  const head = queue.peek();
  if (!head || seatsLeft(tier) < head.quantity) return undefined;
  return queue.dequeue();
}
