function createMemoryStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
  };
}

export function createMemoryRepository(initialStore = createMemoryStore()) {
  const store = initialStore;
  store.events ??= new Map();
  store.tiers ??= new Map();
  store.bookings ??= new Map();
  store.bookingsByReference ??= new Map();

  return {
    async saveEvent(event) {
      store.events.set(event.id, event);
      return event;
    },

    async updateEvent(event) {
      if (!store.events.has(event.id)) return undefined;
      store.events.set(event.id, event);
      return event;
    },

    async listEvents() {
      return [...store.events.values()];
    },

    async getEvent(eventId) {
      return store.events.get(eventId);
    },

    async saveTier(tier) {
      store.tiers.set(tier.id, tier);
      const event = store.events.get(tier.eventId);
      if (event) {
        event.tierIds ??= [];
        if (!event.tierIds.includes(tier.id)) event.tierIds.push(tier.id);
      }
      return tier;
    },

    async getTier(tierId) {
      return store.tiers.get(tierId);
    },

    async createBookingWithReservation(booking) {
      const tier = store.tiers.get(booking.tierId);
      if (!tier || tier.capacity - tier.sold < booking.quantity) return false;
      tier.sold += booking.quantity;
      store.bookings.set(booking.id, booking);
      store.bookingsByReference.set(booking.reference, booking);
      return true;
    },

    async getBookingByReference(reference) {
      return store.bookingsByReference.get(reference);
    },

    async markBookingPaid(reference) {
      const booking = store.bookingsByReference.get(reference);
      if (!booking || booking.status !== 'pending') return undefined;
      booking.status = 'paid';
      return booking;
    },

    async cancelBooking(reference, expectedStatus) {
      const booking = store.bookingsByReference.get(reference);
      if (!booking || booking.status !== expectedStatus) return undefined;
      const tier = store.tiers.get(booking.tierId);
      if (!tier || tier.sold < booking.quantity) return undefined;
      tier.sold -= booking.quantity;
      booking.status = 'cancelled';
      return booking;
    },
  };
}

export const memoryRepository = createMemoryRepository();
export default memoryRepository;
