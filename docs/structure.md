# Project Structure — Folder Hierarchy Studio

> **AI agents: read this document first** before exploring or changing code.
> It lists every file in the repository and defines what it does.
> Maintained by hand; update it whenever files are added, removed, or repurposed.

---

## What this project is

**Folder Hierarchy Studio** is a browser-based visual designer + generator for
`.fh` ("folder hierarchy") files — a renamed evolution of the legacy `.pbkstruct`
format parsed by the original Python/tkinter tool (`pbkstruct_gui.py`, kept for
reference).

A `.fh` file describes a folder/file skeleton:

```
@version 1.0
@name My Structure

#---Root---
@root #79c0ff
src
	main.tsx
	components
		Button.tsx

#---Templates---
@template react-component #ffa657
@index.tsx
	styles.css
```

- Indentation = nesting (tabs or 4 spaces).
- A name containing a dot (`.`) is a **file**; anything else is a **folder**.
- `NAME "Label"` attaches a GUI-only display label (never written to disk).
- `@template X` sections define reusable structures; `@insert X` lines deposit a
  template's contents **in place** (no wrapper folder) at resolve time.
- A trailing `#hex` on `@root` or `@template NAME` (e.g. `@template X #ffa657`)
  assigns a GUI-only display color. The legacy separate-line `@template-color`
  directive was removed and now produces a warning.
- The app resolves `@insert`s into a final tree, previews it, and can export it
  as a `.zip` or create it on disk (File System Access API).

The single source of truth is the `.fh` source string; every designer edit
re-serializes the document and re-parses it.

---

## Repository layout

```
/
├── AGENTS.md                  ← instructions for AI agents (read structure doc first)
├── README.md                  ← user-facing readme
├── build.bat                  ← one-shot Electron build: verify → vite build →
│                                electron-builder --dir → Inno Setup installer (.iss)
├── docs/
│   └── structure.md           ← this document
├── pbkstruct_gui.py           ← LEGACY Python/tkinter tool (.pbkstruct era); reference only
└── web/                       ← THE APP (React + TypeScript + Vite)
    ├── index.html             ← Vite entry HTML
    ├── package.json           ← scripts & deps (see Commands below); also holds the
    │                             electron-builder config ("build" field) and the Electron
    │                             entry point ("main": electron/main.cjs)
    ├── vite.config.ts         ← Vite config (react plugin, port 5173, auto-open,
    │                             base "./" so the built app works under Electron's app:// scheme)
    ├── tsconfig.json          ← TS solution file (references app/node configs)
    ├── tsconfig.app.json      ← TS config for src/
    ├── tsconfig.node.json     ← TS config for vite.config.ts / scripts
    ├── preview.log            ← scratch logs (not part of the app)
    ├── electron/
    │   └── main.cjs           ← Electron main process: serves web/dist via a custom
    │                             app:// protocol (fetch() doesn't work on file://); frameless
    │                             window whose title bar IS the app header (titleBarStyle
    │                             hidden + theme-colored titleBarOverlay); VITE_DEV_SERVER_URL
    │                             env switches to the dev server
    ├── installer/
    │   └── folder-hierarchy-studio.iss  ← Inno Setup script consumed by build.bat;
    │                             machine-wide install ({autopf}\ProductionSandbox\
    │                             Folder Hierarchy Designer, requires elevation),
    │                             version injected via /DMyAppVersion, packaging input via /DAppSourceDir,
    │                             SetupIconFile from build/icon.ico
    ├── build/
    │   └── icon.ico           ← GENERATED (scripts/make-icon.mjs): multi-size ICO;
    │                             auto-embedded into the exe by electron-builder
    ├── public/
    │   ├── Production-Sandbox_Icon.svg ← source of truth for all app icons
    │   ├── Production-Sandbox_Icon.ai/.png ← raw design assets (also copied into dist)
    │   ├── icon.png           ← GENERATED 256px PNG; BrowserWindow/taskbar icon via dist/
    │   └── samples/           ← bundled example .fh files (Load-sample dropdown)
    │       ├── startup.fh     ← loaded automatically on app boot
    │       ├── vizlab.fh
    │       ├── example.fh
    │       ├── project-structure.fh
    │       └── office-directory.fh
    ├── scripts/
    │   ├── verify.ts          ← headless parser/resolver/treeEdit regression suite
    │   └── make-icon.mjs      ← Production-Sandbox_Icon.svg → build/icon.ico + public/icon.png (npm run icons)
    └── src/
        ├── main.tsx           ← React bootstrap (mounts <App/> into #root)
        ├── App.tsx            ← application shell: state hub, layout, toolbar
        ├── index.css          ← ALL styling (single stylesheet, dark theme)
        ├── vite-env.d.ts      ← Vite client types
        ├── components/        ← UI building blocks (see below)
        ├── lib/               ← pure logic: parse/serialize/resolve/edit/export
        └── components/panes/  ← top-level column panes composed by App
```

