# Folder Hierarchy Studio

**Version:** 0.2.0 · **Author:** Jett Turner
**Purpose:** Design, check, and generate folder hierarchies from a simple text definition (`.fh`).

A client-side web app (React + TypeScript + Vite) that also ships as a Windows desktop app (Electron). Nothing is uploaded anywhere; everything runs on your machine. Files written in the legacy `.pbkstruct` syntax still load.

---

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

```bash
npm run build      # production build -> web/dist/
npm run verify     # regression suite: parser, resolver, validation, tree edits, disk writes
npm run typecheck
```

---

## The workspace

Three panes, always visible on a desktop:

| Pane | What it is for |
| --- | --- |
| **Structure** (left) | Root plus every template, with how many times each is inserted. Click one to edit it; drag a template onto a folder to insert it there. |
| **Editor** (centre) | The selected section as a **Tree** (drag and drop, rename, add, duplicate, delete) or the whole file as **Source** text. Both stay in sync. |
| **Output** (right) | Exactly what will be created: counts, pre-flight checks, the resolved preview, and the actions that create it. |

On a phone the three panes sit behind bottom tabs (Structure · Templates · Output).

### Features

| Feature | How |
| --- | --- |
| **Tree editor** | Row actions appear on the row you point at or select. Double-click or `F2` to rename, `Del` to delete, arrow keys to move around, `Alt+↑/↓` to reorder, drag to move. Double-click an `@insert` row to edit its template in place. |
| **Source editor** | Syntax highlighting and inline parse warnings/errors. Comments you write are kept when you edit in the tree. |
| **Pre-flight checks** | Names that Windows can't create (`< > : " / \ | ? *`, reserved names like `CON`, trailing dot or space), a name used as both file and folder, and paths that approach the 260-character limit are flagged before anything is written. Same-name siblings are merged, and the counts reflect what actually lands on disk. |
| **Create folders** | *Chrome, Edge, or the desktop app.* Choose a destination, then review a dry run: what is new, what already exists (left untouched), and any conflicts. Create the whole structure or a single template, optionally wrapped in one new folder. Nothing is ever overwritten or deleted. |
| **Download as .zip** | The same structure as an empty-folder zip; works in every browser. |
| **Copy as text** | The resolved structure as tab-indented text. |
| **Open / Save** | `Ctrl+O` opens, `Ctrl+S` saves straight back to the file you opened (it only asks where the first time), `Ctrl+Shift+S` saves a copy. Dropping a `.fh` file on the window opens it. Where the browser has no file pickers, Save downloads the file instead. |
| **Undo / redo** | `Ctrl+Z` / `Ctrl+Y`, 100 steps. |
| **Samples** | Under the `⋯` menu. |

---

## The `.fh` Format

A `.fh` file defines a hierarchy with **tab indentation** (space indentation is also supported and auto-detected). Each level of indentation is one level of nesting.

```fh
@version 1.0
@name PBK VizLab Structure

#---Root---
@root
01_EXT
	CA
		ANH
			@insert TESTCLIENTS

#---Templates---
@template TESTCLIENTS
	CLIENT1
		_Deliverables
		@insert PROJECT

# Every project gets these
@template PROJECT #ffa657
	00_ProgressImages
	01_Deliverables
	v1.2/
	README.md
```

### Directives

| Directive | Meaning |
| --- | --- |
| `@version 1.0` | Format version (informational) |
| `@name <name>` | Document name (informational) |
| `@root [#hex]` | Starts the top-level structure |
| `@template <NAME> [#hex]` | Starts a reusable, named subtree; optional display color. Names are one word (no spaces). |
| `@insert <NAME>` | Expands a template in place (its contents, with no wrapper folder) |

### Node syntax

```fh
TX "Texas"     # folder "TX" with a display-only label "Texas"
README.md      # a file: the name contains a dot
v1.2/          # a folder, even though the name contains a dot
```

- **Files vs folders.** A name containing a `.` is a **file**; everything else is a **folder**. End a name with `/` to make it a folder regardless (`v1.2/`). Anything that has children is a folder.
- **Comments** are whole lines starting with `#`. They are kept, attached to whatever line follows them.
- **Colors**: a trailing `#hex` on `@root` or `@template NAME` is display-only; it never reaches disk.
- **Templates** may insert other templates. Circular inserts (`A -> B -> A`) and missing templates are reported as errors.

---

## Desktop app

`build.bat` (repo root) builds the Windows installer: verify → build → icons → `electron-builder --dir` → Inno Setup. It needs Node.js and [Inno Setup 6](https://jrsoftware.org/isdl.php). See `docs/structure.md` for details.

## Deploying the web app

`npm run build` produces static files in `web/dist/` that can be hosted anywhere (the repo includes a `vercel.json`). "Create folders" needs a Chromium browser on localhost or https; other browsers get the zip.

---

## Project Layout

```
web/
├── public/samples/          # sample .fh files (bundled)
├── scripts/verify.ts        # regression suite (npm run verify)
├── electron/main.cjs        # desktop shell
└── src/
    ├── lib/                 # format engine: parser, serializer, resolver, validate, ids, treeEdit, export, folders
    ├── hooks/               # useFhDocument: source text, parsed doc, undo/redo, saved state
    ├── components/          # Sidebar, EditorPane, Designer, CodePane, OutputPane, Preview, CreateDialog, …
    └── App.tsx              # shell: layout, file I/O, template operations
```

`docs/structure.md` describes every file. The legacy desktop tool lives on in `pbkstruct_gui.py` (reference only).
