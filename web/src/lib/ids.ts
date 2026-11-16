import type { FhDocument, FsNode } from "./types";
import { newId } from "./types";

/**
 * Node ids are not stored in .fh files, so every parse starts with fresh ones.
 * UI state (collapsed folders, expanded templates, selection) is keyed by id,
 * so without help it would reset on every edit.
 *
 * `reconcileIds` copies ids from the previous document onto a freshly parsed
 * one wherever a node is recognisably "the same":
 *   1. same position, same kind and name;
 *   2. otherwise the first unclaimed sibling with the same kind and name
 *      (covers inserts, deletes and moves within a folder);
 *   3. otherwise, when the sibling count is unchanged, the unclaimed sibling at
 *      the same position (covers renames).
 * Anything left over keeps its fresh id. Mutates and returns `next`.
 */
export function reconcileIds(next: FhDocument, prev: FhDocument | null | undefined): FhDocument {
  if (!prev) return next;
  matchList(next.root, prev.root);
  const prevNames = prev.templateOrder;
  next.templateOrder.forEach((name, i) => {
    // A renamed template keeps its place in the order.
    const prevName =
      prev.templates[name] !== undefined
        ? name
        : next.templateOrder.length === prevNames.length && next.templates[prevNames[i]] === undefined
          ? prevNames[i]
          : undefined;
    if (prevName !== undefined) matchList(next.templates[name] ?? [], prev.templates[prevName] ?? []);
  });
  return next;
}

function matchList(a: FsNode[], b: FsNode[]): void {
  if (!a.length || !b.length) return;
  const pair: (FsNode | undefined)[] = new Array(a.length).fill(undefined);
  const used = new Array(b.length).fill(false);
  const same = (x: FsNode, y: FsNode) => x.kind === y.kind && x.name === y.name;

  for (let i = 0; i < a.length && i < b.length; i++) {
    if (same(a[i], b[i])) {
      pair[i] = b[i];
      used[i] = true;
    }
  }
  for (let i = 0; i < a.length; i++) {
    if (pair[i]) continue;
    const j = b.findIndex((y, k) => !used[k] && same(a[i], y));
    if (j >= 0) {
      pair[i] = b[j];
      used[j] = true;
    }
  }
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (!pair[i] && !used[i] && a[i].kind === b[i].kind) {
        pair[i] = b[i];
        used[i] = true;
      }
    }
  }
  for (let i = 0; i < a.length; i++) {
    const p = pair[i];
    if (!p) continue;
    a[i].id = p.id;
    matchList(a[i].children, p.children);
  }
}

/** Deep copy with brand-new ids on every node (used by Duplicate). */
export function cloneWithNewIds(node: FsNode): FsNode {
  return { ...node, id: newId(), children: node.children.map(cloneWithNewIds) };
}
