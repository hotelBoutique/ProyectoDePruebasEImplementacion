import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCreateReservation } from './support/runConfig.js';

test('only the explicit true string enables reservation creation', () => {
  assert.equal(shouldCreateReservation('true'), true);
  assert.equal(shouldCreateReservation('false'), false);
  assert.equal(shouldCreateReservation(undefined), false);
  assert.equal(shouldCreateReservation('TRUE'), false);

  const previousValue = process.env.TEST_CREATE_RESERVATION;
  try {
    process.env.TEST_CREATE_RESERVATION = 'false';
    assert.equal(shouldCreateReservation(), false);
  } finally {
    if (previousValue === undefined) {
      delete process.env.TEST_CREATE_RESERVATION;
    } else {
      process.env.TEST_CREATE_RESERVATION = previousValue;
    }
  }
});
