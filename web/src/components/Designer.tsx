import { useEffect, useState } from "react";
import type { FsNode } from "../lib/types";
import { makeFolder, makeInsert, removeNode, insertChild } from "../lib/treeEdit";
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

interface EditState {
  path: number[];
  value: string;
}

type AddSpec =
  | { kind: "folder" }
  | { kind: "file" }
  | { kind: "insert"; template: string };

export default function Designer({ nodes, section, templates, onNodesChange }: DesignerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

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

  const addNode = (parentId: string | null, spec: AddSpec) => {
    const node =
      spec.kind === "insert"
        ? makeInsert(spec.template)
        : makeFolder(spec.kind === "file" ? "Untitled.txt" : "New Folder");
    const parent = parentId ? findNode(nodes, parentId) : null;
    const siblings = parent ? parent.children : nodes;
    const newTree = insertChild(nodes, parentId, siblings.length, node);
    onNodesChange(newTree);
    setMenuFor(null);
    const path = pathOf(newTree, node.id);
    setEditing(path ? { path, value: node.name } : null);
    if (parentId) setCollapsed((prev) => { const n = new Set(prev); n.delete(parentId); return n; });
  };

  const renameAt = (path: number[], name: string) => {
    if (name.trim()) onNodesChange(renameByPath(nodes, path, name.trim()));
    setEditing(null);
  };

  const duplicateAt = (path: number[], node: FsNode) => {
    const clone = structuredClone(node);
    clone.id = Math.random().toString(36).slice(2, 10);
    const newTree = insertChild(nodes, path.length ? parentIdAt(nodes, path) : null, path[path.length - 1] + 1, clone);
    onNodesChange(newTree);
    const newPath = pathOf(newTree, clone.id);
    setEditing(newPath ? { path: newPath, value: clone.name } : null);
  };

  const deleteAt = (path: number[]) => {
    const id = nodeAt(nodes, path)?.id;
    if (id) onNodesChange(removeNode(nodes, id));
    if (editing && pathsEqual(path, editing.path)) setEditing(null);
  };

  const moveAt = (path: number[], dir: -1 | 1) => {
    const loc = locatedAt(nodes, path);
    if (!loc) return;
    const siblings = loc.container;
    const target = loc.index + dir;
    if (target < 0 || target >= siblings.length) return;
    const next = removeNode(nodes, loc.node.id);
    onNodesChange(insertChild(next, path.length ? parentIdAt(nodes, path) : null, target, loc.node));
  };

  const renderNode = (node: FsNode, depth: number, path: number[]) => {
    const isCollapsed = collapsed.has(node.id);
    const children = node.children;
    const insertable = node.kind === "folder";
    const dropTarget = dropState?.targetId === node.id ? dropState.position : null;
    const isEditing = editing ? pathsEqual(path, editing.path) : false;

    return (
      <div key={node.id} style={{ paddingLeft: depth * 20 }}>
        <div
          className={`tree-row ${dragId === node.id ? "dragging" : ""} ${dropTarget ? "droppable" : ""}`}
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
                onChange={(e) => onNodesChange(updateName(nodes, node.id, e.target.value))}
                onDragOver={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
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
            <NodeName
              node={node}
              editing={isEditing}
              value={isEditing && editing ? editing.value : node.name}
              onChange={(v) => setEditing({ path, value: v })}
              onStart={() => setEditing({ path, value: node.name })}
              onCommit={(name) => renameAt(path, name)}
            />
          )}

          {node.kind === "folder" && (
            <span className="count">
              {children.length} {children.length === 1 ? "child" : "children"}
            </span>
          )}

          <span className="hover-actions">
            <IconButton title="Add…" onClick={() => setMenuFor(menuFor === node.id ? null : node.id)}>
              <PlusIcon />
            </IconButton>
            <IconButton title="Move up" onClick={() => moveAt(path, -1)}>
              <ChevronIcon className="up" />
            </IconButton>
            <IconButton title="Move down" onClick={() => moveAt(path, 1)}>
              <ChevronIcon className="down" />
            </IconButton>
            <IconButton title="Duplicate" onClick={() => duplicateAt(path, node)}>
              <CopyIcon />
            </IconButton>
            <IconButton title="Delete" className="danger" onClick={() => deleteAt(path)}>
              <XIcon />
            </IconButton>
          </span>
        </div>

        {menuFor === node.id && (
          <div style={{ padding: "4px 0 4px 12px" }}>
            <PlusMenu
              templates={templates}
              onAdd={(spec) => addNode(node.id, spec)}
              isRoot={false}
            />
          </div>
        )}

        {insertable && !isCollapsed && children.length > 0 && children.map((c, i) => renderNode(c, depth + 1, [...path, i]))}
      </div>
    );
  };

  return (
    <div className="designer-body">
      {nodes.length === 0 ? (
        <div className="empty-hint">
          <div className="big">📁</div>
          {section.kind === "root"
            ? "Design the root structure — add folders, files, or reusable structures."
            : `Template "@${section.name}" is empty — add folders or insert another template.`}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6 }}>
            <PlusMenu templates={templates} onAdd={(s) => addNode(null, s)} isRoot />
          </div>
        </div>
      ) : (
        <>
          {nodes.map((n, i) => renderNode(n, 0, [i]))}
          <div className="designer-footer">
            <PlusMenu templates={templates} onAdd={(s) => addNode(null, s)} isRoot />
          </div>
        </>
      )}
    </div>
  );
}