---

## Source files — definitions

### `web/src/App.tsx` — application shell & state hub

Owns all shared state and wires the four column panes together.

- **State**: raw `.fh` source string, parsed doc, filename, undo/redo history
  (`pastRef`/`futureRef`, cap 30), dirty tracking (`baselineRef`),
  leftmost-column visibility + active tab (`LeftTab`), per-column pixel widths,
  active template selection, toast notifications.
- **`applySource(next, discrete?)`**: the ONLY mutation path for source text.
  Re-parses, updates history (typing coalesced within 800 ms unless
  `discrete=true`; designer/file actions always discrete).
- **Keyboard**: Ctrl+S save, Ctrl+O open, Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y
  redo (skipped when focus is in INPUT/SELECT), beforeunload guard +
  `confirmDiscard()` gates on new/open/sample.
- **Layout**: header (filename input with fixed `.fh` chip, samples,
  save/zip/copy/disk buttons) → a vertical `LeftRail` of tabs pinned to the
  screen's left edge (desktop) that swaps in content in the leftmost column →
  `<main>` with resizable columns:
  leftmost column (driven by the rail: Root | Templates | Source) | Preview
  pane. Root, Templates, and Source are all tabs in the rail (no modal, no
  separate Root column) so the editor is always two columns. On mobile the
  `.mobile-tabs` bar picks the same panels in the same order (Root | Templates |
  Source | Preview); desktop rail and mobile bar both honor the 1/2/3 number-key
  shortcuts. `ColumnResizer` sits between the two columns; Preview flex-fills to
  the screen edge. The left column and Preview split the usable space 50/50.
  The status bar's right side shows a rotating tip (`TIPS`) that cycles on a
  timer.
- Auto-selects the first template whenever the active template is missing.

### `web/src/lib/types.ts` — core data model

- `FsNode` — `{ id, kind: "folder" | "insert", name, label?, children }`.
  Files are folders whose name contains a dot. `id` is regenerated on every
  parse (never persist it).
- `FhDocument` — `{ version, name, root: FsNode[], templates, templateOrder, templateColors }`.
  `templateColors` maps template names to hex display colors (GUI only).
- `ParseIssue` / `ParseResult` — diagnostics with line numbers.
- `isFileLike(name)` — dot test used everywhere for folder-vs-file.
- `newId()` — random id generator.

### `web/src/lib/parser.ts` — `.fh` text → `FhDocument`

- Accepts tabs or 4-space indentation (mixed allowed); skips blank lines and
  `#` comments; understands `@version`, `@name`, `@root [#hex]`, `@template X
  [#hex]`, `@insert X`, trailing `"Label"` annotations.
- Produces `ParseResult { doc, issues }` with line-numbered errors/warnings;
  `doc` is null only when the file has no usable content.

### `web/src/lib/serializer.ts` — `FhDocument` → `.fh` text

- `serializeFh(doc)` writes `@version`, `@name`, `#---Root---`/`@root [#hex]`,
  then each `@template X [#hex]` in `templateOrder` order; tabs for indent;
  labels quoted; trailing blank lines trimmed.

### `web/src/lib/resolver.ts` — resolves templates into the final tree

- `resolveTree(root, templates)` → `{ tree, errors }`: expands every `@insert`
  by splicing the template's contents **in place** (no wrapper folder);
  detects circular inserts and missing templates as errors.
