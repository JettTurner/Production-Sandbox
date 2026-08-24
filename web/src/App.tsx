import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ColumnResizer from "./components/ColumnResizer";
import PreviewPane from "./components/panes/PreviewPane";
import RootDesignerPane from "./components/panes/RootDesignerPane";
import SourcePane from "./components/panes/SourcePane";
import TemplatesPane from "./components/panes/TemplatesPane";
import {
  BrandMarkIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  FolderArrowIcon,
  FolderIcon,
  PlusIcon,
  SaveIcon,
} from "./components/icons";
import { parseFh } from "./lib/parser";
import { serializeFh } from "./lib/serializer";
import { countNodes, resolveDoc, treeToText } from "./lib/resolver";
import { copyText, downloadBlob, downloadText, zipTree } from "./lib/export";
import { createOnDisk, supportsFsAccess } from "./lib/folders";
import { removeTemplateRefs, renameTemplateInTree } from "./lib/treeEdit";
import type { FhDocument, FsNode } from "./lib/types";

// First-paint + offline fallback; the real startup content is fetched from
// /samples/startup.fh in the effect below.
const DEFAULT_SOURCE = `@version 1.0
@name Untitled Structure

#---Root---
@root
01_EXT
\t@insert PROJECT

#---Templates---
@template PROJECT
\t00_ProgressImages
\t01_Deliverables
\t02_Links
\t03_ReferenceFiles
`;

const BLANK_SOURCE = `@version 1.0
@name Untitled Structure

#---Root---
@root
`;

const SAMPLES: { value: string; label: string }[] = [
  { value: "startup", label: "Startup / Default" },
  { value: "vizlab", label: "VizLab Production" },
  { value: "office-directory", label: "Office Directory" },
  { value: "project-structure", label: "PBK Project Structure" },
  { value: "example", label: "Example / Recursion demo" },
];

interface Toast {
  id: number;
  type: "success" | "error";
  msg: string;
}

let toastSeq = 0;

function emptyDoc(source: string): FhDocument {
  return (
    parseFh(source).doc ?? {
      version: "1.0",
      name: "Untitled Structure",
      root: [],
      templates: {},
      templateOrder: [],
    }
  );
}

