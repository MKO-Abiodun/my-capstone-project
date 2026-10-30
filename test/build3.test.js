import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/http/app.js';
import { createRouter } from '../src/http/router.js';
import {
  BOOKING_STATES,
  BOOKING_TRANSITIONS,
  assertTransition,
  canTransition
} from '../src/domain/bookingStateMachine.js';

test('booking state machine permits exactly the documented transitions', () => {
  const allowed = Object.entries(BOOKING_TRANSITIONS)
    .flatMap(([from, destinations]) => destinations.map(to => [from, to]));

  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      const isAllowed = allowed.some(([allowedFrom, allowedTo]) =>
        allowedFrom === from && allowedTo === to);
      assert.equal(canTransition(from, to), isAllowed, `${from} -> ${to}`);
      if (isAllowed) {
        assert.doesNotThrow(() => assertTransition(from, to));
      } else {
        assert.throws(
          () => assertTransition(from, to),
          error => error.code === 'INVALID_TRANSITION'
        );
      }
    }
  }
});

test('state machine rejects unknown states', () => {
  assert.equal(canTransition('unknown', 'paid'), false);
  assert.throws(
    () => assertTransition('unknown', 'paid'),
    error => error.code === 'INVALID_TRANSITION'
  );
});

test('router matches method and extracts named path parameters', () => {
  const handler = () => {};
  const router = createRouter().add('get', '/events/:eventId/bookings/:bookingId', handler);

  assert.deepEqual(router.match('GET', '/events/event%201/bookings/booking-2'), {
    handler,
    params: { eventId: 'event 1', bookingId: 'booking-2' }
  });
  assert.equal(router.match('POST', '/events/event-1/bookings/booking-2'), null);
  assert.equal(router.match('GET', '/events/event-1'), null);
});

test('HTTP server returns JSON from /health', async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('HTTP errors use a consistent JSON shape and malformed JSON is a 400', async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const missing = await fetch(`${baseUrl}/api/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    error: { code: 'NOT_FOUND', message: 'Route not found' }
  });

  const badJson = await fetch(`${baseUrl}/api/example`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{'
  });
  assert.equal(badJson.status, 400);
  assert.deepEqual(await badJson.json(), {
    error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' }
  });
});

test('static server serves files and blocks traversal and symlink escapes', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'build3-static-'));
  const publicDir = path.join(tempDir, 'public');
  const outsideDir = path.join(tempDir, 'outside');
  await mkdir(publicDir);
  await mkdir(outsideDir);
  await writeFile(path.join(publicDir, 'index.html'), 'public page');
  await writeFile(path.join(outsideDir, 'secret.txt'), 'private data');
  try {
    await symlink(outsideDir, path.join(publicDir, 'linked'), 'junction');
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
  }

  const server = createApp({ publicDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    await rm(tempDir, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const index = await fetch(baseUrl);
  assert.equal(await index.text(), 'public page');

  const traversal = await fetch(`${baseUrl}/%2e%2e/outside/secret.txt`);
  assert.equal(traversal.status, 404);

  const linked = await fetch(`${baseUrl}/linked/secret.txt`);
  if (await readFile(path.join(publicDir, 'linked', 'secret.txt'), 'utf8').then(
    value => value === 'private data',
    () => false
  )) {
    assert.equal(linked.status, 404);
  }
});
