import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { cloneWithNewIds } from "../lib/ids";
import { dropZone, keyAction, TEMPLATE_MIME } from "../lib/dnd";
import { cleanTemplateName, insertChild, insertRelative, makeFile, makeFolder, makeInsert, moveNode, removeNode, renamedNode } from "../lib/treeEdit";
import { ChevronIcon, CopyIcon, FileIcon, FolderIcon, GripIcon, PlusChildIcon, PlusIcon, XIcon } from "./icons";
import ColorPicker from "./ColorPicker";

// Re-exported so existing imports keep working; the shared rules live in lib/dnd.ts.
export { TEMPLATE_MIME };

export interface SectionRef {
  kind: "root" | "template";
  name?: string;
}

interface DesignerProps {
  nodes: FsNode[];
  section: SectionRef;
  templates: string[];
  onNodesChange: (nodes: FsNode[]) => void;
  templateMap?: Record<string, FsNode[]>;
  templateColors?: Record<string, string>;
  expandedInserts?: Set<string>;
  onToggleInsert?: (nodeId: string) => void;
  onTemplateNodesChange?: (templateName: string, nodes: FsNode[]) => void;
  onAddTemplate?: (name: string) => void;
  onRenameTemplate?: (oldName: string, newName: string) => void;
  onSetTemplateColor?: (name: string, color: string) => void;
  /** Collapsed folder ids. When provided the parent owns this state (so it survives switching sections). */
  collapsed?: Set<string>;
  onCollapsedChange?: (id: string, collapsed: boolean) => void;
  /** Short message for the user (e.g. a rejected name). */
  onNotice?: (message: string) => void;
  /**
   * Templates already being shown above this one (inline expansion nests
   * Designers). A template that inserts itself, directly or through others,
   * is not expanded again, so a circular file cannot recurse forever.
   */
  expansionChain?: string[];
  /** Ask the list to select and focus a node (from Find). */
  reveal?: { ids: string[]; seq: number } | null;
}

interface DropState {
  targetId: string;
  position: "before" | "after" | "into";
}

interface EditState {
  path: number[];
  value: string;
}

interface MenuState {
  anchor: HTMLElement;
  parentId: string | null;
  index: number;
  childOf: boolean;
}

export type AddSpec =
  | { kind: "folder" }
  | { kind: "file" }
  | { kind: "insert"; template: string };

