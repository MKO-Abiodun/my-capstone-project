import {
  addTier as addTierRule,
  createEvent as createEventRule,
  createStore,
  listEventSummaries,
  publishEvent as publishEventRule,
  unpublishEvent as unpublishEventRule,
} from '../domain/inventory.js';
import { searchEvents } from '../domain/eventSearch.js';

async function loadStore(repository, eventRecords) {
  const events = eventRecords ?? await repository.listEvents();
  const store = createStore();

  for (const event of events) {
    store.events.set(event.id, event);
  }
  for (const event of events) {
    for (const tierId of event.tierIds ?? []) {
      const tier = await repository.getTier(tierId);
      if (tier) store.tiers.set(tier.id, tier);
    }
  }

  return store;
}

export function createEventService({ repository }) {
  if (!repository) {
    throw new TypeError('An event service requires a repository');
  }

  return {
    async createEvent(input) {
      const event = createEventRule(createStore(), input);
      await repository.saveEvent(event);
      return event;
    },

    async addTier(eventId, input) {
      const event = await repository.getEvent(eventId);
      const store = await loadStore(repository, event ? [event] : []);
      const tier = addTierRule(store, eventId, input);
      await repository.saveTier(tier);
      return tier;
    },

    async publishEvent(eventId) {
      const event = await repository.getEvent(eventId);
      const store = await loadStore(repository, event ? [event] : []);
      const published = publishEventRule(store, eventId);
      const saved = await repository.updateEvent(published);
      if (!saved) throw new Error('Published event could not be persisted');
      return saved;
    },

    async unpublishEvent(eventId) {
      const event = await repository.getEvent(eventId);
      const store = await loadStore(repository, event ? [event] : []);
      const draft = unpublishEventRule(store, eventId);
      const saved = await repository.updateEvent(draft);
      if (!saved) throw new Error('Unpublished event could not be persisted');
      return saved;
    },

    async listEvents(filters = {}) {
      const { sort = 'date', ...criteria } = filters;
      const store = await loadStore(repository);
      const summaries = listEventSummaries(store, { publishedOnly: true });
      return searchEvents(summaries, criteria, sort);
    },
  };
}

export default createEventService;
