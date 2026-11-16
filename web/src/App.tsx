import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ColumnResizer from "./components/ColumnResizer";
import CreateDialog from "./components/CreateDialog";
import EditorPane from "./components/EditorPane";
import type { EditorView } from "./components/EditorPane";
import NewDialog from "./components/NewDialog";
import OutputPane from "./components/OutputPane";
import Sidebar from "./components/Sidebar";
import type { SectionRef } from "./components/Designer";
import {
  BrandMarkIcon,
  CheckIcon,
  DotsIcon,
  OutputIcon,
  RedoIcon,
  TemplatesIcon,
  TreeIcon,
  UndoIcon,
  WarningIcon,
} from "./components/icons";
import { normalizeSource, useFhDocument } from "./hooks/useFhDocument";
import { countNodes, resolveDoc, resolveTree, treeToText } from "./lib/resolver";
import { uniqueTemplateName } from "./lib/kit";
import type { StarterBlock } from "./lib/kit";
import {
  copyText,
  downloadBlob,
  downloadText,
  pickAndOpenFile,
  pickAndSaveFile,
  supportsFilePickers,
  writeToHandle,
  zipTree,
} from "./lib/export";
import { supportsFsAccess } from "./lib/folders";
import { cleanTemplateName, countTemplateUses, removeTemplateRefs, renameTemplateInTree } from "./lib/treeEdit";
import { planTree } from "./lib/validate";
import { newId } from "./lib/types";
import type { FsNode } from "./lib/types";

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

const VIEW_KEY = "fh-view";
function storedView(): EditorView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "columns" || v === "list" || v === "blocks") return v;
  } catch {
    /* storage unavailable: use the default */
  }
  return "blocks";
}

const SAMPLES: { value: string; label: string }[] = [
  { value: "startup", label: "Startup / Default" },
  { value: "vizlab", label: "VizLab Production" },
  { value: "office-directory", label: "Office Directory" },
  { value: "project-structure", label: "PBK Project Structure" },
  { value: "example", label: "Example / Recursion demo" },
];

const TEMPLATE_PALETTE = ["#bc8cff", "#f97583", "#79c0ff", "#56d4dd", "#d2a8ff", "#ffa657", "#7ee787", "#ff7b72"];

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 420;
const OUTPUT_MIN = 300;
const OUTPUT_MAX = 640;

interface Toast {
  id: number;
  type: "success" | "error";
  msg: string;
}

type MobileTab = "structure" | "templates" | "output";

