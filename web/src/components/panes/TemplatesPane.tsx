import type { CSSProperties } from "react";
import type { FsNode } from "../../lib/types";
import Designer from "../Designer";
import SectionPicker from "../SectionPicker";

interface TemplatesPaneProps {
  templates: string[];
  active: string | null;
  tree: FsNode[];
  onSelect: (name: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onNodesChange: (nodes: FsNode[]) => void;
  style?: CSSProperties;
  className?: string;
}

export default function TemplatesPane({
  templates,
  active,
  tree,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onNodesChange,
  style,
  className,
}: TemplatesPaneProps) {
  return (
    <section className={`pane template-pane ${className ?? ""}`} style={style}>
      <div className="pane-head">
        <span className="title">Templates</span>
        <div className="right">
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>reusable structures</span>
        </div>
      </div>
      <SectionPicker
        templates={templates}
        active={active}
        onSelect={onSelect}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="pane-body">
        {active ? (
          <Designer
            nodes={tree}
            section={{ kind: "template", name: active }}
            templates={templates}
            onNodesChange={onNodesChange}
          />
        ) : (
          <div className="empty-hint">
            <div className="big">🗂️</div>
            Select a template above to design it, or add a new one with + Template.
          </div>
        )}
      </div>
    </section>
  );
}