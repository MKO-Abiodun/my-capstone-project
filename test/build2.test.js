import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { mergeSort } from '../src/domain/sorting.js';
import { filterEvents, sortEvents, searchEvents } from '../src/domain/eventSearch.js';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  joinWaitlist,
  listEventSummaries,
  offerNextOnWaitlist,
  publishEvent,
  seatsLeft,
  unpublishEvent,
} from '../src/domain/inventory.js';

function makeStore() {
  return createStore();
}

// --- sorting.js ---
test('mergeSort stable and does not mutate', () => {
  const orig = [{v:1,i:0},{v:1,i:1},{v:2,i:2}];
  const copy = [...orig];
  const sorted = mergeSort(orig, (a,b) => a.v - b.v);
  assert.deepEqual(orig, copy, 'original unchanged');
  assert.equal(sorted[0].i, 0);
  assert.equal(sorted[1].i, 1);
  assert.notEqual(sorted, orig);
});

test('mergeSort empty list', () => {
  assert.deepEqual(mergeSort([], () => 0), []);
});

// --- S02 ---
test('S02 create event draft', () => {
  const store = makeStore();
  const ev = createEvent(store, {title:'Lagos Tech', city:'Lagos', venue:'Hall', date:'2026-12-01'});
  assert.equal(ev.status, 'draft');
  assert.ok(ev.id);
  const list = listEventSummaries(store, {publishedOnly:true});
  assert.equal(list.length, 0);
});

test('S02 validation', () => {
  const store = makeStore();
  assert.throws(() => createEvent(store, {title:'', city:'Lagos', venue:'H', date:'2026-12-01'}), err => err.code === 'VALIDATION');
  assert.throws(() => createEvent(store, {title:'T', city:'', venue:'H', date:'2026-12-01'}), err => err.code === 'VALIDATION');
  assert.throws(() => createEvent(store, {title:'T', city:'Lagos', venue:'H', date:'not-a-date'}), err => err.code === 'VALIDATION');
  assert.throws(() => createEvent(store, {title:'T', city:'Lagos', venue:'H', date:'2026-02-31'}), err => err.code === 'VALIDATION');
  assert.equal(store.events.size, 0);
});

// --- S03 ---
test('S03 add tier', () => {
  const store = makeStore();
  const ev = createEvent(store, {title:'T', city:'Lagos', venue:'H', date:'2026-12-01'});
  const tier = addTier(store, ev.id, {name:'General', priceCents:500000, capacity:100});
  assert.equal(tier.sold, 0);
  assert.equal(seatsLeft(tier), 100);
});

test('S03 validation price and capacity', () => {
  const store = makeStore();
  const ev = createEvent(store, {title:'T', city:'Lagos', venue:'H', date:'2026-12-01'});
  assert.throws(() => addTier(store, ev.id, {name:'G', priceCents:10.5, capacity:100}), e => e.code==='VALIDATION');
  assert.throws(() => addTier(store, ev.id, {name:'G', priceCents:100, capacity:0}), e => e.code==='VALIDATION');
});

test('S03 NOT_FOUND', () => {
  const store = makeStore();
  assert.throws(() => addTier(store, 'no-id', {name:'G', priceCents:100, capacity:10}), e => e.code==='NOT_FOUND');
});

// --- S04 publish ---
test('S04 publish needs tiers', () => {
  const store = makeStore();
  const ev = createEvent(store, {title:'T', city:'Lagos', venue:'H', date:'2026-12-01'});
  assert.throws(() => publishEvent(store, ev.id), e => e.code==='INVALID_STATE');
  addTier(store, ev.id, {name:'G', priceCents:100, capacity:10});
  const pub = publishEvent(store, ev.id);
  assert.equal(pub.status, 'published');
  assert.equal(listEventSummaries(store).length, 1);
  assert.equal(unpublishEvent(store, ev.id).status, 'draft');
  assert.equal(listEventSummaries(store).length, 0);
});

// --- S05 search/filter/sort ---
function sampleSummaries() {
  return [
    {id:'1', title:'Lagos Tech Meetup', city:'Lagos', venue:'Hall A', date:'2026-12-05T17:00:00.000Z', cheapestPriceCents:50000, totalSeatsLeft:10, totalCapacity:100},
    {id:'2', title:'Abuja Jazz Night', city:'Abuja', venue:'Jazz Hall', date:'2026-12-06T19:00:00.000Z', cheapestPriceCents:100000, totalSeatsLeft:5, totalCapacity:50},
    {id:'3', title:'Lagos Startup', city:'LAGOS', venue:'Hall B', date:'2026-12-05T10:00:00.000Z', cheapestPriceCents:20000, totalSeatsLeft:20, totalCapacity:20},
  ];
}

test('S05 search q case-insensitive', () => {
  const res = filterEvents(sampleSummaries(), {q:'JAZZ'});
  assert.equal(res.length, 1);
  assert.equal(res[0].title, 'Abuja Jazz Night');
  assert.equal(filterEvents(sampleSummaries(), {q:'jazz hall'})[0].id, '2');
});

test('S05 filter city case-insensitive', () => {
  const res = filterEvents(sampleSummaries(), {city:'lagos'});
  assert.equal(res.length, 2);
});

