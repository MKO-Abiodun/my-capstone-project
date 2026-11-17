import { searchEvents } from '../domain/eventSearch.js';

export function createEventService({ repository }) {
  if (!repository) {
    throw new TypeError('An event service requires a repository');
  }

  return {
    async createEvent(input) {
      return repository.createEvent(input);
    },

    async addTier(eventId, input) {
      return repository.addTier(eventId, input);
    },

    async publishEvent(eventId) {
      return repository.publishEvent(eventId);
    },

    async unpublishEvent(eventId) {
      return repository.unpublishEvent(eventId);
    },

    async listEvents(filters = {}) {
      const { sort = 'date', ...criteria } = filters;
      const summaries = await repository.listEvents({ publishedOnly: true });
      return searchEvents(summaries, criteria, sort);
    },
  };
}

export default createEventService;
