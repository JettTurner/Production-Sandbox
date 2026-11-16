/**
 * "Open where you left off".
 *
 * - The current text is kept in localStorage, so closing the window (even with
 *   unsaved work) and coming back restores it.
 * - Recently opened files are remembered as File System Access handles in
 *   IndexedDB, so they can be reopened from the menu and Save can keep writing
 *   to the same file. Browsers may ask for permission again after a restart.
 *
 * Everything here is best-effort: if storage is unavailable the app still works,
 * it just starts fresh.
 */

const SESSION_KEY = "fh-session";
const SEEN_KEY = "fh-seen";
const MAX_SESSION_BYTES = 2_000_000;
const MAX_RECENT = 6;

export interface Session {
  source: string;
  fileName: string | null;
  unsaved: boolean;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.source !== "string" || !s.source.trim()) return null;
    return { source: s.source, fileName: typeof s.fileName === "string" ? s.fileName : null, unsaved: !!s.unsaved };
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    if (s.source.length > MAX_SESSION_BYTES) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: nothing to do */
  }
}

/** True the very first time the app runs in this browser profile. */
export function isFirstRun(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
    localStorage.setItem(SEEN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

// ---------- Recent files (IndexedDB) ----------

export interface RecentFile {
  name: string;
  handle: FileSystemFileHandle;
  at: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fh-studio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("recent", { keyPath: "name" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction("recent", mode);
        const req = run(t.objectStore("recent"));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function listRecent(): Promise<RecentFile[]> {
  try {
    const all = await tx<RecentFile[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.at - a.at).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export async function rememberFile(handle: FileSystemFileHandle): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put({ name: handle.name, handle, at: Date.now() }));
    const all = await tx<RecentFile[]>("readonly", (s) => s.getAll());
    const stale = all.sort((a, b) => b.at - a.at).slice(MAX_RECENT);
    for (const r of stale) await tx("readwrite", (s) => s.delete(r.name));
  } catch {
    /* handles cannot be stored here: recents just stay empty */
  }
}

export async function forgetFile(name: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(name));
  } catch {
    /* ignore */
  }
}

/**
 * Whether a remembered handle can be used. With `ask` the browser may show its
 * permission prompt, which is only allowed in response to a click.
 */
export async function hasAccess(handle: FileSystemFileHandle, ask: boolean): Promise<boolean> {
  try {
    const opts = { mode: "readwrite" as const };
    if ((await handle.queryPermission?.(opts)) === "granted") return true;
    if (!ask) return false;
    return (await handle.requestPermission?.(opts)) === "granted";
  } catch {
    return false;
  }
}
