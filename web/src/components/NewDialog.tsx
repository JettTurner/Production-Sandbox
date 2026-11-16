import { useEffect, useMemo, useRef, useState } from "react";
import { buildKit, cleanNames, defaultKitOptions, DEFAULT_EXTRAS, DEFAULT_PROJECT_FOLDERS, SORT_KINDS } from "../lib/kit";
import type { KitOptions, SortKind } from "../lib/kit";
import { parseFh } from "../lib/parser";
import { countNodes, resolveDoc } from "../lib/resolver";
import { planTree } from "../lib/validate";
import type { FsNode } from "../lib/types";
import { isFileNode } from "../lib/types";
import { CheckIcon, FileIcon, FolderIcon, PlusIcon, XIcon } from "./icons";

interface NewDialogProps {
  samples: { value: string; label: string }[];
  /** Load generated (or blank) .fh text as a new, unsaved structure. */
  onCreate: (text: string) => void;
  onLoadSample: (value: string) => void;
  /** Start from a real folder on this computer (absent where the browser cannot read folders). */
  onImportFolder?: () => void;
  onClose: () => void;
}

const BLANK = (name: string) => `@version 1.0\n@name ${name.trim() || "Untitled Structure"}\n\n#---Root---\n@root\n`;
const PREVIEW_ROWS = 80;
const BLOCK_COLORS = ["#bc8cff", "#f97583", "#79c0ff", "#56d4dd"];

