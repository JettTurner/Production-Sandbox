import os
import configparser
import datetime
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext

# =========================================
# DEFAULT PATHS (edit as needed)
# =========================================
DEFAULT_ROOT = "C:\github\_TEST_ROOT"
DEFAULT_NATIONAL_FILE = "C:\github\_ADMINTOOLS\_Tools\File_Structure_Testing\_ini\national_structure.ini"
# Division -> default project template
DIVISION_TEMPLATE_MAP = {
    "_PBK": "C:\github\_ADMINTOOLS\_Tools\File_Structure_Testing\_ini\project_folder_structure_architecture.ini",
    "_VIZLAB": "C:\github\_ADMINTOOLS\_Tools\File_Structure_Testing\_ini\project_folder_structure_viz.ini",
    # add more divisions here if you introduce more templates
}
# Division -> default subpath inside each office where projects live
DIVISION_PROJECT_SUBPATH = {
    "_PBK": os.path.join("_ArchitectureProjects", "_ActiveProjects"),
    "_VIZLAB": os.path.join("_ArchitectureProjects", "_ActiveProjects"),
    # add per-division default placement if they differ
}

# =========================================
# THEME (matches your master tool)
# =========================================
THEME = {
    "bg": "#1e1e1e",
    "fg": "#e0e0e0",
    "input_bg": "#2d2d2d",
    "input_fg": "#ffffff",
    "button_bg": "#3c3c3c",
    "button_fg": "#ffffff",
    "highlight": "#007acc",
    "warning": "#ffcc00",
    "error": "#ff6666",
    "success": "#66ff99",
    "skip": "#888888",
    "session": "#66ccff",
}

# =========================================
# HELPERS
# =========================================
def load_ini(file_path):
    cfg = configparser.ConfigParser()
    cfg.optionxform = str  # preserve case
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"INI file not found: {file_path}")
    cfg.read(file_path)
    return cfg

def parse_national(national_ini_path):
    """
    Returns:
      divisions: {
        division: {
          STATE_ABBR: [(office_display_name, office_abbr), ...],
          ...
        },
        ...
      }
    """
    cfg = load_ini(national_ini_path)
    divisions = {}
    for division in cfg.sections():
        # skip sections that have no items
        items = list(cfg[division].items())
        if not items:
            continue
        divisions[division] = {}
        for state_abbr, offices_blob in items:
            state = state_abbr.strip().upper()
            offices = [o.strip() for o in offices_blob.split(",") if o.strip()]
            parsed = []
            for office in offices:
                # Expected "Full_Name(ABR)"
                if "(" in office and ")" in office:
                    name_raw, abbr = office.rsplit("(", 1)
                    full_display = name_raw.strip().replace("_", " ")
                    abbr = abbr.strip(" )").upper()
                    parsed.append((full_display, abbr))
                else:
                    # Fallback: make a best-effort abbr
                    full_display = office.replace("_", " ").strip()
                    # naive fallback abbr: first 3 uppercase letters without spaces
                    abbr = "".join([c for c in full_display if c.isalpha()])[:3].upper()
                    parsed.append((full_display, abbr))
            divisions[division][state] = parsed
    return divisions

def create_folder(base_path, folder_name, log_func, overwrite_mode="Only New"):
    path = os.path.join(base_path, folder_name)
    existed = os.path.exists(path)

    try:
        os.makedirs(path, exist_ok=True)
        if existed:
            if overwrite_mode == "Overwrite":
                log_func(f"[!] Overwritten folder: {path}", THEME["warning"])
            elif overwrite_mode == "Only New":
                log_func(f"[-] Skipped existing folder: {path}", THEME["skip"])
                return path
            elif overwrite_mode == "Cancel":
                log_func(f"[X] Cancelled at existing folder: {path}", THEME["error"])
                return None
        else:
            # Folder did not exist before → log creation
            log_func(f"[+] Folder created: {path}", THEME["success"])
        return path
    except Exception as e:
        log_func(f"[X] Failed to create folder: {path}. Error: {e}", THEME["error"])
        return None


