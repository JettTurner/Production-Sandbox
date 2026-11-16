# What's new in Folder Hierarchy Studio

Newest first. Each version is a `## X.Y.Z (date)` heading with a `- ` line per change, written for the people using the app.
`bump-version.ps1` starts each new version's list from the commit messages since the last version, for you to edit.

## 0.2.1 (2026-11-16)

- (Say what changed in 0.2.1.)

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
