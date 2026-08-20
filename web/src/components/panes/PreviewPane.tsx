import type { CSSProperties } from "react";
import type { FsNode } from "../../lib/types";
import Preview from "../Preview";

export interface PreviewStats {
  folders: number;
  files: number;
  total: number;
}

interface PreviewPaneProps {
  stats: PreviewStats;
  tree: FsNode[];
  errors: string[];
  style?: CSSProperties;
}

export default function PreviewPane({ stats, tree, errors, style }: PreviewPaneProps) {
  return (
    <section className="pane" style={style}>
      <div className="pane-head">
        <span className="title">Resolved Preview</span>
        <div className="right">
          <span className="preview-stats">
            <span className="blue">
              <b>{stats.folders}</b> folders
            </span>
            <span className="green">
              <b>{stats.files}</b> files
            </span>
            <span>
              <b>{stats.total}</b> total
            </span>
          </span>
        </div>
      </div>
      <Preview tree={tree} errors={errors} />
    </section>
  );
}