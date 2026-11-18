import { createRouter } from './router.js';
import openapi from './openapi.js';
import {
  validateBookingInput,
  validateCancelInput,
  validateEventInput,
  validateEventSearchInput,
  validatePathIdentifier,
  validatePaymentInput,
  validateTierInput,
  validateUserId,
} from '../domain/validation.js';

function parseUserId(request) {
  return request.headers['x-user-id'];
}

function shouldDeclineMockPayment(body) {
  const paymentInput = body?.cardNumber ?? body?.card ?? body?.paymentMethod;
  const value = String(paymentInput ?? '').trim().toLowerCase();
  return !value || ['declined', 'fail', 'invalid'].some(marker => value.includes(marker));
}

export function createApiRouter({ eventService, bookingService } = {}) {
  if (!eventService || !bookingService) {
    throw new TypeError('The API router requires event and booking services');
  }

  const router = createRouter();

  router.add('GET', '/openapi.json', async () => ({
    status: 200,
    body: openapi,
  }));

  router.add('POST', '/api/events', async ({ body }) => {
    const event = await eventService.createEvent(validateEventInput(body));
    return { status: 201, body: event };
  });

  router.add('POST', '/api/events/:id/tiers', async ({ params, body }) => {
    const eventId = validatePathIdentifier(params.id, 'Event id');
    const tier = await eventService.addTier(eventId, validateTierInput(body));
    return { status: 201, body: tier };
  });

  router.add('POST', '/api/events/:id/publish', async ({ params }) => {
    const event = await eventService.publishEvent(validatePathIdentifier(params.id, 'Event id'));
    return { status: 200, body: event };
  });

  router.add('POST', '/api/events/:id/unpublish', async ({ params }) => {
    const event = await eventService.unpublishEvent(validatePathIdentifier(params.id, 'Event id'));
    return { status: 200, body: event };
  });

  router.add('GET', '/api/events', async ({ request }) => {
    const url = new URL(request.url, 'http://localhost');
    const maxPriceCents = url.searchParams.get('maxPriceCents');
    const filters = validateEventSearchInput({
      q: url.searchParams.get('q') ?? undefined,
      city: url.searchParams.get('city') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      maxPriceCents: maxPriceCents === null ? undefined : maxPriceCents,
      onlyAvailable: url.searchParams.get('onlyAvailable') ?? undefined,
      sort: url.searchParams.get('sort') ?? 'date',
    });
    return { status: 200, body: await eventService.listEvents(filters) };
  });

  router.add('POST', '/api/bookings', async ({ request, body }) => {
    const userId = validateUserId(parseUserId(request));
    const bookingInput = validateBookingInput(body);
    const booking = await bookingService.bookTickets({
      ...bookingInput,
      userId,
    });
    return { status: 201, body: booking };
  });

  router.add('POST', '/api/bookings/:reference/pay', async ({ request, params, body }) => {
    const userId = validateUserId(parseUserId(request));
    const reference = validatePathIdentifier(params.reference, 'Booking reference');
    const paymentInput = validatePaymentInput(body);

    const booking = await bookingService.payBooking(reference, {
      userId,
      shouldDecline: shouldDeclineMockPayment(paymentInput),
    });
    return { status: 200, body: booking };
  });

  router.add('POST', '/api/bookings/:reference/cancel', async ({ request, params, body }) => {
    const userId = validateUserId(parseUserId(request));
    const reference = validatePathIdentifier(params.reference, 'Booking reference');
    validateCancelInput(body);
    const booking = await bookingService.cancelBooking(reference, { userId });
    return { status: 200, body: booking };
  });

  return router;
}

export default createApiRouter;
