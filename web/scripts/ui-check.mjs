/**
 * Browser checks for Folder Hierarchy Studio. Run with: npm run test:ui
 *
 * Builds are served by Vite's preview server and driven in a real browser that
 * is already installed (Edge on Windows, Chrome elsewhere); nothing is
 * downloaded. Set FH_BROWSER=chrome|msedge to choose, FH_HEADED=1 to watch.
 *
 * File pickers cannot be automated, so an in-memory folder stands in for the
 * real one (see FAKE_FS). Everything else is the real app.
 */
import { preview } from "vite";
import { chromium } from "playwright-core";

const PORT = 4199;
const URL = `http://localhost:${PORT}/`;
const channel = process.env.FH_BROWSER ?? (process.platform === "win32" ? "msedge" : "chrome");

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

// An in-memory stand-in for showDirectoryPicker (create + import).
const FAKE_FS = `(() => {
  class MemDir {
    constructor(name) { this.kind = "directory"; this.name = name; this.dirs = new Map(); this.files = new Map(); }
    async getDirectoryHandle(n, o) {
      if (this.files.has(n)) throw Object.assign(new Error("mismatch"), { name: "TypeMismatchError" });
      let d = this.dirs.get(n);
      if (!d) { if (!(o && o.create)) throw Object.assign(new Error("nf"), { name: "NotFoundError" }); d = new MemDir(n); this.dirs.set(n, d); }
      return d;
    }
    async getFileHandle(n, o) {
      if (this.dirs.has(n)) throw Object.assign(new Error("mismatch"), { name: "TypeMismatchError" });
      if (!this.files.has(n)) { if (!(o && o.create)) throw Object.assign(new Error("nf"), { name: "NotFoundError" }); this.files.set(n, ""); }
      return { kind: "file", name: n };
    }
    async *entries() { for (const [n, d] of this.dirs) yield [n, d]; for (const n of this.files.keys()) yield [n, { kind: "file", name: n }]; }
    count() { let n = 0; for (const d of this.dirs.values()) n += 1 + d.count(); return n; }
    names() { return [...this.dirs.keys()]; }
  }
  const dest = new MemDir("Design");
  const existing = new MemDir("OldStudio");
  (async () => {
    const a = await existing.getDirectoryHandle("Clients", { create: true });
    await a.getDirectoryHandle("Acme", { create: true });
    await existing.getDirectoryHandle("Admin", { create: true });
    await existing.getDirectoryHandle(".git", { create: true });
  })();
  window.__dest = dest;
  window.showDirectoryPicker = async (o) => (o && o.id === "fh-import" ? existing : dest);
})();`;

const server = await preview({ preview: { port: PORT, strictPort: true, open: false }, logLevel: "silent" });
const browser = await chromium.launch({ channel, headless: !process.env.FH_HEADED });
const pageErrors = [];

