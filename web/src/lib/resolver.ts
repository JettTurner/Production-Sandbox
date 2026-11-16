import type { FhDocument, FsNode, NodeKind } from "./types";
import { isFileNode } from "./types";

export interface ResolveResult {
  tree: FsNode[];
  errors: string[];
}

export function resolveDoc(doc: FhDocument): ResolveResult {
  return resolveTree(doc.root, doc.templates);
}

/**
 * Expands every @insert in place (no wrapper folder).
 *
 * Resolved node ids are derived from the source node ids plus the chain of
 * @insert nodes they were expanded through, so they are stable across edits
 * (collapse state in the preview survives) and unique even when one template
 * is inserted many times.
 */
export function resolveTree(root: FsNode[], templates: Record<string, FsNode[]>): ResolveResult {
  const errors: string[] = [];
  const tree = resolveNodes(root, templates, [], errors, "", undefined);
  return { tree, errors };
}

function resolveNodes(
  nodes: FsNode[],
  templates: Record<string, FsNode[]>,
  stack: string[],
  errors: string[],
  prefix: string,
  from: string | undefined,
): FsNode[] {
  return nodes.flatMap((n) => resolveNode(n, templates, stack, errors, prefix, from));
}

function resolveNode(
  node: FsNode,
  templates: Record<string, FsNode[]>,
  stack: string[],
  errors: string[],
  prefix: string,
  from: string | undefined,
): FsNode[] {
  const id = prefix + node.id;
  if (node.kind === "insert") {
    const key = node.name;
    if (stack.includes(key)) {
      errors.push(`Circular @insert detected: ${[...stack, key].join(" -> ")}`);
      return [{ id, kind: "insert", name: key, children: [] }];
    }
    const template = templates[key];
    if (!template) {
      errors.push(`Template not found: "${key}"`);
      return [{ id, kind: "insert", name: key, children: [] }];
    }
    // Deposit the template's contents in place — no wrapper folder.
    return resolveNodes(template, templates, [...stack, key], errors, `${id}>`, key);
  }

  const out: FsNode = {
    id,
    kind: "folder",
    name: node.name,
    children: resolveNodes(node.children, templates, stack, errors, prefix, from),
  };
  if (node.label) out.label = node.label;
  if (node.forceFolder) out.forceFolder = true;
  if (from) out.from = from;
  return [out];
}

/** Stats used by the output panel. */
export interface TreeStats {
  folders: number;
  files: number;
  total: number;
  /** Deepest nesting measured in levels (root = 1); 0 when the tree is empty. */
  maxDepth: number;
  /** Most nodes on any single level — the tree's widest branching point; 0 when empty. */
  maxWidth: number;
}

export function countNodes(tree: FsNode[]): TreeStats {
  let folders = 0;
  let files = 0;
  let levels = 0;
  let maxWidth = 0;
  let queue: FsNode[] = [...tree];
  while (queue.length) {
    levels++;
    maxWidth = Math.max(maxWidth, queue.length);
    const next: FsNode[] = [];
    for (const n of queue) {
      if (n.kind === "insert") continue;
      if (isFileNode(n)) files++;
      else {
        folders++;
        next.push(...n.children);
      }
    }
    queue = next;
  }
  return { folders, files, total: folders + files, maxDepth: levels, maxWidth };
}

export function treeToText(tree: FsNode[], indent = 0): string[] {
  const lines: string[] = [];
  for (const node of tree) {
    lines.push("\t".repeat(indent) + node.name);
    if (node.children.length) lines.push(...treeToText(node.children, indent + 1));
  }
  return lines;
}

export type { FsNode, NodeKind };
