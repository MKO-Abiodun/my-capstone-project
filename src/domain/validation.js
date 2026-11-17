import { DomainError } from './errors.js';
import { parseIsoDate } from './dates.js';

const SORT_OPTIONS = new Set(['date', 'price', 'availability']);
const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'y']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no', 'n']);

function requireObject(value, label, { allowMissing = false } = {}) {
  if (allowMissing && (value === undefined || value === null)) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} is required`);
  }
  return value.trim();
}

function optionalText(value, label) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new DomainError('VALIDATION', `${label} must be a string`);
  }
}

export function validatePathIdentifier(value, label = 'id') {
  return requireText(value, label);
}

export function validateUserId(value) {
  return requireText(value, 'x-user-id header');
}

export function validateEventInput(input) {
  const value = requireObject(input, 'Event', { allowMissing: true });
  requireText(value.title, 'Title');
  requireText(value.city, 'City');
  optionalText(value.venue, 'Venue');

  if (value.organizerId !== undefined && value.organizerId !== null) {
    requireText(value.organizerId, 'Organizer id');
  }

  const startsAt = value.startsAt ?? value.date;
  parseIsoDate(startsAt, 'startsAt');
  return value;
}

export function validateTierInput(input) {
  const value = requireObject(input, 'Ticket tier', { allowMissing: true });
  optionalText(value.name, 'Tier name');

  const priceCents = value.priceCents ?? value.price;
  const capacity = value.capacity ?? value.cap;
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new DomainError('VALIDATION', 'priceCents must be a whole number of at least 0');
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new DomainError('VALIDATION', 'capacity must be a whole number of at least 1');
  }
  return value;
}

function parseBoolean(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'boolean') {
    throw new DomainError('VALIDATION', `${label} must be a boolean`);
  }
  const normalised = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE.has(normalised)) return true;
  if (BOOLEAN_FALSE.has(normalised)) return false;
  throw new DomainError('VALIDATION', `${label} must be a boolean`);
}

export function validateEventSearchInput(input) {
  const value = requireObject(input, 'Search filters');
  for (const field of ['q', 'city', 'from', 'to', 'sort']) {
    optionalText(value[field], field);
  }

  if (value.from) parseIsoDate(value.from, 'from');
  if (value.to) parseIsoDate(value.to, 'to', { endOfDay: true });

  let maxPriceCents = value.maxPriceCents;
  if (maxPriceCents !== undefined && maxPriceCents !== null) {
    if (typeof maxPriceCents === 'string' && maxPriceCents.trim() !== '') {
      maxPriceCents = Number(maxPriceCents);
    }
    if (!Number.isInteger(maxPriceCents) || maxPriceCents < 0) {
      throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number of cents');
    }
  }

  const sort = value.sort ?? 'date';
  if (!SORT_OPTIONS.has(sort)) {
    throw new DomainError('VALIDATION', `sort must be one of: ${[...SORT_OPTIONS].join(', ')}`);
  }

  return {
    q: value.q,
    city: value.city,
    from: value.from,
    to: value.to,
    maxPriceCents,
    onlyAvailable: parseBoolean(value.onlyAvailable, 'onlyAvailable'),
    sort,
  };
}

export function validateBookingInput(input) {
  const value = requireObject(input, 'Booking', { allowMissing: true });
  const tierId = validatePathIdentifier(value.tierId, 'tierId');
  const quantity = value.quantity === undefined ? 1 : value.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be between 1 and 10');
  }
  return { tierId, quantity };
}

export function validatePaymentInput(input) {
  const value = requireObject(input, 'Payment', { allowMissing: true });
  for (const field of ['cardNumber', 'card', 'paymentMethod']) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') {
      throw new DomainError('VALIDATION', `${field} must be a string`);
    }
  }
  return value;
}

export function validateCancelInput(input) {
  return requireObject(input, 'Cancellation', { allowMissing: true });
}
