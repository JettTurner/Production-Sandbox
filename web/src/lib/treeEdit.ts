import type { FsNode } from "./types";
import { isFileLike, isFileNode, newId } from "./types";

export interface Located {
  container: FsNode[];
  index: number;
  node: FsNode;
}

function findPath(nodes: FsNode[], id: string, path: Located[] = []): Located[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) return [...path, { container: nodes, index: i, node }];
    const found = findPath(node.children, id, [...path, { container: nodes, index: i, node }]);
    if (found) return found;
  }
  return null;
}

export function cloneTree(nodes: FsNode[]): FsNode[] {
  return nodes.map((n) => ({
    ...n,
    children: cloneTree(n.children),
  }));
}

export function updateNode(root: FsNode[], id: string, updater: (n: FsNode) => FsNode): FsNode[] {
  const path = findPath(root, id);
  if (!path) return root;
  const indices = path.map((p) => p.index);
  return updateByIndices(root, indices, updater);
}

function updateByIndices(nodes: FsNode[], indices: number[], updater: (n: FsNode) => FsNode): FsNode[] {
  const [i, ...rest] = indices;
  if (rest.length === 0) {
    return nodes.map((n, idx) => (idx === i ? updater(n) : n));
  }
  return nodes.map((n, idx) => (idx === i ? { ...n, children: updateByIndices(n.children, rest, updater) } : n));
}

export function insertChild(root: FsNode[], parentId: string | null, index: number, node: FsNode): FsNode[] {
  if (parentId === null) {
    const next = [...root];
    next.splice(index, 0, node);
    return next;
  }
  return updateNode(root, parentId, (n) => {
    const children = [...n.children];
    children.splice(index, 0, node);
    return { ...n, children };
  });
}

export function removeNode(root: FsNode[], id: string): FsNode[] {
  const path = findPath(root, id);
  if (!path) return root;
  const indices = path.map((p) => p.index);
  return removeByIndices(root, indices);
}

function removeByIndices(nodes: FsNode[], indices: number[]): FsNode[] {
  const [i, ...rest] = indices;
  if (rest.length === 0) return nodes.filter((_, idx) => idx !== i);
  return nodes.map((n, idx) => (idx === i ? { ...n, children: removeByIndices(n.children, rest) } : n));
}

export function moveNode(root: FsNode[], dragId: string, targetId: string, position: "before" | "after" | "into"): FsNode[] {
  if (dragId === targetId) return root;
  const dragPath = findPath(root, dragId);
  const targetPath = findPath(root, targetId);
  if (!dragPath || !targetPath) return root;

  const node = dragPath[dragPath.length - 1].node;

  // Cannot drop a node into itself or its own descendant.
  if (position === "into") {
    const isDescendant = targetPath.some((p) => p.node.id === dragId);
    if (isDescendant) return root;
  }

  let next = removeNode(root, dragId);

  // Re-resolve target after removal (indices may have shifted).
  const newTargetPath = findPath(next, targetId);
  if (!newTargetPath) return next;

  const target = newTargetPath[newTargetPath.length - 1];

  if (position === "into") {
    // Drop onto a folder -> becomes its last child (subtree travels with it).
    return replaceChildren(next, newTargetPath, [...target.node.children, node]);
  }

  // Insert as a sibling, into the container that holds the target.
  const parentPath = newTargetPath.slice(0, -1);
  const container = target.container;
  const arr = [...container];
  arr.splice(Math.max(0, Math.min(target.index + (position === "after" ? 1 : 0), arr.length)), 0, node);
  if (parentPath.length === 0) return arr;
  return replaceChildren(next, parentPath, arr);
}

function replaceChildren(root: FsNode[], path: Located[], children: FsNode[]): FsNode[] {
  const [head] = path;
  return path.length === 1
    ? root.map((n) => (n.id === head.node.id ? { ...n, children } : n))
    : root.map((n) => (n.id === path[0].node.id ? { ...n, children: replaceChildren(n.children, path.slice(1), children) } : n));
}

/** A new folder. It is marked as an explicit folder so renaming it to a dotted name keeps it one. */
export function makeFolder(name: string): FsNode {
  return { id: newId(), kind: "folder", name, forceFolder: true, children: [] };
}

/** A new file (a node whose name contains a dot). */
export function makeFile(name: string): FsNode {
  return { id: newId(), kind: "folder", name, children: [] };
}

export function makeInsert(template: string): FsNode {
  return { id: newId(), kind: "insert", name: template, children: [] };
}

