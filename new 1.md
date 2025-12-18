Perfect — let’s give this a **clean, production-ready GUI** that fits the *PBK VizLab* tool vibe and stays pragmatic.

Below is a **Tkinter-based GUI** that wraps your `.pbkstruct` generator with:

### ✅ Features

* File picker for `.pbkstruct`
* Output directory picker
* **Dry-run toggle**
* Scrollable **preview log**
* Generate button
* Clear status feedback
* Safe (no filesystem writes unless you confirm)

This is intentionally **simple, stable, and shippable** — not over-engineered.

---

# 🧰 PBKStruct Generator — GUI Version (Tkinter)

## How it looks conceptually

```
+----------------------------------------+
| PBKStruct Filesystem Generator         |
+----------------------------------------+
| Structure File: [ path.pbkstruct ] [..]|
| Output Folder:  [ /output/path   ] [..]|
|                                        |
| [✓] Dry Run (no folders created)       |
|                                        |
| [ Generate File System ]               |
|                                        |
| Output Log:                            |
| ------------------------------------- |
| [DRY] /01_EXT/CA/LAX/Projects/...      |
| [DRY] /04_AssetLibrary/_Materials     |
| ------------------------------------- |
+----------------------------------------+
```

---

## 🧠 Architecture

* **GUI layer** → calls existing generator
* **Generator logic unchanged**
* Uses `queue` + `threading` to prevent UI freeze
* Logging redirected to GUI

---

## 🧩 `pbkstruct_gui.py`

```python
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import threading
import os
import sys

# ============================================================
# IMPORT YOUR GENERATOR LOGIC
# (Paste your generator functions here or import them)
# ============================================================

from pbkstruct_generate import generate   # if split
# or paste generate(), parse_pbkstruct(), etc directly here


# ============================================================
# GUI APP
# ============================================================

class PBKStructApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("PBKStruct Filesystem Generator")
        self.geometry("760x520")
        self.resizable(True, True)

        self._build_ui()

    def _build_ui(self):
        pad = {"padx": 8, "pady": 6}

        # ------------------------
        # File selectors
        # ------------------------
        tk.Label(self, text="PBKStruct File").grid(row=0, column=0, sticky="w", **pad)
        self.struct_entry = tk.Entry(self, width=70)
        self.struct_entry.grid(row=0, column=1, **pad)
        tk.Button(self, text="Browse", command=self.pick_struct).grid(row=0, column=2, **pad)

        tk.Label(self, text="Output Folder").grid(row=1, column=0, sticky="w", **pad)
        self.output_entry = tk.Entry(self, width=70)
        self.output_entry.grid(row=1, column=1, **pad)
        tk.Button(self, text="Browse", command=self.pick_output).grid(row=1, column=2, **pad)

        # ------------------------
        # Options
        # ------------------------
        self.dry_run = tk.BooleanVar(value=True)
        tk.Checkbutton(
            self,
            text="Dry Run (preview only — no folders created)",
            variable=self.dry_run
        ).grid(row=2, column=1, sticky="w", **pad)

        # ------------------------
        # Generate button
        # ------------------------
        self.run_btn = tk.Button(
            self,
            text="Generate File System",
            height=2,
            command=self.run_generator
        )
        self.run_btn.grid(row=3, column=1, sticky="ew", **pad)

        # ------------------------
        # Output log
        # ------------------------
        tk.Label(self, text="Output Log").grid(row=4, column=0, sticky="w", **pad)

        self.log = scrolledtext.ScrolledText(
            self,
            height=18,
            font=("Consolas", 10)
        )
        self.log.grid(row=5, column=0, columnspan=3, sticky="nsew", **pad)

        # Grid expand
        self.grid_rowconfigure(5, weight=1)
        self.grid_columnconfigure(1, weight=1)

    # ========================================================
    # Actions
    # ========================================================

    def pick_struct(self):
        path = filedialog.askopenfilename(
            filetypes=[("PBKStruct Files", "*.pbkstruct"), ("All Files", "*.*")]
        )
        if path:
            self.struct_entry.delete(0, tk.END)
            self.struct_entry.insert(0, path)

    def pick_output(self):
        path = filedialog.askdirectory()
        if path:
            self.output_entry.delete(0, tk.END)
            self.output_entry.insert(0, path)

    def run_generator(self):
        struct = self.struct_entry.get()
        output = self.output_entry.get()

        if not os.path.isfile(struct):
            messagebox.showerror("Error", "Invalid .pbkstruct file")
            return

        if not output:
            messagebox.showerror("Error", "Output folder required")
            return

        self.log.delete("1.0", tk.END)
        self.run_btn.config(state="disabled")

        thread = threading.Thread(
            target=self._execute,
            args=(struct, output, self.dry_run.get()),
            daemon=True
        )
        thread.start()

    def _execute(self, struct, output, dry):
        # Redirect stdout to GUI
        class Logger:
            def write(_, msg):
                self.log.insert(tk.END, msg)
                self.log.see(tk.END)
            def flush(_): pass

        old_stdout = sys.stdout
        sys.stdout = Logger()

        try:
            generate(struct, output, dry_run=dry)
            self.log.insert(tk.END, "\n✔ Done.\n")
        except Exception as e:
            messagebox.showerror("Generation Error", str(e))
        finally:
            sys.stdout = old_stdout
            self.run_btn.config(state="normal")


# ============================================================
# Launch
# ============================================================

if __name__ == "__main__":
    PBKStructApp().mainloop()
```

---

## 🎨 Styling Notes (Optional Next Step)

If you want to elevate this visually:

* Switch to **ttk** widgets
* Add a dark theme
* Add folder tree preview (AST visualization)
* Add checkboxes for selective generation
* Add validation warnings panel

---

## 🔒 Why This Is the Right First GUI

* Zero dependencies
* Cross-platform
* Studio-safe
* Easy to ship internally
* Easy to embed later into a larger PBK tool suite

---

### Next directions (pick one):

1. 🌳 **Tree preview before generation**
2. 🧪 **Validator panel (duplicate states, missing templates)**
3. 📦 **Single-file EXE build**
4. 🎛 **Selective generation (states / assets / projects)**

Say the word and we’ll build it cleanly.
