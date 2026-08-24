import { useEffect, useCallback } from "react";
import type { FsNode } from "../lib/types";
import Designer from "./Designer";
import SectionPicker from "./SectionPicker";

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  templates: string[];
  active: string | null;
  tree: FsNode[];
  templateColors: Record<string, string>;
  onSelect: (name: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onSetTemplateColor: (name: string, color: string) => void;
  onNodesChange: (nodes: FsNode[]) => void;
}

export default function TemplatesModal({
  open,
  onClose,
  templates,
  active,
  tree,
  templateColors,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetTemplateColor,
  onNodesChange,
}: TemplatesModalProps) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="templates-modal-head">
          <span className="title">Templates</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>reusable structures</span>
          <button className="icon-btn" onClick={onClose} title="Close templates">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
          </button>
        </div>
        <SectionPicker
          templates={templates}
          active={active}
          templateColors={templateColors}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDelete={onDelete}
          onSetTemplateColor={onSetTemplateColor}
        />
        <div className="templates-modal-body">
          {active ? (
            <Designer
              nodes={tree}
              section={{ kind: "template", name: active }}
              templates={templates}
              onNodesChange={onNodesChange}
            />
          ) : (
            <div className="empty-hint">
              <div className="big">🗂️</div>
              Select a template above to design it, or add a new one with + Template.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
