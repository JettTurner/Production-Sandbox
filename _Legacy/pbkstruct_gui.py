import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ==========================================
# PBK Struct Parser
# ==========================================
class PBKStructParser:
    """
    Parses a PBK .pbkstruct file into:
    - root_structure: list of dict nodes representing folders/files
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
                    root_stack = [(self.root_structure, -1)]
                parent_list = root_stack[-1][0]
                new_item = {"name": name.strip(), "children": []}
                parent_list.append(new_item)
                root_stack.append((new_item["children"], indent))

        # --- Convert all templates into nested trees ---
        for key, lines in self.templates.items():
            self.templates[key] = self.parse_template(lines)

    def parse_template(self, lines):
        """
        Convert a template (list of (indent, name)) into a nested tree
        """
        stack = []
        root = []
        for indent, name in lines:
            node = {"name": name.strip(), "children": []}
            while stack and indent <= stack[-1][1]:
                stack.pop()
            if stack:
                stack[-1][0].append(node)
            else:
                root.append(node)
            stack.append((node["children"], indent))
        return root

# ==========================================
# Recursive @insert Resolver with circular detection
# ==========================================
def resolve_node(node, templates, visited=None):
    """
    Recursively resolves a node dictionary.
    Replaces @insert <template> with the template tree.
    Detects direct mutual recursion.
    """
    if visited is None:
        visited = set()

    resolved = []
    name = node["name"]
    children = node.get("children", [])

    if name.startswith("@insert"):
        key = name.split()[1]
        if key in visited:
            raise ValueError(f"Circular @insert detected: {key}")
        if key not in templates:
            raise ValueError(f"Template not found: {key}")
        visited.add(key)
        for tn in templates[key]:
            resolved.extend(resolve_node(tn, templates, visited.copy()))
    else:
        resolved_children = []
        for child in children:
            resolved_children.extend(resolve_node(child, templates, visited.copy()))
        resolved.append({"name": name, "children": resolved_children})

    return resolved

def resolve_tree(tree, templates):
    full_tree = []
    for node in tree:
        full_tree.extend(resolve_node(node, templates))
    return full_tree

# ==========================================
# Helper: Convert tree to text
# ==========================================
def tree_to_text(tree, indent=0):
    lines = []
    for node in tree:
        lines.append("\t" * indent + node["name"])
        if node["children"]:
            lines.extend(tree_to_text(node["children"], indent+1))
    return lines

# ==========================================
# Helper: Compute max depth for gradient
# ==========================================
def compute_max_depth(tree):
    def depth(node):
        if not node["children"]:
            return 0
        return 1 + max(depth(c) for c in node["children"])
    return max(depth(n) for n in tree)

def hex_color(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"

def gradient_color(start_color, end_color, t):
    sr, sg, sb = start_color
    er, eg, eb = end_color
    r = int(sr*(1-t) + er*t)
    g = int(sg*(1-t) + eg*t)
    b = int(sb*(1-t) + eb*t)
    return hex_color(r, g, b)

# ==========================================
# GUI Application
# ==========================================
class FolderGenApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PBK VizLab Folder & File Generator")
        self.parser = None
        self.tree_data = []

        # --- GUI Widgets ---
        self.file_label = tk.Label(root, text="No template loaded")
        self.file_label.pack(pady=5)

        # Top buttons
        btn_frame1 = tk.Frame(root)
        btn_frame1.pack(pady=5)
        tk.Button(btn_frame1, text="Load Template", command=self.load_template).pack(side="left", padx=5)
        tk.Button(btn_frame1, text="Expand All", command=self.expand_all).pack(side="left", padx=5)
        tk.Button(btn_frame1, text="Collapse All", command=self.collapse_all).pack(side="left", padx=5)

        # Frame for treeview + scrollbars
        self.tree_frame = tk.Frame(root)
        self.tree_frame.pack(padx=10, pady=10, fill="both", expand=True)
        self.tree = ttk.Treeview(self.tree_frame)
        self.tree.pack(side="left", fill="both", expand=True)

        # Scrollbars
        self.vsb = tk.Scrollbar(self.tree_frame, orient="vertical", command=self.tree.yview)
        self.vsb.pack(side="right", fill="y")
        self.tree.configure(yscrollcommand=self.vsb.set)

        # Bottom buttons
        btn_frame2 = tk.Frame(root)
        btn_frame2.pack(pady=5)
        tk.Button(btn_frame2, text="Generate Folders & Files", command=self.generate_folders).pack(side="left", padx=5)
        tk.Button(btn_frame2, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)

    # --------------------------------------
    def load_template(self):
        file_path = filedialog.askopenfilename(filetypes=[("PBK Struct Files", "*.pbkstruct")])
        if not file_path:
            return
        try:
            self.parser = PBKStructParser(file_path)
            self.parser.parse()
            self.tree_data = resolve_tree(self.parser.root_structure, self.parser.templates)
            self.file_label.config(text=f"Loaded: {os.path.basename(file_path)}")
            self.populate_tree()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load template:\n{e}")

    # --------------------------------------
    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())
        max_depth = compute_max_depth(self.tree_data)
        start_color = (0, 0, 255)   # Blue for root
        end_color = (0, 180, 0)     # Green for leaf

        def insert_items(parent, children, depth=0):
            for child in children:
                t = depth / max_depth if max_depth else 0
                color = gradient_color(start_color, end_color, t)
                tag_name = f"depth_{depth}"
                self.tree.tag_configure(tag_name, foreground=color)
                node_id = self.tree.insert(parent, "end", text=child["name"], tags=(tag_name,))
                insert_items(node_id, child["children"], depth+1)
        insert_items("", self.tree_data)

    # --------------------------------------
    def generate_folders(self):
        target = filedialog.askdirectory()
        if not target:
            return

        def create_items(base, children):
            for child in children:
                path = os.path.join(base, child["name"])
                if "." in child["name"]:  # file creation
                    with open(path, "w", encoding="utf-8"):
                        pass
                else:  # folder
                    os.makedirs(path, exist_ok=True)
                create_items(path, child["children"])

        try:
            create_items(target, self.tree_data)
            messagebox.showinfo("Done", f"Folders & files generated at {target}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to generate folders/files:\n{e}")

    # --------------------------------------
    def copy_structure(self):
        lines = tree_to_text(self.tree_data)
        text = "\n".join(lines)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "Proposed folder structure copied to clipboard.")

    # --------------------------------------
    def expand_all(self):
        for item in self.tree.get_children():
            self._recurse_expand(item)

    def _recurse_expand(self, item):
        self.tree.item(item, open=True)
        for child in self.tree.get_children(item):
            self._recurse_expand(child)

    def collapse_all(self):
        for item in self.tree.get_children():
            self._recurse_collapse(item)

    def _recurse_collapse(self, item):
        self.tree.item(item, open=False)
        for child in self.tree.get_children(item):
            self._recurse_collapse(child)

# ==========================================
# Run Application
# ==========================================
if __name__ == "__main__":
    root = tk.Tk()
    app = FolderGenApp(root)
    root.geometry("1000x700")
    root.mainloop()
