# AI Agent Instructions

## Read first

**Before doing anything in this repository, read [`docs/structure.md`](docs/structure.md).**
It lists and defines every file, the `.fh` data model, architecture decisions,
commands, and conventions. It is the authoritative map of the codebase — check
it before searching or guessing.

If you add, remove, or repurpose files, update `docs/structure.md` in the same
change.

## Project in one line

Folder Hierarchy Studio (`web/`) — React + TypeScript + Vite app that visually
edits, resolves, previews, and exports `.fh` folder-hierarchy files (successor
to the legacy Python `.pbkstruct` tool kept at the repo root for reference).

## Commands (run inside `web/`)

```
npm run dev        # dev server :5173
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
npm run verify     # parser/resolver/treeEdit regression suite
```

After code changes: run `npm run typecheck`, `npm run build`, and
`npm run verify`; all three must pass.

## Key rules

- All source-text mutations go through `applySource` in `App.tsx`
  (undo/redo integrity).
- Designer edits must produce new trees via `lib/treeEdit.ts`.
- A name containing a dot (`.`) is a file; everything else is a folder.
- Node `id`s are ephemeral — regenerated on parse, never serialized.
