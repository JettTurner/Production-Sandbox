import { useState } from "react";
import type { FhDocument } from "../lib/types";
import type { SectionRef } from "./Designer";
import { TEMPLATE_MIME } from "./Designer";
import { countOwnNodes } from "../lib/treeEdit";
import { describeStarter, starterBlocks } from "../lib/kit";
import type { StarterBlock } from "../lib/kit";
import { FolderIcon, PlusIcon, SearchIcon } from "./icons";

interface SidebarProps {
  doc: FhDocument;
  /** Display color per template (file colors plus palette fallbacks). */
  colors: Record<string, string>;
  section: SectionRef;
  /** @insert count per template name. */
  uses: Record<string, number>;
  /** Folders + files each block creates on its own. */
  blockSizes: Record<string, number>;
  onSelect: (section: SectionRef) => void;
  onAddTemplate: (name: string) => void;
  /** Add one of the ready-made starter blocks to this structure. */
  onAddStarter: (starter: StarterBlock) => void;
  /** Delete every block that is not used anywhere. */
  onRemoveUnused: (names: string[]) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DEFAULT_TEMPLATE_COLOR = "#f0b35a";

const STARTERS = starterBlocks().map((st) => ({ st, inside: describeStarter(st) }));
/** How many starter blocks show before "Show all". */
const STARTERS_SHOWN = 5;

/** Left column: the Root structure plus every block (template), always visible. */
export default function Sidebar({ doc, colors, section, uses, blockSizes, onSelect, onAddTemplate, onAddStarter, onRemoveUnused, className, style }: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [allStarters, setAllStarters] = useState(false);

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
  const unused = doc.templateOrder.filter((t) => !uses[t]);

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
        <div className="section-label">Blocks · {doc.templateOrder.length}</div>
        <button type="button" className="icon-btn boxed" title="Make a new block" aria-label="Make a new block" onClick={() => setAdding(true)}>
          <PlusIcon />
        </button>
      </div>

      {adding && (
        <input
          className="text-input"
          autoFocus
          aria-label="New block name"
          placeholder="Block name"
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
            aria-label="Filter blocks"
            placeholder="Filter blocks"
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
              className={`side-item two-line ${active ? "active" : ""}`}
              aria-current={active ? "true" : undefined}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TEMPLATE_MIME, name);
                e.dataTransfer.setData("text/plain", `@insert ${name}`);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onSelect({ kind: "template", name })}
              title={`${name}: used ${count} ${count === 1 ? "time" : "times"}. Drag it onto a folder to put it there.`}
            >
              <span className="side-dot" style={{ background: colors[name] ?? DEFAULT_TEMPLATE_COLOR }} />
              <span className="side-text">
                <span className="side-name">{name}</span>
                <span className="side-sub">
                  {blockSizes[name] ?? 0} {blockSizes[name] === 1 ? "item" : "items"} ·{" "}
                  {count === 0 ? "not used yet" : `used ${count} ${count === 1 ? "time" : "times"}`}
                </span>
              </span>
            </button>
          );
        })}
        {doc.templateOrder.length === 0 && (
          <p className="side-hint">
            A block is a ready-made set of folders you can reuse. Make one, or add a starter block below.
          </p>
        )}
        {doc.templateOrder.length > 0 && shown.length === 0 && <p className="side-hint">No block matches “{filter}”.</p>}
      </div>

      {doc.templateOrder.length > 0 && <p className="side-hint">Drag a block onto a folder to put it there.</p>}
      {unused.length > 0 && (
        <p className="side-hint tidy">
          {unused.length === 1 ? "1 block isn’t used anywhere." : `${unused.length} blocks aren’t used anywhere.`}{" "}
          <button type="button" className="link-btn" onClick={() => onRemoveUnused(unused)} title={`Remove: ${unused.join(", ")}`}>
            Remove {unused.length === 1 ? "it" : "them"}
          </button>
        </p>
      )}

      <div className="side-head">
        <div className="section-label">Starter blocks · {STARTERS.length}</div>
      </div>
      <div className="side-list">
        {(allStarters ? STARTERS : STARTERS.slice(0, STARTERS_SHOWN)).map(({ st, inside }) => (
          <div className="starter" key={st.name} title={`${st.title} contains:\n${inside}`}>
            <span className="starter-text">
              <b>{st.title}</b>
              <small>{st.hint}</small>
            </span>
            <button type="button" className="btn small" onClick={() => onAddStarter(st)} title={`Add the ${st.title} block to this structure`}>
              <PlusIcon /> Add
            </button>
          </div>
        ))}
      </div>
      <p className="side-hint">
        <button type="button" className="link-btn" aria-expanded={allStarters} onClick={() => setAllStarters(!allStarters)}>
          {allStarters ? "Show fewer" : `Show all ${STARTERS.length}`}
        </button>
      </p>
    </nav>
  );
}
