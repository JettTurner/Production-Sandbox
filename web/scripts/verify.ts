/**
 * Parser/resolver sanity checks. Run with: npm run verify
 * (no test framework — just asserts over the sample .fh files)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFh } from "../src/lib/parser";
import { resolveDoc, countNodes } from "../src/lib/resolver";
import { serializeFh } from "../src/lib/serializer";
import { parseFh as parseFhAgain } from "../src/lib/parser";

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
  const src = `@root\nA\n\t@insert B\n\n@template B\n\tC\n`;
  const { doc } = parseFh(src);
  check(!!doc, "minimal doc parses");
  if (doc) {
    const r = resolveDoc(doc);
    check(r.errors.length === 0, "no recursion error");
    const names = flatten(r.tree).map((n) => n.name);
    check(names.join(",") === "A,B,C", `insert expands in place (got: ${names.join(",")})`);
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