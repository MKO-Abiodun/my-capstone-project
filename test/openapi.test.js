import { test } from 'node:test';
import assert from 'node:assert/strict';
import openapi from '../src/http/openapi.js';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/api.js';

test('OpenAPI document describes the implemented HTTP endpoints', () => {
  assert.equal(openapi.openapi, '3.1.0');
  assert.deepEqual(Object.keys(openapi.paths).sort(), [
    '/api/bookings',
    '/api/bookings/{reference}/cancel',
    '/api/bookings/{reference}/pay',
    '/api/events',
    '/api/events/{id}/publish',
    '/api/events/{id}/tiers',
    '/api/events/{id}/unpublish',
    '/health',
    '/openapi.json',
  ]);
  assert.ok(openapi.paths['/api/bookings'].post.parameters.some(
    parameter => parameter.name === 'x-user-id' && parameter.required
  ));
});

test('HTTP server serves the OpenAPI document for Scalar', async t => {
  const server = createApp({ router: createApiRouter() });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/openapi.json`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), openapi);
});

test('OpenAPI schemas include validation limits and consistent API errors', () => {
  const booking = openapi.components.schemas.CreateBookingRequest;
  assert.equal(booking.properties.quantity.minimum, 1);
  assert.equal(booking.properties.quantity.maximum, 10);
  assert.ok(openapi.components.schemas.ErrorResponse.properties.error.required.includes('code'));
  assert.ok(openapi.paths['/api/events'].get.responses['400']);
  assert.ok(openapi.paths['/api/bookings/{reference}/pay'].post.responses['403']);
});
