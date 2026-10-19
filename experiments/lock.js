// The held-out lock: pure decision logic (no file or git access). The CLI reads and writes experiments/heldout.lock.json around it.
// The held-out seed set may be run once; a second run needs --new-lock and leaves an audit trail (runIndex and previous locks).
import { protocolHash } from './protocol.js';

const refuse = (reason) => ({ allowed: false, reason, nextLock: null });

/**
 * @param {{existingLock: object|null, args: {final?: boolean, yes?: boolean, newLock?: boolean, allowDirty?: boolean},
 *   identity: {codeHash: string, gitCommit: string, gitDirty: boolean}, now: string}} o now is an ISO timestamp supplied by the caller
 * @returns {{allowed: boolean, reason: string, nextLock: object|null}} never mutates its inputs
 */
export function decideHeldoutRun({ existingLock, args, identity, now }) {
  if (!args.final) return refuse('the held-out set is the final evaluation: pass --final');
  if (!args.yes) return refuse('the held-out set may be run only once: pass --yes to confirm');
  if (identity.gitCommit === 'unknown') return refuse('the git commit is unknown, so the run could not be tied to the code (is git available?)');
  if (identity.gitDirty && !args.allowDirty) return refuse('the working tree has uncommitted changes: commit them first, or pass --allow-dirty (the lock will record it)');
  if (existingLock && !args.newLock) {
    return refuse(`the held-out set was already run (runIndex ${existingLock.runIndex}); a second run needs --new-lock and must be reported as run ${existingLock.runIndex + 1}`);
  }
  const base = { createdAt: now, gitCommit: identity.gitCommit, gitDirty: identity.gitDirty, codeHash: identity.codeHash, protocolHash: protocolHash() };
  if (!existingLock) return { allowed: true, reason: 'first held-out run', nextLock: { runIndex: 1, ...base, previous: [] } };
  const { previous = [], ...old } = existingLock;
  return {
    allowed: true, reason: `held-out run ${existingLock.runIndex + 1} (the report must state it)`,
    nextLock: { runIndex: existingLock.runIndex + 1, ...base, previous: [...previous, old] },
  };
}
