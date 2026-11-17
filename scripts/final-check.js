import assert from 'node:assert/strict';
import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  joinWaitlist,
  offerNextOnWaitlist,
  seatsLeft,
} from '../src/domain/inventory.js';
import { newId, newReference } from '../src/domain/ids.js';
import { Queue } from '../src/domain/waitlistQueue.js';

assert.match(newId(), /^[0-9a-f-]{36}$/i);
assert.match(newReference(), /^[A-HJ-NP-Z2-9]{6}$/);

const queue = new Queue();
queue.enqueue('first');
queue.enqueue('second');
assert.equal(queue.size, 2);
assert.equal(queue.peek(), 'first');
assert.equal(queue.dequeue(), 'first');
assert.equal(queue.dequeue(), 'second');
assert.equal(queue.size, 0);

const store = createStore();
const event = createEvent(store, {
  title: 'Build 1 Check',
  city: 'Lagos',
  date: '2026-12-20',
});
const tier = addTier(store, event.id, {
  name: 'General',
  priceCents: 1000,
  capacity: 3,
});
const booking = bookTickets(store, tier.id, 'attendee-1', 2);
assert.equal(booking.amountCents, 2000);
assert.equal(seatsLeft(tier), 1);
assert.equal(findBookingByReference(store, booking.reference), booking);
assert.throws(
  () => bookTickets(store, tier.id, 'attendee-2', 2),
  error => error.code === 'SOLD_OUT'
);
assert.equal(tier.sold, 2);
bookTickets(store, tier.id, 'attendee-2', 1);
assert.equal(seatsLeft(tier), 0);

joinWaitlist(store, tier.id, 'attendee-3', 1);
joinWaitlist(store, tier.id, 'attendee-4', 1);
cancelBooking(store, booking.reference);
assert.equal(seatsLeft(tier), 2);
assert.equal(offerNextOnWaitlist(store, tier.id).userId, 'attendee-3');
assert.throws(
  () => cancelBooking(store, booking.reference),
  error => error.code === 'INVALID_STATE'
);

console.log('Build 1 domain checks passed.');
