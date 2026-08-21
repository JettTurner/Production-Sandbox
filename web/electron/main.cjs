// Electron main process for Folder Hierarchy Studio.
//
// The renderer is the production Vite build (web/dist). It is served through a
// custom `app://` protocol instead of file:// so that runtime `fetch()` calls
// (e.g. the bundled /samples/*.fh files) work — Chromium blocks fetch() on
// file:// origins, but allows it on registered custom schemes.

const { app, BrowserWindow, protocol, net, shell } = require("electron");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { pathToFileURL } = require("node:url");

const DIST_DIR = path.join(__dirname, "..", "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Matches .header in src/index.css (padding 10px + 26px brand row) and the
// GitHub-ish palette variables (--bg-elev / --text) so the native window
// controls blend into the app's own header.
const TITLEBAR_HEIGHT = 46;
const TITLEBAR_COLOR = "#161b22";
const TITLEBAR_SYMBOL_COLOR = "#e6edf3";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  const iconPath = path.join(DIST_DIR, "icon.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Folder Hierarchy Studio",
    backgroundColor: "#0d1117",
    autoHideMenuBar: true,
    // The app's own header becomes the title bar: it is a CSS drag region and
    // Windows draws min/max/close on top of it via the overlay below.
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: TITLEBAR_COLOR,
      symbolColor: TITLEBAR_SYMBOL_COLOR,
      height: TITLEBAR_HEIGHT,
    },
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open target=_blank links in the system browser instead of a new window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadURL("app://bundle/index.html");
  }
}

app.whenReady().then(() => {
  // app://bundle/<path> -> <web/dist>/<path>
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (pathname === "") pathname = "index.html";
    const filePath = path.normalize(path.join(DIST_DIR, pathname));
    if (path.relative(DIST_DIR, filePath).startsWith("..")) {
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
