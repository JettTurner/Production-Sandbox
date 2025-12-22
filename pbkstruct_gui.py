import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import re

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
		self.templates = {}	 # name -> list of nested dict nodes
		self.root_structure = []

	def parse(self):
		"""Parse the PBK struct file and build initial template & root structures"""
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
# Recursive @insert Resolver + Validation
# ==========================================
class TemplateResolver:
	def __init__(self, templates):
		self.templates = templates
		self.visited_stack = []

	def resolve_node(self, node):
		"""
		Recursively resolves a node dictionary.
		Replaces @insert <template> with the template tree.
		Performs:
		- Mutual recursion detection
		- Invalid character check
		- Duplicate sibling check
		"""
		resolved = []
		name = node["name"]
		children = node.get("children", [])

		# --- Handle @insert ---
		if name.startswith("@insert"):
			key = name.split()[1]
			if key in self.visited_stack:
				raise ValueError(f"Direct mutual recursion detected: {' -> '.join(self.visited_stack + [key])}")
			if key not in self.templates:
				raise ValueError(f"Template '{key}' not found for @insert")
			self.visited_stack.append(key)
			for tn in self.templates[key]:
				resolved.extend(self.resolve_node(tn))
			self.visited_stack.pop()
		else:
			# Check invalid characters for Windows filenames
			if re.search(r'[<>:"/\\|?*]', name):
				raise ValueError(f"Invalid character in folder/file name: '{name}'")

			# Resolve children recursively
			resolved_children = []
			child_names = set()
			for child in children:
				# Duplicate sibling check
				if child["name"] in child_names:
					raise ValueError(f"Duplicate sibling name detected: '{child['name']}'")
				child_names.add(child["name"])
				resolved_children.extend(self.resolve_node(child))
			resolved.append({"name": name, "children": resolved_children})

		return resolved

	def resolve_tree(self, tree):
		full_tree = []
		for node in tree:
			full_tree.extend(self.resolve_node(node))
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
		lines.append("\t" * indent + node["name"])
		if node["children"]:
			lines.extend(tree_to_text(node["children"], indent + 1))
	return lines

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
		
		#top buttons
		btn_frame1 = tk.Frame(root)
		btn_frame1.pack(pady=5)
		tk.Button(btn_frame1, text="Load Template", command=self.load_template).pack(side="left", padx=5)
		tk.Button(btn_frame1, text="Expand All", command=self.expand_all).pack(side="left", padx=5)
		tk.Button(btn_frame1, text="Collapse All", command=self.collapse_all).pack(side="left", padx=5)

		
		# Frame for treeview + scrollbars
		self.tree_frame = tk.Frame(root)
		self.tree_frame.pack(padx=10, pady=10, fill="both", expand=True)
		# Frame to hold treeview and horizontal scrollbar
		self.tree_inner = tk.Frame(self.tree_frame)
		self.tree_inner.pack(fill="both", expand=True)
		# Treeview
		self.tree = ttk.Treeview(self.tree_inner)
		self.tree.grid(row=0, column=0, sticky="nsew")
		# Vertical scrollbar
		self.vsb = tk.Scrollbar(self.tree_inner, orient="vertical", command=self.tree.yview)
		self.vsb.grid(row=0, column=1, sticky="ns")
		# Horizontal scrollbar
		self.hsb = tk.Scrollbar(self.tree_inner, orient="horizontal", command=self.tree.xview)
		self.hsb.grid(row=1, column=0, sticky="ew")
		# Configure treeview to use scrollbars
		self.tree.configure(yscrollcommand=self.vsb.set, xscrollcommand=self.hsb.set)
		# Make grid expand properly
		self.tree_inner.grid_rowconfigure(0, weight=1)
		self.tree_inner.grid_columnconfigure(0, weight=1)

		#bottom buttons
		btn_frame2 = tk.Frame(root)
		btn_frame2.pack(pady=5)
		tk.Button(btn_frame2, text="Generate Folders & Files", command=self.generate_folders).pack(side="left", padx=5)
		tk.Button(btn_frame2, text="Copy Proposed Structure", command=self.copy_structure).pack(side="left", padx=5)


	# --------------------------------------
	def load_template(self):
		"""Load .pbkstruct file, parse, resolve inserts, and populate treeview"""
		file_path = filedialog.askopenfilename(filetypes=[("PBK Struct Files", "*.pbkstruct")])
		if not file_path:
			return
		self.parser = PBKStructParser(file_path)
		self.parser.parse()
		try:
			resolver = TemplateResolver(self.parser.templates)
			self.tree_data = resolver.resolve_tree(self.parser.root_structure)
		except ValueError as e:
			messagebox.showerror("Template Error", str(e))
			return

		self.file_label.config(text=f"Loaded: {os.path.basename(file_path)}")
		self.populate_tree()

	def populate_tree(self):
		"""Populate the Tkinter treeview with the fully resolved tree"""
		self.tree.delete(*self.tree.get_children())

		def insert_items(parent, children):
			for child in children:
				node = self.tree.insert(parent, "end", text=child["name"])
				if child["children"]:
					insert_items(node, child["children"])
		insert_items("", self.tree_data)

	# --------------------------------------
	def generate_folders(self):
		"""Generate folders and files on disk based on resolved tree"""
		target = filedialog.askdirectory()
		if not target:
			return

		def create_items(base, children):
			for child in children:
				# Detect if line has a file extension
				if '.' in child["name"]:
					path = os.path.join(base, child["name"])
					# Create blank file
					os.makedirs(os.path.dirname(path), exist_ok=True)
					open(path, "w", encoding="utf-8").close()
				# Detect @link <target>
				elif child["name"].startswith("@link"):
					target_path = child["name"].split(maxsplit=1)[1]
					link_path = os.path.join(base, os.path.basename(target_path))
					try:
						if sys.platform.startswith('win'):
							import subprocess
							subprocess.call(['mklink', '/D', link_path, target_path], shell=True)
						else:
							os.symlink(target_path, link_path)
					except Exception as e:
						messagebox.showwarning("Link Warning", f"Failed to create link: {link_path}\n{e}")
				else:
					path = os.path.join(base, child["name"])
					os.makedirs(path, exist_ok=True)
					create_items(path, child["children"])

		try:
			create_items(target, self.tree_data)
			messagebox.showinfo("Done", f"Folders & files generated at {target}")
		except Exception as e:
			messagebox.showerror("Error", f"Failed to generate folders/files:\n{e}")

	# --------------------------------------
	def copy_structure(self):
		"""Copy the fully resolved folder structure as text to clipboard"""
		lines = tree_to_text(self.tree_data)
		text = "\n".join(lines)
		self.root.clipboard_clear()
		self.root.clipboard_append(text)
		messagebox.showinfo("Copied", "Proposed folder structure copied to clipboard.")
	
	# --------------------------------------
	def expand_all(self):
		"""Recursively expand all treeview nodes"""
		def recursive_expand(item):
			self.tree.item(item, open=True)
			for child in self.tree.get_children(item):
				recursive_expand(child)
		for item in self.tree.get_children():
			recursive_expand(item)

	def collapse_all(self):
		"""Recursively collapse all treeview nodes"""
		def recursive_collapse(item):
			self.tree.item(item, open=False)
			for child in self.tree.get_children(item):
				recursive_collapse(child)
		for item in self.tree.get_children():
			recursive_collapse(item)


# ==========================================
# Run Application
# ==========================================
if __name__ == "__main__":
	root = tk.Tk()
	app = FolderGenApp(root)
	root.geometry("1000x750")
	root.mainloop()
