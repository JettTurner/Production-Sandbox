# pbkstruct_gui.py
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from typing import List, Dict, Tuple
import re
import threading

# ============================================================
# Node Model
# ============================================================

class Node:
    """Folder node for building trees"""
    def __init__(self, name: str):
        self.name = name
        self.children: List["Node"] = []

    def add(self, node: "Node"):
        self.children.append(node)

    def walk(self, base: Path, dry_run: bool):
        path = base / self.name
        if dry_run:
            print(f"[DRY] {path}")
        else:
            path.mkdir(parents=True, exist_ok=True)
            print(f"[OK]  {path}")
        for child in self.children:
            child.walk(path, dry_run)

# ============================================================
# PBKStruct Parser
# ============================================================

SECTION_RE = re.compile(r"^@(root|state|template)\b(?:\s+(.*))?$")
INLINE_RE  = re.compile(r"^@(\w+)\b(?:\s+(.*))?$")
STATE_LINE_RE = re.compile(r'^([A-Z0-9_]+)\s+"([^"]+)"$')

class PBKStruct:
    def __init__(self):
        self.root: List[str] = []
        self.states: List[str] = []
        self.state_defs: Dict[str, Dict[str,str]] = {}
        self.templates: Dict[str, List[str]] = {}

    def parse(self, text: str):
        lines = [l.rstrip() for l in text.splitlines() if l.strip()]
        i = 0
        current_section = None
        current_key = None

        while i < len(lines):
            line = lines[i].strip()

            # SECTION HEADERS (multiline blocks)
            sec = SECTION_RE.match(line)
            if sec:
                current_section = sec.group(1)
                current_key = sec.group(2)
                i += 1
                continue

            # INLINE DIRECTIVES
            inline = INLINE_RE.match(line)
            if inline:
                directive = inline.group(1)
                value = inline.group(2)

                if directive == "states":
                    self.states.extend([s.strip() for s in value.split(",")])

                elif directive == "insert":
                    if current_section == "root":
                        self.root.append(f"@insert {value}")
                    elif current_section == "template":
                        self.templates[current_key].append(f"@insert {value}")

                i += 1
                continue

            # CONTENT LINES
            if current_section == "root":
                self.root.append(line)

            elif current_section == "state":
                m = STATE_LINE_RE.match(line)
                if not m:
                    raise ValueError(f"Invalid state line: {line}")

                code = m.group(1)
                label = m.group(2) or code
                self.state_defs.setdefault(current_key, []).append((code, label))

            elif current_section == "template":
                self.templates.setdefault(current_key, []).append(line)

            i += 1


# ============================================================
# Tree Builder
# ============================================================

def build_template(template: List[str], templates: Dict[str, List[str]]) -> List[Node]:
    stack: List[Tuple[int, Node]] = []
    roots: List[Node] = []

    for line in template:
        indent = len(line) - len(line.lstrip(" "))
        content = line.strip()
        if content.startswith("@insert"):
            name = content.split()[1]
            inserted = build_template(templates[name], templates)
            if stack:
                for n in inserted:
                    stack[-1][1].add(n)
            else:
                roots.extend(inserted)
            continue
        node = Node(content)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if stack:
            stack[-1][1].add(node)
        else:
            roots.append(node)
        stack.append((indent, node))
    return roots

def build_root_tree(struct: PBKStruct) -> List[Node]:
    roots: List[Node] = []

    for entry in struct.root:
        if entry == "01_EXT":
            ext = Node("01_EXT")
            for state in struct.states:
                if state not in struct.state_defs:
                    continue
                state_node = Node(state)
                for code in struct.state_defs[state]:
                    city_node = Node(code)
                    city_node.add(Node("Projects"))
                    state_node.add(city_node)
                ext.add(state_node)
            roots.append(ext)
        elif entry.startswith("@insert"):
            name = entry.split()[1]
            roots.extend(build_template(struct.templates[name], struct.templates))
        else:
            roots.append(Node(entry))
    return roots

# ============================================================
# GUI
# ============================================================

class PBKStructGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("PBKStruct Generator")
        self.geometry("900x600")

        # Variables
        self.struct_file = tk.StringVar()
        self.output_dir = tk.StringVar()
        self.dry_run = tk.BooleanVar(value=True)
        self.tree_nodes: List[Node] = []

        # Layout
        self.create_widgets()

    def create_widgets(self):
        frame_top = tk.Frame(self)
        frame_top.pack(fill="x", padx=10, pady=5)

        tk.Label(frame_top, text="PBKStruct File:").pack(side="left")
        tk.Entry(frame_top, textvariable=self.struct_file, width=60).pack(side="left", padx=5)
        tk.Button(frame_top, text="Browse", command=self.browse_struct).pack(side="left")

        tk.Label(frame_top, text="Output Folder:").pack(side="left", padx=10)
        tk.Entry(frame_top, textvariable=self.output_dir, width=40).pack(side="left", padx=5)
        tk.Button(frame_top, text="Browse", command=self.browse_output).pack(side="left")

        tk.Checkbutton(frame_top, text="Dry Run", variable=self.dry_run).pack(side="left", padx=10)

        tk.Button(frame_top, text="Generate Tree", command=self.generate_tree).pack(side="right", padx=5)

        # Treeview
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True, padx=10, pady=10)

    def browse_struct(self):
        file = filedialog.askopenfilename(filetypes=[("PBKStruct files", "*.pbkstruct")])
        if file:
            self.struct_file.set(file)

    def browse_output(self):
        folder = filedialog.askdirectory()
        if folder:
            self.output_dir.set(folder)

    def generate_tree(self):
        def worker():
            try:
                text = Path(self.struct_file.get()).read_text(encoding="utf-8")
                struct = PBKStruct()
                struct.parse(text)

                self.tree_nodes = build_root_tree(struct)

                self.after(0, self.display_tree)

            except Exception as e:
                err = str(e)
                self.after(0, lambda err=err: messagebox.showerror("Error", err))

        threading.Thread(target=worker, daemon=True).start()

    def display_tree(self):
        self.tree.delete(*self.tree.get_children())
        for node in self.tree_nodes:
            self.insert_tree("", node)

    def insert_tree(self, parent, node: Node):
        item = self.tree.insert(parent, "end", text=node.name)
        for child in node.children:
            self.insert_tree(item, child)

# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    app = PBKStructGUI()
    app.mainloop()
