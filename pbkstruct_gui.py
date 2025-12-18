import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ----------------------------
# PBK Struct Parser
# ----------------------------
class PBKStructParser:
    def __init__(self, filepath):
        self.filepath = filepath
        self.templates = {}  # name -> list of (indent, line)
        self.root_structure = []

    def parse(self):
        with open(self.filepath, "r") as f:
            lines = [line.rstrip("\n") for line in f if line.strip() and not line.strip().startswith("#")]

        current_template = None
        stack = []

        for line in lines:
            stripped = line.lstrip("\t")
            indent = len(line) - len(stripped)
            name = stripped

            if line.startswith("@template"):
                current_template = line.split()[1]
                self.templates[current_template] = []
                continue
            elif line.startswith("@root"):
                # create a dummy root node to hold all root-level folders
                self.root_structure = []
                stack = [(self.root_structure, -1)]  # root has indent -1
                continue
            if current_template:
                self.templates[current_template].append((indent, name))
            else:
                # Build root structure
                while stack and indent <= stack[-1][1]:
                    stack.pop()
                if not stack:
                    # if stack is empty, push root_structure back
                    stack = [(self.root_structure, -1)]
                parent_list = stack[-1][0]
                new_item = {"name": name, "children": []}
                parent_list.append(new_item)
                stack.append((new_item["children"], indent))
        
        for key, lines in self.templates.items():
            self.templates[key] = parse_template(lines)


# ----------------------------
# Resolver for @insert
# ----------------------------
def parse_template(lines):
    """
    lines: list of (indent, name)
    returns: list of nested dict nodes: {"name": str, "children": list}
    """
    stack = []
    root = []
    
    for indent, name in lines:
        node = {"name": name, "children": []}
        # Pop stack until we find parent
        while stack and indent <= stack[-1][1]:
            stack.pop()
        if stack:
            stack[-1][0].append(node)
        else:
            root.append(node)
        stack.append((node["children"], indent))
    return root

def resolve_node(node, templates):
    """
    Recursively resolve a node dict
    """
    resolved = []
    name = node["name"]
    children = node.get("children", [])

    if name.startswith("@insert"):
        key = name.split()[1]
        if key in templates:
            # Insert the template tree here
            for tn in templates[key]:
                resolved.extend(resolve_node(tn, templates))
    else:
        resolved_children = []
        for child in children:
            resolved_children.extend(resolve_node(child, templates))
        resolved.append({"name": name, "children": resolved_children})

    return resolved


def resolve_tree(tree, templates):
    full_tree = []
    for node in tree:
        full_tree.extend(resolve_node(node, templates))
    return full_tree

# ----------------------------
# Helper: Convert tree to text
# ----------------------------
def tree_to_text(tree, indent=0):
    lines = []
    for node in tree:
        lines.append("    " * indent + node["name"])
        if node["children"]:
            lines.extend(tree_to_text(node["children"], indent+1))
    return lines

# ----------------------------
# GUI App
# ----------------------------
class FolderGenApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PBK VizLab Folder Generator")
        self.parser = None
        self.tree_data = []

        # GUI Elements
        self.file_label = tk.Label(root, text="No template loaded")
        self.file_label.pack(pady=5)
        tk.Button(root, text="Load Template", command=self.load_template).pack(pady=5)

        self.tree_frame = tk.Frame(root)
        self.tree_frame.pack(padx=10, pady=10, fill="both", expand=True)
        self.tree = ttk.Treeview(self.tree_frame)
        self.tree.pack(fill="both", expand=True)

        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=5)
        tk.Button(btn_frame, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Generate Folders", command=self.generate_folders).pack(side="left", padx=5)

    def load_template(self):
        file_path = filedialog.askopenfilename(filetypes=[("PBK Struct Files","*.pbkstruct")])
        if not file_path:
            return
        self.parser = PBKStructParser(file_path)
        self.parser.parse()
        self.tree_data = resolve_tree(self.parser.root_structure, self.parser.templates)
        self.file_label.config(text=f"Loaded: {os.path.basename(file_path)}")
        self.populate_tree()

    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())
        def insert_items(parent, children):
            for child in children:
                node = self.tree.insert(parent, "end", text=child["name"])
                if child["children"]:
                    insert_items(node, child["children"])
        insert_items("", self.tree_data)

    def generate_folders(self):
        target = filedialog.askdirectory()
        if not target:
            return
        def create_items(base, children):
            for child in children:
                path = os.path.join(base, child["name"])
                os.makedirs(path, exist_ok=True)
                create_items(path, child["children"])
        create_items(target, self.tree_data)
        messagebox.showinfo("Done", f"Folders generated at {target}")

    def copy_structure(self):
        lines = tree_to_text(self.tree_data)
        text = "\n".join(lines)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "Proposed folder structure copied to clipboard.")

# ----------------------------
# Run App
# ----------------------------
if __name__ == "__main__":
    root = tk.Tk()
    app = FolderGenApp(root)
    root.geometry("900x700")
    root.mainloop()
