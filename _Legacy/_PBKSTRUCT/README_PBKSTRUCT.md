Excellent — you’re at the exact point where a **formal spec** will save you *years* of drift.

Below is a **clean, minimal, opinionated** `.pbkstruct` file specification designed specifically for:

* Deterministic folder generation
* GUI preview & labeling
* Safe expansion
* Future rule layers
* Zero ambiguity

No magic. No guessing.

---

# 📄 `.pbkstruct` File Specification

**Version:** `1.0`
**Purpose:** Declarative filesystem structure definition with reusable templates and metadata.

---

## 1️⃣ Core Design Principles

1. **Indentation defines hierarchy**
2. **Everything is explicit**
3. **Expansion is opt-in**
4. **Metadata never affects folder names**
5. **Same structure drives GUI + filesystem**

---

## 2️⃣ File Layout

A `.pbkstruct` file has **four logical regions** (order-independent):

```text
@version 1.0

@root
...

@template <Name>
...

@state <Code>
...
```

---

## 3️⃣ Indentation Rules

* Tabs **or** spaces allowed
* Must be consistent within a file
* Each indent level = one parent-child relationship
* Empty lines ignored
* Comments allowed with `#`

---

## 4️⃣ Nodes (Folders)

### Syntax

```text
<FolderName> ["Display Label"]
```

### Examples

```text
TX "Texas"
LAX "Los Angeles"
0401_Assets
```

### Rules

* `FolderName` = actual folder name
* `"Display Label"` = GUI-only metadata
* Labels are optional
* Labels **never** affect filesystem output

---

## 5️⃣ Root Section

Defines top-level folder structure.

```text
@root
    01_EXT
    02_INT
    04_AssetLibrary
```

Exactly one `@root` is allowed.

---

## 6️⃣ Templates

Reusable, named subtrees.

### Definition

```text
@template Projects
    Projects
        CLIENT1
            _Deliverables
```

### Expansion

```text
@insert Projects
```

### Rules

* Templates may insert other templates
* Circular references are invalid
* Templates do not auto-expand

---

## 7️⃣ States (Specialized Templates)

State blocks are **named templates with semantic meaning**.

```text
@state TX
    AUS "Austin"
    DAL "Dallas"
```

States expand using a standard rule:

```text
@states CA, TX, FL
```

### Expansion Behavior

For each state:

```
CA/
    <City>/
        @insert LocationTemplate
```

---

## 8️⃣ Location Template (Implicit Convention)

By default, every city expands using:

```text
@template Location
    @insert Projects
```

Can be overridden per file:

```text
@location
    @insert Projects
    LocalDocs
```

---

## 9️⃣ Special Directives

| Directive   | Meaning                |
| ----------- | ---------------------- |
| `@version`  | Spec version           |
| `@root`     | Top-level structure    |
| `@template` | Named reusable tree    |
| `@insert`   | Expand a template      |
| `@state`    | State definition       |
| `@states`   | Expand multiple states |
| `@location` | City expansion rule    |

---

## 🔟 Comments

```text
# This is a comment
```

Ignored by parser.

---

## 1️⃣1️⃣ Validation Rules (Hard Errors)

| Condition                 | Error |
| ------------------------- | ----- |
| Missing `@root`           | ❌     |
| Duplicate template names  | ❌     |
| Circular template insert  | ❌     |
| Invalid indentation       | ❌     |
| Undefined template insert | ❌     |

---

## 1️⃣2️⃣ Example (Complete File)

```text
@version 1.0

@root
    01_EXT
        @states CA, TX
    02_INT
        0201_VR
        0202_3D
    04_AssetLibrary
        @insert AssetLibrary

@location
    @insert Projects

@state CA
    LAX "Los Angeles"
    SDG "San Diego"

@state TX
    AUS "Austin"
    DAL "Dallas"

@template Projects
    Projects
        CLIENT1
            _Deliverables

@template AssetLibrary
    0401_Assets
        @insert AssetCategories

@template AssetCategories
    _Audio
    _Video
```

---

## 1️⃣3️⃣ Output Guarantee

Given the same `.pbkstruct` file:

* Filesystem output is **deterministic**
* GUI preview exactly matches folder creation
* Labels are preserved for UI only

---

## 1️⃣4️⃣ What This Spec Enables Later (Without Changes)

* Rule engine (`@rule`)
* Conditional expansion
* Environment targeting (`@if windows`)
* Per-project overrides
* Export to JSON/YAML
* Schema validation
* Version migration

---

## 1️⃣5️⃣ Non-Goals (By Design)

* No implicit behavior
* No string parsing heuristics
* No filesystem inspection
* No auto-increment logic
* No runtime guessing

---

# 🟢 Recommended Next Steps

1. Lock this spec as **v1.0**
2. Implement:

   * Tokenizer
   * Indent parser
   * Node builder
3. Wire parser output into your GUI preview
4. Keep filesystem writer dumb

If you want, next I can:

* Write the **parser pseudocode**
* Define the **AST schema**
* Create a **formal grammar**
* Refactor your Tkinter app around this

Just say the word.
