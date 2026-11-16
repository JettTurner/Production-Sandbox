export type NodeKind = "folder" | "insert";

export interface FsNode {
  /**
   * Id for React keys, drag & drop and collapse state. Never serialized; it is
   * carried across re-parses by `reconcileIds` (lib/ids.ts) so UI state survives
   * edits.
   */
  id: string;
  kind: NodeKind;
  /** Folder/file name, or template name when kind === "insert". */
  name: string;
  /** Optional display label (GUI only, never written to disk). */
  label?: string;
  /**
   * True when the node is explicitly a folder even though its name contains a
   * dot (written as a trailing slash in .fh: `v1.2/`).
   */
  forceFolder?: boolean;
  /** `#` comment lines that sit directly above this node in the source. */
  comments?: string[];
  /** Resolved trees only: the template this node came from, if any. */
  from?: string;
  children: FsNode[];
}

export interface FhDocument {
  version: string;
  name: string;
  root: FsNode[];
  templates: Record<string, FsNode[]>;
  templateOrder: string[];
  templateColors: Record<string, string>;
  /** Comment lines above @version/@name (top of file). */
  headerComments: string[];
  /** Comment lines directly above @root. */
  rootComments: string[];
  /** Comment lines directly above each @template line. */
  templateComments: Record<string, string[]>;
  /** Comment lines after the last node in the file. */
  trailingComments: string[];
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

/** Name-only test: a name containing a dot looks like a file. */
export function isFileLike(name: string): boolean {
  return name.includes(".");
}

/**
 * The folder-vs-file rule used everywhere: a node is a file when its name
 * contains a dot, unless it is explicitly marked as a folder (`name/`).
 */
export function isFileNode(node: Pick<FsNode, "kind" | "name" | "forceFolder">): boolean {
  return node.kind === "folder" && !node.forceFolder && isFileLike(node.name);
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function emptyDocument(): FhDocument {
  return {
    version: "1.0",
    name: "Untitled Structure",
    root: [],
    templates: {},
    templateOrder: [],
    templateColors: {},
    headerComments: [],
    rootComments: [],
    templateComments: {},
    trailingComments: [],
  };
}
