import { useEffect, useRef, useState } from "react";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import {
  insertChild,
  makeFile,
  makeFolder,
  makeInsert,
  moveNode,
  moveSibling,
  moveToParent,
  removeNode,
  renamedNode,
  updateNode,
} from "../lib/treeEdit";
import { PlusDropdown, TEMPLATE_MIME } from "./Designer";
import type { AddSpec } from "./Designer";
import { NODE_MIME } from "./ColumnsView";
import type { DropPos, ViewProps } from "./ColumnsView";
import NameInput from "./NameInput";
import { ChevronIcon, FileIcon, FolderIcon, PencilIcon, PlusIcon, TemplatesIcon, XIcon } from "./icons";

const DEFAULT_COLOR = "#f0b35a";

/** Path of folder ids that ends inside the only top-level folder, if there is exactly one. */
function autoEnter(nodes: FsNode[]): string[] {
  const only = nodes.length === 1 && nodes[0].kind === "folder" && !isFileNode(nodes[0]) && nodes[0].children.length > 0;
  return only ? [nodes[0].id] : [];
}

/**
 * Blocks view: the folder you are in is shown as a board of cards, one per
 * folder, each listing what is inside it. Blocks (templates) are dragged in
 * from the sidebar and show up as colored bricks. Click a folder to go into it.
 *
 * Everything on the board can be dragged: onto a card to put it inside, onto
 * the edge of a card or row to place it before or after. Keyboard: arrows move
 * between things, Enter goes into a folder, Backspace goes back up, F2
 * renames, Del deletes, Alt+arrows reorder.
 */
