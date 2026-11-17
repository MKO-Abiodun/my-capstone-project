import { DomainError } from './errors.js';

export const USER_ROLES = Object.freeze(['organizer', 'attendee', 'admin']);

export function createUser({ id, name, role } = {}) {
  const finalId = typeof id === 'string' ? id.trim() : '';
  const finalName = typeof name === 'string' ? name.trim() : '';
  const finalRole = typeof role === 'string' ? role.trim().toLowerCase() : '';

  if (finalId === '') {
    throw new DomainError('VALIDATION', 'User id is required');
  }

  if (finalName === '') {
    throw new DomainError('VALIDATION', 'User name is required');
  }

  if (!USER_ROLES.includes(finalRole)) {
    throw new DomainError('VALIDATION', `role must be one of: ${USER_ROLES.join(', ')}`);
  }

  return {
    id: finalId,
    name: finalName,
    role: finalRole,
  };
}

export function createOrganizer(input = {}) {
  return createUser({ ...input, role: 'organizer' });
}

export function createAttendee(input = {}) {
  return createUser({ ...input, role: 'attendee' });
}

export default createUser;