def ensure_relative_path(base_path, rel_path, log_func, overwrite_mode):
    """
    Walks rel_path component by component (sep-aware) creating folders as needed.
    Returns the absolute path of the final directory or None on failure/cancel.
    """
    current = base_path
    for part in rel_path.split(os.sep):
        if not part:
            continue
        made = create_folder(current, part, log_func, overwrite_mode)
        if made is None:
            return None  # cancel or failure
        current = made
    return current

def write_link_placeholder(dir_path, name, target, log_func, overwrite_mode):
    """
    Safe, non-admin 'link' placeholder: create a text file noting the intended LINK target.
    Avoids mklink/admin requirements and prevents bad folder names like 'LINK:U:\...'
    """
    try:
        os.makedirs(dir_path, exist_ok=True)
        placeholder = os.path.join(dir_path, f"{name}_LINK.txt")
        if os.path.exists(placeholder) and overwrite_mode == "Only New":
            log_func(f"[-] Skipped existing link placeholder: {placeholder}", THEME["skip"])
            return
        with open(placeholder, "w", encoding="utf-8") as f:
            f.write(f"Intended LINK target for '{name}':\n{target}\n")
        log_func(f"[L] Link placeholder written: {placeholder} → {target}", THEME["highlight"])
    except Exception as e:
        log_func(f"[X] Failed to write link placeholder for '{name}' in {dir_path}. Error: {e}", THEME["error"])

def build_project_from_template(project_root, template_ini, overwrite_mode, log_func):
    """
    Build project folders from template INI.
    Supports:
      key=value lists (comma-separated) for nested subfolders
      LINK:... values -> creates placeholder file under 'key' folder indicating the target
    """
    cfg = load_ini(template_ini)

    for section in cfg.sections():
        section_path = create_folder(project_root, section, log_func, overwrite_mode)
        if section_path is None:
            return  # cancelled/failed

        # for each folder entry under the section
        for key, value in cfg[section].items():
            key_name = key.strip()
            # If the value is a LINK directive, create a placeholder and continue
            if value.strip().upper().startswith("LINK:"):
                target = value.split(":", 1)[1].strip()
                # write placeholder inside the section, named after key
                write_link_placeholder(section_path, key_name, target, log_func, overwrite_mode)
                continue

            key_path = create_folder(section_path, key_name, log_func, overwrite_mode)
            if key_path is None:
                return

            # Nested comma-separated children
            children = [c.strip() for c in value.split(",") if c.strip()]
            for child in children:
                child_path = create_folder(key_path, child, log_func, overwrite_mode)
                if child_path is None:
                    return

