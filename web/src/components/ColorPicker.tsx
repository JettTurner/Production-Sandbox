import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "./icons";

const PALETTE = [
  "#bc8cff", "#f97583", "#79c0ff", "#56d4dd",
  "#d2a8ff", "#ffa657", "#7ee787", "#ff7b72",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [previewValue, setPreviewValue] = useState(value);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectColor = (color: string) => {
    setPreviewValue(color);
    onChange(color);
    setOpen(false);
  };

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="color-picker-dropdown"
      style={{
        position: "fixed",
        top: anchorRef.current?.getBoundingClientRect().bottom ?? 0,
        left: anchorRef.current?.getBoundingClientRect().left ?? 0,
        zIndex: 300,
      }}
    >
      <div className="color-picker-swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`color-swatch ${c === previewValue ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => selectColor(c)}
            title={c}
          />
        ))}
      </div>
      <div className="color-picker-custom">
        <label>
          Custom:
          <input
            type="color"
            value={previewValue}
            onChange={(e) => setPreviewValue(e.target.value)}
          />
        </label>
        <div className="color-picker-actions">
          <button className="btn ghost small" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary small" onClick={() => onChange(previewValue)}>Confirm</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="color-picker" ref={anchorRef}>
      <button
        className="color-picker-trigger"
        onClick={() => setOpen(!open)}
        style={{ background: value }}
        title="Pick a color"
        aria-label="Pick a color"
      >
        <ChevronIcon className={open ? "rot" : ""} />
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  );
}