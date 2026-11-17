import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';

export function createBookingService({ repository, paymentGateway }) {
  if (!repository) {
    throw new TypeError('A booking service requires a repository');
  }
  if (!paymentGateway) {
    throw new TypeError('A booking service requires a payment gateway');
  }

  return {
    async bookTickets({ tierId, userId, quantity }) {
      return repository.bookTickets(tierId, userId, quantity);
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
      booking.status = 'paid';
      return booking;
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
      return repository.cancelBooking(reference);
    },
  };
}

export default createBookingService;
