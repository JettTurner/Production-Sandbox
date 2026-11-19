import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";

// Running as the Electron desktop app: the header doubles as the window
// title bar (see the html.electron rules in index.css).
const isElectron = /Electron\b/.test(navigator.userAgent);
if (isElectron) {
  document.documentElement.classList.add("electron");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    {/* Vercel Web Analytics: page views on the hosted site only. The desktop
        app works offline and has no /_vercel endpoint, so it is left out. */}
    {!isElectron && <Analytics />}
  </React.StrictMode>,
);