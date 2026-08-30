import type { ReactNode } from "react";

export interface LeftRailTab<T extends string = string> {
  id: T;
  label: string;
  icon: ReactNode;
  title?: string;
}

interface LeftRailProps<T extends string> {
  tabs: LeftRailTab<T>[];
  active: T | null;
  onToggle: (id: T) => void;
}

// Traditional vertical tab rail pinned to the screen's left edge (desktop).
// Each tab is an icon + vertical label; clicking the active one collapses the
// column, clicking another swaps the content in the leftmost column. The tab
// set is data-driven so more panes can be added later without new markup.
export default function LeftRail<T extends string>({ tabs, active, onToggle }: LeftRailProps<T>) {
  return (
    <nav className="left-rail" aria-label="Left panel tabs">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            className={`left-rail-tab ${isActive ? "active" : ""}`}
            onClick={() => onToggle(t.id)}
            title={t.title ?? t.label}
            aria-pressed={isActive}
          >
            {t.icon}
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
