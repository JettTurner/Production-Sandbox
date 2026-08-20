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
}

export default function PreviewPane({ stats, tree, errors }: PreviewPaneProps) {
  return (
    <section className="pane">
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