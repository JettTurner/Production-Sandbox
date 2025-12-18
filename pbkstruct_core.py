"""
PBKSTRUCT CORE
==============

Parses .pbkstruct files and generates filesystem trees.

Design goals:
- Deterministic
- Human-readable
- GUI-safe (no side effects unless asked)
- Extensible DSL
"""

from pathlib import Path
from typing import Dict, List, Tuple
import re

# ============================================================
# Data Models
# ============================================================

class Node:
    """Represents a folder node in the filesystem."""
    def __init__(self, name: str):
        self.name = name
        self.children: List["Node"] = []

    def add(self, node: "Node"):
        self.children.append(node)

    def walk(self, base: Path, dry_run: bool = True):
        """Recursively create folders or print in dry-run mode."""
        path = base / self.name
        if dry_run:
            print(f"[DRY] {path}")
        else:
            path.mkdir(parents=True, exist_ok=True)
            print(f"[OK]  {path}")

        for child in self.children:
            child.walk(path, dry_run)

# ============================================================
# Parser
# ============================================================

SECTION_RE = re.compile(r"^@(\w+)(?:\s+(.*))?$")
STATE_LINE_RE = re.compile(r'^\s*([A-Z0-9_]+)(?:\s+"([^"]+)")?\s*$')  # code + optional quoted description

class PBKStruct:
    def __init__(self):
        self.root: List[str] = []
        self.states: List[str] = []
        self.state_defs: Dict[str, List[Tuple[str, str]]] = {}  # state -> list of (code, desc)
        self.templates: Dict[str, List[str]] = {}

    def parse(self, text: str):
        """Parse a .pbkstruct file."""
        lines = [l.rstrip() for l in text.splitlines() if l.strip()]
        current_section = None
        current_key = None

        for line in lines:
            # Check for section headers
            match = SECTION_RE.match(line)
            if match:
                current_section = match.group(1)
                current_key = match.group(2)
                continue

            # ROOT
            if current_section == "root":
                self.root.append(line)
                continue

            # STATES LIST
            if current_section == "states":
                self.states.extend([s.strip() for s in line.split(",")])
                continue

            # STATE DEFINITIONS
            if current_section == "state":
                if current_key not in self.state_defs:
                    self.state_defs[current_key] = []

                line_stripped = line.strip()
                m = STATE_LINE_RE.match(line_stripped)
                if not m:
                    raise ValueError(f"Invalid state line: {line}")
                code = m.group(1)
                desc = m.group(2) if m.group(2) else code
                self.state_defs[current_key].append((code, desc))
                continue

            # TEMPLATE
            if current_section == "template":
                if current_key not in self.templates:
                    self.templates[current_key] = []
                self.templates[current_key].append(line)
                continue

# ============================================================
# Tree Builders
# ============================================================

def build_template(template: List[str], templates: Dict[str, List[str]]) -> List[Node]:
    """Recursively build a Node tree from a template list."""
    stack: List[Tuple[int, Node]] = []
    roots: List[Node] = []

    for line in template:
        indent = len(line) - len(line.lstrip(" "))
        content = line.strip()

        # Handle @insert directive
        if content.startswith("@insert"):
            name = content.split(maxsplit=1)[1]
            inserted_nodes = build_template(templates[name], templates)
            if stack:
                for n in inserted_nodes:
                    stack[-1][1].add(n)
            else:
                roots.extend(inserted_nodes)
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
    """Build the full root tree including states and templates."""
    roots: List[Node] = []

    for entry in struct.root:
        # Special handling for EXT folder + states
        if entry == "01_EXT":
            ext = Node("01_EXT")
            for state in struct.states:
                state_node = Node(state)
                for code, desc in struct.state_defs.get(state, []):
                    city_node = Node(code)  # folder name = code
                    city_node.add(Node("Projects"))
                    state_node.add(city_node)
                ext.add(state_node)
            roots.append(ext)
        elif entry.startswith("@insert"):
            name = entry.split(maxsplit=1)[1]
            roots.extend(build_template(struct.templates[name], struct.templates))
        else:
            roots.append(Node(entry))

    return roots

# ============================================================
# Public API
# ============================================================

def generate(struct_file: str, output_dir: str, dry_run: bool = True):
    """Generate filesystem from a .pbkstruct file."""
    text = Path(struct_file).read_text(encoding="utf-8")
    struct = PBKStruct()
    struct.parse(text)
    tree = build_root_tree(struct)

    base = Path(output_dir)
    if not dry_run:
        base.mkdir(parents=True, exist_ok=True)

    for node in tree:
        node.walk(base, dry_run)

# ============================================================
# CLI SUPPORT
# ============================================================

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: pbkstruct_core.py <file.pbkstruct> <output_dir> [--apply]")
        sys.exit(1)

    dry = "--apply" not in sys.argv
    generate(sys.argv[1], sys.argv[2], dry_run=dry)
