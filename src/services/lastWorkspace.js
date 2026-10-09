/* "Continue where you left off" — remembers the last meaningful workspace screen, per account.

   What is stored:  { v, userId, workspace, route: {view, params}, at }  — a workspace name and a route. No tokens, no personal data.
   Where:           localStorage, under a key that includes the account's id (vyra:last:<userId>). Two people on one shared device
                    therefore never see each other's record, and on top of that the stored userId must match the signed-in account.
   Logout:          the record is kept on purpose (that is what "continue where you left off" means) but it is only ever used for the same
                    account signing in again, and it is never trusted as permission: services/workspaces.js re-checks the account's CURRENT
                    permissions before using it, so a revoked role simply falls back to the right dashboard.
   Failure:         storage can be missing, full or blocked (private mode, embedded browsers); every call degrades to "nothing remembered". */

const PREFIX = "vyra:last:";
const VERSION = 1;

function browserStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } // even touching it can throw when blocked
}

export function createLastStore(storage = browserStorage(), now = () => Date.now()) {
  const key = (userId) => `${PREFIX}${userId}`;
  return {
    /** → the stored record for this account, or null (missing, corrupt, wrong version, or written for a different account). */
    read(userId) {
      if (!storage || !userId) return null;
      try {
        const rec = JSON.parse(storage.getItem(key(userId)));
        return rec && rec.v === VERSION && rec.userId === userId && typeof rec.workspace === "string" && rec.route && typeof rec.route.view === "string" && Number.isFinite(rec.at) ? rec : null;
      } catch { return null; }
    },
    /** `entry` = { workspace, route } from workspaces.rememberable(). Rewrites only when something changed, so navigating around costs no storage churn. */
    write(userId, entry) {
      if (!storage || !userId || !entry) return;
      try {
        const prev = this.read(userId);
        if (prev && prev.workspace === entry.workspace && JSON.stringify(prev.route) === JSON.stringify(entry.route)) return;
        storage.setItem(key(userId), JSON.stringify({ v: VERSION, userId, workspace: entry.workspace, route: entry.route, at: now() }));
      } catch { /* quota / blocked: not remembering is fine */ }
    },
    forget(userId) { try { if (storage && userId) storage.removeItem(key(userId)); } catch { /* ignore */ } },
  };
}