/** Insert a new node relative to an existing one (used when dropping a template onto the tree). */
export function insertRelative(
  root: FsNode[],
  targetId: string,
  position: "before" | "after" | "into",
  node: FsNode,
): FsNode[] {
  const path = findPath(root, targetId);
  if (!path) return [...root, node];
  const target = path[path.length - 1];
  if (position === "into") return insertChild(root, targetId, target.node.children.length, node);
  const parent = path.length > 1 ? path[path.length - 2].node.id : null;
  return insertChild(root, parent, target.index + (position === "after" ? 1 : 0), node);
}

/** A template name is a single token in .fh: no spaces, no leading # or @. */
export function cleanTemplateName(raw: string): string {
  return raw.trim().replace(/\s+/g, "_").replace(/^[#@]+/, "");
}

/** Nodes in a tree, not counting @insert lines. */
export function countOwnNodes(nodes: FsNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === "insert" ? 0 : 1) + countOwnNodes(node.children), 0);
}

/** Number of @insert references to each template across a list of trees. */
export function countTemplateUses(trees: FsNode[][]): Record<string, number> {
  const uses: Record<string, number> = {};
  const walk = (nodes: FsNode[]) => {
    for (const n of nodes) {
      if (n.kind === "insert") uses[n.name] = (uses[n.name] ?? 0) + 1;
      walk(n.children);
    }
  };
  trees.forEach(walk);
  return uses;
}

/** Rewrite every @insert reference from `oldName` to `newName`. */
export function renameTemplateInTree(nodes: FsNode[], oldName: string, newName: string): FsNode[] {
  return nodes.map((n) => {
    const node: FsNode =
      n.kind === "insert" && n.name === oldName
        ? { ...n, name: newName }
        : n;
    return { ...node, children: renameTemplateInTree(node.children, oldName, newName) };
  });
}

/** Remove every @insert reference to `name` (used when deleting a template). */
export function removeTemplateRefs(nodes: FsNode[], name: string): FsNode[] {
  const result: FsNode[] = [];
  for (const n of nodes) {
    if (n.kind === "insert" && n.name === name) continue;
    result.push({ ...n, children: removeTemplateRefs(n.children, name) });
  }
  return result;
}
/**
 * The one rule for renaming a folder or file, shared by every view.
 * Returns the renamed node, an error message for the user, or null when
 * nothing changes. Renaming never turns a folder into a file: a folder given a
 * dotted name stays a folder (written as `name/` in the source).
 */
