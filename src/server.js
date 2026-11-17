import { createApp } from './http/app.js';
import { createApiRouter } from './http/api.js';
import { config } from './config.js';

const server = createApp({ router: createApiRouter() });

server.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(`Server listening on port ${port}`);
});
