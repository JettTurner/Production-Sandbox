import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ==========================================
# PBK Struct Parser
# ==========================================
class PBKStructParser:
    """
    Parses a PBK .pbkstruct file into:
    - root_structure: list of dict nodes representing folders
    - templates: dict mapping template names to nested folder trees
    """

    def __init__(self, filepath):
        self.filepath = filepath
        self.templates = {}  # name -> list of nested dict nodes
        self.root_structure = []

    def parse(self):
        with open(self.filepath, "r") as f:
            lines = [line.rstrip("\n") for line in f if line.strip() and not line.strip().startswith("#")]

        current_template = None
        root_stack = []

        for line in lines:
            stripped = line.lstrip("\t")
            indent = len(line) - len(stripped)
            name = stripped

            # --- Handle template definition ---
            if line.startswith("@template"):
                current_template = line.split()[1]
                self.templates[current_template] = []
                continue

            # --- Handle root structure ---
            elif line.startswith("@root"):
                self.root_structure = []
                root_stack = [(self.root_structure, -1)]  # dummy root node
                continue

            if current_template:
                # Append template line (indent, name) for later parsing
                self.templates[current_template].append((indent, name))
            else:
                # Build root structure tree
                while root_stack and indent <= root_stack[-1][1]:
                    root_stack.pop()
                if not root_stack:
                    # safety fallback
                    root_stack = [(self.root_structure, -1)]
                parent_list = root_stack[-1][0]
                new_item = {"name": name.strip(), "children": []}  # strip whitespace
                parent_list.append(new_item)
                root_stack.append((new_item["children"], indent))

        # --- Convert all templates into nested trees ---
        for key, lines in self.templates.items():
            self.templates[key] = self.parse_template(lines)

    # ----------------------------------
    def parse_template(self, lines):
        """
        Convert a template (list of (indent, name)) into a nested tree
        """
        stack = []
        root = []

        for indent, name in lines:
            node = {"name": name.strip(), "children": []}  # strip whitespace
            while stack and indent <= stack[-1][1]:
                stack.pop()
            if stack:
                stack[-1][0].append(node)
            else:
                root.append(node)
            stack.append((node["children"], indent))
        return root

# ==========================================
# Recursive @insert Resolver
# ==========================================
def resolve_node(node, templates):
    """
    Recursively resolves a node dictionary.
    Replaces @insert <template> with the template tree.
    """
    resolved = []
    name = node["name"]
    children = node.get("children", [])

    if name.startswith("@insert"):
        key = name.split()[1]
        if key in templates:
            for tn in templates[key]:
                resolved.extend(resolve_node(tn, templates))
    else:
        resolved_children = []
        for child in children:
            resolved_children.extend(resolve_node(child, templates))
        resolved.append({"name": name, "children": resolved_children})

    return resolved

def resolve_tree(tree, templates):
    """
    Resolve a list of nodes (root structure)
    """
    full_tree = []
    for node in tree:
        full_tree.extend(resolve_node(node, templates))
    return full_tree

# ==========================================
# Helper: Convert tree to text
# ==========================================
def tree_to_text(tree, indent=0):
    """
    Converts nested tree to text lines with indentation
    """
    lines = []
    for node in tree:
        lines.append("    " * indent + node["name"])
        if node["children"]:
            lines.extend(tree_to_text(node["children"], indent+1))
    return lines

# ==========================================
# GUI Application
# ==========================================
class FolderGenApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PBK VizLab Folder Generator")
        self.parser = None
        self.tree_data = []

        # --- GUI Widgets ---
        self.file_label = tk.Label(root, text="No template loaded")
        self.file_label.pack(pady=5)
        tk.Button(root, text="Load Template", command=self.load_template).pack(pady=5)

        self.tree_frame = tk.Frame(root)
        self.tree_frame.pack(padx=10, pady=10, fill="both", expand=True)
        self.tree = ttk.Treeview(self.tree_frame)
        self.tree.pack(fill="both", expand=True)

        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=5)
        tk.Button(btn_frame, text="Generate Folders", command=self.generate_folders).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)

    # --------------------------------------
    def load_template(self):
        """
        Load .pbkstruct file, parse, resolve inserts, and populate treeview
        """
        file_path = filedialog.askopenfilename(filetypes=[("PBK Struct Files","*.pbkstruct")])
        if not file_path:
            return
        self.parser = PBKStructParser(file_path)
        self.parser.parse()
        self.tree_data = resolve_tree(self.parser.root_structure, self.parser.templates)
        self.file_label.config(text=f"Loaded: {os.path.basename(file_path)}")
        self.populate_tree()

    def populate_tree(self):
        """
        Populate the Tkinter treeview with the fully resolved tree
        """
        self.tree.delete(*self.tree.get_children())
        def insert_items(parent, children):
            for child in children:
                node = self.tree.insert(parent, "end", text=child["name"])
                if child["children"]:
                    insert_items(node, child["children"])
        insert_items("", self.tree_data)

    # --------------------------------------
    def generate_folders(self):
        """
        Generate folders on disk based on resolved tree
        """
        target = filedialog.askdirectory()
        if not target:
            return

        def create_items(base, children):
            for child in children:
                # Build full path safely
                path = os.path.join(base, child["name"])
                os.makedirs(path, exist_ok=True)
                create_items(path, child["children"])

        try:
            create_items(target, self.tree_data)
            messagebox.showinfo("Done", f"Folders generated at {target}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to generate folders:\n{e}")

    # --------------------------------------
    def copy_structure(self):
        """
        Copy the fully resolved folder structure as text to clipboard
        """
        lines = tree_to_text(self.tree_data)
        text = "\n".join(lines)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "Proposed folder structure copied to clipboard.")

# ==========================================
# Run Application
# ==========================================
if __name__ == "__main__":
    root = tk.Tk()
    app = FolderGenApp(root)
    root.geometry("900x700")
    root.mainloop()
