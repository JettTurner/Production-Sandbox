import type { FsNode } from "../../lib/types";
import Designer from "../Designer";

interface RootDesignerPaneProps {
  name: string;
  onNameChange: (value: string) => void;
  tree: FsNode[];
  templates: string[];
  onNodesChange: (nodes: FsNode[]) => void;
}

export default function RootDesignerPane({
  name,
  onNameChange,
  tree,
  templates,
  onNodesChange,
}: RootDesignerPaneProps) {
  return (
    <section className="pane">
      <div className="pane-head">
        <span className="title">Root Designer</span>
        <div className="right">
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>double-click to rename · drag to move · ＋ to add</span>
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
      </div>
      <div className="pane-body">
        <Designer nodes={tree} section={{ kind: "root" }} templates={templates} onNodesChange={onNodesChange} />
      </div>
    </section>
  );
}