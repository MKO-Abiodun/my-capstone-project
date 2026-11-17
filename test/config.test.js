import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePort } from '../src/config.js';

test('server port defaults to 3000 when PORT is unset or empty', () => {
  assert.equal(resolvePort(undefined), 3000);
  assert.equal(resolvePort(''), 3000);
});

test('server port can be configured from PORT', () => {
  assert.equal(resolvePort('4321'), 4321);
  assert.equal(resolvePort('0'), 0);
});

test('invalid PORT values are rejected', () => {
  for (const value of ['not-a-port', '-1', '65536', '3.5']) {
    assert.throws(
      () => resolvePort(value),
      error => error instanceof RangeError && /PORT must be an integer/.test(error.message)
    );
  }
});
