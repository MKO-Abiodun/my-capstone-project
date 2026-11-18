import { createApp } from './http/app.js';
import { createApiRouter } from './http/api.js';
import { config } from './config.js';
import { createDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';
import { createMockPaymentGateway } from './gateways/mockPaymentGateway.js';
import { createEventService } from './services/eventService.js';
import { createBookingService } from './services/bookingService.js';

const repository = createSqliteRepository(createDatabase());
const paymentGateway = createMockPaymentGateway();
const eventService = createEventService({ repository });
const bookingService = createBookingService({ repository, paymentGateway });
const router = createApiRouter({ eventService, bookingService });
const server = createApp({ router });

server.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(`Server listening on port ${port}`);
});

server.on('close', () => repository.close());