async function open(opts = {}) {
  const context = await browser.newContext({ viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 } });
  if (!opts.firstRun) await context.addInitScript(`try { if (!sessionStorage.getItem("ui-check")) { localStorage.setItem("fh-seen", "1"); sessionStorage.setItem("ui-check", "1"); } } catch (e) {}`);
  await context.addInitScript(FAKE_FS);
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.goto(URL);
  await page.waitForTimeout(800);
  return page;
}
const sample = async (page, label) => {
  await page.click('[aria-label="More actions"]');
  await page.click(`.more-item:has-text("${label}")`);
  await page.waitForTimeout(500);
};
const view = async (page, name) => {
  await page.click(`.segmented button:has-text("${name}")`);
  await page.waitForTimeout(200);
};
const sourceText = async (page) => {
  await page.click(".source-toggle");
  await page.waitForTimeout(150);
  const text = await page.innerText(".code-editable");
  await page.click(".source-toggle");
  return text;
};
const card = (name) => `.card:has(> .card-head .card-title:text-is("${name}"))`;
const drag = async (page, from, to, fx = 0.5, fy = 0.5) => {
  const s = await page.locator(from).first().boundingBox();
  const t = await page.locator(to).first().boundingBox();
  await page.mouse.move(s.x + 12, s.y + 12);
  await page.mouse.down();
  await page.mouse.move(s.x + 30, s.y + 30, { steps: 4 });
  await page.mouse.move(t.x + t.width * fx, t.y + t.height * fy, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
};

try {
  console.log(`\n== ui checks (${channel}) ==`);
  const page = await open();

  // ---- loading and the three views ----
  await sample(page, "VizLab");
  check((await page.innerText(".stats div:nth-child(1) dd")) === "974", "VizLab sample resolves to 974 folders");
  check((await page.innerText(".statusbar .status")).includes("No problems"), "no problems reported");
  await view(page, "Blocks");
  check((await page.locator(".board > .card:not(.add-card)").count()) === 8, "Blocks: starts inside the single top folder (8 cards)");
  check((await page.locator(`${card("07_Admin")} .subcard`).count()) === 1, "Blocks: a folder with contents nests as a box inside its card");
  check((await page.locator(`${card("04_Library")} .brick`).count()) === 1, "Blocks: only real blocks are drawn as bricks");
  await view(page, "Columns");
  for (const n of ["VIZLAB", "01_VL", "_2025", "TESTPROJECTSVL25"]) await page.click(`.col-row:has-text("${n}") .name`);
  check((await page.locator(".column").count()) === 5 && (await page.locator(".column.in-block").count()) === 1, "Columns: selecting opens the next level; a block's contents are boxed");
  await view(page, "List");
  check((await page.locator(".editor .tree-row").count()) === 45, "List: the whole section as one list (45 rows)");

  // ---- editing keeps comments, dotted folders stay folders ----
  await page.click('.tree-row:has-text("_Plugins") .name');
  await page.keyboard.press("F2");
  await page.keyboard.type("v1.2");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  let text = await sourceText(page);
  check(text.includes("v1.2/"), "renaming a folder to a dotted name keeps it a folder (v1.2/)");
  check(text.includes("#--- Asset Library ---"), "comments survive an edit made in a view");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  check((await page.locator('.tree-row:has-text("_Plugins")').count()) === 1, "undo restores the name");

  // ---- validation blocks unsafe output ----
  await page.click('.tree-row:has-text("_Programs") .name');
  await page.keyboard.press("F2");
  await page.keyboard.type("a:b");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  check((await page.locator(".output .check.error").count()) === 1 && (await page.isDisabled(".output-actions .btn.primary")), "an illegal name is flagged and Create is disabled");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);

  // ---- Blocks: drag a block in, rearrange, keyboard ----
  await view(page, "Blocks");
  await drag(page, '.side-item:has-text("HDRI_LIB")', card("05_Tools"));
  check((await page.locator(`${card("05_Tools")} .brick`).count()) === 1, "Blocks: a block dragged from the sidebar lands in the card");
  await drag(page, `${card("05_Tools")} .card-item:has-text("_Plugins")`, card("06_Templates"), 0.5, 0.15);
  check((await page.locator(`${card("06_Templates")} .card-item:has-text("_Plugins")`).count()) === 1, "Blocks: dragging a folder onto another card moves it inside");
  await page.focus(`${card("06_Templates")} > .card-head .card-title`);
  await page.keyboard.press("Alt+ArrowLeft");
  await page.waitForTimeout(200);
  const order = (await page.locator(".board > .card > .card-head .card-title").allInnerTexts()).map((t) => t.trim());
  check(order.indexOf("06_Templates") < order.indexOf("05_Tools"), "Blocks: Alt+arrow reorders cards");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check((await page.innerText(".crumbs")).includes("06_Templates"), "Blocks: Enter goes into a folder");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(200);
  check(!(await page.innerText(".crumbs")).includes("06_Templates"), "Blocks: Backspace goes back up");

  // ---- a path back out of a block ----
  await page.dblclick(`${card("04_Library")} .brick`);
  await page.waitForTimeout(300);
  check((await page.innerText(".editor-title")).trim() === "MAINLIBRARY" && (await page.locator(".crumb-origin").count()) === 1, "opening a block shows where you came from");
  await page.click(".crumb-origin button");
  await page.waitForTimeout(300);
  check((await page.innerText(".editor-title")).trim() === "Root", "the path leads back out of the block");

  // ---- Find ----
  await page.keyboard.press("Control+f");
  await page.keyboard.type("receipts");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  check((await page.evaluate(() => document.activeElement?.textContent ?? "")).includes("_Receipts"), "Find jumps to the match");

  // ---- the session survives a reload ----
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForTimeout(900);
  check((await page.inputValue(".doc-name")) === "PBK Vizlab Structure" && (await page.locator(".pill").count()) === 1, "reload restores the document, still marked unsaved");
  check((await page.innerText(".segmented button.active")).trim() === "Blocks", "reload remembers the view");

  // ---- tidy-up ----
  await sample(page, "Office Directory");
  check((await page.innerText(".side-hint.tidy")).includes("3 blocks"), "unused blocks are pointed out");
  await page.click(".side-hint.tidy .link-btn");
  await page.waitForTimeout(300);
  check((await page.innerText(".sidebar")).toUpperCase().includes("BLOCKS · 3"), "unused blocks can be removed in one click");

  // ---- New: start from a kit; fill-in names; create with a dry run ----
  await page.click('.toolbar button:has-text("New")');
  await page.click(".dialog-foot .btn.primary");
  await page.click('.chip:has-text("By client")');
  await page.waitForTimeout(200);
  const count = await page.innerText(".wizard-count");
  await page.click(".dialog-foot .btn.primary");
  await page.fill("#kit-name", "Studio");
  await page.click(".dialog-foot .btn.primary");
  await page.waitForTimeout(500);
  check((await page.inputValue(".doc-name")) === "Studio" && `${await page.innerText(".stats div:nth-child(1) dd")} folders` === count, `kit builds what its preview promised (${count})`);
  check((await page.innerText(".output .checks")).includes("Project"), "the output says Create will ask for the project name");
  await page.click('.side-item:has-text("PROJECT")');
  await page.click('.editor-head button:has-text("Create one")');
  await page.fill("#wrap-name", "{yymmdd}_{Client}_{Project}");
  await page.waitForTimeout(300);
  check((await page.locator(".blank-row").count()) === 2 && (await page.isDisabled(".dialog-foot .btn.primary")), "Create one: blanks must be filled in first");
  await page.fill('.blank-row input[aria-label="Client"]', "Acme");
  await page.fill('.blank-row input[aria-label="Project"]', "Tower");
  await page.click('button:has-text("Choose")');
  await page.waitForTimeout(900);
  check((await page.innerText(".plan-stats .accent b")) === "8", "dry run: 8 new folders, nothing written yet");
  check((await page.evaluate(() => window.__dest.count())) === 0, "the dry run created nothing");
  await page.click(".dialog-foot .btn.primary");
  await page.waitForTimeout(700);
  const made = await page.evaluate(() => window.__dest.names());
  check(made.length === 1 && /^\d{6}_Acme_Tower$/.test(made[0]), `created with the names filled in (${made[0]})`);
  check((await page.innerText(".dialog-status")).startsWith("Done"), "create reports what it did");
  await page.click('.dialog-foot button:has-text("Close")');

  // ---- import an existing folder ----
  await page.click('[aria-label="More actions"]');
  await page.click('.more-item:has-text("Import a folder")');
  await page.waitForTimeout(600);
  check((await page.inputValue(".doc-name")) === "OldStudio" && (await page.innerText(".stats div:nth-child(1) dd")) === "4", "import reads a folder's layout (hidden folders skipped)");

  // ---- theme and what's new ----
  await page.click('[aria-label="More actions"]');
  await page.click('.more-item:has-text("Light theme")');
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === "light" && lightBg === "rgb(243, 242, 238)", "light theme repaints the app");
  await page.click('[aria-label="More actions"]');
  await page.click('.more-item:has-text("Dark theme")');
  await page.click('[aria-label="More actions"]');
  await page.click('.more-item:has-text("What’s new")');
  check((await page.locator(".whatsnew section").count()) >= 1, "What's new shows the changelog");
  await page.keyboard.press("Escape");

  // ---- several things at once ----
  {
    const multi = await open();
    await sample(multi, "VizLab");
    const row = (n) => `.editor .tree-row:has(.name:text-is("${n}"))`;
    const undo = async () => { await multi.keyboard.press("Control+z"); await multi.waitForTimeout(200); };
    await view(multi, "List");
    await multi.click(`${row("_AI")} .name`);
    await multi.click(`${row("_Twinmotion")} .name`, { modifiers: ["Shift"] });
    check((await multi.locator(".editor .tree-row.selected, .editor .tree-row.also-selected").count()) === 3, "List: Shift-click selects a range");
    await multi.keyboard.press("Delete");
    await multi.waitForTimeout(200);
    let src = await sourceText(multi);
    check(!/^\s*(_AI|_Blender|_Twinmotion)$/m.test(src) && /^\s*_D5$/m.test(src), "List: Del deletes everything selected");
    await undo();
    await multi.click(`${row("_AI")} .name`);
    await multi.click(`${row("_D5")} .name`, { modifiers: ["Control"] });
    check((await multi.locator(".editor .tree-row.selected, .editor .tree-row.also-selected").count()) === 2, "List: Ctrl-click adds to the selection");
    await drag(multi, `${row("_D5")} .drag`, row("_Programs"));
    src = await sourceText(multi);
    check(/_Programs\n\s+_AI\n\s+_D5\n/.test(src), "List: dragging one of the selection moves all of it, in order");
    await undo();
    await multi.click(`${row("_AI")} .name`);
    await multi.keyboard.press("Shift+ArrowDown");
    await multi.keyboard.press("Shift+ArrowDown");
    check((await multi.locator(".editor .tree-row.selected, .editor .tree-row.also-selected").count()) === 3, "List: Shift+arrows extend the selection");
    await multi.keyboard.press("Escape");
    check((await multi.locator(".editor .tree-row.also-selected").count()) === 0, "List: Esc goes back to one");

    await view(multi, "Columns");
    const crow = (n) => `.col-row:has(.name:text-is("${n}"))`;
    await multi.click(`${crow("VIZLAB")} .name`);
    await multi.click(`${crow("06_Templates")} .name`);
    await multi.click(`${crow("_AI")} .name`);
    await multi.click(`${crow("_Twinmotion")} .name`, { modifiers: ["Shift"] });
    await multi.click(`${crow("_Blender")} .name`, { modifiers: ["Control"] });
    check((await multi.locator(".col-row.also-selected").count()) === 1 && (await multi.locator(".column").count()) >= 3, "Columns: Shift-click a range, Ctrl-click takes one out");
    await drag(multi, crow("_AI"), crow("05_Tools"));
    src = await sourceText(multi);
    check(/_Plugins\n\s+_AI\n\s+_Twinmotion\n/.test(src) && /06_Templates\n\s+_Blender\n/.test(src), "Columns: the selection is dragged into a folder together");
    await undo();

    await view(multi, "Blocks");
    const item = (n) => `.card-item:has(.name-btn:text-is("${n}"))`;
    await multi.click(item("_AI"), { modifiers: ["Control"], position: { x: 6, y: 6 } });
    await multi.click(`${item("_D5")} .name-btn`, { modifiers: ["Control"] });
    check((await multi.locator(".is-selected").count()) === 2 && (await multi.locator(".board > .card:not(.add-card)").count()) === 8, "Blocks: Ctrl-click selects instead of going into the folder");
    await drag(multi, item("_D5"), `${card("05_Tools")} > .card-head`);
    src = await sourceText(multi);
    check(/_Plugins\n\s+_AI\n\s+_D5\n/.test(src), "Blocks: the selection is dragged into another card together");
    await undo();
    await multi.click(`${item("_AI")} .name-btn`, { modifiers: ["Control"] });
    await multi.click(`${item("_Sketchup")} .name-btn`, { modifiers: ["Shift"] });
    check((await multi.locator(".is-selected").count()) === 5, "Blocks: Shift-click selects a range");
    await multi.keyboard.press("Delete");
    await multi.waitForTimeout(200);
    src = await sourceText(multi);
    check(/06_Templates\n\s+07_Admin/.test(src), "Blocks: Del deletes everything selected");
    await multi.context().close();
  }

  // ---- first run opens the New dialog ----
  const fresh = await open({ firstRun: true });
  check((await fresh.locator(".dialog.wizard").count()) === 1, "a first run starts in the New dialog");
  await fresh.context().close();

  // ---- phone layout ----
  const phone = await open({ width: 390, height: 844 });
  check((await phone.locator(".mobile-tabs button").count()) === 3 && !(await phone.isVisible(".sidebar")), "phone: one pane at a time behind bottom tabs");
  await phone.click('.mobile-tabs button:has-text("Output")');
  check(await phone.isVisible(".output"), "phone: the Output tab shows the output");
  await phone.context().close();

  check(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors[0]}` : ""}`);
} catch (err) {
  failures++;
  console.log(`  FAIL the run stopped early: ${err.message.split("\n")[0]}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

console.log(`\n${failures === 0 ? "ALL UI CHECKS PASSED" : `${failures} UI CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
