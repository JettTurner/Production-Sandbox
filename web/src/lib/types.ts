export type NodeKind = "folder" | "insert";

export interface FsNode {
  /** Stable id for React keys / drag & drop. Regenerated when parsing. */
  id: string;
  kind: NodeKind;
  /** Folder name, or template name when kind === "insert". */
  name: string;
  /** Optional display label (GUI only, never written to disk). */
  label?: string;
  children: FsNode[];
}

export interface FhDocument {
  version: string;
  name: string;
  root: FsNode[];
  templates: Record<string, FsNode[]>;
  templateOrder: string[];
}

export interface ParseIssue {
  line: number;
  message: string;
  severity: "error" | "warning";
}

export interface ParseResult {
  doc: FhDocument | null;
  issues: ParseIssue[];
}

/** A folder counts as a "file" when its name contains a dot (matches legacy behavior). */
export function isFileLike(name: string): boolean {
  return name.includes(".");
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}