import { useState } from "react";
import { PencilIcon, PlusIcon, XIcon } from "./icons";

interface SectionPickerProps {
  templates: string[];
  active: string | null;
  onSelect: (name: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}

export default function SectionPicker({
  templates,
  active,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: SectionPickerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const commitAdd = () => {
    const n = newName.trim();
    if (n) onAdd(n);
    setNewName("");
    setAdding(false);
  };

  const commitRename = () => {
    if (renaming) onRename(renaming, editName.trim());
    setRenaming(null);
  };

  return (
    <div className="design-tools">
      {renaming ? (
        <input
          className="name-input small"
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(null);
            e.stopPropagation();
          }}
        />
      ) : (
        <select
          className="section-select"
          value={active ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          title="Edit a template"
        >
          <option value="">Template…</option>
          {templates.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      {active && !renaming && (
        <>
          <button
            className="icon-btn"
            title="Rename template"
            onClick={() => {
              setRenaming(active);
              setEditName(active);
            }}
          >
            <PencilIcon />
          </button>
          <button className="icon-btn danger" title="Delete template" onClick={() => onDelete(active)}>
            <XIcon />
          </button>
        </>
      )}

      {adding ? (
        <input
          className="name-input small"
          autoFocus
          placeholder="Template name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitAdd();
            if (e.key === "Escape") {
              setNewName("");
              setAdding(false);
            }
            e.stopPropagation();
          }}
        />
      ) : (
        <button className="btn" onClick={() => setAdding(true)} title="New reusable structure (template)">
          <PlusIcon /> Template
        </button>
      )}
    </div>
  );
}