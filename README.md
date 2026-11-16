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
npm run test:ui    # the built app driven in a real browser (needs Chrome or Edge installed)
npm run typecheck
```

---

## The workspace

Three panes, always visible on a desktop:

| Pane | What it is for |
| --- | --- |
| **Structure** (left) | Root plus every **block**, with how many times each is used. Click one to edit it; drag a block onto a folder to put it there. Starter blocks (Project, Years, Admin, Archive) can be added with one click. |
| **Editor** (centre) | The selected section in one of three views (below), or the whole file as **Source** text (the `<>` button). Everything stays in sync. |
| **Output** (right) | Exactly what will be created: counts, pre-flight checks, the resolved preview, and the actions that create it. |

On a phone the three panes sit behind bottom tabs (Structure · Blocks · Output).

A **block** is a reusable set of folders. In the `.fh` file a block is a `@template`, and using one is an `@insert`.

### Three views

| View | Best for |
| --- | --- |
| **Blocks** | Getting started and seeing the shape. Folders are boxes inside boxes, as deep as the structure goes; only reusable blocks are drawn as colored bricks you drag in. Click a folder's name to go into it; the path at the top leads back. |
| **Columns** | Big, deep structures. One column per level, like a file browser, so you only ever read one short list. Selecting a block shows what is inside it. |
| **List** | Seeing everything at once and bulk rearranging: the whole section as one indented list, with drag and drop and Expand / Collapse all. |

### New: start from a kit

**New** asks a few plain questions (how you sort your work, which departments / years / clients, what every project gets) and builds the structure, with a live preview. You can also start blank or open an example.

### Features

| Feature | How |
| --- | --- |
| **Editing** | In every view: double-click or `F2` to rename, `Del` to delete, arrow keys to move around, `Alt+arrows` to reorder, and drag to rearrange (onto a folder to put it inside, onto an edge to place it before or after). In Blocks, `Enter` goes into a folder and `Backspace` goes back up. In List, double-click a block row to edit the block in place. |
| **Find** | `Ctrl+F` or the Find box: type part of a name, pick a match, and the current view jumps to it. |
| **Source editor** | Syntax highlighting and inline parse warnings/errors. Comments you write are kept when you edit in the tree. |
| **Pre-flight checks** | Names that Windows can't create (`< > : " / \ | ? *`, reserved names like `CON`, trailing dot or space), a name used as both file and folder, and paths that approach the 260-character limit are flagged before anything is written. Same-name siblings are merged, and the counts reflect what actually lands on disk. |
| **Create folders** | *Chrome, Edge, or the desktop app.* Choose a destination, then review a dry run: what is new, what already exists (left untouched), and any conflicts. Create the whole structure or a single block, optionally wrapped in one new folder. Nothing is ever overwritten or deleted. |
| **Download as .zip** | The same structure as an empty-folder zip; works in every browser. |
| **Copy as text** | The resolved structure as tab-indented text. |
| **Open / Save** | `Ctrl+O` opens, `Ctrl+S` saves straight back to the file you opened (it only asks where the first time), `Ctrl+Shift+S` saves a copy. Dropping a `.fh` file on the window opens it. Where the browser has no file pickers, Save downloads the file instead. |
| **Expand / collapse all** | In List view (folders only, or folders and blocks), and above the preview. |
| **Undo / redo** | `Ctrl+Z` / `Ctrl+Y`, 100 steps. |
| **Fill-in names** | A name with a blank in braces, such as `{Client}` or `{yymmdd}_{Project}`, asks for the words when you create folders. `{date}`, `{year}`, `{yy}`, `{month}`, `{day}` and `{yymmdd}` fill themselves in from today's date. |
| **Import a folder** | `⋯` → Import a folder, or from New: reads a folder that already exists and turns it into a structure you can edit. *Chrome, Edge, or the desktop app.* |
| **Picks up where you left off** | The app reopens your last structure, and recent files are listed for reopening. |
| **Path back** | Going into a block from anywhere shows the way back at the top of the editor. |
| **Light / dark theme** | Under the `⋯` menu; remembered. The desktop title bar stays dark. |
| **Samples, What's new** | Under the `⋯` menu. |

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

## Releasing a version

```powershell
.\bump-version.ps1            # asks; Enter takes the next patch
.\bump-version.ps1 minor      # or patch / major / an explicit 1.0.0
.\bump-version.ps1 patch -Commit
```

Sets the version in `web\package.json` (the one place it is kept), `web\package-lock.json` and the line at the top of this README. It also starts the version's notes in `CHANGELOG.md` from the commits since the last version and opens the file to edit (`-NoEdit` skips that); `-Commit` commits the result as "Version X.Y.Z". Then run `build.bat` for the installer.

## Deploying the web app

`npm run build` produces static files in `web/dist/` that can be hosted anywhere (the repo includes a `vercel.json`). "Create folders" needs a Chromium browser on localhost or https; other browsers get the zip.

---

## Project Layout

```
web/
├── public/samples/          # sample .fh files (bundled)
├── scripts/verify.ts        # regression suite (npm run verify)
├── scripts/ui-check.mjs     # browser checks of the built app (npm run test:ui)
├── electron/main.cjs        # desktop shell
└── src/
    ├── lib/                 # format engine: parser, serializer, resolver, validate, ids, treeEdit, kit, blanks, dnd, session, export, folders
    ├── hooks/               # useFhDocument: source text, parsed doc, undo/redo, saved state
    ├── components/          # Sidebar, EditorPane, BlocksView, ColumnsView, Designer (List), NewDialog, OutputPane, …
    └── App.tsx              # shell: layout, file I/O, template operations
```

`docs/structure.md` describes every file. The legacy desktop tool lives on in `pbkstruct_gui.py` (reference only).
