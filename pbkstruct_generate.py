import os
import sys
from collections import defaultdict

# =========================
# Data Models
# =========================

class Node:
    def __init__(self, name):
        self.name = name
        self.children = []

    def add(self, node):
        self.children.append(node)

class Context:
    def __init__(self):
        self.templates = {}
        self.states = {}
        self.location_template = None
        self.root = None

# =========================
# Parser
# =========================

def parse_pbkstruct(path):
    ctx = Context()
    stack = []
    current_section = None
    current_name = None

    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip()
            if not line or line.strip().startswith("#"):
                continue

            indent = len(line) - len(line.lstrip(" "))
            content = line.strip()

            # Directives
            if content.startswith("@"):
                parts = content.split()
                directive = parts[0]

                if directive == "@root":
                    ctx.root = Node("__ROOT__")
                    stack = [(0, ctx.root)]
                    current_section = "root"

                elif directive == "@template":
                    name = parts[1]
                    node = Node(name)
                    ctx.templates[name] = node
                    stack = [(indent, node)]
                    current_section = "template"

                elif directive == "@state":
                    name = parts[1]
                    if name in ctx.states:
                        raise ValueError(f"Duplicate @state {name}")
                    ctx.states[name] = []
                    current_section = "state"
                    current_name = name

                elif directive == "@location":
                    node = Node("__LOCATION__")
                    ctx.location_template = node
                    stack = [(indent, node)]
                    current_section = "location"

                else:
                    stack.append((indent, Node(content)))

                continue

            # State city entry
            if current_section == "state":
                code = content.split()[0]
                ctx.states[current_name].append(code)
                continue

            # Normal node
            name = content.split()[0]
            node = Node(name)

            while stack and indent <= stack[-1][0]:
                stack.pop()

            stack[-1][1].add(node)
            stack.append((indent, node))

    return ctx

# =========================
# Expansion Engine
# =========================

def expand(node, ctx, path, dry_run):
    for child in node.children:
        if child.name == "@insert":
            tmpl = child.children[0].name
            expand(ctx.templates[tmpl], ctx, path, dry_run)
            continue

        if child.name == "@states":
            states = child.children[0].name.split(",")
            for s in states:
                s = s.strip()
                for city in ctx.states[s]:
                    city_path = os.path.join(path, s, city)
                    mkdir(city_path, dry_run)
                    expand(ctx.location_template, ctx, city_path, dry_run)
            continue

        new_path = os.path.join(path, child.name)
        mkdir(new_path, dry_run)
        expand(child, ctx, new_path, dry_run)

# =========================
# Filesystem
# =========================

def mkdir(path, dry):
    if dry:
        print("[DRY]", path)
    else:
        os.makedirs(path, exist_ok=True)

# =========================
# Entry Point
# =========================

def generate(pbks_path, output_path, dry_run=True):
    ctx = parse_pbkstruct(pbks_path)

    if not ctx.root:
        raise RuntimeError("Missing @root")

    for node in ctx.root.children:
        base = os.path.join(output_path, node.name)
        mkdir(base, dry_run)
        expand(node, ctx, base, dry_run)

if __name__ == "__main__":
    pbkstruct = sys.argv[1]
    out = sys.argv[2]
    dry = "--dry-run" in sys.argv
    generate(pbkstruct, out, dry)
