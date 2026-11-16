import { useCallback, useEffect, useState } from "react";
import type { FhDocument, FsNode, ParseIssue } from "../lib/types";
import { isFileNode } from "../lib/types";
import BlocksView from "./BlocksView";
import CodePane from "./CodePane";
import ColumnsView from "./ColumnsView";
import ColorPicker from "./ColorPicker";
import Designer from "./Designer";
import type { SectionRef } from "./Designer";
import { DEFAULT_TEMPLATE_COLOR } from "./Sidebar";
import { CodeIcon, PencilIcon, XIcon } from "./icons";

/** The three ways to look at and edit a section. */
export type EditorView = "columns" | "list" | "blocks";

export const EDITOR_VIEWS: { id: EditorView; label: string; title: string }[] = [
  { id: "columns", label: "Columns", title: "One column per level, like a file browser" },
  { id: "list", label: "List", title: "The whole section as one indented list" },
  { id: "blocks", label: "Blocks", title: "Folders as cards, with drag-in blocks" },
];

interface EditorPaneProps {
  doc: FhDocument;
  /** Display color per template (file colors plus palette fallbacks). */
  colors: Record<string, string>;
  section: SectionRef;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  /** Show the whole .fh file as text instead of the view. */
  sourceOpen: boolean;
  onSourceOpenChange: (open: boolean) => void;
  /** Folders + files each block creates when resolved. */
  blockSizes: Record<string, number>;
  /** Changes when a different document is loaded. */
  docKey: number;
  onSelectSection: (section: SectionRef) => void;
  source: string;
  onSourceChange: (value: string) => void;
  issues: ParseIssue[];
  uses: Record<string, number>;
  onRootChange: (nodes: FsNode[]) => void;
  onTemplateNodesChange: (template: string, nodes: FsNode[]) => void;
  onCreateTemplate: (name: string) => void;
  onRenameTemplate: (oldName: string, newName: string) => void;
  onDeleteTemplate: (name: string) => void;
  onSetColor: (name: string, color: string) => void;
  onNotice: (message: string) => void;
  className?: string;
}

