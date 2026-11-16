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
edits, resolves, validates, previews, and exports `.fh` folder-hierarchy files
(successor to the legacy Python `.pbkstruct` tool kept at the repo root for
reference).

## Commands (run inside `web/`)

```
npm run dev        # dev server :5173
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
npm run verify     # regression suite (parser, resolver, validation, ids, treeEdit, disk writes)
npm run test:ui    # browser checks of the built app (run npm run build first)
```

After code changes: run `npm run typecheck`, `npm run build`, and
`npm run verify`; all three must pass. Add a check to `scripts/verify.ts` for
any engine behaviour you change.

## Key rules

- The `.fh` source string is the single source of truth. It changes only
  through `applySource` (text edits) or `commitDoc` (designer edits) in
  `hooks/useFhDocument.ts` — never set it any other way (undo/redo integrity).
- Designer edits must produce new trees via `lib/treeEdit.ts` (no mutation).
- Comments are part of the document model. Anything that builds or copies an
  `FhDocument` must carry `headerComments`, `rootComments`,
  `templateComments`, `trailingComments` and each node's `comments`.
- File vs folder is decided by `isFileNode(node)` (`lib/types.ts`), never by
  testing the name directly: a dotted name is a file unless `forceFolder` is
  set (written as a trailing `/`).
- Node `id`s are never serialized, but they are stable: `lib/ids.ts` carries
  them across re-parses. Give new nodes an id with `newId()` and re-id copies
  with `cloneWithNewIds`.
- Anything written to disk or zipped must be the planned tree from
  `planTree()` (`lib/validate.ts`), and creation must never overwrite or
  delete (`lib/folders.ts`).
