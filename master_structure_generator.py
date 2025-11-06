import os
import configparser
import datetime
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext

# ================================
# Default Paths
# ================================
DEFAULT_NATIONAL_FILE = "_ini/national_structure.ini"
DEFAULT_OFFICE_FILE = "_ini/office_structure.ini"
DEFAULT_ASSETLIBRARY_FILE = "_ini/folder_structure_asset_library.ini"
DEFAULT_ROOT = "D:/github/_TEST_ROOT"

# ================================
# Theme
# ================================
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
    "main_log": "#66ccff",
    "asset_log": "#c175ff",
}

# ================================
# Helper Functions
# ================================
def load_ini(file_path):
    # Get the folder where this script lives
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # If file_path is not absolute, make it relative to script
    if not os.path.isabs(file_path):
        file_path = os.path.join(base_dir, file_path)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"INI file not found: {file_path}")

    config = configparser.ConfigParser()
    config.read(file_path, encoding="utf-8")
    return config


def create_folder(base_path, folder_name, log_func, overwrite_mode="Only New", is_link=False, link_target=None):
    folder_path = os.path.join(base_path, folder_name)

    if os.path.exists(folder_path):
        if overwrite_mode == "Overwrite":
            log_func(f"[!] Overwriting folder: {folder_path}", THEME["warning"])
        elif overwrite_mode == "Only New":
            log_func(f"[-] Skipped existing folder: {folder_path}", THEME["skip"])
            return
        elif overwrite_mode == "Cancel":
            log_func(f"[X] Cancelled at existing folder: {folder_path}", THEME["error"])
            return

    try:
        os.makedirs(folder_path, exist_ok=True)
        if is_link and link_target:
            log_func(f"[L] Link folder created: {folder_path} → {link_target}", THEME["highlight"])
        else:
            log_func(f"[+] Folder created: {folder_path}", THEME["success"])
    except Exception as e:
        log_func(f"[X] Failed to create folder: {folder_path}. Error: {e}", THEME["error"])


# ================================
# Asset Library Structure
# ================================
def build_asset_library(root_folder, asset_ini, overwrite_mode, log_func):
    """Generate folders from asset library INI."""
    assetLibrary_path = os.path.join(root_folder, "_AssetLibrary")
    try:
        asset_config = load_ini(asset_ini)
        for section in asset_config.sections():
            section_path = os.path.join(assetLibrary_path, section)
            create_folder(assetLibrary_path, section, log_func, overwrite_mode)
            for key, value in asset_config[section].items():
                key_name = key.strip()
                key_path = os.path.join(section_path, key_name)
                create_folder(section_path, key_name, log_func, overwrite_mode)
                # handle nested comma-separated children
                children = [c.strip() for c in value.split(",") if c.strip()]
                for child in children:
                    create_folder(key_path, child, log_func, overwrite_mode)
    except Exception as e:
        log_func(f"[X] Asset library generation failed: {e}", THEME["error"])


# ================================
# Office Structure
# ================================
def build_office_structure(office_path, office_ini_file, overwrite_mode, log_func):
    """Recursively build folders from office_structure.ini including subfolders."""
    office_config = load_ini(office_ini_file)

    for header in office_config.sections():
        # If header already starts with "_", keep it. Otherwise, add one.
        header_name = header if header.startswith("_") else f"_{header}"
        header_path = os.path.join(office_path, header_name)
        create_folder(office_path, header_name, log_func, overwrite_mode)

        for subheader, subheaders in office_config[header].items():
            # Same underscore logic for subheaders
            subheader_name = subheader.strip()
            if not subheader_name.startswith("_"):
                subheader_name = f"_{subheader_name}"
            subheader_path = os.path.join(header_path, subheader_name)
            create_folder(header_path, subheader_name, log_func, overwrite_mode)

            for subsubheader in subheaders.split(","):
                subsubheader = subsubheader.strip().upper()
                if not subsubheader:
                    continue

                # Extract abbreviation from () if exists
                if "(" in subsubheader and ")" in subsubheader:
                    name, abbr = subsubheader.rsplit("(", 1)
                    subsubheader_name = name.strip()
                    subsubheader_abbr = abbr.strip(") ").upper()
                else:
                    subsubheader_name = subsubheader.strip()
                    subsubheader_abbr = subsubheader_name[:3].upper()

                # Same underscore logic for sub-subfolders
                subsubheader_folder = (
                    subsubheader_abbr
                    if subsubheader_abbr.startswith("_")
                    else f"_{subsubheader_abbr}"
                )
                subsubheader_path = os.path.join(subheader_path, subsubheader_folder)
                create_folder(subheader_path, subsubheader_folder, log_func, overwrite_mode)


