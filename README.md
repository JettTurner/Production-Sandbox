# Folder Heirarchy Studio

**Version:** 1.0 (web) · **Author:** Jett Turner
**Purpose:** Design, preview, and generate folder hierarchies from a simple text definition — now as a modern **webapp**.

Previously a Tkinter desktop tool, this project is now a **pure client-side web app** (React + TypeScript + Vite). The definition format has been renamed from `.pbkstruct` to **`.fh`** (folder hierarchy). Files written in the old `.pbkstruct` syntax still load fine.

---

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Everything runs in your browser — no server required.

```bash
npm run build   # production build -> web/dist/
npm run verify  # parser/resolver sanity checks against the sample .fh files
npm run typecheck
```

---

## Features

| Feature | How |
| --- | --- |
| **Visual designer** | Build the tree with buttons + drag & drop: add folders, insert templates, reorder, duplicate, rename (double-click). Edit `@root` or any template via section tabs. |
| **Live code editor** | The `.fh` source pane is two-way synced with the designer — edit text and see the tree update, and vice versa. Syntax highlighting + inline parse warnings/errors. |
| **Resolved preview** | Fully expands every `@insert` with circular-reference detection and missing-template errors. Shows folders/files, depth-colored, collapsible. |
| **Create on disk** | *Chrome/Edge only.* Uses the browser **File System Access API** (`showDirectoryPicker`) to create the real folder tree on your machine. Requires localhost or https. |
| **Download as .zip** | Exports the resolved empty structure as a `.zip`. |
| **Copy as text** | Copies the resolved structure as tab-indented text to the clipboard. |
| **Templates panel** | Create, rename (double-click), and delete templates; see usage counts; references update automatically on rename/delete. |
| **Drag & drop files** | Drop any `.fh` / `.pbkstruct` file anywhere on the page to open it. |
| **Samples** | Load from bundled sample structures (VizLab production, office directory, project structure, recursion demo). |

> Names containing a `.` (e.g. `README.md`) are treated as **files**; everything else is a **folder** (matches legacy behavior).

---

## The `.fh` Format

A `.fh` file defines a hierarchy with **tab indentation** (4-space indentation is also supported and auto-detected). Each tab = one level of nesting.

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
        @insert TESTPROJECTS

@template TESTPROJECTS
    260000_VL_Client-Name_Project-Name_TX_SAN_VZLB_IN
        @insert PROJECT

@template PROJECT
    00_ProgressImages
    01_Deliverables
    02_Links
    03_ReferenceFiles
```

### Directives

| Directive | Meaning |
| --- | --- |
| `@version 1.0` | Format version (informational) |
| `@name <name>` | Document name (informational) |
| `@root [#hex]` | Starts the top-level structure; optional GUI display color |
| `@template <NAME> [#hex]` | Starts a reusable, named subtree; optional GUI display color |
| `@insert <NAME>` | Expands a template in place |

### Node syntax

```fh
TX "Texas"     # folder "TX" with GUI-only label "Texas"
README.md      # treated as a file (name contains a dot)
```

- **Comments** start with `#` and are ignored (whole line).
- **Colors**: a trailing `#hex` on `@root` or `@template NAME` (e.g. `@template PROJECT #ffa657`) sets a GUI-only display color; it never reaches disk.
- **Templates** may insert other templates. Nested inserts are fully supported.
- **Circular inserts** (`A -> B -> A`) are detected and reported as errors.
- **Missing templates** are reported as errors.

---

## Deploying

`npm run build` produces static files in `web/dist/` that you can host anywhere (GitHub Pages, Netlify, any static host). For full offline/folder-creation support it's best run on localhost or https.

**Folder creation note:** `showDirectoryPicker()` is only available in Chromium-based browsers under a secure context. On other browsers, use **Download as .zip** instead.

---

## Project Layout

```
web/
├── public/samples/          # sample .fh files (bundled)
├── scripts/verify.ts        # parser sanity checks (npm run verify)
└── src/
    ├── lib/                 # format engine (parser, serializer, resolver, export, fs access)
    ├── components/          # CodePane, Designer, Preview, TemplatesPanel, icons
    └── App.tsx              # layout + state + actions
```

The legacy desktop app lives on in `pbkstruct_gui.py` (kept for reference).