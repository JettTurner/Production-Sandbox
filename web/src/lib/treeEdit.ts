import type { FsNode } from "./types";

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
  const [head] = path;
  const next = [...head.container];
  next[head.index] = updater(next[head.index]);
  return next;
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
  const [head] = path;
  const next = [...head.container];
  next.splice(head.index, 1);
  return next;
}

export function moveNode(root: FsNode[], dragId: string, targetId: string, position: "before" | "after" | "into"): FsNode[] {
  if (dragId === targetId) return root;
  const dragPath = findPath(root, dragId);
  const targetPath = findPath(root, targetId);
  if (!dragPath || !targetPath) return root;

  const node = dragPath[0].node;

  // Cannot drop a node into itself or its own descendant.
  if (position === "into") {
    const isDescendant = targetPath.some((p) => p.node.id === dragId);
    if (isDescendant) return root;
  }

  let next = removeNode(root, dragId);

  // Re-resolve target after removal (indices may have shifted).
  const newTargetPath = findPath(next, targetId);
  if (!newTargetPath) return next;

  const [target] = newTargetPath;
  const insertInto = (container: FsNode[], index: number): FsNode[] => {
    const arr = [...container];
    arr.splice(Math.max(0, Math.min(index, arr.length)), 0, node);
    return arr;
  };

  if (position === "into") {
    return replaceChildren(next, newTargetPath, insertInto(target.node.children, target.node.children.length));
  }

  let index = target.index + (position === "after" ? 1 : 0);
  // If dragId was before target in the same container, the removal shifted the target left.
  if (target.container === dragPath[0].container && dragPath[0].index < target.index) index -= 1;
  return replaceChildren(next, newTargetPath, insertInto(target.container, index));
}

function replaceChildren(root: FsNode[], path: Located[], children: FsNode[]): FsNode[] {
  const [head] = path;
  return path.length === 1
    ? root.map((n) => (n.id === head.node.id ? { ...n, children } : n))
    : root.map((n) => (n.id === path[0].node.id ? { ...n, children: replaceChildren(n.children, path.slice(1), children) } : n));
}

export function makeFolder(name: string): FsNode {
  return { id: Math.random().toString(36).slice(2, 10), kind: "folder", name, children: [] };
}

export function makeInsert(template: string): FsNode {
  return { id: Math.random().toString(36).slice(2, 10), kind: "insert", name: template, children: [] };
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