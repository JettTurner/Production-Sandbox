import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

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
      // Order matters: labels first (no markup present yet), so regexes never
      // match against already-injected tag attributes.
      html = html.replace(/("(?:[^"]*)")/g, '<span class="tok-label">$1</span>');
      html = html.replace(/@(version|name|root|template|insert|state|states|location)\b/g, '<span class="tok-dir">@$1</span>');
      html = html.replace(
        /(<span class="tok-dir">@(?:version|name)<\/span>\s+)([^"#<]+)/,
        '$1<span class="tok-meta">$2</span>',
      );
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
  const gutterRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => highlightSource(source), [source]);
  const lineNumbers = useMemo(
    () => source.split("\n").map((_, i) => i + 1).join("\n"),
    [source],
  );

  useEffect(() => {
    const ta = textareaRef.current;
    const pre = backdropRef.current;
    const gutter = gutterRef.current;
    if (!ta || !pre || !gutter) return;
    const sync = () => {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    };
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const apply = (next: string, caretStart: number, caretEnd: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = caretStart;
        ta.selectionEnd = caretEnd;
      });
    };

    // Enter: keep the current line's indentation on the new line.
    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const indent = value.slice(lineStart, start).match(/^[\t ]*/)?.[0] ?? "";
      const next = value.slice(0, start) + "\n" + indent + value.slice(end);
      const caret = start + 1 + indent.length;
      apply(next, caret, caret);
      return;
    }

    if (e.key !== "Tab") return;
    e.preventDefault();
    const multiline = start !== end && value.slice(start, end).includes("\n");
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const blockEndIdx = value.indexOf("\n", end);
    const blockEnd = blockEndIdx === -1 ? value.length : blockEndIdx;
    const block = value.slice(lineStart, blockEnd);

    if (e.shiftKey) {
      const outdented = block.replace(/^\t/, "");
      apply(
        value.slice(0, lineStart) + outdented + value.slice(blockEnd),
        lineStart,
        lineStart + outdented.length,
      );
      return;
    }
    if (multiline) {
      const indented = block.replace(/^(?=.)/gm, "\t");
      apply(
        value.slice(0, lineStart) + indented + value.slice(blockEnd),
        lineStart,
        lineStart + indented.length,
      );
      return;
    }
    const next = value.slice(0, start) + "\t" + value.slice(end);
    apply(next, start + 1, start + 1);
  };

  return (
    <div className="code-wrap">
      <div className="code-linearea">
        <pre ref={gutterRef} className="code-gutter" aria-hidden="true">
          {lineNumbers}
        </pre>
        <div className="code-editor">
          <pre ref={backdropRef} className="code-backdrop" aria-hidden="true">
            <span dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          <textarea
            ref={textareaRef}
            className="code-input"
            value={source}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            wrap="off"
            aria-label="Folder hierarchy source (.fh)"
          />
        </div>
      </div>
      {!source.trim() && <div className="code-empty">Start typing… or design visually in the middle pane.</div>}
    </div>
  );
}