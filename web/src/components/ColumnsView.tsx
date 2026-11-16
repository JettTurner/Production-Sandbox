import { useEffect, useRef, useState } from "react";
import type { FhDocument, FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { cloneWithNewIds } from "../lib/ids";
import {
  insertAfter,
  insertChild,
  makeFile,
  makeFolder,
  makeInsert,
  moveSibling,
  removeNode,
  renamedNode,
  updateNode,
} from "../lib/treeEdit";
import { PlusDropdown, TEMPLATE_MIME } from "./Designer";
import type { AddSpec, SectionRef } from "./Designer";
import NameInput from "./NameInput";
import { ChevronIcon, CopyIcon, FileIcon, FolderIcon, PencilIcon, PlusIcon, TemplatesIcon, XIcon } from "./icons";

export interface ViewProps {
  doc: FhDocument;
  section: SectionRef;
  /** Display color per block. */
  colors: Record<string, string>;
  uses: Record<string, number>;
  /** Folders + files each block creates when resolved. */
  blockSizes: Record<string, number>;
  onRootChange: (nodes: FsNode[]) => void;
  onTemplateNodesChange: (template: string, nodes: FsNode[]) => void;
  onCreateTemplate: (name: string) => void;
  onOpenBlock: (name: string) => void;
  onNotice: (message: string) => void;
}

/** Which tree a column edits: the root, or a block's own contents. */
type Owner = { kind: "root" } | { kind: "template"; name: string };

interface Column {
  owner: Owner;
  /** Folder inside the owner's tree whose children this column lists (null = the owner's top level). */
  parentId: string | null;
  nodes: FsNode[];
  title: string;
}

const DEFAULT_COLOR = "#f0b35a";

/**
 * Columns view: one column per level, like a file browser. Selecting a folder
 * shows what is inside it in the next column; selecting a block shows the
 * block's contents (editing there edits the block everywhere it is used).
 */
export default function ColumnsView({
  doc,
  section,
  colors,
  uses,
  onRootChange,
  onTemplateNodesChange,
  onCreateTemplate,
  onOpenBlock,
  onNotice,
}: ViewProps) {
  const [sel, setSel] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<{ col: number; anchor: HTMLElement } | null>(null);
  const [dropCol, setDropCol] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const sectionOwner: Owner = section.kind === "template" ? { kind: "template", name: section.name! } : { kind: "root" };
  const ownerNodes = (o: Owner): FsNode[] => (o.kind === "root" ? doc.root : doc.templates[o.name] ?? []);
  const commit = (o: Owner, nodes: FsNode[]) => (o.kind === "root" ? onRootChange(nodes) : onTemplateNodesChange(o.name, nodes));

  // Walk the selection to build the columns.
  const columns: Column[] = [];
  {
    let owner: Owner = sectionOwner;
    let nodes = ownerNodes(owner);
    let parentId: string | null = null;
    let title = owner.kind === "root" ? "Top" : `Block ${owner.name}`;
    const chain = owner.kind === "template" ? [owner.name] : [];
    for (let i = 0; ; i++) {
      columns.push({ owner, parentId, nodes, title });
      const node = nodes.find((n) => n.id === sel[i]);
      if (!node) break;
      if (node.kind === "insert") {
        const tpl = doc.templates[node.name];
        if (!tpl || chain.includes(node.name)) break; // missing or circular: nothing to show
        chain.push(node.name);
        owner = { kind: "template", name: node.name };
        nodes = tpl;
        parentId = null;
        title = `Block ${node.name}`;
      } else if (isFileNode(node)) {
        break;
      } else {
        nodes = node.children;
        parentId = node.id;
        title = `In ${node.name}`;
      }
    }
  }
  const selected = columns.map((c, i) => c.nodes.find((n) => n.id === sel[i]));

  // Keep the newest column in view, and move focus when asked.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns.length]);
  useEffect(() => {
    if (!focusKey) return;
    scroller.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(focusKey)}"]`)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const select = (col: number, id: string, focus = false) => {
    setSel((prev) => [...prev.slice(0, col), id]);
    setActive(col);
    if (focus) setFocusKey(`${col}:${id}`);
  };

  const add = (col: number, spec: AddSpec) => {
    const c = columns[col];
    if (spec.kind === "insert" && c.owner.kind === "template" && c.owner.name === spec.template) {
      onNotice(`"${spec.template}" can't insert itself.`);
      setMenu(null);
      return;
    }
    const node =
      spec.kind === "insert" ? makeInsert(spec.template) : spec.kind === "file" ? makeFile("Untitled.txt") : makeFolder("New Folder");
    commit(c.owner, insertChild(ownerNodes(c.owner), c.parentId, c.nodes.length, node));
    setMenu(null);
    select(col, node.id);
    if (node.kind === "folder") setEditing({ id: node.id, value: node.name });
  };

  const rename = (col: number, node: FsNode, value: string) => {
    setEditing(null);
    const result = renamedNode(node, value);
    if (!result) return;
    if ("error" in result) return onNotice(result.error);
    const c = columns[col];
    commit(c.owner, updateNode(ownerNodes(c.owner), node.id, () => result.node));
    setFocusKey(`${col}:${node.id}`);
  };

  const remove = (col: number, node: FsNode) => {
    const c = columns[col];
    const at = c.nodes.findIndex((n) => n.id === node.id);
    const neighbour = c.nodes[at + 1] ?? c.nodes[at - 1];
    commit(c.owner, removeNode(ownerNodes(c.owner), node.id));
    if (neighbour) select(col, neighbour.id, true);
    else {
      setSel((prev) => prev.slice(0, col));
      setActive(Math.max(0, col - 1));
    }
  };

  const move = (col: number, node: FsNode, dir: -1 | 1) => {
    const c = columns[col];
    commit(c.owner, moveSibling(ownerNodes(c.owner), node.id, dir));
    setFocusKey(`${col}:${node.id}`);
  };

  const duplicate = (col: number, node: FsNode) => {
    const c = columns[col];
    const clone = cloneWithNewIds(node);
    commit(c.owner, insertAfter(ownerNodes(c.owner), node.id, clone));
    select(col, clone.id);
  };

  const dropBlock = (col: number, template: string, into?: FsNode) => {
    const c = columns[col];
    if (c.owner.kind === "template" && c.owner.name === template) return onNotice(`"${template}" can't insert itself.`);
    const node = makeInsert(template);
    if (into) {
      commit(c.owner, insertChild(ownerNodes(c.owner), into.id, into.children.length, node));
      select(col, into.id);
    } else {
      commit(c.owner, insertChild(ownerNodes(c.owner), c.parentId, c.nodes.length, node));
      select(col, node.id);
    }
  };

  const onKey = (e: React.KeyboardEvent, col: number, node: FsNode) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey) return;
    const c = columns[col];
    const at = c.nodes.findIndex((n) => n.id === node.id);
    let handled = true;
    if (e.altKey && e.key === "ArrowUp") move(col, node, -1);
    else if (e.altKey && e.key === "ArrowDown") move(col, node, 1);
    else if (e.key === "ArrowDown") {
      if (c.nodes[at + 1]) select(col, c.nodes[at + 1].id, true);
    } else if (e.key === "ArrowUp") {
      if (c.nodes[at - 1]) select(col, c.nodes[at - 1].id, true);
    } else if (e.key === "ArrowRight") {
      const next = columns[col + 1];
      if (next?.nodes[0]) select(col + 1, next.nodes[0].id, true);
    } else if (e.key === "ArrowLeft") {
      if (col > 0 && sel[col - 1]) {
        setSel((prev) => prev.slice(0, col));
        setActive(col - 1);
        setFocusKey(`${col - 1}:${sel[col - 1]}`);
      }
    } else if (e.key === "Enter" || e.key === "F2") {
      if (node.kind === "folder") setEditing({ id: node.id, value: node.name });
      else onOpenBlock(node.name);
    } else if (e.key === "Delete" || e.key === "Backspace") remove(col, node);
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className="columns-view">
      <nav className="crumbs" aria-label="Path">
        <button type="button" onClick={() => { setSel([]); setActive(0); }}>
          {section.kind === "root" ? "Root" : section.name}
        </button>
        {selected.map((n, i) =>
          n ? (
            <span key={n.id}>
              <ChevronIcon />
              <button type="button" onClick={() => select(i, n.id)}>{n.name}</button>
            </span>
          ) : null,
        )}
      </nav>
      <div className="columns" ref={scroller}>
        {columns.map((c, col) => {
          const block = c.owner.kind === "template" && !(col === 0 && section.kind === "template") ? c.owner.name : null;
          return (
            <section
              key={`${col}:${c.owner.kind === "template" ? c.owner.name : "root"}:${c.parentId ?? ""}`}
              className={`column ${dropCol === col ? "drop" : ""}`}
              aria-label={c.title}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(TEMPLATE_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (dropCol !== col) setDropCol(col);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCol(null);
              }}
              onDrop={(e) => {
                const template = e.dataTransfer.getData(TEMPLATE_MIME);
                setDropCol(null);
                if (!template) return;
                e.preventDefault();
                dropBlock(col, template);
              }}
            >
              <div className="column-title" title={c.title}>{c.title}</div>
              {block && (
                <div className="block-band" style={{ borderColor: colors[block] ?? DEFAULT_COLOR, color: colors[block] ?? DEFAULT_COLOR }}>
                  <TemplatesIcon />
                  <span>
                    Inside the block {block}
                    {(uses[block] ?? 0) > 1 ? `. A change here updates all ${uses[block]} places it is used.` : "."}
                  </span>
                </div>
              )}
              <div className="column-rows" role="listbox" aria-label={c.title}>
                {c.nodes.map((node, at) => {
                  const isSel = sel[col] === node.id;
                  const isActive = isSel && active === col;
                  const isFile = isFileNode(node);
                  const isInsert = node.kind === "insert";
                  const color = isInsert ? colors[node.name] ?? DEFAULT_COLOR : undefined;
                  const opens = isInsert ? !!doc.templates[node.name] : !isFile;
                  const count = isInsert ? doc.templates[node.name]?.length ?? 0 : node.children.length;
                  const isEditing = editing?.id === node.id;
                  return (
                    <div
                      key={node.id}
                      className={`col-row ${isSel ? "selected" : ""} ${isActive ? "active" : ""} ${isInsert ? "is-block" : ""}`}
                      style={color ? { borderColor: color } : undefined}
                      role="option"
                      aria-selected={isSel}
                      tabIndex={isSel || (!sel[col] && at === 0) ? 0 : -1}
                      data-row={`${col}:${node.id}`}
                      onClick={() => select(col, node.id)}
                      onDoubleClick={() => (isInsert ? onOpenBlock(node.name) : setEditing({ id: node.id, value: node.name }))}
                      onKeyDown={(e) => onKey(e, col, node)}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(TEMPLATE_MIME) || isInsert || isFile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        const template = e.dataTransfer.getData(TEMPLATE_MIME);
                        if (!template || isInsert || isFile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDropCol(null);
                        dropBlock(col, template, node);
                      }}
                      title={isInsert ? `Block ${node.name}. Double-click to edit the block.` : node.name}
                    >
                      <div className="col-row-main">
                        <span className="node-icon" style={color ? { color } : undefined}>
                          {isInsert ? <TemplatesIcon /> : isFile ? <FileIcon /> : <FolderIcon />}
                        </span>
                        {isEditing ? (
                          <NameInput
                            value={editing.value}
                            onChange={(value) => setEditing({ id: node.id, value })}
                            onCommit={(value) => rename(col, node, value)}
                            onCancel={() => setEditing(null)}
                          />
                        ) : (
                          <span className="name" style={color ? { color } : undefined}>{node.name}</span>
                        )}
                        {opens && (
                          <span className="more">
                            {count > 0 && count}
                            <ChevronIcon />
                          </span>
                        )}
                      </div>
                      {isActive && !isEditing && (
                        <div className="col-row-actions">
                          {isInsert ? (
                            <button type="button" className="icon-btn" title="Edit this block" aria-label="Edit this block" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onOpenBlock(node.name); }}>
                              <PencilIcon />
                            </button>
                          ) : (
                            <button type="button" className="icon-btn" title="Rename (F2)" aria-label="Rename" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setEditing({ id: node.id, value: node.name }); }}>
                              <PencilIcon />
                            </button>
                          )}
                          <button type="button" className="icon-btn" title="Move up" aria-label="Move up" tabIndex={-1} disabled={at === 0} onClick={(e) => { e.stopPropagation(); move(col, node, -1); }}>
                            <ChevronIcon className="up" />
                          </button>
                          <button type="button" className="icon-btn" title="Move down" aria-label="Move down" tabIndex={-1} disabled={at === c.nodes.length - 1} onClick={(e) => { e.stopPropagation(); move(col, node, 1); }}>
                            <ChevronIcon className="down" />
                          </button>
                          <button type="button" className="icon-btn" title="Duplicate" aria-label="Duplicate" tabIndex={-1} onClick={(e) => { e.stopPropagation(); duplicate(col, node); }}>
                            <CopyIcon />
                          </button>
                          <button type="button" className="icon-btn danger" title="Delete" aria-label="Delete" tabIndex={-1} onClick={(e) => { e.stopPropagation(); remove(col, node); }}>
                            <XIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {c.nodes.length === 0 && <p className="column-empty">Empty. Add something, or drag a block here.</p>}
              </div>
              <button
                type="button"
                className="add-dashed"
                onClick={(e) => {
                  const anchor = e.currentTarget;
                  setMenu((m) => (m?.anchor === anchor ? null : { col, anchor }));
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <PlusIcon /> Add
              </button>
            </section>
          );
        })}
      </div>
      {menu && columns[menu.col] && (
        <PlusDropdown
          anchor={menu.anchor}
          targetLabel="here"
          templates={doc.templateOrder}
          onAdd={(spec) => add(menu.col, spec)}
          onAddTemplate={onCreateTemplate}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