export default function BlocksView({
  doc,
  section,
  colors,
  blockSizes,
  onRootChange,
  onTemplateNodesChange,
  onCreateTemplate,
  onOpenBlock,
  onNotice,
  reveal,
}: ViewProps) {
  const templateName = section.kind === "template" ? section.name! : null;
  const nodes = templateName ? doc.templates[templateName] ?? [] : doc.root;
  const commit = (next: FsNode[]) => (templateName ? onTemplateNodesChange(templateName, next) : onRootChange(next));

  const [loc, setLoc] = useState<string[]>(() => autoEnter(nodes));
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<{ parentId: string | null; anchor: HTMLElement } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; pos: DropPos } | null>(null);
  // The card the pointer is over while dragging: it shows a "Drop it here" zone.
  const [overCard, setOverCard] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Start inside the single top folder whenever a different section is opened.
  useEffect(() => {
    setLoc(autoEnter(nodes));
    setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  // Find: go to the folder that holds the node, then focus it.
  useEffect(() => {
    if (!reveal || reveal.ids.length === 0) return;
    // A node two levels down shows as a row inside a card, so stop one level higher.
    const depth = Math.max(0, reveal.ids.length - 2);
    setLoc(reveal.ids.slice(0, depth));
    setFocusId(reveal.ids[reveal.ids.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.seq]);

  useEffect(() => {
    if (!focusId) return;
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-nav][data-id="${CSS.escape(focusId)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
    setFocusId(null);
  }, [focusId, loc]);

  // Resolve the location; drop any part of it that no longer exists.
  const trail: FsNode[] = [];
  let here = nodes;
  for (const id of loc) {
    const n = here.find((x) => x.id === id);
    if (!n || n.kind !== "folder" || isFileNode(n)) break;
    trail.push(n);
    here = n.children;
  }
  const current = trail[trail.length - 1] ?? null;
  const hereId = current?.id ?? null;

  const enter = (path: FsNode[], focus?: string) => {
    setLoc(path.map((n) => n.id));
    setEditing(null);
    if (focus) setFocusId(focus);
  };

  const add = (parentId: string | null, spec: AddSpec) => {
    setMenu(null);
    if (spec.kind === "insert" && templateName === spec.template) return onNotice(`"${spec.template}" can't insert itself.`);
    const node =
      spec.kind === "insert" ? makeInsert(spec.template) : spec.kind === "file" ? makeFile("Untitled.txt") : makeFolder("New Folder");
    commit(insertChild(nodes, parentId, Number.MAX_SAFE_INTEGER, node));
    if (node.kind === "folder") setEditing({ id: node.id, value: node.name });
    else setFocusId(node.id);
  };

  const rename = (node: FsNode, value: string) => {
    setEditing(null);
    setFocusId(node.id);
    const result = renamedNode(node, value);
    if (!result) return;
    if ("error" in result) return onNotice(result.error);
    commit(updateNode(nodes, node.id, () => result.node));
  };

  const remove = (node: FsNode) => commit(removeNode(nodes, node.id));

  // ---- drag & drop: blocks from the sidebar, and anything on the board ----
  const endDrag = () => {
    setDrag(null);
    setDrop(null);
    setOverCard(null);
  };
  const draggingCard = !!drag && here.some((n) => n.id === drag);
  const accepts = (e: React.DragEvent) => !!drag || e.dataTransfer.types.includes(TEMPLATE_MIME);

  /** `id` null = the folder being shown. `zones` decides how the pointer position maps to before/after/into. */
  const dropProps = (id: string | null, zones: "card" | "row" | "into") => ({
    onDragOver: (e: React.DragEvent) => {
      if (!accepts(e) || drag === id) return;
      // While a whole card is being dragged, rows stay out of the way so the
      // card underneath decides (before / into / after).
      if (zones === "row" && id !== null && draggingCard && !here.some((n) => n.id === id)) return;
      e.preventDefault();
      e.stopPropagation();
      const fromSidebar = !drag;
      e.dataTransfer.dropEffect = fromSidebar ? "copy" : "move";
      let pos: DropPos = "into";
      const rect = e.currentTarget.getBoundingClientRect();
      if (zones === "row") pos = (e.clientY - rect.top) / rect.height < 0.5 ? "before" : "after";
      else if (zones === "card" && !fromSidebar) {
        const x = (e.clientX - rect.left) / rect.width;
        pos = x < 0.22 ? "before" : x > 0.78 ? "after" : "into";
      }
      const key = id ?? "@here";
      if (drop?.id !== key || drop.pos !== pos) setDrop({ id: key, pos });
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!accepts(e) || drag === id) return;
      if (zones === "row" && id !== null && draggingCard && !here.some((n) => n.id === id)) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = drop?.pos ?? "into";
      const moving = drag;
      const template = e.dataTransfer.getData(TEMPLATE_MIME);
      endDrag();
      if (moving) {
        if (id === null) commit(moveToParent(nodes, moving, hereId));
        else commit(moveNode(nodes, moving, id, pos));
        setFocusId(moving);
      } else if (template) {
        // A block from the sidebar: into a folder, or next to a row.
        if (id === null || pos === "into") add(id ?? hereId, { kind: "insert", template });
        else if (templateName === template) onNotice(`"${template}" can't insert itself.`);
        else commit(insertNear(id, pos, template));
      }
    },
  });
  // Insert a new block line before/after an existing node.
  const insertNear = (id: string, pos: DropPos, template: string): FsNode[] => {
    const node = makeInsert(template);
    const withNode = [...nodes, node]; // park it at the top level, then move it into place
    return moveNode(withNode, node.id, id, pos);
  };
  const dragProps = (node: FsNode) => ({
    draggable: editing?.id !== node.id,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData(NODE_MIME, node.id);
      e.dataTransfer.effectAllowed = "move";
      setDrag(node.id);
    },
    onDragEnd: endDrag,
  });
  const dropClass = (id: string) => `${drag === id ? "dragging" : ""} ${drop?.id === id ? `drop-${drop.pos}` : ""}`;

  // ---- keyboard ----
  const find = (id: string): { node: FsNode; parent: FsNode | null } | null => {
    for (const n of here) {
      if (n.id === id) return { node: n, parent: null };
      for (const c of n.children) if (c.id === id) return { node: c, parent: n };
    }
    return null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || e.ctrlKey || e.metaKey) return;
    const el = target.closest<HTMLElement>("[data-nav]");
    const all = Array.from(boardRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? []);
    const focusAt = (list: HTMLElement[], from: HTMLElement | null, step: number) => {
      const i = from ? list.indexOf(from) : -1;
      const next = list[i + step] ?? (i < 0 ? list[0] : undefined);
      if (next) {
        next.focus();
        next.scrollIntoView({ block: "nearest" });
      }
    };
    const found = el?.dataset.id ? find(el.dataset.id) : null;
    let handled = true;
    if (e.key === "Backspace" && trail.length > 0) enter(trail.slice(0, -1), current!.id);
    else if (!el) handled = false;
    else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowLeft") && found) {
      commit(moveSibling(nodes, found.node.id, -1));
      setFocusId(found.node.id);
    } else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowRight") && found) {
      commit(moveSibling(nodes, found.node.id, 1));
      setFocusId(found.node.id);
    } else if (e.key === "ArrowDown") focusAt(all, el, 1);
    else if (e.key === "ArrowUp") focusAt(all, el, -1);
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const cards = all.filter((x) => x.dataset.nav === "card");
      const card = el.dataset.nav === "card" ? el : el.closest<HTMLElement>(".card")?.querySelector<HTMLElement>('[data-nav="card"]') ?? null;
      focusAt(cards, card, e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "F2" && found && found.node.kind === "folder") setEditing({ id: found.node.id, value: found.node.name });
    else if ((e.key === "Delete") && found) {
      const i = all.indexOf(el);
      const neighbour = all[i + 1] ?? all[i - 1];
      remove(found.node);
      if (neighbour?.dataset.id) setFocusId(neighbour.dataset.id);
    } else if (e.key === "Enter" && found?.node.kind === "insert") onOpenBlock(found.node.name);
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const openMenu = (parentId: string | null, e: React.MouseEvent<HTMLElement>) => {
    const anchor = e.currentTarget;
    setMenu((m) => (m?.anchor === anchor ? null : { parentId, anchor }));
  };

  const nameInput = (node: FsNode) => (
    <NameInput
      value={editing!.value}
      onChange={(value) => setEditing({ id: node.id, value })}
      onCommit={(value) => rename(node, value)}
      onCancel={() => {
        setEditing(null);
        setFocusId(node.id);
      }}
    />
  );

  const brick = (node: FsNode, top: boolean) => {
    const color = colors[node.name] ?? DEFAULT_COLOR;
    const size = blockSizes[node.name];
    const missing = !doc.templates[node.name];
    return (
      <div
        key={node.id}
        className={`brick ${top ? "big" : ""} ${dropClass(node.id)}`}
        style={{ borderColor: color, color }}
        tabIndex={0}
        data-nav={top ? "card" : "item"}
        data-id={node.id}
        onDoubleClick={() => !missing && onOpenBlock(node.name)}
        title={missing ? `The block ${node.name} does not exist` : `Block ${node.name}. Enter or double-click to edit it.`}
        {...dragProps(node)}
        {...dropProps(node.id, top ? "card" : "row")}
      >
        <TemplatesIcon />
        <span className="brick-name">{node.name}</span>
        <span className="brick-size">{missing ? "missing" : `${size ?? 0} ${size === 1 ? "item" : "items"}`}</span>
        {!missing && (
          <button type="button" className="icon-btn" tabIndex={-1} title="Edit this block" aria-label={`Edit block ${node.name}`} onClick={() => onOpenBlock(node.name)}>
            <PencilIcon />
          </button>
        )}
        <button type="button" className="icon-btn danger" tabIndex={-1} title="Remove from here" aria-label={`Remove block ${node.name} from here`} onClick={() => remove(node)}>
          <XIcon />
        </button>
      </div>
    );
  };

  const tools = (node: FsNode) => (
    <>
      <button type="button" className="icon-btn" tabIndex={-1} title="Rename (F2)" aria-label={`Rename ${node.name}`} onClick={() => setEditing({ id: node.id, value: node.name })}>
        <PencilIcon />
      </button>
      <button type="button" className="icon-btn danger" tabIndex={-1} title="Delete (Del)" aria-label={`Delete ${node.name}`} onClick={() => remove(node)}>
        <XIcon />
      </button>
    </>
  );

  const itemRow = (parent: FsNode, node: FsNode) => {
    if (node.kind === "insert") return brick(node, false);
    const isFile = isFileNode(node);
    const isEditing = editing?.id === node.id;
    return (
      <div key={node.id} className={`card-item ${dropClass(node.id)}`} {...dragProps(node)} {...dropProps(node.id, "row")}>
        <span className="node-icon">{isFile ? <FileIcon /> : <FolderIcon />}</span>
        {isEditing ? (
          nameInput(node)
        ) : isFile ? (
          <span className="name" tabIndex={0} data-nav="item" data-id={node.id} title={node.name}>{node.name}</span>
        ) : (
          <button type="button" className="name-btn" data-nav="item" data-id={node.id} onClick={() => enter([...trail, parent, node])} title={`Go into ${node.name}`}>
            {node.name}
          </button>
        )}
        {!isFile && node.children.length > 0 && (
          <span className="more">
            {node.children.length}
            <ChevronIcon />
          </span>
        )}
        {tools(node)}
      </div>
    );
  };

  return (
    <div className="blocks-view">
      <nav className="crumbs" aria-label="Path">
        <button type="button" onClick={() => enter([])}>{templateName ?? "Root"}</button>
        {trail.map((n, i) => (
          <span key={n.id}>
            <ChevronIcon />
            <button type="button" onClick={() => enter(trail.slice(0, i + 1))}>{n.name}</button>
          </span>
        ))}
        <span className="crumbs-hint">
          {here.length} {here.length === 1 ? "thing" : "things"} here · click a folder’s name to go into it · drag to rearrange
        </span>
      </nav>

      <div
        ref={boardRef}
        className={`board ${drop?.id === "@here" ? "drop" : ""}`}
        onKeyDown={onKeyDown}
        {...dropProps(null, "into")}
      >
        {here.map((node) => {
          if (node.kind === "insert") return brick(node, true);
          const isEditing = editing?.id === node.id;
          if (isFileNode(node)) {
            return (
              <section key={node.id} className={`card file ${dropClass(node.id)}`} {...dragProps(node)} {...dropProps(node.id, "row")}>
                <div className="card-head">
                  <span className="node-icon file"><FileIcon /></span>
                  {isEditing ? nameInput(node) : <span className="card-title" tabIndex={0} data-nav="card" data-id={node.id} title={node.name}>{node.name}</span>}
                  {tools(node)}
                </div>
              </section>
            );
          }
          return (
            <section
              key={node.id}
              className={`card ${dropClass(node.id)}`}
              {...dragProps(node)}
              {...dropProps(node.id, "card")}
              onDragEnterCapture={(e) => {
                if (accepts(e) && drag !== node.id && overCard !== node.id) setOverCard(node.id);
              }}
              onDragOverCapture={(e) => {
                if (accepts(e) && drag !== node.id && overCard !== node.id) setOverCard(node.id);
              }}
              onDragLeave={(e) => {
                // Judge by position: relatedTarget is unreliable during a drag.
                const r = e.currentTarget.getBoundingClientRect();
                const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
                if (!inside) {
                  setOverCard((c) => (c === node.id ? null : c));
                  setDrop(null);
                }
              }}
            >
              <div className="card-head">
                <span className="node-icon"><FolderIcon size={18} /></span>
                {isEditing ? (
                  nameInput(node)
                ) : (
                  <button type="button" className="card-title name-btn" data-nav="card" data-id={node.id} onClick={() => enter([...trail, node])} title={`Go into ${node.name}`}>
                    {node.name}
                  </button>
                )}
                {/* Add lives with the other card tools: shown on hover or keyboard focus, not as a permanent row. */}
                <button
                  type="button"
                  className="icon-btn"
                  title={`Add something inside ${node.name}`}
                  aria-label={`Add inside ${node.name}`}
                  onClick={(e) => openMenu(node.id, e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <PlusIcon />
                </button>
                {tools(node)}
              </div>
              {node.children.map((child) => itemRow(node, child))}
              {overCard === node.id && (
                <div className={`drop-hint ${drop?.id === node.id && drop.pos === "into" ? "active" : ""}`} {...dropProps(node.id, "into")}>
                  Drop it here
                </div>
              )}
            </section>
          );
        })}
        <button type="button" className="card add-card" onClick={(e) => openMenu(hereId, e)} onMouseDown={(e) => e.stopPropagation()}>
          <PlusIcon size={18} />
          <span>{here.length === 0 ? "Add the first folder" : "Add a folder here"}</span>
          <small>or drag a block in from the left</small>
        </button>
      </div>

      {menu && (
        <PlusDropdown
          anchor={menu.anchor}
          targetLabel="here"
          templates={doc.templateOrder}
          onAdd={(spec) => add(menu.parentId, spec)}
          onAddTemplate={onCreateTemplate}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
