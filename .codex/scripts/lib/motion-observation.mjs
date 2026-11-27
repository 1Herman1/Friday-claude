import assert from 'node:assert/strict';

export function assertGrabObservation(value) {
  assert.ok(value?.before && value?.after, 'grab requires both event bounds');
  assert.equal(value.sameEvent, true, 'bounds must belong to the same dispatch');
  assert.equal(value.trusted, true, 'grab must use real browser mouse input');
  assert.equal(value.target, 'tile', 'grab must hit the tile, not stale geometry');
  assert.equal(value.before.grabbed, false);
  assert.equal(value.after.grabbed, true, 'engine must actually grab the tile');
  assert.equal(value.after.inertiaPaused, true, 'grab must interrupt inertia');
  assert.ok(Math.abs(value.after.x - value.before.x) < 1, 'grab must not jump to pointer center');
}

// Passed directly to page.evaluate: no Node closure or scheduling between bounds.
export function installGrabObservation() {
  let armed = false;
  let event = null;
  let record = null;
  let sequence = 0;
  window.motionObservation = {
    arm() { armed = true; event = null; record = null; return ++sequence; },
    read() { return record; },
  };
  window.addEventListener('mousedown', e => {
    if (!armed) return;
    armed = false;
    event = e;
    record = { id: sequence, trusted: e.isTrusted, target: e.target.id,
      timeStamp: e.timeStamp, clientX: e.clientX, clientY: e.clientY,
      before: window.pilot.snapshot(), after: null, sameEvent: false };
  }, true);
  // Engine stops propagation at the tile, so a window bubble listener is invalid.
  // This listener is installed after the real engine's target listener.
  document.querySelector('#tile').addEventListener('mousedown', e => {
    if (e !== event || !record) return;
    record.after = window.pilot.snapshot();
    record.sameEvent = true;
    event = null;
  });
}
