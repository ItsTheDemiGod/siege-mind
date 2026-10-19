// Pure pause model: the player's own pause flag plus any number of named locks (menus, dialogs). Paused if either applies.

/** @returns {{paused: () => boolean, lock: Function, unlock: Function, toggleUser: () => void, setUser: Function, hasLock: Function, readonly lockCount: number, readonly user: boolean}} */
export function createPauseState() {
  let user = false;
  const locks = new Set();
  const check = (reason) => {
    if (typeof reason !== 'string' || reason === '') throw new TypeError('pause lock reason must be a non-empty string');
  };
  return {
    paused: () => user || locks.size > 0,
    lock(reason) { check(reason); locks.add(reason); },
    unlock(reason) { check(reason); locks.delete(reason); }, // idempotent; unknown reasons are ignored
    toggleUser() { user = !user; },
    setUser(v) { user = Boolean(v); },
    hasLock(reason) { return locks.has(reason); },
    get lockCount() { return locks.size; },
    get user() { return user; },
  };
}
