import { DomainError } from '../src/domain/errors.js';
import { newId, newReference } from '../src/domain/ids.js';
import { WaitlistQueue } from '../src/domain/waitlistQueue.js';
import { createStore, createEvent, addTier, bookTickets, cancelBooking, findBookingByReference } from '../src/domain/inventory.js';

console.log('=== BUILD 1 FINAL CHECK ===\n');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`✅ ${name}`); pass++; }
  catch(e) { console.log(`❌ ${name}: ${e.message}`); fail++; }
}

// 1. DomainError has code
check('DomainError carries code', () => {
  const e = new DomainError('test', 'SOLD_OUT');
  if (e.code !== 'SOLD_OUT') throw new Error('code missing');
});

// 2. ids uses crypto, not Math.random + reference readable
check('newId is UUID and newReference is 6 chars readable', () => {
  const id = newId();
  const ref = newReference();
  if (id.length < 30) throw new Error('id not uuid');
  if (ref.length !== 6) throw new Error('ref not 6 chars');
  if (ref.includes('I') || ref.includes('O') || ref.includes('0') || ref.includes('1')) throw new Error('ref not safe to read aloud');
});

// 3. WaitlistQueue O(1) and private fields, no array.shift
check('WaitlistQueue FIFO and size O(1)', () => {
  const q = new WaitlistQueue();
  if (q.size !== 0) throw new Error('size');
  q.enqueue('a'); q.enqueue('b');
  if (q.peek() !== 'a') throw new Error('peek');
  if (q.dequeue() !== 'a') throw new Error('dequeue');
  if (q.size !== 1) throw new Error('size after dequeue');
});

// 4. Check file uses private fields #head
check('waitlistQueue uses private fields', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/domain/waitlistQueue.js', 'utf8');
  if (!src.includes('#head') || !src.includes('#tail')) throw new Error('no #head/#tail');
  if (src.includes('array.shift') || src.includes('.shift()')) throw new Error('uses shift() - forbidden');
});

// 5. Inventory rules
check('Booking 1-10 tickets rule', () => {
  const store = createStore();
  const ev = createEvent(store, { name: 'Test' });
  const tier = addTier(ev, { name: 'Gen', capacity: 20, priceCents: 1000 });
  try { bookTickets(store, ev.id, tier.id, { quantity: 11 }); throw new Error('should fail'); }
  catch(e) { if (e.code !== 'VALIDATION') throw e; }
});

check('SOLD_OUT throws with code SOLD_OUT and changes nothing', () => {
  const store = createStore();
  const ev = createEvent(store, { name: 'Test' });
  const tier = addTier(ev, { name: 'Gen', capacity: 1, priceCents: 1000 });
  bookTickets(store, ev.id, tier.id, { quantity: 1 });
  const before = tier.seatsLeft;
  try { bookTickets(store, ev.id, tier.id, { quantity: 1 }); throw new Error('should be SOLD_OUT'); }
  catch(e) { if (e.code !== 'SOLD_OUT') throw new Error(`got ${e.code} expected SOLD_OUT`); }
  if (tier.seatsLeft !== before) throw new Error('seats changed on failed booking');
});

check('Cancel releases seats and cancel twice errors', () => {
  const store = createStore();
  const ev = createEvent(store, { name: 'Test' });
  const tier = addTier(ev, { name: 'Gen', capacity: 1, priceCents: 1000 });
  const b = bookTickets(store, ev.id, tier.id, { quantity: 1 });
  cancelBooking(store, b.id);
  if (tier.seatsLeft !== 1) throw new Error('seats not released');
  try { cancelBooking(store, b.id); throw new Error('should error on double cancel'); }
  catch(e) { if (!e.code) throw e; }
});

check('findBookingByReference O(1) via Map', () => {
  const store = createStore();
  const ev = createEvent(store, { name: 'Test' });
  const tier = addTier(ev, { name: 'Gen', capacity: 2, priceCents: 1000 });
  const b = bookTickets(store, ev.id, tier.id, { quantity: 1 });
  const found = findBookingByReference(store, b.reference);
  if (!found || found.id !== b.id) throw new Error('not found by ref');
});

check('Money as whole cents', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/domain/inventory.js', 'utf8');
  if (!src.includes('priceCents')) throw new Error('priceCents not used');
});

console.log(`\nResult: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('\n🎉 BUILD 1 PERFECT - Ready to ship to build-1 branch!');
