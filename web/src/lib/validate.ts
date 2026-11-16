import type { FsNode } from "./types";
import { isFileNode } from "./types";

/**
 * Checks on the resolved tree before anything is written to disk.
 *
 * Rules follow Windows, the strictest common target: a structure that passes
 * here can be created on Windows, macOS and Linux alike.
 */

export type IssueCode = "illegal-char" | "reserved" | "trailing" | "kind-conflict" | "path-length";

export interface TreeIssue {
  severity: "error" | "warning";
  code: IssueCode;
  /** Slash-separated path of the offending node. */
  path: string;
  message: string;
}

export interface PlannedTree {
  /** The tree as it will land on disk: same-name siblings merged into one. */
  tree: FsNode[];
  issues: TreeIssue[];
  errors: number;
  warnings: number;
  /** How many nodes were folded into an earlier sibling of the same name. */
  duplicates: number;
  /** Up to 5 example paths that had duplicates, for display. */
  duplicateExamples: string[];
  /** Length in characters of the longest relative path (0 when empty). */
  longestPath: number;
  longestPathText: string;
}

/** Windows MAX_PATH. The destination folder's own path counts toward it too. */
export const MAX_PATH = 260;
/** Warn once the structure alone uses this much of MAX_PATH. */
export const PATH_WARN = 200;

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Returns a problem description for a single name, or null when it is fine. */
export function nameProblem(name: string): { code: IssueCode; message: string } | null {
  const bad = name.match(ILLEGAL);
  if (bad) {
    const ch = bad[0] < " " ? "a control character" : `"${bad[0]}"`;
    return { code: "illegal-char", message: `contains ${ch}, which is not allowed in file or folder names` };
  }
  if (name === "." || name === "..") return { code: "reserved", message: "is not a usable name" };
  if (RESERVED.test(name)) return { code: "reserved", message: "is a reserved device name on Windows" };
  if (/[. ]$/.test(name)) return { code: "trailing", message: "ends with a dot or space, which Windows strips" };
  return null;
}

/**
 * Merges same-name siblings (case-insensitively, as Windows and macOS do) and
 * validates every name and path. The returned tree is what zip export and
 * "Create folders" write.
 */
export function planTree(resolved: FsNode[]): PlannedTree {
  const issues: TreeIssue[] = [];
  const duplicateExamples: string[] = [];
  let duplicates = 0;
  let longestPath = 0;
  let longestPathText = "";

  const merge = (nodes: FsNode[], parentPath: string): FsNode[] => {
    const out: FsNode[] = [];
    const byName = new Map<string, FsNode>();
    for (const n of nodes) {
      if (n.kind === "insert") continue; // unresolved insert (reported by the resolver)
      const key = n.name.toLowerCase();
      const path = parentPath ? `${parentPath}/${n.name}` : n.name;
      const first = byName.get(key);
      if (!first) {
        const copy: FsNode = { ...n, children: [...n.children] };
        byName.set(key, copy);
        out.push(copy);
        continue;
      }
      duplicates++;
      if (duplicateExamples.length < 5 && !duplicateExamples.includes(path)) duplicateExamples.push(path);
      if (isFileNode(first) !== isFileNode(n)) {
        issues.push({
          severity: "error",
          code: "kind-conflict",
          path,
          message: `"${path}" is used as both a file and a folder`,
        });
        continue;
      }
      first.children.push(...n.children);
    }
    for (const n of out) {
      const path = parentPath ? `${parentPath}/${n.name}` : n.name;
      const problem = nameProblem(n.name);
      if (problem) issues.push({ severity: "error", code: problem.code, path, message: `"${n.name}" ${problem.message}` });
      if (path.length > longestPath) {
        longestPath = path.length;
        longestPathText = path;
      }
      n.children = isFileNode(n) ? [] : merge(n.children, path);
    }
    return out;
  };

  const tree = merge(resolved, "");

  if (longestPath >= MAX_PATH) {
    issues.push({
      severity: "error",
      code: "path-length",
      path: longestPathText,
      message: `The longest path is ${longestPath} characters; Windows allows ${MAX_PATH} including the destination folder`,
    });
  } else if (longestPath > PATH_WARN) {
    issues.push({
      severity: "warning",
      code: "path-length",
      path: longestPathText,
      message: `The longest path is ${longestPath} characters, leaving ${MAX_PATH - longestPath} for the destination folder's own path`,
    });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  return {
    tree,
    issues,
    errors,
    warnings: issues.length - errors,
    duplicates,
    duplicateExamples,
    longestPath,
    longestPathText,
  };
}
