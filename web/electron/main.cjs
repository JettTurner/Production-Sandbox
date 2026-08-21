// Electron main process for Folder Hierarchy Studio.
//
// The renderer is the production Vite build (web/dist). It is served through a
// custom `app://` protocol instead of file:// so that runtime `fetch()` calls
// (e.g. the bundled /samples/*.fh files) work — Chromium blocks fetch() on
// file:// origins, but allows it on registered custom schemes.

const { app, BrowserWindow, protocol, net, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST_DIR = path.join(__dirname, "..", "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Folder Hierarchy Studio",
    backgroundColor: "#0d1117",
    autoHideMenuBar: true,
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
