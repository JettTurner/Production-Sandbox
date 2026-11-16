import type { SectionRef } from "./Designer";
import { ChevronIcon, TemplatesIcon } from "./icons";

export interface Crumb {
  key: string;
  label: string;
  onClick: () => void;
}

interface CrumbsProps {
  /** Sections the user came through to get here (opening a block from inside another section). */
  origins: SectionRef[];
  onBackTo: (index: number) => void;
  /** The section being edited. */
  section: SectionRef;
  onSectionRoot: () => void;
  /** Folders inside the section, outermost first. */
  trail: Crumb[];
  hint?: string;
}

const label = (s: SectionRef) => (s.kind === "root" ? "Root" : s.name!);

/**
 * The path bar shared by every view: where you came from (so there is always a
 * way back out of a block), then the section, then the folders inside it.
 */
export default function Crumbs({ origins, onBackTo, section, onSectionRoot, trail, hint }: CrumbsProps) {
  return (
    <nav className="crumbs" aria-label="Path">
      {origins.map((o, i) => (
        <span key={`o${i}`} className="crumb-origin">
          <button type="button" onClick={() => onBackTo(i)} title={`Back to ${label(o)}`}>
            {o.kind === "template" && <TemplatesIcon />}
            {label(o)}
          </button>
          <ChevronIcon />
        </span>
      ))}
      <button type="button" className={section.kind === "template" ? "crumb-block" : ""} onClick={onSectionRoot}>
        {section.kind === "template" && <TemplatesIcon />}
        {label(section)}
      </button>
      {trail.map((c) => (
        <span key={c.key}>
          <ChevronIcon />
          <button type="button" onClick={c.onClick}>{c.label}</button>
        </span>
      ))}
      {hint && <span className="crumbs-hint">{hint}</span>}
    </nav>
  );
}
