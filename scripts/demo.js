import { createStore, createEvent, addTier, bookTickets, cancelBooking, findBookingByReference, joinWaitlist } from '../src/domain/inventory.js';

const store = createStore();
const event = createEvent(store, { name: 'Abidjan Tech Festival', date: '2026-12-20' });
const tier = addTier(event, { name: 'General', capacity: 3, priceCents: 5000 });

console.log(`Event ${event.name} created with ${tier.capacity} seats\n`);

const ada = bookTickets(store, event.id, tier.id, { quantity: 2, attendeeName: 'Ada' });
console.log(`Ada booked ${ada.quantity} seats. Reference: ${ada.reference}. Seats left: ${tier.seatsLeft}`);

try {
    bookTickets(store, event.id, tier.id, { quantity: 2, attendeeName: 'Bayo' });
} catch (err) {
    console.log(`Bayo refused for asking for 2 when only 1 is left (${err.code})`);
}

const chidi = bookTickets(store, event.id, tier.id, { quantity: 1, attendeeName: 'Chidi' });
console.log(`Chidi booked last seat. Event sold out. Seats left: ${tier.seatsLeft}`);

const w1 = joinWaitlist(store, event.id, { attendeeName: 'Emeka', quantity: 1 });
const w2 = joinWaitlist(store, event.id, { attendeeName: 'Funmi', quantity: 2 });
console.log(`Two people joined the waitlist. ${w1.attendeeName}, ${w2.attendeeName}. Size: ${event.waitlist.size()}`);

const found = findBookingByReference(store, ada.reference);
console.log(`\nBooking found by reference ${ada.reference}: ${found.attendeeName} - ${found.quantity} tickets`);

const canceled = cancelBooking(store, ada.id);
console.log(`\nAda's cancellation freeing ${canceled.quantity} seat. Seats now: ${tier.seatsLeft}`);

console.log(`Waitlist shows who is next: ${event.waitlist.peek().attendeeName} is next`);