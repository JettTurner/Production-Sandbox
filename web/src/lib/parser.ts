import type { FhDocument, FsNode, NodeKind, ParseIssue, ParseResult } from "./types";
import { newId } from "./types";

interface RawLine {
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
    if (COMMENT_RE.test(text)) return;
    const trimmed = text.trim();
    const leadingTabs = (text.match(/^\t*/)?.[0].length ?? 0);
    const leadingSpaces = (text.match(/^ */)?.[0].length ?? 0);
    lines.push({ text, trimmed, leadingTabs, leadingSpaces, lineNo: i + 1 });
  });

  // --- 2. Detect indentation unit (spaces-per-level) ---
  const spaceIndents = lines
    .filter((l) => l.leadingSpaces > 0 && l.leadingTabs === 0)
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

  for (const l of lines) {
    const t = l.trimmed;

    if (t === "@root") {
      current = rootSection;
      rootSection.items = []; // a later @root resets the root (matches legacy)
      sawRoot = true;
      continue;
    }
    if (t.startsWith("@template")) {
      const name = t.split(/\s+/)[1];
      if (!name) {
        issues.push({ line: l.lineNo, severity: "error", message: "@template requires a name." });
        continue;
      }
      if (templates.has(name)) {
        issues.push({ line: l.lineNo, severity: "error", message: `Duplicate template name "${name}".` });
        continue;
      }
      const section: Section = { kind: "template", templateName: name, items: [] };
      templates.set(name, section);
      current = section;
      continue;
    }
    if (t.startsWith("@version")) {
      version = t.split(/\s+/)[1] ?? version;
      continue;
    }
    if (t.startsWith("@name")) {
      docName = t.replace(/^@name\s+/, "").trim();
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
      current.items.push({ indent: levelOf(l), kind: "insert", name, lineNo: l.lineNo });
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
    current.items.push({ indent: levelOf(l), kind: "folder", name: parsed.name, label: parsed.label, lineNo: l.lineNo });
  }

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
  };

  return { doc, issues };
}

function buildTree(items: Item[], issues: ParseIssue[], sectionLabel: string): FsNode[] {
  const root: FsNode[] = [];
  const stack: { children: FsNode[]; level: number }[] = [];
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
    const parent = stack.length ? stack[stack.length - 1].children : root;
    parent.push(node);
    stack.push({ children: node.children, level: item.indent });
  }
  return root;
}

function parseNodeLine(text: string): { name: string; label?: string } {
  const m = text.match(/^(.*?)\s+"([^"]*)"\s*$/);
  if (m) return { name: m[1].trim(), label: m[2] };
  return { name: text.trim() };
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}