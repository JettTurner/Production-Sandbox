# PBK Struct

### Declarative Folder Structure Generator (GUI)

PBK Struct is a **declarative folder-structure system** with a Tkinter GUI that allows you to define, preview, and generate complex directory hierarchies using a simple text format.

It is designed for:

* Studio pipelines
* Asset libraries
* Client / project structures
* Repeatable, auditable filesystem layouts

The system emphasizes **clarity, determinism, and full preview before generation**.

---

## Key Concepts

PBK Struct uses **three ideas**:

1. **Indentation = hierarchy**
2. **Templates = reusable folder trees**
3. **`@insert` = template expansion at any depth**

Everything resolves into a **fully expanded tree** before anything is created on disk.

---

## Features

* ✅ Human-readable `.pbkstruct` format
* ✅ Reusable templates
* ✅ Nested template insertion
* ✅ Fully resolved hierarchy preview
* ✅ Safe Windows path handling
* ✅ Copy structure to clipboard
* ✅ Generate folders on disk

---

## File Format (`.pbkstruct`)

### 1. Comments

Lines starting with `#` are ignored.

```text
# This is a comment
```

---

### 2. Root Section

The `@root` section defines the **top-level folder structure**.

```text
@root
01_EXT
    @insert AssetLibrary
02_INT
    Projects
```

Indentation **must be tabs** (or consistent spaces).

---

### 3. Templates

Templates define **reusable folder trees**.

```text
@template AssetLibrary
    0400_Programs
        Blender
        Revit
    0401_Assets
        Materials
        Textures
```

Templates:

* Can contain unlimited nesting
* Are **never created by themselves**
* Only exist when inserted

---

### 4. Template Insertion

Templates are inserted using:

```text
@insert TemplateName
```

**Insertion respects indentation**, meaning:

```text
Projects
    @insert AssetLibrary
```

…creates the entire AssetLibrary **inside `Projects/`**.

---

## Example: Full Structure

### Input

```text
@root
Projects
    CLIENT1
        @insert ProjectsTemplate

@template ProjectsTemplate
    _Deliverables
    CLIENT1_00001_VL_TestProject
    CLIENT1_00002_AI_TestProject
```

### Fully Resolved Result

```text
Projects
    CLIENT1
        _Deliverables
        CLIENT1_00001_VL_TestProject
        CLIENT1_00002_AI_TestProject
```

This is **exactly** what the preview and generator will produce.

---

## GUI Overview

### 1. Load Template

* Select a `.pbkstruct` file
* The file is parsed and fully resolved

### 2. Preview Tree

* Displays the **final, expanded hierarchy**
* No placeholders
* No templates
* No directives

### 3. Copy Proposed Structure

* Copies the resolved tree as text
* Useful for review or documentation

### 4. Generate Folders

* Prompts for a target directory
* Creates folders safely
* Skips existing folders

---

## Design Rules (Important)

### Indentation Rules

* Indentation **defines parent/child relationships**
* Tabs are recommended
* Mixed indentation is not supported

### Naming Rules

* Folder names are automatically stripped of:

  * Trailing spaces
  * Tabs
* Prevents Windows path errors

### What Does *Not* Happen

* ❌ No files are created
* ❌ No folders created before preview
* ❌ No implicit template expansion
* ❌ No magic defaults

Everything is explicit.

---

## Error Handling

Common issues the system prevents:

| Problem                       | Prevention            |
| ----------------------------- | --------------------- |
| Trailing tabs in folder names | Names are stripped    |
| Invalid Windows paths         | Sanitized joins       |
| Empty template inserts        | Ignored safely        |
| Broken indentation            | Parser fallback logic |

Errors during generation are caught and shown in the GUI.

---

## Typical Use Cases

* Studio asset libraries
* Client project scaffolding
* Visualization pipelines
* Multi-location folder standards
* Admin / IT structure enforcement

---

## Philosophy

PBK Struct is built on the idea that:

> **Folder structures are code.**

They should be:

* Reviewable
* Repeatable
* Predictable
* Documentable

This tool ensures **what you see is what gets created**.

---

## Roadmap (Optional Extensions)

Planned or easy additions:

* Checkbox-based selective generation
* Variable substitution (`{{CLIENT}}`)
* Dry-run export to JSON
* Validation warnings
* Versioned templates

---

## License

Internal studio tool.
Adapt and extend as needed.

---
