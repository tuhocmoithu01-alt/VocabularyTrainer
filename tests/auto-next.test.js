import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoNextController } from '../auto-next.js';

test('createAutoNextController counts down and fires once', async () => {
  const controller = createAutoNextController();
  const ticks = [];
  let fired = 0;

  controller.start(() => {
    fired += 1;
  }, 3, (value) => {
    ticks.push(value);
  });

  assert.equal(controller.isActive(), true);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.deepEqual(ticks, [3, 2]);

  await new Promise((resolve) => setTimeout(resolve, 2200));
  assert.equal(fired, 1);
  assert.equal(controller.isActive(), false);
});

test('createAutoNextController can be canceled before the callback fires', async () => {
  const controller = createAutoNextController();
  let fired = 0;

  controller.start(() => {
    fired += 1;
  }, 2);

  controller.cancel();
  await new Promise((resolve) => setTimeout(resolve, 2500));

  assert.equal(fired, 0);
  assert.equal(controller.isActive(), false);
});