- Also exports `countNodes` (preview stats: folders/files/total, plus `maxDepth`
  and `maxWidth` — deepest level count and widest branching point),
  `treeToText`, `computeMaxDepth`, `gradientColor` (depth-based name coloring).

### `web/src/lib/treeEdit.ts` — immutable tree operations (designer edits)

All return new trees; never mutate.

- `cloneTree`, `updateNode(root, id, updater)` — rebuild full path to target.
- `removeNode(root, id)`, `insertChild(root, parentId, index, node)`.
- `moveNode(root, dragId, targetId, position)` — position ∈
  `before | after | into`; "into" appends as last child of a folder;
  self/descendant drops are no-ops. Covered by regression checks.
- `renameTemplateInTree(nodes, old, new)` / `removeTemplateRefs(nodes, name)`
  — rewrite or strip `@insert` references when templates are renamed/deleted.

### `web/src/lib/export.ts` — output helpers

- `zipTree(tree, zipName)` — resolved tree → JSZip blob of empty
  folders/files (JSZip dependency).
- `downloadBlob` / `downloadText` — anchor-download helpers.
- `copyText` — clipboard copy with `execCommand` fallback.

### `web/src/lib/folders.ts` — write to real disk

- `createOnDisk(tree, picker)` — File System Access API
  (`showDirectoryPicker`); creates empty files for dot-names, directories
  otherwise. Chrome/Edge only.
- `supportsFsAccess()` — feature detection.

### `web/src/components/Designer.tsx` — interactive tree editor (shared)

Used by both the Root Designer and the Templates pane.

- Recursive rows: chevron, drag handle, type icon, name zone (name + child
  count), always-visible control column pinned right, colored by node type
  (blue folder / green file / purple insert; delete neutral→red on hover).
- Controls: add sibling (`+`), add child (plus-under-line icon; disabled on
  `@insert` rows), move up/down, duplicate, delete, expand/collapse template
  (for `@insert` nodes when `onToggleInsert` is provided).
- Drag & drop with before/after/into drop zones (delegates to
  `treeEdit.moveNode`); controls hidden while dragging.
- Double-click name to rename inline (Enter commits, Escape cancels).
- `PlusDropdown` portal menu: Add Folder / File / Insert structure (lists
  templates). `AddSpec` describes what to insert where.
- New nodes enter rename mode automatically.
- **Inline template expansion**: when `templateMap`, `expandedInserts`, and
  `onToggleInsert` are provided, double-clicking an `@insert` row expands its
  template contents inline with purple styling. Template edits call
  `onTemplateNodesChange(templateName, newNodes)`. Insert rows are colored by
  their template's color from `templateColors`.

### `web/src/components/Preview.tsx` — resolved-tree viewer

- Renders the fully resolved tree (what gets written to disk): one line per
  node, no wrapping/clipping — wide trees scroll horizontally.
- Fixed 20px-per-level indent applied to the row itself.
- Depth-gradient name colors; collapsible folders; Expand/Collapse all;
  count badge on folders; error banner replaces the tree when unresolved.

### `web/src/components/CodePane.tsx` — raw source editor

- Textarea over a syntax-highlight backdrop (directives, labels, comments,
  insert/template names, `#hex` colors), line-number gutter synced to scroll.
- Tab inserts tab (Shift+Tab outdents, multi-line aware); Enter auto-indents.

### `web/src/components/SectionPicker.tsx` — templates pane header tools

- Template chooser dropdown, rename (pencil) / delete (×) for the active
  template, "+ Template" inline creator input. Rendered at the top of the
  `TemplatesPane` (the Templates tab of the leftmost column).

### `web/src/components/ColumnResizer.tsx` — drag handle between columns

- Mouse-drag divider; reports per-move pixel deltas via `onResize(dx)`.

### `web/src/components/LeftRail.tsx` — vertical tab rail

- Generic, data-driven vertical tab strip pinned to the desktop's left edge
  (activity-bar style): a stack of icon + vertical-label tabs, one per leftmost
  column pane. Clicking the active tab collapses the column, clicking another
  swaps its content. Pane definitions come from `App` via the `tabs`/`active`/
  `onToggle` props; new panels are added by appending to the tab list.

### `web/src/components/icons.tsx` — inline SVG icon set

