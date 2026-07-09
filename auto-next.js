export function createAutoNextController() {
  let timerId = null;
  let active = false;

  function clear() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    active = false;
  }

  function start(callback, delaySeconds, onTick) {
    clear();
    active = true;

    const totalMs = Math.max(1, Number(delaySeconds) || 1) * 1000;
    const startTime = Date.now();

    const tick = () => {
      if (!active) {
        return;
      }

      const elapsed = Math.max(0, Math.ceil((totalMs - (Date.now() - startTime)) / 1000));
      const remaining = Math.max(0, elapsed);

      if (typeof onTick === 'function') {
        onTick(remaining);
      }

      if (remaining <= 0) {
        clear();
        callback();
        return;
      }

      timerId = setTimeout(tick, 1000);
    };

    tick();
  }

  function cancel() {
    clear();
  }

  function isActive() {
    return active;
  }

  return { start, cancel, isActive };
}
