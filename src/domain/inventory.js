import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { WaitlistQueue } from './waitlistQueue.js';

export function createStore() {
  return {
    events: new Map(),
    bookings: new Map(),
    bookingsByRef: new Map(),
  };
}

export function createEvent(store, { name, totalSeats } = {}) {
  if (!name) throw new DomainError('VALIDATION', 'Event name required');
  const event = {
    id: newId(),
    name,
    totalSeats: totalSeats ?? 100,
    tiers: [],
    waitlist: new WaitlistQueue(),
  };
  store.events.set(event.id, event);
  return event;
}

export function addTier(event, { name, capacity, priceCents, price } = {}) {
  const finalPriceCents = priceCents ?? price;
  if (!name) throw new DomainError('VALIDATION', 'Tier name required');
  if (capacity == null || capacity <= 0) throw new DomainError('VALIDATION', 'Invalid capacity');
  if (finalPriceCents == null) throw new DomainError('VALIDATION', 'priceCents required');
  const tier = {
    id: newId(),
    name,
    capacity,
    priceCents: finalPriceCents,
    sold: 0,
    get seatsLeft() {
      return this.capacity - this.sold;
    }
  };
  event.tiers.push(tier);
  return tier;
}

function getQty(qtyOrObj) {
  if (typeof qtyOrObj === 'object' && qtyOrObj !== null) {
    return qtyOrObj.quantity ?? qtyOrObj.qty ?? qtyOrObj.count;
  }
  return qtyOrObj;
}

export function bookTickets(store, eventId, tierId, qtyOrObj) {
  const qty = getQty(qtyOrObj);
  if (qty == null || qty < 1 || qty > 10) {
    throw new DomainError('VALIDATION', 'Must book 1-10 tickets');
  }
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('EVENT_NOT_FOUND', 'Event not found');
  const tier = event.tiers.find(t => t.id === tierId);
  if (!tier) throw new DomainError('TIER_NOT_FOUND', 'Tier not found');
  if (tier.sold + qty > tier.capacity) {
    throw new DomainError('SOLD_OUT', 'Sold out');
  }
  tier.sold += qty;
  const booking = {
    id: newId(),
    reference: newReference(),
    eventId,
    tierId,
    quantity: qty,
    qty,
    status: 'CONFIRMED',
  };
  store.bookings.set(booking.id, booking);
  store.bookingsByRef.set(booking.reference, booking);
  return booking;
}

export function cancelBooking(store, bookingId) {
  const booking = store.bookings.get(bookingId);
  if (!booking) throw new DomainError('BOOKING_NOT_FOUND', 'Booking not found');
  if (booking.status === 'CANCELLED') {
    throw new DomainError('ALREADY_CANCELLED', 'Already cancelled');
  }
  const event = store.events.get(booking.eventId);
  const tier = event.tiers.find(t => t.id === booking.tierId);
  tier.sold -= (booking.quantity ?? booking.qty);
  booking.status = 'CANCELLED';
  return booking;
}

export function findBookingByReference(store, reference) {
  return store.bookingsByRef.get(reference) || null;
}

export function joinWaitlist(store, eventId, entry = {}) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('EVENT_NOT_FOUND', 'Event not found');
  const waitlistEntry = {
    id: newId(),
    eventId,
    createdAt: Date.now(),
    ...entry
  };
  event.waitlist.enqueue(waitlistEntry);
  return waitlistEntry;
}
