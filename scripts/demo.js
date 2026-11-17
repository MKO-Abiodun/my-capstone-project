import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  joinWaitlist,
  offerNextOnWaitlist,
} from '../src/domain/inventory.js';

const store = createStore();
const event = createEvent(store, {
  title: 'Abidjan Tech Festival',
  city: 'Abidjan',
  venue: 'Civic Centre',
  date: '2026-12-20',
  organizerId: 'organizer-1',
});
const tier = addTier(store, event.id, {
  name: 'General',
  capacity: 3,
  priceCents: 5000,
});

console.log(`Created "${event.title}" with ${tier.capacity} General seats.`);

const ada = bookTickets(store, tier.id, 'ada', 2);
console.log(`Ada booked ${ada.quantity} tickets. Reference: ${ada.reference}.`);

try {
  bookTickets(store, tier.id, 'bayo', 2);
} catch (error) {
  if (error.code !== 'SOLD_OUT') throw error;
  console.log(`Bayo was refused: ${error.message}`);
}

const chidi = bookTickets(store, tier.id, 'chidi', 1);
console.log(`Chidi booked the last seat. Seats left: ${tier.capacity - tier.sold}.`);

joinWaitlist(store, tier.id, 'emeka', 1);
joinWaitlist(store, tier.id, 'funmi', 2);
console.log(`Emeka and Funmi joined the waitlist (${store.waitlists.get(tier.id).size} people).`);

const found = findBookingByReference(store, ada.reference);
console.log(`Found Ada's booking by reference: ${found.userId}, ${found.quantity} tickets.`);

cancelBooking(store, ada.reference);
console.log(`Ada cancelled; seats left: ${tier.capacity - tier.sold}.`);

const next = offerNextOnWaitlist(store, tier.id);
console.log(`Next on the waitlist: ${next.userId} (${next.quantity} ticket).`);
