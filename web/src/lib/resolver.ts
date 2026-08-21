import type { FhDocument, FsNode, NodeKind } from "./types";
import { newId } from "./types";

export interface ResolveResult {
  tree: FsNode[];
  errors: string[];
}

export function resolveDoc(doc: FhDocument): ResolveResult {
  return resolveTree(doc.root, doc.templates);
}

export function resolveTree(root: FsNode[], templates: Record<string, FsNode[]>): ResolveResult {
  const errors: string[] = [];
  const tree = resolveNodes(root, templates, [], errors);
  return { tree, errors };
}

function resolveNodes(
  nodes: FsNode[],
  templates: Record<string, FsNode[]>,
  stack: string[],
  errors: string[],
): FsNode[] {
  return nodes.flatMap((n) => resolveNode(n, templates, stack, errors));
}

function resolveNode(
  node: FsNode,
  templates: Record<string, FsNode[]>,
  stack: string[],
  errors: string[],
): FsNode[] {
  if (node.kind === "insert") {
    const key = node.name;
    if (stack.includes(key)) {
      errors.push(`Circular @insert detected: ${[...stack, key].join(" -> ")}`);
      return [{ id: newId(), kind: "insert", name: key, children: [] }];
    }
    const template = templates[key];
    if (!template) {
      errors.push(`Template not found: "${key}"`);
      return [{ id: newId(), kind: "insert", name: key, children: [] }];
    }
    // Deposit the template's contents in place — no wrapper folder.
    return resolveNodes(template, templates, [...stack, key], errors);
  }

  return [
    {
      id: newId(),
      kind: "folder",
      name: node.name,
      label: node.label,
      children: resolveNodes(node.children, templates, stack, errors),
    },
  ];
}

/** Stats used by the preview header. */
export function countNodes(tree: FsNode[]): { folders: number; files: number; total: number } {
  let folders = 0;
  let files = 0;
  const walk = (nodes: FsNode[]) => {
    for (const n of nodes) {
      if (n.kind === "insert") continue;
      if (n.name.includes(".")) files++;
      else folders++;
      walk(n.children);
    }
  };
  walk(tree);
  return { folders, files, total: folders + files };
}

export function treeToText(tree: FsNode[], indent = 0): string[] {
  const lines: string[] = [];
  for (const node of tree) {
    lines.push("\t".repeat(indent) + node.name);
    if (node.children.length) lines.push(...treeToText(node.children, indent + 1));
  }
  return lines;
}

export function computeMaxDepth(tree: FsNode[]): number {
  const depth = (node: FsNode): number => {
    if (!node.children.length) return 0;
    return 1 + Math.max(...node.children.map(depth));
  };
  return tree.reduce((m, n) => Math.max(m, depth(n)), 0);
}

export type GradientColor = [number, number, number];
export function gradientColor(start: GradientColor, end: GradientColor, t: number): string {
  const r = Math.round(start[0] * (1 - t) + end[0] * t);
  const g = Math.round(start[1] * (1 - t) + end[1] * t);
  const b = Math.round(start[2] * (1 - t) + end[2] * t);
  return `rgb(${r},${g},${b})`;
}

export type { FsNode, NodeKind };