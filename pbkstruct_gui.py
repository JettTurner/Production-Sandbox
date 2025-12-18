# PBKSTRUCT GUI + ENGINE
# =====================
# Full-featured PBKSTRUCT processor

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import re
from typing import List, Dict, Tuple

# ============================================================
# NODE MODEL
# ============================================================

class Node:
    def __init__(self, name: str):
        self.name = name
        self.children: List['Node'] = []

    def add(self, node: 'Node'):
        self.children.append(node)

    def clone(self):
        n = Node(self.name)
        n.children = [c.clone() for c in self.children]
        return n

    def walk(self, base: Path, dry: bool = True):
        path = base / self.name
        if dry:
            print("[DRY]", path)
        else:
            path.mkdir(parents=True, exist_ok=True)
            print("[OK] ", path)
        for c in self.children:
            c.walk(path, dry)

# ============================================================
# PARSER
# ============================================================

DIRECTIVE_RE = re.compile(r'^@(\w+)(?:\s+(.*))?$')
DEFINE_ITEM_RE = re.compile(r'^([A-Z0-9_]+)(?:\s+"(.+)")?$')

class PBKStruct:
    def __init__(self):
        self.meta = {}
        self.root_lines = []
        self.defines = {}        
        self.templates = {}      
        self.errors: List[str] = []

    def parse(self, text: str):
        lines = text.splitlines()
        current_block = None
        current_key = None
        indent_stack = [0]

        DIRECTIVE_RE = re.compile(r'^@(\w+)(?:\s+(.*))?$')
        DEFINE_ITEM_RE = re.compile(r'^([A-Z0-9_]+)(?:\s+"(.+)")?$')

        for lineno, raw in enumerate(lines, 1):
            line = raw.rstrip("\n")
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue

            # count leading whitespace (spaces or tabs)
            indent = len(line) - len(line.lstrip())

            # ---- directive
            m = DIRECTIVE_RE.match(stripped)
            if m and indent == 0:
                current_block = m.group(1)
                current_key = m.group(2)

                if current_block in ('version', 'name'):
                    self.meta[current_block] = current_key
                elif current_block == 'root':
                    self.root_lines = []
                elif current_block == 'define':
                    self.defines.setdefault(current_key, {})
                elif current_block == 'template':
                    self.templates[current_key] = []
                continue

            # ---- check indentation
            if indent > indent_stack[-1]:
                indent_stack.append(indent)
            else:
                while indent < indent_stack[-1]:
                    indent_stack.pop()
                if indent != indent_stack[-1]:
                    self.errors.append(f"Line {lineno}: unexpected indent level")

            # ---- parse content
            content = line.lstrip()
            if current_block == 'root':
                self.root_lines.append(content)
            elif current_block == 'define':
                m2 = DEFINE_ITEM_RE.match(content)
                if not m2:
                    self.errors.append(f"Line {lineno}: expected CODE \"Label\"")
                    continue
                code, label = m2.group(1), m2.group(2) or m2.group(1)
                self.defines[current_key][code] = label
            elif current_block == 'template':
                self.templates[current_key].append(content)
            else:
                self.errors.append(f"Line {lineno}: unknown block @{current_block}")

        return self.errors

# ============================================================
# TEMPLATE / EXPANSION ENGINE
# ============================================================

def build_template(lines: List[str], templates: Dict[str,List[str]]) -> List[Node]:
    stack: List[Tuple[int, Node]] = []
    roots: List[Node] = []

    for raw in lines:
        indent = len(raw) - len(raw.lstrip(' '))
        content = raw.strip()

        if content.startswith('@insert'):
            name = content.split()[1]
            if name not in templates:
                raise ValueError(f"Template {name} not found")
            nodes = build_template(templates[name], templates)
            if stack:
                for n in nodes:
                    stack[-1][1].add(n)
            else:
                roots.extend(nodes)
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

def build_root(struct: PBKStruct) -> List[Node]:
    roots: List[Node] = []

    for line in struct.root_lines:
        stripped = line.strip()
        if stripped.startswith('@expand'):
            parts = stripped.split()
            if len(parts) != 2:
                struct.errors.append(f"Invalid @expand line: {line}")
                continue
            _, key = parts
            if key == 'states':
                for state_code, state_name in struct.defines.get(('states',''), {}).items():
                    s_node = Node(state_code)
                    city_key = ('cities', state_code)
                    if city_key in struct.defines:
                        for city_code in struct.defines[city_key]:
                            c_node = Node(city_code)
                            s_node.add(c_node)
                    roots.append(s_node)
            continue

        if stripped.startswith('@insert'):
            name = stripped.split()[1]
            if name not in struct.templates:
                struct.errors.append(f"Template {name} not found")
                continue
            roots.extend(build_template(struct.templates[name], struct.templates))
        else:
            roots.append(Node(stripped))

    return roots

# ============================================================
# GUI
# ============================================================

class PBKStructGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("PBKSTRUCT Generator")
        self.geometry("1000x600")

        self.text = tk.Text(self)
        self.text.pack(fill='both', expand=True)

        btns = ttk.Frame(self)
        btns.pack(fill='x')

        ttk.Button(btns, text="Load", command=self.load).pack(side='left')
        ttk.Button(btns, text="Preview", command=self.preview).pack(side='left')
        ttk.Button(btns, text="Apply", command=self.apply).pack(side='left')

    def load(self):
        path = filedialog.askopenfilename(filetypes=[('PBKSTRUCT','*.pbkstruct')])
        if not path:
            return
        self.text.delete('1.0','end')
        self.text.insert('1.0', Path(path).read_text(encoding='utf-8'))

    def parse(self) -> PBKStruct:
        s = PBKStruct()
        s.parse(self.text.get('1.0','end'))
        return s

    def preview(self):
        s = self.parse()
        if s.errors:
            messagebox.showerror("Parse Errors", "\n".join(s.errors))
            return
        roots = build_root(s)
        messagebox.showinfo("Preview", f"Parsed {len(roots)} root nodes")

    def apply(self):
        outdir = filedialog.askdirectory()
        if not outdir:
            return
        s = self.parse()
        if s.errors:
            messagebox.showerror("Parse Errors", "\n".join(s.errors))
            return
        roots = build_root(s)
        for r in roots:
            r.walk(Path(outdir), dry=False)
        messagebox.showinfo("Done", "Filesystem generated successfully ✅")

# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    PBKStructGUI().mainloop()
