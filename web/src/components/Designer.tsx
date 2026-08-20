import { useState } from "react";
import type { FsNode } from "../lib/types";
import { makeFolder, makeInsert, moveNode, removeNode, updateNode, insertChild } from "../lib/treeEdit";
import { ChevronIcon, CopyIcon, FileIcon, FolderIcon, GripIcon, PlusIcon, XIcon } from "./icons";

export interface SectionRef {
  kind: "root" | "template";
  name?: string;
}

interface DesignerProps {
  nodes: FsNode[];
  section: SectionRef;
  templates: string[];
  onNodesChange: (nodes: FsNode[]) => void;
}

interface DropState {
  targetId: string;
  position: "before" | "after" | "into";
}

export default function Designer({ nodes, section, templates, onNodesChange }: DesignerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDrop = (targetId: string, position: DropState["position"]) => {
    if (dragId && dragId !== targetId) {
      onNodesChange(moveNode(nodes, dragId, targetId, position));
    }
    setDragId(null);
    setDropState(null);
  };

  const addChild = (parentId: string | null, kind: "folder" | "insert", index: number) => {
    const node = kind === "insert" ? makeInsert(templates[0] ?? "TEMPLATE") : makeFolder("New Folder");
    onNodesChange(insertChild(nodes, parentId, index, node));
    if (parentId) setCollapsed((prev) => { const n = new Set(prev); n.delete(parentId); return n; });
  };

  const remove = (id: string) => onNodesChange(removeNode(nodes, id));

  const rename = (id: string, name: string) => {
    if (name.trim() && name.trim() !== "") {
      onNodesChange(updateNode(nodes, id, (n) => ({ ...n, name: name.trim() })));
    }
  };

  const changeInsertTemplate = (id: string, template: string) => {
    onNodesChange(updateNode(nodes, id, (n) => ({ ...n, name: template })));
  };

  const duplicate = (id: string) => {
    const copy = structuredClone(findNode(nodes, id));
    if (!copy) return;
    copy.id = Math.random().toString(36).slice(2, 10);
    const parent = findParent(nodes, id);
    if (!parent) return;
    const siblings = parent.kind === "root" ? nodes : parent.node.children;
    const idx = siblings.findIndex((n) => n.id === id);
    onNodesChange(insertChild(nodes, parent.kind === "root" ? null : parent.node.id, idx + 1, copy));
  };

  const renderNode = (node: FsNode, depth: number) => {
    const isCollapsed = collapsed.has(node.id);
    const children = node.children;
    const insertable = node.kind === "folder";
    const dropTarget = dropState?.targetId === node.id ? dropState.position : null;

    return (
      <div key={node.id} style={{ paddingLeft: depth * 18 }}>
        <div
          className={`tree-row ${dragId === node.id ? "dragging" : ""} ${dropTarget ? "droppable" : ""}`}
          draggable={false}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const y = e.clientY - rect.top;
            const third = rect.height / 3;
            const position: DropState["position"] = y < third ? "before" : y > rect.height - third ? "after" : "into";
            if (!dropState || dropState.targetId !== node.id || dropState.position !== position) {
              setDropState({ targetId: node.id, position });
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              if (dropState?.targetId === node.id) setDropState(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(node.id, dropState?.targetId === node.id ? dropState.position : "into");
          }}
        >
          {insertable && children.length > 0 ? (
            <button className={`chev ${isCollapsed ? "rot" : ""}`} onClick={() => toggle(node.id)} title={isCollapsed ? "Expand" : "Collapse"}>
              <ChevronIcon />
            </button>
          ) : (
            <span className="chev" />
          )}
          <span
            className="drag"
            draggable
            onDragStart={(e) => {
              setDragId(node.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", node.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropState(null);
            }}
          >
            <GripIcon />
          </span>
          <span className={`node-icon ${node.kind === "folder" ? "folder" : "insert"}`}>
            {node.kind === "folder" ? (node.name.includes(".") ? <FileIcon /> : <FolderIcon />) : <CopyIcon />}
          </span>

          {node.kind === "insert" ? (
            <span className="insert-picker">
              <span className="name insert-name">@insert</span>
              <select
                value={node.name}
                onChange={(e) => changeInsertTemplate(node.id, e.target.value)}
                onDragOver={(e) => e.stopPropagation()}
              >
                {templates.length ? (
                  templates.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))
                ) : (
                  <option value={node.name}>{node.name}</option>
                )}
              </select>
            </span>
          ) : (
            <EditableName node={node} onCommit={(name) => rename(node.id, name)} />
          )}

          {node.kind === "folder" && (
            <span className="count">
              {children.length} {children.length === 1 ? "child" : "children"}
            </span>
          )}

          <span className="hover-actions">
            {insertable && (
              <>
                <IconButton title="Add subfolder" onClick={() => addChild(node.id, "folder", node.children.length)}>
                  <FolderIcon />
                </IconButton>
                {templates.length > 0 && (
                  <IconButton title="Insert template" onClick={() => addChild(node.id, "insert", node.children.length)}>
                    <CopyIcon />
                  </IconButton>
                )}
              </>
            )}
            <IconButton title="Duplicate" onClick={() => duplicate(node.id)}>
              <CopyIcon />
            </IconButton>
            <IconButton title="Delete" className="danger" onClick={() => remove(node.id)}>
              <XIcon />
            </IconButton>
          </span>
        </div>
        {insertable && !isCollapsed && children.length > 0 && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="designer-body">
      {nodes.length === 0 ? (
        <div className="empty-hint">
          <div className="big">📁</div>
          {section.kind === "root"
            ? "This structure is empty. Add your first top-level folder, or design in the code editor."
            : `Template "@${section.name}" is empty. Add folders to reuse them with @insert.`}
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => addChild(null, "folder", nodes.length)}>
              <PlusIcon /> Add folder
            </button>
          </div>
        </div>
      ) : (
        <>
          {nodes.map((n) => renderNode(n, 0))}
          <div style={{ display: "flex", gap: 8, padding: "12px 4px 4px" }}>
            <button className="btn ghost" onClick={() => addChild(null, "folder", nodes.length)}>
              <PlusIcon /> Add top-level folder
            </button>
            {templates.length > 0 && (
              <button className="btn ghost" onClick={() => addChild(null, "insert", nodes.length)}>
                <CopyIcon /> Insert template
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button className={`icon-btn ${className ?? ""}`} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function EditableName({ node, onCommit }: { node: FsNode; onCommit: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.name);

  if (editing) {
    return (
      <input
        className="name editing"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onCommit(value);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <span className="name" title={`${node.name}${node.label ? ` — ${node.label}` : ""}`} onDoubleClick={() => { setValue(node.name); setEditing(true); }}>
      {node.name}
      {node.label && <span className="label">{node.label}</span>}
    </span>
  );
}

function findNode(nodes: FsNode[], id: string): FsNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function findParent(
  nodes: FsNode[],
  id: string,
): { kind: "root" | "node"; node: FsNode } | null {
  if (nodes.some((n) => n.id === id)) return { kind: "root", node: null as unknown as FsNode };
  for (const n of nodes) {
    if (n.children.some((c) => c.id === id)) return { kind: "node", node: n };
    const found = findParent(n.children, id);
    if (found) return found;
  }
  return null;
}