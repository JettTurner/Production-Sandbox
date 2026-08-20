import { useEffect, useRef, useState } from "react";

interface ColumnResizerProps {
  onResize: (dx: number) => void;
}

export default function ColumnResizer({ onResize }: ColumnResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => onResize(e.clientX - startRef.current);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, onResize]);

  return (
    <div
      className={`col-resizer ${dragging ? "active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        startRef.current = e.clientX;
        setDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
    />
  );
}