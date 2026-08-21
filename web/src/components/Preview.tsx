import { useState } from "react";
import type { FsNode } from "../lib/types";
import { computeMaxDepth, gradientColor } from "../lib/resolver";
import { ChevronIcon, FileIcon, FolderIcon, FolderArrowIcon } from "./icons";

interface PreviewProps {
  tree: FsNode[];
  errors: string[];
}

const INDENT = 20;

export default function Preview({ tree, errors }: PreviewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const maxDepth = computeMaxDepth(tree);

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
    const isFile = node.name.includes(".");
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const color = gradientColor([47, 129, 247], [63, 185, 80], maxDepth ? depth / maxDepth : 0);

    return (
      <div key={node.id}>
        <div
          className={`preview-node ${hasChildren ? "clickable" : ""}`}
          style={{ marginLeft: depth * INDENT }}
          onClick={() => hasChildren && toggle(node.id)}
          title={hasChildren ? (isCollapsed ? "Click to expand" : "Click to collapse") : node.name}
        >
          <span className={`chev ${isCollapsed ? "rot" : ""}`}>
            {hasChildren && <ChevronIcon />}
          </span>
          <span className="node-icon" style={{ color: isFile ? "#7ee787" : "#2f81f7" }}>
            {isFile ? <FileIcon /> : hasChildren ? <FolderIcon /> : <FolderArrowIcon />}
          </span>
          <span className="name" style={{ color: isFile ? "#79c0ff" : color }} title={node.name}>
            {node.name}
          </span>
          {hasChildren && (
            <span className="badge" style={{ opacity: 0.6 }}>
              {node.children.length}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && node.children.map((c) => render(c, depth + 1))}
      </div>
    );
  };

  if (errors.length) {
    return (
      <div className="pane-body">
        <div className="issue-banner error">
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
        <div className="empty-hint">
          <div className="big">⚠️</div>
          Preview unavailable until errors are fixed.
        </div>
      </div>
    );
  }

  return (
    <div className="pane-body">
      {tree.length === 0 ? (
        <div className="empty-hint">
          <div className="big">🌳</div>
          Nothing to preview yet — add some folders first.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, padding: "8px 12px 0", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Fully resolved structure — what gets written to disk.</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button className="btn ghost" onClick={() => setAll(false)}>
                Expand all
              </button>
              <button className="btn ghost" onClick={() => setAll(true)}>
                Collapse all
              </button>
            </div>
          </div>
          <div className="preview-tree">{tree.map((n) => render(n, 0))}</div>
        </>
      )}
    </div>
  );
}