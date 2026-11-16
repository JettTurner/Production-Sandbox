/**
 * Drag-and-drop and keyboard rules shared by the three editor views (List,
 * Columns, Blocks), so they behave the same everywhere.
 */

/** A block dragged out of the sidebar. The data is the block's name. */
export const TEMPLATE_MIME = "application/x-fh-template";
/** A folder, file or block line being moved inside a view. The data is its id. */
export const NODE_MIME = "application/x-fh-node";

export type DropPos = "before" | "after" | "into";

/**
 * Where a drop lands, from the pointer position over the target:
 *  - "row":    top half = before, bottom half = after (things that cannot hold children)
 *  - "folder": top 30% = before, bottom 30% = after, middle = into
 *  - "card":   left 22% = before, right 22% = after, middle = into (cards laid out side by side)
 */
export function dropZone(e: { clientX: number; clientY: number; currentTarget: Element }, mode: "row" | "folder" | "card"): DropPos {
  const rect = e.currentTarget.getBoundingClientRect();
  if (mode === "card") {
    const x = (e.clientX - rect.left) / rect.width;
    return x < 0.22 ? "before" : x > 0.78 ? "after" : "into";
  }
  const y = (e.clientY - rect.top) / rect.height;
  if (mode === "row") return y < 0.5 ? "before" : "after";
  return y < 0.3 ? "before" : y > 0.7 ? "after" : "into";
}

export type KeyAction = "up" | "down" | "left" | "right" | "moveUp" | "moveDown" | "rename" | "delete" | "open" | "back";

/**
 * The one keyboard map for tree editing. Returns null for keys the views do
 * not handle (and for Ctrl/Cmd chords, which belong to the app).
 */
export function keyAction(e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): KeyAction | null {
  if (e.ctrlKey || e.metaKey) return null;
  if (e.altKey) {
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") return "moveUp";
    if (e.key === "ArrowDown" || e.key === "ArrowRight") return "moveDown";
    return null;
  }
  switch (e.key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "F2":
      return "rename";
    case "Delete":
      return "delete";
    case "Enter":
      return "open";
    case "Backspace":
      return "back";
    default:
      return null;
  }
}

/** What is selected: the set, plus the item a Shift-click or Shift+arrow range starts from. */
export interface Selection {
  ids: Set<string>;
  anchor: string | null;
}

export const noSelection: Selection = { ids: new Set(), anchor: null };

/**
 * The one rule for clicking with several things selected, the same as in a
 * file browser:
 *  - plain click: just that one;
 *  - Ctrl or Cmd click: add it, or take it out;
 *  - Shift click: everything from the anchor to it, in the order shown.
 * `order` is the ids as they appear on screen.
 */
export function clickSelect(
  prev: Selection,
  id: string,
  order: string[],
  e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
): Selection {
  if (e.shiftKey && prev.anchor && order.includes(prev.anchor) && order.includes(id)) {
    const a = order.indexOf(prev.anchor);
    const b = order.indexOf(id);
    return { ids: new Set(order.slice(Math.min(a, b), Math.max(a, b) + 1)), anchor: prev.anchor };
  }
  if (e.ctrlKey || e.metaKey) {
    const ids = new Set(prev.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ids, anchor: id };
  }
  return { ids: new Set([id]), anchor: id };
}

/** True when the click or key press asks to select more than one thing. */
export function wantsMulti(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

/**
 * While several things are dragged together, show how many under the pointer
 * instead of a picture of just the one that was grabbed.
 */
export function dragBadge(dataTransfer: DataTransfer, count: number): void {
  if (count < 2 || typeof document === "undefined") return;
  const badge = document.createElement("div");
  badge.className = "drag-badge";
  badge.textContent = `${count} items`;
  document.body.appendChild(badge);
  try {
    dataTransfer.setDragImage(badge, 12, 12);
  } catch {
    // Not supported everywhere; the default picture is fine.
  }
  setTimeout(() => badge.remove(), 0);
}
