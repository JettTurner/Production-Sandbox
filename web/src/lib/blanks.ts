import type { FsNode } from "./types";

/**
 * Fill-in names. A folder or file name can contain blanks written in braces:
 *
 *   {Client}_{Project}        asked for when the folders are created
 *   {date} {year} {yy} {month} {day} {yymmdd}   filled in from today's date
 *
 * Blanks stay as written in the .fh file, the preview and the zip; only
 * "Create folders" fills them in.
 */

const BLANK = /\{([A-Za-z][A-Za-z0-9 _-]{0,30})\}/g;

const pad = (n: number) => String(n).padStart(2, "0");

/** Values for the date blanks, keyed in lower case. */
export function dateBlanks(now = new Date()): Record<string, string> {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  return {
    date: `${y}-${m}-${d}`,
    year: String(y),
    yy: String(y).slice(2),
    month: m,
    day: d,
    yymmdd: `${String(y).slice(2)}${m}${d}`,
  };
}

const DATE_KEYS = new Set(Object.keys(dateBlanks()));

/** The blanks a person has to fill in (date blanks excluded), in the order they first appear. */
export function findBlanks(tree: FsNode[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (nodes: FsNode[]) => {
    for (const n of nodes) {
      if (n.kind !== "insert") {
        for (const m of n.name.matchAll(BLANK)) {
          const key = m[1].trim().toLowerCase();
          if (DATE_KEYS.has(key) || seen.has(key)) continue;
          seen.add(key);
          out.push(m[1].trim());
        }
      }
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/** True when any name uses a date blank. */
export function usesDateBlanks(tree: FsNode[]): boolean {
  return tree.some(
    (n) =>
      (n.kind !== "insert" && [...n.name.matchAll(BLANK)].some((m) => DATE_KEYS.has(m[1].trim().toLowerCase()))) ||
      usesDateBlanks(n.children),
  );
}

export function fillName(name: string, values: Record<string, string>, dates: Record<string, string>): string {
  return name.replace(BLANK, (whole, raw: string) => {
    const key = raw.trim().toLowerCase();
    if (DATE_KEYS.has(key)) return dates[key];
    const v = values[key]?.trim();
    return v ? v : whole; // an unanswered blank is left exactly as written
  });
}

/** A copy of the tree with every answered blank filled in. `values` is keyed in lower case. */
export function fillBlanks(tree: FsNode[], values: Record<string, string>, now = new Date()): FsNode[] {
  const dates = dateBlanks(now);
  const walk = (nodes: FsNode[]): FsNode[] =>
    nodes.map((n) => ({ ...n, name: n.kind === "insert" ? n.name : fillName(n.name, values, dates), children: walk(n.children) }));
  return walk(tree);
}
