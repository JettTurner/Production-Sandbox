import type { FhDocument, FsNode } from "./types";
import { emptyDocument, newId } from "./types";
import { serializeFh } from "./serializer";

/**
 * "Start from a kit": turns a few plain answers into a complete .fh document,
 * and the small library of ready-made starter blocks (templates).
 */

export type SortKind = "department" | "year" | "client";

export const SORT_KINDS: { kind: SortKind; label: string; plural: string; block: string }[] = [
  { kind: "department", label: "By department", plural: "departments", block: "DEPARTMENTS" },
  { kind: "year", label: "By year", plural: "years", block: "YEARS" },
  { kind: "client", label: "By client", plural: "clients", block: "CLIENTS" },
];

export const DEFAULT_PROJECT_FOLDERS = [
  "00_ProgressImages",
  "01_Deliverables",
  "02_Links",
  "03_ReferenceFiles",
  "04_ProjectFiles",
  "05_PostProcess",
  "06_Correspondence",
];

export const DEFAULT_EXTRAS = ["Library", "Tools", "Templates", "Admin", "Archive"];

export interface KitOptions {
  /** The @name of the structure. */
  name: string;
  /** One folder that holds everything ("" for none). */
  topFolder: string;
  /** How work is sorted, outermost first. */
  sortBy: SortKind[];
  names: Record<SortKind, string[]>;
  /** Folders every project gets; they become the PROJECT block. */
  projectFolders: string[];
  /** Extra folders at the top level. */
  extras: string[];
  /** Prefix the top-level folders with 01_, 02_, … */
  numberTop: boolean;
}

export function defaultKitOptions(year = new Date().getFullYear()): KitOptions {
  return {
    name: "My Structure",
    topFolder: "",
    sortBy: ["department", "year"],
    names: {
      department: ["Design", "Production"],
      year: [String(year), String(year + 1)],
      client: ["Client-A", "Client-B"],
    },
    projectFolders: [...DEFAULT_PROJECT_FOLDERS],
    extras: ["Library", "Admin", "Archive"],
    numberTop: true,
  };
}

/** Trimmed, non-empty, first occurrence wins (case-insensitively). */
export function cleanNames(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = raw.trim().replace(/[\\/]+$/, "");
    const key = name.toLowerCase();
    if (!name || /^[#@]/.test(name) || name.includes('"') || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const folder = (name: string, children: FsNode[] = []): FsNode => ({
  id: newId(),
  kind: "folder",
  name,
  forceFolder: true,
  children,
});
const insert = (name: string): FsNode => ({ id: newId(), kind: "insert", name, children: [] });

export function buildKitDocument(o: KitOptions): FhDocument {
  const doc = emptyDocument();
  doc.name = o.name.trim() || "Untitled Structure";
  doc.rootComments = ["#---Root---"];

  const projectFolders = cleanNames(o.projectFolders);
  const hasProject = projectFolders.length > 0;
  // Where a project lives: one example folder holding the PROJECT block.
  const projectLeaf = (): FsNode[] => (hasProject ? [folder("Project-Name", [insert("PROJECT")])] : []);

  // Only sort levels that actually have names.
  const levels = o.sortBy
    .map((kind) => ({ kind, names: cleanNames(o.names[kind] ?? []), block: SORT_KINDS.find((k) => k.kind === kind)!.block }))
    .filter((l) => l.names.length > 0);

  // Level 0 is written out at the root; every deeper level is a block, so the
  // same years/clients are defined once and reused under each parent.
  const levelNodes = (i: number): FsNode[] =>
    levels[i].names.map((name) => folder(name, i + 1 < levels.length ? [insert(levels[i + 1].block)] : projectLeaf()));

  let top: FsNode[] = levels.length ? levelNodes(0) : projectLeaf();
  top = [...top, ...cleanNames(o.extras).map((name) => folder(name))];
  if (o.numberTop) {
    top = top.map((n, i) => ({ ...n, name: `${String(i + 1).padStart(2, "0")}_${n.name}` }));
  }
  const topFolder = o.topFolder.trim().replace(/[\\/]+$/, "");
  doc.root = topFolder ? [folder(topFolder, top)] : top;

  for (let i = 1; i < levels.length; i++) {
    doc.templates[levels[i].block] = levelNodes(i);
    doc.templateOrder.push(levels[i].block);
  }
  if (hasProject) {
    doc.templates.PROJECT = projectFolders.map((name) => folder(name));
    doc.templateOrder.push("PROJECT");
  }
  if (doc.templateOrder.length) doc.templateComments[doc.templateOrder[0]] = ["#---Blocks---"];
  return doc;
}

export function buildKit(o: KitOptions): string {
  return serializeFh(buildKitDocument(o));
}

// ---------- Starter blocks ----------

export interface StarterBlock {
  /** Template name it is added as. */
  name: string;
  title: string;
  hint: string;
  build: () => FsNode[];
}

export function starterBlocks(year = new Date().getFullYear()): StarterBlock[] {
  return [
    {
      name: "PROJECT",
      title: "Project",
      hint: "The folders every project gets",
      build: () => DEFAULT_PROJECT_FOLDERS.map((n) => folder(n)),
    },
    {
      name: "YEARS",
      title: "Years",
      hint: `One folder per year (${year}, ${year + 1})`,
      build: () => [folder(String(year)), folder(String(year + 1))],
    },
    {
      name: "ADMIN",
      title: "Admin",
      hint: "Accounts, receipts, documents",
      build: () => ["Accounts", "Receipts", "Documents", "Warranties"].map((n) => folder(n)),
    },
    {
      name: "ARCHIVE",
      title: "Archive",
      hint: "Old work, by year",
      build: () => [folder(String(year - 2)), folder(String(year - 1))],
    },
  ];
}

/** A template name not already in use: NAME, NAME_2, NAME_3, … */
export function uniqueTemplateName(base: string, existing: Record<string, unknown>): string {
  if (existing[base] === undefined) return base;
  for (let i = 2; ; i++) {
    const name = `${base}_${i}`;
    if (existing[name] === undefined) return name;
  }
}
