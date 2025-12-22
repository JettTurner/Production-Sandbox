import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ============================================================
# Custom Errors
# ============================================================

class TemplateRecursionError(Exception):
    pass

class TemplateNotFoundError(Exception):
    pass


# ============================================================
# PBK Struct Parser
# ============================================================

class PBKStructParser:
    """
    Parses a PBK .pbkstruct file into:
    - root_structure: list of dict nodes
    - templates: dict[str, list[dict]]
    """

    def __init__(self, filepath):
        self.filepath = filepath
        self.templates = {}
        self.root_structure = []

    def parse(self):
        with open(self.filepath, "r", encoding="utf-8") as f:
            lines = [
                line.rstrip("\n")
                for line in f
                if line.strip() and not line.strip().startswith("#")
            ]

        current_template = None
        root_stack = []

        for line in lines:
            stripped = line.lstrip("\t")
            indent = len(line) - len(stripped)
            name = stripped.strip()

            # -------------------------------
            # Template declaration
            # -------------------------------
            if name.startswith("@template"):
                current_template = name.split()[1]
                self.templates[current_template] = []
                continue

            # -------------------------------
            # Root declaration
            # -------------------------------
            if name == "@root":
                current_template = None
                self.root_structure = []
                root_stack = [(self.root_structure, -1)]
                continue

            # -------------------------------
            # Inside template
            # -------------------------------
            if current_template:
                self.templates[current_template].append((indent, name))
                continue

            # -------------------------------
            # Root structure node
            # -------------------------------
            while root_stack and indent <= root_stack[-1][1]:
                root_stack.pop()

            parent = root_stack[-1][0] if root_stack else self.root_structure
            node = {"name": name, "children": []}
            parent.append(node)
            root_stack.append((node["children"], indent))

        # Parse templates into trees
        for key, lines in self.templates.items():
            self.templates[key] = self._parse_template_lines(lines)

    def _parse_template_lines(self, lines):
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


# ============================================================
# Recursive Insert Resolver (WITH CYCLE DETECTION)
# ============================================================

def resolve_node(node, templates, stack):
    """
    Resolve a single node.
    `stack` tracks template expansion to detect recursion.
    """
    name = node["name"]

    # -------------------------------
    # Handle @insert
    # -------------------------------
    if name.startswith("@insert"):
        template_name = name.split()[1]

        if template_name not in templates:
            raise TemplateNotFoundError(f"Template '{template_name}' not found")

        if template_name in stack:
            cycle = " → ".join(stack + [template_name])
            raise TemplateRecursionError(f"Template recursion detected: {cycle}")

        resolved = []
        for child in templates[template_name]:
            resolved.extend(
                resolve_node(child, templates, stack + [template_name])
            )
        return resolved

    # -------------------------------
    # Normal folder node
    # -------------------------------
    resolved_children = []
    for child in node.get("children", []):
        resolved_children.extend(resolve_node(child, templates, stack))

    return [{
        "name": name,
        "children": resolved_children
    }]


def resolve_tree(tree, templates):
    resolved = []
    for node in tree:
        resolved.extend(resolve_node(node, templates, []))
    return resolved


# ============================================================
# Helper: Convert tree to text
# ============================================================

def tree_to_text(tree, indent=0):
    lines = []
    for node in tree:
        lines.append("    " * indent + node["name"])
        if node["children"]:
            lines.extend(tree_to_text(node["children"], indent + 1))
    return lines


# ============================================================
# GUI Application
# ============================================================

class FolderGenApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PBK VizLab Folder Generator")

        self.parser = None
        self.tree_data = []

        # UI
        self.file_label = tk.Label(root, text="No template loaded")
        self.file_label.pack(pady=5)

        tk.Button(root, text="Load Template", command=self.load_template).pack(pady=5)

        self.tree = ttk.Treeview(root)
        self.tree.pack(fill="both", expand=True, padx=10, pady=10)

        btns = tk.Frame(root)
        btns.pack(pady=5)

        tk.Button(btns, text="Generate Folders", command=self.generate_folders).pack(side="left", padx=5)
        tk.Button(btns, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)

    # --------------------------------------------------------

    def load_template(self):
        path = filedialog.askopenfilename(filetypes=[("PBK Struct Files", "*.pbkstruct")])
        if not path:
            return

        try:
            self.parser = PBKStructParser(path)
            self.parser.parse()
            self.tree_data = resolve_tree(self.parser.root_structure, self.parser.templates)
        except (TemplateRecursionError, TemplateNotFoundError) as e:
            messagebox.showerror("Template Error", str(e))
            return
        except Exception as e:
            messagebox.showerror("Parse Error", str(e))
            return

        self.file_label.config(text=f"Loaded: {os.path.basename(path)}")
        self.populate_tree()

    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())

        def insert(parent, nodes):
            for node in nodes:
                nid = self.tree.insert(parent, "end", text=node["name"])
                insert(nid, node["children"])

        insert("", self.tree_data)

    # --------------------------------------------------------

    def generate_folders(self):
        target = filedialog.askdirectory()
        if not target:
            return

        try:
            self._create_items(target, self.tree_data)
            messagebox.showinfo("Done", "Folders generated successfully.")
        except Exception as e:
            messagebox.showerror("Filesystem Error", str(e))

    def _create_items(self, base, nodes):
        for node in nodes:
            safe_name = node["name"].strip()
            path = os.path.join(base, safe_name)
            os.makedirs(path, exist_ok=True)
            self._create_items(path, node["children"])

    # --------------------------------------------------------

    def copy_structure(self):
        text = "\n".join(tree_to_text(self.tree_data))
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "Structure copied to clipboard.")


# ============================================================
# Run App
# ============================================================

if __name__ == "__main__":
    root = tk.Tk()
    root.geometry("900x700")
    FolderGenApp(root)
    root.mainloop()
