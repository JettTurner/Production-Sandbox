import type { FhDocument, FsNode } from "./types";
import { isFileLike } from "./types";

/**
 * FhDocument -> .fh text.
 *
 * Comments are part of the model (see parser.ts): each block of `#` lines is
 * written back directly above the thing it was attached to, so designer edits
 * and saves never drop them. Blank lines are normalized to one between
 * sections.
 */
export function serializeFh(doc: FhDocument): string {
  const lines: string[] = [];
  lines.push(...(doc.headerComments ?? []));
  lines.push(`@version ${doc.version || "1.0"}`);
  lines.push(`@name ${doc.name || "Untitled Structure"}`);
  lines.push("");

  lines.push(...(doc.rootComments ?? []));
  const rootColor = doc.templateColors?.["@root"];
  lines.push(rootColor ? `@root ${rootColor}` : "@root");
  appendTree(lines, doc.root, 0);
  lines.push("");

  for (const name of doc.templateOrder) {
    const tree = doc.templates[name];
    if (!tree) continue;
    lines.push(...(doc.templateComments?.[name] ?? []));
    const color = doc.templateColors?.[name];
    lines.push(color ? `@template ${name} ${color}` : `@template ${name}`);
    appendTree(lines, tree, 1);
    lines.push("");
  }

  lines.push(...(doc.trailingComments ?? []));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

function appendTree(lines: string[], nodes: FsNode[], indent: number): void {
  for (const node of nodes) {
    const pad = "\t".repeat(indent);
    for (const c of node.comments ?? []) lines.push(pad + c);
    if (node.kind === "insert") {
      lines.push(`${pad}@insert ${node.name}`);
    } else {
      // Only dotted names need the explicit-folder slash.
      const slash = node.forceFolder && isFileLike(node.name) ? "/" : "";
      lines.push(`${pad}${node.name}${slash}${node.label ? ` "${node.label}"` : ""}`);
    }
    if (node.children.length) appendTree(lines, node.children, indent + 1);
  }
}
