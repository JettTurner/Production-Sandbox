import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Running as the Electron desktop app: the header doubles as the window
// title bar (see the html.electron rules in index.css).
if (/Electron\b/.test(navigator.userAgent)) {
  document.documentElement.classList.add("electron");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);