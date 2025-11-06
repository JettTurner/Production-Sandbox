---

# **PBK VizLab Tools Documentation**

### *Master Structure Creator & Project Generator Suite*

*Automated folder structure creation tools for multi-office project standardization.*

**Author:** PBK VizLab Tools Team
**Version:** 1.0.0
**Last Updated:** November 2025
**Language:** Python 3.11
**Framework:** Tkinter (no external dependencies)

---

## **Table of Contents**

### **Part I — Master Structure Creator**

1. [Overview](#overview)
2. [Interface Overview](#interface-overview)
3. [Configuration Files](#configuration-files)

   * [national_structure.ini](#1-national_structureini)
   * [office_structure.ini](#2-office_structureini)
   * [folder_structure_asset_library.ini](#3-folder_structure_asset_libraryini)
4. [Generated Folder Example](#generated-folder-example)
5. [Usage](#usage)
6. [Color-Coded Log](#color-coded-log)
7. [Dependencies](#dependencies)
8. [Customization Notes](#customization-notes)
9. [Future Improvements](#future-improvements-optional-ideas)
10. [License](#license)

---

### **Part II — Project Generator**

1. [Overview](#project-generator)
2. [Features](#features)
3. [Default Configuration](#default-configuration)

   * [Default Paths](#default-paths)
   * [Division Template Map](#division-template-map)
   * [Division Project Subpaths](#division-project-subpaths)
4. [INI Structure Definitions](#ini-structure-definitions)

   * [National Structure INI](#national-structure-ini)
   * [Project Template INI](#project-template-ini)
5. [Installation & Usage](#installation--usage)

   * [Requirements](#requirements)
   * [Run the Tool](#run-the-tool)
   * [Interface Overview](#interface-overview-1)
6. [Key Internal Functions](#key-internal-functions)
7. [Example Workflow](#example-workflow)
8. [Customization Tips](#customization-tips)
9. [Author & Maintenance](#author--maintenance)

---

# **Master Structure Creator**

The **Master Structure Creator** is a Python desktop utility for automatically generating a standardized folder hierarchy for national, office, and asset library structures across multiple locations.
It uses configurable `.ini` files to define hierarchical relationships and folder naming conventions, making it easy to create consistent directory layouts for large, multi-office organizations.

---

## **Overview**

This tool reads `.ini` configuration files describing:

* **National structure** → Top-level regions, states, and offices.
* **Office structure** → Standard subfolder layout for each office.
* **Asset library** → Shared asset categories and resources.

It then creates the full hierarchy under a selected root directory, with live progress logs and a preview tree.

The app includes:

* A **Tkinter GUI** with theme support
* Real-time **preview tree** showing the resulting hierarchy
* **INI-driven structure** generation
* Configurable **overwrite modes** (`Overwrite`, `Only New`, `Cancel`)
* Color-coded **logging console**

---

## **Interface Overview**

| Panel            | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| **Left Panel**   | Choose root folder, INI files, and overwrite mode.                 |
| **Right Panel**  | Preview the folder hierarchy before generation.                    |
| **Bottom Panel** | Log window showing folder creation progress, warnings, and errors. |

---

## **Configuration Files**

The tool depends on three `.ini` files that define the folder structures.
They can be customized to match your company or project standards.

### 1. **national_structure.ini**

Defines the overall national and regional layout.

```ini
[_PBK]
TX = 
    Austin(AUS),
    Dallas(DAL),
    Houston(HOU),
    San_Antonio(SAT),
CA = 
    Los_Angeles(LAX),
    Fresno(FRE)
```

Each section represents a company or division.
Each state entry contains one or more offices with optional abbreviations in parentheses.

---

### 2. **office_structure.ini**

Defines the internal layout of each office directory.

```ini
[_ArchitectureProjects]
_ActiveProjects =
_ArchiveProjects =
_ProspectiveProjects =
```

Each section becomes a folder (prefixed with `_` if not already).
Each key/value pair defines nested subfolders, supporting multiple comma-separated values.

---

### 3. **folder_structure_asset_library.ini**

Defines shared resource and asset library folders.

```ini
[Plugins]
Tools = Blender, Unreal, Sketchup
Textures = Wood, Metal, Concrete
```

Each section and key-value pair is translated into nested directories under `_AssetLibrary`.

---

## **Generated Folder Example**

If `root = D:/github/_ROOT`, the tool may create:

```
D:/github/_ROOT/
└── _PBK/
    ├── TX/
    │   ├── _HOU/
    │   │   ├── _ArchitectureProjects/
    │   │   ├── _Admin/
    │   │   ├── _MarketingProjects/
    │   │   └── ...
    │   └── _DAL/
    └── CA/
        ├── _LAX/
        └── _FRE/
└── _AssetLibrary/
    ├── Plugins/
    ├── Textures/
    └── References/
```

---

## **Usage**

### **Run the app**

```bash
python main.py
```

### **Steps**

1. **Root Folder** – Select the directory where the full structure should be created.
2. **Master INI Path** – Choose your `national_structure.ini`.
3. **Office INI Path** – Choose your `office_structure.ini`.
4. **Asset Library INI Path** – Choose your `folder_structure_asset_library.ini`.
5. **Overwrite Mode** – Pick:

   * **Overwrite** – Replace existing folders.
   * **Only New** – Skip existing folders.
   * **Cancel** – Stop at the first existing folder.
6. Click **Create Structure** to generate everything.
7. Watch progress in the log window or preview the hierarchy before creation.

---

## **Color-Coded Log**

| Color            | Meaning                               |
| ---------------- | ------------------------------------- |
| 🟢 **Success**   | Folder created successfully           |
| 🟡 **Warning**   | Overwriting existing folder           |
| ⚪ **Skip**       | Folder already exists (Only New mode) |
| 🔴 **Error**     | Could not create folder               |
| 🔵 **Main Log**  | Process start/finish markers          |
| 🟣 **Asset Log** | Asset library process logs            |

---

## **Dependencies**

* **Python 3.8+**
* **Standard Libraries Only:**
  `os`, `configparser`, `datetime`, `tkinter`

No third-party packages required.

---

## **Customization Notes**

* You can freely modify `.ini` files to change folder structures.
* Use underscores `_` to enforce naming consistency (e.g., `_Admin`).
* Commas in `.ini` values define multiple subfolders.
* Parentheses `()` in names define **abbreviations** for office folders:

  * `Houston(HOU)` → creates `_HOU`
* The color scheme and layout constants are defined at the top of the script.

---

## **Future Improvements (Optional Ideas)**

* Export preview tree as text or JSON
* Allow drag-and-drop reordering in preview
* Save/load custom presets
* CLI mode for batch generation

---

## **License**

This tool is intended for internal or organizational use.
Feel free to modify or extend it for your own workflows.

---


---

# Project Generator

A **Tkinter-based desktop tool** for automatically generating standardized project folder structures across divisions, states, and offices, using INI-driven templates.
It simplifies the creation of new project directories based on **division-specific folder templates** and a **national office structure definition**.

---

## Features

* 🗂 **Automated Folder Generation:** Builds complete project structures from INI templates.
* 🏢 **Division / State / Office Hierarchy:** Populates available offices dynamically from a national INI.
* ⚙️ **INI-Based Templates:** Folder blueprints are defined in `.ini` files for flexibility and maintainability.
* 🧱 **Non-Admin “Link” Placeholders:** Safely creates `_LINK.txt` files instead of symbolic links, avoiding permission issues.
* 🔁 **Overwrite Modes:**

  * **Overwrite:** Replace existing folders.
  * **Only New:** Skip existing ones.
  * **Cancel:** Stop generation if a conflict is found.
* 🪶 **Dark Themed Interface:** Styled to match the master tool theme.
* 🧾 **Detailed Logging:** Realtime color-coded log of every created, skipped, or failed item.

---

## Default Configuration

### Default Paths

These define the tool’s default locations for templates and root folder placement:

```python
DEFAULT_ROOT = "C:\\github\\_TEST_ROOT"
DEFAULT_NATIONAL_FILE = "C:\\github\\_ADMINTOOLS\\_Tools\\File_Structure_Testing\\_ini\\national_structure.ini"
```

### Division Template Map

Each division references a default INI defining its project structure:

```python
DIVISION_TEMPLATE_MAP = {
    "_PBK": "C:\\github\\_ADMINTOOLS\\_Tools\\File_Structure_Testing\\_ini\\project_folder_structure_architecture.ini",
    "_VIZLAB": "C:\\github\\_ADMINTOOLS\\_Tools\\File_Structure_Testing\\_ini\\project_folder_structure_viz.ini",
}
```

### Division Project Subpaths

Defines where generated projects live under each office:

```python
DIVISION_PROJECT_SUBPATH = {
    "_PBK": os.path.join("_ArchitectureProjects", "_ActiveProjects"),
    "_VIZLAB": os.path.join("_ArchitectureProjects", "_ActiveProjects"),
}
```

You can add new divisions by editing both maps.

---

## INI Structure Definitions

### National Structure INI

Defines available offices per division and state:

```ini
[_PBK]
TX = Houston(HOU), Dallas(DAL)
CO = Denver(DEN)

[_VIZLAB]
TX = Viz_Houston(VZH), Viz_Dallas(VZD)
```

Each entry should follow:

```
Full_Name(ABR)
```

Where:

* **Full_Name** is displayed in the dropdown.
* **ABR** becomes the folder suffix (e.g., `_HOU`).

### Project Template INI

Defines the structure of a single project. Example:

```ini
[_PROJECT_ROOT]
01_ADMIN = Correspondence, Invoices
02_DESIGN = Sketches, Render_Exports
03_DELIVERY = LINK:U:\Shared\Deliverables
```

* Each **section** creates a top-level folder.
* Each **key** creates a subfolder inside the section.
* Comma-separated values create nested folders under that key.
* A value starting with `LINK:` creates a text placeholder (instead of a symbolic link).

---

## Installation & Usage

### Requirements

* Python 3.8+
* No external dependencies (uses built-in libraries only)

### Run the Tool

```bash
python project_generator.py
```

### Interface Overview

| Section                       | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| **Root Folder**               | The base path where all divisions live.                        |
| **Division / State / Office** | Selected from dropdowns populated by the national INI.         |
| **Project INI Path**          | The template INI defining the folder layout.                   |
| **Project Names**             | Enter one project name per line.                               |
| **Overwrite Mode**            | Choose whether to overwrite, skip, or cancel existing folders. |
| **Log Output**                | Displays creation results, warnings, and errors.               |

When ready, click **“Generate Projects”**.
The tool builds all folders and subfolders automatically, logging each step.

---

## Key Internal Functions

| Function                                               | Purpose                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `load_ini(path)`                                       | Reads and parses INI files with preserved case.         |
| `parse_national(path)`                                 | Loads national hierarchy of divisions/states/offices.   |
| `create_folder(base, name, log, mode)`                 | Safely creates a folder, logging the result.            |
| `ensure_relative_path(base, rel, log, mode)`           | Recursively creates all subfolders along a path.        |
| `write_link_placeholder(dir, name, target, log, mode)` | Writes a `_LINK.txt` instead of a real symlink.         |
| `build_project_from_template(root, ini, mode, log)`    | Builds a full project folder tree from an INI template. |

---

## Example Workflow

1. Launch the tool.
2. Select division `_PBK`, state `TX`, and office `Houston`.
3. Confirm the `project_folder_structure_architecture.ini` path.
4. Paste project names like:

   ```
   24001_New_School
   24002_Town_Hall
   ```
5. Click **Generate Projects**.

You’ll see a log like:

```
[+] Folder created: C:\github\_TEST_ROOT\_PBK\_TX\_HOU\_ArchitectureProjects\_ActiveProjects\24001_New_School
[+] Folder created: 01_ADMIN
[+] Folder created: Invoices
[+] Folder created: 02_DESIGN
[L] Link placeholder written: 03_DELIVERY_LINK.txt → U:\Shared\Deliverables
```

---

## Customization Tips

* Add new divisions or templates by updating the dictionaries at the top of the file.
* To adjust colors, edit the `THEME` dictionary.
* To test locally without touching production data, change `DEFAULT_ROOT` to a sandbox path.
* To integrate with your existing “Master Tool,” ensure theme and path conventions match.

---

## Author & Maintenance

**Author:** PBK VizLab Tools Team
**Version:** 1.0.0
**Last Updated:** November 2025
**Language:** Python 3.11
**Framework:** Tkinter (no external dependencies)

---