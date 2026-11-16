import { useEffect, useState } from "react";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { insertChild, makeFile, makeFolder, makeInsert, removeNode, renamedNode, updateNode } from "../lib/treeEdit";
import { PlusDropdown, TEMPLATE_MIME } from "./Designer";
import type { AddSpec } from "./Designer";
import type { ViewProps } from "./ColumnsView";
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
}: ViewProps) {
  const templateName = section.kind === "template" ? section.name! : null;
  const nodes = templateName ? doc.templates[templateName] ?? [] : doc.root;
  const commit = (next: FsNode[]) => (templateName ? onTemplateNodesChange(templateName, next) : onRootChange(next));

  const [loc, setLoc] = useState<string[]>(() => autoEnter(nodes));
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<{ parentId: string | null; anchor: HTMLElement } | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  // Start inside the single top folder whenever a different section is opened.
  useEffect(() => {
    setLoc(autoEnter(nodes));
    setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

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

  const enter = (path: FsNode[]) => {
    setLoc(path.map((n) => n.id));
    setEditing(null);
  };

  const add = (parentId: string | null, spec: AddSpec) => {
    setMenu(null);
    if (spec.kind === "insert" && templateName === spec.template) return onNotice(`"${spec.template}" can't insert itself.`);
    const node =
      spec.kind === "insert" ? makeInsert(spec.template) : spec.kind === "file" ? makeFile("Untitled.txt") : makeFolder("New Folder");
    commit(insertChild(nodes, parentId, Number.MAX_SAFE_INTEGER, node));
    if (node.kind === "folder") setEditing({ id: node.id, value: node.name });
  };

  const rename = (node: FsNode, value: string) => {
    setEditing(null);
    const result = renamedNode(node, value);
    if (!result) return;
    if ("error" in result) return onNotice(result.error);
    commit(updateNode(nodes, node.id, () => result.node));
  };

  const remove = (node: FsNode) => commit(removeNode(nodes, node.id));

  const dropProps = (targetId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(TEMPLATE_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      const key = targetId ?? "@here";
      if (dropId !== key) setDropId(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropId(null);
    },
    onDrop: (e: React.DragEvent) => {
      const template = e.dataTransfer.getData(TEMPLATE_MIME);
      setDropId(null);
      if (!template) return;
      e.preventDefault();
      e.stopPropagation();
      add(targetId, { kind: "insert", template });
    },
  });

  const openMenu = (parentId: string | null, e: React.MouseEvent<HTMLElement>) => {
    const anchor = e.currentTarget;
    setMenu((m) => (m?.anchor === anchor ? null : { parentId, anchor }));
  };

  const nameOrInput = (node: FsNode, className: string) =>
    editing?.id === node.id ? (
      <NameInput
        value={editing.value}
        onChange={(value) => setEditing({ id: node.id, value })}
        onCommit={(value) => rename(node, value)}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <span className={className} title={node.name}>{node.name}</span>
    );

  const brick = (node: FsNode, big = false) => {
    const color = colors[node.name] ?? DEFAULT_COLOR;
    const size = blockSizes[node.name];
    const missing = !doc.templates[node.name];
    return (
      <div
        key={node.id}
        className={`brick ${big ? "big" : ""}`}
        style={{ borderColor: color, color }}
        onDoubleClick={() => !missing && onOpenBlock(node.name)}
        title={missing ? `Block ${node.name} does not exist` : `Block ${node.name}. Double-click to edit it.`}
      >
        <TemplatesIcon />
        <span className="brick-name">{node.name}</span>
        <span className="brick-size">{missing ? "missing" : `${size ?? 0} ${size === 1 ? "item" : "items"}`}</span>
        {!missing && (
          <button type="button" className="icon-btn" title="Edit this block" aria-label={`Edit block ${node.name}`} onClick={() => onOpenBlock(node.name)}>
            <PencilIcon />
          </button>
        )}
        <button type="button" className="icon-btn danger" title="Remove from here" aria-label={`Remove block ${node.name} from here`} onClick={() => remove(node)}>
          <XIcon />
        </button>
      </div>
    );
  };

  const itemRow = (parent: FsNode, node: FsNode) => {
    if (node.kind === "insert") return brick(node);
    const isFile = isFileNode(node);
    return (
      <div key={node.id} className="card-item">
        <span className="node-icon">{isFile ? <FileIcon /> : <FolderIcon />}</span>
        {isFile || editing?.id === node.id ? (
          nameOrInput(node, "name")
        ) : (
          <button type="button" className="name-btn" onClick={() => enter([...trail, parent, node])} title={`Go into ${node.name}`}>
            {node.name}
          </button>
        )}
        {!isFile && node.children.length > 0 && (
          <span className="more">
            {node.children.length}
            <ChevronIcon />
          </span>
        )}
        <button type="button" className="icon-btn" title="Rename" aria-label={`Rename ${node.name}`} onClick={() => setEditing({ id: node.id, value: node.name })}>
          <PencilIcon />
        </button>
        <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${node.name}`} onClick={() => remove(node)}>
          <XIcon />
        </button>
      </div>
    );
  };

  return (
    <div className={`blocks-view ${dropId === "@here" ? "drop" : ""}`} {...dropProps(current?.id ?? null)}>
      <nav className="crumbs" aria-label="Path">
        <button type="button" onClick={() => enter([])}>{templateName ?? "Root"}</button>
        {trail.map((n, i) => (
          <span key={n.id}>
            <ChevronIcon />
            <button type="button" onClick={() => enter(trail.slice(0, i + 1))}>{n.name}</button>
          </span>
        ))}
        <span className="crumbs-hint">
          {here.length} {here.length === 1 ? "thing" : "things"} here · click a folder’s name to go into it
        </span>
      </nav>

      <div className="board">
        {here.map((node) => {
          if (node.kind === "insert") return brick(node, true);
          if (isFileNode(node)) {
            return (
              <section key={node.id} className="card file">
                <div className="card-head">
                  <span className="node-icon file"><FileIcon /></span>
                  {nameOrInput(node, "card-title")}
                  <button type="button" className="icon-btn" title="Rename" aria-label={`Rename ${node.name}`} onClick={() => setEditing({ id: node.id, value: node.name })}>
                    <PencilIcon />
                  </button>
                  <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${node.name}`} onClick={() => remove(node)}>
                    <XIcon />
                  </button>
                </div>
              </section>
            );
          }
          return (
            <section key={node.id} className={`card ${dropId === node.id ? "drop" : ""}`} {...dropProps(node.id)}>
              <div className="card-head">
                <span className="node-icon"><FolderIcon size={18} /></span>
                {editing?.id === node.id ? (
                  nameOrInput(node, "card-title")
                ) : (
                  <button type="button" className="card-title name-btn" onClick={() => enter([...trail, node])} title={`Go into ${node.name}`}>
                    {node.name}
                  </button>
                )}
                <button type="button" className="icon-btn" title="Rename" aria-label={`Rename ${node.name}`} onClick={() => setEditing({ id: node.id, value: node.name })}>
                  <PencilIcon />
                </button>
                <button type="button" className="icon-btn danger" title="Delete this folder" aria-label={`Delete ${node.name}`} onClick={() => remove(node)}>
                  <XIcon />
                </button>
              </div>
              {node.children.map((child) => itemRow(node, child))}
              {dropId === node.id && <div className="drop-hint">Drop the block here</div>}
              <button type="button" className="add-dashed" onClick={(e) => openMenu(node.id, e)} onMouseDown={(e) => e.stopPropagation()}>
                <PlusIcon /> Add
              </button>
            </section>
          );
        })}
        <button type="button" className="card add-card" onClick={(e) => openMenu(current?.id ?? null, e)} onMouseDown={(e) => e.stopPropagation()}>
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
