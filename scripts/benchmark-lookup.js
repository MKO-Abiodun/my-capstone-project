import { newId, newReferenceCode } from '../src/domain/ids.js';

const BOOKINGS = 100000;
const LOOKUPS = 500;

const bookingsArray = [];
const bookingsMap = new Map();

for (let i = 0; i < BOOKINGS; i++) {
    const booking = { id: newId(), reference: newReferenceCode() };
    bookingsArray.push(booking);
    bookingsMap.set(booking.reference, booking);
}

const targets = bookingsArray.slice(0, LOOKUPS).map((booking) => booking.reference);

const arrayStart = performance.now();
for (const ref of targets) {
    bookingsArray.find((booking) => booking.reference === ref);
}
const arrayEnd = performance.now();

const mapStart = performance.now();
for (const ref of targets) {
    bookingsMap.get(ref);
}
const mapEnd = performance.now();

console.log(`Array.find: ${(arrayEnd - arrayStart).toFixed(2)} ms for ${LOOKUPS} lookups in ${BOOKINGS}`);
console.log(`Map.get: ${(mapEnd - mapStart).toFixed(2)} ms for ${LOOKUPS} lookups in ${BOOKINGS}`);
console.log(`Map.get is ${((arrayEnd - arrayStart) / (mapEnd - mapStart || 1)).toFixed(1)}x faster`);