import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FsNode } from "../../lib/types";
import Designer from "../Designer";
import { CodeIcon } from "../icons";
import ColorPicker from "../ColorPicker";

interface RootDesignerPaneProps {
  name: string;
  onNameChange: (value: string) => void;
  tree: FsNode[];
  templates: string[];
  templateMap: Record<string, FsNode[]>;
  templateColors: Record<string, string>;
  onNodesChange: (nodes: FsNode[]) => void;
  onTemplateNodesChange: (templateName: string, nodes: FsNode[]) => void;
  onAddTemplate: (name: string) => void;
  onRenameTemplate: (oldName: string, newName: string) => void;
  onSetTemplateColor: (name: string, color: string) => void;
  sourceOpen: boolean;
  onToggleSource: () => void;
  style?: CSSProperties;
  className?: string;
}

export default function RootDesignerPane({
  name,
  onNameChange,
  tree,
  templates,
  templateMap,
  templateColors,
  onNodesChange,
  onTemplateNodesChange,
  onAddTemplate,
  onRenameTemplate,
  onSetTemplateColor,
  sourceOpen,
  onToggleSource,
  style,
  className,
}: RootDesignerPaneProps) {
  const [expandedInserts, setExpandedInserts] = useState<Set<string>>(new Set());

  const toggleInsert = useCallback((id: string) => {
    setExpandedInserts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Stabilize object references so the root Designer (and its nested Designers)
  // don't re-render when only unrelated doc fields change.
  const section = useMemo(() => ({ kind: "root" as const }), []);
  const templateMapRef = useRef(templateMap);
  const templateColorsRef = useRef(templateColors);
  // Only update refs when the actual template content or colors change.
  const templateKey = templates.join("\0");
  const colorsKey = templates.map((t) => `${t}:${templateColors[t] ?? ""}`).join("\0");
  const prevTemplateKeyRef = useRef(templateKey);
  const prevColorsKeyRef = useRef(colorsKey);
  if (templateKey !== prevTemplateKeyRef.current || templateMap !== templateMapRef.current) {
    templateMapRef.current = templateMap;
    prevTemplateKeyRef.current = templateKey;
  }
  if (colorsKey !== prevColorsKeyRef.current || templateColors !== templateColorsRef.current) {
    templateColorsRef.current = templateColors;
    prevColorsKeyRef.current = colorsKey;
  }

  return (
    <section className={`pane root-pane ${className ?? ""}`} style={style}>
      <div className="pane-head">
        <span className="title">Root Designer</span>
        <div className="right">
          <button
            className={`btn ${sourceOpen ? "active" : ""}`}
            onClick={onToggleSource}
            title="Toggle the raw .fh source editor"
          >
            <CodeIcon />
          </button>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>double-click to rename · drag to move · ＋ to add · double-click @insert to expand</span>
        </div>
      </div>
      <div className="sub-head">
        <span className="title">Name</span>
        <input
          className="name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Structure name"
          title="Name of this folder structure (writes the @name line)"
          spellCheck={false}
        />
        <span className="title" style={{ marginLeft: 16 }}>Color</span>
        <ColorPicker
          value={templateColors["@root"] ?? "#bc8cff"}
          onChange={(c) => onSetTemplateColor("@root", c)}
        />
      </div>
      <div className="pane-body">
        <Designer
          nodes={tree}
          section={section}
          templates={templates}
          onNodesChange={onNodesChange}
          templateMap={templateMapRef.current}
          templateColors={templateColorsRef.current}
          expandedInserts={expandedInserts}
          onToggleInsert={toggleInsert}
          onTemplateNodesChange={onTemplateNodesChange}
          onAddTemplate={onAddTemplate}
          onRenameTemplate={onRenameTemplate}
          onSetTemplateColor={onSetTemplateColor}
        />
      </div>
    </section>
  );
}
