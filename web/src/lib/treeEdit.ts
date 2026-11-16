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

/** Insert `node` right after the sibling with id `afterId`. */
export function insertAfter(root: FsNode[], afterId: string, node: FsNode): FsNode[] {
  return insertRelative(root, afterId, "after", node);
}