test('S05 maxPrice and sort by price', () => {
  const summaries = [
    ...sampleSummaries(),
    {id:'4', title:'No tier', city:'Lagos', venue:'', date:'2026-12-07', cheapestPriceCents:null, totalSeatsLeft:3},
  ];
  const res = searchEvents(summaries, {maxPriceCents:60000}, 'price');
  assert.deepEqual(res.map(event => event.id), ['3', '1']);
});

test('S05 sort by date stable title tie-breaker', () => {
  const list = [
    {id:'b', title:'B Event', city:'Lagos', venue:'', date:'2026-12-05T10:00:00.000Z', cheapestPriceCents:100, totalSeatsLeft:1},
    {id:'a', title:'A Event', city:'Lagos', venue:'', date:'2026-12-05T10:00:00.000Z', cheapestPriceCents:100, totalSeatsLeft:1},
    {id:'c', title:'C Event', city:'Lagos', venue:'', date:'2026-12-04T10:00:00.000Z', cheapestPriceCents:100, totalSeatsLeft:1},
  ];
  const sorted = sortEvents(list, 'date');
  assert.deepEqual(sorted.map(event => event.id), ['c', 'a', 'b']);
  const identicalTitles = [
    {id:'z', title:'Same', date:'2026-12-01'},
    {id:'a', title:'Same', date:'2026-12-01'},
  ];
  assert.deepEqual(sortEvents(identicalTitles, 'date').map(event => event.id), ['a', 'z']);
});

test('S05 availability sort and empty results', () => {
  assert.deepEqual(sortEvents(sampleSummaries(), 'availability').map(event => event.id), ['3', '1', '2']);
  assert.deepEqual(searchEvents([], {}, 'date'), []);
  const soldOut = {id:'4', title:'Sold Out', city:'Lagos', venue:'', date:'2026-12-07', cheapestPriceCents:100, totalSeatsLeft:0};
  assert.deepEqual(filterEvents([...sampleSummaries(), soldOut], {onlyAvailable:true}).map(event => event.id), ['1', '2', '3']);
});

test('S05 price sorting puts no-price events last and resolves ties deterministically', () => {
  const list = [
    {id:'b', title:'B event', date:'2026-12-01', cheapestPriceCents:100},
    {id:'a', title:'A event', date:'2026-12-01', cheapestPriceCents:100},
    {id:'c', title:'C event', date:'2026-12-01', cheapestPriceCents:null},
  ];
  assert.deepEqual(sortEvents(list, 'price').map(event => event.id), ['a', 'b', 'c']);
});

test('S05 date to inclusive', () => {
  const res = filterEvents(sampleSummaries(), {to:'2026-12-05'});
  assert.equal(res.length, 2); // both on Dec 5 at 5pm and 10am included
  assert.equal(filterEvents(sampleSummaries(), {from:'2026-12-06'}).length, 1);
});

test('S05 validation bad date and bad sort', () => {
  assert.throws(() => filterEvents(sampleSummaries(), {from:'bad-date'}), e => e.code==='VALIDATION');
  assert.throws(() => filterEvents(sampleSummaries(), {from:'2026-02-31'}), e => e.code==='VALIDATION');
  assert.throws(() => filterEvents(sampleSummaries(), {maxPriceCents:10.5}), e => e.code==='VALIDATION');
  assert.throws(() => filterEvents(sampleSummaries(), {maxPriceCents:-1}), e => e.code==='VALIDATION');
  assert.throws(() => sortEvents(sampleSummaries(), 'unknown'), e => e.code==='VALIDATION');
});

test('S05 original list unchanged', () => {
  const orig = sampleSummaries();
  const copy = JSON.parse(JSON.stringify(orig));
  filterEvents(orig, {city:'Lagos'});
  sortEvents(orig, 'price');
  assert.deepEqual(orig, copy);
});

test('S06 booking creates a pending booking, calculates cents, and reserves seats', () => {
  const store = makeStore();
  const event = createEvent(store, {title:'T', city:'Lagos', date:'2026-12-01'});
  const tier = addTier(store, event.id, {name:'General', priceCents:5000, capacity:3});
  publishEvent(store, event.id);

  const booking = bookTickets(store, tier.id, 'attendee-1', 2);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.amountCents, 10000);
  assert.equal(seatsLeft(tier), 1);
});

test('S06 sold-out booking fails without changing inventory or bookings', () => {
  const store = makeStore();
  const event = createEvent(store, {title:'T', city:'Lagos', date:'2026-12-01'});
  const tier = addTier(store, event.id, {name:'General', priceCents:5000, capacity:3});
  bookTickets(store, tier.id, 'attendee-1', 2);

  assert.throws(
    () => bookTickets(store, tier.id, 'attendee-2', 2),
    error => error.code === 'SOLD_OUT'
  );
  assert.equal(tier.sold, 2);
  assert.equal(store.bookings.size, 1);
});

test('S06 rejects every invalid quantity', () => {
  const store = makeStore();
  const event = createEvent(store, {title:'T', city:'Lagos', date:'2026-12-01'});
  const tier = addTier(store, event.id, {name:'General', priceCents:5000, capacity:20});

  for (const quantity of [0, -1, 1.5, 11]) {
    assert.throws(
      () => bookTickets(store, tier.id, 'attendee-1', quantity),
      error => error.code === 'VALIDATION'
    );
  }
  assert.equal(tier.sold, 0);
  assert.equal(store.bookings.size, 0);
});
