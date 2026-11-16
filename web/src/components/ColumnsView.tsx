import { useEffect, useRef, useState } from "react";
import type { FhDocument, FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { cloneWithNewIds } from "../lib/ids";
import {
  insertAfter,
  insertChild,
  moveNode,
  moveToParent,
  makeFile,
  makeFolder,
  makeInsert,
  moveSibling,
  removeNode,
  renamedNode,
  updateNode,
} from "../lib/treeEdit";
import { dropZone, keyAction, NODE_MIME, TEMPLATE_MIME } from "../lib/dnd";
import type { DropPos } from "../lib/dnd";
import { PlusDropdown } from "./Designer";
import type { AddSpec, SectionRef } from "./Designer";
import Crumbs from "./Crumbs";
import NameInput from "./NameInput";
import { ChevronIcon, CopyIcon, FileIcon, FolderIcon, MoveIcon, PencilIcon, PlusIcon, TemplatesIcon, XIcon } from "./icons";

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
  /** Ask the view to show and focus a node (from Find): ids from the top of the section down to it. */
  reveal?: { ids: string[]; seq: number } | null;
  /** Sections the user came through to get here; shown at the start of the path so there is a way back. */
  origins: SectionRef[];
  onBackTo: (index: number) => void;
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
  reveal,
  origins,
  onBackTo,
}: ViewProps) {
  // Touch "Move": the row that has been picked up, waiting for a tap on where it goes.
  const [moving, setMoving] = useState<{ id: string; owner: string; name: string } | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; owner: string } | null>(null);
  const [dropRow, setDropRow] = useState<{ id: string; pos: DropPos } | null>(null);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<{ col: number; anchor: HTMLElement } | null>(null);
  const [dropCol, setDropCol] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const sectionOwner: Owner = section.kind === "template" ? { kind: "template", name: section.name! } : { kind: "root" };
  const ownerKey = (o: Owner) => (o.kind === "root" ? "@root" : o.name);
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

  // Find: open the columns down to the node and focus it.
  useEffect(() => {
    if (!reveal || reveal.ids.length === 0) return;
    setSel(reveal.ids);
    setActive(reveal.ids.length - 1);
    setFocusKey(`${reveal.ids.length - 1}:${reveal.ids[reveal.ids.length - 1]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.seq]);

  const endDrag = () => {
    setDrag(null);
    setDropRow(null);
    setDropCol(null);
  };

  /** Put the picked-up row into a folder of the same tree (or the column's own level when parentId is given). */
  const putDown = (col: number, parentId: string | null) => {
    const c = columns[col];
    if (!moving) return;
    if (ownerKey(c.owner) !== moving.owner) {
      onNotice("That is inside a different block. Move it within the same block, or use Find.");
    } else {
      const next = moveToParent(ownerNodes(c.owner), moving.id, parentId);
      if (next === ownerNodes(c.owner)) onNotice("It can't go inside itself.");
      else commit(c.owner, next);
    }
    setMoving(null);
  };

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
    if (e.target !== e.currentTarget) return;
    const action = keyAction(e);
    if (!action) return;
    const c = columns[col];
    const at = c.nodes.findIndex((n) => n.id === node.id);
    if (action === "moveUp") move(col, node, -1);
    else if (action === "moveDown") move(col, node, 1);
    else if (action === "down") {
      if (c.nodes[at + 1]) select(col, c.nodes[at + 1].id, true);
    } else if (action === "up") {
      if (c.nodes[at - 1]) select(col, c.nodes[at - 1].id, true);
    } else if (action === "right") {
      const next = columns[col + 1];
      if (next?.nodes[0]) select(col + 1, next.nodes[0].id, true);
    } else if (action === "left") {
      if (col > 0 && sel[col - 1]) {
        setSel((prev) => prev.slice(0, col));
        setActive(col - 1);
        setFocusKey(`${col - 1}:${sel[col - 1]}`);
      }
    } else if (action === "rename" || action === "open") {
      if (node.kind === "folder") setEditing({ id: node.id, value: node.name });
      else onOpenBlock(node.name);
    } else remove(col, node); // delete, back
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="columns-view">
      <Crumbs
        origins={origins}
        onBackTo={onBackTo}
        section={section}
        onSectionRoot={() => {
          setSel([]);
          setActive(0);
        }}
        trail={selected.flatMap((n, i) => (n ? [{ key: n.id, label: n.name, onClick: () => select(i, n.id) }] : []))}
      />
      {moving && (
        <div className="move-banner" role="status">
          <span>
            Moving <b>{moving.name}</b>. Tap the folder it should go into, or a column’s title to put it at that level.
          </span>
          <button type="button" className="btn small" onClick={() => setMoving(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className="columns" ref={scroller}>
        {columns.map((c, col) => {
          const block = c.owner.kind === "template" && !(col === 0 && section.kind === "template") ? c.owner.name : null;
          return (
            <section
              key={`${col}:${c.owner.kind === "template" ? c.owner.name : "root"}:${c.parentId ?? ""}`}
              className={`column ${dropCol === col ? "drop" : ""} ${block ? "in-block" : ""}`}
              style={block ? ({ "--c": colors[block] ?? DEFAULT_COLOR } as React.CSSProperties) : undefined}
              aria-label={c.title}
              onDragOver={(e) => {
                const moving = drag && drag.owner === ownerKey(c.owner);
                if (!moving && !e.dataTransfer.types.includes(TEMPLATE_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = moving ? "move" : "copy";
                if (dropCol !== col) setDropCol(col);
                if (dropRow) setDropRow(null);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCol(null);
              }}
              onDrop={(e) => {
                const template = e.dataTransfer.getData(TEMPLATE_MIME);
                const moving = drag && drag.owner === ownerKey(c.owner) ? drag : null;
                endDrag();
                if (template) {
                  e.preventDefault();
                  dropBlock(col, template);
                } else if (moving) {
                  // Dropped on the column itself: move to the end of this level.
                  e.preventDefault();
                  commit(c.owner, moveToParent(ownerNodes(c.owner), moving.id, c.parentId));
                  setSel((prev) => prev.slice(0, col));
                }
              }}
            >
              {/* A column that shows a block's contents is boxed in the block's color. */}
              <div
                className={`column-title ${moving ? "placing" : ""}`}
                onClick={() => moving && putDown(col, c.parentId)}
                title={
                  block
                    ? `Inside the block ${block}.${(uses[block] ?? 0) > 1 ? ` A change here updates all ${uses[block]} places it is used.` : ""}`
                    : c.title
                }
              >
                {block && <TemplatesIcon />}
                <span>{c.title}</span>
              </div>
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
                      className={`col-row ${isSel ? "selected" : ""} ${isActive ? "active" : ""} ${isInsert ? "is-block" : ""} ${drag?.id === node.id ? "dragging" : ""} ${dropRow?.id === node.id ? `drop-${dropRow.pos}` : ""} ${moving?.id === node.id ? "picked" : ""}`}
                      draggable={!isEditing}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData(NODE_MIME, node.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDrag({ id: node.id, owner: ownerKey(c.owner) });
                      }}
                      onDragEnd={endDrag}
                      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
                      role="option"
                      aria-selected={isSel}
                      tabIndex={isSel || (!sel[col] && at === 0) ? 0 : -1}
                      data-row={`${col}:${node.id}`}
                      onClick={() => {
                        if (moving && moving.id !== node.id && !isInsert && !isFile) putDown(col, node.id);
                        else select(col, node.id);
                      }}
                      onDoubleClick={() => (isInsert ? onOpenBlock(node.name) : setEditing({ id: node.id, value: node.name }))}
                      onKeyDown={(e) => onKey(e, col, node)}
                      onDragOver={(e) => {
                        const moving = drag && drag.owner === ownerKey(c.owner) && drag.id !== node.id;
                        if (moving) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          const pos: DropPos = dropZone(e, isInsert || isFile ? "row" : "folder");
                          if (dropRow?.id !== node.id || dropRow.pos !== pos) setDropRow({ id: node.id, pos });
                          if (dropCol !== null) setDropCol(null);
                          return;
                        }
                        if (!e.dataTransfer.types.includes(TEMPLATE_MIME) || isInsert || isFile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        const moving = drag && drag.owner === ownerKey(c.owner) && drag.id !== node.id ? drag : null;
                        if (moving) {
                          e.preventDefault();
                          e.stopPropagation();
                          const pos = dropRow?.id === node.id ? dropRow.pos : "after";
                          endDrag();
                          commit(c.owner, moveNode(ownerNodes(c.owner), moving.id, node.id, pos));
                          if (pos === "into") select(col, node.id);
                          else setSel((prev) => [...prev.slice(0, col), moving.id]);
                          return;
                        }
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
                        <span className="node-icon">
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
                          <span className="name">{node.name}</span>
                        )}
                        {opens && (
                          <span className="more">
                            {count > 0 && count}
                            <ChevronIcon />
                          </span>
                        )}
                      </div>
                      {!isEditing && (
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
                          <button type="button" className="icon-btn touch-only" title="Move: then tap where it should go" aria-label="Move" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setMoving({ id: node.id, owner: ownerKey(c.owner), name: node.name }); }}>
                            <MoveIcon />
                          </button>
                          <button type="button" className="icon-btn touch-only" title="Move up" aria-label="Move up" tabIndex={-1} disabled={at === 0} onClick={(e) => { e.stopPropagation(); move(col, node, -1); }}>
                            <ChevronIcon className="up" />
                          </button>
                          <button type="button" className="icon-btn touch-only" title="Move down" aria-label="Move down" tabIndex={-1} disabled={at === c.nodes.length - 1} onClick={(e) => { e.stopPropagation(); move(col, node, 1); }}>
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
                className={`add-dashed ${c.nodes.length === 0 || menu?.col === col ? "show" : ""}`}
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
