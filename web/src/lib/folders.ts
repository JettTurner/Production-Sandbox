import type { FsNode } from "./types";
import { isFileNode } from "./types";

/**
 * Writing the planned tree to a real folder with the File System Access API
 * (Chromium browsers and the Electron app; needs a secure context).
 *
 * Nothing here ever deletes, renames or overwrites: existing folders and files
 * are left exactly as they are.
 */

export type EntryStatus = "new" | "exists" | "conflict";

export interface PlanEntry {
  path: string;
  name: string;
  depth: number;
  file: boolean;
  status: EntryStatus;
}

export interface DiskPlan {
  entries: PlanEntry[];
  newCount: number;
  existCount: number;
  conflictCount: number;
}

export interface CreateResult {
  created: number;
  skipped: number;
  /** Set when creation stopped early; everything before it was created. */
  failed?: { path: string; message: string };
}

function errName(err: unknown): string {
  return (err as { name?: string } | null)?.name ?? "";
}

/**
 * Dry run: compares the tree with what is already in `dir` without changing
 * anything. A name that exists as the wrong kind (file vs folder) is a
 * conflict; everything beneath it is reported as a conflict too.
 */
export async function scanDestination(dir: FileSystemDirectoryHandle, tree: FsNode[]): Promise<DiskPlan> {
  const entries: PlanEntry[] = [];

  async function walk(
    base: FileSystemDirectoryHandle | null,
    nodes: FsNode[],
    parentPath: string,
    depth: number,
    inherited: EntryStatus | null,
  ): Promise<void> {
    for (const node of nodes) {
      if (node.kind === "insert") continue;
      const file = isFileNode(node);
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      let status: EntryStatus = inherited ?? "new";
      let child: FileSystemDirectoryHandle | null = null;
      if (!inherited && base) {
        try {
          if (file) await base.getFileHandle(node.name);
          else child = await base.getDirectoryHandle(node.name);
          status = "exists";
        } catch (err) {
          const name = errName(err);
          if (name === "NotFoundError") status = "new";
          else if (name === "TypeMismatchError") status = "conflict";
          else throw err;
        }
      }
      entries.push({ path, name: node.name, depth, file, status });
      if (!file) {
        await walk(child, node.children, path, depth + 1, status === "exists" ? null : status);
      }
    }
  }

  await walk(dir, tree, "", 0, null);
  return {
    entries,
    newCount: entries.filter((e) => e.status === "new").length,
    existCount: entries.filter((e) => e.status === "exists").length,
    conflictCount: entries.filter((e) => e.status === "conflict").length,
  };
}

/**
 * Creates whatever is missing. Existing folders are reused and existing files
 * are never opened for writing (so their contents are untouched). Stops at the
 * first failure and reports where.
 */
export async function createOnDisk(
  dir: FileSystemDirectoryHandle,
  tree: FsNode[],
  onProgress?: (done: number) => void,
): Promise<CreateResult> {
  let created = 0;
  let skipped = 0;
  let done = 0;
  let failed: CreateResult["failed"];

  async function exists(base: FileSystemDirectoryHandle, node: FsNode, file: boolean): Promise<boolean> {
    try {
      if (file) await base.getFileHandle(node.name);
      else await base.getDirectoryHandle(node.name);
      return true;
    } catch (err) {
      if (errName(err) === "NotFoundError") return false;
      throw err;
    }
  }

  async function walk(base: FileSystemDirectoryHandle, nodes: FsNode[], parentPath: string, fresh: boolean): Promise<void> {
    for (const node of nodes) {
      if (failed) return;
      if (node.kind === "insert") continue;
      const file = isFileNode(node);
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      try {
        // Inside a folder we just created nothing can exist yet.
        const had = fresh ? false : await exists(base, node, file);
        if (file) {
          if (!had) await base.getFileHandle(node.name, { create: true });
        } else {
          const child = await base.getDirectoryHandle(node.name, { create: true });
          if (had) skipped++;
          else created++;
          onProgress?.(++done);
          await walk(child, node.children, path, !had);
          continue;
        }
        if (had) skipped++;
        else created++;
        onProgress?.(++done);
      } catch (err) {
        failed = { path, message: (err as Error)?.message || errName(err) || "Unknown error" };
        return;
      }
    }
  }

  await walk(dir, tree, "", false);
  return { created, skipped, ...(failed ? { failed } : {}) };
}

// ---------- Import: read an existing folder into a structure ----------

export interface ReadResult {
  nodes: FsNode[];
  folders: number;
  files: number;
  /** Entries left out: hidden/system items, and files with no dot in their name (the format cannot express those). */
  skipped: number;
  /** True when the folder was bigger than the limit and reading stopped early. */
  truncated: boolean;
}

const SKIP_NAMES = new Set(["node_modules", "$recycle.bin", "system volume information", "thumbs.db", "desktop.ini"]);

/**
 * Reads a real folder into FsNodes (names only; file contents are never read).
 * Names starting with a dot and a few system folders are skipped.
 */
export async function readFolder(
  dir: FileSystemDirectoryHandle,
  opts: { includeFiles: boolean; limit?: number },
): Promise<ReadResult> {
  const limit = opts.limit ?? 5000;
  const res: ReadResult = { nodes: [], folders: 0, files: 0, skipped: 0, truncated: false };
  let n = 0;
  const id = () => `imp${(n++).toString(36)}${Date.now().toString(36)}`;

  async function walk(handle: FileSystemDirectoryHandle): Promise<FsNode[]> {
    const entries: [string, FileSystemFileHandle | FileSystemDirectoryHandle][] = [];
    for await (const entry of handle.entries()) entries.push(entry);
    entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));
    const out: FsNode[] = [];
    for (const [name, child] of entries) {
      if (res.folders + res.files >= limit) {
        res.truncated = true;
        break;
      }
      if (name.startsWith(".") || SKIP_NAMES.has(name.toLowerCase())) {
        res.skipped++;
        continue;
      }
      if (child.kind === "directory") {
        res.folders++;
        const node: FsNode = { id: id(), kind: "folder", name, forceFolder: true, children: [] };
        out.push(node);
        node.children = await walk(child);
      } else if (opts.includeFiles) {
        if (!name.includes(".")) {
          res.skipped++;
          continue;
        }
        res.files++;
        out.push({ id: id(), kind: "folder", name, children: [] });
      }
    }
    return out;
  }

  res.nodes = await walk(dir);
  return res;
}

export function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
