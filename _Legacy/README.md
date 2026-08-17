# PBK VizLab Folder Generator

**Version:** 1.4
**Author:** Jett Turner
**Purpose:** Generate complex folder structures for PBK VizLab projects using a `.pbkstruct` definition file, supporting recursive templates and asset libraries.

---

## Table of Contents

1. [Overview](#overview)
2. [File Format (`.pbkstruct`)](#file-format-pbkstruct)
3. [Supported Commands](#supported-commands)
4. [Templates & Recursive Inserts](#templates--recursive-inserts)
5. [Warnings & Error Handling](#warnings--error-handling)
6. [Using the GUI](#using-the-gui)
7. [Generating Folders](#generating-folders)
8. [Copying Structure](#copying-structure)
9. [Best Practices](#best-practices)

---

## Overview

The PBK VizLab Folder Generator allows you to define a hierarchical folder structure for your projects, clients, and asset libraries using a simple text-based definition file (`.pbkstruct`). The program parses this file and generates folders on disk according to the hierarchy.

Key features:

* Supports nested folders, subfolders, and multi-level templates.
* Allows `@insert` statements to reuse templates recursively.
* Detects direct mutual recursion to prevent infinite loops.
* GUI interface for visualizing the structure before creation.

---

## File Format (`.pbkstruct`)

A `.pbkstruct` file uses **tabs only** to define folder hierarchies. Each tab represents one level of nesting.

**Example:**

```
@version 1.4
@name PBK Vizlab Structure

#---Root---
@root
01_EXT
	CA
		ANH
			@insert TESTCLIENTS
```

* **Tabs**: Each level of hierarchy must be a **tab**, not spaces.
* **Comments:** Lines starting with `#` are ignored.
* **Templates:** Use `@template <TEMPLATE_NAME>` to define reusable folder structures.

---

## Supported Commands

### Root

* `@root` → Defines the main folder structure. All top-level folders go under this.

### Template Definition

* `@template <TEMPLATE_NAME>` → Defines a reusable template. All indented lines under it are part of the template.

### Insert

* `@insert <TEMPLATE_NAME>` → Expands a template at the current location in the hierarchy.

**Example:**

```
@template TESTCLIENTS
	CLIENT1
		_Deliverables
		@insert TESTPROJECTS
```

---

## Templates & Recursive Inserts

Templates can include other templates via `@insert`. Nested inserts are fully supported, allowing large folder trees to be defined modularly.

**Key behaviors:**

1. Templates expand at the exact **tab indentation** of the `@insert`.
2. Multiple `@insert`s at the same level are supported.
3. Recursive inserts are detected; direct mutual recursion triggers an error.

**Example:**

```
@template CHAR_LIB
	_Characters_2D
		@insert ARCHTYPES
	_Characters_3D
		@insert ARCHTYPES

@template ARCHTYPES
	_Sports
		Basketball(_Basketball)
```

After resolving inserts, `_Characters_2D` will include `_Sports` → `Basketball(_Basketball)` as a subfolder.

---

## Warnings & Error Handling

* **Direct Mutual Recursion:** If `TemplateA` inserts `TemplateB` which inserts `TemplateA`, the parser raises an error:

```
Direct recursion detected: TemplateA -> TemplateB -> TemplateA
```

* **Missing Template:** Attempting to insert a template that is not defined raises:

```
Template 'TEMPLATE_NAME' not found
```

* **Indentation Mismatch:** Mixing tabs and spaces will break the hierarchy. **All lines must use tabs only.**

---

## Using the GUI

1. Launch `pbkstruct_gui.py`.
2. Click **Load Template** and select a `.pbkstruct` file.
3. The treeview displays the fully resolved structure with all inserts expanded.
4. Expand/collapse folders in the treeview to inspect nested contents.

---

## Generating Folders

1. Click **Generate Folders**.
2. Choose a target directory on disk.
3. The program creates all folders recursively.
4. If any error occurs (e.g., invalid folder name), an error message will appear.

**Notes:**

* Existing folders are preserved (`exist_ok=True`).
* Invalid characters in Windows folder names (e.g., `\ / : * ? " < > |`) will cause errors.

---

## Copying Structure

* Click **Copy Proposed Structure** to copy a text-based representation of the resolved folder tree to the clipboard.
* This output uses **tab indentation** to show hierarchy.

**Example:**

```
01_EXT
	CA
		ANH
			CLIENT1
				_Deliverables
				CL1_00001_VL_TestProjectName_TX_SAN_VZLB_IN
					00_ProgressImages
					01_Deliverables
```

---

## Best Practices

1. **Use tabs only** for all indentation.
2. **Keep templates modular**; avoid overly deep direct recursion.
3. **Test smaller templates first** to ensure inserts expand correctly.
4. **Naming conventions:** Use descriptive folder names; avoid Windows invalid characters.
5. **Use `@insert` for reusable structures** like asset libraries, clients, and projects.

---

This README reflects **version 1.4**, which fully supports:

* Nested templates and inserts
* Recursive insert resolution with direct recursion detection
* Multi-level asset and client folder structures

---