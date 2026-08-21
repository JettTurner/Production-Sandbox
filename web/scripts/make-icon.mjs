// Generates the desktop icons from the app's own artwork
// (public/Production-Sandbox_Icon.svg):
//   web/build/icon.ico  — multi-size ICO embedded into the exe by
//                         electron-builder (auto-detected in build/) and used
//                         as SetupIconFile by the Inno Setup script
//   web/public/icon.png — 256px PNG copied into dist/ and used as the
//                         BrowserWindow/taskbar icon
// Run: node scripts/make-icon.mjs  (or npm run icons)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const root = new URL("../", import.meta.url);
const svg = readFileSync(new URL("public/Production-Sandbox_Icon.svg", root), "utf8");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const pngs = sizes.map((size) => ({
  size,
  data: new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng(),
}));

mkdirSync(new URL("build/", root), { recursive: true });
writeFileSync(new URL("public/icon.png", root), pngs[pngs.length - 1].data);
writeFileSync(new URL("build/icon.ico", root), await pngToIco(pngs.map((p) => p.data)));

console.log(`icons written: build/icon.ico (${sizes.join(", ")}) + public/icon.png (256)`);