function toggleIn(set: Set<string>, id: string, value?: boolean): Set<string> {
  const next = new Set(set);
  const on = value ?? !next.has(id);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * Everything that can be opened or closed in a section: folders with children,
 * and @insert lines (which expand their template in place). Follows inserts
 * into their templates, each template once.
 */
function expandableIds(nodes: FsNode[], templates: Record<string, FsNode[]>): { folders: string[]; inserts: string[] } {
  const folders: string[] = [];
  const inserts: string[] = [];
  const seen = new Set<string>();
  const walk = (list: FsNode[]) => {
    for (const n of list) {
      if (n.kind === "insert") {
        if (!templates[n.name]) continue;
        inserts.push(n.id);
        if (!seen.has(n.name)) {
          seen.add(n.name);
          walk(templates[n.name]);
        }
      } else if (!isFileNode(n) && n.children.length > 0) {
        folders.push(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return { folders, inserts };
}

function withAll(set: Set<string>, ids: string[], on: boolean): Set<string> {
  const next = new Set(set);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Centre column: one editor for the selected section, as a tree or as source text. */
export default function EditorPane({
  doc,
  colors,
  section,
  view,
  onViewChange,
  sourceOpen,
  onSourceOpenChange,
  blockSizes,
  docKey,
  onSelectSection,
  source,
  onSourceChange,
  issues,
  uses,
  onRootChange,
  onTemplateNodesChange,
  onCreateTemplate,
  onRenameTemplate,
  onDeleteTemplate,
  onSetColor,
  onNotice,
  className,
}: EditorPaneProps) {
  // Lives here (not in Designer) so it survives switching between sections.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedInserts, setExpandedInserts] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);

  const onCollapsedChange = useCallback((id: string, value: boolean) => setCollapsed((s) => toggleIn(s, id, value)), []);
  const onToggleInsert = useCallback((id: string) => setExpandedInserts((s) => toggleIn(s, id)), []);

  const templateName = section.kind === "template" ? section.name! : null;
  useEffect(() => setRenaming(null), [templateName]);

  const nodes = templateName ? doc.templates[templateName] ?? [] : doc.root;
  const errors = issues.filter((i) => i.severity === "error");

  // Expand / collapse for the section being edited. Folders and templates are
  // separate switches: "Expand folders" opens every folder and leaves templates
  // closed; "Expand all" also opens every inserted template in place.
  const setAll = (foldersOpen: boolean, templatesOpen: boolean) => {
    const ids = expandableIds(nodes, doc.templates);
    setCollapsed((prev) => withAll(prev, ids.folders, !foldersOpen));
    setExpandedInserts((prev) => withAll(prev, ids.inserts, templatesOpen));
  };
  const hasInserts = expandableIds(nodes, doc.templates).inserts.length > 0;

  const commitRename = () => {
    const next = renaming?.trim();
    if (templateName && next && next !== templateName) onRenameTemplate(templateName, next);
    setRenaming(null);
  };

  return (
    <section className={`editor ${className ?? ""}`} aria-label="Editor">
      <div className="editor-head">
        {sourceOpen ? (
          <>
            <h1 className="editor-title">Source</h1>
            <span className="editor-meta">the whole .fh file · {source.split("\n").length} lines</span>
          </>
        ) : templateName === null ? (
          <h1 className="editor-title">Root</h1>
        ) : renaming !== null ? (
          <input
            className="text-input mono title-input"
            autoFocus
            aria-label="Block name"
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(null);
              e.stopPropagation();
            }}
          />
        ) : (
          <>
            <ColorPicker value={colors[templateName] ?? DEFAULT_TEMPLATE_COLOR} onChange={(c) => onSetColor(templateName, c)} />
            <h1 className="editor-title mono" title={templateName}>{templateName}</h1>
            <span className="editor-meta">
              {uses[templateName] ? `used ${uses[templateName]}×` : "not used anywhere yet"}
            </span>
            <button type="button" className="icon-btn" title="Rename this block" aria-label="Rename this block" onClick={() => setRenaming(templateName)}>
              <PencilIcon />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete this block (also removes it everywhere it is used)"
              aria-label="Delete this block"
              onClick={() => onDeleteTemplate(templateName)}
            >
              <XIcon />
            </button>
          </>
        )}
        <div className="spacer" />
        {!sourceOpen && view === "list" && (
          <div className="editor-tools">
            {hasInserts && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setAll(true, false)}
                title="Open every folder; leave blocks closed"
              >
                Expand folders
              </button>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => setAll(true, true)}
              title={hasInserts ? "Open every folder and every block" : "Open every folder"}
            >
              Expand all
            </button>
            <button type="button" className="link-btn" onClick={() => setAll(false, false)} title="Close every folder and block">
              Collapse all
            </button>
          </div>
        )}
        <div className="segmented" role="group" aria-label="View">
          {EDITOR_VIEWS.map((v) => (
            <button
              type="button"
              key={v.id}
              className={!sourceOpen && view === v.id ? "active" : ""}
              aria-pressed={!sourceOpen && view === v.id}
              title={v.title}
              onClick={() => {
                onViewChange(v.id);
                onSourceOpenChange(false);
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`btn icon source-toggle ${sourceOpen ? "active" : ""}`}
          aria-pressed={sourceOpen}
          aria-label="Source text"
          title="Edit the whole .fh file as text"
          onClick={() => onSourceOpenChange(!sourceOpen)}
        >
          <CodeIcon />
          {errors.length > 0 && <span className="badge-dot" />}
        </button>
      </div>

      {sourceOpen ? (
        <>
          <div className="editor-body code">
            <CodePane source={source} onChange={onSourceChange} />
          </div>
          {issues.length > 0 && (
            <div className={`issue-banner ${errors.length ? "error" : "warning"}`} role="status">
              <ul>
                {issues.slice(0, 8).map((issue, i) => (
                  <li key={i}>
                    {issue.line ? `Line ${issue.line}: ` : ""}
                    {issue.message}
                  </li>
                ))}
                {issues.length > 8 && <li>…and {issues.length - 8} more</li>}
              </ul>
            </div>
          )}
        </>
      ) : view === "list" ? (
        <div className="editor-body">
          <Designer
            key={`${docKey}:${templateName ?? "@root"}`}
            nodes={nodes}
            section={section}
            templates={doc.templateOrder}
            onNodesChange={templateName ? (n) => onTemplateNodesChange(templateName, n) : onRootChange}
            templateMap={doc.templates}
            templateColors={colors}
            expandedInserts={expandedInserts}
            onToggleInsert={onToggleInsert}
            onTemplateNodesChange={onTemplateNodesChange}
            onAddTemplate={onCreateTemplate}
            onRenameTemplate={onRenameTemplate}
            onSetTemplateColor={onSetColor}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            onNotice={onNotice}
          />
        </div>
      ) : (
        <div className="editor-body">
          {(() => {
            const props = {
              doc,
              section,
              colors,
              uses,
              blockSizes,
              onRootChange,
              onTemplateNodesChange,
              onCreateTemplate,
              onOpenBlock: (name: string) => onSelectSection({ kind: "template", name }),
              onNotice,
            };
            const key = `${docKey}:${templateName ?? "@root"}`;
            return view === "columns" ? <ColumnsView key={key} {...props} /> : <BlocksView key={key} {...props} />;
          })()}
        </div>
      )}
    </section>
  );
}
