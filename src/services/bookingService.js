import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import {
  bookTickets as bookTicketsRule,
  cancelBooking as cancelBookingRule,
  createStore,
} from '../domain/inventory.js';

export function createBookingService({ repository, paymentGateway }) {
  if (!repository) {
    throw new TypeError('A booking service requires a repository');
  }
  if (!paymentGateway) {
    throw new TypeError('A booking service requires a payment gateway');
  }

  return {
    async bookTickets({ tierId, userId, quantity }) {
      const tier = await repository.getTier(tierId);
      const store = createStore();
      if (tier) store.tiers.set(tierId, { ...tier });
      const booking = bookTicketsRule(store, tierId, userId, quantity);
      const reserved = await repository.createBookingWithReservation(booking);
      if (!reserved) {
        const currentTier = await repository.getTier(tierId);
        const seatsLeft = currentTier ? currentTier.capacity - currentTier.sold : 0;
        const message = seatsLeft === 0
          ? `${tier.name} is sold out`
          : `Only ${seatsLeft} ticket(s) left in ${tier.name}`;
        throw new DomainError('SOLD_OUT', message, { seatsLeft });
      }
      return booking;
    },

    async payBooking(reference, { userId, shouldDecline = false } = {}) {
      const booking = await repository.getBookingByReference(reference);
      if (!booking) {
        throw new DomainError('NOT_FOUND', 'Booking not found');
      }
      if (booking.userId !== userId) {
        throw new DomainError('FORBIDDEN', 'You can only pay your own booking');
      }
      assertTransition(booking.status, 'paid');
      const charge = await paymentGateway.charge({
        amountCents: booking.amountCents,
        shouldDecline,
      });
      if (!charge?.ok) {
        throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
      }
      const paidBooking = await repository.markBookingPaid(reference);
      if (!paidBooking) {
        throw new DomainError('INVALID_TRANSITION', 'Booking status changed before payment');
      }
      return paidBooking;
    },

    async cancelBooking(reference, { userId } = {}) {
      const booking = await repository.getBookingByReference(reference);
      if (!booking) {
        throw new DomainError('NOT_FOUND', 'Booking not found');
      }
      if (booking.userId !== userId) {
        throw new DomainError('FORBIDDEN', 'You can only cancel your own booking');
      }
      if (booking.status !== 'pending') {
        throw new DomainError('INVALID_TRANSITION', 'Only unpaid bookings can be cancelled');
      }
      assertTransition(booking.status, 'cancelled');

      const tier = await repository.getTier(booking.tierId);
      const store = createStore();
      if (tier) store.tiers.set(tier.id, { ...tier });
      const domainBooking = { ...booking };
      store.bookings.set(domainBooking.id, domainBooking);
      store.bookingsByReference.set(reference, domainBooking);
      cancelBookingRule(store, reference);

      const cancelled = await repository.cancelBooking(reference, booking.status);
      if (!cancelled) {
        throw new DomainError('INVALID_TRANSITION', 'Booking status changed before cancellation');
      }
      return cancelled;
    },
  };
}

export default createBookingService;
