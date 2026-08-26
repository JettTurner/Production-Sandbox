import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

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
      html = html.replace(/(#[0-9a-fA-F]{3,8}\b)/g, '<span class="tok-hex">$1</span>');
      return html;
    })
    .join("\n");
}

// --- Contenteditable caret helpers -----------------------------------------
// A contenteditable exposes its caret/selection as a DOM Range, not numeric
// offsets. These convert between Range <-> absolute character offset within the
// editor so we can preserve the caret across React re-renders.

function posFor(container: HTMLElement, target: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = target;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) return { node: node as Text, offset: remaining };
    remaining -= len;
  }
  return null;
}

function getOffsets(container: HTMLElement): { start: number; end: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }
  const startRange = document.createRange();
  startRange.selectNodeContents(container);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = document.createRange();
  endRange.selectNodeContents(container);
  endRange.setEnd(range.endContainer, range.endOffset);
  return { start: startRange.toString().length, end: endRange.toString().length };
}

function setOffsets(container: HTMLElement, start: number, end: number): void {
  const range = document.createRange();
  const startPos = posFor(container, start);
  const endPos = posFor(container, end);
  if (startPos) range.setStart(startPos.node, startPos.offset);
  else range.setStart(container, 0);
  if (endPos) range.setEnd(endPos.node, endPos.offset);
  else range.setEnd(container, container.childNodes.length);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

export default function CodePane({ source, onChange }: CodePaneProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineareaRef = useRef<HTMLDivElement>(null);
  const pendingCaretRef = useRef<{ start: number; end: number } | null>(null);

  const highlighted = useMemo(() => highlightSource(source), [source]);
  const lineNumbers = useMemo(
    () => source.split("\n").map((_, i) => i + 1).join("\n"),
    [source],
  );

  // The gutter is a separate <pre>, so drive its typography/padding from the
  // editable's real computed metrics to guarantee the numbers line up with the
  // text lines. The caret/selection live IN the editable, so they can never
  // drift from the rendered text.
  useLayoutEffect(() => {
    const ed = editableRef.current;
    const wrap = lineareaRef.current;
    if (!ed || !wrap) return;
    const cs = getComputedStyle(ed);
    const s = wrap.style;
    s.setProperty("--code-font", cs.fontFamily);
    s.setProperty("--code-size", cs.fontSize);
    s.setProperty("--code-leading", cs.lineHeight);
    s.setProperty("--code-pad-top", cs.paddingTop);
    s.setProperty("--code-pad-left", cs.paddingLeft);
    s.setProperty("--code-pad-right", cs.paddingRight);
  }, []);

  // Restore the caret after React replaces the editable's HTML on re-render.
  useLayoutEffect(() => {
    const ed = editableRef.current;
    const pending = pendingCaretRef.current;
    if (!ed || !pending) return;
    pendingCaretRef.current = null;
    setOffsets(ed, pending.start, pending.end);
  }, [source]);

  // Keep the line-number gutter scrolled in step with the text (editor scroller).
  useEffect(() => {
    const sc = scrollerRef.current;
    const gt = gutterRef.current;
    if (!sc || !gt) return;
    const sync = () => {
      gt.scrollTop = sc.scrollTop;
    };
    sc.addEventListener("scroll", sync);
    sync();
    return () => sc.removeEventListener("scroll", sync);
  }, []);

  const handleInput = () => {
    const ed = editableRef.current;
    if (!ed) return;
    const offs = getOffsets(ed);
    const text = ed.textContent ?? "";
    if (text !== source) {
      pendingCaretRef.current = offs;
      onChange(text);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (text) document.execCommand("insertText", false, text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ed = editableRef.current;
    if (!ed) return;
    const { start, end } = getOffsets(ed);
    const value = ed.textContent ?? "";
    const apply = (next: string, caretStart: number, caretEnd: number) => {
      pendingCaretRef.current = { start: caretStart, end: caretEnd };
      onChange(next);
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
      <div className="code-linearea" ref={lineareaRef}>
        <pre ref={gutterRef} className="code-gutter" aria-hidden="true">
          {lineNumbers}
        </pre>
        <div ref={scrollerRef} className="code-editor">
          <div
            ref={editableRef}
            className="code-editable"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            aria-label="Folder hierarchy source (.fh)"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      </div>
      {!source.trim() && <div className="code-empty">Start typing… or design visually in the middle pane.</div>}
    </div>
  );
}
