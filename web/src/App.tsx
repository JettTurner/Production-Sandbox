import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodePane from "./components/CodePane";
import Designer, { type SectionRef } from "./components/Designer";
import Preview from "./components/Preview";
import SectionPicker from "./components/SectionPicker";
import {
  CopyIcon,
  DownloadIcon,
  EraserIcon,
  FolderArrowIcon,
  UploadIcon,
} from "./components/icons";
import { parseFh } from "./lib/parser";
import { serializeFh } from "./lib/serializer";
import { countNodes, resolveDoc, treeToText } from "./lib/resolver";
import { copyText, downloadBlob, downloadText, zipTree } from "./lib/export";
import { createOnDisk, supportsFsAccess } from "./lib/folders";
import { removeTemplateRefs, renameTemplateInTree } from "./lib/treeEdit";
import type { FhDocument, FsNode } from "./lib/types";

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

const SAMPLES: { value: string; label: string }[] = [
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
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const parsed = useMemo(() => parseFh(source), [source]);
  const doc = useMemo(() => emptyDoc(source), [source]);
  const resolved = useMemo(() => resolveDoc(doc), [doc]);

  const section: SectionRef =
    activeSection && doc.templates[activeSection]
      ? { kind: "template", name: activeSection }
      : { kind: "root" };

  const sectionNodes: FsNode[] = section.kind === "root" ? doc.root : doc.templates[section.name!] ?? [];

  const commitDoc = useCallback(
    (next: FhDocument) => {
      setSource(serializeFh(next));
    },
    [setSource],
  );

  const handleSectionNodesChange = useCallback(
    (nodes: FsNode[]) => {
      const next: FhDocument = { ...doc, templates: { ...doc.templates } };
      if (section.kind === "root") next.root = nodes;
      else if (section.name) next.templates[section.name] = nodes;
      commitDoc(next);
    },
    [doc, section, commitDoc],
  );

  // ---------------- File I/O ----------------
  const handleOpenFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        setSource(String(reader.result ?? ""));
        setFileName(file.name);
        setActiveSection(null);
      };
      reader.readAsText(file);
    },
    [],
  );

  const openFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOpenFile(file);
    e.target.value = "";
  };

  const loadSample = async (value: string) => {
    if (!value) return;
    try {
      const res = await fetch(`/samples/${value}.fh`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setSource(text);
      setFileName(`${value}.fh`);
      setActiveSection(null);
      notify(`Loaded sample "${value}.fh".`);
    } catch (err) {
      notify(`Could not load sample: ${(err as Error).message}`, "error");
    } finally {
      setSample("");
    }
  };

  const saveFh = () => {
    downloadText(serializeFh(doc), fileName ?? `${doc.name}.fh`);
    notify("Saved .fh file.");
  };

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
    setSource(DEFAULT_SOURCE);
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

  // ---------------- Global drag & drop + shortcuts ----------------
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleOpenFile(file);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFh();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileRef.current?.click();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleOpenFile, doc]);

  const stats = countNodes(resolved.tree);
  const errors = parsed.issues.filter((i) => i.severity === "error");
  const warnings = parsed.issues.filter((i) => i.severity === "warning");

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">
            <FolderArrowIcon />
          </span>
          Folder Heirarchy Studio
          <small>.fh</small>
        </div>
        <input
          className="filename-input"
          value={fileName ?? `${doc.name}.fh`}
          onChange={(e) => renameFile(e.target.value)}
          title="Rename the .fh file (also updates the @name line)"
          spellCheck={false}
          placeholder="name.fh"
        />
        <div className="spacer" />
        <div className="toolbar">
          <select className="btn" style={{ padding: "6px 8px" }} value={sample} onChange={(e) => loadSample(e.target.value)}>
            <option value="">Load sample…</option>
            {SAMPLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={newDoc} title="New structure">
            <EraserIcon /> New
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <UploadIcon /> Open
          </button>
          <button className="btn" onClick={saveFh}>
            <DownloadIcon /> Save .fh
          </button>
          <span style={{ width: 1, height: 24, background: "var(--border)" }} />
          <button className="btn" onClick={copyStructure}>
            <CopyIcon /> Copy
          </button>
          <button className="btn" onClick={downloadZip}>
            <DownloadIcon /> Zip
          </button>
          <button className="btn success" onClick={createFolders} title="Create the folders on your disk (Chrome/Edge)">
            <FolderArrowIcon /> Create on Disk
          </button>
          <input ref={fileRef} type="file" accept=".fh,.pbkstruct,.txt,text/plain" hidden onChange={openFromInput} />
        </div>
      </header>

      <main className="main">
        {/* ---------- Code ---------- */}
        <section className="pane">
          <div className="pane-head">
            <span className="title">Source (.fh)</span>
            <div className="right">
              <span className="preview-stats">
                <span>{source.split("\n").length} lines</span>
              </span>
            </div>
          </div>
          <div className="pane-body">
            <CodePane source={source} onChange={setSource} />
          </div>
          {parsed.issues.length > 0 && (
            <div className={`issue-banner ${errors.length ? "error" : "warning"}`}>
              <ul>
                {parsed.issues.slice(0, 8).map((issue, i) => (
                  <li key={i}>
                    {issue.line ? `Line ${issue.line}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ---------- Designer ---------- */}
        <section className="pane">
          <div className="pane-head">
            <span className="title">Designer</span>
            <div className="right">
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>double-click to rename · drag to move · ＋ to add</span>
            </div>
          </div>
          <div className="sub-head">
            <span className="title">Design</span>
            <input
              className="name-input"
              value={doc.name}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Structure name"
              title="Name of this folder structure (writes the @name line)"
              spellCheck={false}
            />
          </div>
          <SectionPicker
            templates={doc.templateOrder}
            active={activeSection}
            onSelect={setActiveSection}
            onAdd={addTemplate}
            onRename={renameTemplate}
            onDelete={deleteTemplate}
          />
          <div className="pane-body">
            <Designer
              nodes={sectionNodes}
              section={section}
              templates={doc.templateOrder}
              onNodesChange={handleSectionNodesChange}
            />
          </div>
        </section>

        {/* ---------- Preview ---------- */}
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
          <Preview tree={resolved.tree} errors={resolved.errors} />
        </section>
      </main>

      <footer className="statusbar">
        <span className={`dot ${errors.length ? "err" : warnings.length ? "warn" : "ok"}`} />
        <span>
          {errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
        <span>File System Access: {supportsFsAccess() ? "available" : "not available"}</span>
        <span style={{ marginLeft: "auto" }}>Drop a .fh / .pbkstruct file anywhere to open</span>
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