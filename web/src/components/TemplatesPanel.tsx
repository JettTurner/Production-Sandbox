import { useMemo, useState } from "react";
import type { FhDocument, FsNode } from "../lib/types";
import { PlusIcon, SparkleIcon, XIcon } from "./icons";

interface TemplatesPanelProps {
  doc: FhDocument;
  activeTemplate: string | null;
  onSelect: (name: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}

export default function TemplatesPanel({
  doc,
  activeTemplate,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: TemplatesPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const usage = useMemo(() => countInsertUsage(doc), [doc]);
  const templates = doc.templateOrder;

  const commitAdd = () => {
    const name = newName.trim();
    if (name) onAdd(name);
    setNewName("");
    setAdding(false);
  };

  const commitRename = (oldName: string) => {
    const name = editName.trim();
    if (name && name !== oldName) onRename(oldName, name);
    setEditing(null);
  };

  return (
    <div className="tpl-list">
      {templates.length === 0 && (
        <div className="empty-hint" style={{ padding: 16 }}>
          No templates yet. Templates are reusable subtrees you insert with <b>@insert</b> — great for clients,
          projects, and asset libraries.
        </div>
      )}
      {templates.map((name) => (
        <div
          key={name}
          className={`tpl-item ${activeTemplate === name ? "active" : ""}`}
          onClick={() => onSelect(activeTemplate === name ? null : name)}
          onDoubleClick={() => {
            setEditing(name);
            setEditName(name);
          }}
        >
          {editing === name ? (
            <input
              className="name editing"
              style={{ flex: 1 }}
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => commitRename(name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(name);
                if (e.key === "Escape") setEditing(null);
                e.stopPropagation();
              }}
            />
          ) : (
            <>
              <SparkleIcon size={12} />
              <span className="tpl-name">{name}</span>
              <span className="tpl-count">
                {doc.templates[name]?.length ?? 0} item{((doc.templates[name]?.length ?? 0) === 1 ? "" : "s")} · used{" "}
                {usage.get(name) ?? 0}x
              </span>
              <button
                className="icon-btn danger"
                title="Delete template"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(name);
                }}
              >
                <XIcon />
              </button>
            </>
          )}
        </div>
      ))}
      {adding ? (
        <div style={{ display: "flex", gap: 6, padding: "6px 10px", alignItems: "center" }}>
          <input
            autoFocus
            className="name editing"
            style={{ flex: 1 }}
            placeholder="Template name (e.g. PROJECT)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") {
                setNewName("");
                setAdding(false);
              }
            }}
          />
        </div>
      ) : (
        <button className="btn ghost" style={{ margin: "6px 10px" }} onClick={() => setAdding(true)}>
          <PlusIcon /> New template
        </button>
      )}
    </div>
  );
}

function countInsertUsage(doc: FhDocument): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (nodes: FsNode[]) => {
    for (const n of nodes) {
      if (n.kind === "insert") counts.set(n.name, (counts.get(n.name) ?? 0) + 1);
      walk(n.children);
    }
  };
  walk(doc.root);
  for (const tree of Object.values(doc.templates)) walk(tree);
  return counts;
}