/** Editable list of names shown as chips: click × to remove, type to add. */
function ChipList({ values, onChange, addLabel, mono }: { values: string[]; onChange: (v: string[]) => void; addLabel: string; mono?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = cleanNames([...values, draft]);
    if (next.length !== values.length) onChange(next);
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="chips">
      {values.map((v) => (
        <span className={`chip on removable ${mono ? "mono" : ""}`} key={v}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} title="Remove" onClick={() => onChange(values.filter((x) => x !== v))}>
            <XIcon />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          className="text-input chip-input"
          autoFocus
          aria-label={addLabel}
          placeholder="Type a name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button type="button" className="chip add" onClick={() => setAdding(true)}>
          <PlusIcon /> {addLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The New dialog: start from a kit. Three steps — pick a starting point,
 * answer a few plain questions, name it — with a live preview of the result.
 * The answers are turned into a normal .fh document by lib/kit.ts.
 */
export default function NewDialog({ samples, onCreate, onLoadSample, onImportFolder, onClose }: NewDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kit, setKit] = useState<"projects" | "blank">("projects");
  const [o, setO] = useState<KitOptions>(() => defaultKitOptions());
  const closeRef = useRef<HTMLButtonElement>(null);
  const set = (patch: Partial<KitOptions>) => setO((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const text = useMemo(() => (kit === "blank" ? BLANK(o.name) : buildKit(o)), [kit, o]);
  const preview = useMemo(() => {
    const doc = parseFh(text).doc;
    if (!doc) return null;
    const plan = planTree(resolveDoc(doc).tree);
    const colors: Record<string, string> = {};
    doc.templateOrder.forEach((t, i) => (colors[t] = BLOCK_COLORS[i % BLOCK_COLORS.length]));
    const rows: { node: FsNode; depth: number }[] = [];
    const walk = (nodes: FsNode[], depth: number) => {
      for (const n of nodes) {
        rows.push({ node: n, depth });
        walk(n.children, depth + 1);
      }
    };
    walk(plan.tree, 0);
    return { rows, colors, stats: countNodes(plan.tree), problems: plan.issues.filter((i) => i.severity === "error") };
  }, [text]);

  const toggleSort = (kind: SortKind) =>
    set({ sortBy: o.sortBy.includes(kind) ? o.sortBy.filter((k) => k !== kind) : [...o.sortBy, kind] });
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const projectChoices = [...DEFAULT_PROJECT_FOLDERS, ...o.projectFolders.filter((f) => !DEFAULT_PROJECT_FOLDERS.includes(f))];
  const extraChoices = [...DEFAULT_EXTRAS, ...o.extras.filter((f) => !DEFAULT_EXTRAS.includes(f))];

  const steps: { n: 1 | 2 | 3; title: string; sub: string }[] = [
    { n: 1, title: "Pick a starting point", sub: step > 1 ? (kit === "blank" ? "Blank" : "Projects kit") : "" },
    { n: 2, title: "Choose what goes inside", sub: kit === "blank" ? "Skipped" : "A few questions" },
    { n: 3, title: "Name it and create", sub: "" },
  ];
  const next = () => setStep(step === 1 ? (kit === "blank" ? 3 : 2) : 3);
  const back = () => setStep(step === 3 ? (kit === "blank" ? 1 : 2) : 1);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog wizard" role="dialog" aria-modal="true" aria-labelledby="new-title">
        <div className="dialog-head">
          <div>
            <h2 id="new-title">New structure</h2>
            <span>Answer a few questions, or start blank. Everything can be changed afterwards.</span>
          </div>
          <button ref={closeRef} type="button" className="icon-btn big" aria-label="Close" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="wizard-body">
          <ol className="wizard-steps" aria-label="Steps">
            {steps.map((s) => (
              <li key={s.n} className={step === s.n ? "now" : step > s.n ? "done" : ""} aria-current={step === s.n ? "step" : undefined}>
                <span className="step-dot">{step > s.n ? <CheckIcon /> : s.n}</span>
                <span>
                  <b>{s.title}</b>
                  {s.sub && <small>{s.sub}</small>}
                </span>
              </li>
            ))}
          </ol>

          <div className="wizard-main">
            {step === 1 && (
              <>
                <section className="question">
                  <h3>How do you want to start?</h3>
                  <div className="kit-cards">
                    <button type="button" className={`kit-card ${kit === "projects" ? "active" : ""}`} aria-pressed={kit === "projects"} onClick={() => setKit("projects")}>
                      <b>Projects kit</b>
                      <small>Sort work by department, year or client. Every project gets the same folders.</small>
                    </button>
                    <button type="button" className={`kit-card ${kit === "blank" ? "active" : ""}`} aria-pressed={kit === "blank"} onClick={() => setKit("blank")}>
                      <b>Blank</b>
                      <small>An empty structure. Add folders and blocks yourself.</small>
                    </button>
                  </div>
                </section>
                {onImportFolder && (
                  <section className="question">
                    <h3>Already have folders you like?</h3>
                    <div className="chips">
                      <button type="button" className="chip" onClick={onImportFolder}>
                        Copy the layout of a folder on this computer…
                      </button>
                    </div>
                  </section>
                )}
                <section className="question">
                  <h3>Or open an example</h3>
                  <div className="chips">
                    {samples.map((s) => (
                      <button type="button" className="chip" key={s.value} onClick={() => onLoadSample(s.value)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {step === 2 && (
              <>
                <section className="question">
                  <h3>How do you sort your work?</h3>
                  <p>Pick one or more. The one you pick first is the top level.</p>
                  <div className="chips">
                    {SORT_KINDS.map((k) => {
                      const at = o.sortBy.indexOf(k.kind);
                      return (
                        <button type="button" key={k.kind} className={`chip ${at >= 0 ? "on" : ""}`} aria-pressed={at >= 0} onClick={() => toggleSort(k.kind)}>
                          {at >= 0 && <span className="chip-order">{at + 1}</span>}
                          {k.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
                {o.sortBy.map((kind) => {
                  const k = SORT_KINDS.find((x) => x.kind === kind)!;
                  return (
                    <section className="question" key={kind}>
                      <h3>Which {k.plural}?</h3>
                      <ChipList values={o.names[kind]} onChange={(v) => set({ names: { ...o.names, [kind]: v } })} addLabel="Add one" />
                    </section>
                  );
                })}
                <section className="question">
                  <h3>What does every project get?</h3>
                  <p>Untick anything you don’t need. This becomes your Project block.</p>
                  <div className="ticks">
                    {projectChoices.map((f) => (
                      <label className="tick" key={f}>
                        <input type="checkbox" checked={o.projectFolders.includes(f)} onChange={() => set({ projectFolders: projectChoices.filter((x) => toggleIn(o.projectFolders, f).includes(x)) })} />
                        <span>{f}</span>
                      </label>
                    ))}
                  </div>
                  <ChipList values={[]} onChange={(v) => set({ projectFolders: cleanNames([...o.projectFolders, ...v]) })} addLabel="Add a folder" mono />
                </section>
                <section className="question">
                  <h3>Anything else at the top?</h3>
                  <div className="chips">
                    {extraChoices.map((f) => {
                      const on = o.extras.includes(f);
                      return (
                        <button type="button" key={f} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ extras: extraChoices.filter((x) => toggleIn(o.extras, f).includes(x)) })}>
                          {on && <CheckIcon />}
                          {f}
                        </button>
                      );
                    })}
                  </div>
                  <ChipList values={[]} onChange={(v) => set({ extras: cleanNames([...o.extras, ...v]) })} addLabel="Add another" />
                </section>
              </>
            )}

            {step === 3 && (
              <>
                <section className="question">
                  <h3><label htmlFor="kit-name">What is this structure called?</label></h3>
                  <input id="kit-name" className="text-input tall" value={o.name} onChange={(e) => set({ name: e.target.value })} spellCheck={false} />
                </section>
                {kit === "projects" && (
                  <>
                    <section className="question">
                      <h3><label htmlFor="kit-top">Put everything inside one folder? (optional)</label></h3>
                      <input id="kit-top" className="text-input tall mono" placeholder="For example STUDIO" value={o.topFolder} onChange={(e) => set({ topFolder: e.target.value })} spellCheck={false} />
                    </section>
                    <section className="question">
                      <label className="tick wide">
                        <input type="checkbox" checked={o.numberTop} onChange={(e) => set({ numberTop: e.target.checked })} />
                        <span>Number the top folders (01_, 02_, …) so they stay in order</span>
                      </label>
                    </section>
                  </>
                )}
              </>
            )}
          </div>

          <aside className="wizard-preview" aria-label="Preview">
            <div className="section-label">What you get</div>
            {preview && preview.rows.length > 0 ? (
              <>
                <p className="wizard-count">
                  {preview.stats.folders.toLocaleString()} {preview.stats.folders === 1 ? "folder" : "folders"}
                  {preview.stats.files ? `, ${preview.stats.files} files` : ""}
                </p>
                <div className="wizard-tree">
                  {preview.rows.slice(0, PREVIEW_ROWS).map(({ node, depth }) => (
                    <div className="wizard-row" key={node.id} style={{ paddingLeft: depth * 14 }}>
                      <span className="node-icon">{isFileNode(node) ? <FileIcon /> : <FolderIcon />}</span>
                      <span className="name">{node.name}</span>
                      {node.from && <span className="from-dot" style={{ background: preview.colors[node.from] }} title={`From the block ${node.from}`} />}
                    </div>
                  ))}
                  {preview.rows.length > PREVIEW_ROWS && <p className="side-hint">…and {preview.rows.length - PREVIEW_ROWS} more</p>}
                </div>
                {preview.problems.length > 0 && <p className="wizard-problem">{preview.problems[0].message}</p>}
              </>
            ) : (
              <p className="side-hint">An empty structure, ready for you to fill in.</p>
            )}
          </aside>
        </div>

        <div className="dialog-foot">
          <span className="dialog-status">Step {step} of 3</span>
          {step > 1 && (
            <button type="button" className="btn big" onClick={back}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn primary big" onClick={next}>
              Next
            </button>
          ) : (
            <button type="button" className="btn primary big" onClick={() => onCreate(text)}>
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
