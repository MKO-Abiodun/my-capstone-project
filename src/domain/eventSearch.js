import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function parseDateInclusive(str, isEnd) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) throw new DomainError('Invalid date', 'VALIDATION');
  if (isEnd && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    // date-only 'to' includes whole day
    d.setUTCHours(23,59,59,999);
  }
  return d;
}

export function filterEvents(summaries, { q, city, from, to, maxPriceCents, onlyAvailable } = {}) {
  if (maxPriceCents !== undefined && !Number.isInteger(maxPriceCents)) {
    throw new DomainError('Invalid price', 'VALIDATION');
  }
  // validate dates early
  if (from) parseDateInclusive(from, false);
  if (to) parseDateInclusive(to, true);

  const fromDate = from ? parseDateInclusive(from, false) : null;
  const toDate = to ? parseDateInclusive(to, true) : null;

  const qLower = q ? q.toLowerCase().trim() : null;
  const cityLower = city ? city.toLowerCase().trim() : null;

  const filtered = summaries.filter(ev => {
    if (qLower) {
      const inTitle = ev.title.toLowerCase().includes(qLower);
      const inVenue = (ev.venue || '').toLowerCase().includes(qLower);
      if (!inTitle && !inVenue) return false;
    }
    if (cityLower && ev.city.toLowerCase() !== cityLower) return false;
    if (fromDate && new Date(ev.date) < fromDate) return false;
    if (toDate && new Date(ev.date) > toDate) return false;
    if (maxPriceCents !== undefined) {
      if (ev.cheapestPriceCents == null) return false;
      if (ev.cheapestPriceCents > maxPriceCents) return false;
    }
    if (onlyAvailable && ev.totalSeatsLeft <= 0) return false;
    return true;
  });

  return [...filtered]; // new array, never modify original
}

export function sortEvents(summaries, sortBy) {
  if (!['date','price','availability'].includes(sortBy)) {
    throw new DomainError('Invalid sort', 'VALIDATION');
  }

  const compare = (a,b) => {
    let primary = 0;
    if (sortBy === 'date') {
      primary = new Date(a.date) - new Date(b.date);
    } else if (sortBy === 'price') {
      const pa = a.cheapestPriceCents == null ? Infinity : a.cheapestPriceCents;
      const pb = b.cheapestPriceCents == null ? Infinity : b.cheapestPriceCents;
      primary = pa - pb;
    } else if (sortBy === 'availability') {
      primary = b.totalSeatsLeft - a.totalSeatsLeft; // most first
    }
    if (primary !== 0) return primary;
    // tie breakers: title, then id
    const t = a.title.localeCompare(b.title);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  };

  // use our own mergeSort - must not mutate original
  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria, sortBy) {
  const filtered = filterEvents(summaries, criteria);
  if (!sortBy) return filtered;
  return sortEvents(filtered, sortBy);
}
