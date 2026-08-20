import { useEffect, useRef, useState } from "react";

interface ColumnResizerProps {
  onResize: (dx: number) => void;
}

export default function ColumnResizer({ onResize }: ColumnResizerProps) {
  const [dragging, setDragging] = useState(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      onResize(e.clientX - lastXRef.current);
      lastXRef.current = e.clientX;
    };
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
        lastXRef.current = e.clientX;
        setDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
    />
  );
}