# What's new in Folder Hierarchy Studio

Newest first. Each version is a `## X.Y.Z (date)` heading with a `- ` line per change, written for the people using the app.
`bump-version.ps1` starts each new version's list from the commit messages since the last version, for you to edit.

## 0.2.1 (2026-11-16)

- Update package-lock.json
- Light theme, one tidy stylesheet, docs for the new features

## 0.2.0 (2026-11-16)

- New three-pane layout: Root and templates on the left, one editor in the middle, what will be created on the right
- Create folders now shows a dry run first: what is new, what already exists, and any conflicts
- Create a single template on its own, optionally inside one new folder
- Names Windows can't create are flagged before anything is written
- Comments in a .fh file are kept when you edit in the tree
- A name ending in `/` is a folder even if it contains a dot (`v1.2/`)
- Save writes back to the file you opened instead of asking every time
- Folders you collapsed stay collapsed while you edit
- Phone layout with bottom tabs
- Three ways to look at a structure: Columns, List and Blocks
- Blocks shows folders nested inside folders, as deep as they go; only reusable blocks are drawn as bricks
- A path back at the top whenever you go into a block, the same in every view
- New asks a few plain questions and builds the structure for you; it can also start from a folder you already have
- Fill-in names: a folder called `{Client}` or `{yymmdd}_{Project}` asks for the words when you create it
- Find a folder by name with Ctrl+F
- Drag to rearrange in every view; on a phone, tap Move and then tap where it goes
- The app reopens what you were working on, and Open lists recent files
- Light theme, under the menu
- What's new, under the menu