export function renamedNode(node: FsNode, raw: string): { node: FsNode } | { error: string } | null {
  // A trailing slash is the .fh way to say "folder"; it is not part of the name.
  const clean = raw.trim().replace(/[\\/]+$/, "").trim();
  if (!clean || clean === node.name) return null;
  if (/^[#@]/.test(clean) || clean.includes('"')) {
    return { error: "Names can't start with # or @, or contain quotes." };
  }
  const wasFolder = !isFileNode(node);
  const next: FsNode = { ...node, name: clean };
  if (wasFolder && isFileLike(clean)) next.forceFolder = true;
  else delete next.forceFolder;
  return { node: next };
}

/** Move a node one place up or down among its siblings. */
export function moveSibling(root: FsNode[], id: string, dir: -1 | 1): FsNode[] {
  const path = findPath(root, id);
  if (!path) return root;
  const here = path[path.length - 1];
  const target = here.index + dir;
  if (target < 0 || target >= here.container.length) return root;
  const parent = path.length > 1 ? path[path.length - 2].node.id : null;
  return insertChild(removeNode(root, id), parent, target, here.node);
}

/**
 * Move a node to the end of another folder (parentId), or of the top level
 * (null). Dropping a folder into itself or one of its own descendants is a
 * no-op.
 */
export function moveToParent(root: FsNode[], dragId: string, parentId: string | null): FsNode[] {
  const dragPath = findPath(root, dragId);
  if (!dragPath) return root;
  if (parentId !== null) {
    const targetPath = findPath(root, parentId);
    if (!targetPath || targetPath.some((p) => p.node.id === dragId)) return root;
  }
  const node = dragPath[dragPath.length - 1].node;
  return insertChild(removeNode(root, dragId), parentId, Number.MAX_SAFE_INTEGER, node);
}

/** Every folder, file and block line in a tree whose name contains `query` (case-insensitive), with its path. */
export interface FoundNode {
  node: FsNode;
  /** Ids from the top of the tree down to the node itself. */
  ids: string[];
  /** Names of the folders above it. */
  parents: string[];
}
export function findByName(root: FsNode[], query: string, limit = 50): FoundNode[] {
  const q = query.trim().toLowerCase();
  const out: FoundNode[] = [];
  if (!q) return out;
  const walk = (nodes: FsNode[], ids: string[], parents: string[]) => {
    for (const n of nodes) {
      if (out.length >= limit) return;
      if (n.name.toLowerCase().includes(q)) out.push({ node: n, ids: [...ids, n.id], parents });
      walk(n.children, [...ids, n.id], [...parents, n.name]);
    }
  };
  walk(root, [], []);
  return out;
}

/** Insert `node` right after the sibling with id `afterId`. */
export function insertAfter(root: FsNode[], afterId: string, node: FsNode): FsNode[] {
  return insertRelative(root, afterId, "after", node);
}

// ---- several things at once (multi-select) ----

/**
 * The selected nodes that matter for a move, delete or copy: in the order they
 * appear in the tree, leaving out anything that sits inside another selected
 * folder (it travels with that folder anyway) and any id that no longer exists.
 */
export function topLevelOf(root: FsNode[], ids: Iterable<string>): FsNode[] {
  const want = new Set(ids);
  const out: FsNode[] = [];
  const walk = (nodes: FsNode[]) => {
    for (const n of nodes) {
      if (want.has(n.id)) out.push(n);
      else walk(n.children);
    }
  };
  walk(root);
  return out;
}

/** Remove several nodes at once. */
export function removeNodes(root: FsNode[], ids: Iterable<string>): FsNode[] {
  const gone = new Set(ids);
  if (gone.size === 0) return root;
  const walk = (nodes: FsNode[]): FsNode[] =>
    nodes.filter((n) => !gone.has(n.id)).map((n) => (n.children.length ? { ...n, children: walk(n.children) } : n));
  return walk(root);
}

/**
 * Move several nodes next to, or into, a target. They land together, in the
 * order they had in the tree. Returns the same tree (a no-op) when the target
 * is one of the things being moved or sits inside one of them.
 */
export function moveNodes(root: FsNode[], ids: Iterable<string>, targetId: string, position: "before" | "after" | "into"): FsNode[] {
  const moving = topLevelOf(root, ids);
  if (moving.length === 0) return root;
  const targetPath = findPath(root, targetId);
  if (!targetPath) return root;
  const movingIds = new Set(moving.map((n) => n.id));
  if (targetPath.some((p) => movingIds.has(p.node.id))) return root;

  const next = removeNodes(root, movingIds);
  const path = findPath(next, targetId);
  if (!path) return root;
  const target = path[path.length - 1];
  if (position === "into") return replaceChildren(next, path, [...target.node.children, ...moving]);
  const arr = [...target.container];
  arr.splice(target.index + (position === "after" ? 1 : 0), 0, ...moving);
  const parentPath = path.slice(0, -1);
  return parentPath.length === 0 ? arr : replaceChildren(next, parentPath, arr);
}

/** Move several nodes to the end of a folder (or of the top level when parentId is null). */
export function moveNodesToParent(root: FsNode[], ids: Iterable<string>, parentId: string | null): FsNode[] {
  const moving = topLevelOf(root, ids);
  if (moving.length === 0) return root;
  const movingIds = new Set(moving.map((n) => n.id));
  if (parentId !== null) {
    const targetPath = findPath(root, parentId);
    if (!targetPath || targetPath.some((p) => movingIds.has(p.node.id))) return root;
  }
  const next = removeNodes(root, movingIds);
  if (parentId === null) return [...next, ...moving];
  const path = findPath(next, parentId);
  if (!path) return root;
  return replaceChildren(next, path, [...path[path.length - 1].node.children, ...moving]);
}

/**
 * Copy several nodes; each copy lands right after its original. `clone` makes
 * the copy (with fresh ids). Returns the new tree and the ids of the copies.
 */
export function duplicateNodes(root: FsNode[], ids: Iterable<string>, clone: (n: FsNode) => FsNode): { tree: FsNode[]; ids: string[] } {
  let tree = root;
  const made: string[] = [];
  for (const node of topLevelOf(root, ids)) {
    const copy = clone(node);
    tree = insertRelative(tree, node.id, "after", copy);
    made.push(copy.id);
  }
  return { tree, ids: made };
}