# ================================
# Master Structure
# ================================
def build_master_structure(root_folder, master_ini, office_ini, overwrite_mode, log_func):
    master_config = load_ini(master_ini)

    for nation in master_config.sections():
        nation_path = os.path.join(root_folder, nation)
        create_folder(root_folder, nation, log_func, overwrite_mode)

        for state, offices in master_config[nation].items():
            state_name = f"_{state.strip()}"  # add underscore to state folders
            state_path = os.path.join(nation_path, state_name)
            create_folder(nation_path, state_name, log_func, overwrite_mode)

            for office in offices.split(","):
                office = office.strip().upper()
                if not office:
                    continue
                # Extract abbreviation from () if exists
                if "(" in office and ")" in office:
                    name, abbr = office.rsplit("(", 1)
                    office_name = name.strip()
                    office_abbr = abbr.strip(") ").upper()
                else:
                    office_name = office
                    office_abbr = office_name[:3].upper()
                office_folder = f"_{office_abbr}"
                office_path = os.path.join(state_path, office_folder)
                create_folder(state_path, office_folder, log_func, overwrite_mode)

                # Build office structure inside this office folder
                build_office_structure(office_path, office_ini, overwrite_mode, log_func)


# ================================
# GUI
# ================================
class MasterStructureCreator:
    def __init__(self, root):
        self.root = root
        self.root.title("Master Structure Creator")
        self.root.configure(bg=THEME["bg"])

        # -------------------------
        # Adjustable sizes (easy to tweak)
        # -------------------------
        self.WINDOW_WIDTH = 1200
        self.WINDOW_HEIGHT = 800
        self.LEFT_WIDTH = 400
        self.RIGHT_WIDTH = 400
        self.TOP_HEIGHT = 400
        self.LOG_HEIGHT = 400

        # Set initial window size
        self.root.geometry(f"{self.WINDOW_WIDTH}x{self.WINDOW_HEIGHT}")

        # Variables
        self.root_folder = tk.StringVar(root, value=DEFAULT_ROOT)
        self.master_ini = tk.StringVar(root, value=DEFAULT_NATIONAL_FILE)
        self.office_ini = tk.StringVar(root, value=DEFAULT_OFFICE_FILE)
        self.asset_ini = tk.StringVar(root, value=DEFAULT_ASSETLIBRARY_FILE)
        self.overwrite_mode = tk.StringVar(root, value="Only New")

        # ===== Main vertical PanedWindow (Top: left/right, Bottom: log) =====
        self.main_paned = tk.PanedWindow(root, orient="vertical", sashrelief="raised", bg=THEME["bg"])
        self.main_paned.pack(fill="both", expand=True)

        # ===== Top horizontal PanedWindow =====
        self.top_paned = tk.PanedWindow(self.main_paned, orient="horizontal", sashrelief="raised", bg=THEME["bg"])
        self.main_paned.add(self.top_paned)

        # Left + Right frames (fixed sizes)
        self.left_frame = tk.Frame(self.top_paned, width=self.LEFT_WIDTH, height=self.TOP_HEIGHT, bg=THEME["bg"])
        self.right_frame = tk.Frame(self.top_paned, width=self.RIGHT_WIDTH, height=self.TOP_HEIGHT, bg=THEME["bg"])
        self.top_paned.add(self.left_frame)
        self.top_paned.add(self.right_frame)

        # Bottom log frame
        self.log_frame = tk.Frame(self.main_paned, width=self.WINDOW_WIDTH, height=self.LOG_HEIGHT, bg=THEME["bg"])
        self.main_paned.add(self.log_frame)

        # Build panels
        self._build_left_panel()
        self._build_right_panel()
        self._build_log_panel()

        self.refresh_preview()

    # -------------------------
    # Helper: labeled entry with browse
    # -------------------------
    def _labeled_entry(self, parent, label, textvar, browse_cmd):
        frame = tk.Frame(parent, bg=THEME["bg"])
        frame.pack(fill="x", padx=10, pady=5)
        tk.Label(frame, text=label, bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w")
        entry = tk.Entry(frame, textvariable=textvar, bg=THEME["input_bg"], fg=THEME["input_fg"], width=80) # IDK WHY THIS IS HERE
        entry.pack(side="left", expand=True, fill="x")
        tk.Button(frame, text="Browse", command=browse_cmd, bg=THEME["button_bg"], fg=THEME["button_fg"]).pack(side="right", padx=5)

    # -------------------------
    # Build Left Panel
    # -------------------------
    def _build_left_panel(self):
        # Use a Frame inside left_frame for padding & scrolling if needed
        left_inner = tk.Frame(self.left_frame, bg=THEME["bg"])
        left_inner.pack(fill="both", expand=True, padx=5, pady=5)

        # Helper for labeled entries
        self._labeled_entry(left_inner, "Root Folder:", self.root_folder, self.browse_root)
        self._labeled_entry(left_inner, "Master INI Path:", self.master_ini, self.browse_master_ini)
        self._labeled_entry(left_inner, "Office INI Path:", self.office_ini, self.browse_office_ini)
        self._labeled_entry(left_inner, "Asset Library INI Path:", self.asset_ini, self.browse_asset_ini)

        # Overwrite dropdown
        tk.Label(left_inner, text="Overwrite Mode:", bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=5, pady=5)
        tk.OptionMenu(left_inner, self.overwrite_mode, "Overwrite", "Only New", "Cancel").pack(padx=5, pady=5, fill="x")

        # Create Structure button
        tk.Button(left_inner, text="Create Structure", command=self.run,
                  bg=THEME["highlight"], fg=THEME["button_fg"]).pack(padx=5, pady=10, fill="x")


    # -------------------------
    # Build Right Panel
    # -------------------------
    def _build_right_panel(self):
        tk.Label(self.right_frame, text="Hierarchy Preview",
                 bg=THEME["bg"], fg=THEME["fg"]).pack(anchor="w", padx=2, pady=2)

        # Treeview style
        style = ttk.Style()
        style.configure("Treeview",
                        background="#1e1e1e", fieldbackground="#1e1e1e",
                        foreground="#ffffff", borderwidth=0)
        style.configure("Treeview.Heading",
                        background="#333333", foreground="#ffffff", relief="flat")
        style.map("Treeview",
                  background=[("selected", "#444444")],
                  foreground=[("selected", "#ffffff")])

        # Treeview with vertical scrollbar
        tree_frame = tk.Frame(self.right_frame)
        tree_frame.pack(fill="both", expand=True, padx=5, pady=5)

        self.tree = ttk.Treeview(tree_frame, show="tree")
        tree_scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)

        self.tree.pack(side="left", fill="both", expand=True)
        tree_scroll.pack(side="right", fill="y")

        # Auto-refresh preview
        for var in (self.master_ini, self.office_ini, self.asset_ini):
            var.trace("w", lambda *args: self.refresh_preview())


    # -------------------------
    # Build Log Panel
    # -------------------------
    def _build_log_panel(self):     
        # Log scrolled text
        self.log_box = scrolledtext.ScrolledText(self.log_frame, bg=THEME["input_bg"], fg=THEME["input_fg"])
        self.log_box.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Clear Log button
        tk.Button(self.log_frame, text="Clear Log", command=self.clear_log,
                  bg=THEME["button_bg"], fg=THEME["button_fg"]).pack(padx=5, pady=5)


    # ================================
    # RightSide Functions
    # ================================
    def refresh_preview(self):
        """Preview folder structure from INI files (not filesystem)."""
        self.tree.delete(*self.tree.get_children())

        root_folder = self.root_folder.get()
        if not root_folder:
            return

        root_node = self.tree.insert("", "end", text=os.path.basename(root_folder), open=True)

        try:
            master_config = load_ini(self.master_ini.get())
            office_config = load_ini(self.office_ini.get())
            asset_config  = load_ini(self.asset_ini.get())

            # build structure preview
            self.preview_master(root_node, master_config, office_config)
            self.preview_assets(root_node, asset_config)

            self.expand_all(root_node)
        except Exception as e:
            self.log(f"[X] Failed to build preview: {e}", THEME["error"])

    def insert_node(self, parent, path):
        """Insert a folder and recurse into subfolders"""
        node = self.tree.insert(parent, "end", text=os.path.basename(path) or path, open=True)
        if os.path.isdir(path):
            try:
                for entry in sorted(os.listdir(path)):
                    full_path = os.path.join(path, entry)
                    if os.path.isdir(full_path):
                        self.insert_node(node, full_path)
            except PermissionError:
                pass
        return node

    def expand_all(self, parent):
        """Expand all children recursively"""
        self.tree.item(parent, open=True)
        for child in self.tree.get_children(parent):
            self.expand_all(child)
            
    def preview_master(self, parent, master_config, office_config):
        for nation in master_config.sections():
            nation_node = self.tree.insert(parent, "end", text=nation, open=True)
            for state, offices in master_config[nation].items():
                state_node = self.tree.insert(nation_node, "end", text=f"_{state.strip()}", open=True)
                for office in offices.split(","):
                    office = office.strip()
                    if not office: continue
                    if "(" in office and ")" in office:
                        name, abbr = office.rsplit("(", 1)
                        abbr = abbr.strip(") ").upper()
                    else:
                        abbr = office[:3].upper()
                    office_node = self.tree.insert(state_node, "end", text=f"_{abbr}", open=True)
                    # insert office structure from office_config
                    for header in office_config.sections():
                        header_name = header if header.startswith("_") else f"_{header}"
                        h_node = self.tree.insert(office_node, "end", text=header_name, open=True)
                        for subheader, subheaders in office_config[header].items():
                            sh_name = subheader if subheader.startswith("_") else f"_{subheader}"
                            sh_node = self.tree.insert(h_node, "end", text=sh_name, open=True)
                            for subsubheader in subheaders.split(","):
                                subsubheader = subsubheader.strip()
                                if not subsubheader: continue
                                if "(" in subsubheader and ")" in subsubheader:
                                    _, abbr = subsubheader.rsplit("(", 1)
                                    abbr = abbr.strip(") ").upper()
                                else:
                                    abbr = subsubheader[:3].upper()
                                self.tree.insert(sh_node, "end", text=f"_{abbr}", open=True)

    def preview_assets(self, parent, asset_config):
        asset_node = self.tree.insert(parent, "end", text="_AssetLibrary", open=True)
        for section in asset_config.sections():
            sec_node = self.tree.insert(asset_node, "end", text=section, open=True)
            for key, value in asset_config[section].items():
                key_node = self.tree.insert(sec_node, "end", text=key, open=True)
                for child in [c.strip() for c in value.split(",") if c.strip()]:
                    self.tree.insert(key_node, "end", text=child, open=True)



    # ================================
    # Left Side Functions
    # ================================
    def browse_root(self):
        folder = filedialog.askdirectory()
        if folder:
            self.root_folder.set(folder)

    def browse_master_ini(self):
        file = filedialog.askopenfilename(filetypes=[("INI files", "*.ini")])
        if file:
            self.master_ini.set(file)

    def browse_office_ini(self):
        file = filedialog.askopenfilename(filetypes=[("INI files", "*.ini")])
        if file:
            self.office_ini.set(file)
 
    def browse_asset_ini(self):
        file = filedialog.askopenfilename(filetypes=[("INI files", "*.ini")])
        if file:
            self.asset_ini.set(file)


    def log(self, message, color=THEME["fg"]):
        self.log_box.insert(tk.END, message + "\n", color)
        self.log_box.tag_config(color, foreground=color)
        self.log_box.see(tk.END)
    
    def clear_log(self):
        self.log_box.delete("1.0", tk.END)

    def run(self):
        root_folder = self.root_folder.get()
        if not root_folder:
            messagebox.showerror("Error", "Please select a root folder.")
            return

        # Master structure
        start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log(f"=== Generation started at {start_time} ===", color=THEME["main_log"])
        
        try:
            build_master_structure(
                root_folder,
                self.master_ini.get(),
                self.office_ini.get(),
                self.overwrite_mode.get(),
                self.log
            )
            finish_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.log(f"=== Generation finished at {finish_time} ===", color=THEME["main_log"])
        except Exception as e:
            self.log(f"[X] Master structure generation failed: {e}", color=THEME["error"])
            messagebox.showerror("Error", str(e))
            return  # stop if master structure fails

        # Asset library
        start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log(f"=== Asset Generation started at {start_time} ===", color=THEME["asset_log"])
        
        try:
            build_asset_library(
                root_folder,
                self.asset_ini.get(),
                self.overwrite_mode.get(),
                self.log
            )
            finish_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.log(f"=== Asset Generation finished at {finish_time} ===", color=THEME["asset_log"])
            messagebox.showinfo("Success", "Master structure and asset library created successfully!")
        except Exception as e:
            self.log(f"[X] Asset generation failed: {e}", color=THEME["error"])
            messagebox.showerror("Error", str(e))


# ================================
# Run App
# ================================
if __name__ == "__main__":
    root = tk.Tk()
    app = MasterStructureCreator(root)
    root.mainloop()
