import { DomainError } from './errors.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

export function parseIsoDate(value, field, { endOfDay = false } = {}) {
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const dateOnly = value.length === 10;
  return endOfDay && dateOnly ? timestamp + 24 * 60 * 60 * 1000 - 1 : timestamp;
}
