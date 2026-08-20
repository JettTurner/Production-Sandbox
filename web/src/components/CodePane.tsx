import { useEffect, useMemo, useRef } from "react";

interface CodePaneProps {
  source: string;
  onChange: (value: string) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightSource(source: string): string {
  const lines = source.split("\n");
  return lines
    .map((line) => {
      if (/^\s*#/.test(line)) {
        return `<span class="tok-comment">${escapeHtml(line)}</span>`;
      }
      let html = escapeHtml(line);
      html = html.replace(
        /(@(?:version|name|root|template|insert|state|states|location)\b)/g,
        '<span class="tok-dir">$1</span>',
      );
      html = html.replace(/("(?:[^"]*)")/g, '<span class="tok-label">$1</span>');
      // Color the value of @version / @name
      html = html.replace(
        /(<span class="tok-dir">@(?:version|name)<\/span>\s+)([^"#]+)/,
        '$1<span class="tok-meta">$2</span>',
      );
      // Color template/insert names
      html = html.replace(
        /(<span class="tok-dir">@(?:template|insert)<\/span>\s+)([\w\-_.]+)/,
        '$1<span class="tok-string">$2</span>',
      );
      return html;
    })
    .join("\n");
}

export default function CodePane({ source, onChange }: CodePaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => highlightSource(source), [source]);

  useEffect(() => {
    const ta = textareaRef.current;
    const pre = backdropRef.current;
    if (!ta || !pre) return;
    const sync = () => {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, []);

  return (
    <div className="code-wrap">
      <pre ref={backdropRef} className="code-backdrop" aria-hidden="true">
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      <textarea
        ref={textareaRef}
        className="code-input"
        value={source}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        wrap="off"
        aria-label="Folder hierarchy source (.fh)"
      />
      {!source.trim() && <div className="code-empty">Start typing… or design visually in the middle pane.</div>}
    </div>
  );
}