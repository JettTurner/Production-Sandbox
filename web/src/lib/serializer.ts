import type { FhDocument, FsNode } from "./types";

export function serializeFh(doc: FhDocument): string {
  const lines: string[] = [];
  lines.push(`@version ${doc.version || "1.0"}`);
  lines.push(`@name ${doc.name || "Untitled Structure"}`);
  lines.push("");

  lines.push("#---Root---");
  const rootColor = doc.templateColors?.["@root"];
  lines.push(rootColor ? `@root ${rootColor}` : "@root");
  appendTree(lines, doc.root, 0);
  lines.push("");

  if (doc.templateOrder.length) {
    lines.push("#---Templates---");
    for (const name of doc.templateOrder) {
      const tree = doc.templates[name];
      if (!tree) continue;
      const color = doc.templateColors?.[name];
      lines.push(color ? `@template ${name} ${color}` : `@template ${name}`);
      appendTree(lines, tree, 0);
      lines.push("");
    }
  }

  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

function appendTree(lines: string[], nodes: FsNode[], indent: number): void {
  for (const node of nodes) {
    const pad = "\t".repeat(indent);
    if (node.kind === "insert") {
      lines.push(`${pad}@insert ${node.name}`);
    } else {
      lines.push(`${pad}${node.name}${node.label ? ` "${node.label}"` : ""}`);
    }
    if (node.children.length) appendTree(lines, node.children, indent + 1);
  }
}