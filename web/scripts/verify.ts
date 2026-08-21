/**
 * Parser/resolver sanity checks. Run with: npm run verify
 * (no test framework — just asserts over the sample .fh files)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFh } from "../src/lib/parser";
import { resolveDoc, countNodes } from "../src/lib/resolver";
import { serializeFh } from "../src/lib/serializer";
import { removeNode, insertChild, updateNode, moveNode } from "../src/lib/treeEdit";
import { makeFolder } from "../src/lib/treeEdit";

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
  }
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

function flatten(nodes: { name: string; children: unknown[] }[]): { name: string }[] {
  const out: { name: string }[] = [];
  for (const n of nodes) {
    out.push({ name: n.name });
    out.push(...flatten(n.children as { name: string; children: unknown[] }[]));
  }
  return out;
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);