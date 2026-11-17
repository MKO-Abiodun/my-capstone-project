export function resolvePort(portValue = process.env.PORT) {
  const port = portValue === '' || portValue === undefined ? 3000 : Number(portValue);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('PORT must be an integer between 0 and 65535');
  }
  return port;
}

export const config = Object.freeze({ port: resolvePort() });