export default function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sample, setSample] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"source" | "templates" | "root" | "preview">("root");
  const fileRef = useRef<HTMLInputElement>(null);
  const baselineRef = useRef(DEFAULT_SOURCE);

  type PaneId = "source" | "templates" | "root" | "preview";
  const MIN_PCT = 10;
  const MAX_PCT = 60;
  const RESIZER_W = 12;
  const mainRef = useRef<HTMLElement>(null);
  const [colPct, setColPct] = useState<Record<PaneId, number>>({
    source: 100 / 3,
    templates: 100 / 3,
    root: 100 / 3,
    preview: 0, // preview is flex-fill; not stored
  });

  // Columns are stored as percentages of the main row. Their default position
  // is an even horizontal split, restored whenever the window is resized.
  const evenSplit = useCallback(() => {
    const el = mainRef.current;
    const panes = (sourceOpen ? 1 : 0) + 3;
    const resizers = (sourceOpen ? 3 : 2) * RESIZER_W;
    const usablePct =
      el && el.clientWidth > resizers + 24
        ? ((el.clientWidth - resizers - 24) / el.clientWidth) * 100
        : 100;
    const share = usablePct / panes;
    setColPct({ source: share, templates: share, root: share, preview: 0 });
  }, [sourceOpen]);

  useEffect(() => {
    evenSplit();
    window.addEventListener("resize", evenSplit);
    return () => window.removeEventListener("resize", evenSplit);
  }, [evenSplit]);

  const handleColumnResize = useCallback(
    (left: PaneId, right: PaneId) => (dx: number) => {
      const width = mainRef.current?.clientWidth ?? window.innerWidth;
      const dPct = (dx / width) * 100;
      setColPct((prev) => {
        const clamp = (v: number) => Math.min(MAX_PCT, Math.max(MIN_PCT, v));
        const next: Record<PaneId, number> = { ...prev, [left]: clamp((prev[left] ?? 25) + dPct) };
        if (right !== "preview") {
          next[right] = clamp((prev[right] ?? 25) - dPct);
        }
        return next;
      });
    },
    [],
  );

  const MAX_HISTORY = 30;
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const sourceRef = useRef(DEFAULT_SOURCE);
  const lastApplyRef = useRef(0);

  const notify = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const parsed = useMemo(() => parseFh(source), [source]);
  const doc = useMemo(() => emptyDoc(source), [source]);
  const resolved = useMemo(() => resolveDoc(doc), [doc]);

  // Every source change goes through here so it can be undone. Rapid typing
  // (within 800ms) is coalesced into one undo step; discrete actions always push.
  const applySource = useCallback((next: string, discrete = false) => {
    if (next === sourceRef.current) return;
    const now = Date.now();
    if (!discrete && now - lastApplyRef.current < 800 && pastRef.current.length) {
      pastRef.current = [...pastRef.current.slice(0, -1), sourceRef.current];
    } else {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), sourceRef.current];
    }
    lastApplyRef.current = now;
    futureRef.current = [];
    sourceRef.current = next;
    setSource(next);
  }, []);

  // On boot, load the startup sample from /samples so the shipped file is the
  // single source of truth; keep the built-in default if the fetch fails.
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}samples/startup.fh`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        baselineRef.current = text;
        applySource(text, true);
        setFileName("startup.fh");
      })
      .catch(() => {
        /* fetch failed — stay on the built-in default */
      });
    return () => {
      cancelled = true;
    };
  }, [applySource]);

  const undo = useCallback(() => {
    const prev = pastRef.current[pastRef.current.length - 1];
    if (prev === undefined) return;
    futureRef.current = [...futureRef.current, sourceRef.current].slice(-MAX_HISTORY);
    pastRef.current = pastRef.current.slice(0, -1);
    sourceRef.current = prev;
    setSource(prev);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (next === undefined) return;
    pastRef.current = [...pastRef.current, sourceRef.current].slice(-MAX_HISTORY);
    futureRef.current = futureRef.current.slice(0, -1);
    sourceRef.current = next;
    setSource(next);
  }, []);

  const commitDoc = useCallback(
    (next: FhDocument) => {
      applySource(serializeFh(next), true);
    },
    [applySource],
  );

  const dirty = source !== baselineRef.current;

  const handleRootChange = useCallback(
    (nodes: FsNode[]) => {
      commitDoc({ ...doc, root: nodes });
    },
    [doc, commitDoc],
  );

  const handleTemplateChange = useCallback(
    (nodes: FsNode[]) => {
      if (!activeSection) return;
      commitDoc({ ...doc, templates: { ...doc.templates, [activeSection]: nodes } });
    },
    [doc, activeSection, commitDoc],
  );

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved changes — discard them and continue?");

  // ---------------- File I/O ----------------
  const handleOpenFile = useCallback(
    (file: File) => {
      if (!confirmDiscard()) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        baselineRef.current = text;
        applySource(text, true);
        setFileName(file.name);
        setActiveSection(null);
      };
      reader.readAsText(file);
    },
    [dirty],
  );

  const openFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOpenFile(file);
    e.target.value = "";
  };

  const loadSample = async (value: string) => {
    if (!value) return;
    if (!confirmDiscard()) {
      setSample("");
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}samples/${value}.fh`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      baselineRef.current = text;
      applySource(text, true);
      setFileName(`${value}.fh`);
      setActiveSection(null);
      notify(`Loaded sample "${value}.fh".`);
    } catch (err) {
      notify(`Could not load sample: ${(err as Error).message}`, "error");
    } finally {
      setSample("");
    }
  };

  const saveFh = useCallback(() => {
    downloadText(serializeFh(doc), fileName ?? `${doc.name}.fh`);
    baselineRef.current = source;
    notify("Saved .fh file.");
  }, [doc, fileName, source, notify]);

  // Edits the @name directive; keeps the header filename in sync.
  const setDocName = (value: string) => {
    const trimmed = value.trim();
    commitDoc({ ...doc, name: trimmed || "Untitled Structure" });
    if (trimmed) setFileName(`${trimmed}.fh`);
  };

  // Edits the header filename; also writes the @name line.
  const renameFile = (value: string) => {
    const base = value.trim().replace(/\.fh$/i, "").trim();
    setFileName(base ? `${base}.fh` : null);
    if (base) commitDoc({ ...doc, name: base });
  };

  const copyStructure = async () => {
    if (!resolved.tree.length) {
      notify("Nothing to copy yet.", "error");
      return;
    }
    const ok = await copyText(treeToText(resolved.tree).join("\n"));
    notify(ok ? "Resolved structure copied to clipboard." : "Copy failed — try again.", ok ? "success" : "error");
  };

  const downloadZip = async () => {
    if (!resolved.tree.length) {
      notify("Nothing to zip yet.", "error");
      return;
    }
    const blob = await zipTree(resolved.tree, fileName ?? "structure.fh");
    downloadBlob(blob, (fileName ?? "structure").replace(/\.fh$/i, "") + ".zip");
    notify("Structure zip downloaded.");
  };

  const createFolders = async () => {
    if (!supportsFsAccess()) {
      notify("Folder creation needs Chrome/Edge (File System Access API) on localhost or https.", "error");
      return;
    }
    try {
      const res = await createOnDisk(resolved.tree, () => window.showDirectoryPicker!());
      notify(`Created ${res.created} folders/files in "${res.target}".`, "success");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      notify(`Failed to create folders: ${(err as Error).message}`, "error");
    }
  };

  const newDoc = () => {
    if (!confirmDiscard()) return;
    baselineRef.current = BLANK_SOURCE;
    applySource(BLANK_SOURCE, true);
    setFileName(null);
    setActiveSection(null);
  };

  // ---------------- Template ops ----------------
  const addTemplate = (name: string) => {
    if (doc.templates[name]) {
      notify(`Template "${name}" already exists.`, "error");
      return;
    }
    const next: FhDocument = { ...doc, templates: { ...doc.templates, [name]: [] }, templateOrder: [...doc.templateOrder, name] };
    commitDoc(next);
    setActiveSection(name);
    notify(`Added template "${name}".`);
  };

  const renameTemplate = (oldName: string, newName: string) => {
    if (doc.templates[newName]) {
      notify(`Template "${newName}" already exists.`, "error");
      return;
    }
    const templates: Record<string, FsNode[]> = {};
    for (const [k, v] of Object.entries(doc.templates)) {
      templates[k === oldName ? newName : k] = renameTemplateInTree(v, oldName, newName);
    }
    const root = renameTemplateInTree(doc.root, oldName, newName);
    const next: FhDocument = {
      ...doc,
      root,
      templates,
      templateOrder: doc.templateOrder.map((t) => (t === oldName ? newName : t)),
    };
    commitDoc(next);
    if (activeSection === oldName) setActiveSection(newName);
    notify(`Renamed "${oldName}" to "${newName}".`);
  };

  const deleteTemplate = (name: string) => {
    const templates: Record<string, FsNode[]> = {};
    for (const [k, v] of Object.entries(doc.templates)) if (k !== name) templates[k] = removeTemplateRefs(v, name);
    const next: FhDocument = {
      ...doc,
      root: removeTemplateRefs(doc.root, name),
      templates,
      templateOrder: doc.templateOrder.filter((t) => t !== name),
    };
    commitDoc(next);
    if (activeSection === name) setActiveSection(null);
    notify(`Deleted template "${name}" and its @insert references.`);
  };

  // Always keep a template selected when one exists (initial load, file open,
  // or after deleting the active template) so the dropdown never sits empty.
  useEffect(() => {
    if ((!activeSection || !doc.templates[activeSection]) && doc.templateOrder.length > 0) {
      setActiveSection(doc.templateOrder[0]);
    }
  }, [activeSection, doc.templateOrder, doc.templates]);

  // ---------------- Global drag & drop + shortcuts ----------------
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleOpenFile(file);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target && (target.tagName === "INPUT" || target.tagName === "SELECT");
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        saveFh();
      } else if (mod && key === "o") {
        e.preventDefault();
        fileRef.current?.click();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        if (!inInput) {
          e.preventDefault();
          redo();
        }
      } else if (mod && key === "z") {
        if (!inInput) {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("keydown", onKey);
    };
  }, [handleOpenFile, saveFh, undo, redo]);

  // Warn before leaving the page with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const stats = countNodes(resolved.tree);
  const errors = parsed.issues.filter((i) => i.severity === "error");
  const warnings = parsed.issues.filter((i) => i.severity === "warning");

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">
            <BrandMarkIcon />
          </span>
          <small>.fh</small>
        </div>
        <div className="filename-wrap">
          <input
            className="filename-input"
            value={(fileName ?? `${doc.name}.fh`).replace(/\.fh$/i, "")}
            onChange={(e) => renameFile(e.target.value)}
            title="Rename the .fh file (also updates the @name line)"
            spellCheck={false}
            placeholder="name"
          />
          <span className="filename-ext">.fh</span>
        </div>
        <div className="spacer" />
        <div className="toolbar">
          <button
            className={`btn ${sourceOpen ? "active" : ""}`}
            onClick={() => setSourceOpen((v) => !v)}
            title="Toggle the raw .fh source editor"
          >
            <CodeIcon />
          </button>
          <select className="btn" style={{ padding: "6px 8px" }} value={sample} onChange={(e) => loadSample(e.target.value)}>
            <option value="">Load sample…</option>
            {SAMPLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={newDoc} title="New structure">
            <PlusIcon />
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} title="Open .fh file">
            <FolderIcon />
          </button>
          <button className="btn" onClick={saveFh} title="Save .fh file">
            <SaveIcon />
          </button>
          <span style={{ width: 1, height: 24, background: "var(--border)" }} />
          <button className="btn" onClick={copyStructure} title="Copy to clipboard">
            <CopyIcon />
          </button>
          <button className="btn" onClick={downloadZip} title="Download as zip">
            <DownloadIcon />
          </button>
          <button className="btn success" onClick={createFolders} title="Create the folders on your disk (Chrome/Edge)">
            <FolderArrowIcon />
          </button>
          <input ref={fileRef} type="file" accept=".fh,.pbkstruct,.txt,text/plain" hidden onChange={openFromInput} />
        </div>
      </header>

      <div className="mobile-tabs">
        <button
          className={`tab ${mobileTab === "source" ? "active" : ""}`}
          onClick={() => { setMobileTab("source"); if (!sourceOpen) setSourceOpen(true); }}
        >Source</button>
        <button className={`tab ${mobileTab === "templates" ? "active" : ""}`} onClick={() => setMobileTab("templates")}>Templates</button>
        <button className={`tab ${mobileTab === "root" ? "active" : ""}`} onClick={() => setMobileTab("root")}>Root</button>
        <button className={`tab ${mobileTab === "preview" ? "active" : ""}`} onClick={() => setMobileTab("preview")}>Preview</button>
      </div>

      <main className="main" ref={mainRef}>
        {sourceOpen && (
          <div className={mobileTab !== "source" ? "mobile-hidden" : ""}>
            <SourcePane
              style={{ flex: `0 0 ${colPct.source}%` }}
              source={source}
              onChange={applySource}
              issues={parsed.issues}
              hasErrors={errors.length > 0}
            />
            <ColumnResizer onResize={handleColumnResize("source", "templates")} />
          </div>
        )}
        <TemplatesPane
          className={mobileTab !== "templates" ? "mobile-hidden" : ""}
          style={{ flex: `0 0 ${colPct.templates}%` }}
          templates={doc.templateOrder}
          active={activeSection}
          tree={activeSection ? doc.templates[activeSection] ?? [] : []}
          onSelect={setActiveSection}
          onAdd={addTemplate}
          onRename={renameTemplate}
          onDelete={deleteTemplate}
          onNodesChange={handleTemplateChange}
        />
        <ColumnResizer onResize={handleColumnResize("templates", "root")} />
        <RootDesignerPane
          className={mobileTab !== "root" ? "mobile-hidden" : ""}
          style={{ flex: `0 0 ${colPct.root}%` }}
          name={doc.name}
          onNameChange={setDocName}
          tree={doc.root}
          templates={doc.templateOrder}
          onNodesChange={handleRootChange}
        />
        <ColumnResizer onResize={handleColumnResize("root", "preview")} />
        <PreviewPane
          className={mobileTab !== "preview" ? "mobile-hidden" : ""}
          style={{ flex: "1 1 0" }}
          stats={stats}
          tree={resolved.tree}
          errors={resolved.errors}
        />
      </main>

      <footer className="statusbar">
        <span className={`dot ${errors.length ? "err" : warnings.length ? "warn" : "ok"}`} />
        <span>
          {errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
        <span>File System Access: {supportsFsAccess() ? "available" : "not available"}</span>
        <span style={{ marginLeft: "auto" }}>Drop a .fh file anywhere to open</span>
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="dot" />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}