let toastSeq = 0;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function App() {
  const fh = useFhDocument(DEFAULT_SOURCE);
  const { doc, source, dirty, commitDoc, applySource, load, undo, redo } = fh;

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [section, setSection] = useState<SectionRef>({ kind: "root" });
  const [view, setViewState] = useState<EditorView>(storedView);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  // Bumped whenever a different document is loaded, so views reset their place in it.
  const [docKey, setDocKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>("structure");
  const [sidebarW, setSidebarW] = useState(252);
  const [outputW, setOutputW] = useState(400);
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const setView = useCallback((v: EditorView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered, still works */
    }
  }, []);
  const notice = useCallback((msg: string) => notify(msg, "error"), [notify]);

  // ---------------- Derived output ----------------
  const resolved = useMemo(() => resolveDoc(doc), [doc]);
  const plan = useMemo(() => planTree(resolved.tree), [resolved.tree]);
  const stats = useMemo(() => countNodes(plan.tree), [plan.tree]);
  const uses = useMemo(() => countTemplateUses([doc.root, ...Object.values(doc.templates)]), [doc]);
  // What each block creates on its own (shown on bricks in the Blocks view).
  const blockSizes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const name of doc.templateOrder) {
      out[name] = countNodes(planTree(resolveTree(doc.templates[name] ?? [], doc.templates).tree).tree).total;
    }
    return out;
  }, [doc.templateOrder, doc.templates]);
  // Display colors: templates without a color in the file get one from the
  // palette by position, so they can be told apart. Nothing is written back
  // until the user actually picks a color.
  const colors = useMemo(() => {
    const out: Record<string, string> = {};
    doc.templateOrder.forEach((name, i) => (out[name] = TEMPLATE_PALETTE[i % TEMPLATE_PALETTE.length]));
    return { ...out, ...doc.templateColors };
  }, [doc.templateOrder, doc.templateColors]);

  const parseErrors = fh.issues.filter((i) => i.severity === "error").length;
  const parseWarnings = fh.issues.length - parseErrors;
  const errorCount = parseErrors + resolved.errors.length + plan.errors;
  const warningCount = parseWarnings + plan.warnings + (plan.duplicates ? 1 : 0);

  // If the selected template disappears (delete, undo, new file), fall back to Root.
  useEffect(() => {
    if (section.kind === "template" && !doc.templates[section.name!]) setSection({ kind: "root" });
  }, [section, doc.templates]);

  const selectSection = useCallback((next: SectionRef) => {
    setSection(next);
    setSourceOpen(false);
    setMobileTab("structure");
  }, []);

  // ---------------- File I/O ----------------
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const confirmDiscard = useCallback(
    () => !dirtyRef.current || window.confirm("You have unsaved changes. Discard them and continue?"),
    [],
  );

  const openText = useCallback(
    (text: string, name: string | null, handle: FileSystemFileHandle | null, unsaved = false) => {
      load(text, unsaved);
      setFileName(name);
      setFileHandle(handle);
      setSection({ kind: "root" });
      setNameDraft(null);
      setDocKey((k) => k + 1);
    },
    [load],
  );

  const openFile = useCallback(async () => {
    if (!supportsFilePickers()) {
      fileRef.current?.click();
      return;
    }
    if (!confirmDiscard()) return;
    try {
      const opened = await pickAndOpenFile();
      if (opened) openText(opened.text, opened.name, opened.handle);
    } catch (err) {
      notify(`Could not open the file: ${(err as Error).message}`, "error");
    }
  }, [confirmDiscard, notify, openText]);

  const openFromInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !confirmDiscard()) return;
    openText(await file.text(), file.name, null);
  };

  const loadSample = async (value: string) => {
    setMoreOpen(false);
    if (!confirmDiscard()) return;
    setNewOpen(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}samples/${value}.fh`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Samples are starting points, not files to overwrite: no handle is kept.
      openText(await res.text(), `${value}.fh`, null);
      notify(`Loaded sample "${value}.fh".`);
    } catch (err) {
      notify(`Could not load sample: ${(err as Error).message}`, "error");
    }
  };

  const suggestedName = fileName ?? `${doc.name}.fh`;

  const saveAs = useCallback(async () => {
    setMoreOpen(false);
    const name = suggestedName.replace(/\.(pbkstruct|txt)$/i, ".fh");
    try {
      if (supportsFilePickers()) {
        const handle = await pickAndSaveFile(source, name);
        if (!handle) return;
        setFileHandle(handle);
        setFileName(handle.name);
        notify(`Saved ${handle.name}.`);
      } else {
        downloadText(source, name);
        notify(`Downloaded ${name}.`);
      }
      fh.markSaved();
    } catch (err) {
      notify(`Save failed: ${(err as Error).message}`, "error");
    }
  }, [fh, notify, source, suggestedName]);

  // Ctrl+S writes straight back to the opened file; it only prompts the first time.
  const save = useCallback(async () => {
    if (!fileHandle) return saveAs();
    try {
      await writeToHandle(fileHandle, source);
      fh.markSaved();
      notify(`Saved ${fileHandle.name}.`);
    } catch (err) {
      notify(`Save failed: ${(err as Error).message}`, "error");
    }
  }, [fh, fileHandle, notify, saveAs, source]);

  // New opens the "start from a kit" dialog; it hands back finished .fh text.
  const newDoc = () => setNewOpen(true);
  const createFromKit = (text: string) => {
    if (!confirmDiscard()) return;
    setNewOpen(false);
    // Generated content exists nowhere else yet, so it starts out as unsaved.
    openText(text, null, null, true);
  };

  // On boot, load the startup sample so the shipped file is the single source
  // of truth; keep the built-in default if the fetch fails.
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}samples/startup.fh`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled && !dirtyRef.current) openText(text, "startup.fh", null);
      })
      .catch(() => {
        /* stay on the built-in default */
      });
    return () => {
      cancelled = true;
    };
  }, [openText]);

  // ---------------- Output actions ----------------
  const blocked = resolved.errors.length > 0 || plan.errors > 0;

  const copyStructure = async () => {
    const ok = await copyText(treeToText(plan.tree).join("\n"));
    notify(ok ? "Structure copied to the clipboard." : "Copy failed. Try again.", ok ? "success" : "error");
  };

  const downloadZip = async () => {
    if (blocked) return;
    const blob = await zipTree(plan.tree);
    downloadBlob(blob, suggestedName.replace(/\.[^.]+$/, "") + ".zip");
    notify("Zip downloaded.");
  };

  // ---------------- Document edits ----------------
  const commitName = () => {
    if (nameDraft === null) return;
    const name = nameDraft.trim() || "Untitled Structure";
    setNameDraft(null);
    if (name !== doc.name) commitDoc((d) => ({ ...d, name }));
  };

  const handleRootChange = useCallback((nodes: FsNode[]) => commitDoc((d) => ({ ...d, root: nodes })), [commitDoc]);

  const handleTemplateNodesChange = useCallback(
    (template: string, nodes: FsNode[]) => commitDoc((d) => ({ ...d, templates: { ...d.templates, [template]: nodes } })),
    [commitDoc],
  );

  const createTemplate = (raw: string, starter: FsNode[]): string | null => {
    const name = cleanTemplateName(raw);
    if (!name) return null;
    if (doc.templates[name]) {
      notify(`A block called "${name}" already exists.`, "error");
      return null;
    }
    commitDoc((d) => ({
      ...d,
      templates: { ...d.templates, [name]: starter },
      templateOrder: [...d.templateOrder, name],
      templateColors: { ...d.templateColors, [name]: TEMPLATE_PALETTE[d.templateOrder.length % TEMPLATE_PALETTE.length] },
      templateComments: d.templateOrder.length
        ? d.templateComments
        : { ...d.templateComments, [name]: ["#---Blocks---"] },
    }));
    return name;
  };

  const addTemplate = (raw: string) => {
    const name = createTemplate(raw, []);
    if (name) {
      selectSection({ kind: "template", name });
      notify(`Added the block "${name}".`);
    }
  };

  const addStarter = (starter: StarterBlock) => {
    const name = createTemplate(uniqueTemplateName(starter.name, doc.templates), starter.build());
    if (name) notify(`Added the ${starter.title} block as "${name}". Drag it onto a folder to use it.`);
  };

  // "New template…" from a row's Add menu: the menu inserts it right after.
  const createTemplateFromInsert = (raw: string) => {
    createTemplate(raw, [{ id: newId(), kind: "folder", name: "New Folder", forceFolder: true, children: [] }]);
  };

  const renameTemplate = (oldName: string, raw: string) => {
    const newName = cleanTemplateName(raw);
    if (!newName || newName === oldName) return;
    if (doc.templates[newName]) {
      notify(`A block called "${newName}" already exists.`, "error");
      return;
    }
    const swap = <T,>(rec: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(rec).map(([k, v]) => [k === oldName ? newName : k, v]));
    commitDoc((d) => ({
      ...d,
      root: renameTemplateInTree(d.root, oldName, newName),
      templates: Object.fromEntries(
        Object.entries(d.templates).map(([k, v]) => [k === oldName ? newName : k, renameTemplateInTree(v, oldName, newName)]),
      ),
      templateOrder: d.templateOrder.map((t) => (t === oldName ? newName : t)),
      templateColors: swap(d.templateColors),
      templateComments: swap(d.templateComments),
    }));
    if (section.kind === "template" && section.name === oldName) setSection({ kind: "template", name: newName });
    notify(`Renamed "${oldName}" to "${newName}".`);
  };

  const deleteTemplate = (name: string) => {
    const drop = <T,>(rec: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(rec).filter(([k]) => k !== name));
    commitDoc((d) => ({
      ...d,
      root: removeTemplateRefs(d.root, name),
      templates: Object.fromEntries(
        Object.entries(d.templates)
          .filter(([k]) => k !== name)
          .map(([k, v]) => [k, removeTemplateRefs(v, name)]),
      ),
      templateOrder: d.templateOrder.filter((t) => t !== name),
      templateColors: drop(d.templateColors),
      templateComments: drop(d.templateComments),
    }));
    notify(`Deleted the block "${name}" everywhere it was used. Undo brings it back.`);
  };

  const setColor = (name: string, color: string) =>
    commitDoc((d) => ({ ...d, templateColors: { ...d.templateColors, [name]: color } }));

  // ---------------- Global drag & drop + shortcuts ----------------
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const item = e.dataTransfer?.items?.[0];
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      // Grab the handle synchronously (it is only readable during the event).
      const handlePromise = item?.getAsFileSystemHandle?.();
      if (!confirmDiscard()) return;
      let handle: FileSystemFileHandle | null = null;
      try {
        const h = await handlePromise;
        if (h && h.kind === "file") handle = h;
      } catch {
        /* no handle: the file still opens, Save will ask where to write */
      }
      openText(await file.text(), file.name, handle);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA");
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!mod) return;
      if (key === "s") {
        e.preventDefault();
        if (e.shiftKey) saveAs();
        else save();
      } else if (key === "o") {
        e.preventDefault();
        openFile();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        if (!inField) {
          e.preventDefault();
          redo();
        }
      } else if (key === "z") {
        if (!inField) {
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
  }, [confirmDiscard, openFile, openText, redo, save, saveAs, undo]);

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

  // Close the More menu when clicking outside it or pressing Escape.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    { id: "structure", label: "Structure", icon: <TreeIcon size={18} /> },
    { id: "templates", label: "Blocks", icon: <TemplatesIcon size={18} /> },
    { id: "output", label: "Output", icon: <OutputIcon size={18} /> },
  ];

  return (
    <div className="app" data-tab={mobileTab}>
      <header className="header">
        <div className="brand" title="Folder Hierarchy Studio">
          <span className="logo"><BrandMarkIcon /></span>
          <span className="brand-name">Folder Hierarchy Studio</span>
        </div>
        <span className="header-sep" />
        <div className="doc-id">
          <input
            className="text-input doc-name"
            aria-label="Structure name"
            title="Name of this structure (the @name line)"
            value={nameDraft ?? doc.name}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setNameDraft(null);
            }}
            spellCheck={false}
          />
          <span className="file-name" title={fileHandle ? "Saving writes back to this file" : "Not saved to a file yet"}>
            {fileName ?? "not saved yet"}
          </span>
          {dirty && (
            <span className="pill">
              <span className="pill-dot" />
              <span className="pill-text">Unsaved changes</span>
            </span>
          )}
        </div>
        <div className="spacer" />
        <div className="toolbar">
          <button type="button" className="btn icon" onClick={undo} disabled={!fh.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <UndoIcon />
          </button>
          <button type="button" className="btn icon" onClick={redo} disabled={!fh.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <RedoIcon />
          </button>
          <span className="header-sep wide-only" />
          <button type="button" className="btn wide-only" onClick={newDoc} title="New structure">
            New
          </button>
          <button type="button" className="btn wide-only" onClick={openFile} title="Open a .fh file (Ctrl+O)">
            Open
          </button>
          <button type="button" className="btn" onClick={save} title={fileHandle ? `Save to ${fileHandle.name} (Ctrl+S)` : "Save (Ctrl+S)"}>
            Save
          </button>
          <div className="more-menu" ref={moreRef}>
            <button
              type="button"
              className="btn icon"
              onClick={() => setMoreOpen((v) => !v)}
              title="More"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <DotsIcon />
            </button>
            {moreOpen && (
              <div className="more-dropdown" role="menu">
                <button type="button" role="menuitem" className="more-item narrow-only" onClick={() => { setMoreOpen(false); newDoc(); }}>
                  New
                </button>
                <button type="button" role="menuitem" className="more-item narrow-only" onClick={() => { setMoreOpen(false); openFile(); }}>
                  Open…
                </button>
                <button type="button" role="menuitem" className="more-item" onClick={saveAs}>
                  Save as…<kbd>Ctrl+Shift+S</kbd>
                </button>
                <div className="more-sep" />
                <div className="more-label">Samples</div>
                {SAMPLES.map((s) => (
                  <button type="button" role="menuitem" className="more-item" key={s.value} onClick={() => loadSample(s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".fh,.pbkstruct,.txt,text/plain" hidden onChange={openFromInput} />
        </div>
      </header>

      <main className="workspace">
        <Sidebar
          className="pane-templates"
          style={{ flexBasis: sidebarW }}
          doc={doc}
          colors={colors}
          section={section}
          uses={uses}
          onSelect={selectSection}
          onAddTemplate={addTemplate}
          onAddStarter={addStarter}
        />
        <ColumnResizer onResize={(dx) => setSidebarW((w) => clamp(w + dx, SIDEBAR_MIN, SIDEBAR_MAX))} />
        <EditorPane
          className="pane-structure"
          doc={doc}
          colors={colors}
          section={section}
          view={view}
          onViewChange={setView}
          sourceOpen={sourceOpen}
          onSourceOpenChange={setSourceOpen}
          blockSizes={blockSizes}
          docKey={docKey}
          onSelectSection={selectSection}
          source={source}
          onSourceChange={(text) => applySource(normalizeSource(text))}
          issues={fh.issues}
          uses={uses}
          onRootChange={handleRootChange}
          onTemplateNodesChange={handleTemplateNodesChange}
          onCreateTemplate={createTemplateFromInsert}
          onRenameTemplate={renameTemplate}
          onDeleteTemplate={deleteTemplate}
          onSetColor={setColor}
          onNotice={notice}
        />
        <ColumnResizer onResize={(dx) => setOutputW((w) => clamp(w - dx, OUTPUT_MIN, OUTPUT_MAX))} />
        <OutputPane
          className="pane-output"
          style={{ flexBasis: outputW }}
          plan={plan}
          stats={stats}
          resolveErrors={resolved.errors}
          templateColors={colors}
          canCreateOnDisk={supportsFsAccess()}
          onCreate={() => setCreateOpen(true)}
          onZip={downloadZip}
          onCopy={copyStructure}
        />
      </main>

      <footer className="statusbar">
        <span className={`status ${errorCount ? "error" : warningCount ? "warning" : "ok"}`}>
          {errorCount || warningCount ? <WarningIcon size={12} /> : <CheckIcon size={12} />}
          {errorCount || warningCount
            ? `${errorCount} ${errorCount === 1 ? "error" : "errors"} · ${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`
            : "No problems found"}
        </span>
        <span className="status-tip">Double-click to rename · Arrow keys to move around · Del to delete · Drag a block onto a folder</span>
      </footer>

      <nav className="mobile-tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            className={mobileTab === t.id ? "active" : ""}
            aria-current={mobileTab === t.id ? "page" : undefined}
            onClick={() => setMobileTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {newOpen && (
        <NewDialog samples={SAMPLES} onCreate={createFromKit} onLoadSample={loadSample} onClose={() => setNewOpen(false)} />
      )}

      {createOpen && (
        <CreateDialog
          doc={doc}
          initialTemplate={null}
          onClose={() => setCreateOpen(false)}
        />
      )}

      <div className="toasts" role="status" aria-live="polite">
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
