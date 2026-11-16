/**
 * Parser/resolver sanity checks. Run with: npm run verify
 * (no test framework — just asserts over the sample .fh files)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFh } from "../src/lib/parser";
import { resolveDoc, countNodes } from "../src/lib/resolver";
import { serializeFh } from "../src/lib/serializer";
import { removeNode, insertChild, updateNode, moveNode, insertRelative, makeInsert, countTemplateUses, cleanTemplateName, countOwnNodes } from "../src/lib/treeEdit";
import { makeFolder } from "../src/lib/treeEdit";
import { reconcileIds, cloneWithNewIds } from "../src/lib/ids";
import { planTree, nameProblem } from "../src/lib/validate";
import { scanDestination, createOnDisk } from "../src/lib/folders";
import { isFileNode } from "../src/lib/types";
import type { FsNode } from "../src/lib/types";

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

const samplesDir = join(process.cwd(), "public", "samples");
const files = readdirSync(samplesDir).filter((f) => f.endsWith(".fh"));

for (const file of files) {
  const source = readFileSync(join(samplesDir, file), "utf-8");
  console.log(`\n== ${file} (${source.split("\n").length} lines) ==`);
  const { doc, issues } = parseFh(source);
  check(!!doc, "parsed");
  if (!doc) continue;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  console.log(`  issues: ${errors.length} errors, ${warnings.length} warnings`);
  for (const w of warnings) console.log(`  warn: ${w.line ? `L${w.line} ` : ""}${w.message}`);
  for (const e of errors) console.log(`  err:  ${e.line ? `L${e.line} ` : ""}${e.message}`);

  const resolved = resolveDoc(doc);
  check(resolved.errors.length === 0, "resolves without errors");
  if (resolved.errors.length) for (const e of resolved.errors) console.log(`  err:  ${e}`);

  const stats = countNodes(resolved.tree);
  console.log(`  resolved: ${stats.folders} folders, ${stats.files} files, ${stats.total} total`);

  // round-trip: serialize -> reparse must produce identical resolved stats
  const re = parseFh(serializeFh(doc));
  check(!!re.doc, "serialize/reparse ok");
  if (re.doc) {
    const reResolved = resolveDoc(re.doc);
    const reStats = countNodes(reResolved.tree);
    check(reStats.total === stats.total, `round-trip stable (${reStats.total} == ${stats.total})`);
    // comments survive, and serializing is idempotent
    const out1 = serializeFh(doc);
    const out2 = serializeFh(re.doc);
    const commentLines = (t: string) => t.split(/\r?\n/).filter((l) => /^\s*#/.test(l)).length;
    check(commentLines(out1) === commentLines(source), `comments preserved (${commentLines(out1)} == ${commentLines(source)})`);
    check(out1 === out2, "serialize is idempotent");
  }
  const plan = planTree(resolved.tree);
  const planned = countNodes(plan.tree);
  console.log(
    `  on disk: ${planned.folders} folders, ${planned.files} files; ${plan.duplicates} duplicates merged; ` +
      `${plan.errors} name errors; longest path ${plan.longestPath}`,
  );
}

// specific behaviors
console.log(`\n== behavior checks ==`);
{
  // ---- tree editing must preserve the full tree (regression for delete/add) ----
  const { doc } = parseFh(`@root\nA\n\tB\n\t\tC\nD\n`);
  check(!!doc, "tree-edit fixture parses");
  if (doc) {
    const tree = doc.root;
    const a = tree[0];
    const b = a.children[0];
    const c = b.children[0];
    const d = tree[1];

    const afterRemove = removeNode(tree, c.id);
    check(afterRemove.length === 2 && afterRemove[0].name === "A", "remove nested node keeps the full tree");
    check(
      afterRemove[0].children[0].name === "B" && afterRemove[0].children[0].children.length === 0,
      "removed node's parent remains intact",
    );
    check(afterRemove[1].name === "D", "sibling D unaffected by nested removal");

    const child = makeFolder("X");
    const afterInsert = insertChild(tree, b.id, 1, child);
    check(afterInsert.length === 2 && afterInsert[0].name === "A", "insert nested child keeps the full tree");
    check(afterInsert[0].children[0].children.map((n) => n.name).join(",") === "C,X", "nested child inserted into B");

    const afterUpdate = updateNode(tree, b.id, (n) => ({ ...n, name: "B2" }));
    check(afterUpdate[0].name === "A" && afterUpdate[0].children[0].name === "B2", "update nested node keeps the full tree");
    check(afterUpdate[1].name === "D", "sibling D unaffected by nested update");

    const afterTopRemove = removeNode(tree, d.id);
    check(afterTopRemove.length === 1 && afterTopRemove[0].name === "A", "remove top-level node works");
  }
}
{
  const src = `@root\nA\n\t@insert B\n\n@template B\n\tC\n`;
  const { doc } = parseFh(src);
  check(!!doc, "minimal doc parses");
  if (doc) {
    const r = resolveDoc(doc);
    check(r.errors.length === 0, "no recursion error");
    const names = flatten(r.tree).map((n) => n.name);
    check(names.join(",") === "A,C", `insert deposits contents without wrapper folder (got: ${names.join(",")})`);
  }
}
{
  const src = `@root\n\t@insert A\n\n@template A\n\t@insert B\n\n@template B\n\t@insert A\n`;
  const { doc } = parseFh(src);
  if (doc) {
    const r = resolveDoc(doc);
    check(r.errors.length === 1, "circular recursion detected");
    check(r.errors[0].includes("Circular"), `error mentions circular (got: ${r.errors[0]})`);
  }
}
{
  const src = `@root\nA\n\t@insert NOPE\n`;
  const { doc } = parseFh(src);
  if (doc) {
    const r = resolveDoc(doc);
    check(r.errors.length === 1, "missing template detected");
  }
}
{
  // mixed tabs + 4-space indentation (like the real office-directory.fh)
  const src = `@root\nA\n    B\n        C\n`;
  const { doc } = parseFh(src);
  if (doc) {
    check(doc.root[0]?.name === "A", "space-indent A is root");
    check(doc.root[0]?.children[0]?.name === "B", "space-indent B is child of A");
    check(doc.root[0]?.children[0]?.children[0]?.name === "C", "space-indent C is child of B");
  }
}
{
  // display labels
  const src = `@root\nTX "Texas"\n\tDAL "Dallas"\n`;
  const { doc } = parseFh(src);
  if (doc) {
    check(doc.root[0]?.label === "Texas", "label parsed");
    check(doc.root[0]?.children[0]?.label === "Dallas", "nested label parsed");
  }
}
{
  // inline colors on @root / @template should be parsed and round-trip
  const src = `@version 1.0\n@name Test\n\n#---Root---\n@root #ff0000\nA\n\tB\n\t@insert T\n\n#---Templates---\n@template T #00ff00\n\tC "cee"\n`;
  const { doc } = parseFh(src);
  check(!!doc, "inline-color fixture parses");
  if (doc) {
    check(doc.templateColors["@root"] === "#ff0000", "root inline color parsed");
    check(doc.templateColors["T"] === "#00ff00", "template inline color parsed");
    const out = serializeFh(doc);
    check(out.includes("@root #ff0000"), "root color serialized inline");
    check(out.includes("@template T #00ff00"), "template color serialized inline");
    check(!out.includes("@template-color"), "no legacy @template-color emitted");
    const re = parseFh(out);
    check(!!re.doc, "inline-color round-trip parses");
    if (re.doc) {
      check(re.doc.templateColors["@root"] === "#ff0000", "root color round-trips");
      check(re.doc.templateColors["T"] === "#00ff00", "template color round-trips");
      check(re.issues.length === 0, "round-trip has no issues");
    }
  }
}
{
  // legacy @template-color lines are rejected with a warning
  const src = `@root\nA\n@template-color @root #ff0000\nB\n\n@template T\n@template-color T #00ff00\n\tC\n`;
  const { doc, issues } = parseFh(src);
  const warns = issues.filter((i) => i.message.includes("@template-color"));
  check(warns.length === 2, "legacy @template-color warns twice");
  if (doc) {
    check(!doc.templateColors["@root"], "legacy root color ignored");
    check(!doc.templateColors["T"], "legacy template color ignored");
    check(Object.keys(doc.templates).length === 1 && !!doc.templates["T"], "no bogus template from @template-color");
  }
}
{
  // ---- moveNode must move a folder together with its subtree ----
  const { doc } = parseFh(`@root\nA\n\tA1\n\tA2\nB\n\tB1\nC\n`);
  check(!!doc, "move fixture parses");
  if (doc) {
    const tree = doc.root;
    const byName = (ns: ReturnType<typeof makeFolder>[], name: string): any => {
      for (const n of ns) {
        if (n.name === name) return n;
        const f = byName(n.children, name);
        if (f) return f;
      }
      return null;
    };
    const names = (ns: any[]) => ns.map((n) => `${n.name}${n.children.length ? `(${names(n.children)})` : ""}`).join(" ");

    const intoC = moveNode(tree, byName(tree, "A").id, byName(tree, "C").id, "into");
    check(names(intoC) === "B(B1) C(A(A1 A2))", `drop A into C (got: ${names(intoC)})`);

    const b1beforeA2 = moveNode(tree, byName(tree, "B1").id, byName(tree, "A2").id, "before");
    check(names(b1beforeA2) === "A(A1 B1 A2) B C", `drop B1 before A2 (got: ${names(b1beforeA2)})`);

    const aAfterC = moveNode(tree, byName(tree, "A").id, byName(tree, "C").id, "after");
    check(names(aAfterC) === "B(B1) C A(A1 A2)", `drop A after C (got: ${names(aAfterC)})`);

    const cIntoA1 = moveNode(tree, byName(tree, "C").id, byName(tree, "A1").id, "into");
    check(names(cIntoA1) === "A(A1(C) A2) B(B1)", `drop C into A1 (got: ${names(cIntoA1)})`);

    const noop = moveNode(tree, byName(tree, "A").id, byName(tree, "A1").id, "into");
    check(names(noop) === "A(A1 A2) B(B1) C", `drop A into its own child is a no-op (got: ${names(noop)})`);

    const bIntoA2 = moveNode(tree, byName(tree, "B").id, byName(tree, "A2").id, "into");
    check(names(bIntoA2) === "A(A1 A2(B(B1))) C", `drop B into A2 keeps B's subtree (got: ${names(bIntoA2)})`);
  }
}


{
  // ---- comments are part of the model and survive designer edits ----
  const src = `# file header\n@version 1.0\n@name C\n\n#---Root---\n@root\nA\n\t# about B\n\tB\n\t# about the insert\n\t@insert T\n\n#---Templates---\n# two lines\n@template T\n\t# inside T\n\tX\n# the end\n`;
  const { doc } = parseFh(src);
  check(!!doc, "comment fixture parses");
  if (doc) {
    check(doc.headerComments.join("|") === "# file header", "header comment captured");
    check(doc.rootComments.join("|") === "#---Root---", "root comment captured");
    check(doc.templateComments["T"]?.length === 2, "template comments captured");
    check(doc.root[0].children[0].comments?.[0] === "# about B", "node comment captured");
    check(doc.trailingComments.join("|") === "# the end", "trailing comment captured");
    // a designer-style edit: add a folder, then serialize
    const edited = { ...doc, root: insertChild(doc.root, doc.root[0].id, 0, makeFolder("New")) };
    const out = serializeFh(edited);
    for (const c of ["# file header", "#---Root---", "# about B", "# about the insert", "#---Templates---", "# two lines", "# inside T", "# the end"]) {
      check(out.includes(c), `edit keeps comment "${c}"`);
    }
    check(serializeFh(parseFh(out).doc!) === out, "comment round-trip is stable");
  }
}
{
  // ---- explicit folders: trailing slash, and children imply a folder ----
  const src = `@root\nv1.2/\nRev.A/ "Revision A"\nnotes.txt\nrelease.2026\n\tbuild\n`;
  const { doc } = parseFh(src);
  check(!!doc, "folder-marker fixture parses");
  if (doc) {
    const [v, rev, notes, rel] = doc.root;
    check(v.name === "v1.2" && v.forceFolder === true && !isFileNode(v), "v1.2/ is a folder named v1.2");
    check(rev.name === "Rev.A" && rev.label === "Revision A" && !isFileNode(rev), "slash works together with a label");
    check(isFileNode(notes), "notes.txt is still a file");
    check(!isFileNode(rel) && rel.children.length === 1, "a dotted name with children is a folder");
    const out = serializeFh(doc);
    check(out.includes("\nv1.2/\n") && out.includes('Rev.A/ "Revision A"') && out.includes("release.2026/"), "slash is written back");
    check(out.includes("\nnotes.txt\n"), "files are written without a slash");
    const stats = countNodes(resolveDoc(doc).tree);
    check(stats.folders === 4 && stats.files === 1, `stats count dotted folders as folders (${stats.folders}/${stats.files})`);
    check(!serializeFh({ ...doc, root: [makeFolder("Plain")] }).includes("Plain/"), "no slash on names without a dot");
  }
}
{
  // ---- validation: illegal names, reserved names, duplicates, kind conflicts ----
  check(nameProblem("ok_name-1") === null, "normal name passes");
  check(nameProblem("a:b")?.code === "illegal-char", "colon rejected");
  check(nameProblem("a\\b")?.code === "illegal-char", "backslash rejected");
  check(nameProblem("CON")?.code === "reserved" && nameProblem("nul.txt")?.code === "reserved", "reserved device names rejected");
  check(nameProblem("name.")?.code === "trailing", "trailing dot rejected");
  const { doc } = parseFh(`@root\nA\n\tx\na\n\ty\n\tx\nB.txt\nb.txt/\nbad:name\n`);
  if (doc) {
    const plan = planTree(resolveDoc(doc).tree);
    check(plan.tree.map((n) => n.name).join(",") === "A,B.txt,bad:name", `same-name siblings merge (got: ${plan.tree.map((n) => n.name).join(",")})`);
    check(plan.tree[0].children.map((n) => n.name).join(",") === "x,y", "merged folder holds the union of children");
    check(plan.duplicates === 3, `duplicates counted (${plan.duplicates})`);
    check(plan.issues.some((i) => i.code === "kind-conflict"), "file/folder clash is an error");
    check(plan.issues.some((i) => i.code === "illegal-char" && i.path === "bad:name"), "illegal name reported with its path");
    check(plan.longestPath === "bad:name".length, `longest path measured (${plan.longestPath})`);
  }
  const long = parseFh(`@root\n${"x".repeat(120)}\n\t${"y".repeat(120)}\n\t\t${"z".repeat(30)}\n`).doc!;
  check(planTree(resolveDoc(long).tree).issues.some((i) => i.code === "path-length" && i.severity === "error"), "over-long path is an error");
}
{
  // ---- ids survive re-parsing, so UI state is not reset by edits ----
  const a = parseFh(`@root\nA\n\tB\n\tC\nD\n\n@template T\n\tX\n`).doc!;
  const ids = (d: typeof a) => [d.root[0].id, d.root[0].children[0].id, d.root[0].children[1].id, d.root[1].id, d.templates["T"][0].id];
  const same = reconcileIds(parseFh(serializeFh(a)).doc!, a);
  check(ids(same).join() === ids(a).join(), "identical re-parse keeps every id");
  const renamed = reconcileIds(parseFh(`@root\nA\n\tB2\n\tC\nD\n\n@template T\n\tX\n`).doc!, a);
  check(renamed.root[0].children[0].id === a.root[0].children[0].id, "a renamed node keeps its id");
  const inserted = reconcileIds(parseFh(`@root\nNew\nA\n\tB\n\tC\nD\n\n@template T\n\tX\n`).doc!, a);
  check(inserted.root[1].id === a.root[0].id && inserted.root[2].id === a.root[1].id, "inserting a sibling keeps the others' ids");
  check(inserted.root[0].id !== a.root[0].id, "the new node gets a fresh id");
  const tRenamed = reconcileIds(parseFh(`@root\nA\n\tB\n\tC\nD\n\n@template T2\n\tX\n`).doc!, a);
  check(tRenamed.templates["T2"][0].id === a.templates["T"][0].id, "a renamed template keeps its node ids");
  // resolved ids are stable and unique
  const d = parseFh(`@root\nA\n\t@insert T\nB\n\t@insert T\n\n@template T\n\tX\n`).doc!;
  const r1 = resolveDoc(d).tree;
  const r2 = resolveDoc(d).tree;
  check(r1[0].children[0].id === r2[0].children[0].id, "resolved ids are stable between resolves");
  check(r1[0].children[0].id !== r1[1].children[0].id, "the same template inserted twice gets distinct ids");
  check(r1[0].children[0].from === "T", "resolved nodes remember their template");
  const clone = cloneWithNewIds(a.root[0]);
  check(clone.id !== a.root[0].id && clone.children[0].id !== a.root[0].children[0].id, "duplicate re-ids the whole subtree");
  // template helpers
  const dropped = insertRelative(a.root, a.root[0].children[1].id, "after", makeInsert("T"));
  check(dropped[0].children.map((n) => n.name).join(",") === "B,C,T", "template dropped after a row lands there");
  check(countTemplateUses([d.root, d.templates["T"]])["T"] === 2, "template uses counted");
  check(countOwnNodes(d.root) === 2, "own nodes exclude @insert lines");
  check(cleanTemplateName("  My Template ") === "My_Template" && cleanTemplateName("@X") === "X", "template names become one token");
}

// ---- dry run + create against an in-memory folder ----
class MemDir {
  readonly kind = "directory" as const;
  dirs = new Map<string, MemDir>();
  files = new Map<string, string>();
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (name.includes(":")) throw Object.assign(new Error("Name is not allowed."), { name: "TypeError" });
    if (this.files.has(name)) throw Object.assign(new Error("type mismatch"), { name: "TypeMismatchError" });
    let d = this.dirs.get(name);
    if (!d) {
      if (!options?.create) throw Object.assign(new Error("not found"), { name: "NotFoundError" });
      d = new MemDir(name);
      this.dirs.set(name, d);
    }
    return d;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (this.dirs.has(name)) throw Object.assign(new Error("type mismatch"), { name: "TypeMismatchError" });
    if (!this.files.has(name)) {
      if (!options?.create) throw Object.assign(new Error("not found"), { name: "NotFoundError" });
      this.files.set(name, "");
    }
    return { kind: "file" as const, name };
  }
}
const asDir = (d: MemDir) => d as unknown as FileSystemDirectoryHandle;

async function diskChecks() {
  console.log(`\n== disk checks ==`);
  const tree: FsNode[] = planTree(resolveDoc(parseFh(`@root\nP\n\tA\n\t\tnotes.txt\n\tB\nQ\n`).doc!).tree).tree;

  const empty = new MemDir("dest");
  const plan0 = await scanDestination(asDir(empty), tree);
  check(plan0.newCount === 5 && plan0.existCount === 0 && plan0.conflictCount === 0, `fresh folder: everything is new (${plan0.newCount})`);
  check(empty.dirs.size === 0, "the dry run creates nothing");

  const res = await createOnDisk(asDir(empty), tree);
  check(res.created === 5 && res.skipped === 0 && !res.failed, `create writes all 5 (${res.created})`);
  check(empty.dirs.get("P")!.dirs.get("A")!.files.has("notes.txt"), "nested file created");

  // existing content is detected and never touched
  empty.dirs.get("P")!.dirs.get("A")!.files.set("notes.txt", "my notes");
  const plan1 = await scanDestination(asDir(empty), tree);
  check(plan1.newCount === 0 && plan1.existCount === 5, "second scan: everything already exists");
  const res2 = await createOnDisk(asDir(empty), tree);
  check(res2.created === 0 && res2.skipped === 5, "second create writes nothing");
  check(empty.dirs.get("P")!.dirs.get("A")!.files.get("notes.txt") === "my notes", "existing file contents are untouched");

  // partial overlap
  const partial = new MemDir("dest");
  await partial.getDirectoryHandle("P", { create: true });
  const plan2 = await scanDestination(asDir(partial), tree);
  check(plan2.existCount === 1 && plan2.newCount === 4, `partial overlap reported (${plan2.existCount} exist, ${plan2.newCount} new)`);

  // a file where a folder should go is a conflict, along with everything under it
  const clash = new MemDir("dest");
  clash.files.set("P", "");
  const plan3 = await scanDestination(asDir(clash), tree);
  check(plan3.conflictCount === 4 && plan3.newCount === 1, `conflict reported with its subtree (${plan3.conflictCount})`);

  // a failure part-way stops and says where
  const bad: FsNode[] = [
    { id: "1", kind: "folder", name: "ok", children: [] },
    { id: "2", kind: "folder", name: "bad:name", children: [] },
    { id: "3", kind: "folder", name: "never", children: [] },
  ];
  const failDir = new MemDir("dest");
  const res3 = await createOnDisk(asDir(failDir), bad);
  check(res3.created === 1 && res3.failed?.path === "bad:name", "failure reports the path and what was created");
  check(!failDir.dirs.has("never"), "nothing is created after a failure");
}

function flatten(nodes: { name: string; children: unknown[] }[]): { name: string }[] {
  const out: { name: string }[] = [];
  for (const n of nodes) {
    out.push({ name: n.name });
    out.push(...flatten(n.children as { name: string; children: unknown[] }[]));
  }
  return out;
}

diskChecks()
  .catch((err) => {
    failures++;
    console.log(`  FAIL disk checks threw: ${(err as Error).message}`);
  })
  .then(() => {
    console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });