import { useMemo, useState } from "react";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { ChevronIcon, FileIcon, FolderIcon } from "./icons";

interface PreviewProps {
  /** The planned tree: resolved, with same-name siblings merged. */
  tree: FsNode[];
  templateColors: Record<string, string>;
}

const INDENT = 16;
const DEFAULT_TEMPLATE_COLOR = "#f0b35a";

function sortNodes(nodes: FsNode[]): FsNode[] {
  const sorted = [...nodes].sort((a, b) => {
    const aFile = isFileNode(a);
    const bFile = isFileNode(b);
    if (aFile !== bFile) return aFile ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
  return sorted.map((n) => ({ ...n, children: sortNodes(n.children) }));
}

/** Read-only view of exactly what will be created. */
export default function Preview({ tree, templateColors }: PreviewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortAlpha, setSortAlpha] = useState(false);
  const displayTree = useMemo(() => (sortAlpha ? sortNodes(tree) : tree), [tree, sortAlpha]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAll = (collapse: boolean) => {
    const all: string[] = [];
    const walk = (nodes: FsNode[]) => {
      for (const n of nodes) {
        if (n.children.length) {
          all.push(n.id);
          walk(n.children);
        }
      }
    };
    walk(tree);
    setCollapsed(new Set(collapse ? all : []));
  };

  const render = (node: FsNode, depth: number) => {
    const isFile = isFileNode(node);
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const row = (
      <>
        <span className={`chev ${isCollapsed ? "rot" : ""}`}>{hasChildren && <ChevronIcon />}</span>
        <span className={`node-icon ${isFile ? "file" : "folder"}`}>{isFile ? <FileIcon /> : <FolderIcon />}</span>
        <span className="name">{node.name}</span>
        {node.from && (
          <span
            className="from-dot"
            style={{ background: templateColors[node.from] ?? DEFAULT_TEMPLATE_COLOR }}
            role="img"
            aria-label={`from the block ${node.from}`}
            title={`From the block ${node.from}`}
          />
        )}
        {hasChildren && <span className="badge">{node.children.length}</span>}
      </>
    );
    return (
      <div key={node.id}>
        {hasChildren ? (
          <button
            type="button"
            className="preview-node clickable"
            style={{ paddingLeft: 8 + depth * INDENT }}
            onClick={() => toggle(node.id)}
            aria-expanded={!isCollapsed}
            title={node.name}
          >
            {row}
          </button>
        ) : (
          <div className="preview-node" style={{ paddingLeft: 8 + depth * INDENT }} title={node.name}>
            {row}
          </div>
        )}
        {hasChildren && !isCollapsed && node.children.map((c) => render(c, depth + 1))}
      </div>
    );
  };

  if (tree.length === 0) {
    return <div className="empty-hint">Nothing to create yet. Add some folders first.</div>;
  }

  return (
    <>
      <div className="preview-toolbar">
        <span className="section-label">Resolved preview</span>
        <div className="preview-tools">
          <button
            type="button"
            className={`link-btn ${sortAlpha ? "active" : ""}`}
            onClick={() => setSortAlpha((s) => !s)}
            aria-pressed={sortAlpha}
            title="Sort alphabetically (folders first). Off shows the order they are defined in."
          >
            A–Z
          </button>
          <button type="button" className="link-btn" onClick={() => setAll(false)}>
            Expand all
          </button>
          <button type="button" className="link-btn" onClick={() => setAll(true)}>
            Collapse all
          </button>
        </div>
      </div>
      <div className="preview-tree">{displayTree.map((n) => render(n, 0))}</div>
    </>
  );
}