Folder, File, Chevron, Grip, Plus, PlusChild (line + plus underneath),
X, Copy, Download, Upload, FolderArrow, Sparkle, Eraser, Pencil, Code, Menu.

### `web/src/components/panes/` — top-level columns

| Pane | Wraps | Notes |
|---|---|---|
| `RootDesignerPane.tsx` | name input + color + Designer | single consolidated header (name `@name` + `@root` color) + root tree; the Root tab of the leftmost column |
| `SourcePane.tsx` | CodePane + issue list | the Source tab of the leftmost column |
| `TemplatesPane.tsx` | SectionPicker + Designer | the Templates tab of the leftmost column |
| `PreviewPane.tsx` | stats header + Preview | folders/files/total counts; the right, flex-fill column |

The leftmost column is the root/source/templates editor selected by the active
`LeftRail` tab; each pane keeps its own default header. All pane components
accept an optional `style` prop (flex sizing from App).

---

## Tests & verification

- `web/scripts/verify.ts` — headless suite run by `npm run verify`
  (via tsx). Covers: parsing (tabs/spaces, labels, directives), resolution
  (in-place splice, circular detection, missing templates), round-trip
  serialize→parse stability, and `treeEdit` mutations including six
  `moveNode` regression cases. Prints `ALL CHECKS PASSED` on success.

## Commands (run inside `web/`)

```
npm run dev               # Vite dev server on :5173 (auto-opens)
npm run build             # tsc -b && vite build
npm run preview           # serve the production build
npm run typecheck         # tsc -b --noEmit
npm run verify            # parser/resolver/treeEdit regression suite
npm run electron:preview  # npm run build, then open dist/ in a plain Electron shell
npm run electron:package  # electron-builder --dir (default output: web/release)
```

## Desktop build (repo root)

```
build.bat                 # full pipeline → Windows installer via Inno Setup
```

`build.bat` runs: dependency install (first run) → `npm run verify` →
`npm run build` → icon generation (`scripts/make-icon.mjs`) →
`electron-builder --dir` → `ISCC.exe` (Inno Setup 6, auto-located under
Program Files or on PATH). Outputs:

- **Installer**: `web/installer/Output/FolderHierarchyStudio-Setup-<version>.exe`
  (version read from `web/package.json`, passed to the `.iss` as
  `/DMyAppVersion`; machine-wide install to
  `Program Files\ProductionSandbox\Folder Hierarchy Designer`, needs elevation).
- **Unpacked app**: `%LOCALAPPDATA%\fh-studio-build\win-unpacked\FolderHierarchyStudio.exe`.

The packaging output deliberately lives **outside** the repo: OneDrive syncs
the workspace and locks the large `win-unpacked` directory while
electron-builder renames it, causing `EPERM`. The `.iss` receives the location
via `/DAppSourceDir`. Requires Node.js and Inno Setup 6
(https://jrsoftware.org/isdl.php).

## Conventions worth preserving

- All source-text mutations go through `applySource` (undo/redo integrity).
- Designer edits produce new trees via `lib/treeEdit.ts` — no in-place mutation.
- Dot-in-name means file; keep this rule consistent everywhere.
- IDs are ephemeral: regenerate on parse, never serialize.
- Single stylesheet (`index.css`); dark GitHub-ish palette with CSS variables.
- Runtime fetches of bundled assets use `${import.meta.env.BASE_URL}`-relative
  paths (not absolute `/...`) so they resolve in the browser, under Vite
  preview, and inside Electron's `app://` scheme.
- In Electron the app header doubles as the window title bar: `html.electron`
  (set in `main.tsx` via UA sniffing) makes `.header` a drag region with
  no-drag controls and right padding reserved for the native min/max/close
  overlay; the overlay colors/height mirror `.header`'s CSS
  (`TITLEBAR_*` constants in `electron/main.cjs`). Keep them in sync when
  changing header padding/height or theme colors.
- All desktop icons derive from `public/Production-Sandbox_Icon.svg`; regenerate
  with `npm run icons` after changing it. The header brand mark is inlined as
  `BrandMarkIcon` (`src/components/icons.tsx`) — update it alongside the SVG.
