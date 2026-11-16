import { useEffect, useRef } from "react";
// The repo's CHANGELOG.md is the single source for release notes (bump-version.ps1 starts each section).
import changelog from "../../../CHANGELOG.md?raw";
import { XIcon } from "./icons";

interface Section {
  title: string;
  items: string[];
}

/** Minimal reader for the changelog's shape: `## X.Y.Z (date)` headings with `- ` items. */
export function parseChangelog(text: string): Section[] {
  const out: Section[] = [];
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) out.push({ title: h[1].trim(), items: [] });
    else if (/^\s*-\s+/.test(line) && out.length) out[out.length - 1].items.push(line.replace(/^\s*-\s+/, "").trim());
  }
  return out;
}

export default function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sections = parseChangelog(changelog);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog narrow" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
        <div className="dialog-head">
          <div>
            <h2 id="whatsnew-title">What’s new</h2>
            <span>Folder Hierarchy Studio {__APP_VERSION__}</span>
          </div>
          <button ref={closeRef} type="button" className="icon-btn big" aria-label="Close" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className="dialog-body single whatsnew">
          {sections.length === 0 && <p>No release notes yet.</p>}
          {sections.map((s) => (
            <section key={s.title}>
              <h3>{s.title}</h3>
              <ul>
                {s.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
