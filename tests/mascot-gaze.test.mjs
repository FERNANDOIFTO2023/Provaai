import test from 'node:test';
import assert from 'node:assert/strict';
import { gazeOffset } from '../lib/mascot-gaze.ts';

const bounds = { left: 50, top: 100, width: 300, height: 300 };
test('the gaze is centered when the pointer is over Bloub', () => {
  assert.deepEqual(gazeOffset(200, 250, bounds), { x: 0, y: 0, tilt: 0 });
});
test('eyes follow every direction without leaving the face', () => {
  for (const [x, y] of [
    [-10000, 250],
    [10000, 250],
    [200, -10000],
    [200, 10000],
    [10000, 10000],
  ]) {
    const gaze = gazeOffset(x, y, bounds);
    assert.ok(
      Math.abs(gaze.x) <= 11 &&
        Math.abs(gaze.y) <= 7 &&
        Math.abs(gaze.tilt) <= 5,
    );
    assert.equal(Math.sign(gaze.x), Math.sign(x - 200));
    assert.equal(Math.sign(gaze.y), Math.sign(y - 250));
  }
});
test('hidden or invalid geometry returns a neutral gaze', () => {
  assert.deepEqual(gazeOffset(100, 100, { ...bounds, width: 0 }), {
    x: 0,
    y: 0,
    tilt: 0,
  });
  assert.deepEqual(gazeOffset(NaN, 100, bounds), { x: 0, y: 0, tilt: 0 });
});
