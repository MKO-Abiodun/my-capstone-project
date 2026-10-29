import { DomainError } from './errors.js';

function isValidDateString(str) {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map()
  };
}

export function createEvent(store, { title, city, venue, date }) {
  if (!title || !title.trim() || !city || !city.trim() || !isValidDateString(date)) {
    throw new DomainError('Invalid event data', 'VALIDATION');
  }
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const event = {
    id,
    title: title.trim(),
    city: city.trim(),
    venue: venue ? venue.trim() : '',
    date: new Date(date).toISOString(),
    status: 'draft',
    tierIds: []
  };
  store.events.set(id, event);
  return event;
}

export function addTier(store, eventId, { name, priceCents, capacity, price, capacity: cap }) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('Event not found', 'NOT_FOUND');
  
  const finalPrice = priceCents ?? price;
  const finalCap = capacity ?? cap;

  if (!Number.isInteger(finalPrice) || finalPrice < 0) {
    throw new DomainError('Invalid price', 'VALIDATION');
  }
  if (!Number.isInteger(finalCap) || finalCap < 1) {
    throw new DomainError('Invalid capacity', 'VALIDATION');
  }
  const tierId = `tier_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const tier = { 
    id: tierId, 
    eventId, 
    name: name || 'General', 
    priceCents: finalPrice, 
    price: finalPrice,
    capacity: finalCap, 
    sold: 0 
  };
  store.tiers.set(tierId, tier);
  event.tierIds.push(tierId);
  return tier;
}

export function publishEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('Event not found', 'NOT_FOUND');
  if (!event.tierIds || event.tierIds.length === 0) {
    throw new DomainError('Event has no tiers', 'INVALID_STATE');
  }
  event.status = 'published';
  return event;
}

export function unpublishEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('Event not found', 'NOT_FOUND');
  event.status = 'draft';
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  const summaries = [];
  for (const event of store.events.values()) {
    if (publishedOnly && event.status !== 'published') continue;
    let cheapest = null;
    let totalLeft = 0;
    let totalCap = 0;
    for (const tid of event.tierIds || []) {
      const tier = store.tiers.get(tid);
      if (!tier) continue;
      const price = tier.priceCents ?? tier.price;
      if (cheapest === null || price < cheapest) cheapest = price;
      totalLeft += (tier.capacity - (tier.sold || 0));
      totalCap += tier.capacity;
    }
    summaries.push({
      id: event.id,
      title: event.title,
      city: event.city,
      venue: event.venue,
      date: event.date,
      status: event.status,
      cheapestPriceCents: cheapest,
      price: cheapest,
      totalSeatsLeft: totalLeft,
      totalCapacity: totalCap
    });
  }
  return summaries;
}

// --- Build 1 booking logic (keep for S06) ---
export function bookTickets(store, tierId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10) {
    throw new DomainError('Invalid quantity', 'VALIDATION');
  }
  const tier = store.tiers.get(tierId);
  if (!tier) throw new DomainError('Tier not found', 'NOT_FOUND');
  const left = tier.capacity - tier.sold;
  if (quantity > left) {
    throw new DomainError('Sold out', 'SOLD_OUT');
  }
  tier.sold += quantity;
  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const booking = {
    id: bookingId,
    tierId,
    quantity,
    priceCents: tier.priceCents ?? tier.price,
    status: 'pending'
  };
  store.bookings.set(bookingId, booking);
  return booking;
}
