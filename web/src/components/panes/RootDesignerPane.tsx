import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FsNode } from "../../lib/types";
import Designer from "../Designer";
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
  style,
  className,
}: RootDesignerPaneProps) {
  const [expandedInserts, setExpandedInserts] = useState<Set<string>>(new Set());

  const toggleInsert = useCallback((nodeId: string) => {
    setExpandedInserts((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
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
        <input
          className="name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Structure name"
          title="Name of this folder structure (writes the @name line)"
          spellCheck={false}
        />
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