function PlusMenu({
  templates,
  onAdd,
  isRoot,
}: {
  templates: string[];
  onAdd: (spec: AddSpec) => void;
  isRoot: boolean;
}) {
  const [template, setTemplate] = useState(templates[0] ?? "");
  useEffect(() => {
    setTemplate((t) => (templates.includes(t) ? t : templates[0] ?? ""));
  }, [templates]);

  return (
    <div className="plus-menu" onMouseDown={(e) => e.stopPropagation()}>
      <button className="btn" onClick={() => onAdd({ kind: "folder" })}>
        <FolderIcon /> Folder
      </button>
      <button className="btn" onClick={() => onAdd({ kind: "file" })}>
        <FileIcon /> File
      </button>
      <span className="plus-insert">
        <CopyIcon />
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--purple)" }}>@insert</span>
        {templates.length ? (
          <>
            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={() => onAdd({ kind: "insert", template })} title="Insert structure">
              Insert
            </button>
          </>
        ) : (
          <span className="muted-note">no structures yet — add one in Insert Structures</span>
        )}
      </span>
      {isRoot && (
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Add to {isRoot ? "top level" : "this folder"}</span>
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
    <button className={`icon-btn ${className ?? ""}`} title={title} onClick={onClick} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </button>
  );
}

function NodeName({
  node,
  editing,
  value,
  onChange,
  onStart,
  onCommit,
}: {
  node: FsNode;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  onCommit: (name: string) => void;
}) {
  if (editing) {
    return (
      <input
        className="name editing"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(value);
          if (e.key === "Escape") onCommit(node.name);
          e.stopPropagation();
        }}
      />
    );
  }
  return (
    <span className="name" title={node.name} onDoubleClick={onStart}>
      {node.name}
      {node.label && <span className="label">{node.label}</span>}
    </span>
  );
}

// ---------- path helpers ----------
function nodeAt(nodes: FsNode[], path: number[]): FsNode | null {
  let list = nodes;
  let node: FsNode | null = null;
  for (const i of path) {
    if (!list[i]) return null;
    node = list[i];
    list = node.children;
  }
  return node;
}

function parentIdAt(nodes: FsNode[], path: number[]): string | null {
  if (path.length <= 1) return null;
  return nodeAt(nodes, path.slice(0, -1))?.id ?? null;
}

function locatedAt(nodes: FsNode[], path: number[]): { container: FsNode[]; index: number; node: FsNode } | null {
  if (path.length === 1) {
    return { container: nodes, index: path[0], node: nodes[path[0]] };
  }
  const parent = nodeAt(nodes, path.slice(0, -1));
  if (!parent) return null;
  const i = path[path.length - 1];
  return { container: parent.children, index: i, node: parent.children[i] };
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function pathOf(nodes: FsNode[], id: string, acc: number[] = []): number[] | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return [...acc, i];
    const found = pathOf(nodes[i].children, id, [...acc, i]);
    if (found) return found;
  }
  return null;
}

function findNode(nodes: FsNode[], id: string): FsNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function updateName(nodes: FsNode[], id: string, name: string): FsNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, name } : { ...n, children: updateName(n.children, id, name) }));
}

function renameByPath(nodes: FsNode[], path: number[], name: string): FsNode[] {
  if (path.length === 1) {
    return nodes.map((n, i) => (i === path[0] ? { ...n, name } : n));
  }
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: renameByPath(n.children, path.slice(1), name) } : n,
  );
}

function moveNode(nodes: FsNode[], dragId: string, targetId: string, position: "before" | "after" | "into"): FsNode[] {
  if (dragId === targetId) return nodes;
  const dragPath = pathOf(nodes, dragId);
  const targetPath = pathOf(nodes, targetId);
  if (!dragPath || !targetPath) return nodes;
  const dragged = nodeAt(nodes, dragPath)!;
  const isDescendant = targetPath.length > dragPath.length && dragPath.every((v, i) => targetPath[i] === v);
  if (position === "into" && isDescendant) return nodes;
  const next = removeNode(nodes, dragId);
  const newTargetPath = pathOf(next, targetId);
  if (!newTargetPath) return next;
  if (position === "into") {
    return insertInto(next, newTargetPath, dragged, 0);
  }
  const index = newTargetPath[newTargetPath.length - 1] + (position === "after" ? 1 : 0);
  return insertInto(next, newTargetPath, dragged, index);
}

function insertInto(nodes: FsNode[], targetPath: number[], node: FsNode, offset: number): FsNode[] {
  if (targetPath.length === 1) {
    const arr = [...nodes];
    arr.splice(targetPath[0] + offset, 0, node);
    return arr;
  }
  return nodes.map((n, i) => {
    if (i !== targetPath[0]) return n;
    const children = insertInto(n.children, targetPath.slice(1), node, offset);
    return { ...n, children };
  });
}