import { createApp } from './http/app.js';
import { config } from './config.js';

const server = createApp();

server.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(`Server listening on port ${port}`);
});
