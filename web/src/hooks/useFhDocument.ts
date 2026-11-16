import { useCallback, useMemo, useRef, useState } from "react";
import { parseFh } from "../lib/parser";
import { serializeFh } from "../lib/serializer";
import { reconcileIds } from "../lib/ids";
import { emptyDocument } from "../lib/types";
import type { FhDocument, ParseIssue } from "../lib/types";

const MAX_HISTORY = 100;
/** Typing in the source editor within this window is one undo step. */
const COALESCE_MS = 800;

/** Line endings are normalized on the way in so the editor and dirty check agree. */
export function normalizeSource(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

interface Live {
  source: string;
  doc: FhDocument;
  issues: ParseIssue[];
}

function parseLive(source: string, prev: FhDocument | null): Live {
  const { doc, issues } = parseFh(source);
  return { source, doc: reconcileIds(doc ?? emptyDocument(), prev), issues };
}

/**
 * Owns the .fh source text, the parsed document derived from it, undo/redo
 * history and the saved-state baseline.
 *
 * The source string is the single source of truth. Every change goes through
 * `applySource` (text edits) or `commitDoc` (designer edits, which serialize a
 * modified document). The parsed document keeps its node ids across re-parses
 * (lib/ids.ts), so collapse/selection state in the UI survives edits.
 */
export function useFhDocument(initialSource: string) {
  const [source, setSource] = useState(initialSource);
  const [baseline, setBaseline] = useState(initialSource);
  const [historyTick, setHistoryTick] = useState(0);

  const liveRef = useRef<Live | null>(null);
  if (liveRef.current === null) liveRef.current = parseLive(initialSource, null);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastApplyRef = useRef(0);

  /** Parsed state for `text`, reusing the cached parse when it is current. */
  const liveFor = useCallback((text: string): Live => {
    const cur = liveRef.current!;
    if (cur.source === text) return cur;
    const next = parseLive(text, cur.doc);
    liveRef.current = next;
    return next;
  }, []);

  const live = useMemo(() => liveFor(source), [source, liveFor]);

  const pushHistory = useCallback((discrete: boolean) => {
    const current = liveRef.current!.source;
    const now = Date.now();
    const coalesce = !discrete && now - lastApplyRef.current < COALESCE_MS && pastRef.current.length > 0;
    if (!coalesce) pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), current];
    lastApplyRef.current = discrete ? 0 : now;
    futureRef.current = [];
  }, []);

  /** Replace the source text. `discrete` forces its own undo step. */
  const applySource = useCallback(
    (next: string, discrete = false) => {
      if (next === liveRef.current!.source) return;
      pushHistory(discrete);
      liveFor(next);
      setSource(next);
      setHistoryTick((t) => t + 1);
    },
    [liveFor, pushHistory],
  );

  /**
   * Apply a designer edit. Always builds on the freshest document (not the
   * render-time snapshot), so several commits in one tick compose correctly.
   */
  const commitDoc = useCallback(
    (update: (d: FhDocument) => FhDocument) => {
      const cur = liveRef.current!;
      const edited = update(cur.doc);
      const text = serializeFh(edited);
      if (text === cur.source) return;
      pushHistory(true);
      const { doc, issues } = parseFh(text);
      // Take ids from the edited document so new nodes keep the ids the UI gave them.
      liveRef.current = { source: text, doc: reconcileIds(doc ?? emptyDocument(), edited), issues };
      setSource(text);
      setHistoryTick((t) => t + 1);
    },
    [pushHistory],
  );

  const step = useCallback(
    (from: React.MutableRefObject<string[]>, to: React.MutableRefObject<string[]>) => {
      const target = from.current[from.current.length - 1];
      if (target === undefined) return;
      to.current = [...to.current, liveRef.current!.source].slice(-MAX_HISTORY);
      from.current = from.current.slice(0, -1);
      lastApplyRef.current = 0;
      liveFor(target);
      setSource(target);
      setHistoryTick((t) => t + 1);
    },
    [liveFor],
  );
  const undo = useCallback(() => step(pastRef, futureRef), [step]);
  const redo = useCallback(() => step(futureRef, pastRef), [step]);

  /**
   * Load a new document: replaces the text, clears history, resets the baseline.
   * `unsaved` marks it as having unsaved changes from the start (generated
   * content that exists nowhere else yet).
   */
  const load = useCallback((text: string, unsaved = false) => {
    const normalized = normalizeSource(text);
    pastRef.current = [];
    futureRef.current = [];
    lastApplyRef.current = 0;
    liveRef.current = parseLive(normalized, null);
    setSource(normalized);
    setBaseline(unsaved ? "" : normalized);
    setHistoryTick((t) => t + 1);
  }, []);

  const markSaved = useCallback(() => setBaseline(liveRef.current!.source), []);

  void historyTick; // re-render so canUndo/canRedo stay current
  return {
    source,
    doc: live.doc,
    issues: live.issues,
    dirty: source !== baseline,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    applySource,
    commitDoc,
    undo,
    redo,
    load,
    markSaved,
  };
}
