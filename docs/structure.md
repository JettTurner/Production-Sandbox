# Project Structure — Folder Hierarchy Studio

> **AI agents: read this document first** before exploring or changing code.
> It lists every file in the repository and defines what it does.
> Maintained by hand; update it whenever files are added, removed, or repurposed.

---

## What this project is

**Folder Hierarchy Studio** is a visual designer + generator for `.fh`
("folder hierarchy") files, running in the browser and as a Windows desktop
app (Electron). `.fh` is a renamed evolution of the legacy `.pbkstruct` format
parsed by the original Python/tkinter tool (`pbkstruct_gui.py`, kept for
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
	v1.2/

# Reusable pieces
@template react-component #ffa657
	index.tsx
	styles.css
```

- Indentation = nesting (tabs or spaces).
- A name containing a dot (`.`) is a **file**; anything else is a **folder**.
  A trailing `/` forces a folder (`v1.2/`), and anything with children is a
  folder. The single test for this is `isFileNode(node)` in `lib/types.ts`.
- `NAME "Label"` attaches a GUI-only display label (never written to disk).
- `@template X` sections define reusable structures; `@insert X` lines deposit a
  template's contents **in place** (no wrapper folder) at resolve time.
- A trailing `#hex` on `@root` or `@template NAME` assigns a GUI-only display
  color. The legacy separate-line `@template-color` directive was removed and
  now produces a warning.
- Lines starting with `#` are comments. They are kept: each block of comment
  lines is attached to the line that follows it.

### Data flow

```
.fh source text ──parseFh──▶ FhDocument ──resolveTree──▶ resolved tree
      ▲                          │                            │
      └────── serializeFh ◀──────┘ (designer edits)       planTree
                                                               │
                                              planned tree + issues ──▶ preview / zip / create on disk
```

The **source string is the single source of truth**. Text edits replace it
directly; designer edits modify the parsed document, serialize it, and
re-parse. Two things make that round trip safe:

- **Comments are in the model**, so serializing never drops them.
- **Node ids survive re-parsing** (`lib/ids.ts`), so collapse / expand /
  selection state in the UI is not reset by an edit.

Everything that leaves the app (preview, zip, folders on disk) comes from the
**planned tree**: the resolved tree with same-name siblings merged and every
name and path validated (`lib/validate.ts`).

---

## Repository layout

```
/
├── AGENTS.md                  ← instructions for AI agents (read structure doc first)
├── README.md                  ← user-facing readme
├── CHANGELOG.md               ← release notes, newest first (started by bump-version.ps1)
├── bump-version.ps1           ← sets the version in web/package.json, the lock file and
│                                the README; starts the CHANGELOG section; -Commit commits
├── build.bat                  ← one-shot Electron build: verify → vite build →
│                                electron-builder --dir → Inno Setup installer (.iss)
├── vercel.json                ← static hosting config (builds web/, serves web/dist)
├── docs/
│   └── structure.md           ← this document
├── pbkstruct_gui.py           ← LEGACY Python/tkinter tool (.pbkstruct era); reference only
└── web/                       ← THE APP (React + TypeScript + Vite)
    ├── index.html             ← Vite entry HTML
    ├── package.json           ← scripts & deps; also the electron-builder config
    │                             ("build" field) and the Electron entry ("main")
    ├── vite.config.ts         ← Vite config (react plugin, port 5173, auto-open,
    │                             base "./" so the build works under Electron's app:// scheme)
    ├── tsconfig*.json         ← TS solution + app/node configs
    ├── electron/
    │   └── main.cjs           ← Electron main process: serves web/dist via a custom
    │                             app:// protocol; frameless window whose title bar IS
    │                             the app header (TITLEBAR_* constants mirror the CSS)
    ├── installer/
    │   └── folder-hierarchy-studio.iss  ← Inno Setup script consumed by build.bat
    ├── build/
    │   └── icon.ico           ← GENERATED (scripts/make-icon.mjs)
    ├── public/
    │   ├── Production-Sandbox_Icon.svg ← source of truth for all app icons
    │   ├── Production-Sandbox_Icon.ai/.png ← raw design assets
    │   ├── icon.png           ← GENERATED 256px PNG
    │   └── samples/           ← bundled example .fh files (⋯ menu → Samples)
    │       ├── startup.fh     ← loaded automatically on app boot
    │       ├── vizlab.fh
    │       ├── example.fh
    │       ├── project-structure.fh
    │       └── office-directory.fh
    ├── scripts/
    │   ├── verify.ts          ← headless regression suite (npm run verify)
    │   ├── ui-check.mjs       ← the built app driven in a browser (npm run test:ui)
    │   └── make-icon.mjs      ← icon SVG → build/icon.ico + public/icon.png (npm run icons)
    └── src/
        ├── main.tsx           ← React bootstrap (mounts <App/>; adds html.electron)
        ├── App.tsx            ← application shell: layout, file I/O, template operations
        ├── index.css          ← ALL styling (single stylesheet, dark + light themes)
        ├── vite-env.d.ts      ← Vite client types + File System Access API typings
        ├── hooks/             ← useFhDocument (document state)
        ├── components/        ← UI (see below)
        └── lib/               ← pure logic (see below)
```

---

## Source files — definitions

### `web/src/App.tsx` — application shell

Composes the header, the three panes, the status bar, the mobile tab bar, the
Create dialog and toasts. Owns UI state only: selected section (Root or a
template), editor mode (Tree / Source), mobile tab, pane widths, the open
file's name and `FileSystemFileHandle`.

- **Derived output** (memoized): `resolveDoc(doc)` → `planTree(...)` →
  `countNodes(plan.tree)`, plus `countTemplateUses` and display `colors`
  (file colors, with palette fallbacks by position for templates that have
  none; nothing is written until the user picks a color).
- **File I/O**: `openFile` / `save` / `saveAs`. With the File System Access
  API the handle from Open, Save-as or a drag-and-drop is kept, so `save`
  writes straight back to it; without the API, Open uses a file input and Save
  downloads. Save writes the source text exactly as shown in Source.
- **Template operations**: add, rename, delete, recolor — each one `commitDoc`
  call that also carries the template's comments and color.
- **Keyboard**: Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open, Ctrl+Z undo,
  Ctrl+Y / Ctrl+Shift+Z redo; `beforeunload` guard and `confirmDiscard()` on
  new/open/sample.

### `web/src/hooks/useFhDocument.ts` — document state

The only place the source text changes.

- `applySource(text, discrete?)` — text edits; typing within 800 ms coalesces
  into one undo step.
- `commitDoc(update)` — designer edits; always builds on the freshest parsed
  document so several commits in one tick compose.
- `undo` / `redo` (100 steps), `load(text)` (new document, clears history),
  `markSaved()`, and `dirty`, `canUndo`, `canRedo`, `doc`, `issues`.
- Parses once per change and runs `reconcileIds` against the previous
  document so node ids stay stable.

### `web/src/lib/types.ts` — core data model

- `FsNode` — `{ id, kind: "folder" | "insert", name, label?, forceFolder?,
  comments?, from?, children }`. Files are `folder`-kind nodes for which
  `isFileNode` is true. `from` exists only on resolved nodes (the template
  they came from).
- `FhDocument` — `{ version, name, root, templates, templateOrder,
  templateColors, headerComments, rootComments, templateComments,
  trailingComments }`.
- `isFileNode(node)` — THE folder-vs-file rule. `isFileLike(name)` is the
  name-only dot test it builds on.
- `ParseIssue` / `ParseResult`, `newId()`, `emptyDocument()`.

### `web/src/lib/parser.ts` — `.fh` text → `FhDocument`

- Tabs or space indentation; skips blank lines; understands `@version`,
  `@name`, `@root [#hex]`, `@template X [#hex]`, `@insert X`, trailing
  `"Label"` annotations and the trailing-`/` folder marker.
- Comment lines are buffered and attached to the next meaningful line (a
  node, `@root`, `@template`, or the file header); leftovers become
  `trailingComments`.
- A dotted name that has children is marked `forceFolder`. Lines indented
  under an `@insert` produce a warning (they are never created).
- Returns `ParseResult { doc, issues }` with line-numbered errors/warnings.

### `web/src/lib/serializer.ts` — `FhDocument` → `.fh` text

- Writes header comments, `@version`, `@name`, then `@root` and each
  `@template` (in `templateOrder`) with their comments above them. Root nodes
  start at indent 0, template nodes at one tab. Node comments are written at
  the node's indent. `name/` is written only for forced folders with a dotted
  name. Serializing a parsed document is idempotent.

### `web/src/lib/resolver.ts` — resolves templates into the final tree

- `resolveTree(root, templates)` → `{ tree, errors }`: expands every `@insert`
  in place; reports circular inserts and missing templates.
- Resolved ids are `<chain of insert ids>` + `<source node id>`: stable across
  edits and unique when a template is inserted many times.
- `countNodes` (folders / files / total / maxDepth / maxWidth), `treeToText`.

### `web/src/lib/validate.ts` — the planned tree and pre-flight checks

- `planTree(resolved)` → `PlannedTree { tree, issues, errors, warnings,
  duplicates, duplicateExamples, longestPath, longestPathText }`. Merges
  same-name siblings case-insensitively (as Windows does), then checks every
  name (`nameProblem`: illegal characters, reserved device names, trailing
  dot/space), file-vs-folder clashes, and path length against `MAX_PATH`
  (260; warning above `PATH_WARN`).
- The output pane, zip export and Create dialog all use `plan.tree`, so the
  counts shown are what actually lands on disk.

### `web/src/lib/ids.ts` — stable node ids

- `reconcileIds(next, prev)` — copies ids from the previous document onto a
  freshly parsed one: same position + name, else same name among siblings,
  else same position when the sibling count is unchanged (renames).
- `cloneWithNewIds(node)` — deep copy with fresh ids (Duplicate).

### `web/src/lib/treeEdit.ts` — immutable tree operations

All return new trees; never mutate.

- `updateNode`, `removeNode`, `insertChild`, `insertRelative` (before / after /
  into an existing node), `moveNode` (drag & drop; self/descendant drops are
  no-ops), `cloneTree`.
- `makeFolder` (marked `forceFolder` so a later dotted rename stays a
  folder), `makeFile`, `makeInsert`.
- `renameTemplateInTree`, `removeTemplateRefs`, `countTemplateUses`.
- `renamedNode(node, text)` — THE rename rule, shared by every view (rejects
  bad names; never turns a folder into a file). `moveSibling`, `insertAfter`,
  `moveToParent` (drop onto a level), `findByName` (the Find box).

### `web/src/lib/kit.ts` — "start from a kit" and starter blocks

- `buildKit(options)` / `buildKitDocument(options)` — turns the New dialog's
  answers (`KitOptions`: sort levels and their names, project folders, extra
  top folders, numbering, optional top folder) into a complete `.fh`
  document. The first sort level is written at the root; each deeper level
  becomes a block (`YEARS`, `CLIENTS`, …) so it is defined once; project
  folders become the `PROJECT` block.
- `starterBlocks()` — the ready-made blocks offered in the sidebar;
  `uniqueTemplateName` avoids name clashes when one is added.

### `web/src/lib/blanks.ts` — fill-in names

- `findBlanks(tree)` — the `{Name}` blanks used in a tree, in order.
- `dateBlanks(now)` — the blanks that fill themselves in: `date`, `year`,
  `yy`, `month`, `day`, `yymmdd`. `usesDateBlanks(tree)` reports whether any
  are present.
- `fillBlanks(tree, values, now)` — the tree with blanks replaced; runs
  before `planTree`, so the filled names are what gets validated and written.

### `web/src/lib/dnd.ts` — shared drag and keyboard rules

- `TEMPLATE_MIME` (a block dragged from the sidebar), `NODE_MIME` (something
  being moved).
- `dropZone(event, kind)` — before / inside / after, from the pointer
  position, for a row, a folder or a card.
- `keyAction(event)` — the one mapping from keys to actions (rename, delete,
  move, reorder) used by all three views.

### `web/src/lib/session.ts` — what the app remembers

- `loadSession` / `saveSession` — the open structure, in localStorage, so the
  app reopens where it was. `isFirstRun` decides whether to greet with New.
- `listRecent`, `rememberFile`, `forgetFile` — recent file handles in
  IndexedDB; `hasAccess(handle, ask)` re-checks permission before reopening.

### `web/src/lib/export.ts` — files in and out

- `zipTree(tree)` — planned tree → JSZip blob of empty folders/files.
- `pickAndOpenFile`, `pickAndSaveFile`, `writeToHandle`,
  `supportsFilePickers` — `.fh` files via the File System Access API.
- `downloadBlob` / `downloadText`, `copyText` — fallbacks and clipboard.

### `web/src/lib/folders.ts` — write to real disk

- `scanDestination(dir, tree)` — dry run: every entry is `new`, `exists` or
  `conflict` (a file where a folder should be, or the reverse). Changes
  nothing.
- `createOnDisk(dir, tree, onProgress)` — creates what is missing. Existing
  folders are reused; existing files are never opened for writing. Stops at
  the first failure and reports the path and what was created.
- `supportsFsAccess()` — feature detection (Chromium + Electron).

### Components (`web/src/components/`)

| File | Role |
| --- | --- |
| `Sidebar.tsx` | Left pane. Root plus the template list: color dot, name, `N×` use count (or "unused"), filter (7+ templates), new-template input. Template rows are drag sources (`TEMPLATE_MIME`). |
| `BlocksView.tsx` | Blocks view: the current folder as a board of cards (one per folder, listing its contents); blocks are colored bricks; cards accept blocks dragged from the sidebar; click a folder name to go into it. Starts inside the top folder when there is only one. Folders render recursively as boxes inside boxes (`.card` at the top level, `.subcard` below); only inserts are bricks. Add shows on hover or while dragging. On touch, Move then a tap places an item. |
| `Crumbs.tsx` | The path at the top of the editor. In Columns and Blocks it is the path inside the section; after going into a block it starts with the way back (`origins` / `onBackTo` in `ViewProps`, kept in `App`). |
| `WhatsNewDialog.tsx` | Shows `CHANGELOG.md` (imported raw at build time) and the app version. |
| `ColumnsView.tsx` | Columns view: one column per level. Selecting a folder opens its children in the next column; selecting a block opens the block's own contents (edits there change the block everywhere). Each column knows which tree it edits (root or a block). Exports the `ViewProps` shared with `BlocksView`. |
| `NewDialog.tsx` | The New dialog ("start from a kit"): three steps with a live preview; produces `.fh` text via `lib/kit.ts`. Also offers Blank and the bundled examples. |
| *(all three views)* | Share drag types `TEMPLATE_MIME` (a block from the sidebar) and `NODE_MIME` (something being moved), the `reveal` prop (Find asks a view to show a node), and the rename / move helpers in `lib/treeEdit.ts`. |
| `NameInput.tsx` | Inline rename field used by the Blocks and Columns views. |
| `EditorPane.tsx` | Centre pane. A Find box (Ctrl+F) searches names in the section and reveals the pick in the current view. Three views chosen by a segmented control (`Columns`, `List`, `Blocks`; remembered in localStorage) plus a Source toggle. Header (section title; for a template: color, rename, delete) + Tree/Source toggle. Expand all / Collapse all act on the section being edited. Tree mode renders `Designer` for the selected section; Source mode renders `CodePane` for the whole file plus the issue list. Owns collapsed-folder and expanded-insert state so it survives switching sections. |
| `Designer.tsx` | The List view: the tree editor (shared by Root, templates and inline-expanded inserts). Row = chevron, drag grip, icon, name, child count, actions. Actions show on hover/selection only. Selection + keyboard (arrows, Enter/F2, Del, Alt+↑/↓). Drag & drop to move; accepts sidebar templates. Inline rename validates names and never turns a folder into a file. `PlusDropdown` adds a folder, file, or template insert. |
| `CodePane.tsx` | Contenteditable source editor with syntax highlighting, line numbers, Tab / Shift+Tab indent, auto-indent on Enter. |
| `OutputPane.tsx` | Right pane. Stats, pre-flight checks (`CheckLine`), `Preview`, and the actions. Where the browser can't write folders, the zip is the primary action. |
| `Preview.tsx` | Read-only planned tree. Collapsible, optional A–Z sort, a dot marks nodes that came from a template (in that template's color). |
| `CreateDialog.tsx` | The review step before writing: destination picker, scope (whole structure or one template), optional wrapper folder, live dry run via `scanDestination`, then `createOnDisk` with progress and a result line. |
| `ColorPicker.tsx` | Swatch + custom color popover. |
| `ColumnResizer.tsx` | Drag handle between panes (reports pixel deltas). |
| `icons.tsx` | Inline SVG icons (filled set + a stroke set) and the `BrandMarkIcon`. |

### Layout & styling (`web/src/index.css`)

- Desktop: header / `.workspace` (sidebar · editor · output, resizable) /
  status bar.
- ≤ 860px: one pane at a time, chosen by `.app[data-tab]`, with a bottom tab
  bar; rows grow to touch size and the selected row's actions move onto their
  own line.
- Colors are CSS variables at the top of the file. `html[data-theme="light"]`
  repaints the same variables; `App` sets the attribute and remembers the
  choice. No rule below the variable blocks uses a literal color.
- Block colors: the element sets `--c` inline. Borders use `--c`; text uses
  `--ink-c`, which the light theme mixes toward black.
- Order: base rules by area, then one block of responsive rules at the end
  (≤ 1180px, ≤ 860px, touch). Put new media rules there, not beside the base
  rule.
- The Electron title-bar overlay color is set in `electron/main.cjs` and
  stays dark in both themes.

---

## Tests & verification

`web/scripts/verify.ts`, run by `npm run verify` (tsx, no test framework).
Covers:

- every bundled sample: parses, resolves, round-trips, keeps its comments,
  serializes idempotently;
- parsing (indentation, labels, colors, legacy directives), resolution
  (in-place splice, circular / missing templates);
- comments surviving designer edits; the folder marker; validation (illegal
  and reserved names, duplicate merging, file/folder clashes, path length);
- id stability across re-parses and resolves; `treeEdit` operations including
  the `moveNode` regression cases;
- the dry run and create against an in-memory folder: nothing written during
  a scan, existing files untouched, conflicts reported, stop-on-failure.

Prints `ALL CHECKS PASSED` on success.

`web/scripts/ui-check.mjs`, run by `npm run test:ui`, builds nothing itself:
run `npm run build` first. It serves `dist/`, opens it in an installed Chrome
or Edge through `playwright-core` (`FH_BROWSER=chrome|msedge`), and checks
the three views, drag and keyboard editing, Find, the New and Create dialogs,
fill-in names, the path back and the phone layout.

## Commands (run inside `web/`)

```
npm run dev               # Vite dev server on :5173 (auto-opens)
npm run build             # tsc -b && vite build
npm run preview           # serve the production build
npm run typecheck         # tsc -b --noEmit
npm run verify            # regression suite
npm run test:ui           # browser checks of the built app
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

- The version is kept in `web/package.json` only; change it with
  `bump-version.ps1`, never by hand.
- The source text changes only through `applySource` / `commitDoc`
  (`hooks/useFhDocument.ts`).
- Designer edits produce new trees via `lib/treeEdit.ts` — no in-place mutation.
- Use `isFileNode(node)` for file-vs-folder; never test the name directly.
- In the UI a `@template` is called a **block**; the file format and the code
  keep the word "template". Every view must apply renames through
  `renamedNode`.
- Carry comments whenever a document or node is copied or rebuilt.
- Ids are never serialized; `lib/ids.ts` keeps them stable across re-parses.
- Write, zip and preview the planned tree (`planTree`), never the raw
  resolved tree. Never overwrite or delete on disk.
- Single stylesheet (`index.css`) with CSS variables; system fonts only (the
  desktop app must work offline).
- Runtime fetches of bundled assets use `${import.meta.env.BASE_URL}`-relative
  paths so they resolve in the browser, under Vite preview, and inside
  Electron's `app://` scheme.
- In Electron the app header doubles as the window title bar: `html.electron`
  (set in `main.tsx`) makes `.header` a drag region with no-drag controls and
  right padding for the native min/max/close overlay; the overlay colors and
  height mirror the CSS (`--header-h`, `--bg-elev`, `--text` ↔ `TITLEBAR_*`
  in `electron/main.cjs`). Keep them in sync.
- All desktop icons derive from `public/Production-Sandbox_Icon.svg`; regenerate
  with `npm run icons` after changing it. The header brand mark is inlined as
  `BrandMarkIcon` (`src/components/icons.tsx`) — update it alongside the SVG.
- The working copy lives in a OneDrive folder; keep heavy build output out of
  it (see `build.bat`). Moving the repo outside OneDrive avoids sync locks on
  `node_modules` entirely.
