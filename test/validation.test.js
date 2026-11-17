import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBookingInput,
  validateCancelInput,
  validateEventInput,
  validateEventSearchInput,
  validatePathIdentifier,
  validatePaymentInput,
  validateTierInput,
  validateUserId,
} from '../src/domain/validation.js';

function expectValidationError(fn) {
  assert.throws(fn, error => error.code === 'VALIDATION');
}

test('event and tier validators reject malformed payloads and invalid fields', () => {
  expectValidationError(() => validateEventInput([]));
  expectValidationError(() => validateEventInput({ title: 'Event', city: 'Lagos', date: '2026-02-31' }));
  expectValidationError(() => validateEventInput({
    title: 'Event',
    city: 'Lagos',
    venue: 3,
    date: '2026-12-10',
  }));
  expectValidationError(() => validateTierInput({ name: 'VIP', priceCents: 2.5, capacity: 3 }));
  expectValidationError(() => validateTierInput({ name: 'VIP', priceCents: 200, capacity: 0 }));
});

test('search validation normalizes supported query values and rejects invalid ones', () => {
  assert.deepEqual(validateEventSearchInput({
    from: '2026-12-01',
    to: '2026-12-02',
    maxPriceCents: '2500',
    onlyAvailable: 'yes',
  }), {
    q: undefined,
    city: undefined,
    from: '2026-12-01',
    to: '2026-12-02',
    maxPriceCents: 2500,
    onlyAvailable: true,
    sort: 'date',
  });

  expectValidationError(() => validateEventSearchInput({ from: '2026-02-31' }));
  expectValidationError(() => validateEventSearchInput({ maxPriceCents: '' }));
  expectValidationError(() => validateEventSearchInput({ onlyAvailable: 'sometimes' }));
  expectValidationError(() => validateEventSearchInput({ sort: 'random' }));
});

test('booking, identity, path, payment, and cancellation validators reject malformed input', () => {
  assert.deepEqual(validateBookingInput({ tierId: 'tier-1' }), {
    tierId: 'tier-1',
    quantity: 1,
  });
  expectValidationError(() => validateBookingInput({ tierId: 'tier-1', quantity: '2' }));
  expectValidationError(() => validateBookingInput({ tierId: '', quantity: 1 }));
  expectValidationError(() => validateUserId('   '));
  expectValidationError(() => validatePathIdentifier('', 'Booking reference'));
  expectValidationError(() => validatePaymentInput({ cardNumber: { number: 'nope' } }));
  expectValidationError(() => validateCancelInput([]));
});
