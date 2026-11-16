import { useEffect, useMemo, useRef, useState } from "react";
import type { FhDocument, FsNode } from "../lib/types";
import { countNodes, resolveTree } from "../lib/resolver";
import { planTree, MAX_PATH } from "../lib/validate";
import { fillBlanks, findBlanks } from "../lib/blanks";
import { createOnDisk, scanDestination, supportsFsAccess } from "../lib/folders";
import type { CreateResult, DiskPlan } from "../lib/folders";
import { CheckLine } from "./OutputPane";
import { FileIcon, FolderArrowIcon, FolderIcon, XIcon } from "./icons";

interface CreateDialogProps {
  doc: FhDocument;
  /** Preselected scope: a template name, or null for the whole structure. */
  initialTemplate: string | null;
  onClose: () => void;
}

const MAX_ROWS = 400;

/**
 * "Create folders" review step: pick a destination, see a dry run of what is
 * new, what already exists and what clashes, and only then write. Nothing is
 * ever overwritten or deleted.
 */
export default function CreateDialog({ doc, initialTemplate, onClose }: CreateDialogProps) {
  const [scope, setScope] = useState<string>(initialTemplate ?? "");
  // Answers to fill-in names ({Client}), keyed in lower case.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wrap, setWrap] = useState("");
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [plan, setPlan] = useState<DiskPlan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const supported = supportsFsAccess();

  // What will be written: the chosen scope, optionally wrapped in one new folder.
  const planned = useMemo(() => {
    const source = scope ? doc.templates[scope] ?? [] : doc.root;
    const resolved = resolveTree(source, doc.templates);
    const wrapName = wrap.trim().replace(/[\\/]+$/, "");
    const raw: FsNode[] = wrapName
      ? [{ id: "wrap", kind: "folder", name: wrapName, forceFolder: true, children: resolved.tree }]
      : resolved.tree;
    const blanks = findBlanks(raw);
    const missing = blanks.filter((b) => !answers[b.toLowerCase()]?.trim());
    return { ...planTree(fillBlanks(raw, answers)), resolveErrors: resolved.errors, blanks, missing };
  }, [doc, scope, wrap, answers]);
  const stats = useMemo(() => countNodes(planned.tree), [planned.tree]);
  const blocked = planned.errors > 0 || planned.resolveErrors.length > 0 || planned.missing.length > 0;

  useEffect(() => setResult(null), [scope, wrap, answers]);

  // Re-run the dry run whenever the destination or the plan changes.
  useEffect(() => {
    if (!dir || blocked) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setScanning(true);
    setError(null);
    const timer = setTimeout(() => {
      scanDestination(dir, planned.tree)
        .then((p) => {
          if (!cancelled) setPlan(p);
        })
        .catch((err) => {
          if (!cancelled) {
            setPlan(null);
            setError(`Couldn't read "${dir.name}": ${(err as Error).message}`);
          }
        })
        .finally(() => {
          if (!cancelled) setScanning(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dir, planned.tree, blocked]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && progress === null) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, progress]);

  const choose = async () => {
    try {
      const handle = await window.showDirectoryPicker!({ id: "fh-destination", mode: "readwrite" });
      setResult(null);
      setDir(handle);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(`Couldn't open that folder: ${(err as Error).message}`);
    }
  };

  const run = async () => {
    if (!dir) return;
    setProgress(0);
    setError(null);
    try {
      const res = await createOnDisk(dir, planned.tree, setProgress);
      setResult(res);
      setPlan(await scanDestination(dir, planned.tree).catch(() => null));
    } catch (err) {
      setError(`Creating folders failed: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  };

  const total = stats.total;
  const canCreate = !!dir && !!plan && !blocked && !scanning && progress === null && plan.conflictCount === 0 && plan.newCount > 0;
  const rows = plan?.entries.slice(0, MAX_ROWS) ?? [];
  const nameErrors = planned.issues.filter((i) => i.severity === "error" && i.code !== "path-length");
  const pathIssue = planned.issues.find((i) => i.code === "path-length");

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && progress === null && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="dialog-head">
          <div>
            <h2 id="create-title">Create folders</h2>
            <span>{doc.name} · review before anything is written</span>
          </div>
          <button ref={closeRef} type="button" className="icon-btn big" aria-label="Close" onClick={onClose} disabled={progress !== null}>
            <XIcon />
          </button>
        </div>

        {!supported ? (
          <div className="dialog-body single">
            <p>
              This browser can’t write folders directly. Use Chrome or Edge on a computer, or the Windows app, or close
              this and choose <b>Download .zip</b> instead.
            </p>
          </div>
        ) : (
          <div className="dialog-body">
            <div className="dialog-col">
              <div className="field">
                <span className="field-label" id="dest-label">Destination</span>
                <div className="dest">
                  <span className={`dest-name ${dir ? "" : "empty"}`} aria-labelledby="dest-label">
                    {dir ? dir.name : "No folder chosen"}
                  </span>
                  <button type="button" className="btn big" onClick={choose} disabled={progress !== null}>
                    {dir ? "Change…" : "Choose…"}
                  </button>
                </div>
              </div>

              <fieldset className="field">
                <legend className="field-label">What to create</legend>
                <label className={`radio-card ${scope === "" ? "active" : ""}`}>
                  <input type="radio" name="scope" checked={scope === ""} onChange={() => setScope("")} />
                  <span>
                    <b>Whole structure</b>
                    <small>Everything under Root</small>
                  </span>
                </label>
                <label className={`radio-card ${scope !== "" ? "active" : ""} ${doc.templateOrder.length ? "" : "disabled"}`}>
                  <input
                    type="radio"
                    name="scope"
                    checked={scope !== ""}
                    disabled={doc.templateOrder.length === 0}
                    onChange={() => setScope(doc.templateOrder[0] ?? "")}
                  />
                  <span>
                    <b>One block</b>
                    <small>Stamp out a single block, for example one new project</small>
                    {scope !== "" && (
                      <select aria-label="Block" value={scope} onChange={(e) => setScope(e.target.value)}>
                        {doc.templateOrder.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                </label>
              </fieldset>

              <div className="field">
                <label className="field-label" htmlFor="wrap-name">
                  Put it all inside a new folder (optional)
                </label>
                <input
                  id="wrap-name"
                  className="text-input mono tall"
                  placeholder="New folder name"
                  value={wrap}
                  onChange={(e) => setWrap(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {planned.blanks.length > 0 && (
                <fieldset className="field">
                  <legend className="field-label">Fill in the names</legend>
                  {planned.blanks.map((b) => (
                    <label className="blank-row" key={b}>
                      <span>{b}</span>
                      <input
                        className="text-input mono"
                        aria-label={b}
                        value={answers[b.toLowerCase()] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [b.toLowerCase()]: e.target.value }))}
                        spellCheck={false}
                      />
                    </label>
                  ))}
                </fieldset>
              )}

              <ul className="checks">
                {planned.missing.length > 0 && (
                  <CheckLine level="warning">Fill in {planned.missing.join(", ")} to continue</CheckLine>
                )}
                {planned.resolveErrors.map((e, i) => (
                  <CheckLine level="error" key={i}>{e}</CheckLine>
                ))}
                {nameErrors.length === 0 ? (
                  <CheckLine level="ok">All names are valid on Windows</CheckLine>
                ) : (
                  <CheckLine level="error" detail={nameErrors.slice(0, 3).map((i) => i.message)}>
                    {nameErrors.length} {nameErrors.length === 1 ? "name" : "names"} can’t be created
                  </CheckLine>
                )}
                <CheckLine level={pathIssue ? pathIssue.severity : "ok"}>
                  Longest path is {planned.longestPath} characters, leaving {Math.max(0, MAX_PATH - planned.longestPath)} for
                  the destination’s own path
                </CheckLine>
                <CheckLine level="ok">Nothing is overwritten or deleted</CheckLine>
              </ul>
            </div>

            <div className="dialog-col plan-col">
              <div className="plan-stats">
                <div className="accent"><b>{plan ? plan.newCount.toLocaleString() : total.toLocaleString()}</b><span>{plan ? "new" : "to create"}</span></div>
                <div><b>{plan ? plan.existCount.toLocaleString() : "–"}</b><span>already there, kept</span></div>
                <div className={plan?.conflictCount ? "bad" : ""}><b>{plan ? plan.conflictCount.toLocaleString() : "–"}</b><span>conflicts</span></div>
              </div>
              <div className="plan-list" aria-live="polite">
                {!dir && <p className="plan-empty">Choose a destination to see exactly what will be created there.</p>}
                {dir && scanning && !plan && <p className="plan-empty">Checking “{dir.name}”…</p>}
                {rows.map((e) => (
                  <div className={`plan-row ${e.status}`} key={e.path} style={{ paddingLeft: 10 + e.depth * 14 }} title={e.path}>
                    <span className="node-icon">{e.file ? <FileIcon /> : <FolderIcon />}</span>
                    <span className="name">{e.name}</span>
                    <span className="tag">{e.status === "new" ? "new" : e.status === "exists" ? "exists" : "conflict"}</span>
                  </div>
                ))}
                {plan && plan.entries.length > MAX_ROWS && (
                  <p className="plan-empty">…and {(plan.entries.length - MAX_ROWS).toLocaleString()} more</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="dialog-foot">
          <span className={`dialog-status ${error || result?.failed ? "bad" : ""}`} role="status">
            {error
              ? error
              : progress !== null
                ? `Creating… ${progress.toLocaleString()} of ${total.toLocaleString()}`
                : result?.failed
                  ? `Stopped at "${result.failed.path}": ${result.failed.message}. ${result.created.toLocaleString()} created before that; nothing was removed.`
                  : result
                    ? `Done. Created ${result.created.toLocaleString()} in "${dir?.name}"${result.skipped ? `, left ${result.skipped.toLocaleString()} existing untouched` : ""}.`
                    : plan?.conflictCount
                      ? "A file is in the way where a folder should go (or the reverse). Rename it or pick another destination."
                      : plan && plan.newCount === 0
                        ? "Everything already exists there. There is nothing to create."
                        : "Folders that already exist are left exactly as they are."}
          </span>
          <button type="button" className="btn big" onClick={onClose} disabled={progress !== null}>
            {result && !result.failed ? "Close" : "Cancel"}
          </button>
          {supported && !(result && !result.failed) && (
            <button type="button" className="btn primary big" onClick={run} disabled={!canCreate}>
              <FolderArrowIcon /> {plan ? `Create ${plan.newCount.toLocaleString()}` : "Create"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