export default function Designer({ nodes, section, templates, onNodesChange, templateMap, templateColors, expandedInserts, onToggleInsert, onTemplateNodesChange, onAddTemplate, onRenameTemplate, onSetTemplateColor, collapsed: collapsedProp, onCollapsedChange, onNotice, expansionChain, reveal }: DesignerProps) {
  const chain = expansionChain ?? (section.kind === "template" && section.name ? [section.name] : []);
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set());
  const collapsed = collapsedProp ?? localCollapsed;
  const setCollapsedFor = (id: string, value: boolean) => {
    if (onCollapsedChange) onCollapsedChange(id, value);
    else
      setLocalCollapsed((prev) => {
        const next = new Set(prev);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      });
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<{ id: string; value: string } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Stable refs for expanded-insert callbacks (avoids remounting nested Designers)
  const onTemplateNodesChangeRef = useRef(onTemplateNodesChange);
  onTemplateNodesChangeRef.current = onTemplateNodesChange;
  const onRenameTemplateRef = useRef(onRenameTemplate);
  onRenameTemplateRef.current = onRenameTemplate;
  const onSetTemplateColorRef = useRef(onSetTemplateColor);
  onSetTemplateColorRef.current = onSetTemplateColor;

  const makeInsertNodesChange = useCallback(
    (templateName: string) => (newNodes: FsNode[]) => {
      onTemplateNodesChangeRef.current?.(templateName, newNodes);
    },
    [],
  );

  const toggle = (id: string) => setCollapsedFor(id, !collapsed.has(id));

  // Move keyboard focus to a row after the tree re-renders.
  useEffect(() => {
    if (!focusId) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(focusId)}"]`);
    el?.focus();
    setFocusId(null);
  }, [focusId]);

  // Find: select the node and bring it into view (the parent already opened its folders).
  useEffect(() => {
    const id = reveal?.ids[reveal.ids.length - 1];
    if (!id) return;
    setSelectedId(id);
    setFocusId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.seq]);

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    if (focus) setFocusId(id);
  };

  /** Rows currently on screen, top to bottom (for arrow-key navigation). */
  const visibleRows = (): { node: FsNode; path: number[] }[] => {
    const out: { node: FsNode; path: number[] }[] = [];
    const walk = (list: FsNode[], base: number[]) => {
      list.forEach((n, i) => {
        const path = [...base, i];
        out.push({ node: n, path });
        if (n.kind === "folder" && !isFileNode(n) && !collapsed.has(n.id)) walk(n.children, path);
      });
    };
    walk(nodes, []);
    return out;
  };

  const dropTemplate = (template: string, targetId: string | null, position: DropState["position"]) => {
    if (section.kind === "template" && section.name === template) {
      onNotice?.(`"${template}" can't insert itself.`);
      return;
    }
    const node = makeInsert(template);
    onNodesChange(targetId ? insertRelative(nodes, targetId, position, node) : [...nodes, node]);
    if (targetId && position === "into") setCollapsedFor(targetId, false);
    select(node.id);
  };

  const handleDrop = (targetId: string, position: DropState["position"], template?: string) => {
    if (template) {
      dropTemplate(template, targetId, position);
    } else if (dragId && dragId !== targetId) {
      onNodesChange(moveNode(nodes, dragId, targetId, position));
    }
    setDragId(null);
    setDropState(null);
  };

  const openMenu = (target: Omit<MenuState, "anchor">, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const anchor = e.currentTarget;
    if (menu?.anchor === anchor) setMenu(null);
    else setMenu({ ...target, anchor });
  };

  const addNode = (parentId: string | null, index: number, spec: AddSpec) => {
    const node =
      spec.kind === "insert"
        ? makeInsert(spec.template)
        : spec.kind === "file"
          ? makeFile("Untitled.txt")
          : makeFolder("New Folder");
    const parent = parentId ? findNode(nodes, parentId) : null;
    const siblings = parent ? parent.children : nodes;
    const newTree = insertChild(nodes, parentId, Math.min(Math.max(index, 0), siblings.length), node);
    onNodesChange(newTree);
    setMenu(null);
    const newPath = pathOf(newTree, node.id);
    setEditing(newPath ? { path: newPath, value: node.name } : null);
    if (parentId) setCollapsedFor(parentId, false);
    setSelectedId(node.id);
  };

  const renameAt = (path: number[], name: string) => {
    setEditing(null);
    const current = nodeAt(nodes, path);
    if (!current) return;
    const result = renamedNode(current, name);
    if (!result) return;
    if ("error" in result) {
      onNotice?.(result.error);
      return;
    }
    onNodesChange(updateByPath(nodes, path, () => result.node));
    setFocusId(current.id);
  };

  const duplicateAt = (path: number[], node: FsNode) => {
    const clone = cloneWithNewIds(node);
    const newTree = insertChild(nodes, path.length ? parentIdAt(nodes, path) : null, path[path.length - 1] + 1, clone);
    onNodesChange(newTree);
    const newPath = pathOf(newTree, clone.id);
    setEditing(newPath ? { path: newPath, value: clone.name } : null);
  };

  const deleteAt = (path: number[]) => {
    const id = nodeAt(nodes, path)?.id;
    if (id) {
      // Keep the keyboard somewhere sensible: the next row, else the previous one.
      const rows = visibleRows();
      const at = rows.findIndex((r) => r.node.id === id);
      const isInside = (p: number[]) => p.length > path.length && path.every((v, i) => v === p[i]);
      const after = rows.slice(at + 1).find((r) => !isInside(r.path));
      const neighbour = after ?? rows[at - 1];
      onNodesChange(removeNode(nodes, id));
      if (neighbour) select(neighbour.node.id, true);
      else setSelectedId(null);
    }
    if (editing && pathsEqual(path, editing.path)) setEditing(null);
  };

  const moveAt = (path: number[], dir: -1 | 1) => {
    const loc = locatedAt(nodes, path);
    if (!loc) return;
    const target = loc.index + dir;
    if (target < 0 || target >= loc.container.length) return;
    const next = removeNode(nodes, loc.node.id);
    onNodesChange(insertChild(next, path.length ? parentIdAt(nodes, path) : null, target, loc.node));
    setFocusId(loc.node.id);
  };

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, node: FsNode, path: number[]) => {
    if (e.target !== e.currentTarget) return; // typing in a name field or a control
    const action = keyAction(e);
    if (!action) return;
    const rows = visibleRows();
    const at = rows.findIndex((r) => r.node.id === node.id);
    const isOpenFolder = node.kind === "folder" && !isFileNode(node) && node.children.length > 0;
    if (action === "moveUp") moveAt(path, -1);
    else if (action === "moveDown") moveAt(path, 1);
    else if (action === "down") {
      if (rows[at + 1]) select(rows[at + 1].node.id, true);
    } else if (action === "up") {
      if (rows[at - 1]) select(rows[at - 1].node.id, true);
    } else if (action === "right") {
      if (isOpenFolder && collapsed.has(node.id)) setCollapsedFor(node.id, false);
      else if (isOpenFolder) select(node.children[0].id, true);
      else if (node.kind === "insert" && onToggleInsert && !expandedInserts?.has(node.id)) onToggleInsert(node.id);
    } else if (action === "left") {
      if (isOpenFolder && !collapsed.has(node.id)) setCollapsedFor(node.id, true);
      else if (node.kind === "insert" && onToggleInsert && expandedInserts?.has(node.id)) onToggleInsert(node.id);
      else {
        const parent = path.length > 1 ? nodeAt(nodes, path.slice(0, -1)) : null;
        if (parent) select(parent.id, true);
      }
    } else if (action === "open" || action === "rename") {
      if (node.kind === "insert") onToggleInsert?.(node.id);
      else setEditing({ path, value: node.name });
    } else deleteAt(path); // delete, back
    e.preventDefault();
    e.stopPropagation();
  };

  const renderNode = (node: FsNode, depth: number, path: number[]) => {
    const isCollapsed = collapsed.has(node.id);
    const children = node.children;
    const isFile = isFileNode(node);
    const isSelected = selectedId === node.id;
    const insertable = node.kind === "folder" && !isFile;
    const dropTarget = dropState?.targetId === node.id ? dropState.position : null;
    const isEditing = editing ? pathsEqual(path, editing.path) : false;
    const typeClass =
      node.kind === "insert" ? "type-insert" : isFile ? "type-file" : "type-folder";
    const insertColor = node.kind === "insert" ? templateColors?.[node.name] : undefined;
    const hasInsertChildren = node.kind === "insert" && node.children.length > 0;
    const isExpanded = node.kind === "insert" && !chain.includes(node.name) && !!expandedInserts?.has(node.id);
    // Use template color for @insert nodes, otherwise undefined
    const nodeColor = node.kind === "insert" ? templateColors?.[node.name] : undefined;

    return (
      <div key={node.id}>
        <div
          className={`tree-row ${isSelected ? "selected" : ""} ${dragId === node.id ? "dragging" : ""} ${dropTarget ? `droppable drop-${dropTarget}` : ""} ${isExpanded ? "insert-expanded-row" : ""}`}
          data-node-id={node.id}
          role="treeitem"
          aria-selected={isSelected}
          aria-level={depth + 1}
          aria-expanded={insertable && children.length > 0 ? !isCollapsed : undefined}
          tabIndex={isSelected || (!selectedId && depth === 0 && path[0] === 0) ? 0 : -1}
          onClick={() => setSelectedId(node.id)}
          onFocus={(e) => {
            if (e.target === e.currentTarget) setSelectedId(node.id);
          }}
          onKeyDown={(e) => onRowKeyDown(e, node, path)}
          style={{ marginLeft: depth * 20, ...(hasInsertChildren && insertColor ? { borderLeftColor: insertColor, borderLeftWidth: 3, borderLeftStyle: "solid" } : {}) }}
          title={node.kind === "insert" ? `Double-click to ${isExpanded ? "close" : "open"} the block "${node.name}"` : undefined}
          onDoubleClick={node.kind === "insert" && onToggleInsert ? () => onToggleInsert(node.id) : undefined}
          onDragOver={(e) => {
            const isTemplate = e.dataTransfer.types.includes(TEMPLATE_MIME);
            if (!dragId && !isTemplate) return; // e.g. a file dragged in from the desktop
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = isTemplate ? "copy" : "move";
            const position = dropZone(e, insertable ? "folder" : "row");
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
            const template = e.dataTransfer.getData(TEMPLATE_MIME);
            if (!dragId && !template) return;
            e.preventDefault();
            e.stopPropagation();
            const fallback = insertable ? "into" : "after";
            handleDrop(node.id, dropState?.targetId === node.id ? dropState.position : fallback, template || undefined);
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
          <span className={`node-icon ${node.kind === "folder" ? "folder" : "insert"}`} style={insertColor ? { color: insertColor } : undefined}>
            {node.kind === "folder" ? (isFile ? <FileIcon /> : <FolderIcon />) : <CopyIcon />}
          </span>

          <span className="name-zone">
            {node.kind === "insert" ? (
              <span className="insert-picker">
                <select
                  aria-label="Block to insert"
                  value={node.name}
                  onChange={(e) => onNodesChange(updateName(nodes, node.id, e.target.value))}
                  onDragOver={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={insertColor ? { color: insertColor, borderColor: insertColor } : undefined}
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

            {insertable && children.length > 0 && (
              <span className="count" title={`${children.length} ${children.length === 1 ? "item" : "items"} inside`}>
                {children.length}
              </span>
            )}
          </span>

            <span className={`hover-actions ${typeClass}`} style={nodeColor ? { "--node-color": nodeColor } as React.CSSProperties : undefined}>
              <IconButton
                title="Add after (same level)"
                onClick={(e) =>
                  openMenu(
                    { parentId: parentIdAt(nodes, path), index: path[path.length - 1] + 1, childOf: false },
                    e,
                  )
                }
              >
                <PlusIcon />
              </IconButton>
              <IconButton
                title={insertable ? "Add child" : "A block's contents come from the block itself"}
                disabled={!insertable}
                onClick={(e) => openMenu({ parentId: node.id, index: children.length, childOf: true }, e)}
              >
                <PlusChildIcon />
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

        {isExpanded && templateMap?.[node.name] && (
          <div className="insert-expanded" style={{ marginLeft: (depth + 1) * 20, "--template-color": templateColors?.[node.name] ?? "#f0b35a" } as React.CSSProperties}>
            <div className="insert-expanded-header">
              {editingTemplateName?.id === node.name ? (
                <input
                  className="insert-expanded-name editing"
                  autoFocus
                  value={editingTemplateName.value}
                  onChange={(e) => setEditingTemplateName({ id: node.name, value: e.target.value })}
                  onBlur={() => {
                    if (editingTemplateName.value.trim() && editingTemplateName.value !== node.name) {
                      onRenameTemplate?.(node.name, editingTemplateName.value.trim());
                    }
                    setEditingTemplateName(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (editingTemplateName.value.trim() && editingTemplateName.value !== node.name) {
                        onRenameTemplate?.(node.name, editingTemplateName.value.trim());
                      }
                      setEditingTemplateName(null);
                    }
                    if (e.key === "Escape") {
                      setEditingTemplateName(null);
                    }
                    e.stopPropagation();
                  }}
                />
              ) : (
                <input
                  className="insert-expanded-name"
                  value={node.name}
                  readOnly
                  title="Double-click to rename this block"
                  onDoubleClick={() => setEditingTemplateName({ id: node.name, value: node.name })}
                />
              )}
              {onSetTemplateColor && (
                <ColorPicker
                  value={templateColors?.[node.name] ?? "#f0b35a"}
                  onChange={(c) => onSetTemplateColor(node.name, c)}
                />
              )}
              <button
                className="icon-btn"
                title="Close this block"
                onClick={() => onToggleInsert?.(node.id)}
              >
                <XIcon />
              </button>
            </div>
            <Designer
              nodes={templateMap[node.name]}
              section={{ kind: "template", name: node.name }}
              templates={templates}
              onNodesChange={makeInsertNodesChange(node.name)}
              templateMap={templateMap}
              templateColors={templateColors}
              expandedInserts={expandedInserts}
              onToggleInsert={onToggleInsert}
              onTemplateNodesChange={onTemplateNodesChange}
              onAddTemplate={onAddTemplate}
              onRenameTemplate={onRenameTemplate}
              onSetTemplateColor={onSetTemplateColor}
              collapsed={collapsedProp}
              onCollapsedChange={onCollapsedChange}
              onNotice={onNotice}
              expansionChain={[...chain, node.name]}
            />
          </div>
        )}

        {insertable && !isCollapsed && children.length > 0 && children.map((c, i) => renderNode(c, depth + 1, [...path, i]))}
      </div>
    );
  };

  return (
    <div
      ref={bodyRef}
      role="tree"
      aria-label={section.kind === "root" ? "Root structure" : `Template ${section.name}`}
      className={`designer-body ${dragId ? "dragging-active" : ""}`}
      onDragOver={(e) => {
        // Dropping a sidebar template on empty space appends it to the end.
        if (!e.dataTransfer.types.includes(TEMPLATE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        const template = e.dataTransfer.getData(TEMPLATE_MIME);
        if (!template) return;
        e.preventDefault();
        e.stopPropagation();
        dropTemplate(template, null, "after");
        setDropState(null);
      }}
    >
      {nodes.length === 0 ? (
        <div className="empty-hint">
          <div className="big"><FolderIcon size={28} /></div>
          {section.kind === "root"
            ? "Nothing here yet. Add folders or files, or drag a block in from the left."
            : `The block "${section.name}" is empty. Add folders, or insert another block.`}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6 }}>
            <AddButton
              label="Add…"
              onClick={(e) => openMenu({ parentId: null, index: nodes.length, childOf: false }, e)}
            />
          </div>
        </div>
      ) : (
        <>
          {nodes.map((n, i) => renderNode(n, 0, [i]))}
          <div className="designer-footer">
            <AddButton
              label="Add…"
              onClick={(e) => openMenu({ parentId: null, index: nodes.length, childOf: false }, e)}
            />
          </div>
        </>
      )}

      {menu && (
        <PlusDropdown
          anchor={menu.anchor}
          targetLabel={menu.childOf ? "child" : menu.parentId ? "sibling" : "top-level item"}
          templates={templates}
          onAdd={(spec) => addNode(menu.parentId, menu.index, spec)}
          onAddTemplate={onAddTemplate}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button className="btn" onClick={onClick} onMouseDown={(e) => e.stopPropagation()} title="Add a folder, file or block">
      <PlusIcon /> {label}
    </button>
  );
}

export function PlusDropdown({
  anchor,
  targetLabel,
  templates,
  onAdd,
  onAddTemplate,
  onClose,
}: {
  anchor: HTMLElement;
  targetLabel: string;
  templates: string[];
  onAdd: (spec: AddSpec) => void;
  onAddTemplate?: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    const estH = Math.min(260, 120 + templates.length * 26);
    const top = r.bottom + 6 + estH > window.innerHeight ? Math.max(6, r.top - estH - 6) : r.bottom + 6;
    const left = Math.max(6, Math.min(r.left, window.innerWidth - 240));
    setPos({ top, left });
  }, [anchor, templates.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="plus-dropdown"
      style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: 300 }}
    >
      <div className="dd-title">Add {targetLabel}</div>
      <button className="dd-item" onClick={() => onAdd({ kind: "folder" })}>
        <span className="ic"><FolderIcon /></span> Folder
      </button>
      <button className="dd-item" onClick={() => onAdd({ kind: "file" })}>
        <span className="ic"><FileIcon /></span> File
      </button>
      <div className="dd-sep" />
      <div className="dd-title">Insert a block</div>
      {templates.length ? (
        templates.map((t) => (
          <button key={t} className="dd-item mono" onClick={() => onAdd({ kind: "insert", template: t })}>
            <span className="ic"><CopyIcon /></span> {t}
          </button>
        ))
      ) : (
        <div className="dd-empty">No blocks yet. Create one below.</div>
      )}
      {onAddTemplate && (
        <>
          <div className="dd-sep" />
          <PlusDropdownCreateTemplate
            onAddTemplate={onAddTemplate}
            onAdd={onAdd}
            onClose={onClose}
          />
        </>
      )}
    </div>,
    document.body,
  );
}

function PlusDropdownCreateTemplate({
  onAddTemplate,
  onAdd,
  onClose,
}: {
  onAddTemplate: (name: string) => void;
  onAdd: (spec: AddSpec) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    const n = cleanTemplateName(name);
    if (n) {
      onAddTemplate(n);
      onAdd({ kind: "insert", template: n });
      onClose();
    }
    setName("");
    setCreating(false);
  };

  if (creating) {
    return (
      <div style={{ padding: "4px 8px" }}>
        <input
          className="name-input small"
          autoFocus
          placeholder="New block name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setName(""); setCreating(false); }
            e.stopPropagation();
          }}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  return (
    <button className="dd-item" onClick={() => setCreating(true)}>
      <span className="ic"><PlusIcon /></span> New block…
    </button>
  );
}

function IconButton({
  title,
  onClick,
  children,
  className,
  disabled,
}: {
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-btn ${className ?? ""}`}
      title={title}
      aria-label={title}
      tabIndex={-1}
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={disabled}
    >
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
        aria-label="Name"
        autoFocus
        onFocus={(e) => e.target.select()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(value);
          if (e.key === "Escape") onCommit(node.name);
          if (e.key === "Enter" || e.key === "Escape") e.preventDefault();
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

function updateByPath(nodes: FsNode[], path: number[], updater: (n: FsNode) => FsNode): FsNode[] {
  if (path.length === 1) {
    return nodes.map((n, i) => (i === path[0] ? updater(n) : n));
  }
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: updateByPath(n.children, path.slice(1), updater) } : n,
  );
}