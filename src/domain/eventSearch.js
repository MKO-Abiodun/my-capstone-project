import { mergeSort } from './sorting.js';
import { DomainError } from './errors.js';
import { parseIsoDate } from './dates.js';

function getStartsAt(event) {
  return event.startsAt ?? event.date ?? null;
}

function getMinPriceCents(event) {
  return event.minPriceCents ?? event.cheapestPriceCents ?? event.price ?? event.priceCents ?? null;
}

function getSeatsLeft(event) {
  return event.seatsLeft ?? event.totalSeatsLeft ?? 0;
}

export function filterEvents(summaries, { q, city, from, to, maxPriceCents, onlyAvailable } = {}) {
  const text = q?.trim().toLowerCase();
  const wantedCity = city?.trim().toLowerCase();
  const fromTime = from ? parseIsoDate(from, 'from') : undefined;
  const toTime = to ? parseIsoDate(to, 'to', { endOfDay: true }) : undefined;

  if (maxPriceCents !== undefined && (!Number.isInteger(maxPriceCents) || maxPriceCents < 0)) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number of cents');
  }

  return summaries.filter((event) => {
    if (text && !`${event.title} ${event.venue || ''}`.toLowerCase().includes(text)) return false;
    if (wantedCity && (event.city || '').toLowerCase() !== wantedCity) return false;

    const startsAt = new Date(getStartsAt(event)).getTime();
    if (fromTime !== undefined && startsAt < fromTime) return false;
    if (toTime !== undefined && startsAt > toTime) return false;

    const minPriceCents = getMinPriceCents(event);
    if (maxPriceCents !== undefined && (minPriceCents === null || minPriceCents > maxPriceCents)) return false;
    if (onlyAvailable && getSeatsLeft(event) <= 0) return false;
    return true;
  });
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byTitleThenId = (a, b) => compareText((a.title || '').toLowerCase(), (b.title || '').toLowerCase()) || compareText(a.id, b.id);

const SORTERS = {
  date: (a, b) => compareText(getStartsAt(a), getStartsAt(b)) || byTitleThenId(a, b),
  price: (a, b) => {
    const priceA = getMinPriceCents(a) ?? Infinity;
    const priceB = getMinPriceCents(b) ?? Infinity;
    return (priceA === priceB ? 0 : priceA < priceB ? -1 : 1) || byTitleThenId(a, b);
  },
  availability: (a, b) => getSeatsLeft(b) - getSeatsLeft(a) || byTitleThenId(a, b),
};

export const SORT_OPTIONS = Object.keys(SORTERS);

export function sortEvents(summaries, sortBy = 'date') {
  if (!Object.hasOwn(SORTERS, sortBy)) {
    throw new DomainError('VALIDATION', `sort must be one of: ${SORT_OPTIONS.join(', ')}`);
  }
  return mergeSort(summaries, SORTERS[sortBy]);
}

export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