# =========================================
# GUI
# =========================================
class ProjectGenerator:
    def __init__(self, root):
        self.root = root
        self.root.title("Project Generator")
        self.root.configure(bg=THEME["bg"])

        # Parsed national hierarchy
        self.divisions = {}
        try:
            self.divisions = parse_national(DEFAULT_NATIONAL_FILE)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load national structure: {e}")

        # State: remembers last auto-set root to avoid clobbering user edits unexpectedly
        self._last_auto_root = None

        # Variables
        self.root_folder = tk.StringVar(root, value=DEFAULT_ROOT)
        self.project_ini = tk.StringVar(root, value="")
        self.division = tk.StringVar(root, value="")
        self.state = tk.StringVar(root, value="")
        self.office = tk.StringVar(root, value="")
        self.project_names = tk.StringVar(root, value="ProjectA\nProjectB")
        self.overwrite_mode = tk.StringVar(root, value="Only New")

        # ---------- Layout (unchanged structure) ----------
        # Root Folder
        tk.Label(root, text="Root Folder:", bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=10, pady=5)
        tk.Entry(root, textvariable=self.root_folder, bg=THEME["input_bg"], fg=THEME["input_fg"], width=60).pack(padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_root, bg=THEME["button_bg"], fg=THEME["button_fg"]).pack(padx=10, pady=5)

        # Division / State / Office (same single-row layout)
        row = tk.Frame(root, bg=THEME["bg"])
        row.pack(padx=10, pady=5, fill="x")
        tk.Label(row, text="Division:", bg=THEME["bg"], fg=THEME["fg"]).pack(side="left", padx=5)
        self.division_menu = tk.OptionMenu(row, self.division, ())
        self._style_optionmenu(self.division_menu)
        self.division_menu.pack(side="left", padx=5)

        tk.Label(row, text="State:", bg=THEME["bg"], fg=THEME["fg"]).pack(side="left", padx=5)
        self.state_menu = tk.OptionMenu(row, self.state, ())
        self._style_optionmenu(self.state_menu)
        self.state_menu.pack(side="left", padx=5)

        tk.Label(row, text="Office:", bg=THEME["bg"], fg=THEME["fg"]).pack(side="left", padx=5)
        self.office_menu = tk.OptionMenu(row, self.office, ())
        self._style_optionmenu(self.office_menu)
        self.office_menu.pack(side="left", padx=5)

        # Project INI
        tk.Label(root, text="Project INI Path:", bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=10, pady=5)
        tk.Entry(root, textvariable=self.project_ini, bg=THEME["input_bg"], fg=THEME["input_fg"], width=60).pack(padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_project_ini, bg=THEME["button_bg"], fg=THEME["button_fg"]).pack(padx=10, pady=5)

        # Project Names
        tk.Label(root, text="Project Names (one per line):", bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=10, pady=5)
        self.project_text = scrolledtext.ScrolledText(root, bg=THEME["input_bg"], fg=THEME["input_fg"], height=5, width=60)
        self.project_text.insert(tk.END, self.project_names.get())
        self.project_text.pack(padx=10, pady=5, fill="both")

        # Overwrite Mode
        tk.Label(root, text="Overwrite Mode:", bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=10, pady=5)
        tk.OptionMenu(root, self.overwrite_mode, "Overwrite", "Only New", "Cancel").pack(padx=10, pady=5)

        # Run Button
        tk.Button(root, text="Generate Projects", command=self.run, bg=THEME["highlight"], fg=THEME["button_fg"]).pack(padx=10, pady=10)

        # Log
        self.log_box = scrolledtext.ScrolledText(root, bg=THEME["input_bg"], fg=THEME["input_fg"], height=15, width=80)
        self.log_box.pack(padx=10, pady=10, fill="both", expand=True)

        # Tag colors
        for tag, color in {
            THEME["fg"]: THEME["fg"],
            THEME["success"]: THEME["success"],
            THEME["warning"]: THEME["warning"],
            THEME["error"]: THEME["error"],
            THEME["skip"]: THEME["skip"],
            THEME["session"]: THEME["session"],
            THEME["highlight"]: THEME["highlight"],
        }.items():
            self.log_box.tag_config(tag, foreground=color)

        # Wire up dependent dropdowns via variable traces (so OptionMenus work reliably)
        self.division.trace_add("write", self._on_division_change)
        self.state.trace_add("write", self._on_state_change)

        # Populate dropdowns from national INI
        self._populate_divisions()

    # ---- OptionMenu styling (dark-ish) ----
    def _style_optionmenu(self, om):
        om.configure(bg=THEME["button_bg"], fg=THEME["button_fg"], activebackground=THEME["button_bg"], activeforeground=THEME["button_fg"], highlightthickness=0)
        menu = om["menu"]
        menu.configure(bg=THEME["input_bg"], fg=THEME["input_fg"], activebackground=THEME["highlight"], activeforeground="#ffffff", tearoff=0)

    def _set_menu_options(self, om_widget, var, values, default_first=True):
        menu = om_widget["menu"]
        menu.delete(0, "end")
        for val in values:
            menu.add_command(label=val, command=lambda v=val: var.set(v))
        if default_first:
            var.set(values[0] if values else "")

    def _populate_divisions(self):
        divisions = sorted(self.divisions.keys())
        self._set_menu_options(self.division_menu, self.division, divisions)
        # trigger cascade to states/offices & defaults
        if divisions:
            self.division.set(divisions[0])

    def _on_division_change(self, *args):
        div = self.division.get()
        # Update Project INI default if mapped
        if div in DIVISION_TEMPLATE_MAP:
            self.project_ini.set(DIVISION_TEMPLATE_MAP[div])

        # Auto-adjust root path only if it was previously untouched or last auto-set
        default_root = DEFAULT_ROOT
        if self.root_folder.get() in (self._last_auto_root, "", default_root):
            # Keep a division-root style the same as master tool layout:
            # user still picks the office and we build under DEFAULT_ROOT/<division>/_STATE/_OFFICE/<division_subpath>
            self._last_auto_root = DEFAULT_ROOT
            self.root_folder.set(DEFAULT_ROOT)

        # Populate states
        states = sorted(self.divisions.get(div, {}).keys())
        self._set_menu_options(self.state_menu, self.state, states)

    def _on_state_change(self, *args):
        div = self.division.get()
        state = self.state.get()
        offices = [name for (name, abbr) in self.divisions.get(div, {}).get(state, [])]
        self._set_menu_options(self.office_menu, self.office, offices)

    def browse_root(self):
        folder = filedialog.askdirectory()
        if folder:
            self.root_folder.set(folder)
            self._last_auto_root = folder  # user override

    def browse_project_ini(self):
        file = filedialog.askopenfilename(filetypes=[("INI files", "*.ini")])
        if file:
            self.project_ini.set(file)

    def log(self, msg, color=THEME["fg"]):
        self.log_box.insert(tk.END, msg + "\n", color)
        self.log_box.see(tk.END)

    def _current_office_abbr(self):
        """Lookup the abbr for selected office display name."""
        div = self.division.get()
        state = self.state.get()
        office_display = self.office.get()
        for name, abbr in self.divisions.get(div, {}).get(state, []):
            if name == office_display:
                return abbr
        return None

    def run(self):
        root_folder = self.root_folder.get().strip()
        div = self.division.get().strip()
        state = self.state.get().strip()
        office_display = self.office.get().strip()
        ini_path = self.project_ini.get().strip()

        if not (root_folder and div and state and office_display and ini_path):
            messagebox.showerror("Error", "Please select Root, Division, State, Office, and Project INI.")
            return

        office_abbr = self._current_office_abbr()
        if not office_abbr:
            messagebox.showerror("Error", "Could not resolve office abbreviation.")
            return

        # Start log
        start = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log(f"=== Project generation started at {start} ===", THEME["session"])
        self.log(f"Division: {div} | State: {state} | Office: {office_display} ({office_abbr})", THEME["session"])

        try:
            # Determine office root and default per-division subpath
            office_root = os.path.join(root_folder, div, f"_{state}", f"_{office_abbr}")
            default_subpath = DIVISION_PROJECT_SUBPATH.get(div, os.path.join("_ArchitectureProjects", "_ActiveProjects"))
            projects_parent = ensure_relative_path(office_root, default_subpath, self.log, self.overwrite_mode.get())
            if projects_parent is None:
                self.log("[X] Aborted while ensuring default project path.", THEME["error"])
                return

            # Parse projects from text box
            projects = [p.strip() for p in self.project_text.get("1.0", tk.END).splitlines() if p.strip()]
            if not projects:
                self.log("[X] No project names provided.", THEME["error"])
                return

            # Build each project
            for proj in projects:
                proj_root = create_folder(projects_parent, proj, self.log, self.overwrite_mode.get())
                if proj_root is None:
                    self.log(f"[X] Aborted on project '{proj}'.", THEME["error"])
                    return
                build_project_from_template(proj_root, ini_path, self.overwrite_mode.get(), self.log)

            # Finish log
            finish = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.log(f"=== Project generation finished at {finish} ===", THEME["session"])
            messagebox.showinfo("Success", "Projects generated successfully!")

        except Exception as e:
            self.log(f"[X] Project generation failed: {e}", THEME["error"])
            messagebox.showerror("Error", str(e))

# =========================================
# RUN
# =========================================
if __name__ == "__main__":
    root = tk.Tk()
    app = ProjectGenerator(root)
    root.mainloop()
