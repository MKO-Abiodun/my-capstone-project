import { test } from 'node:test';
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
import { newReference } from '../src/domain/ids.js';
import { Queue } from '../src/domain/waitlistQueue.js';

test('booking references are short and readable', () => {
  assert.match(newReference(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('linked-list waitlist queue is FIFO and works after becoming empty', () => {
  const queue = new Queue();
  assert.equal(queue.size, 0);
  assert.equal(queue.peek(), null);
  assert.equal(queue.dequeue(), null);

  queue.enqueue('first');
  queue.enqueue('second');
  assert.equal(queue.size, 2);
  assert.equal(queue.peek(), 'first');
  assert.equal(queue.dequeue(), 'first');
  assert.equal(queue.dequeue(), 'second');
  assert.equal(queue.size, 0);

  queue.enqueue('third');
  assert.equal(queue.dequeue(), 'third');
  assert.equal(queue.size, 0);
});

test('inventory prices tickets, refuses overselling without mutation, and finds by reference', () => {
  const store = createStore();
  const event = createEvent(store, {
    title: 'Abidjan Tech Festival',
    city: 'Abidjan',
    date: '2026-12-20',
  });
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 5000,
    capacity: 3,
  });

  const ada = bookTickets(store, tier.id, 'ada', 2);
  assert.equal(ada.status, 'pending');
  assert.equal(ada.amountCents, 10000);
  assert.equal(seatsLeft(tier), 1);
  assert.equal(findBookingByReference(store, ada.reference), ada);

  assert.throws(
    () => bookTickets(store, tier.id, 'bayo', 2),
    error => error.code === 'SOLD_OUT'
  );
  assert.equal(tier.sold, 2);
  assert.equal(store.bookings.size, 1);

  bookTickets(store, tier.id, 'chidi', 1);
  assert.equal(seatsLeft(tier), 0);
});

test('inventory cancellation releases seats once and serves the waitlist in order', () => {
  const store = createStore();
  const event = createEvent(store, {
    title: 'Community Concert',
    city: 'Lagos',
    date: '2026-12-20',
  });
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 2500,
    capacity: 2,
  });
  const booking = bookTickets(store, tier.id, 'attendee-1', 2);

  assert.equal(joinWaitlist(store, tier.id, 'attendee-2', 1).position, 1);
  assert.equal(joinWaitlist(store, tier.id, 'attendee-3', 1).position, 2);

  cancelBooking(store, booking.reference);
  assert.equal(seatsLeft(tier), 2);
  assert.deepEqual(offerNextOnWaitlist(store, tier.id), {
    userId: 'attendee-2',
    quantity: 1,
  });
  assert.equal(store.waitlists.get(tier.id).size, 1);

  assert.throws(
    () => cancelBooking(store, booking.reference),
    error => error.code === 'INVALID_STATE'
  );
  assert.equal(seatsLeft(tier), 2);
});
