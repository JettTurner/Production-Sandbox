import type { TreeStats } from "../lib/resolver";
import type { PlannedTree } from "../lib/validate";
import { MAX_PATH } from "../lib/validate";
import Preview from "./Preview";
import { CheckIcon, CopyIcon, DownloadIcon, FolderArrowIcon, WarningIcon } from "./icons";

interface OutputPaneProps {
  plan: PlannedTree;
  stats: TreeStats;
  /** Circular / missing template errors from the resolver. */
  resolveErrors: string[];
  templateColors: Record<string, string>;
  /** Fill-in names ({Client}) that Create will ask for. */
  blanks: string[];
  canCreateOnDisk: boolean;
  onCreate: () => void;
  onZip: () => void;
  onCopy: () => void;
  className?: string;
  style?: React.CSSProperties;
}

type Level = "ok" | "warning" | "error";

export function CheckLine({ level, children, detail }: { level: Level; children: React.ReactNode; detail?: string[] }) {
  return (
    <li className={`check ${level}`}>
      <span className="check-icon">{level === "ok" ? <CheckIcon /> : <WarningIcon />}</span>
      <span className="check-text">
        {children}
        {detail?.map((d, i) => (
          <span className="check-detail" key={i} title={d}>
            {d}
          </span>
        ))}
      </span>
    </li>
  );
}

/** Right column: what will be created, whether it is safe to create, and the actions that create it. */
export default function OutputPane({
  plan,
  stats,
  resolveErrors,
  templateColors,
  blanks,
  canCreateOnDisk,
  onCreate,
  onZip,
  onCopy,
  className,
  style,
}: OutputPaneProps) {
  const nameErrors = plan.issues.filter((i) => i.severity === "error" && i.code !== "path-length");
  const pathIssue = plan.issues.find((i) => i.code === "path-length");
  const blocked = resolveErrors.length > 0 || plan.errors > 0;
  const empty = plan.tree.length === 0;

  return (
    <aside className={`output ${className ?? ""}`} style={style} aria-label="Output">
      <div className="output-head">
        <div className="output-title">
          <h2>Output</h2>
          <span>What will be created</span>
        </div>
        <dl className="stats">
          <div><dd>{stats.folders.toLocaleString()}</dd><dt>{stats.folders === 1 ? "folder" : "folders"}</dt></div>
          <div><dd>{stats.files.toLocaleString()}</dd><dt>{stats.files === 1 ? "file" : "files"}</dt></div>
          <div><dd>{stats.maxDepth}</dd><dt>{stats.maxDepth === 1 ? "level deep" : "levels deep"}</dt></div>
          <div><dd>{plan.longestPath}</dd><dt>longest path</dt></div>
        </dl>
        <ul className="checks">
          {resolveErrors.map((e, i) => (
            <CheckLine level="error" key={`r${i}`}>{e}</CheckLine>
          ))}
          {nameErrors.length === 0 ? (
            <CheckLine level="ok">All names are valid on Windows</CheckLine>
          ) : (
            <CheckLine level="error" detail={nameErrors.slice(0, 3).map((i) => i.message)}>
              {nameErrors.length} {nameErrors.length === 1 ? "name" : "names"} can’t be created
            </CheckLine>
          )}
          {plan.duplicates === 0 ? (
            <CheckLine level="ok">No duplicate names in the same folder</CheckLine>
          ) : (
            <CheckLine level="warning" detail={plan.duplicateExamples.slice(0, 2)}>
              {plan.duplicates} duplicate {plan.duplicates === 1 ? "name merges" : "names merge"} into one folder
            </CheckLine>
          )}
          <CheckLine level={pathIssue ? pathIssue.severity : "ok"} detail={pathIssue ? [plan.longestPathText] : undefined}>
            {pathIssue
              ? pathIssue.message
              : `Longest path is ${plan.longestPath} of ${MAX_PATH} characters`}
          </CheckLine>
          {blanks.length > 0 && (
            <CheckLine level="ok">
              Create will ask for {blanks.length === 1 ? "one name" : `${blanks.length} names`}: {blanks.join(", ")}
            </CheckLine>
          )}
        </ul>
      </div>

      <div className="output-body">
        {resolveErrors.length > 0 ? (
          <div className="empty-hint">The preview comes back once the template errors above are fixed.</div>
        ) : (
          <Preview tree={plan.tree} templateColors={templateColors} />
        )}
      </div>

      <div className="output-actions">
        {canCreateOnDisk ? (
          <>
            <button
              type="button"
              className="btn primary big"
              onClick={onCreate}
              disabled={blocked || empty}
              title={blocked ? "Fix the problems above first" : "Choose a destination and review before anything is written"}
            >
              <FolderArrowIcon /> Create folders…
            </button>
            <div className="row">
              <button type="button" className="btn" onClick={onZip} disabled={blocked || empty}>
                <DownloadIcon /> Download .zip
              </button>
              <button type="button" className="btn" onClick={onCopy} disabled={empty}>
                <CopyIcon /> Copy as text
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row">
              <button type="button" className="btn primary big" onClick={onZip} disabled={blocked || empty}>
                <DownloadIcon /> Download .zip
              </button>
              <button type="button" className="btn big" onClick={onCopy} disabled={empty}>
                <CopyIcon /> Copy as text
              </button>
            </div>
            <p className="output-note">
              Creating folders directly needs Chrome or Edge on a computer, or the Windows app. Here, download the zip and
              unpack it where the folders should go.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
