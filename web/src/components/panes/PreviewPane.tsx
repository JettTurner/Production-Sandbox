import type { CSSProperties } from "react";
import type { FsNode } from "../../lib/types";
import type { TreeStats } from "../../lib/resolver";
import Preview from "../Preview";

interface PreviewPaneProps {
  stats: TreeStats;
  tree: FsNode[];
  errors: string[];
  style?: CSSProperties;
  className?: string;
}

export default function PreviewPane({ stats, tree, errors, style, className }: PreviewPaneProps) {
  return (
    <section className={`pane preview-pane ${className ?? ""}`} style={style}>
      <div className="pane-head">
        <span className="title">Resolved Preview</span>
        <div className="right">
          <span className="preview-stats">
            <span className="blue" title="Number of folders in the resolved tree">
              <b>{stats.folders}</b> folders
            </span>
            <span className="green" title="Number of files (names containing a dot) in the resolved tree">
              <b>{stats.files}</b> files
            </span>
            <span title="Folders + files in the resolved tree">
              <b>{stats.total}</b> total
            </span>
            <span title="Deepest level of nesting (root counts as level 1)">
              <b>{stats.maxDepth}</b> depth
            </span>
            <span title="Most nodes on a single level — how wide the widest branching point is">
              <b>{stats.maxWidth}</b> widest
            </span>
          </span>
        </div>
      </div>
      <Preview tree={tree} errors={errors} />
    </section>
  );
}