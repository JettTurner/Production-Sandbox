import type { FhDocument, FsNode, NodeKind, ParseIssue, ParseResult } from "./types";
import { isFileLike, newId } from "./types";

interface RawLine {
  comment?: boolean;
  text: string;
  trimmed: string;
  leadingTabs: number;
  leadingSpaces: number;
  lineNo: number;
}

interface Section {
  kind: "root" | "template";
  templateName?: string;
  items: Item[];
}

interface Item {
  indent: number;
  kind: NodeKind;
  name: string;
  label?: string;
  forceFolder?: boolean;
  comments?: string[];
  lineNo: number;
}

const COMMENT_RE = /^\s*#/;

export function parseFh(source: string): ParseResult {
  const issues: ParseIssue[] = [];
  const rawLines = source.split(/\r?\n/);

  // --- 1. Collect meaningful lines ---
  const lines: RawLine[] = [];
  rawLines.forEach((text, i) => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    if (COMMENT_RE.test(text)) {
      lines.push({ comment: true, text, trimmed, leadingTabs: 0, leadingSpaces: 0, lineNo: i + 1 });
      return;
    }
    const leadingTabs = (text.match(/^\t*/)?.[0].length ?? 0);
    const leadingSpaces = (text.match(/^ */)?.[0].length ?? 0);
    lines.push({ text, trimmed, leadingTabs, leadingSpaces, lineNo: i + 1 });
  });

  // --- 2. Detect indentation unit (spaces-per-level) ---
  const spaceIndents = lines
    .filter((l) => !l.comment && l.leadingSpaces > 0 && l.leadingTabs === 0)
    .map((l) => l.leadingSpaces);
  let unit = 0;
  if (spaceIndents.length) {
    unit = spaceIndents.reduce((a, b) => gcd(a, b));
    unit = Math.max(1, unit);
  }
  const levelOf = (l: RawLine): number => {
    if (l.leadingTabs > 0) return l.leadingTabs;
    if (unit > 0) return Math.round(l.leadingSpaces / unit);
    return l.leadingSpaces > 0 ? 1 : 0;
  };

  // --- 3. Tokenize into sections ---
  const rootSection: Section = { kind: "root", items: [] };
  const templates = new Map<string, Section>();
  let current: Section | null = null;
  let version = "1.0";
  let docName = "";
  let sawRoot = false;
  const templateColors: Record<string, string> = {};
  // Comment lines are held here until the next meaningful line claims them, so
  // they travel with whatever they sit above (see serializer.ts).
  let pending: string[] = [];
  const take = (): string[] => {
    const out = pending;
    pending = [];
    return out;
  };
  const headerComments: string[] = [];
  let rootComments: string[] = [];
  const templateComments: Record<string, string[]> = {};

  for (const l of lines) {
    const t = l.trimmed;

    if (l.comment) {
      pending.push(t);
      continue;
    }

    if (/^@root\b/.test(t)) {
      const colorTok = t.replace(/^@root\b/, "").trim();
      if (!colorTok || /^#[0-9a-fA-F]{3,8}$/.test(colorTok)) {
        current = rootSection;
        rootSection.items = []; // a later @root resets the root (matches legacy)
        sawRoot = true;
        rootComments = take();
        if (colorTok) templateColors["@root"] = colorTok;
        continue;
      }
      issues.push({
        line: l.lineNo,
        severity: "warning",
        message: `Invalid color "${colorTok}" after @root was ignored.`,
      });
      continue;
    }
    if (/^@template-color\b/.test(t)) {
      issues.push({
        line: l.lineNo,
        severity: "warning",
        message: '@template-color was removed; put the color after @root/@template (e.g. "@template X #79c0ff").',
      });
      continue;
    }
    if (/^@template\b/.test(t)) {
      let rest = t.replace(/^@template\b/, "").trim();
      const colorM = rest.match(/^(.*?)[ \t]+(#[0-9a-fA-F]{3,8})$/);
      let color: string | undefined;
      if (colorM) {
        rest = colorM[1].trim();
        color = colorM[2];
      }
      const name = rest.split(/\s+/)[0];
      if (!name) {
        issues.push({ line: l.lineNo, severity: "error", message: "@template requires a name." });
        continue;
      }
      if (templates.has(name)) {
        issues.push({ line: l.lineNo, severity: "error", message: `Duplicate template name "${name}".` });
        continue;
      }
      if (color) templateColors[name] = color;
      const comments = take();
      if (comments.length) templateComments[name] = comments;
      const section: Section = { kind: "template", templateName: name, items: [] };
      templates.set(name, section);
      current = section;
      continue;
    }
    if (t.startsWith("@version")) {
      version = t.split(/\s+/)[1] ?? version;
      headerComments.push(...take());
      continue;
    }
    if (t.startsWith("@name")) {
      docName = t.replace(/^@name\b/, "").trim();
      headerComments.push(...take());
      continue;
    }
    if (t.startsWith("@insert")) {
      const name = t.split(/\s+/)[1];
      if (!current) {
        issues.push({ line: l.lineNo, severity: "warning", message: "@insert outside of any section was ignored." });
        continue;
      }
      if (!name) {
        issues.push({ line: l.lineNo, severity: "error", message: "@insert requires a template name." });
        continue;
      }
      const comments = take();
      current.items.push({
        indent: levelOf(l),
        kind: "insert",
        name,
        lineNo: l.lineNo,
        ...(comments.length ? { comments } : {}),
      });
      continue;
    }
    if (t.startsWith("@")) {
      issues.push({ line: l.lineNo, severity: "warning", message: `Unknown directive "${t.split(/\s+/)[0]}" was ignored.` });
      continue;
    }

    // --- Node line (folder or insert) ---
    if (!current) {
      issues.push({ line: l.lineNo, severity: "warning", message: "Node found before @root was ignored." });
      continue;
    }
    const parsed = parseNodeLine(t);
    if (!parsed.name) {
      issues.push({ line: l.lineNo, severity: "warning", message: "A line with no name was ignored." });
      continue;
    }
    const comments = take();
    current.items.push({
      indent: levelOf(l),
      kind: "folder",
      name: parsed.name,
      label: parsed.label,
      lineNo: l.lineNo,
      ...(parsed.forceFolder ? { forceFolder: true } : {}),
      ...(comments.length ? { comments } : {}),
    });
  }
  const trailingComments = take();

  // --- 4. Build trees ---
  const root = buildTree(rootSection.items, issues, "root");
  const templateOrder = [...templates.keys()];
  const templateTrees: Record<string, FsNode[]> = {};
  for (const [name, section] of templates) {
    templateTrees[name] = buildTree(section.items, issues, `template "${name}"`);
  }

  if (!sawRoot) {
    issues.push({ line: 0, severity: "error", message: "Missing @root section." });
  }

  const doc: FhDocument = {
    version,
    name: docName || "Untitled Structure",
    root,
    templates: templateTrees,
    templateOrder,
    templateColors,
    headerComments,
    rootComments,
    templateComments,
    trailingComments,
  };

  return { doc, issues };
}

function buildTree(items: Item[], issues: ParseIssue[], sectionLabel: string): FsNode[] {
  const root: FsNode[] = [];
  const stack: { node: FsNode; level: number }[] = [];
  for (const item of items) {
    while (stack.length && item.indent <= stack[stack.length - 1].level) stack.pop();
    if (stack.length && item.indent - stack[stack.length - 1].level > 1) {
      issues.push({
        line: item.lineNo,
        severity: "warning",
        message: `Indentation jumps more than one level in ${sectionLabel}.`,
      });
    }
    const node: FsNode = {
      id: newId(),
      kind: item.kind,
      name: item.name,
      label: item.label,
      children: [],
    };
    if (item.forceFolder) node.forceFolder = true;
    if (item.comments) node.comments = item.comments;
    const top = stack.length ? stack[stack.length - 1] : null;
    if (top?.node.kind === "insert") {
      issues.push({
        line: item.lineNo,
        severity: "warning",
        message: `"${item.name}" is indented under an @insert; its contents come from the template, so this line is never created.`,
      });
    }
    // Something with children is a folder, even when its name has a dot.
    if (top && top.node.kind === "folder" && isFileLike(top.node.name)) top.node.forceFolder = true;
    const parent = top ? top.node.children : root;
    parent.push(node);
    stack.push({ node, level: item.indent });
  }
  return root;
}

function parseNodeLine(text: string): { name: string; label?: string; forceFolder?: boolean } {
  const m = text.match(/^(.*?)\s+"([^"]*)"\s*$/);
  let name = (m ? m[1] : text).trim();
  // A trailing slash marks an explicit folder: `v1.2/` is a folder named "v1.2".
  let forceFolder = false;
  if (/[\\/]$/.test(name) && name.replace(/[\\/]+$/, "").trim()) {
    name = name.replace(/[\\/]+$/, "").trim();
    forceFolder = true;
  }
  return { name, ...(m ? { label: m[2] } : {}), ...(forceFolder ? { forceFolder } : {}) };
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}