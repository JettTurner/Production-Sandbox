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
