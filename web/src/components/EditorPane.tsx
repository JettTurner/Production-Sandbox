import { useCallback, useEffect, useState } from "react";
import type { FhDocument, FsNode, ParseIssue } from "../lib/types";
import CodePane from "./CodePane";
import ColorPicker from "./ColorPicker";
import Designer from "./Designer";
import type { SectionRef } from "./Designer";
import { DEFAULT_TEMPLATE_COLOR } from "./Sidebar";
import { PencilIcon, XIcon } from "./icons";

export type EditorMode = "tree" | "source";

interface EditorPaneProps {
  doc: FhDocument;
  /** Display color per template (file colors plus palette fallbacks). */
  colors: Record<string, string>;
  section: SectionRef;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
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

/** Centre column: one editor for the selected section, as a tree or as source text. */
export default function EditorPane({
  doc,
  colors,
  section,
  mode,
  onModeChange,
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

  const commitRename = () => {
    const next = renaming?.trim();
    if (templateName && next && next !== templateName) onRenameTemplate(templateName, next);
    setRenaming(null);
  };

  return (
    <section className={`editor ${className ?? ""}`} aria-label="Editor">
      <div className="editor-head">
        {mode === "source" ? (
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
            aria-label="Template name"
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
              {uses[templateName] ? `inserted ${uses[templateName]}×` : "not inserted anywhere"}
            </span>
            <button type="button" className="icon-btn" title="Rename template" aria-label="Rename template" onClick={() => setRenaming(templateName)}>
              <PencilIcon />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete template (also removes its @insert lines)"
              aria-label="Delete template"
              onClick={() => onDeleteTemplate(templateName)}
            >
              <XIcon />
            </button>
          </>
        )}
        <div className="spacer" />
        <div className="segmented" role="group" aria-label="Editor view">
          <button type="button" className={mode === "tree" ? "active" : ""} aria-pressed={mode === "tree"} onClick={() => onModeChange("tree")}>
            Tree
          </button>
          <button
            type="button"
            className={mode === "source" ? "active" : ""}
            aria-pressed={mode === "source"}
            onClick={() => onModeChange("source")}
            title="Edit the whole .fh file as text"
          >
            Source{errors.length ? ` · ${errors.length}` : ""}
          </button>
        </div>
      </div>

      {mode === "tree" ? (
        <div className="editor-body">
          <Designer
            key={templateName ?? "@root"}
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
      )}
    </section>
  );
}
