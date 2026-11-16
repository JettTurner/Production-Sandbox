import { useEffect, useRef, useState } from "react";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { dropZone, keyAction, NODE_MIME, TEMPLATE_MIME } from "../lib/dnd";
import type { DropPos } from "../lib/dnd";
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
import { PlusDropdown } from "./Designer";
import type { AddSpec } from "./Designer";
import type { ViewProps } from "./ColumnsView";
import Crumbs from "./Crumbs";
import NameInput from "./NameInput";
import { FileIcon, FolderIcon, MoveIcon, PencilIcon, PlusIcon, TemplatesIcon, XIcon } from "./icons";

const DEFAULT_COLOR = "#f0b35a";

/** Path of folder ids that ends inside the only top-level folder, if there is exactly one. */
function autoEnter(nodes: FsNode[]): string[] {
  const only = nodes.length === 1 && nodes[0].kind === "folder" && !isFileNode(nodes[0]) && nodes[0].children.length > 0;
  return only ? [nodes[0].id] : [];
}

function findIn(nodes: FsNode[], id: string): FsNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findIn(n.children, id);
    if (hit) return hit;
  }
  return null;
}

/**
 * Blocks view: the folder you are in is a board of cards, one per folder.
 * Folders nest all the way down — a folder inside a card is a box inside that
 * card — so the whole shape is visible at once. Only real blocks (templates)
 * are drawn as colored bricks. Click a folder's name to make it the board.
 *
 * Everything can be dragged: onto a folder to put it inside, onto an edge to
 * place it before or after. Keyboard: arrows move between things, Enter goes
 * into a folder, Backspace goes back up, F2 renames, Del deletes, Alt+arrows
 * reorder. On touch, "Move" picks something up and the next tap puts it down.
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
  origins,
  onBackTo,
}: ViewProps) {
  const templateName = section.kind === "template" ? section.name! : null;
  const nodes = templateName ? doc.templates[templateName] ?? [] : doc.root;
  const commit = (next: FsNode[]) => (templateName ? onTemplateNodesChange(templateName, next) : onRootChange(next));

  const [loc, setLoc] = useState<string[]>(() => autoEnter(nodes));
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<{ parentId: string | null; anchor: HTMLElement } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; pos: DropPos } | null>(null);
  // The innermost folder the pointer is over while dragging: it shows a "Drop it here" zone.
  const [overBox, setOverBox] = useState<string | null>(null);
  // Touch "Move": the thing that has been picked up, waiting for a tap on where it goes.
  const [moving, setMoving] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Start inside the single top folder whenever a different section is opened.
  useEffect(() => {
    setLoc(autoEnter(nodes));
    setEditing(null);
    setMoving(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  // Find: show the folder that holds the node, then focus it.
  useEffect(() => {
    if (!reveal || reveal.ids.length === 0) return;
    setLoc(reveal.ids.slice(0, Math.max(0, reveal.ids.length - 2)));
    setFocusId(reveal.ids[reveal.ids.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.seq]);

  useEffect(() => {
    if (!focusId) return;
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-nav][data-id="${CSS.escape(focusId)}"]`);
    // Nothing to land on (an empty folder): keep the keyboard on the board itself.
    (el ?? boardRef.current)?.focus();
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
  const movingNode = moving ? findIn(nodes, moving) : null;

  const enter = (path: FsNode[], focus?: string) => {
    setLoc(path.map((n) => n.id));
    setEditing(null);
    // Keep the keyboard inside the board: land on the first thing in the new folder.
    const target = path[path.length - 1];
    setFocusId(focus ?? (target ? target.children : nodes)[0]?.id ?? "@board");
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

  /** Put the picked-up thing (touch Move) into a folder, or onto the board when parentId is the board's folder. */
  const putDown = (parentId: string | null) => {
    if (!moving) return;
    const next = moveToParent(nodes, moving, parentId);
    if (next === nodes) onNotice("It can't go inside itself.");
    else commit(next);
    setFocusId(moving);
    setMoving(null);
  };

  // ---- drag & drop: blocks from the sidebar, and anything on the board ----
  const endDrag = () => {
    setDrag(null);
    setDrop(null);
    setOverBox(null);
  };
  const draggingCard = !!drag && here.some((n) => n.id === drag);
  const accepts = (e: React.DragEvent) => !!drag || e.dataTransfer.types.includes(TEMPLATE_MIME);
  // While a whole card is dragged, things nested inside other cards stay out of
  // the way so the card underneath decides (before / into / after).
  const yields = (id: string | null) => id !== null && draggingCard && !here.some((n) => n.id === id);

  const insertNear = (id: string, pos: DropPos, template: string): FsNode[] => {
    const node = makeInsert(template);
    return moveNode([...nodes, node], node.id, id, pos); // park it at the top, then move it into place
  };

  /** `id` null = the board itself. `mode` decides how the pointer position maps to before / into / after. */
  const dropProps = (id: string | null, mode: "card" | "folder" | "row" | "into") => ({
    onDragOver: (e: React.DragEvent) => {
      if (!accepts(e) || drag === id || yields(id)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = drag ? "move" : "copy";
      // A block from the sidebar always goes into the card it is dropped on.
      const pos: DropPos = mode === "into" || (mode === "card" && !drag) ? "into" : dropZone(e, mode);
      const key = id ?? "@here";
      if (drop?.id !== key || drop.pos !== pos) setDrop({ id: key, pos });
    },
    onDrop: (e: React.DragEvent) => {
      if (!accepts(e) || drag === id || yields(id)) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = drop?.pos ?? "into";
      const dragged = drag;
      const template = e.dataTransfer.getData(TEMPLATE_MIME);
      endDrag();
      if (dragged) {
        commit(id === null ? moveToParent(nodes, dragged, hereId) : moveNode(nodes, dragged, id, pos));
        setFocusId(dragged);
      } else if (template) {
        if (id === null || pos === "into") add(id ?? hereId, { kind: "insert", template });
        else if (templateName === template) onNotice(`"${template}" can't insert itself.`);
        else commit(insertNear(id, pos, template));
      }
    },
  });
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
  /** Tracks which folder box the pointer is in while dragging (judged by position; relatedTarget is unreliable). */
  const overProps = (node: FsNode) => {
    const mark = (e: React.DragEvent) => {
      if (accepts(e) && drag !== node.id && !yields(node.id) && overBox !== node.id) setOverBox(node.id);
    };
    return {
      onDragEnterCapture: mark,
      onDragOverCapture: mark,
      onDragLeave: (e: React.DragEvent) => {
        const r = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
        if (!inside) {
          setOverBox((c) => (c === node.id ? null : c));
          setDrop(null);
        }
      },
    };
  };
  const stateClass = (id: string) =>
    `${drag === id ? "dragging" : ""} ${drop?.id === id ? `drop-${drop.pos}` : ""} ${moving === id ? "picked" : ""}`;

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    const action = keyAction(e);
    if (!action) return;
    const el = target.closest<HTMLElement>("[data-nav]");
    const all = Array.from(boardRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? []);
    const focusAt = (list: HTMLElement[], from: HTMLElement | null, step: number) => {
      const i = from ? list.indexOf(from) : -1;
      const next = list[i + step] ?? (i < 0 ? list[0] : undefined);
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };
    const node = el?.dataset.id ? findIn(here, el.dataset.id) : null;
    let handled = true;
    if (action === "back") {
      if (trail.length > 0) enter(trail.slice(0, -1), current!.id);
      else if (origins.length > 0) onBackTo(origins.length - 1);
      else handled = false;
    } else if (!el) handled = false;
    else if ((action === "moveUp" || action === "moveDown") && node) {
      commit(moveSibling(nodes, node.id, action === "moveUp" ? -1 : 1));
      setFocusId(node.id);
    } else if (action === "down") focusAt(all, el, 1);
    else if (action === "up") focusAt(all, el, -1);
    else if (action === "left" || action === "right") {
      const cards = all.filter((x) => x.dataset.nav === "card");
      const card = el.dataset.nav === "card" ? el : el.closest<HTMLElement>(".card")?.querySelector<HTMLElement>('[data-nav="card"]') ?? null;
      focusAt(cards, card, action === "right" ? 1 : -1);
    } else if (action === "rename" && node && node.kind === "folder") setEditing({ id: node.id, value: node.name });
    else if (action === "delete" && node) {
      const i = all.indexOf(el);
      const neighbour = all[i + 1] ?? all[i - 1];
      remove(node);
      if (neighbour?.dataset.id) setFocusId(neighbour.dataset.id);
    } else if (action === "open" && node?.kind === "insert") onOpenBlock(node.name);
    else handled = false; // Enter on a folder name is the button's own click
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

  const moveButton = (node: FsNode) => (
    <button
      type="button"
      className="icon-btn touch-only"
      tabIndex={-1}
      title="Move: then tap where it should go"
      aria-label={`Move ${node.name}`}
      onClick={() => setMoving(node.id)}
    >
      <MoveIcon />
    </button>
  );

  const tools = (node: FsNode) => (
    <>
      {moveButton(node)}
      <button type="button" className="icon-btn" tabIndex={-1} title="Rename (F2)" aria-label={`Rename ${node.name}`} onClick={() => setEditing({ id: node.id, value: node.name })}>
        <PencilIcon />
      </button>
      <button type="button" className="icon-btn danger" tabIndex={-1} title="Delete (Del)" aria-label={`Delete ${node.name}`} onClick={() => remove(node)}>
        <XIcon />
      </button>
    </>
  );

  /** A folder's name: normally "go into it"; while something is picked up, "put it in here". */
  const folderName = (node: FsNode, path: FsNode[], nav: "card" | "item", className: string) => (
    <button
      type="button"
      className={className}
      data-nav={nav}
      data-id={node.id}
      onClick={() => (moving ? (moving === node.id ? setMoving(null) : putDown(node.id)) : enter([...path, node]))}
      title={moving ? `Put it inside ${node.name}` : `Go into ${node.name}`}
    >
      {node.name}
    </button>
  );

  const brick = (node: FsNode, top: boolean) => {
    const color = colors[node.name] ?? DEFAULT_COLOR;
    const size = blockSizes[node.name];
    const missing = !doc.templates[node.name];
    return (
      <div
        key={node.id}
        className={`brick ${top ? "big" : ""} ${stateClass(node.id)}`}
        style={{ "--c": color } as React.CSSProperties}
        tabIndex={0}
        data-nav={top ? "card" : "item"}
        data-id={node.id}
        onDoubleClick={() => !missing && onOpenBlock(node.name)}
        title={missing ? `The block ${node.name} does not exist` : `Block ${node.name}. Enter or double-click to open it.`}
        {...dragProps(node)}
        {...dropProps(node.id, top ? "card" : "row")}
      >
        <TemplatesIcon />
        <span className="brick-name">{node.name}</span>
        <span className="brick-size">{missing ? "missing" : `${size ?? 0} ${size === 1 ? "item" : "items"}`}</span>
        {moveButton(node)}
        {!missing && (
          <button type="button" className="icon-btn" tabIndex={-1} title="Open this block" aria-label={`Open block ${node.name}`} onClick={() => onOpenBlock(node.name)}>
            <PencilIcon />
          </button>
        )}
        <button type="button" className="icon-btn danger" tabIndex={-1} title="Remove from here" aria-label={`Remove block ${node.name} from here`} onClick={() => remove(node)}>
          <XIcon />
        </button>
      </div>
    );
  };

  /** Anything on the board. `path` is the folders above it (from the top of the section). */
  const renderNode = (node: FsNode, path: FsNode[], top: boolean): React.ReactNode => {
    if (node.kind === "insert") return brick(node, top);
    const isEditing = editing?.id === node.id;

    if (isFileNode(node)) {
      const name = isEditing ? (
        nameInput(node)
      ) : (
        <span className={top ? "card-title" : "name"} tabIndex={0} data-nav={top ? "card" : "item"} data-id={node.id} title={node.name}>
          {node.name}
        </span>
      );
      return top ? (
        <section key={node.id} className={`card file ${stateClass(node.id)}`} {...dragProps(node)} {...dropProps(node.id, "card")}>
          <div className="card-head">
            <span className="node-icon file"><FileIcon /></span>
            {name}
            {tools(node)}
          </div>
        </section>
      ) : (
        <div key={node.id} className={`card-item ${stateClass(node.id)}`} {...dragProps(node)} {...dropProps(node.id, "row")}>
          <span className="node-icon file"><FileIcon /></span>
          {name}
          {tools(node)}
        </div>
      );
    }

    // An empty folder inside a card is just a row; anything with contents is a box.
    if (!top && node.children.length === 0) {
      return (
        <div key={node.id} className={`card-item ${stateClass(node.id)}`} {...dragProps(node)} {...dropProps(node.id, "folder")}>
          <span className="node-icon"><FolderIcon /></span>
          {isEditing ? nameInput(node) : folderName(node, path, "item", "name-btn")}
          <button type="button" className="icon-btn" tabIndex={-1} title={`Add something inside ${node.name}`} aria-label={`Add inside ${node.name}`} onClick={(e) => openMenu(node.id, e)} onMouseDown={(e) => e.stopPropagation()}>
            <PlusIcon />
          </button>
          {tools(node)}
        </div>
      );
    }

    const Box = top ? "section" : "div";
    return (
      <Box
        key={node.id}
        className={`${top ? "card" : "subcard"} ${stateClass(node.id)}`}
        {...dragProps(node)}
        {...dropProps(node.id, top ? "card" : "folder")}
        {...overProps(node)}
      >
        <div className="card-head">
          <span className="node-icon"><FolderIcon size={top ? 18 : 14} /></span>
          {isEditing ? nameInput(node) : folderName(node, path, top ? "card" : "item", top ? "card-title name-btn" : "name-btn")}
          {/* Add lives with the other tools: shown on hover or keyboard focus, not as a permanent row. */}
          <button type="button" className="icon-btn" title={`Add something inside ${node.name}`} aria-label={`Add inside ${node.name}`} onClick={(e) => openMenu(node.id, e)} onMouseDown={(e) => e.stopPropagation()}>
            <PlusIcon />
          </button>
          {tools(node)}
        </div>
        {node.children.map((child) => renderNode(child, [...path, node], false))}
        {overBox === node.id && (
          <div className={`drop-hint ${drop?.id === node.id && drop.pos === "into" ? "active" : ""}`} {...dropProps(node.id, "into")}>
            Drop it here
          </div>
        )}
      </Box>
    );
  };

  return (
    <div className="blocks-view">
      <Crumbs
        origins={origins}
        onBackTo={onBackTo}
        section={section}
        onSectionRoot={() => enter([])}
        trail={trail.map((n, i) => ({ key: n.id, label: n.name, onClick: () => enter(trail.slice(0, i + 1)) }))}
        hint={`${here.length} ${here.length === 1 ? "thing" : "things"} here · click a folder’s name to go into it · drag to rearrange`}
      />

      {movingNode && (
        <div className="move-banner" role="status">
          <span>
            Moving <b>{movingNode.name}</b>. Tap the folder it should go into, or tap the empty board to put it here.
          </span>
          <button type="button" className="btn small" onClick={() => setMoving(null)}>
            Cancel
          </button>
        </div>
      )}

      <div
        ref={boardRef}
        tabIndex={-1}
        className={`board ${drop?.id === "@here" ? "drop" : ""} ${moving ? "placing" : ""}`}
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (moving && e.target === e.currentTarget) putDown(hereId);
        }}
        {...dropProps(null, "into")}
      >
        {here.map((node) => renderNode(node, trail, true))}
        <button type="button" className="card add-card" onClick={(e) => (moving ? putDown(hereId) : openMenu(hereId, e))} onMouseDown={(e) => e.stopPropagation()}>
          <PlusIcon size={18} />
          <span>{moving ? "Put it here" : here.length === 0 ? "Add the first folder" : "Add a folder here"}</span>
          {!moving && <small>or drag a block in from the left</small>}
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
