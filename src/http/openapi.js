const errorResponse = {
  description: 'The request failed.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

const userIdHeader = {
  name: 'x-user-id',
  in: 'header',
  required: true,
  description: 'Identifies the caller until authentication is added.',
  schema: { type: 'string', minLength: 1 },
};

const jsonRequest = schema => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Event Ticketing API',
    version: '1.0.0',
    description: 'In-memory event, ticket-tier, and booking API.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
  tags: [
    { name: 'Health' },
    { name: 'Events' },
    { name: 'Bookings' },
  ],
  paths: {
    '/openapi.json': {
      get: {
        tags: ['Health'],
        summary: 'Get the OpenAPI specification',
        operationId: 'getOpenApiSpecification',
        responses: {
          '200': {
            description: 'The OpenAPI document used by Scalar.',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check server health',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'The server is healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { const: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/events': {
      post: {
        tags: ['Events'],
        summary: 'Create a draft event',
        operationId: 'createEvent',
        requestBody: jsonRequest({ $ref: '#/components/schemas/CreateEventRequest' }),
        responses: {
          '201': {
            description: 'The event was created.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Event' } },
            },
          },
          '400': errorResponse,
          '500': errorResponse,
        },
      },
      get: {
        tags: ['Events'],
        summary: 'Search and filter published events',
        operationId: 'listEvents',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Case-insensitive text match against event title or venue.',
            schema: { type: 'string' },
          },
          {
            name: 'city',
            in: 'query',
            description: 'Case-insensitive exact city match.',
            schema: { type: 'string' },
          },
          {
            name: 'from',
            in: 'query',
            description: 'Inclusive start date/time lower bound.',
            schema: {
              oneOf: [
                { type: 'string', format: 'date' },
                { type: 'string', format: 'date-time' },
              ],
            },
          },
          {
            name: 'to',
            in: 'query',
            description: 'Inclusive upper date/time bound; a date-only value includes that full day.',
            schema: {
              oneOf: [
                { type: 'string', format: 'date' },
                { type: 'string', format: 'date-time' },
              ],
            },
          },
          {
            name: 'maxPriceCents',
            in: 'query',
            description: 'Maximum cheapest-tier price in whole cents.',
            schema: { type: 'integer', minimum: 0 },
          },
          {
            name: 'onlyAvailable',
            in: 'query',
            description: 'When true, omit events with no seats left.',
            schema: {
              type: 'string',
              enum: ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'],
            },
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['date', 'price', 'availability'], default: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Matching events, ordered by the selected sort.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/EventSummary' },
                },
              },
            },
          },
          '400': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/events/{id}/tiers': {
      post: {
        tags: ['Events'],
        summary: 'Add a ticket tier to an event',
        operationId: 'addTicketTier',
        parameters: [{
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', minLength: 1 },
        }],
        requestBody: jsonRequest({ $ref: '#/components/schemas/CreateTierRequest' }),
        responses: {
          '201': {
            description: 'The ticket tier was created.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TicketTier' } },
            },
          },
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/events/{id}/publish': {
      post: {
        tags: ['Events'],
        summary: 'Publish an event',
        operationId: 'publishEvent',
        parameters: [{
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', minLength: 1 },
        }],
        responses: {
          '200': {
            description: 'The event was published.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Event' } },
            },
          },
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/events/{id}/unpublish': {
      post: {
        tags: ['Events'],
        summary: 'Return an event to draft status',
        operationId: 'unpublishEvent',
        parameters: [{
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', minLength: 1 },
        }],
        responses: {
          '200': {
            description: 'The event was unpublished.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Event' } },
            },
          },
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Book tickets from a tier',
        operationId: 'createBooking',
        parameters: [userIdHeader],
        requestBody: jsonRequest({ $ref: '#/components/schemas/CreateBookingRequest' }),
        responses: {
          '201': {
            description: 'The pending booking was created.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Booking' } },
            },
          },
          '400': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/bookings/{reference}/pay': {
      post: {
        tags: ['Bookings'],
        summary: 'Pay for a pending booking using mock payment',
        description: 'The card value is only interpreted by this mock API to simulate approval or decline; it is not sent to the payment gateway.',
        operationId: 'payBooking',
        parameters: [
          {
            name: 'reference',
            in: 'path',
            required: true,
            schema: { type: 'string', minLength: 1 },
          },
          userIdHeader,
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MockPaymentRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Payment succeeded and the booking is paid.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Booking' } },
            },
          },
          '400': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/bookings/{reference}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel an unpaid booking',
        operationId: 'cancelBooking',
        parameters: [
          {
            name: 'reference',
            in: 'path',
            required: true,
            schema: { type: 'string', minLength: 1 },
          },
          userIdHeader,
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { type: 'object', additionalProperties: true } },
          },
        },
        responses: {
          '200': {
            description: 'The booking was cancelled and its seats were released.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Booking' } },
            },
          },
          '400': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '500': errorResponse,
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
            additionalProperties: true,
          },
        },
      },
      User: {
        type: 'object',
        required: ['id', 'name', 'role'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['organizer', 'attendee', 'admin'] },
        },
      },
      CreateEventRequest: {
        type: 'object',
        required: ['title', 'city'],
        anyOf: [{ required: ['startsAt'] }, { required: ['date'] }],
        properties: {
          title: { type: 'string', minLength: 1 },
          city: { type: 'string', minLength: 1 },
          venue: { type: 'string' },
          startsAt: {
            oneOf: [
              { type: 'string', format: 'date' },
              { type: 'string', format: 'date-time' },
            ],
          },
          date: {
            oneOf: [
              { type: 'string', format: 'date' },
              { type: 'string', format: 'date-time' },
            ],
          },
          organizerId: { type: 'string', minLength: 1 },
        },
        additionalProperties: true,
      },
      Event: {
        type: 'object',
        required: ['id', 'organizerId', 'organizer', 'title', 'city', 'venue', 'startsAt', 'date', 'status', 'tierIds'],
        properties: {
          id: { type: 'string' },
          organizerId: { type: 'string' },
          organizer: { $ref: '#/components/schemas/User' },
          title: { type: 'string' },
          city: { type: 'string' },
          venue: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['draft', 'published'] },
          tierIds: { type: 'array', items: { type: 'string' } },
        },
      },
      CreateTierRequest: {
        type: 'object',
        anyOf: [{ required: ['priceCents'] }, { required: ['price'] }],
        allOf: [{ anyOf: [{ required: ['capacity'] }, { required: ['cap'] }] }],
        properties: {
          name: { type: 'string', minLength: 1, default: 'General' },
          priceCents: { type: 'integer', minimum: 0 },
          price: { type: 'integer', minimum: 0, description: 'Compatibility alias for priceCents.' },
          capacity: { type: 'integer', minimum: 1 },
          cap: { type: 'integer', minimum: 1, description: 'Compatibility alias for capacity.' },
        },
        additionalProperties: true,
      },
      TicketTier: {
        type: 'object',
        required: ['id', 'eventId', 'name', 'priceCents', 'price', 'capacity', 'sold'],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          name: { type: 'string' },
          priceCents: { type: 'integer', minimum: 0 },
          price: { type: 'integer', minimum: 0 },
          capacity: { type: 'integer', minimum: 1 },
          sold: { type: 'integer', minimum: 0 },
        },
      },
      EventSummary: {
        type: 'object',
        required: [
          'id', 'title', 'city', 'venue', 'date', 'startsAt', 'status',
          'tierCount', 'minPriceCents', 'cheapestPriceCents', 'price',
          'seatsLeft', 'totalSeatsLeft', 'totalCapacity',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          city: { type: 'string' },
          venue: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          startsAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', const: 'published' },
          tierCount: { type: 'integer', minimum: 0 },
          minPriceCents: { type: ['integer', 'null'], minimum: 0 },
          cheapestPriceCents: { type: ['integer', 'null'], minimum: 0 },
          price: { type: ['integer', 'null'], minimum: 0 },
          seatsLeft: { type: 'integer' },
          totalSeatsLeft: { type: 'integer' },
          totalCapacity: { type: 'integer' },
        },
      },
      CreateBookingRequest: {
        type: 'object',
        required: ['tierId'],
        properties: {
          tierId: { type: 'string', minLength: 1 },
          quantity: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
        },
      },
      MockPaymentRequest: {
        type: 'object',
        description: 'For this mock implementation, an absent/empty value or a value containing "declined", "fail", or "invalid" simulates a decline.',
        properties: {
          cardNumber: { type: 'string' },
          card: { type: 'string' },
          paymentMethod: { type: 'string' },
        },
        additionalProperties: true,
      },
      Booking: {
        type: 'object',
        required: [
          'id', 'reference', 'userId', 'attendee', 'tierId', 'quantity',
          'amountCents', 'priceCents', 'status', 'createdAt',
        ],
        properties: {
          id: { type: 'string' },
          reference: { type: 'string' },
          userId: { type: 'string' },
          attendee: { $ref: '#/components/schemas/User' },
          tierId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 10 },
          amountCents: { type: 'integer', minimum: 0 },
          priceCents: { type: 'integer', minimum: 0 },
          status: { type: 'string', enum: ['pending', 'paid', 'cancelled', 'refunded', 'checked_in'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export { openapi };
export default openapi;
