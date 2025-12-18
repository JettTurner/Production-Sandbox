import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ----------------------------
# PBK Struct Parser (unchanged)
# ----------------------------
class PBKStructParser:
    def __init__(self, filepath):
        self.filepath = filepath
        self.definitions = {}   # e.g., states, cities
        self.templates = {}     # e.g., Projects, AssetLibrary
        self.root_structure = []

    def parse(self):
        with open(self.filepath, "r") as f:
            lines = [line.rstrip("\n") for line in f if line.strip() and not line.strip().startswith("#")]

        current_def = None
        current_template = None
        stack = []
        for line in lines:
            stripped = line.lstrip("\t")
            indent = len(line) - len(stripped)
            name = stripped

            if line.startswith("@define"):
                current_def = line.split()[1]
                self.definitions[current_def] = {}
                current_template = None
            elif line.startswith("@template"):
                current_template = line.split()[1]
                self.templates[current_template] = []
                current_def = None
            elif line.startswith("@root"):
                stack = [(self.root_structure, -1)]
                current_def = None
                current_template = None
            elif current_def:
                if indent == 1:
                    parts = name.split(maxsplit=1)
                    if len(parts) == 2:
                        key, val = parts
                        self.definitions[current_def][key] = val.strip('"')
            elif current_template:
                self.templates[current_template].append((indent, name))
            elif stack:
                while stack and indent <= stack[-1][1]:
                    stack.pop()
                parent_list = stack[-1][0]
                new_item = {"name": name, "children": []}
                parent_list.append(new_item)
                stack.append((new_item["children"], indent))

# ----------------------------
# Build full tree
# ----------------------------
def build_full_tree(struct, definitions, templates):
    result = []
    for item in struct:
        if isinstance(item, dict):
            result.append({
                "name": item["name"],
                "children": build_full_tree(item["children"], definitions, templates)
            })
        elif isinstance(item, str):
            if item.startswith("@expand"):
                key = item.split()[1]
                if key in definitions:
                    for k, v in definitions[key].items():
                        children = []
                        if f"cities {k}" in definitions:
                            for ck, cv in definitions[f"cities {k}"].items():
                                children.append({"name": ck, "children":[]})
                        result.append({"name": k, "children": children})
            elif item.startswith("@insert"):
                key = item.split()[1]
                if key in templates:
                    for _, name in templates[key]:
                        result.append({"name": name, "children":[]})
    return result

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

        tk.Button(btn_frame, text="Generate Folders", command=self.generate_folders).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)

    def load_template(self):
        file_path = filedialog.askopenfilename(filetypes=[("PBK Struct Files","*.pbkstruct")])
        if not file_path:
            return
        self.parser = PBKStructParser(file_path)
        self.parser.parse()
        self.tree_data = build_full_tree(self.parser.root_structure, self.parser.definitions, self.parser.templates)
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
    root.geometry("800x700")
    root.mainloop()
