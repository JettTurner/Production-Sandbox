import type { CSSProperties } from "react";
import type { ParseIssue } from "../../lib/types";
import CodePane from "../CodePane";

interface SourcePaneProps {
  source: string;
  onChange: (value: string) => void;
  issues: ParseIssue[];
  hasErrors: boolean;
  style?: CSSProperties;
}

export default function SourcePane({ source, onChange, issues, hasErrors, style }: SourcePaneProps) {
  return (
    <section className="pane source-sidebar" style={style}>
      <div className="pane-head">
        <span className="title">Source (.fh)</span>
        <div className="right">
          <span className="preview-stats">
            <span>{source.split("\n").length} lines</span>
          </span>
        </div>
      </div>
      <div className="pane-body">
        <CodePane source={source} onChange={onChange} />
      </div>
      {issues.length > 0 && (
        <div className={`issue-banner ${hasErrors ? "error" : "warning"}`}>
          <ul>
            {issues.slice(0, 8).map((issue, i) => (
              <li key={i}>
                {issue.line ? `Line ${issue.line}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}