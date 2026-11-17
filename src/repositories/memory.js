import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  listEventSummaries,
  publishEvent,
  unpublishEvent,
} from '../domain/inventory.js';

export function createMemoryRepository(initialStore = createStore()) {
  const store = initialStore;

  return {
    async createEvent(input) {
      return createEvent(store, input);
    },

    async addTier(eventId, input) {
      return addTier(store, eventId, input);
    },

    async publishEvent(eventId) {
      return publishEvent(store, eventId);
    },

    async unpublishEvent(eventId) {
      return unpublishEvent(store, eventId);
    },

    async listEvents({ publishedOnly = true } = {}) {
      return listEventSummaries(store, { publishedOnly });
    },

    async getEvent(eventId) {
      return store.events.get(eventId);
    },

    async getTier(tierId) {
      return store.tiers.get(tierId);
    },

    async bookTickets(tierId, userId, quantity) {
      return bookTickets(store, tierId, userId, quantity);
    },

    async getBookingByReference(reference) {
      return findBookingByReference(store, reference);
    },

    async cancelBooking(reference) {
      return cancelBooking(store, reference);
    },
  };
}

export const memoryRepository = createMemoryRepository();
export default memoryRepository;
