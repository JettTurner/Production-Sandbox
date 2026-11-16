import { useState } from "react";
import type { FhDocument } from "../lib/types";
import type { SectionRef } from "./Designer";
import { TEMPLATE_MIME } from "./Designer";
import { countOwnNodes } from "../lib/treeEdit";
import { FolderIcon, PlusIcon, SearchIcon } from "./icons";

interface SidebarProps {
  doc: FhDocument;
  /** Display color per template (file colors plus palette fallbacks). */
  colors: Record<string, string>;
  section: SectionRef;
  /** @insert count per template name. */
  uses: Record<string, number>;
  onSelect: (section: SectionRef) => void;
  onAddTemplate: (name: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DEFAULT_TEMPLATE_COLOR = "#f0b35a";

/** Left column: the Root structure plus every template, always visible. */
export default function Sidebar({ doc, colors, section, uses, onSelect, onAddTemplate, className, style }: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const commitAdd = () => {
    const name = newName.trim();
    if (name) onAddTemplate(name);
    setNewName("");
    setAdding(false);
  };

  const q = filter.trim().toLowerCase();
  const shown = q ? doc.templateOrder.filter((t) => t.toLowerCase().includes(q)) : doc.templateOrder;
  const rootActive = section.kind === "root";
  const rootCount = countOwnNodes(doc.root);

  return (
    <nav className={`sidebar ${className ?? ""}`} style={style} aria-label="Structure">
      <div className="section-label">Structure</div>
      <button
        type="button"
        className={`side-item ${rootActive ? "active" : ""}`}
        aria-current={rootActive ? "true" : undefined}
        onClick={() => onSelect({ kind: "root" })}
      >
        <span className="side-icon"><FolderIcon /></span>
        <span className="side-name sans">Root</span>
        <span className="side-meta">{rootCount} {rootCount === 1 ? "item" : "items"}</span>
      </button>

      <div className="side-head">
        <div className="section-label">Templates · {doc.templateOrder.length}</div>
        <button type="button" className="icon-btn boxed" title="New template" aria-label="New template" onClick={() => setAdding(true)}>
          <PlusIcon />
        </button>
      </div>

      {adding && (
        <input
          className="text-input"
          autoFocus
          aria-label="New template name"
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
      )}

      {doc.templateOrder.length > 6 && (
        <label className="search-field">
          <SearchIcon />
          <input
            aria-label="Filter templates"
            placeholder="Filter templates"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
      )}

      <div className="side-list">
        {shown.map((name) => {
          const active = section.kind === "template" && section.name === name;
          const count = uses[name] ?? 0;
          return (
            <button
              type="button"
              key={name}
              className={`side-item ${active ? "active" : ""}`}
              aria-current={active ? "true" : undefined}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TEMPLATE_MIME, name);
                e.dataTransfer.setData("text/plain", `@insert ${name}`);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onSelect({ kind: "template", name })}
              title={`${name}: inserted ${count} ${count === 1 ? "time" : "times"}. Drag onto a folder to insert it.`}
            >
              <span className="side-dot" style={{ background: colors[name] ?? DEFAULT_TEMPLATE_COLOR }} />
              <span className="side-name">{name}</span>
              <span className={`side-meta ${count === 0 ? "unused" : ""}`}>{count === 0 ? "unused" : `${count}×`}</span>
            </button>
          );
        })}
        {doc.templateOrder.length === 0 && (
          <p className="side-hint">
            Templates are reusable sets of folders. Create one, then insert it wherever it is needed.
          </p>
        )}
        {doc.templateOrder.length > 0 && shown.length === 0 && <p className="side-hint">No template matches “{filter}”.</p>}
      </div>

      {doc.templateOrder.length > 0 && <p className="side-hint drag-hint">Drag a template onto a folder to insert it there.</p>}
    </nav>
  );
}
